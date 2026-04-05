"""
Unit tests for the FairnessAuditor.
"""

import json
import os
import tempfile

import numpy as np
import pandas as pd
import pytest

from scripts.fairness_audit import FairnessAuditor, main


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

def _fair_predictions() -> tuple[np.ndarray, np.ndarray]:
    """Return predictions with equal rates across two groups."""
    preds = np.array([1, 0, 1, 0, 1, 0, 1, 0])
    groups = np.array(["A", "A", "A", "A", "B", "B", "B", "B"])
    return preds, groups


def _unfair_predictions() -> tuple[np.ndarray, np.ndarray]:
    """Return predictions with a large disparity between groups."""
    preds = np.array([1, 1, 1, 1, 0, 0, 0, 1])
    groups = np.array(["A", "A", "A", "A", "B", "B", "B", "B"])
    return preds, groups


# ---------------------------------------------------------------------------
# Tests — Demographic Parity
# ---------------------------------------------------------------------------

class TestDemographicParity:
    """Tests for compute_demographic_parity."""

    def test_fair_data_passes(self) -> None:
        preds, groups = _fair_predictions()
        auditor = FairnessAuditor(demographic_parity_tolerance=0.1)
        result = auditor.compute_demographic_parity(preds, groups)
        assert result["passed"] is True
        assert result["max_difference"] <= 0.1

    def test_unfair_data_fails(self) -> None:
        preds, groups = _unfair_predictions()
        auditor = FairnessAuditor(demographic_parity_tolerance=0.05)
        result = auditor.compute_demographic_parity(preds, groups)
        assert result["passed"] is False

    def test_group_rates_sum_correctly(self) -> None:
        preds, groups = _fair_predictions()
        auditor = FairnessAuditor()
        result = auditor.compute_demographic_parity(preds, groups)
        assert set(result["group_rates"].keys()) == {"A", "B"}
        for rate in result["group_rates"].values():
            assert 0.0 <= rate <= 1.0

    def test_single_group(self) -> None:
        preds = np.array([1, 0, 1])
        groups = np.array(["X", "X", "X"])
        auditor = FairnessAuditor()
        result = auditor.compute_demographic_parity(preds, groups)
        assert result["max_difference"] == 0.0
        assert result["passed"] is True


# ---------------------------------------------------------------------------
# Tests — Disparate Impact
# ---------------------------------------------------------------------------

class TestDisparateImpact:
    """Tests for compute_disparate_impact."""

    def test_fair_data_passes(self) -> None:
        preds, groups = _fair_predictions()
        auditor = FairnessAuditor(disparate_impact_floor=0.80)
        result = auditor.compute_disparate_impact(preds, groups)
        assert result["passed"] is True
        assert result["disparate_impact_ratio"] >= 0.80

    def test_unfair_data_fails(self) -> None:
        preds, groups = _unfair_predictions()
        auditor = FairnessAuditor(disparate_impact_floor=0.80)
        result = auditor.compute_disparate_impact(preds, groups)
        assert result["passed"] is False

    def test_all_zeros_trivially_fair(self) -> None:
        preds = np.zeros(6, dtype=int)
        groups = np.array(["A", "A", "A", "B", "B", "B"])
        auditor = FairnessAuditor()
        result = auditor.compute_disparate_impact(preds, groups)
        assert result["disparate_impact_ratio"] == 1.0

    def test_ratio_bounds(self) -> None:
        preds, groups = _unfair_predictions()
        auditor = FairnessAuditor()
        result = auditor.compute_disparate_impact(preds, groups)
        assert 0.0 <= result["disparate_impact_ratio"] <= 1.0


# ---------------------------------------------------------------------------
# Tests — Report generation
# ---------------------------------------------------------------------------

