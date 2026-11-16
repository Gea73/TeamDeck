import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildExclusiveMemberPreparationInput,
  computePreparationTargetWords,
  countReviewedBlocks,
  isPreparationFullyReviewed,
  parseAndValidatePreparationMaterial,
} from '../src/domain/preparationValidation';
import { Project, ProjectStatus, TeamMemberAssignmentView } from '../src/types';

function createSampleProject(): {
  project: Project;
  assignments: TeamMemberAssignmentView[];
} {
  const project: Project = {
    id: 'proj-prep-1',
    title: 'Redes Neurais na Triagem Clínica',
    description: 'Avaliação comparativa de modelos em prontuários eletrônicos.',
    discipline: 'Inteligência Artificial Aplicada',
    institution: 'UNICAMP',
    advisor: 'Prof. Dr. Helena Costa',
    presentationDate: '2026-12-10',
    presentationTime: '10:00',
    location: 'Sala 302',
    targetDurationMinutes: 15,
    status: ProjectStatus.IN_PROGRESS,
    baseProgress: 50,
    memberCount: 2,
    overallProgress: 60,
    contentDivision: [],
    sectionAssignments: {
      sec_1: 'mem_a',
      sec_2: 'mem_b',
    },
    slides: [],
    createdAt: '2026-11-01T10:00:00Z',
    updatedAt: '2026-11-01T10:00:00Z',
    pdfDocument: {
      id: 'pdf-1',
      fileName: 'triagem-ia.pdf',
      fileSize: '1.2 MB',
      pageCount: 10,
      uploadedAt: '2026-11-02',
      uploadedBy: 'Lucas',
      summary: 'Análise comparativa.',
      extractedTopics: ['Introdução e Dados', 'Resultados e Limitações'],
      analysis: {
        documentTitle: 'Triagem Clínica com Redes Neurais',
        documentTitleSourcePages: [1],
        mainObjective: {
          text: 'Medir sensibilidade e especificidade em triagem hospitalar.',
          sourceType: 'explicit',
          sourcePages: [1],
        },
        introduction: {
          summary: 'Contexto hospitalar.',
          explicitPoints: ['Superlotação exige priorização rápida.'],
          aiNotes: [],
          sourcePages: [2],
        },
        sections: [
          {
            id: 'sec_1',
            parentSectionId: null,
            level: 1,
            title: 'Coleta e Pré-processamento',
            summary:
              'Descreve a anonimização e limpeza dos 12 mil registros clínicos.',
            mainTopics: [
              'Anonimização seguiu protocolo LGPD.',
              'Remoção de campos ausentes acima de 30%.',
            ],
            visualElements: [],
            sourcePages: [3, 4],
          },
          {
            id: 'sec_2',
            parentSectionId: null,
            level: 1,
            title: 'Avaliação de Desempenho',
            summary: 'Compara AUC-ROC e sensibilidade entre três arquiteturas.',
            mainTopics: ['Rede recorrente obteve AUC-ROC de 0,91.'],
            visualElements: [],
            sourcePages: [7, 8],
          },
        ],
        mainArguments: [],
        keyConcepts: [
          {
            term: 'Anonimização K-anonimato',
            definition: 'Técnica para impedir reidentificação de pacientes.',
            sourceType: 'explicit',
            sourcePages: [3],
          },
          {
            term: 'AUC-ROC',
            definition: 'Área sob a curva característica de operação.',
            sourceType: 'explicit',
            sourcePages: [7],
          },
        ],
        authorExamples: [
          {
            title: 'Mascara de CPF e Prontuário',
            description: 'Substituição determinística antes da tokenização.',
            sourcePages: [4],
          },
          {
            title: 'Caso de falso negativo em sepse',
            description: 'Registro analisado na página 8.',
            sourcePages: [8],
          },
        ],
        conclusions: {
          explicitConclusions: ['Modelos exigem validação local contínua.'],
          aiInterpretations: [],
          sourcePages: [9],
        },
        relevantReferences: [],
        visualElements: [],
        aiInterpretations: [],
        uncertainties: [],
      },
    },
  };

  const assignments: TeamMemberAssignmentView[] = [
    {
      associationId: 'pm_1',
      memberId: 'mem_a',
      projectId: 'proj-prep-1',
      projectName: project.title,
      name: 'Lucas Mendes',
      email: 'lucas@uni.br',
      role: 'Metodologia',
      responsibility: 'Dados e pré-processamento',
      presentationMinutes: 5,
      progress: 70,
      tasksCompleted: 3,
      tasksTotal: 4,
    },
    {
      associationId: 'pm_2',
      memberId: 'mem_b',
      projectId: 'proj-prep-1',
      projectName: project.title,
      name: 'Mariana Souza',
      email: 'mariana@uni.br',
      role: 'Resultados',
      responsibility: 'Métricas e conclusões',
      presentationMinutes: 5,
      progress: 50,
      tasksCompleted: 2,
      tasksTotal: 4,
    },
  ];

  return { project, assignments };
}

