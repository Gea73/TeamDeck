import React from 'react';
import {
  Calendar,
  FolderKanban,
  Layers,
  LayoutDashboard,
  Settings,
  User,
  Users,
  X,
} from 'lucide-react';
import { NavigationRoute, UserProfile } from '../../types';
import { getInitials } from '../../utils/formatters';

interface SidebarProps {
  activeRoute: NavigationRoute;
  onNavigate: (route: NavigationRoute) => void;
  userProfile: UserProfile;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
}

interface NavItem {
  id: NavigationRoute;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const PRIMARY_NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'projects', label: 'Meus projetos', icon: FolderKanban },
  { id: 'teams', label: 'Equipes', icon: Users },
  { id: 'calendar', label: 'Calendário', icon: Calendar },
  { id: 'settings', label: 'Configurações', icon: Settings },
];

export function Sidebar({
  activeRoute,
  onNavigate,
  userProfile,
  isMobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const handleSelect = (route: NavigationRoute) => {
    onNavigate(route);
    onCloseMobile();
  };

  const isRouteActive = (itemId: NavigationRoute) => {
    if (itemId === 'projects' && activeRoute === 'project-detail') {
      return true;
    }
    return activeRoute === itemId;
  };

  return (
    <>
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/35 lg:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 flex flex-col transition-transform duration-200 lg:static lg:translate-x-0 ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-label="Navegação principal"
      >
        {/* Logo TeamDeck */}
        <div className="h-16 px-5 flex items-center justify-between border-b border-slate-200 shrink-0">
          <button
            type="button"
            onClick={() => handleSelect('dashboard')}
            className="flex items-center gap-2.5 text-left focus-visible:outline-2 focus-visible:outline-blue-700 rounded-md"
          >
            <span className="w-8 h-8 rounded-lg bg-blue-700 text-white flex items-center justify-center shrink-0">
              <Layers className="w-4 h-4" aria-hidden="true" />
            </span>
            <span className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap">
              TeamDeck
            </span>
          </button>

          <button
            type="button"
            onClick={onCloseMobile}
            className="p-2 -mr-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg lg:hidden"
            aria-label="Fechar menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Links Principais */}
        <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
          {PRIMARY_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isRouteActive(item.id);

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item.id)}
                aria-current={active ? 'page' : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-blue-700 ${
                  active
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    active ? 'text-blue-700' : 'text-slate-400'
                  }`}
                />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Perfil do usuário */}
        <div className="p-3 border-t border-slate-200 shrink-0">
          <button
            type="button"
            onClick={() => handleSelect('profile')}
            aria-current={activeRoute === 'profile' ? 'page' : undefined}
            className={`w-full flex items-center gap-3 p-2.5 rounded-lg text-left transition-colors focus-visible:outline-2 focus-visible:outline-blue-700 ${
              activeRoute === 'profile'
                ? 'bg-blue-50 text-blue-800'
                : 'hover:bg-slate-50 text-slate-700'
            }`}
          >
            <span className="w-9 h-9 rounded-full bg-blue-700 text-white text-xs font-semibold flex items-center justify-center shrink-0">
              {getInitials(userProfile.name)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900 truncate">
                {userProfile.name}
              </p>
              <p className="text-xs text-slate-500 truncate">
                Perfil do usuário
              </p>
            </div>
            <User className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
          </button>
        </div>
      </aside>
    </>
  );
}
