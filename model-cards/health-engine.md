# Model Card: CausalHealthAnalyzer

## Model Details

| Field | Value |
|---|---|
| **Model Name** | CausalHealthAnalyzer |
| **Version** | 1.0.0 |
| **Date** | 2026-04-05 |
| **Type** | DoWhy causal inference + mixed-effects longitudinal regression |
| **Framework** | DoWhy (causal inference); statsmodels (mixed-effects); scikit-learn (stub linear regression); pandas; NumPy |
| **Owner** | WELLab, Washington University |
| **Contact** | WELLab Principal Investigator |
| **License** | Research use only under IRB-approved protocol |

### Description

The CausalHealthAnalyzer provides causal-inference tooling for analysing
bidirectional relationships between subjective well-being and objective health
biomarkers in the WELLab platform. It integrates with the DoWhy
causal-inference library for identification, estimation, and refutation of
treatment effects, and supports longitudinal mixed-effects regression for
panel data.

The model supports three primary workflows:

1. **Unidirectional causal effect estimation.** Given a treatment variable,
   outcome variable, and set of confounders, the model estimates the average
   causal effect using the backdoor criterion with linear regression (with
   DoWhy integration planned for full DAG-based identification).

2. **Longitudinal mixed-effects regression.** For panel data with repeated
   measures, the model fits random-intercept / random-slope models to
   estimate time trends and between-participant variability.

3. **Bidirectional analysis.** Paired causal analyses estimating the effect
   of well-being on health AND the effect of health on well-being, enabling
   researchers to assess reciprocal relationships.

### Architecture

- Causal effect estimation uses the backdoor criterion with linear regression
  as the default estimation method (`backdoor.linear_regression`).
- Confidence intervals are computed using the normal approximation
  (estimate +/- 1.96 * SE).
- Longitudinal regression uses per-group OLS as a stub, with statsmodels
  MixedLM planned for random-effects estimation.
- Bidirectional analysis merges wellbeing and health datasets on participant
  and wave identifiers, then runs paired causal estimates in both directions.

---

## Intended Use

### Primary Use Cases

- Estimate bidirectional causal effects between subjective well-being and
  objective health biomarkers for academic research conducted under
  IRB-approved protocols.
- Support longitudinal analyses of how wellbeing trajectories relate to
  health outcomes over multiple measurement waves.
- Generate causal effect estimates for inclusion in peer-reviewed
  publications, with appropriate methodological caveats.
- Identify potential confounders and mediators in the wellbeing-health
  relationship for hypothesis generation.

### Intended Users

- WELLab researchers with training in causal inference methodology.
- Biostatisticians and epidemiologists collaborating on WELLab studies.
- Graduate research assistants operating under PI supervision with
  appropriate data access authorization.

---

## Out-of-Scope Use

The following uses are explicitly **not supported** and are prohibited:

- **Individual treatment recommendations.** Causal effect estimates are
  population-level and must not be used to recommend specific treatments
  or interventions for individual participants.
- **Clinical decision support.** The model is not validated for integration
  into clinical decision support systems or electronic health records.
- **Policy prescriptions without expert review.** Causal estimates from
  observational data require careful interpretation by domain experts
  before informing policy.
- **Automated intervention assignment.** Effect estimates must not be used
  to automatically assign participants to treatment arms or interventions
  without clinician and IRB oversight.
- **Insurance or employment decisions.** No output from this model may be
  used in actuarial calculations, underwriting, or hiring contexts.

---

## Training Data

### Expected Data Characteristics

| Characteristic | Specification |
|---|---|
| **Data source** | Longitudinal panel data from WELLab studies |
| **Minimum observations** | 30 per analysis (configurable) |
| **Wellbeing measures** | Subjective well-being scales (e.g., life satisfaction, affect balance) |
| **Health biomarkers** | Objective health measures (e.g., BMI, blood pressure, HbA1c, cortisol) |
| **Measurement waves** | At least 2 waves for longitudinal analysis; 3+ recommended |
| **Confounders** | Researcher-specified based on domain knowledge and DAG |

### Data Requirements for Causal Estimation

- The treatment, outcome, and all confounder columns must be present in
  the input DataFrame.
- Missing values are handled by listwise deletion (rows with NaN in any
  relevant column are dropped).
- Confounders must be specified by the researcher based on a Directed
  Acyclic Graph (DAG) reviewed by a domain expert.

### Data Requirements for Longitudinal Regression

- Panel data must include a participant identifier, a time/wave variable,
  and the outcome of interest.
- At least 2 observations per participant are required for slope estimation.
- Participants with fewer than 2 observations are excluded from analysis.

---

## Evaluation Data

- Causal effect estimates are evaluated using DoWhy refutation tests:
  - **Placebo treatment test:** Replace the true treatment with a random
    variable; the estimated effect should drop to approximately zero.
  - **Random common cause test:** Add a randomly generated confounder;
    the estimated effect should remain stable.
  - **Data subset test:** Re-estimate on random subsets of the data;
    the estimated effect should remain within the confidence interval.
