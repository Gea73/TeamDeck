import { useState } from 'react';
import {
  Calendar,
  CalendarClock,
  ChevronRight,
  Pencil,
  Plus,
  Search,
  Trash2,
  Users,
} from 'lucide-react';
import { CreateProjectInput, Project, ProjectStatus } from '../types';
import { formatDatePtBr } from '../utils/formatters';
import { Card } from '../components/ui/Card';
import { ConfirmDeleteModal } from '../components/ui/ConfirmDeleteModal';
import { PresentationDateModal } from '../components/ui/PresentationDateModal';
import { ProgressBar } from '../components/ui/ProgressBar';
import { ProjectFormModal } from '../components/ui/ProjectFormModal';
import { StatusIndicator } from '../components/ui/StatusIndicator';

interface ProjectsViewProps {
  projects: Project[];
  isMutating: boolean;
  onOpenProject: (projectId: string) => void;
  onCreateProject: (payload: CreateProjectInput) => Promise<void>;
  onUpdateProject: (id: string, payload: CreateProjectInput) => Promise<void>;
  onDeleteProject: (projectId: string) => Promise<void>;
  onSetPresentationDate: (
    projectId: string,
    date: string,
    time: string,
    location: string
  ) => Promise<void>;
  isCreateModalOpen: boolean;
  onOpenCreateModal: () => void;
  onCloseCreateModal: () => void;
}

const STATUS_FILTERS: Array<'Todos' | ProjectStatus> = [
  'Todos',
  ProjectStatus.PLANNING,
  ProjectStatus.IN_PROGRESS,
  ProjectStatus.REHEARSING,
  ProjectStatus.COMPLETED,
];

export function ProjectsView({
  projects,
  isMutating,
  onOpenProject,
  onCreateProject,
  onUpdateProject,
  onDeleteProject,
  onSetPresentationDate,
  isCreateModalOpen,
  onOpenCreateModal,
  onCloseCreateModal,
}: ProjectsViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'Todos' | ProjectStatus>(
    'Todos'
  );

  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [schedulingProject, setSchedulingProject] = useState<Project | null>(
    null
  );
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);

  const filteredProjects = projects.filter((project) => {
    const matchesStatus =
      statusFilter === 'Todos' || project.status === statusFilter;
    const query = searchQuery.trim().toLowerCase();
    const matchesQuery =
      !query ||
      project.title.toLowerCase().includes(query) ||
      project.description.toLowerCase().includes(query) ||
      project.discipline.toLowerCase().includes(query);
    return matchesStatus && matchesQuery;
  });

  const handleProjectFormSubmit = async (
    values: CreateProjectInput,
    editingId?: string
  ) => {
    if (editingId) {
      await onUpdateProject(editingId, values);
    } else {
      await onCreateProject(values);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingProject) return;
    await onDeleteProject(deletingProject.id);
    setDeletingProject(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search
              className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar projeto ou disciplina..."
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-700 focus:ring-1 focus:ring-blue-700"
            />
          </div>

          <div
            className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto"
            role="tablist"
            aria-label="Filtrar projetos por status"
          >
            {STATUS_FILTERS.map((filterOption) => {
              const active = statusFilter === filterOption;
              return (
                <button
                  key={filterOption}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setStatusFilter(filterOption)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-white text-blue-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {filterOption}
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setEditingProject(null);
            onOpenCreateModal();
          }}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          <span>Criar novo projeto</span>
        </button>
      </div>

      {filteredProjects.length === 0 ? (
        <Card padding="lg" className="text-center">
          <p className="text-base font-semibold text-slate-900">
            Nenhum projeto encontrado
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Ajuste os filtros de busca ou crie um novo projeto acadêmico para começar.
          </p>
          <button
            type="button"
            onClick={() => {
              setEditingProject(null);
              onOpenCreateModal();
            }}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>Criar novo projeto</span>
          </button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredProjects.map((project) => (
            <Card
              key={project.id}
              padding="md"
              className="flex flex-col justify-between hover:border-blue-300 transition-colors"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <p className="text-xs font-medium text-blue-700 truncate">
                    {project.discipline}
                  </p>
                  <StatusIndicator status={project.status} />
                </div>

                <h2 className="mt-2 text-lg font-semibold text-slate-900 leading-snug">
                  <button
                    type="button"
                    onClick={() => onOpenProject(project.id)}
                    className="text-left hover:text-blue-700 transition-colors"
                  >
                    {project.title}
                  </button>
                </h2>

                <p className="mt-2 text-sm text-slate-600 line-clamp-2 leading-relaxed">
                  {project.description}
                </p>
              </div>

              <div className="mt-5 pt-4 border-t border-slate-200 space-y-4">
                <ProgressBar value={project.overallProgress} size="sm" />

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-4 text-xs text-slate-600 tabular-nums">
                    <span className="inline-flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                      <span>
                        {formatDatePtBr(project.presentationDate)} ·{' '}
                        {project.presentationTime}
                      </span>
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                      <span>{project.memberCount} integrante(s)</span>
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setSchedulingProject(project)}
                      title="Definir data da apresentação"
                      aria-label={`Definir data da apresentação de ${project.title}`}
                      className="p-2 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <CalendarClock className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingProject(project)}
                      title="Editar projeto"
                      aria-label={`Editar projeto ${project.title}`}
                      className="p-2 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingProject(project)}
                      title="Excluir projeto"
                      aria-label={`Excluir projeto ${project.title}`}
                      className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenProject(project.id)}
                      className="inline-flex items-center gap-1 pl-2 text-sm font-medium text-blue-700 hover:text-blue-800 whitespace-nowrap transition-colors"
                    >
                      <span>Abrir</span>
                      <ChevronRight className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <ProjectFormModal
        isOpen={isCreateModalOpen || Boolean(editingProject)}
        editingProject={editingProject}
        isSubmitting={isMutating}
        onSubmit={handleProjectFormSubmit}
        onClose={() => {
          setEditingProject(null);
          onCloseCreateModal();
        }}
      />

      <PresentationDateModal
        isOpen={Boolean(schedulingProject)}
        project={schedulingProject}
        isSubmitting={isMutating}
        onSubmit={onSetPresentationDate}
        onClose={() => setSchedulingProject(null)}
      />

      <ConfirmDeleteModal
        isOpen={Boolean(deletingProject)}
        title="Excluir projeto"
        description={
          deletingProject
            ? `Tem certeza de que deseja excluir o projeto "${deletingProject.title}"? Os vínculos de integrantes e ensaios deste projeto também serão removidos.`
            : ''
        }
        confirmLabel="Excluir projeto"
        isSubmitting={isMutating}
        onConfirm={handleConfirmDelete}
        onClose={() => setDeletingProject(null)}
      />
    </div>
  );
}
