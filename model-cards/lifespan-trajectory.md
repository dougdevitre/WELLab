# Model Card: TrajectoryAnalyzer

## Model Details

| Field | Value |
|---|---|
| **Model Name** | TrajectoryAnalyzer |
| **Version** | 1.0.0 |
| **Date** | 2026-04-05 |
| **Type** | Latent growth curves (polynomial regression) + Gaussian Mixture Model / K-Means trajectory clustering |
| **Framework** | scikit-learn (KMeans, PolynomialFeatures); NumPy (polyfit); statsmodels (MixedLM, planned); pandas |
| **Owner** | WELLab, Washington University |
| **Contact** | WELLab Principal Investigator |
| **License** | Research use only under IRB-approved protocol |

### Description

The TrajectoryAnalyzer models lifespan developmental trajectories of
well-being, identifying distinct trajectory archetypes (latent classes) that
characterize how well-being changes across the lifespan. It provides three
core capabilities:

1. **Growth curve fitting.** Per-participant polynomial growth curves are
   fitted to longitudinal wellbeing data, capturing individual trajectories
   as polynomial coefficients (intercept, linear slope, quadratic curvature,
   and optionally cubic trends).

2. **Trajectory clustering.** Polynomial coefficients are used as features
   for K-Means clustering (with Gaussian Mixture Models planned), grouping
   participants into latent trajectory classes that share similar wellbeing
   patterns over time.

3. **Cross-cultural comparison.** Aggregate trajectory shapes are compared
   between two cohorts using polynomial fits, enabling researchers to assess
   whether wellbeing trajectories differ systematically across cultural
   groups.

### Architecture

- Per-participant polynomial curves are fitted using `numpy.polyfit` with
  configurable maximum polynomial degree (default: cubic, degree 3).
- When a participant has fewer observations than the requested polynomial
  degree + 1, the degree is automatically reduced.
- Polynomial coefficients are padded to uniform length and used as features
  for K-Means clustering.
- Cross-cultural comparisons fit aggregate polynomial curves to each cohort
  and compute the Euclidean distance between coefficient vectors.

---

## Intended Use

### Primary Use Cases

- Identify wellbeing trajectory archetypes across the lifespan for academic
  research conducted under IRB-approved protocols.
- Characterize developmental patterns (e.g., stable-high, early-decline,
  late-recovery, U-shaped) in longitudinal wellbeing data.
- Compare trajectory distributions across cultural groups, cohorts, or
  intervention arms.
- Generate trajectory cluster assignments as features for downstream
  statistical models (e.g., predicting health outcomes from trajectory
  membership).

### Intended Users

- WELLab researchers studying lifespan development of well-being.
- Developmental psychologists and gerontologists collaborating on
  WELLab studies.
- Graduate research assistants with training in growth curve modeling
  and appropriate data access authorization.

---

## Out-of-Scope Use

The following uses are explicitly **not supported** and are prohibited:

- **Predicting individual futures.** Trajectory cluster membership describes
  past and present patterns; it must not be used to predict an individual
  participant's future wellbeing trajectory.
- **Intervention assignment without clinical judgment.** Trajectory
  classifications must not be used to automatically assign participants
  to interventions, treatment groups, or clinical pathways without
  clinician and IRB oversight.
- **Labeling individuals as "declining" or "at risk."** See Ethical
  Considerations below regarding strength-based naming requirements.
- **Insurance, employment, or legal decisions.** No output from this model
  may be used in non-research contexts.
- **Real-time monitoring or alerting.** The model is designed for
  retrospective analysis of completed longitudinal datasets, not for
  real-time trajectory tracking.

---

## Training Data

### Expected Data Characteristics

| Characteristic | Specification |
|---|---|
| **Data source** | Longitudinal panel data from WELLab lifespan studies |
| **Age range** | 18-100+ years (full adult lifespan) |
| **Measurement occasions** | At least 3 waves per participant (more recommended) |
| **Wellbeing measure** | Composite wellbeing score or domain-specific measure |
| **Age/time variable** | Participant age at each measurement occasion |
| **Grouping variable** | Unique participant identifier |

