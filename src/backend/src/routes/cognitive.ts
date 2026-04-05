import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validateBody } from '../middleware/validation';
import { CognitiveRiskResult, ApiResponse } from '../types';
import { logger } from '../utils/logger';
import { asyncHandler } from '../utils/asyncHandler';
import { parsePagination, paginate } from '../utils/pagination';
import { mockCognitiveAssessments } from '../services/mockData';

const router = Router();

const cognitiveRiskSchema = z.object({
  participantId: z.string().min(1),
  horizonYears: z.number().int().min(1).max(30),
  includeModifiableFactors: z.boolean(),
});

/**
 * GET /participants/:id/cognitive
 * Retrieve cognitive assessment records for a participant.
 */
router.get(
  '/participants/:id/cognitive',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    logger.info('Fetching cognitive assessments', { participantId: id });

    const results = mockCognitiveAssessments.filter((a) => a.participantId === id);

    const params = parsePagination(req);
    const response = paginate(results as unknown as Record<string, unknown>[], params);
    res.json(response);
  }),
);

/**
 * POST /cognitive/risk-assessment
 * Run a cognitive decline risk assessment for a participant.
 */
router.post(
  '/cognitive/risk-assessment',
  validateBody(cognitiveRiskSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { participantId, horizonYears, includeModifiableFactors } = req.body;
    logger.info('Running cognitive risk assessment', { participantId, horizonYears });

    const mockResult: CognitiveRiskResult = {
      participantId,
      riskScore: 0.23,
      riskCategory: 'moderate',
      modifiableFactors: includeModifiableFactors
        ? [
            {
              factor: 'physical-activity',
              impact: -0.15,
              recommendation: 'Increase aerobic exercise to 150 min/week',
            },
            {
              factor: 'sleep-quality',
              impact: -0.08,
              recommendation: 'Address sleep fragmentation',
            },
            {
              factor: 'social-engagement',
              impact: -0.06,
              recommendation: 'Increase weekly social interactions',
            },
          ]
        : [],
      projectedTrajectory: [
        { age: 70, value: 0.87, domain: 'global-cognition', confidence: 0.9 },
        { age: 72, value: 0.84, domain: 'global-cognition', confidence: 0.85 },
        { age: 75, value: 0.79, domain: 'global-cognition', confidence: 0.78 },
        { age: 78, value: 0.73, domain: 'global-cognition', confidence: 0.7 },
        { age: 80, value: 0.68, domain: 'global-cognition', confidence: 0.62 },
      ],
    };

    const response: ApiResponse<CognitiveRiskResult> = {
      success: true,
      data: mockResult,
      meta: { timestamp: new Date().toISOString() },
    };
    res.json(response);
  }),
);

export default router;
