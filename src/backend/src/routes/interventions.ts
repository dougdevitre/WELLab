import { Router, Request, Response } from 'express';
import { validateBody } from '../middleware/validation';
import { Intervention, ApiResponse } from '../types';
import { logger } from '../utils/logger';

const router = Router();

/** Mock interventions store */
const mockInterventions: Intervention[] = [
  {
    id: 'int-001',
    participantId: 'p-001',
    type: 'behavioral',
    name: 'Mindfulness-Based Stress Reduction',
    startDate: '2024-03-01',
    endDate: '2024-05-01',
    status: 'completed',
    frequency: '3x/week',
    outcomes: { stressReduction: 0.35, wellBeingImprovement: 0.22 },
  },
  {
    id: 'int-002',
    participantId: 'p-001',
    type: 'lifestyle',
    name: 'Mediterranean Diet Program',
    startDate: '2024-04-15',
    status: 'active',
    frequency: 'daily',
    outcomes: {},
  },
];

/**
 * GET /participants/:id/interventions
 * Retrieve interventions assigned to a participant.
 */
router.get('/participants/:id/interventions', (req: Request, res: Response) => {
  const { id } = req.params;
  logger.info('Fetching interventions', { participantId: id });

  let results = mockInterventions.filter((i) => i.participantId === id);
  if (req.query.status) {
    results = results.filter((i) => i.status === req.query.status);
  }

  const response: ApiResponse<Intervention[]> = {
    success: true,
    data: results,
    meta: { total: results.length, timestamp: new Date().toISOString() },
  };
  res.json(response);
});

/**
 * POST /interventions
 * Create a new intervention for a participant.
 */
router.post(
  '/',
  validateBody({
    required: ['participantId', 'type', 'name', 'startDate'],
    types: {
      participantId: 'string',
      type: 'string',
      name: 'string',
      startDate: 'string',
    },
  }),
  (req: Request, res: Response) => {
    logger.info('Creating intervention', {
      participantId: req.body.participantId,
      name: req.body.name,
    });

    const newIntervention: Intervention = {
      id: `int-${String(mockInterventions.length + 1).padStart(3, '0')}`,
      participantId: req.body.participantId,
      type: req.body.type,
      name: req.body.name,
      startDate: req.body.startDate,
      endDate: req.body.endDate,
      status: req.body.status || 'planned',
      dosage: req.body.dosage,
      frequency: req.body.frequency,
      outcomes: req.body.outcomes || {},
    };

    mockInterventions.push(newIntervention);

    const response: ApiResponse<Intervention> = {
      success: true,
      data: newIntervention,
      meta: { timestamp: new Date().toISOString() },
    };
    res.status(201).json(response);
  },
);

export default router;
