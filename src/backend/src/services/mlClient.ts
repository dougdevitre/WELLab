/**
 * ML Pipeline Client
 * ==================
 * HTTP client that bridges the Express backend to the FastAPI ML serving layer.
 * Provides typed methods for each ML module and includes retry logic,
 * timeout handling, and graceful fallback to mock data when the ML service
 * is unavailable.
 */

import { logger } from '../utils/logger';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const ML_API_BASE = process.env.ML_API_URL ?? 'http://localhost:8000';
const ML_API_TIMEOUT = parseInt(process.env.ML_API_TIMEOUT ?? '30000', 10);
const ML_API_RETRIES = parseInt(process.env.ML_API_RETRIES ?? '2', 10);

// ---------------------------------------------------------------------------
// Response types (matching FastAPI Pydantic models)
// ---------------------------------------------------------------------------

export interface EmotionalDynamicsMLResult {
  coupling_results: Record<string, string>;
  n_participants: number;
  model_version: string;
}

export interface CognitiveRiskMLResult {
  risk_probabilities: number[];
  high_risk_flags: boolean[];
  model_version: string;
}

export interface TrajectoryMLResult {
  assignments: Record<string, number>;
  centroids: number[][];
  n_clusters: number;
  model_version: string;
}

export interface CausalAnalysisMLResult {
  treatment: string;
  outcome: string;
  estimate: number;
  confidence_interval: [number, number];
  refutation_passed: boolean | null;
  method: string;
  model_version: string;
}

export interface BidirectionalMLResult {
  wellbeing_to_health: CausalAnalysisMLResult;
  health_to_wellbeing: CausalAnalysisMLResult;
  model_version: string;
}

export interface VolatilityMLResult {
  participant_id: string;
  volatility_scores: (number | null)[];
  mean_volatility: number;
  model_version: string;
}

export interface DriftCheckMLResult {
  overall_drifted: boolean;
  severity: string;
  drifted_features: string[];
  summary: Record<string, unknown>;
}

export interface PipelineRetrainMLResult {
  module: string;
  status: string;
  metrics: Record<string, unknown>;
  model_version: string;
  timestamp: string;
}

export interface MLHealthStatus {
  status: string;
  timestamp: string;
  models_loaded: Record<string, boolean>;
}

// ---------------------------------------------------------------------------
// Core HTTP helper with retry + timeout
// ---------------------------------------------------------------------------

async function mlFetch<T>(
  path: string,
  options: {
    method?: 'GET' | 'POST';
    body?: unknown;
    retries?: number;
  } = {},
): Promise<T> {
  const { method = 'GET', body, retries = ML_API_RETRIES } = options;
  const url = `${ML_API_BASE}${path}`;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), ML_API_TIMEOUT);

      const fetchOptions: RequestInit = {
        method,
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
      };

      if (body !== undefined) {
        fetchOptions.body = JSON.stringify(body);
      }

      const response = await fetch(url, fetchOptions);
      clearTimeout(timeout);

      if (!response.ok) {
        const errorBody = await response.text().catch(() => 'Unknown error');
        throw new Error(`ML API ${response.status}: ${errorBody}`);
      }

      const data = (await response.json()) as T;
      return data;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < retries) {
        const backoff = Math.pow(2, attempt) * 500;
        logger.warn(`ML API call failed (attempt ${attempt + 1}/${retries + 1}), retrying in ${backoff}ms`, {
          path,
          error: lastError.message,
        });
        await new Promise((resolve) => setTimeout(resolve, backoff));
      }
    }
  }

  throw lastError ?? new Error('ML API call failed');
}

// ---------------------------------------------------------------------------
// ML Client
// ---------------------------------------------------------------------------

class MLClient {
  private _available: boolean | null = null;

  /**
   * Check if the ML service is reachable. Result is cached for 60s.
   */
  async isAvailable(): Promise<boolean> {
    if (this._available !== null) return this._available;

    try {
      await mlFetch<MLHealthStatus>('/health', { retries: 0 });
      this._available = true;
      // Clear cached status after 60s so we re-check periodically
      setTimeout(() => { this._available = null; }, 60_000);
      return true;
    } catch {
      this._available = false;
      setTimeout(() => { this._available = null; }, 60_000);
      logger.warn('ML service unavailable — routes will use fallback data');
      return false;
    }
  }

