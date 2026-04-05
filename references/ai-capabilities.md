# Advanced AI Capabilities Layer

> WELLab AI-Enabled Research & Impact Platform
> Washington University in St. Louis

This document describes the advanced AI capabilities that operate across the four core modules, providing shared analytical infrastructure for emotion-satisfaction coupling classification, temporal dynamics computation, bidirectional causal modeling, and natural language insight generation.

---

## Table of Contents

1. [IDELS AI Extension](#1-idels-ai-extension)
2. [Temporal Dynamics Engine](#2-temporal-dynamics-engine)
3. [Bidirectional Modeling System](#3-bidirectional-modeling-system)
4. [Claude API Integration](#4-claude-api-integration)

---

## 1. IDELS AI Extension

### Overview

The Intraindividual Dynamics of Emotion and Life Satisfaction (IDELS) AI Extension implements a computational framework for classifying how momentary emotional experiences couple with momentary life satisfaction judgments at the within-person level. This extends the foundational IDELS research by applying machine learning to automate coupling classification, detect transitions between coupling types over time, and generate interpretable explanations for researchers.

### Coupling Types

| Type | Definition | Prevalence (typical) | Interpretation |
|------|-----------|----------------------|----------------|
| **Positive** | Positive affect positively predicts satisfaction; negative affect negatively predicts satisfaction | 40-50% | Emotions strongly inform satisfaction judgments; "bottom-up" evaluation |
| **Negative** | Counter-normative associations (e.g., negative affect positively predicts satisfaction) | 5-10% | May reflect meaning-making, post-traumatic growth, or measurement artifacts |
| **Decoupled** | Near-zero association between affect and satisfaction | 25-35% | Satisfaction based on stable cognitive appraisals rather than momentary affect |
| **Complex** | Non-linear, time-varying, or context-dependent coupling | 15-20% | Coupling strength varies by context, time of day, or life circumstances |

### Classification Pipeline

```
1. Data Preparation
   └─ Filter participants with >= 20 EMA observations
   └─ Person-mean center affect and satisfaction variables
   └─ Compute lagged variables (t-1) for dynamic analysis

2. Within-Person Model Estimation
   └─ Fit multilevel model: LS_it = β₀ᵢ + β₁ᵢ(PA_it) + β₂ᵢ(NA_it) + ε_it
   └─ Extract person-specific slopes (β₁ᵢ, β₂ᵢ) via random effects
   └─ Compute confidence intervals for each slope

3. Coupling Classification
   └─ Feature vector per participant: [β₁, β₂, β₁_se, β₂_se, n_obs]
   └─ Apply trained classifier (Gaussian Mixture Model or rule-based)
   └─ Assign coupling type with posterior probability

4. Temporal Dynamics (optional)
   └─ Fit time-varying parameter model (DSEM or sliding window)
   └─ Detect transitions between coupling types
   └─ Flag participants with unstable coupling for researcher review

5. Validation
   └─ Cross-validate classification against manual expert labels
   └─ Check demographic invariance (coupling should not be predicted by demographics alone)
```

### Configuration Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `min_observations` | 20 | Minimum EMA observations for classification |
| `window_days` | 90 | Default analysis window |
| `sliding_window_step` | 14 | Days between sliding window centers |
| `n_coupling_types` | 4 | Number of GMM components |
| `classification_threshold` | 0.70 | Minimum posterior probability for assignment |
| `transition_sensitivity` | 0.15 | Minimum change in posterior to flag transition |

### Output Schema

```json
{
  "participant_id": "P-20250401-0042",
  "analysis_window": {
    "start": "2026-01-01",
    "end": "2026-03-31"
  },
  "coupling_result": {
    "type": "positive",
    "posterior_probabilities": {
      "positive": 0.87,
      "negative": 0.02,
      "decoupled": 0.08,
      "complex": 0.03
    },
    "coefficients": {
      "pa_to_ls": { "estimate": 0.42, "se": 0.06, "p": 0.0001 },
      "na_to_ls": { "estimate": -0.31, "se": 0.07, "p": 0.0001 }
    }
  },
  "temporal_stability": {
    "stable": true,
    "transitions": [],
    "n_windows_analyzed": 6
  },
  "n_observations": 284,
  "model_version": "idels-coupling-v2.1.0",
  "fairness_audit": {
    "demographic_parity_passed": true,
    "audit_date": "2026-04-01"
  }
}
```

---

## 2. Temporal Dynamics Engine

### Overview

The Temporal Dynamics Engine computes variability and change metrics from time-series wellbeing data. These metrics capture how much a person's wellbeing fluctuates (within-person variability), how fast it changes (rate of change), and how unstable it is (volatility indices). The engine distinguishes within-person dynamics from between-person differences, enabling researchers to study intraindividual processes.

### Metrics Computed

#### Variability Metrics

| Metric | Formula | Interpretation |
|--------|---------|----------------|
| **Intraindividual SD (iSD)** | SD of person-centered scores | Overall within-person variability |
| **Coefficient of Variation (CV)** | iSD / person mean | Variability relative to person's average level |
| **Range** | Max - Min within window | Spread of scores |
| **Interquartile Range (IQR)** | Q3 - Q1 within window | Robust variability measure |

#### Rate of Change Metrics

| Metric | Formula | Interpretation |
|--------|---------|----------------|
| **Mean Successive Difference (MSD)** | Mean of (x_t - x_{t-1}) | Average directional change |
| **Mean Squared Successive Difference (MSSD)** | Mean of (x_t - x_{t-1})^2 | Captures both magnitude and direction of change |
| **Probability of Acute Change (PAC)** | P(|x_t - x_{t-1}| > threshold) | Frequency of large shifts |

#### Volatility Indices

| Metric | Formula | Interpretation |
|--------|---------|----------------|
| **MSSD / Variance ratio** | MSSD / (2 * Var) | Values > 1 indicate temporal instability beyond static variability |
| **Autocorrelation (lag-1)** | Cor(x_t, x_{t-1}) | Emotional inertia — how much current state depends on previous state |
| **Emotional Inertia Index** | 1 - |autocorrelation| | Higher values = less inertia, more reactivity |
| **Composite Volatility Score** | Weighted combination of MSSD, PAC, inertia | Single index summarizing temporal instability |

### Within-Person vs Between-Person Decomposition

The engine implements a full ICC (Intraclass Correlation Coefficient) decomposition:

```
Total variance = Between-person variance + Within-person variance

ICC = Between-person variance / Total variance

High ICC (> 0.50): Most variation is between people (stable trait-like differences)
Low ICC (< 0.30): Most variation is within people (dynamic state-like fluctuations)
```

This decomposition is computed for every wellbeing variable (positive affect, negative affect, life satisfaction, purpose, social connection) and reported at both individual and cohort levels.

### Processing Pipeline

```
Input: Time-indexed wellbeing observations for a participant

1. Preprocessing
   └─ Sort by timestamp
   └─ Impute or flag gaps > 2x expected interval
   └─ Apply person-mean centering

2. Window Segmentation
   └─ Compute metrics for rolling windows (7-day, 14-day, 30-day)
   └─ Compute metrics for full analysis period

3. Metric Computation
   └─ Variability metrics (iSD, CV, Range, IQR)
   └─ Rate of change metrics (MSD, MSSD, PAC)
   └─ Volatility indices (MSSD/Var, autocorrelation, inertia)
   └─ ICC decomposition (requires cohort-level data)

4. Norming
   └─ Compare individual metrics to cohort distribution
   └─ Compute percentile ranks
   └─ Flag extreme values (> 2 SD from cohort mean)

5. Alerting
   └─ Check against configurable thresholds
   └─ Generate alerts for researcher review (never automated intervention)
```

### API Integration

```
GET /api/v1/temporal/metrics/{participant_id}
  ?window=30
  &variables=positive_affect,negative_affect,life_satisfaction
  &include_norms=true
```

**Response**:
```json
{
  "participant_id": "P-20250401-0042",
  "window_days": 30,
  "n_observations": 87,
  "metrics": {
    "positive_affect": {
      "mean": 3.62,
      "isd": 0.92,
      "cv": 0.254,
      "mssd": 1.24,
      "autocorrelation_lag1": 0.38,
      "emotional_inertia": 0.62,
      "pac_threshold_1": 0.14,
      "composite_volatility": 0.45,
      "cohort_percentile": 67
    },
    "negative_affect": {
      "mean": 1.85,
      "isd": 0.71,
      "cv": 0.384,
      "mssd": 0.87,
      "autocorrelation_lag1": 0.42,
      "emotional_inertia": 0.58,
      "pac_threshold_1": 0.09,
      "composite_volatility": 0.38,
      "cohort_percentile": 52
    },
    "life_satisfaction": {
      "mean": 4.05,
      "isd": 0.48,
      "cv": 0.119,
      "mssd": 0.56,
      "autocorrelation_lag1": 0.55,
      "emotional_inertia": 0.45,
      "pac_threshold_1": 0.05,
      "composite_volatility": 0.22,
      "cohort_percentile": 34
    }
  },
  "icc": {
    "positive_affect": 0.42,
    "negative_affect": 0.38,
    "life_satisfaction": 0.61
  },
  "alerts": [],
  "computed_at": "2026-04-05T12:00:00Z",
  "model_version": "temporal-dynamics-v1.2.0"
}
```

---

## 3. Bidirectional Modeling System

### Overview

The Bidirectional Modeling System estimates the directional and reciprocal relationships between wellbeing constructs and health/cognitive outcomes. Rather than assuming wellbeing causes health improvements (or vice versa), this system tests both directions simultaneously using cross-lagged panel models (CLPM), random-intercept cross-lagged panel models (RI-CLPM), and Granger causality frameworks.

### Model Types

#### Cross-Lagged Panel Model (CLPM)

Tests whether wellbeing at time T predicts health at time T+1 (and vice versa), controlling for autoregressive effects.

```
Wellbeing(T) ──────→ Wellbeing(T+1)
      │                    ↑
      └──cross-lag──→ Health(T+1)
                           │
Health(T) ────────→ Health(T+1)
      │                    ↑
      └──cross-lag──→ Wellbeing(T+1)
```

**Parameters estimated**:
- Autoregressive paths: Stability of each construct over time
- Cross-lagged paths: Directional effects between constructs
- Residual correlations: Contemporaneous associations

#### Random-Intercept CLPM (RI-CLPM)

Extends CLPM by separating stable between-person differences (random intercepts) from within-person dynamics. This prevents confounding trait-level associations with temporal processes.

```
Between-person level:
  Wellbeing trait ←──correlated──→ Health trait

Within-person level:
  ΔWellbeing(T) ──cross-lag──→ ΔHealth(T+1)
  ΔHealth(T) ──cross-lag──→ ΔWellbeing(T+1)
```

#### Granger Causality

Tests whether past values of wellbeing improve prediction of future health beyond what past health alone predicts (and vice versa). Implemented as nested model comparison with likelihood ratio tests.

### Supported Variable Pairs

| Wellbeing Construct | Health/Cognitive Outcome |
|---------------------|-------------------------|
| Life satisfaction | Chronic condition count |
| Purpose in life | ADRD risk score |
| Positive affect | Self-rated health |
| Social wellbeing | Functional limitations |
| Eudaimonic composite | Biomarker composite (inflammation, metabolic) |
| Hedonic composite | Mortality risk (for survival extension) |
| Negative affect | Depression diagnosis |
| Emotional volatility | Cardiovascular events |

### Pipeline Architecture

```
1. Data Assembly
   └─ Pull paired time-series data for wellbeing + health variables
   └─ Align measurement occasions (handle different cadences)
   └─ Minimum 3 waves required; 4+ recommended

2. Model Specification
   └─ Auto-detect number of waves and measurement intervals
   └─ Specify CLPM, RI-CLPM, or both
   └─ Include time-invariant covariates (age, sex, education)

3. Model Estimation
   └─ Fit models via maximum likelihood (FIML for missing data)
   └─ Compute standardized path coefficients
   └─ Test measurement invariance across waves

4. Model Comparison
   └─ Compare CLPM vs RI-CLPM fit (chi-square difference test)
   └─ Compare nested models to test significance of cross-lagged paths
   └─ Granger causality tests as robustness check

5. Interpretation Engine
   └─ Classify directionality: wellbeing→health, health→wellbeing, bidirectional, no association
   └─ Compute effect size metrics
   └─ Generate natural language summary via Claude API
```

### API Integration

```
POST /api/v1/bidirectional/analyze
```

**Request**:
```json
{
  "wellbeing_variable": "purpose_in_life",
  "health_variable": "chronic_condition_count",
  "model_types": ["clpm", "ri_clpm"],
  "covariates": ["age", "sex", "education"],
  "cohort_filter": {
    "age_range": [50, 75],
    "min_waves": 3
  }
}
```

**Response**:
```json
{
  "analysis_id": "BD-20260405-001",
  "wellbeing_variable": "purpose_in_life",
  "health_variable": "chronic_condition_count",
  "n_participants": 1893,
  "n_waves": 4,
  "results": {
    "clpm": {
      "fit": { "cfi": 0.97, "rmsea": 0.04, "srmr": 0.03 },
      "paths": {
        "wellbeing_to_health": { "beta": -0.12, "se": 0.03, "p": 0.0001 },
        "health_to_wellbeing": { "beta": -0.08, "se": 0.03, "p": 0.008 },
        "wellbeing_autoregressive": { "beta": 0.65, "se": 0.02, "p": 0.0001 },
        "health_autoregressive": { "beta": 0.72, "se": 0.02, "p": 0.0001 }
      }
    },
    "ri_clpm": {
      "fit": { "cfi": 0.98, "rmsea": 0.03, "srmr": 0.02 },
      "paths": {
        "wellbeing_to_health": { "beta": -0.09, "se": 0.04, "p": 0.02 },
        "health_to_wellbeing": { "beta": -0.05, "se": 0.04, "p": 0.21 },
        "wellbeing_autoregressive": { "beta": 0.28, "se": 0.05, "p": 0.0001 },
        "health_autoregressive": { "beta": 0.35, "se": 0.04, "p": 0.0001 }
      },
      "between_person_correlation": -0.34
    },
    "model_comparison": {
      "preferred": "ri_clpm",
      "chi_sq_diff": 24.5,
      "df_diff": 2,
      "p": 0.000005
    },
    "directionality": {
      "classification": "wellbeing_to_health",
      "confidence": "moderate",
      "summary": "Purpose in life at time T predicts fewer chronic conditions at T+1, but chronic conditions do not significantly predict subsequent purpose (at within-person level)."
    }
  },
  "granger_causality": {
    "wellbeing_granger_causes_health": { "f_statistic": 8.42, "p": 0.004 },
    "health_granger_causes_wellbeing": { "f_statistic": 2.15, "p": 0.143 }
  },
  "model_version": "bidirectional-v1.4.0"
}
```

---

## 4. Claude API Integration

### Overview

The platform integrates Anthropic's Claude API to generate natural language insights from quantitative model outputs. Claude transforms statistical results, risk scores, and trajectory parameters into human-readable narratives tailored to three audiences: participants, researchers, and policymakers.

### Integration Architecture

```
Model output (JSON)
  → Prompt template selection (audience-specific)
  → System prompt (role, constraints, framing guidelines)
  → Claude API call (claude-sonnet-4-20250514)
  → Response validation (content safety, accuracy checks)
  → Delivery to dashboard
```

### Audience-Specific Generation

#### Participant Insights

- **Framing**: Strength-based, encouraging, non-diagnostic
- **Reading level**: 8th grade (Flesch-Kincaid)
- **Constraints**: Never use clinical language, never imply diagnosis, always include actionable takeaway
- **Example output**: "Your sense of wellbeing has been steady over the past month, with your strongest moments coming during times with friends and family. Your positive outlook is a real strength -- research suggests it supports long-term health."

**System prompt excerpt**:
```
You are a wellbeing research assistant for WELLab at Washington University
in St. Louis. Generate a brief, warm, strength-framed insight for a research
participant based on their wellbeing data. Never use clinical or diagnostic
language. Focus on patterns, strengths, and gentle suggestions. Keep it
under 100 words. Always end with an encouraging, actionable takeaway.
```

#### Researcher Summaries

- **Framing**: Technical, precise, hypothesis-generating
- **Constraints**: Include effect sizes, confidence intervals, caveats, and suggested follow-up analyses
- **Example output**: "Cross-lagged analysis (RI-CLPM, N=1893, 4 waves) indicates a significant within-person effect of purpose in life on subsequent chronic condition count (beta=-0.09, p=0.02), with no significant reverse path (beta=-0.05, p=0.21). Model fit was excellent (CFI=0.98, RMSEA=0.03). The between-person correlation (r=-0.34) suggests stable trait-level associations may partially account for previously reported cross-sectional findings. Recommended follow-up: test moderation by age cohort and APOE status."

#### Policy Summaries

- **Framing**: Plain language with population-level implications
- **Constraints**: Use aggregated data only, include uncertainty ranges, tie to actionable policy levers
- **Example output**: "In this cohort of 3,842 adults aged 50-85, those with the highest sense of purpose had a 38% lower risk of developing dementia over 15 years compared to those with the lowest purpose (HR=0.62, 95% CI: 0.49-0.78). Purpose-building programs may represent a scalable, low-cost intervention for dementia prevention."

### API Configuration

| Parameter | Value |
|-----------|-------|
| Model | `claude-sonnet-4-20250514` (default), `claude-opus-4-20250514` (complex analyses) |
| Max tokens | 500 (participant), 1000 (researcher), 750 (policy) |
| Temperature | 0.3 (participant), 0.1 (researcher), 0.2 (policy) |
| Rate limit | 100 requests/minute (platform-wide) |
| Retry strategy | Exponential backoff, 3 retries, 60s max wait |
| Caching | 1-hour cache for identical input hashes |
| Fallback | Pre-written template strings if API unavailable |

### Content Safety

All Claude-generated content passes through a validation layer before delivery:

1. **Diagnostic language filter**: Rejects outputs containing clinical diagnostic terms (e.g., "you have depression", "dementia diagnosis") in participant-facing content.
2. **Accuracy check**: Verifies that cited numbers in the output match the input data within rounding tolerance.
3. **Tone check**: Ensures participant content scores above threshold on positive-framing rubric.
4. **Length check**: Enforces maximum word counts per audience type.
5. **Logging**: All prompts, responses, and validation results are logged for audit trail (with participant data redacted in logs).

### Cost Management

- Participant insights are generated on-demand (triggered by dashboard load) and cached for 1 hour.
- Researcher and policy summaries are generated on analysis completion and cached until underlying data changes.
- Monthly cost monitoring with alerting at 80% of budget threshold.
- Batch generation during off-peak hours for non-time-sensitive summaries.
