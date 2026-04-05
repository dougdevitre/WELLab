"""
Emotional Dynamics Engine
=========================
Implements the Intra- and Inter-individual Dynamical Emotion
Linkage System (IDELS) coupling analysis for the WELLab platform.

Coupling types
--------------
- **positive** : partners' emotions move in the same direction
- **negative** : partners' emotions move in opposite directions
- **decoupled** : no reliable association between partners' emotions
- **complex**   : non-linear or context-dependent linkage pattern
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Dict, List, Optional

import joblib
import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression  # noqa: F401 (stub dep)
from sklearn.preprocessing import StandardScaler  # noqa: F401 (stub dep)

from src.ml.config import (
    EMOTION_COUPLING_THRESHOLD,
    EMOTION_COUPLING_TYPES,
    EMOTION_VOLATILITY_WINDOW,
    RANDOM_SEED,
)
from src.ml.exceptions import ModelNotFittedError, SchemaValidationError
from src.ml.utils import set_reproducible_seed, validate_data_schema

logger = logging.getLogger(__name__)

_MODEL_VERSION = "1.0.0"

# Expected schema for the input data
_INPUT_SCHEMA = {
    "participant_id": "object",
    "time": "float64",
    "positive_affect": "float64",
    "negative_affect": "float64",
}


class EmotionCouplingAnalyzer:
    """Analyse emotional coupling patterns between dyad members.

    This analyser ingests time-series affect data, fits per-dyad
    coupling models, and classifies each relationship into one of the
    four IDELS coupling types.

    Parameters
    ----------
    coupling_threshold : float
        Absolute correlation value above which a dyad is considered
        *coupled* (default from ``config.EMOTION_COUPLING_THRESHOLD``).
    volatility_window : int
        Rolling-window size used for volatility estimation
        (default from ``config.EMOTION_VOLATILITY_WINDOW``).
    seed : int
        Random seed for reproducibility.

    Attributes
    ----------
    is_fitted : bool
        Whether :meth:`fit` has been called successfully.
    coupling_results_ : dict
        Per-participant coupling classification (populated after fit).
    """

    COUPLING_TYPES: List[str] = EMOTION_COUPLING_TYPES

    def __init__(
        self,
        coupling_threshold: float = EMOTION_COUPLING_THRESHOLD,
        volatility_window: int = EMOTION_VOLATILITY_WINDOW,
        seed: int = RANDOM_SEED,
    ) -> None:
        self.coupling_threshold = coupling_threshold
        self.volatility_window = volatility_window
        self.seed = seed

        self.is_fitted: bool = False
        self.coupling_results_: Dict[str, str] = {}
        self._data: Optional[pd.DataFrame] = None
        self._scaler = StandardScaler()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def fit(self, data: pd.DataFrame) -> "EmotionCouplingAnalyzer":
        """Fit coupling models to longitudinal affect data.

        Parameters
        ----------
        data : pd.DataFrame
            Must contain columns defined in ``_INPUT_SCHEMA``.

        Returns
        -------
        EmotionCouplingAnalyzer
            ``self``, for method chaining.

        Raises
        ------
        ValueError
            If schema validation fails.
        """
        set_reproducible_seed(self.seed)

        errors = validate_data_schema(data, _INPUT_SCHEMA)
        if errors:
            raise SchemaValidationError(errors=errors)

        self._data = data.copy()
        logger.info(
            "Fitting EmotionCouplingAnalyzer on %d rows, %d participants",
            len(data),
            data["participant_id"].nunique(),
        )

        # Normalise affect scores
        affect_cols = ["positive_affect", "negative_affect"]
        self._data[affect_cols] = self._scaler.fit_transform(
            self._data[affect_cols]
        )

        # Compute per-participant coupling
        for pid in self._data["participant_id"].unique():
            self.coupling_results_[pid] = self.predict_coupling_type(pid)

        self.is_fitted = True
        logger.info("Fit complete. %d coupling results stored.", len(self.coupling_results_))
        return self

    def predict_coupling_type(self, participant_id: str) -> str:
        """Classify a participant's emotion coupling pattern.

        Parameters
        ----------
        participant_id : str
            Participant whose coupling type is requested.

        Returns
        -------
        str
            One of ``"positive"``, ``"negative"``, ``"decoupled"``,
            or ``"complex"``.
        """
        if self._data is None:
            raise ModelNotFittedError("EmotionCouplingAnalyzer")

        subset = self._data.loc[
            self._data["participant_id"] == participant_id
        ]

        if subset.empty:
            logger.warning("No data for participant %s", participant_id)
            return "decoupled"

        pa = subset["positive_affect"].values
        na = subset["negative_affect"].values

        # Pearson correlation as a first-pass coupling metric
        if len(pa) < 3:
            return "decoupled"

        r = np.corrcoef(pa, na)[0, 1]

        # TODO: Replace simple correlation with a proper multilevel or
        #       time-varying parameter model (e.g., TV-VAR or DCC).
        if np.isnan(r) or abs(r) < self.coupling_threshold:
            return "decoupled"

        # TODO: Add non-linearity test to distinguish "complex" from
        #       simple positive/negative coupling.
        residual_nonlinearity = self._estimate_nonlinearity(pa, na)
        if residual_nonlinearity > 0.3:
            return "complex"

        return "positive" if r > 0 else "negative"

    def compute_volatility(self, time_series: np.ndarray) -> np.ndarray:
        """Compute rolling emotional volatility (standard deviation).

        Parameters
        ----------
        time_series : np.ndarray
            1-D array of affect scores over time.

        Returns
        -------
        np.ndarray
            Rolling standard deviation with the same length as
            *time_series* (leading entries are NaN where the window
            is incomplete).
        """
        series = pd.Series(time_series)
        volatility = series.rolling(
            window=self.volatility_window, min_periods=1
        ).std()
        return volatility.to_numpy()

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
                    "coupling_threshold": self.coupling_threshold,
                    "volatility_window": self.volatility_window,
                    "seed": self.seed,
                },
                "feature_names": list(_INPUT_SCHEMA.keys()),
            },
        }
        joblib.dump(payload, path)
        logger.info("EmotionCouplingAnalyzer saved to %s", path)

    @classmethod
    def load(cls, path: str) -> "EmotionCouplingAnalyzer":
        """Load a previously saved analyzer from disk.

        Parameters
        ----------
        path : str
            File path to the serialized model.

        Returns
        -------
        EmotionCouplingAnalyzer
            The deserialized analyzer instance.
        """
        payload = joblib.load(path)
        model = payload["model"]
        logger.info(
            "EmotionCouplingAnalyzer loaded from %s (version=%s, trained=%s)",
            path,
            payload["metadata"]["model_version"],
            payload["metadata"]["training_timestamp"],
        )
        return model

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _estimate_nonlinearity(x: np.ndarray, y: np.ndarray) -> float:
        """Return a rough nonlinearity score between two signals.

        Uses the ratio of quadratic-model R^2 improvement over a linear
        model as a simple heuristic.

        TODO: Replace with a proper BDS or RESET test.
        """
        if len(x) < 5:
            return 0.0

        x_col = x.reshape(-1, 1)
        linear = LinearRegression().fit(x_col, y)
        r2_linear = max(linear.score(x_col, y), 0.0)

        x_quad = np.column_stack([x, x ** 2])
        quad = LinearRegression().fit(x_quad, y)
        r2_quad = max(quad.score(x_quad, y), 0.0)

        improvement = r2_quad - r2_linear
        return float(np.clip(improvement, 0.0, 1.0))
