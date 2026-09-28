import rasterio
import numpy as np
from PIL import Image
import os

base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
lulc_path = os.path.join(base_dir, "frontend", "public", "data", "lulc_v2.tif")
out_png = os.path.join(base_dir, "frontend", "public", "data", "lulc_color.png")

if os.path.exists(lulc_path):
    print("Converting GeoTIFF to colored PNG...")
    with rasterio.open(lulc_path) as src:
        data = src.read(1)
        h, w = data.shape
        rgba = np.zeros((h, w, 4), dtype=np.uint8)
        
        # ESA WorldCover Mapping
        rgba[data == 10] = [0, 100, 0, 200]    # Trees
        rgba[data == 40] = [255, 255, 0, 150]  # Cropland
        rgba[data == 50] = [255, 0, 0, 200]    # Built-up
        rgba[data == 80] = [0, 0, 255, 200]    # Water
        
        img = Image.fromarray(rgba, 'RGBA')
        img.save(out_png)
        print(f"Saved optimized PNG to: {out_png}")
