from datetime import datetime

from pydantic import BaseModel, Field

Num = float | None


class CopParams(BaseModel):
    flow: float = Field(0.389, gt=0, le=5, description="factor in Q = flow * (i2 - i3)")
    aux_kw: float = Field(0.45, ge=0, le=5, description="fan + automation power, kW")
    min_setpoint: float = Field(0.20, ge=0, le=1)
    cop_min: float = Field(1.5, ge=0)
    cop_max: float = Field(12.0, gt=0)


class Gap(BaseModel):
    start: str
    end: str
    hours: float


class DatasetInfo(BaseModel):
    id: str
    name: str
    source: str
    files: list[str]
    created: str
    rows: int
    start: str
    end: str
    sampling_s: float
    gaps: list[Gap]
    missing_flags: int
    compressor_on: float
    t_out_min: Num
    t_out_max: Num
    completeness: dict[str, float]


class BlocksRequest(BaseModel):
    start: datetime
    minutes: float = Field(30, gt=0, le=24 * 60)
    cop: CopParams = CopParams()


class Block(BaseModel):
    start: str
    minutes: float
    q_kwh: float
    w_kwh: float
    w_total_kwh: float
    setpoint: Num
    p_comp: Num
    t_out: Num
    cop: Num
    cop_total: Num
    valid: bool
    valid_total: bool
    complete: bool
    cop_plot: Num
    cop_total_plot: Num


class BlockSummary(BaseModel):
    blocks: int
    valid: int
    cop: Num
    cop_total: Num
    cop_total_energy: Num
    p_comp: Num
    t_out: Num


class BlocksResponse(BaseModel):
    start: str
    end: str
    blocks: list[Block]
    summary: BlockSummary


class CumulativeRequest(BaseModel):
    cop: CopParams = CopParams()
    max_points: int = Field(1500, ge=100, le=20000)


class Segment(BaseModel):
    start: float   # h from the first row
    end: float


class CumulativeResponse(BaseModel):
    origin: str
    hours: list[Num]
    cop: list[Num]
    cop_total: list[Num]
    t3: list[Num]
    p_suction: list[Num]
    p_discharge: list[Num]
    off: list[Segment]
    gaps: list[Segment]
    final_cop: Num
    final_cop_total: Num


class WindowRequest(BaseModel):
    start: datetime
    minutes: float = Field(30, gt=0, le=24 * 60)
    align_to_cycle: bool = Field(False, description="move the start to the next supply half-cycle")
    cop: CopParams = CopParams()
    max_points: int = Field(3000, ge=100, le=20000)


class CycleTotals(BaseModel):
    q_kwh: float
    w_kwh: float
    w_total_kwh: float
    cop: Num
    cop_total: Num


class WindowResponse(BaseModel):
    start: str
    end: str
    rows: int
    seconds: list[Num]
    supply: list[Num]
    series: dict[str, list[Num]]
    totals: CycleTotals


class PhasePlan(BaseModel):
    anchor: datetime
    supply: bool = Field(description="state that starts at the anchor")
    half_s: float = Field(60, gt=1, le=3600)


class PhaseSuggestion(BaseModel):
    plan: PhasePlan | None
    missing: int
    half_s_logged: Num


class PhasePreview(BaseModel):
    seconds: list[Num]
    t2: list[Num]
    supply_logged: list[Num]
    supply_rebuilt: list[Num]
    origin: str
    filled: int


class WindowSpec(BaseModel):
    start: datetime
    minutes: float = Field(30, gt=0, le=24 * 60)


class CheckRequest(BaseModel):
    windows: list[WindowSpec]
    tolerance_s: float = Field(2, ge=0, le=600)


class CoverageOut(BaseModel):
    start: str
    end: str
    first: str | None
    rows: int
    coverage: float
    max_gap_s: float
    flags: float
    compressor: float
    t3_mean: Num
    t3_std: Num
    status: str


class CandidateOut(BaseModel):
    start: str
    minutes: int
    t3_mean: float
    t3_std: float
    p_std: float
    score: float


# ---- lab tools ----

class NtcRequest(BaseModel):
    table: list[tuple[float, float]] | None = Field(None, description="[[t °C, R Ω], ...]; default NTC 5k")
    resistance: float | None = Field(None, gt=0)
    current_ma: float | None = Field(None, gt=0)
    supply_v: float = Field(9.0, gt=0)


class NtcModel(BaseModel):
    name: str
    params: dict[str, float]
    max_error: float


class NtcReading(BaseModel):
    resistance: float
    t_linear: Num
    t_log: Num
    t_beta: float
    t_steinhart_hart: float


class NtcResponse(BaseModel):
    table: list[tuple[float, float]]
    models: list[NtcModel]
    b_values: dict[str, float]
    datasheet_b: dict[str, float]
    curve_t: list[float]
    curve_r: dict[str, list[float]]
    interp_t: list[float]
    interp_error: list[float]          # linear-in-R minus log interpolation, K
    reading: NtcReading | None


class ModbusStatus(BaseModel):
    port: str
    simulated: bool
    baudrate: int
    parity: str
    timeout: float
    writes_allowed: bool


class ModbusRead(BaseModel):
    unit: int = Field(1, ge=1, le=247)
    kind: str = Field("input", pattern="^(input|holding)$")
    address: int = Field(4036, ge=0, le=65535)
    count: int = Field(1, ge=1, le=125)


class ModbusWrite(BaseModel):
    unit: int = Field(1, ge=1, le=247)
    address: int = Field(4004, ge=0, le=65535)
    value: int = Field(2, ge=0, le=65535)


class ModbusScan(BaseModel):
    unit_from: int = Field(1, ge=1, le=247)
    unit_to: int = Field(31, ge=1, le=247)
    address: int = Field(3130, ge=0, le=65535)


class FrameByte(BaseModel):
    hex: str
    field: str


class ModbusExchange(BaseModel):
    ok: bool
    values: list[int]
    error: str | None
    request: str
    response: str | None
    request_fields: list[FrameByte]
    response_fields: list[FrameByte]


class ScanHit(BaseModel):
    unit: int
    kind: str
    value: int


class RegeneratorRequest(BaseModel):
    mass_flow: float = Field(0.468, gt=0, le=5)
    cells: int = Field(60, ge=5, le=200)
    channel_to_wall: float = Field(8.0, gt=0.5, le=50)
    length_top: float = Field(0.300, gt=0, le=2)
    length_bottom: float = Field(0.074, ge=0, le=2)
    heat_capacity: float | None = Field(None, gt=0, description="J/K; null = from the block masses")
    half_cycle: float = Field(60, gt=1, le=600)
    fan_efficiency: float = Field(0.5, gt=0, le=1)


class RegeneratorRow(BaseModel):
    name: str
    n_channels: int
    wetted_area: float
    hA: float
    dp: float
    heat_capacity: float


class RegeneratorResponse(BaseModel):
    values: dict[str, float]
    rows: list[RegeneratorRow]
    thesis: dict[str, float]
    curve_t: list[float]
    captured_tau: list[float]
    captured_bed: list[float]


class CopTRequest(BaseModel):
    windows: list[datetime] | None = Field(None, description="window starts; default: the suggested steady windows")
    minutes: float = Field(30, gt=0, le=240)
    cop: CopParams = CopParams()


class CopTPoint(BaseModel):
    start: str
    t_out: Num
    cop: Num
    cop_total: Num
    p_comp: Num
    valid: int
    blocks: int
