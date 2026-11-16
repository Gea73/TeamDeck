import {
  encodeMimeEmailToBase64Url,
  validateGmailMessageInput,
} from '../../src/domain/gmailComposer';
import {
  buildGoogleCalendarEventPayload,
  validateCalendarRehearsalInput,
} from '../../src/domain/googleCalendarBuilder';
import {
  CreateCalendarRehearsalInput,
  GoogleCalendarCreateResult,
} from '../../src/types/workspace';

const GMAIL_SEND_ENDPOINT =
  'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';
const CALENDAR_EVENTS_ENDPOINT =
  'https://www.googleapis.com/calendar/v3/calendars/primary/events';

export class GoogleWorkspaceApiError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: string[];

  constructor(
    message: string,
    statusCode: number,
    code = 'WORKSPACE_API_ERROR',
    details?: string[]
  ) {
    super(message);
    this.name = 'GoogleWorkspaceApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

interface GoogleApiErrorEnvelope {
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
}

function mapGoogleHttpError(
  serviceName: 'Gmail' | 'Google Calendar',
  status: number,
  apiMessage: string
): GoogleWorkspaceApiError {
  console.error(`[TeamDeck] Erro ${serviceName} API:`, { status, apiMessage });

  if (status === 401) {
    return new GoogleWorkspaceApiError(
      `Sessão Google expirada ou inválida ao acessar o ${serviceName}. Renove a conexão e tente novamente.`,
      401,
      'GOOGLE_TOKEN_EXPIRED'
    );
  }
  if (status === 403) {
    return new GoogleWorkspaceApiError(
      `Permissão insuficiente para ${serviceName}. Reconecte sua conta Google concedendo os escopos necessários.`,
      403,
      'GOOGLE_INSUFFICIENT_SCOPE'
    );
  }
  if (status === 429) {
    return new GoogleWorkspaceApiError(
      `Limite temporário de requisições da API do ${serviceName} atingido. Aguarde alguns instantes e tente reenviar.`,
      429,
      'GOOGLE_RATE_LIMIT'
    );
  }
  if (status === 400) {
    return new GoogleWorkspaceApiError(
      `Os parâmetros enviados para o ${serviceName} foram rejeitados pela API.`,
      400,
      'GOOGLE_BAD_REQUEST'
    );
  }

  return new GoogleWorkspaceApiError(
    `Falha na operação do ${serviceName} (HTTP ${status}).`,
    status >= 400 && status < 500 ? status : 502,
    'WORKSPACE_API_ERROR'
  );
}

export interface SendGmailMessageResult {
  gmailMessageId: string;
  gmailThreadId: string | null;
  sentAt: string;
}

export async function sendGmailMessage(params: {
  accessToken: string;
  fromEmail?: string | null;
  recipientEmail: string;
  subject: string;
  bodyText: string;
}): Promise<SendGmailMessageResult> {
  const validation = validateGmailMessageInput({
    recipientEmail: params.recipientEmail,
    subject: params.subject,
    bodyText: params.bodyText,
  });

  if (!validation.valid) {
    const firstErr = Object.values(validation.errors)[0] || 'Dados inválidos.';
    throw new GoogleWorkspaceApiError(firstErr, 400, 'INVALID_EMAIL_INPUT');
  }

  const raw = encodeMimeEmailToBase64Url({
    to: params.recipientEmail,
    subject: params.subject,
    bodyText: params.bodyText,
    fromEmail: params.fromEmail,
  });

  let response: Response;
  try {
    response = await fetch(GMAIL_SEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw }),
    });
  } catch (networkErr) {
    console.error('[TeamDeck] Erro de rede Gmail API:', networkErr);
    throw new GoogleWorkspaceApiError(
      'Falha de comunicação com a Gmail API. Verifique sua conexão e tente novamente.',
      502,
      'NETWORK_ERROR'
    );
  }

  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    throw new GoogleWorkspaceApiError(
      `Resposta inválida da Gmail API (HTTP ${response.status}).`,
      502,
      'INVALID_API_RESPONSE'
    );
  }

  if (!response.ok) {
    const apiErr = (data as GoogleApiErrorEnvelope | null)?.error;
    throw mapGoogleHttpError(
      'Gmail',
      response.status,
      apiErr?.message || `HTTP ${response.status}`
    );
  }

  const gmailResp = data as { id?: string; threadId?: string };
  if (!gmailResp.id) {
    throw new GoogleWorkspaceApiError(
      'A Gmail API não confirmou o identificador da mensagem enviada.',
      502,
      'MISSING_GMAIL_ID'
    );
  }

  return {
    gmailMessageId: gmailResp.id,
    gmailThreadId: gmailResp.threadId ?? null,
    sentAt: new Date().toISOString(),
  };
}

export async function createGoogleCalendarRehearsal(params: {
  accessToken: string;
  input: CreateCalendarRehearsalInput;
}): Promise<GoogleCalendarCreateResult> {
  const validation = validateCalendarRehearsalInput(params.input);
  if (!validation.valid) {
    const firstErr =
      Object.values(validation.errors)[0] || 'Dados inválidos do ensaio.';
    throw new GoogleWorkspaceApiError(firstErr, 400, 'INVALID_CALENDAR_INPUT');
  }

  const eventBody = buildGoogleCalendarEventPayload(params.input);
  const queryParams = new URLSearchParams({
    sendUpdates: 'all',
  });
  if (params.input.generateGoogleMeet) {
    queryParams.set('conferenceDataVersion', '1');
  }

  let response: Response;
  try {
    response = await fetch(
      `${CALENDAR_EVENTS_ENDPOINT}?${queryParams.toString()}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${params.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventBody),
      }
    );
  } catch (networkErr) {
    console.error('[TeamDeck] Erro de rede Google Calendar API:', networkErr);
    throw new GoogleWorkspaceApiError(
      'Falha de comunicação com a Google Calendar API. Verifique sua conexão e tente novamente.',
      502,
      'NETWORK_ERROR'
    );
  }

  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    throw new GoogleWorkspaceApiError(
      `Resposta inválida da Google Calendar API (HTTP ${response.status}).`,
      502,
      'INVALID_API_RESPONSE'
    );
  }

  if (!response.ok) {
    const apiErr = (data as GoogleApiErrorEnvelope | null)?.error;
    throw mapGoogleHttpError(
      'Google Calendar',
      response.status,
      apiErr?.message || `HTTP ${response.status}`
    );
  }

  const calResp = data as {
    id?: string;
    htmlLink?: string;
    hangoutLink?: string;
    conferenceData?: {
      entryPoints?: Array<{ entryPointType?: string; uri?: string }>;
    };
  };

  if (!calResp.id) {
    throw new GoogleWorkspaceApiError(
      'A Google Calendar API não retornou o identificador do evento criado.',
      502,
      'MISSING_EVENT_ID'
    );
  }

  const meetEntryUri =
    calResp.hangoutLink ||
    calResp.conferenceData?.entryPoints?.find(
      (ep) => ep.entryPointType === 'video' && ep.uri
    )?.uri ||
    null;

  return {
    googleCalendarEventId: calResp.id,
    googleCalendarHtmlLink:
      calResp.htmlLink ||
      `https://calendar.google.com/calendar/event?eid=${encodeURIComponent(
        calResp.id
      )}`,
    googleMeetLink: meetEntryUri,
    syncedAt: new Date().toISOString(),
  };
}
