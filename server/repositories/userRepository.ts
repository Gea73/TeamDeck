import { UserProfile, UserSettings } from '../../src/types';
import { DbClient, dbQuery } from '../db/pool';

export interface DbUserRecord extends UserProfile {
  createdAt: string;
  updatedAt: string;
}

interface UserRow {
  id: string;
  name: string;
  email: string;
  course: string;
  institution: string;
  semester: string;
  registration_id: string;
  role: string;
  created_at: Date | string;
  updated_at: Date | string;
}

interface UserSettingsRow {
  user_id: string;
  rehearsal_reminders: boolean;
  email_digest: boolean;
  show_timer_warnings: boolean;
  default_slide_duration: number;
  timezone: string;
  academic_period: string;
}

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

function mapUserRow(row: UserRow): DbUserRecord {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    course: row.course,
    institution: row.institution,
    semester: row.semester,
    registrationId: row.registration_id,
    role: row.role,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

function mapSettingsRow(row: UserSettingsRow): UserSettings {
  return {
    rehearsalReminders: row.rehearsal_reminders,
    emailDigest: row.email_digest,
    showTimerWarnings: row.show_timer_warnings,
    defaultSlideDuration: row.default_slide_duration,
    timezone: row.timezone,
    academicPeriod: row.academic_period,
  };
}

export const DEFAULT_USER_SETTINGS: UserSettings = {
  rehearsalReminders: true,
  emailDigest: false,
  showTimerWarnings: true,
  defaultSlideDuration: 2,
  timezone: 'America/Sao_Paulo (GMT-3)',
  academicPeriod: '2026.2',
};

export const userRepository = {
  async findById(id: string, client?: DbClient): Promise<DbUserRecord | null> {
    const res = await dbQuery<UserRow>(
      `SELECT id, name, email, course, institution, semester, registration_id, role, created_at, updated_at
       FROM users
       WHERE id = $1`,
      [id],
      client
    );
    return res.rows[0] ? mapUserRow(res.rows[0]) : null;
  },

  async findByEmail(email: string, client?: DbClient): Promise<DbUserRecord | null> {
    const res = await dbQuery<UserRow>(
      `SELECT id, name, email, course, institution, semester, registration_id, role, created_at, updated_at
       FROM users
       WHERE LOWER(email) = LOWER($1)
       LIMIT 1`,
      [email.trim()],
      client
    );
    return res.rows[0] ? mapUserRow(res.rows[0]) : null;
  },

  async create(
    input: {
      id: string;
      name: string;
      email: string;
      course?: string;
      institution?: string;
      semester?: string;
      registrationId?: string;
      role?: string;
    },
    client?: DbClient
  ): Promise<DbUserRecord> {
    const res = await dbQuery<UserRow>(
      `INSERT INTO users (id, name, email, course, institution, semester, registration_id, role)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, name, email, course, institution, semester, registration_id, role, created_at, updated_at`,
      [
        input.id,
        input.name.trim(),
        input.email.trim().toLowerCase(),
        input.course?.trim() ?? '',
        input.institution?.trim() ?? '',
        input.semester?.trim() ?? '',
        input.registrationId?.trim() ?? '',
        input.role?.trim() || 'Estudante',
      ],
      client
    );
    return mapUserRow(res.rows[0]);
  },

  async upsertByEmail(
    input: {
      id: string;
      name: string;
      email: string;
      course?: string;
      institution?: string;
      semester?: string;
      registrationId?: string;
      role?: string;
    },
    client?: DbClient
  ): Promise<DbUserRecord> {
    const normalizedEmail = input.email.trim().toLowerCase();
    const existing = await this.findByEmail(normalizedEmail, client);
    if (existing) {
      const res = await dbQuery<UserRow>(
        `UPDATE users
         SET name = $2,
             updated_at = NOW()
         WHERE id = $1
         RETURNING id, name, email, course, institution, semester, registration_id, role, created_at, updated_at`,
        [existing.id, input.name.trim() || existing.name],
        client
      );
      return mapUserRow(res.rows[0]);
    }

    return this.create(
      {
        ...input,
        email: normalizedEmail,
      },
      client
    );
  },

  async getSettingsByUserId(
    userId: string,
    client?: DbClient
  ): Promise<UserSettings> {
    const res = await dbQuery<UserSettingsRow>(
      `SELECT user_id, rehearsal_reminders, email_digest, show_timer_warnings, default_slide_duration, timezone, academic_period
       FROM user_settings
       WHERE user_id = $1`,
      [userId],
      client
    );
    return res.rows[0] ? mapSettingsRow(res.rows[0]) : { ...DEFAULT_USER_SETTINGS };
  },

  async upsertSettings(
    userId: string,
    settings: UserSettings,
    client?: DbClient
  ): Promise<UserSettings> {
    const res = await dbQuery<UserSettingsRow>(
      `INSERT INTO user_settings (
         user_id,
         rehearsal_reminders,
         email_digest,
         show_timer_warnings,
         default_slide_duration,
         timezone,
         academic_period,
         updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         rehearsal_reminders = EXCLUDED.rehearsal_reminders,
         email_digest = EXCLUDED.email_digest,
         show_timer_warnings = EXCLUDED.show_timer_warnings,
         default_slide_duration = EXCLUDED.default_slide_duration,
         timezone = EXCLUDED.timezone,
         academic_period = EXCLUDED.academic_period,
         updated_at = NOW()
       RETURNING user_id, rehearsal_reminders, email_digest, show_timer_warnings, default_slide_duration, timezone, academic_period`,
      [
        userId,
        settings.rehearsalReminders,
        settings.emailDigest,
        settings.showTimerWarnings,
        settings.defaultSlideDuration,
        settings.timezone.trim(),
        settings.academicPeriod.trim(),
      ],
      client
    );
    return mapSettingsRow(res.rows[0]);
  },
};
