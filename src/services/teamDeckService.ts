import {
  buildAssignmentViews,
  buildCalendarEvents,
  buildMemberDirectory,
  buildProjectsView,
  hasDuplicateMemberEmail,
  isMemberAssignedToProject,
} from '../domain/projectBusiness';
import {
  buildMemberInputsFromAssignments,
  buildProjectDistributionInputs,
  calculateDistributionSummary,
  distributeSectionsOptimally,
  reassignSectionManually,
} from '../domain/contentDistribution';
import { SlideDeckBuildInput } from '../domain/googleSlidesBuilder';
import { validateGmailMessageInput } from '../domain/gmailComposer';
import { validateCalendarRehearsalInput } from '../domain/googleCalendarBuilder';
import {
  buildExclusiveMemberPreparationInput,
  isPreparationFullyReviewed,
  validatePreparationMaterialStructure,
} from '../domain/preparationValidation';
import {
  validatePdfAnalysisStructure,
  validatePdfFile,
} from '../domain/pdfValidation';
import {
  sanitizeExternalHttpUrl,
  validateAssociationInput,
  validateMemberInput,
  validatePresentationDateInput,
  validateProjectInput,
  validateUpdateAssociationInput,
} from '../domain/validators';
import {
  ITeamDeckRepository,
  teamDeckRepository,
} from '../repositories/teamDeckRepository';
import {
  AssociateMemberInput,
  CreateMemberInput,
  CreateProjectInput,
  GooglePresentationMetadata,
  MemberEntity,
  PdfDocument,
  PresentationSlide,
  ProjectEntity,
  ProjectMemberAssociation,
  ProjectStatus,
  UpdateAssociationInput,
  UpdateMemberInput,
  UpdateProjectInput,
  UserSettings,
  ValidationErrors,
  WorkspaceSnapshot,
} from '../types';
import { PdfAnalysisApiResponse } from '../types/pdfAnalysis';
import {
  MemberPreparationApiResponse,
  MemberPreparationMaterial,
  PreparationReviewStatus,
} from '../types/preparation';
import {
  CreateCalendarRehearsalInput,
  EmailDispatchLog,
  GoogleCalendarCreateResult,
} from '../types/workspace';
import { RehearsalSession, RehearsalStatus } from '../types';
import { generateUniqueId } from '../utils/id';

export class TeamDeckServiceError extends Error {
  public readonly fieldErrors?: ValidationErrors;
  public readonly code?: string;

  constructor(
    message: string,
    fieldErrors?: ValidationErrors,
    code?: string
  ) {
    super(message);
    this.name = 'TeamDeckServiceError';
    this.fieldErrors = fieldErrors;
    this.code = code;
  }
}

export class TeamDeckService {
  constructor(private readonly repository: ITeamDeckRepository) {}

  async getWorkspaceSnapshot(): Promise<WorkspaceSnapshot> {
    const [
      projectEntities,
      memberEntities,
      associations,
      rehearsals,
      preparations,
      emailLogs,
      userProfile,
      userSettings,
    ] = await Promise.all([
      this.repository.getProjects(),
      this.repository.getMembers(),
      this.repository.getProjectMembers(),
      this.repository.getRehearsals(),
      this.repository.getPreparations(),
      this.repository.getEmailLogs(),
      this.repository.getUserProfile(),
      this.repository.getUserSettings(),
    ]);

    const projects = buildProjectsView(projectEntities, associations);
    const assignments = buildAssignmentViews(
      projectEntities,
      memberEntities,
      associations
    );
    const members = buildMemberDirectory(memberEntities, assignments);
    const calendarEvents = buildCalendarEvents(projectEntities, rehearsals);

    return {
      projects,
      members,
      assignments,
      rehearsals,
      calendarEvents,
      preparations,
      emailLogs,
      userProfile,
      userSettings,
    };
  }

  // 1. Criar projeto
  async createProject(input: CreateProjectInput): Promise<WorkspaceSnapshot> {
    const validation = validateProjectInput(input);
    if (!validation.valid) {
      throw new TeamDeckServiceError(
        'Verifique os campos obrigatórios do projeto.',
        validation.errors
      );
    }

    const [projects, userProfile] = await Promise.all([
      this.repository.getProjects(),
      this.repository.getUserProfile(),
    ]);

    const now = new Date().toISOString();
    const newProject: ProjectEntity = {
      id: generateUniqueId('proj'),
      title: input.title.trim(),
      description: input.description.trim(),
      discipline: input.discipline.trim(),
      institution: userProfile.institution,
      advisor: input.advisor.trim() || 'A definir',
      presentationDate: input.presentationDate,
      presentationTime: input.presentationTime,
      location: input.location.trim(),
      targetDurationMinutes: Number(input.targetDurationMinutes),
      status: input.status,
      baseProgress: input.status === ProjectStatus.COMPLETED ? 100 : 10,
      pdfDocument: null,
      contentDivision: [],
      slides: [],
      createdAt: now,
      updatedAt: now,
    };

    await this.repository.saveProjects([newProject, ...projects]);
    return this.getWorkspaceSnapshot();
  }

