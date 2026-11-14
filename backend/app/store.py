"""Datasets held in memory: the synthetic demo and whatever reports were uploaded in this session."""
import threading
import uuid
from dataclasses import dataclass, field
from datetime import datetime

import pandas as pd

from .core import dataset, synthetic

DEMO = "demo"
MAX_UPLOADS = 3


@dataclass
class Dataset:
    id: str
    name: str
    source: str                 # "demo" | "upload"
    frame: pd.DataFrame         # derived frame (channels + enthalpies + dt_h)
    files: list[str] = field(default_factory=list)
    created: str = field(default_factory=lambda: datetime.now().isoformat(timespec="seconds"))


_lock = threading.Lock()
_items: dict[str, Dataset] = {}


def _demo() -> Dataset:
    return Dataset(DEMO, "Synthetic demo record", "demo", dataset.derive(synthetic.generate()),
                   ["generated"])


def get(ds_id: str) -> Dataset | None:
    with _lock:
        if ds_id == DEMO and DEMO not in _items:
            _items[DEMO] = _demo()
        return _items.get(ds_id)


def all() -> list[Dataset]:
    get(DEMO)
    with _lock:
        return list(_items.values())


def add(name: str, frame: pd.DataFrame, files: list[str]) -> Dataset:
    ds = Dataset(uuid.uuid4().hex[:8], name, "upload", frame, files)
    with _lock:
        uploads = [k for k, v in _items.items() if v.source == "upload"]
        for k in uploads[: max(0, len(uploads) - MAX_UPLOADS + 1)]:
            del _items[k]
        _items[ds.id] = ds
    return ds


def replace(ds_id: str, frame: pd.DataFrame) -> Dataset:
    with _lock:
        ds = _items[ds_id]
        ds.frame = frame
        return ds


def reset_demo() -> None:
    with _lock:
        _items.pop(DEMO, None)
