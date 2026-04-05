# %% [markdown]
# # Emotional Dynamics Analysis: EMA & Emotion Coupling
#
# **WELLab -- Washington University**
#
# This notebook demonstrates the Intra- and Inter-individual Dynamical
# Emotion Linkage System (IDELS) coupling analysis.  We generate synthetic
# ecological momentary assessment (EMA) data, fit emotion-coupling models,
# and visualise volatility patterns and coupling types across participants.

# %% Cell 1 -- Imports and setup
import sys
import os
import logging
import warnings

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns

# Make WELLab source importable
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from src.ml.emotional_dynamics import EmotionCouplingAnalyzer
from src.ml.utils import set_reproducible_seed

SEED = 42
set_reproducible_seed(SEED)
rng = np.random.default_rng(SEED)

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
warnings.filterwarnings("ignore")

sns.set_theme(style="whitegrid", context="notebook", palette="colorblind")
print("Setup complete.")

# %% [markdown]
# ## Synthetic EMA Dataset
#
# We simulate 50 participants, each with 30 time-ordered affect
# observations.  Four latent coupling patterns are embedded:
#
# | Group           | n  | Pattern                                      |
# |-----------------|----|----------------------------------------------|
# | Positive        | 15 | PA and NA move together (r > 0)              |
# | Negative        | 15 | PA and NA move in opposite directions (r < 0) |
# | Decoupled       | 10 | No reliable association                      |
# | Complex         | 10 | Non-linear linkage                           |

# %% Cell 2 -- Generate synthetic EMA dataset
N_PARTICIPANTS = 50
N_OBS = 30

group_sizes = {"positive": 15, "negative": 15, "decoupled": 10, "complex": 10}
records = []
pid_counter = 0

for coupling_type, n_subj in group_sizes.items():
    for _ in range(n_subj):
        pid = f"P{pid_counter:03d}"
        pid_counter += 1
        time_points = np.arange(N_OBS, dtype=float)

        if coupling_type == "positive":
            base = rng.normal(0, 1, N_OBS)
            pa = 5.0 + 0.8 * base + rng.normal(0, 0.3, N_OBS)
            na = 3.0 + 0.6 * base + rng.normal(0, 0.3, N_OBS)
        elif coupling_type == "negative":
            base = rng.normal(0, 1, N_OBS)
            pa = 5.0 + 0.8 * base + rng.normal(0, 0.3, N_OBS)
            na = 3.0 - 0.6 * base + rng.normal(0, 0.3, N_OBS)
        elif coupling_type == "decoupled":
            pa = 5.0 + rng.normal(0, 1, N_OBS)
            na = 3.0 + rng.normal(0, 1, N_OBS)
        else:  # complex
            base = rng.normal(0, 1, N_OBS)
            pa = 5.0 + base + rng.normal(0, 0.2, N_OBS)
            na = 3.0 + 0.8 * base**2 - 0.5 * base + rng.normal(0, 0.2, N_OBS)

        for t in range(N_OBS):
            records.append({
                "participant_id": pid,
                "time": float(t),
                "positive_affect": float(np.clip(pa[t], 1, 9)),
                "negative_affect": float(np.clip(na[t], 1, 9)),
                "true_coupling": coupling_type,
            })

ema_df = pd.DataFrame(records)
print(f"Synthetic EMA dataset: {len(ema_df)} rows, "
      f"{ema_df['participant_id'].nunique()} participants")
print(ema_df.head(10))

# %% [markdown]
# ## Fit EmotionCouplingAnalyzer
#
# The analyser normalises affect scores, then computes per-participant
# coupling via Pearson correlation and a nonlinearity heuristic.

# %% Cell 3 -- Fit the analyser
analyzer = EmotionCouplingAnalyzer(seed=SEED)

# The fit method requires only the schema columns; drop the ground-truth label
fit_df = ema_df[["participant_id", "time", "positive_affect", "negative_affect"]].copy()
analyzer.fit(fit_df)

print(f"Fitted: {len(analyzer.coupling_results_)} participants classified")

# %% [markdown]
# ## Coupling-Type Classification
#
# We compare the analyser's predicted coupling type to the ground-truth
# label embedded in the synthetic data.

# %% Cell 4 -- Classify coupling types, display distribution
coupling_series = pd.Series(analyzer.coupling_results_, name="predicted_coupling")
coupling_df = coupling_series.reset_index()
coupling_df.columns = ["participant_id", "predicted_coupling"]

# Add ground truth
truth = ema_df.groupby("participant_id")["true_coupling"].first().reset_index()
coupling_df = coupling_df.merge(truth, on="participant_id")

print("Predicted coupling-type distribution:")
print(coupling_df["predicted_coupling"].value_counts().to_string())
print()

# Confusion-style cross-tab
ct = pd.crosstab(coupling_df["true_coupling"], coupling_df["predicted_coupling"],
                 margins=True)
print("True vs. Predicted coupling types:")
print(ct.to_string())

# %% [markdown]
# ## Emotional Volatility
#
# Volatility is computed as a rolling standard deviation of affect over a
# sliding window.  Higher volatility may signal emotional instability.

# %% Cell 5 -- Compute volatility indices, histogram
volatilities = {}
for pid in ema_df["participant_id"].unique():
    pa = ema_df.loc[ema_df["participant_id"] == pid, "positive_affect"].values
    vol = analyzer.compute_volatility(pa)
    volatilities[pid] = np.nanmean(vol)

