import {
  CalculatedSectionDistribution,
  ContentDistributionSummary,
  formatDurationSecondsPtBr,
} from './contentDistribution';
import {
  PdfSectionAnalysis,
  PdfStructuredAnalysis,
  PdfVisualElement,
} from '../types/pdfAnalysis';
import { PresentationSlide } from '../types';

export const SLIDE_WIDTH_PT = 720; // 9144000 EMU (16:9 widescreen)
export const SLIDE_HEIGHT_PT = 405; // 5143500 EMU (16:9 widescreen)
export const SLIDE_WIDTH_EMU = 9144000;
export const SLIDE_HEIGHT_EMU = 5143500;

export type SlideLayoutType =
  | 'cover'
  | 'section_standard'
  | 'section_visual_split'
  | 'section_two_column'
  | 'conclusion';

export interface SlideDeckBuildInput {
  projectId: string;
  projectTitle: string;
  projectDescription: string;
  discipline: string;
  institution: string;
  advisor: string;
  presentationDate: string;
  presentationTime: string;
  location: string;
  memberNames: string[];
  pdfFileName?: string | null;
  pdfAnalysis?: PdfStructuredAnalysis | null;
  distributionSummary: ContentDistributionSummary;
  approvedSectionIds: string[];
}

export interface PlannedSlide {
  slideObjectId: string;
  slideNumber: number;
  layoutType: SlideLayoutType;
  sectionId: string | null;
  title: string;
  subtitle: string;
  bulletPoints: string[];
  visualCallouts: string[];
  assignedMemberName: string;
  durationSeconds: number;
  durationLabel: string;
  sourcePages: number[];
  speakerNotes: string;
}

export interface BuiltSlideDeckPlan {
  presentationTitle: string;
  projectTitle: string;
  discipline: string;
  institution: string;
  advisor: string;
  presentationDate: string;
  presentationTime: string;
  location: string;
  memberNames: string[];
  pdfFileName: string | null;
  totalDurationSeconds: number;
  totalDurationLabel: string;
  approvedSectionIds: string[];
  slides: PlannedSlide[];
  previewSlides: PresentationSlide[];
}

interface RgbColor {
  red: number;
  green: number;
  blue: number;
}

const COLORS = {
  ROYAL_BLUE: { red: 29 / 255, green: 78 / 255, blue: 216 / 255 },
  DARK_BLUE: { red: 30 / 255, green: 58 / 255, blue: 138 / 255 },
  NAVY: { red: 15 / 255, green: 23 / 255, blue: 42 / 255 },
  SLATE: { red: 71 / 255, green: 85 / 255, blue: 105 / 255 },
  MUTED: { red: 100 / 255, green: 116 / 255, blue: 139 / 255 },
  WHITE: { red: 1, green: 1, blue: 1 },
  SOFT_BLUE_BG: { red: 239 / 255, green: 246 / 255, blue: 1 },
  SOFT_BLUE_BORDER: { red: 191 / 255, green: 219 / 255, blue: 254 / 255 },
  LIGHT_SURFACE: { red: 248 / 255, green: 250 / 255, blue: 252 / 255 },
  BORDER_GRAY: { red: 203 / 255, green: 213 / 255, blue: 225 / 255 },
} satisfies Record<string, RgbColor>;

const MAX_BULLETS_PER_SLIDE = 4;
const MAX_BULLET_CHARS = 135;
const MAX_SUBTITLE_CHARS = 185;

function sanitizeSlidesObjectId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '_');
  const prefixed = /^[a-zA-Z0-9_]/.test(cleaned) ? cleaned : `id_${cleaned}`;
  return prefixed.slice(0, 48);
}

export function condenseTextForSlide(text: string, maxChars: number): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxChars) return normalized;

  const sliced = normalized.slice(0, maxChars - 1);
  const lastSpace = sliced.lastIndexOf(' ');
  const cutoff = lastSpace > maxChars * 0.6 ? lastSpace : maxChars - 1;
  return `${sliced.slice(0, cutoff).trimEnd()}…`;
}

export function formatSourcePagesLabel(pages: number[]): string {
  const unique = Array.from(
    new Set(pages.filter((p) => Number.isInteger(p) && p > 0))
  ).sort((a, b) => a - b);
  if (unique.length === 0) return 'Origem: conteúdo do projeto';
  if (unique.length === 1) return `Pág. ${unique[0]}`;
  return `Págs. ${unique.join(', ')}`;
}

function splitSummaryIntoConciseBullets(summary: string): string[] {
  const normalized = summary.replace(/\s+/g, ' ').trim();
  if (!normalized) return [];

  const sentences = normalized
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (sentences.length <= 1) {
    return [condenseTextForSlide(normalized, MAX_BULLET_CHARS)];
  }

  return sentences.map((s) => condenseTextForSlide(s, MAX_BULLET_CHARS));
}

function formatVisualCallout(element: PdfVisualElement): string {
  const typeLabelMap: Record<PdfVisualElement['type'], string> = {
    imagem: 'Imagem',
    tabela: 'Tabela',
    grafico: 'Gráfico',
    diagrama: 'Diagrama',
  };
  const typeLabel = typeLabelMap[element.type] ?? 'Elemento visual';
  const pages = formatSourcePagesLabel(element.sourcePages);
  const desc = condenseTextForSlide(element.description, 95);
  return `[${typeLabel}] ${condenseTextForSlide(element.title, 60)} (${pages})${
    desc ? ` — ${desc}` : ''
  }`;
}

