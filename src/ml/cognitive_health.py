"""
Cognitive Health & Dementia Prevention Engine
=============================================
Risk prediction, protective-factor identification, and survival
analysis for cognitive decline and dementia onset.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.model_selection import cross_val_score
from sklearn.inspection import permutation_importance

# Stub import -- resolves once lifelines is installed
try:
    from lifelines import CoxPHFitter  # noqa: F401
    _HAS_LIFELINES = True
except ImportError:  # pragma: no cover
    _HAS_LIFELINES = False

from src.ml.config import COGNITIVE_RISK_PARAMS, RANDOM_SEED
from src.ml.utils import set_reproducible_seed

logger = logging.getLogger(__name__)


class CognitiveRiskModel:
    """Predict cognitive-decline risk and identify protective factors.

    Parameters
    ----------
    risk_threshold : float
        Probability cut-off above which a participant is flagged
        as high-risk.
    n_estimators : int
        Number of boosting rounds for the gradient-boosted classifier.
    max_depth : int
        Maximum tree depth.
    seed : int
        Random seed for reproducibility.
    """

    def __init__(
        self,
        risk_threshold: float = COGNITIVE_RISK_PARAMS["risk_threshold"],
        n_estimators: int = COGNITIVE_RISK_PARAMS["n_estimators"],
        max_depth: int = COGNITIVE_RISK_PARAMS["max_depth"],
        seed: int = RANDOM_SEED,
    ) -> None:
        self.risk_threshold = risk_threshold
        self.seed = seed

        self._classifier = GradientBoostingClassifier(
            n_estimators=n_estimators,
            max_depth=max_depth,
            random_state=seed,
        )
        self.is_fitted: bool = False
        self._feature_names: List[str] = []

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def fit(
        self,
        data: pd.DataFrame,
        target_col: str = "cognitive_decline",
        exclude_cols: Optional[List[str]] = None,
    ) -> "CognitiveRiskModel":
        """Train the risk-prediction model.

        Parameters
        ----------
        data : pd.DataFrame
            Feature matrix including the binary target column.
        target_col : str
            Name of the 0/1 outcome column.
        exclude_cols : list[str], optional
            Columns to exclude from features (e.g. IDs, dates).

        Returns
        -------
        CognitiveRiskModel
            ``self``, for method chaining.
        """
        set_reproducible_seed(self.seed)

        exclude = set(exclude_cols or []) | {target_col}
        self._feature_names = [c for c in data.columns if c not in exclude]

        X = data[self._feature_names].values
        y = data[target_col].values

        logger.info(
            "Training CognitiveRiskModel: %d samples, %d features",
            X.shape[0], X.shape[1],
        )

        # TODO: Add hyperparameter tuning via RandomizedSearchCV or
        #       Optuna before production deployment.
        self._classifier.fit(X, y)

        # Quick cross-validated performance check
        cv_scores = cross_val_score(
            self._classifier, X, y, cv=5, scoring="roc_auc"
        )
        logger.info(
            "5-fold CV AUC: %.3f (+/- %.3f)",
            cv_scores.mean(), cv_scores.std(),
        )

        self.is_fitted = True
        return self

    def predict_risk(
        self,
        participant_data: pd.DataFrame,
    ) -> pd.DataFrame:
        """Generate risk scores for new participants.

        Parameters
        ----------
        participant_data : pd.DataFrame
            Must contain the same feature columns used during fit.

        Returns
        -------
        pd.DataFrame
            Original data augmented with ``risk_probability`` and
            ``high_risk`` columns.
        """
        if not self.is_fitted:
            raise RuntimeError("Call fit() before predict_risk().")

        X = participant_data[self._feature_names].values
        probas = self._classifier.predict_proba(X)[:, 1]

        result = participant_data.copy()
        result["risk_probability"] = probas
        result["high_risk"] = probas >= self.risk_threshold

        n_high = int(result["high_risk"].sum())
        logger.info(
            "Predicted risk for %d participants: %d flagged high-risk (%.1f%%)",
            len(result), n_high, 100.0 * n_high / max(len(result), 1),
        )
        return result

    def identify_protective_factors(
        self,
        data: pd.DataFrame,
        target_col: str = "cognitive_decline",
        top_n: int = 10,
    ) -> List[Tuple[str, float]]:
        """Rank features by their protective (negative) importance.

        Parameters
        ----------
        data : pd.DataFrame
            Dataset used for importance estimation.
        target_col : str
            Binary outcome column.
        top_n : int
            Number of top protective factors to return.

        Returns
        -------
        list[tuple[str, float]]
            Feature names paired with their importance scores, sorted
            so that the strongest *protective* factors come first
            (most negative importance = most protective).
        """
        if not self.is_fitted:
            raise RuntimeError("Call fit() before identify_protective_factors().")

        X = data[self._feature_names]
        y = data[target_col]

        logger.info("Computing permutation importance for protective factors")

        # TODO: Supplement with SHAP values for richer explanations.
        perm_imp = permutation_importance(
            self._classifier, X, y,
            n_repeats=10,
            random_state=self.seed,
            scoring="roc_auc",
        )

        importances = perm_imp.importances_mean
        ranked = sorted(
            zip(self._feature_names, importances),
            key=lambda pair: pair[1],
        )

        # Protective factors have *negative* permutation importance:
        # removing them *hurts* prediction of decline, implying they
        # are associated with *lower* risk.
        protective = [(name, float(score)) for name, score in ranked[:top_n]]
        logger.info("Top %d protective factors: %s", top_n, protective)
        return protective

    def survival_analysis(
        self,
        time_to_event_data: pd.DataFrame,
        duration_col: str = "years_to_event",
        event_col: str = "event_observed",
    ) -> Dict[str, Any]:
        """Run a Cox proportional-hazards survival model.

        Parameters
        ----------
        time_to_event_data : pd.DataFrame
            Must include *duration_col*, *event_col*, and covariate
            columns.
        duration_col : str
            Time-to-event column.
        event_col : str
            Binary indicator of whether the event was observed.

        Returns
        -------
        dict
            Hazard ratios, concordance index, and model summary text.
        """
        set_reproducible_seed(self.seed)
        logger.info(
            "Running survival analysis on %d observations",
            len(time_to_event_data),
        )

        if _HAS_LIFELINES:
            cph = CoxPHFitter()
            cph.fit(
                time_to_event_data,
                duration_col=duration_col,
                event_col=event_col,
            )

            return {
                "concordance_index": float(cph.concordance_index_),
                "hazard_ratios": cph.hazard_ratios_.to_dict(),
                "summary": cph.summary.to_dict(),
                "method": "cox_ph_lifelines",
            }

        # --- stub fallback when lifelines is not installed ---
        # TODO: Install lifelines and remove this stub.
        logger.warning(
            "lifelines not installed; returning placeholder survival results"
        )

        covariate_cols = [
            c for c in time_to_event_data.columns
            if c not in (duration_col, event_col)
        ]

        placeholder_hr = {col: 1.0 for col in covariate_cols}
        return {
            "concordance_index": np.nan,
            "hazard_ratios": placeholder_hr,
            "summary": "lifelines not installed -- stub results",
            "method": "stub",
        }