  // 2. Editar projeto
  async updateProject(input: UpdateProjectInput): Promise<WorkspaceSnapshot> {
    const validation = validateProjectInput(input);
    if (!validation.valid) {
      throw new TeamDeckServiceError(
        'Verifique os dados informados para atualizar o projeto.',
        validation.errors
      );
    }

    const [projects, rehearsals] = await Promise.all([
      this.repository.getProjects(),
      this.repository.getRehearsals(),
    ]);

    const existing = projects.find((p) => p.id === input.id);
    if (!existing) {
      throw new TeamDeckServiceError('Projeto não encontrado para edição.');
    }

    const updatedTitle = input.title.trim();
    const updatedProject: ProjectEntity = {
      ...existing,
      title: updatedTitle,
      description: input.description.trim(),
      discipline: input.discipline.trim(),
      advisor: input.advisor.trim() || existing.advisor,
      presentationDate: input.presentationDate,
      presentationTime: input.presentationTime,
      location: input.location.trim(),
      targetDurationMinutes: Number(input.targetDurationMinutes),
      status: input.status,
      updatedAt: new Date().toISOString(),
    };

    const nextProjects = projects.map((p) =>
      p.id === input.id ? updatedProject : p
    );

    const nextRehearsals = rehearsals.map((r) =>
      r.projectId === input.id ? { ...r, projectName: updatedTitle } : r
    );

    await Promise.all([
      this.repository.saveProjects(nextProjects),
      this.repository.saveRehearsals(nextRehearsals),
    ]);

    return this.getWorkspaceSnapshot();
  }

  // 8. Definir a data da apresentação
  async setProjectPresentationDate(
    projectId: string,
    presentationDate: string,
    presentationTime: string,
    location: string
  ): Promise<WorkspaceSnapshot> {
    const validation = validatePresentationDateInput(
      presentationDate,
      presentationTime,
      location
    );
    if (!validation.valid) {
      throw new TeamDeckServiceError(
        'Dados inválidos para agendamento da apresentação.',
        validation.errors
      );
    }

    const projects = await this.repository.getProjects();
    const existing = projects.find((p) => p.id === projectId);
    if (!existing) {
      throw new TeamDeckServiceError('Projeto não encontrado.');
    }

    const nextProjects = projects.map((project) =>
      project.id === projectId
        ? {
            ...project,
            presentationDate,
            presentationTime,
            location: location.trim(),
            updatedAt: new Date().toISOString(),
          }
        : project
    );

    await this.repository.saveProjects(nextProjects);
    return this.getWorkspaceSnapshot();
  }

  // 3. Excluir projeto (com remoção em cascata das associações, ensaios, preparações e logs de envio)
  async deleteProject(projectId: string): Promise<WorkspaceSnapshot> {
    const [projects, associations, rehearsals, preparations, emailLogs] =
      await Promise.all([
        this.repository.getProjects(),
        this.repository.getProjectMembers(),
        this.repository.getRehearsals(),
        this.repository.getPreparations(),
        this.repository.getEmailLogs(),
      ]);

    const exists = projects.some((p) => p.id === projectId);
    if (!exists) {
      throw new TeamDeckServiceError('Projeto não encontrado para exclusão.');
    }

    await Promise.all([
      this.repository.saveProjects(projects.filter((p) => p.id !== projectId)),
      this.repository.saveProjectMembers(
        associations.filter((a) => a.projectId !== projectId)
      ),
      this.repository.saveRehearsals(
        rehearsals.filter((r) => r.projectId !== projectId)
      ),
      this.repository.savePreparations(
        preparations.filter((prep) => prep.projectId !== projectId)
      ),
      this.repository.saveEmailLogs(
        emailLogs.filter((log) => log.projectId !== projectId)
      ),
    ]);

    return this.getWorkspaceSnapshot();
  }

  // 4. Cadastrar integrante (com associação inicial opcional)
  async createMember(
    input: CreateMemberInput,
    initialAssociation?: Omit<AssociateMemberInput, 'memberId'>
  ): Promise<WorkspaceSnapshot> {
    const memberValidation = validateMemberInput(input);
    if (!memberValidation.valid) {
      throw new TeamDeckServiceError(
        'Verifique os dados do integrante.',
        memberValidation.errors
      );
    }

    const [members, projects, associations] = await Promise.all([
      this.repository.getMembers(),
      this.repository.getProjects(),
      this.repository.getProjectMembers(),
    ]);

    if (hasDuplicateMemberEmail(members, input.email)) {
      throw new TeamDeckServiceError(
        'Já existe um integrante cadastrado com este e-mail.',
        { email: 'Este e-mail já está em uso por outro integrante.' }
      );
    }

    const newMemberId = generateUniqueId('mem');
    const now = new Date().toISOString();

    if (initialAssociation && initialAssociation.projectId) {
      const assocValidation = validateAssociationInput({
        ...initialAssociation,
        memberId: newMemberId,
      });
      if (!assocValidation.valid) {
        throw new TeamDeckServiceError(
          'Verifique os dados da associação ao projeto.',
          assocValidation.errors
        );
      }

      const projectExists = projects.some(
        (p) => p.id === initialAssociation.projectId
      );
      if (!projectExists) {
        throw new TeamDeckServiceError(
          'Projeto selecionado para associação não encontrado.'
        );
      }
    }

    const newMember: MemberEntity = {
      id: newMemberId,
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      defaultRole: input.defaultRole.trim(),
      createdAt: now,
      updatedAt: now,
    };

    const nextMembers = [newMember, ...members];
    const nextAssociations = [...associations];

    if (initialAssociation && initialAssociation.projectId) {
      nextAssociations.push({
        id: generateUniqueId('pm'),
        projectId: initialAssociation.projectId,
        memberId: newMemberId,
        role: initialAssociation.role.trim(),
        responsibility: initialAssociation.responsibility.trim(),
        presentationMinutes: Number(initialAssociation.presentationMinutes),
        progress: Number(initialAssociation.progress),
        tasksCompleted: initialAssociation.progress >= 100 ? 4 : 1,
        tasksTotal: 4,
        assignedAt: now,
      });
    }

    await Promise.all([
      this.repository.saveMembers(nextMembers),
      this.repository.saveProjectMembers(nextAssociations),
    ]);

    return this.getWorkspaceSnapshot();
  }

