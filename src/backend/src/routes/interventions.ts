import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validateBody } from '../middleware/validation';
import { Intervention, ApiResponse } from '../types';
import { logger } from '../utils/logger';
import { asyncHandler } from '../utils/asyncHandler';
import { parsePagination, paginate } from '../utils/pagination';
import { mockInterventions } from '../services/mockData';
import { interventionRepository } from '../db';

const router = Router();

const createInterventionSchema = z.object({
  participantId: z.string().min(1),
  type: z.enum(['behavioral', 'pharmacological', 'cognitive-training', 'social', 'lifestyle']),
  name: z.string().min(1),
  startDate: z.string().min(1),
  endDate: z.string().optional(),
  status: z.enum(['planned', 'active', 'completed', 'discontinued']).optional().default('planned'),
  dosage: z.string().optional(),
  frequency: z.string().optional(),
  outcomes: z.record(z.number()).optional().default({}),
});

/**
 * GET /participants/:id/interventions
 * Retrieve interventions from DynamoDB, with fallback to mock data.
 */
router.get(
  '/participants/:id/interventions',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const statusFilter = req.query.status as string | undefined;
    logger.info('Fetching interventions', { participantId: id });

    let results;
    try {
      const page = await interventionRepository.listByParticipant(id, {
        status: statusFilter as Intervention['status'] | undefined,
      });
      results = page.items;
    } catch (err) {
      logger.warn('DynamoDB intervention query failed, using mock data', { error: (err as Error).message });
      results = mockInterventions.filter((i) => i.participantId === id);
      if (statusFilter) {
        results = results.filter((i) => i.status === statusFilter);
      }
    }

    const params = parsePagination(req);
    const response = paginate(results as unknown as Record<string, unknown>[], params);
    res.json(response);
  }),
);

/**
 * POST /interventions
 * Create a new intervention, persisting to DynamoDB with mock fallback.
 */
router.post(
  '/',
  validateBody(createInterventionSchema),
  asyncHandler(async (req: Request, res: Response) => {
    logger.info('Creating intervention', {
      participantId: req.body.participantId,
      name: req.body.name,
    });

    let newIntervention: Intervention;

    try {
      newIntervention = await interventionRepository.create(req.body.participantId, {
        type: req.body.type,
        name: req.body.name,
        startDate: req.body.startDate,
        endDate: req.body.endDate,
        status: req.body.status,
        dosage: req.body.dosage,
        frequency: req.body.frequency,
        outcomes: req.body.outcomes,
      });
    } catch (err) {
      logger.warn('DynamoDB intervention create failed, using in-memory', { error: (err as Error).message });
      newIntervention = {
        id: `int-${String(mockInterventions.length + 1).padStart(3, '0')}`,
        participantId: req.body.participantId,
        type: req.body.type,
        name: req.body.name,
        startDate: req.body.startDate,
        endDate: req.body.endDate,
        status: req.body.status,
        dosage: req.body.dosage,
        frequency: req.body.frequency,
        outcomes: req.body.outcomes,
      };
      mockInterventions.push(newIntervention);
    }

    const response: ApiResponse<Intervention> = {
      success: true,
      data: newIntervention,
      meta: { timestamp: new Date().toISOString() },
    };
    res.status(201).json(response);
  }),
);

export default router;
