# %% [markdown]
# # Cognitive Risk Assessment: Dementia Prevention
#
# **WELLab -- Washington University**
#
# This notebook demonstrates the CognitiveRiskModel for predicting
# cognitive decline, identifying protective factors, and performing
# survival analysis.  All data is synthetic and generated in-notebook
# for reproducibility.

# %% Cell 1 -- Imports and setup
import sys
import os
import logging
import warnings

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.metrics import roc_auc_score, roc_curve
from sklearn.calibration import calibration_curve

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from src.ml.cognitive_health import CognitiveRiskModel
from src.ml.utils import set_reproducible_seed

SEED = 42
set_reproducible_seed(SEED)
rng = np.random.default_rng(SEED)

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
warnings.filterwarnings("ignore")

sns.set_theme(style="whitegrid", context="notebook", palette="colorblind")
print("Setup complete.")

# %% [markdown]
# ## Synthetic Cognitive + Wellbeing Dataset
#
# We simulate 500 participants with the following features:
#
# | Feature              | Description                          |
# |----------------------|--------------------------------------|
# | age                  | 50-90 years                          |
# | education_years      | 8-20 years of schooling              |
# | wellbeing_score      | Subjective wellbeing (1-10)          |
# | social_engagement    | Social activity index (0-10)         |
# | physical_activity    | Exercise hours per week              |
# | sleep_quality        | Self-rated sleep quality (1-10)      |
# | cardiovascular_risk  | Composite CV risk score (0-1)        |
# | cognitive_baseline   | Baseline cognitive test score        |
# | apoe4_carrier        | APOE-e4 allele carrier (0/1)         |
# | depression_history   | History of depression (0/1)          |
#
# The binary outcome `cognitive_decline` is generated from a logistic
# model with known coefficients.

# %% Cell 2 -- Generate synthetic dataset
N = 500

data = pd.DataFrame({
    "age": rng.uniform(50, 90, N),
    "education_years": rng.normal(14, 3, N).clip(8, 20),
    "wellbeing_score": rng.normal(6, 1.5, N).clip(1, 10),
    "social_engagement": rng.normal(5, 2, N).clip(0, 10),
    "physical_activity": rng.exponential(3, N).clip(0, 15),
    "sleep_quality": rng.normal(6, 2, N).clip(1, 10),
    "cardiovascular_risk": rng.beta(2, 5, N),
    "cognitive_baseline": rng.normal(100, 15, N),
    "apoe4_carrier": rng.binomial(1, 0.25, N),
    "depression_history": rng.binomial(1, 0.20, N),
})

# Logistic model for cognitive decline
logit = (
    0.06 * (data["age"] - 70)
    - 0.15 * (data["education_years"] - 14)
    - 0.20 * (data["wellbeing_score"] - 6)
    - 0.10 * data["social_engagement"]
    - 0.08 * data["physical_activity"]
    - 0.05 * data["sleep_quality"]
    + 2.0 * data["cardiovascular_risk"]
    - 0.02 * (data["cognitive_baseline"] - 100)
    + 0.8 * data["apoe4_carrier"]
    + 0.5 * data["depression_history"]
    - 1.5  # intercept
)
prob = 1 / (1 + np.exp(-logit))
data["cognitive_decline"] = rng.binomial(1, prob)

print(f"Dataset: {len(data)} participants")
print(f"Decline prevalence: {data['cognitive_decline'].mean():.1%}")
print(data.describe().round(2).to_string())

# %% [markdown]
# ## Fit CognitiveRiskModel

# %% Cell 3 -- Train model
model = CognitiveRiskModel(risk_threshold=0.5, n_estimators=100, max_depth=6, seed=SEED)
model.fit(data, target_col="cognitive_decline")

print(f"Model fitted: {len(model._feature_names)} features")
print(f"Features: {model._feature_names}")

# %% [markdown]
# ## Risk Score Distribution
#
# We predict risk probabilities for all participants and examine the
# distribution.

# %% Cell 4 -- Predict risk scores
risk_df = model.predict_risk(data[model._feature_names])

