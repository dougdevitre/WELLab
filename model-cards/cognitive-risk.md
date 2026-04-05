# Model Card: CognitiveRiskModel

## Model Details

| Field | Value |
|---|---|
| **Model Name** | CognitiveRiskModel |
| **Version** | 1.0.0 |
| **Date** | 2026-04-05 |
| **Type** | Gradient Boosted Trees (classification) + Cox Proportional Hazards survival analysis |
| **Framework** | scikit-learn (GradientBoostingClassifier, cross_val_score, permutation_importance); lifelines (CoxPHFitter); pandas; NumPy |
| **Owner** | WELLab, Washington University |
| **Contact** | WELLab Principal Investigator |
| **License** | Research use only under IRB-approved protocol |
| **Risk Classification** | HIGH -- This model produces individual-level risk scores. Elevated data governance, fairness auditing, and access controls apply. |

### Description

The CognitiveRiskModel provides research-level cognitive decline risk
stratification and identification of modifiable protective factors. It
operates in three complementary modes:

1. **Risk classification.** A Gradient Boosted Trees classifier predicts
   the probability of cognitive decline (binary outcome) from a multivariate
   feature set. Participants exceeding a configurable risk threshold are
   flagged as high-risk for research purposes.

2. **Protective factor identification.** Permutation importance analysis
   identifies features whose removal most degrades prediction of cognitive
   decline. Features with negative permutation importance (i.e., their
   presence is associated with lower decline risk) are ranked as candidate
   protective factors.

3. **Survival analysis.** A Cox Proportional Hazards model estimates hazard
   ratios for covariates predicting time-to-cognitive-decline, enabling
   researchers to study both risk and protective factors in a time-to-event
   framework.

### Architecture

- **Gradient Boosted Trees:** `GradientBoostingClassifier` with configurable
  `n_estimators` (default: 100) and `max_depth` (default: 6). Probability
  outputs from `predict_proba` are used for risk scoring.
- **Risk threshold:** Participants with predicted probability >= 0.50
  (default) are flagged as high-risk.
- **Permutation importance:** Computed with 10 repeats using ROC-AUC as the
  scoring metric. Features with the most negative importance scores are
  identified as candidate protective factors.
- **Cox PH survival analysis:** Implemented via `lifelines.CoxPHFitter` when
  available. Estimates hazard ratios, concordance index, and model summary
  statistics.

---

## Intended Use

### Primary Use Cases

- Research-level cognitive decline risk stratification in longitudinal
  studies of aging and dementia prevention.
- Identification of modifiable protective factors (e.g., social engagement,
  physical activity, cognitive stimulation) that are associated with reduced
  cognitive decline risk.
- Survival analysis of time-to-cognitive-decline to study the temporal
  dynamics of risk and protective factors.
- Generation of risk scores as features for downstream research analyses
  (e.g., studying the relationship between wellbeing trajectories and
  cognitive resilience).

### Intended Users

- WELLab researchers with training in cognitive aging, neuropsychology,
  or dementia epidemiology.
- Biostatisticians and epidemiologists collaborating on cognitive health
  studies.
- Graduate research assistants operating under PI supervision with
  appropriate data access authorization and ethics training.

---

## Out-of-Scope Use

The following uses are explicitly **not supported** and are **strictly
prohibited**:

- **Individual clinical diagnosis of MCI or dementia.** Risk scores are
  population-level statistical estimates and must never be used to diagnose
  Mild Cognitive Impairment, Alzheimer's disease, or any form of dementia.
- **Replacing neuropsychological assessment.** The model does not replace
  standardized cognitive testing, clinical interviews, or neuroimaging.
- **Individual clinical decision-making.** Risk scores must not inform
  treatment decisions, medication prescriptions, or care planning for
  individual participants.
- **Direct participant notification of high-risk status.** Risk scores must
  never be communicated directly to participants without clinical context
  provided by a licensed clinician (see Ethical Considerations below).
- **Insurance, employment, or legal decisions.** Cognitive risk scores must
  never be used in actuarial calculations, disability determinations,
  employment screening, or legal proceedings.
