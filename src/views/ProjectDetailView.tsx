import { useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  ListChecks,
  MapPin,
  Presentation,
  Upload,
  UserCheck,
} from 'lucide-react';
import {
  Project,
  ProjectDetailTab,
  RehearsalSession,
  TeamMember,
} from '../types';
import {
  formatDatePtBr,
  formatLongDatePtBr,
  getInitials,
} from '../utils/formatters';
import { Card, CardHeader } from '../components/ui/Card';
import { ProgressBar } from '../components/ui/ProgressBar';
import { StatusIndicator } from '../components/ui/StatusIndicator';

interface ProjectDetailViewProps {
  project: Project;
  members: TeamMember[];
  rehearsals: RehearsalSession[];
  onBackToProjects: () => void;
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
  { id: 'rehearsals', label: 'Cronograma de ensaios' },
  { id: 'progress', label: 'Painel de progresso' },
];

export function ProjectDetailView({
  project,
  members,
  rehearsals,
  onBackToProjects,
}: ProjectDetailViewProps) {
  const [activeTab, setActiveTab] = useState<ProjectDetailTab>('overview');
  const [selectedSlideIndex, setSelectedSlideIndex] = useState(0);

  const projectMembers = members.filter((m) => m.projectId === project.id);
  const projectRehearsals = rehearsals.filter((r) => r.projectId === project.id);

  const allocatedMinutes = projectMembers.reduce(
    (sum, m) => sum + m.presentationMinutes,
    0
  );

  const activeSlide =
    project.slides[selectedSlideIndex] ?? project.slides[0] ?? null;

  return (
    <div className="space-y-6">
      {/* Cabeçalho contextual do projeto */}
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

          <div className="flex flex-row lg:flex-col items-center lg:items-end justify-between gap-3 shrink-0">
            <StatusIndicator status={project.status} />
            <div className="w-40">
              <ProgressBar value={project.overallProgress} size="sm" />
            </div>
          </div>
        </div>

        {/* Navegação interna das 7 seções do projeto */}
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

      {/* 1. Informações gerais */}
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
                <p className="text-xs font-medium text-slate-500">Docente responsável</p>
                <p className="font-medium text-slate-900">{project.advisor}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-slate-500">Local da apresentação</p>
                <p className="font-medium text-slate-900 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-blue-700 shrink-0" aria-hidden="true" />
                  <span>{project.location}</span>
                </p>
              </div>
            </div>
          </Card>

          <Card padding="md" className="space-y-4">
            <CardHeader title="Resumo operacional" />
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
                  {project.memberCount} participantes
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

      {/* 2. Integrantes */}
      {activeTab === 'members' && (
        <Card padding="none" className="overflow-hidden">
          <div className="p-5 sm:p-6 border-b border-slate-200">
            <CardHeader
              title="Integrantes da equipe"
              subtitle={`${projectMembers.length} participante(s) com atribuições definidas`}
            />
          </div>

          {projectMembers.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              Nenhum integrante detalhado cadastrado ainda para este projeto.
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {projectMembers.map((member) => (
                <div
                  key={member.id}
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

                  <div className="flex items-center justify-between md:justify-end gap-6 shrink-0">
                    <div className="text-right tabular-nums">
                      <p className="text-xs text-slate-500">Tempo de fala</p>
                      <p className="text-sm font-semibold text-slate-900">
                        {member.presentationMinutes} min
                      </p>
                    </div>
                    <div className="w-36">
                      <ProgressBar value={member.progress} size="sm" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* 3. Documento PDF */}
      {activeTab === 'pdf' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card padding="md" className="lg:col-span-2 space-y-5">
            <CardHeader
              title="Documento PDF de referência"
              subtitle="Arquivo principal utilizado para estruturar o seminário"
            />

            {project.pdfDocument ? (
              <div className="space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-slate-50 border border-slate-200 rounded-lg">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-blue-700 text-white flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {project.pdfDocument.fileName}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500 tabular-nums">
                        {project.pdfDocument.fileSize} · {project.pdfDocument.pageCount}{' '}
                        páginas · Enviado em{' '}
                        {formatDatePtBr(project.pdfDocument.uploadedAt)} por{' '}
                        {project.pdfDocument.uploadedBy}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-slate-900">
                    Síntese do conteúdo
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {project.pdfDocument.summary}
                  </p>
                </div>

                <div className="space-y-2.5 pt-4 border-t border-slate-200">
                  <h3 className="text-sm font-semibold text-slate-900">
                    Tópicos mapeados do arquivo
                  </h3>
                  <ul className="space-y-2">
                    {project.pdfDocument.extractedTopics.map((topic, index) => (
                      <li
                        key={topic}
                        className="flex items-start gap-2.5 text-sm text-slate-700"
                      >
                        <span className="text-xs font-semibold text-blue-700 tabular-nums mt-0.5">
                          {String(index + 1).padStart(2, '0')}.
                        </span>
                        <span>{topic}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <div className="p-8 border border-dashed border-slate-300 rounded-lg text-center space-y-2">
                <FileText
                  className="w-8 h-8 text-slate-400 mx-auto"
                  aria-hidden="true"
                />
                <p className="text-sm font-semibold text-slate-900">
                  Nenhum documento PDF anexado ainda
                </p>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Selecione o artigo, relatório ou roteiro em PDF do trabalho para centralizar a leitura do grupo.
                </p>
              </div>
            )}
          </Card>

          <Card padding="md" className="space-y-4">
            <CardHeader
              title="Envio de documento"
              subtitle="Substituir ou adicionar arquivo PDF"
            />
            <div className="p-6 border border-dashed border-blue-200 bg-blue-50/40 rounded-lg text-center space-y-3">
              <Upload
                className="w-6 h-6 text-blue-700 mx-auto"
                aria-hidden="true"
              />
              <div className="space-y-1">
                <p className="text-sm font-medium text-slate-900">
                  Selecione um arquivo PDF
                </p>
                <p className="text-xs text-slate-500">
                  Tamanho máximo recomendado: 25 MB
                </p>
              </div>
              <label className="inline-flex items-center justify-center px-4 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer transition-colors">
                <span>Escolher arquivo</span>
                <input type="file" accept="application/pdf" className="sr-only" />
              </label>
            </div>
          </Card>
        </div>
      )}

      {/* 4. Divisão de conteúdo */}
      {activeTab === 'content' && (
        <Card padding="none" className="overflow-hidden">
          <div className="p-5 sm:p-6 border-b border-slate-200">
            <CardHeader
              title="Divisão de conteúdo"
              subtitle="Ordem de tópicos distribuída entre os integrantes do grupo"
            />
          </div>

          {project.contentDivision.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              Nenhuma seção de conteúdo foi dividida neste projeto ainda.
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {project.contentDivision.map((item) => (
                <div
                  key={item.id}
                  className="p-5 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xs font-semibold text-blue-700 tabular-nums">
                        Parte {String(item.order).padStart(2, '0')}
                      </span>
                      <h3 className="text-base font-semibold text-slate-900">
                        {item.topicTitle}
                      </h3>
                    </div>
                    <p className="text-sm text-slate-600">{item.keyPoints}</p>
                    <p className="text-xs text-slate-500">
                      Responsável:{' '}
                      <span className="font-medium text-slate-800">
                        {item.assignedMemberName}
                      </span>
                    </p>
                  </div>

                  <div className="flex items-center gap-5 shrink-0">
                    <span className="text-xs font-semibold text-slate-700 tabular-nums whitespace-nowrap">
                      {item.estimatedMinutes} min
                    </span>
                    <StatusIndicator status={item.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* 5. Apresentação */}
      {activeTab === 'presentation' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          <Card padding="none" className="overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-200">
              <CardHeader
                title="Roteiro de slides"
                subtitle={`${project.slides.length} slide(s) estruturado(s)`}
              />
            </div>

            {project.slides.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-500">
                Nenhum slide estruturado ainda.
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {project.slides.map((slide, index) => {
                  const selected = index === selectedSlideIndex;
                  return (
                    <button
                      key={slide.id}
                      type="button"
                      onClick={() => setSelectedSlideIndex(index)}
                      className={`w-full text-left px-5 py-3.5 transition-colors flex items-start justify-between gap-3 ${
                        selected ? 'bg-blue-50' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="min-w-0">
                        <p
                          className={`text-xs font-semibold tabular-nums ${
                            selected ? 'text-blue-700' : 'text-slate-500'
                          }`}
                        >
                          Slide {String(slide.slideNumber).padStart(2, '0')}
                        </p>
                        <p className="text-sm font-semibold text-slate-900 truncate">
                          {slide.title}
                        </p>
                        <p className="text-xs text-slate-500 truncate">
                          {slide.assignedMemberName}
                        </p>
                      </div>
                      <span className="text-xs font-medium text-slate-600 tabular-nums shrink-0">
                        {slide.durationMinutes} min
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </Card>

          <Card padding="lg" className="lg:col-span-2">
            {activeSlide ? (
              <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-200">
                  <div className="flex items-center gap-2 text-xs font-semibold text-blue-700">
                    <Presentation className="w-4 h-4" aria-hidden="true" />
                    <span className="tabular-nums">
                      Slide {activeSlide.slideNumber} de {project.slides.length}
                    </span>
                  </div>
                  <span className="text-xs text-slate-500 tabular-nums">
                    Apresentador: {activeSlide.assignedMemberName} ·{' '}
                    {activeSlide.durationMinutes} min
                  </span>
                </div>

                {/* Pré-visualização limpa do slide */}
                <div className="p-6 sm:p-8 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
                  <div className="space-y-1">
                    <h3 className="text-xl sm:text-2xl font-bold text-slate-900">
                      {activeSlide.title}
                    </h3>
                    <p className="text-sm text-blue-700 font-medium">
                      {activeSlide.subtitle}
                    </p>
                  </div>

                  <ul className="space-y-2.5 pt-2">
                    {activeSlide.bulletPoints.map((point) => (
                      <li
                        key={point}
                        className="flex items-start gap-2.5 text-sm sm:text-base text-slate-700"
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full bg-blue-700 mt-2 shrink-0"
                          aria-hidden="true"
                        />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-blue-700" aria-hidden="true" />
                    <span>Notas do apresentador</span>
                  </p>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {activeSlide.speakerNotes}
                  </p>
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-sm text-slate-500">
                Selecione ou estruture os slides deste projeto para pré-visualização.
              </div>
            )}
          </Card>
        </div>
      )}

      {/* 6. Cronograma de ensaios */}
      {activeTab === 'rehearsals' && (
        <Card padding="none" className="overflow-hidden">
          <div className="p-5 sm:p-6 border-b border-slate-200">
            <CardHeader
              title="Cronograma de ensaios"
              subtitle="Encontros planejados para ajuste de ritmo, transições e cronometragem"
            />
          </div>

          {projectRehearsals.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              Nenhum ensaio agendado para este projeto até o momento.
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {projectRehearsals.map((session) => (
                <div
                  key={session.id}
                  className="p-5 sm:px-6 flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 min-w-0">
                    <h3 className="text-base font-semibold text-slate-900">
                      {session.title}
                    </h3>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600 tabular-nums">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                        {formatDatePtBr(session.date)} às {session.time}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{session.modality}</span>
                      <span aria-hidden="true">·</span>
                      <span>{session.location}</span>
                      <span aria-hidden="true">·</span>
                      <span>{session.durationMinutes} min previstos</span>
                    </div>
                    <p className="text-sm text-slate-600">{session.notes}</p>
                  </div>

                  <div className="shrink-0">
                    <StatusIndicator status={session.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* 7. Painel de progresso */}
      {activeTab === 'progress' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card padding="md">
              <p className="text-xs font-medium text-slate-500">Progresso geral</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900 tabular-nums">
                {project.overallProgress}%
              </p>
              <div className="mt-3">
                <ProgressBar value={project.overallProgress} showLabel={false} size="sm" />
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
                Sem dados individuais vinculados a este projeto.
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {projectMembers.map((member) => (
                  <div
                    key={member.id}
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
                        <ListChecks className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                        {member.tasksCompleted}/{member.tasksTotal} tarefas
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
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
    </div>
  );
}
