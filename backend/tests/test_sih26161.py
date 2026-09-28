"""
Automated Test Suite for SIH26161 (NTRO) Dam Break Modeling System.

Every assertion here is against an artefact the code actually produces. The
suite deliberately includes regression guards for the specific fabrications the
project previously shipped -- hard-coded volume drift, a fixed wall-clock time,
literal Delft3D/PySPH curves, and placeholder verification masks -- so they
cannot quietly come back.

Tests fall into two groups:
  * offline  -- physics and processing checks on synthetic input, no network
  * network  -- end-to-end runs that fetch Copernicus terrain and Sentinel-1
                scenes; skipped (not failed) when the network is unavailable

Run:
    backend/.venv/bin/python backend/tests/test_sih26161.py
"""

import os
import re
import sys
import unittest

import numpy as np

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BACKEND_DIR)
sys.path.insert(0, os.path.join(BACKEND_DIR, "src"))


def _network_available(host: str = "copernicus-dem-30m.s3.eu-central-1.amazonaws.com") -> bool:
    import socket
    try:
        socket.create_connection((host, 443), timeout=5).close()
        return True
    except OSError:
        return False


HAS_NETWORK = _network_available()


def _synthetic_valley_dem(path: str, rows: int = 200, cols: int = 200,
                          cell: float = 30.0) -> str:
    """Write a GeoTIFF of a straight, gently descending valley in UTM 42N.

    Terrain falls downstream (increasing column) so a released reservoir has
    somewhere to run, with side walls to keep the water in the channel.
    """
    import rasterio
    from rasterio.transform import Affine

    col_idx = np.arange(cols)[None, :]
    row_idx = np.arange(rows)[:, None]

    z = 60.0 - 0.15 * col_idx + 0.30 * np.abs(row_idx - rows / 2.0)
    z = z.astype("float32")

    # Easting/northing chosen to sit at roughly 69 deg E, zone 42N.
    transform = Affine(cell, 0.0, 250_000.0, 0.0, -cell, 2_500_000.0)

    with rasterio.open(path, "w", driver="GTiff", height=rows, width=cols,
                       count=1, dtype="float32", crs="EPSG:32642",
                       transform=transform, nodata=-9999.0) as dst:
        dst.write(z, 1)
    return path


class TestPhysicsEngine(unittest.TestCase):
    """Offline: the ANUGA solver itself, on synthetic terrain."""

    @classmethod
    def setUpClass(cls):
        import tempfile
        from hydro.breach import BreachParams

        cls.tmp = tempfile.mkdtemp(prefix="floodshield_test_")
        cls.dem = _synthetic_valley_dem(os.path.join(cls.tmp, "valley.tif"))
        cls.params = BreachParams(
            name="Synthetic Valley",
            reservoir_volume_m3=5.0e6,
            dam_height_m=20.0,
            crest_length_m=1000.0,
            normal_pool_level_m=17.0,
            failure_mode="overtopping",
            simulation_duration_s=1800.0,
        )

    def _run(self):
        from hydro.engine import run_dam_break
        return run_dam_break(self.dem, self.params, max_cells=40_000,
                             max_span_m=None, datadir=self.tmp)

    def test_01_engine_reports_its_own_version(self):
        """The reported engine string must match the installed ANUGA."""
        import anuga
        result = self._run()
        self.assertEqual(result["engine"], "anuga")
        self.assertEqual(result["anuga_version"],
                         getattr(anuga, "__version__", "unknown"))
        self.assertGreaterEqual(len(result["grid_shape"]), 2)

    def test_02_mass_is_conserved_to_floating_point(self):
        """Volume drift must be measured, and must be numerically negligible."""
        stats = self._run()["stats"]
        self.assertIn("volume_drift_pct", stats)
        self.assertLess(abs(stats["volume_drift_pct"]), 1e-6,
                        "solver is not conserving mass")

    def test_03_reservoir_impounds_the_requested_volume(self):
        """The dam must hold the catalogued storage, not a fictitious lake."""
        stats = self._run()["stats"]
        target = self.params.reservoir_volume_m3
        self.assertAlmostEqual(stats["impounded_volume_m3"] / target, 1.0,
                               delta=0.02)
        self.assertAlmostEqual(stats["reservoir_fill_pct"], 100.0, delta=2.0)
        # And it must not be impounding more than the dam can physically hold.
        self.assertLessEqual(stats["reservoir_level_m"], stats["crest_cap_m"] + 1e-6)

    def test_04_the_dam_actually_breaks(self):
        """A held reservoir is still water; a breach is not.

        This is the regression guard for the defect where the structure was
        removed only *after* the run finished, so nothing ever failed and the
        reported peak velocity was ~0.2 m/s.
        """
        stats = self._run()["stats"]
        self.assertGreater(stats["max_speed_mps"], 1.0,
                           "no dam-break wave: peak velocity is still-water speed")
        self.assertGreater(stats["max_depth_m"], 0.5)

    def test_05_inundation_excludes_the_reservoir_pool(self):
        """Downstream extent must be reported separately from the pool."""
        stats = self._run()["stats"]
        self.assertIn("downstream_inundated_area_km2", stats)
        self.assertLessEqual(stats["downstream_inundated_area_km2"],
                             stats["inundated_area_km2"] + 1e-9)
        # The wave must reach below the dam within the run.
        self.assertGreaterEqual(stats["downstream_first_arrival_s"], 0.0,
                                "the breach wave never arrived downstream")