vol_df = pd.DataFrame({
    "participant_id": list(volatilities.keys()),
    "mean_volatility": list(volatilities.values()),
})
vol_df = vol_df.merge(truth, on="participant_id")

fig, ax = plt.subplots(figsize=(8, 5))
for ct_type in ["positive", "negative", "decoupled", "complex"]:
    subset = vol_df.loc[vol_df["true_coupling"] == ct_type, "mean_volatility"]
    ax.hist(subset, bins=12, alpha=0.55, label=ct_type)
ax.set_xlabel("Mean Positive-Affect Volatility")
ax.set_ylabel("Count")
ax.set_title("Distribution of Emotional Volatility by Coupling Type")
ax.legend(title="Coupling type")
plt.tight_layout()
plt.show()

# %% [markdown]
# ## High-Risk Participants
#
# We flag participants whose mean volatility exceeds 2 standard deviations
# above the sample mean -- a simple screening criterion for emotional
# instability warranting clinical follow-up.

# %% Cell 6 -- Identify high-risk participants
mean_vol = vol_df["mean_volatility"].mean()
std_vol = vol_df["mean_volatility"].std()
threshold = mean_vol + 2 * std_vol

vol_df["high_risk"] = vol_df["mean_volatility"] > threshold
n_high = vol_df["high_risk"].sum()

print(f"Volatility mean: {mean_vol:.4f}, SD: {std_vol:.4f}")
print(f"High-risk threshold (mean + 2 SD): {threshold:.4f}")
print(f"High-risk participants: {n_high} / {len(vol_df)}")
print()
if n_high > 0:
    print(vol_df.loc[vol_df["high_risk"]].to_string(index=False))
else:
    print("No participants exceeded the high-risk threshold.")

# %% [markdown]
# ## Individual Emotion Time Series
#
# We plot positive and negative affect over time for a handful of
# participants spanning different coupling types.

# %% Cell 7 -- Individual time-series plots
selected_pids = coupling_df.groupby("predicted_coupling").first()["participant_id"].values[:4]

fig, axes = plt.subplots(2, 2, figsize=(12, 8), sharex=True)
axes = axes.ravel()

for i, pid in enumerate(selected_pids):
    ax = axes[i]
    sub = ema_df.loc[ema_df["participant_id"] == pid]
    ax.plot(sub["time"], sub["positive_affect"], marker="o", ms=3, label="PA")
    ax.plot(sub["time"], sub["negative_affect"], marker="s", ms=3, label="NA")
    ct_label = coupling_df.loc[coupling_df["participant_id"] == pid, "predicted_coupling"].values[0]
    ax.set_title(f"{pid} ({ct_label})")
    ax.set_ylabel("Affect")
    ax.legend(fontsize=8)

axes[-1].set_xlabel("Time point")
axes[-2].set_xlabel("Time point")
fig.suptitle("Individual Emotion Time Series", fontsize=14, y=1.01)
plt.tight_layout()
plt.show()

# %% [markdown]
# ## Coupling Heatmap
#
# A heatmap of the PA-NA Pearson correlation for each participant,
# ordered by coupling type, provides a visual summary of coupling
# strength and direction.

# %% Cell 8 -- Coupling heatmap
correlations = {}
for pid in ema_df["participant_id"].unique():
    sub = ema_df.loc[ema_df["participant_id"] == pid]
    r = np.corrcoef(sub["positive_affect"], sub["negative_affect"])[0, 1]
    correlations[pid] = r

corr_df = pd.DataFrame({
    "participant_id": list(correlations.keys()),
    "pa_na_corr": list(correlations.values()),
})
corr_df = corr_df.merge(truth, on="participant_id")
corr_df = corr_df.sort_values(["true_coupling", "pa_na_corr"])

# Reshape for heatmap
corr_matrix = corr_df.set_index("participant_id")[["pa_na_corr"]]

fig, ax = plt.subplots(figsize=(4, 14))
sns.heatmap(
    corr_matrix,
    cmap="RdBu_r",
    center=0,
    vmin=-1, vmax=1,
    yticklabels=True,
    ax=ax,
    cbar_kws={"label": "PA-NA correlation"},
)
ax.set_title("PA-NA Coupling Across Participants")
ax.set_ylabel("")
ax.tick_params(axis="y", labelsize=6)
plt.tight_layout()
plt.show()

# %% [markdown]
# ## Summary Statistics

# %% Cell 9 -- Summary statistics table
summary = vol_df.groupby("true_coupling").agg(
    n=("participant_id", "count"),
    mean_volatility=("mean_volatility", "mean"),
    sd_volatility=("mean_volatility", "std"),
    n_high_risk=("high_risk", "sum"),
).reset_index()

# Add mean PA-NA correlation per group
corr_summary = corr_df.groupby("true_coupling")["pa_na_corr"].agg(
    mean_corr="mean", sd_corr="std"
).reset_index()

summary = summary.merge(corr_summary, on="true_coupling")

print("=" * 70)
print("  EMOTIONAL DYNAMICS -- SUMMARY STATISTICS")
print("=" * 70)
print(summary.to_string(index=False, float_format="%.4f"))
print("=" * 70)