fig, ax = plt.subplots(figsize=(8, 5))
for label, color in [(0, "#55A868"), (1, "#C44E52")]:
    subset = risk_df.loc[data["cognitive_decline"] == label, "risk_probability"]
    ax.hist(subset, bins=30, alpha=0.6, color=color,
            label=f"Decline={label} (n={len(subset)})")
ax.axvline(model.risk_threshold, color="black", ls="--", lw=1.5,
           label=f"Threshold={model.risk_threshold}")
ax.set_xlabel("Predicted Risk Probability")
ax.set_ylabel("Count")
ax.set_title("Distribution of Cognitive Decline Risk Scores")
ax.legend()
plt.tight_layout()
plt.show()

print(f"High-risk participants: {risk_df['high_risk'].sum()} / {len(risk_df)}")

# %% [markdown]
# ## Protective Factor Analysis
#
# Features whose removal most damages discrimination of decline cases
# are considered important; those with negative permutation importance
# are protective.

# %% Cell 5 -- Protective factors, feature importance bar chart
protective = model.identify_protective_factors(data, target_col="cognitive_decline", top_n=10)

fig, ax = plt.subplots(figsize=(8, 5))
names = [p[0] for p in protective]
scores = [p[1] for p in protective]
bar_colors = ["#55A868" if s < 0 else "#C44E52" for s in scores]

ax.barh(names, scores, color=bar_colors, edgecolor="white")
ax.axvline(0, color="black", lw=0.8)
ax.set_xlabel("Permutation Importance")
ax.set_title("Feature Importance (negative = protective)")
ax.invert_yaxis()
plt.tight_layout()
plt.show()

print("Top protective factors:")
for name, score in protective:
    direction = "PROTECTIVE" if score < 0 else "risk"
    print(f"  {name:25s} importance={score:+.4f}  ({direction})")

# %% [markdown]
# ## Survival Analysis
#
# We generate synthetic time-to-event data and run the survival
# analysis method (Cox PH when lifelines is available, stub otherwise).

# %% Cell 6 -- Survival / Kaplan-Meier analysis
# Generate time-to-event data
hazard = 0.02 * np.exp(logit)
time_to_event = rng.exponential(1 / hazard.clip(0.001))
time_to_event = time_to_event.clip(0, 20)  # max 20 years follow-up
event_observed = (time_to_event < 15).astype(int)  # censoring at 15 years

survival_df = data[model._feature_names].copy()
survival_df["years_to_event"] = time_to_event
survival_df["event_observed"] = event_observed

surv_results = model.survival_analysis(survival_df)

print("Survival analysis results:")
for k, v in surv_results.items():
    if k != "summary":
        print(f"  {k}: {v}")

# Kaplan-Meier-style plot (empirical survival curves by risk group)
risk_df["risk_group"] = pd.cut(risk_df["risk_probability"],
                               bins=[0, 0.3, 0.5, 0.7, 1.0],
                               labels=["low", "moderate", "high", "very_high"])

fig, ax = plt.subplots(figsize=(8, 5))
time_grid = np.linspace(0, 15, 100)

for group, color in [("low", "#55A868"), ("moderate", "#4C72B0"),
                      ("high", "#DD8452"), ("very_high", "#C44E52")]:
    mask = risk_df["risk_group"] == group
    if mask.sum() == 0:
        continue
    t = time_to_event[mask.values]
    e = event_observed[mask.values]

    # Simple KM estimate
    sorted_t = np.sort(t)
    surv = np.array([np.mean(t > tt) for tt in time_grid])
    ax.plot(time_grid, surv, lw=2, label=f"{group} (n={mask.sum()})", color=color)

ax.set_xlabel("Years")
ax.set_ylabel("Survival Probability")
ax.set_title("Kaplan-Meier Survival Curves by Risk Group")
ax.legend()
ax.set_ylim(0, 1.05)
plt.tight_layout()
plt.show()

# %% [markdown]
# ## Risk Stratification

# %% Cell 7 -- Risk stratification by group
risk_df["decline_actual"] = data["cognitive_decline"].values