- Longitudinal regression models are evaluated using:
  - Residual diagnostics (normality, homoscedasticity).
  - Cross-validated prediction accuracy.
  - Comparison of fixed-effect and random-effect variance components.

---

## Metrics

### Primary Metrics

| Metric | Description | Target |
|---|---|---|
| **Effect estimate stability** | Causal effect estimate should be robust to refutation tests | All refutation tests passed |
| **Confidence interval coverage** | 95% CI should contain the true effect in simulation studies | >= 93% coverage |
| **Refutation test pass rate** | Proportion of refutation tests that confirm the estimate | 100% before publication |
| **Fixed-effect significance** | P-value for the treatment effect coefficient | Reported with exact value; significance threshold = 0.05 |
| **Random-effect variance ratio** | Proportion of total variance explained by between-participant differences | Reported descriptively |

### Secondary Metrics

- R-squared of the regression model.
- AIC/BIC for model comparison when multiple specifications are tested.
- Effect heterogeneity across demographic subgroups.
- Sensitivity analysis results (e.g., E-value for unmeasured confounding).

---

## Ethical Considerations

### Causal Claims Require DAG Review

Causal claims are only as valid as the Directed Acyclic Graph (DAG) on which
they are based. Before any causal estimate is published or used for decision
support:

1. The DAG must be constructed by or reviewed by a domain expert (e.g.,
   epidemiologist, health psychologist, or clinical researcher).
2. The DAG must be documented and included in any publication alongside
   the causal estimate.
3. Sensitivity analyses for unmeasured confounding (e.g., E-values) must
   be conducted and reported.

### Confounding Can Mislead

Observational data is inherently susceptible to unmeasured confounding.
Researchers must:

- Explicitly acknowledge that causal estimates are conditional on the
  assumed DAG.
- Report sensitivity analyses quantifying how strong an unmeasured
  confounder would need to be to nullify the estimate.
- Avoid causal language in publications unless refutation tests are passed
  and sensitivity analyses support the causal interpretation.

### Bidirectional Effects and Interpretation

The bidirectional analysis feature estimates effects in both directions
(wellbeing -> health and health -> wellbeing). Researchers must avoid:

- Cherry-picking the direction that supports their hypothesis.
- Interpreting both directions as simultaneously causal without addressing
  the temporal ordering required for causal inference.
- Presenting bidirectional estimates without acknowledging that true
  bidirectional causation requires careful identification strategies.

### Informed Consent

- Participants must consent to AI processing of their health and wellbeing
  data (per WELLab ethics framework Section 2).
- Health biomarker data is particularly sensitive; handling must comply
  with HIPAA and institutional data governance policies.
- Participants may opt out of the health engine module while continuing
  to participate in other WELLab modules.

### Data Protection

- Individual causal effect estimates (when computed for subgroups) are
  visible only to authorized researchers under the IRB protocol.
- Population-level aggregations enforce k-anonymity (k >= 10).
- No demographic cross-tabulations that could identify individuals.

---

## Caveats and Recommendations

### Known Limitations

1. **Observational data.** All estimates are derived from observational data.
   Even with careful confounder adjustment, unmeasured confounders may bias
   estimates. The model does not and cannot establish causation from
   observational data alone.

2. **Unmeasured confounders.** The confounder set is limited to variables
   collected in the study. Important confounders (e.g., genetics,
   socioeconomic factors, neighborhood characteristics) may be unmeasured.

3. **Linearity assumption.** The current implementation assumes linear
   relationships between treatment, outcome, and confounders. Nonlinear
   effects, interactions, and threshold effects are not modeled.

4. **Stub implementation.** The current version uses linear regression as
   a stub for DoWhy causal estimation and per-group OLS as a stub for
   mixed-effects regression. Full DoWhy and statsmodels integration is
   planned but not yet implemented.

5. **Normal approximation for CIs.** Confidence intervals use the normal
   approximation (1.96 * SE), which may be inaccurate for small samples
   or non-normal outcomes.

6. **Merge sensitivity.** Bidirectional analysis requires merging wellbeing
   and health datasets. Merge failures (e.g., mismatched participant IDs
   or wave numbers) can silently exclude data.

### Recommendations

- Always conduct and report refutation tests before presenting causal claims.
- Use E-values to quantify sensitivity to unmeasured confounding.
- Consider nonlinear extensions (splines, interaction terms) when linear
  assumptions may not hold.
- Verify merge completeness before interpreting bidirectional results.
- Report effect estimates with full confidence intervals, not just point
  estimates and p-values.

---

## Fairness Considerations

### Audit Requirements

Causal effect estimates must be stable and unbiased across demographic
subgroups. Fairness is assessed along the following dimensions:

