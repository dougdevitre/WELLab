/**
 * Claude Prompt Templates
 * =======================
 * All prompts used to communicate with Claude for WELLab insight
 * generation.  Each prompt enforces output-format instructions
 * (JSON with specific fields) so the caller can parse deterministically.
 *
 * Guardrails embedded in every system prompt:
 *  - Strength-framed language only
 *  - No clinical diagnoses or labels
 *  - Confidence qualifiers on every claim
 *  - Human-review flag when uncertain
 */

import {
  InsightRequest,
  TrendNarrativeRequest,
  ResearchSummaryRequest,
  PolicyBriefRequest,
} from './types';

// ---------------------------------------------------------------------------
// System prompt (shared across participant-facing use-cases)
// ---------------------------------------------------------------------------

export const PARTICIPANT_INSIGHT_SYSTEM_PROMPT = `You are a wellbeing science communicator for the WELLab research platform.
Your role is to translate statistical findings about a participant's emotional
patterns into warm, accessible, and encouraging narratives.

ABSOLUTE RULES — violating any of these is unacceptable:
1. STRENGTH-FRAMED: Always emphasise what is going well. Growth areas must be
   framed constructively (e.g., "an area with room for growth" not "a weakness").
2. NO DIAGNOSES: Never use psychiatric or medical diagnostic labels (e.g.,
   depression, dementia, PTSD, anxiety disorder, cognitive impairment).
3. NO RAW SCORES: Never expose numeric risk scores, p-values, or statistical
   values directly to the participant.
4. CONFIDENCE QUALIFIERS: Every claim must be hedged appropriately.
   Use phrases like "Our data suggest...", "It appears that...",
   "Based on your recent patterns..." — never "You have..." or "You are...".
5. NO PII: Never include names, emails, phone numbers, or other identifying
   information in your output.
6. HUMAN REVIEW: If you are uncertain about any statement, set
   "requiresHumanReview" to true in that insight.

Your tone is warm, encouraging, and scientifically grounded — like a supportive
coach who respects the participant's intelligence.

Respond ONLY with valid JSON matching the requested schema. No markdown fences,
no commentary outside the JSON object.`;

// ---------------------------------------------------------------------------
// Participant insight prompt
// ---------------------------------------------------------------------------

export function generateParticipantInsightPrompt(data: InsightRequest): string {
  const couplingDescriptions: Record<string, string> = {
    positive:
      'positive emotions and life satisfaction tend to move together — when positive affect rises, so does overall satisfaction',
    negative:
      'negative emotions tend to weigh on life satisfaction — when distress increases, satisfaction dips',
    decoupled:
      'emotional experiences and life satisfaction appear to operate somewhat independently',
    complex:
      'the relationship between emotions and life satisfaction shows a nuanced, context-dependent pattern',
  };

  const couplingNarrative = couplingDescriptions[data.couplingType] ?? couplingDescriptions.complex;

  const trendSummary =
    data.recentTrend.length > 0
      ? `Over the last ${data.recentTrend.length} observation(s), average positive affect was ${mean(data.recentTrend.map((d) => d.positiveAffect)).toFixed(2)}, average negative affect was ${mean(data.recentTrend.map((d) => d.negativeAffect)).toFixed(2)}, and average life satisfaction was ${mean(data.recentTrend.map((d) => d.lifeSatisfaction)).toFixed(2)}.`
      : 'Trend data is limited for this period.';

  return `Generate exactly 3 strength-framed insights for participant ${data.participantId}.

Context:
- Coupling pattern: Their ${couplingNarrative} (coupling strength ~${data.couplingStrength.toFixed(2)}).
- Emotional volatility: ${describeVolatility(data.volatility)}.
- Emotional inertia: ${describeInertia(data.inertia)}.
- Recent trend: ${trendSummary}

Return a JSON object with this exact schema:
{
  "insights": [
    {
      "title": "<short title, 2-5 words>",
      "body": "<1-3 sentences, strength-framed>",
      "category": "<one of: strength, pattern, growth-area>",
      "confidenceQualifier": "<the hedging phrase used>",
      "requiresHumanReview": <true if uncertain, otherwise false>
    }
  ]
}

Important: Exactly 3 insights. One per category (strength, pattern, growth-area).
The growth-area insight MUST be framed constructively.`;
}

// ---------------------------------------------------------------------------
// Trend narrative prompt
// ---------------------------------------------------------------------------

