/** Unique identifier type alias */
export type ID = string;

/** ISO 8601 date string */
export type ISODateString = string;

/** Participant demographic and enrollment record */
export interface Participant {
  id: ID;
  externalId: string;
  firstName: string;
  lastName: string;
  dateOfBirth: ISODateString;
  enrollmentDate: ISODateString;
  cohort: string;
  status: 'active' | 'inactive' | 'withdrawn';
  metadata: Record<string, unknown>;
}

/** Ecological Momentary Assessment observation */
export interface Observation {
  id: ID;
  participantId: ID;
  timestamp: ISODateString;
  source: 'ema' | 'sensor' | 'clinical' | 'self-report';
  measures: Record<string, number | string | boolean>;
  context: ObservationContext;
}

/** Contextual metadata for an observation */
export interface ObservationContext {
  location?: string;
  activity?: string;
  socialContext?: string;
  deviceType?: string;
}

/** Emotion coupling pair result */
export interface EmotionCoupling {
  emotionA: string;
  emotionB: string;
  couplingStrength: number;
  lag: number;
  pValue: number;
}

/** Emotional dynamics analysis result */
export interface EmotionalDynamicsResult {
  participantId: ID;
  period: { start: ISODateString; end: ISODateString };
  volatility: number;
  inertia: number;
  couplings: EmotionCoupling[];
  granularity: number;
}

/** Health record for a participant */
export interface HealthRecord {
  id: ID;
  participantId: ID;
  recordDate: ISODateString;
  domain: 'physical' | 'mental' | 'social' | 'functional';
  indicators: Record<string, number>;
  notes: string;
}

/** Causal analysis request body */
export interface CausalAnalysisRequest {
  participantIds: ID[];
  exposureVariable: string;
  outcomeVariable: string;
  covariates: string[];
  method: 'propensity-score' | 'instrumental-variable' | 'difference-in-differences';
}

/** Causal analysis result */
export interface CausalAnalysisResult {
  estimatedEffect: number;
  confidenceInterval: [number, number];
  pValue: number;
  method: string;
  sampleSize: number;
}

/** Lifespan trajectory data point */
export interface TrajectoryPoint {
  age: number;
  value: number;
  domain: string;
  confidence: number;
}

/** Lifespan trajectory for a participant */
export interface LifespanTrajectory {
  participantId: ID;
  domain: string;
  points: TrajectoryPoint[];
  clusterLabel?: string;
  trajectoryClass: string;
}

/** Cluster analysis request */
export interface ClusterAnalysisRequest {
  participantIds: ID[];
  domain: string;
  nClusters: number;
  method: 'gmm' | 'lcga' | 'k-means';
}

/** Cluster analysis result */
export interface ClusterAnalysisResult {
  clusters: Array<{
    label: string;
    memberCount: number;
    centroid: number[];
    participantIds: ID[];
  }>;
  silhouetteScore: number;
  method: string;
}

/** Cognitive assessment record */
export interface CognitiveAssessment {
  id: ID;
  participantId: ID;
  assessmentDate: ISODateString;
  instrument: string;
  domain: 'memory' | 'executive-function' | 'processing-speed' | 'attention' | 'language';
  score: number;
  normalizedScore: number;
  percentile: number;
}

/** Cognitive risk assessment request */
export interface CognitiveRiskRequest {
  participantId: ID;
  horizonYears: number;
  includeModifiableFactors: boolean;
}

/** Cognitive risk assessment result */
export interface CognitiveRiskResult {
  participantId: ID;
  riskScore: number;
  riskCategory: 'low' | 'moderate' | 'high' | 'very-high';
  modifiableFactors: Array<{ factor: string; impact: number; recommendation: string }>;
  projectedTrajectory: TrajectoryPoint[];
}

/** Intervention record */
export interface Intervention {
  id: ID;
  participantId: ID;
  type: 'behavioral' | 'pharmacological' | 'cognitive-training' | 'social' | 'lifestyle';
  name: string;
  startDate: ISODateString;
  endDate?: ISODateString;
  status: 'planned' | 'active' | 'completed' | 'discontinued';
  dosage?: string;
  frequency?: string;
  outcomes: Record<string, number>;
}

/** Standard API response wrapper */
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: {
    page?: number;
    pageSize?: number;
    total?: number;
    timestamp: ISODateString;
  };
}

/** Standard API error response */
export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/** Validation schema definition for request validation middleware */
export interface ValidationSchema {
  required?: string[];
  types?: Record<string, 'string' | 'number' | 'boolean' | 'object' | 'array'>;
}
