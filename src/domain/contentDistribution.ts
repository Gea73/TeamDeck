import {
  ContentDivisionItem,
  Project,
  TeamMemberAssignmentView,
} from '../types';
import { PdfSectionAnalysis, PdfVisualElement } from '../types/pdfAnalysis';

export const SPEAKING_WORDS_PER_MINUTE = 130;
export const VISUAL_ELEMENT_EXTRA_SECONDS = 10;

export interface DistributionSectionInput {
  id: string;
  order: number;
  title: string;
  summary: string;
  wordCount: number;
  visualElements: PdfVisualElement[];
  sourcePages: number[];
}

export interface DistributionMemberInput {
  memberId: string;
  name: string;
  email: string;
  role: string;
}

export interface CalculatedSectionDistribution {
  id: string;
  order: number;
  title: string;
  summary: string;
  wordCount: number;
  uniqueVisualElements: PdfVisualElement[];
  visualElementCount: number;
  speakingSeconds: number;
  visualSeconds: number;
  durationSeconds: number;
  sourcePages: number[];
  assignedMemberId: string | null;
  assignedMemberName: string | null;
}

export interface MemberDurationSummary {
  memberId: string;
  name: string;
  role: string;
  sectionIds: string[];
  sectionCount: number;
  totalWords: number;
  totalVisualElements: number;
  totalSeconds: number;
  percentageOfTotal: number;
}

export interface ContentDistributionSummary {
  sections: CalculatedSectionDistribution[];
  memberSummaries: MemberDurationSummary[];
  totalDurationSeconds: number;
  totalWords: number;
  totalUniqueVisualElements: number;
  maxMemberSeconds: number;
  minMemberSeconds: number;
  durationDifferenceSeconds: number;
  preservesLogicalSequence: boolean;
}

/**
 * Conta a quantidade de palavras em um texto preservando estabilidade para espaços/quebras de linha.
 */
export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter(Boolean).length;
}

/**
 * Fórmula obrigatória:
 * tempoEmSegundos = (quantidadeDePalavras / 130) * 60 + (quantidadeDeElementosVisuais * 10)
 */
export function calculateSectionDurationSeconds(
  wordCount: number,
  visualElementCount: number
): number {
  const safeWords = Number.isFinite(wordCount) ? Math.max(0, wordCount) : 0;
  const safeVisuals = Number.isFinite(visualElementCount)
    ? Math.max(0, visualElementCount)
    : 0;

  return (
    (safeWords / SPEAKING_WORDS_PER_MINUTE) * 60 +
    safeVisuals * VISUAL_ELEMENT_EXTRA_SECONDS
  );
}

function getVisualElementUniqueKey(element: PdfVisualElement): string {
  const id = element.id?.trim();
  if (id) return `id:${id}`;
  return `fallback:${element.type}:${element.title.trim().toLowerCase()}`;
}

/**
 * Garante que cada elemento visual seja contabilizado uma única vez em toda a apresentação,
 * respeitando a primeira seção na ordem lógica em que o elemento aparece.
 */
export function normalizeAndDeduplicateSections(
  sections: DistributionSectionInput[]
): CalculatedSectionDistribution[] {
  const seenVisualKeys = new Set<string>();
  const ordered = [...sections].sort((a, b) => a.order - b.order);

  return ordered.map((section) => {
    const uniqueVisualElements: PdfVisualElement[] = [];

    for (const element of section.visualElements) {
      const key = getVisualElementUniqueKey(element);
      if (!seenVisualKeys.has(key)) {
        seenVisualKeys.add(key);
        uniqueVisualElements.push(element);
      }
    }

    const safeWords = Math.max(0, section.wordCount);
    const visualCount = uniqueVisualElements.length;
    const speakingSeconds = (safeWords / SPEAKING_WORDS_PER_MINUTE) * 60;
    const visualSeconds = visualCount * VISUAL_ELEMENT_EXTRA_SECONDS;
    const durationSeconds = calculateSectionDurationSeconds(
      safeWords,
      visualCount
    );

    return {
      id: section.id,
      order: section.order,
      title: section.title,
      summary: section.summary,
      wordCount: safeWords,
      uniqueVisualElements,
      visualElementCount: visualCount,
      speakingSeconds,
      visualSeconds,
      durationSeconds,
      sourcePages: section.sourcePages,
      assignedMemberId: null,
      assignedMemberName: null,
    };
  });
}

