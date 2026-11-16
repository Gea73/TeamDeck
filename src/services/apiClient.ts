import {
  MOCK_CALENDAR_EVENTS,
  MOCK_PROJECTS,
  MOCK_REHEARSALS,
  MOCK_TEAM_MEMBERS,
  MOCK_USER_PROFILE,
  MOCK_USER_SETTINGS,
} from '../data/mockData';
import {
  CalendarEvent,
  CreateProjectPayload,
  Project,
  RehearsalSession,
  TeamMember,
  UserProfile,
  UserSettings,
} from '../types';

/**
 * Camada de serviço desacoplada para facilitar a futura conexão
 * com uma API REST em Node.js + Express sem alterar os componentes visuais.
 */
export const API_ENDPOINTS = {
  projects: '/api/projects',
  members: '/api/members',
  rehearsals: '/api/rehearsals',
  calendar: '/api/calendar',
  profile: '/api/profile',
  settings: '/api/settings',
} as const;

export interface TeamDeckRepository {
  getProjects(): Project[];
  createProjectModel(payload: CreateProjectPayload): Project;
  getTeamMembers(): TeamMember[];
  getRehearsals(): RehearsalSession[];
  getCalendarEvents(): CalendarEvent[];
  getUserProfile(): UserProfile;
  getUserSettings(): UserSettings;
}

export const teamDeckService: TeamDeckRepository = {
  getProjects: () => MOCK_PROJECTS,

  createProjectModel: (payload: CreateProjectPayload): Project => ({
    id: `proj-${Date.now()}`,
    title: payload.title.trim(),
    description: payload.description.trim(),
    discipline: payload.discipline?.trim() || 'Disciplina Acadêmica',
    institution: MOCK_USER_PROFILE.institution,
    advisor: 'A definir',
    presentationDate: payload.presentationDate,
    presentationTime: '19:00',
    location: 'Sala a confirmar',
    targetDurationMinutes: 20,
    memberCount: payload.memberCount,
    status: payload.status,
    overallProgress: 10,
    pdfDocument: null,
    contentDivision: [],
    slides: [],
  }),

  getTeamMembers: () => MOCK_TEAM_MEMBERS,
  getRehearsals: () => MOCK_REHEARSALS,
  getCalendarEvents: () => MOCK_CALENDAR_EVENTS,
  getUserProfile: () => MOCK_USER_PROFILE,
  getUserSettings: () => MOCK_USER_SETTINGS,
};
