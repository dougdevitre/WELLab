import { v4 as uuidv4 } from 'uuid';
import { BaseRepository } from '../repository';
import {
  buildHealthKey,
  HEALTH_SK_PREFIX,
  participantPK,
} from '../keys';
import { logger } from '../../utils/logger';
import type { HealthRecord } from '../../types';

// ---------------------------------------------------------------------------
// DynamoDB item shape
// ---------------------------------------------------------------------------
interface HealthItem extends Record<string, unknown> {
  PK: string;
  SK: string;
  entityType: 'HealthRecord';
  id: string;
  participantId: string;
  recordDate: string;
  domain: string;
  indicators: Record<string, number>;
  notes: string;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------
export interface ListHealthOptions {
  startDate?: string;
  endDate?: string;
  limit?: number;
  exclusiveStartKey?: Record<string, unknown>;
}

export interface HealthPage {
  items: HealthRecord[];
  lastEvaluatedKey?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------
class HealthRepository extends BaseRepository<HealthItem> {
  constructor() {
    super('HealthRecord');
  }

  /** Create a new health record. */
  async create(
    participantId: string,
    input: Omit<HealthRecord, 'id' | 'participantId'>,
  ): Promise<HealthRecord> {
    const id = `HR-${uuidv4().slice(0, 8)}`;
    const now = new Date().toISOString();
    const recordDate = input.recordDate ?? now.slice(0, 10);

    const key = buildHealthKey(participantId, recordDate);

    const item: HealthItem = {
      ...key,
      entityType: 'HealthRecord',
      id,
      participantId,
      recordDate,
      domain: input.domain,
      indicators: input.indicators,
      notes: input.notes ?? '',
      created_at: now,
      updated_at: now,
    };

    await this.put(item);
    logger.info('HealthRecord created', { id, participantId });
    return this.toHealthRecord(item);
  }

  /** List health records for a participant, optionally within a date range. */
  async listByParticipant(
    participantId: string,
    options: ListHealthOptions = {},
  ): Promise<HealthPage> {
    const { startDate, endDate, limit, exclusiveStartKey } = options;
    const pk = participantPK(participantId);

    let result;

    if (startDate && endDate) {
      result = await this.queryRange(
        pk,
        `${HEALTH_SK_PREFIX}${startDate}`,
        `${HEALTH_SK_PREFIX}${endDate}`,
        { limit, exclusiveStartKey },
      );
    } else {
      result = await this.query(pk, HEALTH_SK_PREFIX, { limit, exclusiveStartKey });
    }

    return {
      items: result.items.map((i) => this.toHealthRecord(i)),
      lastEvaluatedKey: result.lastEvaluatedKey,
    };
  }

  /** Get the most recent health record for a participant. */
  async getLatest(participantId: string): Promise<HealthRecord | null> {
    const pk = participantPK(participantId);
    const result = await this.query(pk, HEALTH_SK_PREFIX, {
      limit: 1,
      scanForward: false,
    });
    return result.items.length > 0 ? this.toHealthRecord(result.items[0]) : null;
  }

  // -----------------------------------------------------------------------
  // Mapper
  // -----------------------------------------------------------------------
  private toHealthRecord(item: HealthItem): HealthRecord {
    return {
      id: item.id,
      participantId: item.participantId,
      recordDate: item.recordDate,
      domain: item.domain as HealthRecord['domain'],
      indicators: item.indicators,
      notes: item.notes,
    };
  }
}

export const healthRepository = new HealthRepository();
