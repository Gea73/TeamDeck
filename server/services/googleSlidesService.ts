import {
  buildCreateSlidesBatchRequests,
  buildPopulateSlidesBatchRequests,
  buildSlideDeckPlan,
  SLIDE_HEIGHT_EMU,
  SLIDE_WIDTH_EMU,
  SlideDeckBuildInput,
  SlidesBatchRequest,
} from '../../src/domain/googleSlidesBuilder';
import { PresentationSlide } from '../../src/types';

const GOOGLE_SLIDES_API_BASE = 'https://slides.googleapis.com/v1/presentations';
const IDEMPOTENCY_TTL_MS = 5 * 60 * 1000;
const GENERATED_TRACK_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_REQUESTS_PER_BATCH = 250;

export interface GoogleSlidesGenerationResult {
  presentationId: string;
  presentationUrl: string;
  title: string;
  slideCount: number;
  approvedSectionIds: string[];
  generatedAt: string;
  slides: PresentationSlide[];
}

export class GoogleSlidesServiceError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: string[];

  constructor(
    message: string,
    statusCode = 500,
    details?: string[],
    code = 'SLIDES_API_ERROR'
  ) {
    super(message);
    this.name = 'GoogleSlidesServiceError';
    this.statusCode = statusCode;
    this.details = details;
    this.code = code;
  }
}

interface GoogleSlideRaw {
  objectId?: string;
  slideProperties?: {
    notesPage?: {
      notesProperties?: {
        speakerNotesObjectId?: string;
      };
    };
  };
}

interface GooglePresentationRaw {
  presentationId?: string;
  slides?: GoogleSlideRaw[];
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
}

const inFlightProjectGenerations = new Set<string>();
const completedIdempotencyCache = new Map<
  string,
  { expiresAt: number; result: GoogleSlidesGenerationResult }
>();
const serverGeneratedPresentations = new Map<
  string,
  { presentationId: string; expiresAt: number }
>();

function pruneExpiredState(now: number): void {
  for (const [key, entry] of completedIdempotencyCache.entries()) {
    if (entry.expiresAt <= now) {
      completedIdempotencyCache.delete(key);
    }
  }
  for (const [key, entry] of serverGeneratedPresentations.entries()) {
    if (entry.expiresAt <= now) {
      serverGeneratedPresentations.delete(key);
    }
  }
}

async function callSlidesApi<T>(
  url: string,
  accessToken: string,
  options: RequestInit = {}
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        ...(options.headers ?? {}),
      },
    });
  } catch (networkErr) {
    console.error('[TeamDeck] Rede Google Slides API:', networkErr);
    throw new GoogleSlidesServiceError(
      'Falha de comunicação com a Google Slides API. Verifique sua conexão e tente novamente.',
      502,
      undefined,
      'NETWORK_ERROR'
    );
  }

  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    throw new GoogleSlidesServiceError(
      `Resposta inválida recebida da Google Slides API (HTTP ${response.status}).`,
      502,
      undefined,
      'INVALID_API_RESPONSE'
    );
  }

  if (!response.ok) {
    const apiErr = (data as GooglePresentationRaw | null)?.error;
    console.error('[TeamDeck] Erro Google Slides API:', {
      status: response.status,
      apiMessage: apiErr?.message,
    });

    if (response.status === 401) {
      throw new GoogleSlidesServiceError(
        'Sessão Google expirada ou token inválido. Renove a conexão com o Google e tente novamente.',
        401,
        undefined,
        'GOOGLE_TOKEN_EXPIRED'
      );
    }
    if (response.status === 403) {
      throw new GoogleSlidesServiceError(
        'Permissão insuficiente para criar ou editar apresentações no Google Slides.',
        403,
        undefined,
        'GOOGLE_INSUFFICIENT_SCOPE'
      );
    }
    if (response.status === 429) {
      throw new GoogleSlidesServiceError(
        'Limite de requisições da Google Slides API atingido. Tente novamente em instantes.',
        429,
        undefined,
        'GOOGLE_RATE_LIMIT'
      );
    }

    throw new GoogleSlidesServiceError(
      'A Google Slides API recusou a operação solicitada.',
      response.status >= 400 && response.status < 500 ? response.status : 502,
      undefined,
      'SLIDES_API_ERROR'
    );
  }

  return data as T;
}

async function executeBatchedUpdate(
  presentationId: string,
  accessToken: string,
  requests: SlidesBatchRequest[]
): Promise<void> {
  for (let i = 0; i < requests.length; i += MAX_REQUESTS_PER_BATCH) {
    const chunk = requests.slice(i, i + MAX_REQUESTS_PER_BATCH);
    if (chunk.length === 0) continue;

    await callSlidesApi<unknown>(
      `${GOOGLE_SLIDES_API_BASE}/${encodeURIComponent(presentationId)}:batchUpdate`,
      accessToken,
      {
        method: 'POST',
        body: JSON.stringify({ requests: chunk }),
      }
    );
  }
}

