# %% [markdown]
# # Causal Inference: Wellbeing <--> Health
#
# **WELLab -- Washington University**
#
# This notebook applies the CausalHealthAnalyzer to estimate bidirectional
# causal effects between subjective well-being and objective health
# biomarkers.  We generate synthetic observational data with known
# confounders and compare the estimated effects in both directions.

# %% Cell 1 -- Imports and setup
import sys
import os
import logging
import warnings

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from src.ml.health_engine import CausalHealthAnalyzer, CausalEstimateResult
from src.ml.utils import set_reproducible_seed

SEED = 42
set_reproducible_seed(SEED)
rng = np.random.default_rng(SEED)

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
warnings.filterwarnings("ignore")

sns.set_theme(style="whitegrid", context="notebook", palette="colorblind")
print("Setup complete.")

# %% [markdown]
# ## Synthetic Health + Wellbeing Dataset
#
# We create 200 participants observed across 4 measurement waves.
# The data-generating process includes:
#
# - **Confounders**: age, socioeconomic status (SES), baseline physical
#   activity.
# - **True causal effects**: wellbeing --> health (beta = 0.35) and
#   health --> wellbeing (beta = 0.20).
# - **Noise** scaled realistically so that effects are detectable but
#   not trivial.

# %% Cell 2 -- Generate synthetic dataset
N_PARTICIPANTS = 200
N_WAVES = 4

records = []
for pid in range(N_PARTICIPANTS):
    age = rng.uniform(25, 75)
    ses = rng.normal(50, 15)
    activity = rng.normal(3, 1)  # hours/week

    wb_prev = 5.0 + 0.01 * ses + rng.normal(0, 0.5)
    hl_prev = 70 + 0.1 * ses - 0.15 * age + rng.normal(0, 3)

    for wave in range(N_WAVES):
        # Cross-lagged effects + confounders + noise
        wellbeing = (
            0.6 * wb_prev
            + 0.20 * (hl_prev - 70) / 10
            + 0.005 * ses
            + 0.1 * activity
            + rng.normal(0, 0.4)
        )
        health = (
            0.7 * hl_prev
            + 0.35 * (wb_prev - 5)
            + 0.08 * ses
            - 0.1 * age
            + 0.5 * activity
            + rng.normal(0, 2)
        )

        records.append({
            "participant_id": f"P{pid:03d}",
            "wave": wave,
            "wellbeing_score": float(wellbeing),
            "health_score": float(health),
            "age": age,
            "ses": ses,
            "physical_activity": activity,
        })

        wb_prev = wellbeing
        hl_prev = health

health_df = pd.DataFrame(records)
print(f"Dataset: {len(health_df)} rows, {health_df['participant_id'].nunique()} participants, "
      f"{N_WAVES} waves")
print(health_df.describe().round(2).to_string())

# %% [markdown]
# ## Instantiate CausalHealthAnalyzer

# %% Cell 3 -- Create analyser
analyzer = CausalHealthAnalyzer(seed=SEED)
print(f"CausalHealthAnalyzer ready  (method={analyzer.causal_method}, "
      f"alpha={analyzer.significance_level})")

# %% [markdown]
# ## Wellbeing --> Health
#
# We estimate the average causal effect of wellbeing on health,
# adjusting for age, SES, and physical activity.

# %% Cell 4 -- Causal effect: wellbeing -> health
wb_to_hl = analyzer.estimate_causal_effect(
    treatment="wellbeing_score",
    outcome="health_score",
    confounders=["age", "ses", "physical_activity"],
    data=health_df,
)

print("=" * 55)
print("  Wellbeing --> Health")
print("=" * 55)
print(f"  Estimate : {wb_to_hl.estimate:.4f}")
print(f"  95% CI   : ({wb_to_hl.confidence_interval[0]:.4f}, "
      f"{wb_to_hl.confidence_interval[1]:.4f})")
print(f"  Method   : {wb_to_hl.method}")
print("=" * 55)

# %% [markdown]
# ## Health --> Wellbeing (Reverse Direction)

# %% Cell 5 -- Causal effect: health -> wellbeing
hl_to_wb = analyzer.estimate_causal_effect(
    treatment="health_score",
    outcome="wellbeing_score",
    confounders=["age", "ses", "physical_activity"],
    data=health_df,
)

print("=" * 55)
print("  Health --> Wellbeing")
print("=" * 55)
print(f"  Estimate : {hl_to_wb.estimate:.4f}")
print(f"  95% CI   : ({hl_to_wb.confidence_interval[0]:.4f}, "
      f"{hl_to_wb.confidence_interval[1]:.4f})")
print(f"  Method   : {hl_to_wb.method}")
print("=" * 55)

# Compare directions
fig, ax = plt.subplots(figsize=(6, 4))
labels = ["WB -> Health", "Health -> WB"]
estimates = [wb_to_hl.estimate, hl_to_wb.estimate]
ci_low = [wb_to_hl.confidence_interval[0], hl_to_wb.confidence_interval[0]]
ci_high = [wb_to_hl.confidence_interval[1], hl_to_wb.confidence_interval[1]]
errors = [[e - lo for e, lo in zip(estimates, ci_low)],
          [hi - e for e, hi in zip(estimates, ci_high)]]

ax.barh(labels, estimates, xerr=errors, capsize=5, color=["#4C72B0", "#DD8452"])
ax.axvline(0, color="black", lw=0.8, ls="--")
ax.set_xlabel("Estimated Causal Effect")
ax.set_title("Bidirectional Causal Effects")
plt.tight_layout()
plt.show()