class TestReportGeneration:
    """Tests for generate_report."""

    def test_report_contains_model_name(self) -> None:
        auditor = FairnessAuditor()
        report = auditor.generate_report(
            model_name="TestModel",
            audit_results={
                "demographic_parity": {"passed": True, "group_rates": {}, "max_difference": 0.0, "tolerance": 0.05},
                "disparate_impact": {"passed": True, "group_rates": {}, "disparate_impact_ratio": 1.0, "floor": 0.80},
            },
        )
        assert "TestModel" in report

    def test_report_writes_json(self) -> None:
        auditor = FairnessAuditor()
        with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as tmp:
            tmp_path = tmp.name

        try:
            auditor.generate_report(
                model_name="JSONTest",
                audit_results={
                    "demographic_parity": {"passed": True, "group_rates": {}, "max_difference": 0.0, "tolerance": 0.05},
                    "disparate_impact": {"passed": True, "group_rates": {}, "disparate_impact_ratio": 1.0, "floor": 0.80},
                },
                output_path=tmp_path,
            )
            with open(tmp_path) as fh:
                payload = json.load(fh)
            assert payload["model_name"] == "JSONTest"
            assert payload["overall_passed"] is True
        finally:
            os.unlink(tmp_path)


# ---------------------------------------------------------------------------
# Tests — CLI
# ---------------------------------------------------------------------------

class TestCLI:
    """Tests for the argparse-based CLI entry-point."""

    def test_cli_happy_path(self, capsys: pytest.CaptureFixture[str]) -> None:
        with tempfile.NamedTemporaryFile(
            suffix=".csv", mode="w", delete=False
        ) as tmp:
            df = pd.DataFrame({
                "prediction": [1, 0, 1, 0, 1, 0],
                "gender": ["M", "M", "M", "F", "F", "F"],
            })
            df.to_csv(tmp.name, index=False)
            tmp_path = tmp.name

        try:
            main([
                "--predictions", tmp_path,
                "--protected-attribute", "gender",
                "--model-name", "CLITest",
            ])
            captured = capsys.readouterr()
            assert "CLITest" in captured.out
            assert "FAIRNESS AUDIT REPORT" in captured.out
        finally:
            os.unlink(tmp_path)

    def test_cli_missing_column_exits(self) -> None:
        with tempfile.NamedTemporaryFile(
            suffix=".csv", mode="w", delete=False
        ) as tmp:
            pd.DataFrame({"x": [1]}).to_csv(tmp.name, index=False)
            tmp_path = tmp.name

        try:
            with pytest.raises(SystemExit):
                main([
                    "--predictions", tmp_path,
                    "--protected-attribute", "gender",
                ])
        finally:
            os.unlink(tmp_path)


# ---------------------------------------------------------------------------
# Tests -- Equalized Odds
# ---------------------------------------------------------------------------

class TestEqualizedOdds:
    """Tests for equalized_odds."""

    def test_equal_tpr_fpr_passes(self) -> None:
        preds = np.array([1, 0, 1, 0, 1, 0, 1, 0])
        labels = np.array([1, 0, 1, 0, 1, 0, 1, 0])
        groups = np.array(["A", "A", "A", "A", "B", "B", "B", "B"])
        auditor = FairnessAuditor(demographic_parity_tolerance=0.1)
        result = auditor.equalized_odds(preds, labels, groups)
        assert result["passed"] is True
        assert result["max_tpr_difference"] <= 0.1
        assert result["max_fpr_difference"] <= 0.1

    def test_unequal_tpr_fails(self) -> None:
        # Group A: all correct, Group B: all wrong predictions for positives
        preds = np.array([1, 1, 0, 0, 0, 0, 0, 0])
        labels = np.array([1, 1, 0, 0, 1, 1, 0, 0])
        groups = np.array(["A", "A", "A", "A", "B", "B", "B", "B"])
        auditor = FairnessAuditor(demographic_parity_tolerance=0.05)
        result = auditor.equalized_odds(preds, labels, groups)
        assert result["passed"] is False
        assert result["max_tpr_difference"] > 0.05

    def test_returns_per_group_rates(self) -> None:
        preds = np.array([1, 0, 1, 0])
        labels = np.array([1, 0, 1, 0])
        groups = np.array(["A", "A", "B", "B"])
        auditor = FairnessAuditor()
        result = auditor.equalized_odds(preds, labels, groups)
        assert "group_tpr" in result
        assert "group_fpr" in result
        assert set(result["group_tpr"].keys()) == {"A", "B"}