export function generateTrendNarrativePrompt(data: TrendNarrativeRequest): string {
  const rows = data.dataPoints
    .map(
      (d) =>
        `  ${d.date}: PA=${d.positiveAffect.toFixed(2)}, NA=${d.negativeAffect.toFixed(2)}, LS=${d.lifeSatisfaction.toFixed(2)}`,
    )
    .join('\n');

  return `Write a brief, participant-friendly narrative describing the wellbeing
trajectory over the past ${data.windowDays} days for participant ${data.participantId}.

Data (PA = positive affect, NA = negative affect, LS = life satisfaction):
${rows}

Rules:
- 2-4 sentences maximum
- Strength-framed: highlight improvements or stability first
- No raw numbers — describe trends qualitatively (e.g., "gradually improving",
  "holding steady", "somewhat variable")
- Include a confidence qualifier

Return a JSON object:
{
  "narrative": "<the narrative text>"
}`;
}

// ---------------------------------------------------------------------------
// Research summary prompt
// ---------------------------------------------------------------------------

export function generateResearchSummaryPrompt(request: ResearchSummaryRequest): string {
  const moduleNames: Record<string, string> = {
    'emotional-dynamics': 'Intraindividual Dynamics of Emotion and Life Satisfaction (IDELS)',
    'cognitive-health': 'Cognitive Health and Dementia Prevention',
    'lifespan-trajectory': 'Lifespan Trajectory Clustering',
    bidirectional: 'Bidirectional Causal Modeling (RI-CLPM / DoWhy)',
  };

  const moduleName = moduleNames[request.moduleType] ?? request.moduleType;

  const resultsTable = request.analysisResults
    .map((r) => {
      let line = `  - ${r.metric}: ${r.value.toFixed(4)}`;
      if (r.ci) line += ` [95% CI: ${r.ci[0].toFixed(4)}, ${r.ci[1].toFixed(4)}]`;
      if (r.pValue !== undefined) line += `, p = ${r.pValue.toFixed(4)}`;
      if (r.sampleSize !== undefined) line += `, N = ${r.sampleSize}`;
      return line;
    })
    .join('\n');

  const cohortCtx = request.cohortDescription
    ? `\nCohort: ${request.cohortDescription}`
    : '';

  return `Generate a methods paragraph and a results paragraph suitable for an
academic research report, based on the following analysis output from the
${moduleName} module.${cohortCtx}

Analysis results:
${resultsTable}

Return a JSON object:
{
  "methods": "<1 paragraph describing the analytical approach>",
  "results": "<1 paragraph summarising the findings with effect sizes and CIs>"
}

Write in third-person past tense. Include appropriate statistical notation.
Do not over-interpret; report what the data show.`;
}

// ---------------------------------------------------------------------------
// Policy brief prompt
// ---------------------------------------------------------------------------

export function generatePolicyBriefPrompt(request: PolicyBriefRequest): string {
  const metricsBlock = request.populationMetrics
    .map((m) => {
      let line = `  - ${m.label}: ${m.value} ${m.unit}`;
      if (m.changeFromPrior !== undefined) {
        const dir = m.changeFromPrior >= 0 ? '+' : '';
        line += ` (${dir}${m.changeFromPrior.toFixed(1)}% from prior period)`;
      }
      return line;
    })
    .join('\n');

  return `Write a plain-language policy brief based on the following population-level
wellbeing metrics for the period "${request.periodLabel}" (N = ${request.sampleSize}).

Metrics:
${metricsBlock}

Return a JSON object:
{
  "summary": "<2-3 sentence executive summary in plain language, no jargon>",
  "keyFindings": ["<finding 1>", "<finding 2>", "..."],
  "recommendations": ["<recommendation 1>", "<recommendation 2>", "..."]
}

Rules:
- Plain language: a non-scientist policymaker must be able to understand every sentence
- No individual-level data — everything is population-level and aggregated
- 3-5 key findings, 2-4 recommendations
- Use concrete, actionable language for recommendations`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function describeVolatility(v: number): string {
  if (v < 0.3) return 'Their emotional experience has been quite stable recently';
  if (v < 0.6) return 'They show moderate emotional variability, which is typical';
  return 'Their emotional experience has been notably variable';
}

function describeInertia(i: number): string {
  if (i < 0.3) return 'Emotions shift fairly readily from one moment to the next';
  if (i < 0.7) return 'Emotions show a moderate carry-over effect between observations';
  return 'Emotions tend to persist strongly from one observation to the next, suggesting high carry-over';
}
