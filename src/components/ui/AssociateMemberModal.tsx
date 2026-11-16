import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  validateAssociationInput,
  validateUpdateAssociationInput,
} from '../../domain/validators';
import { TeamDeckServiceError } from '../../services/teamDeckService';
import {
  AssociateMemberInput,
  MemberDirectoryItem,
  Project,
  TeamMemberAssignmentView,
  UpdateAssociationInput,
  ValidationErrors,
} from '../../types';
import { Modal } from './Modal';

interface AssociateMemberModalProps {
  isOpen: boolean;
  projects: Project[];
  members: MemberDirectoryItem[];
  lockedProjectId?: string;
  lockedMemberId?: string;
  editingAssignment?: TeamMemberAssignmentView | null;
  isSubmitting: boolean;
  onAssociate: (input: AssociateMemberInput) => Promise<void>;
  onUpdateAssociation: (input: UpdateAssociationInput) => Promise<void>;
  onClose: () => void;
}

export function AssociateMemberModal({
  isOpen,
  projects,
  members,
  lockedProjectId,
  lockedMemberId,
  editingAssignment,
  isSubmitting,
  onAssociate,
  onUpdateAssociation,
  onClose,
}: AssociateMemberModalProps) {
  const [projectId, setProjectId] = useState('');
  const [memberId, setMemberId] = useState('');
  const [role, setRole] = useState('');
  const [responsibility, setResponsibility] = useState('');
  const [presentationMinutes, setPresentationMinutes] = useState(5);
  const [progress, setProgress] = useState(0);

  const [fieldErrors, setFieldErrors] = useState<ValidationErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setFieldErrors({});
    setFormError(null);

    if (editingAssignment) {
      setProjectId(editingAssignment.projectId);
      setMemberId(editingAssignment.memberId);
      setRole(editingAssignment.role);
      setResponsibility(editingAssignment.responsibility);
      setPresentationMinutes(editingAssignment.presentationMinutes);
      setProgress(editingAssignment.progress);
      return;
    }

    const initialProject = lockedProjectId ?? projects[0]?.id ?? '';
    const initialMember = lockedMemberId ?? members[0]?.id ?? '';
    const matchedMember = members.find((m) => m.id === initialMember);

    setProjectId(initialProject);
    setMemberId(initialMember);
    setRole(matchedMember?.defaultRole ?? '');
    setResponsibility('');
    setPresentationMinutes(5);
    setProgress(0);
  }, [
    isOpen,
    editingAssignment,
    lockedProjectId,
    lockedMemberId,
    projects,
    members,
  ]);

  const handleMemberChange = (nextMemberId: string) => {
    setMemberId(nextMemberId);
    const matched = members.find((m) => m.id === nextMemberId);
    if (matched && !role.trim()) {
      setRole(matched.defaultRole);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);

    if (editingAssignment) {
      const updatePayload: UpdateAssociationInput = {
        associationId: editingAssignment.associationId,
        role,
        responsibility,
        presentationMinutes,
        progress,
      };
      const validation = validateUpdateAssociationInput(updatePayload);
      if (!validation.valid) {
        setFieldErrors(validation.errors);
        return;
      }

      setFieldErrors({});
      try {
        await onUpdateAssociation(updatePayload);
        onClose();
      } catch (error) {
        if (error instanceof TeamDeckServiceError) {
          if (error.fieldErrors) setFieldErrors(error.fieldErrors);
          setFormError(error.message);
        } else {
          setFormError('Não foi possível atualizar a associação.');
        }
      }
      return;
    }

    const createPayload: AssociateMemberInput = {
      projectId,
      memberId,
      role,
      responsibility,
      presentationMinutes,
      progress,
    };

    const validation = validateAssociationInput(createPayload);
    if (!validation.valid) {
      setFieldErrors(validation.errors);
      return;
    }

    setFieldErrors({});
    try {
      await onAssociate(createPayload);
      onClose();
    } catch (error) {
      if (error instanceof TeamDeckServiceError) {
        if (error.fieldErrors) setFieldErrors(error.fieldErrors);
        setFormError(error.message);
      } else {
        setFormError('Não foi possível associar o integrante ao projeto.');
      }
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        editingAssignment
          ? 'Editar participação no projeto'
          : 'Associar integrante ao projeto'
      }
      subtitle={
        editingAssignment
          ? `${editingAssignment.name} · ${editingAssignment.projectName}`
          : 'Defina papel, responsabilidade e tempo de fala na apresentação'
      }
    >
      <form onSubmit={(e) => void handleSubmit(e)} noValidate className="space-y-4">
        {formError && (
          <div
            role="alert"
            className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs font-medium text-red-800"
          >
            {formError}
          </div>
        )}

        {!editingAssignment && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="assoc-project"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
                Projeto *
              </label>
              <select
                id="assoc-project"
                disabled={Boolean(lockedProjectId)}
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg text-sm text-slate-900 bg-white disabled:bg-slate-100 focus:outline-none focus:ring-1 ${
                  fieldErrors.projectId
                    ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                    : 'border-slate-300 focus:border-blue-700 focus:ring-blue-700'
                }`}
              >
                {projects.map((proj) => (
                  <option key={proj.id} value={proj.id}>
                    {proj.title}
                  </option>
                ))}
              </select>
              {fieldErrors.projectId && (
                <p className="mt-1 text-xs text-red-600">
                  {fieldErrors.projectId}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="assoc-member"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
                Integrante *
              </label>
              <select
                id="assoc-member"
                disabled={Boolean(lockedMemberId)}
                value={memberId}
                onChange={(e) => handleMemberChange(e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg text-sm text-slate-900 bg-white disabled:bg-slate-100 focus:outline-none focus:ring-1 ${
                  fieldErrors.memberId
                    ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                    : 'border-slate-300 focus:border-blue-700 focus:ring-blue-700'
                }`}
              >
                {members.map((mem) => (
                  <option key={mem.id} value={mem.id}>
                    {mem.name} ({mem.email})
                  </option>
                ))}
              </select>
              {fieldErrors.memberId && (
                <p className="mt-1 text-xs text-red-600">
                  {fieldErrors.memberId}
                </p>
              )}
            </div>
          </div>
        )}

        <div>
          <label
            htmlFor="assoc-role"
            className="block text-sm font-medium text-slate-700 mb-1"
          >
            Papel no projeto *
          </label>
          <input
            id="assoc-role"
            type="text"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="Ex: Pesquisador Técnico"
            className={`w-full px-3.5 py-2 border rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-1 ${
              fieldErrors.role
                ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                : 'border-slate-300 focus:border-blue-700 focus:ring-blue-700'
            }`}
          />
          {fieldErrors.role && (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.role}</p>
          )}
        </div>

        <div>
          <label
            htmlFor="assoc-resp"
            className="block text-sm font-medium text-slate-700 mb-1"
          >
            Responsabilidade na apresentação *
          </label>
          <input
            id="assoc-resp"
            type="text"
            value={responsibility}
            onChange={(e) => setResponsibility(e.target.value)}
            placeholder="Ex: Fundamentação teórica e estudo de caso"
            className={`w-full px-3.5 py-2 border rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-1 ${
              fieldErrors.responsibility
                ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                : 'border-slate-300 focus:border-blue-700 focus:ring-blue-700'
            }`}
          />
          {fieldErrors.responsibility && (
            <p className="mt-1 text-xs text-red-600">
              {fieldErrors.responsibility}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="assoc-minutes"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              Tempo de apresentação (min) *
            </label>
            <input
              id="assoc-minutes"
              type="number"
              min={1}
              max={120}
              value={presentationMinutes}
              onChange={(e) => setPresentationMinutes(Number(e.target.value))}
              className={`w-full px-3 py-2 border rounded-lg text-sm text-slate-900 tabular-nums focus:outline-none focus:ring-1 ${
                fieldErrors.presentationMinutes
                  ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                  : 'border-slate-300 focus:border-blue-700 focus:ring-blue-700'
              }`}
            />
            {fieldErrors.presentationMinutes && (
              <p className="mt-1 text-xs text-red-600">
                {fieldErrors.presentationMinutes}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="assoc-progress"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              Progresso individual (%) *
            </label>
            <input
              id="assoc-progress"
              type="number"
              min={0}
              max={100}
              value={progress}
              onChange={(e) => setProgress(Number(e.target.value))}
              className={`w-full px-3 py-2 border rounded-lg text-sm text-slate-900 tabular-nums focus:outline-none focus:ring-1 ${
                fieldErrors.progress
                  ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                  : 'border-slate-300 focus:border-blue-700 focus:ring-blue-700'
              }`}
            />
            {fieldErrors.progress && (
              <p className="mt-1 text-xs text-red-600">
                {fieldErrors.progress}
              </p>
            )}
          </div>
        </div>

        <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-200">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-60 rounded-lg transition-colors"
          >
            {isSubmitting && (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            )}
            <span>
              {editingAssignment ? 'Salvar vínculo' : 'Associar ao projeto'}
            </span>
          </button>
        </div>
      </form>
    </Modal>
  );
}