class TestBreachParameterisation(unittest.TestCase):
    """Offline: the empirical breach models."""

    def test_01_models_agree_within_an_order_of_magnitude(self):
        from hydro.breach import (BreachParams, froehlich_2008,
                                  macdonald_langridge, von_thun_gillette)
        params = BreachParams(name="X", reservoir_volume_m3=100.55e6,
                              dam_height_m=25.0, crest_length_m=5125.0)
        peaks = [
            froehlich_2008(params.reservoir_volume_m3, params.dam_height_m)[2],
            macdonald_langridge(params.reservoir_volume_m3, params.dam_height_m)[2],
            von_thun_gillette(params.reservoir_volume_m3, params.dam_height_m)[2],
        ]
        self.assertTrue(all(p > 0 for p in peaks))
        self.assertLess(max(peaks) / min(peaks), 10.0)

    def test_02_hydrograph_is_mass_balanced(self):
        """The discharge curve must drain the reservoir, not an arbitrary volume."""
        from hydro.breach import BreachParams, breach_hydrograph
        params = BreachParams(name="X", reservoir_volume_m3=100.55e6,
                              dam_height_m=25.0, crest_length_m=5125.0)
        hydro = breach_hydrograph(params)
        drained = hydro["volume_drained_m3"]
        self.assertAlmostEqual(drained / params.reservoir_volume_m3, 1.0,
                               delta=0.05)
        self.assertEqual(len(hydro["time_s"]), len(hydro["discharge_m3s"]))


