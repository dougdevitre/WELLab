import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { v4 as uuidv4 } from 'uuid';
import { logger } from './utils/logger';
import { authMiddleware } from './middleware/auth';

import participantsRouter from './routes/participants';
import observationsRouter from './routes/observations';
import emotionalDynamicsRouter from './routes/emotional-dynamics';
import healthRouter from './routes/health';
import lifespanRouter from './routes/lifespan';
import cognitiveRouter from './routes/cognitive';
import interventionsRouter from './routes/interventions';

// ---------------------------------------------------------------------------
// Environment validation
// ---------------------------------------------------------------------------
const REQUIRED_ENV_VARS = ['PORT'];
const OPTIONAL_ENV_VARS = ['CORS_ORIGIN', 'LOG_LEVEL', 'JWT_SECRET'];

function validateEnvironment(): void {
  const missing = REQUIRED_ENV_VARS.filter((v) => !process.env[v]);
  if (missing.length > 0) {
    logger.warn(`Missing recommended env vars: ${missing.join(', ')}. Using defaults.`);
  }
}

validateEnvironment();

// ---------------------------------------------------------------------------
// App setup
// ---------------------------------------------------------------------------
const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

// ---------------------------------------------------------------------------
// Security headers
// ---------------------------------------------------------------------------
app.use(helmet());

// ---------------------------------------------------------------------------
// CORS - restrict origins via env
// ---------------------------------------------------------------------------
const corsOrigin = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
  : undefined; // undefined = same-origin only in production; tests may override

app.use(
  cors({
    origin: corsOrigin || false,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
    credentials: true,
  }),
);

// ---------------------------------------------------------------------------
// Body parsing with size limit
// ---------------------------------------------------------------------------
app.use(express.json({ limit: '1mb' }));

// ---------------------------------------------------------------------------
// Response compression
// ---------------------------------------------------------------------------
app.use(compression());

// ---------------------------------------------------------------------------
// Request ID middleware
// ---------------------------------------------------------------------------
app.use((req: Request, res: Response, next: NextFunction) => {
  const requestId = (req.headers['x-request-id'] as string) || uuidv4();
  req.requestId = requestId;
  res.setHeader('X-Request-ID', requestId);
  next();
});

// ---------------------------------------------------------------------------
// Request logging middleware
// ---------------------------------------------------------------------------
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('request', {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
      requestId: req.requestId,
    });
  });

  next();
});

// ---------------------------------------------------------------------------
// Health check (unauthenticated) - kept outside versioned prefix for probes
// ---------------------------------------------------------------------------

/**
 * GET /api/v1/health
 * Simple health-check endpoint for readiness probes.
 */
app.get('/api/v1/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'wellab-api',
    version: '1.0.0',
    modules: [
      'emotional-dynamics',
      'health',
      'lifespan-trajectory',
      'cognitive-health',
    ],
    timestamp: new Date().toISOString(),
  });
});

// ---------------------------------------------------------------------------
// Auth middleware (applied to all /api/v1 routes below)
// ---------------------------------------------------------------------------
app.use('/api/v1', authMiddleware);

// ---------------------------------------------------------------------------
// Route registration (all under /api/v1)
// ---------------------------------------------------------------------------
app.use('/api/v1/participants', participantsRouter);
app.use('/api/v1', observationsRouter);
app.use('/api/v1', emotionalDynamicsRouter);
app.use('/api/v1', healthRouter);
app.use('/api/v1', lifespanRouter);
app.use('/api/v1', cognitiveRouter);
app.use('/api/v1/interventions', interventionsRouter);

// The interventions router also exposes a participant-scoped GET, so mount it
// at the top level /api/v1 as well for the /participants/:id/interventions path.
app.use('/api/v1', interventionsRouter);

// ---------------------------------------------------------------------------
// 404 fallback
// ---------------------------------------------------------------------------
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: 'Endpoint not found' },
  });
});

// ---------------------------------------------------------------------------
// Global error handler
// ---------------------------------------------------------------------------
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  logger.error('Unhandled error', {
    message: err.message,
    stack: err.stack,
    method: req.method,
    url: req.originalUrl,
    requestId: req.requestId,
  });

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
      requestId: req.requestId,
    },
  });
});

// ---------------------------------------------------------------------------
// Start server with graceful shutdown
// ---------------------------------------------------------------------------
const server = app.listen(PORT, () => {
  logger.info(`WELLab API server running on port ${PORT}`);
  logger.info('API base path: /api/v1');
  logger.info(
    'Registered modules: Emotional Dynamics, Health, Lifespan Trajectory, Cognitive Health',
  );
});

function gracefulShutdown(signal: string): void {
  logger.info(`${signal} received. Starting graceful shutdown...`);
  server.close(() => {
    logger.info('HTTP server closed. Exiting.');
    process.exit(0);
  });

  // Force exit after 30 seconds if connections are not drained
  setTimeout(() => {
    logger.error('Graceful shutdown timed out. Forcing exit.');
    process.exit(1);
  }, 30_000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export default app;
