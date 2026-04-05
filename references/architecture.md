# Platform Architecture

## AWS Architecture Overview

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  React SPA  │────▶│ API Gateway  │────▶│   Lambda    │
│  (CloudFront│     │  (REST API)  │     │  Functions  │
│   + S3)     │     └──────────────┘     └──────┬──────┘
└─────────────┘                                  │
                                    ┌────────────┼────────────┐
                                    ▼            ▼            ▼
                              ┌──────────┐ ┌──────────┐ ┌──────────┐
                              │ DynamoDB │ │    S3    │ │SageMaker │
                              │ (main)   │ │ (data)   │ │ (ML)     │
                              └────┬─────┘ └──────────┘ └──────────┘
                                   │
                              ┌────▼─────┐
                              │ DynamoDB │
                              │ Streams  │──▶ Lambda (derived metrics)
                              └──────────┘
```

### Service Roles

| Service | Role |
|---------|------|
| **CloudFront + S3** | Static hosting for React SPA |
| **API Gateway** | REST API with Cognito authorizer, rate limiting, request validation |
| **Lambda** | Business logic, CRUD operations, metric computation |
| **DynamoDB** | Primary data store (single-table design) |
| **S3** | Raw data uploads, ML training data (Parquet), model artifacts |
| **SageMaker** | ML model training, batch inference, notebook experiments |
| **Cognito** | Authentication — separate user pools for researchers and participants |
| **Step Functions** | ML pipeline orchestration (train → evaluate → deploy) |
| **Glue** | ETL: DynamoDB → S3 Parquet for analytics |
| **SSM Parameter Store** | Secrets management (API keys, Cognito secrets) |
| **CloudWatch** | Logging, metrics, alarms |

---

## API Design

### Base URL
- Dev: `https://api-dev.wellab.wustl.edu`
- Staging: `https://api-staging.wellab.wustl.edu`
- Production: `https://api.wellab.wustl.edu`

### Authentication
All endpoints require a valid JWT from Cognito:
```
Authorization: Bearer <cognito-id-token>
```

### Route Structure
```
/api
├── /health-check                    GET    (public)
├── /participants
│   ├── /                            GET    (researcher)
│   ├── /:id                         GET    (researcher, self)
│   ├── /                            POST   (researcher)
│   └── /:id                         PUT    (researcher, self)
├── /participants/:id
│   ├── /observations                GET    (researcher, self)
│   ├── /observations                POST   (self, system)
│   ├── /emotional-dynamics          GET    (researcher, self)
│   ├── /health-records              GET    (researcher, self)
│   ├── /trajectory                  GET    (researcher, self)
│   ├── /cognitive                   GET    (researcher, self)
│   └── /interventions               GET    (researcher, self)
├── /emotional-dynamics/analyze      POST   (researcher)
├── /health/causal-analysis          POST   (researcher)
├── /lifespan/cluster-analysis       POST   (researcher)
├── /cognitive/risk-assessment       POST   (researcher)
└── /interventions                   POST   (researcher, system)
```

### Rate Limiting
| Tier | Requests/min | Burst |
|------|-------------|-------|
| Participant | 60 | 10 |
| Researcher | 300 | 50 |
| System/Internal | 1000 | 200 |

### Error Format
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "positive_affect must be between 1 and 5",
    "details": { "field": "positive_affect", "received": 6 }
  }
}
```

---

## Security

### Encryption
- **At rest**: DynamoDB uses AWS-managed encryption (AES-256); S3 uses SSE-S3
- **In transit**: TLS 1.2+ enforced on all endpoints; HSTS headers on CloudFront

### IAM Policies
- Principle of least privilege for all Lambda execution roles
- Separate roles per function (read-only for query Lambdas, read-write for mutation Lambdas)
- No wildcard (`*`) resource permissions

### Audit Logging
- CloudTrail enabled for all API calls
- DynamoDB Streams capture all data mutations
- Custom audit log entries for: data access, export, deletion, consent changes

### HIPAA-Adjacent Compliance
- PHI-adjacent data (health records) encrypted at rest + in transit
- Access logging with participant_id redaction in CloudWatch
- Minimum necessary: API returns only requested fields, not full records
- Data retention policy: active data 2 years, archive 7 years, then purge

### Secrets Management
- All secrets in SSM Parameter Store (SecureString type)
- No hardcoded credentials in code or environment variables
- Secrets rotated quarterly; rotation Lambda for Cognito client secrets

---

## Deployment

### Environments

| Environment | Branch | Deploy Trigger | Approval |
|-------------|--------|---------------|----------|
| dev | `feature/*` | Push | Automatic |
| staging | `develop` | Merge | Automatic |
| production | `main` | Merge | PI + admin manual approval |

### CDK Stack Structure
```
wellab-platform/
├── infra/
│   ├── bin/app.ts                  # CDK app entry
│   ├── lib/
│   │   ├── api-stack.ts            # API Gateway + Lambda
│   │   ├── data-stack.ts           # DynamoDB + S3
│   │   ├── auth-stack.ts           # Cognito user pools
│   │   ├── ml-stack.ts             # SageMaker + Step Functions
│   │   ├── monitoring-stack.ts     # CloudWatch dashboards + alarms
│   │   └── frontend-stack.ts       # CloudFront + S3
│   └── cdk.json
```

### CI/CD Pipeline (GitHub Actions)
1. **Lint** — ESLint + Prettier (TypeScript), Black + Flake8 (Python)
2. **Test** — Jest (frontend/backend), pytest (ML pipelines)
3. **Build** — Vite (frontend), tsc (backend), package Lambdas
4. **CDK Diff** — Show infrastructure changes on PR
5. **CDK Deploy** — Deploy to target environment on merge

---

## Monitoring & Alerting

### CloudWatch Dashboards
- **API Health**: Request count, latency p50/p95/p99, 4xx/5xx rates
- **Data Pipeline**: DynamoDB read/write capacity, Stream iterator age, Glue job status
- **ML Pipeline**: SageMaker training job status, inference latency, model drift metrics

### Alarms
| Alarm | Threshold | Action |
|-------|-----------|--------|
| API 5xx rate | > 1% for 5 min | PagerDuty + Slack |
| API latency p99 | > 3s for 10 min | Slack |
| DynamoDB throttle | > 0 for 1 min | Auto-scale + Slack |
| EMA compliance | < 50% for participant over 7 days | Researcher notification |
| ML model drift | PSI > 0.2 | Retrain trigger + Slack |
