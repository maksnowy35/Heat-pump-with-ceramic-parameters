"""Everything measured in one window, as the per-window plotting scripts drew it.

wszystkie_wykr_2.py, dodatkowe_COP.py and wszystkieBezCOP2.py drew T, RH, i and the pressures over
a 30-minute window plus a running COP; 120sPRZEDZIALY_new.py drew the same four quantities over a
single 120-second cycle. Both are one function here, with the window length as a parameter.
"""
import numpy as np
import pandas as pd

from . import r290
from .cop import CopSettings, _masks


def cycle_start(df: pd.DataFrame, start) -> pd.Timestamp | None:
    """First row at or after `start` where a supply half-cycle begins."""
    w = df.loc[pd.Timestamp(start):]
    sup = (w["nawiew"] == 1).to_numpy()
    rises = np.flatnonzero(sup[1:] & ~sup[:-1]) + 1
    return w.index[rises[0]] if len(rises) else None


def series(df: pd.DataFrame, start, minutes: float, s: CopSettings = CopSettings()) -> pd.DataFrame:
    t0 = pd.Timestamp(start)
    t1 = t0 + pd.Timedelta(minutes=minutes)
    w = df[(df.index >= t0) & (df.index < t1)].copy()
    if w.empty:
        return w
    heat, power = _masks(w)
    dt = w["dt_h"].where(w.index > w.index[0], 0.0)     # the window starts at its first row
    q = np.where(heat, s.flow * w["delta_i"] * dt, 0.0)
    e = np.where(power, w["Moc_Czynna"] / 1000 * dt, 0.0)
    e_total = e + np.where(power, s.aux_kw * dt, 0.0)
    q_sum, e_sum, et_sum = np.cumsum(q), np.cumsum(e), np.cumsum(e_total)
    roll = dict(window=s.smooth, min_periods=1, center=True)
    w["cop_running"] = pd.Series(np.where(e_sum > 0, q_sum / np.where(e_sum > 0, e_sum, 1), np.nan),
                                 index=w.index).rolling(**roll).mean()
    w["cop_total_running"] = pd.Series(np.where(et_sum > 0, q_sum / np.where(et_sum > 0, et_sum, 1), np.nan),
                                       index=w.index).rolling(**roll).mean()
    supply = (w["nawiew"] == 1) & (w["wywiew"] == 0)
    w["q_kw"] = np.where(supply, s.flow * w["delta_i"], 0.0)       # heating capacity in the supply phase
    w["p_total"] = w["Moc_Czynna"] + s.aux_kw * 1000 * (w["Moc_Czynna"] > 0)
    w["t_sat_suction"] = r290.t_sat(w["p_ssania"].to_numpy())
    w["t_sat_discharge"] = r290.t_sat(w["p_tloczenia"].to_numpy(), quality=0.0)
    w["superheat"] = w["t_ssania"] - w["t_sat_suction"]
    w["superheat_ctrl"] = w["t_ssania"] - w["t_parowania"]
    w["seconds"] = (w.index - w.index[0]).total_seconds()
    return w


def cycle_totals(w: pd.DataFrame, s: CopSettings = CopSettings()) -> dict:
    """Heat, energy and COP over the rows of a window (one cycle for the 120 s view)."""
    heat, power = _masks(w)
    dt = w["dt_h"].where(w.index > w.index[0], 0.0)
    q = float(np.where(heat, s.flow * w["delta_i"] * dt, 0).sum())
    e = float(np.where(power, w["Moc_Czynna"] / 1000 * dt, 0).sum())
    e_total = e + float(np.where(power, s.aux_kw * dt, 0).sum())
    return {
        "q_kwh": q, "w_kwh": e, "w_total_kwh": e_total,
        "cop": q / e if e > 0 else None, "cop_total": q / e_total if e_total > 0 else None,
    }
