# WELLab AI-Enabled Research & Impact Platform

**Operationalizing Lifespan Wellbeing Science with AI**

Built to support the mission of the [WELLab at Washington University in St. Louis](https://wellbeing.wustl.edu), this platform transforms wellbeing research domains into executable AI systems that accelerate discovery, intervention, and public impact.

---

## What This Platform Does

Every WELLab research domain becomes a live AI module that:

1. **Captures** data (EMA, wearables, clinical, self-report)
2. **Models** dynamics (emotion coupling, causal inference, trajectory clustering)
3. **Generates** insights (risk scores, protective factors, intervention targets)
4. **Deploys** interventions (personalized coaching, activity prompts)
5. **Feeds back** into research (continuous learning loop)

---

## AI Modules

| Module | Research Domain | Key Capability |
|--------|----------------|---------------|
| **Real-Time Emotional Dynamics Engine** | Short-term wellbeing fluctuations | EMA, IDELS emotion-coupling, volatility scoring |
| **Behavioral + Physiological Health Engine** | Wellbeing ↔ physical health | Causal inference (DoWhy), longitudinal regression |
| **Lifespan Trajectory Engine** | Long-term wellbeing change | Growth curves, trajectory archetypes, cross-cultural comparison |
| **Cognitive Health & Dementia Prevention Engine** | Wellbeing ↔ cognition / ADRD | Survival analysis, risk stratification, protective factor identification |

---

## Dashboards

- **Participant Experience** — "Your Wellbeing Today", trend patterns, strength-framed insights (mobile-first)
- **Researcher Dashboard** — Coupling heatmaps, trajectory clusters, causal DAGs, data quality monitors
- **Policy Dashboard** — Population wellbeing maps, dementia risk distribution, intervention ROI (k-anonymized)

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React, Vite, TypeScript, Tailwind CSS, Recharts, D3 |
| Backend | Node.js, Express, TypeScript |
| AI/ML | Python (scikit-learn, statsmodels, DoWhy, PyTorch), Anthropic Claude API |
| Infrastructure | AWS (Lambda, DynamoDB, S3, API Gateway, SageMaker, Cognito) |
| IaC | AWS CDK (TypeScript) |
| CI/CD | GitHub Actions |

---

## Project Structure

```
wellab-platform/
├── SKILL.md                        # AI skill routing hub
├── README.md                       # This file
├── references/
│   ├── modules.md                  # Full specs for 4 AI modules
│   ├── data-model.md               # Unified data model + DynamoDB design
│   ├── ai-capabilities.md          # IDELS, temporal dynamics, bidirectional models
│   ├── dashboards.md               # Participant, researcher, policy UIs
│   ├── architecture.md             # API, infra, security, deployment
│   ├── ethics.md                   # Fairness, consent, scientific integrity
│   └── roadmap.md                  # Wearables, coaching agents, future phases
├── scripts/
│   └── fairness_audit.py           # Demographic parity + disparate impact checker
└── assets/                         # Templates, icons, fonts (future)
```

---

## Key Constraints

- **IRB compliance** — All participant data under approved protocol
- **HIPAA-adjacent** — Encryption at rest + in transit, audit logging, minimum necessary access
- **Reproducibility** — Pinned dependencies, deterministic seeds, version-controlled pipelines
- **Cross-cultural fairness** — Models audited for demographic bias before deployment
- **Privacy** — Individual risk scores never surfaced to unauthorized viewers; population data aggregated to k ≥ 10

---

## Getting Started

```bash
# Clone
git clone <repo-url> wellab-platform
cd wellab-platform

# Install
npm install              # Frontend + backend
pip install -r requirements.txt  # ML pipelines

# Develop
npm run dev              # Vite dev server
npm run api:dev          # Express API (nodemon)

# Test
npm test                 # Jest + React Testing Library
pytest tests/            # ML pipeline tests

# Deploy
npm run deploy:staging
npm run deploy:prod      # Requires PI + admin approval
```

---

## Environments

| Environment | Branch | Auto-deploy | Approval Required |
|-------------|--------|-------------|-------------------|
| dev | `feature/*` | Yes | None |
| staging | `develop` | Yes | None |
| production | `main` | No | PI + admin |

---

## Ethics & Scientific Integrity

This platform is built on WELLab's core principles:

- Reproducible AI pipelines with full audit trails
- Transparent model assumptions and confidence intervals
- Cross-cultural fairness audits (pre-deployment + monthly)
- Individual vs population safeguards at every layer
- Participant autonomy: view, export, or delete data at any time

See [`references/ethics.md`](references/ethics.md) for full details.

---

## Roadmap

1. **Phase 1** (Active) — Core platform: 4 AI modules, data model, 3 dashboards
2. **Phase 2** (Planning) — Wearable integration (Apple HealthKit, Fitbit)
3. **Phase 3** (Research) — AI coaching agents (purpose, emotion regulation, social connection)
4. **Phase 4** (Concept) — Cognitive resilience training modules
5. **Phase 5** (Vision) — National wellbeing surveillance + clinical trial automation

---

## License

Proprietary — Washington University in St. Louis. All rights reserved.

---

## Contact

WELLab — Washington University in St. Louis
