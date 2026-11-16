import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseAndValidatePdfAnalysis,
  PDF_MAX_FILE_SIZE_BYTES,
  validatePdfAnalysisStructure,
  validatePdfFile,
} from '../src/domain/pdfValidation';
import { PdfStructuredAnalysis } from '../src/types/pdfAnalysis';

function createValidAnalysisSample(): PdfStructuredAnalysis {
  return {
    documentTitle:
      'Tolerância a Falhas em Prontuários Eletrônicos Distribuídos',
    documentTitleSourcePages: [1],
    mainObjective: {
      text: 'Avaliar arquiteturas de replicação eventual com CRDTs para garantir disponibilidade em unidades básicas de saúde.',
      sourceType: 'explicit',
      sourcePages: [1, 2],
    },
    introduction: {
      summary:
        'A introdução contextualiza interrupções frequentes de conectividade em redes municipais de saúde.',
      explicitPoints: [
        '34% das unidades de atendimento operam com conectividade intermitente.',
        'Bloqueios de escrita comprometem a triagem clínica.',
      ],
      aiNotes: [
        'O autor estabelece relação direta entre disponibilidade local e continuidade assistencial.',
      ],
      sourcePages: [1, 2],
    },
    sections: [
      {
        id: 'sec_01',
        parentSectionId: null,
        level: 1,
        title: '1. Fundamentação Teórica e Teorema CAP',
        summary:
          'Apresenta o Teorema CAP aplicado a sistemas clínicos e justifica a escolha por disponibilidade e tolerância a partições.',
        mainTopics: [
          'Consistência vs. Disponibilidade sob partição',
          'Classificação de dados críticos de prescrição',
        ],
        visualElements: [
          {
            id: 'vis_01',
            type: 'diagrama',
            title: 'Diagrama 1 — Topologia de replicação regional',
            description:
              'Ilustra três nós locais sincronizando logs de eventos com o servidor central.',
            sectionId: 'sec_01',
            sourcePages: [4],
          },
        ],
        sourcePages: [3, 4],
      },
      {
        id: 'sec_01_01',
        parentSectionId: 'sec_01',
        level: 2,
        title: '1.1 Estruturas CRDT Baseadas em Estado',
        summary:
          'Detalha semirreticulados crescentes para fusão determinística de registros médicos offline.',
        mainTopics: [
          'Operador de junção comutativo e idempotente',
          'Resolução determinística de alergias medicamentosas',
        ],
        visualElements: [],
        sourcePages: [5],
      },
    ],
    mainArguments: [
      {
        argument:
          'Modelos fortemente consistentes (CP) inviabilizam atendimentos locais durante quedas de enlace.',
        evidence:
          'Simulação em 12 nós apontou indisponibilidade de 18% das gravações sob modelo síncrono.',
        sourceType: 'explicit',
        sourcePages: [6],
      },
    ],
    keyConcepts: [
      {
        term: 'CRDT (Conflict-free Replicated Data Type)',
        definition:
          'Estrutura de dados replicada cuja convergência de estado é matematicamente garantida sem coordenação central.',
        sourceType: 'explicit',
        sourcePages: [5],
      },
    ],
    authorExamples: [
      {
        title: 'Atualização simultânea de alergias em dois consultórios',
        description:
          'Dois médicos registram alergias distintas offline e o conjunto final preserva ambas após sincronização.',
        sourcePages: [5],
      },
    ],
    conclusions: {
      explicitConclusions: [
        'A arquitetura baseada em CRDT manteve 99,8% de disponibilidade de escrita.',
      ],
      aiInterpretations: [
        'A adoção exige política explícita de auditoria para resolução semântica de conflitos clínicos.',
      ],
      sourcePages: [9],
    },
    relevantReferences: [
      {
        reference:
          'Shapiro, M. et al. Conflict-Free Replicated Data Types. SSS 2011.',
        context: 'Base matemática para os tipos replicados utilizados na Seção 1.1.',
        sourcePages: [10],
      },
    ],
    visualElements: [
      {
        id: 'vis_01',
        type: 'diagrama',
        title: 'Diagrama 1 — Topologia de replicação regional',
        description:
          'Ilustra três nós locais sincronizando logs de eventos com o servidor central.',
        sectionId: 'sec_01',
        sourcePages: [4],
      },
      {
        id: 'vis_02',
        type: 'grafico',
        title: 'Gráfico 1 — Latência média de convergência',
        description:
          'Compara o tempo de convergência entre 4, 8 e 12 nós após restabelecimento do link.',
        sectionId: null,
        sourcePages: [8],
      },
    ],
    aiInterpretations: [
      {
        statement:
          'A solução é mais adequada para unidades ambulatoriais do que para centros cirúrgicos de alta criticidade.',
        basis:
          'Inferência a partir das premissas de consistência eventual discutidas nas páginas 3 e 9.',
        sourcePages: [3, 9],
      },
    ],
    uncertainties: [
      {
        topic: 'Tamanho máximo dos logs de sincronização em produção',
        reason:
          'O documento não informa a política de compactação ou descarte de tombstones após 12 meses.',
        sourcePages: [7],
      },
    ],
  };
}

