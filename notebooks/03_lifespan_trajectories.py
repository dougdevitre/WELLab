# %% [markdown]
# # Lifespan Trajectory Analysis: Growth Curves & Clustering
#
# **WELLab -- Washington University**
#
# This notebook models well-being trajectories across the adult lifespan
# (ages 18-85).  We fit polynomial growth curves per participant, cluster
# them into latent trajectory groups, and compare trajectories across
# synthetic cultural cohorts.

# %% Cell 1 -- Imports and setup
import sys
import os
import logging
import warnings

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from src.ml.lifespan_trajectory import TrajectoryAnalyzer
from src.ml.utils import set_reproducible_seed

SEED = 42
set_reproducible_seed(SEED)
rng = np.random.default_rng(SEED)

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
warnings.filterwarnings("ignore")

sns.set_theme(style="whitegrid", context="notebook", palette="colorblind")
print("Setup complete.")

# %% [markdown]
# ## Synthetic Lifespan Dataset
#
# We simulate 300 participants observed at 5 age points each, drawn
# from three latent trajectory archetypes:
#
# | Archetype     | n   | Shape                                      |
# |---------------|-----|--------------------------------------------|
# | Resilient     | 120 | High stable with slight U-shape in midlife |
# | Declining     | 100 | Gradual linear decline with age            |
# | Late-bloomer  |  80 | Low early, rising after midlife             |

# %% Cell 2 -- Generate synthetic lifespan data
N_PARTICIPANTS = 300
ARCHETYPE_SIZES = {"resilient": 120, "declining": 100, "late_bloomer": 80}
OBS_PER_PERSON = 5

records = []
pid = 0

for archetype, n_subj in ARCHETYPE_SIZES.items():
    for _ in range(n_subj):
        pid_label = f"P{pid:03d}"
        pid += 1

        # Sample 5 ages spread across the lifespan
        base_age = rng.uniform(18, 60)
        ages = np.sort(base_age + np.arange(OBS_PER_PERSON) * rng.uniform(3, 8))
        ages = np.clip(ages, 18, 85)

        for age in ages:
            age_c = (age - 50) / 30  # centred and scaled

            if archetype == "resilient":
                wb = 7.0 + 0.3 * age_c**2 - 0.1 * age_c + rng.normal(0, 0.4)
            elif archetype == "declining":
                wb = 6.5 - 1.5 * age_c + rng.normal(0, 0.5)
            else:  # late_bloomer
                wb = 4.5 + 1.2 * age_c + 0.4 * age_c**2 + rng.normal(0, 0.5)

            records.append({
                "participant_id": pid_label,
                "age": float(age),
                "wellbeing": float(np.clip(wb, 1, 10)),
                "archetype": archetype,
            })

lifespan_df = pd.DataFrame(records)
print(f"Dataset: {len(lifespan_df)} rows, "
      f"{lifespan_df['participant_id'].nunique()} participants")
print(lifespan_df.groupby("archetype").size().to_string())

# %% [markdown]
# ## Fit Growth Curves

# %% Cell 3 -- Fit growth curves
analyzer = TrajectoryAnalyzer(max_degree=3, n_clusters=3, seed=SEED)

growth_summary = analyzer.fit_growth_curves(
    data=lifespan_df,
    outcome="wellbeing",
    age_col="age",
    group_col="participant_id",
)

print("Growth curve fitting summary:")
for k, v in growth_summary.items():
    print(f"  {k}: {v}")

# %% [markdown]
# ## Trajectory Clustering
#
# K-Means on polynomial coefficients identifies latent trajectory
# groups.  We compare the discovered clusters to the true archetypes.

# %% Cell 4 -- Cluster trajectories
cluster_result = analyzer.cluster_trajectories(
    data=lifespan_df,
    n_clusters=3,
    outcome="wellbeing",
    age_col="age",
    group_col="participant_id",
)

assignments = cluster_result["assignments"]
cluster_df = pd.DataFrame({
    "participant_id": list(assignments.keys()),
    "cluster": list(assignments.values()),
})

