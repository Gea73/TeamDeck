import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  FileText,
  Scale,
  SlidersHorizontal,
  Users,
} from 'lucide-react';
import {
  buildMemberInputsFromAssignments,
  buildProjectDistributionInputs,
  calculateDistributionSummary,
  formatDurationSecondsPtBr,
  SPEAKING_WORDS_PER_MINUTE,
  VISUAL_ELEMENT_EXTRA_SECONDS,
} from '../../domain/contentDistribution';
import { Project, TeamMemberAssignmentView } from '../../types';
import { getInitials } from '../../utils/formatters';
import { Card, CardHeader } from '../ui/Card';
import { ProgressBar } from '../ui/ProgressBar';

interface ContentDistributionPanelProps {
  project: Project;
  projectMembers: TeamMemberAssignmentView[];
  isMutating: boolean;
  onAutoDistribute: (projectId: string) => Promise<void>;
  onReassignSection: (
    projectId: string,
    sectionId: string,
    memberId: string
  ) => Promise<void>;
}

export function ContentDistributionPanel({
  project,
  projectMembers,
  isMutating,
  onAutoDistribute,
  onReassignSection,
}: ContentDistributionPanelProps) {
  const { sections, initialAssignments } =
    buildProjectDistributionInputs(project);
  const memberInputs = buildMemberInputsFromAssignments(projectMembers);

  const summary = calculateDistributionSummary(
    sections,
    memberInputs,
    initialAssignments
  );

  const longestMember =
    summary.memberSummaries.length > 0
      ? summary.memberSummaries.reduce((a, b) =>
          b.totalSeconds > a.totalSeconds ? b : a
        )
      : null;

  const shortestMember =
    summary.memberSummaries.length > 0
      ? summary.memberSummaries.reduce((a, b) =>
          b.totalSeconds < a.totalSeconds ? b : a
        )
      : null;

  const hasUnassignedSections = summary.sections.some(
    (s) => !s.assignedMemberId
  );

  return (
    <div className="space-y-6">
      {/* Resumo de tempos e diferença entre integrantes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card padding="md">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-medium text-slate-500">
                Tempo total estimado
              </p>
              <p className="mt-1.5 text-2xl font-semibold text-slate-900 tabular-nums">
                {formatDurationSecondsPtBr(summary.totalDurationSeconds)}
              </p>
            </div>
            <Clock className="w-5 h-5 text-blue-700 shrink-0" aria-hidden="true" />
          </div>
          <p className="mt-3 text-xs text-slate-500 tabular-nums">
            {summary.totalWords} palavras · {summary.totalUniqueVisualElements}{' '}
            elemento(s) visual(is) único(s)
          </p>
        </Card>

        <Card padding="md">
          <p className="text-xs font-medium text-slate-500">
            Maior tempo individual
          </p>
          <p className="mt-1.5 text-2xl font-semibold text-slate-900 tabular-nums">
            {formatDurationSecondsPtBr(summary.maxMemberSeconds)}
          </p>
          <p className="mt-3 text-xs text-slate-500 truncate">
            {longestMember ? longestMember.name : 'Sem integrante associado'}
          </p>
        </Card>

        <Card padding="md">
          <p className="text-xs font-medium text-slate-500">
            Menor tempo individual
          </p>
          <p className="mt-1.5 text-2xl font-semibold text-slate-900 tabular-nums">
            {formatDurationSecondsPtBr(summary.minMemberSeconds)}
          </p>
          <p className="mt-3 text-xs text-slate-500 truncate">
            {shortestMember ? shortestMember.name : 'Sem integrante associado'}
          </p>
        </Card>

        <Card padding="md">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-medium text-slate-500">
                Diferença (máx − mín)
              </p>
              <p className="mt-1.5 text-2xl font-semibold text-blue-700 tabular-nums">
                {formatDurationSecondsPtBr(summary.durationDifferenceSeconds)}
              </p>
            </div>
            <Scale className="w-5 h-5 text-blue-700 shrink-0" aria-hidden="true" />
          </div>
          <p className="mt-3 text-xs text-slate-600 flex items-center gap-1.5">
            {summary.preservesLogicalSequence ? (
              <>
                <CheckCircle2
                  className="w-3.5 h-3.5 text-emerald-600 shrink-0"
                  aria-hidden="true"
                />
                <span>Sequência lógica preservada</span>
              </>
            ) : (
              <>
                <AlertTriangle
                  className="w-3.5 h-3.5 text-amber-600 shrink-0"
                  aria-hidden="true"
                />
                <span>Alteração manual fora de bloco contíguo</span>
              </>
            )}
          </p>
        </Card>
      </div>

      {/* Barra de ação e parâmetros determinísticos */}
      <Card padding="md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-slate-900">
              Parâmetros de cálculo e distribuição
            </h3>
            <p className="text-xs text-slate-600 tabular-nums">
              Velocidade base de {SPEAKING_WORDS_PER_MINUTE} palavras/minuto · +
              {VISUAL_ELEMENT_EXTRA_SECONDS} segundos por elemento visual único
              {project.pdfDocument?.analysis
                ? ' · Fonte: seções extraídas do PDF'
                : ' · Fonte: seções cadastradas no projeto'}
            </p>
          </div>

          <button
            type="button"
            disabled={
              isMutating ||
              summary.sections.length === 0 ||
              memberInputs.length === 0
            }
            onClick={() => void onAutoDistribute(project.id)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-800 disabled:bg-slate-200 disabled:text-slate-500 text-white text-xs sm:text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <SlidersHorizontal className="w-4 h-4" aria-hidden="true" />
            <span>Distribuir automaticamente</span>
          </button>
        </div>

        {memberInputs.length === 0 && (
          <div className="mt-4 p-3.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-center gap-2">
            <Users className="w-4 h-4 text-amber-700 shrink-0" aria-hidden="true" />
            <span>
              Associe integrantes ao projeto na aba <strong>Integrantes</strong>{' '}
              para distribuir as seções entre a equipe.
            </span>
          </div>
        )}

        {memberInputs.length > 0 && hasUnassignedSections && (
          <div className="mt-4 p-3.5 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900">
            Há seções ainda sem integrante definido. Clique em{' '}
            <strong>Distribuir automaticamente</strong> ou selecione manualmente o
            responsável em cada seção abaixo.
          </div>
        )}
      </Card>

      {/* Tempo individual por integrante */}
      {summary.memberSummaries.length > 0 && (
        <Card padding="none" className="overflow-hidden">
          <div className="p-5 sm:p-6 border-b border-slate-200">
            <CardHeader
              title="Tempo individual por integrante"
              subtitle="Totais recalculados automaticamente conforme a divisão das seções"
            />
          </div>

          <div className="divide-y divide-slate-200">
            {summary.memberSummaries.map((member) => (
              <div
                key={member.memberId}
                className="p-5 sm:px-6 grid grid-cols-1 md:grid-cols-12 gap-4 items-center"
              >
                <div className="md:col-span-5 flex items-center gap-3 min-w-0">
                  <span className="w-9 h-9 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold flex items-center justify-center shrink-0">
                    {getInitials(member.name)}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">
                      {member.name}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {member.role}
                    </p>
                  </div>
                </div>

                <div className="md:col-span-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 tabular-nums">
                  <span>{member.sectionCount} seção(ões)</span>
                  <span>{member.totalWords} palavras</span>
                  <span>{member.totalVisualElements} visual(is)</span>
                </div>

                <div className="md:col-span-2 text-left md:text-right">
                  <span className="text-sm font-semibold text-slate-900 tabular-nums">
                    {formatDurationSecondsPtBr(member.totalSeconds)}
                  </span>
                </div>

                <div className="md:col-span-2">
                  <ProgressBar value={member.percentageOfTotal} size="sm" />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Lista de seções em sequência lógica com alteração manual */}
      <Card padding="none" className="overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-slate-200">
          <CardHeader
            title="Divisão de conteúdo em sequência lógica"
            subtitle="Altere manualmente o integrante responsável por qualquer seção para recalcular os tempos"
          />
        </div>

        {summary.sections.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            Nenhuma seção disponível. Envie e processe um documento PDF na aba{' '}
            <strong>Documento PDF</strong> para gerar as seções automaticamente.
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {summary.sections.map((section) => (
              <div
                key={section.id}
                className="p-5 sm:px-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
              >
                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 tabular-nums">
                    <span className="font-semibold text-blue-700">
                      Ordem {String(section.order).padStart(2, '0')}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono">{section.id}</span>
                    {section.sourcePages.length > 0 && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>Pág. {section.sourcePages.join(', ')}</span>
                      </>
                    )}
                  </div>

                  <h4 className="text-base font-semibold text-slate-900">
                    {section.title}
                  </h4>

                  <p className="text-sm text-slate-600 line-clamp-2">
                    {section.summary}
                  </p>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 tabular-nums pt-0.5">
                    <span className="inline-flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                      {section.wordCount} palavras (
                      {formatDurationSecondsPtBr(section.speakingSeconds)})
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Eye className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                      {section.visualElementCount} elemento(s) visual(is) (+
                      {Math.round(section.visualSeconds)}s)
                    </span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5 shrink-0">
                  <div className="text-left sm:text-right tabular-nums">
                    <p className="text-xs text-slate-500">Tempo estimado</p>
                    <p className="text-sm font-semibold text-slate-900">
                      {formatDurationSecondsPtBr(section.durationSeconds)}
                    </p>
                  </div>

                  <div className="w-full sm:w-56">
                    <label
                      htmlFor={`assign-${section.id}`}
                      className="sr-only"
                    >
                      Responsável por {section.title}
                    </label>
                    <select
                      id={`assign-${section.id}`}
                      disabled={isMutating || memberInputs.length === 0}
                      value={section.assignedMemberId ?? ''}
                      onChange={(e) => {
                        if (e.target.value) {
                          void onReassignSection(
                            project.id,
                            section.id,
                            e.target.value
                          );
                        }
                      }}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-blue-700 focus:ring-1 focus:ring-blue-700 disabled:bg-slate-100"
                    >
                      <option value="" disabled>
                        Selecionar integrante...
                      </option>
                      {memberInputs.map((member) => (
                        <option key={member.memberId} value={member.memberId}>
                          {member.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
