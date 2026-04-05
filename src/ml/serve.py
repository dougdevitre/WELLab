"""
FastAPI Serving Layer
=====================
Production API endpoints for the WELLab ML pipeline models.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Pydantic request / response models
# ---------------------------------------------------------------------------


class EmotionalDynamicsRequest(BaseModel):
    """Request body for emotional dynamics prediction."""

    participant_ids: List[str] = Field(..., description="Participant IDs to analyse")
    time: List[float] = Field(..., description="Time points")
    positive_affect: List[float] = Field(..., description="Positive affect scores")
    negative_affect: List[float] = Field(..., description="Negative affect scores")
    coupling_threshold: Optional[float] = Field(None, description="Override coupling threshold")


class EmotionalDynamicsResponse(BaseModel):
    """Response body for emotional dynamics prediction."""

    coupling_results: Dict[str, str]
    n_participants: int
    model_version: str


class CognitiveRiskRequest(BaseModel):
    """Request body for cognitive risk assessment."""

    features: Dict[str, List[float]] = Field(
        ..., description="Feature columns as {name: [values]}"
    )
    participant_ids: Optional[List[str]] = Field(None, description="Optional participant IDs")


class CognitiveRiskResponse(BaseModel):
    """Response body for cognitive risk assessment."""

    risk_probabilities: List[float]
    high_risk_flags: List[bool]
    model_version: str


class TrajectoryRequest(BaseModel):
    """Request body for trajectory clustering."""

    participant_ids: List[str] = Field(..., description="Participant IDs")
    age: List[float] = Field(..., description="Age values")
    wellbeing: List[float] = Field(..., description="Well-being scores")
    n_clusters: Optional[int] = Field(None, description="Override cluster count")


class TrajectoryResponse(BaseModel):
    """Response body for trajectory clustering."""

    assignments: Dict[str, int]
    centroids: List[List[float]]
    n_clusters: int
    model_version: str


class HealthResponse(BaseModel):
    """Health-check response."""

    status: str
    timestamp: str
    models_loaded: Dict[str, bool]


class ModelInfo(BaseModel):
    """Information about a loaded model."""

    name: str
    version: str
    is_loaded: bool


class ModelsResponse(BaseModel):
    """Response listing all available models."""

    models: List[ModelInfo]


# ---------------------------------------------------------------------------
# Application state
# ---------------------------------------------------------------------------

_MODEL_REGISTRY: Dict[str, Any] = {}
_MODEL_VERSIONS: Dict[str, str] = {
    "emotional_dynamics": "1.0.0",
    "cognitive_risk": "1.0.0",
    "trajectory": "1.0.0",
}


def _load_models() -> None:
    """Load models into the registry on startup."""
    import pandas as pd

    from src.ml.cognitive_health import CognitiveRiskModel
    from src.ml.emotional_dynamics import EmotionCouplingAnalyzer
    from src.ml.lifespan_trajectory import TrajectoryAnalyzer

    _MODEL_REGISTRY["emotional_dynamics"] = EmotionCouplingAnalyzer()
    _MODEL_REGISTRY["cognitive_risk"] = CognitiveRiskModel()
    _MODEL_REGISTRY["trajectory"] = TrajectoryAnalyzer()

    logger.info("All models loaded into registry")


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------

app = FastAPI(
    title="WELLab ML API",
    description="Production serving layer for WELLab ML pipeline models.",
    version="1.0.0",
)


@app.on_event("startup")
async def startup_event() -> None:
    """Load models on application startup."""
    _load_models()


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@app.post("/predict/emotional-dynamics", response_model=EmotionalDynamicsResponse)
async def predict_emotional_dynamics(request: EmotionalDynamicsRequest) -> EmotionalDynamicsResponse:
    """Run emotion coupling analysis on provided affect data."""
    import pandas as pd

    from src.ml.exceptions import ModelNotFittedError, SchemaValidationError

    analyzer = _MODEL_REGISTRY.get("emotional_dynamics")
    if analyzer is None:
        raise HTTPException(status_code=503, detail="Emotional dynamics model not loaded")

    try:
        data = pd.DataFrame({
            "participant_id": request.participant_ids,
            "time": request.time,
            "positive_affect": request.positive_affect,
            "negative_affect": request.negative_affect,
        })

        if request.coupling_threshold is not None:
            analyzer.coupling_threshold = request.coupling_threshold

        analyzer.fit(data)

        return EmotionalDynamicsResponse(
            coupling_results=analyzer.coupling_results_,
            n_participants=data["participant_id"].nunique(),
            model_version=_MODEL_VERSIONS["emotional_dynamics"],
        )
    except SchemaValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        logger.exception("Error in emotional dynamics prediction")
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/predict/cognitive-risk", response_model=CognitiveRiskResponse)
async def predict_cognitive_risk(request: CognitiveRiskRequest) -> CognitiveRiskResponse:
    """Run cognitive risk assessment on provided features."""
    import pandas as pd

    from src.ml.exceptions import ModelNotFittedError

    model = _MODEL_REGISTRY.get("cognitive_risk")
    if model is None:
        raise HTTPException(status_code=503, detail="Cognitive risk model not loaded")

    try:
        data = pd.DataFrame(request.features)

        if not model.is_fitted:
            raise ModelNotFittedError("CognitiveRiskModel")

        result = model.predict_risk(data)

        return CognitiveRiskResponse(
            risk_probabilities=result["risk_probability"].tolist(),
            high_risk_flags=result["high_risk"].tolist(),
            model_version=_MODEL_VERSIONS["cognitive_risk"],
        )
    except ModelNotFittedError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except KeyError as exc:
        raise HTTPException(status_code=422, detail=f"Missing feature column: {exc}")
    except Exception as exc:
        logger.exception("Error in cognitive risk prediction")
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/predict/trajectory", response_model=TrajectoryResponse)
async def predict_trajectory(request: TrajectoryRequest) -> TrajectoryResponse:
    """Run trajectory clustering on provided lifespan data."""
    import pandas as pd

    analyzer = _MODEL_REGISTRY.get("trajectory")
    if analyzer is None:
        raise HTTPException(status_code=503, detail="Trajectory model not loaded")

    try:
        data = pd.DataFrame({
            "participant_id": request.participant_ids,
            "age": request.age,
            "wellbeing": request.wellbeing,
        })

        n_clusters = request.n_clusters
        result = analyzer.cluster_trajectories(data, n_clusters=n_clusters)

        return TrajectoryResponse(
            assignments=result["assignments"],
            centroids=result["centroids"],
            n_clusters=result["n_clusters"],
            model_version=_MODEL_VERSIONS["trajectory"],
        )
    except Exception as exc:
        logger.exception("Error in trajectory prediction")
        raise HTTPException(status_code=500, detail=str(exc))


@app.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """Health check with model status."""
    models_loaded = {
        name: name in _MODEL_REGISTRY
        for name in _MODEL_VERSIONS
    }

    return HealthResponse(
        status="healthy",
        timestamp=datetime.now(timezone.utc).isoformat(),
        models_loaded=models_loaded,
    )


@app.get("/models", response_model=ModelsResponse)
async def list_models() -> ModelsResponse:
    """List loaded models with versions."""
    models = []
    for name, version in _MODEL_VERSIONS.items():
        models.append(
            ModelInfo(
                name=name,
                version=version,
                is_loaded=name in _MODEL_REGISTRY,
            )
        )
    return ModelsResponse(models=models)
