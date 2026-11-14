import pandas as pd
import pytest

from app.core import dataset, window, windows
from tests.conftest import make_record


@pytest.fixture(scope="module")
def demo():
    from app import store
    return store.get("demo").frame


def test_check_statuses(demo):
    assert windows.check(demo, "2025-02-22T08:24:58", 30).status == "ok"
    assert windows.check(demo, "2025-02-24T17:45:00", 30).status == "partial"   # runs into the gap
    assert windows.check(demo, "2025-03-02T07:54:29", 30).status == "missing"


def test_tolerance(demo):
    c = windows.check(demo, "2025-02-22T08:24:59", 30, tolerance_s=2)
    assert c.first is not None


def test_suggestions_are_steady_spread_and_disjoint(demo):
    c = windows.suggest(demo, minutes=30, n=6)
    assert 4 <= len(c) <= 6
    temps = [x.t3_mean for x in c]
    assert temps == sorted(temps) and temps[-1] - temps[0] > 6
    starts = sorted(pd.Timestamp(x.start) for x in c)
    assert all((b - a).total_seconds() >= 1800 for a, b in zip(starts, starts[1:]))
    for x in c:
        cov = windows.check(demo, x.start, 30)
        assert cov.status == "ok" and cov.flags == 1 and cov.compressor == 1


def test_cycle_view_has_one_cycle():
    df = dataset.derive(make_record(minutes=10, start="2025-03-02 08:00:00"))
    s = window.cycle_start(df, "2025-03-02 08:00:30")
    assert s == pd.Timestamp("2025-03-02 08:02:00")
    w = window.series(df, s, 2)
    assert len(w) == 60 and w["nawiew"].iloc[0] == 1 and w["nawiew"].iloc[-1] == 0


def test_cycle_totals_match_block_cop():
    from tests.test_cop import _expected_block_cop
    df = dataset.derive(make_record(minutes=10, start="2025-03-02 08:00:00"))
    w = window.series(df, "2025-03-02 08:02:00", 2)
    t = window.cycle_totals(w)
    assert t["cop_total"] == pytest.approx(_expected_block_cop(0.45), rel=0.03)


def test_superheat_from_pressure():
    df = dataset.derive(make_record(minutes=4))
    w = window.series(df, df.index[0], 4)
    # 2.8 bar(g) -> about -7 °C dew point for propane, suction gas at -2 °C
    assert w["superheat"].iloc[0] == pytest.approx(5.0, abs=0.5)
