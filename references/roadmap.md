# Platform Roadmap

## Phase 1 — Core Platform (Active)

### Scope
Build the foundational platform: 4 AI modules, unified data model, 3 dashboards, and deployment infrastructure.

### Deliverables
- Real-Time Emotional Dynamics Engine (EMA collection, IDELS coupling, volatility scoring)
- Behavioral & Physiological Health Engine (causal inference, longitudinal regression)
- Lifespan Trajectory Engine (growth curves, trajectory clustering)
- Cognitive Health & Dementia Prevention Engine (risk stratification, survival analysis)
- Unified DynamoDB data model (single-table design)
- Participant Experience UI (mobile-first)
- Researcher Dashboard (desktop-first)
- Policy Dashboard (k-anonymized aggregates)
- AWS CDK infrastructure (API Gateway, Lambda, DynamoDB, S3, Cognito, CloudFront)
- CI/CD pipeline (GitHub Actions)
- Fairness audit tooling (`scripts/fairness_audit.py`)

### Success Metrics
| Metric | Target |
|--------|--------|
| EMA response rate | ≥ 70% across participants |
| API latency p95 | < 500ms |
| Model fairness (disparate impact ratio) | ≥ 0.80 for all groups |
| Dashboard load time | < 2s on 4G connection |
| Test coverage | ≥ 80% (backend), ≥ 70% (frontend), ≥ 90% (ML) |
| Participant satisfaction (SUS score) | ≥ 70 |

---

## Phase 2 — Wearable Integration (Planning)

### Scope
Integrate passive physiological data streams from consumer wearables to enrich health and emotional dynamics models.

### Deliverables
- Apple HealthKit integration (steps, heart rate, sleep, HRV)
- Fitbit Web API integration (activity, sleep, heart rate)
- Garmin Health API integration (stress, body battery, activity)
- Wearable data normalization layer (vendor-agnostic schema)
- Real-time streaming pipeline (wearable → API → DynamoDB)
- Enhanced Health Engine with physiological features
- Enhanced Emotional Dynamics with HRV-affect coupling
- Updated consent flow for wearable data

### Success Metrics
| Metric | Target |
|--------|--------|
| Wearable data sync reliability | ≥ 95% uptime |
| Data latency (device → platform) | < 15 minutes |
| Model improvement (R² gain) | ≥ 5% on health predictions |
| Participant opt-in rate | ≥ 50% of active participants |

---

## Phase 3 — AI Coaching Agents (Research)

### Scope
Develop AI-powered coaching agents that deliver personalized micro-interventions based on real-time wellbeing data.

### Deliverables
- **Purpose Coach**: Guided reflection exercises when purpose scores dip; strengths-based prompts
- **Emotion Regulation Coach**: In-the-moment coping suggestions triggered by high negative affect or volatility
- **Social Connection Coach**: Prompts for social engagement when isolation patterns detected
- Agent orchestration framework (which coach, when, how often)
- Participant preference learning (adapt style, frequency, modality)
- A/B testing infrastructure for intervention effectiveness
- Researcher interface for designing and monitoring coaching protocols

### Success Metrics
| Metric | Target |
|--------|--------|
| Intervention acceptance rate | ≥ 60% |
| Self-rated helpfulness | ≥ 3.5/5 |
| Wellbeing improvement (pre/post) | Detectable effect (d ≥ 0.2) |
| Participant retention | ≥ 85% over 3 months |

---

## Phase 4 — Cognitive Resilience Training (Concept)

### Scope
Build interactive cognitive training modules informed by the Cognitive Health Engine's risk profiles.

### Deliverables
- Gamified cognitive exercises (memory, executive function, processing speed)
- Adaptive difficulty based on participant performance
- Integration with Cognitive Health Engine (training targeted to weak domains)
- Social features (group challenges, leaderboards with opt-in)
- Longitudinal tracking of cognitive training effects on wellbeing and cognition
- Clinical validation study protocol

### Success Metrics
| Metric | Target |
|--------|--------|
| Training adherence (3x/week) | ≥ 70% |
| Cognitive score improvement | Detectable effect at 6 months |
| Participant enjoyment | ≥ 4/5 |
| Transfer to daily function | Self-reported improvement |

---

## Phase 5 — National Wellbeing Surveillance & Clinical Trial Automation (Vision)

### Scope
Scale the platform for population-level wellbeing monitoring and automated clinical trial management.

### Deliverables
- Multi-site deployment architecture (federated data model)
- National wellbeing index computation (aggregated, privacy-preserving)
- Automated clinical trial protocol execution (randomization, dosing, outcome tracking)
- Regulatory submission support (FDA, IRB multi-site)
- Public API for researchers at other institutions
- Open-source release of core ML modules (with WashU license)
- Integration with national health data systems (with appropriate agreements)

### Success Metrics
| Metric | Target |
|--------|--------|
| Sites supported | ≥ 10 universities |
| Participants tracked | ≥ 10,000 |
| Data processing throughput | ≥ 1M observations/day |
| Public API adoption | ≥ 5 external research teams |
| Time-to-trial-launch | 50% reduction vs. manual process |

---

## Timeline Summary

| Phase | Status | Estimated Duration |
|-------|--------|-------------------|
| Phase 1 | Active | 6–9 months |
| Phase 2 | Planning | 3–4 months |
| Phase 3 | Research | 6–9 months |
| Phase 4 | Concept | 6–12 months |
| Phase 5 | Vision | 12–18 months |

Phases 2–3 may overlap. Phase 4–5 timelines depend on funding and Phase 1–3 outcomes.
