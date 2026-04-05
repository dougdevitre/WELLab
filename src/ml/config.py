"""
ML configuration constants for the WELLab platform.

Central location for random seeds, default model hyper-parameters,
decision thresholds, and data-schema definitions used across all
pipeline modules.
"""

from typing import Dict, Any

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
