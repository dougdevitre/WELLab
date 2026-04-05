"""
WELLab ML Pipeline
===================
AI-Enabled Research & Impact Platform for the Well-Being and Emotion
across the Lifespan Lab (WELLab).

Submodules
----------
- emotional_dynamics : IDELS-based emotion coupling analysis
- health_engine      : Causal behavioral & physiological health modeling
- lifespan_trajectory: Growth-curve and trajectory clustering across the lifespan
- cognitive_health   : Cognitive risk prediction and dementia prevention
- drift              : Data drift detection between reference and production data
- serve              : FastAPI serving layer for model predictions
- exceptions         : Custom exception types for the ML pipeline
- utils              : Shared data-loading and reproducibility helpers
- config             : ML configuration constants
"""

from src.ml.config import ML_CONFIG  # noqa: F401

__all__ = [
    "emotional_dynamics",
    "health_engine",
    "lifespan_trajectory",
    "cognitive_health",
    "drift",
    "serve",
    "exceptions",
    "utils",
    "config",
]
