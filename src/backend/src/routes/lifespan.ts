import { Router, Request, Response } from 'express';
import { validateBody } from '../middleware/validation';
import { LifespanTrajectory, ClusterAnalysisResult, ApiResponse } from '../types';
import { logger } from '../utils/logger';

const router = Router();

/**
 * GET /participants/:id/trajectory
 * Retrieve the lifespan trajectory for a participant, optionally filtered by domain.
 */
router.get('/participants/:id/trajectory', (req: Request, res: Response) => {
  const { id } = req.params;
  const domain = (req.query.domain as string) || 'well-being';
  logger.info('Fetching lifespan trajectory', { participantId: id, domain });

  const mockTrajectory: LifespanTrajectory = {
    participantId: id,
    domain,
    points: [
      { age: 50, value: 72, domain, confidence: 0.95 },
      { age: 55, value: 70, domain, confidence: 0.93 },
      { age: 60, value: 68, domain, confidence: 0.90 },
      { age: 65, value: 71, domain, confidence: 0.88 },
      { age: 70, value: 65, domain, confidence: 0.85 },
    ],
    clusterLabel: 'resilient-stable',
    trajectoryClass: 'U-shaped recovery',
  };

  const response: ApiResponse<LifespanTrajectory> = {
    success: true,
    data: mockTrajectory,
    meta: { timestamp: new Date().toISOString() },
  };
  res.json(response);
});

/**
 * POST /lifespan/cluster-analysis
 * Run a trajectory cluster analysis across participants using GMM, LCGA, or k-means.
 */
router.post(
  '/lifespan/cluster-analysis',
  validateBody({
    required: ['participantIds', 'domain', 'nClusters', 'method'],
    types: {
      participantIds: 'array',
      domain: 'string',
      nClusters: 'number',
      method: 'string',
    },
  }),
  (req: Request, res: Response) => {
    const { participantIds, domain, nClusters, method } = req.body;
    logger.info('Running cluster analysis', { domain, nClusters, method });

    const mockResult: ClusterAnalysisResult = {
      clusters: [
        {
          label: 'stable-high',
          memberCount: Math.ceil(participantIds.length * 0.4),
          centroid: [72, 71, 70, 71, 70],
          participantIds: participantIds.slice(0, Math.ceil(participantIds.length * 0.4)),
        },
        {
          label: 'declining',
          memberCount: Math.ceil(participantIds.length * 0.3),
          centroid: [70, 65, 60, 55, 50],
          participantIds: participantIds.slice(
            Math.ceil(participantIds.length * 0.4),
            Math.ceil(participantIds.length * 0.7),
          ),
        },
        {
          label: 'resilient-recovery',
          memberCount: participantIds.length - Math.ceil(participantIds.length * 0.7),
          centroid: [68, 60, 58, 63, 67],
          participantIds: participantIds.slice(Math.ceil(participantIds.length * 0.7)),
        },
      ],
      silhouetteScore: 0.72,
      method,
    };

    const response: ApiResponse<ClusterAnalysisResult> = {
      success: true,
      data: mockResult,
      meta: { timestamp: new Date().toISOString() },
    };
    res.json(response);
  },
);

export default router;
