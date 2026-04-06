/**
 * Pipeline Orchestrator
 * =====================
 * Manages the continuous learning loop:
 *   Data Capture → Model Dynamics → Generate Insights → Deploy Interventions → Feed Back
 *
 * Coordinates model retraining, drift detection, and feedback ingestion
 * through the ML service and DynamoDB repositories.
 */

import { logger } from '../utils/logger';
import { mlClient, PipelineRetrainMLResult, DriftCheckMLResult } from './mlClient';
import { observationRepository } from '../db';
import { interventionRepository } from '../db';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FeedbackLoopInput {
  participantId: string;
  interventionId: string;
  preScores: Record<string, number>;
  postScores: Record<string, number>;
  interventionType: string;
  completionDate: string;
}

export interface FeedbackLoopResult {
  participantId: string;
  interventionId: string;
  improvement: Record<string, number>;
  overallDelta: number;
  retrainTriggered: boolean;
  timestamp: string;
}

export interface PipelineStatus {
  mlServiceAvailable: boolean;
  lastRetrainTimestamp: string | null;
  lastDriftCheck: DriftCheckMLResult | null;
  feedbackCount: number;
  modules: Record<string, { version: string; lastRetrained: string | null }>;
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const _feedbackBuffer: FeedbackLoopInput[] = [];
const RETRAIN_THRESHOLD = 50; // retrain after N feedback entries
let _lastRetrainTimestamp: string | null = null;
let _lastDriftCheck: DriftCheckMLResult | null = null;

const _moduleState: Record<string, { version: string; lastRetrained: string | null }> = {
  emotional_dynamics: { version: '1.0.0', lastRetrained: null },
  cognitive_risk: { version: '1.0.0', lastRetrained: null },
  trajectory: { version: '1.0.0', lastRetrained: null },
  health: { version: '1.0.0', lastRetrained: null },
};

// ---------------------------------------------------------------------------
// Feedback ingestion (Continuous Learning Loop)
// ---------------------------------------------------------------------------

/**
 * Ingest intervention outcome feedback into the continuous learning pipeline.
 * When enough feedback accumulates, automatically triggers model retraining.
 */
export async function ingestFeedback(input: FeedbackLoopInput): Promise<FeedbackLoopResult> {
  // Compute improvement deltas
  const improvement: Record<string, number> = {};
  let totalDelta = 0;
  let count = 0;

  for (const [key, preVal] of Object.entries(input.preScores)) {
    const postVal = input.postScores[key];
    if (postVal !== undefined) {
      const delta = postVal - preVal;
      improvement[key] = delta;
      totalDelta += delta;
      count++;
    }
  }

  const overallDelta = count > 0 ? totalDelta / count : 0;

  // Buffer the feedback
  _feedbackBuffer.push(input);

  logger.info('Feedback ingested', {
    participantId: input.participantId,
    interventionId: input.interventionId,
    overallDelta,
    bufferSize: _feedbackBuffer.length,
  });

  // Mark intervention completed if outcomes provided
  try {
    await interventionRepository.markCompleted(input.participantId, input.interventionId);
  } catch (err) {
    logger.warn('Failed to mark intervention completed', { error: (err as Error).message });
  }

  // Auto-trigger retraining when threshold is reached
  let retrainTriggered = false;
  if (_feedbackBuffer.length >= RETRAIN_THRESHOLD) {
    try {
      await triggerRetrain('all');
      retrainTriggered = true;
    } catch (err) {
      logger.error('Auto-retrain failed', { error: (err as Error).message });
    }
  }

  return {
    participantId: input.participantId,
    interventionId: input.interventionId,
    improvement,
    overallDelta,
    retrainTriggered,
    timestamp: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Model retraining
// ---------------------------------------------------------------------------

/**
 * Trigger retraining for a specific module or all modules.
 */
export async function triggerRetrain(
  module: string,
): Promise<PipelineRetrainMLResult[]> {
  if (!(await mlClient.isAvailable())) {
    throw new Error('ML service unavailable — cannot retrain');
  }

  const modules = module === 'all'
    ? ['emotional_dynamics', 'cognitive_risk', 'trajectory', 'health']
    : [module];

  const results: PipelineRetrainMLResult[] = [];

  for (const mod of modules) {
    logger.info('Triggering retrain', { module: mod });

    // Gather training data from DynamoDB
    const trainingData = await gatherTrainingData(mod);

    const result = await mlClient.retrainModel({
      module: mod,
      data: trainingData.data,
      targetCol: trainingData.targetCol,
    });

    results.push(result);

    // Update module state
    _moduleState[mod] = {
      version: result.model_version,
      lastRetrained: result.timestamp,
    };
  }

  _lastRetrainTimestamp = new Date().toISOString();
  _feedbackBuffer.length = 0; // Clear the buffer after retraining

  logger.info('Retrain complete', { modules, timestamp: _lastRetrainTimestamp });
  return results;
}

/**
 * Gather training data from DynamoDB for the specified module.
 */
async function gatherTrainingData(module: string): Promise<{
  data: Record<string, unknown[]>;
  targetCol?: string;
}> {
  switch (module) {
    case 'emotional_dynamics': {
      // Pull recent observations and format for emotional dynamics training
      const observations = await safeListObservations();
      return {
        data: {
          participant_id: observations.map((o) => o.participantId),
          time: observations.map((_, i) => i),
          positive_affect: observations.map((o) => Number(o.measures.happiness ?? o.measures.positive_affect ?? 5)),
          negative_affect: observations.map((o) => Number(o.measures.sadness ?? o.measures.negative_affect ?? 3)),
        },
      };
    }

    case 'cognitive_risk': {
      // Use feedback buffer data as training signal
      return {
        data: {
          score: _feedbackBuffer.map((f) => Object.values(f.preScores)[0] ?? 0),
          percentile: _feedbackBuffer.map((f) => Object.values(f.preScores)[1] ?? 50),
          normalized_score: _feedbackBuffer.map((f) => Object.values(f.preScores)[2] ?? 0.5),
          cognitive_decline: _feedbackBuffer.map((f) => {
            const delta = Object.values(f.postScores)[0]! - Object.values(f.preScores)[0]!;
            return delta < -0.1 ? 1 : 0;
          }),
        },
        targetCol: 'cognitive_decline',
      };
    }

    case 'trajectory': {
      return {
        data: {
          participant_id: _feedbackBuffer.map((f) => f.participantId),
          age: _feedbackBuffer.map(() => 65 + Math.random() * 20),
          wellbeing: _feedbackBuffer.map((f) => {
            const vals = Object.values(f.postScores);
            return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 50;
          }),
        },
      };
    }

    case 'health': {
      return {
        data: {
          participant_id: _feedbackBuffer.map((f) => f.participantId),
          wave: _feedbackBuffer.map((_, i) => i),
          health_outcome: _feedbackBuffer.map((f) => {
            const vals = Object.values(f.postScores);
            return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 50;
          }),
        },
      };
    }

    default:
      return { data: {} };
  }
}

async function safeListObservations() {
  try {
    // Pull observations for known participant IDs from feedback
    const pids = [...new Set(_feedbackBuffer.map((f) => f.participantId))];
    const allObs = await Promise.all(
      pids.slice(0, 10).map(async (pid) => {
        const page = await observationRepository.listByParticipant(pid, { limit: 50 });
        return page.items;
      }),
    );
    return allObs.flat();
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Drift detection
// ---------------------------------------------------------------------------

/**
 * Run drift detection on incoming data against stored reference distributions.
 */
export async function checkDataDrift(params: {
  referenceData: Record<string, number[]>;
  newData: Record<string, number[]>;
}): Promise<DriftCheckMLResult> {
  if (!(await mlClient.isAvailable())) {
    throw new Error('ML service unavailable — cannot check drift');
  }

  const result = await mlClient.checkDrift({
    referenceData: params.referenceData,
    newData: params.newData,
  });

  _lastDriftCheck = result;

  if (result.overall_drifted) {
    logger.warn('Data drift detected', {
      severity: result.severity,
      driftedFeatures: result.drifted_features,
    });
  }

  return result;
}

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

/**
 * Get the current pipeline orchestration status.
 */
export async function getPipelineStatus(): Promise<PipelineStatus> {
  const mlAvailable = await mlClient.isAvailable();

  return {
    mlServiceAvailable: mlAvailable,
    lastRetrainTimestamp: _lastRetrainTimestamp,
    lastDriftCheck: _lastDriftCheck,
    feedbackCount: _feedbackBuffer.length,
    modules: { ..._moduleState },
  };
}