- **Genetic risk communication.** If APOE status or other genetic variants
  are included as features, the model must not be used to communicate
  genetic risk to participants without genetic counseling (see APOE
  Handling below).

---

## Training Data

### Expected Data Characteristics

| Characteristic | Specification |
|---|---|
| **Data source** | Longitudinal cognitive aging studies (WELLab cohorts) |
| **Target variable** | `cognitive_decline` -- binary (0/1) indicator |
| **Features** | Demographic, lifestyle, health biomarker, cognitive test, and optionally genetic variables |
| **Sample size** | Minimum 200 participants recommended for stable GBT performance |
| **Class balance** | Cognitive decline is typically a minority class (10-30%); class imbalance handling may be required |
| **Follow-up duration** | At least 2 years for meaningful decline classification |

### Feature Categories

| Category | Example Features |
|---|---|
| **Demographics** | Age, sex, education years, ethnicity |
| **Lifestyle** | Physical activity level, social engagement score, diet quality |
| **Health biomarkers** | BMI, blood pressure, HbA1c, cholesterol, inflammatory markers |
| **Cognitive tests** | MMSE, MoCA, Trail Making Test, digit span, verbal fluency |
| **Psychological** | Depression score, anxiety score, wellbeing composite |
| **Genetic (optional)** | APOE genotype (requires explicit genetic consent) |

### Survival Analysis Data

For the Cox PH model, additional columns are required:

| Column | Type | Description |
|---|---|---|
| `years_to_event` | float64 | Time from baseline to cognitive decline event or censoring |
| `event_observed` | int (0/1) | Whether cognitive decline was observed (1) or censored (0) |

---

## Evaluation Data

- The GBT classifier is evaluated using 5-fold stratified cross-validation
  with ROC-AUC as the primary metric.
- The Cox PH model is evaluated using the concordance index (C-index).
- Both models are evaluated on held-out test sets that are stratified by
  demographic group to ensure fair performance assessment.
- Temporal validation is recommended: train on earlier waves, test on
  later waves to assess real-world generalization.

---

## Metrics

### Primary Metrics

| Metric | Description | Expected Range | Target |
|---|---|---|---|
| **ROC-AUC** | Area under the receiver operating characteristic curve | 0.70-0.85 | >= 0.75 |
| **Sensitivity (at default threshold)** | True positive rate for cognitive decline | 0.60-0.80 | >= 0.70 |
| **Specificity (at default threshold)** | True negative rate (correctly identified non-decliners) | 0.70-0.90 | >= 0.75 |
| **Positive Predictive Value** | Proportion of flagged high-risk participants who truly decline | 0.30-0.60 | Reported; context-dependent |
| **Negative Predictive Value** | Proportion of non-flagged participants who truly do not decline | 0.85-0.95 | >= 0.85 |
| **Concordance index (Cox PH)** | Probability that the model correctly orders pairs by event time | 0.65-0.80 | >= 0.70 |
| **Calibration (Brier score)** | Overall calibration of predicted probabilities | 0.10-0.25 | <= 0.20 |

### Secondary Metrics

- F1-score for the decline class.
- Precision-recall AUC (more informative than ROC-AUC for imbalanced data).
- Feature importance rankings (permutation importance and built-in GBT
  feature importance).
- Hazard ratios with 95% confidence intervals from the Cox PH model.

### Calibration by Age Group

Risk scores must be well-calibrated within each age band:

| Age Band | Expected Calibration Error (ECE) Target |
|---|---|
| 50-59 | <= 0.10 |
| 60-69 | <= 0.10 |
| 70-79 | <= 0.12 |
| 80+ | <= 0.15 (wider tolerance due to smaller sample) |

Groups with ECE exceeding the target are flagged for recalibration using
Platt scaling or isotonic regression.

---

## Ethical Considerations

### CRITICAL: Risk Score Access Controls

Risk scores produced by this model are classified as **highly sensitive**
under the WELLab data governance framework. The following access controls
are mandatory:

1. **Risk scores must NEVER be shown to unauthorized viewers.** Access is
   restricted to:
   - The participant themselves (only with clinical context -- see below).
   - Authorized researchers listed on the IRB protocol.
   - Licensed clinicians providing participant feedback (when applicable).

