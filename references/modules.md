# AI Modules — Full Specifications

## 1. Real-Time Emotional Dynamics Engine

### Overview
Captures and models short-term wellbeing fluctuations using Experience Sampling Methods (ESM/EMA) and IDELS emotion-coupling analysis.

### Key Capabilities
- **Experience Sampling (EMA)**: Collects momentary affect, context, and behavior 5–8 times/day via mobile prompts
- **Emotion Coupling (IDELS)**: Classifies intra-individual emotion–life satisfaction coupling into 4 types: positive, negative, decoupled, complex
- **Volatility Scoring**: Computes within-person emotional variability (MSSD, RMSSD, coefficient of variation)
- **Real-Time Alerts**: Flags participants whose volatility exceeds 2 SD above their personal baseline

### Data Inputs
| Field | Type | Source |
|-------|------|--------|
| `participant_id` | string | Registration |
| `timestamp` | ISO 8601 | Device clock |
| `positive_affect` | float (1–5) | EMA prompt |
| `negative_affect` | float (1–5) | EMA prompt |
| `life_satisfaction` | float (1–7) | EMA prompt |
| `context` | enum | EMA prompt (work, home, social, transit, other) |
| `social_interaction` | boolean | EMA prompt |

### Data Outputs
| Field | Type | Description |
|-------|------|-------------|
| `coupling_type` | enum | positive, negative, decoupled, complex |
| `coupling_strength` | float (-1 to 1) | Pearson r of emotion–satisfaction |
| `volatility_index` | float | RMSSD of affect over rolling window |
| `trend_direction` | enum | improving, stable, declining |
| `risk_flag` | boolean | True if volatility > 2 SD above baseline |

### Models
- **Coupling Classifier**: Random Forest trained on lagged emotion–satisfaction pairs
- **Volatility Engine**: Rolling-window RMSSD with exponential weighting
- **Trend Detector**: Mann-Kendall trend test on 7-day windows

### API Endpoints
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/participants/:id/emotional-dynamics` | Current coupling & volatility for participant |
| POST | `/api/emotional-dynamics/analyze` | Run coupling analysis on submitted data |
| GET | `/api/emotional-dynamics/cohort/:cohortId` | Aggregated coupling distribution for cohort |

### Example Response
```json
{
  "participant_id": "P-001",
  "coupling_type": "positive",
  "coupling_strength": 0.62,
  "volatility_index": 0.34,
  "trend_direction": "improving",
  "risk_flag": false,
  "computed_at": "2026-03-15T14:30:00Z"
}
```

---

## 2. Behavioral & Physiological Health Engine

### Overview
Models bidirectional relationships between wellbeing and physical health using causal inference and longitudinal regression.

### Key Capabilities
- **Causal Inference**: DoWhy-based estimation of wellbeing → health and health → wellbeing effects
- **Longitudinal Regression**: Mixed-effects models tracking health–wellbeing co-trajectories
- **Bidirectional Analysis**: Cross-lagged panel models estimating reciprocal effects
- **Risk Prediction**: Health outcome risk scores conditional on wellbeing trajectory

### Data Inputs
| Field | Type | Source |
|-------|------|--------|
| `participant_id` | string | Registration |
| `assessment_date` | date | Clinical visit |
| `bmi` | float | Clinical |
| `blood_pressure_systolic` | int | Clinical |
| `blood_pressure_diastolic` | int | Clinical |
| `sleep_hours` | float | Self-report / wearable |
| `physical_activity_minutes` | int | Self-report / wearable |
| `chronic_conditions` | string[] | Medical record |
| `wellbeing_composite` | float | Computed from EMA |
| `medication_count` | int | Self-report |

### Data Outputs
| Field | Type | Description |
|-------|------|-------------|
| `causal_effect_wb_to_health` | float | ATE of wellbeing on health |
| `causal_effect_health_to_wb` | float | ATE of health on wellbeing |
| `confidence_interval` | [float, float] | 95% CI for effect estimate |
| `confounders_adjusted` | string[] | Variables controlled for |
| `health_risk_score` | float (0–1) | Composite health risk |

### Models
- **Causal Estimator**: DoWhy with backdoor criterion + linear regression estimand
- **Mixed-Effects Regression**: Random intercepts + slopes by participant
- **Cross-Lagged Panel Model**: Structural equation model with 2+ time lags

### API Endpoints
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/participants/:id/health-records` | Health record history |
| POST | `/api/health/causal-analysis` | Run causal inference on dataset |
| GET | `/api/health/bidirectional/:cohortId` | Cross-lagged results for cohort |

