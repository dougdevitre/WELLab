import {
  PutCommand,
  GetCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
  BatchGetCommand,
  TransactWriteCommand,
  type TransactWriteCommandInput,
} from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from './client';
import { type TableKey } from './keys';
import { ConflictError, DatabaseError, NotFoundError, ConditionFailedError } from './errors';
import { logger } from '../utils/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface QueryOptions {
  limit?: number;
  scanForward?: boolean;
  exclusiveStartKey?: Record<string, unknown>;
  filterExpression?: string;
  filterValues?: Record<string, unknown>;
  filterNames?: Record<string, string>;
}

export interface QueryResult<T> {
  items: T[];
  lastEvaluatedKey?: Record<string, unknown>;
}

export type TransactOperation =
  | { type: 'put'; item: Record<string, unknown>; conditionExpression?: string }
  | { type: 'update'; key: TableKey; updates: Record<string, unknown> }
  | { type: 'delete'; key: TableKey };

// ---------------------------------------------------------------------------
// BaseRepository
// ---------------------------------------------------------------------------

export class BaseRepository<T extends Record<string, unknown>> {
  protected readonly entityName: string;

  constructor(entityName: string) {
    this.entityName = entityName;
  }

  // -----------------------------------------------------------------------
  // put — insert with optional duplicate guard
  // -----------------------------------------------------------------------
  async put(item: T, preventOverwrite = true): Promise<void> {
    const pk = (item as Record<string, unknown>).PK as string;
    const sk = (item as Record<string, unknown>).SK as string;
    try {
      await docClient.send(
        new PutCommand({
          TableName: TABLE_NAME,
          Item: item,
          ...(preventOverwrite && {
            ConditionExpression: 'attribute_not_exists(PK)',
          }),
        }),
      );
      logger.debug(`${this.entityName} put`, { PK: pk, SK: sk });
    } catch (err: unknown) {
      if (this.isConditionalCheckFailed(err)) {
        throw new ConflictError(this.entityName, { PK: pk, SK: sk });
      }
      throw this.wrap('put', err);
    }
  }

  // -----------------------------------------------------------------------
  // get — single item by key
  // -----------------------------------------------------------------------
  async get(key: TableKey): Promise<T> {
    try {
      const result = await docClient.send(
        new GetCommand({
          TableName: TABLE_NAME,
          Key: key,
        }),
      );
      if (!result.Item) {
        throw new NotFoundError(this.entityName, { ...key });
      }
      logger.debug(`${this.entityName} get`, { PK: key.PK, SK: key.SK });
      return result.Item as T;
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      throw this.wrap('get', err);
    }
  }

