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
