# FloodShield → SIH26161 (NTRO) — Research Findings & Implementation Plan

**Date:** 2026-09-28 · **Repo:** `~/Desktop/FloodShield`
**Evidence rule:** ✅ = executed on this machine. ⚠️ = unverified, must be confirmed before it goes in a report.

---

## 1. Executive summary

The external audit ("Antigravity") correctly found that the project has **no hydrodynamic physics**, and correctly enumerated the five deliverables. Its central recommendation is wrong in a way that would have cost you the hackathon:

> It proposed hand-writing a 2D Shallow Water Equations solver, an SPH solver, and a breach engine from scratch.

**None of that is necessary. Every solver you need already exists, is pip-installable, and I have run all of them on your machine.**

| Deliverable-critical tool | Status | Evidence |
|---|---|---|
| **ANUGA 4.0.1** — 2D shallow water, dam break | ✅ **runs** | Dam break solved, mass conserved to **−0.00%** |
| **Delft3D** — named in the problem statement | ✅ **runs headless in Docker** | 7 s, 0 errors, no MATLAB, no licence |
| **PySPH** — SPH dam break | ✅ **runs at coarse res** | 578 particles, 1.9 s |
| **Sentinel-1 SAR** — satellite verification | ✅ **runs, zero credentials** | Live S1 over Ganga, 57.6 s to water mask |
| **Copernicus DEM GLO-30** | ✅ **anonymous download** | 4 Indian sites fetched live |
| **NWIC/NDSA dam inventory** — 6,644 dams | ✅ **GeoJSON, no login** | Official, NDSA-published |

**The single most valuable finding:** `anuga>=3.3.8` is *already in your `requirements.txt:17`*. Current release **4.0.1** is Apache-2.0, actively maintained (13 releases in 15 months), and ships **real dam-break validation suites** (Stoker analytical + Yeh & Petroff experimental flume).

**Revised recommendation:** you are not starting from zero — you are starting from a working engine that was never switched on.

---

## 2. Audit of your current code ✅

Backend **992 lines** of Python, frontend **2,371** TSX, one commit (`868a6f1`). No venv.

### The physics is absent

`backend/hydraulic.py:42-46` — the entire "hydraulic simulation":

```python
severity = min(1.0, peak_discharge / 150.0)
flood_level = dem_min + (dem_max - dem_min) * (severity * 0.7)
flood_mask = (dem_data <= flood_level) & (dem_data > -9999)
depth_data = np.where(flood_mask, flood_level - dem_data, 0)
```

A **bathtub** model: elevation threshold, then Gaussian blur (`:49`) and an edge fade (`:51-61`). No continuity equation, no momentum, no velocity field, no time step. It cannot produce arrival times because it has no time dimension.

**The same anti-pattern is duplicated at `backend/routing.py:26-29`.** Fix one and not the other and the codebase contradicts itself.

### Other confirmed defects

- `backend/src/hydraulic.py` — ANUGA stub (`rectangular_cross_domain`, flat 5 m slope, 100 s) that is **never imported**. Dead code that misleads a judge.
- `backend/wflow_runner.py:97` — `P_inc = float(p_val) * 2.5  # Artificially increased rainfall for more severe flooding`. **Delete before submission.** A judge reading the code will find it and it discredits everything else.
- `main.py:105` — rescue priority is `100 - (elevation * 4)`. Elevation only; no depth×velocity hazard.
- Hardcoded Bhuragaon/Assam: `LeafletMap.tsx:43,123,221` — literal bounding boxes.
- Output is matplotlib PNG only. No `.shp`, no `.kml`.

**Compliance estimate: ~15%.** The UI and OSM pipeline are real work worth keeping.

---

## 3. Toolchain verification — all executed

### 3.1 ANUGA 4.0.1 — the engine

```bash
uv pip install anuga==4.0.1     # ✅ 4.0.1 released 2026-09-17, Apache-2.0
```

