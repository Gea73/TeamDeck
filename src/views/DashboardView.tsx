import {
  ArrowRight,
  CalendarClock,
  FolderKanban,
  TrendingUp,
  Users,
} from 'lucide-react';
import {
  MemberDirectoryItem,
  NavigationRoute,
  Project,
  ProjectStatus,
  RehearsalSession,
} from '../types';
import { formatDatePtBr } from '../utils/formatters';
import { Card, CardHeader } from '../components/ui/Card';
import { MetricCard } from '../components/ui/MetricCard';
import { ProgressBar } from '../components/ui/ProgressBar';
import { StatusIndicator } from '../components/ui/StatusIndicator';

interface DashboardViewProps {
  projects: Project[];
  members: MemberDirectoryItem[];
  rehearsals: RehearsalSession[];
  onOpenProject: (projectId: string) => void;
  onNavigate: (route: NavigationRoute) => void;
}

export function DashboardView({
  projects,
  members,
  rehearsals,
  onOpenProject,
  onNavigate,
}: DashboardViewProps) {
  const activeProjects = projects.filter(
    (project) => project.status !== ProjectStatus.COMPLETED
  );

  const upcomingPresentations = [...activeProjects].sort((a, b) =>
    a.presentationDate.localeCompare(b.presentationDate)
  );

  const averageTeamProgress =
    activeProjects.length > 0
      ? Math.round(
          activeProjects.reduce((acc, proj) => acc + proj.overallProgress, 0) /
            activeProjects.length
        )
      : 0;

  const nextPresentation = upcomingPresentations[0];

  return (
    <div className="space-y-6">
      <section aria-label="Indicadores principais">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-5">
          <MetricCard
            label="Projetos ativos"
            value={activeProjects.length}
            helperText={`${projects.length} projeto(s) cadastrado(s)`}
            icon={<FolderKanban className="w-5 h-5" />}
          />
          <MetricCard
            label="Integrantes"
            value={members.length}
            helperText={`Atuando em ${activeProjects.length} equipe(s) ativa(s)`}
            icon={<Users className="w-5 h-5" />}
          />
          <MetricCard
            label="Próximas apresentações"
            value={upcomingPresentations.length}
            helperText={
              nextPresentation
                ? `Próxima em ${formatDatePtBr(nextPresentation.presentationDate)}`
                : 'Nenhuma apresentação agendada'
            }
            icon={<CalendarClock className="w-5 h-5" />}
          />
          <MetricCard
            label="Progresso geral das equipes"
            value={`${averageTeamProgress}%`}
            progressPercent={averageTeamProgress}
            helperText="Média consolidada dos projetos em andamento"
            icon={<TrendingUp className="w-5 h-5" />}
          />
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        <Card padding="none" className="xl:col-span-2 overflow-hidden">
          <div className="p-5 sm:p-6 border-b border-slate-200">
            <CardHeader
              title="Projetos recentes"
              subtitle="Acompanhe o andamento das apresentações acadêmicas da sua equipe"
              action={
                <button
                  type="button"
                  onClick={() => onNavigate('projects')}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-700 hover:text-blue-800 whitespace-nowrap shrink-0 transition-colors"
                >
                  <span>Ver todos</span>
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </button>
              }
            />
          </div>

          {projects.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              Nenhum projeto cadastrado ainda. Crie seu primeiro projeto em &ldquo;Meus projetos&rdquo;.
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {projects.slice(0, 5).map((project) => (
                <div
                  key={project.id}
                  className="p-5 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/80 transition-colors"
                >
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <button
                        type="button"
                        onClick={() => onOpenProject(project.id)}
                        className="text-left text-base font-semibold text-slate-900 hover:text-blue-700 transition-colors"
                      >
                        {project.title}
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-500">
                      <span>{project.discipline}</span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">
                        Apresentação: {formatDatePtBr(project.presentationDate)}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">
                        {project.memberCount} integrante(s)
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-5 shrink-0">
                    <div className="w-28 sm:w-32">
                      <ProgressBar
                        value={project.overallProgress}
                        size="sm"
                        showLabel
                      />
                    </div>
                    <div className="w-28 flex justify-end">
                      <StatusIndicator status={project.status} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <div className="space-y-6">
          <Card padding="none" className="overflow-hidden">
            <div className="p-5 sm:p-6 border-b border-slate-200">
              <CardHeader
                title="Próximas apresentações"
                subtitle="Datas confirmadas no calendário"
                action={
                  <button
                    type="button"
                    onClick={() => onNavigate('calendar')}
                    className="text-xs font-medium text-blue-700 hover:text-blue-800 whitespace-nowrap shrink-0"
                  >
                    Calendário
                  </button>
                }
              />
            </div>

            {upcomingPresentations.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-500">
                Nenhuma apresentação pendente.
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {upcomingPresentations.map((project) => (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => onOpenProject(project.id)}
                    className="w-full text-left px-5 sm:px-6 py-4 hover:bg-slate-50 transition-colors flex items-start gap-4"
                  >
                    <div className="w-12 py-1.5 rounded-lg bg-blue-50 border border-blue-100 text-center shrink-0">
                      <span className="block text-[11px] font-medium text-blue-700 uppercase tabular-nums">
                        {new Date(`${project.presentationDate}T12:00:00`).toLocaleDateString(
                          'pt-BR',
                          { month: 'short' }
                        )}
                      </span>
                      <span className="block text-base font-bold text-blue-900 tabular-nums leading-tight">
                        {project.presentationDate.split('-')[2]}
                      </span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {project.title}
                      </p>
                      <p className="mt-1 text-xs text-slate-500 truncate">
                        {project.presentationTime} · {project.location}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </Card>

          <Card padding="md">
            <CardHeader
              title="Progresso das equipes"
              subtitle="Preparação consolidada por grupo"
              className="mb-4"
            />
            {activeProjects.length === 0 ? (
              <p className="text-sm text-slate-500">
                Nenhum projeto ativo para exibir progresso.
              </p>
            ) : (
              <div className="space-y-4">
                {activeProjects.map((project) => (
                  <div key={project.id} className="space-y-1">
                    <ProgressBar
                      value={project.overallProgress}
                      labelText={project.title}
                      size="sm"
                    />
                    <p className="text-xs text-slate-500 tabular-nums">
                      {project.memberCount} integrante(s) ·{' '}
                      {
                        rehearsals.filter((r) => r.projectId === project.id)
                          .length
                      }{' '}
                      ensaio(s) registrado(s)
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