test('isola exclusivamente as seções, conceitos e exemplos atribuídos ao integrante', () => {
  const { project, assignments } = createSampleProject();
  const inputA = buildExclusiveMemberPreparationInput(
    project,
    assignments,
    'mem_a'
  );

  assert.equal(inputA.memberId, 'mem_a');
  assert.equal(inputA.assignedSections.length, 1);
  assert.equal(inputA.assignedSections[0].sectionId, 'sec_1');
  assert.equal(inputA.relevantConcepts.length, 1);
  assert.equal(inputA.relevantConcepts[0].term, 'Anonimização K-anonimato');
  assert.equal(inputA.relevantExamples.length, 1);
  assert.equal(inputA.relevantExamples[0].title, 'Mascara de CPF e Prontuário');
});

test('calcula meta de palavras proporcional a 130 palavras por minuto', () => {
  assert.equal(computePreparationTargetWords(60), 130);
  assert.equal(computePreparationTargetWords(120), 260);
});

test('valida JSON estruturado exigindo exatamente 5 perguntas da audiência e sectionId autorizado', () => {
  const validPayload = {
    overviewSummary: 'Fale com clareza sobre a limpeza dos dados clínicos.',
    detailedScript: [
      {
        id: 'scr_1',
        sectionId: 'sec_1',
        sectionTitle: 'Coleta e Pré-processamento',
        estimatedSeconds: 45,
        targetWordCount: 98,
        oralScript:
          'Nesta etapa, explicamos como organizamos os 12 mil registros seguindo a LGPD.',
        keyDeliveryCue: 'Faça uma pausa breve ao citar a LGPD.',
        sourcePages: [3, 4],
      },
    ],
    technicalConcepts: [
      {
        id: 'con_1',
        term: 'K-anonimato',
        accessibleExplanation:
          'Garante que nenhum paciente possa ser identificado individualmente.',
        documentBasis: 'Definido na seção de coleta na página 3.',
        sourcePages: [3],
      },
    ],
    practicalExamples: [
      {
        id: 'ex_1',
        title: 'Substituição de identificadores',
        explanation:
          'Antes de treinar o modelo, códigos pessoais são trocados por chaves internas.',
        connectionToSection: 'Ilustra o passo de anonimização.',
        originType: 'explicit_from_document',
        sourcePages: [4],
      },
    ],
    audienceQuestions: [1, 2, 3, 4, 5].map((n) => ({
      id: `q_${n}`,
      question: `Pergunta plausível ${n}?`,
      answer: `Resposta fundamentada no documento ${n}.`,
      evidenceFromDocument: `Seção Coleta, pág. 3 (${n}).`,
      uncertaintyNote: null,
      sourcePages: [3],
    })),
    slideTransitions: [
      {
        id: 'tr_1',
        fromContext: 'Coleta e Pré-processamento',
        toContext: 'Avaliação de Desempenho (Mariana Souza)',
        suggestedPhrase:
          'Com os dados devidamente tratados, passo a palavra para a Mariana mostrar os resultados.',
      },
    ],
  };

  const ok = parseAndValidatePreparationMaterial(
    JSON.stringify(validPayload),
    ['sec_1']
  );
  assert.equal(ok.valid, true);
  assert.equal(ok.data?.audienceQuestions.length, 5);

  // Rejeita se tiver menos de 5 perguntas
  const invalidCount = {
    ...validPayload,
    audienceQuestions: validPayload.audienceQuestions.slice(0, 4),
  };
  const errCount = parseAndValidatePreparationMaterial(
    JSON.stringify(invalidCount),
    ['sec_1']
  );
  assert.equal(errCount.valid, false);

  // Rejeita se tentar usar seção atribuída a outro integrante
  const invalidSection = {
    ...validPayload,
    detailedScript: [
      {
        ...validPayload.detailedScript[0],
        sectionId: 'sec_2',
      },
    ],
  };
  const errSection = parseAndValidatePreparationMaterial(
    JSON.stringify(invalidSection),
    ['sec_1']
  );
  assert.equal(errSection.valid, false);
});

test('contabiliza corretamente o status de revisão dos 5 blocos individuais', () => {
  const partial = {
    scriptReviewed: true,
    conceptsReviewed: true,
    examplesReviewed: false,
    questionsReviewed: false,
    transitionsReviewed: false,
  };
  assert.equal(countReviewedBlocks(partial), 2);
  assert.equal(isPreparationFullyReviewed(partial), false);

  const complete = {
    scriptReviewed: true,
    conceptsReviewed: true,
    examplesReviewed: true,
    questionsReviewed: true,
    transitionsReviewed: true,
  };
  assert.equal(countReviewedBlocks(complete), 5);
  assert.equal(isPreparationFullyReviewed(complete), true);
});
