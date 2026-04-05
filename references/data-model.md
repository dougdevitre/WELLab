# Unified Data Model & DynamoDB Design

## Core Entities

### 1. Participants

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `participant_id` | string (PK) | Yes | UUID, e.g., `P-00001` |
| `enrollment_date` | ISO 8601 | Yes | Date of consent |
| `status` | enum | Yes | active, paused, withdrawn, completed |
| `demographics.age` | int | Yes | Age at enrollment |
| `demographics.sex` | enum | Yes | male, female, other, prefer_not_to_say |
| `demographics.ethnicity` | string | Yes | Self-identified |
| `demographics.culture_group` | string | Yes | For cross-cultural analysis |
| `demographics.education_years` | int | Yes | Completed education |
| `consent_flags` | object | Yes | Per-module consent booleans |
| `created_at` | ISO 8601 | Yes | Record creation |
| `updated_at` | ISO 8601 | Yes | Last modification |

### 2. Observations (EMA)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `observation_id` | string (PK) | Yes | UUID |
| `participant_id` | string (FK) | Yes | Links to Participant |
| `timestamp` | ISO 8601 | Yes | Moment of response |
| `positive_affect` | float (1–5) | Yes | Momentary PA |
| `negative_affect` | float (1–5) | Yes | Momentary NA |
| `life_satisfaction` | float (1–7) | No | Momentary LS |
| `context` | enum | Yes | work, home, social, transit, other |
| `social_interaction` | boolean | Yes | Currently with others |
| `response_latency_ms` | int | No | Time to complete prompt |
| `source_module` | string | Yes | `emotional_dynamics` |

### 3. HealthRecords

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `record_id` | string (PK) | Yes | UUID |
| `participant_id` | string (FK) | Yes | Links to Participant |
| `assessment_date` | date | Yes | Date of measurement |
| `bmi` | float | No | Body mass index |
| `blood_pressure_systolic` | int | No | mmHg |
| `blood_pressure_diastolic` | int | No | mmHg |
| `sleep_hours` | float | No | Average per night |
| `physical_activity_minutes` | int | No | Weekly total |
| `chronic_conditions` | string[] | No | ICD-10 codes |
| `medication_count` | int | No | Current medications |
| `source_module` | string | Yes | `health_engine` |

### 4. LifespanAssessments

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `assessment_id` | string (PK) | Yes | UUID |
| `participant_id` | string (FK) | Yes | Links to Participant |
| `assessment_wave` | int | Yes | Study wave number |
| `age_at_assessment` | float | Yes | Precise age |
| `life_satisfaction` | float (1–7) | Yes | SWLS or item |
| `eudaimonic_wellbeing` | float (1–7) | No | PWB composite |
| `hedonic_wellbeing` | float (1–5) | No | PANAS aggregate |
| `purpose_in_life` | float (1–7) | No | PIL subscale |
| `major_life_events` | string[] | No | Event codes |
| `source_module` | string | Yes | `lifespan_trajectory` |

### 5. CognitiveAssessments

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `assessment_id` | string (PK) | Yes | UUID |
| `participant_id` | string (FK) | Yes | Links to Participant |
| `assessment_date` | date | Yes | Date of testing |
| `cognitive_score` | float | Yes | Composite score |
| `memory_score` | float | No | Domain score |
| `executive_score` | float | No | Domain score |
| `language_score` | float | No | Domain score |
| `visuospatial_score` | float | No | Domain score |
| `diagnosis` | enum | No | normal, MCI, dementia |
| `source_module` | string | Yes | `cognitive_health` |

### 6. Interventions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `intervention_id` | string (PK) | Yes | UUID |
| `participant_id` | string (FK) | Yes | Links to Participant |
| `type` | enum | Yes | coaching, activity_prompt, psychoeducation, referral |
| `target_domain` | string | Yes | Which module triggered it |
| `content` | object | Yes | Intervention details |
| `delivered_at` | ISO 8601 | Yes | When sent to participant |
| `acknowledged_at` | ISO 8601 | No | When participant opened it |
| `completed_at` | ISO 8601 | No | When participant completed it |
| `outcome_rating` | float (1–5) | No | Participant rating |

---

## DynamoDB Single-Table Design

### Table: `wellab-main`

| Access Pattern | PK | SK | Example |
|---------------|----|----|---------|
| Get participant | `PARTICIPANT#<id>` | `PROFILE` | `PARTICIPANT#P-001 / PROFILE` |
| List observations | `PARTICIPANT#<id>` | `OBS#<timestamp>` | `PARTICIPANT#P-001 / OBS#2026-03-15T14:30:00Z` |
| List health records | `PARTICIPANT#<id>` | `HEALTH#<date>` | `PARTICIPANT#P-001 / HEALTH#2026-03-15` |
| List lifespan assessments | `PARTICIPANT#<id>` | `LIFESPAN#<wave>` | `PARTICIPANT#P-001 / LIFESPAN#003` |
| List cognitive assessments | `PARTICIPANT#<id>` | `COGNITIVE#<date>` | `PARTICIPANT#P-001 / COGNITIVE#2026-03-15` |
| List interventions | `PARTICIPANT#<id>` | `INTERVENTION#<timestamp>` | `PARTICIPANT#P-001 / INTERVENTION#2026-03-15T10:00:00Z` |
| Query by status (GSI1) | `STATUS#<status>` | `PARTICIPANT#<id>` | `STATUS#active / PARTICIPANT#P-001` |
| Query by cohort (GSI2) | `COHORT#<group>` | `PARTICIPANT#<id>` | `COHORT#US-midwest / PARTICIPANT#P-001` |

### GSIs
- **GSI1**: `GSI1PK` (status) + `GSI1SK` (participant_id) — for filtering by enrollment status
- **GSI2**: `GSI2PK` (culture_group) + `GSI2SK` (participant_id) — for cross-cultural queries

---

## Data Lifecycle

1. **Collection**: Mobile EMA → API Gateway → Lambda → DynamoDB
2. **Processing**: DynamoDB Streams → Lambda → compute derived metrics → write back
3. **Analysis**: Glue ETL → S3 (Parquet) → SageMaker notebooks / ML pipelines
4. **Archival**: S3 lifecycle policy → Glacier after 2 years; DynamoDB TTL for ephemeral data
5. **Deletion**: Participant withdrawal triggers cascade delete across all SK patterns

---

## JSON Schema Example: Observation

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["participant_id", "timestamp", "positive_affect", "negative_affect", "context", "social_interaction", "source_module"],
  "properties": {
    "participant_id": { "type": "string", "pattern": "^P-\\d{5}$" },
    "timestamp": { "type": "string", "format": "date-time" },
    "positive_affect": { "type": "number", "minimum": 1, "maximum": 5 },
    "negative_affect": { "type": "number", "minimum": 1, "maximum": 5 },
    "life_satisfaction": { "type": "number", "minimum": 1, "maximum": 7 },
    "context": { "type": "string", "enum": ["work", "home", "social", "transit", "other"] },
    "social_interaction": { "type": "boolean" },
    "source_module": { "type": "string", "const": "emotional_dynamics" }
  }
}
```
