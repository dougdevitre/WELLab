// ---------------------------------------------------------------------------
// Primary key builders for the single-table design
// ---------------------------------------------------------------------------

export interface TableKey {
  PK: string;
  SK: string;
}

export interface GSIKey {
  GSI1PK?: string;
  GSI1SK?: string;
  GSI2PK?: string;
  GSI2SK?: string;
}

// -- Participant ---------------------------------------------------------------

export function buildParticipantKey(id: string): TableKey {
  return { PK: `PARTICIPANT#${id}`, SK: 'PROFILE' };
}

// -- Observation (EMA) ---------------------------------------------------------

export function buildObservationKey(participantId: string, timestamp: string): TableKey {
  return { PK: `PARTICIPANT#${participantId}`, SK: `OBS#${timestamp}` };
}

export const OBSERVATION_SK_PREFIX = 'OBS#';

// -- Health Record -------------------------------------------------------------

export function buildHealthKey(participantId: string, date: string): TableKey {
  return { PK: `PARTICIPANT#${participantId}`, SK: `HEALTH#${date}` };
}

export const HEALTH_SK_PREFIX = 'HEALTH#';

// -- Lifespan Assessment -------------------------------------------------------

export function buildLifespanKey(participantId: string, wave: number): TableKey {
  const paddedWave = String(wave).padStart(3, '0');
  return { PK: `PARTICIPANT#${participantId}`, SK: `LIFESPAN#${paddedWave}` };
}

export const LIFESPAN_SK_PREFIX = 'LIFESPAN#';

// -- Cognitive Assessment ------------------------------------------------------

export function buildCognitiveKey(participantId: string, date: string): TableKey {
  return { PK: `PARTICIPANT#${participantId}`, SK: `COGNITIVE#${date}` };
}

export const COGNITIVE_SK_PREFIX = 'COGNITIVE#';

// -- Intervention --------------------------------------------------------------

export function buildInterventionKey(participantId: string, timestamp: string): TableKey {
  return { PK: `PARTICIPANT#${participantId}`, SK: `INTERVENTION#${timestamp}` };
}

export const INTERVENTION_SK_PREFIX = 'INTERVENTION#';

// -- GSI key builders ----------------------------------------------------------

export function buildStatusGSIKeys(status: string, participantId: string): GSIKey {
  return {
    GSI1PK: `STATUS#${status}`,
    GSI1SK: `PARTICIPANT#${participantId}`,
  };
}

export function buildCohortGSIKeys(cohort: string, participantId: string): GSIKey {
  return {
    GSI2PK: `COHORT#${cohort}`,
    GSI2SK: `PARTICIPANT#${participantId}`,
  };
}

// -- Utility -------------------------------------------------------------------

export function participantPK(participantId: string): string {
  return `PARTICIPANT#${participantId}`;
}
