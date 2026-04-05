"""
Unit tests for the EmotionCouplingAnalyzer.
"""

import numpy as np
import pandas as pd
import pytest

from src.ml.emotional_dynamics import EmotionCouplingAnalyzer
from src.ml.exceptions import ModelNotFittedError, SchemaValidationError


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

def _make_affect_data(
    n_participants: int = 3,
    n_timepoints: int = 50,
    coupling: str = "positive",
    seed: int = 42,
) -> pd.DataFrame:
    """Generate synthetic longitudinal affect data."""
    rng = np.random.RandomState(seed)
    rows = []
    for i in range(n_participants):
        pid = f"P{i:03d}"
        pa = rng.randn(n_timepoints).cumsum()
        if coupling == "positive":
            na = pa + rng.randn(n_timepoints) * 0.3
        elif coupling == "negative":
            na = -pa + rng.randn(n_timepoints) * 0.3
        else:
            na = rng.randn(n_timepoints).cumsum()
        for t in range(n_timepoints):
            rows.append({
                "participant_id": pid,
                "time": float(t),
                "positive_affect": pa[t],
                "negative_affect": na[t],
            })
    return pd.DataFrame(rows)


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestEmotionCouplingAnalyzer:
    """Tests for EmotionCouplingAnalyzer."""

    def test_init_defaults(self) -> None:
        analyzer = EmotionCouplingAnalyzer()
        assert analyzer.is_fitted is False
        assert analyzer.coupling_results_ == {}
        assert analyzer.coupling_threshold > 0

    def test_fit_returns_self(self) -> None:
        data = _make_affect_data()
        analyzer = EmotionCouplingAnalyzer()
        result = analyzer.fit(data)
        assert result is analyzer
        assert analyzer.is_fitted is True

    def test_fit_populates_coupling_results(self) -> None:
        data = _make_affect_data(n_participants=4)
        analyzer = EmotionCouplingAnalyzer()
        analyzer.fit(data)
        assert len(analyzer.coupling_results_) == 4

    def test_positive_coupling_detected(self) -> None:
        data = _make_affect_data(coupling="positive", n_timepoints=100)
        analyzer = EmotionCouplingAnalyzer(coupling_threshold=0.2)
        analyzer.fit(data)
        # At least one participant should be classified as positive or complex
        types = set(analyzer.coupling_results_.values())
        assert types & {"positive", "complex"}, f"Expected positive coupling, got {types}"

    def test_negative_coupling_detected(self) -> None:
        data = _make_affect_data(coupling="negative", n_timepoints=100)
        analyzer = EmotionCouplingAnalyzer(coupling_threshold=0.2)
        analyzer.fit(data)
        types = set(analyzer.coupling_results_.values())
        assert types & {"negative", "complex"}, f"Expected negative coupling, got {types}"

    def test_decoupled_detected(self) -> None:
        data = _make_affect_data(coupling="decoupled", n_timepoints=100)
        analyzer = EmotionCouplingAnalyzer(coupling_threshold=0.5)
        analyzer.fit(data)
        # Most participants should be decoupled when threshold is high
        decoupled_count = sum(
            1 for v in analyzer.coupling_results_.values() if v == "decoupled"
        )
        assert decoupled_count >= 1

    def test_predict_coupling_type_before_fit_raises(self) -> None:
        analyzer = EmotionCouplingAnalyzer()
        with pytest.raises(ModelNotFittedError):
            analyzer.predict_coupling_type("P000")

    def test_predict_coupling_type_unknown_participant(self) -> None:
        data = _make_affect_data(n_participants=1)
        analyzer = EmotionCouplingAnalyzer()
        analyzer.fit(data)
        result = analyzer.predict_coupling_type("NONEXISTENT")
        assert result == "decoupled"

    def test_compute_volatility_shape(self) -> None:
        analyzer = EmotionCouplingAnalyzer(volatility_window=5)
        ts = np.random.randn(20)
        vol = analyzer.compute_volatility(ts)
        assert vol.shape == ts.shape

    def test_compute_volatility_values_nonnegative(self) -> None:
        analyzer = EmotionCouplingAnalyzer(volatility_window=3)
        ts = np.array([1.0, 2.0, 1.5, 3.0, 2.5, 4.0])
        vol = analyzer.compute_volatility(ts)
        assert np.all(vol[~np.isnan(vol)] >= 0)

    def test_fit_rejects_bad_schema(self) -> None:
        bad_data = pd.DataFrame({"x": [1, 2], "y": [3, 4]})
        analyzer = EmotionCouplingAnalyzer()
        with pytest.raises(SchemaValidationError):
            analyzer.fit(bad_data)

    def test_coupling_types_constant(self) -> None:
        assert "positive" in EmotionCouplingAnalyzer.COUPLING_TYPES
        assert "negative" in EmotionCouplingAnalyzer.COUPLING_TYPES
        assert "decoupled" in EmotionCouplingAnalyzer.COUPLING_TYPES
        assert "complex" in EmotionCouplingAnalyzer.COUPLING_TYPES
