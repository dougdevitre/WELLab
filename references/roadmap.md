# Roadmap — Phases and Future Plans

> WELLab AI-Enabled Research & Impact Platform
> Washington University in St. Louis

This document outlines the phased development roadmap for the WELLab platform, from the currently active core platform through long-term vision for national-scale wellbeing science infrastructure.

---

## Table of Contents

1. [Phase 1 — Core Platform (Active)](#phase-1--core-platform-active)
2. [Phase 2 — Wearable Integration (Planning)](#phase-2--wearable-integration-planning)
3. [Phase 3 — AI Coaching Agents (Research)](#phase-3--ai-coaching-agents-research)
4. [Phase 4 — Cognitive Resilience Training (Concept)](#phase-4--cognitive-resilience-training-concept)
5. [Phase 5 — National Wellbeing Surveillance + Clinical Trial Automation (Vision)](#phase-5--national-wellbeing-surveillance--clinical-trial-automation-vision)
6. [Cross-Phase Dependencies](#cross-phase-dependencies)

---

## Phase 1 — Core Platform (Active)

**Status**: Active development
**Timeline**: Current
**Goal**: Establish the foundational AI-enabled research platform with four modules, unified data model, and three dashboard UIs.

### Deliverables

| Deliverable | Status | Description |
|-------------|--------|-------------|
| Real-Time Emotional Dynamics Engine | In progress | EMA collection, IDELS coupling classification, volatility scoring |
| Behavioral + Physiological Health Engine | In progress | Causal inference with DoWhy, longitudinal regression, bidirectional models |
| Lifespan Trajectory Engine | In progress | Growth curves, trajectory clustering, cross-cultural comparison |
| Cognitive Health & Dementia Prevention Engine | In progress | Survival analysis, risk stratification, protective factor identification |
| Unified Data Model (DynamoDB) | In progress | Single-table design, all 6 core entities, GSI patterns |
| Participant Experience UI | In progress | Mobile-first wellbeing dashboard with strength-framed insights |
| Researcher Dashboard | In progress | Coupling heatmaps, trajectory clusters, causal DAGs, data quality |
| Policy Dashboard | In progress | Population maps, risk distribution, intervention ROI |
| Claude API Integration | In progress | Natural language insight generation for all three audiences |
| Fairness Audit Pipeline | In progress | Demographic parity + disparate impact checks, pre-deployment gates |
| AWS Infrastructure (CDK) | In progress | Lambda, DynamoDB, S3, API Gateway, SageMaker, Cognito |
| CI/CD Pipeline | In progress | GitHub Actions with test, lint, fairness audit, deploy |

### Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| EMA observation collection | > 85% compliance rate across active participants | Observations received / prompts sent |
| IDELS coupling classification accuracy | > 80% agreement with expert-labeled validation set | Classification accuracy on held-out data |
| Causal model robustness | All refutation tests pass for primary analyses | DoWhy refutation suite |
| Trajectory model fit | Entropy > 0.80, BIC-optimal cluster count stable across bootstrap samples | Model selection diagnostics |
| ADRD risk score calibration | Calibration slope 0.85-1.15 across demographic groups | Observed vs predicted event rates |
| API response time (p95) | < 500ms | CloudWatch metrics |
| Dashboard accessibility | WCAG 2.1 AA compliance | Automated (axe-core) + manual audit |
| Fairness audit | All metrics within acceptable range for all protected attributes | Fairness audit pipeline |
| Data pipeline uptime | > 99.5% | CloudWatch alarms |
| Participant satisfaction | > 4.0/5.0 on app usability survey | Quarterly participant survey |

---

## Phase 2 — Wearable Integration (Planning)

**Status**: Planning
**Timeline**: Following Phase 1 stabilization
**Goal**: Integrate continuous physiological data from consumer wearable devices to enrich wellbeing models with objective health markers.

### Scope

| Component | Description |
|-----------|-------------|
| **Apple HealthKit Integration** | Import heart rate, HRV, sleep stages, step count, active energy, mindful minutes via HealthKit API on iOS |
| **Fitbit Integration** | Import heart rate, sleep, activity, SpO2 via Fitbit Web API (OAuth 2.0) |
| **Garmin Integration** | Import heart rate, stress score, Body Battery, sleep, activity via Garmin Connect API |
| **Unified Wearable Data Model** | Harmonize data across devices into common schema (timestamps, units, sampling rates) |
| **Physiological Wellbeing Markers** | Compute HRV-based stress index, sleep quality composite, activity sufficiency score |
| **Real-Time Fusion** | Combine EMA self-report with concurrent physiological data for context-enriched modeling |
| **Privacy Controls** | Granular opt-in per data type (heart rate: yes, location: no). Data stays on-platform. |

### Technical Approach

```
Wearable device → Mobile app (React Native)
  → HealthKit / Fitbit API / Garmin API (on-device or server-side)
  → Platform API (POST /api/v1/wearable/sync)
  → Lambda processing (harmonization, quality checks)
  → DynamoDB (new SK pattern: WEARABLE#2026-04-05T14:32:00Z)
  → Integration with existing AI modules
```

### New Capabilities

- **Emotion-Physiology Coupling**: Extend IDELS to include HRV and physiological arousal as predictors of satisfaction.
- **Sleep-Wellbeing Models**: Test whether sleep quality mediates or moderates the wellbeing-health relationship.
- **Activity-Cognition Models**: Incorporate objective activity data into ADRD risk stratification.
- **Real-Time Context Enrichment**: Automatically tag EMA observations with concurrent physiological state.

### IRB Considerations

- Separate consent addendum for wearable data collection.
- Clear explanation of what data is collected and what is not (e.g., no GPS location, no raw accelerometer).
- Data minimization: only import metrics relevant to wellbeing research, not full device dumps.

### Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Wearable enrollment rate | > 50% of active participants opt in | Enrollment counts |
| Data sync reliability | > 95% of expected syncs received within 24 hours | Sync logs |
| Physiological data quality | > 90% of synced data passes quality checks | Quality pipeline |
| Model improvement | Incremental R-squared improvement > 0.03 when adding physiological predictors | Model comparison |
| Participant burden | No decrease in EMA compliance after wearable integration | Compliance tracking |

---

## Phase 3 — AI Coaching Agents (Research)

**Status**: Research
**Timeline**: Following Phase 2
**Goal**: Develop and evaluate AI-powered coaching agents that deliver personalized wellbeing interventions grounded in WELLab research findings.

### Coaching Domains

| Domain | Description | Evidence Base |
|--------|-------------|---------------|
| **Purpose & Meaning** | Guided exercises to explore, articulate, and act on sense of purpose. Values clarification, goal-setting, meaningful activity planning. | Purpose in life research showing protective effects on cognitive decline, mortality, and health behaviors |
| **Emotion Regulation** | Evidence-based strategies for managing emotional variability. Cognitive reappraisal, mindfulness, behavioral activation, situation selection. | Emotion dynamics research showing that regulation patterns predict long-term wellbeing trajectories |
| **Social Connection** | Structured activities to build and maintain meaningful social relationships. Social skill practice, connection planning, relationship quality reflection. | Social wellbeing research linking connection quality to health outcomes and cognitive protection |

### Architecture

```
Participant interaction
  → AI Coaching Agent (Claude API with specialized system prompts)
  → Personalization layer (participant's coupling type, trajectory cluster, risk profile)
  → Session management (track progress, dosage, exercises completed)
  → Outcome measurement (pre/post EMA, targeted assessments)
  → Feedback loop to research models
```

### Key Design Principles

- **Human-in-the-loop**: Coaching agents are supervised by human researchers. Escalation to human coach for crisis situations, complex needs, or participant request.
- **Evidence-based content**: All coaching exercises are derived from published, peer-reviewed interventions. No AI-generated therapeutic content without research backing.
- **Personalized but bounded**: Agent personalizes delivery style, timing, and emphasis based on participant data. Agent does not improvise new therapeutic techniques.
- **Not therapy**: Coaching agents are explicitly framed as research tools for wellbeing enhancement, not as therapy or clinical treatment. Clear disclaimers and crisis resources provided.
- **Evaluated as intervention**: Coaching agent effectiveness is evaluated via randomized controlled trials within the platform.

### Evaluation Framework

Each coaching domain is tested via within-platform RCT:

```
Randomization:
  Treatment: AI coaching (8 sessions over 4 weeks) + usual EMA
  Control: Usual EMA only (waitlist control)

Primary outcomes:
  - Domain-specific wellbeing score (purpose, emotion regulation, social connection)
  - Overall life satisfaction

Secondary outcomes:
  - EMA-measured affect trajectories
  - Coupling type stability
  - Engagement metrics (session completion, satisfaction ratings)

Analysis:
  - Intent-to-treat
  - Mixed-effects models (time × condition)
  - Effect size estimation (Cohen's d)
  - Moderation by coupling type, trajectory cluster, demographic factors
```

### Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Coaching engagement | > 70% session completion rate | Intervention records |
| Effect size (purpose) | Cohen's d > 0.3 (small-medium) | Pre-post assessment comparison |
| Effect size (emotion regulation) | Cohen's d > 0.3 | Pre-post assessment comparison |
| Effect size (social connection) | Cohen's d > 0.3 | Pre-post assessment comparison |
| Participant satisfaction | > 4.0/5.0 | Post-coaching survey |
| Safety | Zero adverse events attributable to coaching | Adverse event monitoring |
| Scalability | Agent can handle 500+ concurrent coaching relationships | Load testing |

---

## Phase 4 — Cognitive Resilience Training (Concept)

**Status**: Concept
**Timeline**: Following Phase 3 research results
**Goal**: Develop digital cognitive training modules that target modifiable protective factors for ADRD, personalized based on individual risk profiles from the Cognitive Health Engine.

### Concept Overview

Building on Phase 1's risk stratification and Phase 3's coaching agent infrastructure, cognitive resilience training modules would provide:

| Module | Description | Target Factor |
|--------|-------------|---------------|
| **Purpose Activation** | Structured purpose-finding program combining coaching agent with real-world activities | Purpose in life (strongest protective factor) |
| **Cognitive Stimulation** | Adaptive cognitive exercises targeting executive function, memory, and processing speed | Cognitive reserve |
| **Social Engagement Protocol** | Facilitated social activities and connection-building exercises | Social engagement |
| **Physical Activity Integration** | Personalized activity plans based on wearable data and health status | Physical activity |
| **Mindfulness & Stress Reduction** | Guided mindfulness practice with physiological biofeedback (wearable) | Stress and inflammation |

### Personalization Approach

```
Participant's risk profile (Cognitive Health Engine)
  → Identify top 3 modifiable factors with most improvement potential
  → Select and sequence relevant training modules
  → Adapt difficulty and content based on cognitive assessment baseline
  → Monitor progress via EMA + cognitive re-assessment
  → Adjust training plan based on response
```

### Research Design

- Multi-site RCT with adaptive randomization
- Factorial design testing individual modules and combinations
- Primary endpoint: Rate of cognitive decline over 2-5 years
- Secondary endpoints: ADRD incidence, wellbeing trajectories, health outcomes
- Powered for demographic subgroup analyses

### Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Training adherence | > 60% module completion over 12 months | Platform engagement data |
| Cognitive trajectory improvement | Slower rate of decline (slope difference > 0.1 SD/year) | Longitudinal cognitive assessments |
| Risk score reduction | > 5-point reduction in composite risk score after 12 months | Pre-post risk score comparison |
| Wellbeing improvement | Significant improvement in targeted wellbeing domains | Lifespan assessments |
| Generalizability | Effects replicate across at least 2 demographic subgroups | Subgroup analysis |

---

## Phase 5 — National Wellbeing Surveillance + Clinical Trial Automation (Vision)

**Status**: Vision
**Timeline**: Long-term (5+ years)
**Goal**: Scale the WELLab platform to support national-level wellbeing monitoring and enable automated, adaptive clinical trials for wellbeing interventions.

### National Wellbeing Surveillance

| Component | Description |
|-----------|-------------|
| **Wellbeing Index** | Composite national wellbeing indicator computed from harmonized data across participating sites, updated quarterly |
| **Geographic Dashboard** | County- and state-level wellbeing maps with drill-down to demographic subgroups |
| **Trend Monitoring** | Automated detection of wellbeing trend shifts (seasonal, economic, policy-related) |
| **Disparity Tracking** | Continuous monitoring of wellbeing disparities across race/ethnicity, income, education, geography |
| **Policy Impact Evaluation** | Pre/post analysis framework for evaluating the impact of policy changes on population wellbeing |
| **Data Federation** | Secure multi-site data sharing without centralizing raw data (federated learning / analytics) |
| **Public Reporting** | Annual "State of Wellbeing" report generated from platform data, reviewed by advisory board |

### Clinical Trial Automation

| Component | Description |
|-----------|-------------|
| **Adaptive Trial Design** | Platform-native support for adaptive randomization, sequential analysis, and futility stopping rules |
| **Digital Endpoint Collection** | EMA, wearable, and cognitive assessments collected via platform — no separate trial infrastructure needed |
| **Automated Monitoring** | Real-time trial dashboards with enrollment tracking, outcome monitoring, and adverse event detection |
| **Multi-Arm Trials** | Support for testing multiple interventions (coaching agents, training modules, combinations) simultaneously |
| **Regulatory Compliance** | GCP-compliant data management, audit trails, and electronic signatures |
| **Site Coordination** | Multi-site trial management with centralized randomization and local data collection |

### Technical Requirements

- **Federated Architecture**: Each participating site runs a local platform instance. Aggregated (not individual) results are shared to a central coordinating node.
- **Scale**: Support for 100,000+ concurrent participants across 50+ sites.
- **Real-Time Analytics**: Sub-minute latency for adaptive trial decision-making.
- **Regulatory Readiness**: 21 CFR Part 11 compliance for electronic records and signatures.
- **Interoperability**: FHIR-compatible data export for integration with EHR systems.

### Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Geographic coverage | > 25 states with participating sites | Site enrollment |
| Population representation | Demographic distribution within 10% of national census | Participant demographics |
| Data freshness | < 24 hours from collection to national dashboard update | Pipeline latency |
| Trial startup time | < 3 months from protocol approval to first enrollment (vs 12+ months traditional) | Timeline tracking |
| Trial cost reduction | > 50% reduction in per-participant trial cost vs traditional RCT | Cost analysis |
| Publication output | > 10 peer-reviewed publications per year from platform data | Publication tracking |
| Policy citations | Platform data cited in > 2 federal policy documents per year | Citation tracking |

---

## Cross-Phase Dependencies

```
Phase 1 (Core Platform)
  │
  ├── Phase 2 (Wearables) ─── requires stable data model + API from Phase 1
  │     │
  │     └── Phase 4 (Cognitive Resilience) ─── requires wearable biofeedback from Phase 2
  │           │
  │           └── Phase 5 (National Scale) ─── requires validated interventions from Phase 4
  │
  └── Phase 3 (Coaching Agents) ─── requires coupling/trajectory data from Phase 1 modules
        │
        ├── Phase 4 (Cognitive Resilience) ─── reuses coaching agent infrastructure from Phase 3
        │
        └── Phase 5 (Clinical Trials) ─── requires coaching agents as trial interventions
```

### Risk Factors

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| IRB approval delays | Medium | High | Early protocol submission, pre-consultation with IRB |
| Wearable API changes | Medium | Medium | Abstraction layer for device APIs, multiple device support |
| Participant recruitment | Medium | High | Multi-site collaboration, community partnerships |
| AI model regulatory requirements | Medium | High | Proactive engagement with FDA digital health guidance |
| Funding continuity | Medium | High | Diversified funding sources (NIH, foundation, industry) |
| Cross-cultural data harmonization | High | Medium | Measurement invariance testing, conservative comparison criteria |
| Staff turnover | Medium | Medium | Comprehensive documentation, modular codebase, knowledge sharing |

### Governance

Each phase transition requires:

1. PI approval based on Phase N success metrics
2. IRB protocol amendment or new protocol
3. Technical architecture review
4. Fairness audit of existing models before expansion
5. Stakeholder advisory board review (researchers, participants, community members)
6. Funding confirmation
