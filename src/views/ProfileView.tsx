import {
  BookOpen,
  Building2,
  FolderKanban,
  GraduationCap,
  Mail,
} from 'lucide-react';
import {
  Project,
  TeamMemberAssignmentView,
  UserProfile,
} from '../types';
import { getInitials } from '../utils/formatters';
import { Card, CardHeader } from '../components/ui/Card';

interface ProfileViewProps {
  userProfile: UserProfile;
  projects: Project[];
  assignments: TeamMemberAssignmentView[];
  onOpenProject: (projectId: string) => void;
}

export function ProfileView({
  userProfile,
  projects,
  assignments,
  onOpenProject,
}: ProfileViewProps) {
  const userAssignments = assignments.filter(
    (m) => m.email.toLowerCase() === userProfile.email.toLowerCase()
  );

  return (
    <div className="max-w-4xl space-y-6">
      <Card padding="lg">
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          <div className="w-16 h-16 rounded-full bg-blue-700 text-white text-xl font-semibold flex items-center justify-center shrink-0">
            {getInitials(userProfile.name)}
          </div>

          <div className="space-y-1 min-w-0">
            <h2 className="text-xl font-bold text-slate-900">
              {userProfile.name}
            </h2>
            <p className="text-sm font-medium text-blue-700">
              {userProfile.role} · {userProfile.semester}
            </p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-xs sm:text-sm text-slate-600">
              <span className="inline-flex items-center gap-1.5">
                <Mail className="w-4 h-4 text-slate-400" aria-hidden="true" />
                {userProfile.email}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <GraduationCap
                  className="w-4 h-4 text-slate-400"
                  aria-hidden="true"
                />
                {userProfile.course}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Building2
                  className="w-4 h-4 text-slate-400"
                  aria-hidden="true"
                />
                {userProfile.institution}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-xs text-slate-500">Registro acadêmico</p>
            <p className="mt-1 font-semibold text-slate-900 tabular-nums">
              {userProfile.registrationId}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Projetos acompanhados</p>
            <p className="mt-1 font-semibold text-slate-900 tabular-nums">
              {projects.length} projeto(s)
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Atribuições diretas</p>
            <p className="mt-1 font-semibold text-slate-900 tabular-nums">
              {userAssignments.length} participação(ões)
            </p>
          </div>
        </div>
      </Card>

      <Card padding="none" className="overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-slate-200">
          <CardHeader
            title="Participações em apresentações"
            subtitle="Responsabilidades e tempos de fala vinculados à sua conta"
          />
        </div>

        {userAssignments.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            Você ainda não possui associações registradas nos projetos atuais.
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {userAssignments.map((assoc) => (
              <div
                key={assoc.associationId}
                className="p-5 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 text-xs text-blue-700 font-medium">
                    <BookOpen className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span>
                      {assoc.role} · {assoc.presentationMinutes} min
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-slate-900">
                    {assoc.projectName}
                  </p>
                  <p className="text-xs text-slate-500">{assoc.responsibility}</p>
                </div>

                <button
                  type="button"
                  onClick={() => onOpenProject(assoc.projectId)}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-700 hover:text-blue-800 whitespace-nowrap shrink-0"
                >
                  <FolderKanban className="w-4 h-4" aria-hidden="true" />
                  <span>Ver projeto</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