2. **Individual risk scores require clinical context.** When a participant
   is informed of their risk score (if permitted under the study protocol):
   - A licensed clinician must provide the context.
   - The score must be accompanied by an explanation of its limitations.
   - The participant must be informed that the score is a statistical
     estimate, not a diagnosis.
   - Resources for clinical follow-up must be provided.

3. **No automated risk notification.** The system must never send automated
   emails, push notifications, or alerts to participants based on risk
   scores without clinician review and approval.

### APOE Status and Genetic Data Handling

If APOE genotype or other genetic variants are included as model features:

1. **Explicit genetic consent required.** Standard research consent is
   insufficient. A separate genetic-specific consent form must be signed,
   covering:
   - The purpose of genetic data collection.
   - How genetic data will be used in the model.
   - The implications of APOE status for Alzheimer's risk.
   - The participant's right to not know their genetic risk status.

2. **Genetic data must be stored separately** from other participant data,
   with additional encryption and access controls.

3. **APOE status must never be communicated** to participants without
   genetic counseling by a certified genetic counselor.

4. **Model outputs that are influenced by APOE status** must be flagged
   in the metadata so that downstream consumers know genetic data
   contributed to the score.

### Participant Wellbeing

- Researchers must have a protocol in place for participants who become
  distressed upon learning about cognitive decline research, even if they
  are not directly informed of their risk scores.
- A licensed psychologist or social worker must be available for referral.
- The debriefing protocol must include information about the limitations
  of risk prediction and the modifiable nature of many risk factors.

### Protective Factor Interpretation

- Protective factors identified by permutation importance are
  **correlational**, not causal. Researchers must not claim that modifying
  a protective factor will reduce cognitive decline risk without additional
  causal evidence.
- Protective factor rankings should be interpreted in the context of the
  full literature, not solely based on model output.
- Participant-facing communications about protective factors must be
  reviewed by the ethics committee.

### Informed Consent

- Participants must consent to AI processing of their cognitive and health
  data (per WELLab ethics framework Section 2).
- Consent must specifically address:
  - That a risk score will be computed.
  - Who will have access to the risk score.
  - Whether the participant will be informed of their score.
  - The limitations of the risk score.
- Participants may opt out of the cognitive risk module while continuing
  to participate in other WELLab modules.

### Data Protection

- Individual risk scores are stored with the same protections as
  individually identifiable health information.
- Population-level risk distributions enforce k-anonymity (k >= 10).
- Risk scores are never included in exported datasets without explicit
  DUA authorization.
- All risk score access is logged in an immutable audit trail.

---

## Caveats and Recommendations

### Known Limitations

1. **Risk scores are population-level estimates, not individual predictions.**
   A risk score of 0.65 means that among participants with similar features,
   approximately 65% experienced cognitive decline. It does not mean this
   specific participant has a 65% chance of decline.

2. **Protective factor analysis is correlational.** Permutation importance
   identifies features associated with decline risk, but it does not
   establish causation. Confounding, reverse causation, and collider bias
   can all distort importance rankings.

3. **Class imbalance.** Cognitive decline is typically a minority class.
   Without appropriate handling (e.g., SMOTE, class weights, threshold
   adjustment), the model may have low sensitivity for the decline class.

4. **Feature availability.** The model requires the same features at
   prediction time as were available during training. Missing features
   at prediction time must be handled (imputation or model retraining).

5. **Temporal generalization.** A model trained on data from one era may
   not generalize to future cohorts due to secular trends in cognitive
   health, education, and healthcare access.

6. **Stub implementations.** The current version uses a stub fallback for
   Cox PH survival analysis when lifelines is not installed. Full
   lifelines integration is required for production deployment.

7. **No hyperparameter tuning.** The current implementation uses default
   hyperparameters. RandomizedSearchCV or Optuna-based tuning is planned
   but not yet implemented.