function buildSectionBullets(
  distSection: CalculatedSectionDistribution,
  pdfSection?: PdfSectionAnalysis
): string[] {
  const rawTopics =
    pdfSection && pdfSection.mainTopics.length > 0
      ? pdfSection.mainTopics
      : splitSummaryIntoConciseBullets(distSection.summary);

  const normalizedTopics = rawTopics
    .map((t) => condenseTextForSlide(t, MAX_BULLET_CHARS))
    .filter(Boolean);

  if (normalizedTopics.length > 0) {
    return normalizedTopics;
  }

  return ['Apresentar os pontos centrais desta seção conforme o documento-base.'];
}

function chunkBullets(bullets: string[], maxPerSlide: number): string[][] {
  if (bullets.length <= maxPerSlide) return [bullets];
  const chunks: string[][] = [];
  for (let i = 0; i < bullets.length; i += maxPerSlide) {
    chunks.push(bullets.slice(i, i + maxPerSlide));
  }
  return chunks;
}

function buildSpeakerNotesText(params: {
  speakerName: string;
  durationLabel: string;
  speech: string;
  transition: string;
  sourcePages: number[];
}): string {
  const sourceNote =
    params.sourcePages.length > 0
      ? `Referência no documento: ${formatSourcePagesLabel(params.sourcePages)}`
      : 'Referência: conteúdo estruturado do projeto';

  return [
    `Integrante responsável: ${params.speakerName}`,
    `Tempo estimado: ${params.durationLabel}`,
    sourceNote,
    '',
    'Discurso sugerido:',
    params.speech,
    '',
    'Transição para o próximo slide:',
    params.transition,
  ].join('\n');
}