/**
 * Verifica se a atribuição atual mantém a sequência lógica do documento,
 * ou seja, cada integrante apresenta um bloco contíguo sem intercalações fora de ordem.
 */
export function checkLogicalSequencePreserved(
  orderedSections: CalculatedSectionDistribution[]
): boolean {
  const finishedMembers = new Set<string>();
  let previousMemberId: string | null = null;

  for (const section of orderedSections) {
    const currentMemberId = section.assignedMemberId;
    if (!currentMemberId) continue;

    if (currentMemberId !== previousMemberId) {
      if (finishedMembers.has(currentMemberId)) {
        return false;
      }
      if (previousMemberId !== null) {
        finishedMembers.add(previousMemberId);
      }
      previousMemberId = currentMemberId;
    }
  }

  return true;
}

/**
 * Calcula todos os tempos individuais, total da apresentação e a diferença
 * entre o maior e o menor tempo individual a partir de um mapa de atribuições.
 */
export function calculateDistributionSummary(
  rawSections: DistributionSectionInput[],
  members: DistributionMemberInput[],
  assignmentMap: Record<string, string>
): ContentDistributionSummary {
  const deduplicatedSections = normalizeAndDeduplicateSections(rawSections);
  const memberById = new Map(members.map((m) => [m.memberId, m]));

  const sections: CalculatedSectionDistribution[] = deduplicatedSections.map(
    (section) => {
      const assignedId = assignmentMap[section.id];
      const matchedMember = assignedId ? memberById.get(assignedId) : undefined;
      return {
        ...section,
        assignedMemberId: matchedMember ? matchedMember.memberId : null,
        assignedMemberName: matchedMember ? matchedMember.name : null,
      };
    }
  );

  const memberBuckets = new Map<
    string,
    {
      sectionIds: string[];
      totalWords: number;
      totalVisualElements: number;
      totalSeconds: number;
    }
  >();

  for (const member of members) {
    memberBuckets.set(member.memberId, {
      sectionIds: [],
      totalWords: 0,
      totalVisualElements: 0,
      totalSeconds: 0,
    });
  }

  let totalDurationSeconds = 0;
  let totalWords = 0;
  let totalUniqueVisualElements = 0;

  for (const section of sections) {
    totalDurationSeconds += section.durationSeconds;
    totalWords += section.wordCount;
    totalUniqueVisualElements += section.visualElementCount;

    if (section.assignedMemberId) {
      const bucket = memberBuckets.get(section.assignedMemberId);
      if (bucket) {
        bucket.sectionIds.push(section.id);
        bucket.totalWords += section.wordCount;
        bucket.totalVisualElements += section.visualElementCount;
        bucket.totalSeconds += section.durationSeconds;
      }
    }
  }

  const memberSummaries: MemberDurationSummary[] = members.map((member) => {
    const bucket = memberBuckets.get(member.memberId)!;
    const percentageOfTotal =
      totalDurationSeconds > 0
        ? (bucket.totalSeconds / totalDurationSeconds) * 100
        : 0;

    return {
      memberId: member.memberId,
      name: member.name,
      role: member.role,
      sectionIds: bucket.sectionIds,
      sectionCount: bucket.sectionIds.length,
      totalWords: bucket.totalWords,
      totalVisualElements: bucket.totalVisualElements,
      totalSeconds: bucket.totalSeconds,
      percentageOfTotal,
    };
  });

  const durations = memberSummaries.map((m) => m.totalSeconds);
  const maxMemberSeconds = durations.length > 0 ? Math.max(...durations) : 0;
  const minMemberSeconds = durations.length > 0 ? Math.min(...durations) : 0;
  const durationDifferenceSeconds = Math.max(
    0,
    maxMemberSeconds - minMemberSeconds
  );

  return {
    sections,
    memberSummaries,
    totalDurationSeconds,
    totalWords,
    totalUniqueVisualElements,
    maxMemberSeconds,
    minMemberSeconds,
    durationDifferenceSeconds,
    preservesLogicalSequence: checkLogicalSequencePreserved(sections),
  };
}

/**
 * Distribui as seções em blocos contíguos na sequência lógica do documento
 * minimizando exatamente (maxTempoIndividual - minTempoIndividual) entre os integrantes.
 */
