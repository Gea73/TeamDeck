import React from 'react';
import { ChevronRight, Menu } from 'lucide-react';
import { NavigationRoute } from '../../types';

interface HeaderProps {
  activeRoute: NavigationRoute;
  selectedProjectTitle?: string;
  onOpenMobileMenu: () => void;
  onNavigateProjects: () => void;
  primaryAction?: React.ReactNode;
}

const ROUTE_TITLES: Record<NavigationRoute, string> = {
  dashboard: 'Dashboard',
  projects: 'Meus projetos',
  'project-detail': 'Detalhes do projeto',
  teams: 'Equipes',
  calendar: 'Calendário',
  settings: 'Configurações',
  profile: 'Perfil do usuário',
};

export function Header({
  activeRoute,
  selectedProjectTitle,
  onOpenMobileMenu,
  onNavigateProjects,
  primaryAction,
}: HeaderProps) {
  return (
    <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4 shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="p-2 -ml-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg lg:hidden focus-visible:outline-2 focus-visible:outline-blue-700"
          aria-label="Abrir menu lateral"
        >
          <Menu className="w-5 h-5" />
        </button>

        {activeRoute === 'project-detail' && selectedProjectTitle ? (
          <nav aria-label="Caminho de navegação" className="flex items-center gap-2 min-w-0 text-sm">
            <button
              type="button"
              onClick={onNavigateProjects}
              className="text-slate-500 hover:text-blue-700 font-medium whitespace-nowrap shrink-0 transition-colors"
            >
              Meus projetos
            </button>
            <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
            <span className="font-semibold text-slate-900 truncate">
              {selectedProjectTitle}
            </span>
          </nav>
        ) : (
          <h1 className="text-lg sm:text-xl font-semibold text-slate-900 tracking-tight truncate">
            {ROUTE_TITLES[activeRoute]}
          </h1>
        )}
      </div>

      {primaryAction && <div className="shrink-0">{primaryAction}</div>}
    </header>
  );
}
