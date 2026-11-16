import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  ExternalLink,
  Loader2,
  Mail,
  RefreshCw,
  RotateCcw,
  Send,
  UserCheck,
} from 'lucide-react';
import {
  buildPersonalizedMemberEmailDrafts,
  isValidEmailAddress,
} from '../../domain/gmailComposer';
import {
  fetchBackendGoogleSession,
  refreshGoogleAccessToken,
  subscribeGoogleSession,
} from '../../services/googleAuthService';
import { TeamDeckServiceError } from '../../services/teamDeckService';
import { Project, TeamMemberAssignmentView } from '../../types';
import { MemberPreparationMaterial } from '../../types/preparation';
import {
  EmailDispatchLog,
  GmailMemberDraft,
  GoogleSessionStatus,
} from '../../types/workspace';
import { Card, CardHeader } from '../ui/Card';
import { GoogleAccountBar } from '../ui/GoogleAccountBar';
import { Modal } from '../ui/Modal';

interface GmailDispatchPanelProps {
  project: Project;
  projectMembers: TeamMemberAssignmentView[];
  preparations: MemberPreparationMaterial[];
  emailLogs: EmailDispatchLog[];
  isMutating: boolean;
  onSendMemberEmail: (params: {
    projectId: string;
    memberId: string;
    memberName: string;
    recipientEmail: string;
    subject: string;
    bodyText: string;
  }) => Promise<void>;
}

interface EditableDraftState {
  recipientEmail: string;
  subject: string;
  bodyText: string;
}

