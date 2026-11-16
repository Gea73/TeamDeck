import { useState } from 'react';
import {
  Calendar as CalendarIcon,
  CalendarPlus,
  Clock,
  ExternalLink,
  MapPin,
  Video,
} from 'lucide-react';
import { sanitizeExternalHttpUrl } from '../domain/validators';
import {
  CalendarEvent,
  Project,
  RehearsalSession,
  TeamMemberAssignmentView,
} from '../types';
import { CreateCalendarRehearsalInput } from '../types/workspace';
import { formatDatePtBr, formatLongDatePtBr } from '../utils/formatters';
import { Card, CardHeader } from '../components/ui/Card';
import { RehearsalFormModal } from '../components/ui/RehearsalFormModal';

interface CalendarViewProps {
  events: CalendarEvent[];
  projects: Project[];
  assignments: TeamMemberAssignmentView[];
  rehearsals: RehearsalSession[];
  isMutating: boolean;
  onOpenProject: (projectId: string) => void;
  onCreateCalendarRehearsal: (
    input: CreateCalendarRehearsalInput
  ) => Promise<void>;
}

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

// Calendário de Novembro de 2026 (1º de novembro de 2026 cai no domingo)
const NOVEMBER_2026_DAYS = Array.from({ length: 30 }, (_, index) => {
  const day = index + 1;
  const iso = `2026-11-${String(day).padStart(2, '0')}`;
  return { day, iso };
});

