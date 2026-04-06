/**
 * EMA Survey Configuration
 * ========================
 * Defines the "A Close Look at Daily Life" daily survey protocol
 * used by the WELLab at Washington University in St. Louis.
 *
 * Protocol: 9 surveys/day over 2 weeks, targeting 80%+ compliance.
 * Each survey measures current thoughts, feelings, and behaviors.
 * First and last surveys of each day include additional items.
 */

// ---------------------------------------------------------------------------
// Survey item definitions
// ---------------------------------------------------------------------------

export interface SurveyItem {
  id: string;
  text: string;
  type: 'likert' | 'slider' | 'open-text' | 'yes-no' | 'multiple-choice';
  scale?: { min: number; max: number; minLabel: string; maxLabel: string };
  options?: string[];
  domain: EMADomain;
  schedule: 'all' | 'first-last' | 'first-only' | 'last-only';
}

export type EMADomain =
  | 'positive-affect'
  | 'negative-affect'
  | 'life-satisfaction'
  | 'self-esteem'
  | 'social-interaction'
  | 'psychological-richness'
  | 'serendipity'
  | 'assertiveness'
  | 'daily-activity'
  | 'wellbeing-global';

// ---------------------------------------------------------------------------
// Core survey items (asked in every survey)
// ---------------------------------------------------------------------------

export const CORE_SURVEY_ITEMS: SurveyItem[] = [
  {
    id: 'pa_happy',
    text: 'Right now, I feel happy.',
    type: 'likert',
    scale: { min: 1, max: 7, minLabel: 'Not at all', maxLabel: 'Very much' },
    domain: 'positive-affect',
    schedule: 'all',
  },
  {
    id: 'pa_content',
    text: 'Right now, I feel content.',
    type: 'likert',
    scale: { min: 1, max: 7, minLabel: 'Not at all', maxLabel: 'Very much' },
    domain: 'positive-affect',
    schedule: 'all',
  },
  {
    id: 'pa_energetic',
    text: 'Right now, I feel energetic.',
    type: 'likert',
    scale: { min: 1, max: 7, minLabel: 'Not at all', maxLabel: 'Very much' },
    domain: 'positive-affect',
    schedule: 'all',
  },
  {
    id: 'na_sad',
    text: 'Right now, I feel sad.',
    type: 'likert',
    scale: { min: 1, max: 7, minLabel: 'Not at all', maxLabel: 'Very much' },
    domain: 'negative-affect',
    schedule: 'all',
  },
  {
    id: 'na_anxious',
    text: 'Right now, I feel anxious.',
    type: 'likert',
    scale: { min: 1, max: 7, minLabel: 'Not at all', maxLabel: 'Very much' },
    domain: 'negative-affect',
    schedule: 'all',
  },
  {
    id: 'na_angry',
    text: 'Right now, I feel angry.',
    type: 'likert',
    scale: { min: 1, max: 7, minLabel: 'Not at all', maxLabel: 'Very much' },
    domain: 'negative-affect',
    schedule: 'all',
  },
  {
    id: 'ls_satisfied',
    text: 'Right now, I am satisfied with my life.',
    type: 'likert',
    scale: { min: 1, max: 7, minLabel: 'Strongly disagree', maxLabel: 'Strongly agree' },
    domain: 'life-satisfaction',
    schedule: 'all',
  },
  {
    id: 'ls_conditions',
    text: 'The conditions of my life are excellent.',
    type: 'likert',
    scale: { min: 1, max: 7, minLabel: 'Strongly disagree', maxLabel: 'Strongly agree' },
    domain: 'life-satisfaction',
    schedule: 'all',
  },
  {
    id: 'social_interaction',
    text: 'Since the last survey, have you had a social interaction (a back-and-forth conversation with another person, in person or remotely)?',
    type: 'yes-no',
    domain: 'social-interaction',
    schedule: 'all',
  },
  {
    id: 'social_quality',
    text: 'How positive was that interaction?',
    type: 'likert',
    scale: { min: 1, max: 7, minLabel: 'Very negative', maxLabel: 'Very positive' },
    domain: 'social-interaction',
    schedule: 'all',
  },
];

// ---------------------------------------------------------------------------
// Additional items for first and last survey of the day
// ---------------------------------------------------------------------------

