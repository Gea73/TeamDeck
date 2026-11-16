import { useState } from 'react';
import {
  ArrowLeft,
  Bell,
  BookOpen,
  Calendar,
  CalendarClock,
  CalendarPlus,
  CheckCircle2,
  Clock,
  ExternalLink,
  ListChecks,
  Mail,
  MapPin,
  Pencil,
  Trash2,
  UserCheck,
  UserMinus,
  UserPlus,
  Video,
} from 'lucide-react';
import { sanitizeExternalHttpUrl } from '../domain/validators';
import {
  AssociateMemberInput,
  CreateProjectInput,
  MemberDirectoryItem,
  Project,
  ProjectDetailTab,
  RehearsalSession,
  TeamMemberAssignmentView,
  UpdateAssociationInput,
} from '../types';
import {
  formatDatePtBr,
  formatLongDatePtBr,
  getInitials,
} from '../utils/formatters';
import { AssociateMemberModal } from '../components/ui/AssociateMemberModal';
import { Card, CardHeader } from '../components/ui/Card';
import { ConfirmDeleteModal } from '../components/ui/ConfirmDeleteModal';
import { PresentationDateModal } from '../components/ui/PresentationDateModal';
import { ProgressBar } from '../components/ui/ProgressBar';
import { ProjectFormModal } from '../components/ui/ProjectFormModal';
import { StatusIndicator } from '../components/ui/StatusIndicator';
import { PdfAnalysisReview } from '../components/project/PdfAnalysisReview';
import { ContentDistributionPanel } from '../components/project/ContentDistributionPanel';
import { PresentationGeneratorPanel } from '../components/project/PresentationGeneratorPanel';
import { IndividualPreparationPanel } from '../components/project/IndividualPreparationPanel';
import { GmailDispatchPanel } from '../components/project/GmailDispatchPanel';
import { RehearsalFormModal } from '../components/ui/RehearsalFormModal';
import {
  MemberPreparationMaterial,
  PreparationReviewStatus,
} from '../types/preparation';
import {
  CreateCalendarRehearsalInput,
  EmailDispatchLog,
} from '../types/workspace';

interface ProjectDetailViewProps {
  project: Project;
  allProjects: Project[];
  allMembers: MemberDirectoryItem[];
  assignments: TeamMemberAssignmentView[];
  rehearsals: RehearsalSession[];
  isMutating: boolean;
  onBackToProjects: () => void;
  onUpdateProject: (id: string, payload: CreateProjectInput) => Promise<void>;
  onDeleteProject: (projectId: string) => Promise<void>;
  onSetPresentationDate: (
    projectId: string,
    date: string,
    time: string,
    location: string
  ) => Promise<void>;
  onAssociateMember: (input: AssociateMemberInput) => Promise<void>;
  onUpdateAssociation: (input: UpdateAssociationInput) => Promise<void>;
  onRemoveAssociation: (associationId: string) => Promise<void>;
  onAnalyzePdf: (projectId: string, file: File) => Promise<void>;
  onAutoDistribute: (projectId: string) => Promise<void>;
  onReassignSection: (
    projectId: string,
    sectionId: string,
    memberId: string
  ) => Promise<void>;
  onGenerateGoogleSlides: (params: {
    projectId: string;
    approvedSectionIds: string[];
    confirmDuplicate: boolean;
    requestId: string;
  }) => Promise<void>;
  preparations: MemberPreparationMaterial[];
  onGenerateMemberPreparation: (
    projectId: string,
    memberId: string
  ) => Promise<void>;
  onUpdateMemberPreparation: (
    material: MemberPreparationMaterial
  ) => Promise<void>;
  onTogglePreparationSectionReviewed: (
    preparationId: string,
    sectionKey: keyof PreparationReviewStatus,
    reviewed: boolean
  ) => Promise<void>;
  onMarkAllPreparationReviewed: (
    preparationId: string,
    reviewed: boolean
  ) => Promise<void>;
  emailLogs: EmailDispatchLog[];
  onSendMemberEmail: (params: {
    projectId: string;
    memberId: string;
    memberName: string;
    recipientEmail: string;
    subject: string;
    bodyText: string;
  }) => Promise<void>;
  onCreateCalendarRehearsal: (
    input: CreateCalendarRehearsalInput
  ) => Promise<void>;
}

