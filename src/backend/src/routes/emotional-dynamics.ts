import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validateBody } from '../middleware/validation';
import { EmotionalDynamicsResult, ApiResponse } from '../types';
import { logger } from '../utils/logger';
import { asyncHandler } from '../utils/asyncHandler';
import { getEmotionalDynamicsResult } from '../services/mockData';

const router = Router();

const analyzeSchema = z.object({
  participantIds: z.array(z.string().min(1)).min(1),
  period: z.object({
    start: z.string().min(1),
    end: z.string().min(1),
  }),
});

/**
 * GET /participants/:id/emotional-dynamics
 * Retrieve emotion coupling analysis and volatility scores for a participant.
 */
router.get(
  '/participants/:id/emotional-dynamics',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    logger.info('Fetching emotional dynamics', { participantId: id });

    const mockResult = getEmotionalDynamicsResult(id);

    const response: ApiResponse<EmotionalDynamicsResult> = {
      success: true,
      data: mockResult,
      meta: { timestamp: new Date().toISOString() },
    };
    res.json(response);
  }),
);

/**
 * POST /emotional-dynamics/analyze
 * Run an emotion coupling and volatility analysis across one or more participants.
 */
router.post(
  '/emotional-dynamics/analyze',
  validateBody(analyzeSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { participantIds, period } = req.body;
    logger.info('Running emotional dynamics analysis', {
      participantCount: participantIds.length,
      period,
    });

    const results: EmotionalDynamicsResult[] = participantIds.map((pid: string) => ({
      participantId: pid,
      period,
      volatility: Math.round(Math.random() * 100) / 100,
      inertia: Math.round(Math.random() * 100) / 100,
      couplings: [
        {
          emotionA: 'happiness',
          emotionB: 'energy',
          couplingStrength: Math.round(Math.random() * 100) / 100,
          lag: 0,
          pValue: 0.01,
        },
      ],
      granularity: Math.round(Math.random() * 100) / 100,
    }));

    const response: ApiResponse<EmotionalDynamicsResult[]> = {
      success: true,
      data: results,
      meta: { total: results.length, timestamp: new Date().toISOString() },
    };
    res.json(response);
  }),
);

export default router;
