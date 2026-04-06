import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validateBody } from '../middleware/validation';
import { Participant, ApiResponse } from '../types';
import { logger } from '../utils/logger';
import { asyncHandler } from '../utils/asyncHandler';
import { parsePagination, paginate } from '../utils/pagination';
import { mockParticipants } from '../services/mockData';
import { participantRepository } from '../db';

const router = Router();

/** Regex for participant ID format */
const ID_PATTERN = /^[pP]-\d{3,}$/;

const createParticipantSchema = z.object({
  externalId: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  dateOfBirth: z.string().min(1),
  cohort: z.string().min(1),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * GET /participants
 * List participants from DynamoDB with optional filtering.
 * Falls back to mock data when DynamoDB is unavailable.
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    logger.info('Listing participants', { query: req.query });

    let results: Participant[];
    try {
      const page = await participantRepository.list({
        status: req.query.status as Participant['status'] | undefined,
        cohort: req.query.cohort as string | undefined,
      });
      results = page.items;
    } catch (err) {
      logger.warn('DynamoDB participant query failed, using mock data', { error: (err as Error).message });
      results = [...mockParticipants];
      if (req.query.cohort) {
        results = results.filter((p) => p.cohort === req.query.cohort);
      }
      if (req.query.status) {
        results = results.filter((p) => p.status === req.query.status);
      }
    }

    const params = parsePagination(req);
    const response = paginate(results as unknown as Record<string, unknown>[], params);
    res.json(response);
  }),
);

/**
 * GET /participants/:id
 * Retrieve a single participant from DynamoDB or mock data.
 */
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    if (!ID_PATTERN.test(id)) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_ID', message: `Invalid participant ID format: ${id}` },
      });
      return;
    }

    let participant: Participant | undefined;
    try {
      participant = await participantRepository.getById(id);
    } catch (err) {
      logger.warn('DynamoDB participant get failed, trying mock', { error: (err as Error).message });
      participant = mockParticipants.find((p) => p.id === id);
    }

    if (!participant) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: `Participant ${id} not found` },
      });
      return;
    }

    const response: ApiResponse<Participant> = {
      success: true,
      data: participant,
      meta: { timestamp: new Date().toISOString() },
    };
    res.json(response);
  }),
);

/**
 * POST /participants
 * Create a new participant, persisting to DynamoDB with mock fallback.
 */
router.post(
  '/',
  validateBody(createParticipantSchema),
  asyncHandler(async (req: Request, res: Response) => {
    logger.info('Creating participant', { externalId: req.body.externalId });

    let newParticipant: Participant;

    try {
      newParticipant = await participantRepository.create({
        externalId: req.body.externalId,
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        dateOfBirth: req.body.dateOfBirth,
        enrollmentDate: new Date().toISOString().split('T')[0],
        cohort: req.body.cohort,
        status: 'active',
        metadata: req.body.metadata || {},
      });
    } catch (err) {
      logger.warn('DynamoDB participant create failed, using in-memory', { error: (err as Error).message });
      newParticipant = {
        id: `p-${String(mockParticipants.length + 1).padStart(3, '0')}`,
        externalId: req.body.externalId,
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        dateOfBirth: req.body.dateOfBirth,
        enrollmentDate: new Date().toISOString().split('T')[0],
        cohort: req.body.cohort,
        status: 'active',
        metadata: req.body.metadata || {},
      };
      mockParticipants.push(newParticipant);
    }

    const response: ApiResponse<Participant> = {
      success: true,
      data: newParticipant,
      meta: { timestamp: new Date().toISOString() },
    };
    res.status(201).json(response);
  }),
);

/**
 * PUT /participants/:id
 * Update an existing participant in DynamoDB with mock fallback.
 */
router.put(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    if (!ID_PATTERN.test(id)) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_ID', message: `Invalid participant ID format: ${id}` },
      });
      return;
    }

    let updated: Participant;
    try {
      updated = await participantRepository.updateById(id, req.body);
    } catch (err) {
      logger.warn('DynamoDB participant update failed, trying mock', { error: (err as Error).message });
      const index = mockParticipants.findIndex((p) => p.id === id);
      if (index === -1) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: `Participant ${id} not found` },
        });
        return;
      }
      mockParticipants[index] = { ...mockParticipants[index], ...req.body, id };
      updated = mockParticipants[index];
    }

    logger.info('Updated participant', { id });

    const response: ApiResponse<Participant> = {
      success: true,
      data: updated,
      meta: { timestamp: new Date().toISOString() },
    };
    res.json(response);
  }),
);

export default router;
