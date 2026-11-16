import { GoogleGenAI, Schema, ThinkingLevel, Type } from '@google/genai';
import { parseAndValidatePdfAnalysis } from '../../src/domain/pdfValidation';
import { PdfStructuredAnalysis } from '../../src/types/pdfAnalysis';
import {
  extractHttpErrorStatus,
  getGeminiModel,
  isRetryableHttpError,
} from '../config/gemini';

export const GEMINI_PDF_MODEL = getGeminiModel();

const visualElementSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    id: {
      type: Type.STRING,
      description: 'Identificador único curto (ex: vis_01).',
    },
    type: {
      type: Type.STRING,
      enum: ['imagem', 'tabela', 'grafico', 'diagrama'],
      description: 'Tipo do elemento visual identificado no PDF.',
    },
    title: {
      type: Type.STRING,
      description: 'Legenda ou título descritivo fiel ao documento.',
    },
    description: {
      type: Type.STRING,
      description:
        'Descrição objetiva do conteúdo representado pelo elemento visual.',
    },
    sectionId: {
      type: Type.STRING,
      nullable: true,
      description: 'ID da seção correspondente ou null se global.',
    },
    sourcePages: {
      type: Type.ARRAY,
      items: { type: Type.INTEGER },
      description: 'Números das páginas de origem (>= 1).',
    },
  },
  required: ['id', 'type', 'title', 'description', 'sectionId', 'sourcePages'],
};

const pdfAnalysisResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    documentTitle: {
      type: Type.STRING,
      description: 'Título oficial do documento extraído do PDF.',
    },
    documentTitleSourcePages: {
      type: Type.ARRAY,
      items: { type: Type.INTEGER },
    },
    mainObjective: {
      type: Type.OBJECT,
      properties: {
        text: { type: Type.STRING },
        sourceType: {
          type: Type.STRING,
          enum: ['explicit', 'ai_interpretation'],
        },
        sourcePages: {
          type: Type.ARRAY,
          items: { type: Type.INTEGER },
        },
      },
      required: ['text', 'sourceType', 'sourcePages'],
    },
    introduction: {
      type: Type.OBJECT,
      properties: {
        summary: { type: Type.STRING },
        explicitPoints: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
        aiNotes: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
        sourcePages: {
          type: Type.ARRAY,
          items: { type: Type.INTEGER },
        },
      },
      required: ['summary', 'explicitPoints', 'aiNotes', 'sourcePages'],
    },
    sections: {
      type: Type.ARRAY,
      description: 'Seções e subseções identificadas em ordem no documento.',
      items: {
        type: Type.OBJECT,
        properties: {
          id: {
            type: Type.STRING,
            description: 'ID único sequencial (ex: sec_01, sec_01_01).',
          },
          parentSectionId: {
            type: Type.STRING,
            nullable: true,
            description: 'ID da seção pai para subseções, ou null.',
          },
          level: {
            type: Type.INTEGER,
            description: 'Nível hierárquico (1 = seção principal, 2+ = subseção).',
          },
          title: { type: Type.STRING },
          summary: {
            type: Type.STRING,
            description:
              'Resumo completo e fiel preservando termos técnicos e informações importantes.',
          },
          mainTopics: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          visualElements: {
            type: Type.ARRAY,
            items: visualElementSchema,
          },
          sourcePages: {
            type: Type.ARRAY,
            items: { type: Type.INTEGER },
          },
        },
        required: [
          'id',
          'parentSectionId',
          'level',
          'title',
          'summary',
          'mainTopics',
          'visualElements',
          'sourcePages',
        ],
      },
    },
    mainArguments: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          argument: { type: Type.STRING },
          evidence: { type: Type.STRING },
          sourceType: {
            type: Type.STRING,
            enum: ['explicit', 'ai_interpretation'],
          },
          sourcePages: {
            type: Type.ARRAY,
            items: { type: Type.INTEGER },
          },
        },
        required: ['argument', 'evidence', 'sourceType', 'sourcePages'],
      },
    },
    keyConcepts: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          term: { type: Type.STRING },
          definition: { type: Type.STRING },
          sourceType: {
            type: Type.STRING,
            enum: ['explicit', 'ai_interpretation'],
          },
          sourcePages: {
            type: Type.ARRAY,
            items: { type: Type.INTEGER },
          },
        },
        required: ['term', 'definition', 'sourceType', 'sourcePages'],
      },
    },
    authorExamples: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          description: { type: Type.STRING },
          sourcePages: {
            type: Type.ARRAY,
            items: { type: Type.INTEGER },
          },
        },
        required: ['title', 'description', 'sourcePages'],
      },
    },
    conclusions: {
      type: Type.OBJECT,
      properties: {
        explicitConclusions: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
        aiInterpretations: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
        sourcePages: {
          type: Type.ARRAY,
          items: { type: Type.INTEGER },
        },
      },
      required: ['explicitConclusions', 'aiInterpretations', 'sourcePages'],
    },
    relevantReferences: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          reference: { type: Type.STRING },
          context: { type: Type.STRING },
          sourcePages: {
            type: Type.ARRAY,
            items: { type: Type.INTEGER },
          },
        },
        required: ['reference', 'context', 'sourcePages'],
      },
    },
    visualElements: {
      type: Type.ARRAY,
      items: visualElementSchema,
    },
    aiInterpretations: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          statement: { type: Type.STRING },
          basis: { type: Type.STRING },
          sourcePages: {
            type: Type.ARRAY,
            items: { type: Type.INTEGER },
          },
        },
        required: ['statement', 'basis', 'sourcePages'],
      },
    },
    uncertainties: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          topic: { type: Type.STRING },
          reason: { type: Type.STRING },
          sourcePages: {
            type: Type.ARRAY,
            items: { type: Type.INTEGER },
          },
        },
        required: ['topic', 'reason', 'sourcePages'],
      },
    },
  },
  required: [
    'documentTitle',
    'documentTitleSourcePages',
    'mainObjective',
    'introduction',
    'sections',
    'mainArguments',
    'keyConcepts',
    'authorExamples',
    'conclusions',
    'relevantReferences',
    'visualElements',
    'aiInterpretations',
    'uncertainties',
  ],
};

