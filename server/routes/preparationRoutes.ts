import { Response, Router } from 'express';
import { z } from 'zod';
import {
  MemberPreparationApiResponse,
  MemberPreparationGenerateInput,
} from '../../src/types/preparation';
import { getGeminiModel } from '../config/gemini';
import {
  AuthenticatedRequest,
  geminiRateLimiter,
  requireAuthenticatedGoogleSession,
} from '../middleware/securityMiddleware';
import {
  GeminiPreparationError,
  generateMemberPreparationWithGemini,
} from '../services/geminiPreparationService';

export const preparationRouter = Router();

const assignedSectionSchema = z.object({
  sectionId: z.string().trim().min(1).max(120),
  order: z.coerce.number().int().min(1).max(200),
  title: z.string().trim().min(1).max(300),
  summary: z.string().trim().max(4000),
  mainTopics: z.array(z.string().max(400)).max(40),
  visualElements: z
    .array(
      z.object({
        id: z.string().max(120),
        type: z.string().max(60),
        title: z.string().max(300),
        description: z.string().max(1000),
        sourcePages: z.array(z.coerce.number().int().min(1).max(2000)).max(50),
      })
    )
    .max(30),
  sourcePages: z.array(z.coerce.number().int().min(1).max(2000)).max(100),
  speakingSeconds: z.coerce.number().min(0).max(7200),
  visualSeconds: z.coerce.number().min(0).max(3600),
  durationSeconds: z.coerce.number().min(1).max(10800),
  targetWordCount: z.coerce.number().int().min(1).max(15000),
});

const preparationGenerateSchema = z.object({
  projectTitle: z.string().trim().max(250).optional().default('Projeto Acadêmico'),
  discipline: z.string().trim().max(200).optional().default('Disciplina'),
  memberName: z
    .string()
    .trim()
    .min(1, 'Nome do integrante é obrigatório para gerar a preparação.')
    .max(150),
  memberRole: z.string().trim().max(150).optional().default('Apresentador'),
  calculatedDurationSeconds: z.coerce.number().min(1).max(10800),
  totalTargetWordCount: z.coerce.number().int().min(1).max(20000),
  assignedSections: z
    .array(assignedSectionSchema)
    .min(
      1,
      'O integrante precisa possuir pelo menos uma seção atribuída para gerar a preparação individual.'
    )
    .max(25, 'Máximo de 25 seções atribuídas por integrante.'),
  relevantConcepts: z
    .array(
      z.object({
        term: z.string().max(250),
        definition: z.string().max(1500),
        sourceType: z.string().max(50),
        sourcePages: z.array(z.coerce.number().int().min(1).max(2000)).max(50),
      })
    )
    .max(50)
    .optional()
    .default([]),
  relevantExamples: z
    .array(
      z.object({
        title: z.string().max(250),
        description: z.string().max(1500),
        sourcePages: z.array(z.coerce.number().int().min(1).max(2000)).max(50),
      })
    )
    .max(30)
    .optional()
    .default([]),
  relevantUncertainties: z
    .array(
      z.object({
        topic: z.string().max(250),
        reason: z.string().max(1000),
        sourcePages: z.array(z.coerce.number().int().min(1).max(2000)).max(50),
      })
    )
    .max(30)
    .optional()
    .default([]),
  slideSequenceHints: z
    .array(
      z.object({
        slideNumber: z.coerce.number().int().min(1).max(200),
        title: z.string().max(250),
        nextSlideTitle: z.string().max(250).nullable(),
        nextSpeakerName: z.string().max(150).nullable(),
      })
    )
    .max(60)
    .optional()
    .default([]),
});

preparationRouter.post(
  '/projects/:projectId/members/:memberId/preparation/generate',
  requireAuthenticatedGoogleSession,
  geminiRateLimiter,
  async (req: AuthenticatedRequest, res: Response) => {
    const projectIdParam = req.params.projectId;
    const memberIdParam = req.params.memberId;

    const projectId = Array.isArray(projectIdParam)
      ? projectIdParam[0]
      : projectIdParam;
    const memberId = Array.isArray(memberIdParam)
      ? memberIdParam[0]
      : memberIdParam;

    if (!projectId?.trim() || !memberId?.trim()) {
      res.status(400).json({
        error: 'Identificadores do projeto e do integrante são obrigatórios.',
      });
      return;
    }

    const parsed = preparationGenerateSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      res.status(400).json({
        error:
          firstIssue?.message ||
          'Dados inválidos para gerar a preparação individual.',
        code: 'INVALID_PREPARATION_INPUT',
      });
      return;
    }

    const sanitizedInput: MemberPreparationGenerateInput = {
      projectId: projectId.trim(),
      projectTitle: parsed.data.projectTitle || 'Projeto Acadêmico',
      discipline: parsed.data.discipline || 'Disciplina',
      memberId: memberId.trim(),
      memberName: parsed.data.memberName,
      memberRole: parsed.data.memberRole || 'Apresentador',
      calculatedDurationSeconds: parsed.data.calculatedDurationSeconds,
      totalTargetWordCount: parsed.data.totalTargetWordCount,
      assignedSections: parsed.data.assignedSections,
      relevantConcepts: parsed.data.relevantConcepts,
      relevantExamples: parsed.data.relevantExamples,
      relevantUncertainties: parsed.data.relevantUncertainties,
      slideSequenceHints: parsed.data.slideSequenceHints,
    };

    try {
      const material = await generateMemberPreparationWithGemini(sanitizedInput);

      const responsePayload: MemberPreparationApiResponse = {
        projectId: projectId.trim(),
        memberId: memberId.trim(),
        generatedAt: new Date().toISOString(),
        model: getGeminiModel(),
        material,
      };

      res.status(200).json(responsePayload);
    } catch (error) {
      if (error instanceof GeminiPreparationError) {
        res.status(error.statusCode).json({
          error: error.message,
        });
        return;
      }

      res.status(500).json({
        error:
          'Erro interno ao gerar o material de preparação individual no servidor.',
      });
    }
  }
);
