# %% [markdown]
# # Data Drift Monitoring
#
# **WELLab -- Washington University**
#
# This notebook demonstrates the DataDriftDetector for identifying
# distributional shifts between reference (training) data and incoming
# production data.  We cover per-feature drift detection, PSI and K-S
# statistics, gradual drift simulation, and alerting thresholds.

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

from src.ml.drift import DataDriftDetector, DriftReport

SEED = 42
np.random.seed(SEED)
rng = np.random.default_rng(SEED)

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
warnings.filterwarnings("ignore")

sns.set_theme(style="whitegrid", context="notebook", palette="colorblind")
print("Setup complete.")

# %% [markdown]
# ## Reference and Drifted Datasets
#
# The **reference** dataset represents the training distribution.
# The **drifted** dataset has shifted means and variances for a subset
# of features, simulating real-world distribution change.

# %% Cell 2 -- Generate reference and drifted datasets
N_REF = 1000
N_NEW = 500

feature_specs = {
    "age":                {"ref_mean": 55, "ref_std": 12, "drift_shift": 5,  "drift_scale": 1.0},
    "wellbeing_score":    {"ref_mean": 6,  "ref_std": 1.5,"drift_shift": -0.8,"drift_scale": 1.3},
    "sleep_quality":      {"ref_mean": 6,  "ref_std": 2,  "drift_shift": 0,  "drift_scale": 1.0},
    "physical_activity":  {"ref_mean": 3,  "ref_std": 1.5,"drift_shift": -1,  "drift_scale": 1.5},
    "social_engagement":  {"ref_mean": 5,  "ref_std": 2,  "drift_shift": 0,  "drift_scale": 1.0},
    "cognitive_score":    {"ref_mean": 100,"ref_std": 15, "drift_shift": -8,  "drift_scale": 1.2},
    "cardiovascular_risk":{"ref_mean": 0.3,"ref_std": 0.15,"drift_shift": 0.1,"drift_scale": 1.0},
    "bmi":                {"ref_mean": 26, "ref_std": 4,  "drift_shift": 2,  "drift_scale": 1.0},
}

ref_data = {}
new_data = {}
for feat, spec in feature_specs.items():
    ref_data[feat] = rng.normal(spec["ref_mean"], spec["ref_std"], N_REF)
    new_data[feat] = rng.normal(
        spec["ref_mean"] + spec["drift_shift"],
        spec["ref_std"] * spec["drift_scale"],
        N_NEW,
    )

ref_df = pd.DataFrame(ref_data)
new_df = pd.DataFrame(new_data)

print(f"Reference dataset: {len(ref_df)} rows, {len(ref_df.columns)} features")
print(f"New dataset      : {len(new_df)} rows, {len(new_df.columns)} features")
print()
print("Feature means comparison:")
comparison = pd.DataFrame({
    "Reference mean": ref_df.mean(),
    "New mean": new_df.mean(),
    "Shift": new_df.mean() - ref_df.mean(),
}).round(3)
print(comparison.to_string())

# %% [markdown]
# ## Fit DataDriftDetector on Reference Data

# %% Cell 3 -- Fit detector
detector = DataDriftDetector(
    p_value_threshold=0.05,
    psi_threshold=0.20,
)
detector.fit(ref_df)

print(f"Detector fitted on reference data ({len(ref_df)} rows, "
      f"{len(ref_df.columns)} features)")

# %% [markdown]
# ## Detect Drift on New Data

# %% Cell 4 -- Detect drift, display report
report = detector.detect(new_df)

print("=" * 60)
print("  DRIFT DETECTION REPORT")
print("=" * 60)
print(f"  Overall drifted : {report.overall_drifted}")
print(f"  Severity        : {report.severity}")
print(f"  Features tested : {report.summary['n_features_tested']}")
print(f"  Features drifted: {report.summary['n_drifted']}")
print(f"  Drift fraction  : {report.summary['drift_fraction']:.2%}")
print("=" * 60)
print()

print("Per-feature results:")
print(f"{'Feature':<25s} {'Test':<20s} {'Statistic':>10s} {'p-value':>10s} "
      f"{'PSI':>8s} {'Drifted':>8s}")
print("-" * 85)
for r in report.feature_results:
    psi_str = f"{r.psi:.4f}" if r.psi is not None else "N/A"
    print(f"{r.feature:<25s} {r.test_name:<20s} {r.statistic:>10.4f} {r.p_value:>10.4f} "
          f"{psi_str:>8s} {'YES' if r.drifted else 'no':>8s}")

# %% [markdown]
# ## Per-Feature Drift Visualisation
#
# We plot PSI values and K-S statistics side by side for each feature
# to identify which variables have shifted the most.

# %% Cell 5 -- PSI and K-S bar charts
features = [r.feature for r in report.feature_results]
ks_stats = [r.statistic for r in report.feature_results]
psi_vals = [r.psi if r.psi is not None else 0 for r in report.feature_results]
drifted = [r.drifted for r in report.feature_results]

fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5))

# K-S statistics
colors_ks = ["#C44E52" if d else "#55A868" for d in drifted]
ax1.barh(features, ks_stats, color=colors_ks, edgecolor="white")
ax1.axvline(0.05, color="gray", ls="--", lw=1, label="Reference")
ax1.set_xlabel("K-S Statistic")
ax1.set_title("Kolmogorov-Smirnov Statistics")
ax1.invert_yaxis()

# PSI values
colors_psi = ["#C44E52" if p > detector.psi_threshold else "#55A868" for p in psi_vals]
ax2.barh(features, psi_vals, color=colors_psi, edgecolor="white")
ax2.axvline(detector.psi_threshold, color="red", ls="--", lw=1.5,
            label=f"Threshold={detector.psi_threshold}")
