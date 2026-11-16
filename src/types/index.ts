import { PdfStructuredAnalysis } from './pdfAnalysis';
import { MemberPreparationMaterial } from './preparation';
import { EmailDispatchLog, RehearsalReminderConfig } from './workspace';

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
  | 'preparation'
  | 'communication'
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

export interface PdfDocument {
  id: string;
  fileName: string;
  fileSize: string;
  pageCount: number;
  uploadedAt: string;
  uploadedBy: string;
  summary: string;
  extractedTopics: string[];
  analysis?: PdfStructuredAnalysis | null;
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
  durationSeconds?: number;
  layoutType?:
    | 'cover'
    | 'section_standard'
    | 'section_visual_split'
    | 'section_two_column'
    | 'conclusion';
  sourcePages?: number[];
  visualCallouts?: string[];
}

export interface GooglePresentationMetadata {
  presentationId: string;
  presentationUrl: string;
  title: string;
  slideCount: number;
  approvedSectionIds: string[];
  generatedAt: string;
}

/**
 * Entidade relacional: tabela `projects`
 */
export interface ProjectEntity {
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
  status: ProjectStatus;
  baseProgress: number;
  pdfDocument: PdfDocument | null;
  contentDivision: ContentDivisionItem[];
  sectionAssignments?: Record<string, string>;
  slides: PresentationSlide[];
  googlePresentation?: GooglePresentationMetadata | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Entidade relacional: tabela `members`
 */
export interface MemberEntity {
  id: string;
  name: string;
  email: string;
  defaultRole: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Entidade associativa: tabela `project_members`
 */
export interface ProjectMemberAssociation {
  id: string;
  projectId: string;
  memberId: string;
  role: string;
  responsibility: string;
  presentationMinutes: number;
  progress: number;
  tasksCompleted: number;
  tasksTotal: number;
  assignedAt: string;
}

/**
 * Modelo agregado de leitura para visualização de projetos
 */
export interface Project extends ProjectEntity {
  memberCount: number;
  overallProgress: number;
}

/**
 * Modelo agregado de leitura para integrante vinculado a um projeto
 */
export interface TeamMemberAssignmentView {
  associationId: string;
  memberId: string;
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

/**
 * Modelo agregado de leitura para diretório de integrantes (com todos os projetos associados)
 */
export interface MemberDirectoryItem extends MemberEntity {
  assignments: TeamMemberAssignmentView[];
  totalPresentationMinutes: number;
  averageProgress: number;
}

export interface RehearsalSession {
  id: string;
  projectId: string;
  projectName: string;
  title: string;
  description?: string;
  date: string;
  time: string;
  location: string;
  modality: 'Presencial' | 'Online';
  durationMinutes: number;
  status: RehearsalStatus;
  notes: string;
  attendeeEmails?: string[];
  meetingLink?: string;
  reminders?: RehearsalReminderConfig[];
  googleCalendarEventId?: string | null;
  googleCalendarHtmlLink?: string | null;
  googleMeetLink?: string | null;
  syncedAt?: string | null;
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

export interface CreateProjectInput {
  title: string;
  description: string;
  discipline: string;
  advisor: string;
  presentationDate: string;
  presentationTime: string;
  location: string;
  targetDurationMinutes: number;
  status: ProjectStatus;
}

export interface UpdateProjectInput extends CreateProjectInput {
  id: string;
}

export interface CreateMemberInput {
  name: string;
  email: string;
  defaultRole: string;
}

export interface UpdateMemberInput extends CreateMemberInput {
  id: string;
}

export interface AssociateMemberInput {
  projectId: string;
  memberId: string;
  role: string;
  responsibility: string;
  presentationMinutes: number;
  progress: number;
}

export interface UpdateAssociationInput {
  associationId: string;
  role: string;
  responsibility: string;
  presentationMinutes: number;
  progress: number;
}

export interface ValidationErrors {
  [field: string]: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationErrors;
}

export interface WorkspaceSnapshot {
  projects: Project[];
  members: MemberDirectoryItem[];
  assignments: TeamMemberAssignmentView[];
  rehearsals: RehearsalSession[];
  calendarEvents: CalendarEvent[];
  preparations: MemberPreparationMaterial[];
  emailLogs: EmailDispatchLog[];
  userProfile: UserProfile;
  userSettings: UserSettings;
}
