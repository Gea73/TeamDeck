import {
  MOCK_USER_PROFILE,
  MOCK_USER_SETTINGS,
  SEED_MEMBERS,
  SEED_PROJECTS,
  SEED_PROJECT_MEMBERS,
  SEED_REHEARSALS,
} from '../data/mockData';
import {
  MemberEntity,
  ProjectEntity,
  ProjectMemberAssociation,
  RehearsalSession,
  UserProfile,
  UserSettings,
} from '../types';
import { MemberPreparationMaterial } from '../types/preparation';
import { EmailDispatchLog } from '../types/workspace';

/**
 * Contrato da camada de persistência isolada.
 * Permite substituir o adaptador local por chamadas a uma API Node.js + PostgreSQL
 * (tabelas: projects, members, project_members, rehearsals, member_preparations, email_dispatch_logs) sem alterar serviços ou UI.
 */
export interface ITeamDeckRepository {
  getProjects(): Promise<ProjectEntity[]>;
  saveProjects(projects: ProjectEntity[]): Promise<void>;

  getMembers(): Promise<MemberEntity[]>;
  saveMembers(members: MemberEntity[]): Promise<void>;

  getProjectMembers(): Promise<ProjectMemberAssociation[]>;
  saveProjectMembers(associations: ProjectMemberAssociation[]): Promise<void>;

  getRehearsals(): Promise<RehearsalSession[]>;
  saveRehearsals(rehearsals: RehearsalSession[]): Promise<void>;

  getPreparations(): Promise<MemberPreparationMaterial[]>;
  savePreparations(preparations: MemberPreparationMaterial[]): Promise<void>;

  getEmailLogs(): Promise<EmailDispatchLog[]>;
  saveEmailLogs(logs: EmailDispatchLog[]): Promise<void>;

  getUserProfile(): Promise<UserProfile>;
  getUserSettings(): Promise<UserSettings>;
  saveUserSettings(settings: UserSettings): Promise<void>;

  resetToSeed(): Promise<void>;
}

const STORAGE_KEYS = {
  schemaVersion: 'teamdeck_pg_schema_v1',
  projects: 'teamdeck_pg_projects',
  members: 'teamdeck_pg_members',
  projectMembers: 'teamdeck_pg_project_members',
  rehearsals: 'teamdeck_pg_rehearsals',
  preparations: 'teamdeck_pg_member_preparations',
  emailLogs: 'teamdeck_pg_email_logs',
  settings: 'teamdeck_pg_settings',
} as const;

const LATENCY_MS = 120;

function simulateIoLatency(): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, LATENCY_MS));
}

function readTable<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch (error) {
    throw new Error(
      `Falha ao ler os dados persistidos (${key}): ${
        error instanceof Error ? error.message : 'erro desconhecido'
      }`
    );
  }
}

function writeTable<T>(key: string, data: T): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    throw new Error(
      `Falha ao gravar os dados persistidos (${key}): ${
        error instanceof Error ? error.message : 'erro desconhecido'
      }`
    );
  }
}

function ensureInitialized(): void {
  if (typeof window === 'undefined') return;
  const initialized = window.localStorage.getItem(STORAGE_KEYS.schemaVersion);
  if (!initialized) {
    writeTable(STORAGE_KEYS.projects, SEED_PROJECTS);
    writeTable(STORAGE_KEYS.members, SEED_MEMBERS);
    writeTable(STORAGE_KEYS.projectMembers, SEED_PROJECT_MEMBERS);
    writeTable(STORAGE_KEYS.rehearsals, SEED_REHEARSALS);
    writeTable(STORAGE_KEYS.preparations, []);
    writeTable(STORAGE_KEYS.emailLogs, []);
    writeTable(STORAGE_KEYS.settings, MOCK_USER_SETTINGS);
    window.localStorage.setItem(STORAGE_KEYS.schemaVersion, '1');
  }
}

