import { useCallback, useEffect, useState } from 'react';
import {
  teamDeckService,
  TeamDeckServiceError,
} from '../services/teamDeckService';
import {
  AssociateMemberInput,
  CreateMemberInput,
  CreateProjectInput,
  UpdateAssociationInput,
  UpdateMemberInput,
  UpdateProjectInput,
  UserSettings,
  WorkspaceSnapshot,
} from '../types';
import {
  MemberPreparationMaterial,
  PreparationReviewStatus,
} from '../types/preparation';
import { CreateCalendarRehearsalInput } from '../types/workspace';

export function useTeamDeck() {
  const [workspace, setWorkspace] = useState<WorkspaceSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isMutating, setIsMutating] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadWorkspace = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const snapshot = await teamDeckService.getWorkspaceSnapshot();
      setWorkspace(snapshot);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível carregar os dados do TeamDeck.'
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  const executeMutation = useCallback(
    async (action: () => Promise<WorkspaceSnapshot>) => {
      setIsMutating(true);
      setErrorMessage(null);
      try {
        const updatedSnapshot = await action();
        setWorkspace(updatedSnapshot);
        return updatedSnapshot;
      } catch (error) {
        if (!(error instanceof TeamDeckServiceError && error.fieldErrors)) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : 'Ocorreu um erro ao salvar as alterações.'
          );
        }
        throw error;
      } finally {
        setIsMutating(false);
      }
    },
    []
  );

  const createProject = useCallback(
    (input: CreateProjectInput) =>
      executeMutation(() => teamDeckService.createProject(input)),
    [executeMutation]
  );

  const updateProject = useCallback(
    (input: UpdateProjectInput) =>
      executeMutation(() => teamDeckService.updateProject(input)),
    [executeMutation]
  );

  const setProjectPresentationDate = useCallback(
    (
      projectId: string,
      presentationDate: string,
      presentationTime: string,
      location: string
    ) =>
      executeMutation(() =>
        teamDeckService.setProjectPresentationDate(
          projectId,
          presentationDate,
          presentationTime,
          location
        )
      ),
    [executeMutation]
  );

  const deleteProject = useCallback(
    (projectId: string) =>
      executeMutation(() => teamDeckService.deleteProject(projectId)),
    [executeMutation]
  );

  const createMember = useCallback(
    (
      input: CreateMemberInput,
      initialAssociation?: Omit<AssociateMemberInput, 'memberId'>
    ) =>
      executeMutation(() =>
        teamDeckService.createMember(input, initialAssociation)
      ),
    [executeMutation]
  );

  const updateMember = useCallback(
    (input: UpdateMemberInput) =>
      executeMutation(() => teamDeckService.updateMember(input)),
    [executeMutation]
  );

  const deleteMember = useCallback(
    (memberId: string) =>
      executeMutation(() => teamDeckService.deleteMember(memberId)),
    [executeMutation]
  );

  const associateMemberToProject = useCallback(
    (input: AssociateMemberInput) =>
      executeMutation(() => teamDeckService.associateMemberToProject(input)),
    [executeMutation]
  );

  const updateMemberAssociation = useCallback(
    (input: UpdateAssociationInput) =>
      executeMutation(() => teamDeckService.updateMemberAssociation(input)),
    [executeMutation]
  );

  const removeMemberFromProject = useCallback(
    (associationId: string) =>
      executeMutation(() =>
        teamDeckService.removeMemberFromProject(associationId)
      ),
    [executeMutation]
  );

  const saveUserSettings = useCallback(
    (settings: UserSettings) =>
      executeMutation(() => teamDeckService.saveUserSettings(settings)),
    [executeMutation]
  );

  const analyzeProjectPdf = useCallback(
    (projectId: string, file: File) =>
      executeMutation(() =>
        teamDeckService.uploadAndAnalyzeProjectPdf(projectId, file)
      ),
    [executeMutation]
  );

  const autoDistributeContent = useCallback(
    (projectId: string) =>
      executeMutation(() =>
        teamDeckService.autoDistributeProjectContent(projectId)
      ),
    [executeMutation]
  );

  const reassignSection = useCallback(
    (projectId: string, sectionId: string, memberId: string) =>
      executeMutation(() =>
        teamDeckService.reassignProjectSection(projectId, sectionId, memberId)
      ),
    [executeMutation]
  );

  const generateGoogleSlides = useCallback(
    (params: {
      projectId: string;
      approvedSectionIds: string[];
      confirmDuplicate: boolean;
      requestId: string;
    }) =>
      executeMutation(() =>
        teamDeckService.generateGoogleSlidesPresentation(params)
      ),
    [executeMutation]
  );

  const generateMemberPreparation = useCallback(
    (projectId: string, memberId: string) =>
      executeMutation(() =>
        teamDeckService.generateMemberPreparation(projectId, memberId)
      ),
    [executeMutation]
  );

  const updateMemberPreparation = useCallback(
    (material: MemberPreparationMaterial) =>
      executeMutation(() =>
        teamDeckService.updateMemberPreparation(material)
      ),
    [executeMutation]
  );

  const togglePreparationSectionReviewed = useCallback(
    (
      preparationId: string,
      sectionKey: keyof PreparationReviewStatus,
      reviewed: boolean
    ) =>
      executeMutation(() =>
        teamDeckService.togglePreparationSectionReviewed(
          preparationId,
          sectionKey,
          reviewed
        )
      ),
    [executeMutation]
  );

  const markAllPreparationReviewed = useCallback(
    (preparationId: string, reviewed: boolean) =>
      executeMutation(() =>
        teamDeckService.markAllPreparationReviewed(preparationId, reviewed)
      ),
    [executeMutation]
  );

  const sendMemberEmail = useCallback(
    (params: {
      projectId: string;
      memberId: string;
      memberName: string;
      recipientEmail: string;
      subject: string;
      bodyText: string;
    }) =>
      executeMutation(async () => {
        const result = await teamDeckService.sendProjectMemberEmail(params);
        return result.snapshot;
      }),
    [executeMutation]
  );

  const createGoogleCalendarRehearsal = useCallback(
    (input: CreateCalendarRehearsalInput) =>
      executeMutation(() =>
        teamDeckService.createRehearsalWithGoogleCalendar(input)
      ),
    [executeMutation]
  );

  return {
    workspace,
    isLoading,
    isMutating,
    errorMessage,
    clearError: () => setErrorMessage(null),
    reloadWorkspace: loadWorkspace,
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
  };
}
