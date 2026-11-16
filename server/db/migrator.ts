import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import { getPool } from './pool';

export interface MigrationDefinition {
  version: string;
  name: string;
  upFilePath: string;
  downFilePath: string | null;
  upSql: string;
  downSql: string | null;
  checksum: string;
}

export interface AppliedMigrationRecord {
  version: string;
  name: string;
  checksum: string;
  appliedAt: string;
}

export interface MigrationRunResult {
  applied: string[];
  skipped: string[];
}

export interface RollbackRunResult {
  rolledBack: string[];
}

const MIGRATIONS_LOCK_KEY = 42819044;

function resolveMigrationsDirectory(customDir?: string): string {
  if (customDir) return path.resolve(customDir);
  const fromCwd = path.resolve(process.cwd(), 'server/db/migrations');
  if (fs.existsSync(fromCwd)) return fromCwd;
  return path.resolve(import.meta.dirname, 'migrations');
}

export function loadMigrations(migrationsDir?: string): MigrationDefinition[] {
  const dir = resolveMigrationsDirectory(migrationsDir);
  if (!fs.existsSync(dir)) {
    throw new Error(`Diretório de migrations não encontrado: ${dir}`);
  }

  const files = fs.readdirSync(dir);
  const upFiles = files
    .filter((f) => /^\d+_[a-zA-Z0-9_]+\.up\.sql$/.test(f))
    .sort((a, b) => a.localeCompare(b, 'en'));

  const migrations: MigrationDefinition[] = [];
  const seenVersions = new Set<string>();

  for (const upFile of upFiles) {
    const match = upFile.match(/^(\d+)_([a-zA-Z0-9_]+)\.up\.sql$/);
    if (!match) continue;
    const version = match[1];
    const name = match[2];

    if (seenVersions.has(version)) {
      throw new Error(`Versão de migration duplicada detectada: ${version}`);
    }
    seenVersions.add(version);

    const upFilePath = path.join(dir, upFile);
    const downFileName = `${version}_${name}.down.sql`;
    const downFilePathCandidate = path.join(dir, downFileName);
    const hasDown = fs.existsSync(downFilePathCandidate);

    const upSql = fs.readFileSync(upFilePath, 'utf8');
    const downSql = hasDown ? fs.readFileSync(downFilePathCandidate, 'utf8') : null;
    const checksum = crypto.createHash('sha256').update(upSql, 'utf8').digest('hex');

    migrations.push({
      version,
      name,
      upFilePath,
      downFilePath: hasDown ? downFilePathCandidate : null,
      upSql,
      downSql,
      checksum,
    });
  }

  return migrations;
}

async function ensureMigrationsTable(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(64) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      checksum VARCHAR(64) NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

export async function getAppliedMigrations(
  poolOverride?: Pool
): Promise<AppliedMigrationRecord[]> {
  const pool = poolOverride ?? getPool();
  await ensureMigrationsTable(pool);
  const res = await pool.query<{
    version: string;
    name: string;
    checksum: string;
    applied_at: Date | string;
  }>(
    `SELECT version, name, checksum, applied_at
     FROM schema_migrations
     ORDER BY version ASC`
  );

  return res.rows.map((row) => ({
    version: row.version,
    name: row.name,
    checksum: row.checksum,
    appliedAt:
      row.applied_at instanceof Date
        ? row.applied_at.toISOString()
        : String(row.applied_at),
  }));
}

export async function runPendingMigrations(options?: {
  pool?: Pool;
  migrationsDir?: string;
}): Promise<MigrationRunResult> {
  const pool = options?.pool ?? getPool();
  const definitions = loadMigrations(options?.migrationsDir);

  const lockClient = await pool.connect();
  try {
    await lockClient.query('SELECT pg_advisory_lock($1)', [MIGRATIONS_LOCK_KEY]);
    await lockClient.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        checksum VARCHAR(64) NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    const appliedRes = await lockClient.query<{
      version: string;
      checksum: string;
    }>('SELECT version, checksum FROM schema_migrations ORDER BY version ASC');

    const appliedMap = new Map(
      appliedRes.rows.map((row) => [row.version, row.checksum])
    );

    const applied: string[] = [];
    const skipped: string[] = [];

    for (const migration of definitions) {
      const existingChecksum = appliedMap.get(migration.version);
      if (existingChecksum !== undefined) {
        if (existingChecksum !== migration.checksum) {
          throw new Error(
            `Checksum divergente na migration ${migration.version}_${migration.name}. Não edite migrations já aplicadas.`
          );
        }
        skipped.push(`${migration.version}_${migration.name}`);
        continue;
      }

      await lockClient.query('BEGIN');
      try {
        await lockClient.query(migration.upSql);
        await lockClient.query(
          `INSERT INTO schema_migrations (version, name, checksum)
           VALUES ($1, $2, $3)`,
          [migration.version, migration.name, migration.checksum]
        );
        await lockClient.query('COMMIT');
        applied.push(`${migration.version}_${migration.name}`);
      } catch (err) {
        await lockClient.query('ROLLBACK');
        throw err;
      }
    }

    return { applied, skipped };
  } finally {
    await lockClient
      .query('SELECT pg_advisory_unlock($1)', [MIGRATIONS_LOCK_KEY])
      .catch(() => {});
    lockClient.release();
  }
}

export async function rollbackMigrations(options?: {
  pool?: Pool;
  migrationsDir?: string;
  steps?: number;
}): Promise<RollbackRunResult> {
  const pool = options?.pool ?? getPool();
  const steps = options?.steps ?? 1;
  const definitions = loadMigrations(options?.migrationsDir);
  const definitionByVersion = new Map(
    definitions.map((m) => [m.version, m])
  );

  const lockClient = await pool.connect();
  try {
    await lockClient.query('SELECT pg_advisory_lock($1)', [MIGRATIONS_LOCK_KEY]);
    const tableExists = await lockClient.query<{ exists: string | null }>(
      `SELECT to_regclass('public.schema_migrations') AS exists`
    );
    if (!tableExists.rows[0]?.exists) {
      return { rolledBack: [] };
    }

    const appliedRes = await lockClient.query<{
      version: string;
      name: string;
    }>(
      `SELECT version, name
       FROM schema_migrations
       ORDER BY version DESC
       LIMIT $1`,
      [Math.max(1, steps)]
    );

    const rolledBack: string[] = [];

    for (const row of appliedRes.rows) {
      const def = definitionByVersion.get(row.version);
      if (!def || !def.downSql) {
        throw new Error(
          `Migration ${row.version}_${row.name} não possui script de rollback (.down.sql) reversível.`
        );
      }

      await lockClient.query('BEGIN');
      try {
        await lockClient.query(def.downSql);
        await lockClient.query(
          'DELETE FROM schema_migrations WHERE version = $1',
          [row.version]
        );
        await lockClient.query('COMMIT');
        rolledBack.push(`${row.version}_${row.name}`);
      } catch (err) {
        await lockClient.query('ROLLBACK');
        throw err;
      }
    }

    return { rolledBack };
  } finally {
    await lockClient
      .query('SELECT pg_advisory_unlock($1)', [MIGRATIONS_LOCK_KEY])
      .catch(() => {});
    lockClient.release();
  }
}
