import './config/env';
import express, { Express, NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import {
  apiRateLimiter,
  enforceCsrfOrigin,
} from './middleware/securityMiddleware';
import { pdfRouter } from './routes/pdfRoutes';
import { preparationRouter } from './routes/preparationRoutes';
import { slidesRouter } from './routes/slidesRoutes';
import { workspaceRouter } from './routes/workspaceRoutes';

export function createApiApp(): Express {
  const app = express();

  app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
    })
  );

  // Logging estruturado sem vazar tokens ou cookies
  app.use('/api', (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    res.on('finish', () => {
      if (process.env.NODE_ENV !== 'test') {
        console.info(
          `[TeamDeck] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${
            Date.now() - start
          }ms)`
        );
      }
    });
    next();
  });

  app.use(express.json({ limit: '512kb' }));

  // Tratamento explícito para JSON malformado no corpo da requisição
  app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
    if (
      err instanceof SyntaxError &&
      'status' in err &&
      (err as { status?: number }).status === 400
    ) {
      res.status(400).json({
        error: 'JSON inválido no corpo da requisição.',
        code: 'INVALID_JSON',
      });
      return;
    }
    next(err);
  });

  app.use('/api', enforceCsrfOrigin);
  app.use('/api', apiRateLimiter);

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.use('/api', pdfRouter);
  app.use('/api', slidesRouter);
  app.use('/api', preparationRouter);
  app.use('/api', workspaceRouter);

  // Tratamento global de erros sem expor stack traces ao cliente
  app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
    console.error('[TeamDeck] Erro não tratado na API:', err);
    if (res.headersSent) {
      next(err);
      return;
    }
    if (req.path.startsWith('/api')) {
      res.status(500).json({
        error: 'Erro interno inesperado no servidor.',
        code: 'INTERNAL_SERVER_ERROR',
      });
      return;
    }
    res.status(500).send('Erro interno do servidor.');
  });

  return app;
}
