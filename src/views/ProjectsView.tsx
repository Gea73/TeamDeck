import React, { useState } from 'react';
import { Calendar, ChevronRight, Plus, Search, Users } from 'lucide-react';
import { CreateProjectPayload, Project, ProjectStatus } from '../types';
import { formatDatePtBr } from '../utils/formatters';
import { Card } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { ProgressBar } from '../components/ui/ProgressBar';
import { StatusIndicator } from '../components/ui/StatusIndicator';

interface ProjectsViewProps {
  projects: Project[];
  onOpenProject: (projectId: string) => void;
  onCreateProject: (payload: CreateProjectPayload) => void;
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
  onOpenProject,
  onCreateProject,
  isCreateModalOpen,
  onOpenCreateModal,
  onCloseCreateModal,
}: ProjectsViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'Todos' | ProjectStatus>('Todos');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [presentationDate, setPresentationDate] = useState('2026-12-05');
  const [memberCount, setMemberCount] = useState(4);
  const [status, setStatus] = useState<ProjectStatus>(ProjectStatus.PLANNING);
  const [discipline, setDiscipline] = useState('');

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

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !description.trim() || !presentationDate) {
      return;
    }

    onCreateProject({
      title,
      description,
      presentationDate,
      memberCount: Math.max(1, Number(memberCount) || 1),
      status,
      discipline,
    });

    setTitle('');
    setDescription('');
    setPresentationDate('2026-12-05');
    setMemberCount(4);
    setStatus(ProjectStatus.PLANNING);
    setDiscipline('');
    onCloseCreateModal();
  };

  return (
    <div className="space-y-6">
      {/* Barra de busca, filtros e ação principal */}
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
          onClick={onOpenCreateModal}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          <span>Criar novo projeto</span>
        </button>
      </div>

      {/* Lista de projetos */}
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
            onClick={onOpenCreateModal}
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
                      <span>{formatDatePtBr(project.presentationDate)}</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                      <span>{project.memberCount} integrantes</span>
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => onOpenProject(project.id)}
                    className="inline-flex items-center gap-1 text-sm font-medium text-blue-700 hover:text-blue-800 whitespace-nowrap shrink-0 transition-colors"
                  >
                    <span>Abrir projeto</span>
                    <ChevronRight className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Modal Criar Novo Projeto */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={onCloseCreateModal}
        title="Criar novo projeto"
        subtitle="Cadastre os dados iniciais da apresentação em grupo"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="project-title"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              Nome do projeto
            </label>
            <input
              id="project-title"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Seminário sobre Bancos de Dados NoSQL"
              className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-blue-700 focus:ring-1 focus:ring-blue-700"
            />
          </div>

          <div>
            <label
              htmlFor="project-discipline"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              Disciplina (opcional)
            </label>
            <input
              id="project-discipline"
              type="text"
              value={discipline}
              onChange={(e) => setDiscipline(e.target.value)}
              placeholder="Ex: SIN3012 — Engenharia de Software"
              className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-blue-700 focus:ring-1 focus:ring-blue-700"
            />
          </div>

          <div>
            <label
              htmlFor="project-description"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              Descrição
            </label>
            <textarea
              id="project-description"
              rows={3}
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Resumo dos objetivos, tema central e formato da apresentação..."
              className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-blue-700 focus:ring-1 focus:ring-blue-700"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label
                htmlFor="project-date"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
                Data da apresentação
              </label>
              <input
                id="project-date"
                type="date"
                required
                value={presentationDate}
                onChange={(e) => setPresentationDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 tabular-nums focus:outline-none focus:border-blue-700 focus:ring-1 focus:ring-blue-700"
              />
            </div>

            <div>
              <label
                htmlFor="project-members"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
                Integrantes
              </label>
              <input
                id="project-members"
                type="number"
                min={1}
                max={20}
                required
                value={memberCount}
                onChange={(e) => setMemberCount(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 tabular-nums focus:outline-none focus:border-blue-700 focus:ring-1 focus:ring-blue-700"
              />
            </div>

            <div>
              <label
                htmlFor="project-status"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
                Status
              </label>
              <select
                id="project-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as ProjectStatus)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white focus:outline-none focus:border-blue-700 focus:ring-1 focus:ring-blue-700"
              >
                {Object.values(ProjectStatus).map((statusOption) => (
                  <option key={statusOption} value={statusOption}>
                    {statusOption}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onCloseCreateModal}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors"
            >
              Salvar projeto
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
