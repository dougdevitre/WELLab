# Model Card: EmotionCouplingAnalyzer

## Model Details

| Field | Value |
|---|---|
| **Model Name** | EmotionCouplingAnalyzer |
| **Version** | 1.0.0 |
| **Date** | 2026-04-05 |
| **Type** | Random Forest classifier + rolling-window RMSSD volatility estimator |
| **Framework** | scikit-learn (StandardScaler, LinearRegression); NumPy; pandas |
| **Owner** | WELLab, Washington University |
| **Contact** | WELLab Principal Investigator |
| **License** | Research use only under IRB-approved protocol |

### Description

The EmotionCouplingAnalyzer implements the Intra- and Inter-individual Dynamical
Emotion Linkage System (IDELS) coupling analysis for the WELLab platform. It
ingests time-series affect data from Ecological Momentary Assessment (EMA),
fits per-dyad or per-participant coupling models, and classifies each
relationship into one of four IDELS coupling types: **positive**, **negative**,
**decoupled**, or **complex**.

The model operates in two stages:

1. **Coupling classification.** Pearson correlation between positive and negative
   affect time series is computed per participant. Absolute correlation values
   above the configured threshold indicate coupling. A nonlinearity test
   (quadratic R-squared improvement over linear) distinguishes complex from
   simple coupling patterns.

2. **Volatility estimation.** A rolling-window standard deviation is computed
   over the affect time series to quantify emotional volatility (RMSSD proxy).

### Architecture

- Affect scores are z-standardized using `sklearn.preprocessing.StandardScaler`.
- Per-participant Pearson correlation serves as the first-pass coupling metric.
- A quadratic vs. linear R-squared improvement ratio detects nonlinearity and
  triggers the "complex" classification when the improvement exceeds 0.30.
- Rolling-window standard deviation (window size configurable) provides the
  volatility measure.

---

## Intended Use

### Primary Use Cases

- Classify emotion-life satisfaction coupling patterns in EMA data for
  wellbeing research conducted under IRB-approved protocols.
- Quantify within-person emotional volatility over time to study affective
  dynamics in longitudinal wellbeing studies.
- Support research on dyadic emotion linkage in couples, families, or
  social-network studies.
- Generate coupling-type features for downstream statistical models (e.g.,
  predicting life satisfaction from coupling patterns).

### Intended Users

- WELLab researchers and approved collaborators operating under IRB protocol.
- Graduate research assistants trained in affective science methodology.
- Data analysts supporting WELLab studies with appropriate data access
  authorization.

---

## Out-of-Scope Use

The following uses are explicitly **not supported** and are prohibited under
the WELLab ethics framework:

- **Clinical diagnosis.** Coupling classifications must not be used to diagnose
  mood disorders, affective dysregulation, or any clinical condition.
- **Treatment decisions.** Output from this model must not inform clinical
  treatment plans, medication adjustments, or therapeutic interventions.
- **Individual risk notification without clinician review.** Participants must
  not receive automated alerts or risk flags based solely on coupling or
  volatility outputs without review by a licensed clinician.
- **Employment or insurance decisions.** No output from this model may be used
  in hiring, insurance underwriting, or any non-research context.
- **Real-time intervention triggering.** The model is not validated for
  just-in-time adaptive interventions without additional clinical validation.

---

## Training Data

### Expected Data Characteristics

| Characteristic | Specification |
|---|---|
| **Data source** | Ecological Momentary Assessment (EMA) |
| **Sampling frequency** | 5-8 prompts per day |
| **Positive affect scale** | 1-5 Likert scale |
| **Negative affect scale** | 1-5 Likert scale |
| **Life satisfaction scale** | 1-7 Likert scale |
| **Minimum observations per participant** | 20 (for stable coupling estimates) |
| **Recommended observations per participant** | 50+ (for reliable classification) |

### Input Schema

The model expects a pandas DataFrame with the following columns:

| Column | Type | Description |
|---|---|---|
| `participant_id` | object (string) | Unique participant identifier |
| `time` | float64 | Measurement occasion (timestamp or index) |
| `positive_affect` | float64 | Positive affect rating |
| `negative_affect` | float64 | Negative affect rating |

### Data Preprocessing

- Affect scores are z-standardized within the dataset using `StandardScaler`.
- Missing values must be handled prior to model input; the model does not
  impute missing data.
- Participants with fewer than 3 observations are automatically classified
  as "decoupled" (insufficient data).

---

## Evaluation Data

- Evaluation uses within-sample cross-validation with a minimum of 20
  observations per participant to ensure stable coupling estimates.
- Coupling classification stability is assessed by split-half reliability:
  the first and second halves of each participant's time series should yield
  the same coupling type at a rate exceeding 80%.
- The nonlinearity threshold (0.30) is validated against simulated data with
  known coupling structures.

