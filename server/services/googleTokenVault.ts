import crypto from 'crypto';
import { Request, Response } from 'express';
import { GoogleSessionStatus } from '../../src/types/workspace';

export const GOOGLE_SESSION_COOKIE_NAME = 'td_google_session';
const DEFAULT_TOKEN_TTL_SECONDS = 3500;
const SESSION_SWEEP_INTERVAL_MS = 5 * 60 * 1000;
const GOOGLE_TOKENINFO_ENDPOINT = 'https://oauth2.googleapis.com/tokeninfo';
const GOOGLE_USERINFO_ENDPOINT = 'https://www.googleapis.com/oauth2/v3/userinfo';

function deriveVaultKey(): Buffer {
  const configuredSecret = process.env.GOOGLE_TOKEN_VAULT_SECRET?.trim();
  if (configuredSecret && configuredSecret.length >= 16) {
    return crypto.createHash('sha256').update(configuredSecret, 'utf8').digest();
  }
  if (process.env.NODE_ENV === 'production') {
    console.warn(
      '[TeamDeck] GOOGLE_TOKEN_VAULT_SECRET não configurado; usando chave efêmera em memória (não compartilhável entre réplicas).'
    );
  }
  return crypto.randomBytes(32);
}

const VAULT_KEY = deriveVaultKey();

interface EncryptedTokenRecord {
  sessionId: string;
  ciphertext: Buffer;
  iv: Buffer;
  authTag: Buffer;
  email: string | null;
  displayName: string | null;
  scopes: string[];
  expiresAtMs: number;
  updatedAt: string;
}

const sessionStore = new Map<string, EncryptedTokenRecord>();

// Limpeza periódica de sessões expiradas para evitar crescimento ilimitado da memória
const sweepTimer = setInterval(() => {
  const now = Date.now();
  for (const [id, record] of sessionStore.entries()) {
    if (record.expiresAtMs <= now) {
      sessionStore.delete(id);
    }
  }
}, SESSION_SWEEP_INTERVAL_MS);
if (typeof sweepTimer.unref === 'function') {
  sweepTimer.unref();
}

function encryptToken(plainToken: string): {
  ciphertext: Buffer;
  iv: Buffer;
  authTag: Buffer;
} {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', VAULT_KEY, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plainToken, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return { ciphertext, iv, authTag };
}