# Add ground truth
truth = lifespan_df.groupby("participant_id")["archetype"].first().reset_index()
cluster_df = cluster_df.merge(truth, on="participant_id")

print(f"Inertia: {cluster_result['inertia']:.2f}")
print()
ct = pd.crosstab(cluster_df["archetype"], cluster_df["cluster"], margins=True)
print("Archetype vs Cluster assignment:")
print(ct.to_string())

# %% [markdown]
# ## Trajectory Archetypes with Confidence Bands
#
# We plot the cluster-mean trajectories along with shaded 95% confidence
# bands.

# %% Cell 5 -- Plot trajectory archetypes
age_grid = np.linspace(18, 85, 200)
colors = ["#4C72B0", "#DD8452", "#55A868"]

fig, ax = plt.subplots(figsize=(10, 6))

for cluster_id in sorted(cluster_df["cluster"].unique()):
    pids_in_cluster = cluster_df.loc[cluster_df["cluster"] == cluster_id, "participant_id"]
    sub = lifespan_df[lifespan_df["participant_id"].isin(pids_in_cluster)]

    # Aggregate polynomial fit
    coeffs = np.polyfit(sub["age"], sub["wellbeing"], deg=3)
    y_mean = np.polyval(coeffs, age_grid)

    # Bootstrap confidence band
    boot_curves = []
    for _ in range(200):
        idx = rng.choice(len(sub), size=len(sub), replace=True)
        boot_sub = sub.iloc[idx]
        bc = np.polyfit(boot_sub["age"], boot_sub["wellbeing"], deg=3)
        boot_curves.append(np.polyval(bc, age_grid))
    boot_arr = np.array(boot_curves)
    ci_lo = np.percentile(boot_arr, 2.5, axis=0)
    ci_hi = np.percentile(boot_arr, 97.5, axis=0)

    c = colors[cluster_id % len(colors)]
    ax.plot(age_grid, y_mean, lw=2, color=c,
            label=f"Cluster {cluster_id} (n={len(pids_in_cluster)})")
    ax.fill_between(age_grid, ci_lo, ci_hi, alpha=0.15, color=c)

ax.set_xlabel("Age")
ax.set_ylabel("Wellbeing")
ax.set_title("Trajectory Archetypes with 95% Confidence Bands")
ax.legend()
plt.tight_layout()
plt.show()

# %% [markdown]
# ## Cross-Cultural Comparison
#
# We create two synthetic cohorts (e.g. "Western" vs "East Asian")
# with different trajectory shapes and test for differences.

# %% Cell 6 -- Cross-cultural comparison
cohort_a = lifespan_df[lifespan_df["archetype"].isin(["resilient", "declining"])][
    ["age", "wellbeing"]
].copy()
cohort_b_records = []
for _ in range(500):
    age = rng.uniform(18, 85)
    age_c = (age - 50) / 30
    wb = 6.0 + 0.5 * age_c - 0.2 * age_c**2 + rng.normal(0, 0.6)
    cohort_b_records.append({"age": float(age), "wellbeing": float(np.clip(wb, 1, 10))})
cohort_b = pd.DataFrame(cohort_b_records)

comparison = analyzer.cross_cultural_comparison(cohort_a, cohort_b)

print("Cross-cultural comparison:")
for k, v in comparison.items():
    print(f"  {k}: {v}")

fig, ax = plt.subplots(figsize=(8, 5))
age_grid = np.linspace(18, 85, 200)

for label, coeffs, color in [
    ("Cohort A (Western)", comparison["cohort_a_coeffs"], "#4C72B0"),
    ("Cohort B (East Asian)", comparison["cohort_b_coeffs"], "#DD8452"),
]:
    y = np.polyval(coeffs, age_grid)
    ax.plot(age_grid, y, lw=2.5, color=color, label=label)

ax.set_xlabel("Age")
ax.set_ylabel("Wellbeing")
ax.set_title("Cross-Cultural Trajectory Comparison")
ax.legend()
plt.tight_layout()
plt.show()

