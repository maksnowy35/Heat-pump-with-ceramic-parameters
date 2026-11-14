"""Logger reports: loading, merging and the derived columns every tool works on.

The test stand writes an Excel report with a timestamp ("dd.mm.yyyy HH:MM:SS") and 23 channels.
Older files call the temperatures t_1..t_5, newer ones t1..t5; both are accepted.
"""
import io
import re
from dataclasses import dataclass

import numpy as np
import pandas as pd

from . import psychro

TIME = "data_i_godzina"
TIME_FORMAT = "%d.%m.%Y %H:%M:%S"

CHANNELS = [
    "t1", "t2", "t3", "t4", "t5", "rh_1", "rh_2", "rh_3", "rh_4", "rh_5",
    "t_ssania", "t_tloczenie", "p_ssania", "p_tloczenia",
    "t_parowania", "t_skraplania", "Moc_Czynna",
    "Moc_Bierna", "Moc_Pozorna", "predkosc_wentylatora",
    "nast_spr", "nawiew", "wywiew",
]

CHANNEL_INFO = {
    "t1": ("T1", "°C", "air temperature, point 1"),
    "t2": ("T2", "°C", "air temperature, point 2 (supply side of the indoor exchanger)"),
    "t3": ("T3", "°C", "air temperature, point 3 (outdoor air)"),
    "t4": ("T4", "°C", "air temperature, point 4"),
    "t5": ("T5", "°C", "air temperature, point 5 (fan)"),
    "rh_1": ("RH1", "-", "relative humidity, point 1"),
    "rh_2": ("RH2", "-", "relative humidity, point 2"),
    "rh_3": ("RH3", "-", "relative humidity, point 3"),
    "rh_4": ("RH4", "-", "relative humidity, point 4"),
    "rh_5": ("RH5", "-", "relative humidity, point 5"),
    "t_ssania": ("t_suc", "°C", "refrigerant temperature, compressor suction"),
    "t_tloczenie": ("t_dis", "°C", "refrigerant temperature, compressor discharge"),
    "p_ssania": ("p_suc", "bar(g)", "suction pressure"),
    "p_tloczenia": ("p_dis", "bar(g)", "discharge pressure"),
    "t_parowania": ("t_evap", "°C", "evaporating temperature (controller)"),
    "t_skraplania": ("t_cond", "°C", "condensing temperature (controller)"),
    "Moc_Czynna": ("P", "W", "compressor active power"),
    "Moc_Bierna": ("Q_r", "var", "compressor reactive power"),
    "Moc_Pozorna": ("S", "VA", "compressor apparent power"),
    "predkosc_wentylatora": ("n_fan", "%", "fan speed"),
    "nast_spr": ("u_comp", "-", "compressor setpoint (0-1)"),
    "nawiew": ("supply", "0/1", "supply half-cycle flag"),
    "wywiew": ("exhaust", "0/1", "exhaust half-cycle flag"),
}


class DatasetError(ValueError):
    pass


def _key(name: str) -> str:
    """Header -> canonical channel name (t_1 -> t1, case and spaces ignored)."""
    k = re.sub(r"\s+", "", str(name)).lower()
    k = re.sub(r"^t_([1-5])$", r"t\1", k)
    k = re.sub(r"^rh([1-5])$", r"rh_\1", k)
    return k


_CANON = {_key(c): c for c in CHANNELS}


def _read(name: str, raw: bytes) -> pd.DataFrame:
    lower = name.lower()
    if lower.endswith((".xlsx", ".xlsm", ".xls")):
        return pd.read_excel(io.BytesIO(raw), engine="openpyxl")
    text = raw.decode("utf-8-sig", errors="replace")
    sep = ";" if text.split("\n", 1)[0].count(";") > text.split("\n", 1)[0].count(",") else ","
    return pd.read_csv(io.StringIO(text), sep=sep, decimal="," if sep == ";" else ".")


