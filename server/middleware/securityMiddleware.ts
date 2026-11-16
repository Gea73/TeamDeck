import { NextFunction, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import {
  GoogleTokenVaultError,
  ResolvedGoogleSession,
  resolveGoogleAccessTokenFromRequest,
} from '../services/googleTokenVault';

export interface AuthenticatedRequest extends Request {
  googleAuth?: ResolvedGoogleSession;
}

export function requireAuthenticatedGoogleSession(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  try {
    req.googleAuth = resolveGoogleAccessTokenFromRequest(req);
    next();
  } catch (err) {
    if (err instanceof GoogleTokenVaultError) {
      res.status(err.statusCode).json({
        error: err.message,
        code: err.code,
      });
      return;
    }
    res.status(401).json({
      error: 'Autenticação Google obrigatória para acessar este recurso.',
      code: 'GOOGLE_NOT_CONNECTED',
    });
  }
}

function normalizeOrigin(urlStr: string | undefined): string | null {
  if (!urlStr) return null;
  try {
    return new URL(urlStr).origin.toLowerCase();
  } catch {
    return null;
  }
}

function getAllowedOriginsForRequest(req: Request): Set<string> {
  const allowed = new Set<string>();

  const envAppUrl = normalizeOrigin(process.env.APP_URL);
  if (envAppUrl) allowed.add(envAppUrl);

  const host = (req.get('x-forwarded-host') || req.get('host') || '').trim();
  if (host) {
    const proto = (req.get('x-forwarded-proto') || req.protocol || 'http')
      .split(',')[0]
      .trim();
    const derived = normalizeOrigin(`${proto}://${host}`);
    if (derived) allowed.add(derived);
    const httpsDerived = normalizeOrigin(`https://${host}`);
    if (httpsDerived) allowed.add(httpsDerived);
    const httpDerived = normalizeOrigin(`http://${host}`);
    if (httpDerived) allowed.add(httpDerived);
  }

  const port = Number(process.env.PORT) || 3000;
  allowed.add(`http://localhost:${port}`);
  allowed.add(`http://127.0.0.1:${port}`);

  return allowed;
}

const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function enforceCsrfOrigin(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!STATE_CHANGING_METHODS.has(req.method.toUpperCase())) {
    next();
    return;
  }

  const secFetchSite = req.get('sec-fetch-site');
  if (secFetchSite && secFetchSite.toLowerCase() === 'cross-site') {
    res.status(403).json({
      error: 'Requisição cross-site bloqueada pela política CSRF.',
      code: 'CSRF_ORIGIN_MISMATCH',
    });
    return;
  }

  const allowedOrigins = getAllowedOriginsForRequest(req);
  const originHeader = req.get('origin');
  if (originHeader) {
    const normalized = normalizeOrigin(originHeader);
    if (!normalized || !allowedOrigins.has(normalized)) {
      res.status(403).json({
        error: 'Origem da requisição não autorizada.',
        code: 'CSRF_ORIGIN_MISMATCH',
      });
      return;
    }
    next();
    return;
  }

  const refererHeader = req.get('referer');
  if (refererHeader) {
    const normalized = normalizeOrigin(refererHeader);
    if (!normalized || !allowedOrigins.has(normalized)) {
      res.status(403).json({
        error: 'Referer da requisição não autorizado.',
        code: 'CSRF_ORIGIN_MISMATCH',
      });
      return;
    }
  }

  next();
}

export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    error: 'Muitas requisições enviadas. Aguarde um minuto e tente novamente.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
});

export const geminiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    error:
      'Limite de requisições de processamento Gemini atingido. Aguarde um minuto e tente novamente.',
    code: 'GEMINI_RATE_LIMIT_EXCEEDED',
  },
});