export class LocalStorageTeamDeckRepository implements ITeamDeckRepository {
  async getProjects(): Promise<ProjectEntity[]> {
    ensureInitialized();
    await simulateIoLatency();
    return readTable<ProjectEntity[]>(STORAGE_KEYS.projects, SEED_PROJECTS);
  }

  async saveProjects(projects: ProjectEntity[]): Promise<void> {
    ensureInitialized();
    await simulateIoLatency();
    writeTable(STORAGE_KEYS.projects, projects);
  }

  async getMembers(): Promise<MemberEntity[]> {
    ensureInitialized();
    await simulateIoLatency();
    return readTable<MemberEntity[]>(STORAGE_KEYS.members, SEED_MEMBERS);
  }

  async saveMembers(members: MemberEntity[]): Promise<void> {
    ensureInitialized();
    await simulateIoLatency();
    writeTable(STORAGE_KEYS.members, members);
  }

  async getProjectMembers(): Promise<ProjectMemberAssociation[]> {
    ensureInitialized();
    await simulateIoLatency();
    return readTable<ProjectMemberAssociation[]>(
      STORAGE_KEYS.projectMembers,
      SEED_PROJECT_MEMBERS
    );
  }

  async saveProjectMembers(
    associations: ProjectMemberAssociation[]
  ): Promise<void> {
    ensureInitialized();
    await simulateIoLatency();
    writeTable(STORAGE_KEYS.projectMembers, associations);
  }

  async getRehearsals(): Promise<RehearsalSession[]> {
    ensureInitialized();
    await simulateIoLatency();
    return readTable<RehearsalSession[]>(
      STORAGE_KEYS.rehearsals,
      SEED_REHEARSALS
    );
  }

  async saveRehearsals(rehearsals: RehearsalSession[]): Promise<void> {
    ensureInitialized();
    await simulateIoLatency();
    writeTable(STORAGE_KEYS.rehearsals, rehearsals);
  }

  async getPreparations(): Promise<MemberPreparationMaterial[]> {
    ensureInitialized();
    await simulateIoLatency();
    return readTable<MemberPreparationMaterial[]>(STORAGE_KEYS.preparations, []);
  }

  async savePreparations(
    preparations: MemberPreparationMaterial[]
  ): Promise<void> {
    ensureInitialized();
    await simulateIoLatency();
    writeTable(STORAGE_KEYS.preparations, preparations);
  }

  async getEmailLogs(): Promise<EmailDispatchLog[]> {
    ensureInitialized();
    await simulateIoLatency();
    return readTable<EmailDispatchLog[]>(STORAGE_KEYS.emailLogs, []);
  }

  async saveEmailLogs(logs: EmailDispatchLog[]): Promise<void> {
    ensureInitialized();
    await simulateIoLatency();
    writeTable(STORAGE_KEYS.emailLogs, logs);
  }

  async getUserProfile(): Promise<UserProfile> {
    return MOCK_USER_PROFILE;
  }

  async getUserSettings(): Promise<UserSettings> {
    ensureInitialized();
    return readTable<UserSettings>(STORAGE_KEYS.settings, MOCK_USER_SETTINGS);
  }

  async saveUserSettings(settings: UserSettings): Promise<void> {
    ensureInitialized();
    await simulateIoLatency();
    writeTable(STORAGE_KEYS.settings, settings);
  }

  async resetToSeed(): Promise<void> {
    writeTable(STORAGE_KEYS.projects, SEED_PROJECTS);
    writeTable(STORAGE_KEYS.members, SEED_MEMBERS);
    writeTable(STORAGE_KEYS.projectMembers, SEED_PROJECT_MEMBERS);
    writeTable(STORAGE_KEYS.rehearsals, SEED_REHEARSALS);
    writeTable(STORAGE_KEYS.preparations, []);
    writeTable(STORAGE_KEYS.emailLogs, []);
    writeTable(STORAGE_KEYS.settings, MOCK_USER_SETTINGS);
    window.localStorage.setItem(STORAGE_KEYS.schemaVersion, '1');
  }
}

export const teamDeckRepository: ITeamDeckRepository =
  new LocalStorageTeamDeckRepository();
