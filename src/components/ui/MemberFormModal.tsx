import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  validateAssociationInput,
  validateMemberInput,
} from '../../domain/validators';
import { TeamDeckServiceError } from '../../services/teamDeckService';
import {
  AssociateMemberInput,
  CreateMemberInput,
  MemberDirectoryItem,
  Project,
  ValidationErrors,
} from '../../types';
import { Modal } from './Modal';

interface MemberFormModalProps {
  isOpen: boolean;
  editingMember?: MemberDirectoryItem | null;
  projects: Project[];
  isSubmitting: boolean;
  onSubmit: (
    memberInput: CreateMemberInput,
    editingId?: string,
    initialAssociation?: Omit<AssociateMemberInput, 'memberId'>
  ) => Promise<void>;
  onClose: () => void;
}

export function MemberFormModal({
  isOpen,
  editingMember,
  projects,
  isSubmitting,
  onSubmit,
  onClose,
}: MemberFormModalProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [defaultRole, setDefaultRole] = useState('');

  const [associateNow, setAssociateNow] = useState(false);
  const [projectId, setProjectId] = useState('');
  const [responsibility, setResponsibility] = useState('');
  const [presentationMinutes, setPresentationMinutes] = useState(5);
  const [progress, setProgress] = useState(0);

  const [fieldErrors, setFieldErrors] = useState<ValidationErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setFieldErrors({});
    setFormError(null);

    if (editingMember) {
      setName(editingMember.name);
      setEmail(editingMember.email);
      setDefaultRole(editingMember.defaultRole);
      setAssociateNow(false);
    } else {
      setName('');
      setEmail('');
      setDefaultRole('');
      setAssociateNow(false);
      setProjectId(projects[0]?.id ?? '');
      setResponsibility('');
      setPresentationMinutes(5);
      setProgress(0);
    }
  }, [isOpen, editingMember, projects]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);

    const memberPayload: CreateMemberInput = {
      name,
      email,
      defaultRole,
    };

    const memberValidation = validateMemberInput(memberPayload);
    const mergedErrors: ValidationErrors = { ...memberValidation.errors };

    let initialAssoc: Omit<AssociateMemberInput, 'memberId'> | undefined;

    if (!editingMember && associateNow) {
      initialAssoc = {
        projectId,
        role: defaultRole || 'Integrante',
        responsibility,
        presentationMinutes,
        progress,
      };
      const assocValidation = validateAssociationInput({
        ...initialAssoc,
        memberId: 'pending',
      });
      Object.assign(mergedErrors, assocValidation.errors);
    }

    if (Object.keys(mergedErrors).length > 0) {
      setFieldErrors(mergedErrors);
      return;
    }

    setFieldErrors({});
    try {
      await onSubmit(memberPayload, editingMember?.id, initialAssoc);
      onClose();
    } catch (error) {
      if (error instanceof TeamDeckServiceError) {
        if (error.fieldErrors) setFieldErrors(error.fieldErrors);
        setFormError(error.message);
      } else {
        setFormError('Não foi possível salvar os dados do integrante.');
      }
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingMember ? 'Editar integrante' : 'Cadastrar integrante'}
      subtitle={
        editingMember
          ? 'Atualize os dados cadastrais do participante'
          : 'Adicione um novo participante ao diretório da equipe'
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

        <div>
          <label
            htmlFor="mem-name"
            className="block text-sm font-medium text-slate-700 mb-1"
          >
            Nome do integrante *
          </label>
          <input
            id="mem-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Fernanda Oliveira"
            className={`w-full px-3.5 py-2 border rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-1 ${
              fieldErrors.name
                ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                : 'border-slate-300 focus:border-blue-700 focus:ring-blue-700'
            }`}
          />
          {fieldErrors.name && (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.name}</p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="mem-email"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              E-mail *
            </label>
            <input
              id="mem-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="fernanda.oliveira@usp.br"
              className={`w-full px-3.5 py-2 border rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-1 ${
                fieldErrors.email
                  ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                  : 'border-slate-300 focus:border-blue-700 focus:ring-blue-700'
              }`}
            />
            {fieldErrors.email && (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.email}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="mem-role"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              Função principal *
            </label>
            <input
              id="mem-role"
              type="text"
              value={defaultRole}
              onChange={(e) => setDefaultRole(e.target.value)}
              placeholder="Ex: Pesquisadora / Slides"
              className={`w-full px-3.5 py-2 border rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-1 ${
                fieldErrors.defaultRole
                  ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                  : 'border-slate-300 focus:border-blue-700 focus:ring-blue-700'
              }`}
            />
            {fieldErrors.defaultRole && (
              <p className="mt-1 text-xs text-red-600">
                {fieldErrors.defaultRole}
              </p>
            )}
          </div>
        </div>

        {!editingMember && projects.length > 0 && (
          <div className="pt-3 border-t border-slate-200 space-y-3">
            <label className="flex items-center gap-2.5 text-sm font-medium text-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={associateNow}
                onChange={(e) => setAssociateNow(e.target.checked)}
                className="w-4 h-4 accent-blue-700 rounded"
              />
              <span>Associar este integrante a um projeto agora</span>
            </label>

            {associateNow && (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                <div>
                  <label
                    htmlFor="mem-init-project"
                    className="block text-xs font-medium text-slate-700 mb-1"
                  >
                    Projeto *
                  </label>
                  <select
                    id="mem-init-project"
                    value={projectId}
                    onChange={(e) => setProjectId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white focus:outline-none focus:border-blue-700"
                  >
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
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
                    htmlFor="mem-init-resp"
                    className="block text-xs font-medium text-slate-700 mb-1"
                  >
                    Responsabilidade no projeto *
                  </label>
                  <input
                    id="mem-init-resp"
                    type="text"
                    value={responsibility}
                    onChange={(e) => setResponsibility(e.target.value)}
                    placeholder="Ex: Revisão bibliográfica e gráficos"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white focus:outline-none focus:border-blue-700"
                  />
                  {fieldErrors.responsibility && (
                    <p className="mt-1 text-xs text-red-600">
                      {fieldErrors.responsibility}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="mem-init-min"
                      className="block text-xs font-medium text-slate-700 mb-1"
                    >
                      Tempo de fala (min) *
                    </label>
                    <input
                      id="mem-init-min"
                      type="number"
                      min={1}
                      max={120}
                      value={presentationMinutes}
                      onChange={(e) =>
                        setPresentationMinutes(Number(e.target.value))
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white tabular-nums focus:outline-none focus:border-blue-700"
                    />
                    {fieldErrors.presentationMinutes && (
                      <p className="mt-1 text-xs text-red-600">
                        {fieldErrors.presentationMinutes}
                      </p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="mem-init-prog"
                      className="block text-xs font-medium text-slate-700 mb-1"
                    >
                      Progresso inicial (%)
                    </label>
                    <input
                      id="mem-init-prog"
                      type="number"
                      min={0}
                      max={100}
                      value={progress}
                      onChange={(e) => setProgress(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white tabular-nums focus:outline-none focus:border-blue-700"
                    />
                    {fieldErrors.progress && (
                      <p className="mt-1 text-xs text-red-600">
                        {fieldErrors.progress}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

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
              {editingMember ? 'Salvar alterações' : 'Cadastrar integrante'}
            </span>
          </button>
        </div>
      </form>
    </Modal>
  );
}
