import { Response, Router } from 'express';
import { z } from 'zod';
import { SlideDeckBuildInput } from '../../src/domain/googleSlidesBuilder';
import {
  AuthenticatedRequest,
  requireAuthenticatedGoogleSession,
} from '../middleware/securityMiddleware';
import {
  generateGoogleSlidesPresentation,
  GoogleSlidesServiceError,
} from '../services/googleSlidesService';

export const slidesRouter = Router();

const generateSlidesBodySchema = z.object({
  deckInput: z
    .object({
      projectId: z.string().trim().min(1).max(120).optional(),
      projectTitle: z
        .string()
        .trim()
        .min(1, 'Título do projeto é obrigatório.')
        .max(200),
      projectDescription: z.string().max(4000).optional().default(''),
      discipline: z.string().max(200).optional().default('Disciplina'),
      institution: z.string().max(200).optional().default('Instituição'),
      advisor: z.string().max(200).optional().default('Orientador'),
      presentationDate: z.string().max(40).optional().default(''),
      presentationTime: z.string().max(20).optional().default(''),
      location: z.string().max(300).optional().default(''),
      memberNames: z.array(z.string().max(150)).max(50).default([]),
      approvedSectionIds: z
        .array(z.string().trim().min(1).max(120))
        .min(
          1,
          'Selecione e aprove pelo menos uma seção do documento para gerar a apresentação.'
        )
        .max(100),
      distributionSummary: z
        .object({
          sections: z.array(z.record(z.string(), z.unknown())).min(1).max(100),
        })
        .passthrough(),
    })
    .passthrough(),
  requestId: z.string().trim().min(1).max(120).optional(),
  existingPresentationId: z.string().trim().max(200).nullable().optional(),
  confirmDuplicate: z.boolean().optional().default(false),
});

slidesRouter.post(
  '/projects/:projectId/slides/generate',
  requireAuthenticatedGoogleSession,
  async (req: AuthenticatedRequest, res: Response) => {
    const projectIdParam = req.params.projectId;
    const projectId = Array.isArray(projectIdParam)
      ? projectIdParam[0]
      : projectIdParam;

    if (!projectId || !projectId.trim()) {
      res.status(400).json({ error: 'Identificador do projeto é obrigatório.' });
      return;
    }

    const parsed = generateSlidesBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      res.status(400).json({
        error:
          firstIssue?.message ||
          'Dados estruturados inválidos para gerar os slides.',
        code: 'INVALID_SLIDES_INPUT',
      });
      return;
    }

    const auth = req.googleAuth!;
    const deckInput = {
      ...(parsed.data.deckInput as unknown as SlideDeckBuildInput),
      projectId: projectId.trim(),
    };

    try {
      const result = await generateGoogleSlidesPresentation({
        accessToken: auth.accessToken,
        sessionId: auth.sessionId,
        deckInput,
        requestId: parsed.data.requestId,
        existingPresentationId: parsed.data.existingPresentationId ?? null,
        confirmDuplicate: parsed.data.confirmDuplicate,
      });

      res.status(200).json(result);
    } catch (error) {
      if (error instanceof GoogleSlidesServiceError) {
        res.status(error.statusCode).json({
          error: error.message,
          code: error.code,
          details: error.details,
        });
        return;
      }

      res.status(500).json({
        error:
          'Erro interno ao gerar a apresentação no Google Slides pelo servidor.',
      });
    }
  }
);