---

## 3. Lifespan Trajectory Engine

### Overview
Analyzes long-term wellbeing change across the lifespan using growth curve modeling, trajectory clustering, and cross-cultural comparison.

### Key Capabilities
- **Growth Curve Modeling**: Latent growth curves with linear, quadratic, and piecewise specifications
- **Trajectory Clustering**: GMM-based identification of distinct wellbeing trajectory archetypes
- **Cross-Cultural Comparison**: Measurement invariance testing across cultural groups
- **Turning Point Detection**: Change-point analysis for life events (retirement, bereavement, etc.)

### Data Inputs
| Field | Type | Source |
|-------|------|--------|
| `participant_id` | string | Registration |
| `assessment_wave` | int | Study design |
| `age_at_assessment` | float | Computed |
| `life_satisfaction` | float (1–7) | SWLS or single item |
| `eudaimonic_wellbeing` | float (1–7) | PWB subscales |
| `hedonic_wellbeing` | float (1–5) | PANAS or ESM aggregate |
| `culture_group` | string | Demographics |
| `major_life_events` | string[] | Interview / self-report |

### Data Outputs
| Field | Type | Description |
|-------|------|-------------|
| `trajectory_archetype` | string | e.g., "stable-high", "late-decline", "resilient-rebound" |
| `cluster_probability` | float | Posterior probability of cluster membership |
| `growth_parameters` | object | intercept, linear slope, quadratic term |
| `predicted_trajectory` | float[] | Predicted wellbeing values by age |
| `turning_points` | object[] | Detected change points with confidence |

### Models
- **Latent Growth Curve**: statsmodels mixed-effects with polynomial time terms
- **GMM Clustering**: sklearn GaussianMixture with BIC-based model selection
- **Change-Point Detection**: Bayesian online change-point detection

### API Endpoints
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/participants/:id/trajectory` | Individual trajectory + archetype |
| POST | `/api/lifespan/cluster-analysis` | Run clustering on cohort data |
| GET | `/api/lifespan/cross-cultural` | Cross-cultural comparison results |

---

## 4. Cognitive Health & Dementia Prevention Engine

### Overview
Models the intersection of wellbeing and cognitive health, with focus on ADRD risk stratification and protective factor identification.

### Key Capabilities
- **Risk Stratification**: Multi-factor cognitive decline risk scoring
- **Survival Analysis**: Time-to-event modeling for MCI/dementia onset
- **Protective Factor Identification**: Feature importance analysis for modifiable factors
- **Intervention Targeting**: Personalized recommendations based on risk profile

### Data Inputs
| Field | Type | Source |
|-------|------|--------|
| `participant_id` | string | Registration |
| `cognitive_score` | float | MoCA, MMSE, or composite |
| `cognitive_domain_scores` | object | Memory, executive, language, visuospatial |
| `apoe_status` | string | Genotyping (if consented) |
| `education_years` | int | Demographics |
| `social_engagement_score` | float | Self-report |
| `physical_activity_level` | string | Self-report |
| `wellbeing_composite` | float | Computed from modules 1–3 |
| `age` | float | Demographics |
| `diagnosis` | string | Clinical (normal, MCI, dementia) |

### Data Outputs
| Field | Type | Description |
|-------|------|-------------|
| `risk_score` | float (0–1) | Composite cognitive decline risk |
| `risk_category` | enum | low, moderate, high, very_high |
| `protective_factors` | object[] | Ranked modifiable factors |
| `survival_probability` | float[] | Kaplan-Meier curve values |
| `recommended_interventions` | string[] | Personalized suggestions |

### Models
- **Risk Classifier**: Gradient Boosted Trees (XGBoost) with SHAP explanations
- **Survival Model**: Cox proportional hazards via lifelines
- **Protective Factor Ranker**: Permutation importance + SHAP values

### API Endpoints
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/participants/:id/cognitive` | Cognitive assessment history + risk |
| POST | `/api/cognitive/risk-assessment` | Compute risk for participant data |
| GET | `/api/cognitive/protective-factors` | Population-level protective factor ranking |
