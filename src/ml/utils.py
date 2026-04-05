"""
Shared utilities for the WELLab ML pipeline.

Provides reproducibility helpers, data-loading stubs, and schema
validation used by every engine module.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd

from src.ml.config import RANDOM_SEED

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Reproducibility
# ---------------------------------------------------------------------------

def set_reproducible_seed(seed: int = RANDOM_SEED) -> None:
    """Set random seeds for numpy (and, when available, sklearn and torch).

    Parameters
    ----------
    seed : int
        The seed value to use across all RNGs.
    """
    np.random.seed(seed)
    logger.info("NumPy random seed set to %d", seed)

    # TODO: Add torch.manual_seed(seed) when PyTorch is added as a dependency
    # TODO: Add tf.random.set_seed(seed) if TensorFlow is ever used


# ---------------------------------------------------------------------------
# Data loading
# ---------------------------------------------------------------------------

def load_participant_data(
    participant_id: str,
    data_dir: Optional[str] = None,
) -> pd.DataFrame:
    """Load longitudinal data for a single participant.

    Parameters
    ----------
    participant_id : str
        Unique identifier for the participant (e.g. ``"WELLab-0042"``).
    data_dir : str, optional
        Root directory containing participant CSVs.  Falls back to the
        project default when *None*.

    Returns
    -------
    pd.DataFrame
        DataFrame indexed by measurement occasion with all recorded
        variables for the requested participant.

    Raises
    ------
    FileNotFoundError
        If no data file exists for *participant_id*.
    """
    if data_dir is None:
        # TODO: Replace with actual default data path from project config
        data_dir = "data/participants"

    file_path = f"{data_dir}/{participant_id}.csv"

    # TODO: Implement actual file I/O with appropriate error handling
    #       and column-type coercion for date/time fields.
    logger.info("Loading data for participant %s from %s", participant_id, file_path)

    try:
        df = pd.read_csv(file_path, parse_dates=True)
    except FileNotFoundError:
        logger.error("Data file not found: %s", file_path)
        raise

    return df


# ---------------------------------------------------------------------------
# Schema validation
# ---------------------------------------------------------------------------

def validate_data_schema(
    data: pd.DataFrame,
    schema: Dict[str, Any],
) -> List[str]:
    """Validate that *data* conforms to the expected *schema*.

    Parameters
    ----------
    data : pd.DataFrame
        The DataFrame to validate.
    schema : dict
        Mapping of ``{column_name: expected_dtype_string}``.
        Example: ``{"age": "float64", "participant_id": "object"}``.

    Returns
    -------
    list[str]
        A list of human-readable validation error messages.  An empty
        list signals that the data passed all checks.
    """
    errors: List[str] = []

    # Check for required columns
    missing_cols = set(schema.keys()) - set(data.columns)
    if missing_cols:
        errors.append(f"Missing required columns: {sorted(missing_cols)}")

    # Check dtype compatibility for present columns
    # Allow compatible dtype aliases (e.g. "str" matches "object")
    _COMPATIBLE = {
        "object": {"object", "str", "string"},
        "str": {"object", "str", "string"},
        "string": {"object", "str", "string"},
    }

    for col, expected_dtype in schema.items():
        if col not in data.columns:
            continue
        actual_dtype = str(data[col].dtype)
        compatible_set = _COMPATIBLE.get(expected_dtype, {expected_dtype})
        if actual_dtype not in compatible_set:
            errors.append(
                f"Column '{col}' has dtype '{actual_dtype}', "
                f"expected '{expected_dtype}'"
            )

    # Check for completely empty columns
    for col in data.columns:
        if data[col].isna().all():
            errors.append(f"Column '{col}' is entirely NaN")

    if errors:
        logger.warning("Schema validation found %d issue(s)", len(errors))
    else:
        logger.info("Schema validation passed")

    return errors
