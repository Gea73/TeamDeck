import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { validatePresentationDateInput } from '../../domain/validators';
import { TeamDeckServiceError } from '../../services/teamDeckService';
import { Project, ValidationErrors } from '../../types';
import { Modal } from './Modal';

interface PresentationDateModalProps {
  isOpen: boolean;
  project: Project | null;
  isSubmitting: boolean;
  onSubmit: (
    projectId: string,
    presentationDate: string,
    presentationTime: string,
    location: string
  ) => Promise<void>;
  onClose: () => void;
}

export function PresentationDateModal({
  isOpen,
  project,
  isSubmitting,
  onSubmit,
  onClose,
}: PresentationDateModalProps) {
  const [presentationDate, setPresentationDate] = useState('');
  const [presentationTime, setPresentationTime] = useState('');
  const [location, setLocation] = useState('');
  const [fieldErrors, setFieldErrors] = useState<ValidationErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !project) return;
    setPresentationDate(project.presentationDate);
    setPresentationTime(project.presentationTime);
    setLocation(project.location);
    setFieldErrors({});
    setFormError(null);
  }, [isOpen, project]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!project) return;

    const validation = validatePresentationDateInput(
      presentationDate,
      presentationTime,
      location
    );
    if (!validation.valid) {
      setFieldErrors(validation.errors);
      return;
    }

    setFieldErrors({});
    setFormError(null);
    try {
      await onSubmit(project.id, presentationDate, presentationTime, location);
      onClose();
    } catch (error) {
      if (error instanceof TeamDeckServiceError) {
        if (error.fieldErrors) setFieldErrors(error.fieldErrors);
        setFormError(error.message);
      } else {
        setFormError('Não foi possível definir a data da apresentação.');
      }
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Definir data da apresentação"
      subtitle={project ? project.title : undefined}
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="pres-date"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              Data da apresentação *
            </label>
            <input
              id="pres-date"
              type="date"
              value={presentationDate}
              onChange={(e) => setPresentationDate(e.target.value)}
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
              htmlFor="pres-time"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              Horário *
            </label>
            <input
              id="pres-time"
              type="time"
              value={presentationTime}
              onChange={(e) => setPresentationTime(e.target.value)}
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
        </div>

        <div>
          <label
            htmlFor="pres-location"
            className="block text-sm font-medium text-slate-700 mb-1"
          >
            Sala / Local *
          </label>
          <input
            id="pres-location"
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Ex: Auditório Paulo Freire — Sala 204"
            className={`w-full px-3.5 py-2 border rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-1 ${
              fieldErrors.location
                ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                : 'border-slate-300 focus:border-blue-700 focus:ring-blue-700'
            }`}
          />
          {fieldErrors.location && (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.location}</p>
          )}
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
            <span>Salvar data</span>
          </button>
        </div>
      </form>
    </Modal>
  );
}