### Input Schema

The model expects a pandas DataFrame with at minimum:

| Column | Type | Description |
|---|---|---|
| `participant_id` | object (string) | Unique participant identifier |
| `age` | float64 | Participant age at measurement occasion |
| `wellbeing` | float64 | Wellbeing outcome score |

### Data Requirements

- At least `max_degree + 1` observations per participant for full polynomial
  fitting (default: 4 observations for cubic curves).
- Participants with fewer observations receive reduced-degree polynomial fits.
- Missing values must be handled prior to model input.
- Cross-cultural comparison requires at least two cohorts with overlapping
  age ranges.

---

## Evaluation Data

- Growth curve quality is assessed using residual analysis (normality,
  homoscedasticity) and goodness-of-fit statistics (R-squared per
  participant).
- Cluster quality is evaluated using:
  - **Inertia** (within-cluster sum of squares): Lower is better.
  - **Silhouette score**: Measures cluster separation; target > 0.30.
  - **Bayesian Information Criterion (BIC)** for GMM-based clustering
    (planned): Used for selecting the optimal number of clusters.
  - **Cluster stability**: Bootstrap resampling to assess assignment
    consistency; target > 80% agreement across resamples.
- Cross-cultural comparisons are validated using permutation tests or
  bootstrap CIs for the coefficient differences (planned).

---

## Metrics

### Primary Metrics

| Metric | Description | Target |
|---|---|---|
| **Cluster inertia** | Within-cluster sum of squares from K-Means | Minimized (elbow method for k selection) |
| **Silhouette score** | Average silhouette coefficient across all participants | >= 0.30 |
| **Growth curve R-squared** | Per-participant goodness of fit for polynomial curves | Median >= 0.60 |
| **Cluster stability (bootstrap)** | Agreement of cluster assignments across 100 bootstrap resamples | >= 80% |
| **Cross-cultural distance significance** | Whether cohort trajectory differences exceed chance levels | p < 0.05 via permutation test |

### Secondary Metrics

- Cluster size distribution (no cluster should contain fewer than 5%
  of participants).
- Polynomial degree adequacy (whether cubic is sufficient or higher
  degrees improve fit significantly).
- Cross-validation prediction error for growth curves.

---

## Ethical Considerations

### Strength-Based Naming of Trajectory Clusters

Trajectory labels assigned to latent classes must adhere to strength-based
naming conventions. This is a core requirement of the WELLab ethics framework.

**Prohibited labels:**
- "late-decline" -- implies inevitable deterioration
- "low-functioning" -- deficit-focused language
- "at-risk trajectory" -- stigmatizing and potentially self-fulfilling
- "failure to thrive" -- clinical label inappropriate for research classification

**Required approach:**
- Labels should describe the shape, not the value judgment:
  "stable-high," "gradual-change," "U-shaped recovery," "variable."
- When decline is part of the trajectory shape, use neutral descriptors:
  "transitional" rather than "declining."
- All trajectory labels must be reviewed and approved by the PI and
  ethics committee before use in any publication or participant-facing
  communication.

### Probabilistic, Not Deterministic

Cluster assignments are inherently probabilistic. A participant assigned to
the "stable-high" cluster may have a posterior probability of only 0.55 for
that cluster and 0.35 for the "U-shaped" cluster. Researchers must:

- Report posterior probabilities (when using GMM) or distance-to-centroid
  measures alongside hard cluster assignments.
- Avoid treating cluster assignments as fixed participant attributes.
- Acknowledge uncertainty in all publications and presentations.

### Cross-Cultural Measurement Invariance

Before comparing trajectories across cultural groups, researchers must verify:

1. **Configural invariance:** The same factor structure holds across groups.
2. **Metric invariance:** Factor loadings are equivalent across groups.
3. **Scalar invariance:** Intercepts are equivalent across groups (required
   for mean comparisons).

