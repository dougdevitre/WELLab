import { v4 as uuidv4 } from 'uuid';
import { BaseRepository } from '../repository';
import {
  buildCognitiveKey,
  COGNITIVE_SK_PREFIX,
  participantPK,
} from '../keys';
import { logger } from '../../utils/logger';
import type { CognitiveAssessment } from '../../types';

// ---------------------------------------------------------------------------
// DynamoDB item shape
// ---------------------------------------------------------------------------
interface CognitiveItem extends Record<string, unknown> {
  PK: string;
  SK: string;
  entityType: 'CognitiveAssessment';
  id: string;
  participantId: string;
  assessmentDate: string;
  instrument: string;
  domain: string;
  score: number;
  normalizedScore: number;
  percentile: number;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------
export interface ListCognitiveOptions {
  limit?: number;
  exclusiveStartKey?: Record<string, unknown>;
}

export interface CognitivePage {
  items: CognitiveAssessment[];
  lastEvaluatedKey?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------
class CognitiveRepository extends BaseRepository<CognitiveItem> {
  constructor() {
    super('CognitiveAssessment');
  }

  /** Create a new cognitive assessment. */
  async create(
    participantId: string,
    input: Omit<CognitiveAssessment, 'id' | 'participantId'>,
  ): Promise<CognitiveAssessment> {
    const id = `CA-${uuidv4().slice(0, 8)}`;
    const now = new Date().toISOString();
    const assessmentDate = input.assessmentDate ?? now.slice(0, 10);

    const key = buildCognitiveKey(participantId, assessmentDate);

    const item: CognitiveItem = {
      ...key,
      entityType: 'CognitiveAssessment',
      id,
      participantId,
      assessmentDate,
      instrument: input.instrument,
      domain: input.domain,
      score: input.score,
      normalizedScore: input.normalizedScore,
      percentile: input.percentile,
      created_at: now,
      updated_at: now,
    };

    await this.put(item);
    logger.info('CognitiveAssessment created', { id, participantId });
    return this.toCognitive(item);
  }

  /** List all cognitive assessments for a participant. */
  async listByParticipant(
    participantId: string,
    options: ListCognitiveOptions = {},
  ): Promise<CognitivePage> {
    const { limit, exclusiveStartKey } = options;
    const pk = participantPK(participantId);

    const result = await this.query(pk, COGNITIVE_SK_PREFIX, {
      limit,
      exclusiveStartKey,
    });

    return {
      items: result.items.map((i) => this.toCognitive(i)),
      lastEvaluatedKey: result.lastEvaluatedKey,
    };
  }

  /** Get the most recent cognitive assessment. */
  async getLatest(participantId: string): Promise<CognitiveAssessment | null> {
    const pk = participantPK(participantId);
    const result = await this.query(pk, COGNITIVE_SK_PREFIX, {
      limit: 1,
      scanForward: false,
    });
    return result.items.length > 0 ? this.toCognitive(result.items[0]) : null;
  }

  // -----------------------------------------------------------------------
  // Mapper
  // -----------------------------------------------------------------------
  private toCognitive(item: CognitiveItem): CognitiveAssessment {
    return {
      id: item.id,
      participantId: item.participantId,
      assessmentDate: item.assessmentDate,
      instrument: item.instrument,
      domain: item.domain as CognitiveAssessment['domain'],
      score: item.score,
      normalizedScore: item.normalizedScore,
      percentile: item.percentile,
    };
  }
}

export const cognitiveRepository = new CognitiveRepository();
