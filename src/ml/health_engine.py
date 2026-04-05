"""
Behavioral & Physiological Health Engine
=========================================
Provides causal-inference tooling for analysing bidirectional
relationships between subjective well-being and objective health
biomarkers in the WELLab platform.

Integrates with the DoWhy causal-inference library for identification,
estimation, and refutation of treatment effects.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import joblib
import numpy as np
import pandas as pd

# Stub imports -- these will resolve once DoWhy / statsmodels are installed
try:
    import dowhy  # noqa: F401
    from dowhy import CausalModel  # noqa: F401
    _HAS_DOWHY = True
except ImportError:  # pragma: no cover
    _HAS_DOWHY = False

try:
    import statsmodels.api as sm  # noqa: F401
    _HAS_STATSMODELS = True
except ImportError:  # pragma: no cover
    _HAS_STATSMODELS = False

from src.ml.config import HEALTH_ENGINE_PARAMS, RANDOM_SEED
from src.ml.exceptions import InsufficientDataError  # noqa: F401
from src.ml.utils import set_reproducible_seed

logger = logging.getLogger(__name__)

_MODEL_VERSION = "1.0.0"


@dataclass
class CausalEstimateResult:
    """Container for a single causal-effect estimate."""

    treatment: str
    outcome: str
    method: str
    estimate: float
    p_value: Optional[float] = None
    confidence_interval: tuple[float, float] = (np.nan, np.nan)
    refutation_passed: Optional[bool] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


class CausalHealthAnalyzer:
    """Estimate causal effects between well-being and health variables.

    Parameters
    ----------
    significance_level : float
        Alpha for hypothesis tests (default 0.05).
    causal_method : str
        DoWhy estimation method identifier.
    seed : int
        Random seed for reproducibility.
    """

    def __init__(
        self,
        significance_level: float = HEALTH_ENGINE_PARAMS["significance_level"],
        causal_method: str = HEALTH_ENGINE_PARAMS["causal_method"],
        seed: int = RANDOM_SEED,
    ) -> None:
        self.significance_level = significance_level
        self.causal_method = causal_method
        self.seed = seed

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def estimate_causal_effect(
        self,
        treatment: str,
        outcome: str,
        confounders: List[str],
        data: Optional[pd.DataFrame] = None,
    ) -> CausalEstimateResult:
        """Estimate the average causal effect of *treatment* on *outcome*.

        Parameters
        ----------
        treatment : str
            Column name of the treatment / exposure variable.
        outcome : str
            Column name of the outcome variable.
        confounders : list[str]
            Column names to adjust for.
        data : pd.DataFrame, optional
            Observational data.  Required on first call; cached
            thereafter.

        Returns
        -------
        CausalEstimateResult
            Structured result including point estimate, CI, and
            refutation flag.
        """
        set_reproducible_seed(self.seed)

        if data is None:
            raise InsufficientDataError(required=1, actual=0, context="data must be provided")

        logger.info(
            "Estimating causal effect: %s -> %s | %s",
            treatment, outcome, confounders,
        )

        # TODO: Build a proper DoWhy CausalModel with the user-supplied
        #       DAG or automatic graph discovery.
        #
        # model = CausalModel(
        #     data=data,
        #     treatment=treatment,
        #     outcome=outcome,
        #     common_causes=confounders,
        # )
        # identified = model.identify_effect()
        # estimate = model.estimate_effect(
        #     identified, method_name=self.causal_method
        # )

        # --- stub linear estimate ---
        from sklearn.linear_model import LinearRegression

        feature_cols = [treatment] + confounders
        X = data[feature_cols].dropna()
        y = data.loc[X.index, outcome]

        reg = LinearRegression().fit(X, y)
        treatment_idx = feature_cols.index(treatment)
        beta = float(reg.coef_[treatment_idx])

        n = len(y)
        se = float(np.std(y - reg.predict(X)) / np.sqrt(n))
        ci_low = beta - 1.96 * se
        ci_high = beta + 1.96 * se

        # TODO: Run DoWhy refutation tests (placebo, random common cause)
        refutation_passed = None

        return CausalEstimateResult(
            treatment=treatment,
            outcome=outcome,
            method=self.causal_method,
            estimate=beta,
            confidence_interval=(ci_low, ci_high),
            refutation_passed=refutation_passed,
        )

    def run_longitudinal_regression(
        self,
        data: pd.DataFrame,
        outcome: str = "health_outcome",
        time_var: str = "wave",
        group_var: str = "participant_id",
    ) -> Dict[str, Any]:
        """Fit a longitudinal (mixed-effects) regression.

        Parameters
        ----------
        data : pd.DataFrame
            Panel data with repeated measures.
        outcome : str
            Dependent variable column.
        time_var : str
            Column identifying the measurement occasion.
        group_var : str
            Column identifying the clustering unit (participant).

        Returns
        -------
        dict
            Summary statistics including fixed-effect coefficients and
            random-effect variance components.
        """
        set_reproducible_seed(self.seed)
        logger.info("Running longitudinal regression for outcome=%s", outcome)

        # TODO: Use statsmodels MixedLM for proper random-intercept /
        #       random-slope models:
        #
        # import statsmodels.formula.api as smf
        # model = smf.mixedlm(
        #     f"{outcome} ~ {time_var}", data,
        #     groups=data[group_var],
        #     re_formula=f"~{time_var}",
        # )
        # result = model.fit()

        # --- stub OLS per group ---
        from sklearn.linear_model import LinearRegression

        coefficients: Dict[str, float] = {}
        for gid, grp in data.groupby(group_var):
            X = grp[[time_var]].values
            y = grp[outcome].values
            if len(y) < 2:
                continue
            reg = LinearRegression().fit(X, y)
            coefficients[str(gid)] = float(reg.coef_[0])

        mean_slope = float(np.mean(list(coefficients.values()))) if coefficients else 0.0
        var_slope = float(np.var(list(coefficients.values()))) if coefficients else 0.0

        return {
            "fixed_effect_slope": mean_slope,
            "random_effect_variance": var_slope,
            "n_groups": len(coefficients),
            "method": "stub_ols_per_group",
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
                    "significance_level": self.significance_level,
                    "causal_method": self.causal_method,
                    "seed": self.seed,
                },
                "feature_names": [],
            },
        }
        joblib.dump(payload, path)
        logger.info("CausalHealthAnalyzer saved to %s", path)

    @classmethod
    def load(cls, path: str) -> "CausalHealthAnalyzer":
        """Load a previously saved analyzer from disk.

        Parameters
        ----------
        path : str
            File path to the serialized model.

        Returns
        -------
        CausalHealthAnalyzer
            The deserialized analyzer instance.
        """
        payload = joblib.load(path)
        model = payload["model"]
        logger.info(
            "CausalHealthAnalyzer loaded from %s (version=%s, trained=%s)",
            path,
            payload["metadata"]["model_version"],
            payload["metadata"]["training_timestamp"],
        )
        return model

    def bidirectional_analysis(
        self,
        wellbeing_data: pd.DataFrame,
        health_data: pd.DataFrame,
        participant_col: str = "participant_id",
        time_col: str = "wave",
    ) -> Dict[str, CausalEstimateResult]:
        """Run paired causal analyses in both directions.

        Estimates the effect of well-being on health **and** the effect
        of health on well-being, returning both results keyed by
        direction label.

        Parameters
        ----------
        wellbeing_data : pd.DataFrame
            Subjective well-being measures.
        health_data : pd.DataFrame
            Objective health biomarkers.
        participant_col : str
            Join key for participants.
        time_col : str
            Join key for measurement wave.

        Returns
        -------
        dict[str, CausalEstimateResult]
            ``"wellbeing_to_health"`` and ``"health_to_wellbeing"`` estimates.
        """
        merged = pd.merge(
            wellbeing_data, health_data,
            on=[participant_col, time_col],
            how="inner",
            suffixes=("_wb", "_hl"),
        )

        if merged.empty:
            raise InsufficientDataError(
                required=1, actual=0,
                context="Merge produced an empty DataFrame; check join keys",
            )

        logger.info("Bidirectional analysis on %d merged rows", len(merged))

        # TODO: Replace hard-coded column names with config-driven mappings
        wb_col = "wellbeing_score" if "wellbeing_score" in merged.columns else merged.columns[2]
        hl_col = "health_score" if "health_score" in merged.columns else merged.columns[3]

        wb_to_hl = self.estimate_causal_effect(
            treatment=wb_col,
            outcome=hl_col,
            confounders=[time_col],
            data=merged,
        )

        hl_to_wb = self.estimate_causal_effect(
            treatment=hl_col,
            outcome=wb_col,
            confounders=[time_col],
            data=merged,
        )

        return {
            "wellbeing_to_health": wb_to_hl,
            "health_to_wellbeing": hl_to_wb,
        }
