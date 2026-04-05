"""
ML configuration constants for the WELLab platform.

Central location for random seeds, default model hyper-parameters,
decision thresholds, and data-schema definitions used across all
pipeline modules.
"""

from __future__ import annotations

import copy
import os
from typing import Any, Dict, Optional

# ---------------------------------------------------------------------------
# Reproducibility
# ---------------------------------------------------------------------------
RANDOM_SEED: int = 42

# ---------------------------------------------------------------------------
# Emotional Dynamics Engine
# ---------------------------------------------------------------------------
EMOTION_COUPLING_TYPES: list[str] = [
    "positive",
    "negative",
    "decoupled",
    "complex",
]

EMOTION_VOLATILITY_WINDOW: int = 5  # rolling-window size for volatility
EMOTION_COUPLING_THRESHOLD: float = 0.30  # abs(r) above this => coupled

# ---------------------------------------------------------------------------
# Health Engine
# ---------------------------------------------------------------------------
HEALTH_ENGINE_PARAMS: Dict[str, Any] = {
    "min_observations": 30,
    "significance_level": 0.05,
    "bootstrap_iterations": 1000,
    "causal_method": "backdoor.linear_regression",
}

# ---------------------------------------------------------------------------
# Lifespan Trajectory Engine
# ---------------------------------------------------------------------------
TRAJECTORY_PARAMS: Dict[str, Any] = {
    "default_n_clusters": 3,
    "max_polynomial_degree": 3,
    "convergence_tolerance": 1e-4,
    "max_iterations": 200,
}

# ---------------------------------------------------------------------------
# Cognitive Health & Dementia Prevention Engine
# ---------------------------------------------------------------------------
COGNITIVE_RISK_PARAMS: Dict[str, Any] = {
    "risk_threshold": 0.5,
    "n_estimators": 100,
    "max_depth": 6,
    "survival_alpha": 0.05,
}

# ---------------------------------------------------------------------------
# Fairness Audit
# ---------------------------------------------------------------------------
FAIRNESS_PARAMS: Dict[str, Any] = {
    "demographic_parity_tolerance": 0.05,
    "disparate_impact_floor": 0.80,  # 4/5ths rule
}

# ---------------------------------------------------------------------------
# Aggregate config dict (convenient for serialisation / logging)
# ---------------------------------------------------------------------------
ML_CONFIG: Dict[str, Any] = {
    "random_seed": RANDOM_SEED,
    "emotion_coupling_types": EMOTION_COUPLING_TYPES,
    "emotion_volatility_window": EMOTION_VOLATILITY_WINDOW,
    "emotion_coupling_threshold": EMOTION_COUPLING_THRESHOLD,
    "health_engine": HEALTH_ENGINE_PARAMS,
    "trajectory": TRAJECTORY_PARAMS,
    "cognitive_risk": COGNITIVE_RISK_PARAMS,
    "fairness": FAIRNESS_PARAMS,
}


# ---------------------------------------------------------------------------
# Config loader
# ---------------------------------------------------------------------------

def _deep_merge(base: Dict[str, Any], overrides: Dict[str, Any]) -> Dict[str, Any]:
    """Recursively merge *overrides* into *base*, returning a new dict."""
    merged = copy.deepcopy(base)
    for key, value in overrides.items():
        if (
            key in merged
            and isinstance(merged[key], dict)
            and isinstance(value, dict)
        ):
            merged[key] = _deep_merge(merged[key], value)
        else:
            merged[key] = value
    return merged


def _coerce_value(value: str) -> Any:
    """Attempt to coerce a string environment variable to a Python type."""
    if value.lower() in ("true", "yes"):
        return True
    if value.lower() in ("false", "no"):
        return False
    try:
        return int(value)
    except ValueError:
        pass
    try:
        return float(value)
    except ValueError:
        pass
    return value


def _env_overrides(prefix: str = "WELLAB_ML_") -> Dict[str, Any]:
    """Collect environment variables with the given prefix and return as a dict.

    Environment variable names are lowered and split on ``__`` to create
    nested keys.  For example, ``WELLAB_ML_HEALTH_ENGINE__SIGNIFICANCE_LEVEL=0.01``
    becomes ``{"health_engine": {"significance_level": 0.01}}``.
    """
    overrides: Dict[str, Any] = {}

    for env_key, env_val in os.environ.items():
        if not env_key.startswith(prefix):
            continue

        stripped = env_key[len(prefix):].lower()
        parts = stripped.split("__")

        current = overrides
        for part in parts[:-1]:
            current = current.setdefault(part, {})
        current[parts[-1]] = _coerce_value(env_val)

    return overrides


def load_config(path: Optional[str] = None) -> Dict[str, Any]:
    """Load ML configuration with file -> env-override -> defaults merge.

    Parameters
    ----------
    path : str, optional
        Path to a YAML configuration file.  When *None*, only the
        built-in defaults and environment-variable overrides are used.

    Returns
    -------
    dict[str, Any]
        Fully merged configuration dictionary.
    """
    defaults = copy.deepcopy(ML_CONFIG)

    # Layer 1: YAML file (if provided)
    file_config: Dict[str, Any] = {}
    if path is not None:
        try:
            import yaml
        except ImportError as exc:
            raise ImportError(
                "PyYAML is required to load YAML config files. "
                "Install it with: pip install pyyaml"
            ) from exc

        with open(path, "r") as fh:
            loaded = yaml.safe_load(fh)
            if isinstance(loaded, dict):
                file_config = loaded

    # Layer 2: Environment variable overrides
    env_config = _env_overrides()

    # Merge: defaults <- file <- env
    merged = _deep_merge(defaults, file_config)
    merged = _deep_merge(merged, env_config)

    return merged