class TestSolverVerification(unittest.TestCase):
    """Offline: ANUGA against the exact Ritter (1892) dam-break solution.

    This is the project's verification deliverable. It is a closed-form
    reference, so the comparison tests the discretisation rather than merely
    confirming that two codes were written by the same community.
    """

    @classmethod
    def setUpClass(cls):
        from hydro.flume import run_flume_benchmark
        # NB: do not name this `cls.run` -- unittest.TestCase.run is the method
        # the runner calls to execute each test, and a dict there breaks it.
        cls.flume = run_flume_benchmark()
        cls.m = cls.flume["metrics"]

    def test_01_reproduces_the_analytical_solution(self):
        self.assertGreater(self.m["pearson_correlation"], 0.99)
        self.assertLess(self.m["normalised_rmse"], 0.05)

    def test_02_matches_at_the_dam_section(self):
        """Ritter is exact at the dam: h = 4 h0 / 9, u = (2/3) sqrt(g h0)."""
        self.assertAlmostEqual(self.m["dam_section_depth_exact_m"], 4.0 / 9.0,
                               places=3)
        self.assertLess(abs(self.m["dam_section_depth_error_m"]), 0.05)

    def test_03_wave_front_speed_is_two_celerities(self):
        import numpy as np
        from hydro.flume import G, H0_M
        self.assertAlmostEqual(self.m["wave_front_speed_mps"],
                               2.0 * np.sqrt(G * H0_M), places=3)

    def test_04_front_arrival_is_compared_like_with_like(self):
        """The reference must cross the same depth threshold as the solver.

        Comparing the solver's threshold crossing against the arrival of
        *zero* depth measures the exact solution's growth from 0 to the
        threshold, not the numerics -- a 0.28 s error in this configuration.
        """
        self.assertLess(self.m["front_arrival_exact_s"],
                        self.m["front_arrival_anuga_s"])
        self.assertLess(abs(self.m["front_arrival_error_s"]),
                        2.0 * self.m["time_step_s"])

    def test_05_conserves_mass(self):
        self.assertLess(abs(self.flume["mass"]["drift_pct"]), 1e-9)


class TestNoFabricatedMetrics(unittest.TestCase):
    """Regression guards: the removed fabrications must not reappear.

    These read the source rather than calling it, because the whole failure
    mode was a correct-looking value that no runtime check could distinguish
    from a computed one.
    """

    SOURCES = ("src/main.py", "satellite.py", "hydraulic.py", "routing.py")

    def _read(self, rel):
        with open(os.path.join(BACKEND_DIR, rel), encoding="utf-8") as fh:
            return fh.read()

    def test_01_no_hardcoded_mass_conservation(self):
        for rel in self.SOURCES:
            src = self._read(rel)
            self.assertNotRegex(
                src, r'"mass_conservation_volume_drift_pct"\s*:\s*-?0\.0+\s*[,}]',
                f"{rel}: volume drift is hard-coded instead of measured")

    def test_02_no_hardcoded_wall_time(self):
        for rel in self.SOURCES:
            src = self._read(rel)
            self.assertNotRegex(
                src, r'"wall_time_s"\s*:\s*\d+\.\d+\s*[,}]',
                f"{rel}: wall time is hard-coded instead of measured")

    def test_03_no_literal_benchmark_curves(self):
        """Delft3D / PySPH comparison series must not be literal arrays."""
        src = self._read("src/main.py")
        self.assertNotRegex(src, r"delft3d_wse\s*=\s*\[",
                            "Delft3D curve is a hard-coded array")
        self.assertNotRegex(src, r"pysph_front\s*=\s*\[",
                            "PySPH curve is a hard-coded array")

    def test_04_no_placeholder_verification_masks(self):
        """IoU must be computed on real masks, not hand-built rectangles."""
        src = self._read("satellite.py") + self._read("src/main.py")
        self.assertNotIn("sim_dummy", src)
        self.assertNotIn("sat_dummy", src)

    def test_05_no_fabricated_scene_fallback(self):
        """A failed STAC search must return empty, not invented scene ids."""
        src = self._read("satellite.py")
        self.assertNotRegex(src, r"_LIVE_SAR|_PRE_SURGE",
                            "satellite.py invents scene metadata on failure")

    # -- frontend ----------------------------------------------------------
    # The backend guards above were the original scope; the UI could still
    # print a statistic that no endpoint had produced, which is the same
    # failure wearing a different hat.

    FRONTEND_SRC = os.path.join(
        os.path.dirname(BACKEND_DIR), "frontend", "src")

    def _frontend_sources(self):
        found = []
        for root, _dirs, files in os.walk(self.FRONTEND_SRC):
            for fn in files:
                if fn.endswith((".ts", ".tsx")):
                    found.append(os.path.join(root, fn))
        return found

    def test_06_frontend_displays_no_literal_statistic(self):
        """Every metric shown in the UI must come from an API response."""
        pattern = re.compile(
            r"(?:pearson|rmse|iou|dice|correlation|drift)\s*[:=]\s*-?\d+\.\d+",
            re.IGNORECASE)
        for path in self._frontend_sources():
            with open(path, encoding="utf-8") as fh:
                src = fh.read()
            m = pattern.search(src)
            if m is not None:
                self.fail(
                    f"{os.path.relpath(path, BACKEND_DIR)}: literal statistic "
                    f"{m.group(0)!r} would render as a computed result")

    def test_07_raster_extent_is_declared_exactly_once(self):
        """The DEM / flood / LULC overlays must share one extent constant.

        Written inline three times they could drift apart, misregistering two
        rasters against the basemap while the third stayed correct.
        """
        for coord in ("26.2501389", "91.9968055"):
            total = 0
            for path in self._frontend_sources():
                with open(path, encoding="utf-8") as fh:
                    total += fh.read().count(coord)
            self.assertEqual(
                total, 1,
                f"raster extent coordinate {coord} appears {total}x across the "
                f"frontend; declare it once and reference it")


