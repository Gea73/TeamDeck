import { Request, Response, Router } from 'express';
import { z } from 'zod';
import { MAX_CALENDAR_ATTENDEES } from '../../src/domain/googleCalendarBuilder';
import {
  isRealIsoDate,
  isValidEmailAddress,
  isValidTime24h,
  isValidTimeZone,
  sanitizeExternalHttpUrl,
} from '../../src/domain/validators';
import { CreateCalendarRehearsalInput } from '../../src/types/workspace';
import {
  AuthenticatedRequest,
  requireAuthenticatedGoogleSession,
} from '../middleware/securityMiddleware';
import {
  clearSessionCookie,
  getGoogleSessionStatusFromRequest,
  GOOGLE_SESSION_COOKIE_NAME,
  GoogleTokenVaultError,
  parseCookieHeader,
  revokeAndDeleteGoogleSession,
  setSessionCookie,
  storeGoogleTokenSession,
  verifyGoogleAccessTokenWithGoogle,
} from '../services/googleTokenVault';
import {
  createGoogleCalendarRehearsal,
  GoogleWorkspaceApiError,
  sendGmailMessage,
} from '../services/googleWorkspaceApiService';

export const workspaceRouter = Router();

const sendGmailSchema = z.object({
  memberId: z.string().trim().max(120).optional(),
  recipientEmail: z
    .string()
    .trim()
    .min(3, 'Destinatário é obrigatório.')
    .max(254, 'E-mail do destinatário excede o tamanho máximo.')
    .refine(isValidEmailAddress, 'Endereço de e-mail do destinatário inválido.'),
  subject: z
    .string()
    .trim()
    .min(3, 'Assunto deve ter pelo menos 3 caracteres.')
    .max(200, 'Assunto não pode exceder 200 caracteres.'),
  bodyText: z
    .string()
    .trim()
    .min(10, 'O corpo da mensagem deve ter pelo menos 10 caracteres.')
    .max(20000, 'O corpo da mensagem excede 20.000 caracteres.'),
});

const calendarRehearsalSchema = z.object({
  projectName: z.string().trim().max(200).optional().default(''),
  title: z
    .string()
    .trim()
    .min(3, 'Título do ensaio deve ter pelo menos 3 caracteres.')
    .max(200, 'Título do ensaio não pode exceder 200 caracteres.'),
  description: z.string().trim().max(5000).optional().default(''),
  date: z
    .string()
    .trim()
    .refine(isRealIsoDate, 'Data do ensaio inválida (use YYYY-MM-DD).'),
  time: z
    .string()
    .trim()
    .refine(isValidTime24h, 'Horário do ensaio inválido (use HH:MM).'),
  durationMinutes: z.coerce
    .number()
    .finite('Duração inválida.')
    .min(10, 'Duração mínima é de 10 minutos.')
    .max(480, 'Duração máxima é de 480 minutos.'),
  modality: z.enum(['Presencial', 'Online']),
  location: z.string().trim().max(500).optional().default(''),
  meetingLink: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .default('')
    .refine(
      (val) => !val || Boolean(sanitizeExternalHttpUrl(val)),
      'Link de videoconferência deve começar com http:// ou https://.'
    ),
  generateGoogleMeet: z.boolean().optional().default(false),
  attendeeEmails: z
    .array(
      z
        .string()
        .trim()
        .max(254)
        .refine(isValidEmailAddress, 'E-mail de participante inválido.')
    )
    .min(1, 'Adicione pelo menos um participante.')
    .max(
      MAX_CALENDAR_ATTENDEES,
      `Máximo de ${MAX_CALENDAR_ATTENDEES} participantes por ensaio.`
    ),
  reminders: z
    .array(
      z.object({
        method: z.enum(['popup', 'email']),
        minutes: z.coerce.number().int().min(0).max(40320),
      })
    )
    .max(10, 'Máximo de 10 lembretes por evento.')
    .optional()
    .default([]),
  timeZone: z
    .string()
    .trim()
    .max(100)
    .optional()
    .default('America/Sao_Paulo')
    .refine(isValidTimeZone, 'Fuso horário IANA inválido.'),
});

// Status da sessão Google (nunca expõe o access token ao frontend)
workspaceRouter.get('/google/session', (req: Request, res: Response) => {
  const status = getGoogleSessionStatusFromRequest(req);
  res.status(200).json(status);
});

