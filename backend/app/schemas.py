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
