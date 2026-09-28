import os
import json
import networkx as nx
import numpy as np
import rasterio
from shapely.geometry import Point, LineString, shape

def calculate_safe_route(discharge_data, user_lat, user_lng, safe_spots):
    try:
        # Find peak index and T-4
        discharges = [float(row.get('discharge', 0)) for row in discharge_data]
        if not discharges: return None
        peak_idx = np.argmax(discharges)
        pre_peak_idx = max(0, peak_idx - 4)
        pre_peak_discharge = discharges[pre_peak_idx]
        
        public_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'frontend', 'public', 'data')
        dem_path = os.path.join(public_dir, 'dem.tif')
        roads_path = os.path.join(public_dir, 'roads.geojson')
        shelters_path = os.path.join(public_dir, 'shelters.geojson')
        
        with rasterio.open(dem_path) as src:
            dem_data = src.read(1)
            transform = src.transform
            
        dem_min = dem_data[dem_data > -9999].min()
        dem_max = dem_data[dem_data > -9999].max()
        pre_peak_severity = min(1.0, pre_peak_discharge / 150.0)
        flood_level = dem_min + (dem_max - dem_min) * (pre_peak_severity * 0.7)
        
        # Build graph
        G = nx.Graph()
        with open(roads_path, 'r') as f:
            roads = json.load(f)
            
        for feature in roads['features']:
            geom = shape(feature['geometry'])
            if geom.geom_type == 'LineString':
                coords = list(geom.coords)
                for i in range(len(coords) - 1):
                    p1, p2 = coords[i], coords[i+1]
                    
                    dist = Point(p1).distance(Point(p2))
                    G.add_edge(p1, p2, weight=dist)
                    
        if len(G.nodes) == 0: return None
        
        # We must use the largest connected component. NetworkX cannot route across disconnected subgraphs because there are no edges connecting them.
        largest_cc = max(nx.connected_components(G), key=len)
        G = G.subgraph(largest_cc).copy()
        
        # Find nearest node to user
        def get_nearest_node(lon, lat):
            nodes = np.array(G.nodes())
            distances = np.sum((nodes - np.array([lon, lat]))**2, axis=1)
            return tuple(nodes[np.argmin(distances)])
            
        start_node = get_nearest_node(user_lng, user_lat)
        
        best_route = None
        best_spot = None
        min_cost = float('inf')
        
        for spot in safe_spots:
            target_node = get_nearest_node(spot['lng'], spot['lat'])
            try:
                path = nx.shortest_path(G, source=start_node, target=target_node, weight='weight')
                cost = nx.shortest_path_length(G, source=start_node, target=target_node, weight='weight')
                if cost < min_cost:
                    min_cost = cost
                    best_route = path
                    best_spot = spot
            except nx.NetworkXNoPath:
                continue
                
        if not best_route: return None
        
        # Reverse geocode safe spot name using Nominatim API
        spot_name = "Elevated Safe Zone"
        try:
            import requests
            url = f"https://nominatim.openstreetmap.org/reverse?lat={best_spot['lat']}&lon={best_spot['lng']}&format=json"
            headers = {"User-Agent": "FloodShield-Demo-App/1.0"}
            r = requests.get(url, headers=headers, timeout=3)
            if r.status_code == 200:
                data = r.json()
                if 'display_name' in data:
                    # Keep it short, just the first 2 parts (e.g. Village, District)
                    parts = data['display_name'].split(',')
                    spot_name = ', '.join(parts[:2]).strip()
        except Exception:
            pass
            
        best_spot['name'] = spot_name
        
        route_geojson = {
            "type": "Feature",
            "geometry": {
                "type": "LineString",
                "coordinates": [[user_lng, user_lat]] + best_route + [[best_spot['lng'], best_spot['lat']]]
            },
            "properties": {"type": "evacuation_route"}
        }
        
        return {"route": route_geojson, "safe_spot": best_spot}
        
    except Exception as e:
        print("Routing Error:", e)
        return None
