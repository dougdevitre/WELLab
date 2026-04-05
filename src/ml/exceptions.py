"""
Custom exceptions for the WELLab ML pipeline.
==============================================
Provides domain-specific error types to replace generic ValueError
and RuntimeError throughout the codebase.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional


class ModelNotFittedError(Exception):
    """Raised when a prediction or inspection method is called before fit()."""

    def __init__(self, model_name: str = "Model") -> None:
        self.model_name = model_name
        super().__init__(
            f"{model_name} has not been fitted yet. Call fit() before using this method."
        )


class SchemaValidationError(Exception):
    """Raised when input data does not conform to the expected schema.

    Attributes
    ----------
    field_errors : dict[str, str]
        Mapping of field name to a human-readable description of the
        validation failure for that field.
    errors : list[str]
        Flat list of all validation error messages.
    """

    def __init__(
        self,
        errors: Optional[List[str]] = None,
        field_errors: Optional[Dict[str, str]] = None,
    ) -> None:
        self.errors: List[str] = errors or []
        self.field_errors: Dict[str, str] = field_errors or {}
        detail = "; ".join(self.errors) if self.errors else str(self.field_errors)
        super().__init__(f"Schema validation failed: {detail}")


class DataDriftError(Exception):
    """Raised when significant data drift is detected between reference and new data.

    Attributes
    ----------
    drifted_features : list[str]
        Names of features that exceeded the drift threshold.
    severity : str
        Overall drift severity (e.g. "low", "moderate", "severe").
    """

    def __init__(
        self,
        drifted_features: Optional[List[str]] = None,
        severity: str = "unknown",
        message: Optional[str] = None,
    ) -> None:
        self.drifted_features: List[str] = drifted_features or []
        self.severity = severity
        msg = message or (
            f"Data drift detected (severity={severity}) in features: "
            f"{self.drifted_features}"
        )
        super().__init__(msg)


class InsufficientDataError(Exception):
    """Raised when there is not enough data to perform the requested analysis.

    Attributes
    ----------
    required : int
        Minimum number of observations needed.
    actual : int
        Number of observations actually provided.
    """

    def __init__(
        self,
        required: int,
        actual: int,
        context: str = "",
    ) -> None:
        self.required = required
        self.actual = actual
        self.context = context
        detail = f" ({context})" if context else ""
        super().__init__(
            f"Insufficient data{detail}: need at least {required} observations, "
            f"got {actual}."
        )


class FairnessViolationError(Exception):
    """Raised when a fairness metric falls below the acceptable threshold.

    Attributes
    ----------
    metric : str
        Name of the fairness metric that was violated.
    value : float
        The computed metric value.
    threshold : float
        The threshold that was not met.
    """

    def __init__(
        self,
        metric: str,
        value: float,
        threshold: float,
    ) -> None:
        self.metric = metric
        self.value = value
        self.threshold = threshold
        super().__init__(
            f"Fairness violation: {metric}={value:.4f} "
            f"(threshold={threshold:.4f})"
        )
