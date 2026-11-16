export type NavigationRoute =
  | 'dashboard'
  | 'projects'
  | 'project-detail'
  | 'teams'
  | 'calendar'
  | 'settings'
  | 'profile';

export type ProjectDetailTab =
  | 'overview'
  | 'members'
  | 'pdf'
  | 'content'
  | 'presentation'
  | 'rehearsals'
  | 'progress';

export enum ProjectStatus {
  PLANNING = 'Planejamento',
  IN_PROGRESS = 'Em andamento',
  REHEARSING = 'Em ensaio',
  COMPLETED = 'Concluído',
}

export enum RehearsalStatus {
  CONFIRMED = 'Confirmado',
  PENDING = 'Pendente',
  DONE = 'Realizado',
}

export enum ContentSectionStatus {
  PENDING = 'Pendente',
  DRAFTING = 'Em redação',
  READY = 'Revisado',
}

export interface TeamMember {
  id: string;
  projectId: string;
  projectName: string;
  name: string;
  email: string;
  role: string;
  responsibility: string;
  presentationMinutes: number;
  progress: number;
  tasksCompleted: number;
  tasksTotal: number;
}

export interface PdfDocument {
  id: string;
  fileName: string;
  fileSize: string;
  pageCount: number;
  uploadedAt: string;
  uploadedBy: string;
  summary: string;
  extractedTopics: string[];
}

export interface ContentDivisionItem {
  id: string;
  order: number;
  topicTitle: string;
  keyPoints: string;
  assignedMemberId: string;
  assignedMemberName: string;
  estimatedMinutes: number;
  status: ContentSectionStatus;
}

export interface PresentationSlide {
  id: string;
  slideNumber: number;
  title: string;
  subtitle: string;
  bulletPoints: string[];
  speakerNotes: string;
  assignedMemberName: string;
  durationMinutes: number;
}

export interface RehearsalSession {
  id: string;
  projectId: string;
  projectName: string;
  title: string;
  date: string;
  time: string;
  location: string;
  modality: 'Presencial' | 'Online';
  durationMinutes: number;
  status: RehearsalStatus;
  notes: string;
}

export interface Project {
  id: string;
  title: string;
  description: string;
  discipline: string;
  institution: string;
  advisor: string;
  presentationDate: string;
  presentationTime: string;
  location: string;
  targetDurationMinutes: number;
  memberCount: number;
  status: ProjectStatus;
  overallProgress: number;
  pdfDocument: PdfDocument | null;
  contentDivision: ContentDivisionItem[];
  slides: PresentationSlide[];
}

export interface CalendarEvent {
  id: string;
  date: string;
  time: string;
  title: string;
  projectId: string;
  projectName: string;
  type: 'Apresentação' | 'Ensaio' | 'Entrega';
  location: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  course: string;
  institution: string;
  semester: string;
  registrationId: string;
  role: string;
}

export interface UserSettings {
  rehearsalReminders: boolean;
  emailDigest: boolean;
  showTimerWarnings: boolean;
  defaultSlideDuration: number;
  timezone: string;
  academicPeriod: string;
}

export interface CreateProjectPayload {
  title: string;
  description: string;
  presentationDate: string;
  memberCount: number;
  status: ProjectStatus;
  discipline?: string;
}
