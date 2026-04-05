# Dashboard UIs — Specifications

> WELLab AI-Enabled Research & Impact Platform
> Washington University in St. Louis

This document specifies the three dashboard user interfaces that surface insights from the WELLab platform to participants, researchers, and policymakers.

---

## Table of Contents

1. [Participant Experience UI](#1-participant-experience-ui)
2. [Researcher Dashboard](#2-researcher-dashboard)
3. [Policy Dashboard](#3-policy-dashboard)
4. [Shared Technical Specifications](#4-shared-technical-specifications)

---

## 1. Participant Experience UI

### Overview

The Participant Experience UI is a mobile-first web application that provides enrolled participants with strength-framed insights about their own wellbeing. It prioritizes simplicity, warmth, and actionability. Participants see their own data only — never comparisons to other individuals. The interface is designed to support engagement with the research process without creating anxiety or encouraging self-diagnosis.

### Design Principles

- **Strength-framed**: Lead with what is going well. Frame challenges as opportunities for growth.
- **Non-diagnostic**: Never use clinical language. Never imply a diagnosis or prescribe treatment.
- **Actionable**: Every insight includes at least one concrete, positive takeaway.
- **Accessible**: WCAG 2.1 AA compliance. Supports screen readers, high contrast, and text scaling.
- **Mobile-first**: Primary use case is smartphone access. Responsive up to desktop.

### Views and Components

#### 1.1 "Your Wellbeing Today" (Home Screen)

The landing view upon login. Displays current wellbeing snapshot.

| Component | Description | Data Source |
|-----------|-------------|-------------|
| **Wellbeing Ring** | Circular gauge showing today's composite wellbeing score (1-5 scale) | Latest EMA observation or daily average |
| **Mood Snapshot** | Simple emoji-adjacent icons for current affect (not actual emojis — custom accessible icons) | Latest EMA positive/negative affect |
| **Daily Insight Card** | 1-2 sentence AI-generated insight about today's pattern | Claude API (participant mode) |
| **EMA Prompt Button** | Primary CTA: "Check in now" — opens EMA questionnaire | Sampling schedule |
| **Streak Counter** | Days of consecutive EMA participation | Observation count |

**Layout**: Single-column, scrollable. Wellbeing Ring centered at top. Insight card below. EMA button fixed at bottom.

#### 1.2 Trend Patterns (Weekly/Monthly View)

Accessible via bottom tab navigation. Shows wellbeing trends over time.

| Component | Description | Data Source |
|-----------|-------------|-------------|
| **Trend Line Chart** | Line graph of positive affect, negative affect, and life satisfaction over selected window | Observations (7d, 14d, 30d, 90d toggles) |
| **Best Moments Highlight** | Cards highlighting the participant's top-3 highest-wellbeing moments with context | Observations sorted by composite score |
| **Pattern Summary** | AI-generated paragraph describing trends and contexts | Claude API |
| **Activity Correlations** | Simple bar chart: "You tend to feel best when..." with activity/social/location breakdowns | Aggregated observations by context |

**Chart library**: Recharts (React). Smooth curves, muted color palette (teal for PA, coral for NA, navy for LS). No gridlines. Minimal axis labels.

#### 1.3 Strength-Framed Insights (Insights Tab)

Periodic (weekly) deeper insights generated from accumulated data.

| Component | Description | Data Source |
|-----------|-------------|-------------|
| **Weekly Summary Card** | "This week in your wellbeing..." narrative | Claude API |
| **Strength Badge** | Visual badge highlighting a personal strength (e.g., "Social Connector", "Steady & Grounded") | Coupling type + volatility metrics |
| **Growth Opportunity** | Gentle suggestion framed as exploration, not prescription | Temporal dynamics + coupling analysis |
| **Trajectory Snapshot** | Simplified representation of lifespan trajectory (arrow: stable, rising, etc.) | Lifespan Trajectory Engine |

#### 1.4 Settings and Data Rights

| Component | Description |
|-----------|-------------|
| **Profile** | View/edit demographics, notification preferences |
| **EMA Schedule** | View current sampling schedule, request modifications |
| **My Data** | View all personal data, export as CSV/JSON, request deletion |
| **Consent** | View current consent form, update data sharing preferences |
| **Notifications** | Configure push notification timing and frequency |

### Navigation

- **Bottom tab bar** (mobile): Home, Trends, Insights, Settings
- **Sidebar** (desktop): Same sections, expanded labels
- **No hamburger menus** — all navigation visible at all times

---

## 2. Researcher Dashboard

### Overview

The Researcher Dashboard is a desktop-optimized web application for WELLab researchers to explore data, monitor study health, run analyses, and visualize results from all four AI modules. It provides deep analytical capabilities while maintaining the ethical guardrails defined in `references/ethics.md`.

### Design Principles

- **Data-dense**: Maximize information per screen. Support multiple panels and split views.
- **Interactive**: All visualizations support hover, click-to-drill-down, filter, and export.
- **Reproducible**: Every visualization includes a "Reproduce" button that exports the query, parameters, and model version.
- **Audit-aware**: All data access is logged. Sensitive views require re-authentication.

### Views and Components

#### 2.1 Study Overview (Home)

| Component | Description | Data Source |
|-----------|-------------|-------------|
| **Active Participants Counter** | Total enrolled, active, paused, withdrawn | Participant entities |
| **EMA Compliance Gauge** | Percentage of expected EMA responses received (today, 7d, 30d) | Observations vs schedule |
| **Data Quality Scorecard** | Flagged observations, missing data rate, response latency distribution | Data quality pipeline |
| **Module Status Cards** | 4 cards showing last model run, data freshness, alert count per module | Module metadata |
| **Recent Alerts Feed** | Scrollable list of participant alerts (volatility threshold, cognitive inflection) | Alert system |

#### 2.2 Coupling Heatmaps

Visualize IDELS emotion-satisfaction coupling across the study population.

| Component | Description | Data Source |
|-----------|-------------|-------------|
| **Coupling Distribution Pie/Donut** | Proportion of participants in each coupling type | IDELS AI Extension |
| **Coupling Heatmap** | 2D heatmap: PA slope (x) vs NA slope (y), colored by coupling type | Person-level coupling coefficients |
| **Coupling × Demographics** | Grouped bar charts showing coupling type distribution by age, sex, race/ethnicity, country | Coupling + demographics |
| **Temporal Stability Matrix** | Grid showing coupling type transitions over quarters | Temporal coupling analysis |
| **Individual Coupling Card** | Click a point on heatmap to see individual's coupling details, observation count, confidence | Participant coupling record |

**Rendering**: D3.js for heatmap (custom canvas rendering for performance with N > 5000). Recharts for bar/pie charts.

#### 2.3 Trajectory Clusters

Visualize lifespan trajectory archetypes and cluster assignments.

| Component | Description | Data Source |
|-----------|-------------|-------------|
| **Cluster Spaghetti Plot** | Overlaid individual trajectories colored by cluster assignment | Lifespan Trajectory Engine |
| **Cluster Summary Cards** | One card per cluster: label, prevalence, mean intercept/slope, description | Cluster model output |
| **Cluster × Predictors Table** | Table showing demographic and wellbeing predictors of cluster membership | Multinomial regression results |
| **Model Fit Panel** | BIC, AIC, entropy, number of clusters tested, elbow plot | Model selection output |
| **Individual Trajectory Viewer** | Search by participant ID, view growth curve with observed points and predicted trajectory | Individual growth parameters |

#### 2.4 Causal DAGs

Visualize and explore causal models from the Health Engine.

| Component | Description | Data Source |
|-----------|-------------|-------------|
| **DAG Editor/Viewer** | Interactive directed graph with draggable nodes, labeled edges | DoWhy causal model |
| **Effect Estimate Panel** | ATE, CATE, confidence intervals, p-values for selected causal path | Causal analysis results |
| **Refutation Results** | Pass/fail badges for each refutation test with detail expansion | Refutation output |
| **Sensitivity Analysis Plot** | How ATE changes under varying unmeasured confounding assumptions | Sensitivity analysis |
| **Bidirectional Summary** | Side-by-side comparison of wellbeing→health vs health→wellbeing paths | RI-CLPM results |

**Rendering**: D3.js force-directed graph for DAG. Custom edge labels with coefficient and significance indicators.

#### 2.5 Data Quality Monitors

| Component | Description | Data Source |
|-----------|-------------|-------------|
| **Compliance Timeline** | Daily EMA compliance rate over time, with study events annotated | Observations vs schedule |
| **Response Latency Histogram** | Distribution of time-from-prompt-to-response | Observation metadata |
| **Missing Data Matrix** | Heatmap of missing variables by participant and wave | All entities |
| **Flagged Observations Table** | Sortable table of observations with quality flags | Data quality pipeline |
| **Careless Response Detector** | Participants flagged for invariant responding, impossibly fast responses | Statistical detection |

#### 2.6 Cohort Comparison

| Component | Description | Data Source |
|-----------|-------------|-------------|
| **Cohort Builder** | Filter interface to define cohorts by demographics, coupling type, cluster, risk level | All participant attributes |
| **Side-by-Side Comparison** | Two-panel view comparing any metric across two user-defined cohorts | Aggregated metrics |
| **Statistical Tests** | Automated t-tests, chi-square, effect sizes with confidence intervals | On-demand computation |
| **Export** | CSV/JSON export of comparison results with full metadata | Export pipeline |

---

## 3. Policy Dashboard

### Overview

The Policy Dashboard is a desktop web application for policymakers, funders, and public health officials. It presents population-level findings in accessible, actionable formats. All data is aggregated and k-anonymized (minimum group size of 10) to protect individual privacy. No individual-level data is accessible from this dashboard.

### Design Principles

- **Population-level only**: Never display individual data. All metrics are aggregated.
- **Plain language**: Minimize jargon. Define technical terms on hover.
- **Actionable**: Connect findings to specific policy levers and intervention opportunities.
- **Trustworthy**: Show uncertainty ranges. Explain methodology on demand. Cite sources.
- **k-Anonymized**: Suppress any cell with fewer than 10 individuals.

### Views and Components

#### 3.1 Population Wellbeing Maps

| Component | Description | Data Source |
|-----------|-------------|-------------|
| **Choropleth Map** | Geographic heatmap of mean wellbeing scores by region (county, state, country) | Aggregated lifespan assessments |
| **Wellbeing Index Trend** | Time-series of population wellbeing index by year/wave | Aggregated assessments over time |
| **Demographic Breakdown** | Bar charts of wellbeing by age group, sex, race/ethnicity, education | Aggregated demographics × wellbeing |
| **Disparity Index** | Computed gap between highest and lowest demographic groups | Derived metric |
| **Data Coverage Indicator** | Shows N per region, highlights areas with insufficient data | Participant counts |

**Rendering**: D3.js choropleth with GeoJSON boundaries. Suppression applied when n < 10 for any cell.

#### 3.2 Dementia Risk Distribution

| Component | Description | Data Source |
|-----------|-------------|-------------|
| **Risk Distribution Histogram** | Population-level distribution of ADRD risk scores (binned) | Cognitive Health Engine |
| **Risk by Subgroup** | Grouped bar chart: risk distribution by age, sex, APOE status | Aggregated risk scores |
| **Protective Factor Impact Chart** | Tornado chart showing population-level impact of each modifiable factor | SHAP-based factor importance |
| **Survival Curve Comparison** | Population survival curves stratified by wellbeing tertiles | Survival analysis output |
| **Prevention Potential Estimator** | Interactive slider: "If we increased purpose by X%, we project Y fewer cases" | Counterfactual simulation |

#### 3.3 Intervention ROI

| Component | Description | Data Source |
|-----------|-------------|-------------|
| **Intervention Comparison Table** | Table of tested interventions with effect sizes, cost, reach, and ROI | Intervention entities |
| **Cost-Effectiveness Scatter** | Scatter plot: effect size (x) vs cost per participant (y) | Computed from intervention data |
| **Reach × Impact Matrix** | 2x2 grid: high/low reach vs high/low impact for each intervention type | Intervention metadata |
| **Projected Population Impact** | "If scaled to N people, expected outcomes..." projections | Simulation engine |
| **Evidence Quality Badges** | Badge per intervention: RCT, quasi-experimental, observational | Study design metadata |

#### 3.4 Reports and Export

| Component | Description |
|-----------|-------------|
| **Report Builder** | Select metrics, time period, populations to generate a PDF/PPTX report |
| **Scheduled Reports** | Configure weekly/monthly automated report delivery via email |
| **Data Export** | Download aggregated data tables (CSV) with k-anonymity applied |
| **API Access** | Read-only API endpoints for integration with external systems |

---

## 4. Shared Technical Specifications

### Technology Stack

| Component | Technology |
|-----------|-----------|
| Framework | React 18+ with TypeScript |
| Build tool | Vite |
| Styling | Tailwind CSS (custom theme: WELLab color palette) |
| Charts | Recharts (standard charts), D3.js (custom visualizations) |
| State management | React Query (TanStack Query) for server state, Zustand for UI state |
| Routing | React Router v6 |
| Testing | Jest + React Testing Library + Playwright (E2E) |
| Accessibility | axe-core (automated), manual screen reader testing |

### Color Palette

| Token | Hex | Usage |
|-------|-----|-------|
| `primary-teal` | `#0D7377` | Primary actions, positive affect lines |
| `primary-navy` | `#1B2A4A` | Headers, life satisfaction lines |
| `accent-coral` | `#E07A5F` | Alerts, negative affect lines |
| `accent-gold` | `#D4A843` | Highlights, badges |
| `neutral-100` | `#F7F7F7` | Background |
| `neutral-200` | `#E5E5E5` | Borders, dividers |
| `neutral-700` | `#4A4A4A` | Body text |
| `neutral-900` | `#1A1A1A` | Headings |
| `success` | `#2D8A4E` | Positive indicators |
| `warning` | `#D4A843` | Caution indicators |
| `error` | `#C44536` | Error states |

### Typography

| Element | Font | Size | Weight |
|---------|------|------|--------|
| H1 | Inter | 28px / 1.75rem | 700 |
| H2 | Inter | 22px / 1.375rem | 600 |
| H3 | Inter | 18px / 1.125rem | 600 |
| Body | Inter | 16px / 1rem | 400 |
| Small | Inter | 14px / 0.875rem | 400 |
| Caption | Inter | 12px / 0.75rem | 400 |
| Monospace | JetBrains Mono | 14px / 0.875rem | 400 |

### Data Flow

```
User action (page load, filter change, drill-down)
  → React component dispatches query via TanStack Query
  → API Gateway (authenticated request with JWT)
  → Lambda handler validates permissions (role-based)
  → DynamoDB query or S3 presigned URL
  → Response with cache headers
  → TanStack Query caches response (stale-while-revalidate)
  → React component renders visualization
```

### Authentication and Authorization

| Dashboard | Auth Pool | Roles | Session Duration |
|-----------|-----------|-------|------------------|
| Participant Experience | Cognito Participant Pool | `participant` | 30 days (refresh token) |
| Researcher Dashboard | Cognito Researcher Pool | `researcher`, `pi`, `admin` | 8 hours (refresh token) |
| Policy Dashboard | Cognito Researcher Pool | `policy_viewer`, `admin` | 8 hours (refresh token) |

**Role-based access**:
- `participant`: Own data only. Cannot access other participants or population data.
- `researcher`: All participant data (de-identified in UI). Module outputs. Cannot modify production data.
- `pi`: Researcher permissions + approve deployments + manage team access.
- `policy_viewer`: Aggregated data only. No individual-level access. k-anonymized outputs.
- `admin`: Full platform access. IAM policy management. Audit log review.

### Accessibility Requirements (WCAG 2.1 AA)

| Requirement | Implementation |
|-------------|----------------|
| Color contrast | Minimum 4.5:1 for body text, 3:1 for large text. All chart colors tested for colorblind accessibility. |
| Keyboard navigation | All interactive elements focusable. Tab order follows visual layout. Focus indicators visible. |
| Screen reader support | All charts have `aria-label` descriptions. Data tables have proper headers. Images have alt text. |
| Text scaling | UI supports up to 200% text scaling without horizontal scrolling. |
| Motion sensitivity | Animations respect `prefers-reduced-motion`. Chart transitions can be disabled. |
| Error handling | Form errors announced to screen readers. Error messages are descriptive and actionable. |
| Language | `lang` attribute set on HTML element. Content available in English (primary) with i18n framework for future languages. |

### Responsive Breakpoints

| Breakpoint | Width | Target |
|------------|-------|--------|
| `sm` | 640px | Small phones |
| `md` | 768px | Large phones, small tablets |
| `lg` | 1024px | Tablets, small laptops |
| `xl` | 1280px | Laptops, desktops |
| `2xl` | 1536px | Large desktops |

- Participant Experience UI: Optimized for `sm`-`md`. Functional at all breakpoints.
- Researcher Dashboard: Optimized for `xl`-`2xl`. Minimum usable at `lg`.
- Policy Dashboard: Optimized for `lg`-`xl`. Functional at `md`+.

### Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| First Contentful Paint | < 1.5s | Lighthouse |
| Largest Contentful Paint | < 2.5s | Lighthouse |
| Time to Interactive | < 3.5s | Lighthouse |
| Cumulative Layout Shift | < 0.1 | Lighthouse |
| API response (p95) | < 500ms | CloudWatch |
| Chart render (1000 points) | < 200ms | Performance API |
| Chart render (10000 points) | < 1000ms | Performance API |
