import {
  InformationOriginType,
  PdfAiInterpretationItem,
  PdfArgumentItem,
  PdfConceptItem,
  PdfExampleItem,
  PdfReferenceItem,
  PdfSectionAnalysis,
  PdfStructuredAnalysis,
  PdfUncertaintyItem,
  PdfVisualElement,
  VisualElementType,
} from '../types/pdfAnalysis';

export const PDF_MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB
export const ALLOWED_PDF_MIME_TYPES = new Set([
  'application/pdf',
  'application/x-pdf',
]);

export interface PdfFileValidationInput {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  headerBytes?: Uint8Array;
}

export interface PdfFileValidationResult {
  valid: boolean;
  error?: string;
}

export function validatePdfFile(
  input: PdfFileValidationInput
): PdfFileValidationResult {
  const normalizedName = input.fileName.trim().toLowerCase();
  if (!normalizedName.endsWith('.pdf')) {
    return {
      valid: false,
      error: 'Extensão inválida. Envie apenas arquivos com extensão .pdf.',
    };
  }

  const normalizedMime = input.mimeType.trim().toLowerCase();
  if (!ALLOWED_PDF_MIME_TYPES.has(normalizedMime)) {
    return {
      valid: false,
      error: `Tipo MIME inválido (${input.mimeType || 'desconhecido'}). Apenas application/pdf é permitido.`,
    };
  }

  if (!Number.isFinite(input.sizeBytes) || input.sizeBytes <= 0) {
    return {
      valid: false,
      error: 'O arquivo PDF está vazio ou corrompido.',
    };
  }

  if (input.sizeBytes > PDF_MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: 'O arquivo excede o limite máximo de 20 MB.',
    };
  }

  if (input.headerBytes && input.headerBytes.length >= 4) {
    const signature = String.fromCharCode(
      input.headerBytes[0],
      input.headerBytes[1],
      input.headerBytes[2],
      input.headerBytes[3]
    );
    if (signature !== '%PDF') {
      return {
        valid: false,
        error:
          'Assinatura binária inválida. O conteúdo do arquivo não corresponde a um PDF válido.',
      };
    }
  }

  return { valid: true };
}

