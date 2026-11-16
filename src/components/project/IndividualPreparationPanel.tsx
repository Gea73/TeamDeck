import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock,
  FileText,
  HelpCircle,
  Lightbulb,
  Loader2,
  MessageSquareQuote,
  Pencil,
  RefreshCw,
  Save,
  Sparkles,
  UserCheck,
  X,
} from 'lucide-react';
import {
  countWords,
  formatDurationSecondsPtBr,
} from '../../domain/contentDistribution';
import { formatSourcePagesLabel } from '../../domain/googleSlidesBuilder';
import {
  buildExclusiveMemberPreparationInput,
  countReviewedBlocks,
  estimateOralReadingSeconds,
} from '../../domain/preparationValidation';
import {
  fetchBackendGoogleSession,
  subscribeGoogleSession,
} from '../../services/googleAuthService';
import { TeamDeckServiceError } from '../../services/teamDeckService';
import { Project, TeamMemberAssignmentView } from '../../types';
import {
  MemberPreparationMaterial,
  PreparationReviewStatus,
} from '../../types/preparation';
import { GoogleSessionStatus } from '../../types/workspace';
import { getInitials } from '../../utils/formatters';
import { Card, CardHeader } from '../ui/Card';
import { GoogleAccountBar } from '../ui/GoogleAccountBar';
import { Modal } from '../ui/Modal';
import { ProgressBar } from '../ui/ProgressBar';

type MaterialTabKey =
  | 'script'
  | 'concepts'
  | 'examples'
  | 'questions'
  | 'transitions';

interface IndividualPreparationPanelProps {
  project: Project;
  projectMembers: TeamMemberAssignmentView[];
  preparations: MemberPreparationMaterial[];
  initialSelectedMemberId?: string | null;
  isMutating: boolean;
  onGeneratePreparation: (projectId: string, memberId: string) => Promise<void>;
  onUpdatePreparation: (material: MemberPreparationMaterial) => Promise<void>;
  onToggleSectionReviewed: (
    preparationId: string,
    sectionKey: keyof PreparationReviewStatus,
    reviewed: boolean
  ) => Promise<void>;
  onMarkAllReviewed: (
    preparationId: string,
    reviewed: boolean
  ) => Promise<void>;
}

const MATERIAL_TABS: Array<{
  key: MaterialTabKey;
  label: string;
  reviewField: keyof PreparationReviewStatus;
}> = [
  { key: 'script', label: 'Roteiro detalhado', reviewField: 'scriptReviewed' },
  {
    key: 'concepts',
    label: 'Conceitos técnicos',
    reviewField: 'conceptsReviewed',
  },
  {
    key: 'examples',
    label: 'Exemplos práticos',
    reviewField: 'examplesReviewed',
  },
  {
    key: 'questions',
    label: '5 Perguntas da audiência',
    reviewField: 'questionsReviewed',
  },
  {
    key: 'transitions',
    label: 'Transições de slides',
    reviewField: 'transitionsReviewed',
  },
];

