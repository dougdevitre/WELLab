# %% [markdown]
# # Fairness Audit Workflow
#
# **WELLab -- Washington University**
#
# This notebook demonstrates a complete fairness auditing pipeline for
# ML model predictions.  We generate synthetic predictions with
# demographic attributes, then run demographic parity, disparate impact,
# equalized odds, calibration, and intersectional audits.

# %% Cell 1 -- Imports and setup
import sys
import os
import logging
import warnings
import json

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from scripts.fairness_audit import FairnessAuditor

SEED = 42
np.random.seed(SEED)
rng = np.random.default_rng(SEED)

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
warnings.filterwarnings("ignore")

sns.set_theme(style="whitegrid", context="notebook", palette="colorblind")
print("Setup complete.")

# %% [markdown]
# ## Synthetic Predictions with Demographics
#
# We simulate model predictions for 1,000 participants with intentional
# bias: the model has a higher positive-prediction rate for some
# demographic groups, mimicking a real-world fairness concern.

# %% Cell 2 -- Generate synthetic predictions
N = 1000

gender = rng.choice(["male", "female", "non_binary"], N, p=[0.45, 0.45, 0.10])
ethnicity = rng.choice(["white", "black", "hispanic", "asian"], N,
                        p=[0.40, 0.25, 0.20, 0.15])

# True labels (roughly balanced)
base_prob = 0.30
true_labels = rng.binomial(1, base_prob, N)

# Biased predictions: model systematically over-predicts for some groups
pred_probs = np.zeros(N)
for i in range(N):
    base = 0.25
    if gender[i] == "male":
        base += 0.08
    if ethnicity[i] == "white":
        base += 0.05
    elif ethnicity[i] == "asian":
        base += 0.03
    # Add signal from true label
    if true_labels[i] == 1:
        base += 0.35
    pred_probs[i] = np.clip(base + rng.normal(0, 0.1), 0, 1)

predictions = (pred_probs > 0.5).astype(int)

audit_df = pd.DataFrame({
    "gender": gender,
    "ethnicity": ethnicity,
    "true_label": true_labels,
    "prediction": predictions,
    "pred_probability": pred_probs,
})

print(f"Dataset: {N} participants")
print(f"Prediction rate: {predictions.mean():.3f}")
print(f"True positive rate: {true_labels.mean():.3f}")
print()
print("Prediction rate by gender:")
print(audit_df.groupby("gender")["prediction"].mean().to_string())
print()
print("Prediction rate by ethnicity:")
print(audit_df.groupby("ethnicity")["prediction"].mean().to_string())

# %% [markdown]
# ## Demographic Parity Audit
#
# Demographic parity requires that the positive-prediction rate be
# approximately equal across all groups.

# %% Cell 3 -- Demographic parity
auditor = FairnessAuditor()

dp_gender = auditor.compute_demographic_parity(predictions, gender)

print("=" * 55)
print("  DEMOGRAPHIC PARITY -- by Gender")
print("=" * 55)
print(f"  Group rates   : {dp_gender['group_rates']}")
print(f"  Max difference: {dp_gender['max_difference']:.4f}")
print(f"  Tolerance     : {dp_gender['tolerance']}")
print(f"  PASSED        : {dp_gender['passed']}")
print("=" * 55)

dp_ethnicity = auditor.compute_demographic_parity(predictions, ethnicity)
print()
print("  DEMOGRAPHIC PARITY -- by Ethnicity")
print("=" * 55)
print(f"  Group rates   : {dp_ethnicity['group_rates']}")
print(f"  Max difference: {dp_ethnicity['max_difference']:.4f}")
print(f"  PASSED        : {dp_ethnicity['passed']}")
print("=" * 55)

# %% [markdown]
# ## Disparate Impact Audit (4/5ths Rule)
#
# The disparate impact ratio is min(group_rate) / max(group_rate).
# A ratio below 0.80 indicates potential adverse impact.

# %% Cell 4 -- Disparate impact
di_gender = auditor.compute_disparate_impact(predictions, gender)

