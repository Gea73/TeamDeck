import { ValidationResult } from '../types';
import {
  CreateCalendarRehearsalInput,
  RehearsalReminderConfig,
} from '../types/workspace';
import {
  isRealIsoDate,
  isValidEmailAddress,
  isValidTime24h,
  isValidTimeZone,
  sanitizeExternalHttpUrl,
} from './validators';

export const MAX_CALENDAR_ATTENDEES = 25;

export function validateCalendarRehearsalInput(
  input: Partial<CreateCalendarRehearsalInput>
): ValidationResult {
  const errors: Record<string, string> = {};

  if (!input.projectId?.trim()) {
    errors.projectId = 'Selecione o projeto vinculado ao ensaio.';
  }

  if (!input.title || input.title.trim().length < 3) {
    errors.title = 'Informe um título para o ensaio (mínimo de 3 caracteres).';
  } else if (input.title.trim().length > 200) {
    errors.title = 'O título do ensaio deve ter no máximo 200 caracteres.';
  }

  if (!input.date || !isRealIsoDate(input.date)) {
    errors.date = 'Informe uma data real válida no formato AAAA-MM-DD.';
  }

  if (!input.time || !isValidTime24h(input.time)) {
    errors.time = 'Informe um horário válido no formato HH:MM (00:00 a 23:59).';
  }

  const duration = Number(input.durationMinutes);
  if (!Number.isFinite(duration) || duration < 10 || duration > 480) {
    errors.durationMinutes =
      'A duração do ensaio deve estar entre 10 e 480 minutos.';
  }

  const attendees = Array.isArray(input.attendeeEmails)
    ? Array.from(
        new Set(
          input.attendeeEmails.map((e) => e.trim().toLowerCase()).filter(Boolean)
        )
      )
    : [];

  if (attendees.length === 0) {
    errors.attendeeEmails =
      'Adicione pelo menos um e-mail de participante para o convite.';
  } else if (attendees.length > MAX_CALENDAR_ATTENDEES) {
    errors.attendeeEmails = `O limite máximo é de ${MAX_CALENDAR_ATTENDEES} participantes por ensaio.`;
  } else if (attendees.some((email) => !isValidEmailAddress(email))) {
    errors.attendeeEmails =
      'Um ou mais e-mails de participantes possuem formato inválido.';
  }

  if (input.modality === 'Presencial' && !input.location?.trim()) {
    errors.location =
      'Informe o local físico para ensaios na modalidade presencial.';
  }

  if (input.meetingLink?.trim() && !sanitizeExternalHttpUrl(input.meetingLink)) {
    errors.meetingLink =
      'O link de videoconferência deve começar com http:// ou https://.';
  } else if (
    input.modality === 'Online' &&
    !input.generateGoogleMeet &&
    !input.meetingLink?.trim() &&
    !input.location?.trim()
  ) {
    errors.meetingLink =
      'Informe um link de videoconferência ou habilite a criação automática do Google Meet.';
  }

  if (input.timeZone && !isValidTimeZone(input.timeZone)) {
    errors.timeZone = 'Fuso horário IANA inválido.';
  }

  if (Array.isArray(input.reminders)) {
    if (input.reminders.length > 5) {
      errors.reminders = 'São permitidos no máximo 5 lembretes por evento.';
    } else {
      const invalidReminder = input.reminders.some(
        (r) =>
          (r.method !== 'email' && r.method !== 'popup') ||
          !Number.isFinite(r.minutes) ||
          r.minutes < 0 ||
          r.minutes > 40320
      );
      if (invalidReminder) {
        errors.reminders =
          'Os lembretes devem usar método válido e antecedência entre 0 e 40320 minutos.';
      }
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Calcula início e término em ISO local após validar data e hora reais.
 */
export function computeEventStartEnd(
  dateStr: string,
  timeStr: string,
  durationMinutes: number
): { startDateTime: string; endDateTime: string } {
  const cleanDate = dateStr.trim();
  const cleanTime = timeStr.trim();
  if (!isRealIsoDate(cleanDate)) {
    throw new Error(`Data inválida para evento do calendário: ${dateStr}`);
  }
  if (!isValidTime24h(cleanTime)) {
    throw new Error(`Horário inválido para evento do calendário: ${timeStr}`);
  }
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    throw new Error('Duração do evento deve ser positiva.');
  }

  const [year, month, day] = cleanDate.split('-').map(Number);
  const [hour, minute] = cleanTime.split(':').map(Number);

  // Calcula data/hora final sem depender do fuso do host usando UTC aritmético puro
  const startUtcMs = Date.UTC(year, month - 1, day, hour, minute, 0);
  const endUtc = new Date(startUtcMs + durationMinutes * 60 * 1000);

  const pad = (n: number) => String(n).padStart(2, '0');
  const startDateTime = `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(
    minute
  )}:00`;
  const endDateTime = `${endUtc.getUTCFullYear()}-${pad(
    endUtc.getUTCMonth() + 1
  )}-${pad(endUtc.getUTCDate())}T${pad(endUtc.getUTCHours())}:${pad(
    endUtc.getUTCMinutes()
  )}:00`;

  return { startDateTime, endDateTime };
}

export interface GoogleCalendarEventInsertBody {
  summary: string;
  description: string;
  location?: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  attendees: Array<{ email: string }>;
  reminders: {
    useDefault: boolean;
    overrides: RehearsalReminderConfig[];
  };
  conferenceData?: {
    createRequest: {
      requestId: string;
      conferenceSolutionKey: { type: 'hangoutsMeet' };
    };
  };
}

export function buildGoogleCalendarEventPayload(
  input: CreateCalendarRehearsalInput,
  conferenceRequestId?: string
): GoogleCalendarEventInsertBody {
  const { startDateTime, endDateTime } = computeEventStartEnd(
    input.date,
    input.time,
    Number(input.durationMinutes)
  );

  const timeZone =
    input.timeZone && isValidTimeZone(input.timeZone)
      ? input.timeZone.trim()
      : 'America/Sao_Paulo';
  const uniqueEmails = Array.from(
    new Set(input.attendeeEmails.map((e) => e.trim().toLowerCase()).filter(Boolean))
  ).slice(0, MAX_CALENDAR_ATTENDEES);

  const safeMeetingLink = sanitizeExternalHttpUrl(input.meetingLink);

  const descriptionParts = [
    `Projeto: ${input.projectName}`,
    `Modalidade: ${input.modality}`,
    input.description.trim() ? `\n${input.description.trim()}` : '',
    safeMeetingLink ? `\nLink da videoconferência: ${safeMeetingLink}` : '',
    '\nAgendado via TeamDeck.',
  ].filter(Boolean);

  const effectiveLocation =
    input.location.trim() || safeMeetingLink || undefined;

  const reminders: RehearsalReminderConfig[] =
    input.reminders.length > 0
      ? input.reminders.map((r) => ({
          method: r.method,
          minutes: Math.round(r.minutes),
        }))
      : [{ method: 'popup', minutes: 30 }];

  const payload: GoogleCalendarEventInsertBody = {
    summary: input.title.trim(),
    description: descriptionParts.join('\n'),
    ...(effectiveLocation ? { location: effectiveLocation } : {}),
    start: {
      dateTime: startDateTime,
      timeZone,
    },
    end: {
      dateTime: endDateTime,
      timeZone,
    },
    attendees: uniqueEmails.map((email) => ({ email })),
    reminders: {
      useDefault: false,
      overrides: reminders,
    },
  };

  if (input.generateGoogleMeet) {
    payload.conferenceData = {
      createRequest: {
        requestId:
          conferenceRequestId ||
          `td_meet_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    };
  }

  return payload;
}
