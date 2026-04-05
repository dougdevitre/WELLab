---
name: wellab-platform
description: >
  WELLab AI-Enabled Research & Impact Platform — operationalizes lifespan wellbeing
  science with AI for the WELLab at Washington University in St. Louis. Use this skill
  for ANY task involving: wellbeing research modules, experience sampling / EMA,
  emotion dynamics / IDELS modeling, wellbeing-health causal inference, lifespan
  trajectory analysis, cognitive health / ADRD / dementia prevention, intervention
  design, participant dashboards, researcher dashboards, policy dashboards, longitudinal
  data pipelines, wellbeing measurement systems, cross-cultural wellbeing comparison,
  wearable integration, AI coaching agents, or any WELLab platform feature. Also
  trigger for "wellbeing AI", "emotion coupling", "life satisfaction", "eudaimonic",
  "hedonic", "cognitive decline risk", "purpose score", "wellbeing trajectory",
  "experience sampling", "momentary assessment", "WashU wellbeing", or platform
  architecture / data model / API / deployment questions about the WELLab system.
  Always trigger even for basic questions about wellbeing research operationalization.
---

# WELLab AI-Enabled Research & Impact Platform

## Mission

Operationalize WELLab's lifespan wellbeing science into executable AI systems that
accelerate discovery, intervention, and public impact.

**Core loop**: Capture data → Model dynamics → Generate insights → Deploy interventions → Feed back into research.

---

## Platform Architecture

The platform is organized into **4 AI Modules**, a **Unified Data Model**, an
**Advanced AI Capabilities Layer**, and **3 Dashboard UIs**.

### AI Modules (see `references/modules.md` for full specs)

| Module | Domain | Key Capability |
|--------|--------|---------------|
| Real-Time Emotional Dynamics Engine | Short-term wellbeing dynamics | EMA, emotion-coupling, IDELS |
| Behavioral + Physiological Health Engine | Wellbeing ↔ physical health | Causal inference, longitudinal regression |
| Lifespan Trajectory Engine | Long-term wellbeing change | Growth curves, trajectory clustering |
| Cognitive Health & Dementia Prevention Engine | Wellbeing ↔ cognition / ADRD | Survival analysis, risk stratification |

### Data Model (see `references/data-model.md`)

Core entities: Participants, Observations, Health, Lifespan, Cognitive, Interventions.
Each entity has standard fields plus module-specific extensions.

### AI Capabilities Layer (see `references/ai-capabilities.md`)

- IDELS AI Extension — emotion → life satisfaction coupling classification
- Temporal Dynamics Engine — variability, rate of change, volatility
- Bidirectional Modeling System — wellbeing ↔ health, health ↔ wellbeing

### Dashboards (see `references/dashboards.md`)

- Participant Experience UI
- Researcher Dashboard
- Policy Dashboard

---

## When to Read Reference Files

| User request | Read this file |
|-------------|---------------|
| Build or modify an AI module, add EMA/sampling, emotion coupling, health prediction, trajectory analysis, cognitive risk | `references/modules.md` |
| Data model, schema, entity relationships, new fields | `references/data-model.md` |
| IDELS, temporal dynamics, bidirectional modeling, advanced AI layer | `references/ai-capabilities.md` |
| Dashboard UI, participant view, researcher view, policy view | `references/dashboards.md` |
| API routes, deployment, infrastructure, security | `references/architecture.md` |
| Ethics, fairness, reproducibility, scientific integrity | `references/ethics.md` |
| Roadmap, wearables, coaching agents, extensions | `references/roadmap.md` |

---

## Technology Stack

- **Frontend**: React / Vite, TypeScript, Tailwind CSS, Recharts / D3
- **Backend**: Node.js / Express, TypeScript
- **AI/ML**: Python (scikit-learn, statsmodels, DoWhy, PyTorch), Anthropic Claude API
- **Infrastructure**: AWS (Lambda, DynamoDB, S3, API Gateway, SageMaker)
- **Data Pipeline**: AWS Glue / Step Functions, DynamoDB Streams
- **Auth**: AWS Cognito (researcher + participant pools)
- **Secrets**: AWS SSM Parameter Store (SecureString)

---

## Key Constraints

- **IRB compliance**: All participant data must be de-identified or under approved protocol.
- **HIPAA-adjacent**: Health data requires encryption at rest + in transit, audit logging, minimum necessary access.
- **Reproducibility**: Every AI pipeline must be version-controlled with pinned dependencies and deterministic seeds.
- **Cross-cultural fairness**: Models must be audited for demographic bias before deployment.
- **Individual vs population**: Never surface individual risk scores to unauthorized viewers. Population dashboards must aggregate to k-anonymity thresholds.

---

## Output Patterns

When building features for this platform, follow these patterns:

### Spec documents
Include: Goals, Non-goals, User stories, Data model changes, API routes, Security considerations, Edge cases, Test plan, Rollout plan.

### Code output
- TypeScript for all Node/React code
- Python for ML/analytics pipelines
- Include file tree + filename headers
- Secure by default (least-privilege IAM, no hardcoded secrets)
- Small modular utilities

### Data artifacts
- JSON schemas with example payloads
- CSV templates with headers + example rows
- Always include `participant_id`, `timestamp`, `source_module`

---

## Quick Start Commands

```bash
# Clone and install
git clone <repo-url> wellab-platform
cd wellab-platform
npm install          # frontend + backend
pip install -r requirements.txt  # ML pipelines

# Dev
npm run dev          # Vite dev server
npm run api:dev      # Express API (nodemon)

# Test
npm test             # Jest + React Testing Library
pytest tests/        # ML pipeline tests

# Deploy
npm run deploy:staging
npm run deploy:prod
```
