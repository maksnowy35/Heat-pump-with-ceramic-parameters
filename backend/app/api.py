import math

import numpy as np
import pandas as pd
from fastapi import APIRouter, File, HTTPException, UploadFile

from . import __version__, store
from .core import cop, dataset, series
from .schemas import (
    Block, BlocksRequest, BlocksResponse, BlockSummary, CopParams, CumulativeRequest,
    CumulativeResponse, DatasetInfo, Gap, Segment,
)

router = APIRouter()

MAX_UPLOAD_MB = 200


def _num(v) -> float | None:
    return None if v is None or not math.isfinite(float(v)) else float(v)


def _ds(ds_id: str) -> store.Dataset:
    ds = store.get(ds_id)
    if ds is None:
        raise HTTPException(404, f"unknown dataset '{ds_id}'")
    return ds


def _info(ds: store.Dataset) -> DatasetInfo:
    s = dataset.summarize(ds.frame)
    return DatasetInfo(
        id=ds.id, name=ds.name, source=ds.source, files=ds.files, created=ds.created,
        rows=s.rows, start=s.start, end=s.end, sampling_s=s.sampling_s,
        gaps=[Gap(start=a, end=b, hours=h) for a, b, h in s.gaps],
        missing_flags=s.missing_flags, compressor_on=s.compressor_on,
        t_out_min=_num(s.t_out_range[0]), t_out_max=_num(s.t_out_range[1]),
        completeness=s.completeness,
    )


def _settings(p: CopParams) -> cop.CopSettings:
    return cop.CopSettings(flow=p.flow, aux_kw=p.aux_kw, min_setpoint=p.min_setpoint,
                           cop_min=p.cop_min, cop_max=p.cop_max)


def _window(df: pd.DataFrame, start, minutes: float) -> pd.DataFrame:
    t0 = pd.Timestamp(start).tz_localize(None)
    w = df.loc[t0: t0 + pd.Timedelta(minutes=minutes)]
    if w.empty:
        raise HTTPException(422, f"no data between {t0} and {t0 + pd.Timedelta(minutes=minutes)}")
    return w


@router.get("/health")
def health():
    return {"status": "ok", "version": __version__}


@router.get("/datasets", response_model=list[DatasetInfo])
def list_datasets():
    return [_info(d) for d in store.all()]


@router.get("/datasets/{ds_id}", response_model=DatasetInfo)
def get_dataset(ds_id: str):
    return _info(_ds(ds_id))


@router.post("/datasets", response_model=DatasetInfo)
async def upload(files: list[UploadFile] = File(...)):
    raw = []
    for f in files:
        data = await f.read()
        if len(data) > MAX_UPLOAD_MB * 1024 * 1024:
            raise HTTPException(413, f"{f.filename}: larger than {MAX_UPLOAD_MB} MB")
        raw.append((f.filename or "report.xlsx", data))
    try:
        frame = dataset.derive(dataset.load(raw))
    except dataset.DatasetError as e:
        raise HTTPException(422, str(e)) from e
    if frame.empty:
        raise HTTPException(422, "no rows with a valid timestamp")
    names = [n for n, _ in raw]
    return _info(store.add(" + ".join(names), frame, names))


@router.post("/datasets/{ds_id}/blocks", response_model=BlocksResponse)
def blocks(ds_id: str, req: BlocksRequest):
    w = _window(_ds(ds_id).frame, req.start, req.minutes)
    b = cop.blocks(w, _settings(req.cop))
    out = [
        Block(
            start=i.isoformat(), minutes=r.minutes, q_kwh=r.Q, w_kwh=r.W, w_total_kwh=r.W_total,
            setpoint=_num(r.nast_spr), p_comp=_num(r.P), t_out=_num(r.t3),
            cop=_num(r.cop), cop_total=_num(r.cop_total), valid=bool(r.valid),
            valid_total=bool(r.valid_total), complete=bool(r.complete), cop_plot=_num(r.cop_plot),
            cop_total_plot=_num(r.cop_total_plot),
        )
        for i, r in b.iterrows()
    ]
    return BlocksResponse(start=w.index[0].isoformat(), end=w.index[-1].isoformat(), blocks=out,
                          summary=BlockSummary(**cop.block_summary(b)))


@router.post("/datasets/{ds_id}/cumulative", response_model=CumulativeResponse)
def cumulative(ds_id: str, req: CumulativeRequest):
    df = _ds(ds_id).frame
    c = cop.cumulative(df, _settings(req.cop))
    origin = df.index[0]
    view = series.bucket(c[["cop_smooth", "cop_total_smooth", "t3", "p_ssania", "p_tloczenia"]],
                         req.max_points)
    hours = (view.index - origin).total_seconds() / 3600

    def h(ts) -> float:
        return round((ts - origin).total_seconds() / 3600, 3)

    s = dataset.summarize(df)
    return CumulativeResponse(
        origin=origin.isoformat(),
        hours=series.values(hours, 3),
        cop=series.values(view["cop_smooth"]),
        cop_total=series.values(view["cop_total_smooth"]),
        t3=series.values(view["t3"], 2),
        p_suction=series.values(view["p_ssania"], 3),
        p_discharge=series.values(view["p_tloczenia"], 3),
        off=[Segment(start=h(a), end=h(b)) for a, b in cop.off_segments(df)],
        gaps=[Segment(start=h(pd.Timestamp(a)), end=h(pd.Timestamp(b))) for a, b, _ in s.gaps],
        final_cop=_num(c["cop"].iloc[-1]),
        final_cop_total=_num(c["cop_total"].iloc[-1]),
    )