  // 5. Editar integrante
  async updateMember(input: UpdateMemberInput): Promise<WorkspaceSnapshot> {
    const validation = validateMemberInput(input);
    if (!validation.valid) {
      throw new TeamDeckServiceError(
        'Verifique os dados do integrante.',
        validation.errors
      );
    }

    const members = await this.repository.getMembers();
    const existing = members.find((m) => m.id === input.id);
    if (!existing) {
      throw new TeamDeckServiceError('Integrante não encontrado.');
    }

    if (hasDuplicateMemberEmail(members, input.email, input.id)) {
      throw new TeamDeckServiceError(
        'Já existe outro integrante cadastrado com este e-mail.',
        { email: 'Este e-mail pertence a outro integrante.' }
      );
    }

    const nextMembers = members.map((member) =>
      member.id === input.id
        ? {
            ...member,
            name: input.name.trim(),
            email: input.email.trim().toLowerCase(),
            defaultRole: input.defaultRole.trim(),
            updatedAt: new Date().toISOString(),
          }
        : member
    );

    await this.repository.saveMembers(nextMembers);
    return this.getWorkspaceSnapshot();
  }

  // 6. Remover integrante (com limpeza em cascata das associações, preparações e logs de e-mail)
  async deleteMember(memberId: string): Promise<WorkspaceSnapshot> {
    const [members, associations, preparations, emailLogs] = await Promise.all([
      this.repository.getMembers(),
      this.repository.getProjectMembers(),
      this.repository.getPreparations(),
      this.repository.getEmailLogs(),
    ]);

    const exists = members.some((m) => m.id === memberId);
    if (!exists) {
      throw new TeamDeckServiceError('Integrante não encontrado para remoção.');
    }

    await Promise.all([
      this.repository.saveMembers(members.filter((m) => m.id !== memberId)),
      this.repository.saveProjectMembers(
        associations.filter((a) => a.memberId !== memberId)
      ),
      this.repository.savePreparations(
        preparations.filter((prep) => prep.memberId !== memberId)
      ),
      this.repository.saveEmailLogs(
        emailLogs.filter((log) => log.memberId !== memberId)
      ),
    ]);

    return this.getWorkspaceSnapshot();
  }

  // 7. Associar integrante a um projeto
  async associateMemberToProject(
    input: AssociateMemberInput
  ): Promise<WorkspaceSnapshot> {
    const validation = validateAssociationInput(input);
    if (!validation.valid) {
      throw new TeamDeckServiceError(
        'Verifique os campos da associação.',
        validation.errors
      );
    }

    const [projects, members, associations] = await Promise.all([
      this.repository.getProjects(),
      this.repository.getMembers(),
      this.repository.getProjectMembers(),
    ]);

    if (!projects.some((p) => p.id === input.projectId)) {
      throw new TeamDeckServiceError('Projeto selecionado não existe.');
    }

    if (!members.some((m) => m.id === input.memberId)) {
      throw new TeamDeckServiceError('Integrante selecionado não existe.');
    }

    if (isMemberAssignedToProject(associations, input.projectId, input.memberId)) {
      throw new TeamDeckServiceError(
        'Este integrante já está associado a este projeto.',
        { memberId: 'Este participante já faz parte da equipe do projeto.' }
      );
    }

    const newAssociation: ProjectMemberAssociation = {
      id: generateUniqueId('pm'),
      projectId: input.projectId,
      memberId: input.memberId,
      role: input.role.trim(),
      responsibility: input.responsibility.trim(),
      presentationMinutes: Number(input.presentationMinutes),
      progress: Number(input.progress),
      tasksCompleted: input.progress >= 100 ? 4 : Math.max(0, Math.round((input.progress / 100) * 4)),
      tasksTotal: 4,
      assignedAt: new Date().toISOString(),
    };

    await this.repository.saveProjectMembers([...associations, newAssociation]);
    return this.getWorkspaceSnapshot();
  }

  // Editar associação entre integrante e projeto
  async updateMemberAssociation(
    input: UpdateAssociationInput
  ): Promise<WorkspaceSnapshot> {
    const validation = validateUpdateAssociationInput(input);
    if (!validation.valid) {
      throw new TeamDeckServiceError(
        'Verifique os dados da participação no projeto.',
        validation.errors
      );
    }

    const associations = await this.repository.getProjectMembers();
    const existing = associations.find((a) => a.id === input.associationId);
    if (!existing) {
      throw new TeamDeckServiceError('Vínculo de integrante não encontrado.');
    }

    const nextAssociations = associations.map((assoc) =>
      assoc.id === input.associationId
        ? {
            ...assoc,
            role: input.role.trim(),
            responsibility: input.responsibility.trim(),
            presentationMinutes: Number(input.presentationMinutes),
            progress: Number(input.progress),
            tasksCompleted: Math.round(
              (Number(input.progress) / 100) * assoc.tasksTotal
            ),
          }
        : assoc
    );

    await this.repository.saveProjectMembers(nextAssociations);
    return this.getWorkspaceSnapshot();
  }