---

## Metrics

### Primary Metrics

| Metric | Description | Target |
|---|---|---|
| **Coupling classification accuracy** | Agreement between model classification and ground-truth coupling type (from simulated or expert-labeled data) | >= 85% |
| **Volatility RMSSD** | Rolling standard deviation of affect time series; validated against known-volatility simulations | Correlation with true volatility >= 0.90 |
| **False alarm rate for risk flags** | Proportion of "complex" or high-volatility flags that are false positives | <= 10% |
| **Split-half reliability** | Consistency of coupling classification across halves of the time series | >= 0.80 |
| **Nonlinearity detection sensitivity** | Ability to detect true nonlinear coupling when present | >= 0.75 |
| **Nonlinearity detection specificity** | Ability to correctly classify linear coupling as non-complex | >= 0.85 |

### Secondary Metrics

- Per-coupling-type precision and recall.
- Calibration of coupling confidence scores by demographic group.
- Volatility estimate stability as a function of window size.

---

## Ethical Considerations

### Sensitivity of Emotion Data

Emotion data collected via EMA is inherently sensitive. Participants may
disclose information about their affective states that could, if mishandled,
lead to stigmatization, discrimination, or psychological harm.

### Strength-Based Interpretation

Coupling classifications must be interpreted through a strength-based lens:

- **"Decoupled" does not mean "unhealthy."** Emotional independence can be
  adaptive in many cultural contexts.
- **"Complex" does not mean "disordered."** Nonlinear emotion dynamics may
  reflect healthy emotional flexibility.
- **"Negative coupling" does not mean "negative emotions."** It indicates
  that partners' emotions move in opposite directions, which may be
  functional in some relationship contexts.

### Prohibited Labeling

- Participants must never be labeled as "emotionally unstable," "at risk,"
  or "disordered" based solely on coupling or volatility classifications.
- All participant-facing language must be reviewed by the ethics committee
  before deployment.

### Informed Consent

- Participants must consent to AI processing of their emotion data (per
  WELLab ethics framework Section 2).
- Every AI-generated insight includes a "How we computed this" expandable
  section explaining the coupling analysis in plain language.
- Participants may opt out of the emotional dynamics module while continuing
  to participate in other WELLab modules (granular consent).

### Data Protection

- Individual coupling classifications are visible only to the participant
  and authorized researchers under the IRB protocol.
- Population-level aggregations enforce k-anonymity (k >= 10).
- All predictions are logged with model version, input hash, output, and
  timestamp; logs are retained for 7 years.

---

## Caveats and Recommendations

### Known Limitations

1. **Coupling estimates are unstable with fewer than 20 observations.**
   Pearson correlations computed on short time series have wide confidence
   intervals. The model automatically classifies participants with fewer
   than 3 observations as "decoupled," but estimates from 3-19 observations
   should be interpreted with extreme caution.

2. **Cultural variation in emotional expression affects generalizability.**
   Affect scales may carry different meanings across cultural groups.
   Dialectical emotional styles (e.g., co-occurrence of positive and
   negative affect common in East Asian populations) may be misclassified
   as "complex" when they represent normative emotional experience.

3. **Self-report bias in EMA.** Participants may underreport negative affect
   due to social desirability, especially in collectivist cultural contexts.
   This can attenuate coupling estimates.

4. **The nonlinearity test is a heuristic.** The quadratic R-squared
   improvement threshold of 0.30 is a rough approximation. A proper BDS
   or RESET test should be implemented before production deployment (noted
   as a TODO in the codebase).

5. **Coupling classification is correlational, not causal.** "Positive
   coupling" does not imply that one partner's emotions cause the other's.

6. **Time-invariant coupling assumption.** The current implementation
   computes a single coupling type per participant across the entire time
   series. Coupling may change over time; a time-varying parameter model
   (e.g., TV-VAR or DCC) is planned but not yet implemented.

### Recommendations

- Always report coupling classifications alongside confidence intervals or
  bootstrap-derived uncertainty estimates.
- Verify cross-cultural measurement invariance before comparing coupling
  patterns across culture_group.
- Use a minimum of 50 observations per participant for publishable results.
- Supplement coupling classification with qualitative data when possible.

---

## Fairness Considerations

### Audit Requirements

Before deployment and on an ongoing monthly basis, the EmotionCouplingAnalyzer
must pass fairness audits across the following demographic groups:

| Demographic Attribute | Source |
|---|---|
| sex | Participant demographics |
| ethnicity | Participant demographics |
| culture_group | Participant demographics |
| age_band | Derived from date of birth |

### Fairness Criteria

1. **Demographic Parity.** The positive prediction rate for each coupling type
   must not differ by more than 5 percentage points across demographic groups
   (per WELLab ethics framework Section 3).

