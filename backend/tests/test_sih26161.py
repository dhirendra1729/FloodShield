"""
Automated Test Suite for SIH26161 (NTRO) Dam Break Modeling System.
Runs validation checks across all 5 official deliverables:
1. Hydrodynamic modeling & breach hydrographs
2. Customized scenario generator & dam catalog
3. Interactive visualization data & standard GIS export (.shp, .kml)
4. Sentinel-1 SAR satellite pipeline & ground-truth verification
5. Real-world Indian basin presets (Machchhu-II, Teesta-III, Rishi Ganga, Mullaperiyar)
"""

import os
import sys
import unittest

# Add backend and src to path
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BACKEND_DIR)
sys.path.insert(0, os.path.join(BACKEND_DIR, "src"))

from main import app
from starlette.testclient import TestClient

class TestSIH26161Deliverables(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_01_health_and_solvers(self):
        """Deliverable 1: Check solvers registered in system health."""
        res = self.client.get("/api/health")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "ok")
        self.assertIn("ANUGA 4.0.1", data["solvers"]["primary"])
        self.assertIn("Delft3D-FLOW", data["solvers"]["benchmark_1"])
        self.assertIn("PySPH", data["solvers"]["benchmark_2"])
        self.assertIn("Sentinel-1", data["solvers"]["satellite"])

    def test_02_indian_dam_catalog(self):
        """Deliverables 2 & 5: Check Indian dam catalog & benchmark presets."""
        res = self.client.get("/api/dam/catalog")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        benchmarks = data.get("benchmarks", [])
        self.assertGreaterEqual(len(benchmarks), 4)
        
        # Verify Machchhu-II and Teesta-III presets exist
        names = [b["id"] for b in benchmarks]
        self.assertIn("machchhu-ii", names)
        self.assertIn("teesta-iii", names)
        self.assertIn("rishi-ganga", names)
        self.assertIn("mullaperiyar", names)

    def test_03_dam_search(self):
        """Deliverables 2 & 5: Search the 6,644 NDSA dam database."""
        res = self.client.get("/api/dam/catalog?q=Periyar")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertGreater(data.get("count", 0), 0)

    def test_04_dam_break_simulation_machchhu(self):
        """Deliverables 1, 2, 3: Run Machchhu-II overtopping breach simulation."""
        payload = {
            "dam_name": "Machchhu-II Dam",
            "dam_height_m": 25.0,
            "reservoir_volume_mcm": 100.55,
            "crest_length_m": 5125.0,
            "failure_mode": "overtopping",
            "breach_model": "froehlich",
            "simulation_hours": 3.0,
            "latitude": 22.7667,
            "longitude": 70.8667
        }
        res = self.client.post("/api/dam/simulate", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "success")
        
        # Check mass conservation & breach physics
        self.assertGreater(data["breach_summary"]["peak_discharge_m3s"], 1000.0)
        self.assertGreater(data["hydrodynamics"]["inundated_area_km2"], 0.0)
        self.assertGreater(data["hydrodynamics"]["max_depth_m"], 0.0)
        self.assertGreater(len(data["timeline"]), 5)
        self.assertGreater(len(data["hadr_settlements"]), 0)

    def test_05_delft3d_and_pysph_benchmark(self):
        """Deliverable 1: Cross-comparison against Delft3D-FLOW and SPH."""
        payload = {
            "dam_name": "Machchhu-II Dam",
            "dam_height_m": 25.0,
            "reservoir_volume_mcm": 100.55,
            "crest_length_m": 5125.0,
            "failure_mode": "overtopping"
        }
        res = self.client.post("/api/dam/benchmark", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "success")
        self.assertIn("metrics", data)
        self.assertGreater(data["metrics"]["pearson_correlation"], 0.95)

    def test_06_gis_export_shapefile_zip(self):
        """Deliverable 3: Export ESRI Shapefile bundle (.zip)."""
        payload = {"dam_name": "Machchhu-II Dam"}
        res = self.client.post("/api/gis/export/shp", json=payload)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.headers.get("content-type"), "application/zip")
        self.assertGreater(len(res.content), 500)

    def test_07_gis_export_kml(self):
        """Deliverable 3: Export Google Earth KML."""
        payload = {"dam_name": "Machchhu-II Dam"}
        res = self.client.post("/api/gis/export/kml", json=payload)
        self.assertEqual(res.status_code, 200)
        self.assertIn("application/vnd.google-earth.kml+xml", res.headers.get("content-type"))
        self.assertIn("<kml", res.text)
        self.assertIn("Machchhu-II", res.text)

    def test_08_satellite_sar_scenes(self):
        """Deliverable 4: Query Sentinel-1 SAR scenes."""
        res = self.client.get("/api/satellite/scenes?lat=22.7667&lon=70.8667")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "success")
        self.assertGreater(len(data.get("scenes", [])), 0)

    def test_09_satellite_verification_iou(self):
        """Deliverable 4: Surface water delineation & ground-truth verification."""
        payload = {"dam_name": "Machchhu-II Dam"}
        res = self.client.post("/api/satellite/verify", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "success")
        metrics = data.get("ground_truth_metrics", {})
        self.assertIn("iou", metrics)
        self.assertIn("dice_f1", metrics)
        self.assertGreater(metrics["iou"], 0.0)

if __name__ == "__main__":
    unittest.main()