export function IndividualPreparationPanel({
  project,
  projectMembers,
  preparations,
  initialSelectedMemberId,
  isMutating,
  onGeneratePreparation,
  onUpdatePreparation,
  onToggleSectionReviewed,
  onMarkAllReviewed,
}: IndividualPreparationPanelProps) {
  const [selectedMemberId, setSelectedMemberId] = useState<string>(
    () => initialSelectedMemberId || projectMembers[0]?.memberId || ''
  );
  const [activeSubTab, setActiveSubTab] = useState<MaterialTabKey>('script');
  const [editingTab, setEditingTab] = useState<MaterialTabKey | null>(null);
  const [draftMaterial, setDraftMaterial] =
    useState<MemberPreparationMaterial | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isConfirmRegenerateOpen, setIsConfirmRegenerateOpen] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
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

  const needsAuth = !googleSession.connected || googleSession.isExpired;

  useEffect(() => {
    if (
      initialSelectedMemberId &&
      projectMembers.some((m) => m.memberId === initialSelectedMemberId)
    ) {
      setSelectedMemberId(initialSelectedMemberId);
      return;
    }
    if (
      projectMembers.length > 0 &&
      !projectMembers.some((m) => m.memberId === selectedMemberId)
    ) {
      setSelectedMemberId(projectMembers[0].memberId);
    }
  }, [initialSelectedMemberId, projectMembers, selectedMemberId]);

  // Limpa modo de edição ao trocar de integrante
  useEffect(() => {
    setEditingTab(null);
    setDraftMaterial(null);
    setLocalError(null);
    setSuccessMessage(null);
  }, [selectedMemberId]);

  const projectPreparations = useMemo(
    () => preparations.filter((p) => p.projectId === project.id),
    [preparations, project.id]
  );

  const selectedMember = useMemo(
    () =>
      projectMembers.find((m) => m.memberId === selectedMemberId) ??
      projectMembers[0] ??
      null,
    [projectMembers, selectedMemberId]
  );

  const activeMaterial = useMemo(
    () =>
      selectedMember
        ? projectPreparations.find(
            (p) => p.memberId === selectedMember.memberId
          ) ?? null
        : null,
    [projectPreparations, selectedMember]
  );

  // Calcula em tempo real quais seções estão atribuídas exclusivamente ao integrante selecionado
  const memberScopePreview = useMemo(() => {
    if (!selectedMember) return { input: null, reason: null as string | null };
    try {
      const input = buildExclusiveMemberPreparationInput(
        project,
        projectMembers,
        selectedMember.memberId
      );
      return { input, reason: null as string | null };
    } catch (err) {
      return {
        input: null,
        reason:
          err instanceof Error
            ? err.message
            : 'Atribua seções a este integrante na aba Divisão de conteúdo.',
      };
    }
  }, [project, projectMembers, selectedMember]);

  const handleGenerate = async () => {
    if (!selectedMember) return;
    if (needsAuth) {
      setLocalError(
        'Conecte (ou renove) sua conta Google antes de gerar a preparação individual.'
      );
      return;
    }
    setIsGenerating(true);
    setLocalError(null);
    setSuccessMessage(null);
    try {
      await onGeneratePreparation(project.id, selectedMember.memberId);
      setEditingTab(null);
      setDraftMaterial(null);
      setIsConfirmRegenerateOpen(false);
      setSuccessMessage(
        `Material individual gerado para ${selectedMember.name} com base exclusiva nas suas seções.`
      );
    } catch (err) {
      if (
        err instanceof TeamDeckServiceError &&
        (err.code === 'GOOGLE_TOKEN_EXPIRED' ||
          err.code === 'GOOGLE_NOT_CONNECTED')
      ) {
        void fetchBackendGoogleSession();
      }
      setLocalError(
        err instanceof Error
          ? err.message
          : 'Erro ao gerar o material de preparação individual.'
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const startEditing = (tab: MaterialTabKey) => {
    if (!activeMaterial) return;
    setDraftMaterial(structuredClone(activeMaterial));
    setEditingTab(tab);
    setLocalError(null);
    setSuccessMessage(null);
  };

  const cancelEditing = () => {
    setEditingTab(null);
    setDraftMaterial(null);
  };

  const saveEditing = async () => {
    if (!draftMaterial) return;
    setLocalError(null);
    try {
      await onUpdatePreparation(draftMaterial);
      setEditingTab(null);
      setDraftMaterial(null);
      setSuccessMessage('Alterações salvas no material do integrante.');
    } catch (err) {
      setLocalError(
        err instanceof Error ? err.message : 'Erro ao salvar as alterações.'
      );
    }
  };

  const busy = isGenerating || isMutating;

  if (projectMembers.length === 0) {
    return (
      <Card padding="lg" className="text-center space-y-2">
        <UserCheck className="w-8 h-8 text-slate-400 mx-auto" />
        <h3 className="text-base font-semibold text-slate-900">
          Nenhum integrante associado ao projeto
        </h3>
        <p className="text-sm text-slate-500 max-w-md mx-auto">
          Associe integrantes na aba &ldquo;Integrantes&rdquo; e distribua as
          seções do documento antes de acessar a preparação individual.
        </p>
      </Card>
    );
  }

  const reviewedCount = activeMaterial
    ? countReviewedBlocks(activeMaterial.reviewedSections)
    : 0;
  const activeReviewPercent = activeMaterial
    ? Math.round((reviewedCount / 5) * 100)
    : 0;

  return (
    <div className="space-y-5">
      <GoogleAccountBar
        purposeLabel="gerar roteiros e perguntas individuais com segurança"
        compact
        onSessionChange={setGoogleSession}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Seletor de integrante */}
      <Card padding="none" className="lg:col-span-4 overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200">
          <CardHeader
            title="Integrantes do projeto"
            subtitle="Selecione um participante para preparar suas seções"
          />
        </div>
        <div className="divide-y divide-slate-200">
          {projectMembers.map((member) => {
            const selected = selectedMember?.memberId === member.memberId;
            const prep = projectPreparations.find(
              (p) => p.memberId === member.memberId
            );
            const revCount = prep
              ? countReviewedBlocks(prep.reviewedSections)
              : 0;

            let scopeInfo: ReturnType<
              typeof buildExclusiveMemberPreparationInput
            > | null = null;
            try {
              scopeInfo = buildExclusiveMemberPreparationInput(
                project,
                projectMembers,
                member.memberId
              );
            } catch {
              scopeInfo = null;
            }

            return (
              <button
                key={member.memberId}
                type="button"
                onClick={() => setSelectedMemberId(member.memberId)}
                className={`w-full text-left px-4 py-3.5 transition-colors flex items-start justify-between gap-3 ${
                  selected ? 'bg-blue-50/80' : 'hover:bg-slate-50'
                }`}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <span
                    className={`w-9 h-9 rounded-full border text-xs font-semibold flex items-center justify-center shrink-0 ${
                      selected
                        ? 'bg-blue-700 border-blue-700 text-white'
                        : 'bg-blue-50 border-blue-200 text-blue-700'
                    }`}
                  >
                    {getInitials(member.name)}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">
                      {member.name}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {member.role}
                      {scopeInfo
                        ? ` · ${scopeInfo.assignedSections.length} seção(ões)`
                        : ' · Sem seções'}
                    </p>
                    <p className="mt-1 text-xs font-medium text-blue-700 tabular-nums">
                      {prep
                        ? prep.allReviewed
                          ? 'Material revisado (5/5)'
                          : `Em revisão (${revCount}/5)`
                        : 'Preparação pendente'}
                    </p>
                  </div>
                </div>

                {scopeInfo && (
                  <span className="text-xs font-semibold text-slate-700 tabular-nums shrink-0">
                    {formatDurationSecondsPtBr(
                      scopeInfo.calculatedDurationSeconds
                    )}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </Card>

      {/* Área de preparação do integrante selecionado */}
      <div className="lg:col-span-8 space-y-5">
        {selectedMember && (
          <Card padding="md" className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="space-y-1 min-w-0">
                <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">
                  Preparação Individual
                </p>
                <h3 className="text-lg sm:text-xl font-bold text-slate-900">
                  {selectedMember.name}
                </h3>
                <p className="text-xs sm:text-sm text-slate-500">
                  {selectedMember.role} · {selectedMember.email}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {activeMaterial && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void onMarkAllReviewed(
                        activeMaterial.id,
                        !activeMaterial.allReviewed
                      )
                    }
                    className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap ${
                      activeMaterial.allReviewed
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100'
                        : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>
                      {activeMaterial.allReviewed
                        ? 'Tudo revisado'
                        : 'Marcar tudo como revisado'}
                    </span>
                  </button>
                )}

                <button
                  type="button"
                  disabled={busy || needsAuth || !memberScopePreview.input}
                  onClick={() => {
                    if (activeMaterial) {
                      setIsConfirmRegenerateOpen(true);
                    } else {
                      void handleGenerate();
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-700 hover:bg-blue-800 disabled:bg-slate-200 disabled:text-slate-500 text-white text-xs sm:text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Gerando roteiro...</span>
                    </>
                  ) : activeMaterial ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Regenerar material</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Gerar preparação com IA</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {localError && (
              <div
                role="alert"
                className="flex items-start gap-2.5 p-3.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-900"
              >
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{localError}</span>
              </div>
            )}

            {successMessage && (
              <div
                role="status"
                className="flex items-start gap-2.5 p-3.5 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-900"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>{successMessage}</span>
              </div>
            )}

            {/* Resumo exclusivo das seções atribuídas */}
            {memberScopePreview.input ? (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-slate-800">
                    Base exclusiva ({memberScopePreview.input.assignedSections.length}{' '}
                    seção(ões) atribuída(s))
                  </span>
                  <div className="flex items-center gap-3 tabular-nums text-slate-600">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-blue-700" />
                      Tempo calculado:{' '}
                      <strong className="text-slate-900">
                        {formatDurationSecondsPtBr(
                          memberScopePreview.input.calculatedDurationSeconds
                        )}
                      </strong>
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      Meta oral: ~
                      <strong className="text-slate-900">
                        {memberScopePreview.input.totalTargetWordCount} palavras
                      </strong>{' '}
                      (130 pal/min)
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {memberScopePreview.input.assignedSections.map((sec) => (
                    <div
                      key={sec.sectionId}
                      className="p-2.5 bg-white border border-slate-200 rounded-lg text-xs flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 truncate">
                          {sec.order}. {sec.title}
                        </p>
                        <p className="text-slate-500">
                          {formatSourcePagesLabel(sec.sourcePages)}
                        </p>
                      </div>
                      <span className="font-semibold text-blue-700 tabular-nums shrink-0">
                        {formatDurationSecondsPtBr(sec.durationSeconds)}
                      </span>
                    </div>
                  ))}
                </div>

                {activeMaterial && (
                  <div className="pt-2 border-t border-slate-200 flex items-center gap-4">
                    <span className="text-xs font-medium text-slate-600 shrink-0 tabular-nums">
                      Revisão: {reviewedCount}/5 blocos
                    </span>
                    <div className="flex-1">
                      <ProgressBar
                        value={activeReviewPercent}
                        size="sm"
                        showLabel={false}
                      />
                    </div>
                    <span className="text-xs font-semibold text-slate-800 tabular-nums">
                      {activeReviewPercent}%
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-900">
                {memberScopePreview.reason}
              </div>
            )}
          </Card>
        )}

        {/* Conteúdo gerado para o integrante */}
        {!activeMaterial ? (
          memberScopePreview.input && (
            <Card padding="lg" className="text-center space-y-3">
              <BookOpen className="w-8 h-8 text-blue-700 mx-auto" />
              <h4 className="text-base font-semibold text-slate-900">
                Material de preparação ainda não gerado
              </h4>
              <p className="text-sm text-slate-600 max-w-lg mx-auto leading-relaxed">
                Clique em <strong>&ldquo;Gerar preparação com IA&rdquo;</strong>{' '}
                para criar um roteiro oral adequado ao tempo calculado de{' '}
                <strong>
                  {formatDurationSecondsPtBr(
                    memberScopePreview.input.calculatedDurationSeconds
                  )}
                </strong>
                , explicações de conceitos, exemplos práticos, 5 perguntas da
                audiência fundamentadas no documento e transições entre slides.
              </p>
            </Card>
          )
        ) : (
          <Card padding="none" className="overflow-hidden">
            {/* Sub-abas dos 5 blocos de preparação */}
            <div className="px-4 sm:px-5 pt-4 border-b border-slate-200 flex items-center gap-1.5 overflow-x-auto">
              {MATERIAL_TABS.map((tab) => {
                const active = activeSubTab === tab.key;
                const isRev = activeMaterial.reviewedSections[tab.reviewField];
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => {
                      setActiveSubTab(tab.key);
                      setEditingTab(null);
                      setDraftMaterial(null);
                    }}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-t-lg text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                      active
                        ? 'border-blue-700 text-blue-700 bg-blue-50/50'
                        : 'border-transparent text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>{tab.label}</span>
                    {isRev && (
                      <CheckCircle2
                        className="w-3.5 h-3.5 text-emerald-600"
                        aria-label="Revisado"
                      />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="p-5 sm:p-6 space-y-5">
              {/* Barra de ação do bloco atual (Editar + Marcar como revisado) */}
              {(() => {
                const currentTabMeta = MATERIAL_TABS.find(
                  (t) => t.key === activeSubTab
                )!;
                const isSectionReviewed =
                  activeMaterial.reviewedSections[currentTabMeta.reviewField];
                const isEditingThis = editingTab === activeSubTab;

                return (
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {currentTabMeta.label}
                      </p>
                      <p className="text-xs text-slate-500">
                        {activeMaterial.overviewSummary}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {isEditingThis ? (
                        <>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={cancelEditing}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Cancelar</span>
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void saveEditing()}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg"
                          >
                            <Save className="w-3.5 h-3.5" />
                            <span>Salvar alterações</span>
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => startEditing(activeSubTab)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            <span>Editar</span>
                          </button>

                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              void onToggleSectionReviewed(
                                activeMaterial.id,
                                currentTabMeta.reviewField,
                                !isSectionReviewed
                              )
                            }
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                              isSectionReviewed
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100'
                                : 'bg-blue-50 border-blue-200 text-blue-800 hover:bg-blue-100'
                            }`}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>
                              {isSectionReviewed
                                ? 'Revisado'
                                : 'Marcar como revisado'}
                            </span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* 1. Roteiro detalhado */}
              {activeSubTab === 'script' && (
                <div className="space-y-4">
                  {(editingTab === 'script' && draftMaterial
                    ? draftMaterial.detailedScript
                    : activeMaterial.detailedScript
                  ).map((block, idx) => {
                    const actualWords = countWords(block.oralScript);
                    const actualSeconds = estimateOralReadingSeconds(
                      block.oralScript
                    );
                    return (
                      <div
                        key={block.id}
                        className="p-4 sm:p-5 bg-slate-50 border border-slate-200 rounded-xl space-y-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-bold text-slate-900">
                              {block.sectionTitle}
                            </p>
                            <p className="text-xs text-slate-500">
                              {formatSourcePagesLabel(block.sourcePages)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 text-xs tabular-nums">
                            <span className="px-2.5 py-1 bg-white border border-slate-200 rounded-md text-slate-700 font-medium">
                              Meta: {formatDurationSecondsPtBr(block.estimatedSeconds)}{' '}
                              (~{block.targetWordCount} pal.)
                            </span>
                            <span className="px-2.5 py-1 bg-blue-50 border border-blue-200 rounded-md text-blue-800 font-semibold">
                              Atual: {actualWords} pal. (
                              {formatDurationSecondsPtBr(actualSeconds)})
                            </span>
                          </div>
                        </div>

                        {editingTab === 'script' && draftMaterial ? (
                          <div className="space-y-3">
                            <div>
                              <label className="block text-xs font-medium text-slate-700 mb-1">
                                Roteiro de fala (linguagem oral natural)
                              </label>
                              <textarea
                                rows={5}
                                value={block.oralScript}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setDraftMaterial((prev) => {
                                    if (!prev) return prev;
                                    const next = [...prev.detailedScript];
                                    next[idx] = { ...next[idx], oralScript: val };
                                    return { ...prev, detailedScript: next };
                                  });
                                }}
                                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-slate-700 mb-1">
                                Dica de entrega / ritmo
                              </label>
                              <input
                                type="text"
                                value={block.keyDeliveryCue}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setDraftMaterial((prev) => {
                                    if (!prev) return prev;
                                    const next = [...prev.detailedScript];
                                    next[idx] = {
                                      ...next[idx],
                                      keyDeliveryCue: val,
                                    };
                                    return { ...prev, detailedScript: next };
                                  });
                                }}
                                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                              />
                            </div>
                          </div>
                        ) : (
                          <>
                            <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-line">
                              {block.oralScript}
                            </p>
                            <p className="text-xs text-blue-800 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                              <strong>Orientação oral:</strong>{' '}
                              {block.keyDeliveryCue}
                            </p>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* 2. Conceitos técnicos */}
              {activeSubTab === 'concepts' && (
                <div className="space-y-3">
                  {(editingTab === 'concepts' && draftMaterial
                    ? draftMaterial.technicalConcepts
                    : activeMaterial.technicalConcepts
                  ).map((concept, idx) => (
                    <div
                      key={concept.id}
                      className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5"
                    >
                      {editingTab === 'concepts' && draftMaterial ? (
                        <div className="space-y-2.5">
                          <input
                            type="text"
                            value={concept.term}
                            onChange={(e) => {
                              const val = e.target.value;
                              setDraftMaterial((prev) => {
                                if (!prev) return prev;
                                const next = [...prev.technicalConcepts];
                                next[idx] = { ...next[idx], term: val };
                                return { ...prev, technicalConcepts: next };
                              });
                            }}
                            className="w-full px-3 py-1.5 text-sm font-semibold bg-white border border-slate-300 rounded-lg"
                          />
                          <textarea
                            rows={3}
                            value={concept.accessibleExplanation}
                            onChange={(e) => {
                              const val = e.target.value;
                              setDraftMaterial((prev) => {
                                if (!prev) return prev;
                                const next = [...prev.technicalConcepts];
                                next[idx] = {
                                  ...next[idx],
                                  accessibleExplanation: val,
                                };
                                return { ...prev, technicalConcepts: next };
                              });
                            }}
                            className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                          />
                          <input
                            type="text"
                            value={concept.documentBasis}
                            onChange={(e) => {
                              const val = e.target.value;
                              setDraftMaterial((prev) => {
                                if (!prev) return prev;
                                const next = [...prev.technicalConcepts];
                                next[idx] = {
                                  ...next[idx],
                                  documentBasis: val,
                                };
                                return { ...prev, technicalConcepts: next };
                              });
                            }}
                            className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                          />
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="text-sm font-bold text-slate-900">
                              {concept.term}
                            </h4>
                            <span className="text-xs font-medium text-blue-700">
                              {formatSourcePagesLabel(concept.sourcePages)}
                            </span>
                          </div>
                          <p className="text-sm text-slate-700 leading-relaxed">
                            {concept.accessibleExplanation}
                          </p>
                          <p className="text-xs text-slate-500">
                            <strong>Base no documento:</strong>{' '}
                            {concept.documentBasis}
                          </p>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* 3. Exemplos práticos */}
              {activeSubTab === 'examples' && (
                <div className="space-y-3">
                  {(editingTab === 'examples' && draftMaterial
                    ? draftMaterial.practicalExamples
                    : activeMaterial.practicalExamples
                  ).map((example, idx) => (
                    <div
                      key={example.id}
                      className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2"
                    >
                      {editingTab === 'examples' && draftMaterial ? (
                        <div className="space-y-2.5">
                          <input
                            type="text"
                            value={example.title}
                            onChange={(e) => {
                              const val = e.target.value;
                              setDraftMaterial((prev) => {
                                if (!prev) return prev;
                                const next = [...prev.practicalExamples];
                                next[idx] = { ...next[idx], title: val };
                                return { ...prev, practicalExamples: next };
                              });
                            }}
                            className="w-full px-3 py-1.5 text-sm font-semibold bg-white border border-slate-300 rounded-lg"
                          />
                          <textarea
                            rows={3}
                            value={example.explanation}
                            onChange={(e) => {
                              const val = e.target.value;
                              setDraftMaterial((prev) => {
                                if (!prev) return prev;
                                const next = [...prev.practicalExamples];
                                next[idx] = { ...next[idx], explanation: val };
                                return { ...prev, practicalExamples: next };
                              });
                            }}
                            className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                          />
                          <input
                            type="text"
                            value={example.connectionToSection}
                            onChange={(e) => {
                              const val = e.target.value;
                              setDraftMaterial((prev) => {
                                if (!prev) return prev;
                                const next = [...prev.practicalExamples];
                                next[idx] = {
                                  ...next[idx],
                                  connectionToSection: val,
                                };
                                return { ...prev, practicalExamples: next };
                              });
                            }}
                            className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                          />
                        </div>
                      ) : (
                        <>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                              <Lightbulb className="w-4 h-4 text-blue-700 shrink-0" />
                              <span>{example.title}</span>
                            </h4>
                            <span className="text-xs font-medium text-slate-600">
                              {example.originType === 'explicit_from_document'
                                ? 'Exemplo do documento'
                                : 'Ilustração didática'}{' '}
                              · {formatSourcePagesLabel(example.sourcePages)}
                            </span>
                          </div>
                          <p className="text-sm text-slate-700 leading-relaxed">
                            {example.explanation}
                          </p>
                          {example.connectionToSection && (
                            <p className="text-xs text-slate-500">
                              <strong>Conexão com sua fala:</strong>{' '}
                              {example.connectionToSection}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* 4. 5 Perguntas da audiência */}
              {activeSubTab === 'questions' && (
                <div className="space-y-4">
                  {(editingTab === 'questions' && draftMaterial
                    ? draftMaterial.audienceQuestions
                    : activeMaterial.audienceQuestions
                  ).map((qa, idx) => (
                    <div
                      key={qa.id}
                      className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5"
                    >
                      {editingTab === 'questions' && draftMaterial ? (
                        <div className="space-y-2.5">
                          <label className="block text-xs font-semibold text-blue-700">
                            Pergunta {idx + 1}
                          </label>
                          <input
                            type="text"
                            value={qa.question}
                            onChange={(e) => {
                              const val = e.target.value;
                              setDraftMaterial((prev) => {
                                if (!prev) return prev;
                                const next = [...prev.audienceQuestions];
                                next[idx] = { ...next[idx], question: val };
                                return { ...prev, audienceQuestions: next };
                              });
                            }}
                            className="w-full px-3 py-1.5 text-sm font-semibold bg-white border border-slate-300 rounded-lg"
                          />
                          <textarea
                            rows={3}
                            value={qa.answer}
                            onChange={(e) => {
                              const val = e.target.value;
                              setDraftMaterial((prev) => {
                                if (!prev) return prev;
                                const next = [...prev.audienceQuestions];
                                next[idx] = { ...next[idx], answer: val };
                                return { ...prev, audienceQuestions: next };
                              });
                            }}
                            className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                          />
                          <input
                            type="text"
                            value={qa.evidenceFromDocument}
                            onChange={(e) => {
                              const val = e.target.value;
                              setDraftMaterial((prev) => {
                                if (!prev) return prev;
                                const next = [...prev.audienceQuestions];
                                next[idx] = {
                                  ...next[idx],
                                  evidenceFromDocument: val,
                                };
                                return { ...prev, audienceQuestions: next };
                              });
                            }}
                            className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                          />
                        </div>
                      ) : (
                        <>
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="text-sm font-bold text-slate-900 flex items-start gap-2">
                              <HelpCircle className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
                              <span>
                                {idx + 1}. {qa.question}
                              </span>
                            </h4>
                            <span className="text-xs font-medium text-blue-700 shrink-0">
                              {formatSourcePagesLabel(qa.sourcePages)}
                            </span>
                          </div>
                          <p className="text-sm text-slate-800 leading-relaxed">
                            {qa.answer}
                          </p>
                          <p className="text-xs text-slate-600 bg-white border border-slate-200 rounded-lg px-3 py-2">
                            <FileText className="w-3.5 h-3.5 inline mr-1 text-blue-700" />
                            <strong>Fundamentação no documento:</strong>{' '}
                            {qa.evidenceFromDocument}
                          </p>
                          {qa.uncertaintyNote && (
                            <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                              <strong>Limite de cobertura do documento:</strong>{' '}
                              {qa.uncertaintyNote}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* 5. Transições de slides */}
              {activeSubTab === 'transitions' && (
                <div className="space-y-3">
                  {(editingTab === 'transitions' && draftMaterial
                    ? draftMaterial.slideTransitions
                    : activeMaterial.slideTransitions
                  ).map((tr, idx) => (
                    <div
                      key={tr.id}
                      className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2"
                    >
                      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-blue-800">
                        <span>{tr.fromContext}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                        <span>{tr.toContext}</span>
                      </div>

                      {editingTab === 'transitions' && draftMaterial ? (
                        <textarea
                          rows={2}
                          value={tr.suggestedPhrase}
                          onChange={(e) => {
                            const val = e.target.value;
                            setDraftMaterial((prev) => {
                              if (!prev) return prev;
                              const next = [...prev.slideTransitions];
                              next[idx] = {
                                ...next[idx],
                                suggestedPhrase: val,
                              };
                              return { ...prev, slideTransitions: next };
                            });
                          }}
                          className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                        />
                      ) : (
                        <p className="text-sm text-slate-800 leading-relaxed flex items-start gap-2">
                          <MessageSquareQuote className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
                          <span>&ldquo;{tr.suggestedPhrase}&rdquo;</span>
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        )}
      </div>

      {/* Modal de confirmação antes de sobrescrever material já gerado/editado */}
      <Modal
        isOpen={isConfirmRegenerateOpen}
        onClose={() => !isGenerating && setIsConfirmRegenerateOpen(false)}
        title="Regenerar material individual?"
        subtitle="O conteúdo atual será substituído"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-700 leading-relaxed">
            Já existe um material de preparação salvo para{' '}
            <strong>{selectedMember?.name}</strong>. Ao regenerar, eventuais
            edições manuais e marcações de revisão atuais serão substituídas pela
            nova versão gerada com a Gemini API.
          </p>
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              disabled={isGenerating}
              onClick={() => setIsConfirmRegenerateOpen(false)}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={isGenerating}
              onClick={() => void handleGenerate()}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg"
            >
              {isGenerating && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>Confirmar regeneração</span>
            </button>
          </div>
        </div>
      </Modal>
      </div>
    </div>
  );
}
