import {
  buildMemberInputsFromAssignments,
  buildProjectDistributionInputs,
  calculateDistributionSummary,
  countWords,
  distributeSectionsOptimally,
  SPEAKING_WORDS_PER_MINUTE,
} from './contentDistribution';
import { buildSlideDeckPlan } from './googleSlidesBuilder';
import { Project, TeamMemberAssignmentView } from '../types';
import {
  AudienceQuestionAnswer,
  MemberAssignedSectionInput,
  MemberPreparationApiResponse,
  MemberPreparationGenerateInput,
  PracticalExampleItem,
  PreparationReviewStatus,
  PreparationScriptBlock,
  SlideTransitionSuggestion,
  TechnicalConceptExplanation,
} from '../types/preparation';

export const REQUIRED_AUDIENCE_QUESTIONS_COUNT = 5;

export interface PreparationValidationResult {
  valid: boolean;
  errors: string[];
  data?: MemberPreparationApiResponse['material'];
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizeSourcePages(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  const nums = value.filter(
    (item): item is number => Number.isInteger(item) && item > 0
  );
  return Array.from(new Set(nums)).sort((a, b) => a - b);
}

function stripMarkdownJsonFence(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

export function estimateOralReadingSeconds(text: string): number {
  const words = countWords(text);
  return (words / SPEAKING_WORDS_PER_MINUTE) * 60;
}

export function computePreparationTargetWords(speakingSeconds: number): number {
  if (!Number.isFinite(speakingSeconds) || speakingSeconds <= 0) {
    return 40;
  }
  return Math.max(25, Math.round((speakingSeconds / 60) * SPEAKING_WORDS_PER_MINUTE));
}

export function countReviewedBlocks(status: PreparationReviewStatus): number {
  return [
    status.scriptReviewed,
    status.conceptsReviewed,
    status.examplesReviewed,
    status.questionsReviewed,
    status.transitionsReviewed,
  ].filter(Boolean).length;
}

export function isPreparationFullyReviewed(
  status: PreparationReviewStatus
): boolean {
  return countReviewedBlocks(status) === 5;
}

/**
 * Monta a entrada exclusiva para um único integrante, isolando estritamente
 * as seções atribuídas a ele, seus conceitos, exemplos e páginas de origem.
 */
export function buildExclusiveMemberPreparationInput(
  project: Project,
  projectMembers: TeamMemberAssignmentView[],
  memberId: string
): MemberPreparationGenerateInput {
  const targetMember = projectMembers.find((m) => m.memberId === memberId);
  if (!targetMember) {
    throw new Error('Integrante não está associado a este projeto.');
  }

  const { sections, initialAssignments } =
    buildProjectDistributionInputs(project);
  if (sections.length === 0) {
    throw new Error(
      'Não há seções disponíveis neste projeto. Processe o PDF ou estruture o conteúdo primeiro.'
    );
  }

  const memberInputs = buildMemberInputsFromAssignments(projectMembers);
  const allAssigned = sections.every((s) => Boolean(initialAssignments[s.id]));
  const distribution =
    memberInputs.length > 0 && !allAssigned
      ? distributeSectionsOptimally(sections, memberInputs).summary
      : calculateDistributionSummary(
          sections,
          memberInputs,
          initialAssignments
        );

  const memberDistributionSections = distribution.sections.filter(
    (s) => s.assignedMemberId === memberId
  );

  if (memberDistributionSections.length === 0) {
    throw new Error(
      `Nenhuma seção foi atribuída a ${targetMember.name}. Atribua pelo menos uma seção na aba Divisão de conteúdo.`
    );
  }

  const pdfAnalysis = project.pdfDocument?.analysis ?? null;
  const pdfSectionsById = new Map(
    (pdfAnalysis?.sections ?? []).map((s) => [s.id, s])
  );

  const assignedSections: MemberAssignedSectionInput[] =
    memberDistributionSections.map((distSec) => {
      const pdfSec = pdfSectionsById.get(distSec.id);
      const targetWordCount = computePreparationTargetWords(
        distSec.speakingSeconds
      );

      return {
        sectionId: distSec.id,
        order: distSec.order,
        title: distSec.title,
        summary: distSec.summary,
        mainTopics: pdfSec?.mainTopics ?? [],
        visualElements: distSec.uniqueVisualElements.map((v) => ({
          id: v.id,
          type: v.type,
          title: v.title,
          description: v.description,
          sourcePages: v.sourcePages,
        })),
        sourcePages: distSec.sourcePages,
        speakingSeconds: distSec.speakingSeconds,
        visualSeconds: distSec.visualSeconds,
        durationSeconds: distSec.durationSeconds,
        targetWordCount,
      };
    });

  // Páginas pertencentes exclusivamente às seções deste integrante
  const assignedPagesSet = new Set<number>(
    assignedSections.flatMap((s) => s.sourcePages)
  );
  const overlapsAssignedPages = (pages: number[]): boolean => {
    if (assignedPagesSet.size === 0 || pages.length === 0) return false;
    return pages.some((p) => assignedPagesSet.has(p));
  };

  const relevantConcepts = (pdfAnalysis?.keyConcepts ?? [])
    .filter((c) => overlapsAssignedPages(c.sourcePages))
    .map((c) => ({
      term: c.term,
      definition: c.definition,
      sourceType: c.sourceType,
      sourcePages: c.sourcePages,
    }));

  const relevantExamples = (pdfAnalysis?.authorExamples ?? [])
    .filter((ex) => overlapsAssignedPages(ex.sourcePages))
    .map((ex) => ({
      title: ex.title,
      description: ex.description,
      sourcePages: ex.sourcePages,
    }));

  const relevantUncertainties = (pdfAnalysis?.uncertainties ?? [])
    .filter((u) => overlapsAssignedPages(u.sourcePages))
    .map((u) => ({
      topic: u.topic,
      reason: u.reason,
      sourcePages: u.sourcePages,
    }));

  // Dicas de sequência apenas para os slides das seções deste integrante
  const assignedIds = assignedSections.map((s) => s.sectionId);
  const assignedIdsSet = new Set(assignedIds);

  const deckPlan = buildSlideDeckPlan({
    projectId: project.id,
    projectTitle: project.title,
    projectDescription: project.description,
    discipline: project.discipline,
    institution: project.institution,
    advisor: project.advisor,
    presentationDate: project.presentationDate,
    presentationTime: project.presentationTime,
    location: project.location,
    memberNames: projectMembers.map((m) => m.name),
    pdfFileName: project.pdfDocument?.fileName ?? null,
    pdfAnalysis,
    distributionSummary: distribution,
    approvedSectionIds: distribution.sections.map((s) => s.id),
  });

  const slideSequenceHints = deckPlan.slides
    .map((slide, idx) => {
      if (!slide.sectionId || !assignedIdsSet.has(slide.sectionId)) {
        return null;
      }
      const nextSlide = deckPlan.slides[idx + 1] ?? null;
      return {
        slideNumber: slide.slideNumber,
        title: slide.title,
        nextSlideTitle: nextSlide ? nextSlide.title : null,
        nextSpeakerName: nextSlide ? nextSlide.assignedMemberName : null,
      };
    })
    .filter(
      (
        item
      ): item is {
        slideNumber: number;
        title: string;
        nextSlideTitle: string | null;
        nextSpeakerName: string | null;
      } => item !== null
    );

  const calculatedDurationSeconds = assignedSections.reduce(
    (sum, s) => sum + s.durationSeconds,
    0
  );
  const totalTargetWordCount = assignedSections.reduce(
    (sum, s) => sum + s.targetWordCount,
    0
  );

  return {
    projectId: project.id,
    projectTitle: project.title,
    discipline: project.discipline,
    memberId: targetMember.memberId,
    memberName: targetMember.name,
    memberRole: targetMember.role,
    calculatedDurationSeconds,
    totalTargetWordCount,
    assignedSections,
    relevantConcepts,
    relevantExamples,
    relevantUncertainties,
    slideSequenceHints,
  };
}

export function validatePreparationMaterialStructure(
  payload: unknown,
  allowedSectionIds: string[]
): PreparationValidationResult {
  const errors: string[] = [];

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return {
      valid: false,
      errors: ['O retorno da IA deve ser um objeto JSON válido.'],
    };
  }

  const obj = payload as Record<string, unknown>;
  const allowedSet = new Set(allowedSectionIds);

  if (!isNonEmptyString(obj.overviewSummary)) {
    errors.push('O campo "overviewSummary" é obrigatório.');
  }

  // 1. Roteiro detalhado
  const detailedScript: PreparationScriptBlock[] = [];
  if (!Array.isArray(obj.detailedScript) || obj.detailedScript.length === 0) {
    errors.push(
      'O campo "detailedScript" deve conter pelo menos um bloco de roteiro.'
    );
  } else {
    obj.detailedScript.forEach((item, index) => {
      if (!item || typeof item !== 'object') {
        errors.push(`detailedScript[${index}] inválido.`);
        return;
      }
      const b = item as Record<string, unknown>;
      const sectionId = isNonEmptyString(b.sectionId) ? b.sectionId.trim() : '';
      if (!sectionId || (allowedSet.size > 0 && !allowedSet.has(sectionId))) {
        errors.push(
          `detailedScript[${index}].sectionId ("${sectionId}") não pertence às seções atribuídas ao integrante.`
        );
      }
      if (!isNonEmptyString(b.sectionTitle)) {
        errors.push(`detailedScript[${index}].sectionTitle é obrigatório.`);
      }
      if (!isNonEmptyString(b.oralScript)) {
        errors.push(`detailedScript[${index}].oralScript é obrigatório.`);
      }

      detailedScript.push({
        id: isNonEmptyString(b.id) ? b.id.trim() : `script_${index + 1}`,
        sectionId,
        sectionTitle: isNonEmptyString(b.sectionTitle)
          ? b.sectionTitle.trim()
          : '',
        estimatedSeconds:
          typeof b.estimatedSeconds === 'number' && b.estimatedSeconds > 0
            ? Math.round(b.estimatedSeconds)
            : 60,
        targetWordCount:
          typeof b.targetWordCount === 'number' && b.targetWordCount > 0
            ? Math.round(b.targetWordCount)
            : 130,
        oralScript: isNonEmptyString(b.oralScript) ? b.oralScript.trim() : '',
        keyDeliveryCue: isNonEmptyString(b.keyDeliveryCue)
          ? b.keyDeliveryCue.trim()
          : 'Mantenha ritmo natural e contato visual com a banca.',
        sourcePages: normalizeSourcePages(b.sourcePages),
      });
    });
  }

  // 2. Conceitos técnicos
  const technicalConcepts: TechnicalConceptExplanation[] = [];
  if (!Array.isArray(obj.technicalConcepts) || obj.technicalConcepts.length === 0) {
    errors.push(
      'O campo "technicalConcepts" deve explicar pelo menos um conceito das seções.'
    );
  } else {
    obj.technicalConcepts.forEach((item, index) => {
      if (!item || typeof item !== 'object') {
        errors.push(`technicalConcepts[${index}] inválido.`);
        return;
      }
      const c = item as Record<string, unknown>;
      if (!isNonEmptyString(c.term) || !isNonEmptyString(c.accessibleExplanation)) {
        errors.push(
          `technicalConcepts[${index}] precisa de "term" e "accessibleExplanation".`
        );
      }
      technicalConcepts.push({
        id: isNonEmptyString(c.id) ? c.id.trim() : `concept_${index + 1}`,
        term: isNonEmptyString(c.term) ? c.term.trim() : '',
        accessibleExplanation: isNonEmptyString(c.accessibleExplanation)
          ? c.accessibleExplanation.trim()
          : '',
        documentBasis: isNonEmptyString(c.documentBasis)
          ? c.documentBasis.trim()
          : 'Baseado nas seções atribuídas do documento.',
        sourcePages: normalizeSourcePages(c.sourcePages),
      });
    });
  }

  // 3. Exemplos práticos
  const practicalExamples: PracticalExampleItem[] = [];
  if (!Array.isArray(obj.practicalExamples) || obj.practicalExamples.length === 0) {
    errors.push(
      'O campo "practicalExamples" deve conter pelo menos um exemplo prático.'
    );
  } else {
    obj.practicalExamples.forEach((item, index) => {
      if (!item || typeof item !== 'object') {
        errors.push(`practicalExamples[${index}] inválido.`);
        return;
      }
      const ex = item as Record<string, unknown>;
      if (!isNonEmptyString(ex.title) || !isNonEmptyString(ex.explanation)) {
        errors.push(
          `practicalExamples[${index}] precisa de "title" e "explanation".`
        );
      }
      const originType =
        ex.originType === 'explicit_from_document' ||
        ex.originType === 'didactic_illustration'
          ? ex.originType
          : 'didactic_illustration';

      practicalExamples.push({
        id: isNonEmptyString(ex.id) ? ex.id.trim() : `example_${index + 1}`,
        title: isNonEmptyString(ex.title) ? ex.title.trim() : '',
        explanation: isNonEmptyString(ex.explanation)
          ? ex.explanation.trim()
          : '',
        connectionToSection: isNonEmptyString(ex.connectionToSection)
          ? ex.connectionToSection.trim()
          : '',
        originType,
        sourcePages: normalizeSourcePages(ex.sourcePages),
      });
    });
  }

  // 4. Exatamente 5 perguntas da audiência + respostas fundamentadas
  const audienceQuestions: AudienceQuestionAnswer[] = [];
  if (!Array.isArray(obj.audienceQuestions)) {
    errors.push('O campo "audienceQuestions" é obrigatório.');
  } else if (obj.audienceQuestions.length !== REQUIRED_AUDIENCE_QUESTIONS_COUNT) {
    errors.push(
      `O campo "audienceQuestions" deve conter exatamente ${REQUIRED_AUDIENCE_QUESTIONS_COUNT} perguntas (recebido: ${obj.audienceQuestions.length}).`
    );
  } else {
    obj.audienceQuestions.forEach((item, index) => {
      if (!item || typeof item !== 'object') {
        errors.push(`audienceQuestions[${index}] inválido.`);
        return;
      }
      const q = item as Record<string, unknown>;
      if (
        !isNonEmptyString(q.question) ||
        !isNonEmptyString(q.answer) ||
        !isNonEmptyString(q.evidenceFromDocument)
      ) {
        errors.push(
          `audienceQuestions[${index}] exige "question", "answer" e "evidenceFromDocument".`
        );
      }
      audienceQuestions.push({
        id: isNonEmptyString(q.id) ? q.id.trim() : `qa_${index + 1}`,
        question: isNonEmptyString(q.question) ? q.question.trim() : '',
        answer: isNonEmptyString(q.answer) ? q.answer.trim() : '',
        evidenceFromDocument: isNonEmptyString(q.evidenceFromDocument)
          ? q.evidenceFromDocument.trim()
          : '',
        uncertaintyNote: isNonEmptyString(q.uncertaintyNote)
          ? q.uncertaintyNote.trim()
          : null,
        sourcePages: normalizeSourcePages(q.sourcePages),
      });
    });
  }

  // 5. Sugestões de transição entre slides
  const slideTransitions: SlideTransitionSuggestion[] = [];
  if (!Array.isArray(obj.slideTransitions) || obj.slideTransitions.length === 0) {
    errors.push(
      'O campo "slideTransitions" deve conter sugestões de transição entre slides.'
    );
  } else {
    obj.slideTransitions.forEach((item, index) => {
      if (!item || typeof item !== 'object') {
        errors.push(`slideTransitions[${index}] inválido.`);
        return;
      }
      const tr = item as Record<string, unknown>;
      if (
        !isNonEmptyString(tr.fromContext) ||
        !isNonEmptyString(tr.toContext) ||
        !isNonEmptyString(tr.suggestedPhrase)
      ) {
        errors.push(
          `slideTransitions[${index}] exige "fromContext", "toContext" e "suggestedPhrase".`
        );
      }
      slideTransitions.push({
        id: isNonEmptyString(tr.id) ? tr.id.trim() : `trans_${index + 1}`,
        fromContext: isNonEmptyString(tr.fromContext)
          ? tr.fromContext.trim()
          : '',
        toContext: isNonEmptyString(tr.toContext) ? tr.toContext.trim() : '',
        suggestedPhrase: isNonEmptyString(tr.suggestedPhrase)
          ? tr.suggestedPhrase.trim()
          : '',
      });
    });
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: [],
    data: {
      overviewSummary: (obj.overviewSummary as string).trim(),
      detailedScript,
      technicalConcepts,
      practicalExamples,
      audienceQuestions,
      slideTransitions,
    },
  };
}

export function parseAndValidatePreparationMaterial(
  rawText: string,
  allowedSectionIds: string[]
): PreparationValidationResult {
  const cleaned = stripMarkdownJsonFence(rawText);
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

  return validatePreparationMaterialStructure(parsed, allowedSectionIds);
}
