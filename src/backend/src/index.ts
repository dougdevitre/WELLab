import express from 'express';
import cors from 'cors';
import { logger } from './utils/logger';
import { authMiddleware } from './middleware/auth';

import participantsRouter from './routes/participants';
import observationsRouter from './routes/observations';
import emotionalDynamicsRouter from './routes/emotional-dynamics';
import healthRouter from './routes/health';
import lifespanRouter from './routes/lifespan';
import cognitiveRouter from './routes/cognitive';
import interventionsRouter from './routes/interventions';

const app = express();
const PORT = process.env.PORT || 3001;

// ---------------------------------------------------------------------------
// Global middleware
// ---------------------------------------------------------------------------
app.use(cors());
app.use(express.json());

// ---------------------------------------------------------------------------
// Health check (unauthenticated)
// ---------------------------------------------------------------------------

/**
 * GET /api/health
 * Simple health-check endpoint for readiness probes.
 */
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'wellab-api',
    version: '0.1.0',
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
// Auth middleware (applied to all /api routes below)
// ---------------------------------------------------------------------------
app.use('/api', authMiddleware);

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------
app.use('/api/participants', participantsRouter);
app.use('/api', observationsRouter);
app.use('/api', emotionalDynamicsRouter);
app.use('/api', healthRouter);
app.use('/api', lifespanRouter);
app.use('/api', cognitiveRouter);
app.use('/api/interventions', interventionsRouter);

// The interventions router also exposes a participant-scoped GET, so mount it
// at the top level /api as well for the /participants/:id/interventions path.
app.use('/api', interventionsRouter);

// ---------------------------------------------------------------------------
// 404 fallback
// ---------------------------------------------------------------------------
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: 'Endpoint not found' },
  });
});

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------
app.listen(PORT, () => {
  logger.info(`WELLab API server running on port ${PORT}`);
  logger.info('Registered modules: Emotional Dynamics, Health, Lifespan Trajectory, Cognitive Health');
});

export default app;
