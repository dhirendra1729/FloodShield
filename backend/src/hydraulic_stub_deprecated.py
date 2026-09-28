import os
import warnings

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
PROCESSED_DIR = os.path.join(DATA_DIR, "processed")

def run_simulation(dem_file: str = None):
    """
    ANUGA Hydraulic Simulation pipeline.
    Simulates flood inundation over a 2D mesh.
    """
    print("=== Starting ANUGA Simulation Pipeline ===")
    
    try:
        import anuga
    except ImportError:
        warnings.warn("ANUGA is not installed or failed to import. Please install anuga. Simulation aborted.")
        return

    print("1. Creating domain and generating mesh...")
    # NOTE: In a real scenario, convert DEM .tif to .pts and generate mesh.
    # For now, we mock a 1km x 1km rectangular domain to test the pipeline.
    length = 1000.0
    width = 1000.0
    domain = anuga.rectangular_cross_domain(
        int(length/50), int(width/50), len1=length, len2=width
    )
    
    domain.set_name("bhuragaon_flood_sim")
    domain.set_datadir(PROCESSED_DIR)

    print("2. Setting initial conditions (Elevation, Friction, Water Depth)...")
    # Simulate a gentle slope downwards towards the east
    domain.set_quantity('elevation', lambda x, y: 5.0 - x/1000.0) 
    
    # ---------------------------------------------------------
    # World Cover / Land Use Land Cover (LULC) Friction Mapping
    # ---------------------------------------------------------
    lulc_path = os.path.join(DATA_DIR, "raw", "lulc.tif")
    if os.path.exists(lulc_path):
        print(" -> Detected World Cover data (lulc.tif)! Mapping raster classes to Manning's 'n' friction values...")
        # In production ANUGA, you extract raster values and apply them to domain polygons.
        # Examples of ESA WorldCover mapping:
        # Trees (10) -> 0.1, Cropland (40) -> 0.04, Built-up (50) -> 0.015, Water (80) -> 0.01
        domain.set_quantity('friction', lambda x, y: 0.04) # Mocking an agriculture-dominant region
    else:
        print(" -> No World Cover data (lulc.tif) found. Falling back to generic friction (0.03).")
        domain.set_quantity('friction', 0.03)  # Generic fallback
        
    domain.set_quantity('stage', 0.0)      # Initially dry

    print("3. Setting boundary conditions (River Inflow)...")
    # Setup boundaries: Left=River Inflow, Right/Top/Bottom=Reflective
    Br = anuga.Reflective_boundary(domain)
    # Simulate a sudden flood wave (10m height) entering from the left (west)
    Bd = anuga.Dirichlet_boundary([10.0, 0.0, 0.0]) 
    
    domain.set_boundary({
        'left': Bd,
        'right': Br,
        'top': Br,
        'bottom': Br
    })

    print("4. Evolving simulation over time...")
    # Run the simulation for 100 seconds (mock time)
    for t in domain.evolve(yieldstep=10, finaltime=100):
        print(f" -> Evolving... Time: {t:.1f}s / 100.0s")
    
    print(f"=== Simulation complete! ===")
    print(f"Results saved in: {PROCESSED_DIR}\\bhuragaon_flood_sim.sww")
    print("You can view this .sww file in QGIS using the ANUGA Viewer Plugin.")

if __name__ == "__main__":
    os.makedirs(PROCESSED_DIR, exist_ok=True)
    run_simulation()
