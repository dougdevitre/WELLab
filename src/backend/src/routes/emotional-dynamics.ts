import { Router, Request, Response } from 'express';
import { validateBody } from '../middleware/validation';
import { EmotionalDynamicsResult, ApiResponse } from '../types';
import { logger } from '../utils/logger';

const router = Router();

/**
 * GET /participants/:id/emotional-dynamics
 * Retrieve emotion coupling analysis and volatility scores for a participant.
 */
router.get('/participants/:id/emotional-dynamics', (req: Request, res: Response) => {
  const { id } = req.params;
  logger.info('Fetching emotional dynamics', { participantId: id });

  const mockResult: EmotionalDynamicsResult = {
    participantId: id,
    period: { start: '2024-01-01', end: '2024-06-30' },
    volatility: 0.42,
    inertia: 0.68,
    couplings: [
      { emotionA: 'happiness', emotionB: 'energy', couplingStrength: 0.73, lag: 0, pValue: 0.001 },
      { emotionA: 'anxiety', emotionB: 'sadness', couplingStrength: 0.58, lag: 1, pValue: 0.01 },
      { emotionA: 'anger', emotionB: 'anxiety', couplingStrength: 0.35, lag: 0, pValue: 0.05 },
    ],
    granularity: 0.61,
  };

  const response: ApiResponse<EmotionalDynamicsResult> = {
    success: true,
    data: mockResult,
    meta: { timestamp: new Date().toISOString() },
  };
  res.json(response);
});

/**
 * POST /emotional-dynamics/analyze
 * Run an emotion coupling and volatility analysis across one or more participants.
 */
router.post(
  '/emotional-dynamics/analyze',
  validateBody({
    required: ['participantIds', 'period'],
    types: { participantIds: 'array', period: 'object' },
  }),
  (req: Request, res: Response) => {
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
  },
);

export default router;
