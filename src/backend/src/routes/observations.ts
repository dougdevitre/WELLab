import { Router, Request, Response } from 'express';
import { validateBody } from '../middleware/validation';
import { Observation, ApiResponse } from '../types';
import { logger } from '../utils/logger';

const router = Router();

/** Mock observations store */
const mockObservations: Observation[] = [
  {
    id: 'obs-001',
    participantId: 'p-001',
    timestamp: '2024-06-15T09:30:00Z',
    source: 'ema',
    measures: { happiness: 7, sadness: 2, anxiety: 3, energy: 6 },
    context: { activity: 'morning-routine', socialContext: 'alone', deviceType: 'mobile' },
  },
  {
    id: 'obs-002',
    participantId: 'p-001',
    timestamp: '2024-06-15T14:00:00Z',
    source: 'ema',
    measures: { happiness: 5, sadness: 4, anxiety: 5, energy: 4 },
    context: { activity: 'work', socialContext: 'colleagues', deviceType: 'mobile' },
  },
];

/**
 * GET /participants/:id/observations
 * List EMA observations for a given participant.
 */
router.get('/participants/:id/observations', (req: Request, res: Response) => {
  const { id } = req.params;
  logger.info('Fetching observations', { participantId: id });

  const results = mockObservations.filter((o) => o.participantId === id);

  const response: ApiResponse<Observation[]> = {
    success: true,
    data: results,
    meta: { total: results.length, timestamp: new Date().toISOString() },
  };
  res.json(response);
});

/**
 * POST /participants/:id/observations
 * Record a new EMA observation for a participant.
 */
router.post(
  '/participants/:id/observations',
  validateBody({
    required: ['source', 'measures'],
    types: { source: 'string', measures: 'object' },
  }),
  (req: Request, res: Response) => {
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
  },
);

export default router;
