import numpy as np
import pandas as pd
import pytest

from app.core import dataset


def make_record(minutes=30, dt=2.0, start="2025-03-02 07:54:00", p_comp=600.0, setpoint=0.55,
                t2=24.0, rh2=0.25, t3=3.5, rh3=0.70):
    """Steady record in the logger layout: constant air states, 60 s supply / 60 s exhaust."""
    n = int(minutes * 60 / dt)
    t = np.arange(n) * dt
    supply = (t // 60).astype(int) % 2 == 0
    idx = pd.Timestamp(start) + pd.to_timedelta(t, unit="s")
    df = pd.DataFrame(index=idx, columns=dataset.CHANNELS, dtype=float)
    df.index.name = dataset.TIME
    for k in range(1, 6):
        df[f"t{k}"] = 20.0
        df[f"rh_{k}"] = 0.3
    df["t2"], df["rh_2"], df["t3"], df["rh_3"] = t2, rh2, t3, rh3
    df["p_ssania"], df["p_tloczenia"] = 2.8, 13.5
    df["t_ssania"], df["t_tloczenie"], df["t_parowania"], df["t_skraplania"] = -2.0, 70.0, -8.0, 42.5
    df["Moc_Czynna"], df["Moc_Bierna"], df["Moc_Pozorna"] = p_comp, 200.0, 640.0
    df["predkosc_wentylatora"], df["nast_spr"] = 70.0, setpoint
    df["nawiew"], df["wywiew"] = supply.astype(float), (~supply).astype(float)
    return df


@pytest.fixture
def record():
    return make_record()
