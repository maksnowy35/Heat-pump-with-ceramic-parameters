"""NTC thermistors: resistance-temperature characteristics.

Two models, both fitted by linear least squares from an R-T table:
  Beta:             R = R25 exp(B (1/T - 1/T25))
  Steinhart-Hart:   1/T = A + B ln R + C (ln R)^3
"""
from dataclasses import dataclass

import numpy as np

T0 = 273.15
T25 = 25.0


@dataclass(frozen=True)
class Beta:
    r25: float          # Ω
    beta: float         # K
    t_ref: float = T25  # °C

    def resistance(self, t):
        T = np.asarray(t, float) + T0
        return self.r25 * np.exp(self.beta * (1 / T - 1 / (self.t_ref + T0)))

    def temperature(self, r):
        inv_T = 1 / (self.t_ref + T0) + np.log(np.asarray(r, float) / self.r25) / self.beta
        return 1 / inv_T - T0


@dataclass(frozen=True)
class SteinhartHart:
    a: float
    b: float
    c: float

    def temperature(self, r):
        L = np.log(np.asarray(r, float))
        return 1 / (self.a + self.b * L + self.c * L**3) - T0

    def resistance(self, t):
        T = np.asarray(t, float) + T0
        x = (self.a - 1 / T) / self.c
        y = np.sqrt((self.b / (3 * self.c)) ** 3 + x**2 / 4)
        return np.exp(np.cbrt(y - x / 2) - np.cbrt(y + x / 2))


def fit_beta(t, r, t_ref=T25) -> Beta:
    """Least squares of ln R = ln R_ref + B (1/T - 1/T_ref)."""
    T = np.asarray(t, float) + T0
    X = 1 / T - 1 / (t_ref + T0)
    B, lnR = np.polyfit(X, np.log(np.asarray(r, float)), 1)
    return Beta(r25=float(np.exp(lnR)), beta=float(B), t_ref=t_ref)


def fit_steinhart_hart(t, r) -> SteinhartHart:
    """Least squares of 1/T = A + B ln R + C (ln R)^3 (needs at least 3 points)."""
    L = np.log(np.asarray(r, float))
    M = np.column_stack([np.ones_like(L), L, L**3])
    (a, b, c), *_ = np.linalg.lstsq(M, 1 / (np.asarray(t, float) + T0), rcond=None)
    return SteinhartHart(float(a), float(b), float(c))


def residuals(model, t, r):
    """Temperature error of the fit at the table points [K]."""
    return model.temperature(r) - np.asarray(t, float)


def table_temperature(table: list[tuple[float, float]], r: float) -> float:
    """Piecewise-linear interpolation in the R-T table, clamped to its ends (NTC5k_characterisitc.py)."""
    t_lo, r_hi = table[0]
    t_hi, r_lo = table[-1]
    if r > r_hi:
        return t_lo
    if r < r_lo:
        return t_hi
    for (t1, r1), (t2, r2) in zip(table, table[1:]):
        if r2 <= r <= r1:
            return t1 + (t2 - t1) * (r - r1) / (r2 - r1)
    return float("nan")


def beta_between(t1: float, r1: float, t2: float, r2: float) -> float:
    """B constant between two table points, B_t1/t2 = ln(R1/R2) / (1/T1 - 1/T2)."""
    return float(np.log(r1 / r2) / (1 / (t1 + T0) - 1 / (t2 + T0)))


def resistance_from_current(current_ma: float, supply_v: float) -> float:
    """Thermistor fed straight from the supply: R = U / I."""
    return supply_v / (current_ma * 1e-3)


def log_table_temperature(table: list[tuple[float, float]], r: float) -> float:
    """Interpolation linear in ln R against 1/T between neighbouring points (a Beta curve per interval).
    Matches the table exactly at its points and follows the exponential shape in between."""
    t_lo, r_hi = table[0]
    t_hi, r_lo = table[-1]
    if r > r_hi:
        return t_lo
    if r < r_lo:
        return t_hi
    for (t1, r1), (t2, r2) in zip(table, table[1:]):
        if r2 <= r <= r1:
            x = (np.log(r) - np.log(r1)) / (np.log(r2) - np.log(r1))
            inv = 1 / (t1 + T0) + x * (1 / (t2 + T0) - 1 / (t1 + T0))
            return float(1 / inv - T0)
    return float("nan")
