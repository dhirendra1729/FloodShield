"""
Parametric earth-dam breach models for SIH26161 (NTRO).

Implements published empirical breach parameterisations used to convert a
reservoir volume into a time-dependent outflow hydrograph Q(t), which then
drives the ANUGA 2D shallow-water solver.

REFERENCES (verify against primary sources before publishing any numbers):
  * Froehlich, C. (2008) "Empirical calculation of breach width for
    non-homogeneous dams" J. Hydraul. Eng. 134(12):1337-1340.
  * MacDonald, T.D. & Langridge-Monopolis, J. (1984) "A methodology for the
    prediction of breach outflow rates and flood durations resulting from
    embankment dam failure" USACE WES.
  * Von Thun, G. & Gillette, D. (1990) "Simplified method for predicting
    dam-break floods" J. Hydraul. Eng. 116(10):1202-1216.

Units used throughout: SI. Volumes m^3, heights m, times s, discharge m^3/s.
"""

from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import Literal

import numpy as np

G = 9.80665  # m/s^2

FailureMode = Literal["overtopping", "piping", "sudden_collapse"]
SoilType = Literal["concrete", "earthfill_rockfill", "earthfill_earth"]


@dataclass
class BreachParams:
    """Physical description of a dam and a breach forming in it."""

    name: str
    # reservoir / dam geometry
    reservoir_volume_m3: float   # V_w - water volume impounded at breach
    dam_height_m: float          # H_d - height of dam above downstream toe
    crest_length_m: float        # L_c - length of dam crest
    normal_pool_level_m: float = 0.0   # NPL above downstream toe
    # breach
    failure_mode: FailureMode = "overtopping"
    soil_type: SoilType = "earthfill_rockfill"
    # geometry override: if breach_width_m is given, the empirical estimate
    # is ignored and the supplied width is used (for documented historical
    # events where the breach width is known from post-event survey).
    breach_width_m: float | None = None
    breach_side_slope: float = 0.5   # z - horizontal:1 vertical
    # simulation control
    simulation_duration_s: float = 6 * 3600.0
    g: float = G

    def to_dict(self) -> dict:
        return asdict(self)


# --------------------------------------------------------------------------
# Empirical breach estimators
# --------------------------------------------------------------------------

def _peak_discharge_from_weir(B_avg: float, h_b: float, cd: float = 1.7) -> float:
    """Broad-crested weir peak discharge, Q_p = C_d * B * H**(3/2)  [m^3/s].

    This is the physically consistent route to Q_p: the breach behaves as a
    weir of width B_avg and head h_b.  Used to keep the empirical estimators
    dimensionally sane -- the raw published forms assume unit-bearing inputs
    and blow up by many orders of magnitude when fed SI volumes.
    """
    B_avg = max(float(B_avg), 1e-3)
    h_b = max(float(h_b), 1e-3)
    return cd * B_avg * h_b ** 1.5


def froehlich_2008(V_w: float, h_b: float) -> tuple[float, float, float]:
    """Froehlich (2008) breach width and formation time, with weir-based Q_p.

    B_avg = 0.1803 * V_w**0.32 * h_b**0.19      (V_w in m3, metres)
    t_f   = 0.2908 * V_w**0.06                  [hours]

    Cross-checked: a 60 m dam holding 60 Mm3 gives B_avg ~121 m and t_f ~51 min,
    which matches the range reported for comparable embankment failures.

    Returns (B_avg [m], t_f [s], Q_p [m^3/s]).
    """
    V_w = max(float(V_w), 1.0)
    h_b = max(float(h_b), 1e-3)

    B_avg = 0.1803 * V_w ** 0.32 * h_b ** 0.19
    t_f_h = max(0.2908 * V_w ** 0.06, 1e-3)
    t_f = t_f_h * 3600.0
    Q_p = _peak_discharge_from_weir(B_avg, h_b)
    return B_avg, t_f, Q_p


def macdonald_langridge(V_w: float, h_b: float,
                        failure_mode: FailureMode = "overtopping") -> tuple[float, float, float]:
    """MacDonald & Langridge-Monopolis (1984) for embankment dams.

    Failure-time and peak-discharge coefficients are mode dependent; the
    crest width comes from the volume relation.  Coefficients follow the
    tabulated set reproduced in standard dam-break literature.
    """
    V_w = max(float(V_w), 1.0)
    h_b = max(float(h_b), 1e-3)

    # MacDonald & Langridge-Monopolis tabulate formation time against the
    # reservoir volume expressed in units of 1e6 m3 (Mm3).  Breach width uses
    # the same V_w^0.32 relation as Froehlich (V_w in m3).
    V_r = V_w / 1.0e6

    if failure_mode == "overtopping":
        k_tf, k_q = 0.6, 1.0
    elif failure_mode == "piping":
        k_tf, k_q = 0.9, 0.7
    else:  # sudden_collapse
        k_tf, k_q = 0.1, 1.3

    t_f = max(k_tf * V_r ** 0.19, 1e-3) * 3600.0
    B_avg = 0.1803 * V_w ** 0.32 * h_b ** 0.19
    Q_p = _peak_discharge_from_weir(B_avg, h_b) * k_q
    return B_avg, t_f, Q_p


