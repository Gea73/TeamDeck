import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateDistributionSummary,
  calculateSectionDurationSeconds,
  countWords,
  distributeSectionsOptimally,
  DistributionMemberInput,
  DistributionSectionInput,
  reassignSectionManually,
} from '../src/domain/contentDistribution';
import { PdfVisualElement } from '../src/types/pdfAnalysis';

function makeVisual(
  id: string,
  type: PdfVisualElement['type'],
  page = 1
): PdfVisualElement {
  return {
    id,
    type,
    title: `Elemento ${id}`,
    description: `Descrição do elemento ${id}`,
    sectionId: null,
    sourcePages: [page],
  };
}

function makeSection(
  id: string,
  order: number,
  wordCount: number,
  visualElements: PdfVisualElement[] = []
): DistributionSectionInput {
  return {
    id,
    order,
    title: `Seção ${order}`,
    summary: `Resumo da seção ${order}`,
    wordCount,
    visualElements,
    sourcePages: [order],
  };
}

const TEAM_THREE: DistributionMemberInput[] = [
  { memberId: 'm1', name: 'Mariana', email: 'm1@usp.br', role: 'Líder' },
  { memberId: 'm2', name: 'Lucas', email: 'm2@usp.br', role: 'Pesquisador' },
  { memberId: 'm3', name: 'Beatriz', email: 'm3@usp.br', role: 'Slides' },
];

test('Seções sem elementos visuais calculam tempo exato a 130 palavras/min', () => {
  assert.equal(calculateSectionDurationSeconds(130, 0), 60);
  assert.equal(calculateSectionDurationSeconds(65, 0), 30);
  assert.equal(calculateSectionDurationSeconds(260, 0), 120);
  assert.equal(calculateSectionDurationSeconds(0, 0), 0);
  assert.equal(countWords('Um   dois\ntres\tquatro'), 4);
});

test('Seções com imagens somam +10 segundos por imagem única', () => {
  const secWithImages = makeSection('s1', 1, 130, [
    makeVisual('img_1', 'imagem', 2),
    makeVisual('img_2', 'imagem', 2),
  ]);

  const summary = calculateDistributionSummary(
    [secWithImages],
    [TEAM_THREE[0]],
    { s1: 'm1' }
  );

  // 130 palavras = 60s + 2 imagens * 10s = 80s
  assert.equal(summary.sections[0].speakingSeconds, 60);
  assert.equal(summary.sections[0].visualSeconds, 20);
  assert.equal(summary.sections[0].durationSeconds, 80);
  assert.equal(summary.totalDurationSeconds, 80);
});

test('Seções com tabelas e gráficos contabilizam cada elemento visual uma única vez', () => {
  const sharedTable = makeVisual('tab_01', 'tabela', 3);
  const sharedChart = makeVisual('graf_01', 'grafico', 4);
  const uniqueChart = makeVisual('graf_02', 'grafico', 5);

  const sections: DistributionSectionInput[] = [
    // tab_01 aparece duplicado na própria seção e também na seção 2
    makeSection('s1', 1, 130, [sharedTable, sharedTable, sharedChart]),
    makeSection('s2', 2, 130, [sharedTable, uniqueChart]),
  ];

  const summary = calculateDistributionSummary(sections, TEAM_THREE.slice(0, 2), {
    s1: 'm1',
    s2: 'm2',
  });

  // Seção 1 deve contabilizar tab_01 + graf_01 (2 elementos = +20s => 80s)
  assert.equal(summary.sections[0].visualElementCount, 2);
  assert.equal(summary.sections[0].durationSeconds, 80);

  // Seção 2 deve ignorar tab_01 já contabilizado e contar apenas graf_02 (1 elemento = +10s => 70s)
  assert.equal(summary.sections[1].visualElementCount, 1);
  assert.equal(summary.sections[1].durationSeconds, 70);

  assert.equal(summary.totalUniqueVisualElements, 3);
  assert.equal(summary.totalDurationSeconds, 150);
});

test('Seções com diferentes quantidades de palavras preservam proporção exata na fórmula', () => {
  const sections: DistributionSectionInput[] = [
    makeSection('s1', 1, 195, []), // 90s
    makeSection('s2', 2, 325, [makeVisual('diag_1', 'diagrama', 2)]), // 150s + 10s = 160s
    makeSection('s3', 3, 52, [makeVisual('tab_1', 'tabela', 3)]), // 24s + 10s = 34s
  ];

  const summary = calculateDistributionSummary(sections, TEAM_THREE, {
    s1: 'm1',
    s2: 'm2',
    s3: 'm3',
  });

  assert.equal(summary.sections[0].durationSeconds, 90);
  assert.equal(summary.sections[1].durationSeconds, 160);
  assert.equal(summary.sections[2].durationSeconds, 34);
  assert.equal(summary.totalDurationSeconds, 284);
  assert.equal(summary.maxMemberSeconds, 160);
  assert.equal(summary.minMemberSeconds, 34);
  assert.equal(summary.durationDifferenceSeconds, 126);
});

