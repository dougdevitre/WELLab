/** Base class for all database errors. */
export class DatabaseError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'DatabaseError';
  }
}

/** Thrown when a requested item does not exist. */
export class NotFoundError extends DatabaseError {
  constructor(entity: string, key: Record<string, unknown>) {
    super(`${entity} not found: ${JSON.stringify(key)}`);
    this.name = 'NotFoundError';
  }
}

/** Thrown when a put with a condition expression fails (duplicate key). */
export class ConflictError extends DatabaseError {
  constructor(entity: string, key: Record<string, unknown>) {
    super(`${entity} already exists: ${JSON.stringify(key)}`);
    this.name = 'ConflictError';
  }
}

/** Thrown when a conditional update/delete fails (stale data). */
export class ConditionFailedError extends DatabaseError {
  constructor(message: string) {
    super(message);
    this.name = 'ConditionFailedError';
  }
}
