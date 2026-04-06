/**
 * Pipeline API Routes
 * ===================
 * Endpoints for the continuous learning loop, model retraining,
 * drift detection, and feedback ingestion.
 *
 * Authentication: all routes require a valid JWT.
 * Authorization: researcher or admin role only.
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireRole } from '../middleware/auth';
import { validateBody } from '../middleware/validation';
import { asyncHandler } from '../utils/asyncHandler';
import { logger } from '../utils/logger';
import { ApiResponse } from '../types';
import {
  ingestFeedback,
  triggerRetrain,
  checkDataDrift,
  getPipelineStatus,
  FeedbackLoopResult,
  PipelineStatus,
} from '../services/pipelineOrchestrator';
import { PipelineRetrainMLResult, DriftCheckMLResult } from '../services/mlClient';

const router = Router();

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const feedbackSchema = z.object({
  participantId: z.string().min(1),
  interventionId: z.string().min(1),
  preScores: z.record(z.number()),
  postScores: z.record(z.number()),
  interventionType: z.string().min(1),
  completionDate: z.string().min(1),
});

const retrainSchema = z.object({
  module: z.enum(['emotional_dynamics', 'cognitive_risk', 'trajectory', 'health', 'all']),
});

const driftCheckSchema = z.object({
  referenceData: z.record(z.array(z.number())),
  newData: z.record(z.array(z.number())),
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/**
 * POST /pipeline/feedback
 * Ingest intervention outcome feedback into the continuous learning loop.
 * Automatically triggers model retraining when enough feedback accumulates.
 */
router.post(
  '/pipeline/feedback',
  requireRole('researcher', 'admin'),
  validateBody(feedbackSchema),
  asyncHandler(async (req: Request, res: Response) => {
    logger.info('Ingesting feedback', {
      participantId: req.body.participantId,
      interventionId: req.body.interventionId,
    });

    const result = await ingestFeedback(req.body);

    const response: ApiResponse<FeedbackLoopResult> = {
      success: true,
      data: result,
      meta: { timestamp: new Date().toISOString() },
    };
    res.status(201).json(response);
  }),
);

/**
 * POST /pipeline/retrain
 * Trigger model retraining for a specific module or all modules.
 */
router.post(
  '/pipeline/retrain',
  requireRole('admin'),
  validateBody(retrainSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { module } = req.body;
    logger.info('Manual retrain triggered', { module });

    const results = await triggerRetrain(module);

    const response: ApiResponse<PipelineRetrainMLResult[]> = {
      success: true,
      data: results,
      meta: { timestamp: new Date().toISOString() },
    };
    res.json(response);
  }),
);

/**
 * POST /pipeline/drift-check
 * Run drift detection between reference and new data distributions.
 */
router.post(
  '/pipeline/drift-check',
  requireRole('researcher', 'admin'),
  validateBody(driftCheckSchema),
  asyncHandler(async (req: Request, res: Response) => {
    logger.info('Running drift check');

    const result = await checkDataDrift(req.body);

    const response: ApiResponse<DriftCheckMLResult> = {
      success: true,
      data: result,
      meta: { timestamp: new Date().toISOString() },
    };
    res.json(response);
  }),
);

/**
 * GET /pipeline/status
 * Get the current status of the ML pipeline orchestration layer.
 */
router.get(
  '/pipeline/status',
  requireRole('researcher', 'admin'),
  asyncHandler(async (_req: Request, res: Response) => {
    const status = await getPipelineStatus();

    const response: ApiResponse<PipelineStatus> = {
      success: true,
      data: status,
      meta: { timestamp: new Date().toISOString() },
    };
    res.json(response);
  }),
);

export default router;
