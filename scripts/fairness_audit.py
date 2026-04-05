#!/usr/bin/env python3
"""
Fairness Audit Script
=====================
Computes demographic parity and disparate impact metrics for ML model
predictions, and generates a human-readable audit report.

Usage
-----
    python scripts/fairness_audit.py \\
        --predictions predictions.csv \\
        --protected-attribute gender \\
        --model-name "CognitiveRiskModel v1"
"""

from __future__ import annotations

import argparse
import itertools
import json
import logging
import sys
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

# The 4/5ths (80 %) rule threshold for disparate impact
_DISPARATE_IMPACT_FLOOR = 0.80
_DEMOGRAPHIC_PARITY_TOLERANCE = 0.05


class FairnessAuditor:
    """Audit model predictions for demographic fairness.

    Parameters
    ----------
    disparate_impact_floor : float
        Minimum acceptable disparate impact ratio (default 0.80,
        per the 4/5ths rule).
    demographic_parity_tolerance : float
        Maximum allowable difference in positive-prediction rates
        across groups.
    """

    def __init__(
        self,
        disparate_impact_floor: float = _DISPARATE_IMPACT_FLOOR,
        demographic_parity_tolerance: float = _DEMOGRAPHIC_PARITY_TOLERANCE,
    ) -> None:
        self.disparate_impact_floor = disparate_impact_floor
        self.demographic_parity_tolerance = demographic_parity_tolerance

    # ------------------------------------------------------------------
    # Core metrics
    # ------------------------------------------------------------------

    def compute_demographic_parity(
        self,
        predictions: np.ndarray,
        protected_attribute: np.ndarray,
    ) -> Dict[str, Any]:
        """Compute per-group positive-prediction rates.

        Demographic parity is satisfied when the positive-prediction
        rate is approximately equal across all groups defined by
        *protected_attribute*.

        Parameters
        ----------
        predictions : np.ndarray
            Binary (0/1) model predictions.
        protected_attribute : np.ndarray
            Group labels for each prediction.

        Returns
        -------
        dict
            ``group_rates`` mapping, ``max_difference`` between any
            two groups, and a ``passed`` flag.
        """
        df = pd.DataFrame({
            "pred": np.asarray(predictions).ravel(),
            "group": np.asarray(protected_attribute).ravel(),
        })

        group_rates: Dict[str, float] = {}
        for group_name, grp in df.groupby("group"):
            rate = float(grp["pred"].mean())
            group_rates[str(group_name)] = rate

        rates = list(group_rates.values())
        max_diff = max(rates) - min(rates) if rates else 0.0

        passed = max_diff <= self.demographic_parity_tolerance

        logger.info(
            "Demographic parity: max_diff=%.4f, tolerance=%.4f, passed=%s",
            max_diff, self.demographic_parity_tolerance, passed,
        )

        return {
            "group_rates": group_rates,
            "max_difference": max_diff,
            "tolerance": self.demographic_parity_tolerance,
            "passed": passed,
        }

    def compute_disparate_impact(
        self,
        predictions: np.ndarray,
        protected_attribute: np.ndarray,
    ) -> Dict[str, Any]:
        """Compute the disparate impact ratio.

        The ratio is defined as ``min(group_rate) / max(group_rate)``.
        A ratio below ``disparate_impact_floor`` (default 0.80)
        indicates potential adverse impact.

        Parameters
        ----------
        predictions : np.ndarray
            Binary (0/1) model predictions.
        protected_attribute : np.ndarray
            Group labels for each prediction.

        Returns
        -------
        dict
            ``disparate_impact_ratio``, per-group rates, and a
            ``passed`` flag.
        """
        df = pd.DataFrame({
            "pred": np.asarray(predictions).ravel(),
            "group": np.asarray(protected_attribute).ravel(),
        })

        group_rates: Dict[str, float] = {}
        for group_name, grp in df.groupby("group"):
            rate = float(grp["pred"].mean())
            group_rates[str(group_name)] = rate

        rates = list(group_rates.values())
        max_rate = max(rates) if rates else 0.0

        if max_rate == 0.0:
            ratio = 1.0  # no positive predictions at all => trivially fair
        else:
            ratio = min(rates) / max_rate

        passed = ratio >= self.disparate_impact_floor

        logger.info(
            "Disparate impact: ratio=%.4f, floor=%.4f, passed=%s",
            ratio, self.disparate_impact_floor, passed,
        )

        return {
            "group_rates": group_rates,
            "disparate_impact_ratio": ratio,
            "floor": self.disparate_impact_floor,
            "passed": passed,
        }

    # ------------------------------------------------------------------
    # Equalized odds
    # ------------------------------------------------------------------

    def equalized_odds(
        self,
        predictions: np.ndarray,
        labels: np.ndarray,
        protected_attribute: np.ndarray,
    ) -> Dict[str, Any]:
        """Compute equalized odds across groups.

        Equalized odds requires that the true-positive rate (TPR) and
        false-positive rate (FPR) are equal across all groups.

        Parameters
        ----------
        predictions : np.ndarray
            Binary (0/1) model predictions.
        labels : np.ndarray
            Binary (0/1) ground-truth labels.
        protected_attribute : np.ndarray
            Group labels for each observation.

        Returns
        -------
        dict
            Per-group TPR and FPR, max differences, and a ``passed`` flag.
        """
        df = pd.DataFrame({
            "pred": np.asarray(predictions).ravel(),
            "label": np.asarray(labels).ravel(),
            "group": np.asarray(protected_attribute).ravel(),
        })

        group_tpr: Dict[str, float] = {}
        group_fpr: Dict[str, float] = {}

        for group_name, grp in df.groupby("group"):
            positives = grp[grp["label"] == 1]
            negatives = grp[grp["label"] == 0]
            tpr = float(positives["pred"].mean()) if len(positives) > 0 else 0.0
            fpr = float(negatives["pred"].mean()) if len(negatives) > 0 else 0.0
            group_tpr[str(group_name)] = tpr
            group_fpr[str(group_name)] = fpr

        tpr_values = list(group_tpr.values())
        fpr_values = list(group_fpr.values())

        max_tpr_diff = (max(tpr_values) - min(tpr_values)) if tpr_values else 0.0
        max_fpr_diff = (max(fpr_values) - min(fpr_values)) if fpr_values else 0.0

        passed = (
            max_tpr_diff <= self.demographic_parity_tolerance
            and max_fpr_diff <= self.demographic_parity_tolerance
        )

        return {
            "group_tpr": group_tpr,
            "group_fpr": group_fpr,
            "max_tpr_difference": max_tpr_diff,
            "max_fpr_difference": max_fpr_diff,
            "passed": passed,
        }

    # ------------------------------------------------------------------
    # Calibration by group
    # ------------------------------------------------------------------

    def calibration_by_group(
        self,
        probabilities: np.ndarray,
        labels: np.ndarray,
        protected_attribute: np.ndarray,
        n_bins: int = 10,
    ) -> Dict[str, Any]:
        """Compute calibration metrics per group.

        For each group, computes the mean predicted probability and the
        actual positive rate within each probability bin.

        Parameters
        ----------
        probabilities : np.ndarray
            Predicted probabilities (continuous, 0-1).
        labels : np.ndarray
            Binary (0/1) ground-truth labels.
        protected_attribute : np.ndarray
            Group labels for each observation.
        n_bins : int
            Number of calibration bins.

        Returns
        -------
        dict
            Per-group calibration curves and an overall calibration error.
        """
        df = pd.DataFrame({
            "prob": np.asarray(probabilities).ravel(),
            "label": np.asarray(labels).ravel(),
            "group": np.asarray(protected_attribute).ravel(),
        })

        bin_edges = np.linspace(0, 1, n_bins + 1)
        group_calibration: Dict[str, Dict[str, Any]] = {}

        for group_name, grp in df.groupby("group"):
            bin_means: List[float] = []
            bin_true_rates: List[float] = []
            bin_counts: List[int] = []

            for i in range(n_bins):
                low, high = bin_edges[i], bin_edges[i + 1]
                mask = (grp["prob"] >= low) & (grp["prob"] < high)
                if i == n_bins - 1:
                    mask = mask | (grp["prob"] == high)
                bin_data = grp[mask]
                if len(bin_data) == 0:
                    continue
                bin_means.append(float(bin_data["prob"].mean()))
                bin_true_rates.append(float(bin_data["label"].mean()))
                bin_counts.append(len(bin_data))

            # Expected Calibration Error (weighted)
            total = sum(bin_counts)
            ece = 0.0
            if total > 0:
                for bm, btr, bc in zip(bin_means, bin_true_rates, bin_counts):
                    ece += (bc / total) * abs(btr - bm)

            group_calibration[str(group_name)] = {
                "bin_means": bin_means,
                "bin_true_rates": bin_true_rates,
                "bin_counts": bin_counts,
                "expected_calibration_error": ece,
            }

        # Max ECE difference across groups
        eces = [g["expected_calibration_error"] for g in group_calibration.values()]
        max_ece_diff = (max(eces) - min(eces)) if eces else 0.0

        return {
            "group_calibration": group_calibration,
            "max_ece_difference": max_ece_diff,
        }

    # ------------------------------------------------------------------
    # Intersectional audit
    # ------------------------------------------------------------------

    def intersectional_audit(
        self,
        predictions: np.ndarray,
        protected_attributes: List[str],
        data: Optional[pd.DataFrame] = None,
        attribute_arrays: Optional[Dict[str, np.ndarray]] = None,
    ) -> Dict[str, Any]:
        """Audit fairness across intersections of multiple protected attributes.

        Parameters
        ----------
        predictions : np.ndarray
            Binary (0/1) model predictions.
        protected_attributes : list[str]
            Column names (when *data* is provided) or keys in
            *attribute_arrays*.
        data : pd.DataFrame, optional
            DataFrame containing the protected attribute columns.
        attribute_arrays : dict[str, np.ndarray], optional
            Mapping of attribute name to array of group labels.

        Returns
        -------
        dict
            Per-intersection positive-prediction rates, max differences,
            and disparate impact information.
        """
        preds = np.asarray(predictions).ravel()

        if data is not None:
            attr_df = data[protected_attributes].copy()
        elif attribute_arrays is not None:
            attr_df = pd.DataFrame(attribute_arrays)
        else:
            raise ValueError(
                "Either data or attribute_arrays must be provided."
            )

        # Build intersection labels
        intersection_labels = attr_df.apply(
            lambda row: "_x_".join(str(v) for v in row), axis=1,
        )

        df = pd.DataFrame({"pred": preds, "intersection": intersection_labels})

        group_rates: Dict[str, float] = {}
        group_counts: Dict[str, int] = {}
        for group_name, grp in df.groupby("intersection"):
            group_rates[str(group_name)] = float(grp["pred"].mean())
            group_counts[str(group_name)] = len(grp)

        rates = list(group_rates.values())
        max_diff = (max(rates) - min(rates)) if rates else 0.0

        max_rate = max(rates) if rates else 0.0
        if max_rate == 0.0:
            di_ratio = 1.0
        else:
            di_ratio = min(rates) / max_rate

        passed = di_ratio >= self.disparate_impact_floor

        return {
            "intersections": group_rates,
            "intersection_counts": group_counts,
            "max_difference": max_diff,
            "disparate_impact_ratio": di_ratio,
            "passed": passed,
        }

    # ------------------------------------------------------------------
    # Bootstrap confidence intervals
    # ------------------------------------------------------------------

    @staticmethod
    def _bootstrap_ci(
        metric_fn,
        *arrays: np.ndarray,
        n_bootstrap: int = 1000,
        confidence_level: float = 0.95,
        seed: int = 42,
    ) -> Tuple[float, float, float]:
        """Compute a bootstrap confidence interval for a metric.

        Parameters
        ----------
        metric_fn : callable
            Function that takes the same arrays and returns a scalar.
        arrays : np.ndarray
            Arrays to resample in parallel.
        n_bootstrap : int
            Number of bootstrap iterations.
        confidence_level : float
            Confidence level (e.g. 0.95 for 95% CI).
        seed : int
            Random seed.

        Returns
        -------
        tuple[float, float, float]
            (point_estimate, ci_lower, ci_upper)
        """
        rng = np.random.RandomState(seed)
        n = len(arrays[0])
        estimates = []

        for _ in range(n_bootstrap):
            idx = rng.randint(0, n, size=n)
            sampled = tuple(arr[idx] for arr in arrays)
            estimates.append(metric_fn(*sampled))

        point_estimate = metric_fn(*arrays)
        alpha = 1 - confidence_level
        ci_lower = float(np.percentile(estimates, 100 * alpha / 2))
        ci_upper = float(np.percentile(estimates, 100 * (1 - alpha / 2)))

        return point_estimate, ci_lower, ci_upper

    def compute_demographic_parity_with_ci(
        self,
        predictions: np.ndarray,
        protected_attribute: np.ndarray,
        n_bootstrap: int = 1000,
    ) -> Dict[str, Any]:
        """Compute demographic parity with bootstrap confidence intervals.

        Returns the same structure as :meth:`compute_demographic_parity`
        but augmented with ``ci_lower`` and ``ci_upper`` for
        ``max_difference``.
        """
        base_result = self.compute_demographic_parity(predictions, protected_attribute)
        preds = np.asarray(predictions).ravel()
        groups = np.asarray(protected_attribute).ravel()

        def _max_diff(p, g):
            df = pd.DataFrame({"pred": p, "group": g})
            rates = [float(grp["pred"].mean()) for _, grp in df.groupby("group")]
            return (max(rates) - min(rates)) if len(rates) > 1 else 0.0

        _, ci_low, ci_high = self._bootstrap_ci(_max_diff, preds, groups, n_bootstrap=n_bootstrap)
        base_result["max_difference_ci"] = (ci_low, ci_high)
        return base_result

    def compute_disparate_impact_with_ci(
        self,
        predictions: np.ndarray,
        protected_attribute: np.ndarray,
        n_bootstrap: int = 1000,
    ) -> Dict[str, Any]:
        """Compute disparate impact with bootstrap confidence intervals.

        Returns the same structure as :meth:`compute_disparate_impact`
        but augmented with ``ci_lower`` and ``ci_upper`` for the ratio.
        """
        base_result = self.compute_disparate_impact(predictions, protected_attribute)
        preds = np.asarray(predictions).ravel()
        groups = np.asarray(protected_attribute).ravel()

        def _di_ratio(p, g):
            df = pd.DataFrame({"pred": p, "group": g})
            rates = [float(grp["pred"].mean()) for _, grp in df.groupby("group")]
            max_rate = max(rates) if rates else 0.0
            if max_rate == 0.0:
                return 1.0
            return min(rates) / max_rate

        _, ci_low, ci_high = self._bootstrap_ci(_di_ratio, preds, groups, n_bootstrap=n_bootstrap)
        base_result["disparate_impact_ratio_ci"] = (ci_low, ci_high)
        return base_result

    # ------------------------------------------------------------------
    # Reporting
    # ------------------------------------------------------------------

    def generate_report(
        self,
        model_name: str,
        audit_results: Dict[str, Any],
        output_path: Optional[str] = None,
    ) -> str:
        """Generate a human-readable fairness audit report.

        Parameters
        ----------
        model_name : str
            Descriptive name for the model being audited.
        audit_results : dict
            Combined dict with ``"demographic_parity"`` and
            ``"disparate_impact"`` sub-keys (as returned by the
            compute methods).
        output_path : str, optional
            If provided, write the report as JSON to this file.

        Returns
        -------
        str
            Formatted report string.
        """
        timestamp = datetime.now(timezone.utc).isoformat()

        dp = audit_results.get("demographic_parity", {})
        di = audit_results.get("disparate_impact", {})

        overall_pass = dp.get("passed", False) and di.get("passed", False)

        # Compute magnitude of unfairness
        dp_diff = dp.get("max_difference", 0.0)
        di_ratio = di.get("disparate_impact_ratio", 1.0)
        dp_magnitude = "N/A"
        di_magnitude = "N/A"

        if isinstance(dp_diff, (int, float)):
            if dp_diff <= 0.05:
                dp_magnitude = "negligible"
            elif dp_diff <= 0.10:
                dp_magnitude = "small"
            elif dp_diff <= 0.20:
                dp_magnitude = "moderate"
            else:
                dp_magnitude = "severe"

        if isinstance(di_ratio, (int, float)):
            if di_ratio >= 0.90:
                di_magnitude = "negligible"
            elif di_ratio >= 0.80:
                di_magnitude = "small"
            elif di_ratio >= 0.60:
                di_magnitude = "moderate"
            else:
                di_magnitude = "severe"

        # Equalized odds (if present)
        eo = audit_results.get("equalized_odds", {})
        cal = audit_results.get("calibration", {})

        # Build recommendations
        recommendations: List[str] = []
        if not dp.get("passed", True):
            recommendations.append(
                f"Demographic parity gap is {dp_magnitude} ({dp_diff:.4f}). "
                "Consider resampling, threshold adjustment, or post-processing "
                "calibration to reduce prediction rate differences across groups."
            )
        if not di.get("passed", True):
            recommendations.append(
                f"Disparate impact ratio is {di_magnitude} ({di_ratio:.4f}). "
                "Review feature selection for proxies of protected attributes "
                "and consider adversarial debiasing or reject-option classification."
            )
        if eo and not eo.get("passed", True):
            recommendations.append(
                "Equalized odds violated. Consider equalized-odds post-processing "
                "(Hardt et al., 2016) to balance TPR and FPR across groups."
            )
        if not recommendations:
            recommendations.append("All fairness checks passed. Continue monitoring in production.")

        report_lines = [
            "=" * 60,
            f"  FAIRNESS AUDIT REPORT",
            f"  Model : {model_name}",
            f"  Date  : {timestamp}",
            "=" * 60,
            "",
            "--- Demographic Parity ---",
            f"  Group positive-prediction rates: {dp.get('group_rates', {})}",
            f"  Max difference : {dp.get('max_difference', 'N/A'):.4f}"
            if isinstance(dp.get("max_difference"), (int, float))
            else f"  Max difference : {dp.get('max_difference', 'N/A')}",
            f"  Tolerance      : {dp.get('tolerance', 'N/A')}",
            f"  Magnitude      : {dp_magnitude}",
            f"  PASSED         : {dp.get('passed', 'N/A')}",
            "",
            "--- Disparate Impact (4/5ths Rule) ---",
            f"  Group positive-prediction rates: {di.get('group_rates', {})}",
            f"  Disparate impact ratio : {di.get('disparate_impact_ratio', 'N/A'):.4f}"
            if isinstance(di.get("disparate_impact_ratio"), (int, float))
            else f"  Disparate impact ratio : {di.get('disparate_impact_ratio', 'N/A')}",
            f"  Floor                  : {di.get('floor', 'N/A')}",
            f"  Magnitude              : {di_magnitude}",
            f"  PASSED                 : {di.get('passed', 'N/A')}",
            "",
        ]

        if eo:
            report_lines += [
                "--- Equalized Odds ---",
                f"  Group TPR: {eo.get('group_tpr', {})}",
                f"  Group FPR: {eo.get('group_fpr', {})}",
                f"  Max TPR difference: {eo.get('max_tpr_difference', 'N/A')}",
                f"  Max FPR difference: {eo.get('max_fpr_difference', 'N/A')}",
                f"  PASSED: {eo.get('passed', 'N/A')}",
                "",
            ]

        if cal:
            report_lines += [
                "--- Calibration ---",
                f"  Max ECE difference: {cal.get('max_ece_difference', 'N/A')}",
                "",
            ]

        report_lines += [
            "--- Overall ---",
            f"  ALL CHECKS PASSED: {overall_pass}",
            "",
            "--- Recommendations ---",
        ]
        for i, rec in enumerate(recommendations, 1):
            report_lines.append(f"  {i}. {rec}")

        report_lines.append("=" * 60)

        report_text = "\n".join(report_lines)

        if output_path:
            payload = {
                "model_name": model_name,
                "timestamp": timestamp,
                "overall_passed": overall_pass,
                "demographic_parity": dp,
                "disparate_impact": di,
            }
            with open(output_path, "w") as fh:
                json.dump(payload, fh, indent=2)
            logger.info("Audit report written to %s", output_path)

        return report_text


