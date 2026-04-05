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
import json
import logging
import sys
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

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
            f"  PASSED         : {dp.get('passed', 'N/A')}",
            "",
            "--- Disparate Impact (4/5ths Rule) ---",
            f"  Group positive-prediction rates: {di.get('group_rates', {})}",
            f"  Disparate impact ratio : {di.get('disparate_impact_ratio', 'N/A'):.4f}"
            if isinstance(di.get("disparate_impact_ratio"), (int, float))
            else f"  Disparate impact ratio : {di.get('disparate_impact_ratio', 'N/A')}",
            f"  Floor                  : {di.get('floor', 'N/A')}",
            f"  PASSED                 : {di.get('passed', 'N/A')}",
            "",
            "--- Overall ---",
            f"  ALL CHECKS PASSED: {overall_pass}",
            "=" * 60,
        ]

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
