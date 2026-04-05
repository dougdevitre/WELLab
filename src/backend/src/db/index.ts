// ---------------------------------------------------------------------------
// DynamoDB data access layer — barrel export
// ---------------------------------------------------------------------------

export { docClient, TABLE_NAME } from './client';
export { participantRepository } from './repositories/participantRepository';
export { observationRepository } from './repositories/observationRepository';
export { healthRepository } from './repositories/healthRepository';
export { cognitiveRepository } from './repositories/cognitiveRepository';
export { interventionRepository } from './repositories/interventionRepository';
export { lifespanRepository } from './repositories/lifespanRepository';

// Re-export error types for consumers
export { NotFoundError, ConflictError, ConditionFailedError, DatabaseError } from './errors';

// Re-export key builders for advanced use cases
export * from './keys';