export function distributeSectionsOptimally(
  rawSections: DistributionSectionInput[],
  members: DistributionMemberInput[]
): {
  assignmentMap: Record<string, string>;
  summary: ContentDistributionSummary;
} {
  const orderedSections = normalizeAndDeduplicateSections(rawSections);
  const n = orderedSections.length;
  const k = members.length;

  const assignmentMap: Record<string, string> = {};

  if (n === 0 || k === 0) {
    return {
      assignmentMap,
      summary: calculateDistributionSummary(rawSections, members, assignmentMap),
    };
  }

  if (k === 1) {
    for (const sec of orderedSections) {
      assignmentMap[sec.id] = members[0].memberId;
    }
    return {
      assignmentMap,
      summary: calculateDistributionSummary(rawSections, members, assignmentMap),
    };
  }

  // Caso haja menos seções do que integrantes, distribui 1 por integrante em sequência
  if (n <= k) {
    orderedSections.forEach((sec, index) => {
      assignmentMap[sec.id] = members[index].memberId;
    });
    return {
      assignmentMap,
      summary: calculateDistributionSummary(rawSections, members, assignmentMap),
    };
  }

  // Soma prefixada das durações para consulta O(1) de qualquer bloco contíguo [i..j]
  const prefix = new Array<number>(n + 1).fill(0);
  for (let i = 0; i < n; i++) {
    prefix[i + 1] = prefix[i] + orderedSections[i].durationSeconds;
  }

  const rangeSum = (start: number, endInclusive: number): number =>
    prefix[endInclusive + 1] - prefix[start];

  const totalDuration = prefix[n];
  const maxFeasibleLowerBound = totalDuration / k + 1e-9;

  // Coleta todas as somas contíguas candidatas ao menor tempo individual (L)
  const candidateLowerBoundsSet = new Set<number>([0]);
  for (let i = 0; i < n; i++) {
    for (let j = i; j < n; j++) {
      const sum = rangeSum(i, j);
      if (sum <= maxFeasibleLowerBound) {
        candidateLowerBoundsSet.add(Number(sum.toFixed(6)));
      }
    }
  }

  const candidateLowerBounds = Array.from(candidateLowerBoundsSet).sort(
    (a, b) => b - a
  );

  let bestSpread = Infinity;
  let bestMax = Infinity;
  let bestBoundaries: number[] | null = null;

  // Para cada limite inferior L candidato, encontramos via PD o menor limite superior U possível
  for (const lowerBound of candidateLowerBounds) {
    const dp: number[][] = Array.from({ length: k + 1 }, () =>
      new Array<number>(n).fill(Infinity)
    );
    const prevSplit: number[][] = Array.from({ length: k + 1 }, () =>
      new Array<number>(n).fill(-1)
    );

    for (let i = 0; i < n; i++) {
      const s = rangeSum(0, i);
      if (s + 1e-6 >= lowerBound) {
        dp[1][i] = s;
      }
    }

    for (let group = 2; group <= k; group++) {
      for (let i = group - 1; i < n; i++) {
        let currentBestMax = Infinity;
        let currentBestSplit = -1;

        for (let split = group - 2; split < i; split++) {
          const prevMax = dp[group - 1][split];
          if (!Number.isFinite(prevMax)) continue;

          const lastBlock = rangeSum(split + 1, i);
          if (lastBlock + 1e-6 < lowerBound) continue;

          const candidateMax = Math.max(prevMax, lastBlock);
          if (candidateMax < currentBestMax - 1e-9) {
            currentBestMax = candidateMax;
            currentBestSplit = split;
          }
        }

        dp[group][i] = currentBestMax;
        prevSplit[group][i] = currentBestSplit;
      }
    }

    const achievedMax = dp[k][n - 1];
    if (!Number.isFinite(achievedMax)) continue;

    // Reconstrói as fronteiras reais para calcular o min/max exato (sem imprecisão de arredondamento)
    const boundaries = new Array<number>(k + 1);
    boundaries[k] = n - 1;
    let cursor = n - 1;
    for (let group = k; group >= 2; group--) {
      cursor = prevSplit[group][cursor];
      boundaries[group - 1] = cursor;
    }
    boundaries[0] = -1;

    let actualMin = Infinity;
    let actualMax = -Infinity;
    for (let group = 0; group < k; group++) {
      const start = boundaries[group] + 1;
      const end = boundaries[group + 1];
      const blockSum = rangeSum(start, end);
      actualMin = Math.min(actualMin, blockSum);
      actualMax = Math.max(actualMax, blockSum);
    }

    const actualSpread = actualMax - actualMin;

    if (
      actualSpread < bestSpread - 1e-9 ||
      (Math.abs(actualSpread - bestSpread) <= 1e-9 &&
        actualMax < bestMax - 1e-9)
    ) {
      bestSpread = actualSpread;
      bestMax = actualMax;
      bestBoundaries = boundaries;
    }
  }

  if (bestBoundaries) {
    for (let group = 0; group < k; group++) {
      const start = bestBoundaries[group] + 1;
      const end = bestBoundaries[group + 1];
      const memberId = members[group].memberId;
      for (let idx = start; idx <= end; idx++) {
        assignmentMap[orderedSections[idx].id] = memberId;
      }
    }
  }

  return {
    assignmentMap,
    summary: calculateDistributionSummary(rawSections, members, assignmentMap),
  };
}

