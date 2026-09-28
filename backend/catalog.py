"""
Indian Dam Catalog & Case Study Presets for SIH26161 (NTRO).
Provides pre-parameterized historical benchmark cases and searches
the official NDSA / NWIC 6,644 Indian dam inventory.
"""

import json
import os
import re
from typing import List, Dict, Any, Optional

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
DAM_GEOJSON_PATH = os.path.join(DATA_DIR, "dam.geojson")

# Curated benchmark presets with authoritative CWC NRLD / NDSA parameters
#
# These three historical cases are mirrored in the Tana workspace as "Dam
# Benchmark" records. This file is the authority: the values below are what
# /api/dam/simulate actually solves with, so a record that disagrees with them
# describes a run the system cannot reproduce. Mirrors:
#   Machchhu-II  tana:text:01m3mhj99vx4p8qcz0b3q6dyap
#   Teesta-III   tana:text:01m3mhj9ayrcmayd77pgeee0ry
#   Rishiganga   tana:text:01m3mhj9c0p3fkfk1jy9kfehqc
BENCHMARK_PRESETS: List[Dict[str, Any]] = [
    {
        "id": "machchhu-ii",
        "name": "Machchhu-II Dam (Morbi Failure 1979)",
        "state": "Gujarat",
        "river": "Machhu",
        "basin": "Rivers draining into Gulf of Kachchh",
        "latitude": 22.7667,
        "longitude": 70.8667,
        "dam_height_m": 25.0,
        "crest_length_m": 5125.0,
        "reservoir_volume_mcm": 100.55,
        "normal_pool_level_m": 22.0,
        "historical_event": "Catastrophic overtopping failure on 11 Aug 1979 after extreme monsoon rainfall (over 20 inches in 24h). Inundated Morbi town downstream.",
        "failure_mode": "overtopping",
        "default_model": "froehlich",
        "downstream_villages": ["Morbi City", "Lilapar", "Mahendranagar", "Jambu"]
    },
    {
        "id": "teesta-iii",
        "name": "Teesta-III Dam (Chungthang GLOF 2023)",
        "state": "Sikkim",
        "river": "Teesta",
        "basin": "Brahmaputra",
        "latitude": 27.5975,
        "longitude": 88.6503,
        "dam_height_m": 60.0,
        "crest_length_m": 200.0,
        "reservoir_volume_mcm": 18.4,
        "normal_pool_level_m": 55.0,
        "historical_event": "South Lhonak Glacial Lake Outburst Flood (GLOF) on 3-4 Oct 2023 released >50 MCM water + sediment, breaching dam within 10 minutes.",
        "failure_mode": "overtopping",
        "default_model": "froehlich",
        "downstream_villages": ["Chungthang", "Mangan", "Singtam", "Rangpo"]
    },
    {
        "id": "rishi-ganga",
        "name": "Rishi Ganga / Tapovan (Chamoli Disaster 2021)",
        "state": "Uttarakhand",
        "river": "Dhauliganga / Rishi Ganga",
        "basin": "Ganga (Upper Alaknanda)",
        "latitude": 30.4942,
        "longitude": 79.6275,
        "dam_height_m": 24.5,
        "crest_length_m": 85.5,
        "reservoir_volume_mcm": 1.54,
        "normal_pool_level_m": 20.0,
        "historical_event": "Rock and ice avalanche formed temporary blockage breach on 7 Feb 2021. Violent surge (~10.6 m/s) damaged Tapovan Vishnugad project.",
        "failure_mode": "sudden_collapse",
        "default_model": "macdonald",
        "downstream_villages": ["Raini", "Tapovan", "Joshimath", "Helang"]
    },
    {
        "id": "mullaperiyar",
        "name": "Mullaperiyar Dam (Periyar River)",
        "state": "Kerala",
        "river": "Periyar",
        "basin": "Periyar",
        "latitude": 9.5286,
        "longitude": 77.1442,
        "dam_height_m": 53.66,
        "crest_length_m": 365.85,
        "reservoir_volume_mcm": 443.23,
        "normal_pool_level_m": 48.0,
        "historical_event": "National critical infrastructure risk study. Simulates potential piping vs overtopping breach down the Periyar gorge towards Idukki Reservoir.",
        "failure_mode": "piping",
        "default_model": "froehlich",
        "downstream_villages": ["Vandiperiyar", "Upputhara", "Ayyappancoil", "Idukki Gorge"]
    },
    {
        "id": "bhuragaon",
        "name": "Bhuragaon Plains (Brahmaputra Catchment)",
        "state": "Assam",
        "river": "Brahmaputra",
        "basin": "Brahmaputra",
        "latitude": 26.3715,
        "longitude": 92.2670,
        "dam_height_m": 15.0,
        "crest_length_m": 1200.0,
        "reservoir_volume_mcm": 25.0,
        "normal_pool_level_m": 12.0,
        "historical_event": "FloodShield baseline sector with local high-resolution DEM, land use land cover, and OpenStreetMap road and shelter networks.",
        "failure_mode": "overtopping",
        "default_model": "froehlich",
        "downstream_villages": ["Bhuragaon Town", "Mikirgaon", "Kusumtola", "Silpukhuri"]
    }
]

