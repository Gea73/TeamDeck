import { NextFunction, Request, Response, Router } from 'express';
import multer from 'multer';
import {
  formatBytesPtBr,
  PDF_MAX_FILE_SIZE_BYTES,
  validatePdfFile,
} from '../../src/domain/pdfValidation';
import { PdfAnalysisApiResponse } from '../../src/types/pdfAnalysis';
import { getGeminiModel } from '../config/gemini';
import {
  AuthenticatedRequest,
  geminiRateLimiter,
  requireAuthenticatedGoogleSession,
} from '../middleware/securityMiddleware';
import {
  analyzePdfWithGemini,
  GeminiPdfProcessingError,
} from '../services/geminiPdfService';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: PDF_MAX_FILE_SIZE_BYTES,
    files: 1,
  },
});

export const pdfRouter = Router();

pdfRouter.post(
  '/projects/:projectId/pdf/analyze',
  requireAuthenticatedGoogleSession,
  geminiRateLimiter,
  (req: Request, res: Response, next: NextFunction) => {
    upload.single('file')(req, res, (err: unknown) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          res.status(413).json({
            error: 'O arquivo PDF excede o tamanho máximo permitido de 20 MB.',
          });
          return;
        }
        res.status(400).json({
          error: 'Falha no envio do arquivo PDF.',
        });
        return;
      }

      if (err) {
        res.status(400).json({
          error: 'Não foi possível ler o arquivo enviado.',
        });
        return;
      }

      next();
    });
  },
  async (req: AuthenticatedRequest, res: Response) => {
    const projectIdParam = req.params.projectId;
    const projectId = Array.isArray(projectIdParam)
      ? projectIdParam[0]
      : projectIdParam;

    if (!projectId || !projectId.trim()) {
      res.status(400).json({ error: 'Identificador do projeto é obrigatório.' });
      return;
    }

    const file = req.file;
    if (!file) {
      res.status(400).json({
        error: 'Nenhum arquivo PDF foi enviado no campo "file".',
      });
      return;
    }

    const validation = validatePdfFile({
      fileName: file.originalname,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      headerBytes: file.buffer.subarray(0, 8),
    });

    if (!validation.valid) {
      res.status(400).json({
        error: validation.error ?? 'Arquivo PDF inválido.',
      });
      return;
    }

    try {
      const analysis = await analyzePdfWithGemini(
        file.buffer,
        file.originalname
      );

      const payload: PdfAnalysisApiResponse = {
        projectId: projectId.trim(),
        fileName: file.originalname,
        fileSizeBytes: file.size,
        fileSizeLabel: formatBytesPtBr(file.size),
        analyzedAt: new Date().toISOString(),
        model: getGeminiModel(),
        analysis,
      };

      res.status(200).json(payload);
    } catch (error) {
      if (error instanceof GeminiPdfProcessingError) {
        res.status(error.statusCode).json({
          error: error.message,
        });
        return;
      }

      res.status(500).json({
        error: 'Erro interno ao processar o documento PDF no servidor.',
      });
    }
  }
);