# %% [markdown]
# ## Individual Trajectories on Cluster Means

# %% Cell 7 -- Individual trajectory overlay
fig, axes = plt.subplots(1, 3, figsize=(15, 5), sharey=True)

for cluster_id, ax in enumerate(axes):
    pids_in_cluster = cluster_df.loc[cluster_df["cluster"] == cluster_id, "participant_id"]
    sub = lifespan_df[lifespan_df["participant_id"].isin(pids_in_cluster)]

    # Plot individual traces (sample up to 15)
    sample_pids = rng.choice(pids_in_cluster.values,
                             size=min(15, len(pids_in_cluster)), replace=False)
    for sp in sample_pids:
        p_data = sub[sub["participant_id"] == sp]
        ax.plot(p_data["age"], p_data["wellbeing"], alpha=0.25, lw=0.8,
                color="gray", marker=".", ms=3)

    # Cluster mean curve
    coeffs = np.polyfit(sub["age"], sub["wellbeing"], deg=3)
    age_g = np.linspace(sub["age"].min(), sub["age"].max(), 100)
    ax.plot(age_g, np.polyval(coeffs, age_g), lw=3, color=colors[cluster_id])

    ax.set_title(f"Cluster {cluster_id} (n={len(pids_in_cluster)})")
    ax.set_xlabel("Age")
    if cluster_id == 0:
        ax.set_ylabel("Wellbeing")

fig.suptitle("Individual Trajectories Overlaid on Cluster Means", fontsize=14, y=1.02)
plt.tight_layout()
plt.show()

# %% [markdown]
# ## Optimal Cluster Count (BIC-proxy & Silhouette)
#
# We sweep k from 2 to 7 and evaluate inertia (BIC proxy) and
# silhouette scores to guide cluster-count selection.

# %% Cell 8 -- BIC/silhouette analysis
k_range = range(2, 8)
inertias = []
silhouettes = []

# Build feature matrix from growth model coefficients
growth_models = analyzer._growth_models
pids = list(growth_models.keys())
max_len = max(len(c) for c in growth_models.values())
X = np.zeros((len(pids), max_len))
for i, p in enumerate(pids):
    coeffs = growth_models[p]
    X[i, max_len - len(coeffs):] = coeffs

for k in k_range:
    km = KMeans(n_clusters=k, random_state=SEED, n_init=10)
    labels = km.fit_predict(X)
    inertias.append(km.inertia_)
    silhouettes.append(silhouette_score(X, labels))

fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 4))

ax1.plot(list(k_range), inertias, "o-", lw=2)
ax1.set_xlabel("Number of clusters (k)")
ax1.set_ylabel("Inertia")
ax1.set_title("Elbow Plot")

ax2.plot(list(k_range), silhouettes, "s-", lw=2, color="#DD8452")
ax2.set_xlabel("Number of clusters (k)")
ax2.set_ylabel("Silhouette score")
ax2.set_title("Silhouette Analysis")

plt.tight_layout()
plt.show()

best_k = list(k_range)[np.argmax(silhouettes)]
print(f"Optimal k by silhouette: {best_k} (score={max(silhouettes):.4f})")

# %% [markdown]
# ## Export Results

# %% Cell 9 -- Export to CSV
output_dir = os.path.join(os.path.dirname(__file__), "output")
os.makedirs(output_dir, exist_ok=True)

cluster_df.to_csv(os.path.join(output_dir, "trajectory_clusters.csv"), index=False)

growth_coeff_df = pd.DataFrame({
    "participant_id": pids,
    **{f"coeff_{i}": X[:, i] for i in range(X.shape[1])},
})
growth_coeff_df.to_csv(os.path.join(output_dir, "growth_coefficients.csv"), index=False)

print(f"Results exported to {output_dir}/")
print(f"  - trajectory_clusters.csv  ({len(cluster_df)} rows)")
print(f"  - growth_coefficients.csv  ({len(growth_coeff_df)} rows)")