class TestSatelliteProcessing(unittest.TestCase):
    """Offline: the SAR processing chain on synthetic backscatter."""

    @classmethod
    def setUpClass(cls):
        rng = np.random.default_rng(0)
        truth = np.zeros((120, 120), dtype=bool)
        truth[:, 60:] = True                       # right half is water
        base = np.where(truth, 0.02, 0.30)         # water is dark
        speckle = rng.gamma(4.0, 1 / 4.0, size=base.shape)
        cls.image = base * speckle
        cls.truth = truth

    def test_01_refined_lee_suppresses_speckle(self):
        from satellite import refined_lee_filter
        filtered, _ = refined_lee_filter(self.image, looks=4.0)
        raw_db = 10 * np.log10(self.image)
        filt_db = 10 * np.log10(np.maximum(filtered, 1e-12))
        # a homogeneous patch (all land)
        self.assertLess(filt_db[10:50, 10:50].std(), raw_db[10:50, 10:50].std())

    def test_02_refined_lee_preserves_the_edge(self):
        """Speckle reduction must not come from blurring the boundary away."""
        from satellite import refined_lee_filter
        filtered, _ = refined_lee_filter(self.image, looks=4.0)
        raw_db = 10 * np.log10(self.image)
        filt_db = 10 * np.log10(np.maximum(filtered, 1e-12))

        def contrast(arr):
            prof = arr[:, 55:66].mean(axis=0)
            return prof.max() - prof.min()

        self.assertGreater(contrast(filt_db), 0.5 * contrast(raw_db))

    def test_03_otsu_separates_water_from_land(self):
        from satellite import detect_water
        mask, threshold = detect_water(self.image, looks=4.0)
        self.assertGreater(threshold, -40.0)
        self.assertLess(threshold, 0.0)
        self.assertGreater((mask == self.truth).mean(), 0.95)

    def test_04_verification_metrics_are_correct(self):
        from satellite import verify_inundation
        a = np.zeros((40, 40), dtype=bool)
        a[10:30, 10:30] = True
        b = np.zeros((40, 40), dtype=bool)
        b[10:30, 10:30] = True

        identical = verify_inundation(a, b)
        self.assertEqual(identical["iou"], 1.0)
        self.assertEqual(identical["dice_f1"], 1.0)

        disjoint = verify_inundation(a, ~a)
        self.assertEqual(disjoint["iou"], 0.0)

    def test_05_verification_rejects_mismatched_grids(self):
        """A silent shape mismatch would make the score meaningless."""
        from satellite import verify_inundation
        with self.assertRaises(ValueError):
            verify_inundation(np.ones((10, 10)), np.ones((20, 20)))

    def test_06_resample_preserves_coverage(self):
        from satellite import resample_mask
        a = np.zeros((40, 40), dtype=bool)
        a[10:30, 10:30] = True
        out = resample_mask(a, (20, 20))
        self.assertEqual(out.shape, (20, 20))
        self.assertGreater(out.sum(), 0)


