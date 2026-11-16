import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Bell,
  CalendarPlus,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  Video,
} from 'lucide-react';
import { isValidEmailAddress } from '../../domain/gmailComposer';
import { validateCalendarRehearsalInput } from '../../domain/googleCalendarBuilder';
import {
  fetchBackendGoogleSession,
  refreshGoogleAccessToken,
  subscribeGoogleSession,
} from '../../services/googleAuthService';
import { TeamDeckServiceError } from '../../services/teamDeckService';
import {
  Project,
  TeamMemberAssignmentView,
  ValidationErrors,
} from '../../types';
import {
  CreateCalendarRehearsalInput,
  GoogleSessionStatus,
  RehearsalReminderConfig,
} from '../../types/workspace';
import { GoogleAccountBar } from './GoogleAccountBar';
import { Modal } from './Modal';

interface RehearsalFormModalProps {
  isOpen: boolean;
  projects: Project[];
  assignments: TeamMemberAssignmentView[];
  lockedProjectId?: string;
  defaultDate?: string;
  isSubmitting: boolean;
  onCreateCalendarRehearsal: (
    input: CreateCalendarRehearsalInput
  ) => Promise<void>;
  onClose: () => void;
}

const REMINDER_PRESETS: Array<{ label: string; minutes: number }> = [
  { label: '15 min antes', minutes: 15 },
  { label: '30 min antes', minutes: 30 },
  { label: '1 hora antes', minutes: 60 },
  { label: '1 dia antes', minutes: 1440 },
];