  // Remover associação entre integrante e projeto
  async removeMemberFromProject(
    associationId: string
  ): Promise<WorkspaceSnapshot> {
    const associations = await this.repository.getProjectMembers();
    const exists = associations.some((a) => a.id === associationId);
    if (!exists) {
      throw new TeamDeckServiceError('Vínculo não encontrado para remoção.');
    }

    await this.repository.saveProjectMembers(
      associations.filter((a) => a.id !== associationId)
    );

    return this.getWorkspaceSnapshot();
  }

  async saveUserSettings(settings: UserSettings): Promise<WorkspaceSnapshot> {
    await this.repository.saveUserSettings(settings);
    return this.getWorkspaceSnapshot();
  }

  async uploadAndAnalyzeProjectPdf(
    projectId: string,
    file: File
  ): Promise<WorkspaceSnapshot> {
    const fileValidation = validatePdfFile({
      fileName: file.name,
      mimeType: file.type || 'application/pdf',
      sizeBytes: file.size,
    });

    if (!fileValidation.valid) {
      throw new TeamDeckServiceError(
        fileValidation.error ?? 'Arquivo PDF inválido.'
      );
    }

    const [projects, userProfile] = await Promise.all([
      this.repository.getProjects(),
      this.repository.getUserProfile(),
    ]);

    const targetProject = projects.find((p) => p.id === projectId);
    if (!targetProject) {
      throw new TeamDeckServiceError('Projeto não encontrado para vincular o PDF.');
    }

    const formData = new FormData();
    formData.append('file', file);

    let response: Response;
    try {
      response = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/pdf/analyze`,
        {
          method: 'POST',
          credentials: 'include',
          body: formData,
        }
      );
    } catch (networkError) {
      throw new TeamDeckServiceError(
        `Falha de comunicação com o servidor ao enviar o PDF: ${
          networkError instanceof Error ? networkError.message : 'erro de rede'
        }`
      );
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new TeamDeckServiceError(
        `O servidor retornou uma resposta inválida (status ${response.status}).`
      );
    }

    if (!response.ok) {
      const errorObj = payload as {
        error?: string;
        details?: string[];
        code?: string;
      };
      const detailMsg =
        Array.isArray(errorObj.details) && errorObj.details.length > 0
          ? ` (${errorObj.details[0]})`
          : '';
      throw new TeamDeckServiceError(
        (errorObj.error || 'Erro ao processar documento PDF no servidor.') +
          detailMsg,
        undefined,
        errorObj.code
      );
    }

    const apiResponse = payload as PdfAnalysisApiResponse;
    const structureValidation = validatePdfAnalysisStructure(apiResponse.analysis);
    if (!structureValidation.valid || !structureValidation.data) {
      throw new TeamDeckServiceError(
        'Os dados retornados pela análise do PDF não passaram na validação estrutural.'
      );
    }

    const analysis = structureValidation.data;
    const allPages = [
      ...analysis.documentTitleSourcePages,
      ...analysis.sections.flatMap((s) => s.sourcePages),
      ...analysis.visualElements.flatMap((v) => v.sourcePages),
    ];
    const estimatedPageCount = allPages.length > 0 ? Math.max(...allPages) : 1;

    const updatedPdfDocument: PdfDocument = {
      id: generateUniqueId('pdf'),
      fileName: apiResponse.fileName,
      fileSize: apiResponse.fileSizeLabel,
      pageCount: estimatedPageCount,
      uploadedAt: apiResponse.analyzedAt.slice(0, 10),
      uploadedBy: userProfile.name,
      summary: analysis.mainObjective.text,
      extractedTopics: analysis.sections.map((section) => section.title),
      analysis,
    };

    const [projectsNow, memberEntities, associations] = await Promise.all([
      this.repository.getProjects(),
      this.repository.getMembers(),
      this.repository.getProjectMembers(),
    ]);

    const updatedPdfProject: ProjectEntity = {
      ...targetProject,
      pdfDocument: updatedPdfDocument,
      updatedAt: new Date().toISOString(),
    };

    const projectView = buildProjectsView([updatedPdfProject], associations)[0];
    const projectAssignmentViews = buildAssignmentViews(
      [updatedPdfProject],
      memberEntities,
      associations
    );
    const { sections } = buildProjectDistributionInputs(projectView);
    const memberInputs = buildMemberInputsFromAssignments(projectAssignmentViews);

    let initialSectionAssignments = targetProject.sectionAssignments;
    if (sections.length > 0 && memberInputs.length > 0) {
      const distributed = distributeSectionsOptimally(sections, memberInputs);
      initialSectionAssignments = distributed.assignmentMap;
    }

    const nextProjects = projectsNow.map((project) =>
      project.id === projectId
        ? {
            ...project,
            pdfDocument: updatedPdfDocument,
            sectionAssignments: initialSectionAssignments,
            updatedAt: new Date().toISOString(),
          }
        : project
    );

    await this.repository.saveProjects(nextProjects);
    return this.getWorkspaceSnapshot();
  }

  async autoDistributeProjectContent(
    projectId: string
  ): Promise<WorkspaceSnapshot> {
    const [projects, members, associations] = await Promise.all([
      this.repository.getProjects(),
      this.repository.getMembers(),
      this.repository.getProjectMembers(),
    ]);

    const target = projects.find((p) => p.id === projectId);
    if (!target) {
      throw new TeamDeckServiceError('Projeto não encontrado para distribuição.');
    }

    const projectView = buildProjectsView([target], associations)[0];
    const projectAssignmentViews = buildAssignmentViews(
      [target],
      members,
      associations
    );

    const { sections } = buildProjectDistributionInputs(projectView);
    const memberInputs = buildMemberInputsFromAssignments(projectAssignmentViews);

    if (sections.length === 0) {
      throw new TeamDeckServiceError(
        'Não há seções disponíveis para distribuir neste projeto.'
      );
    }

    if (memberInputs.length === 0) {
      throw new TeamDeckServiceError(
        'Associe pelo menos um integrante ao projeto antes de distribuir as seções.'
      );
    }

    const { assignmentMap } = distributeSectionsOptimally(
      sections,
      memberInputs
    );

    const nextProjects = projects.map((project) =>
      project.id === projectId
        ? {
            ...project,
            sectionAssignments: assignmentMap,
            updatedAt: new Date().toISOString(),
          }
        : project
    );

    await this.repository.saveProjects(nextProjects);
    return this.getWorkspaceSnapshot();
  }

  async reassignProjectSection(
    projectId: string,
    sectionId: string,
    memberId: string
  ): Promise<WorkspaceSnapshot> {
    const [projects, members, associations] = await Promise.all([
      this.repository.getProjects(),
      this.repository.getMembers(),
      this.repository.getProjectMembers(),
    ]);

    const target = projects.find((p) => p.id === projectId);
    if (!target) {
      throw new TeamDeckServiceError('Projeto não encontrado.');
    }

    const projectView = buildProjectsView([target], associations)[0];
    const projectAssignmentViews = buildAssignmentViews(
      [target],
      members,
      associations
    );

    const { sections, initialAssignments } =
      buildProjectDistributionInputs(projectView);
    const memberInputs = buildMemberInputsFromAssignments(projectAssignmentViews);

    if (!sections.some((s) => s.id === sectionId)) {
      throw new TeamDeckServiceError('Seção informada não pertence ao projeto.');
    }

    if (!memberInputs.some((m) => m.memberId === memberId)) {
      throw new TeamDeckServiceError(
        'O integrante selecionado não está associado a este projeto.'
      );
    }

    const { assignmentMap } = reassignSectionManually(
      sections,
      memberInputs,
      initialAssignments,
      sectionId,
      memberId
    );

    const nextProjects = projects.map((project) =>
      project.id === projectId
        ? {
            ...project,
            sectionAssignments: assignmentMap,
            updatedAt: new Date().toISOString(),
          }
        : project
    );

    await this.repository.saveProjects(nextProjects);
    return this.getWorkspaceSnapshot();
  }

  async generateGoogleSlidesPresentation(params: {
    projectId: string;
    approvedSectionIds: string[];
    confirmDuplicate: boolean;
    requestId: string;
  }): Promise<WorkspaceSnapshot> {
    const {
      projectId,
      approvedSectionIds,
      confirmDuplicate,
      requestId,
    } = params;

    if (approvedSectionIds.length === 0) {
      throw new TeamDeckServiceError(
        'Selecione e aprove pelo menos uma seção do documento antes de gerar os slides.'
      );
    }

    const [projects, members, associations] = await Promise.all([
      this.repository.getProjects(),
      this.repository.getMembers(),
      this.repository.getProjectMembers(),
    ]);

    const target = projects.find((p) => p.id === projectId);
    if (!target) {
      throw new TeamDeckServiceError('Projeto não encontrado.');
    }

    if (target.googlePresentation?.presentationId && !confirmDuplicate) {
      throw new TeamDeckServiceError(
        'Este projeto já possui uma apresentação gerada no Google Slides. Confirme para gerar uma nova versão.'
      );
    }

    const projectView = buildProjectsView([target], associations)[0];
    const projectAssignmentViews = buildAssignmentViews(
      [target],
      members,
      associations
    );

    const { sections, initialAssignments } =
      buildProjectDistributionInputs(projectView);

    if (sections.length === 0) {
      throw new TeamDeckServiceError(
        'Envie e analise um documento PDF (ou estruture seções) antes de gerar a apresentação.'
      );
    }

    const memberInputs = buildMemberInputsFromAssignments(projectAssignmentViews);
    const hasAllAssigned = sections.every((s) =>
      Boolean(initialAssignments[s.id])
    );

    const distributionSummary =
      memberInputs.length > 0 && !hasAllAssigned
        ? distributeSectionsOptimally(sections, memberInputs).summary
        : calculateDistributionSummary(
            sections,
            memberInputs,
            initialAssignments
          );

    const deckInput: SlideDeckBuildInput = {
      projectId: target.id,
      projectTitle: target.title,
      projectDescription: target.description,
      discipline: target.discipline,
      institution: target.institution,
      advisor: target.advisor,
      presentationDate: target.presentationDate,
      presentationTime: target.presentationTime,
      location: target.location,
      memberNames: projectAssignmentViews.map((m) => m.name),
      pdfFileName: target.pdfDocument?.fileName ?? null,
      pdfAnalysis: target.pdfDocument?.analysis ?? null,
      distributionSummary,
      approvedSectionIds,
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    let response: Response;
    try {
      response = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/slides/generate`,
        {
          method: 'POST',
          credentials: 'include',
          headers,
          body: JSON.stringify({
            deckInput,
            requestId,
            existingPresentationId:
              target.googlePresentation?.presentationId ?? null,
            confirmDuplicate,
          }),
        }
      );
    } catch (networkErr) {
      throw new TeamDeckServiceError(
        `Falha de comunicação com o servidor ao gerar a apresentação: ${
          networkErr instanceof Error ? networkErr.message : 'erro de rede'
        }`
      );
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new TeamDeckServiceError(
        `O servidor retornou uma resposta inválida (HTTP ${response.status}).`
      );
    }

