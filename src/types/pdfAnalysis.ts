export type InformationOriginType = 'explicit' | 'ai_interpretation';

export type VisualElementType = 'imagem' | 'tabela' | 'grafico' | 'diagrama';

export interface PdfVisualElement {
  id: string;
  type: VisualElementType;
  title: string;
  description: string;
  sectionId: string | null;
  sourcePages: number[];
}

export interface PdfSectionAnalysis {
  id: string;
  parentSectionId: string | null;
  level: number;
  title: string;
  summary: string;
  mainTopics: string[];
  visualElements: PdfVisualElement[];
  sourcePages: number[];
}

export interface PdfMainObjective {
  text: string;
  sourceType: InformationOriginType;
  sourcePages: number[];
}

export interface PdfIntroductionAnalysis {
  summary: string;
  explicitPoints: string[];
  aiNotes: string[];
  sourcePages: number[];
}

export interface PdfArgumentItem {
  argument: string;
  evidence: string;
  sourceType: InformationOriginType;
  sourcePages: number[];
}

export interface PdfConceptItem {
  term: string;
  definition: string;
  sourceType: InformationOriginType;
  sourcePages: number[];
}

export interface PdfExampleItem {
  title: string;
  description: string;
  sourcePages: number[];
}

export interface PdfConclusionsAnalysis {
  explicitConclusions: string[];
  aiInterpretations: string[];
  sourcePages: number[];
}

export interface PdfReferenceItem {
  reference: string;
  context: string;
  sourcePages: number[];
}

export interface PdfUncertaintyItem {
  topic: string;
  reason: string;
  sourcePages: number[];
}

export interface PdfAiInterpretationItem {
  statement: string;
  basis: string;
  sourcePages: number[];
}

export interface PdfStructuredAnalysis {
  documentTitle: string;
  documentTitleSourcePages: number[];
  mainObjective: PdfMainObjective;
  introduction: PdfIntroductionAnalysis;
  sections: PdfSectionAnalysis[];
  mainArguments: PdfArgumentItem[];
  keyConcepts: PdfConceptItem[];
  authorExamples: PdfExampleItem[];
  conclusions: PdfConclusionsAnalysis;
  relevantReferences: PdfReferenceItem[];
  visualElements: PdfVisualElement[];
  aiInterpretations: PdfAiInterpretationItem[];
  uncertainties: PdfUncertaintyItem[];
}

export interface PdfAnalysisApiResponse {
  projectId: string;
  fileName: string;
  fileSizeBytes: number;
  fileSizeLabel: string;
  analyzedAt: string;
  model: string;
  analysis: PdfStructuredAnalysis;
}
