import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validateBody } from '../middleware/validation';
import { Participant, ApiResponse } from '../types';
import { logger } from '../utils/logger';
import { asyncHandler } from '../utils/asyncHandler';
import { parsePagination, paginate } from '../utils/pagination';
import { mockParticipants } from '../services/mockData';

const router = Router();

/** Regex for participant ID format */
const ID_PATTERN = /^p-\d{3,}$/;

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
 * List all participants with optional filtering by cohort or status.
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    logger.info('Listing participants', { query: req.query });

    let results = [...mockParticipants];
    if (req.query.cohort) {
      results = results.filter((p) => p.cohort === req.query.cohort);
    }
    if (req.query.status) {
      results = results.filter((p) => p.status === req.query.status);
    }

    const params = parsePagination(req);
    const response = paginate(results as unknown as Record<string, unknown>[], params);
    res.json(response);
  }),
);

/**
 * GET /participants/:id
 * Retrieve a single participant by ID.
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

    const participant = mockParticipants.find((p) => p.id === id);

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
 * Create a new participant record.
 */
router.post(
  '/',
  validateBody(createParticipantSchema),
  asyncHandler(async (req: Request, res: Response) => {
    logger.info('Creating participant', { externalId: req.body.externalId });

    const newParticipant: Participant = {
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
 * Update an existing participant record.
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

    const index = mockParticipants.findIndex((p) => p.id === id);

    if (index === -1) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: `Participant ${id} not found` },
      });
      return;
    }

    mockParticipants[index] = { ...mockParticipants[index], ...req.body, id };
    logger.info('Updated participant', { id });

    const response: ApiResponse<Participant> = {
      success: true,
      data: mockParticipants[index],
      meta: { timestamp: new Date().toISOString() },
    };
    res.json(response);
  }),
);

export default router;
