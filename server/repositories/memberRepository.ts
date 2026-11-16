import { MemberEntity, ProjectMemberAssociation } from '../../src/types';
import { DbClient, dbQuery } from '../db/pool';

export interface DbMemberRecord extends MemberEntity {
  userId: string | null;
}

interface MemberRow {
  id: string;
  user_id: string | null;
  name: string;
  email: string;
  default_role: string;
  created_at: Date | string;
  updated_at: Date | string;
}

interface ProjectMemberRow {
  id: string;
  project_id: string;
  member_id: string;
  role: string;
  responsibility: string;
  presentation_minutes: number;
  progress: number;
  tasks_completed: number;
  tasks_total: number;
  assigned_at: Date | string;
}

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

function mapMemberRow(row: MemberRow): DbMemberRecord {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    email: row.email,
    defaultRole: row.default_role,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

function mapAssociationRow(row: ProjectMemberRow): ProjectMemberAssociation {
  return {
    id: row.id,
    projectId: row.project_id,
    memberId: row.member_id,
    role: row.role,
    responsibility: row.responsibility,
    presentationMinutes: row.presentation_minutes,
    progress: row.progress,
    tasksCompleted: row.tasks_completed,
    tasksTotal: row.tasks_total,
    assignedAt: toIsoString(row.assigned_at),
  };
}

export const memberRepository = {
  async findById(id: string, client?: DbClient): Promise<DbMemberRecord | null> {
    const res = await dbQuery<MemberRow>(
      `SELECT id, user_id, name, email, default_role, created_at, updated_at
       FROM members
       WHERE id = $1`,
      [id],
      client
    );
    return res.rows[0] ? mapMemberRow(res.rows[0]) : null;
  },

  async findByEmail(email: string, client?: DbClient): Promise<DbMemberRecord | null> {
    const res = await dbQuery<MemberRow>(
      `SELECT id, user_id, name, email, default_role, created_at, updated_at
       FROM members
       WHERE LOWER(email) = LOWER($1)
       LIMIT 1`,
      [email.trim()],
      client
    );
    return res.rows[0] ? mapMemberRow(res.rows[0]) : null;
  },

  async findAll(client?: DbClient): Promise<DbMemberRecord[]> {
    const res = await dbQuery<MemberRow>(
      `SELECT id, user_id, name, email, default_role, created_at, updated_at
       FROM members
       ORDER BY created_at DESC`,
      [],
      client
    );
    return res.rows.map(mapMemberRow);
  },

  async findVisibleToUser(
    userId: string,
    userEmail: string,
    client?: DbClient
  ): Promise<DbMemberRecord[]> {
    const res = await dbQuery<MemberRow>(
      `SELECT DISTINCT m.id, m.user_id, m.name, m.email, m.default_role, m.created_at, m.updated_at
       FROM members m
       LEFT JOIN project_members pm ON pm.member_id = m.id
       LEFT JOIN projects p ON p.id = pm.project_id
       WHERE m.user_id = $1
          OR LOWER(m.email) = LOWER($2)
          OR p.creator_user_id = $1
          OR pm.project_id IN (
            SELECT pm2.project_id
            FROM project_members pm2
            INNER JOIN members m2 ON m2.id = pm2.member_id
            WHERE m2.user_id = $1 OR LOWER(m2.email) = LOWER($2)
          )
       ORDER BY m.created_at DESC`,
      [userId, userEmail.trim()],
      client
    );
    return res.rows.map(mapMemberRow);
  },

  async create(
    input: {
      id: string;
      userId?: string | null;
      name: string;
      email: string;
      defaultRole: string;
    },
    client?: DbClient
  ): Promise<DbMemberRecord> {
    const res = await dbQuery<MemberRow>(
      `INSERT INTO members (id, user_id, name, email, default_role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, user_id, name, email, default_role, created_at, updated_at`,
      [
        input.id,
        input.userId ?? null,
        input.name.trim(),
        input.email.trim().toLowerCase(),
        input.defaultRole.trim(),
      ],
      client
    );
    return mapMemberRow(res.rows[0]);
  },

  async update(
    input: {
      id: string;
      name: string;
      email: string;
      defaultRole: string;
    },
    client?: DbClient
  ): Promise<DbMemberRecord | null> {
    const res = await dbQuery<MemberRow>(
      `UPDATE members
       SET name = $2,
           email = $3,
           default_role = $4,
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, user_id, name, email, default_role, created_at, updated_at`,
      [
        input.id,
        input.name.trim(),
        input.email.trim().toLowerCase(),
        input.defaultRole.trim(),
      ],
      client
    );
    return res.rows[0] ? mapMemberRow(res.rows[0]) : null;
  },

  async linkUserByEmail(
    userId: string,
    email: string,
    client?: DbClient
  ): Promise<void> {
    await dbQuery(
      `UPDATE members
       SET user_id = $1,
           updated_at = NOW()
       WHERE LOWER(email) = LOWER($2)
         AND (user_id IS NULL OR user_id <> $1)`,
      [userId, email.trim()],
      client
    );
  },

  async deleteById(memberId: string, client?: DbClient): Promise<boolean> {
    const res = await dbQuery(
      `DELETE FROM members WHERE id = $1`,
      [memberId],
      client
    );
    return (res.rowCount ?? 0) > 0;
  },

  async findAssociationsByProjectIds(
    projectIds: string[],
    client?: DbClient
  ): Promise<ProjectMemberAssociation[]> {
    if (projectIds.length === 0) return [];
    const res = await dbQuery<ProjectMemberRow>(
      `SELECT id, project_id, member_id, role, responsibility, presentation_minutes, progress, tasks_completed, tasks_total, assigned_at
       FROM project_members
       WHERE project_id = ANY($1::text[])
       ORDER BY assigned_at ASC`,
      [projectIds],
      client
    );
    return res.rows.map(mapAssociationRow);
  },

  async findAssociationById(
    associationId: string,
    client?: DbClient
  ): Promise<ProjectMemberAssociation | null> {
    const res = await dbQuery<ProjectMemberRow>(
      `SELECT id, project_id, member_id, role, responsibility, presentation_minutes, progress, tasks_completed, tasks_total, assigned_at
       FROM project_members
       WHERE id = $1`,
      [associationId],
      client
    );
    return res.rows[0] ? mapAssociationRow(res.rows[0]) : null;
  },

  async findAssociationByProjectAndMember(
    projectId: string,
    memberId: string,
    client?: DbClient
  ): Promise<ProjectMemberAssociation | null> {
    const res = await dbQuery<ProjectMemberRow>(
      `SELECT id, project_id, member_id, role, responsibility, presentation_minutes, progress, tasks_completed, tasks_total, assigned_at
       FROM project_members
       WHERE project_id = $1 AND member_id = $2`,
      [projectId, memberId],
      client
    );
    return res.rows[0] ? mapAssociationRow(res.rows[0]) : null;
  },

  async createAssociation(
    input: {
      id: string;
      projectId: string;
      memberId: string;
      role: string;
      responsibility: string;
      presentationMinutes: number;
      progress: number;
      tasksCompleted: number;
      tasksTotal: number;
    },
    client?: DbClient
  ): Promise<ProjectMemberAssociation> {
    const res = await dbQuery<ProjectMemberRow>(
      `INSERT INTO project_members (
         id, project_id, member_id, role, responsibility, presentation_minutes, progress, tasks_completed, tasks_total
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, project_id, member_id, role, responsibility, presentation_minutes, progress, tasks_completed, tasks_total, assigned_at`,
      [
        input.id,
        input.projectId,
        input.memberId,
        input.role.trim(),
        input.responsibility.trim(),
        input.presentationMinutes,
        input.progress,
        input.tasksCompleted,
        input.tasksTotal,
      ],
      client
    );
    return mapAssociationRow(res.rows[0]);
  },

  async updateAssociation(
    input: {
      id: string;
      role: string;
      responsibility: string;
      presentationMinutes: number;
      progress: number;
      tasksCompleted: number;
    },
    client?: DbClient
  ): Promise<ProjectMemberAssociation | null> {
    const res = await dbQuery<ProjectMemberRow>(
      `UPDATE project_members
       SET role = $2,
           responsibility = $3,
           presentation_minutes = $4,
           progress = $5,
           tasks_completed = $6
       WHERE id = $1
       RETURNING id, project_id, member_id, role, responsibility, presentation_minutes, progress, tasks_completed, tasks_total, assigned_at`,
      [
        input.id,
        input.role.trim(),
        input.responsibility.trim(),
        input.presentationMinutes,
        input.progress,
        input.tasksCompleted,
      ],
      client
    );
    return res.rows[0] ? mapAssociationRow(res.rows[0]) : null;
  },

  async deleteAssociationById(
    associationId: string,
    client?: DbClient
  ): Promise<boolean> {
    const res = await dbQuery(
      `DELETE FROM project_members WHERE id = $1`,
      [associationId],
      client
    );
    return (res.rowCount ?? 0) > 0;
  },

  async deleteAssociationsByProjectId(
    projectId: string,
    client?: DbClient
  ): Promise<number> {
    const res = await dbQuery(
      `DELETE FROM project_members WHERE project_id = $1`,
      [projectId],
      client
    );
    return res.rowCount ?? 0;
  },

  async deleteAssociationsByMemberId(
    memberId: string,
    client?: DbClient
  ): Promise<number> {
    const res = await dbQuery(
      `DELETE FROM project_members WHERE member_id = $1`,
      [memberId],
      client
    );
    return res.rowCount ?? 0;
  },

  async isUserMemberOfProject(
    userId: string,
    userEmail: string,
    projectId: string,
    client?: DbClient
  ): Promise<boolean> {
    const res = await dbQuery<{ found: number }>(
      `SELECT 1 AS found
       FROM project_members pm
       INNER JOIN members m ON m.id = pm.member_id
       WHERE pm.project_id = $1
         AND (m.user_id = $2 OR LOWER(m.email) = LOWER($3))
       LIMIT 1`,
      [projectId, userId, userEmail.trim()],
      client
    );
    return (res.rowCount ?? 0) > 0;
  },
};
