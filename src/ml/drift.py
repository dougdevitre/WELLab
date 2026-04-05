"""
Data Drift Detection
====================
Monitors distributional shifts between reference (training) data and
incoming production data for the WELLab ML pipeline.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd
from scipy import stats

from src.ml.exceptions import DataDriftError

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Report dataclass
# ---------------------------------------------------------------------------

@dataclass
class FeatureDriftResult:
    """Drift result for a single feature."""

    feature: str
    statistic: float
    p_value: float
    test_name: str
    drifted: bool
    psi: Optional[float] = None


@dataclass
class DriftReport:
    """Aggregated drift report across all features.

    Attributes
    ----------
    feature_results : list[FeatureDriftResult]
        Per-feature drift test outcomes.
    overall_drifted : bool
        Whether overall drift was detected (any feature exceeds threshold).
    severity : str
        ``"none"``, ``"low"``, ``"moderate"``, or ``"severe"`` based on
        the fraction of drifted features.
    summary : dict[str, Any]
        High-level summary statistics.
    """

    feature_results: List[FeatureDriftResult] = field(default_factory=list)
    overall_drifted: bool = False
    severity: str = "none"
    summary: Dict[str, Any] = field(default_factory=dict)

    @property
    def drifted_features(self) -> List[str]:
        return [r.feature for r in self.feature_results if r.drifted]


# ---------------------------------------------------------------------------
# Detector
# ---------------------------------------------------------------------------

class DataDriftDetector:
    """Detect distributional drift between reference and new data.

    Parameters
    ----------
    p_value_threshold : float
        Statistical significance level for KS / chi-squared tests.
    psi_threshold : float
        Population Stability Index threshold above which drift is flagged.
    categorical_columns : list[str], optional
        Columns to treat as categorical.  All others are assumed continuous.
    """

    def __init__(
        self,
        p_value_threshold: float = 0.05,
        psi_threshold: float = 0.20,
        categorical_columns: Optional[List[str]] = None,
    ) -> None:
        self.p_value_threshold = p_value_threshold
        self.psi_threshold = psi_threshold
        self.categorical_columns: List[str] = categorical_columns or []

        self._reference: Optional[pd.DataFrame] = None
        self._is_fitted: bool = False

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def fit(self, reference_data: pd.DataFrame) -> "DataDriftDetector":
        """Store reference distributions.

        Parameters
        ----------
        reference_data : pd.DataFrame
            The baseline (training) dataset.

        Returns
        -------
        DataDriftDetector
            ``self``, for method chaining.
        """
        self._reference = reference_data.copy()
        self._is_fitted = True
        logger.info(
            "DataDriftDetector fitted on reference data with %d rows, %d columns",
            len(reference_data),
            len(reference_data.columns),
        )
        return self

    def detect(self, new_data: pd.DataFrame) -> DriftReport:
        """Compare *new_data* against the stored reference distributions.

        Parameters
        ----------
        new_data : pd.DataFrame
            Incoming production data to test for drift.

        Returns
        -------
        DriftReport
            Per-feature results and overall drift status.
        """
        if not self._is_fitted or self._reference is None:
            raise DataDriftError(
                message="DataDriftDetector has not been fitted. Call fit() first."
            )

        common_cols = [
            c for c in self._reference.columns if c in new_data.columns
        ]

        feature_results: List[FeatureDriftResult] = []

        for col in common_cols:
            ref_col = self._reference[col].dropna()
            new_col = new_data[col].dropna()

            if col in self.categorical_columns:
                result = self._test_categorical(col, ref_col, new_col)
            else:
                result = self._test_continuous(col, ref_col, new_col)

            feature_results.append(result)

        n_drifted = sum(1 for r in feature_results if r.drifted)
        n_total = max(len(feature_results), 1)
        drift_fraction = n_drifted / n_total

        if drift_fraction == 0:
            severity = "none"
        elif drift_fraction < 0.2:
            severity = "low"
        elif drift_fraction < 0.5:
            severity = "moderate"
        else:
            severity = "severe"

        overall_drifted = n_drifted > 0

        report = DriftReport(
            feature_results=feature_results,
            overall_drifted=overall_drifted,
            severity=severity,
            summary={
                "n_features_tested": len(feature_results),
                "n_drifted": n_drifted,
                "drift_fraction": drift_fraction,
            },
        )

        logger.info(
            "Drift detection complete: %d/%d features drifted (severity=%s)",
            n_drifted,
            len(feature_results),
            severity,
        )
        return report

    # ------------------------------------------------------------------
    # Statistical tests
    # ------------------------------------------------------------------

    @staticmethod
    def population_stability_index(
        reference: np.ndarray,
        current: np.ndarray,
        n_bins: int = 10,
    ) -> float:
        """Compute the Population Stability Index (PSI) for a feature.

        Parameters
        ----------
        reference : np.ndarray
            Reference distribution values.
        current : np.ndarray
            Current distribution values.
        n_bins : int
            Number of quantile-based bins.

        Returns
        -------
        float
            PSI value.  Values > 0.20 typically indicate significant shift.
        """
        eps = 1e-6
        # Use reference quantiles to define bin edges
        edges = np.quantile(reference, np.linspace(0, 1, n_bins + 1))
        edges = np.unique(edges)

        ref_counts, _ = np.histogram(reference, bins=edges)
        cur_counts, _ = np.histogram(current, bins=edges)

        ref_pct = ref_counts / max(ref_counts.sum(), 1) + eps
        cur_pct = cur_counts / max(cur_counts.sum(), 1) + eps

        psi = float(np.sum((cur_pct - ref_pct) * np.log(cur_pct / ref_pct)))
        return psi

    @staticmethod
    def kolmogorov_smirnov_test(
        reference: np.ndarray,
        current: np.ndarray,
    ) -> tuple:
        """Run a two-sample Kolmogorov-Smirnov test.

        Returns
        -------
        tuple[float, float]
            (statistic, p_value)
        """
        stat, p_value = stats.ks_2samp(reference, current)
        return float(stat), float(p_value)

    @staticmethod
    def chi_squared_test(
        reference: np.ndarray,
        current: np.ndarray,
    ) -> tuple:
        """Run a chi-squared test for categorical features.

        Computes observed vs expected frequencies based on the reference
        distribution proportions.

        Returns
        -------
        tuple[float, float]
            (statistic, p_value)
        """
        ref_series = pd.Series(reference)
        cur_series = pd.Series(current)

        all_categories = list(set(ref_series.unique()) | set(cur_series.unique()))

        ref_counts = ref_series.value_counts()
        cur_counts = cur_series.value_counts()

        ref_freq = np.array([ref_counts.get(c, 0) for c in all_categories], dtype=float)
        cur_freq = np.array([cur_counts.get(c, 0) for c in all_categories], dtype=float)

        # Expected frequencies scaled to current sample size
        ref_total = ref_freq.sum()
        cur_total = cur_freq.sum()
        if ref_total == 0 or cur_total == 0:
            return 0.0, 1.0

        expected = (ref_freq / ref_total) * cur_total
        # Avoid zero expected
        expected = np.where(expected == 0, 1e-6, expected)

        stat, p_value = stats.chisquare(cur_freq, f_exp=expected)
        return float(stat), float(p_value)

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _test_continuous(
        self, col: str, ref: pd.Series, new: pd.Series,
    ) -> FeatureDriftResult:
        ref_arr = ref.values.astype(float)
        new_arr = new.values.astype(float)

        ks_stat, ks_p = self.kolmogorov_smirnov_test(ref_arr, new_arr)
        psi = self.population_stability_index(ref_arr, new_arr)

        drifted = ks_p < self.p_value_threshold or psi > self.psi_threshold

        return FeatureDriftResult(
            feature=col,
            statistic=ks_stat,
            p_value=ks_p,
            test_name="kolmogorov_smirnov",
            drifted=drifted,
            psi=psi,
        )

    def _test_categorical(
        self, col: str, ref: pd.Series, new: pd.Series,
    ) -> FeatureDriftResult:
        chi_stat, chi_p = self.chi_squared_test(ref.values, new.values)

        drifted = chi_p < self.p_value_threshold

        return FeatureDriftResult(
            feature=col,
            statistic=chi_stat,
            p_value=chi_p,
            test_name="chi_squared",
            drifted=drifted,
            psi=None,
        )
