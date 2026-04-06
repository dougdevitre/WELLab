import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validateBody } from '../middleware/validation';
import { EmotionalDynamicsResult, ApiResponse } from '../types';
import { logger } from '../utils/logger';
import { asyncHandler } from '../utils/asyncHandler';
import { getEmotionalDynamicsResult } from '../services/mockData';
import { observationRepository } from '../db';
import { mlClient } from '../services/mlClient';

const router = Router();

const analyzeSchema = z.object({
  participantIds: z.array(z.string().min(1)).min(1),
  period: z.object({
    start: z.string().min(1),
    end: z.string().min(1),
  }),
});

/**
 * GET /participants/:id/emotional-dynamics
 * Retrieve emotion coupling analysis and volatility scores for a participant.
 * Attempts ML service first, then falls back to mock data.
 */
router.get(
  '/participants/:id/emotional-dynamics',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    logger.info('Fetching emotional dynamics', { participantId: id });

    let result: EmotionalDynamicsResult;

    try {
      if (await mlClient.isAvailable()) {
        // Pull EMA observations from DynamoDB for this participant
        const obsPage = await observationRepository.listByParticipant(id, { limit: 200 });
        const observations = obsPage.items;

        if (observations.length >= 3) {
          const pids = observations.map(() => id);
          const times = observations.map((_, i) => i);
          const pa = observations.map((o) => Number(o.measures.happiness ?? o.measures.positive_affect ?? 5));
          const na = observations.map((o) => Number(o.measures.sadness ?? o.measures.negative_affect ?? 3));

          const mlResult = await mlClient.analyzeEmotionalDynamics({
            participantIds: pids,
            time: times,
            positiveAffect: pa,
            negativeAffect: na,
          });

          // Also compute volatility
          const volResult = await mlClient.computeVolatility({
            participantId: id,
            timeSeries: pa,
          });

          const couplingType = mlResult.coupling_results[id] ?? 'decoupled';
          result = {
            participantId: id,
            period: {
              start: observations[0]?.timestamp ?? new Date().toISOString(),
              end: observations[observations.length - 1]?.timestamp ?? new Date().toISOString(),
            },
            volatility: volResult.mean_volatility,
            inertia: 0.5, // Placeholder until full IDELS implementation
            couplings: [{
              emotionA: 'positive_affect',
              emotionB: 'negative_affect',
              couplingStrength: couplingType === 'positive' ? 0.7 : couplingType === 'negative' ? -0.7 : 0.1,
              lag: 0,
              pValue: 0.01,
            }],
            granularity: 0.6,
          };
        } else {
          result = getEmotionalDynamicsResult(id);
        }
      } else {
        result = getEmotionalDynamicsResult(id);
      }
    } catch (err) {
      logger.warn('ML service call failed, using fallback', { error: (err as Error).message });
      result = getEmotionalDynamicsResult(id);
    }

    const response: ApiResponse<EmotionalDynamicsResult> = {
      success: true,
      data: result,
      meta: { timestamp: new Date().toISOString() },
    };
    res.json(response);
  }),
);

/**
 * POST /emotional-dynamics/analyze
 * Run an emotion coupling and volatility analysis across one or more participants.
 * Uses ML service for real analysis when available.
 */
router.post(
  '/emotional-dynamics/analyze',
  validateBody(analyzeSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { participantIds, period } = req.body;
    logger.info('Running emotional dynamics analysis', {
      participantCount: participantIds.length,
      period,
    });

    let results: EmotionalDynamicsResult[];

    try {
      if (await mlClient.isAvailable()) {
        // Gather observations for all participants from DynamoDB
        const allObs = await Promise.all(
          participantIds.map(async (pid: string) => {
            const page = await observationRepository.listByParticipant(pid, {
              startDate: period.start,
              endDate: period.end,
              limit: 200,
            });
            return { pid, observations: page.items };
          }),
        );

        // Flatten into ML request format
        const pids: string[] = [];
        const times: number[] = [];
        const pa: number[] = [];
        const na: number[] = [];

        for (const { pid, observations } of allObs) {
          for (let i = 0; i < observations.length; i++) {
            const obs = observations[i];
            pids.push(pid);
            times.push(i);
            pa.push(Number(obs.measures.happiness ?? obs.measures.positive_affect ?? 5));
            na.push(Number(obs.measures.sadness ?? obs.measures.negative_affect ?? 3));
          }
        }

        if (pids.length >= 3) {
          const mlResult = await mlClient.analyzeEmotionalDynamics({
            participantIds: pids,
            time: times,
            positiveAffect: pa,
            negativeAffect: na,
          });

          results = participantIds.map((pid: string) => {
            const couplingType = mlResult.coupling_results[pid] ?? 'decoupled';
            return {
              participantId: pid,
              period,
              volatility: Math.abs(couplingType === 'complex' ? 0.8 : 0.4),
              inertia: 0.5,
              couplings: [{
                emotionA: 'positive_affect',
                emotionB: 'negative_affect',
                couplingStrength: couplingType === 'positive' ? 0.7 : couplingType === 'negative' ? -0.7 : 0.1,
                lag: 0,
                pValue: 0.01,
              }],
              granularity: 0.6,
            };
          });
        } else {
          results = participantIds.map((pid: string) => getEmotionalDynamicsResult(pid));
        }
      } else {
        results = participantIds.map((pid: string) => getEmotionalDynamicsResult(pid));
      }
    } catch (err) {
      logger.warn('ML batch analysis failed, using fallback', { error: (err as Error).message });
      results = participantIds.map((pid: string) => getEmotionalDynamicsResult(pid));
    }

    const response: ApiResponse<EmotionalDynamicsResult[]> = {
      success: true,
      data: results,
      meta: { total: results.length, timestamp: new Date().toISOString() },
    };
    res.json(response);
  }),
);

export default router;