def normalize(df: pd.DataFrame, source: str = "") -> pd.DataFrame:
    """Name the columns, parse the timestamp, coerce numbers; returns a frame indexed by time."""
    df = df.copy()
    keys = [_key(c) for c in df.columns[1:]]
    if all(k in _CANON for k in keys) and len(keys) >= 3:
        df.columns = [TIME] + [_CANON[k] for k in keys]
    elif df.shape[1] == len(CHANNELS) + 1:
        df.columns = [TIME] + CHANNELS  # positional, as the original scripts did
    else:
        raise DatasetError(
            f"{source or 'file'}: expected a timestamp and {len(CHANNELS)} channels "
            f"({len(CHANNELS) + 1} columns), found {df.shape[1]}"
        )

    t = df[TIME]
    if not pd.api.types.is_datetime64_any_dtype(t):
        parsed = pd.to_datetime(t.astype(str).str.strip(), format=TIME_FORMAT, errors="coerce")
        if parsed.isna().mean() > 0.5:
            parsed = pd.to_datetime(t, dayfirst=True, errors="coerce")
        t = parsed
    df[TIME] = t
    df = df.dropna(subset=[TIME])
    for c in df.columns[1:]:
        df[c] = pd.to_numeric(df[c], errors="coerce")
    for c in CHANNELS:
        if c not in df:
            df[c] = np.nan
    return df.set_index(TIME)[CHANNELS]


def load(files: list[tuple[str, bytes]]) -> pd.DataFrame:
    """Read one or more reports and merge them in time order (duplicate timestamps dropped)."""
    if not files:
        raise DatasetError("no files")
    frames = []
    for name, raw in files:
        try:
            frames.append(normalize(_read(name, raw), name))
        except DatasetError:
            raise
        except Exception as e:  # unreadable file
            raise DatasetError(f"{name}: {e}") from e
    df = pd.concat(frames).sort_index()
    return df[~df.index.duplicated(keep="first")]


def derive(df: pd.DataFrame, p_atm: float = psychro.P_ATM) -> pd.DataFrame:
    """Add enthalpies i_1..i_5 [kJ/kg], delta_i = i_2 - i_3 and dt_h (time since previous row) [h]."""
    df = df.copy()
    for k in range(1, 6):
        rh = df[f"rh_{k}"]
        if rh.max(skipna=True) > 1.5:  # logged in % instead of a fraction
            rh = rh / 100.0
            df[f"rh_{k}"] = rh
        df[f"i_{k}"] = psychro.enthalpy(df[f"t{k}"].to_numpy(), rh.to_numpy(), p_atm)
    df["delta_i"] = df["i_2"] - df["i_3"]
    df["dt_h"] = df.index.to_series().diff().dt.total_seconds().div(3600).fillna(0).to_numpy()
    return df


@dataclass
class Summary:
    rows: int
    start: str
    end: str
    sampling_s: float
    gaps: list[tuple[str, str, float]]       # (from, to, hours) longer than gap_s
    missing_flags: int                        # rows without supply/exhaust flags
    compressor_on: float                      # fraction of rows with setpoint > 0
    t_out_range: tuple[float, float]
    completeness: dict[str, float]


def summarize(df: pd.DataFrame, gap_s: float = 600.0) -> Summary:
    idx = df.index
    dts = idx.to_series().diff().dt.total_seconds()
    gaps = []
    for end, d in dts[dts > gap_s].items():
        start = idx[idx.get_loc(end) - 1]
        gaps.append((start.isoformat(), end.isoformat(), round(d / 3600, 2)))
    flags = df[["nawiew", "wywiew"]]
    t3 = df["t3"]
    return Summary(
        rows=len(df),
        start=idx[0].isoformat() if len(df) else "",
        end=idx[-1].isoformat() if len(df) else "",
        sampling_s=float(dts.median()) if len(df) > 1 else 0.0,
        gaps=gaps,
        missing_flags=int(flags.isna().any(axis=1).sum()),
        compressor_on=float((df["nast_spr"] > 0).mean()) if len(df) else 0.0,
        t_out_range=(float(t3.min()), float(t3.max())) if t3.notna().any() else (np.nan, np.nan),
        completeness={c: float(df[c].notna().mean()) for c in CHANNELS},
    )


def to_excel(df: pd.DataFrame) -> bytes:
    """Write a frame back in the logger layout (timestamp text + 23 channels)."""
    out = df[CHANNELS].copy()
    out.insert(0, TIME, out.index.strftime(TIME_FORMAT))
    buf = io.BytesIO()
    out.to_excel(buf, index=False, engine="openpyxl")
    return buf.getvalue()