export function CalendarView({
  events,
  projects,
  assignments,
  rehearsals,
  isMutating,
  onOpenProject,
  onCreateCalendarRehearsal,
}: CalendarViewProps) {
  const [selectedDate, setSelectedDate] = useState<string>('2026-11-24');
  const [typeFilter, setTypeFilter] = useState<'Todos' | CalendarEvent['type']>(
    'Todos'
  );
  const [isRehearsalModalOpen, setIsRehearsalModalOpen] = useState(false);

  const filteredEvents = events.filter(
    (ev) => typeFilter === 'Todos' || ev.type === typeFilter
  );

  const selectedDayEvents = filteredEvents.filter(
    (ev) => ev.date === selectedDate
  );

  const upcomingEvents = [...filteredEvents].sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  const findSyncedRehearsalForEvent = (
    eventId: string
  ): RehearsalSession | undefined => {
    return rehearsals.find((r) => eventId === `ev_${r.id}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-slate-600">
          Visualize datas de apresentações oficiais, ensaios no Google Calendar
          e entregas prévias.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <div
            className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg"
            role="tablist"
            aria-label="Filtrar eventos por tipo"
          >
            {(['Todos', 'Apresentação', 'Ensaio', 'Entrega'] as const).map(
              (typeOption) => {
                const active = typeFilter === typeOption;
                return (
                  <button
                    key={typeOption}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setTypeFilter(typeOption)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      active
                        ? 'bg-white text-blue-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {typeOption}
                  </button>
                );
              }
            )}
          </div>

          {projects.length > 0 && (
            <button
              type="button"
              onClick={() => setIsRehearsalModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs sm:text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
            >
              <CalendarPlus className="w-4 h-4" aria-hidden="true" />
              <span>Agendar ensaio</span>
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        {/* Grade mensal */}
        <Card padding="md" className="xl:col-span-2">
          <CardHeader
            title="Novembro de 2026"
            subtitle="Clique em uma data para inspecionar os compromissos"
            className="mb-5"
          />

          <div className="grid grid-cols-7 gap-1.5 text-center mb-2">
            {WEEKDAYS.map((dayName) => (
              <div
                key={dayName}
                className="py-1.5 text-xs font-semibold text-slate-500"
              >
                {dayName}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {NOVEMBER_2026_DAYS.map(({ day, iso }) => {
              const dayEvents = filteredEvents.filter((ev) => ev.date === iso);
              const isSelected = selectedDate === iso;
              const hasPresentation = dayEvents.some(
                (ev) => ev.type === 'Apresentação'
              );
              const hasEvent = dayEvents.length > 0;

              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => setSelectedDate(iso)}
                  className={`min-h-[68px] sm:min-h-[78px] p-2 rounded-lg border text-left flex flex-col justify-between transition-colors ${
                    isSelected
                      ? 'border-blue-700 bg-blue-50/70'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <span
                    className={`text-xs font-semibold tabular-nums ${
                      isSelected ? 'text-blue-700' : 'text-slate-800'
                    }`}
                  >
                    {day}
                  </span>

                  {hasEvent && (
                    <span
                      className={`text-[11px] font-medium truncate w-full ${
                        hasPresentation ? 'text-blue-700' : 'text-slate-600'
                      }`}
                    >
                      {dayEvents.length === 1
                        ? dayEvents[0].type
                        : `${dayEvents.length} eventos`}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </Card>

        {/* Painel do dia selecionado e lista geral */}
        <div className="space-y-6">
          <Card padding="md">
            <CardHeader
              title={formatLongDatePtBr(selectedDate)}
              subtitle="Compromissos do dia selecionado"
              className="mb-4"
            />

            {selectedDayEvents.length === 0 ? (
              <p className="text-sm text-slate-500 py-4">
                Nenhuma apresentação ou ensaio registrado para esta data.
              </p>
            ) : (
              <div className="divide-y divide-slate-200">
                {selectedDayEvents.map((event) => {
                  const syncedRehearsal = findSyncedRehearsalForEvent(event.id);
                  return (
                    <div
                      key={event.id}
                      className="py-3.5 first:pt-0 last:pb-0 space-y-1.5"
                    >
                      <p className="text-xs font-semibold text-blue-700">
                        {event.type} · {event.time}
                      </p>
                      <p className="text-sm font-semibold text-slate-900">
                        {event.title}
                      </p>
                      <p className="text-xs text-slate-500 flex items-center gap-1.5">
                        <MapPin
                          className="w-3.5 h-3.5 text-slate-400 shrink-0"
                          aria-hidden="true"
                        />
                        <span>{event.location}</span>
                      </p>
                      <div className="flex flex-wrap items-center gap-3 pt-1">
                        <button
                          type="button"
                          onClick={() => onOpenProject(event.projectId)}
                          className="text-xs font-medium text-blue-700 hover:underline"
                        >
                          Abrir projeto vinculado
                        </button>
                        {sanitizeExternalHttpUrl(
                          syncedRehearsal?.googleCalendarHtmlLink
                        ) && (
                          <a
                            href={sanitizeExternalHttpUrl(
                              syncedRehearsal?.googleCalendarHtmlLink
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-blue-700"
                          >
                            <span>Google Calendar</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                        {sanitizeExternalHttpUrl(
                          syncedRehearsal?.googleMeetLink ||
                            syncedRehearsal?.meetingLink
                        ) && (
                          <a
                            href={sanitizeExternalHttpUrl(
                              syncedRehearsal?.googleMeetLink ||
                                syncedRehearsal?.meetingLink
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline"
                          >
                            <Video className="w-3 h-3" />
                            <span>Meet</span>
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <Card padding="none" className="overflow-hidden">
            <div className="p-5 border-b border-slate-200">
              <CardHeader
                title="Agenda completa"
                subtitle="Próximas datas acadêmicas"
              />
            </div>
            <div className="divide-y divide-slate-200 max-h-80 overflow-y-auto">
              {upcomingEvents.map((event) => {
                const syncedRehearsal = findSyncedRehearsalForEvent(event.id);
                return (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => {
                      if (event.date.startsWith('2026-11')) {
                        setSelectedDate(event.date);
                      }
                      onOpenProject(event.projectId);
                    }}
                    className="w-full text-left px-5 py-3.5 hover:bg-slate-50 transition-colors space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-blue-700">
                        {event.type}
                        {syncedRehearsal?.googleCalendarEventId
                          ? ' · Google Calendar'
                          : ''}
                      </span>
                      <span className="text-slate-500 tabular-nums inline-flex items-center gap-1">
                        <CalendarIcon className="w-3 h-3" aria-hidden="true" />
                        {formatDatePtBr(event.date)} ·{' '}
                        <Clock className="w-3 h-3" aria-hidden="true" />
                        {event.time}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {event.title}
                    </p>
                  </button>
                );
              })}
            </div>
          </Card>
        </div>
      </div>

      <RehearsalFormModal
        isOpen={isRehearsalModalOpen}
        projects={projects}
        assignments={assignments}
        defaultDate={selectedDate}
        isSubmitting={isMutating}
        onCreateCalendarRehearsal={onCreateCalendarRehearsal}
        onClose={() => setIsRehearsalModalOpen(false)}
      />
    </div>
  );
}
