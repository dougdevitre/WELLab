import { v4 as uuidv4 } from 'uuid';
import { BaseRepository } from '../repository';
import {
  buildInterventionKey,
  INTERVENTION_SK_PREFIX,
  participantPK,
} from '../keys';
import { logger } from '../../utils/logger';
import type { Intervention } from '../../types';

// ---------------------------------------------------------------------------
// DynamoDB item shape
// ---------------------------------------------------------------------------
interface InterventionItem extends Record<string, unknown> {
  PK: string;
  SK: string;
  entityType: 'Intervention';
  id: string;
  participantId: string;
  type: string;
  name: string;
  startDate: string;
  endDate?: string;
  status: string;
  dosage?: string;
  frequency?: string;
  outcomes: Record<string, number>;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------
export interface ListInterventionOptions {
  type?: Intervention['type'];
  status?: Intervention['status'];
  limit?: number;
  exclusiveStartKey?: Record<string, unknown>;
}

export interface InterventionPage {
  items: Intervention[];
  lastEvaluatedKey?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------
class InterventionRepository extends BaseRepository<InterventionItem> {
  constructor() {
    super('Intervention');
  }

  /** Create a new intervention record. */
  async create(
    participantId: string,
    input: Omit<Intervention, 'id' | 'participantId'>,
  ): Promise<Intervention> {
    const id = `INT-${uuidv4().slice(0, 8)}`;
    const now = new Date().toISOString();
    const timestamp = input.startDate ?? now;

    const key = buildInterventionKey(participantId, timestamp);

    const item: InterventionItem = {
      ...key,
      entityType: 'Intervention',
      id,
      participantId,
      type: input.type,
      name: input.name,
      startDate: input.startDate,
      endDate: input.endDate,
      status: input.status,
      dosage: input.dosage,
      frequency: input.frequency,
      outcomes: input.outcomes ?? {},
      created_at: now,
      updated_at: now,
    };

    await this.put(item);
    logger.info('Intervention created', { id, participantId });
    return this.toIntervention(item);
  }

  /** List interventions for a participant with optional type/status filters. */
  async listByParticipant(
    participantId: string,
    options: ListInterventionOptions = {},
  ): Promise<InterventionPage> {
    const { type, status, limit, exclusiveStartKey } = options;
    const pk = participantPK(participantId);

    // Build filter expression for type and/or status
    const filterParts: string[] = [];
    const filterValues: Record<string, unknown> = {};
    const filterNames: Record<string, string> = {};

    if (type) {
      filterParts.push('#intType = :intType');
      filterNames['#intType'] = 'type';
      filterValues[':intType'] = type;
    }
    if (status) {
      filterParts.push('#intStatus = :intStatus');
      filterNames['#intStatus'] = 'status';
      filterValues[':intStatus'] = status;
    }

    const result = await this.query(pk, INTERVENTION_SK_PREFIX, {
      limit,
      exclusiveStartKey,
      filterExpression: filterParts.length > 0 ? filterParts.join(' AND ') : undefined,
      filterValues: Object.keys(filterValues).length > 0 ? filterValues : undefined,
      filterNames: Object.keys(filterNames).length > 0 ? filterNames : undefined,
    });

    return {
      items: result.items.map((i) => this.toIntervention(i)),
      lastEvaluatedKey: result.lastEvaluatedKey,
    };
  }

  /** Mark an intervention as completed. Finds the item by scanning the participant's interventions. */
  async markCompleted(
    participantId: string,
    interventionId: string,
  ): Promise<Intervention> {
    // Find the intervention's sort key by querying all interventions for the participant
    const pk = participantPK(participantId);
    const result = await this.query(pk, INTERVENTION_SK_PREFIX, {
      filterExpression: '#iid = :iid',
      filterNames: { '#iid': 'id' },
      filterValues: { ':iid': interventionId },
    });

    if (result.items.length === 0) {
      const { NotFoundError } = await import('../errors');
      throw new NotFoundError('Intervention', { id: interventionId, participantId });
    }

    const existing = result.items[0];
    const key = { PK: existing.PK, SK: existing.SK };
    const now = new Date().toISOString();

    const updated = await this.update(key, {
      status: 'completed',
      endDate: now,
    });

    logger.info('Intervention marked completed', { interventionId, participantId });
    return this.toIntervention(updated);
  }

  // -----------------------------------------------------------------------
  // Mapper
  // -----------------------------------------------------------------------
  private toIntervention(item: InterventionItem): Intervention {
    return {
      id: item.id,
      participantId: item.participantId,
      type: item.type as Intervention['type'],
      name: item.name,
      startDate: item.startDate,
      endDate: item.endDate,
      status: item.status as Intervention['status'],
      dosage: item.dosage,
      frequency: item.frequency,
      outcomes: item.outcomes,
    };
  }
}

export const interventionRepository = new InterventionRepository();