export const EXTENDED_SURVEY_ITEMS: SurveyItem[] = [
  {
    id: 'se_respect',
    text: 'Right now, I have a high level of self-esteem.',
    type: 'likert',
    scale: { min: 1, max: 7, minLabel: 'Strongly disagree', maxLabel: 'Strongly agree' },
    domain: 'self-esteem',
    schedule: 'first-last',
  },
  {
    id: 'pr_rich',
    text: 'Today my life feels psychologically rich (characterized by variety, depth, and interest).',
    type: 'likert',
    scale: { min: 1, max: 7, minLabel: 'Strongly disagree', maxLabel: 'Strongly agree' },
    domain: 'psychological-richness',
    schedule: 'first-last',
  },
  {
    id: 'serendipity',
    text: 'Today, something serendipitous happened (an event occurred by chance in a happy or positive way).',
    type: 'likert',
    scale: { min: 1, max: 7, minLabel: 'Strongly disagree', maxLabel: 'Strongly agree' },
    domain: 'serendipity',
    schedule: 'last-only',
  },
  {
    id: 'assertive',
    text: 'Today, I was assertive (having or showing a confident and forceful personality).',
    type: 'likert',
    scale: { min: 1, max: 7, minLabel: 'Strongly disagree', maxLabel: 'Strongly agree' },
    domain: 'assertiveness',
    schedule: 'last-only',
  },
  {
    id: 'wb_global',
    text: 'Overall, how would you rate your well-being today?',
    type: 'slider',
    scale: { min: 0, max: 100, minLabel: 'Worst possible', maxLabel: 'Best possible' },
    domain: 'wellbeing-global',
    schedule: 'last-only',
  },
];

// ---------------------------------------------------------------------------
// Survey protocol configuration
// ---------------------------------------------------------------------------

export const EMA_PROTOCOL = {
  studyName: 'A Close Look at Daily Life',
  institution: 'WELLab — Washington University in St. Louis',
  contactEmail: 'wellab@wustl.edu',
  contactPhone: '314-935-5397',
  durationWeeks: 2,
  surveysPerDay: 9,
  complianceTarget: 0.80,
  surveyWindowMinutes: 15,

  /** Glossary for uncommon terms shown in survey items */
  glossary: {
    assertive: 'Having or showing a confident and forceful personality.',
    conventional: 'Conforming to accepted standards, in accordance with what is generally done or believed.',
    'psychologically rich': 'Characterized by variety, depth, and interest via first-hand or vicarious experiences such as novels, films, and sports on TV.',
    'self-esteem': 'A realistic respect for or positive impression of oneself; self-respect.',
    'social interaction': 'A back-and-forth conversation with another person that occurs either in person or remotely (e.g., via text, phone, or videocall).',
    'serendipitous/serendipity': 'The occurrence of events by chance in a happy or positive way.',
  } as Record<string, string>,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Get the survey items for a given survey position in the day.
 * @param surveyIndex 0-based index within the day (0 = first, 8 = last for 9/day)
 */
export function getSurveyItems(surveyIndex: number): SurveyItem[] {
  const isFirst = surveyIndex === 0;
  const isLast = surveyIndex === EMA_PROTOCOL.surveysPerDay - 1;

  const items = [...CORE_SURVEY_ITEMS];

  for (const item of EXTENDED_SURVEY_ITEMS) {
    if (item.schedule === 'first-last' && (isFirst || isLast)) {
      items.push(item);
    } else if (item.schedule === 'first-only' && isFirst) {
      items.push(item);
    } else if (item.schedule === 'last-only' && isLast) {
      items.push(item);
    }
  }

  return items;
}

/**
 * Map raw survey responses to the observation measures format
 * expected by the WELLab data model.
 */
export function mapSurveyToMeasures(
  responses: Record<string, number | string | boolean>,
): Record<string, number | string | boolean> {
  return {
    happiness: Number(responses.pa_happy ?? 0),
    contentment: Number(responses.pa_content ?? 0),
    energy: Number(responses.pa_energetic ?? 0),
    sadness: Number(responses.na_sad ?? 0),
    anxiety: Number(responses.na_anxious ?? 0),
    anger: Number(responses.na_angry ?? 0),
    life_satisfaction: Number(responses.ls_satisfied ?? 0),
    life_conditions: Number(responses.ls_conditions ?? 0),
    social_interaction: Boolean(responses.social_interaction),
    social_quality: Number(responses.social_quality ?? 0),
    // Extended items (may be undefined for mid-day surveys)
    ...(responses.se_respect !== undefined && { self_esteem: Number(responses.se_respect) }),
    ...(responses.pr_rich !== undefined && { psychological_richness: Number(responses.pr_rich) }),
    ...(responses.serendipity !== undefined && { serendipity: Number(responses.serendipity) }),
    ...(responses.assertive !== undefined && { assertiveness: Number(responses.assertive) }),
    ...(responses.wb_global !== undefined && { wellbeing_global: Number(responses.wb_global) }),
    // Computed composites
    positive_affect: (Number(responses.pa_happy ?? 0) + Number(responses.pa_content ?? 0) + Number(responses.pa_energetic ?? 0)) / 3,
    negative_affect: (Number(responses.na_sad ?? 0) + Number(responses.na_anxious ?? 0) + Number(responses.na_angry ?? 0)) / 3,
  };
}

/**
 * Compute EMA compliance rate for a participant over a given period.
 */
export function computeCompliance(
  responsesReceived: number,
  daysInStudy: number,
): { rate: number; meetsTarget: boolean; totalExpected: number } {
  const totalExpected = daysInStudy * EMA_PROTOCOL.surveysPerDay;
  const rate = totalExpected > 0 ? responsesReceived / totalExpected : 0;
  return {
    rate,
    meetsTarget: rate >= EMA_PROTOCOL.complianceTarget,
    totalExpected,
  };
}
