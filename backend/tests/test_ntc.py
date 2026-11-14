import json
from pathlib import Path

import numpy as np
import pytest

from app.core import ntc

DATA = json.loads((Path(__file__).resolve().parent.parent / "app/data/ntc5k.json").read_text())
TABLE = [tuple(p) for p in DATA["table"]]
T = np.array([p[0] for p in TABLE])
R = np.array([p[1] for p in TABLE])


def test_table_reproduces_datasheet_b_values():
    assert ntc.beta_between(25, 5000, 50, 2032) == pytest.approx(3470, abs=1)
    assert ntc.beta_between(25, 5000, 100, 464) == pytest.approx(3526, abs=1)


def test_script_example_current_to_temperature():
    """9 V supply, 2.5 mA -> 3600 Ω -> 34.26 °C by linear interpolation, as the script printed."""
    r = ntc.resistance_from_current(2.5, 9.0)
    assert r == pytest.approx(3600)
    assert ntc.table_temperature(TABLE, r) == pytest.approx(34.26, abs=0.01)


def test_table_clamps_like_the_script():
    assert ntc.table_temperature(TABLE, 1e6) == -20
    assert ntc.table_temperature(TABLE, 10) == 100


@pytest.mark.parametrize("t, r", TABLE)
def test_both_interpolations_exact_at_table_points(t, r):
    assert ntc.table_temperature(TABLE, r) == pytest.approx(t)
    assert ntc.log_table_temperature(TABLE, r) == pytest.approx(t)


def test_linear_interpolation_reads_warm_between_points():
    """Mid-interval, linear interpolation in R overestimates T by 0.4-0.7 K at 10 K spacing,
    more than the class B tolerance of the sensors (±0.425 K)."""
    r_mid = float(np.sqrt(13730 * 9041))           # between 0 and 10 °C
    diff = ntc.table_temperature(TABLE, r_mid) - ntc.log_table_temperature(TABLE, r_mid)
    assert 0.4 < diff < 0.7


def test_models_round_trip_and_fit_quality():
    beta = ntc.fit_beta(T, R)
    sh = ntc.fit_steinhart_hart(T, R)
    assert sh.temperature(sh.resistance(37.0)) == pytest.approx(37.0, abs=1e-6)
    assert beta.temperature(beta.resistance(37.0)) == pytest.approx(37.0, abs=1e-9)
    assert np.abs(ntc.residuals(sh, T, R)).max() < 0.7
    assert np.abs(ntc.residuals(sh, T, R)).max() < np.abs(ntc.residuals(beta, T, R)).max()


def test_steinhart_hart_recovers_known_coefficients():
    true = ntc.SteinhartHart(1.129e-3, 2.341e-4, 8.775e-8)    # common 10k thermistor
    t = np.linspace(-20, 100, 13)
    fit = ntc.fit_steinhart_hart(t, true.resistance(t))
    assert np.abs(ntc.residuals(fit, t, true.resistance(t))).max() < 1e-6
