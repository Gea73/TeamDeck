import { useState } from 'react';
import {
  Clock,
  FolderPlus,
  Mail,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserMinus,
} from 'lucide-react';
import {
  AssociateMemberInput,
  CreateMemberInput,
  MemberDirectoryItem,
  Project,
  TeamMemberAssignmentView,
  UpdateAssociationInput,
} from '../types';
import { getInitials } from '../utils/formatters';
import { AssociateMemberModal } from '../components/ui/AssociateMemberModal';
import { Card } from '../components/ui/Card';
import { ConfirmDeleteModal } from '../components/ui/ConfirmDeleteModal';
import { MemberFormModal } from '../components/ui/MemberFormModal';
import { ProgressBar } from '../components/ui/ProgressBar';

interface TeamsViewProps {
  members: MemberDirectoryItem[];
  assignments: TeamMemberAssignmentView[];
  projects: Project[];
  isMutating: boolean;
  onOpenProject: (projectId: string) => void;
  onCreateMember: (
    input: CreateMemberInput,
    initialAssociation?: Omit<AssociateMemberInput, 'memberId'>
  ) => Promise<void>;
  onUpdateMember: (id: string, input: CreateMemberInput) => Promise<void>;
  onDeleteMember: (memberId: string) => Promise<void>;
  onAssociateMember: (input: AssociateMemberInput) => Promise<void>;
  onUpdateAssociation: (input: UpdateAssociationInput) => Promise<void>;
  onRemoveAssociation: (associationId: string) => Promise<void>;
}

