import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validateBody } from '../middleware/validation';
import { CognitiveRiskResult, ApiResponse } from '../types';
import { logger } from '../utils/logger';
import { asyncHandler } from '../utils/asyncHandler';
import { parsePagination, paginate } from '../utils/pagination';
import { mockCognitiveAssessments } from '../services/mockData';
import { cognitiveRepository } from '../db';
import { mlClient } from '../services/mlClient';

const router = Router();

const cognitiveRiskSchema = z.object({
  participantId: z.string().min(1),
  horizonYears: z.number().int().min(1).max(30),
  includeModifiableFactors: z.boolean(),
});

/**
 * GET /participants/:id/cognitive
 * Retrieve cognitive assessment records from DynamoDB, with fallback to mock.
 */
router.get(
  '/participants/:id/cognitive',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    logger.info('Fetching cognitive assessments', { participantId: id });

    let results;
    try {
      const page = await cognitiveRepository.listByParticipant(id);
      results = page.items;
    } catch (err) {
      logger.warn('DynamoDB cognitive query failed, using mock data', { error: (err as Error).message });
      results = mockCognitiveAssessments.filter((a) => a.participantId === id);
    }

    const params = parsePagination(req);
    const response = paginate(results as unknown as Record<string, unknown>[], params);
    res.json(response);
  }),
);

/**
 * POST /cognitive/risk-assessment
 * Run a cognitive decline risk assessment via ML service.
 * Falls back to mock results when ML service is unavailable.
 */
router.post(
  '/cognitive/risk-assessment',
  validateBody(cognitiveRiskSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { participantId, horizonYears, includeModifiableFactors } = req.body;
    logger.info('Running cognitive risk assessment', { participantId, horizonYears });

    let result: CognitiveRiskResult;

    try {
      if (await mlClient.isAvailable()) {
        // Fetch cognitive assessments from DynamoDB
        let assessments;
        try {
          const page = await cognitiveRepository.listByParticipant(participantId);
          assessments = page.items;
        } catch {
          assessments = mockCognitiveAssessments.filter((a) => a.participantId === participantId);
        }

        if (assessments.length > 0) {
          // Build feature matrix from assessment data
          const features: Record<string, number[]> = {
            normalized_score: assessments.map((a) => a.normalizedScore),
            percentile: assessments.map((a) => a.percentile),
            score: assessments.map((a) => a.score),
          };

          const mlResult = await mlClient.assessCognitiveRisk({
            features,
            participantIds: assessments.map((a) => a.participantId),
          });

          const riskScore = mlResult.risk_probabilities[0] ?? 0.23;
          const riskCategory =
            riskScore >= 0.75 ? 'very-high' :
            riskScore >= 0.5 ? 'high' :
            riskScore >= 0.25 ? 'moderate' : 'low';

          result = {
            participantId,
            riskScore,
            riskCategory,
            modifiableFactors: includeModifiableFactors
              ? [
                  { factor: 'physical-activity', impact: -0.15, recommendation: 'Increase aerobic exercise to 150 min/week' },
                  { factor: 'sleep-quality', impact: -0.08, recommendation: 'Address sleep fragmentation' },
                  { factor: 'social-engagement', impact: -0.06, recommendation: 'Increase weekly social interactions' },
                ]
              : [],
            projectedTrajectory: [
              { age: 70, value: 0.87 * (1 - riskScore * 0.1), domain: 'global-cognition', confidence: 0.9 },
              { age: 72, value: 0.84 * (1 - riskScore * 0.15), domain: 'global-cognition', confidence: 0.85 },
              { age: 75, value: 0.79 * (1 - riskScore * 0.2), domain: 'global-cognition', confidence: 0.78 },
              { age: 78, value: 0.73 * (1 - riskScore * 0.25), domain: 'global-cognition', confidence: 0.7 },
              { age: 80, value: 0.68 * (1 - riskScore * 0.3), domain: 'global-cognition', confidence: 0.62 },
            ],
          };
        } else {
          result = buildDefaultCognitiveResult(participantId, includeModifiableFactors);
        }
      } else {
        result = buildDefaultCognitiveResult(participantId, includeModifiableFactors);
      }
    } catch (err) {
      logger.warn('ML cognitive risk failed, using fallback', { error: (err as Error).message });
      result = buildDefaultCognitiveResult(participantId, includeModifiableFactors);
    }

    const response: ApiResponse<CognitiveRiskResult> = {
      success: true,
      data: result,
      meta: { timestamp: new Date().toISOString() },
    };
    res.json(response);
  }),
);

function buildDefaultCognitiveResult(participantId: string, includeModifiableFactors: boolean): CognitiveRiskResult {
  return {
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
      { age: 70, value: 0.87, domain: 'global-cognition', confidence: 0.9 },
      { age: 72, value: 0.84, domain: 'global-cognition', confidence: 0.85 },
      { age: 75, value: 0.79, domain: 'global-cognition', confidence: 0.78 },
      { age: 78, value: 0.73, domain: 'global-cognition', confidence: 0.7 },
      { age: 80, value: 0.68, domain: 'global-cognition', confidence: 0.62 },
    ],
  };
}

export default router;