// Valida o token junto ao Google e armazena de forma cifrada no backend
workspaceRouter.post('/google/session', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const match = authHeader?.match(/^Bearer\s+(.+)$/i);
  const accessToken = match?.[1]?.trim();

  if (!accessToken || accessToken.length < 10) {
    res.status(400).json({
      error: 'Access token OAuth 2.0 ausente ou inválido.',
      code: 'GOOGLE_TOKEN_INVALID',
    });
    return;
  }

  try {
    const verified = await verifyGoogleAccessTokenWithGoogle(accessToken);

    const existingSessionId = parseCookieHeader(
      req.headers.cookie,
      GOOGLE_SESSION_COOKIE_NAME
    );

    const { sessionId, status } = storeGoogleTokenSession({
      existingSessionId,
      accessToken,
      email: verified.email,
      displayName: verified.displayName,
      scopes: verified.scopes,
      expiresInSeconds: verified.expiresInSeconds,
    });

    setSessionCookie(res, sessionId);
    res.status(200).json(status);
  } catch (err) {
    if (err instanceof GoogleTokenVaultError) {
      res.status(err.statusCode).json({
        error: err.message,
        code: err.code,
      });
      return;
    }

    res.status(502).json({
      error: 'Não foi possível verificar a sessão Google no servidor.',
      code: 'GOOGLE_VERIFICATION_UNAVAILABLE',
    });
  }
});

// Desconecta a conta Google, revoga o token (melhor esforço) e remove sessão do backend
workspaceRouter.delete(
  '/google/session',
  async (req: Request, res: Response) => {
    await revokeAndDeleteGoogleSession(req);
    clearSessionCookie(res);
    res.status(200).json({
      connected: false,
      email: null,
      displayName: null,
      expiresAt: null,
      isExpired: false,
      scopes: [],
    });
  }
);

// Envio individual via Gmail API
workspaceRouter.post(
  '/projects/:projectId/gmail/send',
  requireAuthenticatedGoogleSession,
  async (req: AuthenticatedRequest, res: Response) => {
    const projectIdParam = req.params.projectId;
    const projectId = Array.isArray(projectIdParam)
      ? projectIdParam[0]
      : projectIdParam;

    if (!projectId?.trim()) {
      res.status(400).json({ error: 'Identificador do projeto é obrigatório.' });
      return;
    }

    const parsed = sendGmailSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      res.status(400).json({
        error: firstIssue?.message || 'Dados inválidos para envio de e-mail.',
        code: 'INVALID_EMAIL_INPUT',
      });
      return;
    }

    const auth = req.googleAuth!;

    try {
      const result = await sendGmailMessage({
        accessToken: auth.accessToken,
        fromEmail: auth.fromEmail,
        recipientEmail: parsed.data.recipientEmail,
        subject: parsed.data.subject,
        bodyText: parsed.data.bodyText,
      });

      res.status(200).json({
        projectId,
        memberId: parsed.data.memberId ?? null,
        recipientEmail: parsed.data.recipientEmail,
        ...result,
      });
    } catch (error) {
      if (error instanceof GoogleWorkspaceApiError) {
        res.status(error.statusCode).json({
          error: error.message,
          code: error.code,
        });
        return;
      }

      res.status(500).json({
        error: 'Erro interno ao enviar e-mail via Gmail API.',
      });
    }
  }
);

// Criação real de ensaio no Google Calendar
workspaceRouter.post(
  '/projects/:projectId/calendar/rehearsals',
  requireAuthenticatedGoogleSession,
  async (req: AuthenticatedRequest, res: Response) => {
    const projectIdParam = req.params.projectId;
    const projectId = Array.isArray(projectIdParam)
      ? projectIdParam[0]
      : projectIdParam;

    if (!projectId?.trim()) {
      res.status(400).json({ error: 'Identificador do projeto é obrigatório.' });
      return;
    }

    const parsed = calendarRehearsalSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      res.status(400).json({
        error:
          firstIssue?.message ||
          'Dados inválidos para agendamento no Google Calendar.',
        code: 'INVALID_CALENDAR_INPUT',
      });
      return;
    }

    const auth = req.googleAuth!;
    const validatedInput: CreateCalendarRehearsalInput = {
      projectId: projectId.trim(),
      projectName: parsed.data.projectName,
      title: parsed.data.title,
      description: parsed.data.description,
      date: parsed.data.date,
      time: parsed.data.time,
      durationMinutes: parsed.data.durationMinutes,
      modality: parsed.data.modality,
      location: parsed.data.location,
      meetingLink: parsed.data.meetingLink,
      generateGoogleMeet: parsed.data.generateGoogleMeet,
      attendeeEmails: parsed.data.attendeeEmails,
      reminders: parsed.data.reminders,
      timeZone: parsed.data.timeZone,
    };

    try {
      const result = await createGoogleCalendarRehearsal({
        accessToken: auth.accessToken,
        input: validatedInput,
      });

      res.status(201).json(result);
    } catch (error) {
      if (error instanceof GoogleWorkspaceApiError) {
        res.status(error.statusCode).json({
          error: error.message,
          code: error.code,
        });
        return;
      }

      res.status(500).json({
        error: 'Erro interno ao criar evento no Google Calendar.',
      });
    }
  }
);
