from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import __version__
from .api import router

app = FastAPI(
    title="Heat pump with ceramic regenerator - API",
    version=__version__,
    description=(
        "Analysis of the logger reports of a reversible ventilation unit with a ceramic regenerator "
        "and an R290 heat pump: enthalpies, COP per 2-minute block, cumulative COP."
    ),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4200"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api/v1")