    if (!response.ok) {
      const errObj = payload as {
        error?: string;
        details?: string[];
        code?: string;
      };
      const detail =
        Array.isArray(errObj.details) && errObj.details.length > 0
          ? ` (${errObj.details[0]})`
          : '';
      throw new TeamDeckServiceError(
        (errObj.error || 'Não foi possível gerar a apresentação no Google Slides.') +
          detail,
        undefined,
        errObj.code
      );
    }

    const result = payload as {
      presentationId?: string;
      presentationUrl?: string;
      title?: string;
      slideCount?: number;
      approvedSectionIds?: string[];
      generatedAt?: string;
      slides?: PresentationSlide[];
    };

    if (!result.presentationId || !result.presentationUrl) {
      throw new TeamDeckServiceError(
        'Resposta incompleta do servidor: identificador ou URL da apresentação ausentes.'
      );
    }

    const googlePresentation: GooglePresentationMetadata = {
      presentationId: result.presentationId,
      presentationUrl: result.presentationUrl,
      title: result.title ?? `${target.title} — TeamDeck`,
      slideCount:
        typeof result.slideCount === 'number'
          ? result.slideCount
          : result.slides?.length ?? 0,
      approvedSectionIds: result.approvedSectionIds ?? approvedSectionIds,
      generatedAt: result.generatedAt ?? new Date().toISOString(),
    };

