import json
import math
from pathlib import Path

import numpy as np
import pandas as pd
from fastapi import APIRouter, File, HTTPException, UploadFile

from . import __version__, store
from .core import cop, dataset, modbus, ntc, phases, regenerator, series, window, windows
from .schemas import (
    Block, BlocksRequest, BlocksResponse, BlockSummary, CandidateOut, CheckRequest, CopParams,
    CoverageOut, CumulativeRequest, CumulativeResponse, CycleTotals, DatasetInfo, Gap, PhasePlan,
    PhasePreview, PhaseSuggestion, Segment, WindowRequest, WindowResponse,
    CopTPoint, CopTRequest, FrameByte, ModbusExchange, ModbusRead, ModbusScan, ModbusStatus, ModbusWrite,
    NtcModel, NtcReading, NtcRequest, NtcResponse, RegeneratorRequest, RegeneratorResponse, RegeneratorRow,
    ScanHit,
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
    return cop.settings(p.mode, flow=p.flow, aux_kw=p.aux_kw, min_setpoint=p.min_setpoint,
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


WINDOW_COLUMNS = [
    "t1", "t2", "t3", "t4", "t5", "rh_1", "rh_2", "rh_3", "rh_4", "rh_5", "i_1", "i_2", "i_3", "i_4", "i_5",
    "p_ssania", "p_tloczenia", "t_ssania", "t_tloczenie", "t_parowania", "t_skraplania",
    "t_sat_suction", "t_sat_discharge", "superheat", "superheat_ctrl", "Moc_Czynna", "p_total",
    "nast_spr", "q_kw", "cop_running", "cop_total_running",
]


@router.post("/datasets/{ds_id}/window", response_model=WindowResponse)
def window_series(ds_id: str, req: WindowRequest):
    df = _ds(ds_id).frame
    start = pd.Timestamp(req.start).tz_localize(None)
    if req.align_to_cycle:
        aligned = window.cycle_start(df, start)
        if aligned is None:
            raise HTTPException(422, f"no supply half-cycle starts after {start}")
        start = aligned
    w = window.series(df, start, req.minutes, _settings(req.cop))
    if w.empty:
        raise HTTPException(422, f"no data between {start} and {start + pd.Timedelta(minutes=req.minutes)}")
    totals = window.cycle_totals(w, _settings(req.cop))
    view = series.bucket(w[WINDOW_COLUMNS + ["seconds", "nawiew"]], req.max_points)
    return WindowResponse(
        start=w.index[0].isoformat(), end=w.index[-1].isoformat(), rows=len(w),
        seconds=series.values((view.index - w.index[0]).total_seconds(), 1),
        supply=series.values(view["nawiew"], 2),
        series={c: series.values(view[c], 4) for c in WINDOW_COLUMNS},
        totals=CycleTotals(**totals),
    )


@router.get("/datasets/{ds_id}/phases", response_model=PhaseSuggestion)
def phase_suggestion(ds_id: str):
    df = _ds(ds_id).frame
    plan = phases.suggest(df)
    missing = int((df["nawiew"].isna() | df["wywiew"].isna()).sum())
    return PhaseSuggestion(
        plan=PhasePlan(anchor=plan.anchor.to_pydatetime(), supply=plan.supply, half_s=plan.half_s) if plan else None,
        missing=missing, half_s_logged=_num(phases.half_cycle(df)),
    )


@router.post("/datasets/{ds_id}/phases/preview", response_model=PhasePreview)
def phase_preview(ds_id: str, plan: PhasePlan, minutes: float = 8):
    df = _ds(ds_id).frame
    anchor = pd.Timestamp(plan.anchor).tz_localize(None)
    rebuilt = phases.reconstruct(df, anchor, plan.supply, plan.half_s)
    lo, hi = anchor - pd.Timedelta(minutes=minutes * 0.75), anchor + pd.Timedelta(minutes=minutes * 0.25)
    sel = (df.index >= lo) & (df.index < hi)
    w, r = df[sel], rebuilt[sel]
    if w.empty:
        raise HTTPException(422, "no data around the anchor")
    filled = int(df["nawiew"].isna().sum() - rebuilt["nawiew"].isna().sum())
    return PhasePreview(
        seconds=series.values((w.index - anchor).total_seconds(), 1), t2=series.values(w["t2"], 2),
        supply_logged=series.values(w["nawiew"], 0), supply_rebuilt=series.values(r["nawiew"], 0),
        origin=anchor.isoformat(), filled=filled,
    )


@router.post("/datasets/{ds_id}/phases/apply", response_model=DatasetInfo)
def phase_apply(ds_id: str, plan: PhasePlan):
    ds = _ds(ds_id)
    anchor = pd.Timestamp(plan.anchor).tz_localize(None)
    frame = phases.reconstruct(ds.frame, anchor, plan.supply, plan.half_s)
    return _info(store.replace(ds.id, frame))


@router.post("/datasets/{ds_id}/windows/check", response_model=list[CoverageOut])
def windows_check(ds_id: str, req: CheckRequest):
    df = _ds(ds_id).frame
    out = []
    for w in req.windows:
        c = windows.check(df, pd.Timestamp(w.start).tz_localize(None), w.minutes, req.tolerance_s)
        fields = dict(c.__dict__)
        fields["t3_mean"] = _num(c.t3_mean)
        fields["t3_std"] = _num(c.t3_std)
        out.append(CoverageOut(**fields))
    return out


@router.get("/datasets/{ds_id}/windows/suggest", response_model=list[CandidateOut])
def windows_suggest(ds_id: str, minutes: int = 30, n: int = 8):
    if not (5 <= minutes <= 240 and 1 <= n <= 30):
        raise HTTPException(422, "minutes must be 5-240 and n 1-30")
    return [CandidateOut(**c.__dict__) for c in windows.suggest(_ds(ds_id).frame, minutes, n)]


@router.post("/datasets/{ds_id}/reset", response_model=DatasetInfo)
def reset(ds_id: str):
    """Regenerate the demo record (undo reconstructed flags)."""
    if ds_id != store.DEMO:
        raise HTTPException(422, "only the demo record can be reset")
    store.reset_demo()
    return _info(_ds(store.DEMO))


# ---------------------------------------------------------------- COP against outdoor temperature

@router.post("/datasets/{ds_id}/cop-vs-tout", response_model=list[CopTPoint])
def cop_vs_tout(ds_id: str, req: CopTRequest):
    df = _ds(ds_id).frame
    starts = [pd.Timestamp(w).tz_localize(None) for w in req.windows] if req.windows else \
        [pd.Timestamp(c.start) for c in windows.suggest(df, int(req.minutes), 10)]
    out = []
    for t0 in starts:
        w = df.loc[t0: t0 + pd.Timedelta(minutes=req.minutes)]
        if w.empty:
            continue
        s = cop.block_summary(cop.blocks(w, _settings(req.cop)))
        out.append(CopTPoint(start=t0.isoformat(), t_out=_num(s["t_out"]), cop=_num(s["cop"]),
                             cop_total=_num(s["cop_total"]), p_comp=_num(s["p_comp"]),
                             valid=s["valid"], blocks=s["blocks"]))
    return sorted(out, key=lambda p: (p.t_out is None, p.t_out))


# ---------------------------------------------------------------- NTC

DATA = Path(__file__).resolve().parent / "data"
NTC5K = json.loads((DATA / "ntc5k.json").read_text(encoding="utf-8"))


@router.get("/ntc/preset")
def ntc_preset():
    return NTC5K


@router.post("/ntc", response_model=NtcResponse)
def ntc_analyse(req: NtcRequest):
    table = sorted(req.table or [tuple(x) for x in NTC5K["table"]])
    if len(table) < 3:
        raise HTTPException(422, "the R-T table needs at least 3 points")
    t = np.array([p[0] for p in table])
    r = np.array([p[1] for p in table])
    if np.any(r <= 0) or np.any(np.diff(r) >= 0):
        raise HTTPException(422, "resistance must be positive and fall with temperature (NTC)")
    beta = ntc.fit_beta(t, r)
    sh = ntc.fit_steinhart_hart(t, r)
    by_t = dict(zip(t.tolist(), r.tolist()))
    b_values = {}
    for t2 in (50.0, 85.0, 100.0):
        if 25.0 in by_t and t.min() <= t2 <= t.max():
            r2 = by_t.get(t2)
            if r2 is None:  # between table points: interpolate ln R against 1/T
                r2 = float(np.exp(np.interp(1 / (t2 + 273.15), 1 / (t[::-1] + 273.15), np.log(r[::-1]))))
            b_values[f"B25/{t2:.0f}"] = ntc.beta_between(25.0, by_t[25.0], t2, r2)

    grid = np.linspace(t.min(), t.max(), 121)
    mids, errs = [], []
    for x in np.linspace(t.min(), t.max(), 241):
        rx = float(np.exp(np.interp(1 / (x + 273.15), 1 / (t[::-1] + 273.15), np.log(r[::-1]))))
        mids.append(round(float(x), 2))
        errs.append(round(ntc.table_temperature(table, rx) - ntc.log_table_temperature(table, rx), 4))

    reading = None
    rr = req.resistance or (ntc.resistance_from_current(req.current_ma, req.supply_v) if req.current_ma else None)
    if rr:
        reading = NtcReading(
            resistance=rr, t_linear=_num(ntc.table_temperature(table, rr)),
            t_log=_num(ntc.log_table_temperature(table, rr)),
            t_beta=float(beta.temperature(rr)), t_steinhart_hart=float(sh.temperature(rr)),
        )
    return NtcResponse(
        table=table,
        models=[
            NtcModel(name="Beta", params={"R25": beta.r25, "B": beta.beta},
                     max_error=float(np.abs(ntc.residuals(beta, t, r)).max())),
            NtcModel(name="Steinhart-Hart", params={"A": sh.a, "B": sh.b, "C": sh.c},
                     max_error=float(np.abs(ntc.residuals(sh, t, r)).max())),
        ],
        b_values=b_values,
        datasheet_b=NTC5K["datasheet_beta"] if req.table is None else {},
        curve_t=series.values(grid, 2),
        curve_r={"beta": series.values(beta.resistance(grid), 1),
                 "steinhart_hart": series.values(sh.resistance(grid), 1)},
        interp_t=mids, interp_error=errs, reading=reading,
    )


# ---------------------------------------------------------------- Modbus

_SIM = modbus.Simulator()


def _link():
    s = modbus.settings_from_env()
    return _SIM if s.port == "simulator" else modbus.Serial(s)


def _exchange(x: modbus.Exchange) -> ModbusExchange:
    return ModbusExchange(
        ok=x.ok, values=x.values, error=x.error,
        request=x.request.hex(" ").upper(), response=x.response.hex(" ").upper() if x.response else None,
        request_fields=[FrameByte(**f) for f in modbus.describe(x.request)],
        response_fields=[FrameByte(**f) for f in modbus.describe(x.response)] if x.response else [],
    )


@router.get("/modbus", response_model=ModbusStatus)
def modbus_status():
    s = modbus.settings_from_env()
    return ModbusStatus(port=s.port, simulated=s.port == "simulator", baudrate=s.baudrate, parity=s.parity,
                        timeout=s.timeout, writes_allowed=modbus.writes_allowed())


@router.post("/modbus/read", response_model=ModbusExchange)
def modbus_read(req: ModbusRead):
    return _exchange(_link().read(req.unit, req.kind, req.address, req.count))


@router.post("/modbus/write", response_model=ModbusExchange)
def modbus_write(req: ModbusWrite):
    if not modbus.writes_allowed():
        raise HTTPException(403, "writing to a real controller is off; set MODBUS_ALLOW_WRITE=1 to allow it")
    return _exchange(_link().write(req.unit, req.address, req.value))


@router.post("/modbus/scan", response_model=list[ScanHit])
def modbus_scan(req: ModbusScan):
    if req.unit_to < req.unit_from or req.unit_to - req.unit_from > 64:
        raise HTTPException(422, "scan at most 64 unit ids, from <= to")
    return [ScanHit(**h) for h in modbus.scan(_link(), range(req.unit_from, req.unit_to + 1), req.address)]


# ---------------------------------------------------------------- regenerator

REGEN_THESIS = json.loads((DATA / "regenerator_thesis.json").read_text(encoding="utf-8"))


@router.post("/regenerator", response_model=RegeneratorResponse)
def regenerator_calc(req: RegeneratorRequest):
    rows = list(regenerator.RegeneratorInput().rows)
    rows[0] = regenerator.Row(rows[0].n_blocks, req.length_top, rows[0].block_mass * req.length_top / 0.300, "top")
    if req.length_bottom > 0:
        rows[1] = regenerator.Row(rows[1].n_blocks, req.length_bottom,
                                  rows[1].block_mass * req.length_bottom / 0.074, "bottom")
    else:
        rows = rows[:1]
    inp = regenerator.RegeneratorInput(
        cells=req.cells, channel_to_wall=req.channel_to_wall, rows=tuple(rows), mass_flow=req.mass_flow,
        heat_capacity=req.heat_capacity, half_cycle=req.half_cycle, fan_efficiency=req.fan_efficiency,
    )
    res = regenerator.compute(inp)
    d = regenerator.to_dict(res)
    rows_out = [RegeneratorRow(**{k: r[k] for k in RegeneratorRow.model_fields}) for r in d.pop("rows")]
    tt = np.linspace(0, max(240.0, 2 * req.half_cycle), 121)
    return RegeneratorResponse(
        values={k: float(v) for k, v in d.items()}, rows=rows_out,
        thesis={k: float(v) for k, v in REGEN_THESIS.items() if k != "note"},
        curve_t=series.values(tt, 1),
        captured_tau=series.values(1 - np.exp(-tt / res.tau), 4),
        captured_bed=series.values(1 - np.exp(-tt / res.tau_bed), 4),
    )
