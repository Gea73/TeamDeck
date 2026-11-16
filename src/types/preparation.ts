export interface PreparationScriptBlock {
  id: string;
  sectionId: string;
  sectionTitle: string;
  estimatedSeconds: number;
  targetWordCount: number;
  oralScript: string;
  keyDeliveryCue: string;
  sourcePages: number[];
}

export interface TechnicalConceptExplanation {
  id: string;
  term: string;
  accessibleExplanation: string;
  documentBasis: string;
  sourcePages: number[];
}

export type PracticalExampleOrigin =
  | 'explicit_from_document'
  | 'didactic_illustration';

export interface PracticalExampleItem {
  id: string;
  title: string;
  explanation: string;
  connectionToSection: string;
  originType: PracticalExampleOrigin;
  sourcePages: number[];
}

export interface AudienceQuestionAnswer {
  id: string;
  question: string;
  answer: string;
  evidenceFromDocument: string;
  uncertaintyNote: string | null;
  sourcePages: number[];
}

export interface SlideTransitionSuggestion {
  id: string;
  fromContext: string;
  toContext: string;
  suggestedPhrase: string;
}

export interface PreparationReviewStatus {
  scriptReviewed: boolean;
  conceptsReviewed: boolean;
  examplesReviewed: boolean;
  questionsReviewed: boolean;
  transitionsReviewed: boolean;
}

export interface MemberPreparationMaterial {
  id: string;
  projectId: string;
  memberId: string;
  memberName: string;
  memberRole: string;
  assignedSectionIds: string[];
  assignedSectionTitles: string[];
  calculatedDurationSeconds: number;
  totalTargetWordCount: number;
  overviewSummary: string;
  detailedScript: PreparationScriptBlock[];
  technicalConcepts: TechnicalConceptExplanation[];
  practicalExamples: PracticalExampleItem[];
  audienceQuestions: AudienceQuestionAnswer[];
  slideTransitions: SlideTransitionSuggestion[];
  reviewedSections: PreparationReviewStatus;
  allReviewed: boolean;
  generatedAt: string;
  updatedAt: string;
  reviewedAt: string | null;
  model: string;
}

export interface MemberAssignedSectionInput {
  sectionId: string;
  order: number;
  title: string;
  summary: string;
  mainTopics: string[];
  visualElements: Array<{
    id: string;
    type: string;
    title: string;
    description: string;
    sourcePages: number[];
  }>;
  sourcePages: number[];
  speakingSeconds: number;
  visualSeconds: number;
  durationSeconds: number;
  targetWordCount: number;
}

export interface MemberPreparationGenerateInput {
  projectId: string;
  projectTitle: string;
  discipline: string;
  memberId: string;
  memberName: string;
  memberRole: string;
  calculatedDurationSeconds: number;
  totalTargetWordCount: number;
  assignedSections: MemberAssignedSectionInput[];
  relevantConcepts: Array<{
    term: string;
    definition: string;
    sourceType: string;
    sourcePages: number[];
  }>;
  relevantExamples: Array<{
    title: string;
    description: string;
    sourcePages: number[];
  }>;
  relevantUncertainties: Array<{
    topic: string;
    reason: string;
    sourcePages: number[];
  }>;
  slideSequenceHints: Array<{
    slideNumber: number;
    title: string;
    nextSlideTitle: string | null;
    nextSpeakerName: string | null;
  }>;
}

export interface MemberPreparationApiResponse {
  projectId: string;
  memberId: string;
  generatedAt: string;
  model: string;
  material: Omit<
    MemberPreparationMaterial,
    | 'id'
    | 'projectId'
    | 'memberId'
    | 'memberName'
    | 'memberRole'
    | 'assignedSectionIds'
    | 'assignedSectionTitles'
    | 'calculatedDurationSeconds'
    | 'totalTargetWordCount'
    | 'reviewedSections'
    | 'allReviewed'
    | 'generatedAt'
    | 'updatedAt'
    | 'reviewedAt'
    | 'model'
  >;
}