    const currentProjects = await this.repository.getProjects();
    const nextProjects = currentProjects.map((project) =>
      project.id === projectId
        ? {
            ...project,
            googlePresentation,
            slides:
              Array.isArray(result.slides) && result.slides.length > 0
                ? result.slides
                : project.slides,
            updatedAt: new Date().toISOString(),
          }
        : project
    );

    await this.repository.saveProjects(nextProjects);
    return this.getWorkspaceSnapshot();
  }

  async generateMemberPreparation(
    projectId: string,
    memberId: string
  ): Promise<WorkspaceSnapshot> {
    const [projects, members, associations, preparations] = await Promise.all([
      this.repository.getProjects(),
      this.repository.getMembers(),
      this.repository.getProjectMembers(),
      this.repository.getPreparations(),
    ]);

    const target = projects.find((p) => p.id === projectId);
    if (!target) {
      throw new TeamDeckServiceError('Projeto não encontrado.');
    }

    const projectView = buildProjectsView([target], associations)[0];
    const projectAssignments = buildAssignmentViews(
      [target],
      members,
      associations
    );

    let exclusiveInput;
    try {
      exclusiveInput = buildExclusiveMemberPreparationInput(
        projectView,
        projectAssignments,
        memberId
      );
    } catch (err) {
      throw new TeamDeckServiceError(
        err instanceof Error
          ? err.message
          : 'Não foi possível preparar as seções do integrante.'
      );
    }

    let response: Response;
    try {
      response = await fetch(
        `/api/projects/${encodeURIComponent(
          projectId
        )}/members/${encodeURIComponent(memberId)}/preparation/generate`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(exclusiveInput),
        }
      );
    } catch (networkErr) {
      throw new TeamDeckServiceError(
        `Falha de comunicação com o servidor ao gerar a preparação individual: ${
          networkErr instanceof Error ? networkErr.message : 'erro de rede'
        }`
      );
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new TeamDeckServiceError(
        `O servidor retornou uma resposta inválida (HTTP ${response.status}).`
      );
    }

    if (!response.ok) {
      const errObj = payload as {
        error?: string;
        details?: string[];
        code?: string;
      };
      const detail =
        Array.isArray(errObj.details) && errObj.details.length > 0
          ? ` (${errObj.details[0]})`
          : '';
      throw new TeamDeckServiceError(
        (errObj.error || 'Erro ao gerar o material de preparação individual.') +
          detail,
        undefined,
        errObj.code
      );
    }

    const apiResp = payload as MemberPreparationApiResponse;
    const allowedSectionIds = exclusiveInput.assignedSections.map(
      (s) => s.sectionId
    );
    const validation = validatePreparationMaterialStructure(
      apiResp.material,
      allowedSectionIds
    );
    if (!validation.valid || !validation.data) {
      throw new TeamDeckServiceError(
        'O material de preparação retornado pelo servidor falhou na validação estrutural.'
      );
    }

    const now = new Date().toISOString();
    const existing = preparations.find(
      (p) => p.projectId === projectId && p.memberId === memberId
    );

    const newMaterial: MemberPreparationMaterial = {
      id: existing?.id ?? generateUniqueId('prep'),
      projectId,
      memberId,
      memberName: exclusiveInput.memberName,
      memberRole: exclusiveInput.memberRole,
      assignedSectionIds: allowedSectionIds,
      assignedSectionTitles: exclusiveInput.assignedSections.map(
        (s) => s.title
      ),
      calculatedDurationSeconds: exclusiveInput.calculatedDurationSeconds,
      totalTargetWordCount: exclusiveInput.totalTargetWordCount,
      overviewSummary: validation.data.overviewSummary,
      detailedScript: validation.data.detailedScript,
      technicalConcepts: validation.data.technicalConcepts,
      practicalExamples: validation.data.practicalExamples,
      audienceQuestions: validation.data.audienceQuestions,
      slideTransitions: validation.data.slideTransitions,
      reviewedSections: {
        scriptReviewed: false,
        conceptsReviewed: false,
        examplesReviewed: false,
        questionsReviewed: false,
        transitionsReviewed: false,
      },
      allReviewed: false,
      generatedAt: apiResp.generatedAt || now,
      updatedAt: now,
      reviewedAt: null,
      model: apiResp.model,
    };

    const nextPreparations = existing
      ? preparations.map((p) =>
          p.projectId === projectId && p.memberId === memberId
            ? newMaterial
            : p
        )
      : [newMaterial, ...preparations];

    await this.repository.savePreparations(nextPreparations);
    return this.getWorkspaceSnapshot();
  }

  async updateMemberPreparation(
    updatedMaterial: MemberPreparationMaterial
  ): Promise<WorkspaceSnapshot> {
    const preparations = await this.repository.getPreparations();
    const exists = preparations.some((p) => p.id === updatedMaterial.id);
    if (!exists) {
      throw new TeamDeckServiceError(
        'Material de preparação não encontrado para atualização.'
      );
    }

    const allReviewed = isPreparationFullyReviewed(
      updatedMaterial.reviewedSections
    );
    const now = new Date().toISOString();

    const nextPreparations = preparations.map((p) =>
      p.id === updatedMaterial.id
        ? {
            ...updatedMaterial,
            allReviewed,
            updatedAt: now,
            reviewedAt: allReviewed ? p.reviewedAt ?? now : null,
          }
        : p
    );

    await this.repository.savePreparations(nextPreparations);
    return this.getWorkspaceSnapshot();
  }

  async togglePreparationSectionReviewed(
    preparationId: string,
    sectionKey: keyof PreparationReviewStatus,
    reviewed: boolean
  ): Promise<WorkspaceSnapshot> {
    const preparations = await this.repository.getPreparations();
    const target = preparations.find((p) => p.id === preparationId);
    if (!target) {
      throw new TeamDeckServiceError('Material de preparação não encontrado.');
    }

    const nextStatus: PreparationReviewStatus = {
      ...target.reviewedSections,
      [sectionKey]: reviewed,
    };
    const allReviewed = isPreparationFullyReviewed(nextStatus);
    const now = new Date().toISOString();

    const nextPreparations = preparations.map((p) =>
      p.id === preparationId
        ? {
            ...p,
            reviewedSections: nextStatus,
            allReviewed,
            updatedAt: now,
            reviewedAt: allReviewed ? now : null,
          }
        : p
    );

    await this.repository.savePreparations(nextPreparations);
    return this.getWorkspaceSnapshot();
  }

  async markAllPreparationReviewed(
    preparationId: string,
    reviewed: boolean
  ): Promise<WorkspaceSnapshot> {
    const preparations = await this.repository.getPreparations();
    const target = preparations.find((p) => p.id === preparationId);
    if (!target) {
      throw new TeamDeckServiceError('Material de preparação não encontrado.');
    }

    const nextStatus: PreparationReviewStatus = {
      scriptReviewed: reviewed,
      conceptsReviewed: reviewed,
      examplesReviewed: reviewed,
      questionsReviewed: reviewed,
      transitionsReviewed: reviewed,
    };
    const now = new Date().toISOString();

    const nextPreparations = preparations.map((p) =>
      p.id === preparationId
        ? {
            ...p,
            reviewedSections: nextStatus,
            allReviewed: reviewed,
            updatedAt: now,
            reviewedAt: reviewed ? now : null,
          }
        : p
    );

    await this.repository.savePreparations(nextPreparations);
    return this.getWorkspaceSnapshot();
  }

  // Envio real de e-mail personalizado via Gmail API com registro de status e tentativas
  async sendProjectMemberEmail(params: {
    projectId: string;
    memberId: string;
    memberName: string;
    recipientEmail: string;
    subject: string;
    bodyText: string;
  }): Promise<{ snapshot: WorkspaceSnapshot; log: EmailDispatchLog }> {
    const validation = validateGmailMessageInput({
      recipientEmail: params.recipientEmail,
      subject: params.subject,
      bodyText: params.bodyText,
    });

    if (!validation.valid) {
      throw new TeamDeckServiceError(
        'Verifique o destinatário, assunto e corpo da mensagem.',
        validation.errors
      );
    }

    const emailLogs = await this.repository.getEmailLogs();
    const previousLog = emailLogs.find(
      (l) => l.projectId === params.projectId && l.memberId === params.memberId
    );
    const attemptCount = (previousLog?.attemptCount ?? 0) + 1;
    const now = new Date().toISOString();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    let response: Response | null = null;
    let payload: unknown = null;
    let failureMessage: string | null = null;
    let failureCode: string | undefined;

    try {
      response = await fetch(
        `/api/projects/${encodeURIComponent(params.projectId)}/gmail/send`,
        {
          method: 'POST',
          credentials: 'include',
          headers,
          body: JSON.stringify({
            memberId: params.memberId,
            recipientEmail: params.recipientEmail.trim(),
            subject: params.subject.trim(),
            bodyText: params.bodyText.trim(),
          }),
        }
      );

      payload = await response.json().catch(() => null);
      if (!response.ok) {
        const errObj = (payload ?? {}) as { error?: string; code?: string };
        failureMessage =
          errObj.error || `Falha na Gmail API (HTTP ${response.status}).`;
        failureCode = errObj.code;
      }
    } catch (networkErr) {
      failureMessage = `Falha de rede ao enviar mensagem pela Gmail API: ${
        networkErr instanceof Error ? networkErr.message : 'erro de conexão'
      }`;
    }

    const apiOk = payload as {
      gmailMessageId?: string;
      gmailThreadId?: string | null;
      sentAt?: string;
    } | null;

    if (!failureMessage && (!apiOk || !apiOk.gmailMessageId)) {
      failureMessage =
        'A Gmail API não retornou o identificador de confirmação da mensagem.';
    }

    if (failureMessage) {
      const failedLog: EmailDispatchLog = {
        id: previousLog?.id ?? generateUniqueId('mail'),
        projectId: params.projectId,
        memberId: params.memberId,
        memberName: params.memberName,
        recipientEmail: params.recipientEmail.trim(),
        subject: params.subject.trim(),
        bodyText: params.bodyText.trim(),
        status: 'failed',
        gmailMessageId: null,
        gmailThreadId: null,
        errorMessage: failureMessage,
        attemptCount,
        lastAttemptAt: now,
        sentAt: null,
      };

      const nextLogs = previousLog
        ? emailLogs.map((l) => (l.id === previousLog.id ? failedLog : l))
        : [failedLog, ...emailLogs];

      await this.repository.saveEmailLogs(nextLogs);
      throw new TeamDeckServiceError(failureMessage, undefined, failureCode);
    }

    const sentLog: EmailDispatchLog = {
      id: previousLog?.id ?? generateUniqueId('mail'),
      projectId: params.projectId,
      memberId: params.memberId,
      memberName: params.memberName,
      recipientEmail: params.recipientEmail.trim(),
      subject: params.subject.trim(),
      bodyText: params.bodyText.trim(),
      status: 'sent',
      gmailMessageId: apiOk!.gmailMessageId!,
      gmailThreadId: apiOk!.gmailThreadId ?? null,
      errorMessage: null,
      attemptCount,
      lastAttemptAt: now,
      sentAt: apiOk!.sentAt ?? now,
    };

    const nextLogs = previousLog
      ? emailLogs.map((l) => (l.id === previousLog.id ? sentLog : l))
      : [sentLog, ...emailLogs];

    await this.repository.saveEmailLogs(nextLogs);
    const snapshot = await this.getWorkspaceSnapshot();
    return { snapshot, log: sentLog };
  }

  // Criação real de ensaio no Google Calendar + persistência do eventId somente após confirmação da API
  async createRehearsalWithGoogleCalendar(
    input: CreateCalendarRehearsalInput
  ): Promise<WorkspaceSnapshot> {
    const validation = validateCalendarRehearsalInput(input);
    if (!validation.valid) {
      throw new TeamDeckServiceError(
        'Verifique os dados do ensaio antes de agendar no Google Calendar.',
        validation.errors
      );
    }

    const [projects, rehearsals] = await Promise.all([
      this.repository.getProjects(),
      this.repository.getRehearsals(),
    ]);

    const targetProject = projects.find((p) => p.id === input.projectId);
    if (!targetProject) {
      throw new TeamDeckServiceError('Projeto não encontrado para o ensaio.');
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    let response: Response;
    try {
      response = await fetch(
        `/api/projects/${encodeURIComponent(
          input.projectId
        )}/calendar/rehearsals`,
        {
          method: 'POST',
          credentials: 'include',
          headers,
          body: JSON.stringify({
            ...input,
            projectName: targetProject.title,
          }),
        }
      );
    } catch (networkErr) {
      throw new TeamDeckServiceError(
        `Falha de rede ao criar evento no Google Calendar: ${
          networkErr instanceof Error ? networkErr.message : 'erro de conexão'
        }`
      );
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new TeamDeckServiceError(
        `Resposta inválida do servidor ao criar evento (HTTP ${response.status}).`
      );
    }

    if (!response.ok) {
      const errObj = payload as { error?: string; code?: string };
      throw new TeamDeckServiceError(
        errObj.error || 'Não foi possível criar o ensaio no Google Calendar.',
        undefined,
        errObj.code
      );
    }

    const calResult = payload as GoogleCalendarCreateResult;
    if (!calResult.googleCalendarEventId) {
      throw new TeamDeckServiceError(
        'O Google Calendar não confirmou o ID do evento criado.'
      );
    }

    const safeMeetLink = sanitizeExternalHttpUrl(
      calResult.googleMeetLink || input.meetingLink
    );
    const safeHtmlLink = sanitizeExternalHttpUrl(
      calResult.googleCalendarHtmlLink
    );

    const newRehearsal: RehearsalSession = {
      id: generateUniqueId('reh'),
      projectId: targetProject.id,
      projectName: targetProject.title,
      title: input.title.trim(),
      description: input.description.trim(),
      date: input.date,
      time: input.time,
      location:
        input.location.trim() ||
        safeMeetLink ||
        'Google Meet',
      modality: input.modality,
      durationMinutes: Number(input.durationMinutes),
      status: RehearsalStatus.CONFIRMED,
      notes: input.description.trim(),
      attendeeEmails: input.attendeeEmails,
      meetingLink: safeMeetLink,
      reminders: input.reminders,
      googleCalendarEventId: calResult.googleCalendarEventId,
      googleCalendarHtmlLink: safeHtmlLink,
      googleMeetLink: sanitizeExternalHttpUrl(calResult.googleMeetLink),
      syncedAt: calResult.syncedAt,
    };

    await this.repository.saveRehearsals([newRehearsal, ...rehearsals]);
    return this.getWorkspaceSnapshot();
  }
}

export const teamDeckService = new TeamDeckService(teamDeckRepository);