ax2.set_xlabel("PSI")
ax2.set_title("Population Stability Index")
ax2.legend()
ax2.invert_yaxis()

plt.tight_layout()
plt.show()

# Distribution comparison for drifted features
drifted_features = report.drifted_features
n_drifted = len(drifted_features)
if n_drifted > 0:
    n_cols = min(n_drifted, 3)
    n_rows = (n_drifted + n_cols - 1) // n_cols
    fig, axes = plt.subplots(n_rows, n_cols, figsize=(5 * n_cols, 4 * n_rows))
    axes_flat = np.atleast_1d(axes).ravel()

    for i, feat in enumerate(drifted_features):
        ax = axes_flat[i]
        ax.hist(ref_df[feat], bins=30, alpha=0.5, density=True, label="Reference",
                color="#4C72B0")
        ax.hist(new_df[feat], bins=30, alpha=0.5, density=True, label="New data",
                color="#C44E52")
        ax.set_title(f"{feat} (DRIFTED)")
        ax.set_xlabel(feat)
        ax.set_ylabel("Density")
        ax.legend(fontsize=8)

    # Hide unused axes
    for j in range(i + 1, len(axes_flat)):
        axes_flat[j].set_visible(False)

    plt.suptitle("Distribution Comparison for Drifted Features", fontsize=14, y=1.02)
    plt.tight_layout()
    plt.show()

# %% [markdown]
# ## Gradual Drift Simulation
#
# We simulate drift that increases over 12 monthly batches, tracking
# how the drift severity evolves over time.  This models a scenario
# where population characteristics shift slowly (e.g., demographic
# change in a longitudinal study).

# %% Cell 6 -- Gradual drift over time
N_BATCHES = 12
BATCH_SIZE = 200

drift_timeline = []

for batch_idx in range(N_BATCHES):
    drift_fraction = batch_idx / (N_BATCHES - 1)  # 0 to 1

    batch_data = {}
    for feat, spec in feature_specs.items():
        shifted_mean = spec["ref_mean"] + drift_fraction * spec["drift_shift"]
        shifted_std = spec["ref_std"] * (1 + drift_fraction * (spec["drift_scale"] - 1))
        batch_data[feat] = rng.normal(shifted_mean, shifted_std, BATCH_SIZE)

    batch_df = pd.DataFrame(batch_data)
    batch_report = detector.detect(batch_df)

    drift_timeline.append({
        "batch": batch_idx + 1,
        "month": f"M{batch_idx + 1:02d}",
        "n_drifted": batch_report.summary["n_drifted"],
        "drift_fraction": batch_report.summary["drift_fraction"],
        "severity": batch_report.severity,
        "overall_drifted": batch_report.overall_drifted,
    })

timeline_df = pd.DataFrame(drift_timeline)

fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(10, 7), sharex=True)

ax1.plot(timeline_df["batch"], timeline_df["n_drifted"], "o-", lw=2, color="#4C72B0")
ax1.set_ylabel("Number of Drifted Features")
ax1.set_title("Drift Evolution Over Time")
ax1.axhline(len(feature_specs) * 0.5, color="red", ls="--", lw=1,
            label="50% features threshold")
ax1.legend()

# Color-coded severity
severity_colors = {"none": "#55A868", "low": "#A8D08D",
                   "moderate": "#DD8452", "severe": "#C44E52"}
bar_colors = [severity_colors.get(s, "gray") for s in timeline_df["severity"]]
ax2.bar(timeline_df["batch"], timeline_df["drift_fraction"], color=bar_colors,
        edgecolor="white")
ax2.set_xlabel("Batch (Month)")
ax2.set_ylabel("Fraction of Drifted Features")
ax2.set_title("Drift Severity by Month")

# Legend for severity
from matplotlib.patches import Patch
legend_elements = [Patch(facecolor=c, label=s) for s, c in severity_colors.items()]
ax2.legend(handles=legend_elements, title="Severity", loc="upper left")

plt.tight_layout()
plt.show()

print("Drift timeline:")
print(timeline_df.to_string(index=False))

# %% [markdown]
# ## Alerting Thresholds
#
# We define operational alerting rules based on drift severity, and show
# which batches would have triggered each alert level.

# %% Cell 7 -- Alerting thresholds
ALERT_RULES = {
    "INFO": {
        "condition": "drift_fraction > 0",
        "description": "Any feature shows drift (p < 0.05 or PSI > 0.20)",
    },
    "WARNING": {
        "condition": "drift_fraction >= 0.25",
        "description": "25% or more features show drift",
    },
    "CRITICAL": {
        "condition": "drift_fraction >= 0.50",
        "description": "50% or more features show drift -- retrain recommended",
    },
}

print("=" * 60)
print("  ALERTING THRESHOLDS")
print("=" * 60)
for level, rule in ALERT_RULES.items():
    print(f"  [{level}] {rule['description']}")
print("=" * 60)
print()

# Apply rules to timeline
for _, row in timeline_df.iterrows():
    frac = row["drift_fraction"]
    if frac >= 0.50:
        alert = "CRITICAL"
    elif frac >= 0.25:
        alert = "WARNING"
    elif frac > 0:
        alert = "INFO"
    else:
        alert = "OK"
    print(f"  {row['month']}: drift_fraction={frac:.2f}, "
          f"n_drifted={row['n_drifted']}, alert={alert}")

print()
print("Recommendation: Set up automated monitoring to run the")
print("DataDriftDetector on each new data batch. Trigger model")
print("retraining when CRITICAL alerts persist for 2+ consecutive months.")
