import { Router, Request, Response } from 'express';
import { validateBody } from '../middleware/validation';
import { Participant, ApiResponse } from '../types';
import { logger } from '../utils/logger';

const router = Router();

/** Mock participant store */
const mockParticipants: Participant[] = [
  {
    id: 'p-001',
    externalId: 'WELL-2024-001',
    firstName: 'Alice',
    lastName: 'Chen',
    dateOfBirth: '1955-03-12',
    enrollmentDate: '2024-01-15',
    cohort: 'aging-well-2024',
    status: 'active',
    metadata: { site: 'Boston', language: 'en' },
  },
  {
    id: 'p-002',
    externalId: 'WELL-2024-002',
    firstName: 'Robert',
    lastName: 'Johnson',
    dateOfBirth: '1948-07-22',
    enrollmentDate: '2024-02-01',
    cohort: 'aging-well-2024',
    status: 'active',
    metadata: { site: 'Chicago', language: 'en' },
  },
];

/**
 * GET /participants
 * List all participants with optional filtering by cohort or status.
 */
router.get('/', (req: Request, res: Response) => {
  logger.info('Listing participants', { query: req.query });

  let results = [...mockParticipants];
  if (req.query.cohort) {
    results = results.filter((p) => p.cohort === req.query.cohort);
  }
  if (req.query.status) {
    results = results.filter((p) => p.status === req.query.status);
  }

  const response: ApiResponse<Participant[]> = {
    success: true,
    data: results,
    meta: { total: results.length, timestamp: new Date().toISOString() },
  };
  res.json(response);
});

/**
 * GET /participants/:id
 * Retrieve a single participant by ID.
 */
router.get('/:id', (req: Request, res: Response) => {
  const participant = mockParticipants.find((p) => p.id === req.params.id);

  if (!participant) {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: `Participant ${req.params.id} not found` },
    });
    return;
  }

  const response: ApiResponse<Participant> = {
    success: true,
    data: participant,
    meta: { timestamp: new Date().toISOString() },
  };
  res.json(response);
});

/**
 * POST /participants
 * Create a new participant record.
 */
router.post(
  '/',
  validateBody({
    required: ['externalId', 'firstName', 'lastName', 'dateOfBirth', 'cohort'],
    types: {
      externalId: 'string',
      firstName: 'string',
      lastName: 'string',
      dateOfBirth: 'string',
      cohort: 'string',
    },
  }),
  (req: Request, res: Response) => {
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
  },
);

/**
 * PUT /participants/:id
 * Update an existing participant record.
 */
router.put('/:id', (req: Request, res: Response) => {
  const index = mockParticipants.findIndex((p) => p.id === req.params.id);

  if (index === -1) {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: `Participant ${req.params.id} not found` },
    });
    return;
  }

  mockParticipants[index] = { ...mockParticipants[index], ...req.body, id: req.params.id };
  logger.info('Updated participant', { id: req.params.id });

  const response: ApiResponse<Participant> = {
    success: true,
    data: mockParticipants[index],
    meta: { timestamp: new Date().toISOString() },
  };
  res.json(response);
});

export default router;
