import {
  AssociateMemberInput,
  CreateMemberInput,
  CreateProjectInput,
  ProjectStatus,
  UpdateAssociationInput,
  ValidationErrors,
  ValidationResult,
} from '../types';

const STRICT_EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
const DATE_ISO_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidEmailAddress(email: string): boolean {
  const trimmed = email.trim();
  if (!trimmed || trimmed.length > 254) return false;
  const [localPart] = trimmed.split('@');
  if (!localPart || localPart.length > 64) return false;
  if (localPart.startsWith('.') || localPart.endsWith('.') || localPart.includes('..')) {
    return false;
  }
  return STRICT_EMAIL_REGEX.test(trimmed);
}

export function isRealIsoDate(dateStr: string): boolean {
  const trimmed = dateStr.trim();
  if (!DATE_ISO_REGEX.test(trimmed)) return false;
  const parsed = new Date(`${trimmed}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === trimmed;
}

export function isValidTime24h(timeStr: string): boolean {
  return TIME_REGEX.test(timeStr.trim());
}

export function isValidTimeZone(timeZone: string): boolean {
  const trimmed = timeZone.trim();
  if (!trimmed) return false;
  try {
    const intlWithSupported = Intl as typeof Intl & {
      supportedValuesOf?: (key: string) => string[];
    };
    if (typeof intlWithSupported.supportedValuesOf === 'function') {
      const supported = intlWithSupported.supportedValuesOf('timeZone');
      if (supported.includes(trimmed)) return true;
    }
    new Intl.DateTimeFormat(undefined, { timeZone: trimmed });
    return true;
  } catch {
    return false;
  }
}

export function sanitizeExternalHttpUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  const trimmed = url.trim();
  if (!trimmed) return undefined;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString();
    }
    return undefined;
  } catch {
    return undefined;
  }
}

export function validateProjectInput(input: CreateProjectInput): ValidationResult {
  const errors: ValidationErrors = {};

  if (!input.title.trim()) {
    errors.title = 'Informe o nome do projeto.';
  } else if (input.title.trim().length < 3) {
    errors.title = 'O nome do projeto deve ter pelo menos 3 caracteres.';
  }

  if (!input.description.trim()) {
    errors.description = 'Informe uma descrição para o projeto.';
  } else if (input.description.trim().length < 10) {
    errors.description = 'A descrição deve ter pelo menos 10 caracteres.';
  }

  if (!input.discipline.trim()) {
    errors.discipline = 'Informe a disciplina ou matéria acadêmica.';
  }

  if (!input.presentationDate || !isRealIsoDate(input.presentationDate)) {
    errors.presentationDate = 'Selecione uma data válida para a apresentação.';
  }

  if (!input.presentationTime || !isValidTime24h(input.presentationTime)) {
    errors.presentationTime = 'Informe um horário válido (ex: 19:30).';
  }

  if (!input.location.trim()) {
    errors.location = 'Informe a sala ou local da apresentação.';
  }

  if (
    Number.isNaN(input.targetDurationMinutes) ||
    input.targetDurationMinutes < 5 ||
    input.targetDurationMinutes > 180
  ) {
    errors.targetDurationMinutes =
      'A duração prevista deve estar entre 5 e 180 minutos.';
  }

  if (!Object.values(ProjectStatus).includes(input.status)) {
    errors.status = 'Selecione um status válido.';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validatePresentationDateInput(
  presentationDate: string,
  presentationTime: string,
  location: string
): ValidationResult {
  const errors: ValidationErrors = {};

  if (!presentationDate || !isRealIsoDate(presentationDate)) {
    errors.presentationDate = 'Selecione uma data válida.';
  }

  if (!presentationTime || !isValidTime24h(presentationTime)) {
    errors.presentationTime = 'Informe um horário válido (HH:MM).';
  }

  if (!location.trim()) {
    errors.location = 'Informe o local da apresentação.';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateMemberInput(input: CreateMemberInput): ValidationResult {
  const errors: ValidationErrors = {};

  if (!input.name.trim()) {
    errors.name = 'Informe o nome completo do integrante.';
  } else if (input.name.trim().length < 2) {
    errors.name = 'O nome deve ter pelo menos 2 caracteres.';
  }

  if (!input.email.trim()) {
    errors.email = 'Informe o e-mail do integrante.';
  } else if (!isValidEmailAddress(input.email)) {
    errors.email = 'Informe um endereço de e-mail válido.';
  }

  if (!input.defaultRole.trim()) {
    errors.defaultRole = 'Informe a função principal do integrante.';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateAssociationInput(
  input: Pick<
    AssociateMemberInput,
    'projectId' | 'memberId' | 'role' | 'responsibility' | 'presentationMinutes' | 'progress'
  >
): ValidationResult {
  const errors: ValidationErrors = {};

  if (!input.projectId) {
    errors.projectId = 'Selecione um projeto.';
  }

  if (!input.memberId) {
    errors.memberId = 'Selecione um integrante.';
  }

  if (!input.role.trim()) {
    errors.role = 'Informe o papel do integrante neste projeto.';
  }

  if (!input.responsibility.trim()) {
    errors.responsibility = 'Descreva a responsabilidade na apresentação.';
  }

  if (
    Number.isNaN(input.presentationMinutes) ||
    input.presentationMinutes < 1 ||
    input.presentationMinutes > 120
  ) {
    errors.presentationMinutes =
      'O tempo de apresentação deve estar entre 1 e 120 minutos.';
  }

  if (
    Number.isNaN(input.progress) ||
    input.progress < 0 ||
    input.progress > 100
  ) {
    errors.progress = 'O progresso deve estar entre 0% e 100%.';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateUpdateAssociationInput(
  input: UpdateAssociationInput
): ValidationResult {
  return validateAssociationInput({
    projectId: 'valid',
    memberId: 'valid',
    role: input.role,
    responsibility: input.responsibility,
    presentationMinutes: input.presentationMinutes,
    progress: input.progress,
  });
}
