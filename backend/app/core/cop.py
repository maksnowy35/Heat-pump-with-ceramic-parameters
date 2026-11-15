"""Coefficient of performance from the logger data.

Heat is counted only in the supply half-cycle, electrical energy over the whole cycle:

    Q = flow * (i_2 - i_3) * dt          (supply, compressor setpoint > 0)
    W = P_comp * dt  [+ P_aux * dt]       (supply or exhaust, setpoint > 0)

Two views, as in the original scripts:
  * blocks      - Q and W summed in 2-minute blocks (one supply + one exhaust half-cycle),
                  COP per block with and without the constant fan/automation power;
  * cumulative  - running sums from the first row, COP = sum(Q) / sum(W), smoothed.

Two modes:
  * scripts     - exactly as the scripts computed it: flow = 0.389 (the volume flow in m3/s),
                  constant power on exhaust rows only in the cumulative COP, dt of a row = time since
                  the previous row (also across logging gaps), clock-aligned 2-minute bins;
  * corrected   - flow = mass flow 0.468 kg/s, constant power over the whole cycle everywhere,
                  dt capped at max_dt_s, blocks aligned with the cycles (from each supply start).
"""
from dataclasses import dataclass, replace

import numpy as np
import pandas as pd


VOLUME_FLOW = 1400 / 3600       # m3/s, the 0.389 of the scripts
MASS_FLOW = 0.468                # kg/s = 1.2 kg/m3 * 1400 m3/h (thesis, section 3.1)


@dataclass(frozen=True)
class CopSettings:
    flow: float = 0.389           # factor in Q = flow * delta_i; the scripts use 0.389
    aux_kw: float = 0.45          # fan + automation [kW]
    block: str = "2min"
    min_setpoint: float = 0.20    # blocks with max setpoint below this are not trusted
    cop_min: float = 1.5
    cop_max: float = 12.0
    smooth: int = 10              # rolling window (samples) for the cumulative COP
    mode: str = "scripts"         # "scripts" | "corrected"
    max_dt_s: float = 10.0        # corrected mode: longest time step a single row may carry

    @property
    def corrected(self) -> bool:
        return self.mode == "corrected"


def settings(mode: str = "scripts", **kw) -> CopSettings:
    """Settings of a mode; `flow` defaults to the volume flow (scripts) or the mass flow (corrected)."""
    kw = {k: v for k, v in kw.items() if v is not None}
    kw.setdefault("flow", MASS_FLOW if mode == "corrected" else round(VOLUME_FLOW, 3))
    return CopSettings(mode=mode, **kw)


def dt_hours(df: pd.DataFrame, s: CopSettings) -> pd.Series:
    """Time step of each row [h]; in corrected mode a row after a gap carries at most max_dt_s."""
    return df["dt_h"].clip(upper=s.max_dt_s / 3600) if s.corrected else df["dt_h"]


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


def cycle_ids(df: pd.DataFrame) -> np.ndarray:
    """Cycle number of every row: a new cycle starts where a supply half-cycle begins."""
    sup = ((df["nawiew"] == 1) & (df["wywiew"] == 0)).to_numpy()
    starts = np.r_[False, sup[1:] & ~sup[:-1]]
    return np.cumsum(starts)


def blocks(df: pd.DataFrame, s: CopSettings = CopSettings()) -> pd.DataFrame:
    """COP per block: clock-aligned 2-minute bins (cop_blok30min_nowszy.py) or, in corrected mode,
    one block per cycle starting with its supply half-cycle."""
    heat, power = _masks(df)
    dt = dt_hours(df, s)
    w = pd.DataFrame(index=df.index)
    w["Q"] = np.where(heat, s.flow * df["delta_i"] * dt, 0.0)          # kWh
    w["W"] = np.where(power, df["Moc_Czynna"] / 1000.0 * dt, 0.0)       # kWh
    w["W_total"] = w["W"] + np.where(power, s.aux_kw * dt, 0.0)
    w["nast_spr"] = df["nast_spr"]
    w["P"] = df["Moc_Czynna"]
    w["t3"] = df["t3"]
    w["span"] = df["dt_h"].clip(upper=60 / 3600)
    agg = {"Q": "sum", "W": "sum", "W_total": "sum", "nast_spr": "max",
           "P": "mean", "t3": "mean", "span": "sum"}

    if s.corrected:
        ids = cycle_ids(df)
        g = w.groupby(ids)
        b = g.agg(agg)
        b.index = pd.DatetimeIndex(g.apply(lambda x: x.index[0]))
        b.index.name = df.index.name
        if len(b) and ids[0] == 0:          # rows before the first supply start are not a cycle
            b = b.iloc[1:]
    else:
        b = w.resample(s.block).agg(agg)
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
    if len(b):
        origin = b.index[0] if not s.corrected else df.index[0]
        b["minutes"] = (b.index - origin).total_seconds() / 60
    else:
        b["minutes"] = []
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

    As in those scripts, the constant power is added on exhaust rows only; in corrected mode on
    every row of the cycle, as the block scripts did.
    """
    heat, power = _masks(df)
    dt = dt_hours(df, s)
    q = np.where(heat, s.flow * df["delta_i"] * dt, 0.0)
    p = df["Moc_Czynna"] / 1000.0
    aux_rows = 1.0 if s.corrected else (df["wywiew"] == 1)
    w_total = np.where(power, (p + aux_rows * s.aux_kw) * dt, 0.0)
    w = np.where(power, p * dt, 0.0)

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
