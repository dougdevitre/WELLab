import { v4 as uuidv4 } from 'uuid';
import { BaseRepository } from '../repository';
import {
  buildLifespanKey,
  LIFESPAN_SK_PREFIX,
  participantPK,
} from '../keys';
import { logger } from '../../utils/logger';
import type { LifespanTrajectory, TrajectoryPoint } from '../../types';

// ---------------------------------------------------------------------------
// DynamoDB item shape
// ---------------------------------------------------------------------------
interface LifespanItem extends Record<string, unknown> {
  PK: string;
  SK: string;
  entityType: 'LifespanAssessment';
  id: string;
  participantId: string;
  assessmentWave: number;
  domain: string;
  points: TrajectoryPoint[];
  clusterLabel?: string;
  trajectoryClass: string;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------
export interface ListLifespanOptions {
  limit?: number;
  exclusiveStartKey?: Record<string, unknown>;
}

export interface LifespanPage {
  items: LifespanTrajectory[];
  lastEvaluatedKey?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------
class LifespanRepository extends BaseRepository<LifespanItem> {
  constructor() {
    super('LifespanAssessment');
  }

  /** Create a new lifespan assessment for a given wave. */
  async create(
    participantId: string,
    input: Omit<LifespanTrajectory, 'participantId'> & { assessmentWave: number },
  ): Promise<LifespanTrajectory> {
    const id = `LS-${uuidv4().slice(0, 8)}`;
    const now = new Date().toISOString();

    const key = buildLifespanKey(participantId, input.assessmentWave);

    const item: LifespanItem = {
      ...key,
      entityType: 'LifespanAssessment',
      id,
      participantId,
      assessmentWave: input.assessmentWave,
      domain: input.domain,
      points: input.points,
      clusterLabel: input.clusterLabel,
      trajectoryClass: input.trajectoryClass,
      created_at: now,
      updated_at: now,
    };

    await this.put(item);
    logger.info('LifespanAssessment created', { id, participantId, wave: input.assessmentWave });
    return this.toTrajectory(item);
  }

  /** List all lifespan assessments (all waves) for a participant. */
  async listByParticipant(
    participantId: string,
    options: ListLifespanOptions = {},
  ): Promise<LifespanPage> {
    const { limit, exclusiveStartKey } = options;
    const pk = participantPK(participantId);

    const result = await this.query(pk, LIFESPAN_SK_PREFIX, {
      limit,
      exclusiveStartKey,
    });

    return {
      items: result.items.map((i) => this.toTrajectory(i)),
      lastEvaluatedKey: result.lastEvaluatedKey,
    };
  }

  /** Get a specific wave assessment for a participant. */
  async getByWave(participantId: string, wave: number): Promise<LifespanTrajectory> {
    const key = buildLifespanKey(participantId, wave);
    const item = await this.get(key);
    return this.toTrajectory(item);
  }

  // -----------------------------------------------------------------------
  // Mapper
  // -----------------------------------------------------------------------
  private toTrajectory(item: LifespanItem): LifespanTrajectory {
    return {
      participantId: item.participantId,
      domain: item.domain,
      points: item.points,
      clusterLabel: item.clusterLabel,
      trajectoryClass: item.trajectoryClass,
    };
  }
}

export const lifespanRepository = new LifespanRepository();
