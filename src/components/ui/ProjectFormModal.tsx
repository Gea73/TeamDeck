import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { validateProjectInput } from '../../domain/validators';
import { TeamDeckServiceError } from '../../services/teamDeckService';
import {
  CreateProjectInput,
  Project,
  ProjectStatus,
  ValidationErrors,
} from '../../types';
import { Modal } from './Modal';

interface ProjectFormModalProps {
  isOpen: boolean;
  editingProject?: Project | null;
  isSubmitting: boolean;
  onSubmit: (
    values: CreateProjectInput,
    editingId?: string
  ) => Promise<void>;
  onClose: () => void;
}

const DEFAULT_VALUES: CreateProjectInput = {
  title: '',
  description: '',
  discipline: '',
  advisor: '',
  presentationDate: '2026-12-05',
  presentationTime: '19:00',
  location: '',
  targetDurationMinutes: 20,
  status: ProjectStatus.PLANNING,
};

export function ProjectFormModal({
  isOpen,
  editingProject,
  isSubmitting,
  onSubmit,
  onClose,
}: ProjectFormModalProps) {
  const [form, setForm] = useState<CreateProjectInput>(DEFAULT_VALUES);
  const [fieldErrors, setFieldErrors] = useState<ValidationErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setFieldErrors({});
    setFormError(null);
    if (editingProject) {
      setForm({
        title: editingProject.title,
        description: editingProject.description,
        discipline: editingProject.discipline,
        advisor: editingProject.advisor === 'A definir' ? '' : editingProject.advisor,
        presentationDate: editingProject.presentationDate,
        presentationTime: editingProject.presentationTime,
        location: editingProject.location,
        targetDurationMinutes: editingProject.targetDurationMinutes,
        status: editingProject.status,
      });
    } else {
      setForm(DEFAULT_VALUES);
    }
  }, [isOpen, editingProject]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);

    const validation = validateProjectInput(form);
    if (!validation.valid) {
      setFieldErrors(validation.errors);
      return;
    }

    setFieldErrors({});
    try {
      await onSubmit(form, editingProject?.id);
      onClose();
    } catch (error) {
      if (error instanceof TeamDeckServiceError) {
        if (error.fieldErrors) setFieldErrors(error.fieldErrors);
        setFormError(error.message);
      } else {
        setFormError('Não foi possível salvar o projeto. Tente novamente.');
      }
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingProject ? 'Editar projeto' : 'Criar novo projeto'}
      subtitle={
        editingProject
          ? 'Atualize as informações e a data da apresentação do projeto'
          : 'Cadastre os dados da apresentação acadêmica em grupo'
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
            htmlFor="proj-title"
            className="block text-sm font-medium text-slate-700 mb-1"
          >
            Nome do projeto *
          </label>
          <input
            id="proj-title"
            type="text"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Ex: Seminário sobre Bancos de Dados Distribuídos"
            className={`w-full px-3.5 py-2 border rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-1 ${
              fieldErrors.title
                ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                : 'border-slate-300 focus:border-blue-700 focus:ring-blue-700'
            }`}
          />
          {fieldErrors.title && (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.title}</p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="proj-discipline"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              Disciplina *
            </label>
            <input
              id="proj-discipline"
              type="text"
              value={form.discipline}
              onChange={(e) => setForm({ ...form, discipline: e.target.value })}
              placeholder="Ex: SIN3012 — Banco de Dados"
              className={`w-full px-3.5 py-2 border rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-1 ${
                fieldErrors.discipline
                  ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                  : 'border-slate-300 focus:border-blue-700 focus:ring-blue-700'
              }`}
            />
            {fieldErrors.discipline && (
              <p className="mt-1 text-xs text-red-600">
                {fieldErrors.discipline}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="proj-advisor"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              Docente responsável
            </label>
            <input
              id="proj-advisor"
              type="text"
              value={form.advisor}
              onChange={(e) => setForm({ ...form, advisor: e.target.value })}
              placeholder="Ex: Prof. Dr. Carlos Silva"
              className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-blue-700 focus:ring-1 focus:ring-blue-700"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="proj-description"
            className="block text-sm font-medium text-slate-700 mb-1"
          >
            Descrição *
          </label>
          <textarea
            id="proj-description"
            rows={3}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Objetivo do trabalho, tema abordado e formato esperado pela banca..."
            className={`w-full px-3.5 py-2 border rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-1 ${
              fieldErrors.description
                ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                : 'border-slate-300 focus:border-blue-700 focus:ring-blue-700'
            }`}
          />
          {fieldErrors.description && (
            <p className="mt-1 text-xs text-red-600">
              {fieldErrors.description}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label
              htmlFor="proj-date"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              Data da apresentação *
            </label>
            <input
              id="proj-date"
              type="date"
              value={form.presentationDate}
              onChange={(e) =>
                setForm({ ...form, presentationDate: e.target.value })
              }
              className={`w-full px-3 py-2 border rounded-lg text-sm text-slate-900 tabular-nums focus:outline-none focus:ring-1 ${
                fieldErrors.presentationDate
                  ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                  : 'border-slate-300 focus:border-blue-700 focus:ring-blue-700'
              }`}
            />
            {fieldErrors.presentationDate && (
              <p className="mt-1 text-xs text-red-600">
                {fieldErrors.presentationDate}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="proj-time"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              Horário *
            </label>
            <input
              id="proj-time"
              type="time"
              value={form.presentationTime}
              onChange={(e) =>
                setForm({ ...form, presentationTime: e.target.value })
              }
              className={`w-full px-3 py-2 border rounded-lg text-sm text-slate-900 tabular-nums focus:outline-none focus:ring-1 ${
                fieldErrors.presentationTime
                  ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                  : 'border-slate-300 focus:border-blue-700 focus:ring-blue-700'
              }`}
            />
            {fieldErrors.presentationTime && (
              <p className="mt-1 text-xs text-red-600">
                {fieldErrors.presentationTime}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="proj-duration"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              Duração (min) *
            </label>
            <input
              id="proj-duration"
              type="number"
              min={5}
              max={180}
              value={form.targetDurationMinutes}
              onChange={(e) =>
                setForm({
                  ...form,
                  targetDurationMinutes: Number(e.target.value),
                })
              }
              className={`w-full px-3 py-2 border rounded-lg text-sm text-slate-900 tabular-nums focus:outline-none focus:ring-1 ${
                fieldErrors.targetDurationMinutes
                  ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                  : 'border-slate-300 focus:border-blue-700 focus:ring-blue-700'
              }`}
            />
            {fieldErrors.targetDurationMinutes && (
              <p className="mt-1 text-xs text-red-600">
                {fieldErrors.targetDurationMinutes}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="proj-location"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              Sala / Local *
            </label>
            <input
              id="proj-location"
              type="text"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              placeholder="Ex: Auditório B — Sala 105"
              className={`w-full px-3.5 py-2 border rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-1 ${
                fieldErrors.location
                  ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                  : 'border-slate-300 focus:border-blue-700 focus:ring-blue-700'
              }`}
            />
            {fieldErrors.location && (
              <p className="mt-1 text-xs text-red-600">
                {fieldErrors.location}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="proj-status"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              Status
            </label>
            <select
              id="proj-status"
              value={form.status}
              onChange={(e) =>
                setForm({ ...form, status: e.target.value as ProjectStatus })
              }
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
            <span>{editingProject ? 'Salvar alterações' : 'Criar projeto'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
}
