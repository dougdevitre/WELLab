import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validateBody } from '../middleware/validation';
import { ClusterAnalysisResult, ApiResponse } from '../types';
import { logger } from '../utils/logger';
import { asyncHandler } from '../utils/asyncHandler';
import { getLifespanTrajectory } from '../services/mockData';
import { LifespanTrajectory } from '../types';

const router = Router();

const clusterAnalysisSchema = z.object({
  participantIds: z.array(z.string().min(1)).min(1),
  domain: z.string().min(1),
  nClusters: z.number().int().min(2).max(20),
  method: z.enum(['gmm', 'lcga', 'k-means']),
});

/**
 * GET /participants/:id/trajectory
 * Retrieve the lifespan trajectory for a participant, optionally filtered by domain.
 */
router.get(
  '/participants/:id/trajectory',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const domain = (req.query.domain as string) || 'well-being';
    logger.info('Fetching lifespan trajectory', { participantId: id, domain });

    const mockTrajectory: LifespanTrajectory = getLifespanTrajectory(id, domain);

    const response: ApiResponse<LifespanTrajectory> = {
      success: true,
      data: mockTrajectory,
      meta: { timestamp: new Date().toISOString() },
    };
    res.json(response);
  }),
);

/**
 * POST /lifespan/cluster-analysis
 * Run a trajectory cluster analysis across participants using GMM, LCGA, or k-means.
 */
router.post(
  '/lifespan/cluster-analysis',
  validateBody(clusterAnalysisSchema),
  asyncHandler(async (req: Request, res: Response) => {
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
  }),
);

export default router;
