"""Ceramic fixed-bed regenerator: channel geometry, heat transfer, pressure drop, heat capacity.

Port of section 4.4 of the thesis ("Wpływ ceramicznych bloków na wydajność urządzenia").
Blocks are square honeycombs with `cells x cells` square channels; the channel side is
`channel_to_wall` times the wall thickness. Laminar, fully developed flow in square ducts:
Nu = 3.61 (constant wall temperature), Darcy f Re = 56.9.
"""
import json
from dataclasses import asdict, dataclass, field
from functools import cache
from pathlib import Path

import numpy as np

DATA = Path(__file__).resolve().parent.parent / "data"


@dataclass(frozen=True)
class Row:
    n_blocks: int
    length: float       # m, in the flow direction
    block_mass: float   # kg
    name: str = ""


@cache
def device() -> dict:
    return json.loads((DATA / "device.json").read_text(encoding="utf-8"))


def _default_rows() -> tuple[Row, ...]:
    rows = device()["ceramic"]["rows"]
    return tuple(Row(r["n_blocks"], r["length_m"], r["block_mass_kg"], r["name"]) for r in rows)


@dataclass(frozen=True)
class RegeneratorInput:
    block_side: float = 0.150        # m, outer side of a block
    frame: float = 0.0002            # m, outer wall per edge
    cells: int = 60                  # channels per side
    channel_to_wall: float = 8.0     # a / t
    rows: tuple[Row, ...] = field(default_factory=_default_rows)
    mass_flow: float = 0.468         # kg/s
    rho: float = 1.2                 # kg/m3
    mu: float = 1.85e-5              # Pa s
    k_air: float = 0.026             # W/(m K)
    cp_air: float = 1006.0           # J/(kg K)
    nusselt: float = 3.61
    f_re: float = 56.9
    cp_ceramic: float = 880.0        # J/(kg K)
    heat_capacity: float | None = None   # J/K, overrides sum(n m cp); the thesis takes 95 kJ/K
    fan_efficiency: float = 0.5
    dp_reference: float = 98.0       # Pa, earlier assumption the thesis compares against
    half_cycle: float = 60.0         # s


@dataclass(frozen=True)
class RowResult:
    name: str
    n_channels: int
    wetted_area: float   # m2
    hA: float            # W/K
    friction: float      # Darcy f
    dp: float            # Pa
    heat_capacity: float # J/K


@dataclass(frozen=True)
class RegeneratorResult:
    pitch: float              # m
    wall: float               # m
    channel: float            # m (= hydraulic diameter)
    open_area_block: float    # m2
    open_area_row: float      # m2
    volume_flow: float        # m3/s
    velocity: float           # m/s, in the channels
    reynolds: float
    h: float                  # W/(m2 K)
    rows: list[RowResult]
    hA: float                 # W/K
    ntu: float
    dp: float                 # Pa, friction only, no minor losses
    fan_power_mech: float     # W
    fan_power_el: float       # W
    fan_saving_mech: float    # W vs dp_reference
    fan_saving_el: float      # W
    heat_capacity: float      # J/K
    tau: float                # s, C / hA (thesis, Eq. in 4.4 E)
    half_cycle_over_tau: float
    captured_fraction: float  # 1 - exp(-t_half / tau)
    tau_bed: float            # s, C / (m cp): time scale set by the air capacity rate
    utilization: float        # m cp t_half / C


def compute(inp: RegeneratorInput | None = None) -> RegeneratorResult:
    inp = inp or RegeneratorInput()
    pitch = (inp.block_side - 2 * inp.frame) / inp.cells
    wall = pitch / (inp.channel_to_wall + 1)
    a = inp.channel_to_wall * wall

    # as in the thesis: open fraction (a/p)^2 applied to the full block face
    open_block = inp.block_side**2 * (a / pitch) ** 2
    n_parallel = inp.rows[0].n_blocks  # rows are in series, blocks in a row in parallel
    open_row = n_parallel * open_block

    V = inp.mass_flow / inp.rho
    v = V / open_row
    re = inp.rho * v * a / inp.mu
    h = inp.nusselt * inp.k_air / a
    f = inp.f_re / re
    q_dyn = inp.rho * v**2 / 2

    rows = []
    for r in inp.rows:
        n = r.n_blocks * inp.cells**2
        A = n * 4 * a * r.length
        rows.append(RowResult(
            name=r.name, n_channels=n, wetted_area=A, hA=h * A, friction=f,
            dp=f * r.length / a * q_dyn, heat_capacity=r.n_blocks * r.block_mass * inp.cp_ceramic,
        ))

    hA = sum(r.hA for r in rows)
    dp = sum(r.dp for r in rows)
    C = inp.heat_capacity if inp.heat_capacity is not None else sum(r.heat_capacity for r in rows)
    mcp = inp.mass_flow * inp.cp_air
    tau = C / hA
    p_mech = V * dp

    return RegeneratorResult(
        pitch=pitch, wall=wall, channel=a, open_area_block=open_block, open_area_row=open_row,
        volume_flow=V, velocity=v, reynolds=re, h=h, rows=rows, hA=hA, ntu=hA / mcp, dp=dp,
        fan_power_mech=p_mech, fan_power_el=p_mech / inp.fan_efficiency,
        fan_saving_mech=V * (inp.dp_reference - dp),
        fan_saving_el=V * (inp.dp_reference - dp) / inp.fan_efficiency,
        heat_capacity=C, tau=tau, half_cycle_over_tau=inp.half_cycle / tau,
        captured_fraction=1 - np.exp(-inp.half_cycle / tau),
        tau_bed=C / mcp, utilization=mcp * inp.half_cycle / C,
    )


def half_cycle_for(fraction: float, tau: float) -> float:
    """Half-cycle [s] after which the lumped model C dT/dt = -hA (T - T_air) has given `fraction`."""
    return -tau * np.log(1 - fraction)


def to_dict(res: RegeneratorResult) -> dict:
    return asdict(res)