test('validatePdfFile aceita arquivo PDF válido com extensão, MIME e assinatura corretos', () => {
  const validHeader = new TextEncoder().encode('%PDF-1.7\n');
  const result = validatePdfFile({
    fileName: 'Artigo_Academico.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 1024 * 512,
    headerBytes: validHeader,
  });

  assert.equal(result.valid, true);
  assert.equal(result.error, undefined);
});

test('validatePdfFile rejeita extensão diferente de .pdf, MIME inválido e arquivo acima do limite', () => {
  const wrongExt = validatePdfFile({
    fileName: 'apresentacao.docx',
    mimeType: 'application/pdf',
    sizeBytes: 1024,
  });
  assert.equal(wrongExt.valid, false);
  assert.match(wrongExt.error ?? '', /Extensão inválida/);

  const wrongMime = validatePdfFile({
    fileName: 'documento.pdf',
    mimeType: 'image/png',
    sizeBytes: 1024,
  });
  assert.equal(wrongMime.valid, false);
  assert.match(wrongMime.error ?? '', /Tipo MIME inválido/);

  const oversized = validatePdfFile({
    fileName: 'documento.pdf',
    mimeType: 'application/pdf',
    sizeBytes: PDF_MAX_FILE_SIZE_BYTES + 1,
  });
  assert.equal(oversized.valid, false);
  assert.match(oversized.error ?? '', /limite máximo/);

  const wrongHeader = validatePdfFile({
    fileName: 'falso.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 500,
    headerBytes: new TextEncoder().encode('PNG\r\n'),
  });
  assert.equal(wrongHeader.valid, false);
  assert.match(wrongHeader.error ?? '', /Assinatura binária inválida/);
});

test('validatePdfAnalysisStructure aprova estrutura completa retornada pela Gemini API', () => {
  const sample = createValidAnalysisSample();
  const result = validatePdfAnalysisStructure(sample);

  assert.equal(result.valid, true);
  assert.equal(result.errors.length, 0);
  assert.equal(result.data?.sections.length, 2);
  assert.equal(result.data?.sections[1].parentSectionId, 'sec_01');
});

test('parseAndValidatePdfAnalysis aceita JSON com bloco markdown e rejeita JSON malformado', () => {
  const sample = createValidAnalysisSample();
  const wrapped = '```json\n' + JSON.stringify(sample) + '\n```';

  const ok = parseAndValidatePdfAnalysis(wrapped);
  assert.equal(ok.valid, true);

  const malformed = parseAndValidatePdfAnalysis('{ "documentTitle": "sem fechar"');
  assert.equal(malformed.valid, false);
  assert.match(malformed.errors[0], /não é um JSON válido/);
});

test('validatePdfAnalysisStructure rejeita seção sem ID, resumo ou página de origem válida', () => {
  const broken = createValidAnalysisSample() as unknown as Record<string, unknown>;
  const sections = [...(broken.sections as Array<Record<string, unknown>>)];
  sections[0] = {
    ...sections[0],
    id: '',
    sourcePages: [0],
  };
  broken.sections = sections;

  const result = validatePdfAnalysisStructure(broken);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('sections[0].id')));
  assert.ok(result.errors.some((e) => e.includes('sections[0].sourcePages')));
});

test('validatePdfAnalysisStructure rejeita tipo de elemento visual inválido e sourceType desconhecido', () => {
  const broken = createValidAnalysisSample() as unknown as Record<string, unknown>;
  broken.mainObjective = {
    text: 'Objetivo',
    sourceType: 'inventado',
    sourcePages: [1],
  };
  broken.visualElements = [
    {
      id: 'vis_99',
      type: 'video',
      title: 'Elemento inválido',
      description: 'Tipo não permitido',
      sectionId: null,
      sourcePages: [2],
    },
  ];

  const result = validatePdfAnalysisStructure(broken);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('mainObjective.sourceType')));
  assert.ok(result.errors.some((e) => e.includes('visualElements[0].type')));
});
