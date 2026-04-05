/**
 * Insight Generation Engine
 * =========================
 * Main service layer that orchestrates calls to the Claude API,
 * applies guardrails, caches results, and returns structured outputs.
 */

import { logger } from '../../utils/logger';
import { getClaudeClient } from './client';
import {
  PARTICIPANT_INSIGHT_SYSTEM_PROMPT,
  generateParticipantInsightPrompt,
  generateTrendNarrativePrompt,
  generateResearchSummaryPrompt,
  generatePolicyBriefPrompt,
} from './prompts';
import {
  validateInsightOutput,
  reframeToStrength,
  addConfidenceQualifier,
  redactSensitiveData,
} from './guardrails';
import {
  Insight,
  InsightCategory,
  InsightRequest,
  InsightResponse,
  TrendNarrativeRequest,
  TrendNarrativeResponse,
  ResearchSummaryRequest,
  ResearchSummaryResponse,
  PolicyBriefRequest,
  PolicyBriefResponse,
  TrendDataPoint,
  ClaudeUsageMetrics,
} from './types';

// ---------------------------------------------------------------------------
// Simple in-memory cache (insights regenerated weekly, not per-request)
// ---------------------------------------------------------------------------

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const insightCache = new Map<string, CacheEntry<InsightResponse>>();

