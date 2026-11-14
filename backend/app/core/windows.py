"""Measurement windows: is a window in the record, and which windows are steady enough to analyse.

`check` replaces szykanie_dat.py, which looked for hand-picked 30-minute intervals in the report
files with a tolerance of a few seconds. `suggest` does the picking itself: it scores every window
of the record by how steady it is and returns a set spread over the outdoor temperatures met.
"""
from dataclasses import dataclass

import numpy as np
import pandas as pd


@dataclass
class Coverage:
    start: str
    end: str
    first: str | None          # first sample within tolerance of the window start
    rows: int
    coverage: float            # logged time / window length
    max_gap_s: float
    flags: float               # share of rows with supply/exhaust flags
    compressor: float          # share of rows with setpoint >= min_setpoint
    t3_mean: float | None
    t3_std: float | None
    status: str                # "ok" | "partial" | "missing"


def check(df: pd.DataFrame, start, minutes: float = 30, tolerance_s: float = 2,
          min_setpoint: float = 0.2) -> Coverage:
    t0 = pd.Timestamp(start)
    t1 = t0 + pd.Timedelta(minutes=minutes)
    w = df.loc[t0 - pd.Timedelta(seconds=tolerance_s): t1]
    if w.empty:
        return Coverage(t0.isoformat(), t1.isoformat(), None, 0, 0.0, minutes * 60, 0, 0, None, None, "missing")
    rel = (w.index - t0).total_seconds().to_numpy()
    gaps = np.diff(np.r_[0.0, np.clip(rel, 0, None), minutes * 60])
    max_gap = float(gaps.max())
    step = float(np.median(np.diff(rel))) if len(w) > 1 else 0.0
    covered = float(np.clip(gaps, 0, max(step * 1.5, 1)).sum() / (minutes * 60))
    first_ok = abs((w.index[0] - t0).total_seconds()) <= max(tolerance_s, step)
    t3 = w["t3"]
    status = "ok" if (covered > 0.97 and first_ok and max_gap <= max(10, 3 * step)) else "partial"
    return Coverage(
        start=t0.isoformat(), end=t1.isoformat(),
        first=w.index[0].isoformat() if first_ok else None,
        rows=len(w), coverage=min(covered, 1.0), max_gap_s=max_gap,
        flags=float((w["nawiew"].notna() & w["wywiew"].notna()).mean()),
        compressor=float((w["nast_spr"] >= min_setpoint).mean()),
        t3_mean=float(t3.mean()) if t3.notna().any() else None,
        t3_std=float(t3.std()) if t3.notna().sum() > 1 else None,
        status=status,
    )


@dataclass
class Candidate:
    start: str
    minutes: int
    t3_mean: float
    t3_std: float
    p_std: float               # spread of the compressor power, W
    score: float


def suggest(df: pd.DataFrame, minutes: int = 30, n: int = 8, step_min: int = 5,
            min_setpoint: float = 0.2) -> list[Candidate]:
    """Steady windows: fully logged, flags present, compressor running throughout; the steadiest
    window from each of `n` outdoor-temperature bands, ordered by temperature."""
    m = pd.DataFrame({
        "rows": df["t3"].resample("1min").count(),
        "flags": (df["nawiew"].notna() & df["wywiew"].notna()).resample("1min").min(),
        "running": (df["nast_spr"] >= min_setpoint).resample("1min").min(),
        "t3": df["t3"].resample("1min").mean(),
        "t3_sq": (df["t3"] ** 2).resample("1min").mean(),
        "p": df["Moc_Czynna"].resample("1min").mean(),
    })
    step = float(np.median(np.diff((df.index[:1000] - df.index[0]).total_seconds())))
    expected = 60 / max(step, 1e-3)
    m["ok"] = (m["rows"] >= 0.9 * expected) & (m["flags"] == 1) & (m["running"] == 1)

    roll = m.rolling(minutes, min_periods=minutes)
    ok_all = roll["ok"].sum() == minutes
    t3_mean = roll["t3"].mean()
    t3_std = np.sqrt(np.maximum(roll["t3_sq"].mean() - t3_mean**2, 0))
    p_std = roll["p"].std()
    cand = pd.DataFrame({"t3": t3_mean, "t3_std": t3_std, "p_std": p_std})[ok_all]
    if cand.empty:
        return []
    cand.index = cand.index - pd.Timedelta(minutes=minutes - 1)        # label by the window start
    cand = cand[(cand.index.minute % step_min) == 0]
    cand["score"] = cand["t3_std"] + cand["p_std"] / 200

    edges = np.linspace(cand["t3"].min(), cand["t3"].max() + 1e-9, n + 1)
    picked: list[pd.Timestamp] = []
    for lo, hi in zip(edges[:-1], edges[1:]):
        band = cand[(cand["t3"] >= lo) & (cand["t3"] < hi)].sort_values("score")
        for ts in band.index:
            if all(abs((ts - p).total_seconds()) >= minutes * 60 for p in picked):
                picked.append(ts)
                break
    out = [Candidate(ts.isoformat(), minutes, float(cand.at[ts, "t3"]), float(cand.at[ts, "t3_std"]),
                     float(cand.at[ts, "p_std"]), float(cand.at[ts, "score"])) for ts in picked]
    return sorted(out, key=lambda c: c.t3_mean)
