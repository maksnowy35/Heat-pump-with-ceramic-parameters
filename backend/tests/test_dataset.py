import numpy as np
import pandas as pd
import pytest

from app.core import dataset
from tests.conftest import make_record


def _as_report(df, underscored=False):
    out = df.copy()
    out.insert(0, dataset.TIME, out.index.strftime(dataset.TIME_FORMAT))
    if underscored:
        out = out.rename(columns={f"t{k}": f"t_{k}" for k in range(1, 6)})
    return out.reset_index(drop=True)


@pytest.mark.parametrize("underscored", [False, True])
def test_both_header_variants(record, underscored):
    df = dataset.normalize(_as_report(record, underscored))
    assert list(df.columns) == dataset.CHANNELS
    assert df.index[0] == record.index[0]
    assert df["t2"].iloc[0] == 24.0


def test_positional_columns(record):
    report = _as_report(record)
    report.columns = ["Czas"] + [f"kol{i}" for i in range(23)]
    df = dataset.normalize(report)
    assert df["p_tloczenia"].iloc[0] == 13.5


def test_wrong_layout_is_rejected(record):
    with pytest.raises(dataset.DatasetError):
        dataset.normalize(_as_report(record).iloc[:, :10].rename(columns=lambda c: f"x{c}"))


def test_excel_round_trip_and_merge(record):
    a, b = record.iloc[:500], record.iloc[400:]
    df = dataset.load([("b.xlsx", dataset.to_excel(b)), ("a.xlsx", dataset.to_excel(a))])
    assert len(df) == len(record)              # overlap removed
    assert df.index.is_monotonic_increasing


def test_csv_with_semicolons(record):
    text = _as_report(record.iloc[:20]).to_csv(sep=";", decimal=",", index=False)
    df = dataset.load([("r.csv", text.encode())])
    assert df["t3"].iloc[0] == pytest.approx(3.5)


def test_derive(record):
    df = dataset.derive(record)
    assert df["dt_h"].iloc[0] == 0 and df["dt_h"].iloc[1] == pytest.approx(2 / 3600)
    assert df["delta_i"].iloc[0] == pytest.approx(df["i_2"].iloc[0] - df["i_3"].iloc[0])


def test_humidity_in_percent_is_converted(record):
    r = record.copy()
    r["rh_2"] *= 100
    df = dataset.derive(r)
    assert df["rh_2"].max() <= 1


def test_summary_finds_gaps_and_missing_flags(record):
    r = pd.concat([record.iloc[:300], record.iloc[300:].shift(2, freq="h")])
    r.iloc[:10, r.columns.get_loc("nawiew")] = np.nan
    s = dataset.summarize(r)
    assert len(s.gaps) == 1 and s.gaps[0][2] == pytest.approx(2.0, abs=0.01)
    assert s.missing_flags == 10
