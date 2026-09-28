import os
import osmnx as ox
import geopandas as gpd
import requests
import json
from config import BHURAGAON_BOUNDS
from spatial_db import ingest_geojson_to_postgis

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
RAW_DIR = os.path.join(DATA_DIR, "raw")
PROCESSED_DIR = os.path.join(DATA_DIR, "processed")

def setup_directories():
    os.makedirs(RAW_DIR, exist_ok=True)
    os.makedirs(PROCESSED_DIR, exist_ok=True)

def fetch_and_ingest_osm_data():
    print("========================================")
    print(" Fetching OSM Data (Roads & Shelters)")
    print("========================================")
    bbox = (
        BHURAGAON_BOUNDS["min_lon"], # left
        BHURAGAON_BOUNDS["min_lat"], # bottom
        BHURAGAON_BOUNDS["max_lon"], # right
        BHURAGAON_BOUNDS["max_lat"]  # top
    )
    
    roads_path = os.path.join(RAW_DIR, "roads.geojson")
    shelters_path = os.path.join(RAW_DIR, "shelters.geojson")
    
    try:
        # 1. Download Road Network
        print("\n[1/2] Downloading Road Network...")
        G = ox.graph_from_bbox(bbox, network_type="drive")
        nodes, edges = ox.graph_to_gdfs(G)
        edges.to_file(roads_path, driver="GeoJSON")
        
        # Ingest to DB
        ingest_geojson_to_postgis(roads_path, "roads")
        
    except Exception as e:
        print(f" -> Error processing roads: {e}")

    try:
        # 2. Download Buildings (Potential Shelters)
        print("\n[2/2] Downloading Building Footprints (Hospitals, Schools)...")
        tags = {"building": True, "amenity": ["hospital", "school", "clinic"]}
        buildings = ox.features_from_bbox(bbox, tags=tags)
        buildings.to_file(shelters_path, driver="GeoJSON")
        
        # Ingest to DB
        ingest_geojson_to_postgis(shelters_path, "shelters")
        
    except Exception as e:
        print(f" -> Error processing buildings: {e}")

def fetch_weather_data():
    print("\\n========================================")
    print(" Fetching Open-Meteo Weather Forecast")
    print("========================================")
    lat = (BHURAGAON_BOUNDS["min_lat"] + BHURAGAON_BOUNDS["max_lat"]) / 2
    lon = (BHURAGAON_BOUNDS["min_lon"] + BHURAGAON_BOUNDS["max_lon"]) / 2
    url = f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&hourly=precipitation"
    
    try:
        response = requests.get(url)
        response.raise_for_status()
        data = response.json()
        with open(os.path.join(RAW_DIR, "forecast.json"), "w") as f:
            json.dump(data, f, indent=4)
        print(" -> ✅ Weather Data Fetch Complete.")
    except Exception as e:
        print(f" -> ❌ Error fetching weather: {e}")

if __name__ == "__main__":
    setup_directories()
    fetch_and_ingest_osm_data()
    fetch_weather_data()
    print("\\n=== Data Pipeline Execution Complete ===")