# ======================================================================
# CLI
# ======================================================================

def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Run a fairness audit on model predictions.",
    )
    parser.add_argument(
        "--predictions",
        required=True,
        help="Path to a CSV file with at least 'prediction' and the protected attribute columns.",
    )
    parser.add_argument(
        "--protected-attribute",
        required=True,
        help="Column name of the protected attribute (e.g. 'gender', 'race').",
    )
    parser.add_argument(
        "--prediction-col",
        default="prediction",
        help="Column name containing binary predictions (default: 'prediction').",
    )
    parser.add_argument(
        "--model-name",
        default="UnnamedModel",
        help="Descriptive model name for the report header.",
    )
    parser.add_argument(
        "--output",
        default=None,
        help="Optional path to write the JSON report.",
    )
    parser.add_argument(
        "--di-floor",
        type=float,
        default=_DISPARATE_IMPACT_FLOOR,
        help="Disparate impact floor (default: 0.80).",
    )
    parser.add_argument(
        "--dp-tolerance",
        type=float,
        default=_DEMOGRAPHIC_PARITY_TOLERANCE,
        help="Demographic parity tolerance (default: 0.05).",
    )
    return parser


def main(argv: Optional[List[str]] = None) -> None:
    """Entry-point for the fairness audit CLI."""
    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

    parser = _build_parser()
    args = parser.parse_args(argv)

    df = pd.read_csv(args.predictions)

    if args.prediction_col not in df.columns:
        logger.error("Column '%s' not found in %s", args.prediction_col, args.predictions)
        sys.exit(1)
    if args.protected_attribute not in df.columns:
        logger.error("Column '%s' not found in %s", args.protected_attribute, args.predictions)
        sys.exit(1)

    predictions = df[args.prediction_col].values
    protected = df[args.protected_attribute].values

    auditor = FairnessAuditor(
        disparate_impact_floor=args.di_floor,
        demographic_parity_tolerance=args.dp_tolerance,
    )

    dp_result = auditor.compute_demographic_parity(predictions, protected)
    di_result = auditor.compute_disparate_impact(predictions, protected)

    audit_results = {
        "demographic_parity": dp_result,
        "disparate_impact": di_result,
    }

    report = auditor.generate_report(
        model_name=args.model_name,
        audit_results=audit_results,
        output_path=args.output,
    )

    print(report)


if __name__ == "__main__":
    main()
