# Ethics — Fairness, Consent, Scientific Integrity

> WELLab AI-Enabled Research & Impact Platform
> Washington University in St. Louis

This document defines the ethical framework governing the WELLab platform, including IRB compliance, informed consent for AI-driven insights, cross-cultural fairness auditing, reproducibility standards, data safeguards, participant rights, and model transparency.

---

## Table of Contents

1. [IRB Compliance Framework](#1-irb-compliance-framework)
2. [Informed Consent for AI-Driven Insights](#2-informed-consent-for-ai-driven-insights)
3. [Cross-Cultural Fairness Auditing](#3-cross-cultural-fairness-auditing)
4. [Reproducibility Standards](#4-reproducibility-standards)
5. [Individual vs Population Data Safeguards](#5-individual-vs-population-data-safeguards)
6. [Participant Data Rights](#6-participant-data-rights)
7. [Model Transparency and Confidence Interval Reporting](#7-model-transparency-and-confidence-interval-reporting)

---

## 1. IRB Compliance Framework

### Governing Principles

All data collection, processing, and analysis on the WELLab platform operates under Institutional Review Board (IRB) approval from Washington University in St. Louis. The platform is designed to make IRB compliance structural — built into the system architecture rather than relying on individual researcher adherence.

### IRB Protocol Requirements

| Requirement | Implementation |
|-------------|----------------|
| Active protocol number | Stored in every Participant record (`consent.irb_protocol_id`). API rejects data submission without valid protocol. |
| Protocol expiration tracking | Automated alert 90 days before protocol expiration. Data collection halted if protocol lapses. |
| Amendments | Protocol amendments are version-tracked. System logs which consent version each participant signed. |
| Continuing review | Annual review checklists generated automatically from platform data (enrollment counts, adverse events, protocol deviations). |
| Adverse event reporting | Dedicated endpoint for logging adverse events. Automated notification to PI within 24 hours. |
| Protocol deviation logging | All deviations (e.g., data accessed outside protocol scope) are logged and flagged for PI review. |

### Data Collection Boundaries

- The platform will not collect data types not specified in the active IRB protocol.
- API validation enforces field-level restrictions — if a data field is not in the approved protocol, the API rejects it.
- Cross-cultural datasets imported from external sources (HRS, SHARE, ELSA) must have separate data use agreements on file. The system tracks which datasets are authorized for which analyses.

### Human Subjects Protections

- **Vulnerable populations**: If the study enrolls participants with cognitive impairment, the platform supports proxy consent workflows and simplified UI modes.
- **Withdrawal**: Participants can withdraw at any time via the app (Settings > Consent > Withdraw). Withdrawal triggers a cascade that halts data collection, flags existing data per protocol (retain de-identified or delete), and sends confirmation.
- **Compensation tracking**: If participants are compensated, the platform tracks EMA completion milestones and generates compensation reports (without linking to financial systems).

---

## 2. Informed Consent for AI-Driven Insights

### Consent Architecture

AI-generated insights represent a novel element of research participation that requires specific, informed consent. The platform separates AI consent from general study consent.

### AI-Specific Consent Elements

Participants are informed about and consent to each of the following:

| Element | Plain Language Description Provided to Participant |
|---------|---------------------------------------------------|
| **AI-generated summaries** | "We use AI to create brief written summaries of your wellbeing patterns. These summaries are designed to be encouraging and informative, not diagnostic." |
| **Coupling classification** | "Our system identifies patterns in how your daily emotions relate to your overall satisfaction. This is a research classification, not a clinical assessment." |
| **Risk scoring** | "For participants in our cognitive health study, we compute a research-grade risk score. This score is for research purposes only and is not a medical diagnosis or prediction." |
| **Data used for AI** | "Your EMA responses, survey answers, and (if applicable) health information are processed by our AI system. No data is shared with external AI companies — all processing happens within our secure research infrastructure." |
| **Claude API usage** | "We use a commercial AI service (Anthropic Claude) to generate written summaries. Only aggregated, non-identifying data patterns are sent to this service. Your name, ID, and personal details are never included." |
| **Right to opt out** | "You can turn off AI-generated insights at any time in your app settings. This does not affect your participation in the study or your access to your own data." |

### Consent Granularity

The `consent.ai_insights_opt_in` field is a boolean, but the consent form provides granular detail. The platform also supports per-feature opt-outs:

```json
{
  "ai_insights_opt_in": true,
  "ai_preferences": {
    "show_trend_summaries": true,
    "show_strength_badges": true,
    "show_trajectory_info": false,
    "allow_claude_api_processing": true
  }
}
```

### Re-Consent Triggers

The platform triggers re-consent when:
- A new AI capability is added that was not described in the original consent.
- The AI model changes in a way that materially affects output (e.g., switching from Claude Sonnet to a different model family).
- The data types used for AI processing expand beyond original scope.
- IRB protocol amendment requires updated consent language.

Re-consent is delivered via in-app notification with the updated consent form. Data collection continues under the original consent terms until the participant re-consents or opts out.

---

## 3. Cross-Cultural Fairness Auditing

### Fairness Framework

The platform audits all AI models for demographic fairness before deployment and on a monthly cadence. The goal is to ensure that model performance and outputs do not systematically disadvantage any demographic group.

### Protected Attributes

| Attribute | Categories Audited |
|-----------|--------------------|
| Age | 18-34, 35-49, 50-64, 65-79, 80+ |
| Sex | Male, Female, Intersex |
| Race/Ethnicity | White, Black/African American, Hispanic/Latino, Asian, American Indian/Alaska Native, Native Hawaiian/Pacific Islander, Multiracial, Other |
| Education | Less than HS, HS diploma, Some college, Bachelor's, Graduate/Professional |
| Country | All countries represented in dataset |
| Income bracket | Quintiles Q1-Q5 |

### Fairness Metrics

#### Demographic Parity

For classification outputs (e.g., coupling type, risk category):

```
Demographic Parity Ratio = P(positive outcome | group A) / P(positive outcome | group B)

Acceptable range: 0.80 - 1.25 (80% rule)
```

The platform computes this for every protected attribute × every classification output.

#### Disparate Impact

```
Disparate Impact Ratio = (Selection rate for protected group) / (Selection rate for reference group)

Threshold: > 0.80 (per EEOC guidelines, adapted for research context)
```

#### Equalized Odds

For predictive models (e.g., ADRD risk):

```
True Positive Rate difference across groups < 0.05
False Positive Rate difference across groups < 0.05
```

#### Calibration

Risk scores should be equally calibrated across groups:

```
For each risk decile, observed event rate should be similar across demographic groups.
Calibration slope per group: acceptable range 0.85 - 1.15
```

### Fairness Audit Pipeline

The `scripts/fairness_audit.py` script implements the following pipeline:

```
1. Load model outputs and demographic data
2. For each protected attribute:
   a. Compute demographic parity ratio
   b. Compute disparate impact ratio
   c. Compute equalized odds (for predictive models)
   d. Compute calibration by group (for risk scores)
3. Generate report:
   a. Pass/fail for each metric × attribute combination
   b. Visualizations (grouped bar charts, calibration plots)
   c. Recommendations for remediation
4. Gate deployment:
   a. If any critical metric fails → block deployment, notify PI
   b. If any warning metric fails → flag for review, allow deployment with PI approval
```

### Audit Schedule

| Trigger | Scope |
|---------|-------|
| Pre-deployment (CI/CD) | All classification and prediction outputs |
| Monthly (scheduled) | Full audit across all models and demographic groups |
| On-demand (researcher request) | Specific model or subgroup analysis |
| Post-data-import | Fairness check on newly imported cross-cultural datasets |

### Remediation Actions

When a fairness metric fails:

1. **Investigate**: Determine whether the disparity reflects model bias or genuine population differences.
2. **Document**: Log the finding, investigation, and decision in the fairness audit trail.
3. **Remediate** (if model bias):
   - Re-weight training data
   - Add demographic covariates
   - Apply post-processing calibration
   - Re-audit after remediation
4. **Accept** (if genuine population difference):
   - Document scientific justification
   - Add contextual note to model outputs
   - PI sign-off required

---

## 4. Reproducibility Standards

### Principle

Every AI pipeline output on the WELLab platform must be fully reproducible. Given the same input data and code version, the system must produce identical results.

### Implementation

#### Pinned Dependencies

All dependencies are version-pinned with lock files:

| Language | Lock File | Tool |
|----------|-----------|------|
| Python | `requirements.txt` + `requirements-lock.txt` | pip-compile |
| Node.js | `package-lock.json` | npm |
| CDK | `package-lock.json` | npm |
| R (via rpy2) | `renv.lock` | renv |

No floating version ranges (e.g., `^1.0.0`) in production dependencies. All versions are exact (e.g., `==1.0.0`).

#### Deterministic Seeds

All stochastic operations use explicit random seeds:

```python
# Every ML pipeline sets seeds at the top
import random
import numpy as np
import torch

RANDOM_SEED = 42  # Configurable per pipeline run

random.seed(RANDOM_SEED)
np.random.seed(RANDOM_SEED)
torch.manual_seed(RANDOM_SEED)
torch.cuda.manual_seed_all(RANDOM_SEED)

# For scikit-learn
from sklearn.cluster import KMeans
km = KMeans(n_clusters=4, random_state=RANDOM_SEED)
```

The random seed is stored in the model artifact metadata and logged with every output.

#### Version-Controlled Pipelines

```
Every model output includes:
{
  "model_version": "idels-coupling-v2.1.0",     # Semantic version
  "code_commit": "abc123def456",                  # Git commit hash
  "pipeline_run_id": "run-20260405-001",          # Unique run ID
  "random_seed": 42,                              # Seed used
  "input_data_hash": "sha256:abc123...",          # Hash of input data
  "dependency_hash": "sha256:def456...",          # Hash of lock file
  "training_started_at": "2026-04-05T02:00:00Z",
  "training_completed_at": "2026-04-05T02:45:00Z"
}
```

#### Model Registry

All model artifacts are stored in S3 with the following structure:

```
s3://wellab-models-{env}/
├── emotional-dynamics/
│   ├── idels-coupling-v2.1.0/
│   │   ├── model.pkl
│   │   ├── metadata.json
│   │   ├── training_data_manifest.json
│   │   ├── fairness_audit.json
│   │   └── validation_results.json
│   └── temporal-dynamics-v1.2.0/
│       └── ...
├── health-engine/
│   └── ...
├── lifespan-trajectory/
│   └── ...
└── cognitive-health/
    └── ...
```

#### Reproducibility Verification

Monthly automated jobs re-run a subset of analyses with stored seeds and verify output matches. Discrepancies trigger an alert and investigation.

---

## 5. Individual vs Population Data Safeguards

### Principle

Individual-level data (participant-identifiable) and population-level data (aggregated, de-identified) are treated as fundamentally different and subject to different access rules, display rules, and storage rules.

### Access Rules

| Data Level | Who Can Access | How |
|------------|---------------|-----|
| Individual (own data) | The participant themselves | Participant Experience UI (authenticated, own data only) |
| Individual (research) | Authorized researchers on the IRB protocol | Researcher Dashboard (authenticated, audit-logged) |
| Individual (admin) | Platform administrators | Admin tools (authenticated, audit-logged, justification required) |
| Population (research) | Authorized researchers | Researcher Dashboard (aggregated views, no export of individual records) |
| Population (policy) | Policy viewers | Policy Dashboard (k-anonymized, no individual access possible) |

### k-Anonymity Enforcement

All population-level displays and exports enforce k-anonymity with k >= 10:

- Any demographic cell with fewer than 10 individuals is suppressed (displayed as "< 10" or omitted).
- Geographic aggregations are rolled up to the next level if a region has fewer than 10 participants.
- Cross-tabulations that would create small cells are automatically simplified.

Implementation:

```python
def enforce_k_anonymity(data: pd.DataFrame, group_cols: list, k: int = 10) -> pd.DataFrame:
    """Suppress groups with fewer than k individuals."""
    group_sizes = data.groupby(group_cols).size()
    valid_groups = group_sizes[group_sizes >= k].index
    return data[data.set_index(group_cols).index.isin(valid_groups)]
```

### Display Rules

| Rule | Participant UI | Researcher Dashboard | Policy Dashboard |
|------|---------------|---------------------|-----------------|
| Show individual scores | Own only | Yes (de-identified) | Never |
| Show individual trajectories | Own only (simplified) | Yes | Never |
| Show risk scores | Never (strength-framed narrative only) | Yes | Aggregated distribution only |
| Show comparisons to others | Never | Yes (group-level) | Yes (population-level) |
| Allow data export | Own data only | Aggregated datasets, with DUA | k-anonymized aggregates |

### Linkage Prevention

- Participant IDs are pseudonymized differently for each dashboard.
- The Policy Dashboard has no access to participant IDs whatsoever — it receives only pre-aggregated data from a dedicated Lambda function that enforces k-anonymity before returning results.
- Researcher Dashboard shows study IDs, never real names or contact information.

---

## 6. Participant Data Rights

### Rights Overview

Participants have the following rights over their data, accessible via the Participant Experience UI (Settings > My Data) or by contacting the research team:

| Right | Description | Implementation |
|-------|-------------|----------------|
| **View** | See all data the platform holds about them | "My Data" screen: browsable, searchable view of all observations, assessments, computed metrics, and AI-generated insights |
| **Export** | Download a complete copy of their data | "Export My Data" button → generates JSON + CSV archive → download link (24-hour expiry) |
| **Correct** | Request correction of inaccurate demographic data | "Edit Profile" for demographics. Observational data is immutable (corrections noted as amendments). |
| **Delete** | Request deletion of all personal data | "Delete My Data" button → confirmation flow → cascading deletion across DynamoDB + S3 + backups |
| **Restrict** | Limit processing of their data | Opt-out of specific AI features while remaining in the study |
| **Object** | Object to specific processing | Request review of how their data is being used; escalated to PI |
| **Withdraw** | Withdraw from the study entirely | "Withdraw" button → halts all data collection, triggers deletion or de-identification per protocol |

### Deletion Process

When a participant requests data deletion:

```
1. Participant clicks "Delete My Data" → confirmation screen explaining consequences
2. Participant confirms with re-authentication (password or biometric)
3. System sets participant status to "deletion_pending"
4. Immediate: Halt all data collection and AI processing for this participant
5. Within 24 hours:
   a. Delete all DynamoDB items with PK = PARTICIPANT#{id}
   b. Delete all S3 objects tagged with participant_id
   c. Remove participant from any cached model inputs
   d. Purge from CloudWatch logs (where technically feasible)
6. Within 7 days:
   a. Verify deletion across all storage tiers
   b. Send confirmation to participant
   c. Log deletion event in audit trail (without personal data)
7. Exception: De-identified data already included in published analyses
   may be retained per IRB protocol — participant is informed of this
   in the consent form.
```

### Export Format

The data export package includes:

```
wellab-export-P-20250401-0042-20260405/
├── participant_profile.json
├── observations/
│   ├── observations.csv
│   └── observations.json
├── health_records/
│   ├── health_records.csv
│   └── health_records.json
├── lifespan_assessments/
│   ├── assessments.csv
│   └── assessments.json
├── cognitive_assessments/
│   ├── assessments.csv
│   └── assessments.json
├── interventions/
│   ├── interventions.csv
│   └── interventions.json
├── computed_metrics/
│   ├── coupling_classification.json
│   ├── volatility_scores.json
│   ├── trajectory_parameters.json
│   └── risk_scores.json
├── ai_insights/
│   └── generated_insights.json
└── export_metadata.json
```

---

## 7. Model Transparency and Confidence Interval Reporting

### Transparency Principles

Every AI model output on the WELLab platform must be accompanied by sufficient information for a researcher to understand what the model did, how confident it is, and what its limitations are.

### Required Metadata for Every Model Output

| Field | Description | Example |
|-------|-------------|---------|
| `model_version` | Semantic version of the model | `idels-coupling-v2.1.0` |
| `model_type` | Human-readable model description | `Gaussian Mixture Model for coupling classification` |
| `n_observations` | Number of data points used | `284` |
| `confidence_interval` | 95% CI for primary estimate | `[0.36, 0.48]` |
| `confidence_level` | Qualitative confidence label | `high` (>0.85 posterior), `moderate` (0.70-0.85), `low` (<0.70) |
| `assumptions` | Key model assumptions | `Linearity, normally distributed residuals, stationarity` |
| `limitations` | Known limitations for this output | `Small sample size for this demographic subgroup` |
| `training_data_description` | Description of training data | `N=2,450 adults aged 40-85, 65% female, 78% White, US sample` |
| `generalizability_note` | Who this model does and does not generalize to | `Validated on US and European samples. Not validated for East Asian populations.` |
| `last_fairness_audit` | Date of most recent fairness audit | `2026-04-01` |

### Confidence Interval Standards

| Output Type | CI Method | Reporting |
|-------------|-----------|-----------|
| Regression coefficients | Profile likelihood or Wald | 95% CI reported with every coefficient |
| Coupling classification | Posterior probability | Posterior probability for each class; minimum 0.70 for assignment |
| Risk scores | Bootstrap (1000 iterations) | 95% CI around composite risk score |
| Survival curves | Greenwood's formula | 95% confidence bands on all survival curves |
| Causal effects (ATE) | Bootstrap or influence function | 95% CI + multiple estimator comparison |
| Trajectory cluster prevalence | Bootstrap | 95% CI on prevalence estimates |
| Cross-cultural comparisons | Measurement invariance tests | Metric invariance required before comparison; reported with fit indices |

### Researcher-Facing Transparency

The Researcher Dashboard includes a "Model Card" panel for every visualization:

```
┌─────────────────────────────────────────────────┐
│ Model Card: IDELS Coupling Classification       │
│                                                 │
│ Version: idels-coupling-v2.1.0                  │
│ Type: Gaussian Mixture Model (4 components)     │
│ Training data: N=2,450 (US, 2023-2025)         │
│ Fairness audit: Passed (2026-04-01)             │
│ Assumptions: Linear within-person associations, │
│   normally distributed random effects            │
│ Limitations: Not validated for samples with     │
│   < 20 observations per participant              │
│ Reproduce: [Copy Parameters] [Download Artifact]│
└─────────────────────────────────────────────────┘
```

### Participant-Facing Transparency

Participants see simplified transparency information:

- Insights include a "How we calculated this" expandable section.
- Risk-related information is never presented as certainty — always framed as "research estimates" with context.
- The word "prediction" is avoided in participant-facing text. Instead: "pattern", "tendency", "association".

### Policy-Facing Transparency

Policy dashboard outputs include:

- Methodology summary (2-3 sentences, plain language).
- Uncertainty ranges displayed as error bars or shaded confidence bands.
- Sample size and population description for every statistic.
- "What this does NOT tell us" section for key findings.
- Citation to peer-reviewed methodology papers where applicable.

### Model Deprecation

When a model version is superseded:

1. New version is deployed alongside old version for a validation period (30 days).
2. Outputs from both versions are compared for consistency.
3. Old version is marked as deprecated and removed from production endpoints.
4. Historical outputs retain their original `model_version` tag — they are never retroactively relabeled.
5. Deprecation is logged and communicated to researchers via dashboard notification.