export function TeamsView({
  members,
  assignments,
  projects,
  isMutating,
  onOpenProject,
  onCreateMember,
  onUpdateMember,
  onDeleteMember,
  onAssociateMember,
  onUpdateAssociation,
  onRemoveAssociation,
}: TeamsViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');

  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [editingMember, setEditingMember] =
    useState<MemberDirectoryItem | null>(null);
  const [deletingMember, setDeletingMember] =
    useState<MemberDirectoryItem | null>(null);

  const [associateTargetMemberId, setAssociateTargetMemberId] = useState<
    string | undefined
  >(undefined);
  const [isAssociateModalOpen, setIsAssociateModalOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] =
    useState<TeamMemberAssignmentView | null>(null);
  const [removingAssignment, setRemovingAssignment] =
    useState<TeamMemberAssignmentView | null>(null);

  const query = searchQuery.trim().toLowerCase();

  const filteredDirectory = members.filter((member) => {
    const matchesSearch =
      !query ||
      member.name.toLowerCase().includes(query) ||
      member.email.toLowerCase().includes(query) ||
      member.defaultRole.toLowerCase().includes(query) ||
      member.assignments.some((a) =>
        a.responsibility.toLowerCase().includes(query)
      );

    if (selectedProjectId === 'all') return matchesSearch;
    return (
      matchesSearch &&
      member.assignments.some((a) => a.projectId === selectedProjectId)
    );
  });

  const filteredProjectAssignments = assignments.filter((item) => {
    if (selectedProjectId !== 'all' && item.projectId !== selectedProjectId) {
      return false;
    }
    return (
      !query ||
      item.name.toLowerCase().includes(query) ||
      item.email.toLowerCase().includes(query) ||
      item.responsibility.toLowerCase().includes(query)
    );
  });

  const handleMemberSubmit = async (
    memberInput: CreateMemberInput,
    editingId?: string,
    initialAssociation?: Omit<AssociateMemberInput, 'memberId'>
  ) => {
    if (editingId) {
      await onUpdateMember(editingId, memberInput);
    } else {
      await onCreateMember(memberInput, initialAssociation);
    }
  };

  const handleDeleteMemberConfirm = async () => {
    if (!deletingMember) return;
    await onDeleteMember(deletingMember.id);
    setDeletingMember(null);
  };

  const handleRemoveAssociationConfirm = async () => {
    if (!removingAssignment) return;
    await onRemoveAssociation(removingAssignment.associationId);
    setRemovingAssignment(null);
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
            <option value="all">Todos os integrantes ({members.length})</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.title}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {projects.length > 0 && members.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setEditingAssignment(null);
                setAssociateTargetMemberId(undefined);
                setIsAssociateModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-blue-700 border border-blue-200 text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
            >
              <FolderPlus className="w-4 h-4" aria-hidden="true" />
              <span>Associar a projeto</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setEditingMember(null);
              setIsMemberModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>Cadastrar integrante</span>
          </button>
        </div>
      </div>

      {/* Quando filtrado por um projeto específico, mostra os vínculos daquele projeto */}
      {selectedProjectId !== 'all' ? (
        <Card padding="none" className="overflow-hidden">
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-600">
                  <th className="py-3.5 px-6">Nome do integrante</th>
                  <th className="py-3.5 px-4">E-mail</th>
                  <th className="py-3.5 px-4">Responsabilidade</th>
                  <th className="py-3.5 px-4 text-right">Tempo de apresentação</th>
                  <th className="py-3.5 px-4 w-44">Progresso individual</th>
                  <th className="py-3.5 px-6 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {filteredProjectAssignments.map((item) => (
                  <tr
                    key={item.associationId}
                    className="hover:bg-slate-50/70 transition-colors"
                  >
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold flex items-center justify-center shrink-0">
                          {getInitials(item.name)}
                        </span>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 truncate">
                            {item.name}
                          </p>
                          <p className="text-xs text-slate-500 truncate">
                            {item.role}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-slate-600 whitespace-nowrap">
                      {item.email}
                    </td>
                    <td className="py-4 px-4 text-slate-700 max-w-xs">
                      {item.responsibility}
                    </td>
                    <td className="py-4 px-4 text-right font-medium text-slate-800 tabular-nums whitespace-nowrap">
                      {item.presentationMinutes} min
                    </td>
                    <td className="py-4 px-4">
                      <ProgressBar value={item.progress} size="sm" />
                    </td>
                    <td className="py-4 px-6 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingAssignment(item);
                          setIsAssociateModalOpen(true);
                        }}
                        title="Editar participação"
                        aria-label={`Editar participação de ${item.name}`}
                        className="p-2 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setRemovingAssignment(item)}
                        title="Remover do projeto"
                        aria-label={`Remover ${item.name} do projeto`}
                        className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <UserMinus className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="lg:hidden divide-y divide-slate-200">
            {filteredProjectAssignments.map((item) => (
              <div key={item.associationId} className="p-4 sm:p-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-9 h-9 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold flex items-center justify-center shrink-0">
                      {getInitials(item.name)}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {item.name}
                      </p>
                      <p className="text-xs text-slate-500 truncate">
                        {item.role}
                      </p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 tabular-nums shrink-0">
                    <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                    {item.presentationMinutes} min
                  </span>
                </div>
                <p className="text-xs text-slate-600">{item.responsibility}</p>
                <ProgressBar value={item.progress} size="sm" />
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingAssignment(item);
                      setIsAssociateModalOpen(true);
                    }}
                    className="text-xs font-medium text-blue-700 hover:underline px-2 py-1"
                  >
                    Editar vínculo
                  </button>
                  <button
                    type="button"
                    onClick={() => setRemovingAssignment(item)}
                    className="text-xs font-medium text-red-600 hover:underline px-2 py-1"
                  >
                    Desassociar
                  </button>
                </div>
              </div>
            ))}
          </div>

          {filteredProjectAssignments.length === 0 && (
            <div className="p-8 text-center text-sm text-slate-500">
              Nenhum integrante associado a este projeto.
            </div>
          )}
        </Card>
      ) : (
        /* Diretório completo de integrantes cadastrados */
        <Card padding="none" className="overflow-hidden">
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-600">
                  <th className="py-3.5 px-6">Nome do integrante</th>
                  <th className="py-3.5 px-4">E-mail</th>
                  <th className="py-3.5 px-4">Projetos e responsabilidades</th>
                  <th className="py-3.5 px-4 text-right">Tempo total</th>
                  <th className="py-3.5 px-4 w-44">Progresso médio</th>
                  <th className="py-3.5 px-6 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {filteredDirectory.map((member) => (
                  <tr
                    key={member.id}
                    className="hover:bg-slate-50/70 transition-colors"
                  >
                    <td className="py-4 px-6 align-top">
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold flex items-center justify-center shrink-0">
                          {getInitials(member.name)}
                        </span>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 truncate">
                            {member.name}
                          </p>
                          <p className="text-xs text-slate-500 truncate">
                            {member.defaultRole}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-slate-600 align-top whitespace-nowrap">
                      {member.email}
                    </td>
                    <td className="py-4 px-4 align-top max-w-md">
                      {member.assignments.length === 0 ? (
                        <span className="text-xs text-slate-400">
                          Sem projeto associado
                        </span>
                      ) : (
                        <ul className="space-y-1.5">
                          {member.assignments.map((assoc) => (
                            <li key={assoc.associationId} className="text-xs">
                              <button
                                type="button"
                                onClick={() => onOpenProject(assoc.projectId)}
                                className="font-semibold text-blue-700 hover:underline text-left"
                              >
                                {assoc.projectName}
                              </button>
                              <span className="text-slate-600">
                                {' '}
                                — {assoc.responsibility} ({assoc.presentationMinutes}{' '}
                                min)
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td className="py-4 px-4 text-right font-medium text-slate-800 tabular-nums align-top whitespace-nowrap">
                      {member.totalPresentationMinutes} min
                    </td>
                    <td className="py-4 px-4 align-top">
                      <ProgressBar value={member.averageProgress} size="sm" />
                    </td>
                    <td className="py-4 px-6 text-right align-top whitespace-nowrap">
                      {projects.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingAssignment(null);
                            setAssociateTargetMemberId(member.id);
                            setIsAssociateModalOpen(true);
                          }}
                          title="Associar a projeto"
                          aria-label={`Associar ${member.name} a um projeto`}
                          className="p-2 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <FolderPlus className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setEditingMember(member);
                          setIsMemberModalOpen(true);
                        }}
                        title="Editar integrante"
                        aria-label={`Editar ${member.name}`}
                        className="p-2 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingMember(member)}
                        title="Remover integrante"
                        aria-label={`Remover ${member.name}`}
                        className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="lg:hidden divide-y divide-slate-200">
            {filteredDirectory.map((member) => (
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
                      <p className="text-xs text-slate-500 truncate">
                        {member.defaultRole}
                      </p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 tabular-nums shrink-0">
                    <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                    {member.totalPresentationMinutes} min
                  </span>
                </div>

                <p className="text-xs text-slate-600 flex items-center gap-1.5 truncate">
                  <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                  <span>{member.email}</span>
                </p>

                {member.assignments.length > 0 && (
                  <div className="space-y-1 text-xs">
                    {member.assignments.map((assoc) => (
                      <p key={assoc.associationId} className="text-slate-600">
                        <button
                          type="button"
                          onClick={() => onOpenProject(assoc.projectId)}
                          className="font-semibold text-blue-700 hover:underline"
                        >
                          {assoc.projectName}
                        </button>
                        : {assoc.responsibility}
                      </p>
                    ))}
                  </div>
                )}

                <ProgressBar value={member.averageProgress} size="sm" />

                <div className="flex items-center justify-end gap-3 pt-1">
                  {projects.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingAssignment(null);
                        setAssociateTargetMemberId(member.id);
                        setIsAssociateModalOpen(true);
                      }}
                      className="text-xs font-medium text-blue-700 hover:underline"
                    >
                      Associar
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setEditingMember(member);
                      setIsMemberModalOpen(true);
                    }}
                    className="text-xs font-medium text-slate-700 hover:underline"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeletingMember(member)}
                    className="text-xs font-medium text-red-600 hover:underline"
                  >
                    Remover
                  </button>
                </div>
              </div>
            ))}
          </div>

          {filteredDirectory.length === 0 && (
            <div className="p-8 text-center text-sm text-slate-500">
              Nenhum integrante cadastrado para os critérios selecionados.
            </div>
          )}
        </Card>
      )}

      <MemberFormModal
        isOpen={isMemberModalOpen}
        editingMember={editingMember}
        projects={projects}
        isSubmitting={isMutating}
        onSubmit={handleMemberSubmit}
        onClose={() => {
          setEditingMember(null);
          setIsMemberModalOpen(false);
        }}
      />

      <AssociateMemberModal
        isOpen={isAssociateModalOpen}
        projects={projects}
        members={members}
        lockedProjectId={
          selectedProjectId !== 'all' ? selectedProjectId : undefined
        }
        lockedMemberId={associateTargetMemberId}
        editingAssignment={editingAssignment}
        isSubmitting={isMutating}
        onAssociate={onAssociateMember}
        onUpdateAssociation={onUpdateAssociation}
        onClose={() => {
          setEditingAssignment(null);
          setAssociateTargetMemberId(undefined);
          setIsAssociateModalOpen(false);
        }}
      />

      <ConfirmDeleteModal
        isOpen={Boolean(deletingMember)}
        title="Remover integrante"
        description={
          deletingMember
            ? `Tem certeza de que deseja remover "${deletingMember.name}"? Todos os vínculos deste participante com projetos serão removidos.`
            : ''
        }
        confirmLabel="Remover integrante"
        isSubmitting={isMutating}
        onConfirm={handleDeleteMemberConfirm}
        onClose={() => setDeletingMember(null)}
      />

      <ConfirmDeleteModal
        isOpen={Boolean(removingAssignment)}
        title="Remover integrante do projeto"
        description={
          removingAssignment
            ? `Deseja desassociar "${removingAssignment.name}" do projeto "${removingAssignment.projectName}"?`
            : ''
        }
        confirmLabel="Desassociar"
        isSubmitting={isMutating}
        onConfirm={handleRemoveAssociationConfirm}
        onClose={() => setRemovingAssignment(null)}
      />
    </div>
  );
}