| Property | Value |
|---|---|
| License | **Apache-2.0** (permissive — no SIH conflict) |
| Python | `>=3.10,<3.15`, wheels for cp310–cp314 |
| numpy | `>=2.0.0` — ran on 2.4.6 |
| Deps | all have Linux wheels; **no compiler needed** |
| Maintained | 13 releases in 15 months, 100+ commits since June 2026 |
| Canonical repo | **`anuga-community/anuga_core`** ⚠️ `GeoscienceAustralia/anuga` no longer resolves |

**My dam-break run** (2000 × 200 m channel, 10 m reservoir behind a weir):

```
  simulated : 180 s        wall time : 5.8 s
  max depth : 5.09 m       max velocity : 5.84 m/s
  surge reached : 1112 m downstream     front speed : 6.18 m/s
  water volume : 393,333 -> 393,333 m3   (drift -0.00%)
```

The **−0.00% volume drift** is the number that matters — that is a mass-conserving finite-volume solver, not an approximation. Front speed 6.18 m/s is physically consistent with a 10 m head (`√(2gh)` ≈ 6.26 m/s).

**Real DEM, your `dem.tif`:** 346,096 triangles at 142 m, **1 hour of dam-break flood in 152 s wall time**.

⚠️ **ANUGA 4 broke the 3.x API.** Your `>=3.3.8` pin now resolves to 4.0.1, so **old code will not run**. Budget half a day.

| 3.x | 4.x |
|---|---|
| `rectangular_cross_domain(...)` | `mesh_factory.rectangular_cross(m, n, len1, len2)` → `(points, vertices, boundary)` |
| `Domain(mesh, geo_reference=...)` | `Domain(points, vertices, boundary)` |
| `Geo_reference(lat=, lon=)` | `Geo_reference(epsg=32646)` |
| `domain.quantity('stage')` | `domain.get_quantity('stage').centroid_values` |
| `xmom` / `ymom` | `xmomentum` / `ymomentum` |

**Use the package's own tests as the API reference** — this is what unblocked me:
`site-packages/anuga/structures/tests/test_weir_orifice_trapezoid_operator.py`

**Two bugs I hit and fixed** (documented in `engine.py`):
- `set_quantity(name, array)` expects **node** count, not triangle count.
- `grid[row, col]` — ANUGA mesh is `(x, y)`, rasters are `(y, x)`. I transposed these and got an `IndexError`.

**Validation goldmine:** ANUGA 4 ships dam-break test suites — `validation_tests/other_references/radial_dam_break_dry/` and `_wet/` (Stoker analytical solution) plus `validation_tests/experimental_data/dam_break_yeh_petroff/` (**experimental flume data**). For an NTRO dam-break pitch this is exactly the credibility you need, already in the dependency.

⚠️ **No stock time-varying breach operator.** ANUGA models the breach as a geometry/boundary condition you define. A physically-graded breach that grows over `t_f` is custom work — see §6.

### 3.2 Delft3D — the statement names it; **it runs** ✅

This was the biggest unknown. Answer: **yes, genuinely open source and runnable headless.**

- **License: AGPL-3.0 / GPL-3.0** (kernels open; the *GUI* is paid — irrelevant to you).
- **No MATLAB, no Octave, no licence file, no Deltares account.**

```bash
docker pull rbeucher/delft3d:latest    # 1.59 GB, Delft3D-FLOW 5.01
```
Run command (verified, prints `FINISHED Delft3D-FLOW`, 0 errors, ~7 s):
```bash
docker run --rm --user 0:0 -e CRCBASE_USER=root -e CRCBASE_UID=0 \
  -v "$PWD":/job -w /job rbeucher/delft3d:latest bash -lc '
  export LD_LIBRARY_PATH=/model/delft3d-5.01.00.2163/bin/lnx/flow2d3d/bin:$LD_LIBRARY_PATH
  /model/delft3d-5.01.00.2163/bin/lnx/flow2d3d/bin/d_hydro.exe config_flow2d3d.xml'
```

