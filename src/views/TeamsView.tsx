import { useState } from 'react';
import { Clock, Mail, Search } from 'lucide-react';
import { Project, TeamMember } from '../types';
import { getInitials } from '../utils/formatters';
import { Card } from '../components/ui/Card';
import { ProgressBar } from '../components/ui/ProgressBar';

interface TeamsViewProps {
  members: TeamMember[];
  projects: Project[];
  onOpenProject: (projectId: string) => void;
}

export function TeamsView({ members, projects, onOpenProject }: TeamsViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');

  const filteredMembers = members.filter((member) => {
    const matchesProject =
      selectedProjectId === 'all' || member.projectId === selectedProjectId;
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !query ||
      member.name.toLowerCase().includes(query) ||
      member.email.toLowerCase().includes(query) ||
      member.responsibility.toLowerCase().includes(query);
    return matchesProject && matchesSearch;
  });

  const totalSpeakingMinutes = filteredMembers.reduce(
    (sum, member) => sum + member.presentationMinutes,
    0
  );

  return (
    <div className="space-y-6">
      {/* Filtros de equipe */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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
              placeholder="Buscar integrante, e-mail ou função..."
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-700 focus:ring-1 focus:ring-blue-700"
            />
          </div>

          <select
            aria-label="Filtrar por projeto"
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="px-3.5 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:border-blue-700 focus:ring-1 focus:ring-blue-700 max-w-xs"
          >
            <option value="all">Todos os projetos</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.title}
              </option>
            ))}
          </select>
        </div>

        <div className="text-sm text-slate-600 tabular-nums whitespace-nowrap">
          <span className="font-semibold text-slate-900">
            {filteredMembers.length}
          </span>{' '}
          integrantes · Tempo somado:{' '}
          <span className="font-semibold text-blue-700">
            {totalSpeakingMinutes} min
          </span>
        </div>
      </div>

      {/* Tabela responsiva de integrantes */}
      <Card padding="none" className="overflow-hidden">
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-600">
                <th className="py-3.5 px-6">Nome do integrante</th>
                <th className="py-3.5 px-4">E-mail</th>
                <th className="py-3.5 px-4">Responsabilidade</th>
                <th className="py-3.5 px-4">Projeto</th>
                <th className="py-3.5 px-4 text-right">Tempo de apresentação</th>
                <th className="py-3.5 px-6 w-48">Progresso individual</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {filteredMembers.map((member) => (
                <tr
                  key={member.id}
                  className="hover:bg-slate-50/70 transition-colors"
                >
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold flex items-center justify-center shrink-0">
                        {getInitials(member.name)}
                      </span>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 truncate">
                          {member.name}
                        </p>
                        <p className="text-xs text-slate-500 truncate">
                          {member.role}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-slate-600 whitespace-nowrap">
                    {member.email}
                  </td>
                  <td className="py-4 px-4 text-slate-700 max-w-xs">
                    {member.responsibility}
                  </td>
                  <td className="py-4 px-4 max-w-[220px]">
                    <button
                      type="button"
                      onClick={() => onOpenProject(member.projectId)}
                      className="text-left text-blue-700 hover:text-blue-800 font-medium truncate block w-full"
                      title={member.projectName}
                    >
                      {member.projectName}
                    </button>
                  </td>
                  <td className="py-4 px-4 text-right font-medium text-slate-800 tabular-nums whitespace-nowrap">
                    {member.presentationMinutes} min
                  </td>
                  <td className="py-4 px-6">
                    <ProgressBar value={member.progress} size="sm" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Visualização em lista para telas menores */}
        <div className="lg:hidden divide-y divide-slate-200">
          {filteredMembers.map((member) => (
            <div key={member.id} className="p-4 sm:p-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-9 h-9 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold flex items-center justify-center shrink-0">
                    {getInitials(member.name)}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">
                      {member.name}
                    </p>
                    <p className="text-xs text-slate-500 truncate">{member.role}</p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 tabular-nums shrink-0">
                  <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                  {member.presentationMinutes} min
                </span>
              </div>

              <div className="text-xs text-slate-600 space-y-1">
                <p className="flex items-center gap-1.5 truncate">
                  <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                  <span>{member.email}</span>
                </p>
                <p>
                  <span className="font-medium text-slate-700">Responsabilidade:</span>{' '}
                  {member.responsibility}
                </p>
                <p className="truncate">
                  <span className="font-medium text-slate-700">Projeto:</span>{' '}
                  <button
                    type="button"
                    onClick={() => onOpenProject(member.projectId)}
                    className="text-blue-700 font-medium hover:underline"
                  >
                    {member.projectName}
                  </button>
                </p>
              </div>

              <ProgressBar value={member.progress} size="sm" />
            </div>
          ))}
        </div>

        {filteredMembers.length === 0 && (
          <div className="p-8 text-center">
            <p className="text-sm font-medium text-slate-900">
              Nenhum integrante encontrado para os critérios selecionados.
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