function formatDateTimePtBr(isoString: string | null): string {
  if (!isoString) return '—';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return isoString;
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

export function GmailDispatchPanel({
  project,
  projectMembers,
  preparations,
  emailLogs,
  isMutating,
  onSendMemberEmail,
}: GmailDispatchPanelProps) {
  const appBaseUrl =
    typeof window !== 'undefined' ? window.location.origin : '';

  const baseDrafts = useMemo(
    () =>
      buildPersonalizedMemberEmailDrafts({
        project,
        projectMembers,
        preparations,
        appBaseUrl,
      }),
    [project, projectMembers, preparations, appBaseUrl]
  );

  const [draftEdits, setDraftEdits] = useState<
    Record<string, EditableDraftState>
  >({});
  const [selectedMemberId, setSelectedMemberId] = useState<string>(
    () => projectMembers[0]?.memberId ?? ''
  );
  const [googleSession, setGoogleSession] = useState<GoogleSessionStatus>({
    connected: false,
    email: null,
    displayName: null,
    expiresAt: null,
    isExpired: false,
    scopes: [],
  });

  const [sendingMemberId, setSendingMemberId] = useState<string | null>(null);
  const [isBatchSending, setIsBatchSending] = useState(false);
  const [confirmMode, setConfirmMode] = useState<'single' | 'batch' | null>(
    null
  );
  const [feedbackError, setFeedbackError] = useState<{
    message: string;
    expired?: boolean;
  } | null>(null);
  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeGoogleSession(setGoogleSession);
    void fetchBackendGoogleSession();
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (
      projectMembers.length > 0 &&
      !projectMembers.some((m) => m.memberId === selectedMemberId)
    ) {
      setSelectedMemberId(projectMembers[0].memberId);
    }
  }, [projectMembers, selectedMemberId]);

  const projectLogs = useMemo(
    () => emailLogs.filter((l) => l.projectId === project.id),
    [emailLogs, project.id]
  );

  const getEffectiveDraft = (base: GmailMemberDraft): EditableDraftState => {
    return (
      draftEdits[base.memberId] ?? {
        recipientEmail: base.recipientEmail,
        subject: base.subject,
        bodyText: base.bodyText,
      }
    );
  };

  const updateDraftField = (
    memberId: string,
    base: GmailMemberDraft,
    field: keyof EditableDraftState,
    value: string
  ) => {
    const current = getEffectiveDraft(base);
    setDraftEdits((prev) => ({
      ...prev,
      [memberId]: {
        ...current,
        [field]: value,
      },
    }));
  };

  const resetDraftToGenerated = (base: GmailMemberDraft) => {
    setDraftEdits((prev) => {
      const next = { ...prev };
      delete next[base.memberId];
      return next;
    });
  };

  const activeBaseDraft =
    baseDrafts.find((d) => d.memberId === selectedMemberId) ??
    baseDrafts[0] ??
    null;

  const activeDraft = activeBaseDraft
    ? getEffectiveDraft(activeBaseDraft)
    : null;

  const activeLog = activeBaseDraft
    ? projectLogs.find((l) => l.memberId === activeBaseDraft.memberId) ?? null
    : null;

  const pendingOrFailedDrafts = useMemo(() => {
    return baseDrafts.filter((draft) => {
      const log = projectLogs.find((l) => l.memberId === draft.memberId);
      return !log || log.status === 'failed';
    });
  }, [baseDrafts, projectLogs]);

  const sentCount = baseDrafts.filter((draft) => {
    const log = projectLogs.find((l) => l.memberId === draft.memberId);
    return log?.status === 'sent';
  }).length;

  const failedCount = baseDrafts.filter((draft) => {
    const log = projectLogs.find((l) => l.memberId === draft.memberId);
    return log?.status === 'failed';
  }).length;

  const isGoogleReady = googleSession.connected && !googleSession.isExpired;

  const handleConfirmSendSingle = async () => {
    if (!activeBaseDraft || !activeDraft) return;

    setConfirmMode(null);
    setSendingMemberId(activeBaseDraft.memberId);
    setFeedbackError(null);
    setFeedbackSuccess(null);

    try {
      await onSendMemberEmail({
        projectId: project.id,
        memberId: activeBaseDraft.memberId,
        memberName: activeBaseDraft.memberName,
        recipientEmail: activeDraft.recipientEmail,
        subject: activeDraft.subject,
        bodyText: activeDraft.bodyText,
      });
      setFeedbackSuccess(
        `E-mail confirmado pela Gmail API e enviado para ${activeDraft.recipientEmail}.`
      );
    } catch (err) {
      const code =
        err instanceof TeamDeckServiceError ? err.code : undefined;
      if (code === 'GOOGLE_TOKEN_EXPIRED' || code === 'GOOGLE_NOT_CONNECTED') {
        void fetchBackendGoogleSession();
      }
      setFeedbackError({
        message:
          err instanceof Error
            ? err.message
            : 'Não foi possível enviar a mensagem pela Gmail API.',
        expired: code === 'GOOGLE_TOKEN_EXPIRED',
      });
    } finally {
      setSendingMemberId(null);
    }
  };

  const handleConfirmSendBatch = async () => {
    if (pendingOrFailedDrafts.length === 0) return;

    setConfirmMode(null);
    setIsBatchSending(true);
    setFeedbackError(null);
    setFeedbackSuccess(null);

    let succeeded = 0;
    let failed = 0;
    let lastError: string | null = null;
    let sawExpired = false;

    for (const baseDraft of pendingOrFailedDrafts) {
      const edited = getEffectiveDraft(baseDraft);
      setSendingMemberId(baseDraft.memberId);
      try {
        await onSendMemberEmail({
          projectId: project.id,
          memberId: baseDraft.memberId,
          memberName: baseDraft.memberName,
          recipientEmail: edited.recipientEmail,
          subject: edited.subject,
          bodyText: edited.bodyText,
        });
        succeeded += 1;
      } catch (err) {
        failed += 1;
        lastError =
          err instanceof Error ? err.message : 'Erro no envio pela Gmail API.';
        if (
          err instanceof TeamDeckServiceError &&
          err.code === 'GOOGLE_TOKEN_EXPIRED'
        ) {
          sawExpired = true;
          void fetchBackendGoogleSession();
          break;
        }
      }
    }

    setSendingMemberId(null);
    setIsBatchSending(false);

    if (succeeded > 0 && failed === 0) {
      setFeedbackSuccess(
        `${succeeded} mensagem(ns) confirmada(s) pela Gmail API e enviada(s) com sucesso.`
      );
    } else if (succeeded > 0 && failed > 0) {
      setFeedbackError({
        message: `${succeeded} e-mail(s) enviado(s), mas ${failed} falhou(aram): ${
          lastError ?? ''
        }`,
        expired: sawExpired,
      });
    } else if (failed > 0) {
      setFeedbackError({
        message:
          lastError ||
          'Nenhum e-mail pôde ser enviado. Verifique o status de cada integrante.',
        expired: sawExpired,
      });
    }
  };

  const handleRenewTokenInline = async () => {
    setFeedbackError(null);
    try {
      await refreshGoogleAccessToken();
    } catch (err) {
      setFeedbackError({
        message:
          err instanceof Error
            ? err.message
            : 'Falha ao renovar a sessão Google.',
      });
    }
  };

  const busy = isMutating || isBatchSending || Boolean(sendingMemberId);

  return (
    <div className="space-y-6">
      <Card padding="md" className="space-y-5">
        <CardHeader
          title="Comunicação da equipe via Gmail"
          subtitle="Revise mensagens personalizadas com responsabilidade individual, tempo de fala e links dos materiais antes de enviar"
          action={
            baseDrafts.length > 0 && (
              <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-slate-600 tabular-nums">
                <span className="text-emerald-700 font-semibold">
                  {sentCount} enviado(s)
                </span>
                {failedCount > 0 && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-red-700 font-semibold">
                      {failedCount} com falha
                    </span>
                  </>
                )}
              </div>
            )
          }
        />

        <GoogleAccountBar
          purposeLabel="enviar mensagens reais pelo Gmail"
          compact
          onSessionChange={setGoogleSession}
        />

        {feedbackError && (
          <div
            role="alert"
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-900"
          >
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{feedbackError.message}</span>
            </div>
            {feedbackError.expired && (
              <button
                type="button"
                onClick={() => void handleRenewTokenInline()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-red-300 text-red-800 text-xs font-medium rounded-lg hover:bg-red-100 transition-colors shrink-0 whitespace-nowrap"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Renovar token Google</span>
              </button>
            )}
          </div>
        )}

        {feedbackSuccess && (
          <div
            role="status"
            className="flex items-start gap-2.5 p-3.5 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-900"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>{feedbackSuccess}</span>
          </div>
        )}
      </Card>

      {projectMembers.length === 0 ? (
        <Card padding="lg" className="text-center space-y-2">
          <Mail className="w-8 h-8 text-slate-400 mx-auto" aria-hidden="true" />
          <p className="text-sm font-semibold text-slate-900">
            Nenhum integrante associado a este projeto
          </p>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Associe participantes na aba &ldquo;Integrantes&rdquo; para gerar os
            rascunhos personalizados de e-mail.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Lista de integrantes + status de envio */}
          <Card padding="none" className="overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between gap-2">
              <CardHeader
                title="Destinatários"
                subtitle={`${baseDrafts.length} integrante(s)`}
              />
              {pendingOrFailedDrafts.length > 0 && (
                <button
                  type="button"
                  disabled={busy || !isGoogleReady}
                  onClick={() => setConfirmMode('batch')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-700 hover:bg-blue-800 disabled:bg-slate-200 disabled:text-slate-500 text-white text-xs font-medium rounded-lg transition-colors whitespace-nowrap"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Enviar pendentes ({pendingOrFailedDrafts.length})</span>
                </button>
              )}
            </div>

            <div className="divide-y divide-slate-200">
              {baseDrafts.map((draft) => {
                const log = projectLogs.find(
                  (l) => l.memberId === draft.memberId
                );
                const selected = draft.memberId === activeBaseDraft?.memberId;
                const isThisSending = sendingMemberId === draft.memberId;

                return (
                  <button
                    key={draft.memberId}
                    type="button"
                    onClick={() => setSelectedMemberId(draft.memberId)}
                    className={`w-full text-left px-5 py-4 transition-colors space-y-1.5 ${
                      selected ? 'bg-blue-50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {draft.memberName}
                      </p>
                      {isThisSending ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 shrink-0">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Enviando</span>
                        </span>
                      ) : log?.status === 'sent' ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 shrink-0">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Enviado</span>
                        </span>
                      ) : log?.status === 'failed' ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 shrink-0">
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>Falha</span>
                        </span>
                      ) : (
                        <span className="text-xs font-medium text-slate-500 shrink-0">
                          Aguardando revisão
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-500 truncate">
                      {getEffectiveDraft(draft).recipientEmail}
                    </p>
                    <p className="text-xs text-slate-600 tabular-nums">
                      Tempo: {draft.presentationDurationLabel}
                    </p>
                  </button>
                );
              })}
            </div>
          </Card>

          {/* Revisão e edição da mensagem individual */}
          {activeBaseDraft && activeDraft && (
            <Card padding="lg" className="lg:col-span-2 space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-slate-200">
                <div className="space-y-1 min-w-0">
                  <p className="text-xs font-semibold text-blue-700 flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Revisão individual antes do envio</span>
                  </p>
                  <h3 className="text-lg font-bold text-slate-900">
                    {activeBaseDraft.memberName}
                  </h3>
                  <p className="text-xs text-slate-600">
                    {activeBaseDraft.responsibility}
                  </p>
                </div>

                <button
                  type="button"
                  disabled={busy}
                  onClick={() => resetDraftToGenerated(activeBaseDraft)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg transition-colors whitespace-nowrap"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restaurar modelo</span>
                </button>
              </div>

              {/* Resumo dos dados injetados automaticamente */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                <div className="space-y-1">
                  <p className="font-semibold text-slate-700 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-blue-700" />
                    <span>Tempo de apresentação</span>
                  </p>
                  <p className="text-slate-600 tabular-nums">
                    {activeBaseDraft.presentationDurationLabel}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="font-semibold text-slate-700 flex items-center gap-1.5">
                    <ExternalLink className="w-3.5 h-3.5 text-blue-700" />
                    <span>Materiais incluídos</span>
                  </p>
                  <ul className="space-y-0.5 text-slate-600">
                    {activeBaseDraft.materialLinks.length > 0 ? (
                      activeBaseDraft.materialLinks.map((link) => (
                        <li key={link.url} className="truncate">
                          {link.label}
                        </li>
                      ))
                    ) : (
                      <li>Link do painel do projeto no TeamDeck</li>
                    )}
                  </ul>
                </div>
              </div>

              {/* Status registrado do último envio/tentativa */}
              {activeLog && (
                <div
                  className={`p-3.5 rounded-xl border text-xs space-y-1 ${
                    activeLog.status === 'sent'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-red-50 border-red-200 text-red-900'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 font-semibold">
                    <span>
                      {activeLog.status === 'sent'
                        ? 'Mensagem confirmada pela Gmail API'
                        : 'Falha no último envio'}
                    </span>
                    <span className="tabular-nums">
                      Tentativa(s): {activeLog.attemptCount} ·{' '}
                      {formatDateTimePtBr(activeLog.lastAttemptAt)}
                    </span>
                  </div>
                  {activeLog.gmailMessageId && (
                    <p className="text-emerald-800">
                      ID Gmail:{' '}
                      <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-emerald-200">
                        {activeLog.gmailMessageId}
                      </code>
                    </p>
                  )}
                  {activeLog.errorMessage && (
                    <p className="text-red-800">{activeLog.errorMessage}</p>
                  )}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="gmail-recipient"
                    className="block text-sm font-medium text-slate-700 mb-1"
                  >
                    Destinatário (e-mail)
                  </label>
                  <input
                    id="gmail-recipient"
                    type="email"
                    value={activeDraft.recipientEmail}
                    onChange={(e) =>
                      updateDraftField(
                        activeBaseDraft.memberId,
                        activeBaseDraft,
                        'recipientEmail',
                        e.target.value
                      )
                    }
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-blue-700 focus:ring-1 focus:ring-blue-700"
                  />
                  {!isValidEmailAddress(activeDraft.recipientEmail) && (
                    <p className="mt-1 text-xs text-red-600">
                      Informe um endereço de e-mail válido antes de enviar.
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="gmail-subject"
                    className="block text-sm font-medium text-slate-700 mb-1"
                  >
                    Assunto
                  </label>
                  <input
                    id="gmail-subject"
                    type="text"
                    value={activeDraft.subject}
                    onChange={(e) =>
                      updateDraftField(
                        activeBaseDraft.memberId,
                        activeBaseDraft,
                        'subject',
                        e.target.value
                      )
                    }
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-blue-700 focus:ring-1 focus:ring-blue-700"
                  />
                </div>

                <div>
                  <label
                    htmlFor="gmail-body"
                    className="block text-sm font-medium text-slate-700 mb-1"
                  >
                    Conteúdo da mensagem
                  </label>
                  <textarea
                    id="gmail-body"
                    rows={12}
                    value={activeDraft.bodyText}
                    onChange={(e) =>
                      updateDraftField(
                        activeBaseDraft.memberId,
                        activeBaseDraft,
                        'bodyText',
                        e.target.value
                      )
                    }
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-800 leading-relaxed focus:outline-none focus:border-blue-700 focus:ring-1 focus:ring-blue-700"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-slate-500">
                  O envio utiliza sua conta Google conectada via Gmail API e só
                  é marcado como concluído após confirmação oficial do servidor.
                </p>

                <button
                  type="button"
                  disabled={
                    busy ||
                    !isGoogleReady ||
                    !isValidEmailAddress(activeDraft.recipientEmail) ||
                    activeDraft.subject.trim().length < 3 ||
                    activeDraft.bodyText.trim().length < 10
                  }
                  onClick={() => setConfirmMode('single')}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-700 hover:bg-blue-800 disabled:bg-slate-200 disabled:text-slate-500 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
                >
                  {sendingMemberId === activeBaseDraft.memberId ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Enviando pelo Gmail...</span>
                    </>
                  ) : activeLog?.status === 'failed' ? (
                    <>
                      <RefreshCw className="w-4 h-4" />
                      <span>Tentar reenviar</span>
                    </>
                  ) : activeLog?.status === 'sent' ? (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Enviar novamente</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Confirmar e enviar</span>
                    </>
                  )}
                </button>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Modal explícito de confirmação antes de disparar e-mails reais pelo Gmail */}
      <Modal
        isOpen={Boolean(confirmMode)}
        onClose={() => !busy && setConfirmMode(null)}
        title={
          confirmMode === 'batch'
            ? 'Confirmar envio em lote via Gmail?'
            : 'Confirmar envio de e-mail via Gmail?'
        }
        subtitle="Ação externa irreversível na sua conta Google"
      >
        <div className="space-y-4">
          {confirmMode === 'single' && activeBaseDraft && activeDraft ? (
            <div className="space-y-2 text-sm text-slate-700">
              <p>
                Você está prestes a enviar um e-mail real pela Gmail API usando
                sua conta{' '}
                <strong>{googleSession.email || 'Google conectada'}</strong>:
              </p>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
                <p>
                  <strong>Para:</strong> {activeDraft.recipientEmail} (
                  {activeBaseDraft.memberName})
                </p>
                <p>
                  <strong>Assunto:</strong> {activeDraft.subject}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-2 text-sm text-slate-700">
              <p>
                Serão enviados{' '}
                <strong>{pendingOrFailedDrafts.length} e-mail(s)</strong> reais
                pela Gmail API usando{' '}
                <strong>{googleSession.email || 'sua conta Google'}</strong>:
              </p>
              <ul className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1 max-h-40 overflow-y-auto">
                {pendingOrFailedDrafts.map((d) => (
                  <li key={d.memberId}>
                    • {d.memberName} ({getEffectiveDraft(d).recipientEmail})
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200">
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirmMode(null)}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              Revisar antes
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void (confirmMode === 'batch'
                  ? handleConfirmSendBatch()
                  : handleConfirmSendSingle())
              }
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg"
            >
              <Send className="w-4 h-4" />
              <span>Enviar agora</span>
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
