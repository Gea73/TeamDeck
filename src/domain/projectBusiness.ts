import {
  CalendarEvent,
  MemberDirectoryItem,
  MemberEntity,
  Project,
  ProjectEntity,
  ProjectMemberAssociation,
  ProjectStatus,
  RehearsalSession,
  TeamMemberAssignmentView,
} from '../types';

export function calculateProjectOverallProgress(
  project: ProjectEntity,
  projectAssignments: ProjectMemberAssociation[]
): number {
  if (project.status === ProjectStatus.COMPLETED) {
    return 100;
  }

  if (projectAssignments.length === 0) {
    return project.baseProgress;
  }

  const total = projectAssignments.reduce((sum, item) => sum + item.progress, 0);
  return Math.round(total / projectAssignments.length);
}

export function buildProjectsView(
  projects: ProjectEntity[],
  associations: ProjectMemberAssociation[]
): Project[] {
  return projects.map((project) => {
    const projectAssociations = associations.filter(
      (assoc) => assoc.projectId === project.id
    );

    return {
      ...project,
      memberCount: projectAssociations.length,
      overallProgress: calculateProjectOverallProgress(
        project,
        projectAssociations
      ),
    };
  });
}

export function buildAssignmentViews(
  projects: ProjectEntity[],
  members: MemberEntity[],
  associations: ProjectMemberAssociation[]
): TeamMemberAssignmentView[] {
  const projectMap = new Map(projects.map((p) => [p.id, p]));
  const memberMap = new Map(members.map((m) => [m.id, m]));

  const views: TeamMemberAssignmentView[] = [];

  for (const assoc of associations) {
    const project = projectMap.get(assoc.projectId);
    const member = memberMap.get(assoc.memberId);

    if (!project || !member) continue;

    views.push({
      associationId: assoc.id,
      memberId: member.id,
      projectId: project.id,
      projectName: project.title,
      name: member.name,
      email: member.email,
      role: assoc.role,
      responsibility: assoc.responsibility,
      presentationMinutes: assoc.presentationMinutes,
      progress: assoc.progress,
      tasksCompleted: assoc.tasksCompleted,
      tasksTotal: assoc.tasksTotal,
    });
  }

  return views;
}

export function buildMemberDirectory(
  members: MemberEntity[],
  assignmentViews: TeamMemberAssignmentView[]
): MemberDirectoryItem[] {
  return members.map((member) => {
    const memberAssignments = assignmentViews.filter(
      (item) => item.memberId === member.id
    );

    const totalPresentationMinutes = memberAssignments.reduce(
      (sum, item) => sum + item.presentationMinutes,
      0
    );

    const averageProgress =
      memberAssignments.length > 0
        ? Math.round(
            memberAssignments.reduce((sum, item) => sum + item.progress, 0) /
              memberAssignments.length
          )
        : 0;

    return {
      ...member,
      assignments: memberAssignments,
      totalPresentationMinutes,
      averageProgress,
    };
  });
}

export function buildCalendarEvents(
  projects: ProjectEntity[],
  rehearsals: RehearsalSession[]
): CalendarEvent[] {
  const presentationEvents: CalendarEvent[] = projects.map((project) => ({
    id: `cal_pres_${project.id}`,
    date: project.presentationDate,
    time: project.presentationTime,
    title: `Apresentação — ${project.title}`,
    projectId: project.id,
    projectName: project.title,
    type: 'Apresentação',
    location: project.location,
  }));

  const rehearsalEvents: CalendarEvent[] = rehearsals.map((rehearsal) => ({
    id: `cal_reh_${rehearsal.id}`,
    date: rehearsal.date,
    time: rehearsal.time,
    title: rehearsal.title,
    projectId: rehearsal.projectId,
    projectName: rehearsal.projectName,
    type: 'Ensaio',
    location: rehearsal.location,
  }));

  return [...presentationEvents, ...rehearsalEvents].sort((a, b) =>
    `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`)
  );
}

export function hasDuplicateMemberEmail(
  members: MemberEntity[],
  email: string,
  ignoreMemberId?: string
): boolean {
  const normalized = email.trim().toLowerCase();
  return members.some(
    (member) =>
      member.id !== ignoreMemberId && member.email.trim().toLowerCase() === normalized
  );
}

export function isMemberAssignedToProject(
  associations: ProjectMemberAssociation[],
  projectId: string,
  memberId: string
): boolean {
  return associations.some(
    (assoc) => assoc.projectId === projectId && assoc.memberId === memberId
  );
}
