import { lazy, Suspense, useState } from 'react';
import { AlertCircle, Loader2, Plus, RefreshCw, X } from 'lucide-react';
import { useTeamDeck } from './hooks/useTeamDeck';
import { MOCK_USER_PROFILE } from './data/mockData';
import { NavigationRoute } from './types';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { Card } from './components/ui/Card';

const DashboardView = lazy(() =>
  import('./views/DashboardView').then((m) => ({ default: m.DashboardView }))
);
const ProjectsView = lazy(() =>
  import('./views/ProjectsView').then((m) => ({ default: m.ProjectsView }))
);
const ProjectDetailView = lazy(() =>
  import('./views/ProjectDetailView').then((m) => ({
    default: m.ProjectDetailView,
  }))
);
const TeamsView = lazy(() =>
  import('./views/TeamsView').then((m) => ({ default: m.TeamsView }))
);
const CalendarView = lazy(() =>
  import('./views/CalendarView').then((m) => ({ default: m.CalendarView }))
);
const SettingsView = lazy(() =>
  import('./views/SettingsView').then((m) => ({ default: m.SettingsView }))
);
const ProfileView = lazy(() =>
  import('./views/ProfileView').then((m) => ({ default: m.ProfileView }))
);

export default function App() {
  const {
    workspace,
    isLoading,
    isMutating,
    errorMessage,
    clearError,
    reloadWorkspace,
    createProject,
    updateProject,
    setProjectPresentationDate,
    deleteProject,
    createMember,
    updateMember,
    deleteMember,
    associateMemberToProject,
    updateMemberAssociation,
    removeMemberFromProject,
    saveUserSettings,
    analyzeProjectPdf,
    autoDistributeContent,
    reassignSection,
    generateGoogleSlides,
    generateMemberPreparation,
    updateMemberPreparation,
    togglePreparationSectionReviewed,
    markAllPreparationReviewed,
    sendMemberEmail,
    createGoogleCalendarRehearsal,
  } = useTeamDeck();

  const [activeRoute, setActiveRoute] = useState<NavigationRoute>('dashboard');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isCreateProjectModalOpen, setIsCreateProjectModalOpen] =
    useState(false);

  const projects = workspace?.projects ?? [];
  const selectedProject =
    projects.find((p) => p.id === selectedProjectId) ?? projects[0];

  const handleOpenProject = (projectId: string) => {
    setSelectedProjectId(projectId);
    setActiveRoute('project-detail');
  };

  const handleOpenCreateModalFromHeader = () => {
    setActiveRoute('projects');
    setIsCreateProjectModalOpen(true);
  };

  const userProfile = workspace?.userProfile ?? MOCK_USER_PROFILE;

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex">
      <Sidebar
        activeRoute={activeRoute}
        onNavigate={setActiveRoute}
        userProfile={userProfile}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        <Header
          activeRoute={activeRoute}
          selectedProjectTitle={selectedProject?.title}
          onOpenMobileMenu={() => setIsMobileSidebarOpen(true)}
          onNavigateProjects={() => setActiveRoute('projects')}
          primaryAction={
            activeRoute === 'dashboard' && workspace ? (
              <button
                type="button"
                onClick={handleOpenCreateModalFromHeader}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs sm:text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
                <span>Novo projeto</span>
              </button>
            ) : undefined
          }
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1360px] w-full mx-auto space-y-6">
          {errorMessage && (
            <div
              role="alert"
              className="flex items-center justify-between gap-4 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-900"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <AlertCircle
                  className="w-5 h-5 text-red-600 shrink-0"
                  aria-hidden="true"
                />
                <span className="truncate">{errorMessage}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {!workspace && (
                  <button
                    type="button"
                    onClick={() => void reloadWorkspace()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-red-300 text-red-800 text-xs font-medium rounded-lg hover:bg-red-100 transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Tentar novamente</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={clearError}
                  className="p-1 text-red-700 hover:bg-red-100 rounded-md"
                  aria-label="Dispensar aviso"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {isLoading && !workspace ? (
            <div className="space-y-6" aria-busy="true" aria-label="Carregando dados">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-5">
                {[1, 2, 3, 4].map((slot) => (
                  <Card key={slot} padding="md" className="h-32 animate-pulse">
                    <div className="h-3.5 w-28 bg-slate-200 rounded" />
                    <div className="mt-4 h-7 w-16 bg-slate-200 rounded" />
                    <div className="mt-4 h-3 w-40 bg-slate-100 rounded" />
                  </Card>
                ))}
              </div>
              <Card padding="lg" className="flex items-center justify-center gap-3 py-16">
                <Loader2
                  className="w-5 h-5 text-blue-700 animate-spin"
                  aria-hidden="true"
                />
                <span className="text-sm font-medium text-slate-600">
                  Carregando projetos e equipes...
                </span>
              </Card>
            </div>
          ) : workspace ? (
            <Suspense
              fallback={
                <Card
                  padding="lg"
                  className="flex items-center justify-center gap-3 py-16"
                >
                  <Loader2
                    className="w-5 h-5 text-blue-700 animate-spin"
                    aria-hidden="true"
                  />
                  <span className="text-sm font-medium text-slate-600">
                    Carregando módulo...
                  </span>
                </Card>
              }
            >
              {activeRoute === 'dashboard' && (
                <DashboardView
                  projects={workspace.projects}
                  members={workspace.members}
                  rehearsals={workspace.rehearsals}
                  onOpenProject={handleOpenProject}
                  onNavigate={setActiveRoute}
                />
              )}

              {activeRoute === 'projects' && (
                <ProjectsView
                  projects={workspace.projects}
                  isMutating={isMutating}
                  onOpenProject={handleOpenProject}
                  onCreateProject={async (payload) => {
                    await createProject(payload);
                  }}
                  onUpdateProject={async (id, payload) => {
                    await updateProject({ ...payload, id });
                  }}
                  onDeleteProject={async (projectId) => {
                    await deleteProject(projectId);
                  }}
                  onSetPresentationDate={async (
                    projectId,
                    date,
                    time,
                    location
                  ) => {
                    await setProjectPresentationDate(
                      projectId,
                      date,
                      time,
                      location
                    );
                  }}
                  isCreateModalOpen={isCreateProjectModalOpen}
                  onOpenCreateModal={() => setIsCreateProjectModalOpen(true)}
                  onCloseCreateModal={() => setIsCreateProjectModalOpen(false)}
                />
              )}

              {activeRoute === 'project-detail' && selectedProject && (
                <ProjectDetailView
                  project={selectedProject}
                  allProjects={workspace.projects}
                  allMembers={workspace.members}
                  assignments={workspace.assignments}
                  rehearsals={workspace.rehearsals}
                  isMutating={isMutating}
                  onBackToProjects={() => setActiveRoute('projects')}
                  onUpdateProject={async (id, payload) => {
                    await updateProject({ ...payload, id });
                  }}
                  onDeleteProject={async (projectId) => {
                    await deleteProject(projectId);
                  }}
                  onSetPresentationDate={async (
                    projectId,
                    date,
                    time,
                    location
                  ) => {
                    await setProjectPresentationDate(
                      projectId,
                      date,
                      time,
                      location
                    );
                  }}
                  onAssociateMember={async (input) => {
                    await associateMemberToProject(input);
                  }}
                  onUpdateAssociation={async (input) => {
                    await updateMemberAssociation(input);
                  }}
                  onRemoveAssociation={async (associationId) => {
                    await removeMemberFromProject(associationId);
                  }}
                  onAnalyzePdf={async (projectId, file) => {
                    await analyzeProjectPdf(projectId, file);
                  }}
                  onAutoDistribute={async (projectId) => {
                    await autoDistributeContent(projectId);
                  }}
                  onReassignSection={async (projectId, sectionId, memberId) => {
                    await reassignSection(projectId, sectionId, memberId);
                  }}
                  onGenerateGoogleSlides={async (params) => {
                    await generateGoogleSlides(params);
                  }}
                  preparations={workspace.preparations}
                  onGenerateMemberPreparation={async (projectId, memberId) => {
                    await generateMemberPreparation(projectId, memberId);
                  }}
                  onUpdateMemberPreparation={async (material) => {
                    await updateMemberPreparation(material);
                  }}
                  onTogglePreparationSectionReviewed={async (
                    preparationId,
                    sectionKey,
                    reviewed
                  ) => {
                    await togglePreparationSectionReviewed(
                      preparationId,
                      sectionKey,
                      reviewed
                    );
                  }}
                  onMarkAllPreparationReviewed={async (
                    preparationId,
                    reviewed
                  ) => {
                    await markAllPreparationReviewed(preparationId, reviewed);
                  }}
                  emailLogs={workspace.emailLogs}
                  onSendMemberEmail={async (params) => {
                    await sendMemberEmail(params);
                  }}
                  onCreateCalendarRehearsal={async (input) => {
                    await createGoogleCalendarRehearsal(input);
                  }}
                />
              )}

              {activeRoute === 'project-detail' && !selectedProject && (
                <Card padding="lg" className="text-center space-y-3">
                  <p className="text-base font-semibold text-slate-900">
                    Nenhum projeto selecionado
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveRoute('projects')}
                    className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium rounded-lg"
                  >
                    Ir para Meus projetos
                  </button>
                </Card>
              )}

              {activeRoute === 'teams' && (
                <TeamsView
                  members={workspace.members}
                  assignments={workspace.assignments}
                  projects={workspace.projects}
                  isMutating={isMutating}
                  onOpenProject={handleOpenProject}
                  onCreateMember={async (input, initialAssociation) => {
                    await createMember(input, initialAssociation);
                  }}
                  onUpdateMember={async (id, input) => {
                    await updateMember({ ...input, id });
                  }}
                  onDeleteMember={async (memberId) => {
                    await deleteMember(memberId);
                  }}
                  onAssociateMember={async (input) => {
                    await associateMemberToProject(input);
                  }}
                  onUpdateAssociation={async (input) => {
                    await updateMemberAssociation(input);
                  }}
                  onRemoveAssociation={async (associationId) => {
                    await removeMemberFromProject(associationId);
                  }}
                />
              )}

              {activeRoute === 'calendar' && (
                <CalendarView
                  events={workspace.calendarEvents}
                  projects={workspace.projects}
                  assignments={workspace.assignments}
                  rehearsals={workspace.rehearsals}
                  isMutating={isMutating}
                  onOpenProject={handleOpenProject}
                  onCreateCalendarRehearsal={async (input) => {
                    await createGoogleCalendarRehearsal(input);
                  }}
                />
              )}

              {activeRoute === 'settings' && (
                <SettingsView
                  initialSettings={workspace.userSettings}
                  isMutating={isMutating}
                  onSaveSettings={async (nextSettings) => {
                    await saveUserSettings(nextSettings);
                  }}
                />
              )}

              {activeRoute === 'profile' && (
                <ProfileView
                  userProfile={workspace.userProfile}
                  projects={workspace.projects}
                  assignments={workspace.assignments}
                  onOpenProject={handleOpenProject}
                />
              )}
            </Suspense>
          ) : null}
        </main>
      </div>
    </div>
  );
}
