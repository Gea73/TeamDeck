import {
  buildMemberInputsFromAssignments,
  buildProjectDistributionInputs,
  calculateDistributionSummary,
  distributeSectionsOptimally,
  formatDurationSecondsPtBr,
} from './contentDistribution';
import { Project, TeamMemberAssignmentView, ValidationResult } from '../types';
import { MemberPreparationMaterial } from '../types/preparation';
import { GmailMemberDraft } from '../types/workspace';
import { formatDatePtBr } from '../utils/formatters';
import { isValidEmailAddress } from './validators';

export { isValidEmailAddress };

export function buildPersonalizedMemberEmailDrafts(params: {
  project: Project;
  projectMembers: TeamMemberAssignmentView[];
  preparations?: MemberPreparationMaterial[];
  appBaseUrl?: string;
}): GmailMemberDraft[] {
  const { project, projectMembers, preparations = [], appBaseUrl } = params;
  if (projectMembers.length === 0) return [];

  const { sections, initialAssignments } =
    buildProjectDistributionInputs(project);
  const memberInputs = buildMemberInputsFromAssignments(projectMembers);

  const hasAllAssigned =
    sections.length > 0 &&
    sections.every((s) => Boolean(initialAssignments[s.id]));

  const distribution =
    sections.length > 0 && memberInputs.length > 0
      ? hasAllAssigned
        ? calculateDistributionSummary(
            sections,
            memberInputs,
            initialAssignments
          )
        : distributeSectionsOptimally(sections, memberInputs).summary
      : null;

  const cleanOrigin = appBaseUrl ? appBaseUrl.replace(/\/+$/, '') : '';

  return projectMembers.map((member) => {
    const memberSummary = distribution?.memberSummaries.find(
      (ms) => ms.memberId === member.memberId
    );
    const assignedSections =
      distribution?.sections.filter(
        (sec) => sec.assignedMemberId === member.memberId
      ) ?? [];

    const hasCalculatedDuration =
      memberSummary && memberSummary.sectionCount > 0;
    const presentationDurationLabel = hasCalculatedDuration
      ? `${formatDurationSecondsPtBr(memberSummary.totalSeconds)} (${
          memberSummary.sectionCount
        } seção(ões) atribuída(s))`
      : `${member.presentationMinutes} min`;

    const responsibilityLines = [
      `${member.role}: ${member.responsibility}`,
      assignedSections.length > 0
        ? `Seções atribuídas: ${assignedSections
            .map((s) => `${s.order}. ${s.title}`)
            .join('; ')}`
        : null,
    ].filter(Boolean);

    const responsibility = responsibilityLines.join(' — ');

    const materialLinks: Array<{ label: string; url: string }> = [];
    if (project.googlePresentation?.presentationUrl) {
      materialLinks.push({
        label: 'Apresentação no Google Slides',
        url: project.googlePresentation.presentationUrl,
      });
    }

    const memberPrep = preparations.find(
      (p) => p.projectId === project.id && p.memberId === member.memberId
    );
    if (cleanOrigin) {
      materialLinks.push({
        label: memberPrep
          ? 'Roteiro de Preparação Individual (TeamDeck)'
          : 'Painel do Projeto (TeamDeck)',
        url: `${cleanOrigin}/?project=${encodeURIComponent(
          project.id
        )}&member=${encodeURIComponent(member.memberId)}`,
      });
    }

    const linksSection =
      materialLinks.length > 0
        ? materialLinks.map((l) => `- ${l.label}: ${l.url}`).join('\n')
        : '- Os slides e o roteiro de preparação estão disponíveis na aba do projeto no TeamDeck.';

    const subject = `[TeamDeck] Sua preparação para "${project.title}"`;

    const bodyText = [
      `Olá, ${member.name},`,
      '',
      `Seguem as orientações individuais da sua participação no projeto "${project.title}" (${project.discipline}):`,
      '',
      `• Data e horário da apresentação: ${formatDatePtBr(
        project.presentationDate
      )} às ${project.presentationTime} (${project.location})`,
      `• Papel e responsabilidade individual: ${responsibility}`,
      `• Tempo de apresentação previsto: ${presentationDurationLabel}`,
      '',
      'Links e materiais de apoio:',
      linksSection,
      '',
      memberPrep
        ? `Status da sua preparação individual: ${
            memberPrep.allReviewed
              ? 'Material revisado.'
              : 'Material gerado no TeamDeck aguardando revisão final.'
          }`
        : 'Acesse o TeamDeck para gerar e revisar seu roteiro oral na aba "Preparação individual".',
      '',
      'Qualquer dúvida ou ajuste de horário, alinhar com a equipe antes do próximo ensaio.',
      '',
      'Atenciosamente,',
      'Equipe TeamDeck',
    ].join('\n');

    return {
      memberId: member.memberId,
      memberName: member.name,
      recipientEmail: member.email,
      responsibility,
      presentationDurationLabel,
      materialLinks,
      subject,
      bodyText,
    };
  });
}

export function validateGmailMessageInput(input: {
  recipientEmail?: string;
  subject?: string;
  bodyText?: string;
}): ValidationResult {
  const errors: Record<string, string> = {};

  if (!input.recipientEmail || !isValidEmailAddress(input.recipientEmail)) {
    errors.recipientEmail = 'Informe um endereço de e-mail válido.';
  }

  if (!input.subject || input.subject.trim().length < 3) {
    errors.subject = 'O assunto da mensagem precisa ter pelo menos 3 caracteres.';
  }

  if (!input.bodyText || input.bodyText.trim().length < 10) {
    errors.bodyText =
      'O corpo da mensagem precisa ter pelo menos 10 caracteres.';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

function encodeRfc2047Subject(subject: string): string {
  const clean = subject.replace(/[\r\n]+/g, ' ').trim();
  const base64 = Buffer.from(clean, 'utf8').toString('base64');
  return `=?UTF-8?B?${base64}?=`;
}

/**
 * Codifica uma mensagem RFC 2822 em UTF-8 para Base64URL (campo `raw` da Gmail API).
 */
export function encodeMimeEmailToBase64Url(params: {
  to: string;
  subject: string;
  bodyText: string;
  fromEmail?: string | null;
}): string {
  const sanitizedTo = params.to.replace(/[\r\n]+/g, '').trim();
  const rawBodyBase64 = Buffer.from(params.bodyText, 'utf8').toString('base64');
  // RFC 2045 exige quebra de linha a cada 76 caracteres para transferência base64
  const bodyBase64 =
    rawBodyBase64.match(/.{1,76}/g)?.join('\r\n') ?? rawBodyBase64;

  const headers: string[] = [];
  if (params.fromEmail?.trim()) {
    headers.push(`From: ${params.fromEmail.replace(/[\r\n]+/g, '').trim()}`);
  }
  headers.push(`To: ${sanitizedTo}`);
  headers.push(`Subject: ${encodeRfc2047Subject(params.subject)}`);
  headers.push('MIME-Version: 1.0');
  headers.push('Content-Type: text/plain; charset="UTF-8"');
  headers.push('Content-Transfer-Encoding: base64');

  const rawMime = `${headers.join('\r\n')}\r\n\r\n${bodyBase64}`;

  return Buffer.from(rawMime, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}