test('Equipes com diferentes quantidades de integrantes minimizam diferença preservando sequência lógica', () => {
  // Seções ordenadas: [60s, 60s, 120s, 60s, 60s, 120s] => Total = 480s
  const sections: DistributionSectionInput[] = [
    makeSection('s1', 1, 130), // 60s
    makeSection('s2', 2, 130), // 60s
    makeSection('s3', 3, 260), // 120s
    makeSection('s4', 4, 130), // 60s
    makeSection('s5', 5, 130), // 60s
    makeSection('s6', 6, 260), // 120s
  ];

  // Equipe de 2 integrantes -> [s1,s2,s3] = 240s e [s4,s5,s6] = 240s (diferença = 0s)
  const dist2 = distributeSectionsOptimally(sections, TEAM_THREE.slice(0, 2));
  assert.equal(dist2.summary.preservesLogicalSequence, true);
  assert.equal(dist2.summary.totalDurationSeconds, 480);
  assert.equal(dist2.summary.durationDifferenceSeconds, 0);
  assert.deepEqual(dist2.summary.memberSummaries[0].sectionIds, ['s1', 's2', 's3']);
  assert.deepEqual(dist2.summary.memberSummaries[1].sectionIds, ['s4', 's5', 's6']);

  // Equipe de 3 integrantes -> [s1,s2] = 120s, [s3] = 120s, [s4,s5] + ... espera:
  // Com s1..s6: [60,60]=120, [120,60]=180, [60,120]=180 -> diferença = 60s (melhor possível em sequência!)
  // Vamos validar também com [120, 120, 120] onde diferença é 0s para 3 integrantes:
  const sections3Equal = [
    makeSection('a1', 1, 130),
    makeSection('a2', 2, 130),
    makeSection('a3', 3, 260),
    makeSection('a4', 4, 260),
  ];
  const dist3 = distributeSectionsOptimally(sections3Equal, TEAM_THREE);
  assert.equal(dist3.summary.preservesLogicalSequence, true);
  assert.equal(dist3.summary.maxMemberSeconds, 120);
  assert.equal(dist3.summary.minMemberSeconds, 120);
  assert.equal(dist3.summary.durationDifferenceSeconds, 0);

  // Equipe de 1 integrante -> recebe todas as seções, diferença 0s
  const dist1 = distributeSectionsOptimally(sections, [TEAM_THREE[0]]);
  assert.equal(dist1.summary.totalDurationSeconds, 480);
  assert.equal(dist1.summary.durationDifferenceSeconds, 0);
  assert.equal(dist1.summary.memberSummaries[0].sectionCount, 6);

  // Equipe maior que quantidade de seções (4 integrantes para 2 seções)
  const teamFour: DistributionMemberInput[] = [
    ...TEAM_THREE,
    { memberId: 'm4', name: 'Rafael', email: 'm4@usp.br', role: 'Dados' },
  ];
  const dist4 = distributeSectionsOptimally(sections.slice(0, 2), teamFour);
  assert.equal(dist4.summary.preservesLogicalSequence, true);
  assert.equal(dist4.summary.totalDurationSeconds, 120);
  assert.equal(dist4.summary.maxMemberSeconds, 60);
  assert.equal(dist4.summary.minMemberSeconds, 0);
  assert.equal(dist4.summary.durationDifferenceSeconds, 60);
});

test('Redistribuição após alterações manuais recalcula tempos individuais, total e diferença', () => {
  const sections: DistributionSectionInput[] = [
    makeSection('s1', 1, 130), // 60s
    makeSection('s2', 2, 130), // 60s
    makeSection('s3', 3, 260), // 120s
    makeSection('s4', 4, 260), // 120s
  ];

  const initial = distributeSectionsOptimally(sections, TEAM_THREE);
  assert.equal(initial.summary.durationDifferenceSeconds, 0);
  assert.equal(initial.assignmentMap.s1, 'm1');
  assert.equal(initial.assignmentMap.s2, 'm1');
  assert.equal(initial.assignmentMap.s3, 'm2');
  assert.equal(initial.assignmentMap.s4, 'm3');

  // Usuário altera manualmente s2 de m1 para m2
  const afterManualEdit = reassignSectionManually(
    sections,
    TEAM_THREE,
    initial.assignmentMap,
    's2',
    'm2'
  );

  assert.equal(afterManualEdit.summary.totalDurationSeconds, 360);
  // m1 fica com 60s, m2 fica com 180s, m3 fica com 120s
  assert.equal(afterManualEdit.summary.memberSummaries[0].totalSeconds, 60);
  assert.equal(afterManualEdit.summary.memberSummaries[1].totalSeconds, 180);
  assert.equal(afterManualEdit.summary.memberSummaries[2].totalSeconds, 120);
  assert.equal(afterManualEdit.summary.maxMemberSeconds, 180);
  assert.equal(afterManualEdit.summary.minMemberSeconds, 60);
  assert.equal(afterManualEdit.summary.durationDifferenceSeconds, 120);
  assert.equal(afterManualEdit.summary.preservesLogicalSequence, true);

  // Alteração fora da sequência contígua (s4 atribuída a m1) sinaliza quebra da sequência contígua
  const nonContiguous = reassignSectionManually(
    sections,
    TEAM_THREE,
    afterManualEdit.assignmentMap,
    's4',
    'm1'
  );
  assert.equal(nonContiguous.summary.preservesLogicalSequence, false);
  assert.equal(nonContiguous.summary.memberSummaries[0].totalSeconds, 180);
  assert.equal(nonContiguous.summary.memberSummaries[1].totalSeconds, 180);
  assert.equal(nonContiguous.summary.memberSummaries[2].totalSeconds, 0);
  assert.equal(nonContiguous.summary.durationDifferenceSeconds, 180);
});
