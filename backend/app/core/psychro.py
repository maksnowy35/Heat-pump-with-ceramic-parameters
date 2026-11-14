"""Moist air: saturation pressure, humidity ratio, specific enthalpy, dew point.

ASHRAE Handbook - Fundamentals (2017), ch. 1. Relative humidity is a fraction (0-1), as logged
by the test stand, and always taken over liquid water (the convention of capacitive RH sensors such
as the SHT20), so the water formula is used below 0 °C too.
"""
import numpy as np

P_ATM = 101_325.0      # Pa
EPS = 0.621945         # M_w / M_a
CP_DA = 1.006          # kJ/(kg K) dry air
CP_V = 1.86            # kJ/(kg K) water vapour
R0 = 2501.0            # kJ/kg latent heat at 0 °C

# Hyland-Wexler, over liquid water (ASHRAE 2017, ch. 1, Eq. 6)
_C8, _C9, _C10, _C11, _C12, _C13 = (
    -5.8002206e3, 1.3914993, -4.8640239e-2, 4.1764768e-5, -1.4452093e-8, 6.5459673,
)


def _ln_pws(T):
    return _C8 / T + _C9 + _C10 * T + _C11 * T**2 + _C12 * T**3 + _C13 * np.log(T)


def p_ws(t):
    """Saturation pressure of water vapour [Pa] at t [°C]."""
    return np.exp(_ln_pws(np.asarray(t, float) + 273.15))


def humidity_ratio(t, rh, p=P_ATM):
    """Humidity ratio x [kg/kg dry air]."""
    pw = np.asarray(rh, float) * p_ws(t)
    return EPS * pw / (p - pw)


def enthalpy(t, rh, p=P_ATM):
    """Specific enthalpy of moist air i [kJ/kg dry air]."""
    t = np.asarray(t, float)
    return CP_DA * t + humidity_ratio(t, rh, p) * (R0 + CP_V * t)


def dew_point(t, rh):
    """Dew point [°C] (over water), Newton iteration on the Hyland-Wexler equation."""
    target = np.log(np.asarray(rh, float) * p_ws(t))
    T = np.asarray(t, float) + 273.15 - 5.0
    for _ in range(8):
        dlnp = -_C8 / T**2 + _C10 + 2 * _C11 * T + 3 * _C12 * T**2 + _C13 / T
        T = T - (_ln_pws(T) - target) / dlnp
    return T - 273.15
