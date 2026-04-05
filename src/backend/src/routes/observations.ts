import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validateBody } from '../middleware/validation';
import { Observation, ApiResponse } from '../types';
import { logger } from '../utils/logger';
import { asyncHandler } from '../utils/asyncHandler';
import { parsePagination, paginate } from '../utils/pagination';
import { mockObservations } from '../services/mockData';

const router = Router();

const createObservationSchema = z.object({
  source: z.enum(['ema', 'sensor', 'clinical', 'self-report']),
  measures: z.record(z.union([z.number(), z.string(), z.boolean()])),
  context: z
    .object({
      location: z.string().optional(),
      activity: z.string().optional(),
      socialContext: z.string().optional(),
      deviceType: z.string().optional(),
    })
    .optional(),
});

/**
 * GET /participants/:id/observations
 * List EMA observations for a given participant.
 */
router.get(
  '/participants/:id/observations',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    logger.info('Fetching observations', { participantId: id });

    const results = mockObservations.filter((o) => o.participantId === id);

    const params = parsePagination(req);
    const response = paginate(results as unknown as Record<string, unknown>[], params);
    res.json(response);
  }),
);

/**
 * POST /participants/:id/observations
 * Record a new EMA observation for a participant.
 */
router.post(
  '/participants/:id/observations',
  validateBody(createObservationSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    logger.info('Recording observation', { participantId: id, source: req.body.source });

    const newObs: Observation = {
      id: `obs-${String(mockObservations.length + 1).padStart(3, '0')}`,
      participantId: id,
      timestamp: new Date().toISOString(),
      source: req.body.source,
      measures: req.body.measures,
      context: req.body.context || {},
    };

    mockObservations.push(newObs);

    const response: ApiResponse<Observation> = {
      success: true,
      data: newObs,
      meta: { timestamp: new Date().toISOString() },
    };
    res.status(201).json(response);
  }),
);

export default router;
