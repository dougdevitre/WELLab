import {
  Participant,
  Observation,
  HealthRecord,
  Intervention,
  CognitiveAssessment,
  EmotionalDynamicsResult,
  LifespanTrajectory,
} from '../types';

// ---------------------------------------------------------------------------
// Participants
// ---------------------------------------------------------------------------
export const mockParticipants: Participant[] = [
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

// ---------------------------------------------------------------------------
// Observations
// ---------------------------------------------------------------------------
export const mockObservations: Observation[] = [
  {
    id: 'obs-001',
    participantId: 'p-001',
    timestamp: '2024-06-15T09:30:00Z',
    source: 'ema',
    measures: { happiness: 7, sadness: 2, anxiety: 3, energy: 6 },
    context: { activity: 'morning-routine', socialContext: 'alone', deviceType: 'mobile' },
  },
  {
    id: 'obs-002',
    participantId: 'p-001',
    timestamp: '2024-06-15T14:00:00Z',
    source: 'ema',
    measures: { happiness: 5, sadness: 4, anxiety: 5, energy: 4 },
    context: { activity: 'work', socialContext: 'colleagues', deviceType: 'mobile' },
  },
];

// ---------------------------------------------------------------------------
// Health Records
// ---------------------------------------------------------------------------
export const mockHealthRecords: HealthRecord[] = [
  {
    id: 'hr-001',
    participantId: 'p-001',
    recordDate: '2024-03-15',
    domain: 'physical',
    indicators: { bmi: 24.5, systolicBP: 128, diastolicBP: 82, gripStrength: 32 },
    notes: 'Routine physical assessment',
  },
  {
    id: 'hr-002',
    participantId: 'p-001',
    recordDate: '2024-03-15',
    domain: 'mental',
    indicators: { phq9: 4, gad7: 3, pss: 12 },
    notes: 'Quarterly mental health screening',
  },
];

// ---------------------------------------------------------------------------
// Interventions
// ---------------------------------------------------------------------------
export const mockInterventions: Intervention[] = [
  {
    id: 'int-001',
    participantId: 'p-001',
    type: 'behavioral',
    name: 'Mindfulness-Based Stress Reduction',
    startDate: '2024-03-01',
    endDate: '2024-05-01',
    status: 'completed',
    frequency: '3x/week',
    outcomes: { stressReduction: 0.35, wellBeingImprovement: 0.22 },
  },
  {
    id: 'int-002',
    participantId: 'p-001',
    type: 'lifestyle',
    name: 'Mediterranean Diet Program',
    startDate: '2024-04-15',
    status: 'active',
    frequency: 'daily',
    outcomes: {},
  },
];

// ---------------------------------------------------------------------------
// Cognitive Assessments
// ---------------------------------------------------------------------------
export const mockCognitiveAssessments: CognitiveAssessment[] = [
  {
    id: 'ca-001',
    participantId: 'p-001',
    assessmentDate: '2024-04-10',
    instrument: 'MoCA',
    domain: 'memory',
    score: 26,
    normalizedScore: 0.87,
    percentile: 72,
  },
  {
    id: 'ca-002',
    participantId: 'p-001',
    assessmentDate: '2024-04-10',
    instrument: 'Trail Making B',
    domain: 'executive-function',
    score: 85,
    normalizedScore: 0.78,
    percentile: 65,
  },
  {
    id: 'ca-003',
    participantId: 'p-001',
    assessmentDate: '2024-04-10',
    instrument: 'Digit Symbol',
    domain: 'processing-speed',
    score: 52,
    normalizedScore: 0.72,
    percentile: 58,
  },
];

// ---------------------------------------------------------------------------
// Emotional Dynamics (factory - per-participant)
// ---------------------------------------------------------------------------
export function getEmotionalDynamicsResult(participantId: string): EmotionalDynamicsResult {
  return {
    participantId,
    period: { start: '2024-01-01', end: '2024-06-30' },
    volatility: 0.42,
    inertia: 0.68,
    couplings: [
      { emotionA: 'happiness', emotionB: 'energy', couplingStrength: 0.73, lag: 0, pValue: 0.001 },
      { emotionA: 'anxiety', emotionB: 'sadness', couplingStrength: 0.58, lag: 1, pValue: 0.01 },
      { emotionA: 'anger', emotionB: 'anxiety', couplingStrength: 0.35, lag: 0, pValue: 0.05 },
    ],
    granularity: 0.61,
  };
}

// ---------------------------------------------------------------------------
// Lifespan Trajectory (factory - per-participant)
// ---------------------------------------------------------------------------
export function getLifespanTrajectory(participantId: string, domain: string): LifespanTrajectory {
  return {
    participantId,
    domain,
    points: [
      { age: 50, value: 72, domain, confidence: 0.95 },
      { age: 55, value: 70, domain, confidence: 0.93 },
      { age: 60, value: 68, domain, confidence: 0.90 },
      { age: 65, value: 71, domain, confidence: 0.88 },
      { age: 70, value: 65, domain, confidence: 0.85 },
    ],
    clusterLabel: 'resilient-stable',
    trajectoryClass: 'U-shaped recovery',
  };
}