class TestApiContract(unittest.TestCase):
    """Offline: endpoints that need no external service."""

    @classmethod
    def setUpClass(cls):
        from main import app
        from starlette.testclient import TestClient
        cls.client = TestClient(app)

    def test_01_catalog_presets(self):
        data = self.client.get("/api/dam/catalog").json()
        ids = [b["id"] for b in data.get("benchmarks", [])]
        for expected in ("machchhu-ii", "teesta-iii", "rishi-ganga",
                         "mullaperiyar"):
            self.assertIn(expected, ids)

    def test_02_dam_search_hits_the_real_inventory(self):
        data = self.client.get("/api/dam/catalog?q=Periyar").json()
        self.assertGreater(data.get("count", 0), 0)

    def test_03_health_does_not_claim_unrunnable_solvers(self):
        """Health must not advertise solvers the project cannot execute."""
        data = self.client.get("/api/health").json()
        self.assertEqual(data["status"], "ok")
        solvers = data["solvers"]
        self.assertIn("ANUGA", solvers["primary"])
        # Delft3D/PySPH must be reported as unavailable rather than listed as
        # working solvers, since neither runs in this deployment.
        self.assertNotIn("Delft3D-FLOW Open-Source Suite",
                         str(solvers.get("benchmark_1", "")))

    def test_04_simulate_without_terrain_fails_honestly(self):
        """An unresolvable DEM must produce an error, never a fabricated run."""
        from unittest import mock
        import main as M

        payload = {"dam_name": "Machchhu-II Dam", "simulation_hours": 1.0}
        with mock.patch.object(M, "resolve_dem",
                               side_effect=IOError("no terrain")):
            data = self.client.post("/api/dam/simulate", json=payload).json()
        self.assertEqual(data["status"], "error")
        self.assertIn("terrain", data["message"].lower())

    def test_05_benchmark_is_a_real_solver_run(self):
        """The benchmark must be an actual solve, not a stored curve."""
        data = self.client.get("/api/dam/benchmark").json()
        self.assertEqual(data["status"], "success")
        self.assertGreater(len(data["anuga_floodshield_curve"]), 20)
        self.assertEqual(len(data["anuga_floodshield_curve"]),
                         len(data["analytical_curve"]))
        self.assertGreater(data["metrics"]["pearson_correlation"], 0.99)
        self.assertLess(data["metrics"]["normalised_rmse"], 0.05)
        self.assertEqual(data["metrics"]["anuga_version"],
                         __import__("anuga").__version__)
        self.assertGreater(data["metrics"]["wall_time_s"], 0.0)

    def test_06_unrun_cross_solver_comparisons_are_declared(self):
        """Delft3D/PySPH must be reported as not executed, not plotted."""
        data = self.client.get("/api/dam/benchmark").json()
        cross = data["cross_solver_comparison"]
        for name in ("delft3d_flow", "pysph"):
            self.assertFalse(cross[name]["executed"])
            self.assertTrue(cross[name]["reason"])
        # The removed endpoint served these keys; nothing may recreate them.
        for gone in ("delft3d_flow_curve", "pysph_particle_curve"):
            self.assertNotIn(gone, data)

    def test_07_static_dam_routes_are_not_shadowed(self):
        """A literal /api/dam/<name> route must not fall through to {dam_id}.

        Registering /api/dam/{dam_id} first makes FastAPI match it ahead of
        any literal sibling, so the endpoint silently 404s inside a
        status:success envelope.
        """
        data = self.client.get("/api/dam/benchmark").json()
        self.assertNotIn("not found", str(data.get("message", "")).lower())
        self.assertIn("benchmark_suite", data)

        catalog = self.client.get("/api/dam/catalog").json()
        self.assertIn("benchmarks", catalog)


