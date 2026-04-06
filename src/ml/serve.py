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


class CausalAnalysisRequest(BaseModel):
    """Request body for causal health analysis."""

    treatment: str = Field(..., description="Treatment/exposure variable name")
    outcome: str = Field(..., description="Outcome variable name")
    confounders: List[str] = Field(default_factory=list, description="Confounder variable names")
    data: Dict[str, List[float]] = Field(..., description="Data columns as {name: [values]}")


class CausalAnalysisResponse(BaseModel):
    """Response body for causal health analysis."""

    treatment: str
    outcome: str
    estimate: float
    confidence_interval: List[float]
    refutation_passed: Optional[bool]
    method: str
    model_version: str


class BidirectionalRequest(BaseModel):
    """Request body for bidirectional wellbeing-health analysis."""

    participant_ids: List[str] = Field(..., description="Participant IDs")
    wellbeing_scores: List[float] = Field(..., description="Wellbeing scores")
    health_scores: List[float] = Field(..., description="Health scores")
    waves: List[int] = Field(..., description="Measurement wave identifiers")


class BidirectionalResponse(BaseModel):
    """Response body for bidirectional analysis."""

    wellbeing_to_health: CausalAnalysisResponse
    health_to_wellbeing: CausalAnalysisResponse
    model_version: str


class VolatilityRequest(BaseModel):
    """Request body for volatility computation."""

    participant_id: str = Field(..., description="Participant ID")
    time_series: List[float] = Field(..., description="Affect scores over time")
    window: Optional[int] = Field(None, description="Rolling window size")


class VolatilityResponse(BaseModel):
    """Response body for volatility computation."""

    participant_id: str
    volatility_scores: List[Optional[float]]
    mean_volatility: float
    model_version: str


class DriftCheckRequest(BaseModel):
    """Request body for data drift detection."""

    reference_data: Dict[str, List[float]] = Field(..., description="Reference data columns")
    new_data: Dict[str, List[float]] = Field(..., description="New data columns to check")
    categorical_columns: List[str] = Field(default_factory=list)


class DriftCheckResponse(BaseModel):
    """Response body for drift detection."""

    overall_drifted: bool
    severity: str
    drifted_features: List[str]
    summary: Dict[str, Any]


class PipelineRetrainRequest(BaseModel):
    """Request to trigger model retraining (continuous learning loop)."""

    module: str = Field(..., description="Module to retrain: emotional_dynamics | cognitive_risk | trajectory | health")
    data: Dict[str, List[Any]] = Field(..., description="Training data columns")
    target_col: Optional[str] = Field(None, description="Target column for supervised models")
    config_overrides: Dict[str, Any] = Field(default_factory=dict)


class PipelineRetrainResponse(BaseModel):
    """Response from model retraining."""

    module: str
    status: str
    metrics: Dict[str, Any]
    model_version: str
    timestamp: str


class HealthCheckResponse(BaseModel):
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
    "health": "1.0.0",
}


def _load_models() -> None:
    """Load models into the registry on startup."""
    from src.ml.cognitive_health import CognitiveRiskModel
    from src.ml.emotional_dynamics import EmotionCouplingAnalyzer
    from src.ml.health_engine import CausalHealthAnalyzer
    from src.ml.lifespan_trajectory import TrajectoryAnalyzer

    _MODEL_REGISTRY["emotional_dynamics"] = EmotionCouplingAnalyzer()
    _MODEL_REGISTRY["cognitive_risk"] = CognitiveRiskModel()
    _MODEL_REGISTRY["trajectory"] = TrajectoryAnalyzer()
    _MODEL_REGISTRY["health"] = CausalHealthAnalyzer()

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

    from src.ml.exceptions import SchemaValidationError

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