const DETAIL_TABS: Array<{
  id: ProjectDetailTab;
  label: string;
}> = [
  { id: 'overview', label: 'Informações gerais' },
  { id: 'members', label: 'Integrantes' },
  { id: 'pdf', label: 'Documento PDF' },
  { id: 'content', label: 'Divisão de conteúdo' },
  { id: 'presentation', label: 'Apresentação' },
  { id: 'preparation', label: 'Preparação individual' },
  { id: 'communication', label: 'E-mails (Gmail)' },
  { id: 'rehearsals', label: 'Cronograma de ensaios' },
  { id: 'progress', label: 'Painel de progresso' },
];

export function ProjectDetailView({
  project,
  allProjects,
  allMembers,
  assignments,
  rehearsals,
  isMutating,
  onBackToProjects,
  onUpdateProject,
  onDeleteProject,
  onSetPresentationDate,
  onAssociateMember,
  onUpdateAssociation,
  onRemoveAssociation,
  onAnalyzePdf,
  onAutoDistribute,
  onReassignSection,
  onGenerateGoogleSlides,
  preparations,
  onGenerateMemberPreparation,
  onUpdateMemberPreparation,
  onTogglePreparationSectionReviewed,
  onMarkAllPreparationReviewed,
  emailLogs,
  onSendMemberEmail,
  onCreateCalendarRehearsal,
}: ProjectDetailViewProps) {
  const [activeTab, setActiveTab] = useState<ProjectDetailTab>('overview');
  const [selectedPrepMemberId, setSelectedPrepMemberId] = useState<
    string | null
  >(null);

  const [isEditProjectOpen, setIsEditProjectOpen] = useState(false);
  const [isDateModalOpen, setIsDateModalOpen] = useState(false);
  const [isDeleteProjectOpen, setIsDeleteProjectOpen] = useState(false);
  const [isRehearsalModalOpen, setIsRehearsalModalOpen] = useState(false);

  const [isAssociateOpen, setIsAssociateOpen] = useState(false);
  const [editingAssociation, setEditingAssociation] =
    useState<TeamMemberAssignmentView | null>(null);
  const [removingAssociation, setRemovingAssociation] =
    useState<TeamMemberAssignmentView | null>(null);

  const projectMembers = assignments.filter((m) => m.projectId === project.id);
  const projectRehearsals = rehearsals.filter((r) => r.projectId === project.id);

  const allocatedMinutes = projectMembers.reduce(
    (sum, m) => sum + m.presentationMinutes,
    0
  );

  const availableMembersToAssociate = allMembers.filter(
    (mem) => !projectMembers.some((pm) => pm.memberId === mem.id)
  );

  const handleDeleteProjectConfirm = async () => {
    await onDeleteProject(project.id);
    setIsDeleteProjectOpen(false);
    onBackToProjects();
  };

  const handleRemoveAssociationConfirm = async () => {
    if (!removingAssociation) return;
    await onRemoveAssociation(removingAssociation.associationId);
    setRemovingAssociation(null);
  };

  return (
    <div className="space-y-6">
      <Card padding="md">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div className="space-y-2 min-w-0">
            <button
              type="button"
              onClick={onBackToProjects}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 hover:text-blue-800 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Voltar para Meus projetos</span>
            </button>

            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              {project.title}
            </h2>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm text-slate-600">
              <span>{project.discipline}</span>
              <span aria-hidden="true">·</span>
              <span>{project.advisor}</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">
                {formatLongDatePtBr(project.presentationDate)} às{' '}
                {project.presentationTime}
              </span>
            </div>
          </div>

          <div className="flex flex-col items-start lg:items-end gap-3 shrink-0">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setIsDateModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors whitespace-nowrap"
              >
                <CalendarClock className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Definir data</span>
              </button>
              <button
                type="button"
                onClick={() => setIsEditProjectOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg transition-colors whitespace-nowrap"
              >
                <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Editar projeto</span>
              </button>
              <button
                type="button"
                onClick={() => setIsDeleteProjectOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 bg-white hover:bg-red-50 border border-red-200 rounded-lg transition-colors whitespace-nowrap"
              >
                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Excluir</span>
              </button>
            </div>

            <div className="flex items-center gap-4">
              <StatusIndicator status={project.status} />
              <div className="w-36">
                <ProgressBar value={project.overallProgress} size="sm" />
              </div>
            </div>
          </div>
        </div>

        <div
          className="mt-6 pt-4 border-t border-slate-200 flex items-center gap-1.5 overflow-x-auto"
          role="tablist"
          aria-label="Seções do projeto"
        >
          {DETAIL_TABS.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-blue-700 text-white'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </Card>

      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card padding="md" className="lg:col-span-2 space-y-5">
            <CardHeader
              title="Informações gerais"
              subtitle="Escopo acadêmico, orientação e logística da banca"
            />

            <p className="text-sm sm:text-base text-slate-700 leading-relaxed">
              {project.description}
            </p>

            <div className="pt-4 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="space-y-1">
                <p className="text-xs font-medium text-slate-500">Instituição</p>
                <p className="font-medium text-slate-900">{project.institution}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-slate-500">Disciplina</p>
                <p className="font-medium text-slate-900">{project.discipline}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-slate-500">
                  Docente responsável
                </p>
                <p className="font-medium text-slate-900">{project.advisor}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-slate-500">
                  Local da apresentação
                </p>
                <p className="font-medium text-slate-900 flex items-center gap-1.5">
                  <MapPin
                    className="w-4 h-4 text-blue-700 shrink-0"
                    aria-hidden="true"
                  />
                  <span>{project.location}</span>
                </p>
              </div>
            </div>
          </Card>

          <Card padding="md" className="space-y-4">
            <CardHeader
              title="Resumo operacional"
              action={
                <button
                  type="button"
                  onClick={() => setIsDateModalOpen(true)}
                  className="text-xs font-medium text-blue-700 hover:underline"
                >
                  Alterar data
                </button>
              }
            />
            <dl className="divide-y divide-slate-200 text-sm">
              <div className="py-3 flex items-center justify-between gap-3">
                <dt className="text-slate-500">Data marcada</dt>
                <dd className="font-semibold text-slate-900 tabular-nums">
                  {formatDatePtBr(project.presentationDate)}
                </dd>
              </div>
              <div className="py-3 flex items-center justify-between gap-3">
                <dt className="text-slate-500">Horário</dt>
                <dd className="font-semibold text-slate-900 tabular-nums">
                  {project.presentationTime}
                </dd>
              </div>
              <div className="py-3 flex items-center justify-between gap-3">
                <dt className="text-slate-500">Duração prevista</dt>
                <dd className="font-semibold text-slate-900 tabular-nums">
                  {project.targetDurationMinutes} min
                </dd>
              </div>
              <div className="py-3 flex items-center justify-between gap-3">
                <dt className="text-slate-500">Integrantes</dt>
                <dd className="font-semibold text-slate-900 tabular-nums">
                  {project.memberCount} participante(s)
                </dd>
              </div>
              <div className="py-3 flex items-center justify-between gap-3">
                <dt className="text-slate-500">Documento-base</dt>
                <dd className="font-semibold text-blue-700">
                  {project.pdfDocument ? 'Anexado' : 'Pendente'}
                </dd>
              </div>
            </dl>
          </Card>
        </div>
      )}

      {activeTab === 'members' && (
        <Card padding="none" className="overflow-hidden">
          <div className="p-5 sm:p-6 border-b border-slate-200">
            <CardHeader
              title="Integrantes associados"
              subtitle={`${projectMembers.length} participante(s) vinculado(s) a este projeto`}
              action={
                <button
                  type="button"
                  disabled={availableMembersToAssociate.length === 0}
                  onClick={() => {
                    setEditingAssociation(null);
                    setIsAssociateOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-700 hover:bg-blue-800 disabled:bg-slate-200 disabled:text-slate-500 text-white text-xs sm:text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
                >
                  <UserPlus className="w-4 h-4" aria-hidden="true" />
                  <span>Associar integrante</span>
                </button>
              }
            />
          </div>

          {projectMembers.length === 0 ? (
            <div className="p-8 text-center space-y-3">
              <p className="text-sm font-medium text-slate-900">
                Nenhum integrante associado a este projeto ainda.
              </p>
              <p className="text-xs text-slate-500">
                Associe participantes cadastrados na aba Equipes para definir responsabilidades e tempos de fala.
              </p>
              {availableMembersToAssociate.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingAssociation(null);
                    setIsAssociateOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-medium rounded-lg transition-colors"
                >
                  <UserPlus className="w-4 h-4" aria-hidden="true" />
                  <span>Associar integrante</span>
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {projectMembers.map((member) => (
                <div
                  key={member.associationId}
                  className="p-5 sm:px-6 flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-3.5 min-w-0">
                    <span className="w-10 h-10 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold flex items-center justify-center shrink-0">
                      {getInitials(member.name)}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">
                        {member.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {member.email} · {member.role}
                      </p>
                      <p className="mt-1.5 text-sm text-slate-700">
                        {member.responsibility}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between md:justify-end gap-5 shrink-0">
                    <div className="text-right tabular-nums">
                      <p className="text-xs text-slate-500">Tempo de fala</p>
                      <p className="text-sm font-semibold text-slate-900">
                        {member.presentationMinutes} min
                      </p>
                    </div>
                    <div className="w-32">
                      <ProgressBar value={member.progress} size="sm" />
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedPrepMemberId(member.memberId);
                          setActiveTab('preparation');
                        }}
                        title="Abrir preparação individual"
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors mr-1 whitespace-nowrap"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        <span>Preparar</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingAssociation(member);
                          setIsAssociateOpen(true);
                        }}
                        title="Editar participação"
                        aria-label={`Editar participação de ${member.name}`}
                        className="p-2 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setRemovingAssociation(member)}
                        title="Remover do projeto"
                        aria-label={`Remover ${member.name} do projeto`}
                        className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <UserMinus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {activeTab === 'pdf' && (
        <PdfAnalysisReview
          projectId={project.id}
          pdfDocument={project.pdfDocument}
          onAnalyzePdf={onAnalyzePdf}
        />
      )}

      {activeTab === 'content' && (
        <ContentDistributionPanel
          project={project}
          projectMembers={projectMembers}
          isMutating={isMutating}
          onAutoDistribute={onAutoDistribute}
          onReassignSection={onReassignSection}
        />
      )}

      {activeTab === 'presentation' && (
        <PresentationGeneratorPanel
          project={project}
          projectMembers={projectMembers}
          isMutating={isMutating}
          onGenerateGoogleSlides={onGenerateGoogleSlides}
        />
      )}

      {activeTab === 'preparation' && (
        <IndividualPreparationPanel
          project={project}
          projectMembers={projectMembers}
          preparations={preparations}
          initialSelectedMemberId={selectedPrepMemberId}
          isMutating={isMutating}
          onGeneratePreparation={onGenerateMemberPreparation}
          onUpdatePreparation={onUpdateMemberPreparation}
          onToggleSectionReviewed={onTogglePreparationSectionReviewed}
          onMarkAllReviewed={onMarkAllPreparationReviewed}
        />
      )}

      {activeTab === 'communication' && (
        <GmailDispatchPanel
          project={project}
          projectMembers={projectMembers}
          preparations={preparations}
          emailLogs={emailLogs}
          isMutating={isMutating}
          onSendMemberEmail={onSendMemberEmail}
        />
      )}

      {activeTab === 'rehearsals' && (
        <Card padding="none" className="overflow-hidden">
          <div className="p-5 sm:p-6 border-b border-slate-200">
            <CardHeader
              title="Cronograma de ensaios"
              subtitle="Encontros planejados no Google Calendar com convites e lembretes para a equipe"
              action={
                <button
                  type="button"
                  onClick={() => setIsRehearsalModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs sm:text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
                >
                  <CalendarPlus className="w-4 h-4" aria-hidden="true" />
                  <span>Agendar ensaio no Google Calendar</span>
                </button>
              }
            />
          </div>

          {projectRehearsals.length === 0 ? (
            <div className="p-8 text-center space-y-3">
              <p className="text-sm font-medium text-slate-900">
                Nenhum ensaio agendado para este projeto até o momento.
              </p>
              <button
                type="button"
                onClick={() => setIsRehearsalModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-medium rounded-lg transition-colors"
              >
                <CalendarPlus className="w-4 h-4" aria-hidden="true" />
                <span>Criar ensaio no Google Calendar</span>
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {projectRehearsals.map((session) => (
                <div
                  key={session.id}
                  className="p-5 sm:px-6 flex flex-col lg:flex-row lg:items-start justify-between gap-4"
                >
                  <div className="space-y-2 min-w-0">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h3 className="text-base font-semibold text-slate-900">
                        {session.title}
                      </h3>
                      {session.googleCalendarEventId && (
                        <span className="text-xs font-medium text-blue-700">
                          · Sincronizado com Google Calendar
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600 tabular-nums">
                      <span className="inline-flex items-center gap-1">
                        <Calendar
                          className="w-3.5 h-3.5 text-slate-400"
                          aria-hidden="true"
                        />
                        {formatDatePtBr(session.date)} às {session.time}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{session.modality}</span>
                      <span aria-hidden="true">·</span>
                      <span>{session.location}</span>
                      <span aria-hidden="true">·</span>
                      <span>{session.durationMinutes} min previstos</span>
                    </div>

                    {session.notes && (
                      <p className="text-sm text-slate-600">{session.notes}</p>
                    )}

                    {(session.attendeeEmails?.length ||
                      session.reminders?.length ||
                      session.googleCalendarEventId) && (
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-1 text-xs text-slate-500">
                        {session.attendeeEmails &&
                          session.attendeeEmails.length > 0 && (
                            <span className="inline-flex items-center gap-1">
                              <Mail className="w-3.5 h-3.5 text-slate-400" />
                              <span>
                                {session.attendeeEmails.length} convidado(s)
                              </span>
                            </span>
                          )}

                        {session.reminders && session.reminders.length > 0 && (
                          <span className="inline-flex items-center gap-1">
                            <Bell className="w-3.5 h-3.5 text-slate-400" />
                            <span>
                              {session.reminders
                                .map(
                                  (r) =>
                                    `${
                                      r.method === 'email' ? 'E-mail' : 'Popup'
                                    } ${r.minutes}min`
                                )
                                .join(', ')}
                            </span>
                          </span>
                        )}

                        {session.googleCalendarEventId && (
                          <span>
                            ID Evento:{' '}
                            <code className="font-mono text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">
                              {session.googleCalendarEventId}
                            </code>
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                    {sanitizeExternalHttpUrl(
                      session.googleMeetLink || session.meetingLink
                    ) && (
                      <a
                        href={sanitizeExternalHttpUrl(
                          session.googleMeetLink || session.meetingLink
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 text-xs font-medium rounded-lg transition-colors whitespace-nowrap"
                      >
                        <Video className="w-3.5 h-3.5" />
                        <span>Entrar na sala</span>
                      </a>
                    )}
                    {sanitizeExternalHttpUrl(session.googleCalendarHtmlLink) && (
                      <a
                        href={sanitizeExternalHttpUrl(
                          session.googleCalendarHtmlLink
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-xs font-medium rounded-lg transition-colors whitespace-nowrap"
                      >
                        <span>Google Calendar</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                    <StatusIndicator status={session.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {activeTab === 'progress' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card padding="md">
              <p className="text-xs font-medium text-slate-500">
                Progresso geral
              </p>
              <p className="mt-2 text-2xl font-semibold text-slate-900 tabular-nums">
                {project.overallProgress}%
              </p>
              <div className="mt-3">
                <ProgressBar
                  value={project.overallProgress}
                  showLabel={false}
                  size="sm"
                />
              </div>
            </Card>

            <Card padding="md">
              <p className="text-xs font-medium text-slate-500">
                Tempo alocado vs. limite
              </p>
              <p className="mt-2 text-2xl font-semibold text-slate-900 tabular-nums">
                {allocatedMinutes} / {project.targetDurationMinutes} min
              </p>
              <p className="mt-2 text-xs text-slate-500">
                {allocatedMinutes <= project.targetDurationMinutes
                  ? 'Dentro do tempo estabelecido pela banca'
                  : 'Acima do limite previsto — ajustar roteiro'}
              </p>
            </Card>

            <Card padding="md">
              <p className="text-xs font-medium text-slate-500">
                Seções revisadas
              </p>
              <p className="mt-2 text-2xl font-semibold text-slate-900 tabular-nums">
                {
                  project.contentDivision.filter((c) => c.status === 'Revisado')
                    .length
                }{' '}
                / {project.contentDivision.length}
              </p>
              <p className="mt-2 text-xs text-slate-500">
                Etapas validadas pela equipe
              </p>
            </Card>
          </div>

          <Card padding="none" className="overflow-hidden">
            <div className="p-5 sm:p-6 border-b border-slate-200">
              <CardHeader
                title="Preparação por participante"
                subtitle="Acompanhamento de entregas individuais e tempo de exposição"
              />
            </div>

            {projectMembers.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">
                Sem integrantes associados a este projeto.
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {projectMembers.map((member) => (
                  <div
                    key={member.associationId}
                    className="p-5 sm:px-6 grid grid-cols-1 md:grid-cols-12 gap-4 items-center"
                  >
                    <div className="md:col-span-5 flex items-center gap-3 min-w-0">
                      <UserCheck
                        className="w-4 h-4 text-blue-700 shrink-0"
                        aria-hidden="true"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">
                          {member.name}
                        </p>
                        <p className="text-xs text-slate-500 truncate">
                          {member.responsibility}
                        </p>
                      </div>
                    </div>

                    <div className="md:col-span-3 flex items-center gap-4 text-xs text-slate-600 tabular-nums">
                      <span className="inline-flex items-center gap-1">
                        <ListChecks
                          className="w-3.5 h-3.5 text-slate-400"
                          aria-hidden="true"
                        />
                        {member.tasksCompleted}/{member.tasksTotal} tarefas
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock
                          className="w-3.5 h-3.5 text-slate-400"
                          aria-hidden="true"
                        />
                        {member.presentationMinutes} min
                      </span>
                    </div>

                    <div className="md:col-span-4 flex items-center gap-3">
                      <div className="flex-1">
                        <ProgressBar value={member.progress} size="sm" />
                      </div>
                      {member.progress === 100 && (
                        <CheckCircle2
                          className="w-4 h-4 text-emerald-600 shrink-0"
                          aria-label="Concluído"
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      <ProjectFormModal
        isOpen={isEditProjectOpen}
        editingProject={project}
        isSubmitting={isMutating}
        onSubmit={async (values) => {
          await onUpdateProject(project.id, values);
        }}
        onClose={() => setIsEditProjectOpen(false)}
      />

      <PresentationDateModal
        isOpen={isDateModalOpen}
        project={project}
        isSubmitting={isMutating}
        onSubmit={onSetPresentationDate}
        onClose={() => setIsDateModalOpen(false)}
      />

      <ConfirmDeleteModal
        isOpen={isDeleteProjectOpen}
        title="Excluir projeto"
        description={`Tem certeza de que deseja excluir o projeto "${project.title}"? Todos os vínculos de integrantes e ensaios deste projeto serão removidos.`}
        confirmLabel="Excluir projeto"
        isSubmitting={isMutating}
        onConfirm={handleDeleteProjectConfirm}
        onClose={() => setIsDeleteProjectOpen(false)}
      />

      <AssociateMemberModal
        isOpen={isAssociateOpen}
        projects={allProjects}
        members={
          editingAssociation ? allMembers : availableMembersToAssociate
        }
        lockedProjectId={project.id}
        editingAssignment={editingAssociation}
        isSubmitting={isMutating}
        onAssociate={onAssociateMember}
        onUpdateAssociation={onUpdateAssociation}
        onClose={() => {
          setEditingAssociation(null);
          setIsAssociateOpen(false);
        }}
      />

      <ConfirmDeleteModal
        isOpen={Boolean(removingAssociation)}
        title="Remover integrante do projeto"
        description={
          removingAssociation
            ? `Deseja desassociar "${removingAssociation.name}" do projeto "${project.title}"? O cadastro do integrante continuará disponível na aba Equipes.`
            : ''
        }
        confirmLabel="Remover do projeto"
        isSubmitting={isMutating}
        onConfirm={handleRemoveAssociationConfirm}
        onClose={() => setRemovingAssociation(null)}
      />

      <RehearsalFormModal
        isOpen={isRehearsalModalOpen}
        projects={allProjects}
        assignments={assignments}
        lockedProjectId={project.id}
        isSubmitting={isMutating}
        onCreateCalendarRehearsal={onCreateCalendarRehearsal}
        onClose={() => setIsRehearsalModalOpen(false)}
      />
    </div>
  );
}