8. **No SHAP explanations.** Individual-level explanations (e.g., "Your
   risk is elevated primarily because of X and Y") require SHAP values,
   which are planned but not yet implemented.

### Recommendations

- Use stratified cross-validation and report AUC with confidence intervals.
- Address class imbalance explicitly (class weights or resampling).
- Conduct temporal validation by training on earlier waves and testing
  on later waves.
- Supplement permutation importance with SHAP values for richer
  explanations.
- Always report calibration metrics alongside discrimination metrics.
- Have all participant-facing risk communications reviewed by both a
  clinician and the ethics committee.

---

## Fairness Considerations

### CRITICAL: Fairness Requirements

Cognitive decline risk prediction is an area where algorithmic bias can
cause serious harm, particularly to racial and ethnic minorities who have
historically been underserved by cognitive health research and healthcare.
Fairness auditing for this model is therefore classified as **critical**.

### Audit Requirements

The CognitiveRiskModel must pass fairness audits across all of the following
demographic groups:

| Demographic Attribute | Source | Priority |
|---|---|---|
| sex | Participant demographics | Required |
| ethnicity | Participant demographics | **Critical** |
| race | Participant demographics | **Critical** |
| culture_group | Participant demographics | Required |
| age_band | Derived from date of birth | Required |
| education_level | Participant demographics | Required |

### Fairness Criteria

1. **Demographic parity.** The high-risk flagging rate must not differ by
   more than 5 percentage points across demographic groups (per WELLab
   ethics framework).

2. **Disparate impact (4/5ths rule).** The high-risk flagging rate for any
   demographic group must be at least 80% of the highest group's rate.
   If the disparate impact ratio falls below 0.80, the model is
   **quarantined** and cannot be used until bias is remediated.

3. **Equal calibration.** Predicted probabilities must be equally
   well-calibrated across demographic groups. A risk score of 0.60 must
   mean approximately 60% decline rate for all groups, not just for the
   majority group.

4. **Equal sensitivity and specificity.** Sensitivity (true positive rate)
   and specificity (true negative rate) should be approximately equal
   across demographic groups. Systematic differences in sensitivity by
   race/ethnicity are unacceptable without scientific justification and
   ethics committee approval.

5. **Representation check.** Training data must include at least 30
   participants per demographic group. Under-represented groups receive
   explicit uncertainty warnings.

### Monthly Fairness Audit

- Automated fairness audit runs monthly via `scripts/fairness_audit.py`.
- The audit computes all fairness criteria above and generates a report.
- The report is reviewed by the PI and an ethics committee member.
- If any criterion fails, the model is quarantined pending remediation.

### Quarterly Human Review

- Every quarter, the PI and an ethics committee member review:
  - Cumulative fairness audit reports.
  - Any remediation actions taken.
  - Changes in demographic composition of the data.
  - Literature updates on bias in cognitive risk prediction.

### Remediation Protocol

If bias is detected:

1. The model is immediately **quarantined** -- risk scores are suppressed
   for all participants (not just affected groups) to prevent differential
   treatment.
2. Root cause analysis is conducted:
   - Data imbalance (insufficient representation of affected group)?
   - Feature bias (features that are proxies for protected attributes)?
   - Label bias (cognitive decline definition biased against certain groups)?
   - Scale bias (cognitive tests normed on non-representative samples)?
3. Remediation is applied (re-weighting, data augmentation, feature
   removal, threshold adjustment, or subgroup-specific calibration).
4. The model is retrained and re-audited.
5. Remediation is documented in the audit trail with before/after metrics.
6. PI and ethics committee approve re-deployment.

### Known Fairness Risks

- **Cognitive test bias.** Many standardized cognitive tests (e.g., MMSE)
  have known cultural and educational biases. Features derived from these
  tests may propagate bias into risk scores.
- **APOE frequency variation.** APOE e4 allele frequency varies by
  ancestry. If APOE is a model feature, risk scores may systematically
  differ by race/ethnicity for biological rather than bias-related reasons.
  This must be carefully documented and communicated.
- **Healthcare access confounding.** Participants with better healthcare
  access may receive earlier cognitive decline diagnoses, creating
  ascertainment bias in the training labels.

---

## Quantitative Analyses

### Expected Performance by Subgroup

| Subgroup | Expected AUC | Notes |
|---|---|---|
| Overall | 0.75-0.85 | Depends on feature availability |
| Age 50-64 | 0.70-0.80 | Lower base rate, fewer events |
| Age 65-79 | 0.75-0.85 | Most data typically available |
| Age 80+ | 0.70-0.80 | Competing risks (mortality) |

### Sensitivity/Specificity at Default Threshold (0.50)

| Metric | Expected Value |
|---|---|
| Sensitivity | 0.65-0.75 |
| Specificity | 0.75-0.85 |
| PPV | 0.35-0.55 |
| NPV | 0.85-0.95 |

Note: The default threshold of 0.50 may not be optimal. Threshold
optimization using the Youden index or cost-sensitive analysis should be
conducted for each deployment context.

### Protective Factor Analysis

Expected top protective factors (based on prior literature):

| Factor | Direction | Strength |
|---|---|---|
| Physical activity | Protective | Strong |
| Social engagement | Protective | Moderate-Strong |
| Cognitive stimulation | Protective | Moderate |
| Education years | Protective | Moderate |
| Mediterranean diet adherence | Protective | Moderate |
| Sleep quality | Protective | Moderate |

These are hypothesized based on literature and must be confirmed empirically
in WELLab data.

### Survival Analysis

- Expected concordance index: 0.65-0.80.
- Hazard ratios for key risk factors should be consistent with
  published meta-analyses.
- Proportional hazards assumption must be tested (Schoenfeld residuals)
  and reported.

---

## Configuration Parameters

All parameters are defined in `src/ml/config.py` and can be overridden via
environment variables (prefix `WELLAB_ML_`) or a YAML configuration file.

| Parameter | Default Value | Description |
|---|---|---|
| `RANDOM_SEED` | 42 | Global random seed for reproducibility |
| `COGNITIVE_RISK_PARAMS.risk_threshold` | 0.50 | Probability cutoff above which a participant is flagged as high-risk |
| `COGNITIVE_RISK_PARAMS.n_estimators` | 100 | Number of boosting rounds for the Gradient Boosted Trees classifier |
| `COGNITIVE_RISK_PARAMS.max_depth` | 6 | Maximum tree depth for each boosting round |
| `COGNITIVE_RISK_PARAMS.survival_alpha` | 0.05 | Significance level for survival analysis |
| `FAIRNESS_PARAMS.demographic_parity_tolerance` | 0.05 | Maximum allowable difference in high-risk flagging rate across demographic groups |
| `FAIRNESS_PARAMS.disparate_impact_floor` | 0.80 | Minimum disparate impact ratio; model quarantined if ratio falls below this |

### Environment Variable Overrides

```bash
export WELLAB_ML_COGNITIVE_RISK__RISK_THRESHOLD=0.60
export WELLAB_ML_COGNITIVE_RISK__N_ESTIMATORS=200
export WELLAB_ML_COGNITIVE_RISK__MAX_DEPTH=4
```

---

## Serialization and Reproducibility

### Model Artifacts

- Models are serialized using `joblib.dump` with metadata including:
  model version, training timestamp, configuration parameters (risk
  threshold, n_estimators, max_depth, seed), and feature names.
- The fitted `GradientBoostingClassifier` and feature name list are
  stored together for deployment consistency.
- Artifact files are stored in S3 with version IDs.

### Reproducibility

- `GradientBoostingClassifier` uses `random_state=RANDOM_SEED` for
  deterministic training.
- Permutation importance uses `random_state=RANDOM_SEED`.
- All stochastic operations use `utils.set_reproducible_seed()`.
- Cross-validation uses deterministic fold assignments.
- Every training run is logged: hyperparameters, data snapshot ID,
  CV AUC scores, feature names, seed, and duration.
- Logs are retained for 7 years per data retention policy.

---

## Version History

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0.0 | 2026-04-05 | WELLab ML Team | Initial model card. Documents CognitiveRiskModel v1.0.0 with Gradient Boosted Trees risk classification, permutation importance for protective factors, Cox PH survival analysis, APOE handling requirements, critical fairness audit framework, and access control mandates. |

---

*This model card follows the format proposed by Mitchell et al. (2019),
"Model Cards for Model Reporting." It is intended for IRB review and
research transparency purposes.*
