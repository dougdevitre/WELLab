import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validateBody } from '../middleware/validation';
import { CausalAnalysisResult, ApiResponse } from '../types';
import { logger } from '../utils/logger';
import { asyncHandler } from '../utils/asyncHandler';
import { parsePagination, paginate } from '../utils/pagination';
import { mockHealthRecords } from '../services/mockData';

const router = Router();

const causalAnalysisSchema = z.object({
  participantIds: z.array(z.string().min(1)).min(1),
  exposureVariable: z.string().min(1),
  outcomeVariable: z.string().min(1),
  covariates: z.array(z.string()).optional().default([]),
  method: z.enum(['propensity-score', 'instrumental-variable', 'difference-in-differences']),
});

/**
 * GET /participants/:id/health-records
 * Retrieve health records for a participant, optionally filtered by domain.
 */
router.get(
  '/participants/:id/health-records',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    logger.info('Fetching health records', { participantId: id, domain: req.query.domain });

    let results = mockHealthRecords.filter((r) => r.participantId === id);
    if (req.query.domain) {
      results = results.filter((r) => r.domain === req.query.domain);
    }

    const params = parsePagination(req);
    const response = paginate(results as unknown as Record<string, unknown>[], params);
    res.json(response);
  }),
);

/**
 * POST /health/causal-analysis
 * Run a causal inference analysis between exposure and outcome variables.
 */
router.post(
  '/health/causal-analysis',
  validateBody(causalAnalysisSchema),
  asyncHandler(async (req: Request, res: Response) => {
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
  }),
);

export default router;
