# AI Modules — Full Specifications

> WELLab AI-Enabled Research & Impact Platform
> Washington University in St. Louis

This document provides complete specifications for the four core AI modules that power the WELLab platform. Each module maps to a distinct research domain and operates as an independent microservice with shared data model access.

---

## Table of Contents

1. [Real-Time Emotional Dynamics Engine](#1-real-time-emotional-dynamics-engine)
2. [Behavioral + Physiological Health Engine](#2-behavioral--physiological-health-engine)
3. [Lifespan Trajectory Engine](#3-lifespan-trajectory-engine)
4. [Cognitive Health & Dementia Prevention Engine](#4-cognitive-health--dementia-prevention-engine)

---

## 1. Real-Time Emotional Dynamics Engine

### Overview

The Real-Time Emotional Dynamics Engine captures and models short-term fluctuations in wellbeing through Ecological Momentary Assessment (EMA) and experience sampling methods. It implements the Intraindividual Dynamics of Emotion and Life Satisfaction (IDELS) framework to classify how momentary emotions couple with life satisfaction judgments at the within-person level.

### Key Capabilities

- **EMA / Experience Sampling**: Configurable sampling schedules (signal-contingent, interval-contingent, event-contingent) delivered via mobile push notifications. Supports 3-7 daily prompts with randomized timing windows.
- **IDELS Emotion-Coupling Classification**: Classifies each participant into one of four coupling types based on how momentary positive/negative affect relates to momentary life satisfaction:
  - **Positive coupling**: Higher positive affect strongly predicts higher life satisfaction (and vice versa for negative affect)
  - **Negative coupling**: Counter-normative pattern where negative affect associates with higher satisfaction (rare, context-dependent)
  - **Decoupled**: Emotion and satisfaction operate independently — satisfaction is stable regardless of affect fluctuations
  - **Complex**: Non-linear or time-varying coupling that does not fit a single classification
- **Volatility Scoring**: Computes within-person variability metrics including MSSD (mean squared successive differences), coefficient of variation, and intraindividual standard deviation across affect and satisfaction time series.
- **Real-Time Alerting**: Flags participants whose volatility exceeds configurable thresholds for researcher review (never automated intervention without human oversight).

### Data Inputs

| Input | Source | Format |
|-------|--------|--------|
| EMA responses | Mobile app (React Native) | JSON payloads via REST API |
| Sampling schedule | Researcher configuration | Cron-like schedule definition |
| Participant metadata | Registration / consent flow | Participant entity in DynamoDB |
| Historical observations | DynamoDB Observations table | Time-indexed affect + satisfaction ratings |

### Data Outputs

| Output | Destination | Format |
|--------|-------------|--------|
| Processed EMA observation | DynamoDB Observations table | Standardized observation record |
| Coupling classification | DynamoDB participant profile | Enum: positive / negative / decoupled / complex |
| Volatility scores | DynamoDB computed metrics | Numeric indices per participant per window |
| Alerts | Researcher Dashboard + SNS | Alert object with participant ID, metric, threshold |
| Trend summaries | Participant Experience UI | Natural language summary via Claude API |

### Models Used

| Model | Library | Purpose |
|-------|---------|---------|
| Multilevel / mixed-effects regression | `statsmodels` (MixedLM) | Within-person emotion-satisfaction coupling estimation |
| Dynamic Structural Equation Modeling (DSEM) | `PyTorch` (custom) | Time-varying coupling parameters |
| K-means + silhouette analysis | `scikit-learn` | Coupling type clustering from person-level coefficients |
| ARIMA / state-space models | `statsmodels` | Volatility and trend decomposition |
| Claude API (claude-sonnet-4-20250514) | `anthropic` SDK | Natural language insight generation for participants |

### API Endpoints

#### `POST /api/v1/ema/observations`

Submit a new EMA observation.

**Auth**: Participant JWT (Cognito)

**Request body**:
```json
{
  "participant_id": "P-20250401-0042",
  "timestamp": "2026-04-05T14:32:00Z",
  "positive_affect": 3.8,
  "negative_affect": 1.2,
  "life_satisfaction": 4.1,
  "context": {
    "activity": "working",
    "social": "alone",
    "location_type": "home"
  },
  "sampling_type": "signal_contingent"
}
```

**Response** (201 Created):
```json
{
  "observation_id": "OBS-20260405-143200-P0042",
  "status": "recorded",
  "next_prompt_at": "2026-04-05T17:15:00Z"
}
```

#### `GET /api/v1/ema/participants/{participant_id}/coupling`

Retrieve coupling classification for a participant.

**Auth**: Researcher JWT (Cognito)

**Response** (200 OK):
```json
{
  "participant_id": "P-20250401-0042",
  "coupling_type": "positive",
  "confidence": 0.87,
  "coefficients": {
    "pa_to_ls": 0.42,
    "na_to_ls": -0.31
  },
  "n_observations": 284,
  "window": {
    "start": "2026-01-15",
    "end": "2026-04-05"
  },
  "model_version": "idels-coupling-v2.1.0"
}
```

#### `GET /api/v1/ema/participants/{participant_id}/volatility`

Retrieve volatility scores.

**Auth**: Researcher JWT (Cognito)

**Response** (200 OK):
```json
{
  "participant_id": "P-20250401-0042",
  "window_days": 30,
  "metrics": {
    "pa_mssd": 1.24,
    "na_mssd": 0.87,
    "ls_mssd": 0.56,
    "pa_isd": 0.92,
    "na_isd": 0.71,
    "ls_isd": 0.48,
    "pa_cv": 0.23,
    "na_cv": 0.34,
    "ls_cv": 0.11
  },
  "alerts": [],
  "computed_at": "2026-04-05T12:00:00Z"
}
```

#### `GET /api/v1/ema/schedule/{participant_id}`

Get current sampling schedule for a participant.

**Auth**: Participant or Researcher JWT

#### `PUT /api/v1/ema/schedule/{participant_id}`

Update sampling schedule (researcher only).

**Auth**: Researcher JWT

---

## 2. Behavioral + Physiological Health Engine

### Overview

The Behavioral + Physiological Health Engine models the bidirectional relationship between psychological wellbeing and physical health outcomes. It uses causal inference techniques to move beyond correlation and identify directional effects: does wellbeing improve health, does health improve wellbeing, or both? This module supports both cross-sectional analysis and longitudinal tracking across years of data.

### Key Capabilities

- **Causal Inference with DoWhy**: Builds causal directed acyclic graphs (DAGs) from domain knowledge, identifies valid adjustment sets, and estimates average treatment effects (ATE) and conditional average treatment effects (CATE) using multiple estimators (backdoor, instrumental variable, frontdoor).
- **Longitudinal Regression**: Mixed-effects models with time-varying covariates tracking wellbeing and health metrics over months to years. Handles irregular measurement intervals and missing data via FIML.
- **Bidirectional Analysis**: Implements cross-lagged panel models and Granger causality tests to assess directionality between wellbeing constructs (life satisfaction, purpose, positive affect) and health outcomes (chronic conditions, biomarkers, functional limitations).
- **Intervention Effect Estimation**: Estimates the expected health impact of wellbeing-targeted interventions using counterfactual reasoning.

### Data Inputs

| Input | Source | Format |
|-------|--------|--------|
| Wellbeing assessments | EMA module + periodic surveys | Standardized scale scores |
| Health records | Clinical data imports, self-report | HealthRecord entities |
| Biomarkers | Lab results, wearables (Phase 2) | Numeric values with reference ranges |
| Demographics | Enrollment | Age, sex, race/ethnicity, SES indicators |
| Behavioral data | Activity logs, sleep, exercise | Structured daily summaries |

### Data Outputs

| Output | Destination | Format |
|--------|-------------|--------|
| Causal effect estimates | Researcher Dashboard | ATE/CATE with confidence intervals |
| DAG visualizations | Researcher Dashboard | JSON graph structure for D3 rendering |
| Longitudinal trajectories | Researcher Dashboard + Policy Dashboard | Time series with model fits |
| Intervention simulations | Policy Dashboard | Counterfactual projections |
| Health-wellbeing reports | Participant Experience UI | Strength-framed natural language summaries |

### Models Used

| Model | Library | Purpose |
|-------|---------|---------|
| Causal DAG + effect estimation | `DoWhy` | Causal inference from observational data |
| Mixed-effects regression | `statsmodels` (MixedLM) | Longitudinal wellbeing-health associations |
| Cross-lagged panel models | `lavaan` (via `rpy2`) / `semopy` | Bidirectional temporal effects |
| Granger causality | `statsmodels` | Time-series directionality testing |
| Random forests (CATE) | `econml` (EconML) | Heterogeneous treatment effect estimation |
| Claude API | `anthropic` SDK | Narrative generation for health-wellbeing reports |

### API Endpoints

#### `POST /api/v1/health/causal-analysis`

Run a causal analysis between a wellbeing exposure and health outcome.

**Auth**: Researcher JWT

**Request body**:
```json
{
  "exposure": "life_satisfaction",
  "outcome": "chronic_condition_count",
  "covariates": ["age", "sex", "education", "income", "baseline_health"],
  "cohort_filter": {
    "age_range": [40, 75],
    "min_observations": 3
  },
  "estimators": ["backdoor.linear_regression", "backdoor.propensity_score_matching"],
  "refutation_tests": ["random_common_cause", "placebo_treatment", "data_subset"]
}
```

**Response** (200 OK):
```json
{
  "analysis_id": "CA-20260405-001",
  "exposure": "life_satisfaction",
  "outcome": "chronic_condition_count",
  "results": {
    "backdoor.linear_regression": {
      "ate": -0.34,
      "ci_lower": -0.51,
      "ci_upper": -0.17,
      "p_value": 0.0001
    },
    "backdoor.propensity_score_matching": {
      "ate": -0.29,
      "ci_lower": -0.48,
      "ci_upper": -0.10,
      "p_value": 0.003
    }
  },
  "refutations": {
    "random_common_cause": { "passed": true, "new_effect": -0.33 },
    "placebo_treatment": { "passed": true, "new_effect": 0.02 },
    "data_subset": { "passed": true, "new_effect": -0.31 }
  },
  "dag": {
    "nodes": ["life_satisfaction", "chronic_condition_count", "age", "sex", "education", "income", "baseline_health"],
    "edges": [
      { "from": "life_satisfaction", "to": "chronic_condition_count" },
      { "from": "age", "to": "life_satisfaction" },
      { "from": "age", "to": "chronic_condition_count" }
    ]
  },
  "n_participants": 1247,
  "model_version": "health-causal-v1.3.0"
}
```

#### `GET /api/v1/health/longitudinal/{participant_id}`

Retrieve longitudinal health-wellbeing trajectory for a participant.

**Auth**: Researcher JWT

#### `POST /api/v1/health/intervention-simulation`

Simulate the health impact of a hypothetical wellbeing intervention.

**Auth**: Researcher JWT

**Request body**:
```json
{
  "intervention": {
    "target": "life_satisfaction",
    "effect_size": 0.5,
    "duration_months": 12
  },
  "population_filter": {
    "age_range": [50, 70],
    "baseline_health": "fair_or_poor"
  },
  "outcomes": ["chronic_condition_count", "functional_limitations", "self_rated_health"]
}
```

#### `GET /api/v1/health/bidirectional-summary`

Retrieve summary of bidirectional wellbeing-health effects across cohorts.

**Auth**: Researcher or Policy JWT

---

## 3. Lifespan Trajectory Engine

### Overview

The Lifespan Trajectory Engine models long-term patterns of wellbeing change across the adult lifespan. It uses growth curve modeling to estimate individual and population-level trajectories, applies clustering algorithms to identify distinct trajectory archetypes (e.g., stable high, late-life decline, midlife recovery), and supports cross-cultural comparisons using harmonized datasets from multiple countries.

### Key Capabilities

- **Growth Curve Modeling**: Latent growth curve models (LGCM) and multilevel growth models that estimate intercepts (baseline wellbeing) and slopes (rate of change) for individuals and groups. Supports linear, quadratic, and piecewise specifications.
- **Trajectory Archetypes / Clustering**: Group-based trajectory modeling (GBTM) and growth mixture modeling (GMM) to identify subpopulations following distinct wellbeing paths across the lifespan. Automatic model selection via BIC/AIC and entropy.
- **Cross-Cultural Comparison**: Harmonized analysis across datasets from different countries (e.g., HRS, SHARE, ELSA, CHARLS). Measurement invariance testing ensures constructs are comparable before pooling.
- **Age-Period-Cohort Decomposition**: Separates aging effects from historical period effects and birth cohort differences in wellbeing trends.

### Data Inputs

| Input | Source | Format |
|-------|--------|--------|
| Lifespan assessments | Periodic surveys (annual/biennial) | LifespanAssessment entities |
| Wellbeing measures | Validated scales (SWLS, PWB, PANAS) | Standardized scores |
| Demographics | Enrollment + updates | Age, sex, race/ethnicity, education, country |
| Cross-cultural datasets | Harmonized imports (HRS, SHARE, etc.) | CSV/Parquet with harmonization metadata |

### Data Outputs

| Output | Destination | Format |
|--------|-------------|--------|
| Individual growth parameters | DynamoDB + Researcher Dashboard | Intercept, slope, quadratic terms |
| Trajectory cluster assignments | DynamoDB + Researcher Dashboard | Cluster ID + posterior probability |
| Population trajectory curves | Policy Dashboard | Aggregated curves with confidence bands |
| Cross-cultural comparison reports | Researcher + Policy Dashboard | Country-level trajectory comparisons |
| Participant lifespan summary | Participant Experience UI | Strength-framed trajectory narrative |

### Models Used

| Model | Library | Purpose |
|-------|---------|---------|
| Latent growth curve models | `lavaan` (via `rpy2`) / `semopy` | Individual trajectory estimation |
| Growth mixture models | `scikit-learn` (GMM) + custom | Trajectory archetype identification |
| Group-based trajectory modeling | Custom PyTorch implementation | Discrete trajectory group assignment |
| Hierarchical linear models | `statsmodels` (MixedLM) | Nested data (persons within countries) |
| Measurement invariance | `semopy` / `lavaan` | Cross-cultural construct equivalence |
| Claude API | `anthropic` SDK | Natural language trajectory summaries |

### API Endpoints

#### `GET /api/v1/lifespan/trajectories/{participant_id}`

Retrieve growth curve parameters and cluster assignment for a participant.

**Auth**: Researcher JWT

**Response** (200 OK):
```json
{
  "participant_id": "P-20250401-0042",
  "growth_curve": {
    "model": "quadratic",
    "intercept": 4.12,
    "linear_slope": -0.02,
    "quadratic": 0.001,
    "intercept_se": 0.15,
    "linear_slope_se": 0.008,
    "quadratic_se": 0.0003
  },
  "cluster": {
    "id": 2,
    "label": "stable_high",
    "posterior_probability": 0.91,
    "description": "Consistently high wellbeing with minimal age-related decline"
  },
  "assessments_used": 8,
  "age_range": [42, 56],
  "model_version": "lifespan-trajectory-v2.0.0"
}
```

#### `GET /api/v1/lifespan/clusters`

Retrieve all trajectory archetypes with population distribution.

**Auth**: Researcher or Policy JWT

**Response** (200 OK):
```json
{
  "model_version": "lifespan-trajectory-v2.0.0",
  "n_clusters": 4,
  "clusters": [
    {
      "id": 1,
      "label": "late_life_decline",
      "prevalence": 0.22,
      "mean_intercept": 3.85,
      "mean_slope": -0.08,
      "description": "Moderate baseline wellbeing with accelerating decline after age 70"
    },
    {
      "id": 2,
      "label": "stable_high",
      "prevalence": 0.35,
      "mean_intercept": 4.30,
      "mean_slope": -0.01,
      "description": "Consistently high wellbeing with minimal age-related decline"
    },
    {
      "id": 3,
      "label": "midlife_recovery",
      "prevalence": 0.18,
      "mean_intercept": 3.20,
      "mean_slope": 0.04,
      "description": "Lower baseline with steady improvement through middle adulthood"
    },
    {
      "id": 4,
      "label": "chronic_low",
      "prevalence": 0.25,
      "mean_intercept": 2.60,
      "mean_slope": -0.03,
      "description": "Persistently low wellbeing with gradual decline"
    }
  ],
  "model_fit": {
    "bic": 12450.3,
    "aic": 12380.1,
    "entropy": 0.84
  }
}
```

#### `POST /api/v1/lifespan/cross-cultural`

Run a cross-cultural trajectory comparison.

**Auth**: Researcher JWT

**Request body**:
```json
{
  "datasets": ["HRS", "SHARE", "ELSA"],
  "wellbeing_measure": "life_satisfaction",
  "age_range": [50, 85],
  "covariates": ["sex", "education"],
  "invariance_test": true
}
```

#### `GET /api/v1/lifespan/population-curves`

Retrieve population-level trajectory curves for the Policy Dashboard.

**Auth**: Policy JWT

---

## 4. Cognitive Health & Dementia Prevention Engine

### Overview

The Cognitive Health & Dementia Prevention Engine links wellbeing factors to cognitive outcomes and Alzheimer's Disease and Related Dementias (ADRD) risk. It uses survival analysis to model time-to-cognitive-decline, builds multi-factor risk stratification scores, and identifies protective factors (e.g., purpose in life, social engagement, positive affect) that may delay or prevent dementia onset.

### Key Capabilities

- **Survival Analysis**: Cox proportional hazards models and accelerated failure time models estimating the association between wellbeing factors and time to cognitive impairment or dementia diagnosis. Handles competing risks (death before dementia).
- **Risk Stratification**: Multi-factor risk scoring combining demographic, genetic (APOE status where available), lifestyle, and wellbeing predictors into a composite ADRD risk index. Calibrated to population-level incidence rates.
- **Protective Factor Identification**: Uses variable importance methods (SHAP, permutation importance) and causal inference to rank wellbeing factors by their protective effect magnitude. Distinguishes modifiable from non-modifiable factors.
- **Cognitive Trajectory Tracking**: Monitors cognitive assessment scores (MoCA, MMSE, or custom batteries) over time, detects inflection points signaling accelerated decline, and generates early warning flags.

### Data Inputs

| Input | Source | Format |
|-------|--------|--------|
| Cognitive assessments | Neuropsych batteries, MoCA, MMSE | CognitiveAssessment entities |
| Wellbeing measures | EMA module + periodic surveys | Standardized scale scores |
| Health records | Clinical imports | Diagnoses, medications, biomarkers |
| Genetic data (optional) | Research genotyping | APOE allele status |
| Demographics | Enrollment | Age, sex, race/ethnicity, education |
| Social engagement metrics | Surveys, activity logs | Frequency/quality scores |

### Data Outputs

| Output | Destination | Format |
|--------|-------------|--------|
| ADRD risk score | DynamoDB + Researcher Dashboard | 0-100 composite index with component breakdown |
| Survival curves | Researcher Dashboard | Kaplan-Meier + Cox model predicted curves |
| Protective factor rankings | Researcher + Policy Dashboard | Ordered list with effect sizes and CIs |
| Cognitive trajectory + alerts | Researcher Dashboard | Time series with inflection detection |
| Prevention recommendations | Participant Experience UI | Strength-framed, modifiable-factor-focused |
| Population risk maps | Policy Dashboard | Aggregated risk distribution (k-anonymized) |

### Models Used

| Model | Library | Purpose |
|-------|---------|---------|
| Cox proportional hazards | `lifelines` | Time-to-event analysis for cognitive decline |
| Accelerated failure time | `lifelines` | Alternative survival parameterization |
| Competing risks (Fine-Gray) | `scikit-survival` | Accounting for death as competing risk |
| Gradient boosted survival | `scikit-survival` (GBS) | Non-linear risk stratification |
| SHAP values | `shap` | Protective factor importance ranking |
| Changepoint detection | `ruptures` | Cognitive trajectory inflection detection |
| Claude API | `anthropic` SDK | Prevention recommendation narratives |

### API Endpoints

#### `GET /api/v1/cognitive/risk/{participant_id}`

Retrieve ADRD risk stratification for a participant.

**Auth**: Researcher JWT

**Response** (200 OK):
```json
{
  "participant_id": "P-20250401-0042",
  "risk_score": 28,
  "risk_category": "low_moderate",
  "components": {
    "age_sex": { "score": 15, "weight": 0.25 },
    "education": { "score": 8, "weight": 0.10 },
    "apoe_status": { "score": null, "weight": 0.15, "note": "Not available" },
    "purpose_in_life": { "score": -12, "weight": 0.12, "direction": "protective" },
    "social_engagement": { "score": -8, "weight": 0.10, "direction": "protective" },
    "positive_affect": { "score": -5, "weight": 0.08, "direction": "protective" },
    "physical_activity": { "score": -3, "weight": 0.08, "direction": "protective" },
    "chronic_conditions": { "score": 10, "weight": 0.12 }
  },
  "modifiable_factors": [
    { "factor": "purpose_in_life", "current_percentile": 72, "potential_reduction": 5 },
    { "factor": "social_engagement", "current_percentile": 55, "potential_reduction": 4 },
    { "factor": "physical_activity", "current_percentile": 40, "potential_reduction": 6 }
  ],
  "confidence_interval": [22, 35],
  "model_version": "cognitive-risk-v1.5.0",
  "calibration_population": "HRS_2018_2024"
}
```

#### `GET /api/v1/cognitive/survival-curve`

Retrieve population or subgroup survival curves.

**Auth**: Researcher or Policy JWT

**Query params**: `stratify_by` (e.g., purpose_tertile), `age_range`, `cohort_filter`

**Response** (200 OK):
```json
{
  "strata": [
    {
      "label": "High purpose (top tertile)",
      "survival_probabilities": [
        { "year": 0, "probability": 1.0 },
        { "year": 5, "probability": 0.96 },
        { "year": 10, "probability": 0.89 },
        { "year": 15, "probability": 0.78 }
      ],
      "median_survival_years": null,
      "hazard_ratio": 0.62,
      "ci_lower": 0.49,
      "ci_upper": 0.78
    },
    {
      "label": "Low purpose (bottom tertile)",
      "survival_probabilities": [
        { "year": 0, "probability": 1.0 },
        { "year": 5, "probability": 0.91 },
        { "year": 10, "probability": 0.76 },
        { "year": 15, "probability": 0.58 }
      ],
      "median_survival_years": 18.3,
      "hazard_ratio": 1.0,
      "ci_lower": null,
      "ci_upper": null
    }
  ],
  "n_participants": 3842,
  "n_events": 412,
  "model_version": "cognitive-survival-v1.5.0"
}
```

#### `GET /api/v1/cognitive/protective-factors`

Retrieve ranked protective factors across the study population.

**Auth**: Researcher or Policy JWT

#### `GET /api/v1/cognitive/trajectory/{participant_id}`

Retrieve cognitive assessment trajectory with inflection detection.

**Auth**: Researcher JWT

#### `POST /api/v1/cognitive/population-risk-map`

Generate aggregated population risk distribution for the Policy Dashboard.

**Auth**: Policy JWT

**Request body**:
```json
{
  "aggregation": "county",
  "k_anonymity_threshold": 10,
  "risk_bins": [0, 25, 50, 75, 100],
  "demographic_stratification": ["age_group", "sex"]
}
```

---

## Cross-Module Integration

All four modules share the unified data model (see `references/data-model.md`) and can reference each other's outputs:

- The **Emotional Dynamics Engine** feeds volatility scores into the **Health Engine** as predictors.
- The **Health Engine** provides chronic condition counts to the **Cognitive Engine** for risk stratification.
- The **Lifespan Trajectory Engine** provides growth curve parameters that contextualize individual findings in the other three modules.
- The **Cognitive Engine** contributes ADRD risk scores back to the **Lifespan Engine** for trajectory prediction.

All inter-module data flows are logged in the audit trail and respect the same IRB and privacy constraints described in `references/ethics.md`.
