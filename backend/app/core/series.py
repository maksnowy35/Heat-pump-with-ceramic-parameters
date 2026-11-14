"""Helpers to send time series to the browser: bucketing long records and JSON-safe lists."""
import math

import numpy as np
import pandas as pd


def bucket(df: pd.DataFrame, max_points: int = 1500) -> pd.DataFrame:
    """Mean over equal time buckets so that at most ~max_points remain.
    Empty buckets (logging gaps) stay as NaN rows, which break the lines in the charts."""
    if len(df) <= max_points:
        return df
    span = (df.index[-1] - df.index[0]).total_seconds()
    step = max(1, math.ceil(span / max_points))
    return df.resample(f"{step}s").mean()


def values(s, digits: int = 4) -> list[float | None]:
    a = np.asarray(s, dtype=float)
    return [None if not math.isfinite(v) else round(float(v), digits) for v in a]


def minutes_from(index: pd.DatetimeIndex, origin: pd.Timestamp) -> list[float]:
    return values((index - origin).total_seconds() / 60, 4)
