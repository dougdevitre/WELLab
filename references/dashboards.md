# Dashboard Specifications

## 1. Participant Experience UI

### Design Principles
- **Mobile-first**: Primary access via smartphone; responsive up to tablet
- **Strength-framed**: All insights emphasize what's going well; growth areas framed constructively
- **Accessible**: WCAG 2.1 AA compliant; support for screen readers, high contrast, large text

### Sections

#### "Your Wellbeing Today" Score Card
- Composite wellbeing score (0–100 visual scale)
- Color-coded status: green (thriving), blue (doing well), yellow (mixed), gray (insufficient data)
- Comparison to participant's own 30-day average (not to others)

#### Trend Patterns
- Line chart: 7-day and 30-day positive affect, negative affect, life satisfaction
- Sparklines for quick glance of week-over-week change
- Tap to expand for detailed daily view

#### Strength-Framed Insights
- AI-generated (Claude API) personalized messages, e.g.:
  - "You tend to feel most satisfied after social interactions — your connections are a real strength."
  - "Your emotional balance has been improving over the past two weeks."
- Maximum 3 insights per session; rotated weekly
- Human-reviewed template library with personalized variable substitution

#### Activity & Intervention Log
- List of completed and upcoming activities/prompts
- Self-rated helpfulness after each intervention
- "Explore more" suggestions based on what's worked

### Data Flow
```
DynamoDB → API Gateway → Lambda → JSON response
  → React (mobile-optimized) → Recharts/D3 visualizations
```

---

## 2. Researcher Dashboard

### Design Principles
- **Desktop-first**: Optimized for large-screen analysis workflows
- **Interactive**: Click-to-filter, drill-down, export capabilities
- **Reproducible**: Every visualization includes a "Methods" tooltip with computation details

### Sections

#### Coupling Heatmap
- Matrix: participants × coupling metrics (type, strength, volatility)
- Color scale: diverging (blue = positive coupling, red = negative, gray = decoupled)
- Click participant row to view individual time series
- Filter by cohort, age group, culture group

#### Trajectory Clusters
- Scatter/line plot showing identified trajectory archetypes
- Each cluster labeled with descriptive name and n-count
- Toggle between life satisfaction, eudaimonic, and hedonic dimensions
- Silhouette score and BIC displayed for model selection transparency

#### Causal DAGs
- Interactive directed acyclic graph visualization (D3)
- Nodes: wellbeing, health, cognitive, demographic variables
- Edges: estimated causal effects with strength and direction
- Click edge to view full estimation details (method, CI, p-value)

#### Data Quality Monitor
- Completion rates by participant, day, time window
- Missing data heatmap (participants × variables)
- Response latency distribution
- Alerts for participants below compliance threshold (< 50% response rate)

#### Cohort Selector
- Dropdown/multi-select for: culture group, age band, enrollment wave, study arm
- All visualizations update reactively when cohort changes

### Data Flow
```
DynamoDB / S3 (Parquet) → API → Aggregation Lambda
  → React → D3 (heatmaps, DAGs) + Recharts (charts, tables)
```

---

## 3. Policy Dashboard

### Design Principles
- **Privacy-first**: All data aggregated to k-anonymity ≥ 10
- **Accessible**: Plain-language labels; no jargon
- **Printable**: Export-ready charts for reports and presentations

### Sections

#### Population Wellbeing Map
- Choropleth or bubble map by region/site
- Metric: mean wellbeing composite with CI error bars
- Toggle: current snapshot vs. year-over-year change

#### Dementia Risk Distribution
- Histogram of risk scores across population (aggregated, no individual data)
- Overlays by modifiable factor (physical activity level, social engagement)
- Projected reduction under intervention scenarios

#### Intervention ROI Table
- Rows: intervention types (coaching, activity prompts, psychoeducation, referral)
- Columns: n_delivered, n_completed, mean_outcome_rating, estimated_effect_size, cost_per_unit
- Sortable by any column

#### Trend Summary
- Population-level wellbeing trend over time (quarterly aggregation)
- Breakdown by demographic group (with k-anonymity check)
- Confidence bands shown on all trend lines

### Data Flow
```
S3 (aggregated Parquet) → API Gateway → Lambda (k-anonymity check)
  → React → Recharts (charts) + HTML tables (ROI)
```

---

## Accessibility Requirements (All Dashboards)
- WCAG 2.1 AA compliance
- Keyboard navigation for all interactive elements
- ARIA labels on all charts and dynamic content
- Color-blind safe palettes (tested with Coblis simulator)
- Minimum 4.5:1 contrast ratio for text
- Screen reader compatible: all charts have `aria-label` summaries
- Responsive: participant UI mobile-first; researcher/policy desktop-first with tablet support
