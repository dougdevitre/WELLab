import { v4 as uuidv4 } from 'uuid';
import { BaseRepository, type QueryOptions, type QueryResult } from '../repository';
import {
  buildParticipantKey,
  buildStatusGSIKeys,
  buildCohortGSIKeys,
  participantPK,
  type TableKey,
} from '../keys';
import { NotFoundError } from '../errors';
import { logger } from '../../utils/logger';
import type { Participant } from '../../types';

// ---------------------------------------------------------------------------
// DynamoDB item shape (Participant profile row)
// ---------------------------------------------------------------------------
interface ParticipantItem extends Record<string, unknown> {
  PK: string;
  SK: string;
  GSI1PK?: string;
  GSI1SK?: string;
  GSI2PK?: string;
  GSI2SK?: string;
  entityType: 'Participant';
  id: string;
  externalId: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  enrollmentDate: string;
  cohort: string;
  status: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Options for listing
// ---------------------------------------------------------------------------
export interface ListParticipantsOptions {
  status?: Participant['status'];
  cohort?: string;
  limit?: number;
  exclusiveStartKey?: Record<string, unknown>;
}

export interface ParticipantPage {
  items: Participant[];
  lastEvaluatedKey?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------
class ParticipantRepository extends BaseRepository<ParticipantItem> {
  constructor() {
    super('Participant');
  }

  /** Create a new participant with an auto-generated ID (unless provided). */
  async create(input: Omit<Participant, 'id'> & { id?: string }): Promise<Participant> {
    const id = input.id ?? `P-${uuidv4().slice(0, 5).toUpperCase()}`;
    const now = new Date().toISOString();

    const key = buildParticipantKey(id);
    const gsi1 = buildStatusGSIKeys(input.status, id);
    const gsi2 = buildCohortGSIKeys(input.cohort, id);

    const item: ParticipantItem = {
      ...key,
      ...gsi1,
      ...gsi2,
      entityType: 'Participant',
      id,
      externalId: input.externalId,
      firstName: input.firstName,
      lastName: input.lastName,
      dateOfBirth: input.dateOfBirth,
      enrollmentDate: input.enrollmentDate,
      cohort: input.cohort,
      status: input.status,
      metadata: input.metadata ?? {},
      created_at: now,
      updated_at: now,
    };

    await this.put(item);
    logger.info('Participant created', { id });
    return this.toParticipant(item);
  }

  /** Get a single participant by ID. */
  async getById(id: string): Promise<Participant> {
    const key = buildParticipantKey(id);
    const item = await this.get(key);
    return this.toParticipant(item);
  }

  /** List participants, optionally filtered by status (GSI1) or cohort (GSI2). */
  async list(options: ListParticipantsOptions = {}): Promise<ParticipantPage> {
    const { status, cohort, limit, exclusiveStartKey } = options;

    let result: QueryResult<ParticipantItem>;

    if (status) {
      result = await this.queryIndex(
        'GSI1',
        'GSI1PK',
        `STATUS#${status}`,
        undefined,
        undefined,
        { limit, exclusiveStartKey },
      );
    } else if (cohort) {
      result = await this.queryIndex(
        'GSI2',
        'GSI2PK',
        `COHORT#${cohort}`,
        undefined,
        undefined,
        { limit, exclusiveStartKey },
      );
    } else {
      // Full scan is deliberately NOT implemented — require a filter.
      // For a small dataset we can query GSI1 with status = 'active' as default.
      result = await this.queryIndex(
        'GSI1',
        'GSI1PK',
        'STATUS#active',
        undefined,
        undefined,
        { limit, exclusiveStartKey },
      );
    }

    return {
      items: result.items.map((i) => this.toParticipant(i)),
      lastEvaluatedKey: result.lastEvaluatedKey,
    };
  }

  /** Partial update of participant fields. Updates GSI keys when status or cohort change. */
  async updateById(id: string, updates: Partial<Omit<Participant, 'id'>>): Promise<Participant> {
    const key = buildParticipantKey(id);

    // Re-derive GSI keys if status or cohort are changing
    const gsiUpdates: Record<string, unknown> = {};
    if (updates.status) {
      const gsi1 = buildStatusGSIKeys(updates.status, id);
      Object.assign(gsiUpdates, gsi1);
    }
    if (updates.cohort) {
      const gsi2 = buildCohortGSIKeys(updates.cohort, id);
      Object.assign(gsiUpdates, gsi2);
    }

    const merged = { ...updates, ...gsiUpdates };
    const item = await this.update(key, merged);
    logger.info('Participant updated', { id, fields: Object.keys(updates) });
    return this.toParticipant(item);
  }

  /**
   * Cascade-delete a participant and all their related items.
   * Queries all SK values under the participant PK, then deletes in a transaction.
   */
  async deleteById(id: string): Promise<void> {
    const pk = participantPK(id);

    // First verify participant exists
    await this.getById(id);

    // Gather all items under this PK
    const allKeys: TableKey[] = [];
    let lastKey: Record<string, unknown> | undefined;

    do {
      const page = await this.query(pk, undefined, { exclusiveStartKey: lastKey, limit: 100 });
      for (const item of page.items) {
        allKeys.push({ PK: item.PK as string, SK: item.SK as string });
      }
      lastKey = page.lastEvaluatedKey;
    } while (lastKey);

    if (allKeys.length === 0) {
      throw new NotFoundError('Participant', { PK: pk, SK: 'PROFILE' });
    }

    // DynamoDB transactions max out at 100 items; chunk if needed
    const CHUNK = 100;
    for (let i = 0; i < allKeys.length; i += CHUNK) {
      const chunk = allKeys.slice(i, i + CHUNK);
      await this.transactWrite(
        chunk.map((key) => ({ type: 'delete' as const, key })),
      );
    }

    logger.info('Participant cascade-deleted', { id, itemsRemoved: allKeys.length });
  }

  // -----------------------------------------------------------------------
  // Mapper
  // -----------------------------------------------------------------------
  private toParticipant(item: ParticipantItem): Participant {
    return {
      id: item.id,
      externalId: item.externalId,
      firstName: item.firstName,
      lastName: item.lastName,
      dateOfBirth: item.dateOfBirth,
      enrollmentDate: item.enrollmentDate,
      cohort: item.cohort,
      status: item.status as Participant['status'],
      metadata: item.metadata,
    };
  }
}

export const participantRepository = new ParticipantRepository();
