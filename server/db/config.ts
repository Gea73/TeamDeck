import '../config/env';

export interface DatabaseConfig {
  connectionString: string;
  ssl: boolean | { rejectUnauthorized: boolean };
  maxConnections: number;
  idleTimeoutMillis: number;
  connectionTimeoutMillis: number;
  statementTimeoutMillis: number;
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function resolveSslOption(connectionString: string): boolean | { rejectUnauthorized: boolean } {
  const flag = process.env.DATABASE_SSL?.trim().toLowerCase();
  if (flag === 'true' || flag === 'require') {
    return {
      rejectUnauthorized:
        process.env.DATABASE_SSL_REJECT_UNAUTHORIZED?.trim().toLowerCase() !== 'false',
    };
  }
  if (flag === 'false' || flag === 'disable') {
    return false;
  }
  try {
    const parsed = new URL(connectionString);
    const sslmode = parsed.searchParams.get('sslmode')?.toLowerCase();
    if (sslmode === 'require' || sslmode === 'verify-full' || sslmode === 'verify-ca') {
      return { rejectUnauthorized: sslmode !== 'require' };
    }
  } catch {
    // Ignore URL parsing errors here; validation happens below
  }
  return false;
}

export function resolveDatabaseUrl(options?: { testMode?: boolean }): string {
  const isTest = options?.testMode ?? process.env.NODE_ENV === 'test';

  if (isTest) {
    const testUrl = process.env.TEST_DATABASE_URL?.trim();
    if (!testUrl) {
      throw new Error(
        'TEST_DATABASE_URL não configurada. Os testes devem usar um banco PostgreSQL separado.'
      );
    }
    const prodOrDevUrl = process.env.DATABASE_URL?.trim();
    if (prodOrDevUrl && testUrl === prodOrDevUrl) {
      throw new Error(
        'TEST_DATABASE_URL não pode ser igual a DATABASE_URL. Configure um banco de testes separado.'
      );
    }
    return testUrl;
  }

  const dbUrl = process.env.DATABASE_URL?.trim();
  if (!dbUrl) {
    throw new Error(
      'DATABASE_URL não configurada. Defina a string de conexão do PostgreSQL nas variáveis de ambiente.'
    );
  }

  return dbUrl;
}

export function isDatabaseConfigured(options?: { testMode?: boolean }): boolean {
  const isTest = options?.testMode ?? process.env.NODE_ENV === 'test';
  return isTest
    ? Boolean(process.env.TEST_DATABASE_URL?.trim())
    : Boolean(process.env.DATABASE_URL?.trim());
}

export function getDatabaseConfig(options?: {
  connectionString?: string;
  testMode?: boolean;
}): DatabaseConfig {
  const connectionString =
    options?.connectionString?.trim() ||
    resolveDatabaseUrl({ testMode: options?.testMode });

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(connectionString);
  } catch {
    throw new Error(
      'String de conexão PostgreSQL inválida. Verifique o formato de DATABASE_URL.'
    );
  }

  if (
    parsedUrl.protocol !== 'postgres:' &&
    parsedUrl.protocol !== 'postgresql:'
  ) {
    throw new Error(
      'Protocolo inválido para PostgreSQL. A URL deve iniciar com postgresql:// ou postgres://.'
    );
  }

  return {
    connectionString,
    ssl: resolveSslOption(connectionString),
    maxConnections: parsePositiveInt(process.env.PG_POOL_MAX, 10),
    idleTimeoutMillis: parsePositiveInt(process.env.PG_IDLE_TIMEOUT_MS, 30000),
    connectionTimeoutMillis: parsePositiveInt(
      process.env.PG_CONNECTION_TIMEOUT_MS,
      5000
    ),
    statementTimeoutMillis: parsePositiveInt(
      process.env.PG_STATEMENT_TIMEOUT_MS,
      15000
    ),
  };
}

/**
 * Mascara credenciais caso alguma string contenha URI PostgreSQL antes de logar.
 */
export function redactConnectionSecrets(message: string): string {
  return message.replace(
    /(postgres(?:ql)?:\/\/)([^:@\s]+):([^@\s]+)@/gi,
    '$1***:***@'
  );
}