print("=" * 55)
print("  DISPARATE IMPACT -- by Gender")
print("=" * 55)
print(f"  DI ratio : {di_gender['disparate_impact_ratio']:.4f}")
print(f"  Floor    : {di_gender['floor']}")
print(f"  PASSED   : {di_gender['passed']}")
print("=" * 55)

di_ethnicity = auditor.compute_disparate_impact(predictions, ethnicity)
print()
print("  DISPARATE IMPACT -- by Ethnicity")
print("=" * 55)
print(f"  DI ratio : {di_ethnicity['disparate_impact_ratio']:.4f}")
print(f"  PASSED   : {di_ethnicity['passed']}")
print("=" * 55)

# %% [markdown]
# ## Equalized Odds Analysis
#
# Equalized odds requires equal true-positive rates (TPR) and
# false-positive rates (FPR) across groups.

# %% Cell 5 -- Equalized odds
eo_gender = auditor.equalized_odds(predictions, true_labels, gender)

print("Equalized Odds -- by Gender:")
print(f"  TPR by group: {eo_gender['group_tpr']}")
print(f"  FPR by group: {eo_gender['group_fpr']}")
print(f"  Max TPR diff: {eo_gender['max_tpr_difference']:.4f}")
print(f"  Max FPR diff: {eo_gender['max_fpr_difference']:.4f}")
print(f"  PASSED      : {eo_gender['passed']}")

eo_ethnicity = auditor.equalized_odds(predictions, true_labels, ethnicity)
print()
print("Equalized Odds -- by Ethnicity:")
print(f"  TPR by group: {eo_ethnicity['group_tpr']}")
print(f"  FPR by group: {eo_ethnicity['group_fpr']}")
print(f"  Max TPR diff: {eo_ethnicity['max_tpr_difference']:.4f}")
print(f"  Max FPR diff: {eo_ethnicity['max_fpr_difference']:.4f}")
print(f"  PASSED      : {eo_ethnicity['passed']}")

# %% [markdown]
# ## Calibration by Group
#
# Good calibration means that among predictions of probability p,
# approximately p fraction actually have the positive outcome.
# Differential calibration across groups is a fairness concern.

# %% Cell 6 -- Calibration by group
cal_gender = auditor.calibration_by_group(pred_probs, true_labels, gender)

fig, ax = plt.subplots(figsize=(7, 5))
for group_name, cal_data in cal_gender["group_calibration"].items():
    if cal_data["bin_means"]:
        ax.plot(cal_data["bin_means"], cal_data["bin_true_rates"],
                "o-", label=f"{group_name} (ECE={cal_data['expected_calibration_error']:.3f})")

ax.plot([0, 1], [0, 1], "k--", lw=0.8, label="Perfect")
ax.set_xlabel("Mean Predicted Probability")
ax.set_ylabel("Observed Proportion")
ax.set_title("Calibration by Gender")
ax.legend()
plt.tight_layout()
plt.show()

print(f"Max ECE difference across gender groups: "
      f"{cal_gender['max_ece_difference']:.4f}")

# %% [markdown]
# ## Intersectional Audit (Gender x Ethnicity)
#
# Fairness audits on single attributes can miss disparities at
# intersections.  We audit the cross-product of gender and ethnicity.

# %% Cell 7 -- Intersectional audit
intersect = auditor.intersectional_audit(
    predictions=predictions,
    protected_attributes=["gender", "ethnicity"],
    data=audit_df,
)

print("Intersectional Audit (Gender x Ethnicity):")
print(f"  Number of intersections: {len(intersect['intersections'])}")
print(f"  Max rate difference    : {intersect['max_difference']:.4f}")
print(f"  DI ratio               : {intersect['disparate_impact_ratio']:.4f}")
print(f"  PASSED                 : {intersect['passed']}")
print()

# Sort by rate for display
sorted_groups = sorted(intersect["intersections"].items(), key=lambda x: x[1])
print("  Positive-prediction rates by intersection:")
for group, rate in sorted_groups:
    n = intersect["intersection_counts"][group]
    print(f"    {group:30s}  rate={rate:.3f}  (n={n})")