# ---------------------------------------------------------------------------
# Tests -- Calibration by Group
# ---------------------------------------------------------------------------

class TestCalibrationByGroup:
    """Tests for calibration_by_group."""

    def test_well_calibrated_returns_low_ece(self) -> None:
        rng = np.random.RandomState(42)
        n = 200
        probs = rng.uniform(0, 1, n)
        labels = (rng.uniform(0, 1, n) < probs).astype(int)
        groups = np.array(["A"] * 100 + ["B"] * 100)
        auditor = FairnessAuditor()
        result = auditor.calibration_by_group(probs, labels, groups, n_bins=5)
        assert "group_calibration" in result
        for g_name, g_data in result["group_calibration"].items():
            assert "expected_calibration_error" in g_data
            # Well-calibrated data should have relatively low ECE
            assert g_data["expected_calibration_error"] < 0.3

    def test_max_ece_difference_computed(self) -> None:
        probs = np.array([0.1, 0.9, 0.1, 0.9, 0.5, 0.5, 0.5, 0.5])
        labels = np.array([0, 1, 0, 1, 1, 1, 0, 0])
        groups = np.array(["A", "A", "A", "A", "B", "B", "B", "B"])
        auditor = FairnessAuditor()
        result = auditor.calibration_by_group(probs, labels, groups)
        assert "max_ece_difference" in result
        assert isinstance(result["max_ece_difference"], float)

    def test_single_group_calibration(self) -> None:
        probs = np.array([0.2, 0.8, 0.5])
        labels = np.array([0, 1, 1])
        groups = np.array(["X", "X", "X"])
        auditor = FairnessAuditor()
        result = auditor.calibration_by_group(probs, labels, groups)
        assert "X" in result["group_calibration"]
        assert result["max_ece_difference"] == 0.0


# ---------------------------------------------------------------------------
# Tests -- Intersectional Audit
# ---------------------------------------------------------------------------

class TestIntersectionalAudit:
    """Tests for intersectional_audit."""

    def test_intersectional_groups_created(self) -> None:
        preds = np.array([1, 0, 1, 0, 1, 0, 1, 0])
        auditor = FairnessAuditor()
        result = auditor.intersectional_audit(
            preds,
            protected_attributes=["gender", "race"],
            attribute_arrays={
                "gender": np.array(["M", "M", "F", "F", "M", "M", "F", "F"]),
                "race": np.array(["W", "B", "W", "B", "W", "B", "W", "B"]),
            },
        )
        assert "intersections" in result
        # Should have intersections like M_x_W, M_x_B, F_x_W, F_x_B
        assert len(result["intersections"]) == 4

    def test_intersectional_fair_data_passes(self) -> None:
        preds = np.array([1, 0, 1, 0, 1, 0, 1, 0])
        auditor = FairnessAuditor(disparate_impact_floor=0.80)
        result = auditor.intersectional_audit(
            preds,
            protected_attributes=["group"],
            attribute_arrays={"group": np.array(["A", "A", "B", "B", "A", "A", "B", "B"])},
        )
        assert result["passed"] is True


# ---------------------------------------------------------------------------
# Tests -- Bootstrap Confidence Intervals
# ---------------------------------------------------------------------------

class TestBootstrapCI:
    """Tests for confidence interval methods."""

    def test_dp_with_ci_has_interval(self) -> None:
        preds, groups = _fair_predictions()
        auditor = FairnessAuditor()
        result = auditor.compute_demographic_parity_with_ci(
            preds, groups, n_bootstrap=100,
        )
        assert "max_difference_ci" in result
        ci_low, ci_high = result["max_difference_ci"]
        assert ci_low <= ci_high

    def test_di_with_ci_has_interval(self) -> None:
        preds, groups = _fair_predictions()
        auditor = FairnessAuditor()
        result = auditor.compute_disparate_impact_with_ci(
            preds, groups, n_bootstrap=100,
        )
        assert "disparate_impact_ratio_ci" in result
        ci_low, ci_high = result["disparate_impact_ratio_ci"]
        assert ci_low <= ci_high