@unittest.skipUnless(HAS_NETWORK, "no network: terrain/SAR endpoints unreachable")
class TestEndToEnd(unittest.TestCase):
    """Network: full runs against Copernicus terrain and Sentinel-1."""

    @classmethod
    def setUpClass(cls):
        from main import app
        from starlette.testclient import TestClient
        cls.client = TestClient(app)
        cls.payload = {
            "dam_name": "Machchhu-II Dam",
            "dam_height_m": 25.0,
            "reservoir_volume_mcm": 100.55,
            "crest_length_m": 5125.0,
            "failure_mode": "overtopping",
            "breach_model": "froehlich",
            "simulation_hours": 1.0,
            "latitude": 22.7667,
            "longitude": 70.8667,
        }
        cls.result = cls.client.post("/api/dam/simulate",
                                     json=cls.payload).json()

    def test_01_simulation_succeeds_on_the_dams_own_terrain(self):
        self.assertEqual(self.result.get("status"), "success",
                         self.result.get("message"))
        self.assertIn("GLO-30", self.result["terrain"]["dataset"])
        self.assertIn("N22_00_E070_00", self.result["terrain"]["tile"])

    def test_02_bounds_are_centred_near_the_dam(self):
        """Guards the defect where the window was centred on the DEM tile."""
        west, south, east, north = self.result["bounds"]
        self.assertTrue(west < 70.8667 < east, "dam longitude outside bounds")
        self.assertTrue(south < 22.7667 < north, "dam latitude outside bounds")
        self.assertLess(east - west, 1.0, "study window spans an entire degree")

    def test_03_physics_is_credible(self):
        h = self.result["hydrodynamics"]
        self.assertGreater(h["max_velocity_mps"], 1.0,
                           "still-water speed: the breach did not run")
        self.assertGreater(h["max_depth_m"], 1.0)
        self.assertLess(abs(h["mass_conservation_volume_drift_pct"]), 1e-4)
        self.assertAlmostEqual(h["reservoir_fill_pct"], 100.0, delta=5.0)
        self.assertGreater(h["wall_time_s"], 0.0)

    def test_04_timeline_frames_advance(self):
        timeline = self.result["timeline"]
        self.assertGreater(len(timeline), 5)
        fronts = [f["wave_front_distance_km"] for f in timeline]
        self.assertGreaterEqual(fronts[-1], fronts[0])
        times = [f["time_minutes"] for f in timeline]
        self.assertEqual(times, sorted(times))

    def test_05_settlements_report_measured_values(self):
        for s in self.result["hadr_settlements"]:
            self.assertIn(s["hazard_level"],
                          {"NONE", "LOW", "MODERATE", "HIGH", "EXTREME"})
            if s["estimated_depth_m"] <= 0.05:
                self.assertEqual(s["evacuation_status"], "NO_INUNDATION")

    def test_06_gis_exports_follow_a_simulation(self):
        shp = self.client.post("/api/gis/export/shp",
                              json={"dam_name": "Machchhu-II Dam"})
        self.assertEqual(shp.status_code, 200)
        self.assertGreater(len(shp.content), 500)

        kml = self.client.post("/api/gis/export/kml",
                               json={"dam_name": "Machchhu-II Dam"})
        self.assertIn("<kml", kml.text)

    def test_07_satellite_scenes_come_from_stac(self):
        data = self.client.get(
            "/api/satellite/scenes?lat=22.7667&lon=70.8667").json()
        self.assertEqual(data["status"], "success")
        for scene in data["scenes"]:
            self.assertIn("collection", scene)
            self.assertTrue(scene["id"], "scene id must be a real STAC id")


if __name__ == "__main__":
    print(f"network-dependent tests: {'ENABLED' if HAS_NETWORK else 'SKIPPED'}")
    unittest.main(verbosity=2)
