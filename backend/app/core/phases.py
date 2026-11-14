"""Supply/exhaust flags: reconstruction where the logger did not record them.

Port of uzupelnienie_nawiew_wywiew.py: from an anchor row, walk back in time and write the flags,
switching them every half-cycle. The script hard-coded the anchor (row 220795), the state at the
anchor (supply 0, exhaust 1) and the half-cycle (120 s); here they are parameters, and `suggest`
reads them off the part of the record where the flags were logged.
"""
from dataclasses import dataclass

import numpy as np
import pandas as pd


@dataclass(frozen=True)
class Plan:
    anchor: pd.Timestamp     # first row of a logged half-cycle
    supply: bool             # state that starts at the anchor
    half_s: float            # half-cycle length
    missing: int             # rows without flags before the anchor


def _known(df: pd.DataFrame) -> pd.Series:
    return df["nawiew"].notna() & df["wywiew"].notna()


def half_cycle(df: pd.DataFrame) -> float | None:
    """Median length of the logged half-cycles [s]."""
    k = df[_known(df)]
    if len(k) < 3:
        return None
    sup = k["nawiew"].to_numpy() == 1
    switches = k.index[1:][sup[1:] != sup[:-1]]
    if len(switches) < 3:
        return None
    return float(np.median(np.diff(switches.values).astype("timedelta64[ms]").astype(float)) / 1000)


def suggest(df: pd.DataFrame) -> Plan | None:
    """Anchor at the first switch logged after the first block of rows without flags."""
    known = _known(df).to_numpy()
    if known.all() or not known.any():
        return None
    first_missing = int(np.argmin(known))
    after = np.flatnonzero(known[first_missing:])
    if not len(after):
        return None
    start = first_missing + int(after[0])
    sup = (df["nawiew"].to_numpy() == 1)
    for i in range(start + 1, len(df)):
        if not known[i]:
            break
        if sup[i] != sup[i - 1]:
            h = half_cycle(df.iloc[start:])
            if h is None:
                return None
            return Plan(df.index[i], bool(sup[i]), h, int((~known[:i]).sum()))
    return None


def reconstruct(df: pd.DataFrame, anchor, supply: bool, half_s: float, only_missing: bool = True) -> pd.DataFrame:
    """Flags for all rows before `anchor`, switching every `half_s` going back in time.

    A row at time t lies n = ceil((anchor - t) / half_s) half-cycles back: odd n has the opposite
    state to the one starting at the anchor, even n the same.
    """
    anchor = pd.Timestamp(anchor)
    out = df.copy()
    before = out.index < anchor
    back = (anchor - out.index[before]).total_seconds().to_numpy()
    n = np.ceil(back / half_s - 1e-9).astype(int)
    is_supply = np.where(n % 2 == 1, not supply, supply)
    target = before.copy()
    if only_missing:
        target &= ~_known(out).to_numpy()
    sel = target[before]
    rows = np.flatnonzero(target)
    out.iloc[rows, out.columns.get_loc("nawiew")] = is_supply[sel].astype(float)
    out.iloc[rows, out.columns.get_loc("wywiew")] = (~is_supply[sel]).astype(float)
    return out


def reconstruct_as_script(df: pd.DataFrame, start_row: int, half_s: float = 120.0,
                          state: tuple[int, int] = (0, 1)) -> pd.DataFrame:
    """Literal port of the loop in uzupelnienie_nawiew_wywiew.py (kept for comparison and tests)."""
    out = df.copy()
    t = out.index
    nav, wyw = state
    current = t[start_row]
    jn, jw = out.columns.get_loc("nawiew"), out.columns.get_loc("wywiew")
    for i in range(start_row, 1, -1):
        out.iat[i, jn], out.iat[i, jw] = nav, wyw
        if t[i] < current - pd.Timedelta(seconds=half_s):
            current = t[i]
            nav, wyw = wyw, nav
    return out
