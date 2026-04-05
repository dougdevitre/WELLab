# Architecture — API, Infrastructure, Security, Deployment

> WELLab AI-Enabled Research & Impact Platform
> Washington University in St. Louis

This document describes the platform's AWS infrastructure, API design, security posture, deployment pipelines, and monitoring strategy.

---

## Table of Contents

1. [AWS Architecture](#1-aws-architecture)
2. [API Design](#2-api-design)
3. [Security](#3-security)
4. [Deployment Pipelines](#4-deployment-pipelines)
5. [Monitoring and Alerting](#5-monitoring-and-alerting)

---

## 1. AWS Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Clients                                     │
│  Participant App (mobile web)  │  Researcher Dashboard  │  Policy   │
└──────────────┬─────────────────┴───────────┬────────────┴───────────┘
               │                             │
               ▼                             ▼
┌──────────────────────────────────────────────────────────────────────┐
│                      Amazon CloudFront (CDN)                        │
│              Static assets (React SPA) from S3 origin               │
└──────────────────────────┬───────────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────────────┐
│                     Amazon API Gateway (REST)                       │
│              Custom domain, TLS 1.2+, usage plans                   │
│              Cognito authorizer attached                             │
└──────────┬───────────────┬───────────────┬───────────────────────────┘
           │               │               │
           ▼               ▼               ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────────────────┐
│ Lambda       │ │ Lambda       │ │ Lambda                   │
│ (API handlers│ │ (Stream      │ │ (Scheduled               │
│  Node.js/TS) │ │  processors) │ │  batch jobs)             │
└──────┬───────┘ └──────┬───────┘ └──────┬───────────────────┘
       │                │                │
       ▼                ▼                ▼
┌──────────────────────────────────────────────────────────────────────┐
│                      Amazon DynamoDB                                │
│          Single-table design (wellab-platform-{env})                │
│          DynamoDB Streams → Lambda stream processors                │
│          On-demand capacity, point-in-time recovery                 │
└──────────────────────────────────────────────────────────────────────┘
       │                                          │
       ▼                                          ▼
┌──────────────────────┐            ┌──────────────────────────────┐
│ Amazon S3            │            │ Amazon SageMaker             │
│ - Raw data exports   │            │ - Processing jobs (Python)   │
│ - Model artifacts    │            │ - Training jobs              │
│ - Parquet archives   │            │ - Endpoints (inference)      │
│ - Static site assets │            │ - Notebook instances (dev)   │
└──────────────────────┘            └──────────────────────────────┘
       │
       ▼
┌──────────────────────┐
│ Amazon S3 Glacier    │
│ - Archived data      │
│ - Long-term storage  │
└──────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│                        Supporting Services                          │
│                                                                      │
│  Amazon Cognito        - User authentication (2 pools)              │
│  AWS SSM Param Store   - Secrets (SecureString)                     │
│  AWS Step Functions    - Batch pipeline orchestration                │
│  Amazon SNS            - Alert notifications                        │
│  Amazon CloudWatch     - Logging, metrics, alarms                   │
│  AWS Glue              - ETL for cross-cultural dataset imports      │
│  AWS CDK               - Infrastructure as Code                      │
└──────────────────────────────────────────────────────────────────────┘
```

### AWS Services Detail

| Service | Purpose | Configuration |
|---------|---------|---------------|
| **API Gateway** | REST API entry point | Regional endpoint, custom domain `api.wellab.wustl.edu`, WAF attached |
| **Lambda** | Serverless compute | Node.js 20.x (API handlers), Python 3.12 (ML pipelines), 256-1024MB memory, 30s timeout (API), 15min (batch) |
| **DynamoDB** | Primary datastore | Single table, on-demand capacity, encryption at rest (AWS-managed KMS), PITR enabled, Streams enabled |
| **S3** | Object storage | Versioning enabled, server-side encryption (SSE-S3), lifecycle policies for archival |
| **SageMaker** | ML platform | Processing jobs for model training, real-time endpoints for inference, notebook instances for development |
| **Cognito** | Authentication | 2 user pools (participant, researcher), MFA enforced for researchers, OAuth 2.0 / OIDC |
| **CloudFront** | CDN | HTTPS-only, custom domain, S3 origin for SPA, API Gateway origin for API |
| **Step Functions** | Orchestration | Standard workflows for batch processing pipelines (nightly model retraining, data archival) |
| **SNS** | Notifications | Topics for alerts (researcher), EMA prompts (participant), deployment notifications |
| **SSM Parameter Store** | Secrets | SecureString parameters for API keys (Anthropic), database credentials, third-party integrations |
| **CloudWatch** | Observability | Log groups per Lambda, custom metrics, dashboards, alarms |
| **Glue** | ETL | Crawlers and jobs for importing/harmonizing external datasets (HRS, SHARE, ELSA) |
| **CDK** | IaC | TypeScript CDK stacks for all infrastructure, synthesized to CloudFormation |

### CDK Stack Organization

```
wellab-platform-cdk/
├── bin/
│   └── app.ts                    # CDK app entry point
├── lib/
│   ├── wellab-network-stack.ts   # VPC, subnets, security groups
│   ├── wellab-data-stack.ts      # DynamoDB, S3 buckets
│   ├── wellab-auth-stack.ts      # Cognito pools, authorizers
│   ├── wellab-api-stack.ts       # API Gateway, Lambda handlers
│   ├── wellab-ml-stack.ts        # SageMaker, Step Functions
│   ├── wellab-cdn-stack.ts       # CloudFront, DNS
│   └── wellab-monitoring-stack.ts # CloudWatch, SNS, alarms
├── config/
│   ├── dev.ts
│   ├── staging.ts
│   └── prod.ts
└── test/
    └── *.test.ts                 # CDK assertion tests
```

---

## 2. API Design

### Base URL

| Environment | Base URL |
|-------------|----------|
| dev | `https://api-dev.wellab.wustl.edu/v1` |
| staging | `https://api-staging.wellab.wustl.edu/v1` |
| production | `https://api.wellab.wustl.edu/v1` |

### REST Endpoint Summary

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/ema/observations` | Participant | Submit EMA observation |
| `GET` | `/ema/participants/{id}/coupling` | Researcher | Get coupling classification |
| `GET` | `/ema/participants/{id}/volatility` | Researcher | Get volatility scores |
| `GET` | `/ema/schedule/{id}` | Participant/Researcher | Get sampling schedule |
| `PUT` | `/ema/schedule/{id}` | Researcher | Update sampling schedule |
| `POST` | `/health/causal-analysis` | Researcher | Run causal analysis |
| `GET` | `/health/longitudinal/{id}` | Researcher | Get longitudinal trajectory |
| `POST` | `/health/intervention-simulation` | Researcher | Simulate intervention impact |
| `GET` | `/health/bidirectional-summary` | Researcher/Policy | Get bidirectional analysis summary |
| `GET` | `/lifespan/trajectories/{id}` | Researcher | Get growth curve + cluster |
| `GET` | `/lifespan/clusters` | Researcher/Policy | Get all trajectory clusters |
| `POST` | `/lifespan/cross-cultural` | Researcher | Run cross-cultural comparison |
| `GET` | `/lifespan/population-curves` | Policy | Get population trajectory curves |
| `GET` | `/cognitive/risk/{id}` | Researcher | Get ADRD risk stratification |
| `GET` | `/cognitive/survival-curve` | Researcher/Policy | Get survival curves |
| `GET` | `/cognitive/protective-factors` | Researcher/Policy | Get ranked protective factors |
| `GET` | `/cognitive/trajectory/{id}` | Researcher | Get cognitive trajectory |
| `POST` | `/cognitive/population-risk-map` | Policy | Generate population risk map |
| `GET` | `/temporal/metrics/{id}` | Researcher | Get temporal dynamics metrics |
| `POST` | `/bidirectional/analyze` | Researcher | Run bidirectional analysis |
| `GET` | `/participants/{id}/profile` | Participant (own) / Researcher | Get participant profile |
| `PUT` | `/participants/{id}/profile` | Participant (own) | Update profile |
| `GET` | `/participants/{id}/data-export` | Participant (own) | Export all personal data |
| `DELETE` | `/participants/{id}/data` | Participant (own) / Admin | Delete all personal data |
| `GET` | `/admin/audit-log` | Admin | View audit trail |
| `GET` | `/admin/fairness-report` | Admin/PI | View latest fairness audit |

### Auth Middleware

All requests pass through a middleware chain:

```
Request
  → CloudFront (TLS termination)
  → API Gateway (route matching)
  → Cognito Authorizer (JWT validation)
  → Lambda handler
    → Role extraction from JWT claims
    → Permission check (role × resource × action)
    → Data access scoping (participant sees own data only)
    → Audit log entry (who, what, when)
    → Business logic
    → Response
```

**JWT Claims**:
```json
{
  "sub": "cognito-user-id",
  "email": "user@wustl.edu",
  "custom:role": "researcher",
  "custom:participant_id": "P-20250401-0042",
  "custom:team_id": "wellab-core",
  "iss": "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_XXXXX",
  "exp": 1743897600
}
```

### Rate Limiting

| Role | Requests/second | Requests/day | Burst |
|------|-----------------|--------------|-------|
| Participant | 5 | 1,000 | 10 |
| Researcher | 20 | 10,000 | 50 |
| PI | 20 | 10,000 | 50 |
| Policy viewer | 10 | 5,000 | 20 |
| Admin | 50 | 50,000 | 100 |
| Claude API (internal) | 100/min | — | — |

Implemented via API Gateway usage plans and Lambda concurrency limits.

### Error Response Format

All error responses follow a consistent format:

```json
{
  "error": {
    "code": "INSUFFICIENT_DATA",
    "message": "Participant P-20250401-0042 has 12 observations; minimum 20 required for coupling analysis.",
    "status": 422,
    "request_id": "req-20260405-abcdef",
    "documentation_url": "https://docs.wellab.wustl.edu/errors/INSUFFICIENT_DATA"
  }
}
```

### Pagination

List endpoints use cursor-based pagination:

```
GET /api/v1/ema/participants/{id}/observations?limit=50&cursor=eyJTS...
```

Response includes:
```json
{
  "items": [...],
  "pagination": {
    "count": 50,
    "cursor": "eyJTS...",
    "has_more": true
  }
}
```

---

## 3. Security

### Encryption

| Layer | Method | Key Management |
|-------|--------|----------------|
| Data in transit | TLS 1.2+ (CloudFront + API Gateway enforce) | AWS Certificate Manager |
| DynamoDB at rest | AES-256 (AWS-managed KMS key) | AWS KMS, auto-rotation |
| S3 at rest | SSE-S3 (AES-256) | AWS-managed |
| S3 sensitive data | SSE-KMS (customer-managed key) | Customer-managed CMK, annual rotation |
| SSM Parameter Store | SecureString (KMS-encrypted) | Customer-managed CMK |
| Lambda env vars | KMS encryption helper | Per-function encryption key |

### Audit Logging

All data access events are logged to CloudWatch Logs and archived to S3:

```json
{
  "timestamp": "2026-04-05T14:32:00Z",
  "event_type": "DATA_ACCESS",
  "user_id": "cognito-user-id",
  "role": "researcher",
  "action": "READ",
  "resource": "participant/P-20250401-0042/coupling",
  "ip_address": "128.252.x.x",
  "user_agent": "Mozilla/5.0...",
  "request_id": "req-20260405-abcdef",
  "response_status": 200,
  "data_classification": "PHI_ADJACENT"
}
```

**Audit log retention**: 12 months in CloudWatch, 7 years in S3 Glacier.

**Audit log access**: Admin role only. Separate CloudWatch log group with restricted IAM policy.

### HIPAA-Adjacent Compliance

The platform follows HIPAA-adjacent practices even though it may not fall under HIPAA regulation for all data types:

| Requirement | Implementation |
|-------------|----------------|
| Access control | Role-based access via Cognito + Lambda middleware |
| Audit controls | Full audit logging of all data access and modifications |
| Integrity controls | DynamoDB point-in-time recovery, S3 versioning, checksums |
| Transmission security | TLS 1.2+ enforced on all endpoints |
| Encryption at rest | AES-256 on all storage services |
| Minimum necessary | Data scoping in Lambda handlers — participants see only own data |
| BAA | AWS BAA executed for applicable services |
| Workforce training | Annual security training for all platform users |
| Incident response | Documented IR plan with < 72hr notification requirement |

### IAM Policies

Principle: **Least privilege**. Each Lambda function has its own IAM role with only the permissions it needs.

**Example: EMA observation handler**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:PutItem",
        "dynamodb:GetItem",
        "dynamodb:Query"
      ],
      "Resource": "arn:aws:dynamodb:us-east-1:*:table/wellab-platform-*",
      "Condition": {
        "ForAllValues:StringLike": {
          "dynamodb:LeadingKeys": ["PARTICIPANT#*"]
        }
      }
    },
    {
      "Effect": "Allow",
      "Action": "ssm:GetParameter",
      "Resource": "arn:aws:ssm:us-east-1:*:parameter/wellab/*/api-keys/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:us-east-1:*:log-group:/aws/lambda/wellab-*"
    }
  ]
}
```

### Network Security

- **No public subnets** for Lambda functions that access DynamoDB or S3 (VPC endpoints used).
- **WAF** on API Gateway: Rate limiting, SQL injection protection, IP allowlisting for admin endpoints.
- **Security groups**: Restrictive inbound rules. No SSH access to any resource.
- **VPC Flow Logs**: Enabled for all VPCs, archived to S3.

### Secret Management

| Secret | Storage | Rotation |
|--------|---------|----------|
| Anthropic API key | SSM Parameter Store (SecureString) | Manual, per API key rotation schedule |
| DynamoDB CMK | AWS KMS | Annual automatic rotation |
| Cognito client secrets | SSM Parameter Store | On security incident |
| Third-party API keys | SSM Parameter Store (SecureString) | Quarterly |

**No secrets in**:
- Environment variables (except KMS-encrypted references to SSM)
- Source code
- CDK constructs (references to SSM paths only)
- CI/CD configuration files (GitHub Secrets for CI, SSM for runtime)

---

## 4. Deployment Pipelines

### Environment Strategy

| Environment | Branch | Trigger | Approval | AWS Account |
|-------------|--------|---------|----------|-------------|
| dev | `feature/*` | Push | None | Development |
| staging | `develop` | Merge to develop | None | Staging |
| production | `main` | Merge to main | PI + admin | Production |

### CI/CD Pipeline (GitHub Actions)

```yaml
# .github/workflows/deploy.yml (simplified)

on:
  push:
    branches: [develop, main]
  pull_request:
    branches: [develop, main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install dependencies
        run: npm ci && pip install -r requirements.txt
      - name: Lint
        run: npm run lint && ruff check .
      - name: Type check
        run: npm run typecheck && mypy src/
      - name: Unit tests
        run: npm test -- --coverage && pytest tests/ --cov
      - name: CDK synth
        run: npx cdk synth
      - name: Fairness audit (pre-deploy)
        run: python scripts/fairness_audit.py --check-only

  deploy-staging:
    needs: test
    if: github.ref == 'refs/heads/develop'
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - name: CDK deploy
        run: npx cdk deploy --all --require-approval never
      - name: Integration tests
        run: npm run test:integration
      - name: Smoke tests
        run: npm run test:smoke

  deploy-production:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment: production  # Requires PI + admin approval in GitHub
    steps:
      - name: CDK deploy
        run: npx cdk deploy --all --require-approval never
      - name: Smoke tests
        run: npm run test:smoke
      - name: Post-deploy fairness audit
        run: python scripts/fairness_audit.py --full
```

### Deployment Checklist (Production)

1. All tests pass on `develop` (staging)
2. Integration tests pass against staging environment
3. Fairness audit passes (no demographic bias regressions)
4. Model version bumped if ML pipeline changed
5. Data migration script tested (if schema changes)
6. PR approved by at least 1 researcher + 1 engineer
7. PI approval in GitHub environment protection rules
8. Post-deploy smoke tests pass
9. Post-deploy fairness audit runs automatically

### Rollback Strategy

- **Lambda**: Automatic rollback via CodeDeploy with CloudWatch alarm triggers (error rate > 5%).
- **DynamoDB**: Point-in-time recovery to any second within the last 35 days.
- **S3**: Object versioning allows restoration of any previous version.
- **CDK**: `cdk deploy` with previous commit hash to roll back infrastructure.
- **Manual rollback**: Revert merge on `main`, re-deploy.

---

## 5. Monitoring and Alerting

### CloudWatch Dashboards

| Dashboard | Metrics | Audience |
|-----------|---------|----------|
| **Platform Health** | API Gateway 4xx/5xx rates, Lambda errors, DynamoDB throttles, latency p50/p95/p99 | Engineering |
| **Data Pipeline** | EMA observations/hour, processing lag, model training duration, data quality scores | Research + Engineering |
| **Security** | Failed auth attempts, WAF blocked requests, audit log anomalies | Security + Admin |
| **Cost** | Daily/monthly AWS spend by service, forecast vs budget | Admin |

### Alarms

| Alarm | Condition | Severity | Notification |
|-------|-----------|----------|--------------|
| API error rate | 5xx rate > 5% for 5 minutes | Critical | SNS → PagerDuty + Slack |
| API latency | p99 > 2s for 10 minutes | Warning | SNS → Slack |
| DynamoDB throttle | Any throttled request | Warning | SNS → Slack |
| Lambda errors | Error count > 10 in 5 minutes | Critical | SNS → PagerDuty |
| EMA compliance drop | Daily compliance < 60% | Warning | SNS → email (PI) |
| Model training failure | Step Function execution failed | Critical | SNS → Slack |
| Fairness audit failure | Any metric below threshold | Critical | SNS → email (PI + Admin) |
| Cost anomaly | Daily spend > 150% of 30-day average | Warning | SNS → email (Admin) |
| Auth failures | > 50 failed attempts in 10 minutes | Critical | SNS → PagerDuty + WAF rule |
| Data deletion request | Any participant data deletion | Info | SNS → email (Admin) |

### Logging Strategy

| Log Source | Destination | Retention |
|------------|-------------|-----------|
| Lambda function logs | CloudWatch Logs | 30 days (dev), 90 days (staging), 12 months (prod) |
| API Gateway access logs | CloudWatch Logs | 90 days |
| Audit trail | CloudWatch Logs + S3 | 12 months (CW) + 7 years (S3) |
| WAF logs | S3 | 12 months |
| VPC Flow Logs | S3 | 90 days |
| CDK deployment logs | GitHub Actions | 90 days |
| SageMaker training logs | CloudWatch Logs + S3 | 12 months |

### Health Checks

- **API Gateway**: Built-in health check endpoint (`GET /v1/health`) returning service status.
- **Lambda**: Warm-up invocations every 5 minutes for critical functions.
- **DynamoDB**: Periodic read probe to verify table accessibility.
- **SageMaker endpoints**: Ping endpoint with test payload every 5 minutes.
- **External dependencies**: Anthropic API health check (lightweight Claude ping) every 15 minutes.