function decryptToken(record: EncryptedTokenRecord): string {
  const decipher = crypto.createDecipheriv('aes-256-gcm', VAULT_KEY, record.iv);
  decipher.setAuthTag(record.authTag);
  const decrypted = Buffer.concat([
    decipher.update(record.ciphertext),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

export function parseCookieHeader(
  cookieHeader: string | undefined,
  name: string
): string | null {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(';');
  for (const part of parts) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    if (key === name) {
      return decodeURIComponent(part.slice(idx + 1).trim());
    }
  }
  return null;
}

export function setSessionCookie(res: Response, sessionId: string): void {
  const isProd = process.env.NODE_ENV === 'production';
  const cookieAttrs = [
    `${GOOGLE_SESSION_COOKIE_NAME}=${encodeURIComponent(sessionId)}`,
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
    'Max-Age=86400',
    ...(isProd ? ['Secure'] : []),
  ];
  res.setHeader('Set-Cookie', cookieAttrs.join('; '));
}

export function clearSessionCookie(res: Response): void {
  const isProd = process.env.NODE_ENV === 'production';
  const cookieAttrs = [
    `${GOOGLE_SESSION_COOKIE_NAME}=`,
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
    'Max-Age=0',
    ...(isProd ? ['Secure'] : []),
  ];
  res.setHeader('Set-Cookie', cookieAttrs.join('; '));
}

export interface VerifiedGoogleTokenInfo {
  email: string;
  displayName: string | null;
  scopes: string[];
  expiresInSeconds: number;
  subject: string | null;
}

export async function verifyGoogleAccessTokenWithGoogle(
  accessToken: string
): Promise<VerifiedGoogleTokenInfo> {
  const cleanToken = accessToken.trim();
  if (!cleanToken || cleanToken.length < 10) {
    throw new GoogleTokenVaultError(
      'Access token OAuth 2.0 ausente ou inválido.',
      401,
      'GOOGLE_TOKEN_INVALID'
    );
  }

  let tokenInfoRes: globalThis.Response;
  try {
    tokenInfoRes = await fetch(
      `${GOOGLE_TOKENINFO_ENDPOINT}?access_token=${encodeURIComponent(cleanToken)}`
    );
  } catch {
    throw new GoogleTokenVaultError(
      'Não foi possível validar o token com os servidores do Google.',
      502,
      'GOOGLE_VERIFICATION_UNAVAILABLE'
    );
  }

  if (!tokenInfoRes.ok) {
    throw new GoogleTokenVaultError(
      'Token Google inválido ou expirado.',
      401,
      'GOOGLE_TOKEN_INVALID'
    );
  }

  const info = (await tokenInfoRes.json().catch(() => null)) as {
    email?: string;
    email_verified?: string | boolean;
    scope?: string;
    expires_in?: string | number;
    sub?: string;
  } | null;

  if (!info || !info.email) {
    throw new GoogleTokenVaultError(
      'O token informado não possui uma identidade de e-mail verificada pelo Google.',
      401,
      'GOOGLE_TOKEN_INVALID'
    );
  }

  if (info.email_verified === 'false' || info.email_verified === false) {
    throw new GoogleTokenVaultError(
      'A conta Google precisa possuir e-mail verificado.',
      401,
      'GOOGLE_EMAIL_UNVERIFIED'
    );
  }

  const expiresRaw = Number(info.expires_in);
  const expiresInSeconds =
    Number.isFinite(expiresRaw) && expiresRaw > 0
      ? Math.min(expiresRaw, DEFAULT_TOKEN_TTL_SECONDS)
      : DEFAULT_TOKEN_TTL_SECONDS;

  const scopes =
    typeof info.scope === 'string'
      ? info.scope
          .split(/\s+/)
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

  let displayName: string | null = null;
  try {
    const userInfoRes = await fetch(GOOGLE_USERINFO_ENDPOINT, {
      headers: { Authorization: `Bearer ${cleanToken}` },
    });
    if (userInfoRes.ok) {
      const userInfo = (await userInfoRes.json().catch(() => null)) as {
        name?: string;
      } | null;
      if (userInfo?.name && typeof userInfo.name === 'string') {
        displayName = userInfo.name.trim() || null;
      }
    }
  } catch {
    // Opcional; mantém null se userinfo falhar
  }

  return {
    email: info.email.trim().toLowerCase(),
    displayName,
    scopes,
    expiresInSeconds,
    subject: typeof info.sub === 'string' ? info.sub : null,
  };
}

export function storeGoogleTokenSession(params: {
  existingSessionId?: string | null;
  accessToken: string;
  email: string;
  displayName?: string | null;
  scopes: string[];
  expiresInSeconds?: number;
}): { sessionId: string; status: GoogleSessionStatus } {
  const sessionId =
    params.existingSessionId && sessionStore.has(params.existingSessionId)
      ? params.existingSessionId
      : crypto.randomBytes(24).toString('hex');

  const { ciphertext, iv, authTag } = encryptToken(params.accessToken);
  const ttlSeconds =
    params.expiresInSeconds && params.expiresInSeconds > 30
      ? params.expiresInSeconds
      : DEFAULT_TOKEN_TTL_SECONDS;
  const expiresAtMs = Date.now() + ttlSeconds * 1000;

  const record: EncryptedTokenRecord = {
    sessionId,
    ciphertext,
    iv,
    authTag,
    email: params.email,
    displayName: params.displayName ?? null,
    scopes: Array.isArray(params.scopes) ? params.scopes : [],
    expiresAtMs,
    updatedAt: new Date().toISOString(),
  };

  sessionStore.set(sessionId, record);

  return {
    sessionId,
    status: toSessionStatus(record),
  };
}

function toSessionStatus(record: EncryptedTokenRecord | undefined): GoogleSessionStatus {
  if (!record) {
    return {
      connected: false,
      email: null,
      displayName: null,
      expiresAt: null,
      isExpired: false,
      scopes: [],
    };
  }

  const isExpired = Date.now() >= record.expiresAtMs;
  return {
    connected: true,
    email: record.email,
    displayName: record.displayName,
    expiresAt: new Date(record.expiresAtMs).toISOString(),
    isExpired,
    scopes: record.scopes,
  };
}

export function getGoogleSessionStatusFromRequest(req: Request): GoogleSessionStatus {
  const sessionId = parseCookieHeader(
    req.headers.cookie,
    GOOGLE_SESSION_COOKIE_NAME
  );
  if (!sessionId) return toSessionStatus(undefined);
  return toSessionStatus(sessionStore.get(sessionId));
}

export class GoogleTokenVaultError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(message: string, statusCode: number, code: string) {
    super(message);
    this.name = 'GoogleTokenVaultError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

export interface ResolvedGoogleSession {
  sessionId: string;
  accessToken: string;
  fromEmail: string | null;
  scopes: string[];
}

export function resolveGoogleAccessTokenFromRequest(
  req: Request
): ResolvedGoogleSession {
  const sessionId = parseCookieHeader(
    req.headers.cookie,
    GOOGLE_SESSION_COOKIE_NAME
  );
  if (!sessionId) {
    throw new GoogleTokenVaultError(
      'Sessão Google não encontrada. Conecte sua conta Google antes de executar esta ação.',
      401,
      'GOOGLE_NOT_CONNECTED'
    );
  }

  const record = sessionStore.get(sessionId);
  if (!record) {
    throw new GoogleTokenVaultError(
      'Sessão Google expirada ou desconectada. Conecte sua conta Google novamente.',
      401,
      'GOOGLE_NOT_CONNECTED'
    );
  }

  if (Date.now() >= record.expiresAtMs) {
    throw new GoogleTokenVaultError(
      'O access token da sua sessão Google expirou. Renove a conexão para continuar.',
      401,
      'GOOGLE_TOKEN_EXPIRED'
    );
  }

  return {
    sessionId: record.sessionId,
    accessToken: decryptToken(record),
    fromEmail: record.email,
    scopes: record.scopes,
  };
}

export async function revokeAndDeleteGoogleSession(
  req: Request
): Promise<void> {
  const sessionId = parseCookieHeader(
    req.headers.cookie,
    GOOGLE_SESSION_COOKIE_NAME
  );
  if (!sessionId) return;

  const record = sessionStore.get(sessionId);
  sessionStore.delete(sessionId);

  if (!record) return;

  try {
    const token = decryptToken(record);
    const revokeRes = await fetch(
      `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`,
      { method: 'POST' }
    );
    if (!revokeRes.ok) {
      console.warn(
        `[TeamDeck] Revogação OAuth remota retornou HTTP ${revokeRes.status} para sessão encerrada.`
      );
    } else {
      console.info('[TeamDeck] Token OAuth revogado com sucesso no encerramento da sessão.');
    }
  } catch (err) {
    console.warn(
      '[TeamDeck] Falha de rede ao revogar token OAuth no Google; sessão removida do servidor.',
      err instanceof Error ? err.message : ''
    );
  }
}

export function _clearTokenVaultForTests(): void {
  sessionStore.clear();
}

export function _getTokenVaultSizeForTests(): number {
  return sessionStore.size;
}
