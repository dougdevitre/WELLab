# Advanced AI Capabilities Layer

## 1. IDELS AI Extension

### Overview
The Intraindividual Dynamics of Emotion and Life Satisfaction (IDELS) framework quantifies how momentary emotions couple with life satisfaction judgments within individuals over time.

### Coupling Types

| Type | Description | Pattern | Clinical Implication |
|------|-------------|---------|---------------------|
| **Positive** | High positive affect → higher life satisfaction | r > +0.30 | Emotions strongly inform wellbeing judgments |
| **Negative** | High negative affect → lower life satisfaction | r < -0.30 | Distress dominates wellbeing evaluation |
| **Decoupled** | Affect and satisfaction vary independently | \|r\| < 0.30 | Cognitive evaluation dominates; affect less influential |
| **Complex** | Non-linear or context-dependent relationship | Non-monotonic | Requires deeper profiling; may indicate transition states |

### Classification Pipeline
1. Collect ≥ 20 EMA observations per participant
2. Compute lagged within-person correlations (emotion[t] → satisfaction[t], emotion[t-1] → satisfaction[t])
3. Classify coupling type via threshold-based rules + Random Forest for edge cases
4. Output coupling type, strength, and confidence interval

### Configuration
```python
COUPLING_THRESHOLD = 0.30        # |r| above this = coupled
MIN_OBSERVATIONS = 20            # minimum for stable estimate
LAG_WINDOWS = [0, 1, 2]          # concurrent, 1-lag, 2-lag
CONFIDENCE_LEVEL = 0.95          # for bootstrap CI
```

---

## 2. Temporal Dynamics Engine

### Overview
Computes within-person temporal dynamics metrics that capture how wellbeing changes over time, beyond simple averages.

### Metrics

| Metric | Formula | Interpretation |
|--------|---------|----------------|
| **iSD** | Within-person SD | Overall variability |
| **MSSD** | Mean squared successive difference | Moment-to-moment instability |
| **RMSSD** | √MSSD | Instability on original scale |
| **Coefficient of Variation** | iSD / iMean | Relative variability |
| **Rate of Change** | First difference / Δt | Speed of change |
| **Inertia** | Autocorrelation lag-1 | Emotional carry-over |
| **Entropy** | Shannon entropy of discretized values | Predictability |

### Within-Person vs. Between-Person Decomposition
- **Within-person**: All metrics computed per participant across their own time series
- **Between-person**: Aggregate metrics compared across participants for population-level insights
- **Contextual decomposition**: Metrics computed separately by context (work, home, social) to identify environment-specific patterns

### Alert Thresholds
- Volatility alert: RMSSD > participant's rolling 30-day mean + 2 SD
- Inertia alert: Autocorrelation > 0.7 (emotional "stickiness" may indicate rumination)
- Entropy alert: Entropy < 0.5 (affect becoming rigidly fixed)

---

## 3. Bidirectional Modeling System

### Overview
Estimates reciprocal causal effects between wellbeing and health outcomes using structural causal models and cross-lagged panel designs.

### Model Types

#### Cross-Lagged Panel Model (CLPM)
```
Wellbeing[t] → Wellbeing[t+1] (autoregressive)
Health[t]    → Health[t+1]    (autoregressive)
Wellbeing[t] → Health[t+1]    (cross-lagged: WB→Health)
Health[t]    → Wellbeing[t+1] (cross-lagged: Health→WB)
```

#### Random Intercept CLPM (RI-CLPM)
Separates within-person dynamics from stable between-person differences:
- Between-person: Trait-level wellbeing ↔ trait-level health
- Within-person: State deviations from personal means

#### DoWhy Causal Pipeline
1. Define causal graph (DAG) with domain expertise
2. Identify estimand via backdoor or instrumental variable criterion
3. Estimate effect via linear regression, propensity score matching, or IV
4. Refute with placebo treatment, random common cause, data subset tests

### Output Schema
```json
{
  "model_type": "RI-CLPM",
  "effects": {
    "wellbeing_to_health": { "estimate": 0.15, "se": 0.04, "p": 0.001, "ci": [0.07, 0.23] },
    "health_to_wellbeing": { "estimate": 0.08, "se": 0.03, "p": 0.012, "ci": [0.02, 0.14] }
  },
  "fit_indices": { "CFI": 0.97, "RMSEA": 0.04, "SRMR": 0.03 },
  "n_participants": 1250,
  "n_timepoints": 4
}
```

---

## 4. Claude API Integration

### Natural Language Insight Generation
Uses Anthropic's Claude API to transform statistical outputs into participant-friendly, strength-framed narratives.

### Use Cases
- **Participant Insights**: "Your positive emotions and life satisfaction are closely connected — when you feel joyful, your overall sense of wellbeing rises too."
- **Researcher Summaries**: Auto-generated methods and results paragraphs for coupling/trajectory analyses
- **Policy Briefs**: Plain-language summaries of population-level findings for stakeholders

### Guardrails
- Never disclose raw risk scores or clinical diagnoses via AI-generated text
- All outputs framed in strengths-based language (what's going well, not what's wrong)
- Confidence qualifiers included ("Our data suggest..." not "You have...")
- Human review required before any AI-generated content is shown to participants
