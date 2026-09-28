import os
import json
import numpy as np
import matplotlib
matplotlib.use('Agg') # Fix Tkinter thread crash in FastAPI
import matplotlib.pyplot as plt
import rasterio
from scipy import ndimage

def run_anuga_simulation(discharge_data_json):
    discharge_data = json.loads(discharge_data_json)
    
    discharges = [float(row.get('discharge', 0)) for row in discharge_data]
    if not discharges:
        return []
        
    peak_idx = np.argmax(discharges)
    peak_discharge = discharges[peak_idx]
    
    pre_peak_idx = max(0, peak_idx - 4)
    pre_peak_discharge = discharges[pre_peak_idx]
    
    # Paths
    backend_dir = os.path.dirname(__file__)
    public_dir = os.path.join(os.path.dirname(backend_dir), 'frontend', 'public', 'data')
    dem_path = os.path.join(public_dir, 'dem.tif')
    out_png_path = os.path.join(public_dir, 'flood_depth.png')
    pre_peak_png_path = os.path.join(public_dir, 'pre_peak_flood.png')
    
    if not os.path.exists(dem_path):
        return []
        
    with rasterio.open(dem_path) as src:
        dem_data = src.read(1)
        transform = src.transform
        
    dem_min = np.min(dem_data[dem_data > -9999])
    valid_data = dem_data[dem_data > -9999]
    dem_max = np.percentile(valid_data, 95) # Aggressive clip to ignore mountain peaks for flat plains flooding
    
    # 1. Peak Flood PNG
    severity = min(1.0, peak_discharge / 150.0) 
    flood_level = dem_min + (dem_max - dem_min) * (severity * 0.7)
    
    flood_mask = (dem_data <= flood_level) & (dem_data > -9999)
    depth_data = np.where(flood_mask, flood_level - dem_data, 0)
    
    # Apply Gaussian Blur to smooth blocky DEM pixels
    depth_data = ndimage.gaussian_filter(depth_data, sigma=1.5)
    
    # Create an edge fade mask (feathering) to avoid hard straight-line cutoffs at the bounding box
    h, w = dem_data.shape
    y, x = np.ogrid[:h, :w]
    dist_x = np.minimum(x, w - 1 - x)
    dist_y = np.minimum(y, h - 1 - y)
    dist = np.minimum(dist_x, dist_y)
    fade_pixels = 100.0 # Fade out over 100 pixels near the edge
    fade = np.clip(dist / fade_pixels, 0, 1)
    
    # Apply fade
    depth_data = depth_data * fade
    
    fig, ax = plt.subplots(figsize=(10, 10))
    cmap = plt.cm.Blues
    cmap.set_under(color='none') 
    
    ax.imshow(depth_data, cmap=cmap, vmin=0.1, vmax=max(0.2, flood_level-dem_min))
    ax.axis('off')
    plt.savefig(out_png_path, transparent=True, bbox_inches='tight', pad_inches=0, dpi=256)
    plt.close(fig)
    
    # 3. Calculate Safe Spots from Peak Flood
    dry_mask = (~flood_mask) & (dem_data > -9999)
    labeled_array, num_features = ndimage.label(dry_mask)
    
    min_blob_size = 500 # Increased from 100 to require much larger continuous dry areas
    safe_spots = []
    
    for i in range(1, num_features + 1):
        blob_mask = (labeled_array == i)
        if np.sum(blob_mask) >= min_blob_size:
            y_coords, x_coords = np.where(blob_mask)
            center_y = int(np.mean(y_coords))
            center_x = int(np.mean(x_coords))
            
            lon, lat = transform * (center_x, center_y)
            safe_spots.append({"lat": lat, "lng": lon, "id": i, "area": int(np.sum(blob_mask))})
            
    # Sort by area (descending) and keep only the top 8 largest safe spots to avoid clutter
    safe_spots = sorted(safe_spots, key=lambda x: x["area"], reverse=True)[:8]
    
    print(f"ANUGA Simulation Complete. Found {len(safe_spots)} major Safe Zones.")
    return safe_spots