| Demographic Attribute | Source |
|---|---|
| sex | Participant demographics |
| ethnicity | Participant demographics |
| culture_group | Participant demographics |
| age_band | Derived from date of birth |
| education_level | Participant demographics |

### Fairness Criteria

1. **Effect estimate stability.** Causal effect estimates should not
   systematically differ across demographic subgroups unless there is a
   scientifically justified reason (e.g., known biological sex differences
   in health biomarkers).

2. **Confidence interval overlap.** Subgroup-specific confidence intervals
   should overlap substantially. Non-overlapping CIs across demographic
   groups trigger a fairness review.

3. **Confounder adequacy.** The confounder set must be evaluated for
   adequacy within each demographic subgroup. A confounder that is
   well-measured in one group but poorly measured in another can introduce
   differential bias.

4. **Representation check.** Each demographic subgroup must have at least
   30 participants. Subgroups below this threshold receive uncertainty
   warnings on their estimates.

### Refutation Tests as Fairness Guards

- All three DoWhy refutation tests (placebo, random common cause, data
  subset) must be conducted within each demographic subgroup, not just
  on the full sample.
- If refutation tests fail for any subgroup, the estimate for that
  subgroup is flagged and not reported without additional investigation.

### Remediation Protocol

If fairness concerns are identified:

1. Investigate whether confounders are adequate for the affected subgroup.
2. Consider subgroup-specific models if effect heterogeneity is justified.
3. Document all fairness concerns and remediation steps in the audit trail.
4. PI and ethics committee review before results are published.

---

## Quantitative Analyses

### Expected Effect Estimate Ranges

- Wellbeing-to-health effects: Small to medium standardized effects
  (beta = 0.05-0.30) are expected based on prior literature.
- Health-to-wellbeing effects: Small to medium standardized effects
  (beta = 0.10-0.35) are expected based on prior literature.
- Bidirectional asymmetry: The health-to-wellbeing pathway is typically
  stronger than the wellbeing-to-health pathway in cross-sectional data.

### Refutation Test Expectations

| Test | Expected Result |
|---|---|
| Placebo treatment | Effect drops to ~0 (within noise) |
| Random common cause | Effect remains within original 95% CI |
| Data subset (50% random) | Effect remains within original 95% CI |

### Longitudinal Regression Expectations

- Fixed-effect slopes: Direction and magnitude depend on the specific
  outcome and study design.
- Random-effect variance: Significant between-participant variability is
  expected (ICC > 0.30 for most wellbeing and health outcomes).

---

## Configuration Parameters

All parameters are defined in `src/ml/config.py` and can be overridden via
environment variables (prefix `WELLAB_ML_`) or a YAML configuration file.

| Parameter | Default Value | Description |
|---|---|---|
| `RANDOM_SEED` | 42 | Global random seed for reproducibility |
| `HEALTH_ENGINE_PARAMS.min_observations` | 30 | Minimum observations required for causal estimation |
| `HEALTH_ENGINE_PARAMS.significance_level` | 0.05 | Alpha level for hypothesis tests |
| `HEALTH_ENGINE_PARAMS.bootstrap_iterations` | 1000 | Number of bootstrap iterations for CI estimation |
| `HEALTH_ENGINE_PARAMS.causal_method` | "backdoor.linear_regression" | DoWhy estimation method identifier |
| `FAIRNESS_PARAMS.demographic_parity_tolerance` | 0.05 | Maximum allowable difference in prediction rates across groups |
| `FAIRNESS_PARAMS.disparate_impact_floor` | 0.80 | Minimum disparate impact ratio (4/5ths rule) |

### Environment Variable Overrides

```bash
export WELLAB_ML_HEALTH_ENGINE__SIGNIFICANCE_LEVEL=0.01
export WELLAB_ML_HEALTH_ENGINE__BOOTSTRAP_ITERATIONS=5000
```

---

## Serialization and Reproducibility

### Model Artifacts

- Models are serialized using `joblib.dump` with metadata including:
  model version, training timestamp, configuration parameters (significance
  level, causal method, seed), and feature names.
- Artifact files are stored in S3 with version IDs.

### Reproducibility

- All stochastic operations use `RANDOM_SEED = 42` via
  `utils.set_reproducible_seed()`.
- Every training run is logged: hyperparameters, data snapshot ID, metrics,
  seed, and duration.
- Logs are retained for 7 years per data retention policy.

---

## Version History

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0.0 | 2026-04-05 | WELLab ML Team | Initial model card. Documents CausalHealthAnalyzer v1.0.0 with DoWhy causal inference, mixed-effects longitudinal regression, bidirectional analysis, refutation test requirements, and fairness audit framework. |

---

*This model card follows the format proposed by Mitchell et al. (2019),
"Model Cards for Model Reporting." It is intended for IRB review and
research transparency purposes.*