# %% [markdown]
# ## Fairness Metrics Dashboard

# %% Cell 8 -- Visualise fairness dashboard
fig, axes = plt.subplots(2, 2, figsize=(14, 10))

# 1. Demographic parity by ethnicity
ax = axes[0, 0]
groups = list(dp_ethnicity["group_rates"].keys())
rates = list(dp_ethnicity["group_rates"].values())
bars = ax.bar(groups, rates, edgecolor="white")
ax.axhline(np.mean(rates), color="red", ls="--", lw=1, label="Mean rate")
ax.set_ylabel("Positive Prediction Rate")
ax.set_title("Demographic Parity by Ethnicity")
ax.legend()

# 2. Equalized odds comparison
ax = axes[0, 1]
groups_eo = list(eo_ethnicity["group_tpr"].keys())
tpr_vals = [eo_ethnicity["group_tpr"][g] for g in groups_eo]
fpr_vals = [eo_ethnicity["group_fpr"][g] for g in groups_eo]
x_pos = np.arange(len(groups_eo))
w = 0.35
ax.bar(x_pos - w/2, tpr_vals, w, label="TPR", color="#4C72B0")
ax.bar(x_pos + w/2, fpr_vals, w, label="FPR", color="#DD8452")
ax.set_xticks(x_pos)
ax.set_xticklabels(groups_eo)
ax.set_ylabel("Rate")
ax.set_title("Equalized Odds by Ethnicity")
ax.legend()

# 3. Intersectional rates
ax = axes[1, 0]
int_groups = [g for g, _ in sorted_groups]
int_rates = [r for _, r in sorted_groups]
colors = ["#C44E52" if r < 0.25 else "#4C72B0" for r in int_rates]
ax.barh(int_groups, int_rates, color=colors, edgecolor="white")
ax.axvline(0.8 * max(int_rates), color="red", ls="--", lw=1, label="4/5ths threshold")
ax.set_xlabel("Positive Prediction Rate")
ax.set_title("Intersectional Rates (Gender x Ethnicity)")
ax.tick_params(axis="y", labelsize=7)
ax.legend(fontsize=8)

# 4. Summary pass/fail table
ax = axes[1, 1]
ax.axis("off")
table_data = [
    ["Metric", "Gender", "Ethnicity"],
    ["Demographic Parity", str(dp_gender["passed"]), str(dp_ethnicity["passed"])],
    ["Disparate Impact", str(di_gender["passed"]), str(di_ethnicity["passed"])],
    ["Equalized Odds", str(eo_gender["passed"]), str(eo_ethnicity["passed"])],
    ["Intersectional", "--", str(intersect["passed"])],
]
table = ax.table(cellText=table_data[1:], colLabels=table_data[0],
                  loc="center", cellLoc="center")
table.auto_set_font_size(False)
table.set_fontsize(10)
table.scale(1.2, 1.8)
# Color cells
for i in range(1, len(table_data)):
    for j in range(1, 3):
        val = table_data[i][j]
        color = "#d4edda" if val == "True" else "#f8d7da" if val == "False" else "#ffffff"
        table[i - 1, j].set_facecolor(color)
ax.set_title("Fairness Check Summary", pad=20)

plt.tight_layout()
plt.show()

# %% [markdown]
# ## Generate Full Audit Report

# %% Cell 9 -- Generate and save report
audit_results = {
    "demographic_parity": dp_ethnicity,
    "disparate_impact": di_ethnicity,
    "equalized_odds": eo_ethnicity,
    "calibration": cal_gender,
}

report = auditor.generate_report(
    model_name="CognitiveRiskModel v1 -- WELLab",
    audit_results=audit_results,
)

print(report)

# Save report to file
output_dir = os.path.join(os.path.dirname(__file__), "output")
os.makedirs(output_dir, exist_ok=True)
report_path = os.path.join(output_dir, "fairness_audit_report.json")

auditor.generate_report(
    model_name="CognitiveRiskModel v1 -- WELLab",
    audit_results=audit_results,
    output_path=report_path,
)

print(f"\nJSON report saved to: {report_path}")