# %% [markdown]
# ## Longitudinal Regression
#
# We fit a longitudinal (stub OLS-per-group) regression to model the
# within-person trajectory of health outcomes across waves.

# %% Cell 6 -- Longitudinal regression
long_results = analyzer.run_longitudinal_regression(
    data=health_df,
    outcome="health_score",
    time_var="wave",
    group_var="participant_id",
)

print("Longitudinal regression results:")
for k, v in long_results.items():
    print(f"  {k}: {v}")

# Plot per-participant slopes
participant_slopes = []
for pid, grp in health_df.groupby("participant_id"):
    if len(grp) >= 2:
        coeffs = np.polyfit(grp["wave"], grp["health_score"], 1)
        participant_slopes.append(coeffs[0])

fig, ax = plt.subplots(figsize=(7, 4))
ax.hist(participant_slopes, bins=25, edgecolor="white", alpha=0.8)
ax.axvline(np.mean(participant_slopes), color="red", lw=2, ls="--",
           label=f"Mean = {np.mean(participant_slopes):.2f}")
ax.set_xlabel("Per-Participant Health Slope (per wave)")
ax.set_ylabel("Count")
ax.set_title("Distribution of Longitudinal Health Trajectories")
ax.legend()
plt.tight_layout()
plt.show()

# %% [markdown]
# ## Bidirectional Analysis
#
# The `bidirectional_analysis` method runs both directions simultaneously
# on merged wellbeing + health datasets.

# %% Cell 7 -- Bidirectional analysis
wb_data = health_df[["participant_id", "wave", "wellbeing_score"]].copy()
hl_data = health_df[["participant_id", "wave", "health_score"]].copy()

bidir = analyzer.bidirectional_analysis(wb_data, hl_data)

fig, ax = plt.subplots(figsize=(6, 4))
directions = list(bidir.keys())
ests = [bidir[d].estimate for d in directions]
cis = [bidir[d].confidence_interval for d in directions]
err = [[e - ci[0] for e, ci in zip(ests, cis)],
       [ci[1] - e for e, ci in zip(ests, cis)]]

colors = ["#4C72B0", "#DD8452"]
ax.barh(directions, ests, xerr=err, capsize=5, color=colors)
ax.axvline(0, color="black", lw=0.8, ls="--")
ax.set_xlabel("Estimated Effect")
ax.set_title("Cross-Lagged Bidirectional Effects")
plt.tight_layout()
plt.show()

for direction, result in bidir.items():
    print(f"{direction}: estimate={result.estimate:.4f}, "
          f"CI=({result.confidence_interval[0]:.4f}, "
          f"{result.confidence_interval[1]:.4f})")

# %% [markdown]
# ## Sensitivity Analysis
#
# We assess how the wellbeing --> health effect changes as we vary
# the set of confounders included in the model.

# %% Cell 8 -- Sensitivity analysis
confounder_sets = {
    "None": [],
    "Age only": ["age"],
    "Age + SES": ["age", "ses"],
    "Age + SES + Activity": ["age", "ses", "physical_activity"],
    "SES + Activity": ["ses", "physical_activity"],
}

sensitivity_results = {}
for label, confounders in confounder_sets.items():
    # Must have at least one confounder for the stub; use wave if empty
    conf = confounders if confounders else ["wave"]
    result = analyzer.estimate_causal_effect(
        treatment="wellbeing_score",
        outcome="health_score",
        confounders=conf,
        data=health_df,
    )
    sensitivity_results[label] = result

fig, ax = plt.subplots(figsize=(8, 4))
labels_s = list(sensitivity_results.keys())
ests_s = [sensitivity_results[l].estimate for l in labels_s]
ci_s = [sensitivity_results[l].confidence_interval for l in labels_s]
err_s = [[e - c[0] for e, c in zip(ests_s, ci_s)],
         [c[1] - e for e, c in zip(ests_s, ci_s)]]

ax.errorbar(labels_s, ests_s, yerr=err_s, fmt="o-", capsize=5, markersize=8)
ax.set_ylabel("Estimated Effect (WB -> Health)")
ax.set_xlabel("Confounder Set")
ax.set_title("Sensitivity of Causal Estimate to Confounder Specification")
ax.axhline(0, color="gray", ls="--", lw=0.8)
plt.xticks(rotation=20, ha="right")
plt.tight_layout()
plt.show()

# %% [markdown]
# ## Results Summary

# %% Cell 9 -- Summary table
rows = []
for label, result in sensitivity_results.items():
    rows.append({
        "Confounder set": label,
        "Estimate": result.estimate,
        "CI lower": result.confidence_interval[0],
        "CI upper": result.confidence_interval[1],
        "Method": result.method,
    })

summary_df = pd.DataFrame(rows)
print("=" * 75)
print("  CAUSAL INFERENCE -- RESULTS SUMMARY")
print("=" * 75)
print(summary_df.to_string(index=False, float_format="%.4f"))
print()
print(f"Bidirectional comparison:")
print(f"  WB -> Health : {bidir['wellbeing_to_health'].estimate:.4f}")
print(f"  Health -> WB : {bidir['health_to_wellbeing'].estimate:.4f}")
print(f"  Longitudinal slope (mean) : {long_results['fixed_effect_slope']:.4f}")
print("=" * 75)
