"""Synthetic logger report for the demo.

The measurement data of the test stand is not published, so the demo runs on a generated record
in exactly the logger layout (2 s sampling, 60 s supply / 60 s exhaust). It is shaped after the
measured behaviour - outdoor temperature swinging over the day, compressor at ~50 % in the
exhaust phase, discharge pressure held by the controller, equalised pressures when the compressor
is off, a logging gap, and supply/exhaust flags missing at the start of the record - so that every
tool has something to show. It is not measurement data.
"""
import numpy as np
import pandas as pd
from scipy.signal import lfilter

from . import psychro, r290
from .dataset import CHANNELS, TIME

START = "2025-02-22 06:00:00"


def _lag(x: np.ndarray, dt: float, tau: float) -> np.ndarray:
    a = np.exp(-dt / tau)
    return lfilter([1 - a], [1, -a], x, zi=[a * x[0]])[0]


def _smooth_noise(rng, n: int, dt: float, tau: float, sigma: float) -> np.ndarray:
    a = np.exp(-dt / tau)
    w = rng.normal(0, sigma * np.sqrt(1 - a * a), n)
    return lfilter([1], [1, -a], w)


def _t_from_i(i, x):
    return (i - psychro.R0 * x) / (psychro.CP_DA + psychro.CP_V * x)


def _rh_from_x(t, x, p=psychro.P_ATM):
    pw = x * p / (psychro.EPS + x)
    return np.clip(pw / psychro.p_ws(t), 0.05, 0.98)


def _x_from_rh(t, rh):
    return psychro.humidity_ratio(t, rh)


def target_cop(t_out):
    """COP (as the scripts compute it, with the constant power) the record is shaped to give."""
    return np.clip(4.15 - 0.11 * (np.asarray(t_out) - 2.0), 2.6, 4.3)