function formatDateDisplay(dateStr: string): string {
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export function buildSlideDeckPlan(
  input: SlideDeckBuildInput
): BuiltSlideDeckPlan {
  const approvedSet = new Set(input.approvedSectionIds);
  const orderedApprovedSections = [...input.distributionSummary.sections]
    .filter((section) => approvedSet.has(section.id))
    .sort((a, b) => a.order - b.order);

  if (orderedApprovedSections.length === 0) {
    throw new Error(
      'Selecione e aprove pelo menos uma seção do documento para gerar a apresentação.'
    );
  }

  const pdfSectionMap = new Map<string, PdfSectionAnalysis>(
    (input.pdfAnalysis?.sections ?? []).map((s) => [s.id, s])
  );

  const deckTitle = input.pdfAnalysis?.documentTitle?.trim()
    ? input.pdfAnalysis.documentTitle.trim()
    : input.projectTitle.trim();

  const approvedDurationSeconds = orderedApprovedSections.reduce(
    (sum, s) => sum + s.durationSeconds,
    0
  );
  const totalDurationLabel = formatDurationSecondsPtBr(approvedDurationSeconds);

  const firstPresenter =
    orderedApprovedSections.find((s) => s.assignedMemberName)?.assignedMemberName ??
    input.memberNames[0] ??
    'Equipe do projeto';

  const lastPresenter =
    [...orderedApprovedSections]
      .reverse()
      .find((s) => s.assignedMemberName)?.assignedMemberName ??
    firstPresenter;

  const coverSubtitleSource = input.pdfAnalysis?.mainObjective?.text?.trim()
    ? input.pdfAnalysis.mainObjective.text.trim()
    : input.projectDescription.trim();

  const coverSourcePages = [
    ...(input.pdfAnalysis?.documentTitleSourcePages ?? []),
    ...(input.pdfAnalysis?.mainObjective?.sourcePages ?? []),
  ];

  // 1. Slide de Capa
  const draftSlides: Omit<PlannedSlide, 'slideNumber' | 'speakerNotes'>[] = [];

  draftSlides.push({
    slideObjectId: sanitizeSlidesObjectId('sl_cover_01'),
    layoutType: 'cover',
    sectionId: null,
    title: condenseTextForSlide(deckTitle, 110),
    subtitle: condenseTextForSlide(coverSubtitleSource, 220),
    bulletPoints: [
      `Disciplina: ${input.discipline}`,
      `Orientação: ${input.advisor}`,
      `Apresentação: ${formatDateDisplay(input.presentationDate)} às ${input.presentationTime} (${input.location})`,
      `Equipe: ${input.memberNames.length > 0 ? input.memberNames.join(', ') : 'A definir'}`,
    ],
    visualCallouts: [],
    assignedMemberName: firstPresenter,
    durationSeconds: 30,
    durationLabel: '30s (abertura)',
    sourcePages: coverSourcePages,
  });

  // 2. Slides das seções aprovadas
  let sectionLayoutToggle = 0;

  for (const distSection of orderedApprovedSections) {
    const pdfSection = pdfSectionMap.get(distSection.id);
    const allBullets = buildSectionBullets(distSection, pdfSection);
    const bulletChunks = chunkBullets(allBullets, MAX_BULLETS_PER_SLIDE);
    const visualCallouts = distSection.uniqueVisualElements.map(
      formatVisualCallout
    );

    const speakerName =
      distSection.assignedMemberName?.trim() || 'Integrante a definir';
    const perPartSeconds = distSection.durationSeconds / bulletChunks.length;

    bulletChunks.forEach((chunk, chunkIndex) => {
      const isMultiPart = bulletChunks.length > 1;
      const partSuffix = isMultiPart
        ? ` (Parte ${chunkIndex + 1}/${bulletChunks.length})`
        : '';

      const hasVisualsOnThisSlide = chunkIndex === 0 && visualCallouts.length > 0;

      let layoutType: SlideLayoutType;
      if (hasVisualsOnThisSlide) {
        layoutType = 'section_visual_split';
      } else if (chunk.length >= 3 && sectionLayoutToggle % 2 === 1) {
        layoutType = 'section_two_column';
      } else {
        layoutType = 'section_standard';
      }
      sectionLayoutToggle += 1;

      const summaryText =
        chunkIndex === 0
          ? condenseTextForSlide(distSection.summary, MAX_SUBTITLE_CHARS)
          : `Continuação da seção: ${condenseTextForSlide(distSection.title, 90)}`;

      draftSlides.push({
        slideObjectId: sanitizeSlidesObjectId(
          `sl_sec_${distSection.order}_p${chunkIndex + 1}`
        ),
        layoutType,
        sectionId: distSection.id,
        title: `${condenseTextForSlide(distSection.title, 85)}${partSuffix}`,
        subtitle: summaryText,
        bulletPoints: chunk,
        visualCallouts: hasVisualsOnThisSlide ? visualCallouts : [],
        assignedMemberName: speakerName,
        durationSeconds: perPartSeconds,
        durationLabel: isMultiPart
          ? `${formatDurationSecondsPtBr(perPartSeconds)} (de ${formatDurationSecondsPtBr(distSection.durationSeconds)})`
          : formatDurationSecondsPtBr(distSection.durationSeconds),
        sourcePages: distSection.sourcePages,
      });
    });
  }

  // 3. Slide Final de Conclusão
  const explicitConclusions =
    input.pdfAnalysis?.conclusions?.explicitConclusions
      ?.map((c) => condenseTextForSlide(c, MAX_BULLET_CHARS))
      .filter(Boolean)
      .slice(0, 4) ?? [];

  const conclusionBullets =
    explicitConclusions.length > 0
      ? explicitConclusions
      : [
          `Síntese das ${orderedApprovedSections.length} seções apresentadas sobre ${condenseTextForSlide(deckTitle, 70)}.`,
          input.pdfAnalysis?.mainObjective?.text
            ? `Objetivo central retomado: ${condenseTextForSlide(input.pdfAnalysis.mainObjective.text, 105)}`
            : `Alinhamento dos resultados com o escopo de ${input.discipline}.`,
          `Tempo total estimado da apresentação: ${totalDurationLabel}.`,
        ];

  const topReferences =
    input.pdfAnalysis?.relevantReferences
      ?.slice(0, 3)
      .map(
        (ref) =>
          `${condenseTextForSlide(ref.reference, 85)} (${formatSourcePagesLabel(ref.sourcePages)})`
      ) ?? [];

  const conclusionSourcePages =
    input.pdfAnalysis?.conclusions?.sourcePages ?? [];

  draftSlides.push({
    slideObjectId: sanitizeSlidesObjectId('sl_conclusion_final'),
    layoutType: 'conclusion',
    sectionId: null,
    title: 'Conclusões e Referências',
    subtitle: `Síntese final de ${condenseTextForSlide(deckTitle, 95)}`,
    bulletPoints: conclusionBullets,
    visualCallouts: topReferences,
    assignedMemberName: lastPresenter,
    durationSeconds: 30,
    durationLabel: `30s (total ${totalDurationLabel})`,
    sourcePages: conclusionSourcePages,
  });

  // 4. Montar numeração e notas do apresentador completas com transições encadeadas
  const totalSlides = draftSlides.length;
  const slides: PlannedSlide[] = draftSlides.map((draft, index) => {
    const nextSlide = draftSlides[index + 1];

    let speech = '';
    if (draft.layoutType === 'cover') {
      speech = `Bom dia/boa tarde a todos. Apresentaremos o trabalho "${deckTitle}", da disciplina ${input.discipline}, sob orientação de ${input.advisor}. ${
        coverSubtitleSource
          ? `Nosso objetivo central é: ${condenseTextForSlide(coverSubtitleSource, 180)}`
          : ''
      } A equipe é composta por ${
        input.memberNames.length > 0 ? input.memberNames.join(', ') : firstPresenter
      }, com duração total prevista de ${totalDurationLabel}.`;
    } else if (draft.layoutType === 'conclusion') {
      const pointsText = draft.bulletPoints.join(' ');
      speech = `Para concluir nossa apresentação, destacamos os principais achados do documento: ${pointsText} Agradecemos a atenção da banca e ficamos à disposição para perguntas.`;
    } else {
      const distSection = orderedApprovedSections.find(
        (s) => s.id === draft.sectionId
      );
      const baseSummary = distSection?.summary?.trim() || draft.subtitle;
      const bulletsSpeech = draft.bulletPoints.join(' ');
      const visualNote =
        draft.visualCallouts.length > 0
          ? ` Durante esta fala, aponte os elementos visuais do documento original (${draft.visualCallouts.length} item(ns) listado(s) no painel direito).`
          : '';
      speech = `${baseSummary} Em destaque neste slide: ${bulletsSpeech}${visualNote}`;
    }

    const transition = nextSlide
      ? nextSlide.assignedMemberName !== draft.assignedMemberName
        ? `Com isso encerramos este ponto; passo a palavra para ${nextSlide.assignedMemberName}, que apresentará "${nextSlide.title}" no próximo slide.`
        : `Seguindo para o próximo slide, vamos aprofundar "${nextSlide.title}".`
      : 'Encerramos a exposição oral e abrimos espaço para arguição, dúvidas e comentários da banca avaliadora.';

    const speakerNotes = buildSpeakerNotesText({
      speakerName: draft.assignedMemberName,
      durationLabel: draft.durationLabel,
      speech,
      transition,
      sourcePages: draft.sourcePages,
    });

    return {
      ...draft,
      slideNumber: index + 1,
      speakerNotes,
    };
  });

  const previewSlides: PresentationSlide[] = slides.map((s) => ({
    id: s.slideObjectId,
    slideNumber: s.slideNumber,
    title: s.title,
    subtitle: s.subtitle,
    bulletPoints: s.bulletPoints,
    speakerNotes: s.speakerNotes,
    assignedMemberName: s.assignedMemberName,
    durationMinutes: Math.max(0.5, Number((s.durationSeconds / 60).toFixed(1))),
    durationSeconds: Math.round(s.durationSeconds),
    layoutType: s.layoutType,
    sourcePages: s.sourcePages,
    visualCallouts: s.visualCallouts,
  }));

  return {
    presentationTitle: `${input.projectTitle.trim()} — TeamDeck`,
    projectTitle: deckTitle,
    discipline: input.discipline,
    institution: input.institution,
    advisor: input.advisor,
    presentationDate: formatDateDisplay(input.presentationDate),
    presentationTime: input.presentationTime,
    location: input.location,
    memberNames: input.memberNames,
    pdfFileName: input.pdfFileName ?? null,
    totalDurationSeconds: approvedDurationSeconds,
    totalDurationLabel,
    approvedSectionIds: orderedApprovedSections.map((s) => s.id),
    slides,
    previewSlides,
  };
}

export type SlidesBatchRequest = Record<string, unknown>;

export function buildCreateSlidesBatchRequests(
  plan: BuiltSlideDeckPlan,
  initialSlideIdToDelete?: string | null
): SlidesBatchRequest[] {
  const requests: SlidesBatchRequest[] = plan.slides.map((slide, index) => ({
    createSlide: {
      objectId: slide.slideObjectId,
      insertionIndex: index,
      slideLayoutReference: {
        predefinedLayout: 'BLANK',
      },
    },
  }));

  if (initialSlideIdToDelete) {
    requests.push({
      deleteObject: {
        objectId: initialSlideIdToDelete,
      },
    });
  }

  return requests;
}

function createShapeAndStyleRequests(params: {
  objectId: string;
  slideId: string;
  shapeType: 'RECTANGLE' | 'ROUND_RECTANGLE' | 'TEXT_BOX';
  x: number;
  y: number;
  w: number;
  h: number;
  fillColor?: RgbColor;
  borderColor?: RgbColor;
  borderWeightPt?: number;
}): SlidesBatchRequest[] {
  const requests: SlidesBatchRequest[] = [
    {
      createShape: {
        objectId: params.objectId,
        shapeType: params.shapeType,
        elementProperties: {
          pageObjectId: params.slideId,
          size: {
            width: { magnitude: params.w, unit: 'PT' },
            height: { magnitude: params.h, unit: 'PT' },
          },
          transform: {
            scaleX: 1,
            scaleY: 1,
            translateX: params.x,
            translateY: params.y,
            unit: 'PT',
          },
        },
      },
    },
  ];

  const shapeProperties: Record<string, unknown> = {};
  const fields: string[] = [];

  if (params.fillColor) {
    shapeProperties.shapeBackgroundFill = {
      solidFill: {
        color: { rgbColor: params.fillColor },
        alpha: 1,
      },
    };
    fields.push(
      'shapeBackgroundFill.solidFill.color',
      'shapeBackgroundFill.solidFill.alpha'
    );
  } else {
    shapeProperties.shapeBackgroundFill = {
      propertyState: 'NOT_RENDERED',
    };
    fields.push('shapeBackgroundFill.propertyState');
  }

  if (params.borderColor) {
    shapeProperties.outline = {
      outlineFill: {
        solidFill: { color: { rgbColor: params.borderColor } },
      },
      weight: { magnitude: params.borderWeightPt ?? 1, unit: 'PT' },
      propertyState: 'RENDERED',
    };
    fields.push('outline.outlineFill', 'outline.weight', 'outline.propertyState');
  } else {
    shapeProperties.outline = {
      propertyState: 'NOT_RENDERED',
    };
    fields.push('outline.propertyState');
  }

  requests.push({
    updateShapeProperties: {
      objectId: params.objectId,
      shapeProperties,
      fields: fields.join(','),
    },
  });

  return requests;
}

function createTextBoxRequests(params: {
  objectId: string;
  slideId: string;
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  fontSizePt: number;
  fontFamily?: string;
  bold?: boolean;
  color: RgbColor;
  alignment?: 'START' | 'CENTER' | 'END';
  bullets?: boolean;
  lineSpacing?: number;
  spaceBelowPt?: number;
  fillColor?: RgbColor;
  borderColor?: RgbColor;
  shapeType?: 'TEXT_BOX' | 'RECTANGLE' | 'ROUND_RECTANGLE';
}): SlidesBatchRequest[] {
  const requests = createShapeAndStyleRequests({
    objectId: params.objectId,
    slideId: params.slideId,
    shapeType: params.shapeType ?? 'TEXT_BOX',
    x: params.x,
    y: params.y,
    w: params.w,
    h: params.h,
    fillColor: params.fillColor,
    borderColor: params.borderColor,
  });

  const cleanText = params.text.trim();
  if (!cleanText) {
    return requests;
  }

  requests.push({
    insertText: {
      objectId: params.objectId,
      insertionIndex: 0,
      text: cleanText,
    },
  });

  requests.push({
    updateTextStyle: {
      objectId: params.objectId,
      textRange: { type: 'ALL' },
      style: {
        fontFamily: params.fontFamily ?? 'Roboto',
        fontSize: { magnitude: params.fontSizePt, unit: 'PT' },
        bold: Boolean(params.bold),
        foregroundColor: {
          opaqueColor: { rgbColor: params.color },
        },
      },
      fields: 'fontFamily,fontSize,bold,foregroundColor',
    },
  });

  requests.push({
    updateParagraphStyle: {
      objectId: params.objectId,
      textRange: { type: 'ALL' },
      style: {
        alignment: params.alignment ?? 'START',
        lineSpacing: params.lineSpacing ?? 120,
        spaceBelow: { magnitude: params.spaceBelowPt ?? 4, unit: 'PT' },
      },
      fields: 'alignment,lineSpacing,spaceBelow',
    },
  });

  if (params.bullets) {
    requests.push({
      createParagraphBullets: {
        objectId: params.objectId,
        textRange: { type: 'ALL' },
        bulletPreset: 'BULLET_DISC_CIRCLE_SQUARE',
      },
    });
  }

  return requests;
}

export function buildPopulateSlidesBatchRequests(
  plan: BuiltSlideDeckPlan,
  slideIdToSpeakerNotesId: Record<string, string>
): SlidesBatchRequest[] {
  const requests: SlidesBatchRequest[] = [];
  const totalSlides = plan.slides.length;

  for (const slide of plan.slides) {
    const sid = slide.slideObjectId;
    const prefix = `s${slide.slideNumber}`;

    // Fundo branco consistente
    requests.push({
      updatePageProperties: {
        objectId: sid,
        pageProperties: {
          pageBackgroundFill: {
            solidFill: {
              color: { rgbColor: COLORS.WHITE },
              alpha: 1,
            },
          },
        },
        fields: 'pageBackgroundFill.solidFill.color,pageBackgroundFill.solidFill.alpha',
      },
    });

    if (slide.layoutType === 'cover') {
      // Barra lateral azul royal
      requests.push(
        ...createShapeAndStyleRequests({
          objectId: sanitizeSlidesObjectId(`${prefix}_accent_bar`),
          slideId: sid,
          shapeType: 'RECTANGLE',
          x: 0,
          y: 0,
          w: 22,
          h: SLIDE_HEIGHT_PT,
          fillColor: COLORS.ROYAL_BLUE,
        })
      );

      // Cabeçalho institucional
      requests.push(
        ...createTextBoxRequests({
          objectId: sanitizeSlidesObjectId(`${prefix}_eyebrow`),
          slideId: sid,
          x: 52,
          y: 38,
          w: 620,
          h: 24,
          text: `${plan.institution.toUpperCase()}  ·  ${plan.discipline.toUpperCase()}`,
          fontSizePt: 10.5,
          fontFamily: 'Plus Jakarta Sans',
          bold: true,
          color: COLORS.ROYAL_BLUE,
        })
      );

      // Título principal
      requests.push(
        ...createTextBoxRequests({
          objectId: sanitizeSlidesObjectId(`${prefix}_title`),
          slideId: sid,
          x: 52,
          y: 72,
          w: 620,
          h: 108,
          text: slide.title,
          fontSizePt: 27,
          fontFamily: 'Plus Jakarta Sans',
          bold: true,
          color: COLORS.NAVY,
          lineSpacing: 112,
        })
      );

      // Subtítulo / objetivo principal
      requests.push(
        ...createTextBoxRequests({
          objectId: sanitizeSlidesObjectId(`${prefix}_subtitle`),
          slideId: sid,
          x: 52,
          y: 186,
          w: 620,
          h: 78,
          text: slide.subtitle,
          fontSizePt: 13,
          color: COLORS.SLATE,
          lineSpacing: 125,
        })
      );

      // Cartão inferior de metadados acadêmicos
      requests.push(
        ...createShapeAndStyleRequests({
          objectId: sanitizeSlidesObjectId(`${prefix}_meta_card`),
          slideId: sid,
          shapeType: 'ROUND_RECTANGLE',
          x: 52,
          y: 280,
          w: 620,
          h: 88,
          fillColor: COLORS.LIGHT_SURFACE,
          borderColor: COLORS.BORDER_GRAY,
        })
      );

      const teamText =
        plan.memberNames.length > 0
          ? plan.memberNames.join(', ')
          : 'Integrantes a definir';

      requests.push(
        ...createTextBoxRequests({
          objectId: sanitizeSlidesObjectId(`${prefix}_meta_left`),
          slideId: sid,
          x: 68,
          y: 292,
          w: 315,
          h: 64,
          text: `Equipe: ${teamText}\nOrientação: ${plan.advisor}`,
          fontSizePt: 10.5,
          color: COLORS.NAVY,
          lineSpacing: 135,
        })
      );

      requests.push(
        ...createTextBoxRequests({
          objectId: sanitizeSlidesObjectId(`${prefix}_meta_right`),
          slideId: sid,
          x: 394,
          y: 292,
          w: 262,
          h: 64,
          text: `Data: ${plan.presentationDate} às ${plan.presentationTime}\nDuração total estimada: ${plan.totalDurationLabel}\n${
            plan.pdfFileName ? `Base: ${condenseTextForSlide(plan.pdfFileName, 36)}` : 'TeamDeck Acadêmico'
          }`,
          fontSizePt: 10,
          color: COLORS.SLATE,
          lineSpacing: 130,
        })
      );
    } else if (slide.layoutType === 'conclusion') {
      // Faixa superior azul royal
      requests.push(
        ...createShapeAndStyleRequests({
          objectId: sanitizeSlidesObjectId(`${prefix}_header_bg`),
          slideId: sid,
          shapeType: 'RECTANGLE',
          x: 0,
          y: 0,
          w: SLIDE_WIDTH_PT,
          h: 70,
          fillColor: COLORS.ROYAL_BLUE,
        })
      );

      requests.push(
        ...createTextBoxRequests({
          objectId: sanitizeSlidesObjectId(`${prefix}_eyebrow`),
          slideId: sid,
          x: 44,
          y: 12,
          w: 440,
          h: 18,
          text: 'ENCERRAMENTO E SÍNTESE FINAL',
          fontSizePt: 9.5,
          fontFamily: 'Plus Jakarta Sans',
          bold: true,
          color: COLORS.SOFT_BLUE_BORDER,
        })
      );

      requests.push(
        ...createTextBoxRequests({
          objectId: sanitizeSlidesObjectId(`${prefix}_title`),
          slideId: sid,
          x: 44,
          y: 30,
          w: 450,
          h: 32,
          text: slide.title,
          fontSizePt: 20,
          fontFamily: 'Plus Jakarta Sans',
          bold: true,
          color: COLORS.WHITE,
        })
      );

      requests.push(
        ...createTextBoxRequests({
          objectId: sanitizeSlidesObjectId(`${prefix}_total_badge`),
          slideId: sid,
          x: 500,
          y: 18,
          w: 176,
          h: 34,
          shapeType: 'ROUND_RECTANGLE',
          fillColor: COLORS.DARK_BLUE,
          text: `Duração: ${plan.totalDurationLabel}\nResp.: ${condenseTextForSlide(slide.assignedMemberName, 22)}`,
          fontSizePt: 9.5,
          bold: true,
          color: COLORS.WHITE,
          alignment: 'CENTER',
          lineSpacing: 115,
        })
      );

      // Coluna esquerda: Conclusões explícitas
      requests.push(
        ...createShapeAndStyleRequests({
          objectId: sanitizeSlidesObjectId(`${prefix}_left_card`),
          slideId: sid,
          shapeType: 'ROUND_RECTANGLE',
          x: 44,
          y: 88,
          w: 392,
          h: 278,
          fillColor: COLORS.LIGHT_SURFACE,
          borderColor: COLORS.BORDER_GRAY,
        })
      );

      requests.push(
        ...createTextBoxRequests({
          objectId: sanitizeSlidesObjectId(`${prefix}_left_label`),
          slideId: sid,
          x: 60,
          y: 100,
          w: 360,
          h: 20,
          text: `PRINCIPAIS CONCLUSÕES (${formatSourcePagesLabel(slide.sourcePages).toUpperCase()})`,
          fontSizePt: 9.5,
          fontFamily: 'Plus Jakarta Sans',
          bold: true,
          color: COLORS.ROYAL_BLUE,
        })
      );

      requests.push(
        ...createTextBoxRequests({
          objectId: sanitizeSlidesObjectId(`${prefix}_left_bullets`),
          slideId: sid,
          x: 60,
          y: 124,
          w: 360,
          h: 228,
          text: slide.bulletPoints.join('\n'),
          fontSizePt: 11.5,
          color: COLORS.NAVY,
          bullets: true,
          lineSpacing: 125,
          spaceBelowPt: 8,
        })
      );

      // Coluna direita: Referências e encerramento
      requests.push(
        ...createShapeAndStyleRequests({
          objectId: sanitizeSlidesObjectId(`${prefix}_right_card`),
          slideId: sid,
          shapeType: 'ROUND_RECTANGLE',
          x: 450,
          y: 88,
          w: 226,
          h: 278,
          fillColor: COLORS.SOFT_BLUE_BG,
          borderColor: COLORS.SOFT_BLUE_BORDER,
        })
      );

      requests.push(
        ...createTextBoxRequests({
          objectId: sanitizeSlidesObjectId(`${prefix}_right_label`),
          slideId: sid,
          x: 464,
          y: 100,
          w: 198,
          h: 20,
          text: 'REFERÊNCIAS E BANCA',
          fontSizePt: 9.5,
          fontFamily: 'Plus Jakarta Sans',
          bold: true,
          color: COLORS.ROYAL_BLUE,
        })
      );

      const refsText =
        slide.visualCallouts.length > 0
          ? `${slide.visualCallouts.map((r) => `• ${r}`).join('\n\n')}\n\nEspaço aberto para perguntas da banca.`
          : `Projeto: ${condenseTextForSlide(plan.projectTitle, 65)}\n\nEquipe: ${plan.memberNames.join(', ') || 'Grupo acadêmico'}\n\nEspaço aberto para perguntas da banca.`;

      requests.push(
        ...createTextBoxRequests({
          objectId: sanitizeSlidesObjectId(`${prefix}_right_body`),
          slideId: sid,
          x: 464,
          y: 126,
          w: 198,
          h: 226,
          text: refsText,
          fontSizePt: 10,
          color: COLORS.DARK_BLUE,
          lineSpacing: 125,
          spaceBelowPt: 6,
        })
      );
    } else {
      // Slides de Seção (3 variações de layout)
      // Barra superior fina
      requests.push(
        ...createShapeAndStyleRequests({
          objectId: sanitizeSlidesObjectId(`${prefix}_top_line`),
          slideId: sid,
          shapeType: 'RECTANGLE',
          x: 0,
          y: 0,
          w: SLIDE_WIDTH_PT,
          h: 5,
          fillColor: COLORS.ROYAL_BLUE,
        })
      );

      // Etiqueta esquerda (origem + seção)
      requests.push(
        ...createTextBoxRequests({
          objectId: sanitizeSlidesObjectId(`${prefix}_meta_left`),
          slideId: sid,
          x: 44,
          y: 18,
          w: 310,
          h: 22,
          text: `CONTEÚDO DO DOCUMENTO  ·  ${formatSourcePagesLabel(slide.sourcePages).toUpperCase()}`,
          fontSizePt: 9,
          fontFamily: 'Plus Jakarta Sans',
          bold: true,
          color: COLORS.ROYAL_BLUE,
        })
      );

      // Badge direita: Responsável + Tempo estimado
      requests.push(
        ...createTextBoxRequests({
          objectId: sanitizeSlidesObjectId(`${prefix}_speaker_badge`),
          slideId: sid,
          x: 360,
          y: 15,
          w: 316,
          h: 26,
          shapeType: 'ROUND_RECTANGLE',
          fillColor: COLORS.SOFT_BLUE_BG,
          borderColor: COLORS.SOFT_BLUE_BORDER,
          text: `Responsável: ${condenseTextForSlide(slide.assignedMemberName, 26)}  |  ${slide.durationLabel}`,
          fontSizePt: 9.5,
          bold: true,
          color: COLORS.DARK_BLUE,
          alignment: 'CENTER',
        })
      );

      // Título da seção
      requests.push(
        ...createTextBoxRequests({
          objectId: sanitizeSlidesObjectId(`${prefix}_title`),
          slideId: sid,
          x: 44,
          y: 48,
          w: 632,
          h: 42,
          text: slide.title,
          fontSizePt: 20,
          fontFamily: 'Plus Jakarta Sans',
          bold: true,
          color: COLORS.NAVY,
          lineSpacing: 110,
        })
      );

      if (slide.layoutType === 'section_visual_split') {
        requests.push(
          ...createTextBoxRequests({
            objectId: sanitizeSlidesObjectId(`${prefix}_subtitle`),
            slideId: sid,
            x: 44,
            y: 92,
            w: 632,
            h: 42,
            text: slide.subtitle,
            fontSizePt: 11,
            color: COLORS.SLATE,
            lineSpacing: 120,
          })
        );

        // Coluna esquerda: Tópicos
        requests.push(
          ...createShapeAndStyleRequests({
            objectId: sanitizeSlidesObjectId(`${prefix}_left_box`),
            slideId: sid,
            shapeType: 'ROUND_RECTANGLE',
            x: 44,
            y: 142,
            w: 368,
            h: 224,
            fillColor: COLORS.LIGHT_SURFACE,
            borderColor: COLORS.BORDER_GRAY,
          })
        );

        requests.push(
          ...createTextBoxRequests({
            objectId: sanitizeSlidesObjectId(`${prefix}_bullets`),
            slideId: sid,
            x: 58,
            y: 154,
            w: 340,
            h: 200,
            text: slide.bulletPoints.join('\n'),
            fontSizePt: 11.5,
            color: COLORS.NAVY,
            bullets: true,
            lineSpacing: 125,
            spaceBelowPt: 7,
          })
        );

        // Coluna direita: Elementos visuais identificados no documento
        requests.push(
          ...createShapeAndStyleRequests({
            objectId: sanitizeSlidesObjectId(`${prefix}_visual_card`),
            slideId: sid,
            shapeType: 'ROUND_RECTANGLE',
            x: 426,
            y: 142,
            w: 250,
            h: 224,
            fillColor: COLORS.SOFT_BLUE_BG,
            borderColor: COLORS.SOFT_BLUE_BORDER,
          })
        );

        requests.push(
          ...createTextBoxRequests({
            objectId: sanitizeSlidesObjectId(`${prefix}_visual_label`),
            slideId: sid,
            x: 440,
            y: 154,
            w: 222,
            h: 20,
            text: 'ELEMENTOS VISUAIS DO DOCUMENTO',
            fontSizePt: 9,
            fontFamily: 'Plus Jakarta Sans',
            bold: true,
            color: COLORS.ROYAL_BLUE,
          })
        );

        const visualBody =
          slide.visualCallouts.slice(0, 3).map((v) => `• ${v}`).join('\n\n') +
          '\n\nInserir figura original extraída do PDF acima.';

        requests.push(
          ...createTextBoxRequests({
            objectId: sanitizeSlidesObjectId(`${prefix}_visual_body`),
            slideId: sid,
            x: 440,
            y: 178,
            w: 222,
            h: 176,
            text: visualBody,
            fontSizePt: 9.5,
            color: COLORS.DARK_BLUE,
            lineSpacing: 120,
          })
        );
      } else if (slide.layoutType === 'section_two_column') {
        // Coluna esquerda: Síntese destacada
        requests.push(
          ...createShapeAndStyleRequests({
            objectId: sanitizeSlidesObjectId(`${prefix}_synth_card`),
            slideId: sid,
            shapeType: 'ROUND_RECTANGLE',
            x: 44,
            y: 102,
            w: 248,
            h: 264,
            fillColor: COLORS.SOFT_BLUE_BG,
            borderColor: COLORS.SOFT_BLUE_BORDER,
          })
        );

        requests.push(
          ...createTextBoxRequests({
            objectId: sanitizeSlidesObjectId(`${prefix}_synth_label`),
            slideId: sid,
            x: 58,
            y: 114,
            w: 220,
            h: 20,
            text: 'SÍNTESE DA SEÇÃO',
            fontSizePt: 9.5,
            fontFamily: 'Plus Jakarta Sans',
            bold: true,
            color: COLORS.ROYAL_BLUE,
          })
        );

        requests.push(
          ...createTextBoxRequests({
            objectId: sanitizeSlidesObjectId(`${prefix}_synth_body`),
            slideId: sid,
            x: 58,
            y: 140,
            w: 220,
            h: 212,
            text: slide.subtitle,
            fontSizePt: 11.5,
            color: COLORS.DARK_BLUE,
            lineSpacing: 130,
          })
        );

        // Coluna direita: Lista objetiva de tópicos
        requests.push(
          ...createShapeAndStyleRequests({
            objectId: sanitizeSlidesObjectId(`${prefix}_topics_card`),
            slideId: sid,
            shapeType: 'ROUND_RECTANGLE',
            x: 306,
            y: 102,
            w: 370,
            h: 264,
            fillColor: COLORS.LIGHT_SURFACE,
            borderColor: COLORS.BORDER_GRAY,
          })
        );

        requests.push(
          ...createTextBoxRequests({
            objectId: sanitizeSlidesObjectId(`${prefix}_topics_label`),
            slideId: sid,
            x: 322,
            y: 114,
            w: 338,
            h: 20,
            text: 'PONTOS PRINCIPAIS',
            fontSizePt: 9.5,
            fontFamily: 'Plus Jakarta Sans',
            bold: true,
            color: COLORS.SLATE,
          })
        );

        requests.push(
          ...createTextBoxRequests({
            objectId: sanitizeSlidesObjectId(`${prefix}_bullets`),
            slideId: sid,
            x: 322,
            y: 140,
            w: 338,
            h: 212,
            text: slide.bulletPoints.join('\n'),
            fontSizePt: 11.5,
            color: COLORS.NAVY,
            bullets: true,
            lineSpacing: 125,
            spaceBelowPt: 8,
          })
        );
      } else {
        // Layout padrão focado
        requests.push(
          ...createTextBoxRequests({
            objectId: sanitizeSlidesObjectId(`${prefix}_subtitle`),
            slideId: sid,
            x: 44,
            y: 94,
            w: 632,
            h: 46,
            text: slide.subtitle,
            fontSizePt: 11.5,
            color: COLORS.SLATE,
            lineSpacing: 125,
          })
        );

        requests.push(
          ...createShapeAndStyleRequests({
            objectId: sanitizeSlidesObjectId(`${prefix}_content_card`),
            slideId: sid,
            shapeType: 'ROUND_RECTANGLE',
            x: 44,
            y: 148,
            w: 632,
            h: 218,
            fillColor: COLORS.LIGHT_SURFACE,
            borderColor: COLORS.BORDER_GRAY,
          })
        );

        requests.push(
          ...createTextBoxRequests({
            objectId: sanitizeSlidesObjectId(`${prefix}_bullets`),
            slideId: sid,
            x: 62,
            y: 162,
            w: 596,
            h: 190,
            text: slide.bulletPoints.join('\n'),
            fontSizePt: 12.5,
            color: COLORS.NAVY,
            bullets: true,
            lineSpacing: 130,
            spaceBelowPt: 9,
          })
        );
      }
    }

    // Rodapé em todos os slides (exceto capa que já possui cartão completo)
    if (slide.layoutType !== 'cover') {
      requests.push(
        ...createTextBoxRequests({
          objectId: sanitizeSlidesObjectId(`${prefix}_footer`),
          slideId: sid,
          x: 44,
          y: 376,
          w: 632,
          h: 18,
          text: `${condenseTextForSlide(plan.projectTitle, 58)}  ·  Slide ${slide.slideNumber} de ${totalSlides}`,
          fontSizePt: 8.5,
          color: COLORS.MUTED,
        })
      );
    }

    // Notas do apresentador obrigatórias
    const notesObjectId = slideIdToSpeakerNotesId[sid];
    if (notesObjectId && slide.speakerNotes.trim()) {
      requests.push({
        insertText: {
          objectId: notesObjectId,
          insertionIndex: 0,
          text: slide.speakerNotes,
        },
      });
    }
  }

  return requests;
}
