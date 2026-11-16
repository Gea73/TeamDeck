import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateDistributionSummary } from '../src/domain/contentDistribution';
import {
  buildCreateSlidesBatchRequests,
  buildPopulateSlidesBatchRequests,
  buildSlideDeckPlan,
  SlideDeckBuildInput,
} from '../src/domain/googleSlidesBuilder';
import {
  generateGoogleSlidesPresentation,
  GoogleSlidesServiceError,
} from '../server/services/googleSlidesService';
import { PdfStructuredAnalysis } from '../src/types/pdfAnalysis';

function createSampleDeckInput(): SlideDeckBuildInput {
  const analysis: PdfStructuredAnalysis = {
    documentTitle: 'Arquitetura de Microsserviços para Sistemas Acadêmicos',
    documentTitleSourcePages: [1],
    mainObjective: {
      text: 'Avaliar padrões de resiliência e comunicação assíncrona em plataformas universitárias.',
      sourceType: 'explicit',
      sourcePages: [1, 2],
    },
    introduction: {
      summary: 'Contexto da modernização de sistemas acadêmicos.',
      explicitPoints: ['Sistemas legados monolíticos apresentam acoplamento alto.'],
      aiNotes: [],
      sourcePages: [2],
    },
    sections: [
      {
        id: 'sec-1',
        parentSectionId: null,
        level: 1,
        title: 'Fundamentação Teórica',
        summary: 'Define os princípios de isolamento de falhas e filas assíncronas.',
        mainTopics: [
          'Circuit breaker reduz falhas em cascata.',
          'Filas desacoplam produtores e consumidores.',
          'Observabilidade exige rastreamento distribuído.',
        ],
        visualElements: [],
        sourcePages: [3, 4],
      },
      {
        id: 'sec-2',
        parentSectionId: null,
        level: 1,
        title: 'Resultados Experimentais',
        summary: 'Apresenta métricas de latência e taxa de erro sob carga controlada.',
        mainTopics: [
          'Latência p95 caiu de 840ms para 210ms.',
          'Taxa de erro manteve-se abaixo de 0,4%.',
          'Recuperação automática ocorreu em 12 segundos.',
          'Throughput dobrou com balanceamento horizontal.',
          'Logs estruturados aceleraram diagnóstico de incidentes.',
        ],
        visualElements: [
          {
            id: 'vis-1',
            type: 'grafico',
            title: 'Gráfico de Latência p95 por Cenário',
            description: 'Comparativo entre arquitetura monolítica e microsserviços.',
            sectionId: 'sec-2',
            sourcePages: [7],
          },
        ],
        sourcePages: [6, 7],
      },
      {
        id: 'sec-3',
        parentSectionId: null,
        level: 1,
        title: 'Seção Opcional Não Aprovada',
        summary: 'Anexos extensos fora do escopo da banca.',
        mainTopics: ['Apêndice técnico detalhado.'],
        visualElements: [],
        sourcePages: [12],
      },
    ],
    mainArguments: [],
    keyConcepts: [],
    authorExamples: [],
    conclusions: {
      explicitConclusions: [
        'O desacoplamento via mensageria reduziu significativamente o tempo de indisponibilidade.',
        'A adoção gradual minimiza riscos operacionais em equipes acadêmicas.',
      ],
      aiInterpretations: [],
      sourcePages: [9],
    },
    relevantReferences: [
      {
        reference: 'NEWMAN, S. Building Microservices. O’Reilly, 2021.',
        context: 'Base conceitual de padrões de resiliência.',
        sourcePages: [10],
      },
    ],
    visualElements: [],
    aiInterpretations: [],
    uncertainties: [],
  };

  const members = [
    {
      memberId: 'm1',
      name: 'Ana Beatriz',
      email: 'ana@uni.edu',
      role: 'Apresentadora',
    },
    {
      memberId: 'm2',
      name: 'Carlos Eduardo',
      email: 'carlos@uni.edu',
      role: 'Analista',
    },
  ];

  const distSummary = calculateDistributionSummary(
    analysis.sections.map((s, idx) => ({
      id: s.id,
      order: idx + 1,
      title: s.title,
      summary: s.summary,
      wordCount: 130,
      visualElements: s.visualElements,
      sourcePages: s.sourcePages,
    })),
    members,
    {
      'sec-1': 'm1',
      'sec-2': 'm2',
      'sec-3': 'm2',
    }
  );

  return {
    projectId: 'proj-test-1',
    projectTitle: 'Microsserviços Resilientes',
    projectDescription: 'Estudo aplicado em sistemas universitários.',
    discipline: 'Engenharia de Software',
    institution: 'USP',
    advisor: 'Prof. Dr. Marcos Silva',
    presentationDate: '2026-12-01',
    presentationTime: '14:00',
    location: 'Auditório B',
    memberNames: ['Ana Beatriz', 'Carlos Eduardo'],
    pdfFileName: 'artigo-microsservicos.pdf',
    pdfAnalysis: analysis,
    distributionSummary: distSummary,
    approvedSectionIds: ['sec-1', 'sec-2'],
  };
}

