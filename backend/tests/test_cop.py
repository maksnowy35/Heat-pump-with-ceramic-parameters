import numpy as np
import pandas as pd
import pytest

from app.core import cop, dataset, psychro
from tests.conftest import make_record


def _expected_block_cop(aux_kw, flow=0.389, p_kw=0.6):
    di = psychro.enthalpy(24.0, 0.25) - psychro.enthalpy(3.5, 0.70)
    return flow * di * 60 / ((p_kw + aux_kw) * 120)


def test_block_cop_steady_state():
    df = dataset.derive(make_record(start="2025-03-02 08:00:00"))
    b = cop.blocks(df)
    inner = b.iloc[1:-1]
    assert inner["complete"].all()
    assert inner["cop_total"].to_numpy() == pytest.approx(_expected_block_cop(0.45), rel=0.02)
    assert inner["cop"].to_numpy() == pytest.approx(_expected_block_cop(0.0), rel=0.02)
    assert inner["valid_total"].all()


def test_low_setpoint_marks_blocks_invalid_and_holds_previous_level():
    r = make_record(start="2025-03-02 08:00:00")
    r.loc["2025-03-02 08:10:00":"2025-03-02 08:11:58", "nast_spr"] = 0.1
    b = cop.blocks(dataset.derive(r))
    bad = b.loc["2025-03-02 08:10:00"]
    assert not bad["valid_total"]
    assert bad["cop_total_plot"] == pytest.approx(b.loc["2025-03-02 08:08:00", "cop_total"])


def test_compressor_off_gives_no_cop():
    b = cop.blocks(dataset.derive(make_record(setpoint=0.0)))
    assert b["cop_total"].isna().all() and not b["valid_total"].any()


def test_cumulative_adds_constant_power_on_exhaust_rows_only():
    df = dataset.derive(make_record(minutes=60, start="2025-03-02 08:00:00"))
    c = cop.cumulative(df)
    di = psychro.enthalpy(24.0, 0.25) - psychro.enthalpy(3.5, 0.70)
    expected = 0.389 * di * 60 / ((0.6 + 0.45 / 2) * 120)
    assert c["cop_total"].iloc[-1] == pytest.approx(expected, rel=0.02)


def test_off_segments():
    r = make_record(minutes=300, start="2025-03-02 08:00:00")
    r.loc["2025-03-02 09:00":"2025-03-02 11:30", "Moc_Czynna"] = 0
    segs = cop.off_segments(dataset.derive(r))
    assert len(segs) == 1
    assert (segs[0][1] - segs[0][0]).total_seconds() / 3600 == pytest.approx(2.5, abs=0.02)


def test_demo_record_cop_follows_its_shape():
    from app.core import synthetic
    df = dataset.derive(synthetic.generate(days=0.5))
    w = df.loc["2025-02-22 09:00":"2025-02-22 09:30"]
    s = cop.block_summary(cop.blocks(w))
    assert s["cop_total"] == pytest.approx(float(synthetic.target_cop(s["t_out"])), rel=0.05)


# ---- corrected mode ----

def test_mode_defaults():
    assert cop.settings("scripts").flow == pytest.approx(0.389)
    assert cop.settings("corrected").flow == pytest.approx(0.468)
    assert cop.settings("corrected", flow=0.5).flow == 0.5


def test_corrected_blocks_follow_the_cycles():
    df = dataset.derive(make_record(start="2025-03-02 08:00:30"))   # record starts inside a supply phase
    b = cop.blocks(df, cop.settings("corrected"))
    assert b.index[0] == pd.Timestamp("2025-03-02 08:02:30")        # first supply start seen in the data
    assert (b.index.to_series().diff().dropna().dt.total_seconds() == 120).all()
    full = b[b["complete"]]
    assert full["cop_total"].to_numpy() == pytest.approx(_expected_block_cop(0.45, flow=0.468), rel=0.02)
    assert full["cop_total"].iloc[0] / _expected_block_cop(0.45) == pytest.approx(0.468 / 0.389, rel=0.02)


def test_corrected_cumulative_counts_constant_power_all_cycle():
    df = dataset.derive(make_record(minutes=60, start="2025-03-02 08:00:00"))
    c = cop.cumulative(df, cop.settings("corrected"))
    assert c["cop_total"].iloc[-1] == pytest.approx(_expected_block_cop(0.45, flow=0.468), rel=0.02)


def test_gap_row_carries_the_gap_only_in_scripts_mode():
    r = make_record(minutes=60, start="2025-03-02 08:00:00")
    r = pd.concat([r.iloc[:900], r.iloc[900:].shift(10, freq="h")])     # 10 h logging gap
    df = dataset.derive(r)
    scripts = cop.cumulative(df, cop.settings("scripts"))["cop_total"].iloc[-1]
    corrected = cop.cumulative(df, cop.settings("corrected"))["cop_total"].iloc[-1]
    steady = _expected_block_cop(0.45, flow=0.468)
    assert corrected == pytest.approx(steady, rel=0.03)
    # one row weighted with 10 h makes the scripts' running COP the COP of that single row
    assert abs(scripts / (0.389 / 0.468) - steady) > 0.3
