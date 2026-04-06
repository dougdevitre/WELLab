/**
 * EMA Survey Routes
 * =================
 * Endpoints for the "A Close Look at Daily Life" experience sampling protocol.
 * Handles survey delivery, submission, and compliance tracking.
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validateBody } from '../middleware/validation';
import { ApiResponse } from '../types';
import { logger } from '../utils/logger';
import { asyncHandler } from '../utils/asyncHandler';
import { observationRepository } from '../db';
import {
  getSurveyItems,
  mapSurveyToMeasures,
  computeCompliance,
  EMA_PROTOCOL,
  SurveyItem,
} from '../services/emaSurveyConfig';

const router = Router();

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const submitSurveySchema = z.object({
  surveyIndex: z.number().int().min(0).max(8),
  responses: z.record(z.union([z.number(), z.string(), z.boolean()])),
  context: z.object({
    activity: z.string().optional(),
    socialContext: z.string().optional(),
    deviceType: z.string().optional(),
  }).optional(),
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/**
 * GET /participants/:id/ema/survey
 * Get the survey items for the current survey index.
 * Query param: ?surveyIndex=0 (0-8, defaults to middle-of-day)
 */
router.get(
  '/participants/:id/ema/survey',
  asyncHandler(async (req: Request, res: Response) => {
    const surveyIndex = parseInt(req.query.surveyIndex as string ?? '4', 10);
    const items = getSurveyItems(surveyIndex);

    const response: ApiResponse<{ items: SurveyItem[]; protocol: typeof EMA_PROTOCOL }> = {
      success: true,
      data: { items, protocol: EMA_PROTOCOL },
      meta: { timestamp: new Date().toISOString() },
    };
    res.json(response);
  }),
);

/**
 * POST /participants/:id/ema/submit
 * Submit a completed EMA survey, mapping responses to observation measures
 * and persisting to DynamoDB.
 */
router.post(
  '/participants/:id/ema/submit',
  validateBody(submitSurveySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { surveyIndex, responses, context } = req.body;

    logger.info('EMA survey submitted', { participantId: id, surveyIndex });

    // Map raw survey responses to standardized measures
    const measures = mapSurveyToMeasures(responses);

    // Persist as an observation
    let observation;
    try {
      observation = await observationRepository.create(id, {
        timestamp: new Date().toISOString(),
        source: 'ema',
        measures,
        context: {
          activity: context?.activity,
          socialContext: context?.socialContext,
          deviceType: context?.deviceType ?? 'mobile',
        },
      });
    } catch (err) {
      logger.warn('Failed to persist EMA to DynamoDB', { error: (err as Error).message });
      observation = {
        id: `ema-${Date.now()}`,
        participantId: id,
        timestamp: new Date().toISOString(),
        source: 'ema' as const,
        measures,
        context: context ?? {},
      };
    }

    const response: ApiResponse<typeof observation> = {
      success: true,
      data: observation,
      meta: { timestamp: new Date().toISOString() },
    };
    res.status(201).json(response);
  }),
);

/**
 * GET /participants/:id/ema/compliance
 * Get EMA compliance statistics for a participant.
 */
router.get(
  '/participants/:id/ema/compliance',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const daysInStudy = parseInt(req.query.days as string ?? '14', 10);

    let totalResponses = 0;
    try {
      const page = await observationRepository.listByParticipant(id, { limit: 500 });
      totalResponses = page.items.filter((o) => o.source === 'ema').length;
    } catch (err) {
      logger.warn('Failed to query observations for compliance', { error: (err as Error).message });
    }

    const compliance = computeCompliance(totalResponses, daysInStudy);

    const response: ApiResponse<typeof compliance & { participantId: string }> = {
      success: true,
      data: { participantId: id, ...compliance },
      meta: { timestamp: new Date().toISOString() },
    };
    res.json(response);
  }),
);

/**
 * GET /ema/protocol
 * Get the full EMA protocol configuration and glossary.
 */
router.get(
  '/ema/protocol',
  asyncHandler(async (_req: Request, res: Response) => {
    const response: ApiResponse<typeof EMA_PROTOCOL> = {
      success: true,
      data: EMA_PROTOCOL,
      meta: { timestamp: new Date().toISOString() },
    };
    res.json(response);
  }),
);

export default router;