function getCached<T>(cache: Map<string, CacheEntry<T>>, key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache<T>(cache: Map<string, CacheEntry<T>>, key: string, data: T): void {
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

// ---------------------------------------------------------------------------
// Research / policy prompt system prompts
// ---------------------------------------------------------------------------

const RESEARCH_SYSTEM_PROMPT = `You are an academic research writing assistant for the WELLab platform.
You produce concise, precise methods and results paragraphs suitable for
peer-reviewed publication. Use third-person past tense, include statistical
notation, and do not over-interpret the data.

Respond ONLY with valid JSON matching the requested schema.`;

const POLICY_SYSTEM_PROMPT = `You are a plain-language science communicator preparing policy briefs for
non-scientist stakeholders. Your writing is clear, jargon-free, and
action-oriented. All data referenced is population-level and aggregated —
never mention individuals.

Respond ONLY with valid JSON matching the requested schema.`;

// ---------------------------------------------------------------------------
// Participant insights
// ---------------------------------------------------------------------------

/**
 * Generate up to 3 strength-framed insights for a participant.
 * Results are cached for 7 days per participant.
 */
export async function generateParticipantInsights(
  participantId: string,
  emotionalDynamics: {
    couplingType: 'positive' | 'negative' | 'decoupled' | 'complex';
    couplingStrength: number;
    volatility: number;
    inertia: number;
  },
  recentTrend: TrendDataPoint[],
): Promise<InsightResponse> {
  // Check cache first
  const cacheKey = `insights:${participantId}`;
  const cached = getCached(insightCache, cacheKey);
  if (cached) {
    logger.info('Returning cached insights', { participantId });
    return cached;
  }

  const request: InsightRequest = {
    participantId,
    couplingType: emotionalDynamics.couplingType,
    couplingStrength: emotionalDynamics.couplingStrength,
    volatility: emotionalDynamics.volatility,
    inertia: emotionalDynamics.inertia,
    recentTrend,
    lastObservationDate:
      recentTrend.length > 0
        ? recentTrend[recentTrend.length - 1].date
        : new Date().toISOString(),
  };

  const client = getClaudeClient();
  const userPrompt = generateParticipantInsightPrompt(request);

  const { text, usage } = await client.createMessage(
    PARTICIPANT_INSIGHT_SYSTEM_PROMPT,
    userPrompt,
    { maxTokens: 1024, temperature: 0.4 },
  );

  // Parse response
  const parsed = safeParseJSON<{ insights: RawInsight[] }>(text);
  if (!parsed || !Array.isArray(parsed.insights)) {
    logger.error('Failed to parse Claude insight response', { text });
    throw new Error('Claude returned an unparseable response for participant insights');
  }

  // Validate, sanitise, and cap at 3 insights
  const insights: Insight[] = parsed.insights.slice(0, 3).map((raw) => {
    const insight = normaliseInsight(raw);
    const validation = validateInsightOutput(insight);

    if (!validation.valid) {
      // Auto-flag for human review when guardrails trip
      insight.requiresHumanReview = true;
      logger.warn('Insight flagged for human review', {
        participantId,
        title: insight.title,
        issues: validation.issues,
      });
    }

    return insight;
  });

  const response: InsightResponse = {
    insights,
    generatedAt: new Date().toISOString(),
    usage,
  };

  setCache(insightCache, cacheKey, response);
  return response;
}

// ---------------------------------------------------------------------------
// Trend narrative
// ---------------------------------------------------------------------------

/**
 * Generate a natural-language description of a participant's wellbeing
 * trajectory over 7 or 30 days.
 */
export async function generateTrendNarrative(
  data: TrendNarrativeRequest,
): Promise<TrendNarrativeResponse> {
  const client = getClaudeClient();
  const userPrompt = generateTrendNarrativePrompt(data);

  const { text, usage } = await client.createMessage(
    PARTICIPANT_INSIGHT_SYSTEM_PROMPT,
    userPrompt,
    { maxTokens: 512, temperature: 0.3 },
  );

  const parsed = safeParseJSON<{ narrative: string }>(text);
  if (!parsed || typeof parsed.narrative !== 'string') {
    logger.error('Failed to parse trend narrative response', { text });
    throw new Error('Claude returned an unparseable response for trend narrative');
  }

  const narrative = redactSensitiveData(reframeToStrength(parsed.narrative));

  return {
    narrative,
    generatedAt: new Date().toISOString(),
    usage,
  };
}

// ---------------------------------------------------------------------------
// Research summary
// ---------------------------------------------------------------------------

/**
 * Auto-generate methods and results paragraphs for the researcher dashboard.
 */
export async function generateResearchSummary(
  request: ResearchSummaryRequest,
): Promise<ResearchSummaryResponse> {
  const client = getClaudeClient();
  const userPrompt = generateResearchSummaryPrompt(request);

  const { text, usage } = await client.createMessage(RESEARCH_SYSTEM_PROMPT, userPrompt, {
    maxTokens: 1024,
    temperature: 0.2,
  });

  const parsed = safeParseJSON<{ methods: string; results: string }>(text);
  if (!parsed || typeof parsed.methods !== 'string' || typeof parsed.results !== 'string') {
    logger.error('Failed to parse research summary response', { text });
    throw new Error('Claude returned an unparseable response for research summary');
  }

  return {
    methods: redactSensitiveData(parsed.methods),
    results: redactSensitiveData(parsed.results),
    generatedAt: new Date().toISOString(),
    usage,
  };
}

// ---------------------------------------------------------------------------
// Policy brief
// ---------------------------------------------------------------------------

/**
 * Generate a plain-language policy brief from population-level metrics.
 */
export async function generatePolicyBrief(
  request: PolicyBriefRequest,
): Promise<PolicyBriefResponse> {
  const client = getClaudeClient();
  const userPrompt = generatePolicyBriefPrompt(request);

  const { text, usage } = await client.createMessage(POLICY_SYSTEM_PROMPT, userPrompt, {
    maxTokens: 1024,
    temperature: 0.3,
  });

  const parsed = safeParseJSON<{
    summary: string;
    keyFindings: string[];
    recommendations: string[];
  }>(text);

  if (
    !parsed ||
    typeof parsed.summary !== 'string' ||
    !Array.isArray(parsed.keyFindings) ||
    !Array.isArray(parsed.recommendations)
  ) {
    logger.error('Failed to parse policy brief response', { text });
    throw new Error('Claude returned an unparseable response for policy brief');
  }

  return {
    summary: redactSensitiveData(parsed.summary),
    keyFindings: parsed.keyFindings.map(redactSensitiveData),
    recommendations: parsed.recommendations.map(redactSensitiveData),
    generatedAt: new Date().toISOString(),
    usage,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface RawInsight {
  title?: string;
  body?: string;
  category?: string;
  confidenceQualifier?: string;
  requiresHumanReview?: boolean;
}

/** Safely parse JSON, returning null on failure. */
function safeParseJSON<T>(text: string): T | null {
  try {
    // Strip markdown fences if Claude included them despite instructions
    const cleaned = text.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '');
    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
}

/** Normalise a raw parsed insight into a well-typed Insight. */
function normaliseInsight(raw: RawInsight): Insight {
  const categoryMap: Record<string, InsightCategory> = {
    strength: InsightCategory.Strength,
    pattern: InsightCategory.Pattern,
    'growth-area': InsightCategory.GrowthArea,
  };

  const category = categoryMap[raw.category ?? ''] ?? InsightCategory.Pattern;

  const body = redactSensitiveData(reframeToStrength(raw.body ?? ''));

  // Determine confidence level heuristically
  const confidenceLevel: 'high' | 'medium' | 'low' = raw.requiresHumanReview ? 'low' : 'medium';
  const qualifier = raw.confidenceQualifier ?? '';
  const bodyWithQualifier = qualifier
    ? body
    : addConfidenceQualifier(body, confidenceLevel);

  return {
    title: raw.title ?? 'Insight',
    body: bodyWithQualifier,
    category,
    confidenceQualifier: qualifier || `Confidence: ${confidenceLevel}`,
    requiresHumanReview: raw.requiresHumanReview ?? false,
  };
}
