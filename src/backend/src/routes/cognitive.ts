import { Router, Request, Response } from 'express';
import { validateBody } from '../middleware/validation';
import { CognitiveAssessment, CognitiveRiskResult, ApiResponse } from '../types';
import { logger } from '../utils/logger';

const router = Router();

/**
 * GET /participants/:id/cognitive
 * Retrieve cognitive assessment records for a participant.
 */
router.get('/participants/:id/cognitive', (req: Request, res: Response) => {
  const { id } = req.params;
  logger.info('Fetching cognitive assessments', { participantId: id });

  const mockAssessments: CognitiveAssessment[] = [
    {
      id: 'ca-001',
      participantId: id,
      assessmentDate: '2024-04-10',
      instrument: 'MoCA',
      domain: 'memory',
      score: 26,
      normalizedScore: 0.87,
      percentile: 72,
    },
    {
      id: 'ca-002',
      participantId: id,
      assessmentDate: '2024-04-10',
      instrument: 'Trail Making B',
      domain: 'executive-function',
      score: 85,
      normalizedScore: 0.78,
      percentile: 65,
    },
    {
      id: 'ca-003',
      participantId: id,
      assessmentDate: '2024-04-10',
      instrument: 'Digit Symbol',
      domain: 'processing-speed',
      score: 52,
      normalizedScore: 0.72,
      percentile: 58,
    },
  ];

  const response: ApiResponse<CognitiveAssessment[]> = {
    success: true,
    data: mockAssessments,
    meta: { total: mockAssessments.length, timestamp: new Date().toISOString() },
  };
  res.json(response);
});

/**
 * POST /cognitive/risk-assessment
 * Run a cognitive decline risk assessment for a participant.
 */
router.post(
  '/cognitive/risk-assessment',
  validateBody({
    required: ['participantId', 'horizonYears'],
    types: { participantId: 'string', horizonYears: 'number', includeModifiableFactors: 'boolean' },
  }),
  (req: Request, res: Response) => {
    const { participantId, horizonYears, includeModifiableFactors } = req.body;
    logger.info('Running cognitive risk assessment', { participantId, horizonYears });

    const mockResult: CognitiveRiskResult = {
      participantId,
      riskScore: 0.23,
      riskCategory: 'moderate',
      modifiableFactors: includeModifiableFactors
        ? [
            { factor: 'physical-activity', impact: -0.15, recommendation: 'Increase aerobic exercise to 150 min/week' },
            { factor: 'sleep-quality', impact: -0.08, recommendation: 'Address sleep fragmentation' },
            { factor: 'social-engagement', impact: -0.06, recommendation: 'Increase weekly social interactions' },
          ]
        : [],
      projectedTrajectory: [
        { age: 70, value: 0.87, domain: 'global-cognition', confidence: 0.90 },
        { age: 72, value: 0.84, domain: 'global-cognition', confidence: 0.85 },
        { age: 75, value: 0.79, domain: 'global-cognition', confidence: 0.78 },
        { age: 78, value: 0.73, domain: 'global-cognition', confidence: 0.70 },
        { age: 80, value: 0.68, domain: 'global-cognition', confidence: 0.62 },
      ],
    };

    const response: ApiResponse<CognitiveRiskResult> = {
      success: true,
      data: mockResult,
      meta: { timestamp: new Date().toISOString() },
    };
    res.json(response);
  },
);

export default router;
