"""
SIH26161 (NTRO) hydrodynamic modelling package.

Modules
-------
breach : parametric dam-breach parameterisation and Q(t) hydrograph
engine : ANUGA 4.x 2D shallow-water solver driving real DEMs
"""

from .breach import (BreachParams, breach_hydrograph, froehlich_2008,
                     macdonald_langridge, von_thun_gillette,
                     peak_discharge_estimate)
from .engine import run_dam_break, ANUGA_VERSION

__all__ = [
    "BreachParams",
    "breach_hydrograph",
    "froehlich_2008",
    "macdonald_langridge",
    "von_thun_gillette",
    "peak_discharge_estimate",
    "run_dam_break",
    "ANUGA_VERSION",
]
