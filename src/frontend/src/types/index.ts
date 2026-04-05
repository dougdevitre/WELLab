export interface Participant {
  id: string;
  externalId: string;
  cohort: string;
  enrolledAt: string;
  demographics: Record<string, string | number>;
}

export interface Observation {
  id: string;
  participantId: string;
  timestamp: string;
  domain: WellbeingDomain;
  value: number;
  source: "self-report" | "passive-sensor" | "ema" | "clinical";
  metadata?: Record<string, unknown>;
}

export type WellbeingDomain =
  | "physical"
  | "emotional"
  | "social"
  | "cognitive"
  | "environmental"
  | "occupational"
  | "spiritual"
  | "financial";

export interface WellbeingScore {
  overall: number;
  domains: Record<WellbeingDomain, number>;
  confidence: number;
  timestamp: string;
}

export interface TrendPoint {
  date: string;
  overall: number;
  physical: number;
  emotional: number;
  social: number;
}

export interface Insight {
  id: string;
  title: string;
  description: string;
  domain: WellbeingDomain;
  type: "strength" | "growth-area" | "pattern";
  confidence: number;
}

export interface CohortSummary {
  cohortId: string;
  name: string;
  participantCount: number;
  avgWellbeing: number;
  dataCompleteness: number;
}

export interface InterventionROI {
  interventionName: string;
  targetPopulation: string;
  costPerParticipant: number;
  wellbeingGain: number;
  roi: number;
}

export interface RiskBucket {
  label: string;
  count: number;
  percentage: number;
  color: string;
}

export interface ApiResponse<T> {
  data: T;
  meta?: {
    total: number;
    page: number;
    pageSize: number;
  };
}
