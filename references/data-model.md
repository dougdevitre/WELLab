# Unified Data Model + DynamoDB Design

> WELLab AI-Enabled Research & Impact Platform
> Washington University in St. Louis

This document defines the unified data model for the WELLab platform, including core entity specifications, DynamoDB single-table design patterns, JSON schema examples, and the full data lifecycle.

---

## Table of Contents

1. [Core Entities](#core-entities)
2. [Entity Specifications](#entity-specifications)
3. [DynamoDB Single-Table Design](#dynamodb-single-table-design)
4. [JSON Schema Examples](#json-schema-examples)
5. [Data Lifecycle](#data-lifecycle)

---

## Core Entities

| Entity | Description | Primary Module |
|--------|-------------|----------------|
| **Participant** | Enrolled individual with consent and demographics | All modules |
| **Observation** | Single EMA / experience sampling response | Emotional Dynamics Engine |
| **HealthRecord** | Physical health data point (condition, biomarker, medication) | Health Engine |
| **LifespanAssessment** | Periodic wellbeing assessment (annual/biennial) | Lifespan Trajectory Engine |
| **CognitiveAssessment** | Cognitive test result (MoCA, MMSE, custom battery) | Cognitive Health Engine |
| **Intervention** | Assigned or completed intervention record | All modules |

---

## Entity Specifications

### Participant

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `participant_id` | String | Yes | Unique identifier (format: `P-YYYYMMDD-NNNN`) |
| `enrollment_date` | ISO 8601 datetime | Yes | Date of consent and enrollment |
| `status` | Enum | Yes | `active`, `paused`, `withdrawn`, `completed` |
| `demographics.age` | Integer | Yes | Age at enrollment |
| `demographics.date_of_birth` | ISO 8601 date | Yes | Used for age calculations |
| `demographics.sex` | Enum | Yes | `male`, `female`, `intersex`, `prefer_not_to_say` |
| `demographics.gender_identity` | String | No | Self-reported gender identity |
| `demographics.race_ethnicity` | Array[String] | Yes | Multi-select, standardized categories |
| `demographics.education_years` | Integer | No | Years of formal education |
| `demographics.education_level` | Enum | No | `less_than_hs`, `hs_diploma`, `some_college`, `bachelors`, `masters`, `doctorate` |
| `demographics.country` | String (ISO 3166) | Yes | Country of residence |
| `demographics.primary_language` | String (ISO 639-1) | Yes | Primary language |
| `demographics.income_bracket` | Enum | No | Anonymized income quintile |
| `consent.irb_protocol_id` | String | Yes | Active IRB protocol number |
| `consent.consent_version` | String | Yes | Version of consent form signed |
| `consent.consent_date` | ISO 8601 date | Yes | Date consent was signed |
| `consent.data_sharing_level` | Enum | Yes | `individual_only`, `research_team`, `de_identified_public` |
| `consent.ai_insights_opt_in` | Boolean | Yes | Whether participant consented to AI-generated insights |
| `coupling_type` | Enum | No | IDELS classification: `positive`, `negative`, `decoupled`, `complex` |
| `trajectory_cluster_id` | Integer | No | Assigned lifespan trajectory cluster |
| `adrd_risk_score` | Float | No | Composite ADRD risk (0-100) |
| `created_at` | ISO 8601 datetime | Yes | Record creation timestamp |
| `updated_at` | ISO 8601 datetime | Yes | Last modification timestamp |

**Indexes**: Primary key (`participant_id`), GSI on `status`, GSI on `demographics.country`, GSI on `coupling_type`.

**Relationships**: One-to-many with Observations, HealthRecords, LifespanAssessments, CognitiveAssessments, Interventions.

---

### Observation (EMA)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `observation_id` | String | Yes | Unique ID (format: `OBS-YYYYMMDD-HHMMSS-PNNNN`) |
| `participant_id` | String | Yes | FK to Participant |
| `timestamp` | ISO 8601 datetime | Yes | Moment of response |
| `source_module` | String | Yes | Always `emotional_dynamics` |
| `sampling_type` | Enum | Yes | `signal_contingent`, `interval_contingent`, `event_contingent` |
| `positive_affect` | Float (1-5) | Yes | Composite positive affect score |
| `negative_affect` | Float (1-5) | Yes | Composite negative affect score |
| `life_satisfaction` | Float (1-5) | Yes | Momentary life satisfaction rating |
| `affect_items` | Object | No | Individual affect items (e.g., `happy`, `sad`, `anxious`, `calm`) |
| `eudaimonic_items` | Object | No | Purpose, meaning, engagement items |
| `context.activity` | String | No | Current activity category |
| `context.social` | Enum | No | `alone`, `with_partner`, `with_friends`, `with_family`, `with_coworkers`, `with_strangers` |
| `context.location_type` | Enum | No | `home`, `work`, `outdoors`, `transit`, `public_place`, `other` |
| `response_latency_ms` | Integer | No | Time from prompt to submission |
| `prompt_id` | String | No | Reference to the sampling schedule prompt |
| `data_quality_flags` | Array[String] | No | e.g., `rapid_response`, `identical_to_previous`, `outside_schedule_window` |
| `created_at` | ISO 8601 datetime | Yes | Record creation timestamp |

**Indexes**: Primary key (`participant_id` + `timestamp`), GSI on `observation_id`, GSI on `sampling_type`.

---

### HealthRecord

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `record_id` | String | Yes | Unique ID (format: `HR-YYYYMMDD-PNNNN-NNN`) |
| `participant_id` | String | Yes | FK to Participant |
| `timestamp` | ISO 8601 datetime | Yes | Date of record |
| `source_module` | String | Yes | Always `health_engine` |
| `record_type` | Enum | Yes | `condition`, `biomarker`, `medication`, `procedure`, `self_report` |
| `category` | String | Yes | e.g., `cardiovascular`, `metabolic`, `musculoskeletal`, `mental_health` |
| `name` | String | Yes | Condition/biomarker/medication name |
| `value` | Float | No | Numeric value (for biomarkers) |
| `unit` | String | No | Measurement unit |
| `reference_range` | Object | No | `{ "low": 0.5, "high": 1.2 }` |
| `icd10_code` | String | No | ICD-10 diagnosis code |
| `severity` | Enum | No | `mild`, `moderate`, `severe` |
| `status` | Enum | Yes | `active`, `resolved`, `chronic` |
| `self_rated_health` | Integer (1-5) | No | Self-rated health score |
| `functional_limitations` | Array[String] | No | List of ADL/IADL limitations |
| `data_source` | Enum | Yes | `clinical_import`, `self_report`, `wearable`, `lab_result` |
| `created_at` | ISO 8601 datetime | Yes | Record creation timestamp |

**Indexes**: Primary key (`participant_id` + `timestamp`), GSI on `record_type`, GSI on `category`.

---

### LifespanAssessment

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `assessment_id` | String | Yes | Unique ID (format: `LA-YYYYMMDD-PNNNN-NN`) |
| `participant_id` | String | Yes | FK to Participant |
| `timestamp` | ISO 8601 datetime | Yes | Assessment date |
| `source_module` | String | Yes | Always `lifespan_trajectory` |
| `wave` | Integer | Yes | Assessment wave number |
| `age_at_assessment` | Float | Yes | Age at time of assessment |
| `life_satisfaction` | Float | No | SWLS or similar composite score |
| `purpose_in_life` | Float | No | Purpose/meaning subscale score |
| `positive_affect` | Float | No | Trait-level positive affect |
| `negative_affect` | Float | No | Trait-level negative affect |
| `social_wellbeing` | Float | No | Social connectedness / integration score |
| `autonomy` | Float | No | Psychological wellbeing — autonomy subscale |
| `personal_growth` | Float | No | Psychological wellbeing — growth subscale |
| `environmental_mastery` | Float | No | Psychological wellbeing — mastery subscale |
| `self_acceptance` | Float | No | Psychological wellbeing — self-acceptance |
| `positive_relations` | Float | No | Psychological wellbeing — positive relations |
| `hedonic_composite` | Float | No | Computed hedonic wellbeing composite |
| `eudaimonic_composite` | Float | No | Computed eudaimonic wellbeing composite |
| `dataset_source` | String | No | For cross-cultural: `HRS`, `SHARE`, `ELSA`, `CHARLS`, `WELLab_primary` |
| `country` | String (ISO 3166) | No | Country of data collection |
| `data_quality_score` | Float (0-1) | No | Completeness and validity score |
| `created_at` | ISO 8601 datetime | Yes | Record creation timestamp |

**Indexes**: Primary key (`participant_id` + `wave`), GSI on `dataset_source`, GSI on `country`.

---

### CognitiveAssessment

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `assessment_id` | String | Yes | Unique ID (format: `COG-YYYYMMDD-PNNNN-NN`) |
| `participant_id` | String | Yes | FK to Participant |
| `timestamp` | ISO 8601 datetime | Yes | Assessment date |
| `source_module` | String | Yes | Always `cognitive_health` |
| `test_type` | Enum | Yes | `moca`, `mmse`, `custom_battery`, `tics`, `word_recall` |
| `total_score` | Float | Yes | Overall score |
| `max_possible_score` | Float | Yes | Maximum achievable score |
| `percentile` | Float | No | Age-normed percentile |
| `subscores` | Object | No | Domain-specific subscores |
| `subscores.memory` | Float | No | Memory domain score |
| `subscores.executive_function` | Float | No | Executive function score |
| `subscores.attention` | Float | No | Attention / processing speed |
| `subscores.language` | Float | No | Language domain score |
| `subscores.visuospatial` | Float | No | Visuospatial ability score |
| `diagnosis` | Enum | No | `normal`, `mci`, `mild_dementia`, `moderate_dementia`, `severe_dementia` |
| `diagnosis_date` | ISO 8601 date | No | Date of clinical diagnosis (if applicable) |
| `diagnosis_source` | Enum | No | `clinical`, `algorithmic`, `self_report` |
| `inflection_detected` | Boolean | No | Whether changepoint detected in trajectory |
| `inflection_date` | ISO 8601 date | No | Estimated inflection point date |
| `assessor_type` | Enum | Yes | `in_person`, `telephone`, `digital`, `proxy` |
| `created_at` | ISO 8601 datetime | Yes | Record creation timestamp |

**Indexes**: Primary key (`participant_id` + `timestamp`), GSI on `test_type`, GSI on `diagnosis`.

---

### Intervention

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `intervention_id` | String | Yes | Unique ID (format: `INT-YYYYMMDD-PNNNN-NN`) |
| `participant_id` | String | Yes | FK to Participant |
| `source_module` | String | Yes | Originating module |
| `intervention_type` | Enum | Yes | `activity_prompt`, `coaching_session`, `psychoeducation`, `social_connection`, `mindfulness`, `physical_activity`, `cognitive_training` |
| `target_construct` | String | Yes | e.g., `purpose_in_life`, `positive_affect`, `social_engagement` |
| `assigned_at` | ISO 8601 datetime | Yes | When intervention was assigned |
| `started_at` | ISO 8601 datetime | No | When participant began |
| `completed_at` | ISO 8601 datetime | No | When participant completed |
| `status` | Enum | Yes | `assigned`, `in_progress`, `completed`, `skipped`, `expired` |
| `dosage` | Object | No | `{ "sessions": 8, "frequency": "weekly", "duration_minutes": 30 }` |
| `adherence_rate` | Float (0-1) | No | Proportion of dosage completed |
| `pre_scores` | Object | No | Pre-intervention outcome scores |
| `post_scores` | Object | No | Post-intervention outcome scores |
| `effect_size` | Float | No | Computed within-person effect (Cohen's d) |
| `participant_rating` | Integer (1-5) | No | Participant satisfaction rating |
| `notes` | String | No | Free-text notes (encrypted at rest) |
| `created_at` | ISO 8601 datetime | Yes | Record creation timestamp |

**Indexes**: Primary key (`participant_id` + `assigned_at`), GSI on `intervention_type`, GSI on `status`.

---

## DynamoDB Single-Table Design

The platform uses a single-table design for DynamoDB to minimize the number of tables, reduce costs, and enable efficient access patterns through composite keys and Global Secondary Indexes (GSIs).

### Table: `wellab-platform-{env}`

| Attribute | Type | Description |
|-----------|------|-------------|
| `PK` | String | Partition key |
| `SK` | String | Sort key |
| `GSI1PK` | String | Global Secondary Index 1 — partition key |
| `GSI1SK` | String | Global Secondary Index 1 — sort key |
| `GSI2PK` | String | Global Secondary Index 2 — partition key |
| `GSI2SK` | String | Global Secondary Index 2 — sort key |
| `entity_type` | String | Discriminator: `PARTICIPANT`, `OBSERVATION`, `HEALTH_RECORD`, `LIFESPAN_ASSESSMENT`, `COGNITIVE_ASSESSMENT`, `INTERVENTION` |
| `data` | Map | Entity-specific attributes |
| `ttl` | Number | Optional TTL for archival |

### PK/SK Patterns

| Entity | PK | SK | Purpose |
|--------|----|----|---------|
| Participant | `PARTICIPANT#P-20250401-0042` | `PROFILE` | Participant profile |
| Participant metadata | `PARTICIPANT#P-20250401-0042` | `META#consent` | Consent record |
| Observation | `PARTICIPANT#P-20250401-0042` | `OBS#2026-04-05T14:32:00Z` | Single EMA observation |
| Health record | `PARTICIPANT#P-20250401-0042` | `HEALTH#2026-04-05T10:00:00Z#HR-001` | Health data point |
| Lifespan assessment | `PARTICIPANT#P-20250401-0042` | `LIFESPAN#W08#2026-04-01` | Wave 8 assessment |
| Cognitive assessment | `PARTICIPANT#P-20250401-0042` | `COGNITIVE#2026-04-05T09:00:00Z` | Cognitive test result |
| Intervention | `PARTICIPANT#P-20250401-0042` | `INTERVENTION#2026-03-15T08:00:00Z` | Intervention record |
| Computed metric | `PARTICIPANT#P-20250401-0042` | `METRIC#volatility#2026-04` | Monthly volatility score |
| Coupling result | `PARTICIPANT#P-20250401-0042` | `METRIC#coupling#2026-Q1` | Quarterly coupling classification |
| Risk score | `PARTICIPANT#P-20250401-0042` | `METRIC#adrd_risk#2026-04` | Monthly ADRD risk score |
| Trajectory cluster | `PARTICIPANT#P-20250401-0042` | `METRIC#trajectory#v2.0.0` | Cluster assignment |

### GSI Patterns

| GSI | PK | SK | Use Case |
|-----|----|----|----------|
| GSI1 | `entity_type` | `created_at` | List all entities of a type, sorted by creation date |
| GSI2 | `STATUS#active` | `participant_id` | Find all active participants |
| GSI2 | `COUPLING#positive` | `participant_id` | Find participants by coupling type |
| GSI2 | `CLUSTER#2` | `participant_id` | Find participants by trajectory cluster |
| GSI2 | `RISK#high` | `participant_id` | Find high-risk participants |

### Access Patterns

| Access Pattern | Key Condition | Index |
|----------------|---------------|-------|
| Get participant profile | PK = `PARTICIPANT#id`, SK = `PROFILE` | Table |
| Get all observations for participant | PK = `PARTICIPANT#id`, SK begins_with `OBS#` | Table |
| Get observations in date range | PK = `PARTICIPANT#id`, SK between `OBS#start` and `OBS#end` | Table |
| Get all health records | PK = `PARTICIPANT#id`, SK begins_with `HEALTH#` | Table |
| Get latest cognitive assessment | PK = `PARTICIPANT#id`, SK begins_with `COGNITIVE#`, ScanIndexForward = false, Limit = 1 | Table |
| Get all computed metrics | PK = `PARTICIPANT#id`, SK begins_with `METRIC#` | Table |
| List active participants | GSI2PK = `STATUS#active` | GSI2 |
| Find participants by coupling type | GSI2PK = `COUPLING#positive` | GSI2 |
| List all observations by date | GSI1PK = `OBSERVATION`, GSI1SK = timestamp | GSI1 |

---

## JSON Schema Examples

### Participant (DynamoDB Item)

```json
{
  "PK": { "S": "PARTICIPANT#P-20250401-0042" },
  "SK": { "S": "PROFILE" },
  "GSI1PK": { "S": "PARTICIPANT" },
  "GSI1SK": { "S": "2025-04-01T09:30:00Z" },
  "GSI2PK": { "S": "STATUS#active" },
  "GSI2SK": { "S": "P-20250401-0042" },
  "entity_type": { "S": "PARTICIPANT" },
  "data": {
    "M": {
      "participant_id": { "S": "P-20250401-0042" },
      "enrollment_date": { "S": "2025-04-01T09:30:00Z" },
      "status": { "S": "active" },
      "demographics": {
        "M": {
          "age": { "N": "54" },
          "date_of_birth": { "S": "1971-08-15" },
          "sex": { "S": "female" },
          "race_ethnicity": { "L": [{ "S": "white" }] },
          "education_years": { "N": "18" },
          "education_level": { "S": "masters" },
          "country": { "S": "US" },
          "primary_language": { "S": "en" },
          "income_bracket": { "S": "Q4" }
        }
      },
      "consent": {
        "M": {
          "irb_protocol_id": { "S": "IRB-2025-0142" },
          "consent_version": { "S": "3.1" },
          "consent_date": { "S": "2025-04-01" },
          "data_sharing_level": { "S": "research_team" },
          "ai_insights_opt_in": { "BOOL": true }
        }
      },
      "coupling_type": { "S": "positive" },
      "trajectory_cluster_id": { "N": "2" },
      "adrd_risk_score": { "N": "28" }
    }
  },
  "created_at": { "S": "2025-04-01T09:30:00Z" },
  "updated_at": { "S": "2026-04-05T12:00:00Z" }
}
```

### Observation (DynamoDB Item)

```json
{
  "PK": { "S": "PARTICIPANT#P-20250401-0042" },
  "SK": { "S": "OBS#2026-04-05T14:32:00Z" },
  "GSI1PK": { "S": "OBSERVATION" },
  "GSI1SK": { "S": "2026-04-05T14:32:00Z" },
  "entity_type": { "S": "OBSERVATION" },
  "data": {
    "M": {
      "observation_id": { "S": "OBS-20260405-143200-P0042" },
      "participant_id": { "S": "P-20250401-0042" },
      "timestamp": { "S": "2026-04-05T14:32:00Z" },
      "source_module": { "S": "emotional_dynamics" },
      "sampling_type": { "S": "signal_contingent" },
      "positive_affect": { "N": "3.8" },
      "negative_affect": { "N": "1.2" },
      "life_satisfaction": { "N": "4.1" },
      "context": {
        "M": {
          "activity": { "S": "working" },
          "social": { "S": "alone" },
          "location_type": { "S": "home" }
        }
      },
      "response_latency_ms": { "N": "12400" },
      "data_quality_flags": { "L": [] }
    }
  },
  "created_at": { "S": "2026-04-05T14:32:00Z" }
}
```

### Cognitive Assessment (DynamoDB Item)

```json
{
  "PK": { "S": "PARTICIPANT#P-20250401-0042" },
  "SK": { "S": "COGNITIVE#2026-04-05T09:00:00Z" },
  "GSI1PK": { "S": "COGNITIVE_ASSESSMENT" },
  "GSI1SK": { "S": "2026-04-05T09:00:00Z" },
  "entity_type": { "S": "COGNITIVE_ASSESSMENT" },
  "data": {
    "M": {
      "assessment_id": { "S": "COG-20260405-P0042-01" },
      "participant_id": { "S": "P-20250401-0042" },
      "test_type": { "S": "moca" },
      "total_score": { "N": "27" },
      "max_possible_score": { "N": "30" },
      "percentile": { "N": "72" },
      "subscores": {
        "M": {
          "memory": { "N": "4" },
          "executive_function": { "N": "4" },
          "attention": { "N": "6" },
          "language": { "N": "5" },
          "visuospatial": { "N": "4" }
        }
      },
      "diagnosis": { "S": "normal" },
      "inflection_detected": { "BOOL": false },
      "assessor_type": { "S": "in_person" }
    }
  },
  "created_at": { "S": "2026-04-05T09:00:00Z" }
}
```

---

## Data Lifecycle

### Stage 1: Collection

```
Participant (mobile app / web / phone interview)
  → API Gateway (HTTPS, TLS 1.2+)
  → Lambda validation function
  → DynamoDB (immediate write)
  → DynamoDB Stream (triggers processing)
```

- All incoming data is validated against JSON schemas before persistence.
- Timestamps are normalized to UTC.
- `participant_id` is verified against active consent records.
- Data quality flags are applied (e.g., response latency checks, range validation).

### Stage 2: Processing

```
DynamoDB Stream event
  → Lambda processing function
  → Compute derived metrics (volatility, coupling coefficients)
  → Write computed metrics back to DynamoDB
  → Trigger alerts if thresholds exceeded
  → Push to S3 (Parquet) for batch analytics
```

- Observations are enriched with computed fields (z-scores, rolling averages).
- Batch jobs (Step Functions) run nightly for model re-estimation.
- All processing is idempotent — reprocessing the same event produces the same result.

### Stage 3: Analysis

```
S3 Parquet files
  → SageMaker Processing Jobs / SageMaker Endpoints
  → Model training (growth curves, survival models, causal DAGs)
  → Model artifacts stored in S3 with version tags
  → Results written to DynamoDB (computed metrics)
  → Dashboard APIs serve results
```

- Model training jobs are triggered by data volume thresholds or scheduled cadence.
- All model artifacts are versioned (`model_version` field in every output).
- Fairness audits run automatically post-training (see `references/ethics.md`).

### Stage 4: Archival

```
DynamoDB items > 24 months old
  → DynamoDB TTL or scheduled export
  → S3 Glacier Deep Archive
  → Retain indefinitely per IRB protocol
  → Available for re-analysis via S3 restore
```

- Active data (< 24 months) remains in DynamoDB for low-latency access.
- Archived data is exported to S3 in Parquet format with full metadata.
- Deletion requests (participant data rights) propagate to all storage tiers.
- Archival jobs run weekly and produce audit logs.

### Data Retention Policy

| Data Type | Active Storage | Archive Storage | Deletion Policy |
|-----------|---------------|-----------------|-----------------|
| EMA observations | 24 months in DynamoDB | S3 Glacier indefinitely | On participant request or IRB closure |
| Health records | 24 months in DynamoDB | S3 Glacier indefinitely | On participant request or IRB closure |
| Computed metrics | 24 months in DynamoDB | S3 Glacier indefinitely | On participant request or IRB closure |
| Model artifacts | All versions in S3 Standard | Older versions to S3 IA after 12 months | Retained for reproducibility |
| Audit logs | 12 months in CloudWatch | S3 Glacier for 7 years | Regulatory minimum |
| De-identified datasets | S3 Standard | Indefinitely | Per data sharing agreement |
