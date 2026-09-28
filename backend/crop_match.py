import rasterio
from rasterio.mask import mask
from shapely.geometry import box
import os

base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
input_lulc = os.environ.get("ESA_WORLDCOVER_PATH", "ESA_WorldCover_10m.tif")
input_dem = os.path.join(base_dir, "frontend", "public", "data", "dem.tif")
output_lulc = os.path.join(base_dir, "frontend", "public", "data", "lulc.tif")

if os.path.exists(input_dem) and os.path.exists(input_lulc):
    print("Reading DEM bounds...")
    with rasterio.open(input_dem) as dem:
        bounds = dem.bounds
        minx, miny, maxx, maxy = bounds.left, bounds.bottom, bounds.right, bounds.top
        
        buffer = 0.02
        minx -= buffer
        miny -= buffer
        maxx += buffer
        maxy += buffer

    bbox = box(minx, miny, maxx, maxy)

    print("Cropping LULC to match DEM...")
    try:
        with rasterio.open(input_lulc) as src:
            geo_json = [bbox.__geo_interface__]
            out_image, out_transform = mask(src, geo_json, crop=True)
            out_meta = src.meta.copy()

            out_meta.update({
                "driver": "GTiff",
                "height": out_image.shape[1],
                "width": out_image.shape[2],
                "transform": out_transform
            })

            with rasterio.open(output_lulc, "w", **out_meta) as dest:
                dest.write(out_image)
        print("Cropped successfully to:", output_lulc)
    except Exception as e:
        print("Error:", e)
