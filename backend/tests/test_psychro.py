import numpy as np
import pytest
from CoolProp.HumidAirProp import HAPropsSI

from app.core import psychro


def test_saturation_pressure_at_20C():
    assert psychro.p_ws(20.0) == pytest.approx(2339.3, rel=1e-3)


@pytest.mark.parametrize("t, rh", [(0, 0.8), (3.5, 0.7), (10, 0.5), (20, 0.3), (24, 0.25), (30, 0.4)])
def test_enthalpy_matches_coolprop(t, rh):
    """The scripts used CoolProp HAPropsSI row by row; the closed form agrees within 0.15 kJ/kg."""
    ref = HAPropsSI("H", "T", t + 273.15, "P", 101325, "R", rh) / 1000
    assert psychro.enthalpy(t, rh) == pytest.approx(ref, abs=0.15)


def test_enthalpy_difference_matches_coolprop():
    ref = (HAPropsSI("H", "T", 297.15, "P", 101325, "R", 0.25)
           - HAPropsSI("H", "T", 276.65, "P", 101325, "R", 0.70)) / 1000
    assert psychro.enthalpy(24, 0.25) - psychro.enthalpy(3.5, 0.70) == pytest.approx(ref, abs=0.05)


def test_dew_point_round_trip():
    td = psychro.dew_point(20.0, 0.5)
    assert psychro.p_ws(td) == pytest.approx(0.5 * psychro.p_ws(20.0), rel=1e-6)
    assert td == pytest.approx(9.27, abs=0.05)


def test_vectorised():
    i = psychro.enthalpy(np.array([0.0, 20.0]), np.array([0.5, 0.5]))
    assert i.shape == (2,) and i[1] > i[0]