Without measurement invariance, cross-cultural trajectory comparisons may
reflect measurement artifacts rather than true differences in wellbeing
development.

### Informed Consent

- Participants must consent to AI processing of their longitudinal data
  (per WELLab ethics framework Section 2).
- Trajectory classifications are research-internal; participants are not
  shown their cluster assignment unless this is part of an approved
  feedback protocol.
- Participants may opt out of the trajectory module while continuing to
  participate in other WELLab modules.

### Data Protection

- Individual trajectory assignments are visible only to authorized
  researchers under the IRB protocol.
- Population-level trajectory distributions enforce k-anonymity (k >= 10).
- No reporting of trajectory membership for demographic cells with
  fewer than 10 participants.

---

## Caveats and Recommendations

### Known Limitations

1. **Cluster assignments are probabilistic, not deterministic.** K-Means
   provides hard assignments, but participants near cluster boundaries
   may be poorly classified. GMM-based soft assignments are planned.

2. **Number of clusters is researcher-specified.** The default of 3 clusters
   may not be optimal for all datasets. Researchers should use the elbow
   method, silhouette scores, or BIC to select k.

3. **Polynomial degree limitation.** Cubic polynomials cannot capture all
   trajectory shapes (e.g., sharp discontinuities, step functions). Spline-
   based or nonparametric approaches may be needed for some populations.

4. **Cross-cultural comparison is approximate.** The Euclidean distance
   between polynomial coefficient vectors is a rough metric. A proper
   permutation test or bootstrap CI is needed for inferential claims
   (noted as a TODO in the codebase).

5. **Cross-cultural measurement invariance must be verified.** Without
   invariance testing, trajectory comparisons across culture_group may be
   meaningless. The model does not perform invariance tests automatically.

6. **Age-period-cohort confounding.** In cross-sectional or short-panel
   data, age effects may be confounded with period or cohort effects.
   Researchers must address this in their study design.

7. **Survivorship bias.** In lifespan studies, participants who remain in
   the study at older ages may be systematically healthier or more engaged
   than those who drop out, biasing trajectory estimates at older ages.

### Recommendations

- Use BIC or silhouette scores to select the number of trajectory clusters.
- Report cluster assignments alongside uncertainty measures.
- Verify measurement invariance before cross-cultural comparisons.
- Use multiple imputation or pattern-mixture models to address dropout.
- Consider accelerated longitudinal designs to disentangle age and cohort.
- Supplement quantitative trajectories with qualitative life-history data.

---

## Fairness Considerations

### Audit Requirements

Trajectory cluster distributions must be examined for fairness across
demographic groups:

| Demographic Attribute | Source |
|---|---|
| sex | Participant demographics |
| ethnicity | Participant demographics |
| culture_group | Participant demographics |
| age_band | Derived from date of birth |
| education_level | Participant demographics |

### Fairness Criteria

1. **Cluster distribution equity.** Cluster distributions should not
   systematically differ by demographic group unless the difference is
   scientifically justified and documented. For example, if the "stable-high"
   cluster is 90% female and 10% male, this requires investigation and
   justification.

2. **Demographic parity for trajectory labels.** The assignment rate for
   negatively-valenced trajectory types (if any) should not differ by more
   than 5 percentage points across demographic groups.

3. **Disparate impact (4/5ths rule).** The assignment rate for any trajectory
   cluster in any demographic group must be at least 80% of the highest
   group's rate. If the disparate impact ratio falls below 0.80, the
   clustering must be re-examined.

4. **Representation check.** Training data must include at least 30
   participants per demographic group. Under-represented groups are flagged,
   and trajectory assignments for those groups carry uncertainty warnings.

### Scientifically Justified Differences

Some trajectory distribution differences across demographic groups may be
genuine and scientifically important (e.g., known sex differences in
wellbeing trajectories at midlife). In these cases:

- The difference must be documented with supporting literature.
- The PI and ethics committee must review and approve the interpretation.
- The difference must not be used to disadvantage any group.

