/**
 * Claude API Integration — Type Definitions
 * ==========================================
 * Typed interfaces for all Claude-powered insight generation workflows
 * in the WELLab platform.
 */

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/** Categories for participant-facing insights */
export enum InsightCategory {
  /** Something the participant is doing well */
  Strength = 'strength',
  /** A notable pattern in the data */
  Pattern = 'pattern',
  /** An area with room for improvement, framed constructively */
  GrowthArea = 'growth-area',
}

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

/** Token-level usage tracking for a single Claude API call */
export interface ClaudeUsageMetrics {
  inputTokens: number;
  outputTokens: number;
  model: string;
  latencyMs: number;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Participant insights
// ---------------------------------------------------------------------------

/** A single strength-framed insight shown on the participant dashboard */
export interface Insight {
  /** Short title, e.g. "Social Connections" */
  title: string;
  /** 1-3 sentence narrative */
  body: string;
  /** Category tag */
  category: InsightCategory;
  /** Confidence qualifier already prepended (e.g. "Our data suggest...") */
  confidenceQualifier: string;
  /** Whether a human reviewer must approve before display */
  requiresHumanReview: boolean;
}

/** Input data sent to Claude for participant insight generation */
export interface InsightRequest {
  participantId: string;
  couplingType: 'positive' | 'negative' | 'decoupled' | 'complex';
  couplingStrength: number;
  volatility: number;
  inertia: number;
  recentTrend: TrendDataPoint[];
  /** ISO date of the most recent observation */
  lastObservationDate: string;
}

/** Structured response expected from Claude for participant insights */
export interface InsightResponse {
  insights: Insight[];
  generatedAt: string;
  usage: ClaudeUsageMetrics;
}

// ---------------------------------------------------------------------------
// Trend narrative
// ---------------------------------------------------------------------------

export interface TrendDataPoint {
  date: string;
  positiveAffect: number;
  negativeAffect: number;
  lifeSatisfaction: number;
}

export interface TrendNarrativeRequest {
  participantId: string;
  windowDays: 7 | 30;
  dataPoints: TrendDataPoint[];
}

export interface TrendNarrativeResponse {
  narrative: string;
  generatedAt: string;
  usage: ClaudeUsageMetrics;
}

// ---------------------------------------------------------------------------
// Research summary
// ---------------------------------------------------------------------------

export interface AnalysisResultEntry {
  metric: string;
  value: number;
  ci?: [number, number];
  pValue?: number;
  sampleSize?: number;
}

export interface ResearchSummaryRequest {
  moduleType: 'emotional-dynamics' | 'cognitive-health' | 'lifespan-trajectory' | 'bidirectional';
  analysisResults: AnalysisResultEntry[];
  /** Optional context describing the cohort or study arm */
  cohortDescription?: string;
}

export interface ResearchSummaryResponse {
  methods: string;
  results: string;
  generatedAt: string;
  usage: ClaudeUsageMetrics;
}

// ---------------------------------------------------------------------------
// Policy brief
// ---------------------------------------------------------------------------

export interface PopulationMetric {
  label: string;
  value: number;
  unit: string;
  changeFromPrior?: number;
  demographicBreakdown?: Record<string, number>;
}

export interface PolicyBriefRequest {
  populationMetrics: PopulationMetric[];
  periodLabel: string;
  sampleSize: number;
}

export interface PolicyBriefResponse {
  summary: string;
  keyFindings: string[];
  recommendations: string[];
  generatedAt: string;
  usage: ClaudeUsageMetrics;
}
