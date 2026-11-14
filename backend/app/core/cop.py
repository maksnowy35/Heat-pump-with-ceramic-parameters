"""Coefficient of performance from the logger data.

Heat is counted only in the supply half-cycle, electrical energy over the whole cycle:

    Q = flow * (i_2 - i_3) * dt          (supply, compressor setpoint > 0)
    W = P_comp * dt  [+ P_aux * dt]       (supply or exhaust, setpoint > 0)

Two views, as in the original scripts:
  * blocks      - Q and W summed in 2-minute blocks (one supply + one exhaust half-cycle),
                  COP per block with and without the constant fan/automation power;
  * cumulative  - running sums from the first row, COP = sum(Q) / sum(W), smoothed.
"""
from dataclasses import dataclass

import numpy as np
import pandas as pd


@dataclass(frozen=True)
class CopSettings:
    flow: float = 0.389           # factor in Q = flow * delta_i; the scripts use 0.389
    aux_kw: float = 0.45          # fan + automation [kW]
    block: str = "2min"
    min_setpoint: float = 0.20    # blocks with max setpoint below this are not trusted
    cop_min: float = 1.5
    cop_max: float = 12.0
    smooth: int = 10              # rolling window (samples) for the cumulative COP


def _masks(df: pd.DataFrame) -> tuple[pd.Series, pd.Series]:
    running = df["nast_spr"] > 0
    supply = (df["nawiew"] == 1) & (df["wywiew"] == 0)
    active = (df["nawiew"] == 1) | (df["wywiew"] == 1)
    heat = running & supply & df["delta_i"].notna()
    power = running & active & df["Moc_Czynna"].notna()
    return heat, power


def _fill_invalid(values: pd.Series, valid: pd.Series) -> pd.Series:
    """Invalid blocks are drawn at the level of the previous (or next) valid one."""
    return values.where(valid).ffill().bfill()


def blocks(df: pd.DataFrame, s: CopSettings = CopSettings()) -> pd.DataFrame:
    """COP in clock-aligned blocks (cop_blok30min_nowszy.py)."""
    heat, power = _masks(df)
    w = pd.DataFrame(index=df.index)
    w["Q"] = np.where(heat, s.flow * df["delta_i"] * df["dt_h"], 0.0)          # kWh
    w["W"] = np.where(power, df["Moc_Czynna"] / 1000.0 * df["dt_h"], 0.0)       # kWh
    w["W_total"] = w["W"] + np.where(power, s.aux_kw * df["dt_h"], 0.0)
    w["nast_spr"] = df["nast_spr"]
    w["P"] = df["Moc_Czynna"]
    w["t3"] = df["t3"]
    w["span"] = df["dt_h"].clip(upper=60 / 3600)

    b = w.resample(s.block).agg({"Q": "sum", "W": "sum", "W_total": "sum", "nast_spr": "max",
                                 "P": "mean", "t3": "mean", "span": "sum"})
    b = b.dropna(subset=["nast_spr"])
    # blocks cut by the window edges (or a gap) are drawn, but left out of the averages
    b["complete"] = b["span"] * 3600 >= 0.9 * pd.Timedelta(s.block).total_seconds()
    b["cop"] = (b["Q"] / b["W"]).where(b["W"] > 0)
    b["cop_total"] = (b["Q"] / b["W_total"]).where(b["W_total"] > 0)

    trusted = b["nast_spr"] >= s.min_setpoint
    b["valid"] = trusted & b["cop"].between(s.cop_min, s.cop_max)
    b["valid_total"] = trusted & b["cop_total"].between(s.cop_min, s.cop_max)
    b["cop_plot"] = _fill_invalid(b["cop"], b["valid"])
    b["cop_total_plot"] = _fill_invalid(b["cop_total"], b["valid_total"])
    b["minutes"] = (b.index - b.index[0]).total_seconds() / 60 if len(b) else []
    return b


def block_summary(b: pd.DataFrame) -> dict:
    """Means over the complete, trusted blocks."""
    v, vt = b[b["valid"] & b["complete"]], b[b["valid_total"] & b["complete"]]
    return {
        "blocks": int(len(b)),
        "valid": int(len(vt)),
        "cop": float(v["cop"].mean()) if len(v) else None,
        "cop_total": float(vt["cop_total"].mean()) if len(vt) else None,
        # ratio of sums over the trusted blocks: the energy-weighted COP of the window
        "cop_total_energy": float(vt["Q"].sum() / vt["W_total"].sum()) if len(vt) else None,
        "p_comp": float(b["P"].mean()) if len(b) else None,
        "t_out": float(b["t3"].mean()) if len(b) else None,
    }


def cumulative(df: pd.DataFrame, s: CopSettings = CopSettings()) -> pd.DataFrame:
    """Running COP from the first row (nowy_skumulowane4.py / skumulowany_5najnowszy.py).

    As in those scripts, the constant power is added on exhaust rows only.
    """
    heat, power = _masks(df)
    q = np.where(heat, s.flow * df["delta_i"] * df["dt_h"], 0.0)
    p = df["Moc_Czynna"] / 1000.0
    w_total = np.where(power, (p + (df["wywiew"] == 1) * s.aux_kw) * df["dt_h"], 0.0)
    w = np.where(power, p * df["dt_h"], 0.0)

    out = pd.DataFrame(index=df.index)
    out["hours"] = (df.index - df.index[0]).total_seconds() / 3600
    q_sum = np.cumsum(q)
    out["cop_total"] = q_sum / pd.Series(np.cumsum(w_total), index=df.index).replace(0, np.nan)
    out["cop"] = q_sum / pd.Series(np.cumsum(w), index=df.index).replace(0, np.nan)
    roll = dict(window=s.smooth, min_periods=1, center=True)
    out["cop_total_smooth"] = out["cop_total"].rolling(**roll).mean()
    out["cop_smooth"] = out["cop"].rolling(**roll).mean()
    for c in ("t3", "p_ssania", "p_tloczenia"):
        out[c] = df[c].rolling(**roll).mean()
    out["P"] = df["Moc_Czynna"]
    return out


def off_segments(df: pd.DataFrame, min_hours: float = 2.0) -> list[tuple[pd.Timestamp, pd.Timestamp]]:
    """Runs with zero compressor power longer than `min_hours` (drawn dashed in the scripts)."""
    off = (df["Moc_Czynna"] == 0).to_numpy()
    if not len(off):
        return []
    edges = np.flatnonzero(np.diff(off.astype(int))) + 1
    starts = np.r_[0, edges]
    ends = np.r_[edges - 1, len(off) - 1]
    idx = df.index
    return [(idx[a], idx[b]) for a, b in zip(starts, ends)
            if off[a] and (idx[b] - idx[a]).total_seconds() / 3600 > min_hours]