### Remediation Protocol

If unjustified bias is detected:

1. Investigate data imbalance, scale bias, and confounding.
2. Consider re-weighting, data augmentation, or subgroup-specific models.
3. Re-audit after remediation.
4. Document all remediation steps in the audit trail.

---

## Quantitative Analyses

### Expected Trajectory Archetypes

Based on prior literature on lifespan wellbeing, the following trajectory
types are commonly identified with 3-5 clusters:

| Archetype | Description | Expected Prevalence |
|---|---|---|
| **Stable-high** | Consistently high wellbeing across the lifespan | 30-50% |
| **U-shaped** | Decline in midlife with recovery in later life | 20-35% |
| **Gradual-change** | Slow, steady change (increase or decrease) over time | 15-25% |
| **Variable** | High within-person variability, no clear trend | 5-15% |

### Growth Curve Statistics

- Expected mean R-squared for cubic polynomial fits: 0.60-0.85 for
  participants with 5+ observations.
- Expected polynomial coefficient distributions should be approximately
  normal for the linear and quadratic terms.

### Cluster Quality

- Expected silhouette score: 0.25-0.50 (trajectory data is often noisy).
- Expected inertia reduction from k=2 to k=3: 15-30%.
- Bootstrap stability: >= 80% assignment agreement is the minimum
  acceptable threshold.

---

## Configuration Parameters

All parameters are defined in `src/ml/config.py` and can be overridden via
environment variables (prefix `WELLAB_ML_`) or a YAML configuration file.

| Parameter | Default Value | Description |
|---|---|---|
| `RANDOM_SEED` | 42 | Global random seed for reproducibility |
| `TRAJECTORY_PARAMS.default_n_clusters` | 3 | Default number of latent trajectory groups for K-Means clustering |
| `TRAJECTORY_PARAMS.max_polynomial_degree` | 3 | Maximum polynomial degree for growth curve fitting (1=linear, 2=quadratic, 3=cubic) |
| `TRAJECTORY_PARAMS.convergence_tolerance` | 1e-4 | Convergence tolerance for iterative optimization (used in planned GMM implementation) |
| `TRAJECTORY_PARAMS.max_iterations` | 200 | Maximum iterations for iterative optimization |
| `FAIRNESS_PARAMS.demographic_parity_tolerance` | 0.05 | Maximum allowable difference in cluster assignment rates across demographic groups |
| `FAIRNESS_PARAMS.disparate_impact_floor` | 0.80 | Minimum disparate impact ratio (4/5ths rule) |

### Environment Variable Overrides

```bash
export WELLAB_ML_TRAJECTORY__DEFAULT_N_CLUSTERS=4
export WELLAB_ML_TRAJECTORY__MAX_POLYNOMIAL_DEGREE=2
```

---

## Serialization and Reproducibility

### Model Artifacts

- Models are serialized using `joblib.dump` with metadata including:
  model version, training timestamp, configuration parameters (max_degree,
  n_clusters, seed), and participant-level growth model keys.
- K-Means cluster model and per-participant polynomial coefficients are
  stored together.
- Artifact files are stored in S3 with version IDs.

### Reproducibility

- K-Means uses `random_state=RANDOM_SEED` for deterministic initialization.
- `numpy.polyfit` is deterministic for a given input.
- All stochastic operations use `utils.set_reproducible_seed()`.
- Every training run is logged: hyperparameters, data snapshot ID, metrics,
  seed, and duration.
- Logs are retained for 7 years per data retention policy.

---

## Version History

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0.0 | 2026-04-05 | WELLab ML Team | Initial model card. Documents TrajectoryAnalyzer v1.0.0 with polynomial growth curves, K-Means trajectory clustering, cross-cultural comparison, strength-based naming requirements, measurement invariance caveats, and fairness audit framework. |

---

*This model card follows the format proposed by Mitchell et al. (2019),
"Model Cards for Model Reporting." It is intended for IRB review and
research transparency purposes.*
