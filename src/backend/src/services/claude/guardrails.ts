/**
 * Claude Insight Guardrails
 * =========================
 * Safety layer ensuring all AI-generated content follows WELLab ethics
 * guidelines: strength-framed, no diagnoses, confidence qualifiers,
 * no PII leakage.
 *
 * Ref: references/ethics.md -- sections 2 (informed consent), 7 (transparency)
 */

import { Insight } from './types';
import { logger } from '../../utils/logger';

// ---------------------------------------------------------------------------
// Banned terms — clinical diagnoses & labels that must never appear
// ---------------------------------------------------------------------------

export const BANNED_TERMS: string[] = [
  // Psychiatric diagnoses
  'depression',
  'depressed',
  'major depressive disorder',
  'bipolar',
  'schizophrenia',
  'psychosis',
  'psychotic',
  'borderline personality',
  'antisocial personality',
  'ptsd',
  'post-traumatic stress',
  'anxiety disorder',
  'generalized anxiety',
  'panic disorder',
  'obsessive-compulsive',
  'ocd',
  'adhd',
  'eating disorder',
  'anorexia',
  'bulimia',
  'substance use disorder',
  'addiction',
  'suicidal',
  'self-harm',

  // Cognitive/dementia labels
  'dementia',
  'alzheimer',
  "alzheimer's",
  'mild cognitive impairment',
  'mci',
  'cognitive decline',
  'cognitive impairment',
  'neurodegeneration',

  // Clinical framing
  'diagnosis',
  'diagnosed',
  'clinical assessment',
  'pathological',
  'abnormal',
  'disorder',
  'disease',
  'syndrome',
  'deficit',
  'impaired',
  'dysfunction',
  'at risk',
  'high risk',
  'risk score',
  'risk level',
];

/** Pre-compiled lowercase set for O(1) substring checks */
const BANNED_SET = BANNED_TERMS.map((t) => t.toLowerCase());

// ---------------------------------------------------------------------------
// Negative framing patterns
// ---------------------------------------------------------------------------

const NEGATIVE_PATTERNS: RegExp[] = [
  /\byou(?:'re| are) (?:not|failing|struggling|unable)\b/i,
  /\byour (?:problem|weakness|failure|inability)\b/i,
  /\b(?:unfortunately|sadly|alarmingly|worryingly)\b/i,
  /\b(?:poor|bad|terrible|awful|horrible) (?:score|result|outcome|performance)\b/i,
  /\b(?:worse|worst|declining|deteriorating) (?:than|over)\b/i,
  /\braw score\b/i,
];

// ---------------------------------------------------------------------------
// PII patterns
// ---------------------------------------------------------------------------

const PII_PATTERNS: RegExp[] = [
  // Email
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  // US phone numbers
  /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
  // SSN-like
  /\b\d{3}-\d{2}-\d{4}\b/g,
  // Full names preceded by common labels
  /(?:name|patient|subject|participant):\s*[A-Z][a-z]+ [A-Z][a-z]+/gi,
  // IP addresses
  /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,
];

// ---------------------------------------------------------------------------
// Confidence qualifiers
// ---------------------------------------------------------------------------

const CONFIDENCE_QUALIFIERS: Record<string, string> = {
  high: 'Our data suggest',
  medium: 'It appears that',
  low: 'Based on limited observations, it seems',
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface ValidationResult {
  valid: boolean;
  issues: string[];
}

/**
 * Validate that an AI-generated insight does not contain banned terms,
 * clinical diagnoses, raw scores, or negative framing.
 */
export function validateInsightOutput(insight: Insight): ValidationResult {
  const issues: string[] = [];
  const fullText = `${insight.title} ${insight.body} ${insight.confidenceQualifier}`.toLowerCase();

  // Check banned terms
  for (const term of BANNED_SET) {
    if (fullText.includes(term)) {
      issues.push(`Contains banned term: "${term}"`);
    }
  }

  // Check negative framing
  const combinedText = `${insight.title} ${insight.body} ${insight.confidenceQualifier}`;
  for (const pattern of NEGATIVE_PATTERNS) {
    if (pattern.test(combinedText)) {
      issues.push(`Contains negative framing matching pattern: ${pattern.source}`);
    }
  }

  // Check for raw numeric scores exposed to participants
  const rawScorePattern = /\b(?:score|rating)\s*(?:is|was|=|:)\s*\d+\.?\d*/i;
  if (rawScorePattern.test(combinedText)) {
    issues.push('Contains raw numeric score');
  }

  if (issues.length > 0) {
    logger.warn('Insight failed guardrail validation', {
      insightTitle: insight.title,
      issues,
    });
  }

  return { valid: issues.length === 0, issues };
}

/**
 * Ensure text uses strength-based framing.
 * Replaces common negative phrases with constructive alternatives.
 */
export function reframeToStrength(text: string): string {
  const replacements: Array<[RegExp, string]> = [
    [/\byou(?:'re| are) struggling with\b/gi, 'you have room to grow in'],
    [/\byou(?:'re| are) failing at\b/gi, 'you are building skills in'],
    [/\byour weakness (?:is|in)\b/gi, 'an area for growth is'],
    [/\bpoor performance in\b/gi, 'an emerging area for you is'],
    [/\bdeclined\b/gi, 'has shifted'],
    [/\bdeteriorated\b/gi, 'has changed'],
    [/\bworse than\b/gi, 'different from'],
    [/\bunfortunately\b/gi, 'notably'],
    [/\bsadly\b/gi, 'interestingly'],
    [/\bproblem\b/gi, 'opportunity'],
  ];

  let result = text;
  for (const [pattern, replacement] of replacements) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

/**
 * Prepend an appropriate confidence qualifier to the text based on the
 * confidence level.
 *
 * @param confidenceLevel - "high" | "medium" | "low"
 */
export function addConfidenceQualifier(
  text: string,
  confidenceLevel: 'high' | 'medium' | 'low',
): string {
  const qualifier = CONFIDENCE_QUALIFIERS[confidenceLevel] ?? CONFIDENCE_QUALIFIERS.medium;

  // If the text already starts with a known qualifier, skip
  const lowerText = text.toLowerCase();
  const alreadyQualified = Object.values(CONFIDENCE_QUALIFIERS).some((q) =>
    lowerText.startsWith(q.toLowerCase()),
  );
  if (alreadyQualified) return text;

  // Lowercase the first character of text when joining
  const body = text.charAt(0).toLowerCase() + text.slice(1);
  return `${qualifier} ${body}`;
}

/**
 * Redact any personally-identifiable information that may have leaked
 * through the Claude response.
 */
export function redactSensitiveData(text: string): string {
  let result = text;
  for (const pattern of PII_PATTERNS) {
    result = result.replace(pattern, '[REDACTED]');
  }
  return result;
}