export function formatBytesPtBr(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1).replace('.', ',')} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(2).replace('.', ',')} MB`;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.every((item) => typeof item === 'string' && item.trim().length > 0)
  );
}

function isValidSourcePages(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.every(
      (page) => typeof page === 'number' && Number.isInteger(page) && page >= 1
    )
  );
}

function isInformationOriginType(value: unknown): value is InformationOriginType {
  return value === 'explicit' || value === 'ai_interpretation';
}

const VALID_VISUAL_TYPES = new Set<VisualElementType>([
  'imagem',
  'tabela',
  'grafico',
  'diagrama',
]);

function validateVisualElement(
  raw: unknown,
  path: string,
  errors: string[]
): raw is PdfVisualElement {
  if (!isPlainObject(raw)) {
    errors.push(`${path} deve ser um objeto.`);
    return false;
  }

  if (!isNonEmptyString(raw.id)) {
    errors.push(`${path}.id é obrigatório.`);
  }
  if (
    typeof raw.type !== 'string' ||
    !VALID_VISUAL_TYPES.has(raw.type as VisualElementType)
  ) {
    errors.push(
      `${path}.type deve ser 'imagem', 'tabela', 'grafico' ou 'diagrama'.`
    );
  }
  if (!isNonEmptyString(raw.title)) {
    errors.push(`${path}.title é obrigatório.`);
  }
  if (!isNonEmptyString(raw.description)) {
    errors.push(`${path}.description é obrigatório.`);
  }
  if (
    raw.sectionId !== null &&
    raw.sectionId !== undefined &&
    typeof raw.sectionId !== 'string'
  ) {
    errors.push(`${path}.sectionId deve ser string ou null.`);
  }
  if (!isValidSourcePages(raw.sourcePages) || raw.sourcePages.length === 0) {
    errors.push(
      `${path}.sourcePages deve conter ao menos um número inteiro de página >= 1.`
    );
  }

  return true;
}

function validateSection(
  raw: unknown,
  index: number,
  errors: string[]
): raw is PdfSectionAnalysis {
  const path = `sections[${index}]`;
  if (!isPlainObject(raw)) {
    errors.push(`${path} deve ser um objeto.`);
    return false;
  }

  if (!isNonEmptyString(raw.id)) {
    errors.push(`${path}.id é obrigatório.`);
  }
  if (
    raw.parentSectionId !== null &&
    raw.parentSectionId !== undefined &&
    typeof raw.parentSectionId !== 'string'
  ) {
    errors.push(`${path}.parentSectionId deve ser string ou null.`);
  }
  if (
    typeof raw.level !== 'number' ||
    !Number.isInteger(raw.level) ||
    raw.level < 1
  ) {
    errors.push(`${path}.level deve ser um inteiro >= 1.`);
  }
  if (!isNonEmptyString(raw.title)) {
    errors.push(`${path}.title é obrigatório.`);
  }
  if (!isNonEmptyString(raw.summary)) {
    errors.push(`${path}.summary é obrigatório.`);
  }
  if (!isStringArray(raw.mainTopics)) {
    errors.push(`${path}.mainTopics deve ser uma lista de tópicos (strings).`);
  }
  if (!Array.isArray(raw.visualElements)) {
    errors.push(`${path}.visualElements deve ser um array.`);
  } else {
    raw.visualElements.forEach((el, elIdx) => {
      validateVisualElement(el, `${path}.visualElements[${elIdx}]`, errors);
    });
  }
  if (!isValidSourcePages(raw.sourcePages) || raw.sourcePages.length === 0) {
    errors.push(
      `${path}.sourcePages deve informar as páginas de origem (>= 1).`
    );
  }

  return true;
}

export interface PdfAnalysisValidationResult {
  valid: boolean;
  errors: string[];
  data?: PdfStructuredAnalysis;
}

export function validatePdfAnalysisStructure(
  raw: unknown
): PdfAnalysisValidationResult {
  const errors: string[] = [];

  if (!isPlainObject(raw)) {
    return {
      valid: false,
      errors: ['A resposta da análise deve ser um objeto JSON válido.'],
    };
  }

  if (!isNonEmptyString(raw.documentTitle)) {
    errors.push('documentTitle é obrigatório.');
  }
  if (!isValidSourcePages(raw.documentTitleSourcePages)) {
    errors.push('documentTitleSourcePages deve conter números de página >= 1.');
  }

  if (!isPlainObject(raw.mainObjective)) {
    errors.push('mainObjective deve ser um objeto.');
  } else {
    if (!isNonEmptyString(raw.mainObjective.text)) {
      errors.push('mainObjective.text é obrigatório.');
    }
    if (!isInformationOriginType(raw.mainObjective.sourceType)) {
      errors.push(
        "mainObjective.sourceType deve ser 'explicit' ou 'ai_interpretation'."
      );
    }
    if (!isValidSourcePages(raw.mainObjective.sourcePages)) {
      errors.push('mainObjective.sourcePages deve ser um array de páginas >= 1.');
    }
  }

  if (!isPlainObject(raw.introduction)) {
    errors.push('introduction deve ser um objeto.');
  } else {
    if (typeof raw.introduction.summary !== 'string') {
      errors.push('introduction.summary deve ser string.');
    }
    if (!isStringArray(raw.introduction.explicitPoints)) {
      errors.push('introduction.explicitPoints deve ser um array de strings.');
    }
    if (!isStringArray(raw.introduction.aiNotes)) {
      errors.push('introduction.aiNotes deve ser um array de strings.');
    }
    if (!isValidSourcePages(raw.introduction.sourcePages)) {
      errors.push('introduction.sourcePages deve ser um array de páginas >= 1.');
    }
  }

  if (!Array.isArray(raw.sections) || raw.sections.length === 0) {
    errors.push('sections deve conter ao menos uma seção identificada.');
  } else {
    raw.sections.forEach((section, index) => {
      validateSection(section, index, errors);
    });
  }

  if (!Array.isArray(raw.mainArguments)) {
    errors.push('mainArguments deve ser um array.');
  } else {
    raw.mainArguments.forEach((arg: unknown, idx: number) => {
      if (!isPlainObject(arg)) {
        errors.push(`mainArguments[${idx}] deve ser um objeto.`);
        return;
      }
      const typed = arg as Partial<PdfArgumentItem>;
      if (!isNonEmptyString(typed.argument)) {
        errors.push(`mainArguments[${idx}].argument é obrigatório.`);
      }
      if (!isNonEmptyString(typed.evidence)) {
        errors.push(`mainArguments[${idx}].evidence é obrigatório.`);
      }
      if (!isInformationOriginType(typed.sourceType)) {
        errors.push(
          `mainArguments[${idx}].sourceType deve ser 'explicit' ou 'ai_interpretation'.`
        );
      }
      if (!isValidSourcePages(typed.sourcePages)) {
        errors.push(`mainArguments[${idx}].sourcePages inválido.`);
      }
    });
  }

  if (!Array.isArray(raw.keyConcepts)) {
    errors.push('keyConcepts deve ser um array.');
  } else {
    raw.keyConcepts.forEach((concept: unknown, idx: number) => {
      if (!isPlainObject(concept)) {
        errors.push(`keyConcepts[${idx}] deve ser um objeto.`);
        return;
      }
      const typed = concept as Partial<PdfConceptItem>;
      if (!isNonEmptyString(typed.term)) {
        errors.push(`keyConcepts[${idx}].term é obrigatório.`);
      }
      if (!isNonEmptyString(typed.definition)) {
        errors.push(`keyConcepts[${idx}].definition é obrigatório.`);
      }
      if (!isInformationOriginType(typed.sourceType)) {
        errors.push(`keyConcepts[${idx}].sourceType inválido.`);
      }
      if (!isValidSourcePages(typed.sourcePages)) {
        errors.push(`keyConcepts[${idx}].sourcePages inválido.`);
      }
    });
  }

  if (!Array.isArray(raw.authorExamples)) {
    errors.push('authorExamples deve ser um array.');
  } else {
    raw.authorExamples.forEach((example: unknown, idx: number) => {
      if (!isPlainObject(example)) {
        errors.push(`authorExamples[${idx}] deve ser um objeto.`);
        return;
      }
      const typed = example as Partial<PdfExampleItem>;
      if (!isNonEmptyString(typed.title)) {
        errors.push(`authorExamples[${idx}].title é obrigatório.`);
      }
      if (!isNonEmptyString(typed.description)) {
        errors.push(`authorExamples[${idx}].description é obrigatório.`);
      }
      if (!isValidSourcePages(typed.sourcePages)) {
        errors.push(`authorExamples[${idx}].sourcePages inválido.`);
      }
    });
  }

  if (!isPlainObject(raw.conclusions)) {
    errors.push('conclusions deve ser um objeto.');
  } else {
    if (!isStringArray(raw.conclusions.explicitConclusions)) {
      errors.push('conclusions.explicitConclusions deve ser um array de strings.');
    }
    if (!isStringArray(raw.conclusions.aiInterpretations)) {
      errors.push('conclusions.aiInterpretations deve ser um array de strings.');
    }
    if (!isValidSourcePages(raw.conclusions.sourcePages)) {
      errors.push('conclusions.sourcePages deve ser um array de páginas >= 1.');
    }
  }

  if (!Array.isArray(raw.relevantReferences)) {
    errors.push('relevantReferences deve ser um array.');
  } else {
    raw.relevantReferences.forEach((ref: unknown, idx: number) => {
      if (!isPlainObject(ref)) {
        errors.push(`relevantReferences[${idx}] deve ser um objeto.`);
        return;
      }
      const typed = ref as Partial<PdfReferenceItem>;
      if (!isNonEmptyString(typed.reference)) {
        errors.push(`relevantReferences[${idx}].reference é obrigatório.`);
      }
      if (typeof typed.context !== 'string') {
        errors.push(`relevantReferences[${idx}].context deve ser string.`);
      }
      if (!isValidSourcePages(typed.sourcePages)) {
        errors.push(`relevantReferences[${idx}].sourcePages inválido.`);
      }
    });
  }

  if (!Array.isArray(raw.visualElements)) {
    errors.push('visualElements deve ser um array.');
  } else {
    raw.visualElements.forEach((el, idx) => {
      validateVisualElement(el, `visualElements[${idx}]`, errors);
    });
  }

  if (!Array.isArray(raw.aiInterpretations)) {
    errors.push('aiInterpretations deve ser um array.');
  } else {
    raw.aiInterpretations.forEach((item: unknown, idx: number) => {
      if (!isPlainObject(item)) {
        errors.push(`aiInterpretations[${idx}] deve ser um objeto.`);
        return;
      }
      const typed = item as Partial<PdfAiInterpretationItem>;
      if (!isNonEmptyString(typed.statement)) {
        errors.push(`aiInterpretations[${idx}].statement é obrigatório.`);
      }
      if (!isNonEmptyString(typed.basis)) {
        errors.push(`aiInterpretations[${idx}].basis é obrigatório.`);
      }
      if (!isValidSourcePages(typed.sourcePages)) {
        errors.push(`aiInterpretations[${idx}].sourcePages inválido.`);
      }
    });
  }

  if (!Array.isArray(raw.uncertainties)) {
    errors.push('uncertainties deve ser um array.');
  } else {
    raw.uncertainties.forEach((item: unknown, idx: number) => {
      if (!isPlainObject(item)) {
        errors.push(`uncertainties[${idx}] deve ser um objeto.`);
        return;
      }
      const typed = item as Partial<PdfUncertaintyItem>;
      if (!isNonEmptyString(typed.topic)) {
        errors.push(`uncertainties[${idx}].topic é obrigatório.`);
      }
      if (!isNonEmptyString(typed.reason)) {
        errors.push(`uncertainties[${idx}].reason é obrigatório.`);
      }
      if (!isValidSourcePages(typed.sourcePages)) {
        errors.push(`uncertainties[${idx}].sourcePages inválido.`);
      }
    });
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: [],
    data: raw as unknown as PdfStructuredAnalysis,
  };
}

export function parseAndValidatePdfAnalysis(
  rawText: string
): PdfAnalysisValidationResult {
  if (!rawText || !rawText.trim()) {
    return {
      valid: false,
      errors: ['A resposta retornada pela Gemini API veio vazia.'],
    };
  }

  const cleaned = rawText
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (error) {
    return {
      valid: false,
      errors: [
        `Resposta da Gemini API não é um JSON válido: ${
          error instanceof Error ? error.message : 'erro de sintaxe'
        }`,
      ],
    };
  }

  return validatePdfAnalysisStructure(parsed);
}
