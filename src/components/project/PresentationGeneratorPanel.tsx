import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  FileText,
  Layers,
  Loader2,
  Presentation,
  RefreshCw,
  UserCheck,
} from 'lucide-react';
import {
  buildMemberInputsFromAssignments,
  buildProjectDistributionInputs,
  calculateDistributionSummary,
  distributeSectionsOptimally,
  formatDurationSecondsPtBr,
} from '../../domain/contentDistribution';
import {
  buildSlideDeckPlan,
  formatSourcePagesLabel,
} from '../../domain/googleSlidesBuilder';
import { sanitizeExternalHttpUrl } from '../../domain/validators';
import {
  fetchBackendGoogleSession,
  subscribeGoogleSession,
} from '../../services/googleAuthService';
import { TeamDeckServiceError } from '../../services/teamDeckService';
import {
  PresentationSlide,
  Project,
  TeamMemberAssignmentView,
} from '../../types';
import { GoogleSessionStatus } from '../../types/workspace';
import { formatDatePtBr } from '../../utils/formatters';
import { generateUniqueId } from '../../utils/id';
import { Card, CardHeader } from '../ui/Card';
import { GoogleAccountBar } from '../ui/GoogleAccountBar';
import { Modal } from '../ui/Modal';

interface PresentationGeneratorPanelProps {
  project: Project;
  projectMembers: TeamMemberAssignmentView[];
  isMutating: boolean;
  onGenerateGoogleSlides: (params: {
    projectId: string;
    approvedSectionIds: string[];
    confirmDuplicate: boolean;
    requestId: string;
  }) => Promise<void>;
}

const LAYOUT_LABELS: Record<
  NonNullable<PresentationSlide['layoutType']>,
  string
> = {
  cover: 'Capa acadêmica',
  section_standard: 'Seção focada',
  section_visual_split: 'Seção com elemento visual',
  section_two_column: 'Seção em duas colunas',
  conclusion: 'Conclusão e referências',
};