  /**
   * Get ML service health status.
   */
  async getHealth(): Promise<MLHealthStatus> {
    return mlFetch<MLHealthStatus>('/health');
  }

  // -----------------------------------------------------------------------
  // Emotional Dynamics
  // -----------------------------------------------------------------------

  async analyzeEmotionalDynamics(params: {
    participantIds: string[];
    time: number[];
    positiveAffect: number[];
    negativeAffect: number[];
    couplingThreshold?: number;
  }): Promise<EmotionalDynamicsMLResult> {
    return mlFetch<EmotionalDynamicsMLResult>('/predict/emotional-dynamics', {
      method: 'POST',
      body: {
        participant_ids: params.participantIds,
        time: params.time,
        positive_affect: params.positiveAffect,
        negative_affect: params.negativeAffect,
        coupling_threshold: params.couplingThreshold,
      },
    });
  }

  async computeVolatility(params: {
    participantId: string;
    timeSeries: number[];
    window?: number;
  }): Promise<VolatilityMLResult> {
    return mlFetch<VolatilityMLResult>('/predict/volatility', {
      method: 'POST',
      body: {
        participant_id: params.participantId,
        time_series: params.timeSeries,
        window: params.window,
      },
    });
  }

  // -----------------------------------------------------------------------
  // Cognitive Risk
  // -----------------------------------------------------------------------

  async assessCognitiveRisk(params: {
    features: Record<string, number[]>;
    participantIds?: string[];
  }): Promise<CognitiveRiskMLResult> {
    return mlFetch<CognitiveRiskMLResult>('/predict/cognitive-risk', {
      method: 'POST',
      body: {
        features: params.features,
        participant_ids: params.participantIds,
      },
    });
  }

  // -----------------------------------------------------------------------
  // Trajectory
  // -----------------------------------------------------------------------

  async clusterTrajectories(params: {
    participantIds: string[];
    age: number[];
    wellbeing: number[];
    nClusters?: number;
  }): Promise<TrajectoryMLResult> {
    return mlFetch<TrajectoryMLResult>('/predict/trajectory', {
      method: 'POST',
      body: {
        participant_ids: params.participantIds,
        age: params.age,
        wellbeing: params.wellbeing,
        n_clusters: params.nClusters,
      },
    });
  }

  // -----------------------------------------------------------------------
  // Health Engine (Causal Analysis)
  // -----------------------------------------------------------------------

  async runCausalAnalysis(params: {
    treatment: string;
    outcome: string;
    confounders: string[];
    data: Record<string, number[]>;
  }): Promise<CausalAnalysisMLResult> {
    return mlFetch<CausalAnalysisMLResult>('/predict/causal-analysis', {
      method: 'POST',
      body: params,
    });
  }

  async runBidirectionalAnalysis(params: {
    participantIds: string[];
    wellbeingScores: number[];
    healthScores: number[];
    waves: number[];
  }): Promise<BidirectionalMLResult> {
    return mlFetch<BidirectionalMLResult>('/predict/bidirectional', {
      method: 'POST',
      body: {
        participant_ids: params.participantIds,
        wellbeing_scores: params.wellbeingScores,
        health_scores: params.healthScores,
        waves: params.waves,
      },
    });
  }

  // -----------------------------------------------------------------------
  // Pipeline operations
  // -----------------------------------------------------------------------

  async checkDrift(params: {
    referenceData: Record<string, number[]>;
    newData: Record<string, number[]>;
    categoricalColumns?: string[];
  }): Promise<DriftCheckMLResult> {
    return mlFetch<DriftCheckMLResult>('/pipeline/drift-check', {
      method: 'POST',
      body: {
        reference_data: params.referenceData,
        new_data: params.newData,
        categorical_columns: params.categoricalColumns ?? [],
      },
    });
  }

  async retrainModel(params: {
    module: string;
    data: Record<string, unknown[]>;
    targetCol?: string;
    configOverrides?: Record<string, unknown>;
  }): Promise<PipelineRetrainMLResult> {
    return mlFetch<PipelineRetrainMLResult>('/pipeline/retrain', {
      method: 'POST',
      body: {
        module: params.module,
        data: params.data,
        target_col: params.targetCol,
        config_overrides: params.configOverrides ?? {},
      },
    });
  }
}

/** Singleton ML client instance */
export const mlClient = new MLClient();
