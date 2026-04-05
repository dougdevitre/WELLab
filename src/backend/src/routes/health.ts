import { Router, Request, Response } from 'express';
import { validateBody } from '../middleware/validation';
import { HealthRecord, CausalAnalysisResult, ApiResponse } from '../types';
import { logger } from '../utils/logger';

const router = Router();

/**
 * GET /participants/:id/health-records
 * Retrieve health records for a participant, optionally filtered by domain.
 */
router.get('/participants/:id/health-records', (req: Request, res: Response) => {
  const { id } = req.params;
  logger.info('Fetching health records', { participantId: id, domain: req.query.domain });

  const mockRecords: HealthRecord[] = [
    {
      id: 'hr-001',
      participantId: id,
      recordDate: '2024-03-15',
      domain: 'physical',
      indicators: { bmi: 24.5, systolicBP: 128, diastolicBP: 82, gripStrength: 32 },
      notes: 'Routine physical assessment',
    },
    {
      id: 'hr-002',
      participantId: id,
      recordDate: '2024-03-15',
      domain: 'mental',
      indicators: { phq9: 4, gad7: 3, pss: 12 },
      notes: 'Quarterly mental health screening',
    },
  ];

  let results = mockRecords;
  if (req.query.domain) {
    results = results.filter((r) => r.domain === req.query.domain);
  }

  const response: ApiResponse<HealthRecord[]> = {
    success: true,
    data: results,
    meta: { total: results.length, timestamp: new Date().toISOString() },
  };
  res.json(response);
});

/**
 * POST /health/causal-analysis
 * Run a causal inference analysis between exposure and outcome variables.
 */
router.post(
  '/health/causal-analysis',
  validateBody({
    required: ['participantIds', 'exposureVariable', 'outcomeVariable', 'method'],
    types: {
      participantIds: 'array',
      exposureVariable: 'string',
      outcomeVariable: 'string',
      method: 'string',
    },
  }),
  (req: Request, res: Response) => {
    logger.info('Running causal analysis', {
      exposure: req.body.exposureVariable,
      outcome: req.body.outcomeVariable,
      method: req.body.method,
    });

    const mockResult: CausalAnalysisResult = {
      estimatedEffect: 0.34,
      confidenceInterval: [0.12, 0.56],
      pValue: 0.003,
      method: req.body.method,
      sampleSize: req.body.participantIds.length,
    };

    const response: ApiResponse<CausalAnalysisResult> = {
      success: true,
      data: mockResult,
      meta: { timestamp: new Date().toISOString() },
    };
    res.json(response);
  },
);

export default router;