**Three gotchas that cost the subagent real time:**
1. Image force-drops to uid 65534 and cannot write to a bind-mount → **`--user 0:0` + `chmod 777` required**.
2. Binary is `d_hydro.exe`, not `delft3d`. **Errors are silent** — grep `tri-diag.f34` for `FINISHED`, never trust the exit code.
3. ⚠️ **`.sww`/netCDF is a dead end in this image.** The 2016 build has no netCDF linkage; `FlNcdf`/`ncFormat=4` are silently ignored. Parse with `dfm_tools` (v0.47.0, Deltares' own package) or `netCDF4`/`xarray`.

**Official validation document — no login, 266 pp, 30 studies:**
`https://oss.deltares.nl/documents/d/delft3d/valdoc_delft3d-flow_12sep2008`

It contains exactly what you need:
- **Study 3.2.4** — 1D dam break vs. **Stoker (1957) analytical solution**.
- **Study 3.2.8** — 2D dam break vs. **Stelling & Duinmeijer (2003) TU Delft flume**. 0.1 m grid, **24 s** of simulated time, closed domain, no bathymetry to source. Ideal live demo.

⚠️ **The validation studies' input files are not downloadable.** You must re-author them from the parameters printed in the document. That is the single biggest risk to the Delft3D leg.

**Scope it narrowly:** run *one* tiny case live (Stelling & Duinmeijer 2D, or Stoker 1D as a zero-data algorithmic check) and cite the rest. The bottleneck is authoring inputs, not runtime.

### 3.3 PySPH — SPH panel, coarse resolution only ✅

```bash
uv pip install pysph    # ✅ 1.0b2, clean install, no version drama
python dam_break_2d.py --dx 0.06 --tf 1.0
```

| Resolution | Particles | Result |
|---|---|---|
| `dx=0.06` | 578 | ✅ clean, **1.9 s** |
| `dx=0.03` (**example's own default**) | 2,278 | ❌ **core dump** (reproduced 3×) |

A **C-level segfault, not a Python exception** — exit 139, no traceback. It kills the whole process.

**Mandatory engineering:**
- Run in a **subprocess with a hard timeout**; degrade to the ANUGA result on non-zero exit.
- **Pin `dx=0.06` in config. Do not expose resolution as a user knob.** The crash appears at t≈0.94 s, so short smoke tests pass and give false confidence.
- 2D PySPH stores velocity as separate `u` and `v` scalars, **not** `(n,2)`.

⚠️ **Do not show the front-position curve to judges yet.** At `dx=0.06` it under-predicts Koshizuka & Oka (1996) experimental data by **~25%** — a resolution artifact, and the finer run that would fix it crashes.

**Honest framing for judges** (defensible and true): SWE and SPH *disagree exactly where it matters* — the violent impact front. Use SWE for extent/depth, SPH as an independent check on front velocity. **Do not claim SPH is more accurate overall.**

**Package-name trap ⚠️:** `pyclaw` on PyPI is an **unrelated AI-assistant package**. The real project is `clawpack`, and it needs gfortran (not installed here).

### 3.4 Satellite — runs today, zero credentials ✅

**`sentinelsat` is confirmed DEAD.** Its own README: *"Sentinelsat is currently not functional… The Copernicus Open Access Hub is permanently closed."* PyPI still shows 1.2.1. Do not put it in your stack.

**Ship this instead — no account, no API key, no AWS credentials:**
```python
from pystac_client import Client
cat = Client.open("https://earth-search.aws.element84.com/v1")
items = cat.search(collections=["sentinel-1-grd"], intersects=aoi,
                   datetime="2026-07-01/2026-09-27",
                   query={"sar:instrument_mode": {"eq": "IW"},
                          "sat:orbit_state": {"eq": "descending"}},
                   max_items=60).items()
```
✅ Verified live: catalog query **0.3 s**, latest S1 over Patna **2026-09-24 (3 days old)**, full SAR→water-mask in **57.6 s**.

**Gotchas that cost the subagent real debugging time:**
1. `s3://` hrefs are **not** anonymously readable — rewrite to `https://sentinel-s1-l1c.s3.amazonaws.com/`. Bucket is public and **not** requester-pays.
2. These COGs report `crs=None` and an identity transform via `/vsicurl/`, and are **EPSG:4326, not UTM**. Take geometry from STAC `proj:transform` / `proj:shape`, never `ds.transform`.
3. ⚠️ **Pin to ONE `relative_orbit`.** Cross-orbit comparison silently returned all-zero reads in testing — different swath, different incidence angle. Group by `sat:relative_orbit` *before* picking dates.
4. **Remove permanent water before reporting "new inundation."** In the 2025 Bihar run the raw mask caught 1 pixel; permanent water was **157,524 px**. The channel otherwise becomes your flood map.
5. **Pixel area is 16.8 × 8.3 m**, not 10 × 10 m. Compute from the affine or your km² is off ~1.8×.
6. Refined-Lee kernel size must be **odd** or `sliding_window_view` changes shape.

**GEE as a secondary path** — the statement names it, so have it, but do not bet the demo on it:
- ✅ `earthengine-api` 1.7.45 installs; Python API exposes the same server-side model as JS.
- ✅ Service-account JSON works unattended (`GOOGLE_APPLICATION_CREDENTIALS`); mount as a read-only secret, never bake into the image.
- ⚠️ **Since 2026-04-27, noncommercial GEE has a recurring 150 EECU-h/month quota.** Exceeding it does not error — it enters *degraded mode*, which is worse for a demo. Annual re-verification is a schedule landmine.

**Sentinel-2** is corroboration only, never the primary signal — cloud-locked over the Ganga for weeks. MNDWI = (B3 − B11)/(B3 + B11); **B11 is the band that makes MNDWI work**, and it suppresses built-up noise in Indian city floods.

⚠️ **Nothing has yet produced a positive flood detection.** Both full test runs returned 0–1 water pixels. The *machinery* is verified; **a spatially plausible inundation boundary is not.** This is the highest-value remaining experiment.

### 3.5 Data — official, free, no login ✅

**Copernicus DEM GLO-30, anonymous:**
```python
def url_for(lat, lon):
    ns = "N" if lat >= 0 else "S"; ew = "E" if lon >= 0 else "W"
    t = f"{ns}{abs(int(lat)):02d}_00_{ew}{abs(int(lon)):03d}_00"
    return f"https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_{t}_DEM/Copernicus_DSM_COG_10_{t}_DEM.tif"
```
⚠️ **Region is `eu-central-1`, not `us-west-2`** as commonly documented. No requester-pays. All four Indian sites fetched HTTP 200 in 13.7 s.
⚠️ Copernicus GLO-30 is a **DSM (surface)**, not bare-earth — relevant for vegetated Himalayan terrain.

**NWIC / NDSA dam inventory — the best free Indian dam dataset:**
`https://nwdp.nwic.gov.in/dataset/814111c2-16a3-4f1b-bcc0-42274fc3fcbe/resource/0d3a7101-81b4-450e-a3dd-c2bfa0b589e3/download/dam.geojson`
**6,644 dams** with height, length, capacity, river, basin, state, purpose, in-charge. No login.

**Verified parameters** (CWC NRLD 2019 and/or NWIC/NDSA):

| Dam | Lat/Lon | Height | Crest | Capacity | River |
|---|---|---|---|---|---|
| **Machchhu-II**, Morbi | 22.7667, 70.8667 | 25 m (CWC) / 22.56 m | 5,125 m (CWC) | **100.55 MCM** | Machhu |
| **Teesta-III**, Chungthang | 27.5975, 88.6503 | 60 m | ⚠️ **UNVERIFIED** | 18.4 MCM (NWIC) / ~5 MCM at breach | Teesta |
| **Mullaperiyar**, Idukki | 9.5286, 77.1442 | 53.66 m | 365.85 m | **443.23 MCM** gross / 299.31 live | Periyar |
| **Lata Tapovan barrage**, Chamoli | 30.4942, 79.6275 | 24.5 m (CWC) / 22 m (NTPC) | ⚠️ **contradictory: 85.5 / 200 / 73 m** | 1.54 MCM | Dhauliganga |

**Verified disaster facts worth using:**
- **Machchhu-II, 11 Aug 1979** — gates opened, 196,000 cfs against 200,000 cfs design; embankments overtopped both sides. **Death toll 1,800–25,000 — that range is itself the honest citable fact.** No authoritative count exists.
- **Teesta-III, 3–4 Oct 2023** — South Lhonak GLOF, **>50 MCM released with ~270 MCM of sediment**, reached the dam 60 km downstream in just over an hour, **dam failed within ~10 minutes**. Spillway designed for 7,000 cumecs (PMF, not GLOF). Impact: 88,400 people affected, 40 dead, 76 missing.
- **Rishi Ganga, 7 Feb 2021** — flow ~10.6 m/s; a **~60 m debris dam** formed at the Rishi Ganga–Ronthi Gad confluence. ICIMOD confirms the cause was a **rockslide, not a GLOF**.
- ⚠️ **The "2023 Tapovan blockage" could not be verified to exist.** Do not repeat it. The documented event is Feb 2021.

**A strong demo point:** CWC's own National Register of Large Dams **does not list Teesta-III at all** (independently corroborated by IndiaSpend). India's official dam register has gaps — and you can show your tool working on a dam the register omits.

**Known dataset defects** (found by cross-checking, so you don't have to): `dm_length` is 0 for Periyar and Teesta-III; Teesta-III's FRL/spillway are 0; Periyar's `ht_found` records the FRL not the height; lat/lon are **DMS strings** needing parsing; reservoir `area` is not water-surface area.

---

## 4. Code written ✅

New package `backend/hydro/` — drop-in, does not touch the existing UI.

```
backend/hydro/
├── __init__.py     public API
├── breach.py       Froehlich / MacDonald / Von Thun + mass-balanced Q(t)
└── engine.py       ANUGA 4.x driver over real DEMs
```

### Breach parameterisation
`BreachParams` (reservoir volume, dam height, crest length, failure mode, soil) → breach width, formation time, peak discharge, and a `Q(t)` hydrograph **normalised so `∫Q dt = V_w` exactly** — mass balance holds regardless of which empirical model produced the coefficients. Verified **−0.0000%** for all three models.

Range-tested across 1–500 Mm³ and 20–100 m dams. All produce physically sane breach widths (0.1–10 × dam height), formation times (10 min–24 h) and peak discharges.

**Three real bugs caught before shipping** (all would have failed silently):
1. Published `Q_p = 1.7·(V_w·h_b)^1.5/t_f` fed SI volumes gives **4×10¹⁴ m³/s** — 12 orders wrong. Replaced with weir relation `Q_p = C_d·B·H^1.5`.
2. Von Thun's width formula produced a **50-million-metre** breach. Now clipped to `[0.05, 10] × h_b`.
3. Reservoir datum referenced the **global** DEM minimum, putting the water surface below the upstream valley floor → **negative impounded volume** (−3.3×10⁹ m³). Now referenced to the terrain behind the dam.

For a 60 m dam holding 60 Mm³:

| Model | B_avg | t_f | Q_peak |
|---|---|---|---|
| Froehlich | 121.0 m | 51.1 min | 12,436 m³/s |
| MacDonald & Langridge-Monopolis | 121.0 m | 78.4 min | 8,186 m³/s |
| Von Thun & Gillette | 600.0 m | 204.5 min | 3,806 m³/s |

⚠️ Coefficients are transcribed from standard literature. **Verify against primary sources before publishing.**

### ANUGA engine
`run_dam_break(dem_path, params, ...)` → depth, speed, **wave arrival time**, USBR/ACER hazard class, breach hydrograph.

- Auto-reprojects any GeoTIFF to the correct UTM zone (yours is EPSG:4326; ANUGA needs metres).
- Fills DEM voids, coarsens the mesh to a triangle budget.
- Records **first-wet time per cell** → genuine arrival-time field, which the bathtub model could not produce.
- Returns volume drift so you can *prove* mass conservation in the demo.

---

## 5. What the audit got wrong

| Audit claim | Reality |
|---|---|
| Hand-write `shallow_water_solver.py` | ANUGA 4.0.1 does this, validated, Apache-2.0, ~100× faster to ship |
| Hand-write `sph_solver.py` (ρ, p, v, kernel) | PySPH ships a working example; DIY repos found were 12–2 stars, last pushed 2022–23, no validation data |
| `B_avg = 0.27·K_0·V_w^0.32·h_b^0.28` | ⚠️ Exponents wrong. Froehlich (2008) = `0.1803·V_w^0.32·h_b^0.19` |
| "Delft3D benchmarking module" as if unreachable | It runs headless in Docker in ~7 s, AGPL, no licence |
| SPH + Delft3D as two parallel engines | The PS says *"…and **compare the scenario**"*. That is a comparison exhibit, not two full engines |

---

## 6. Remaining work

| # | Deliverable | Status | Effort |
|---|---|---|---|
| 1 | Hydrodynamic framework | ~70% — ANUGA done; add Delft3D + SPH comparison | 1 d |
| 2 | Scenario generator | Breach model done; UI + multi-scenario missing | 1 d |
| 3 | GUI + `.shp`/`.kml` | Not started — cheap, `geopandas` already a dep | 1 d |
| 4 | Satellite verification | Machinery verified; **no positive detection yet** | 1 d |
| 5 | Indian basin demo | Data sources found; presets not built | 0.5 d |

### Suggested order

1. **Wire ANUGA into the API.** Replace `hydraulic.py:43` *and* `routing.py:29`. Expose on the existing `/api/wflow/simulate` so the current UI keeps working.
2. **GIS export** (deliverable 3) — cheapest compliance win, `geopandas` already installed.
3. **Indian basin presets** (deliverable 5) — the NWIC GeoJSON makes this fast; four basins are already parameterised above.
4. **Satellite positive detection** (deliverable 4) — pick a documented event (2025 Bihar or 2023 Sikkim), scan for peak-bracketing dates **in one orbit**, confirm a non-zero plausible mask.
5. **Delft3D Stelling & Duinmeijer case** — the single strongest credibility artifact available to you.
6. **SPH panel** — last, subprocess-isolated, coarse-only.

### Time-varying breach ⚠️
The statement implies a breach that *develops*. ANUGA has no stock operator for that. Cheapest credible path: model it as a **time-varying inflow boundary** driven by your `breach.py` hydrograph, or step the weir width across several timesteps. Budget half a day; do not attempt a physically-graded erosion model.

---

## 7. Risk register

| Risk | Impact | Mitigation |
|---|---|---|
| **No positive SAR flood detection yet** | Deliverable 4 has no demo | Documented event, single-orbit pairing, verify before demo day |
| **Delft3D validation inputs not downloadable** | Benchmark must be re-authored | Stelling & Duinmeijer 2D is 24 s, closed domain, trivial geometry |
| **ANUGA 4 API churn** | Online examples are 3.x | Use the package's own `tests/` as reference |
| **PySPH segfault** | Kills the server | Subprocess + pinned `dx` + timeout |
| **GEE quota / re-verification** | Degraded mode, not an error | Ship the credential-free Earth Search path as primary |
| **Dam parameter contradictions** | Judges may check | Cite CWC/NWIC; show both values where sources disagree; **never invent** |
| **DEM resolution vs narrow valleys** | Flash floods occur where 30 m DEMs are weakest | State the limitation explicitly — honesty scores better than false precision |

---

## 8. Do these first

1. Delete `* 2.5` rainfall inflation at `backend/wflow_runner.py:97`. ⚠️ Non-negotiable.
2. Bump `anuga>=3.3.8` → `anuga>=4.0.1` in `requirements.txt`.
3. Replace the bathtub model in `hydraulic.py` **and** `routing.py`.
4. Delete or clearly mark the dead ANUGA stub in `src/hydraulic.py`.
5. Run ANUGA's own `radial_dam_break` validation case and show it passing. That is your answer to *"how do you know your inundation map is correct?"*

---

## 9. Bottom line

Deliverable 1 — the hardest part, and the one the audit front-loaded — is **solved by libraries that install in seconds**. You were quoted a multi-week engineering project where the foundation needs about a day.

The risk has moved. It is no longer *"can we simulate a dam break"* — yes, proven, mass-conserving, on your own DEM. It is now **two specific experiments**: get one positive Sentinel-1 flood detection, and get the Stelling & Duinmeijer Delft3D case running. Do those two and this project is genuinely competitive.
