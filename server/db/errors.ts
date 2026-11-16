import { redactConnectionSecrets } from './config';

export class AppDatabaseError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly pgCode?: string;

  constructor(
    message: string,
    statusCode: number,
    code: string,
    pgCode?: string
  ) {
    super(message);
    this.name = 'AppDatabaseError';
    this.statusCode = statusCode;
    this.code = code;
    this.pgCode = pgCode;
  }
}

interface PgErrorShape {
  code?: string;
  constraint?: string;
  message?: string;
}

const CONNECTION_ERROR_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ENOTFOUND',
  'ETIMEDOUT',
  '57P01',
  '57P02',
  '57P03',
  '08000',
  '08001',
  '08003',
  '08004',
  '08006',
]);

export function mapPostgresError(
  err: unknown,
  fallbackMessage = 'Erro ao persistir ou consultar dados no banco de dados.'
): AppDatabaseError {
  if (err instanceof AppDatabaseError) {
    return err;
  }

  const pgErr = (err ?? {}) as PgErrorShape;
  const pgCode = typeof pgErr.code === 'string' ? pgErr.code : undefined;

  if (pgCode && CONNECTION_ERROR_CODES.has(pgCode)) {
    return new AppDatabaseError(
      'Serviço de banco de dados temporariamente indisponível.',
      503,
      'DATABASE_UNAVAILABLE',
      pgCode
    );
  }

  switch (pgCode) {
    case '23505':
      return new AppDatabaseError(
        'Já existe um registro com os mesmos dados únicos informados.',
        409,
        'UNIQUE_CONSTRAINT_VIOLATION',
        pgCode
      );
    case '23503':
      return new AppDatabaseError(
        'Operação bloqueada por referência a registro relacionado inexistente ou ainda vinculado.',
        409,
        'FOREIGN_KEY_VIOLATION',
        pgCode
      );
    case '23514':
      return new AppDatabaseError(
        'Os dados informados violam uma regra de integridade do banco.',
        400,
        'CHECK_CONSTRAINT_VIOLATION',
        pgCode
      );
    case '23502':
      return new AppDatabaseError(
        'Um campo obrigatório não foi informado.',
        400,
        'NOT_NULL_VIOLATION',
        pgCode
      );
    case '22P02':
    case '22007':
    case '22008':
      return new AppDatabaseError(
        'Formato inválido em identificador, data ou valor numérico.',
        400,
        'INVALID_DATA_FORMAT',
        pgCode
      );
    case '40P01':
    case '40001':
      return new AppDatabaseError(
        'Conflito de concorrência ao atualizar o registro. Tente novamente.',
        409,
        'TRANSACTION_CONFLICT',
        pgCode
      );
    default: {
      const rawMsg =
        err instanceof Error ? redactConnectionSecrets(err.message) : '';
      if (
        rawMsg.includes('connect ECONNREFUSED') ||
        rawMsg.includes('Connection terminated') ||
        rawMsg.includes('timeout expired')
      ) {
        return new AppDatabaseError(
          'Serviço de banco de dados temporariamente indisponível.',
          503,
          'DATABASE_UNAVAILABLE',
          pgCode
        );
      }
      return new AppDatabaseError(
        fallbackMessage,
        500,
        'DATABASE_OPERATION_FAILED',
        pgCode
      );
    }
  }
}

export function logSafeDatabaseError(context: string, err: unknown): void {
  const pgErr = (err ?? {}) as PgErrorShape;
  const code = typeof pgErr.code === 'string' ? pgErr.code : 'UNKNOWN';
  const msg =
    err instanceof Error
      ? redactConnectionSecrets(err.message)
      : 'Erro desconhecido';
  console.error(`[TeamDeck DB] ${context} (code=${code}): ${msg}`);
}