2. **Disparate Impact (4/5ths Rule).** The selection rate for any coupling
   classification in any demographic group must be at least 80% of the
   highest group's rate. If the disparate impact ratio falls below 0.80,
   the model must be retrained with data augmentation or re-weighting.

3. **Calibration Audit.** Model probabilities (when available) must be
   well-calibrated within each demographic group, assessed via Brier score
   decomposition.

4. **Representation Check.** Training data must include at least 30
   participants per demographic group. Under-represented groups are flagged,
   and model outputs for those groups carry uncertainty warnings.

### Remediation Protocol

If bias is detected during any audit:

1. The model is **quarantined** -- outputs are suppressed for affected groups.
2. Root cause analysis is conducted (data imbalance, scale bias, etc.).
3. Data augmentation or re-weighting is applied.
4. The model is retrained and re-audited.
5. Remediation is documented in the audit trail with before/after metrics.
6. The PI and ethics committee member review and approve re-deployment.

### Ongoing Monitoring

- Monthly automated fairness audit via `scripts/fairness_audit.py`.
- Quarterly human review of audit reports by PI and ethics committee member.
- All fairness audit results are logged and retained for 7 years.

---

## Quantitative Analyses

### Expected Confusion Matrix for Coupling Types

|  | Predicted: Positive | Predicted: Negative | Predicted: Decoupled | Predicted: Complex |
|---|---|---|---|---|
| **Actual: Positive** | High | Low | Low | Low |
| **Actual: Negative** | Low | High | Low | Low |
| **Actual: Decoupled** | Low | Low | High | Low |
| **Actual: Complex** | Low | Low | Moderate | Moderate-High |

Note: "Complex" coupling is the most difficult to classify and may be
confused with "decoupled" when nonlinearity is subtle. The nonlinearity
threshold of 0.30 should be validated against expert-labeled data.

### Calibration by Demographic Group

- Calibration curves should be generated for each demographic group (sex,
  ethnicity, culture_group, age_band) to verify that coupling classifications
  are equally reliable across populations.
- Expected calibration error (ECE) should be below 0.10 for each group.
- Groups with ECE exceeding 0.10 are flagged for model adjustment.

### Volatility Estimates

- Volatility (rolling SD) should correlate with true emotional variability
  at r >= 0.90 in simulation studies.
- Volatility estimates should be stable across window sizes of 3-7 for
  datasets with 50+ observations per participant.

---

## Configuration Parameters

All parameters are defined in `src/ml/config.py` and can be overridden via
environment variables (prefix `WELLAB_ML_`) or a YAML configuration file.

| Parameter | Default Value | Description |
|---|---|---|
| `RANDOM_SEED` | 42 | Global random seed for reproducibility across all stochastic operations |
| `EMOTION_COUPLING_TYPES` | ["positive", "negative", "decoupled", "complex"] | The four IDELS coupling classifications |
| `EMOTION_VOLATILITY_WINDOW` | 5 | Rolling-window size (in measurement occasions) for volatility estimation |
| `EMOTION_COUPLING_THRESHOLD` | 0.30 | Absolute Pearson correlation value above which a participant is considered coupled |
| `FAIRNESS_PARAMS.demographic_parity_tolerance` | 0.05 | Maximum allowable difference in positive prediction rate across demographic groups |
| `FAIRNESS_PARAMS.disparate_impact_floor` | 0.80 | Minimum disparate impact ratio (4/5ths rule); model retrained if ratio falls below this |

### Environment Variable Overrides

Parameters can be overridden at runtime using environment variables with the
`WELLAB_ML_` prefix. Nested keys use double underscores. Examples:

```bash
export WELLAB_ML_EMOTION_VOLATILITY_WINDOW=7
export WELLAB_ML_FAIRNESS__DISPARATE_IMPACT_FLOOR=0.85
```

---

## Serialization and Reproducibility

### Model Artifacts

- Models are serialized using `joblib.dump` with full metadata including:
  model version, training timestamp, configuration parameters, and feature
  names.
- Artifact files are stored in S3 with version IDs.
- Training data snapshots are stored alongside model artifacts.

### Reproducibility

- All stochastic operations use `RANDOM_SEED = 42` via
  `utils.set_reproducible_seed()`.
- NumPy and scikit-learn seeds are set deterministically.
- Hardware-specific non-determinism (GPU vs. CPU) is documented.
- Every training run is logged: hyperparameters, data snapshot ID, metrics,
  seed, and duration.

---

## Version History

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0.0 | 2026-04-05 | WELLab ML Team | Initial model card. Documents EmotionCouplingAnalyzer v1.0.0 with IDELS coupling classification, rolling-window volatility, fairness audit requirements, and configuration parameters. |

---

*This model card follows the format proposed by Mitchell et al. (2019),
"Model Cards for Model Reporting." It is intended for IRB review and
research transparency purposes.*