@app.post("/predict/causal-analysis", response_model=CausalAnalysisResponse)
async def predict_causal_analysis(request: CausalAnalysisRequest) -> CausalAnalysisResponse:
    """Run causal health analysis between treatment and outcome variables."""
    import pandas as pd

    analyzer = _MODEL_REGISTRY.get("health")
    if analyzer is None:
        raise HTTPException(status_code=503, detail="Health engine model not loaded")

    try:
        data = pd.DataFrame(request.data)

        result = analyzer.estimate_causal_effect(
            treatment=request.treatment,
            outcome=request.outcome,
            confounders=request.confounders,
            data=data,
        )

        return CausalAnalysisResponse(
            treatment=result.treatment,
            outcome=result.outcome,
            estimate=result.estimate,
            confidence_interval=list(result.confidence_interval),
            refutation_passed=result.refutation_passed,
            method=result.method,
            model_version=_MODEL_VERSIONS["health"],
        )
    except Exception as exc:
        logger.exception("Error in causal analysis")
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/predict/bidirectional", response_model=BidirectionalResponse)
async def predict_bidirectional(request: BidirectionalRequest) -> BidirectionalResponse:
    """Run bidirectional wellbeing-health causal analysis."""
    import pandas as pd

    analyzer = _MODEL_REGISTRY.get("health")
    if analyzer is None:
        raise HTTPException(status_code=503, detail="Health engine model not loaded")

    try:
        wellbeing_df = pd.DataFrame({
            "participant_id": request.participant_ids,
            "wave": request.waves,
            "wellbeing_score": request.wellbeing_scores,
        })
        health_df = pd.DataFrame({
            "participant_id": request.participant_ids,
            "wave": request.waves,
            "health_score": request.health_scores,
        })

        results = analyzer.bidirectional_analysis(wellbeing_df, health_df)

        def _to_response(r: "Any") -> CausalAnalysisResponse:
            return CausalAnalysisResponse(
                treatment=r.treatment,
                outcome=r.outcome,
                estimate=r.estimate,
                confidence_interval=list(r.confidence_interval),
                refutation_passed=r.refutation_passed,
                method=r.method,
                model_version=_MODEL_VERSIONS["health"],
            )

        return BidirectionalResponse(
            wellbeing_to_health=_to_response(results["wellbeing_to_health"]),
            health_to_wellbeing=_to_response(results["health_to_wellbeing"]),
            model_version=_MODEL_VERSIONS["health"],
        )
    except Exception as exc:
        logger.exception("Error in bidirectional analysis")
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/predict/volatility", response_model=VolatilityResponse)
async def predict_volatility(request: VolatilityRequest) -> VolatilityResponse:
    """Compute emotional volatility for a time series."""
    import numpy as np

    analyzer = _MODEL_REGISTRY.get("emotional_dynamics")
    if analyzer is None:
        raise HTTPException(status_code=503, detail="Emotional dynamics model not loaded")

    try:
        if request.window is not None:
            analyzer.volatility_window = request.window

        series = np.array(request.time_series)
        volatility = analyzer.compute_volatility(series)

        scores = [None if np.isnan(v) else float(v) for v in volatility]
        valid_scores = [s for s in scores if s is not None]
        mean_vol = float(np.mean(valid_scores)) if valid_scores else 0.0

        return VolatilityResponse(
            participant_id=request.participant_id,
            volatility_scores=scores,
            mean_volatility=mean_vol,
            model_version=_MODEL_VERSIONS["emotional_dynamics"],
        )
    except Exception as exc:
        logger.exception("Error in volatility computation")
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/pipeline/drift-check", response_model=DriftCheckResponse)
async def check_drift(request: DriftCheckRequest) -> DriftCheckResponse:
    """Check for data drift between reference and new data."""
    import pandas as pd

    from src.ml.drift import DataDriftDetector

    try:
        ref_df = pd.DataFrame(request.reference_data)
        new_df = pd.DataFrame(request.new_data)

        detector = DataDriftDetector(
            categorical_columns=request.categorical_columns,
        )
        detector.fit(ref_df)
        report = detector.detect(new_df)

        return DriftCheckResponse(
            overall_drifted=report.overall_drifted,
            severity=report.severity,
            drifted_features=report.drifted_features,
            summary=report.summary,
        )
    except Exception as exc:
        logger.exception("Error in drift detection")
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/pipeline/retrain", response_model=PipelineRetrainResponse)
async def retrain_model(request: PipelineRetrainRequest) -> PipelineRetrainResponse:
    """Retrain a model with new data (continuous learning loop)."""
    import pandas as pd

    valid_modules = list(_MODEL_VERSIONS.keys())
    if request.module not in valid_modules:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid module: {request.module}. Must be one of {valid_modules}",
        )

    model = _MODEL_REGISTRY.get(request.module)
    if model is None:
        raise HTTPException(status_code=503, detail=f"{request.module} model not loaded")

    try:
        data = pd.DataFrame(request.data)
        metrics: Dict[str, Any] = {}

        if request.module == "emotional_dynamics":
            model.fit(data)
            metrics = {
                "n_participants": data["participant_id"].nunique() if "participant_id" in data.columns else 0,
                "coupling_results": model.coupling_results_,
            }

        elif request.module == "cognitive_risk":
            target = request.target_col or "cognitive_decline"
            model.fit(data, target_col=target)
            metrics = {
                "n_samples": len(data),
                "n_features": len(model._feature_names),
                "is_fitted": model.is_fitted,
            }

        elif request.module == "trajectory":
            summary = model.fit_growth_curves(data)
            metrics = summary

        elif request.module == "health":
            result = model.run_longitudinal_regression(data)
            metrics = result

        # Bump version patch number
        current = _MODEL_VERSIONS[request.module]
        parts = current.split(".")
        parts[2] = str(int(parts[2]) + 1)
        _MODEL_VERSIONS[request.module] = ".".join(parts)

        return PipelineRetrainResponse(
            module=request.module,
            status="retrained",
            metrics=metrics,
            model_version=_MODEL_VERSIONS[request.module],
            timestamp=datetime.now(timezone.utc).isoformat(),
        )
    except Exception as exc:
        logger.exception("Error in model retraining")
        raise HTTPException(status_code=500, detail=str(exc))


@app.get("/health", response_model=HealthCheckResponse)
async def health_check() -> HealthCheckResponse:
    """Health check with model status."""
    models_loaded = {
        name: name in _MODEL_REGISTRY
        for name in _MODEL_VERSIONS
    }

    return HealthCheckResponse(
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
