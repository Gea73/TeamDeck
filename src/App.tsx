import { useState } from 'react';
import { Plus } from 'lucide-react';
import { teamDeckService } from './services/apiClient';
import { CreateProjectPayload, NavigationRoute, Project } from './types';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { DashboardView } from './views/DashboardView';
import { ProjectsView } from './views/ProjectsView';
import { ProjectDetailView } from './views/ProjectDetailView';
import { TeamsView } from './views/TeamsView';
import { CalendarView } from './views/CalendarView';
import { SettingsView } from './views/SettingsView';
import { ProfileView } from './views/ProfileView';

export default function App() {
  const [projects, setProjects] = useState<Project[]>(() =>
    teamDeckService.getProjects()
  );
  const [members] = useState(() => teamDeckService.getTeamMembers());
  const [rehearsals] = useState(() => teamDeckService.getRehearsals());
  const [calendarEvents] = useState(() => teamDeckService.getCalendarEvents());
  const [userProfile] = useState(() => teamDeckService.getUserProfile());
  const [userSettings] = useState(() => teamDeckService.getUserSettings());

  const [activeRoute, setActiveRoute] = useState<NavigationRoute>('dashboard');
  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    () => teamDeckService.getProjects()[0]?.id ?? ''
  );
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isCreateProjectModalOpen, setIsCreateProjectModalOpen] =
    useState(false);

  const selectedProject =
    projects.find((p) => p.id === selectedProjectId) ?? projects[0];

  const handleOpenProject = (projectId: string) => {
    setSelectedProjectId(projectId);
    setActiveRoute('project-detail');
  };

  const handleCreateProject = (payload: CreateProjectPayload) => {
    const newProject = teamDeckService.createProjectModel(payload);
    setProjects((prev) => [newProject, ...prev]);
  };

  const handleOpenCreateModalFromHeader = () => {
    setActiveRoute('projects');
    setIsCreateProjectModalOpen(true);
  };

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
            activeRoute === 'dashboard' ? (
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

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1360px] w-full mx-auto">
          {activeRoute === 'dashboard' && (
            <DashboardView
              projects={projects}
              members={members}
              rehearsals={rehearsals}
              onOpenProject={handleOpenProject}
              onNavigate={setActiveRoute}
            />
          )}

          {activeRoute === 'projects' && (
            <ProjectsView
              projects={projects}
              onOpenProject={handleOpenProject}
              onCreateProject={handleCreateProject}
              isCreateModalOpen={isCreateProjectModalOpen}
              onOpenCreateModal={() => setIsCreateProjectModalOpen(true)}
              onCloseCreateModal={() => setIsCreateProjectModalOpen(false)}
            />
          )}

          {activeRoute === 'project-detail' && selectedProject && (
            <ProjectDetailView
              project={selectedProject}
              members={members}
              rehearsals={rehearsals}
              onBackToProjects={() => setActiveRoute('projects')}
            />
          )}

          {activeRoute === 'teams' && (
            <TeamsView
              members={members}
              projects={projects}
              onOpenProject={handleOpenProject}
            />
          )}

          {activeRoute === 'calendar' && (
            <CalendarView
              events={calendarEvents}
              onOpenProject={handleOpenProject}
            />
          )}

          {activeRoute === 'settings' && (
            <SettingsView initialSettings={userSettings} />
          )}

          {activeRoute === 'profile' && (
            <ProfileView
              userProfile={userProfile}
              projects={projects}
              members={members}
              onOpenProject={handleOpenProject}
            />
          )}
        </main>
      </div>
    </div>
  );
}