export function RehearsalFormModal({
  isOpen,
  projects,
  assignments,
  lockedProjectId,
  defaultDate,
  isSubmitting,
  onCreateCalendarRehearsal,
  onClose,
}: RehearsalFormModalProps) {
  const [projectId, setProjectId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('19:00');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [modality, setModality] = useState<'Presencial' | 'Online'>('Online');
  const [location, setLocation] = useState('');
  const [meetingLink, setMeetingLink] = useState('');
  const [generateGoogleMeet, setGenerateGoogleMeet] = useState(true);
  const [attendeeEmails, setAttendeeEmails] = useState<string[]>([]);
  const [extraEmailInput, setExtraEmailInput] = useState('');
  const [reminders, setReminders] = useState<RehearsalReminderConfig[]>([
    { method: 'popup', minutes: 30 },
    { method: 'email', minutes: 1440 },
  ]);

  const [newReminderMethod, setNewReminderMethod] = useState<'popup' | 'email'>(
    'popup'
  );
  const [newReminderMinutes, setNewReminderMinutes] = useState(15);

  const [fieldErrors, setFieldErrors] = useState<ValidationErrors>({});
  const [formError, setFormError] = useState<{
    message: string;
    expired?: boolean;
  } | null>(null);
  const [googleSession, setGoogleSession] = useState<GoogleSessionStatus>({
    connected: false,
    email: null,
    displayName: null,
    expiresAt: null,
    isExpired: false,
    scopes: [],
  });

  useEffect(() => {
    const unsubscribe = subscribeGoogleSession(setGoogleSession);
    void fetchBackendGoogleSession();
    return () => unsubscribe();
  }, []);

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === projectId) ?? null,
    [projects, projectId]
  );

  const projectMembers = useMemo(
    () => assignments.filter((a) => a.projectId === projectId),
    [assignments, projectId]
  );

  useEffect(() => {
    if (!isOpen) return;
    const initialProjId = lockedProjectId || projects[0]?.id || '';
    const initialProj = projects.find((p) => p.id === initialProjId) ?? null;
    const initialMembers = assignments.filter(
      (a) => a.projectId === initialProjId
    );

    setProjectId(initialProjId);
    setTitle(
      initialProj
        ? `Ensaio cronometrado — ${initialProj.title}`
        : 'Ensaio da apresentação'
    );
    setDescription(
      initialProj
        ? `Ensaio completo da equipe para alinhamento de roteiro, transições e tempo de apresentação (${initialProj.targetDurationMinutes} min).`
        : ''
    );
    setDate(defaultDate || initialProj?.presentationDate || '2026-11-20');
    setTime('19:00');
    setDurationMinutes(Math.max(30, initialProj?.targetDurationMinutes ?? 60));
    setModality('Online');
    setLocation(initialProj?.location ?? '');
    setMeetingLink('');
    setGenerateGoogleMeet(true);
    setAttendeeEmails(
      Array.from(
        new Set(initialMembers.map((m) => m.email.trim().toLowerCase()))
      )
    );
    setExtraEmailInput('');
    setReminders([
      { method: 'popup', minutes: 30 },
      { method: 'email', minutes: 1440 },
    ]);
    setFieldErrors({});
    setFormError(null);
  }, [isOpen, lockedProjectId, defaultDate, projects, assignments]);

  const handleProjectChange = (nextProjectId: string) => {
    setProjectId(nextProjectId);
    const nextProj = projects.find((p) => p.id === nextProjectId) ?? null;
    const nextMembers = assignments.filter((a) => a.projectId === nextProjectId);
    if (nextProj) {
      setTitle(`Ensaio cronometrado — ${nextProj.title}`);
      setLocation(nextProj.location);
    }
    setAttendeeEmails(
      Array.from(new Set(nextMembers.map((m) => m.email.trim().toLowerCase())))
    );
  };

  const toggleMemberEmail = (email: string) => {
    const clean = email.trim().toLowerCase();
    setAttendeeEmails((prev) =>
      prev.includes(clean) ? prev.filter((e) => e !== clean) : [...prev, clean]
    );
  };

  const handleAddExtraEmail = () => {
    const clean = extraEmailInput.trim().toLowerCase();
    if (!clean) return;
    if (!isValidEmailAddress(clean)) {
      setFieldErrors((prev) => ({
        ...prev,
        attendeeEmails: 'Informe um endereço de e-mail válido.',
      }));
      return;
    }
    if (!attendeeEmails.includes(clean)) {
      setAttendeeEmails((prev) => [...prev, clean]);
    }
    setExtraEmailInput('');
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next.attendeeEmails;
      return next;
    });
  };

  const handleAddReminder = () => {
    const mins = Math.max(0, Math.min(40320, Math.round(newReminderMinutes)));
    const exists = reminders.some(
      (r) => r.method === newReminderMethod && r.minutes === mins
    );
    if (!exists) {
      setReminders((prev) => [...prev, { method: newReminderMethod, minutes: mins }]);
    }
  };

  const handleRemoveReminder = (index: number) => {
    setReminders((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleRenewToken = async () => {
    setFormError(null);
    try {
      await refreshGoogleAccessToken();
    } catch (err) {
      setFormError({
        message:
          err instanceof Error
            ? err.message
            : 'Não foi possível renovar o token Google.',
      });
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);

    const browserTimeZone =
      typeof Intl !== 'undefined'
        ? Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo'
        : 'America/Sao_Paulo';

    const payload: CreateCalendarRehearsalInput = {
      projectId,
      projectName: selectedProject?.title ?? '',
      title,
      description,
      date,
      time,
      durationMinutes: Number(durationMinutes),
      modality,
      location: modality === 'Presencial' ? location : location.trim(),
      meetingLink: modality === 'Online' ? meetingLink.trim() : meetingLink.trim(),
      generateGoogleMeet: modality === 'Online' && generateGoogleMeet,
      attendeeEmails,
      reminders,
      timeZone: browserTimeZone,
    };

    const validation = validateCalendarRehearsalInput(payload);
    if (!validation.valid) {
      setFieldErrors(validation.errors);
      return;
    }

    if (!googleSession.connected || googleSession.isExpired) {
      setFormError({
        message:
          'Conecte (ou renove) sua conta Google acima antes de criar o evento no Google Calendar.',
        expired: googleSession.isExpired,
      });
      return;
    }

    setFieldErrors({});

    try {
      await onCreateCalendarRehearsal(payload);
      onClose();
    } catch (err) {
      if (err instanceof TeamDeckServiceError) {
        if (err.fieldErrors) setFieldErrors(err.fieldErrors);
        if (
          err.code === 'GOOGLE_TOKEN_EXPIRED' ||
          err.code === 'GOOGLE_NOT_CONNECTED'
        ) {
          void fetchBackendGoogleSession();
        }
        setFormError({
          message: err.message,
          expired: err.code === 'GOOGLE_TOKEN_EXPIRED',
        });
      } else {
        setFormError({
          message: 'Não foi possível criar o ensaio no Google Calendar.',
        });
      }
    }
  };

  const isGoogleReady = googleSession.connected && !googleSession.isExpired;

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !isSubmitting && onClose()}
      title="Agendar ensaio no Google Calendar"
      subtitle="Cria evento real no seu calendário e envia convites aos participantes"
    >
      <form
        onSubmit={(e) => void handleSubmit(e)}
        noValidate
        className="space-y-4 max-h-[75vh] overflow-y-auto pr-1"
      >
        <GoogleAccountBar
          purposeLabel="criar eventos e convites no Google Calendar"
          compact
          onSessionChange={setGoogleSession}
        />

        {formError && (
          <div
            role="alert"
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-900"
          >
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{formError.message}</span>
            </div>
            {formError.expired && (
              <button
                type="button"
                onClick={() => void handleRenewToken()}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-red-300 rounded text-red-800 font-medium hover:bg-red-100 shrink-0"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Renovar</span>
              </button>
            )}
          </div>
        )}

        {!lockedProjectId && (
          <div>
            <label
              htmlFor="reh-project"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              Projeto *
            </label>
            <select
              id="reh-project"
              value={projectId}
              onChange={(e) => handleProjectChange(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white focus:outline-none focus:border-blue-700 focus:ring-1 focus:ring-blue-700"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
            {fieldErrors.projectId && (
              <p className="mt-1 text-xs text-red-600">
                {fieldErrors.projectId}
              </p>
            )}
          </div>
        )}

        <div>
          <label
            htmlFor="reh-title"
            className="block text-sm font-medium text-slate-700 mb-1"
          >
            Título do ensaio *
          </label>
          <input
            id="reh-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex: Ensaio cronometrado — Banca final"
            className={`w-full px-3.5 py-2 border rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-1 ${
              fieldErrors.title
                ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                : 'border-slate-300 focus:border-blue-700 focus:ring-blue-700'
            }`}
          />
          {fieldErrors.title && (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.title}</p>
          )}
        </div>

        <div>
          <label
            htmlFor="reh-desc"
            className="block text-sm font-medium text-slate-700 mb-1"
          >
            Descrição e pauta do ensaio
          </label>
          <textarea
            id="reh-desc"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Objetivos do ensaio, slides prioritários, cronometragem..."
            className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-blue-700 focus:ring-1 focus:ring-blue-700"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label
              htmlFor="reh-date"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              Data *
            </label>
            <input
              id="reh-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 tabular-nums focus:outline-none focus:border-blue-700 focus:ring-1 focus:ring-blue-700"
            />
            {fieldErrors.date && (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.date}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="reh-time"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              Horário *
            </label>
            <input
              id="reh-time"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 tabular-nums focus:outline-none focus:border-blue-700 focus:ring-1 focus:ring-blue-700"
            />
            {fieldErrors.time && (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.time}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="reh-duration"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              Duração (min) *
            </label>
            <input
              id="reh-duration"
              type="number"
              min={10}
              max={480}
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Number(e.target.value))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 tabular-nums focus:outline-none focus:border-blue-700 focus:ring-1 focus:ring-blue-700"
            />
            {fieldErrors.durationMinutes && (
              <p className="mt-1 text-xs text-red-600">
                {fieldErrors.durationMinutes}
              </p>
            )}
          </div>
        </div>

        {/* Modalidade e localização / videoconferência */}
        <div className="space-y-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-slate-700">
              Modalidade
            </span>
            <div className="flex items-center gap-1 p-1 bg-white border border-slate-200 rounded-lg">
              {(['Online', 'Presencial'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setModality(option)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                    modality === option
                      ? 'bg-blue-700 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          {modality === 'Online' ? (
            <div className="space-y-3">
              <label className="flex items-center gap-2.5 text-xs sm:text-sm text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={generateGoogleMeet}
                  onChange={(e) => setGenerateGoogleMeet(e.target.checked)}
                  className="w-4 h-4 accent-blue-700 rounded"
                />
                <Video className="w-4 h-4 text-blue-700 shrink-0" />
                <span>Gerar link do Google Meet automaticamente no evento</span>
              </label>

              <div>
                <label
                  htmlFor="reh-meet-link"
                  className="block text-xs font-medium text-slate-600 mb-1"
                >
                  {generateGoogleMeet
                    ? 'Link externo alternativo (opcional)'
                    : 'Link de videoconferência *'}
                </label>
                <input
                  id="reh-meet-link"
                  type="url"
                  value={meetingLink}
                  onChange={(e) => setMeetingLink(e.target.value)}
                  placeholder="https://meet.google.com/... ou Zoom / Teams"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white focus:outline-none focus:border-blue-700 focus:ring-1 focus:ring-blue-700"
                />
                {fieldErrors.meetingLink && (
                  <p className="mt-1 text-xs text-red-600">
                    {fieldErrors.meetingLink}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div>
              <label
                htmlFor="reh-location"
                className="block text-xs font-medium text-slate-600 mb-1"
              >
                Local físico *
              </label>
              <input
                id="reh-location"
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Ex: Biblioteca Central — Sala de Estudos 04"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white focus:outline-none focus:border-blue-700 focus:ring-1 focus:ring-blue-700"
              />
              {fieldErrors.location && (
                <p className="mt-1 text-xs text-red-600">
                  {fieldErrors.location}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Participantes (e-mails para convite) */}
        <div className="space-y-2.5">
          <label className="block text-sm font-medium text-slate-700">
            Participantes convidados ({attendeeEmails.length}) *
          </label>

          {projectMembers.length > 0 && (
            <div className="space-y-1.5 border border-slate-200 rounded-lg p-2.5 bg-slate-50/70 max-h-32 overflow-y-auto">
              {projectMembers.map((member) => {
                const emailLower = member.email.trim().toLowerCase();
                const checked = attendeeEmails.includes(emailLower);
                return (
                  <label
                    key={member.associationId}
                    className="flex items-center justify-between gap-2 text-xs text-slate-700 cursor-pointer py-1 px-1.5 rounded hover:bg-white"
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleMemberEmail(emailLower)}
                        className="w-4 h-4 accent-blue-700 rounded"
                      />
                      <span className="font-medium text-slate-900 truncate">
                        {member.name}
                      </span>
                    </span>
                    <span className="text-slate-500 truncate">{emailLower}</span>
                  </label>
                );
              })}
            </div>
          )}

          <div className="flex items-center gap-2">
            <input
              type="email"
              value={extraEmailInput}
              onChange={(e) => setExtraEmailInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddExtraEmail();
                }
              }}
              placeholder="Adicionar outro e-mail (ex: orientador@universidade.edu)"
              className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-blue-700 focus:ring-1 focus:ring-blue-700"
            />
            <button
              type="button"
              onClick={handleAddExtraEmail}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-xs font-medium rounded-lg transition-colors whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Adicionar</span>
            </button>
          </div>

          {attendeeEmails.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {attendeeEmails.map((email) => (
                <span
                  key={email}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 border border-blue-200 rounded-md text-xs text-blue-900"
                >
                  <span>{email}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setAttendeeEmails((prev) =>
                        prev.filter((item) => item !== email)
                      )
                    }
                    className="text-blue-700 hover:text-red-700"
                    aria-label={`Remover ${email}`}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {fieldErrors.attendeeEmails && (
            <p className="text-xs text-red-600">{fieldErrors.attendeeEmails}</p>
          )}
        </div>

        {/* Lembretes do Google Calendar */}
        <div className="space-y-2.5">
          <div className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
            <Bell className="w-4 h-4 text-blue-700" />
            <span>Lembretes do evento</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={newReminderMethod}
              onChange={(e) =>
                setNewReminderMethod(e.target.value as 'popup' | 'email')
              }
              className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white text-slate-800"
            >
              <option value="popup">Notificação (popup)</option>
              <option value="email">E-mail</option>
            </select>

            <select
              value={newReminderMinutes}
              onChange={(e) => setNewReminderMinutes(Number(e.target.value))}
              className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white text-slate-800"
            >
              {REMINDER_PRESETS.map((preset) => (
                <option key={preset.minutes} value={preset.minutes}>
                  {preset.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={handleAddReminder}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-xs font-medium rounded-lg"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Incluir lembrete</span>
            </button>
          </div>

          {reminders.length > 0 && (
            <ul className="space-y-1 text-xs text-slate-600">
              {reminders.map((rem, idx) => (
                <li
                  key={`${rem.method}_${rem.minutes}_${idx}`}
                  className="flex items-center justify-between px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg"
                >
                  <span>
                    {rem.method === 'email' ? 'E-mail' : 'Notificação'} ·{' '}
                    {rem.minutes >= 60
                      ? `${Math.round((rem.minutes / 60) * 10) / 10} h`
                      : `${rem.minutes} min`}{' '}
                    antes
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveReminder(idx)}
                    className="text-slate-400 hover:text-red-600"
                    aria-label="Remover lembrete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="text-xs text-slate-500 leading-relaxed pt-1">
          Ao confirmar, o evento será criado diretamente no seu Google Calendar e
          os convites serão enviados aos participantes listados. O ensaio só é
          salvo após confirmação da API.
        </p>

        <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-200">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !isGoogleReady}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 disabled:bg-slate-200 disabled:text-slate-500 rounded-lg transition-colors"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CalendarPlus className="w-4 h-4" />
            )}
            <span>Criar no Google Calendar</span>
          </button>
        </div>
      </form>
    </Modal>
  );
}
