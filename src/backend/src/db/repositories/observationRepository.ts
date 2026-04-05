import { v4 as uuidv4 } from 'uuid';
import { BaseRepository } from '../repository';
import {
  buildObservationKey,
  OBSERVATION_SK_PREFIX,
  participantPK,
} from '../keys';
import { logger } from '../../utils/logger';
import type { Observation } from '../../types';

// ---------------------------------------------------------------------------
// DynamoDB item shape
// ---------------------------------------------------------------------------
interface ObservationItem extends Record<string, unknown> {
  PK: string;
  SK: string;
  entityType: 'Observation';
  id: string;
  participantId: string;
  timestamp: string;
  source: string;
  measures: Record<string, number | string | boolean>;
  context: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------
export interface ListObservationsOptions {
  startDate?: string;
  endDate?: string;
  limit?: number;
  exclusiveStartKey?: Record<string, unknown>;
}

export interface ObservationPage {
  items: Observation[];
  lastEvaluatedKey?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------
class ObservationRepository extends BaseRepository<ObservationItem> {
  constructor() {
    super('Observation');
  }

  /** Create a new EMA observation. */
  async create(
    participantId: string,
    input: Omit<Observation, 'id' | 'participantId'>,
  ): Promise<Observation> {
    const id = `OBS-${uuidv4().slice(0, 8)}`;
    const now = new Date().toISOString();
    const timestamp = input.timestamp ?? now;

    const key = buildObservationKey(participantId, timestamp);

    const item: ObservationItem = {
      ...key,
      entityType: 'Observation',
      id,
      participantId,
      timestamp,
      source: input.source,
      measures: input.measures,
      context: input.context as Record<string, unknown>,
      created_at: now,
      updated_at: now,
    };

    await this.put(item);
    logger.info('Observation created', { id, participantId });
    return this.toObservation(item);
  }

  /** List observations for a participant, optionally within a date range. */
  async listByParticipant(
    participantId: string,
    options: ListObservationsOptions = {},
  ): Promise<ObservationPage> {
    const { startDate, endDate, limit, exclusiveStartKey } = options;
    const pk = participantPK(participantId);

    let result;

    if (startDate && endDate) {
      result = await this.queryRange(
        pk,
        `${OBSERVATION_SK_PREFIX}${startDate}`,
        `${OBSERVATION_SK_PREFIX}${endDate}`,
        { limit, exclusiveStartKey },
      );
    } else if (startDate) {
      result = await this.queryRange(
        pk,
        `${OBSERVATION_SK_PREFIX}${startDate}`,
        `${OBSERVATION_SK_PREFIX}\uffff`,
        { limit, exclusiveStartKey },
      );
    } else {
      result = await this.query(pk, OBSERVATION_SK_PREFIX, { limit, exclusiveStartKey });
    }

    return {
      items: result.items.map((i) => this.toObservation(i)),
      lastEvaluatedKey: result.lastEvaluatedKey,
    };
  }

  /** Get the most recent observations for a participant. */
  async getLatest(participantId: string, count = 1): Promise<Observation[]> {
    const pk = participantPK(participantId);
    const result = await this.query(pk, OBSERVATION_SK_PREFIX, {
      limit: count,
      scanForward: false,
    });
    return result.items.map((i) => this.toObservation(i));
  }

  // -----------------------------------------------------------------------
  // Mapper
  // -----------------------------------------------------------------------
  private toObservation(item: ObservationItem): Observation {
    return {
      id: item.id,
      participantId: item.participantId,
      timestamp: item.timestamp,
      source: item.source as Observation['source'],
      measures: item.measures,
      context: {
        location: item.context.location as string | undefined,
        activity: item.context.activity as string | undefined,
        socialContext: item.context.socialContext as string | undefined,
        deviceType: item.context.deviceType as string | undefined,
      },
    };
  }
}

export const observationRepository = new ObservationRepository();
