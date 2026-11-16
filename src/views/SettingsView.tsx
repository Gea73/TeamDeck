import React, { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { UserSettings } from '../types';
import { Card, CardHeader } from '../components/ui/Card';

interface SettingsViewProps {
  initialSettings: UserSettings;
}

export function SettingsView({ initialSettings }: SettingsViewProps) {
  const [settings, setSettings] = useState<UserSettings>(initialSettings);
  const [savedNotice, setSavedNotice] = useState(false);

  const handleSave = (event: React.FormEvent) => {
    event.preventDefault();
    setSavedNotice(true);
    window.setTimeout(() => setSavedNotice(false), 3000);
  };

  return (
    <div className="max-w-3xl space-y-6">
      <Card padding="md">
        <CardHeader
          title="Preferências da plataforma"
          subtitle="Ajuste lembretes de ensaios, parâmetros de tempo e período letivo"
          className="mb-6"
        />

        <form onSubmit={handleSave} className="space-y-6">
          <div className="divide-y divide-slate-200">
            <label className="py-4 first:pt-0 flex items-center justify-between gap-4 cursor-pointer">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  Lembretes de ensaios agendados
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Destacar ensaios confirmados com 24 horas de antecedência no painel inicial.
                </p>
              </div>
              <input
                type="checkbox"
                checked={settings.rehearsalReminders}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    rehearsalReminders: e.target.checked,
                  }))
                }
                className="w-4 h-4 accent-blue-700 rounded"
              />
            </label>

            <label className="py-4 flex items-center justify-between gap-4 cursor-pointer">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  Alertas de tempo por slide
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Exibir aviso quando a soma dos tópicos ultrapassar a duração limite da banca.
                </p>
              </div>
              <input
                type="checkbox"
                checked={settings.showTimerWarnings}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    showTimerWarnings: e.target.checked,
                  }))
                }
                className="w-4 h-4 accent-blue-700 rounded"
              />
            </label>

            <label className="py-4 flex items-center justify-between gap-4 cursor-pointer">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  Resumo semanal de progresso por e-mail
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Receber relatório consolidado das tarefas concluídas pelos integrantes.
                </p>
              </div>
              <input
                type="checkbox"
                checked={settings.emailDigest}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    emailDigest: e.target.checked,
                  }))
                }
                className="w-4 h-4 accent-blue-700 rounded"
              />
            </label>
          </div>

          <div className="pt-4 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="academic-period"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
                Período letivo ativo
              </label>
              <input
                id="academic-period"
                type="text"
                value={settings.academicPeriod}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    academicPeriod: e.target.value,
                  }))
                }
                className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 tabular-nums focus:outline-none focus:border-blue-700 focus:ring-1 focus:ring-blue-700"
              />
            </div>

            <div>
              <label
                htmlFor="slide-duration"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
                Duração padrão por slide (min)
              </label>
              <input
                id="slide-duration"
                type="number"
                min={1}
                max={15}
                value={settings.defaultSlideDuration}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    defaultSlideDuration: Number(e.target.value),
                  }))
                }
                className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 tabular-nums focus:outline-none focus:border-blue-700 focus:ring-1 focus:ring-blue-700"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="min-h-[20px]">
              {savedNotice && (
                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700">
                  <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                  Preferências atualizadas na visualização atual.
                </span>
              )}
            </div>

            <button
              type="submit"
              className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Salvar preferências
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}