def generate(start: str = START, days: float = 4.0, dt: float = 2.0, seed: int = 7) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    n = int(days * 86400 / dt)
    t = np.arange(n) * dt
    hours = t / 3600
    clock = (pd.Timestamp(start).hour + pd.Timestamp(start).minute / 60 + hours) % 24

    # outdoor air: daily swing + a slower drift
    t_out = (6.8 + 4.6 * np.sin(2 * np.pi * (clock - 9) / 24)
             + 2.4 * np.sin(2 * np.pi * hours / 79 + 0.6)
             + _smooth_noise(rng, n, dt, 1800, 0.35))
    rh_out = np.clip(0.80 - 0.018 * (t_out - 6) + _smooth_noise(rng, n, dt, 3600, 0.03), 0.45, 0.95)
    x_out = _x_from_rh(t_out, rh_out)
    t_in = 20.6 + 0.4 * np.sin(2 * np.pi * (clock - 15) / 24) + _smooth_noise(rng, n, dt, 900, 0.1)
    x_in = _x_from_rh(t_in, 0.31)

    # half-cycles
    phase = (t // 60).astype(int) % 2          # 0 supply, 1 exhaust
    s = t % 60                                  # seconds into the half-cycle
    supply = phase == 0

    # compressor: off for a few hours on the second day
    on = ~((hours >= 26.0) & (hours < 31.0))
    pid = 0.07 * np.sin(2 * np.pi * t / 640) + _smooth_noise(rng, n, dt, 60, 0.02)
    setpoint = np.where(supply, 0.58 + pid, 0.50)
    setpoint = np.where(on, np.clip(setpoint, 0.2, 0.9), 0.0)
    p_comp = (230 + 760 * setpoint) * (1 + 0.012 * (t_in - t_out - 14)) + rng.normal(0, 12, n)
    p_comp = np.where(on, np.round(p_comp), 0.0)

    # heat delivered in the supply half-cycle, shaped so the block COP follows target_cop
    p_cycle = pd.Series(p_comp).rolling(60, min_periods=1, center=True).mean().to_numpy()
    di_mean = 2 * target_cop(t_out) * (p_cycle / 1000 + 0.45) / 0.389
    shape = 0.8 + 0.4 * np.exp(-s / 12)
    shape /= 0.8 + 0.4 * 12 / 60 * (1 - np.exp(-5))
    i_out = psychro.enthalpy(t_out, rh_out)
    i_in = psychro.enthalpy(t_in, 0.31)
    di_regen = 0.86 * (i_in - i_out)            # regenerator alone, compressor off
    di = np.where(on, di_mean, di_regen) * shape + rng.normal(0, 0.25, n)

    # point 3 - outdoor side; point 2 - supply side of the indoor exchanger
    t3 = np.where(supply, t_out + 0.6 * np.exp(-s / 15), t_out + 0.9 * (1 - np.exp(-s / 20)))
    t3 = t3 + rng.normal(0, 0.05, n)
    rh3 = _rh_from_x(t3, x_out)
    i3 = psychro.enthalpy(t3, rh3)
    x2 = 0.4 * x_out + 0.6 * x_in
    t2_supply = _t_from_i(i3 + di, x2)
    t2_exhaust = t_in - 0.3 + 0.8 * np.exp(-s / 10)
    t2 = np.where(supply, t2_supply, t2_exhaust)
    rh2 = np.where(supply, _rh_from_x(t2, x2), _rh_from_x(t2, x_in))

    t1 = np.where(supply, t_in + 0.5 * (1 - np.exp(-s / 20)), t_in + 0.5 * np.exp(-s / 20))
    t4 = t3 - 0.6 + np.where(on & ~supply, -0.8 * (1 - np.exp(-s / 15)), 0.0)
    t5 = t_in - 1.0 + np.where(supply, 0.7 * (1 - np.exp(-s / 25)), 0.4 * np.exp(-s / 25))
    rh1, rh4, rh5 = _rh_from_x(t1, x_in), _rh_from_x(t4, x_out), _rh_from_x(t5, x_in)

    # refrigerant side
    p_suc_on = (2.75 + 0.09 * (t_out - 3) + 0.12 * np.sin(2 * np.pi * t / 120)
                + _smooth_noise(rng, n, dt, 30, 0.08))
    p_dis_on = 13.2 + 0.45 * np.sin(2 * np.pi * t / 640) + np.where(supply, 0.15, -0.15) \
        + _smooth_noise(rng, n, dt, 20, 0.15)
    p_eq = r290.p_sat(15.0)
    p_suc = _lag(np.where(on, p_suc_on, p_eq), dt, 240)
    p_dis = _lag(np.where(on, p_dis_on, p_eq), dt, 240)
    t_evap = r290.t_sat(p_suc)
    t_cond = r290.t_sat(p_dis, quality=0.0)
    superheat = 6.0 + 1.5 * np.sin(2 * np.pi * t / 640 + 1) + _smooth_noise(rng, n, dt, 40, 0.6)
    t_suc = np.where(on, t_evap + superheat, 14.0 + rng.normal(0, 0.1, n))
    t_dis = np.where(on, t_cond + 24 + _smooth_noise(rng, n, dt, 60, 1.0), t_cond)

    s_app = p_comp / 0.93
    data = {
        "t1": t1, "t2": t2, "t3": t3, "t4": t4, "t5": t5,
        "rh_1": rh1, "rh_2": rh2, "rh_3": rh3, "rh_4": rh4, "rh_5": rh5,
        "t_ssania": t_suc, "t_tloczenie": t_dis,
        "p_ssania": p_suc, "p_tloczenia": p_dis,
        "t_parowania": t_evap, "t_skraplania": t_cond,
        "Moc_Czynna": p_comp, "Moc_Bierna": np.sqrt(np.maximum(s_app**2 - p_comp**2, 0)),
        "Moc_Pozorna": s_app, "predkosc_wentylatora": np.full(n, 70.0),
        "nast_spr": setpoint,
        "nawiew": (phase == 0).astype(float), "wywiew": (phase == 1).astype(float),
    }
    df = pd.DataFrame(data, index=pd.Timestamp(start) + pd.to_timedelta(t, unit="s"))
    df.index.name = TIME

    # logger resolution
    for c in ("t1", "t2", "t3", "t4", "t5", "t_ssania", "t_tloczenie", "t_parowania", "t_skraplania"):
        df[c] = df[c].round(1)
    for c in ("rh_1", "rh_2", "rh_3", "rh_4", "rh_5", "nast_spr"):
        df[c] = df[c].round(3)
    for c in ("p_ssania", "p_tloczenia"):
        df[c] = df[c].round(2)
    for c in ("Moc_Bierna", "Moc_Pozorna"):
        df[c] = df[c].round(0)

    # supply/exhaust flags were not logged in the first two hours
    df.loc[df.index < df.index[0] + pd.Timedelta(hours=2), ["nawiew", "wywiew"]] = np.nan
    # logger stopped for ten hours on the third day
    gap = (hours >= 60.0) & (hours < 70.0)
    return df.loc[~gap, CHANNELS]