/**
 * Altera manualmente o integrante responsável por uma seção e recalcula automaticamente
 * os tempos individuais, o tempo total e a diferença entre maior e menor duração.
 */
export function reassignSectionManually(
  rawSections: DistributionSectionInput[],
  members: DistributionMemberInput[],
  currentAssignmentMap: Record<string, string>,
  sectionId: string,
  newMemberId: string
): {
  assignmentMap: Record<string, string>;
  summary: ContentDistributionSummary;
} {
  const nextAssignmentMap: Record<string, string> = {
    ...currentAssignmentMap,
    [sectionId]: newMemberId,
  };

  return {
    assignmentMap: nextAssignmentMap,
    summary: calculateDistributionSummary(
      rawSections,
      members,
      nextAssignmentMap
    ),
  };
}

/**
 * Constrói a lista normalizada de seções para distribuição a partir do PDF analisado
 * ou, caso ainda não haja análise de PDF, a partir da divisão manual de conteúdo do projeto.
 */
export function buildProjectDistributionInputs(project: Project): {
  sections: DistributionSectionInput[];
  initialAssignments: Record<string, string>;
} {
  const pdfSections: PdfSectionAnalysis[] =
    project.pdfDocument?.analysis?.sections ?? [];

  if (pdfSections.length > 0) {
    const sections: DistributionSectionInput[] = pdfSections.map(
      (section, index) => {
        const fullText = [
          section.title,
          section.summary,
          ...section.mainTopics,
        ].join(' ');
        return {
          id: section.id,
          order: index + 1,
          title: section.title,
          summary: section.summary,
          wordCount: countWords(fullText),
          visualElements: section.visualElements ?? [],
          sourcePages: section.sourcePages ?? [],
        };
      }
    );

    const saved = project.sectionAssignments ?? {};
    return {
      sections,
      initialAssignments: { ...saved },
    };
  }

  const fallbackSections: DistributionSectionInput[] =
    project.contentDivision.map((item: ContentDivisionItem) => ({
      id: item.id,
      order: item.order,
      title: item.topicTitle,
      summary: item.keyPoints,
      wordCount: countWords(`${item.topicTitle} ${item.keyPoints}`),
      visualElements: [],
      sourcePages: [],
    }));

  const fallbackAssignments: Record<string, string> = {};
  for (const item of project.contentDivision) {
    if (project.sectionAssignments?.[item.id]) {
      fallbackAssignments[item.id] = project.sectionAssignments[item.id];
    } else if (item.assignedMemberId) {
      fallbackAssignments[item.id] = item.assignedMemberId;
    }
  }

  return {
    sections: fallbackSections,
    initialAssignments: fallbackAssignments,
  };
}

export function buildMemberInputsFromAssignments(
  projectAssignments: TeamMemberAssignmentView[]
): DistributionMemberInput[] {
  return projectAssignments.map((item) => ({
    memberId: item.memberId,
    name: item.name,
    email: item.email,
    role: item.role,
  }));
}

export function formatDurationSecondsPtBr(totalSeconds: number): string {
  const rounded = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(rounded / 60);
  const seconds = rounded % 60;
  if (minutes === 0) {
    return `${seconds}s`;
  }
  return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
}
