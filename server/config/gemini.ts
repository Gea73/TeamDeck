export function getGeminiModel(): string {
  return process.env.GEMINI_MODEL?.trim() || 'gemini-4-hydrogen';
}

export function extractHttpErrorStatus(error: unknown): number | null {
  if (!error || typeof error !== 'object') return null;

  const errObj = error as {
    status?: unknown;
    statusCode?: unknown;
    code?: unknown;
    response?: { status?: unknown };
  };

  const candidates = [
    errObj.status,
    errObj.statusCode,
    errObj.response?.status,
    typeof errObj.code === 'number' ? errObj.code : null,
  ];

  for (const val of candidates) {
    if (typeof val === 'number' && Number.isInteger(val) && val >= 100 && val <= 599) {
      return val;
    }
  }

  return null;
}

const RETRYABLE_HTTP_STATUSES = new Set([408, 429, 500, 502, 503, 504]);
const RETRYABLE_NETWORK_CODES = new Set([
  'ECONNRESET',
  'ETIMEDOUT',
  'ECONNREFUSED',
  'EPIPE',
  'UND_ERR_CONNECT_TIMEOUT',
]);

export function isRetryableHttpError(error: unknown): boolean {
  const status = extractHttpErrorStatus(error);
  if (status !== null) {
    return RETRYABLE_HTTP_STATUSES.has(status);
  }

  if (error && typeof error === 'object') {
    const code = (error as { code?: unknown }).code;
    if (typeof code === 'string' && RETRYABLE_NETWORK_CODES.has(code)) {
      return true;
    }
    const causeCode = (error as { cause?: { code?: unknown } }).cause?.code;
    if (typeof causeCode === 'string' && RETRYABLE_NETWORK_CODES.has(causeCode)) {
      return true;
    }
  }

  return false;
}