export async function generateGoogleSlidesPresentation(params: {
  accessToken: string;
  sessionId?: string;
  deckInput: SlideDeckBuildInput;
  requestId?: string;
  existingPresentationId?: string | null;
  confirmDuplicate?: boolean;
}): Promise<GoogleSlidesGenerationResult> {
  const {
    accessToken,
    sessionId = 'anon',
    deckInput,
    requestId,
    existingPresentationId,
    confirmDuplicate,
  } = params;

  const projectId = deckInput.projectId;
  const projectScopeKey = `${sessionId}:${projectId}`;
  const now = Date.now();
  pruneExpiredState(now);

  const idempotencyKey = requestId
    ? `${sessionId}:${projectId}:${requestId}`
    : null;
  if (idempotencyKey) {
    const cached = completedIdempotencyCache.get(idempotencyKey);
    if (cached && cached.expiresAt > now) {
      return cached.result;
    }
  }

  const serverExisting = serverGeneratedPresentations.get(projectScopeKey);
  if ((existingPresentationId || serverExisting) && !confirmDuplicate) {
    throw new GoogleSlidesServiceError(
      'Este projeto já possui uma apresentação vinculada no Google Slides. Confirme explicitamente para gerar uma nova versão sem duplicidade acidental.',
      409,
      undefined,
      'DUPLICATE_CONFIRMATION_REQUIRED'
    );
  }

  if (inFlightProjectGenerations.has(projectScopeKey)) {
    throw new GoogleSlidesServiceError(
      'Já existe uma geração de slides em andamento para este projeto. Aguarde a conclusão.',
      409,
      undefined,
      'GENERATION_IN_FLIGHT'
    );
  }

  let plan;
  try {
    plan = buildSlideDeckPlan(deckInput);
  } catch (planError) {
    throw new GoogleSlidesServiceError(
      planError instanceof Error
        ? planError.message
        : 'Dados inválidos para montar o roteiro da apresentação.',
      400,
      undefined,
      'INVALID_DECK_PLAN'
    );
  }

  inFlightProjectGenerations.add(projectScopeKey);
  let createdPresentationId: string | null = null;

  try {
    // 1. Criar apresentação widescreen 16:9
    const created = await callSlidesApi<GooglePresentationRaw>(
      GOOGLE_SLIDES_API_BASE,
      accessToken,
      {
        method: 'POST',
        body: JSON.stringify({
          title: plan.presentationTitle,
          pageSize: {
            width: { magnitude: SLIDE_WIDTH_EMU, unit: 'EMU' },
            height: { magnitude: SLIDE_HEIGHT_EMU, unit: 'EMU' },
          },
        }),
      }
    );

    const presentationId = created.presentationId;
    if (!presentationId) {
      throw new GoogleSlidesServiceError(
        'A Google Slides API não retornou o identificador da apresentação criada.',
        502,
        undefined,
        'MISSING_PRESENTATION_ID'
      );
    }
    createdPresentationId = presentationId;

    const initialDefaultSlideId = created.slides?.[0]?.objectId ?? null;

    // 2. Criar os slides estruturados e remover o slide em branco inicial
    const createSlideRequests = buildCreateSlidesBatchRequests(
      plan,
      initialDefaultSlideId
    );
    await executeBatchedUpdate(presentationId, accessToken, createSlideRequests);

    // 3. Consultar speakerNotesObjectId de cada slide criado
    const presentationDetails = await callSlidesApi<GooglePresentationRaw>(
      `${GOOGLE_SLIDES_API_BASE}/${encodeURIComponent(
        presentationId
      )}?fields=slides(objectId,slideProperties/notesPage/notesProperties/speakerNotesObjectId)`,
      accessToken,
      { method: 'GET' }
    );

    const slideIdToSpeakerNotesId: Record<string, string> = {};
    for (const slide of presentationDetails.slides ?? []) {
      const slideObjId = slide.objectId;
      const notesObjId =
        slide.slideProperties?.notesPage?.notesProperties?.speakerNotesObjectId;
      if (slideObjId && notesObjId) {
        slideIdToSpeakerNotesId[slideObjId] = notesObjId;
      }
    }

    // 4. Inserir textos, layouts visuais e notas do apresentador em todos os slides
    const populateRequests = buildPopulateSlidesBatchRequests(
      plan,
      slideIdToSpeakerNotesId
    );
    await executeBatchedUpdate(presentationId, accessToken, populateRequests);

    const result: GoogleSlidesGenerationResult = {
      presentationId,
      presentationUrl: `https://docs.google.com/presentation/d/${presentationId}/edit`,
      title: plan.presentationTitle,
      slideCount: plan.slides.length,
      approvedSectionIds: plan.approvedSectionIds,
      generatedAt: new Date().toISOString(),
      slides: plan.previewSlides,
    };

    serverGeneratedPresentations.set(projectScopeKey, {
      presentationId,
      expiresAt: Date.now() + GENERATED_TRACK_TTL_MS,
    });

    if (idempotencyKey) {
      completedIdempotencyCache.set(idempotencyKey, {
        expiresAt: Date.now() + IDEMPOTENCY_TTL_MS,
        result,
      });
    }

    return result;
  } catch (err) {
    if (createdPresentationId && err instanceof GoogleSlidesServiceError) {
      throw new GoogleSlidesServiceError(
        `${err.message} Um arquivo parcial foi criado no seu Google Drive (ID: ${createdPresentationId}) e precisa ser revisado ou removido manualmente.`,
        err.statusCode,
        [`Apresentação parcial: https://docs.google.com/presentation/d/${createdPresentationId}/edit`],
        err.code
      );
    }
    throw err;
  } finally {
    inFlightProjectGenerations.delete(projectScopeKey);
  }
}
