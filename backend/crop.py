import rasterio
from rasterio.mask import mask
from shapely.geometry import box
import os

base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
input_file = os.environ.get("ESA_WORLDCOVER_PATH", "ESA_WorldCover_10m.tif")
output_dir = os.path.join(base_dir, "frontend", "public", "data")
os.makedirs(output_dir, exist_ok=True)
output_file = os.path.join(output_dir, "lulc.tif")

# Bhuragaon Bounds from config.py
min_lon, min_lat, max_lon, max_lat = 92.15, 26.21, 92.30, 26.31
bbox = box(min_lon, min_lat, max_lon, max_lat)

if os.path.exists(input_file):
    print(f"Cropping {input_file}...")
    try:
        with rasterio.open(input_file) as src:
            geo_json = [bbox.__geo_interface__]
            out_image, out_transform = mask(src, geo_json, crop=True)
            out_meta = src.meta.copy()

            out_meta.update({
                "driver": "GTiff",
                "height": out_image.shape[1],
                "width": out_image.shape[2],
                "transform": out_transform
            })

            with rasterio.open(output_file, "w", **out_meta) as dest:
                dest.write(out_image)
        print("Cropped successfully to:", output_file)
    except Exception as e:
        print("Error:", e)
else:
    print(f"Input file {input_file} not found. Set ESA_WORLDCOVER_PATH environment variable.")
