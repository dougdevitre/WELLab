"""
Lifespan Trajectory Engine
==========================
Growth-curve fitting, trajectory clustering, and cross-cultural
comparison tools for modelling well-being across the lifespan.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, Optional

import joblib
import numpy as np
import pandas as pd
from sklearn.cluster import KMeans

# Stub import -- resolves once statsmodels is installed
try:
    import statsmodels.formula.api as smf  # noqa: F401
    _HAS_STATSMODELS = True
except ImportError:  # pragma: no cover
    _HAS_STATSMODELS = False

from src.ml.config import RANDOM_SEED, TRAJECTORY_PARAMS
from src.ml.utils import set_reproducible_seed

logger = logging.getLogger(__name__)

_MODEL_VERSION = "1.0.0"


class TrajectoryAnalyzer:
    """Model lifespan developmental trajectories.

    Parameters
    ----------
    max_degree : int
        Maximum polynomial degree for growth-curve fitting.
    n_clusters : int
        Default number of latent trajectory groups.
    seed : int
        Random seed for reproducibility.
    """

    def __init__(
        self,
        max_degree: int = TRAJECTORY_PARAMS["max_polynomial_degree"],
        n_clusters: int = TRAJECTORY_PARAMS["default_n_clusters"],
        seed: int = RANDOM_SEED,
    ) -> None:
        self.max_degree = max_degree
        self.n_clusters = n_clusters
        self.seed = seed

        self._growth_models: Dict[str, Any] = {}
        self._cluster_model: Optional[KMeans] = None

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def fit_growth_curves(
        self,
        data: pd.DataFrame,
        outcome: str = "wellbeing",
        age_col: str = "age",
        group_col: str = "participant_id",
    ) -> Dict[str, Any]:
        """Fit polynomial growth curves per participant.

        Parameters
        ----------
        data : pd.DataFrame
            Longitudinal panel with at least *outcome*, *age_col*, and
            *group_col*.
        outcome : str
            Dependent variable.
        age_col : str
            Age or time variable.
        group_col : str
            Clustering / grouping variable.

        Returns
        -------
        dict
            Per-participant polynomial coefficients and an aggregate
            summary.
        """
        set_reproducible_seed(self.seed)
        logger.info(
            "Fitting growth curves (degree<=%d) for %d participants",
            self.max_degree,
            data[group_col].nunique(),
        )

        participant_curves: Dict[str, np.ndarray] = {}

        for pid, grp in data.groupby(group_col):
            x = grp[age_col].values.reshape(-1, 1)
            y = grp[outcome].values

            if len(y) < self.max_degree + 1:
                # Not enough points for the requested degree
                degree = max(len(y) - 1, 1)
            else:
                degree = self.max_degree

            # TODO: Replace with statsmodels MixedLM for proper
            #       random-effects growth curves:
            #   smf.mixedlm(f"{outcome} ~ age + I(age**2)",
            #               data, groups=data[group_col])
            coeffs = np.polyfit(x.ravel(), y, deg=degree)
            participant_curves[str(pid)] = coeffs

        self._growth_models = participant_curves

        # Aggregate summary
        all_coeffs = np.array(list(participant_curves.values()))
        summary = {
            "n_participants": len(participant_curves),
            "degree": self.max_degree,
            "mean_coefficients": all_coeffs.mean(axis=0).tolist(),
            "std_coefficients": all_coeffs.std(axis=0).tolist(),
        }
        logger.info("Growth curve fitting complete: %s", summary)
        return summary

    def cluster_trajectories(
        self,
        data: pd.DataFrame,
        n_clusters: Optional[int] = None,
        outcome: str = "wellbeing",
        age_col: str = "age",
        group_col: str = "participant_id",
    ) -> Dict[str, Any]:
        """Identify latent trajectory groups via K-Means on curve features.

        Parameters
        ----------
        data : pd.DataFrame
            Same longitudinal format as :meth:`fit_growth_curves`.
        n_clusters : int, optional
            Number of clusters (falls back to ``self.n_clusters``).
        outcome, age_col, group_col : str
            Column names.

        Returns
        -------
        dict
            Cluster labels per participant plus cluster centroids.
        """
        k = n_clusters or self.n_clusters
        set_reproducible_seed(self.seed)
        logger.info("Clustering trajectories into %d groups", k)

        # Build feature matrix from polynomial coefficients
        if not self._growth_models:
            self.fit_growth_curves(data, outcome, age_col, group_col)

        pids = list(self._growth_models.keys())

        # Pad coefficient arrays to uniform length
        max_len = max(len(c) for c in self._growth_models.values())
        feature_matrix = np.zeros((len(pids), max_len))
        for i, pid in enumerate(pids):
            coeffs = self._growth_models[pid]
            feature_matrix[i, max_len - len(coeffs):] = coeffs

        # TODO: Consider using GMM or latent-class growth analysis
        #       instead of K-Means for better probabilistic assignment.
        self._cluster_model = KMeans(
            n_clusters=k,
            random_state=self.seed,
            n_init=10,
        )
        labels = self._cluster_model.fit_predict(feature_matrix)

        assignments = {pid: int(label) for pid, label in zip(pids, labels)}
        centroids = self._cluster_model.cluster_centers_.tolist()

        logger.info("Trajectory clustering complete: %d clusters", k)
        return {
            "n_clusters": k,
            "assignments": assignments,
            "centroids": centroids,
            "inertia": float(self._cluster_model.inertia_),
        }

    # ------------------------------------------------------------------
    # Serialization
    # ------------------------------------------------------------------

    def save(self, path: str) -> None:
        """Save the analyzer to disk with metadata.

        Parameters
        ----------
        path : str
            File path for the serialized model.
        """
        payload = {
            "model": self,
            "metadata": {
                "model_version": _MODEL_VERSION,
                "training_timestamp": datetime.now(timezone.utc).isoformat(),
                "config": {
                    "max_degree": self.max_degree,
                    "n_clusters": self.n_clusters,
                    "seed": self.seed,
                },
                "feature_names": list(self._growth_models.keys()),
            },
        }
        joblib.dump(payload, path)
        logger.info("TrajectoryAnalyzer saved to %s", path)

    @classmethod
    def load(cls, path: str) -> "TrajectoryAnalyzer":
        """Load a previously saved analyzer from disk.

        Parameters
        ----------
        path : str
            File path to the serialized model.

        Returns
        -------
        TrajectoryAnalyzer
            The deserialized analyzer instance.
        """
        payload = joblib.load(path)
        model = payload["model"]
        logger.info(
            "TrajectoryAnalyzer loaded from %s (version=%s, trained=%s)",
            path,
            payload["metadata"]["model_version"],
            payload["metadata"]["training_timestamp"],
        )
        return model

    def cross_cultural_comparison(
        self,
        cohort_a: pd.DataFrame,
        cohort_b: pd.DataFrame,
        outcome: str = "wellbeing",
        age_col: str = "age",
    ) -> Dict[str, Any]:
        """Compare aggregate trajectory shapes between two cohorts.

        Parameters
        ----------
        cohort_a, cohort_b : pd.DataFrame
            Each must contain *outcome* and *age_col* columns.

        Returns
        -------
        dict
            Per-cohort polynomial fits, the coefficient differences,
            and a rough significance indicator.
        """
        set_reproducible_seed(self.seed)
        logger.info(
            "Cross-cultural comparison: cohort_a=%d rows, cohort_b=%d rows",
            len(cohort_a), len(cohort_b),
        )

        def _fit_cohort(df: pd.DataFrame) -> np.ndarray:
            x = df[age_col].values
            y = df[outcome].values
            degree = min(self.max_degree, max(len(y) - 1, 1))
            return np.polyfit(x, y, deg=degree)

        coeffs_a = _fit_cohort(cohort_a)
        coeffs_b = _fit_cohort(cohort_b)

        # Pad to same length for comparison
        max_len = max(len(coeffs_a), len(coeffs_b))
        padded_a = np.zeros(max_len)
        padded_b = np.zeros(max_len)
        padded_a[max_len - len(coeffs_a):] = coeffs_a
        padded_b[max_len - len(coeffs_b):] = coeffs_b

        diff = padded_a - padded_b

        # TODO: Implement permutation test or bootstrap CI for the
        #       coefficient differences to get proper p-values.
        crude_distance = float(np.linalg.norm(diff))

        return {
            "cohort_a_coeffs": padded_a.tolist(),
            "cohort_b_coeffs": padded_b.tolist(),
            "coefficient_diff": diff.tolist(),
            "euclidean_distance": crude_distance,
            "significant": crude_distance > 0.5,  # placeholder threshold
        }