  // -----------------------------------------------------------------------
  // query — by PK, optional SK prefix, filtering, pagination
  // -----------------------------------------------------------------------
  async query(pk: string, skPrefix?: string, options: QueryOptions = {}): Promise<QueryResult<T>> {
    const {
      limit,
      scanForward = true,
      exclusiveStartKey,
      filterExpression,
      filterValues,
      filterNames,
    } = options;

    const expressionNames: Record<string, string> = { '#pk': 'PK' };
    const expressionValues: Record<string, unknown> = { ':pk': pk };
    let keyCondition = '#pk = :pk';

    if (skPrefix) {
      expressionNames['#sk'] = 'SK';
      expressionValues[':skPrefix'] = skPrefix;
      keyCondition += ' AND begins_with(#sk, :skPrefix)';
    }

    try {
      const result = await docClient.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          KeyConditionExpression: keyCondition,
          ExpressionAttributeNames: {
            ...expressionNames,
            ...filterNames,
          },
          ExpressionAttributeValues: {
            ...expressionValues,
            ...filterValues,
          },
          ScanIndexForward: scanForward,
          ...(limit && { Limit: limit }),
          ...(exclusiveStartKey && { ExclusiveStartKey: exclusiveStartKey }),
          ...(filterExpression && { FilterExpression: filterExpression }),
        }),
      );

      logger.debug(`${this.entityName} query`, { pk, skPrefix, count: result.Items?.length ?? 0 });
      return {
        items: (result.Items ?? []) as T[],
        lastEvaluatedKey: result.LastEvaluatedKey as Record<string, unknown> | undefined,
      };
    } catch (err) {
      throw this.wrap('query', err);
    }
  }

  // -----------------------------------------------------------------------
  // queryIndex — query a GSI
  // -----------------------------------------------------------------------
  async queryIndex(
    indexName: string,
    pkName: string,
    pkValue: string,
    skName?: string,
    skPrefix?: string,
    options: QueryOptions = {},
  ): Promise<QueryResult<T>> {
    const { limit, scanForward = true, exclusiveStartKey } = options;

    const expressionNames: Record<string, string> = { '#gsiPk': pkName };
    const expressionValues: Record<string, unknown> = { ':gsiPk': pkValue };
    let keyCondition = '#gsiPk = :gsiPk';

    if (skName && skPrefix) {
      expressionNames['#gsiSk'] = skName;
      expressionValues[':gsiSkPrefix'] = skPrefix;
      keyCondition += ' AND begins_with(#gsiSk, :gsiSkPrefix)';
    }

    try {
      const result = await docClient.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          IndexName: indexName,
          KeyConditionExpression: keyCondition,
          ExpressionAttributeNames: expressionNames,
          ExpressionAttributeValues: expressionValues,
          ScanIndexForward: scanForward,
          ...(limit && { Limit: limit }),
          ...(exclusiveStartKey && { ExclusiveStartKey: exclusiveStartKey }),
        }),
      );

      logger.debug(`${this.entityName} queryIndex`, { indexName, pkValue, count: result.Items?.length ?? 0 });
      return {
        items: (result.Items ?? []) as T[],
        lastEvaluatedKey: result.LastEvaluatedKey as Record<string, unknown> | undefined,
      };
    } catch (err) {
      throw this.wrap('queryIndex', err);
    }
  }

  // -----------------------------------------------------------------------
  // queryRange — query with SK between two values
  // -----------------------------------------------------------------------
  async queryRange(
    pk: string,
    skStart: string,
    skEnd: string,
    options: QueryOptions = {},
  ): Promise<QueryResult<T>> {
    const { limit, scanForward = true, exclusiveStartKey } = options;

    try {
      const result = await docClient.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          KeyConditionExpression: '#pk = :pk AND #sk BETWEEN :skStart AND :skEnd',
          ExpressionAttributeNames: { '#pk': 'PK', '#sk': 'SK' },
          ExpressionAttributeValues: { ':pk': pk, ':skStart': skStart, ':skEnd': skEnd },
          ScanIndexForward: scanForward,
          ...(limit && { Limit: limit }),
          ...(exclusiveStartKey && { ExclusiveStartKey: exclusiveStartKey }),
        }),
      );

      logger.debug(`${this.entityName} queryRange`, { pk, skStart, skEnd, count: result.Items?.length ?? 0 });
      return {
        items: (result.Items ?? []) as T[],
        lastEvaluatedKey: result.LastEvaluatedKey as Record<string, unknown> | undefined,
      };
    } catch (err) {
      throw this.wrap('queryRange', err);
    }
  }

  // -----------------------------------------------------------------------
  // update — partial update with expression builder
  // -----------------------------------------------------------------------
  async update(key: TableKey, updates: Record<string, unknown>): Promise<T> {
    const entries = Object.entries(updates).filter(
      ([k]) => k !== 'PK' && k !== 'SK',
    );

    if (entries.length === 0) {
      return this.get(key);
    }

    const expressionParts: string[] = [];
    const expressionNames: Record<string, string> = {};
    const expressionValues: Record<string, unknown> = {};

    for (const [field, value] of entries) {
      const safeAlias = field.replace(/[^a-zA-Z0-9]/g, '_');
      expressionParts.push(`#${safeAlias} = :${safeAlias}`);
      expressionNames[`#${safeAlias}`] = field;
      expressionValues[`:${safeAlias}`] = value;
    }

    // Always bump updated_at
    expressionParts.push('#updatedAt = :updatedAt');
    expressionNames['#updatedAt'] = 'updated_at';
    expressionValues[':updatedAt'] = new Date().toISOString();

    try {
      const result = await docClient.send(
        new UpdateCommand({
          TableName: TABLE_NAME,
          Key: key,
          UpdateExpression: `SET ${expressionParts.join(', ')}`,
          ExpressionAttributeNames: expressionNames,
          ExpressionAttributeValues: expressionValues,
          ConditionExpression: 'attribute_exists(PK)',
          ReturnValues: 'ALL_NEW',
        }),
      );

      logger.debug(`${this.entityName} update`, { PK: key.PK, SK: key.SK, fields: entries.map(([k]) => k) });
      return result.Attributes as T;
    } catch (err: unknown) {
      if (this.isConditionalCheckFailed(err)) {
        throw new NotFoundError(this.entityName, { ...key });
      }
      throw this.wrap('update', err);
    }
  }

  // -----------------------------------------------------------------------
  // delete — single item
  // -----------------------------------------------------------------------
  async delete(key: TableKey): Promise<void> {
    try {
      await docClient.send(
        new DeleteCommand({
          TableName: TABLE_NAME,
          Key: key,
          ConditionExpression: 'attribute_exists(PK)',
        }),
      );
      logger.debug(`${this.entityName} delete`, { PK: key.PK, SK: key.SK });
    } catch (err: unknown) {
      if (this.isConditionalCheckFailed(err)) {
        throw new NotFoundError(this.entityName, { ...key });
      }
      throw this.wrap('delete', err);
    }
  }

  // -----------------------------------------------------------------------
  // batchGet — up to 100 items
  // -----------------------------------------------------------------------
  async batchGet(keys: TableKey[]): Promise<T[]> {
    if (keys.length === 0) return [];

    const BATCH_SIZE = 100;
    const results: T[] = [];

    for (let i = 0; i < keys.length; i += BATCH_SIZE) {
      const batch = keys.slice(i, i + BATCH_SIZE);
      try {
        const result = await docClient.send(
          new BatchGetCommand({
            RequestItems: {
              [TABLE_NAME]: { Keys: batch },
            },
          }),
        );

        const items = result.Responses?.[TABLE_NAME] ?? [];
        results.push(...(items as T[]));

        // Handle unprocessed keys with retry
        let unprocessed = result.UnprocessedKeys?.[TABLE_NAME]?.Keys;
        let retries = 0;
        while (unprocessed && unprocessed.length > 0 && retries < 3) {
          retries++;
          const retry = await docClient.send(
            new BatchGetCommand({
              RequestItems: {
                [TABLE_NAME]: { Keys: unprocessed },
              },
            }),
          );
          const retryItems = retry.Responses?.[TABLE_NAME] ?? [];
          results.push(...(retryItems as T[]));
          unprocessed = retry.UnprocessedKeys?.[TABLE_NAME]?.Keys;
        }

        if (unprocessed && unprocessed.length > 0) {
          logger.warn(`${this.entityName} batchGet: ${unprocessed.length} unprocessed keys after retries`);
        }
      } catch (err) {
        throw this.wrap('batchGet', err);
      }
    }

    logger.debug(`${this.entityName} batchGet`, { requested: keys.length, returned: results.length });
    return results;
  }

  // -----------------------------------------------------------------------
  // transactWrite — multi-item atomic writes (max 100 operations)
  // -----------------------------------------------------------------------
  async transactWrite(operations: TransactOperation[]): Promise<void> {
    if (operations.length === 0) return;
    if (operations.length > 100) {
      throw new DatabaseError('TransactWrite supports a maximum of 100 operations');
    }

    const transactItems: TransactWriteCommandInput['TransactItems'] = operations.map((op) => {
      switch (op.type) {
        case 'put':
          return {
            Put: {
              TableName: TABLE_NAME,
              Item: op.item,
              ...(op.conditionExpression && {
                ConditionExpression: op.conditionExpression,
              }),
            },
          };
        case 'update': {
          const entries = Object.entries(op.updates).filter(
            ([k]) => k !== 'PK' && k !== 'SK',
          );
          const parts: string[] = [];
          const names: Record<string, string> = {};
          const values: Record<string, unknown> = {};
          for (const [field, value] of entries) {
            const alias = field.replace(/[^a-zA-Z0-9]/g, '_');
            parts.push(`#${alias} = :${alias}`);
            names[`#${alias}`] = field;
            values[`:${alias}`] = value;
          }
          return {
            Update: {
              TableName: TABLE_NAME,
              Key: op.key,
              UpdateExpression: `SET ${parts.join(', ')}`,
              ExpressionAttributeNames: names,
              ExpressionAttributeValues: values,
            },
          };
        }
        case 'delete':
          return {
            Delete: {
              TableName: TABLE_NAME,
              Key: op.key,
            },
          };
      }
    });

    try {
      await docClient.send(
        new TransactWriteCommand({ TransactItems: transactItems }),
      );
      logger.debug(`${this.entityName} transactWrite`, { operationCount: operations.length });
    } catch (err: unknown) {
      if (this.isTransactionCanceled(err)) {
        throw new ConditionFailedError(
          `${this.entityName} transaction canceled: one or more conditions failed`,
        );
      }
      throw this.wrap('transactWrite', err);
    }
  }

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------
  private isConditionalCheckFailed(err: unknown): boolean {
    return (
      typeof err === 'object' &&
      err !== null &&
      'name' in err &&
      (err as { name: string }).name === 'ConditionalCheckFailedException'
    );
  }

  private isTransactionCanceled(err: unknown): boolean {
    return (
      typeof err === 'object' &&
      err !== null &&
      'name' in err &&
      (err as { name: string }).name === 'TransactionCanceledException'
    );
  }

  protected wrap(operation: string, err: unknown): DatabaseError {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`${this.entityName}.${operation} failed`, { error: message });
    return new DatabaseError(`${this.entityName}.${operation}: ${message}`, err);
  }
}
