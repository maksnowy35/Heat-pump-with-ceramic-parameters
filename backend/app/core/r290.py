"""R290 (propane) on the refrigerant side: saturation temperatures from the gauge pressures
of the Carel SPKT transducers, superheat and subcooling. Properties from CoolProp."""
import numpy as np
from CoolProp.CoolProp import PropsSI

FLUID = "Propane"
P_ATM_BAR = 1.01325


def _abs_pa(p_gauge_bar, p_atm_bar):
    return (np.asarray(p_gauge_bar, float) + p_atm_bar) * 1e5


def t_sat(p_gauge_bar, p_atm_bar=P_ATM_BAR, quality=1.0):
    """Saturation (dew point for quality=1) temperature [°C] at a gauge pressure [bar(g)]."""
    p = np.atleast_1d(_abs_pa(p_gauge_bar, p_atm_bar))
    out = np.full(p.shape, np.nan)
    ok = np.isfinite(p) & (p > 0)
    if ok.any():
        out[ok] = PropsSI("T", "P", p[ok], "Q", quality, FLUID) - 273.15
    return out if np.ndim(p_gauge_bar) else float(out[0])


def p_sat(t, p_atm_bar=P_ATM_BAR):
    """Saturation pressure [bar(g)] at t [°C]."""
    T = np.atleast_1d(np.asarray(t, float)) + 273.15
    out = PropsSI("P", "T", T, "Q", 1.0, FLUID) / 1e5 - p_atm_bar
    return out if np.ndim(t) else float(out[0])


def superheat(t_suction_gas, p_suction_bar, p_atm_bar=P_ATM_BAR):
    """Superheat [K]: suction gas temperature minus the dew temperature at suction pressure."""
    return np.asarray(t_suction_gas, float) - t_sat(p_suction_bar, p_atm_bar, quality=1.0)


def subcooling(t_liquid, p_discharge_bar, p_atm_bar=P_ATM_BAR):
    """Subcooling [K]: bubble temperature at discharge pressure minus the liquid temperature."""
    return t_sat(p_discharge_bar, p_atm_bar, quality=0.0) - np.asarray(t_liquid, float)
