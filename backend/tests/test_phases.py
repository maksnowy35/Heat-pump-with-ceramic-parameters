import numpy as np
import pandas as pd
import pytest

from app.core import phases
from tests.conftest import make_record


def _truth(df):
    t = (df.index - df.index[0]).total_seconds().to_numpy()
    return ((t // 60).astype(int) % 2 == 0).astype(float)


def test_half_cycle_from_logged_flags(record):
    assert phases.half_cycle(record) == pytest.approx(60.0)


def test_suggest_and_reconstruct_recover_the_flags():
    r = make_record(minutes=60)
    truth = _truth(r)
    r.iloc[:700, [r.columns.get_loc("nawiew"), r.columns.get_loc("wywiew")]] = np.nan
    plan = phases.suggest(r)
    assert plan is not None and plan.missing == 700 and plan.half_s == pytest.approx(60)
    fixed = phases.reconstruct(r, plan.anchor, plan.supply, plan.half_s)
    assert (fixed["nawiew"].to_numpy() == truth).all()
    assert (fixed["wywiew"].to_numpy() == 1 - truth).all()


def test_only_missing_rows_are_written():
    r = make_record(minutes=10)
    r.iloc[:50, r.columns.get_loc("nawiew")] = np.nan
    fixed = phases.reconstruct(r, r.index[200], supply=False, half_s=37)   # deliberately wrong plan
    assert (fixed["nawiew"].iloc[50:].to_numpy() == r["nawiew"].iloc[50:].to_numpy()).all()


def test_script_loop_makes_every_half_cycle_one_sample_longer():
    """The loop in uzupelnienie_nawiew_wywiew.py writes a row, then compares it with the time of the
    last switch, and restarts the count at the row where it switched: each reconstructed half-cycle
    is one sample longer than `half_s`, so the phase drifts going back in time. The vectorised form
    places every switch exactly half_s apart."""
    r = make_record(minutes=20)
    script = phases.reconstruct_as_script(r, 450, half_s=60, state=(0, 1))
    vec = phases.reconstruct(r, r.index[451], supply=True, half_s=60, only_missing=False)
    sw_script = np.flatnonzero(np.diff(script["nawiew"].to_numpy()[2:451]))
    sw_vec = np.flatnonzero(np.diff(vec["nawiew"].to_numpy()[2:451]))
    assert set(np.diff(sw_script) * 2) == {62}
    assert set(np.diff(sw_vec) * 2) == {60}
    exact = phases.reconstruct(r, r.index[480], supply=True, half_s=60, only_missing=False)  # 960 s
    assert (exact["nawiew"].to_numpy() == _truth(r)).all()


def test_no_plan_when_nothing_is_missing(record):
    assert phases.suggest(record) is None