const SYSTEM_INSTRUCTION = `Você é um analista acadêmico rigoroso especializado em extração técnica de documentos PDF para apresentações universitárias.
Siga rigorosamente todas as regras abaixo:
1. Responda exclusivamente em português (pt-BR), preservando termos técnicos originais entre parênteses quando relevante.
2. NÃO invente informações ausentes no documento. Se algum dado não constar no PDF, registre em "uncertainties" explicando o que está ausente ou ambíguo.
3. Diferencie claramente fatos explícitos no texto ("explicit") de sínteses ou inferências analíticas feitas pela IA ("ai_interpretation", "aiNotes", "aiInterpretations").
4. NÃO descarte informações relevantes apenas para encurtar o resumo; preserve dados quantitativos, definições, premissas metodológicas e conceitos técnicos.
5. Para TODA seção, subseção, argumento, conceito, exemplo, conclusão, referência e elemento visual (imagem, tabela, gráfico, diagrama), informe o número real da(s) página(s) de origem (inteiros >= 1) em "sourcePages".
6. Estruture seções e subseções hierarquicamente com IDs únicos (ex: sec_01, sec_01_01), vinculando subseções via "parentSectionId" e "level".
7. Retorne exclusivamente JSON válido conforme o schema solicitado.`;

const EXTRACTION_PROMPT = `Analise integralmente este documento PDF e extraia todas as informações exigidas em JSON estruturado:
- Título do documento e página(s) de origem;
- Objetivo principal (indicando se é explícito no texto ou interpretação da IA);
- Introdução (resumo, pontos explícitos e observações interpretativas separadas);
- Seções e subseções completas com id, parentSectionId, level, title, summary detalhado, mainTopics, visualElements internos e sourcePages;
- Principais argumentos com evidências e origem;
- Conceitos importantes com definições técnicas preservadas;
- Exemplos apresentados pelo autor;
- Conclusões (separando conclusões explícitas do autor e interpretações da IA);
- Referências relevantes citadas no documento;
- Lista consolidada de imagens, tabelas, gráficos e diagramas identificados com suas páginas de origem;
- Lista explícita de interpretações feitas pela IA e de incertezas/lacunas encontradas no documento.`;

export class GeminiPdfProcessingError extends Error {
  public readonly statusCode: number;
  public readonly details?: string[];

  constructor(message: string, statusCode = 500, details?: string[]) {
    super(message);
    this.name = 'GeminiPdfProcessingError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new GeminiPdfProcessingError(
      'A variável de ambiente GEMINI_API_KEY não está configurada no servidor.',
      503
    );
  }

  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function analyzePdfWithGemini(
  pdfBuffer: Buffer,
  fileName: string
): Promise<PdfStructuredAnalysis> {
  const ai = getGeminiClient();
  const model = getGeminiModel();
  const safeFileName = fileName.replace(/[\r\n\t]+/g, ' ').slice(0, 180);

  const pdfPart = {
    inlineData: {
      mimeType: 'application/pdf',
      data: pdfBuffer.toString('base64'),
    },
  };

  const textPart = {
    text: `${EXTRACTION_PROMPT}\n\nNome do arquivo enviado: ${safeFileName}`,
  };

  let lastError: unknown;
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: { parts: [pdfPart, textPart] },
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
          responseSchema: pdfAnalysisResponseSchema,
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.HIGH,
          },
        },
      });

      const responseText = response.text ?? '';
      const validation = parseAndValidatePdfAnalysis(responseText);

      if (!validation.valid || !validation.data) {
        throw new GeminiPdfProcessingError(
          'A resposta estruturada da Gemini API falhou na validação de esquema.',
          502
        );
      }

      return validation.data;
    } catch (error) {
      lastError = error;

      if (error instanceof GeminiPdfProcessingError) {
        throw error;
      }

      if (attempt < maxAttempts && isRetryableHttpError(error)) {
        await sleep(500 * Math.pow(2, attempt - 1));
        continue;
      }

      break;
    }
  }

  const status = extractHttpErrorStatus(lastError);
  const rawMessage =
    lastError instanceof Error ? lastError.message : 'Erro desconhecido';
  console.error('[TeamDeck] Erro Gemini PDF:', { status, rawMessage });

  if (
    status === 401 ||
    status === 403 ||
    rawMessage.includes('API_KEY_INVALID') ||
    rawMessage.includes('PERMISSION_DENIED')
  ) {
    throw new GeminiPdfProcessingError(
      'Chave da Gemini API inválida ou sem permissão. Verifique GEMINI_API_KEY nas configurações do servidor.',
      403
    );
  }

  if (status === 429 || rawMessage.includes('RESOURCE_EXHAUSTED')) {
    throw new GeminiPdfProcessingError(
      'Limite de requisições da Gemini API atingido temporariamente. Aguarde alguns instantes e tente novamente.',
      429
    );
  }

  throw new GeminiPdfProcessingError(
    'Não foi possível processar o documento PDF com a Gemini API no momento.',
    502
  );
}