def _parse_dms(dms_str: str) -> Optional[float]:
    """Parse DMS string e.g. 11° 37' 28.000\" N into decimal degrees."""
    if not dms_str or not isinstance(dms_str, str):
        return None
    try:
        match = re.search(r'(\d+)\s*°\s*(\d+)\s*\'\s*([\d\.]+)\s*"?\s*([NSEWnsew])', dms_str)
        if match:
            deg, min_, sec, direction = match.groups()
            dd = float(deg) + float(min_) / 60.0 + float(sec) / 3600.0
            if direction.upper() in ['S', 'W']:
                dd = -dd
            return round(dd, 5)
    except Exception:
        pass
    return None

def get_benchmarks() -> List[Dict[str, Any]]:
    """Return the list of curated historical dam breach benchmarks."""
    return BENCHMARK_PRESETS

def get_benchmark_by_id(dam_id: str) -> Optional[Dict[str, Any]]:
    for b in BENCHMARK_PRESETS:
        if b["id"] == dam_id:
            return b
    return None

def search_dams(query: str, limit: int = 25) -> List[Dict[str, Any]]:
    """Search the 6,644 NDSA dam inventory by dam name, state, or river."""
    results = []
    q = query.strip().lower()
    
    # 1. Match presets first
    for b in BENCHMARK_PRESETS:
        if q in b["name"].lower() or q in b["state"].lower() or q in b["river"].lower():
            results.append({
                "id": b["id"],
                "name": b["name"],
                "state": b["state"],
                "river": b["river"],
                "height_m": b["dam_height_m"],
                "capacity_mcm": b["reservoir_volume_mcm"],
                "lat": b["latitude"],
                "lng": b["longitude"],
                "is_preset": True
            })
            
    if not os.path.exists(DAM_GEOJSON_PATH):
        return results[:limit]
        
    try:
        with open(DAM_GEOJSON_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
            
        for feature in data.get("features", []):
            if len(results) >= limit:
                break
            props = feature.get("properties", {})
            name = props.get("dm_name") or ""
            state = props.get("state") or ""
            river = props.get("river") or ""
            
            if q in name.lower() or q in state.lower() or q in river.lower():
                lat = _parse_dms(props.get("latitude"))
                lng = _parse_dms(props.get("longitude"))
                height = float(props.get("ht_found") or 20.0)
                cap = float(props.get("gs_st_cap") or 10.0)
                
                results.append({
                    "id": props.get("PIC") or name.lower().replace(" ", "-"),
                    "name": name,
                    "state": state,
                    "river": river if river != "None" else "Unspecified Tributary",
                    "height_m": height,
                    "capacity_mcm": cap,
                    "lat": lat or 26.37,
                    "lng": lng or 92.26,
                    "is_preset": False,
                    "dam_type": props.get("dm_type") or "Earthfill"
                })
    except Exception as e:
        print("Dam search error:", e)
        
    return results[:limit]
