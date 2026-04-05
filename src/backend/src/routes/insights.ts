/**
 * Insights API Routes
 * ===================
 * Endpoints for AI-powered insight generation via the Claude API.
 *
 * Authentication: all routes require a valid JWT.
 * Authorization:
 *  - GET /participants/:id/insights — participant (own data) or researcher/admin
 *  - POST /insights/*               — researcher or admin only
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireRole } from '../middleware/auth';
import { validateBody } from '../middleware/validation';
import { asyncHandler } from '../utils/asyncHandler';
import { logger } from '../utils/logger';
import { ApiResponse } from '../types';
import {
  generateParticipantInsights,
  generateTrendNarrative,
  generateResearchSummary,
  generatePolicyBrief,
} from '../services/claude/insightEngine';
import {
  InsightResponse,
  TrendNarrativeResponse,
  ResearchSummaryResponse,
  PolicyBriefResponse,
} from '../services/claude/types';

const router = Router();

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const trendDataPointSchema = z.object({
  date: z.string().min(1),
  positiveAffect: z.number(),
  negativeAffect: z.number(),
  lifeSatisfaction: z.number(),
});

const participantInsightQuerySchema = z.object({
  couplingType: z.enum(['positive', 'negative', 'decoupled', 'complex']),
  couplingStrength: z.number().min(-1).max(1),
  volatility: z.number().min(0),
  inertia: z.number().min(0).max(1),
  recentTrend: z.array(trendDataPointSchema).optional().default([]),
});

const trendNarrativeSchema = z.object({
  participantId: z.string().min(1),
  windowDays: z.union([z.literal(7), z.literal(30)]),
  dataPoints: z.array(trendDataPointSchema).min(1),
});

const analysisResultSchema = z.object({
  metric: z.string().min(1),
  value: z.number(),
  ci: z.tuple([z.number(), z.number()]).optional(),
  pValue: z.number().optional(),
  sampleSize: z.number().optional(),
});

const researchSummarySchema = z.object({
  moduleType: z.enum([
    'emotional-dynamics',
    'cognitive-health',
    'lifespan-trajectory',
    'bidirectional',
  ]),
  analysisResults: z.array(analysisResultSchema).min(1),
  cohortDescription: z.string().optional(),
});

const populationMetricSchema = z.object({
  label: z.string().min(1),
  value: z.number(),
  unit: z.string().min(1),
  changeFromPrior: z.number().optional(),
  demographicBreakdown: z.record(z.number()).optional(),
});

const policyBriefSchema = z.object({
  populationMetrics: z.array(populationMetricSchema).min(1),
  periodLabel: z.string().min(1),
  sampleSize: z.number().int().positive(),
});

// ---------------------------------------------------------------------------
// Participant ID pattern
// ---------------------------------------------------------------------------
const ID_PATTERN = /^p-\d{3,}$/;

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/**
 * GET /participants/:id/insights
 * Generate or retrieve cached strength-framed insights for a participant.
 *
 * Query params encode the emotional dynamics context so the endpoint is
 * idempotent and cacheable.
 */
router.get(
  '/participants/:id/insights',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    if (!ID_PATTERN.test(id)) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_ID', message: `Invalid participant ID format: ${id}` },
      });
      return;
    }

    // Participants can only view their own insights
    if (req.user?.role === 'participant' && req.user.sub !== id) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Participants may only view their own insights' },
      });
      return;
    }

    // Parse emotional dynamics context from query string
    const parseResult = participantInsightQuerySchema.safeParse({
      couplingType: req.query.couplingType,
      couplingStrength: req.query.couplingStrength
        ? Number(req.query.couplingStrength)
        : undefined,
      volatility: req.query.volatility ? Number(req.query.volatility) : undefined,
      inertia: req.query.inertia ? Number(req.query.inertia) : undefined,
      recentTrend: req.query.recentTrend
        ? JSON.parse(req.query.recentTrend as string)
        : [],
    });

    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid insight request parameters',
          details: parseResult.error.flatten(),
        },
      });
      return;
    }

    const { couplingType, couplingStrength, volatility, inertia, recentTrend } =
      parseResult.data;

    logger.info('Generating participant insights', { participantId: id });

    const insights = await generateParticipantInsights(
      id,
      { couplingType, couplingStrength, volatility, inertia },
      recentTrend,
    );

    const response: ApiResponse<InsightResponse> = {
      success: true,
      data: insights,
      meta: { timestamp: new Date().toISOString() },
    };

    res.json(response);
  }),
);

/**
 * POST /insights/trend-narrative
 * Generate a natural-language narrative from trend data.
 * Requires researcher or admin role.
 */
router.post(
  '/insights/trend-narrative',
  requireRole('researcher', 'admin'),
  validateBody(trendNarrativeSchema),
  asyncHandler(async (req: Request, res: Response) => {
    logger.info('Generating trend narrative', {
      participantId: req.body.participantId,
      windowDays: req.body.windowDays,
    });

    const narrative = await generateTrendNarrative(req.body);

    const response: ApiResponse<TrendNarrativeResponse> = {
      success: true,
      data: narrative,
      meta: { timestamp: new Date().toISOString() },
    };

    res.json(response);
  }),
);

/**
 * POST /insights/research-summary
 * Auto-generate methods and results paragraphs.
 * Requires researcher or admin role.
 */
router.post(
  '/insights/research-summary',
  requireRole('researcher', 'admin'),
  validateBody(researchSummarySchema),
  asyncHandler(async (req: Request, res: Response) => {
    logger.info('Generating research summary', {
      moduleType: req.body.moduleType,
    });

    const summary = await generateResearchSummary(req.body);

    const response: ApiResponse<ResearchSummaryResponse> = {
      success: true,
      data: summary,
      meta: { timestamp: new Date().toISOString() },
    };

    res.json(response);
  }),
);

/**
 * POST /insights/policy-brief
 * Generate a plain-language policy brief from population metrics.
 * Requires researcher or admin role.
 */
router.post(
  '/insights/policy-brief',
  requireRole('researcher', 'admin'),
  validateBody(policyBriefSchema),
  asyncHandler(async (req: Request, res: Response) => {
    logger.info('Generating policy brief', {
      periodLabel: req.body.periodLabel,
      sampleSize: req.body.sampleSize,
    });

    const brief = await generatePolicyBrief(req.body);

    const response: ApiResponse<PolicyBriefResponse> = {
      success: true,
      data: brief,
      meta: { timestamp: new Date().toISOString() },
    };

    res.json(response);
  }),
);

export default router;
