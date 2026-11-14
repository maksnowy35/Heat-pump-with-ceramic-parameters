import json
from pathlib import Path

import pytest

from app.core import regenerator

THESIS = json.loads((Path(__file__).resolve().parent.parent / "app/data/regenerator_thesis.json").read_text())


@pytest.fixture(scope="module")
def res():
    return regenerator.compute(regenerator.RegeneratorInput(heat_capacity=95_000))


@pytest.mark.parametrize("key, scale, digits", [
    ("pitch", 1e3, "pitch_mm"), ("wall", 1e3, "wall_mm"), ("channel", 1e3, "channel_mm"),
    ("open_area_block", 1, "open_area_block"), ("open_area_row", 1, "open_area_row"),
    ("volume_flow", 1, "volume_flow"), ("velocity", 1, "velocity"), ("reynolds", 1, "reynolds"),
    ("h", 1, "h"), ("hA", 1, "hA"), ("dp", 1, "dp"), ("fan_power_mech", 1, "fan_power_mech"),
    ("fan_power_el", 1, "fan_power_el"), ("fan_saving_mech", 1, "fan_saving_mech"), ("tau", 1, "tau"),
])
def test_thesis_section_4_4(res, key, scale, digits):
    assert getattr(res, key) * scale == pytest.approx(THESIS[digits], rel=4e-3)


def test_rows(res):
    top, bottom = res.rows
    assert top.wetted_area == pytest.approx(THESIS["wetted_area_top"], rel=1e-3)
    assert bottom.wetted_area == pytest.approx(THESIS["wetted_area_bottom"], rel=1e-3)
    assert top.dp == pytest.approx(THESIS["dp_top"], rel=4e-3)
    assert bottom.dp == pytest.approx(THESIS["dp_bottom"], rel=1e-2)
    assert res.ntu == pytest.approx(16, abs=0.2)


def test_heat_capacity_from_the_masses_matches_the_paper():
    """30 blocks, 113.1 kg; the paper gives 99 528 J/K."""
    res = regenerator.compute()
    assert res.heat_capacity == pytest.approx(99_528, rel=1e-4)


def test_half_cycle_fractions(res):
    # 60 s ~ 4.8 tau; 40-50 s collect 96-98 % in the lumped model
    assert res.half_cycle_over_tau == pytest.approx(4.8, abs=0.05)
    assert regenerator.half_cycle_for(0.96, res.tau) == pytest.approx(40, abs=1)
    assert regenerator.half_cycle_for(0.98, res.tau) == pytest.approx(49, abs=1)


def test_air_capacity_time_scale(res):
    """C / (m cp) is about 200 s: in a 60 s half-cycle the air can carry away ~28 % of what the bed holds."""
    assert res.tau_bed == pytest.approx(95_000 / (0.468 * 1006), rel=1e-6)
    assert res.utilization == pytest.approx(0.297, abs=0.005)
