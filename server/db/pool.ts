import pg, { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { getDatabaseConfig, redactConnectionSecrets } from './config';
import { logSafeDatabaseError, mapPostgresError } from './errors';

const { Pool: PgPool } = pg;

export type DbClient = Pool | PoolClient;

let activePool: Pool | null = null;
let activeConnectionString: string | null = null;

export function createPoolForUrl(connectionString: string): Pool {
  const config = getDatabaseConfig({ connectionString });
  const pool = new PgPool({
    connectionString: config.connectionString,
    ssl: config.ssl,
    max: config.maxConnections,
    idleTimeoutMillis: config.idleTimeoutMillis,
    connectionTimeoutMillis: config.connectionTimeoutMillis,
    statement_timeout: config.statementTimeoutMillis,
  });

  pool.on('error', (err) => {
    logSafeDatabaseError('Erro inesperado em cliente ocioso do pool', err);
  });

  return pool;
}

export function getPool(options?: {
  connectionString?: string;
  testMode?: boolean;
}): Pool {
  const config = getDatabaseConfig(options);

  if (activePool && activeConnectionString === config.connectionString) {
    return activePool;
  }

  if (activePool) {
    const previous = activePool;
    activePool = null;
    activeConnectionString = null;
    void previous.end().catch((err) => {
      logSafeDatabaseError('Falha ao encerrar pool anterior', err);
    });
  }

  activePool = createPoolForUrl(config.connectionString);
  activeConnectionString = config.connectionString;
  return activePool;
}

export async function closePool(): Promise<void> {
  if (!activePool) return;
  const poolToClose = activePool;
  activePool = null;
  activeConnectionString = null;
  try {
    await poolToClose.end();
  } catch (err) {
    logSafeDatabaseError('Erro ao fechar pool de conexões PostgreSQL', err);
  }
}

export async function dbQuery<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
  client?: DbClient
): Promise<QueryResult<T>> {
  const executor = client ?? getPool();
  try {
    return await executor.query<T>(text, params);
  } catch (err) {
    logSafeDatabaseError('Falha em consulta SQL', err);
    throw mapPostgresError(err);
  }
}

export async function withTransaction<T>(
  work: (client: PoolClient) => Promise<T>,
  poolOverride?: Pool
): Promise<T> {
  const pool = poolOverride ?? getPool();
  let client: PoolClient;
  try {
    client = await pool.connect();
  } catch (err) {
    logSafeDatabaseError('Falha ao adquirir conexão do pool para transação', err);
    throw mapPostgresError(err, 'Não foi possível iniciar transação no banco.');
  }

  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      logSafeDatabaseError('Falha ao executar ROLLBACK da transação', rollbackErr);
    }
    if (err instanceof Error && err.name === 'AppDatabaseError') {
      throw err;
    }
    if (err instanceof Error && err.name === 'AppDomainError') {
      throw err;
    }
    throw mapPostgresError(err);
  } finally {
    client.release();
  }
}

export interface DatabaseHealthResult {
  ok: boolean;
  latencyMs: number;
  error?: string;
}

export async function verifyDatabaseConnection(
  poolOverride?: Pool
): Promise<DatabaseHealthResult> {
  const start = Date.now();
  try {
    const pool = poolOverride ?? getPool();
    await pool.query('SELECT 1 AS ok');
    return {
      ok: true,
      latencyMs: Date.now() - start,
    };
  } catch (err) {
    const safeMsg =
      err instanceof Error
        ? redactConnectionSecrets(err.message)
        : 'Falha de conexão com PostgreSQL.';
    logSafeDatabaseError('Verificação de conectividade falhou', err);
    return {
      ok: false,
      latencyMs: Date.now() - start,
      error: safeMsg.includes('ECONNREFUSED')
        ? 'Banco PostgreSQL indisponível.'
        : 'Falha na verificação de conectividade com o banco.',
    };
  }
}