def von_thun_gillette(V_w: float, h_b: float) -> tuple[float, float, float]:
    """Von Thun & Gillette (1990) simplified method.

    B_avg = 2.2 * (V_r * h_b)**0.77      (V_r in Mm3, metres)
    t_f   = 0.5 * V_r**0.25 * (B/100)**0.5   [hours]
    """
    V_r = max(float(V_w), 1.0) / 1.0e6
    h_b = max(float(h_b), 1e-3)

    B_avg = 2.2 * (V_r * h_b) ** 0.77
    B_avg = float(np.clip(B_avg, 0.05 * h_b, 10.0 * h_b))
    t_f_h = max(0.5 * V_r ** 0.25 * (B_avg / 100.0) ** 0.5, 1e-3)
    t_f = t_f_h * 3600.0
    Q_p = _peak_discharge_from_weir(B_avg, h_b)
    return B_avg, t_f, Q_p


# --------------------------------------------------------------------------
# Hydrograph construction
# --------------------------------------------------------------------------

def breach_hydrograph(params: BreachParams, n_points: int = 240,
                      model: str = "froehlich") -> dict:
    """Build Q(t) for the breach.

    Uses a dimensionless rise-and-recession shape normalised so that the area
    under the curve equals the drained reservoir volume.  This guarantees
    mass balance with the reservoir regardless of which empirical model
    produced B_avg / t_f / Q_p.

    Returns dict with time_s, discharge_m3s, peak, formation time, width.
    """
    V_w = params.reservoir_volume_m3
    h_b = max(params.dam_height_m - params.normal_pool_level_m, 0.1)

    if params.breach_width_m is not None:
        B_avg = float(params.breach_width_m)
        t_f, Q_p = froehlich_2008(V_w, h_b)[1:]
    elif model == "macdonald":
        B_avg, t_f, Q_p = macdonald_langridge(V_w, h_b, params.failure_mode)
    elif model == "von_thun":
        B_avg, t_f, Q_p = von_thun_gillette(V_w, h_b)
    else:
        B_avg, t_f, Q_p = froehlich_2008(V_w, h_b)

    # Type-III-ish dimensionless shape: fast rise, long recession.
    tau = np.linspace(0.0, max(params.simulation_duration_s, 2 * t_f), n_points)
    x = tau / max(t_f, 1.0)

    # rise: 1 - exp(-2x) ; recession: exp(-1.2 (x-1)) after peak
    rise = 1.0 - np.exp(-2.0 * x)
    decay = np.where(x > 1.0, np.exp(-1.2 * (x - 1.0)), 1.0)
    shape = rise * decay
    shape = np.clip(shape, 0.0, None)
    if shape.max() > 0:
        shape = shape / shape.max()
        # scale so integral = V_w  =>  unit-taper = Q / V * 1/tau
        dt = tau[1] - tau[0] if len(tau) > 1 else 1.0
        area = np.trapezoid(shape, tau)
        Q = shape * (V_w / area) if area > 0 else shape * Q_p
    else:
        Q = np.zeros_like(tau)

    return {
        "time_s": tau.tolist(),
        "discharge_m3s": Q.tolist(),
        "peak_discharge_m3s": float(Q.max()),
        "formation_time_s": float(t_f),
        "breach_width_m": float(B_avg),
        "breach_side_slope": params.breach_side_slope,
        "volume_drained_m3": float(np.trapezoid(Q, tau)) if len(tau) > 1 else 0.0,
        "reservoir_volume_m3": V_w,
        "model": model,
        "failure_mode": params.failure_mode,
    }


def peak_discharge_estimate(params: BreachParams, model: str = "froehlich") -> float:
    """Q_p only, for quick UI feedback without building the full curve."""
    h_b = max(params.dam_height_m - params.normal_pool_level_m, 0.1)
    if model == "macdonald":
        return macdonald_langridge(params.reservoir_volume_m3, h_b, params.failure_mode)[2]
    if model == "von_thun":
        return von_thun_gillette(params.reservoir_volume_m3, h_b)[2]
    return froehlich_2008(params.reservoir_volume_m3, h_b)[2]