export function PresentationGeneratorPanel({
  project,
  projectMembers,
  isMutating,
  onGenerateGoogleSlides,
}: PresentationGeneratorPanelProps) {
  const [selectedSlideIndex, setSelectedSlideIndex] = useState(0);

  // Estado de sessão Google (armazenado de forma cifrada no backend)
  const [googleSession, setGoogleSession] = useState<GoogleSessionStatus>({
    connected: false,
    email: null,
    displayName: null,
    expiresAt: null,
    isExpired: false,
    scopes: [],
  });
  const needsAuth = !googleSession.connected || googleSession.isExpired;

  // Estado de geração e aprovação de seções
  const [isGenerating, setIsGenerating] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [isConfirmDuplicateOpen, setIsConfirmDuplicateOpen] = useState(false);

  const { sections, initialAssignments } = useMemo(
    () => buildProjectDistributionInputs(project),
    [project]
  );

  const memberInputs = useMemo(
    () => buildMemberInputsFromAssignments(projectMembers),
    [projectMembers]
  );

  const effectiveDistribution = useMemo(() => {
    if (sections.length === 0) {
      return calculateDistributionSummary([], memberInputs, {});
    }
    const allAssigned = sections.every((s) => Boolean(initialAssignments[s.id]));
    if (memberInputs.length > 0 && !allAssigned) {
      return distributeSectionsOptimally(sections, memberInputs).summary;
    }
    return calculateDistributionSummary(
      sections,
      memberInputs,
      initialAssignments
    );
  }, [sections, memberInputs, initialAssignments]);

  const [approvedSectionIds, setApprovedSectionIds] = useState<string[]>(() =>
    sections.map((s) => s.id)
  );

  // Sincronizar seleção padrão quando o conjunto de seções do projeto mudar
  useEffect(() => {
    const validIds = new Set(sections.map((s) => s.id));
    setApprovedSectionIds((prev) => {
      const kept = prev.filter((id) => validIds.has(id));
      if (kept.length > 0) return kept;
      return sections.map((s) => s.id);
    });
  }, [sections]);

  useEffect(() => {
    const unsubscribe = subscribeGoogleSession(setGoogleSession);
    void fetchBackendGoogleSession();
    return () => unsubscribe();
  }, []);

  const deckPreviewEstimate = useMemo(() => {
    if (approvedSectionIds.length === 0 || effectiveDistribution.sections.length === 0) {
      return null;
    }
    try {
      return buildSlideDeckPlan({
        projectId: project.id,
        projectTitle: project.title,
        projectDescription: project.description,
        discipline: project.discipline,
        institution: project.institution,
        advisor: project.advisor,
        presentationDate: project.presentationDate,
        presentationTime: project.presentationTime,
        location: project.location,
        memberNames: projectMembers.map((m) => m.name),
        pdfFileName: project.pdfDocument?.fileName ?? null,
        pdfAnalysis: project.pdfDocument?.analysis ?? null,
        distributionSummary: effectiveDistribution,
        approvedSectionIds,
      });
    } catch {
      return null;
    }
  }, [approvedSectionIds, effectiveDistribution, project, projectMembers]);

  const activeSlide =
    project.slides[selectedSlideIndex] ?? project.slides[0] ?? null;

  const toggleSectionApproval = (sectionId: string) => {
    setApprovedSectionIds((prev) =>
      prev.includes(sectionId)
        ? prev.filter((id) => id !== sectionId)
        : [...prev, sectionId]
    );
  };

  const executeGeneration = async (confirmDuplicate: boolean) => {
    if (needsAuth) {
      setLocalError(
        'Conecte (ou renove) sua conta Google antes de gerar a apresentação no Google Slides.'
      );
      return;
    }

    if (approvedSectionIds.length === 0) {
      setLocalError(
        'Aprove pelo menos uma seção do documento para gerar os slides.'
      );
      return;
    }

    setIsGenerating(true);
    setLocalError(null);
    setSuccessMessage(null);

    const requestId = generateUniqueId('slides_req');

    try {
      await onGenerateGoogleSlides({
        projectId: project.id,
        approvedSectionIds,
        confirmDuplicate,
        requestId,
      });
      setSelectedSlideIndex(0);
      setSuccessMessage(
        'Apresentação gerada e salva com sucesso no Google Slides!'
      );
      setIsConfirmDuplicateOpen(false);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Erro ao gerar a apresentação no Google Slides.';
      const code =
        err instanceof TeamDeckServiceError ? err.code : undefined;
      if (
        code === 'GOOGLE_TOKEN_EXPIRED' ||
        code === 'GOOGLE_NOT_CONNECTED' ||
        message.toLowerCase().includes('expirada') ||
        message.toLowerCase().includes('inválido') ||
        message.toLowerCase().includes('autorização')
      ) {
        void fetchBackendGoogleSession();
      }
      setLocalError(message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRequestGenerate = () => {
    setLocalError(null);
    setSuccessMessage(null);

    if (needsAuth) {
      setLocalError(
        'Conecte sua conta Google acima antes de gerar a apresentação.'
      );
      return;
    }

    if (approvedSectionIds.length === 0) {
      setLocalError(
        'Selecione pelo menos uma seção aprovada para incluir na apresentação.'
      );
      return;
    }

    if (project.googlePresentation?.presentationId) {
      setIsConfirmDuplicateOpen(true);
      return;
    }

    void executeGeneration(false);
  };

  const handleCopyUrl = async () => {
    if (!project.googlePresentation?.presentationUrl) return;
    try {
      await navigator.clipboard.writeText(
        project.googlePresentation.presentationUrl
      );
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2500);
    } catch {
      setLocalError('Não foi possível copiar o link automaticamente.');
    }
  };

  const busy = isGenerating || isMutating;

  return (
    <div className="space-y-6">
      {/* Cartão principal de conexão Google Slides e geração */}
      <Card padding="md" className="space-y-5">
        <CardHeader
          title="Geração automática no Google Slides"
          subtitle="Transforme as seções aprovadas em slides 16:9 editáveis com roteiro de fala nas notas do apresentador"
        />

        {localError && (
          <div
            role="alert"
            className="flex items-start gap-2.5 p-3.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-900"
          >
            <AlertCircle
              className="w-4 h-4 text-red-600 shrink-0 mt-0.5"
              aria-hidden="true"
            />
            <span>{localError}</span>
          </div>
        )}

        {successMessage && (
          <div
            role="status"
            className="flex items-start gap-2.5 p-3.5 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-900"
          >
            <CheckCircle2
              className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5"
              aria-hidden="true"
            />
            <span>{successMessage}</span>
          </div>
        )}

        <GoogleAccountBar
          purposeLabel="exportar para o Google Slides"
          compact
          onSessionChange={setGoogleSession}
        />

        {/* Apresentação já vinculada ao projeto */}
        {project.googlePresentation && (
          <div className="p-4 sm:p-5 bg-blue-50/70 border border-blue-200 rounded-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1.5 min-w-0">
              <div className="flex items-center gap-2 text-xs font-semibold text-blue-800">
                <CheckCircle2 className="w-4 h-4 text-blue-700 shrink-0" />
                <span>Apresentação vinculada no Google Slides</span>
              </div>
              <p className="text-sm sm:text-base font-bold text-slate-900 truncate">
                {project.googlePresentation.title}
              </p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600 tabular-nums">
                <span>
                  ID:{' '}
                  <code className="font-mono text-slate-800 bg-white px-1.5 py-0.5 rounded border border-blue-200">
                    {project.googlePresentation.presentationId}
                  </code>
                </span>
                <span aria-hidden="true">·</span>
                <span>{project.googlePresentation.slideCount} slide(s)</span>
                <span aria-hidden="true">·</span>
                <span>
                  Gerada em{' '}
                  {formatDatePtBr(
                    project.googlePresentation.generatedAt.slice(0, 10)
                  )}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleCopyUrl}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-xs font-medium rounded-lg transition-colors whitespace-nowrap"
              >
                {copiedUrl ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Link copiado</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copiar URL</span>
                  </>
                )}
              </button>

              {sanitizeExternalHttpUrl(
                project.googlePresentation.presentationUrl
              ) && (
                <a
                  href={sanitizeExternalHttpUrl(
                    project.googlePresentation.presentationUrl
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs sm:text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
                >
                  <span>Abrir no Google Slides</span>
                  <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                </a>
              )}
            </div>
          </div>
        )}

        {/* Seleção de seções aprovadas para geração */}
        {sections.length === 0 ? (
          <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl text-center space-y-2">
            <FileText
              className="w-7 h-7 text-slate-400 mx-auto"
              aria-hidden="true"
            />
            <p className="text-sm font-semibold text-slate-900">
              Nenhuma seção disponível para gerar os slides
            </p>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Envie e processe um documento PDF na aba &ldquo;Documento PDF&rdquo; e
              revise a divisão de conteúdo antes de gerar a apresentação no Google
              Slides.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Seções aprovadas para a apresentação
                </h3>
                <p className="text-xs text-slate-500">
                  {approvedSectionIds.length} de {sections.length} seção(ões)
                  selecionada(s)
                  {deckPreviewEstimate
                    ? ` · ${deckPreviewEstimate.slides.length} slides previstos (capa + conteúdo + conclusão) · ${deckPreviewEstimate.totalDurationLabel}`
                    : ''}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setApprovedSectionIds(sections.map((s) => s.id))
                  }
                  disabled={busy}
                  className="text-xs font-medium text-blue-700 hover:underline px-2 py-1"
                >
                  Selecionar todas
                </button>
                <span className="text-slate-300" aria-hidden="true">
                  |
                </span>
                <button
                  type="button"
                  onClick={() => setApprovedSectionIds([])}
                  disabled={busy}
                  className="text-xs font-medium text-slate-600 hover:underline px-2 py-1"
                >
                  Limpar
                </button>
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl divide-y divide-slate-200 max-h-72 overflow-y-auto">
              {effectiveDistribution.sections.map((sec) => {
                const checked = approvedSectionIds.includes(sec.id);
                return (
                  <label
                    key={sec.id}
                    className={`flex items-start sm:items-center justify-between gap-3 px-4 py-3 cursor-pointer transition-colors ${
                      checked ? 'bg-white' : 'bg-slate-50/70 opacity-75'
                    }`}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={busy}
                        onChange={() => toggleSectionApproval(sec.id)}
                        className="mt-1 sm:mt-0 w-4 h-4 accent-blue-700 rounded border-slate-300"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">
                          {sec.order}. {sec.title}
                        </p>
                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-slate-500 mt-0.5">
                          <span className="inline-flex items-center gap-1">
                            <UserCheck className="w-3 h-3 text-blue-700" />
                            {sec.assignedMemberName || 'Integrante a definir'}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{formatSourcePagesLabel(sec.sourcePages)}</span>
                          {sec.visualElementCount > 0 && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="text-blue-700 font-medium">
                                {sec.visualElementCount} elemento(s) visual(is)
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 tabular-nums shrink-0">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      {formatDurationSecondsPtBr(sec.durationSeconds)}
                    </span>
                  </label>
                );
              })}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Layers className="w-4 h-4 text-blue-700 shrink-0" />
                <span>
                  Inclui capa, slides balanceados por seção (sem excesso de texto),
                  notas do apresentador com discurso e transição, e slide final de
                  conclusão.
                </span>
              </div>

              <button
                type="button"
                onClick={handleRequestGenerate}
                disabled={
                  busy || needsAuth || approvedSectionIds.length === 0
                }
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-700 hover:bg-blue-800 disabled:bg-slate-200 disabled:text-slate-500 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Gerando no Google Slides...</span>
                  </>
                ) : project.googlePresentation ? (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    <span>Gerar nova versão</span>
                  </>
                ) : (
                  <>
                    <Presentation className="w-4 h-4" />
                    <span>Gerar apresentação no Google Slides</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* Pré-visualização do roteiro e notas do apresentador */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <Card padding="none" className="overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-200">
            <CardHeader
              title="Roteiro de slides"
              subtitle={`${project.slides.length} slide(s) estruturado(s)`}
            />
          </div>

          {project.slides.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-500">
              Nenhum slide estruturado ainda. Gere a apresentação acima para
              visualizar o roteiro completo.
            </div>
          ) : (
            <div className="divide-y divide-slate-200 max-h-[540px] overflow-y-auto">
              {project.slides.map((slide, index) => {
                const selected = index === selectedSlideIndex;
                return (
                  <button
                    key={slide.id}
                    type="button"
                    onClick={() => setSelectedSlideIndex(index)}
                    className={`w-full text-left px-5 py-3.5 transition-colors flex items-start justify-between gap-3 ${
                      selected ? 'bg-blue-50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="min-w-0">
                      <p
                        className={`text-xs font-semibold tabular-nums ${
                          selected ? 'text-blue-700' : 'text-slate-500'
                        }`}
                      >
                        Slide {String(slide.slideNumber).padStart(2, '0')}
                        {slide.layoutType
                          ? ` · ${LAYOUT_LABELS[slide.layoutType]}`
                          : ''}
                      </p>
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {slide.title}
                      </p>
                      <p className="text-xs text-slate-500 truncate">
                        {slide.assignedMemberName}
                      </p>
                    </div>
                    <span className="text-xs font-medium text-slate-600 tabular-nums shrink-0">
                      {slide.durationSeconds
                        ? formatDurationSecondsPtBr(slide.durationSeconds)
                        : `${slide.durationMinutes} min`}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </Card>

        <Card padding="lg" className="lg:col-span-2">
          {activeSlide ? (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-200">
                <div className="flex items-center gap-2 text-xs font-semibold text-blue-700">
                  <Presentation className="w-4 h-4" aria-hidden="true" />
                  <span className="tabular-nums">
                    Slide {activeSlide.slideNumber} de {project.slides.length}
                  </span>
                  {activeSlide.layoutType && (
                    <span className="text-slate-500 font-normal">
                      · {LAYOUT_LABELS[activeSlide.layoutType]}
                    </span>
                  )}
                </div>
                <span className="text-xs text-slate-500 tabular-nums">
                  Responsável: {activeSlide.assignedMemberName} ·{' '}
                  {activeSlide.durationSeconds
                    ? formatDurationSecondsPtBr(activeSlide.durationSeconds)
                    : `${activeSlide.durationMinutes} min`}
                </span>
              </div>

              <div className="p-6 sm:p-8 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
                <div className="space-y-1">
                  {activeSlide.sourcePages &&
                    activeSlide.sourcePages.length > 0 && (
                      <p className="text-xs font-semibold text-blue-700">
                        {formatSourcePagesLabel(activeSlide.sourcePages)}
                      </p>
                    )}
                  <h3 className="text-xl sm:text-2xl font-bold text-slate-900">
                    {activeSlide.title}
                  </h3>
                  <p className="text-sm text-blue-700 font-medium">
                    {activeSlide.subtitle}
                  </p>
                </div>

                <div
                  className={
                    activeSlide.visualCallouts &&
                    activeSlide.visualCallouts.length > 0
                      ? 'grid grid-cols-1 md:grid-cols-5 gap-4 pt-2'
                      : 'pt-2'
                  }
                >
                  <ul
                    className={`space-y-2.5 ${
                      activeSlide.visualCallouts &&
                      activeSlide.visualCallouts.length > 0
                        ? 'md:col-span-3'
                        : ''
                    }`}
                  >
                    {activeSlide.bulletPoints.map((point, idx) => (
                      <li
                        key={`${activeSlide.id}_bp_${idx}`}
                        className="flex items-start gap-2.5 text-sm sm:text-base text-slate-700"
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full bg-blue-700 mt-2 shrink-0"
                          aria-hidden="true"
                        />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>

                  {activeSlide.visualCallouts &&
                    activeSlide.visualCallouts.length > 0 && (
                      <div className="md:col-span-2 p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
                        <p className="text-xs font-semibold text-blue-800 uppercase tracking-wide">
                          {activeSlide.layoutType === 'conclusion'
                            ? 'Referências do documento'
                            : 'Elementos visuais originais'}
                        </p>
                        <ul className="space-y-2 text-xs text-slate-700">
                          {activeSlide.visualCallouts.map((callout, idx) => (
                            <li key={`${activeSlide.id}_vis_${idx}`}>
                              {callout}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                </div>
              </div>

              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <BookOpen
                    className="w-3.5 h-3.5 text-blue-700"
                    aria-hidden="true"
                  />
                  <span>Notas do apresentador</span>
                </p>
                <pre className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap font-sans bg-slate-50 border border-slate-200 rounded-lg p-4">
                  {activeSlide.speakerNotes}
                </pre>
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-sm text-slate-500">
              Selecione ou gere os slides deste projeto para pré-visualização.
            </div>
          )}
        </Card>
      </div>

      {/* Modal obrigatório de confirmação antes de gerar nova versão */}
      <Modal
        isOpen={isConfirmDuplicateOpen}
        onClose={() => !isGenerating && setIsConfirmDuplicateOpen(false)}
        title="Gerar nova apresentação no Google Slides?"
        subtitle="Confirmação necessária para evitar apresentações duplicadas"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-700 leading-relaxed">
            Este projeto já está vinculado à apresentação{' '}
            <strong className="text-slate-900">
              {project.googlePresentation?.title}
            </strong>{' '}
            (ID:{' '}
            <code className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">
              {project.googlePresentation?.presentationId}
            </code>
            ).
          </p>
          <p className="text-sm text-slate-600 leading-relaxed">
            Ao confirmar, uma <strong>nova apresentação</strong> com{' '}
            {deckPreviewEstimate?.slides.length ?? approvedSectionIds.length + 2}{' '}
            slides será criada na sua conta Google e o vínculo salvo no TeamDeck
            será atualizado para a nova URL. A versão anterior permanecerá intacta
            no seu Google Drive.
          </p>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              disabled={isGenerating}
              onClick={() => setIsConfirmDuplicateOpen(false)}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={isGenerating}
              onClick={() => void executeGeneration(true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 rounded-lg transition-colors"
            >
              {isGenerating && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>Confirmar nova geração</span>
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