test('gera capa, seções aprovadas divididas sem excesso de texto, layout visual e conclusão', () => {
  const input = createSampleDeckInput();
  const plan = buildSlideDeckPlan(input);

  // Deve incluir apenas sec-1 e sec-2 (excluindo sec-3 não aprovada)
  // Capa (1) + sec-1 (1 slide, 3 bullets) + sec-2 (2 slides, 5 bullets -> 4 + 1) + Conclusão (1) = 5 slides
  assert.equal(plan.slides.length, 5);
  assert.equal(plan.slides[0].layoutType, 'cover');
  assert.equal(plan.slides[1].sectionId, 'sec-1');
  assert.equal(plan.slides[2].sectionId, 'sec-2');
  assert.equal(plan.slides[2].layoutType, 'section_visual_split');
  assert.equal(plan.slides[3].sectionId, 'sec-2');
  assert.match(plan.slides[3].title, /Parte 2\/2/);
  assert.equal(plan.slides[4].layoutType, 'conclusion');

  // Nenhum slide de seção deve ultrapassar 4 tópicos (evitar excesso de texto)
  for (const slide of plan.slides) {
    assert.ok(slide.bulletPoints.length <= 4);
  }

  // Preserva páginas de origem e elementos visuais reais
  assert.deepEqual(plan.slides[1].sourcePages, [3, 4]);
  assert.equal(plan.slides[2].visualCallouts.length, 1);
  assert.match(plan.slides[2].visualCallouts[0], /Gráfico de Latência p95/);
  assert.match(plan.slides[2].visualCallouts[0], /Pág\. 7/);
});

test('inclui notas do apresentador obrigatórias com responsável, tempo, discurso e transição em todos os slides', () => {
  const plan = buildSlideDeckPlan(createSampleDeckInput());

  for (const slide of plan.slides) {
    assert.match(slide.speakerNotes, /Integrante responsável:/);
    assert.match(slide.speakerNotes, /Tempo estimado:/);
    assert.match(slide.speakerNotes, /Discurso sugerido:/);
    assert.match(slide.speakerNotes, /Transição para o próximo slide:/);
    assert.ok(slide.speakerNotes.includes(slide.assignedMemberName));
  }
});

test('gera requisições batchUpdate válidas removendo slide inicial apenas após criar slides e inserindo speaker notes', () => {
  const plan = buildSlideDeckPlan(createSampleDeckInput());
  const createReqs = buildCreateSlidesBatchRequests(plan, 'default_slide_0');

  // Último request deve ser deleteObject para o slide inicial padrão
  const lastCreateReq = createReqs[createReqs.length - 1] as {
    deleteObject?: { objectId: string };
  };
  assert.equal(lastCreateReq.deleteObject?.objectId, 'default_slide_0');

  const notesMap: Record<string, string> = {};
  for (const s of plan.slides) {
    notesMap[s.slideObjectId] = `notes_${s.slideObjectId}`;
  }

  const populateReqs = buildPopulateSlidesBatchRequests(plan, notesMap);
  const notesInserts = populateReqs.filter((req) => {
    const insert = req.insertText as { objectId?: string } | undefined;
    return insert?.objectId?.startsWith('notes_');
  });

  assert.equal(notesInserts.length, plan.slides.length);
});

test('bloqueia geração duplicada sem confirmação explícita quando já existe presentationId', async () => {
  const deckInput = createSampleDeckInput();

  await assert.rejects(
    () =>
      generateGoogleSlidesPresentation({
        accessToken: 'fake_token_for_validation_check',
        deckInput,
        existingPresentationId: '1AbCdEfGhIjKlMnOpQrStUvWxYz',
        confirmDuplicate: false,
        requestId: 'req-dup-1',
      }),
    (err: unknown) =>
      err instanceof GoogleSlidesServiceError && err.statusCode === 409
  );
});
