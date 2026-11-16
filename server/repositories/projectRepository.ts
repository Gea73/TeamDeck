import { ProjectStatus } from '../../src/types';
import { DbClient, dbQuery } from '../db/pool';

export interface DbProjectRecord {
  id: string;
  creatorUserId: string;
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
  createdAt: string;
  updatedAt: string;
}

interface ProjectRow {
  id: string;
  creator_user_id: string;
  title: string;
  description: string;
  discipline: string;
  institution: string;
  advisor: string;
  presentation_date: Date | string;
  presentation_time: string;
  location: string;
  target_duration_minutes: number;
  status: ProjectStatus;
  base_progress: number;
  created_at: Date | string;
  updated_at: Date | string;
}

function toIsoDate(value: Date | string): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return String(value).slice(0, 10);
}

function toIsoTimestamp(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

function mapProjectRow(row: ProjectRow): DbProjectRecord {
  return {
    id: row.id,
    creatorUserId: row.creator_user_id,
    title: row.title,
    description: row.description,
    discipline: row.discipline,
    institution: row.institution,
    advisor: row.advisor,
    presentationDate: toIsoDate(row.presentation_date),
    presentationTime: row.presentation_time,
    location: row.location,
    targetDurationMinutes: row.target_duration_minutes,
    status: row.status,
    baseProgress: row.base_progress,
    createdAt: toIsoTimestamp(row.created_at),
    updatedAt: toIsoTimestamp(row.updated_at),
  };
}

export const projectRepository = {
  async findById(
    projectId: string,
    client?: DbClient
  ): Promise<DbProjectRecord | null> {
    const res = await dbQuery<ProjectRow>(
      `SELECT id, creator_user_id, title, description, discipline, institution, advisor,
              presentation_date, presentation_time, location, target_duration_minutes,
              status, base_progress, created_at, updated_at
       FROM projects
       WHERE id = $1`,
      [projectId],
      client
    );
    return res.rows[0] ? mapProjectRow(res.rows[0]) : null;
  },

  async findAccessibleByUser(
    userId: string,
    userEmail: string,
    client?: DbClient
  ): Promise<DbProjectRecord[]> {
    const res = await dbQuery<ProjectRow>(
      `SELECT DISTINCT p.id, p.creator_user_id, p.title, p.description, p.discipline,
              p.institution, p.advisor, p.presentation_date, p.presentation_time,
              p.location, p.target_duration_minutes, p.status, p.base_progress,
              p.created_at, p.updated_at
       FROM projects p
       LEFT JOIN project_members pm ON pm.project_id = p.id
       LEFT JOIN members m ON m.id = pm.member_id
       WHERE p.creator_user_id = $1
          OR m.user_id = $1
          OR LOWER(m.email) = LOWER($2)
       ORDER BY p.created_at DESC`,
      [userId, userEmail.trim()],
      client
    );
    return res.rows.map(mapProjectRow);
  },

  async create(
    input: {
      id: string;
      creatorUserId: string;
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
    },
    client?: DbClient
  ): Promise<DbProjectRecord> {
    const res = await dbQuery<ProjectRow>(
      `INSERT INTO projects (
         id, creator_user_id, title, description, discipline, institution, advisor,
         presentation_date, presentation_time, location, target_duration_minutes,
         status, base_progress
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::date, $9, $10, $11, $12, $13)
       RETURNING id, creator_user_id, title, description, discipline, institution, advisor,
                 presentation_date, presentation_time, location, target_duration_minutes,
                 status, base_progress, created_at, updated_at`,
      [
        input.id,
        input.creatorUserId,
        input.title.trim(),
        input.description.trim(),
        input.discipline.trim(),
        input.institution.trim(),
        input.advisor.trim() || 'A definir',
        input.presentationDate,
        input.presentationTime,
        input.location.trim(),
        input.targetDurationMinutes,
        input.status,
        input.baseProgress,
      ],
      client
    );
    return mapProjectRow(res.rows[0]);
  },

  async update(
    input: {
      id: string;
      title: string;
      description: string;
      discipline: string;
      advisor: string;
      presentationDate: string;
      presentationTime: string;
      location: string;
      targetDurationMinutes: number;
      status: ProjectStatus;
    },
    client?: DbClient
  ): Promise<DbProjectRecord | null> {
    const res = await dbQuery<ProjectRow>(
      `UPDATE projects
       SET title = $2,
           description = $3,
           discipline = $4,
           advisor = $5,
           presentation_date = $6::date,
           presentation_time = $7,
           location = $8,
           target_duration_minutes = $9,
           status = $10,
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, creator_user_id, title, description, discipline, institution, advisor,
                 presentation_date, presentation_time, location, target_duration_minutes,
                 status, base_progress, created_at, updated_at`,
      [
        input.id,
        input.title.trim(),
        input.description.trim(),
        input.discipline.trim(),
        input.advisor.trim() || 'A definir',
        input.presentationDate,
        input.presentationTime,
        input.location.trim(),
        input.targetDurationMinutes,
        input.status,
      ],
      client
    );
    return res.rows[0] ? mapProjectRow(res.rows[0]) : null;
  },

  async updatePresentationDate(
    input: {
      id: string;
      presentationDate: string;
      presentationTime: string;
      location: string;
    },
    client?: DbClient
  ): Promise<DbProjectRecord | null> {
    const res = await dbQuery<ProjectRow>(
      `UPDATE projects
       SET presentation_date = $2::date,
           presentation_time = $3,
           location = $4,
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, creator_user_id, title, description, discipline, institution, advisor,
                 presentation_date, presentation_time, location, target_duration_minutes,
                 status, base_progress, created_at, updated_at`,
      [
        input.id,
        input.presentationDate,
        input.presentationTime,
        input.location.trim(),
      ],
      client
    );
    return res.rows[0] ? mapProjectRow(res.rows[0]) : null;
  },

  async touchUpdatedAt(projectId: string, client?: DbClient): Promise<void> {
    await dbQuery(
      `UPDATE projects SET updated_at = NOW() WHERE id = $1`,
      [projectId],
      client
    );
  },

  async deleteById(projectId: string, client?: DbClient): Promise<boolean> {
    const res = await dbQuery(
      `DELETE FROM projects WHERE id = $1`,
      [projectId],
      client
    );
    return (res.rowCount ?? 0) > 0;
  },
};