strat = risk_df.groupby("risk_group").agg(
    n=("risk_probability", "count"),
    mean_risk=("risk_probability", "mean"),
    actual_decline_rate=("decline_actual", "mean"),
).reset_index()

print("Risk Stratification:")
print(strat.to_string(index=False, float_format="%.3f"))
print()

fig, ax = plt.subplots(figsize=(7, 4))
x = np.arange(len(strat))
w = 0.35
ax.bar(x - w/2, strat["mean_risk"], w, label="Mean predicted risk", color="#4C72B0")
ax.bar(x + w/2, strat["actual_decline_rate"], w, label="Actual decline rate", color="#DD8452")
ax.set_xticks(x)
ax.set_xticklabels(strat["risk_group"])
ax.set_ylabel("Rate")
ax.set_title("Predicted Risk vs Actual Decline Rate by Risk Group")
ax.legend()
plt.tight_layout()
plt.show()

# %% [markdown]
# ## Wellbeing as Protective Factor
#
# We isolate the role of wellbeing by comparing decline rates across
# wellbeing tertiles, controlling for age.

# %% Cell 8 -- Wellbeing as protective factor
data["wellbeing_tertile"] = pd.qcut(data["wellbeing_score"], 3,
                                     labels=["Low", "Medium", "High"])
data["age_group"] = pd.cut(data["age"], bins=[50, 65, 75, 90],
                            labels=["50-65", "65-75", "75-90"])

wb_analysis = data.groupby(["age_group", "wellbeing_tertile"]).agg(
    n=("cognitive_decline", "count"),
    decline_rate=("cognitive_decline", "mean"),
).reset_index()

print("Decline rate by age group and wellbeing tertile:")
print(wb_analysis.to_string(index=False, float_format="%.3f"))

fig, ax = plt.subplots(figsize=(8, 5))
pivot = wb_analysis.pivot(index="age_group", columns="wellbeing_tertile",
                          values="decline_rate")
pivot.plot(kind="bar", ax=ax, edgecolor="white")
ax.set_ylabel("Cognitive Decline Rate")
ax.set_xlabel("Age Group")
ax.set_title("Wellbeing as Protective Factor: Decline Rate by Age and Wellbeing")
ax.legend(title="Wellbeing tertile")
plt.xticks(rotation=0)
plt.tight_layout()
plt.show()

# %% [markdown]
# ## Model Performance

# %% Cell 9 -- AUC and calibration plot
y_true = data["cognitive_decline"].values
y_prob = risk_df["risk_probability"].values

auc = roc_auc_score(y_true, y_prob)
fpr, tpr, _ = roc_curve(y_true, y_prob)

fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 5))

# ROC curve
ax1.plot(fpr, tpr, lw=2, label=f"AUC = {auc:.3f}")
ax1.plot([0, 1], [0, 1], "k--", lw=0.8)
ax1.set_xlabel("False Positive Rate")
ax1.set_ylabel("True Positive Rate")
ax1.set_title("ROC Curve")
ax1.legend()

# Calibration plot
prob_true, prob_pred = calibration_curve(y_true, y_prob, n_bins=10)
ax2.plot(prob_pred, prob_true, "o-", lw=2, label="Model")
ax2.plot([0, 1], [0, 1], "k--", lw=0.8, label="Perfect calibration")
ax2.set_xlabel("Mean Predicted Probability")
ax2.set_ylabel("Observed Proportion")
ax2.set_title("Calibration Plot")
ax2.legend()

plt.tight_layout()
plt.show()

print("=" * 55)
print("  COGNITIVE RISK MODEL -- PERFORMANCE SUMMARY")
print("=" * 55)
print(f"  AUC-ROC           : {auc:.4f}")
print(f"  N participants    : {len(data)}")
print(f"  Decline prevalence: {data['cognitive_decline'].mean():.3f}")
print(f"  High-risk flagged : {risk_df['high_risk'].sum()}")
print(f"  Features used     : {len(model._feature_names)}")
print("=" * 55)
