import csv
import io
import os
import rasterio
import numpy as np
from typing import List, Dict

# ESA WorldCover to Curve Number (AMC II) mapping
# Generic mapping for average soil conditions
LULC_CN_MAP = {
    10: 55,  # Trees
    20: 65,  # Shrubland
    30: 70,  # Grassland
    40: 75,  # Cropland
    50: 90,  # Built-up
    60: 85,  # Bare
    70: 75,  # Snow/Ice
    80: 100, # Water
    90: 95,  # Wetland
    95: 95,  # Mangroves
    100: 95  # Moss
}

def get_dynamic_curve_number() -> float:
    """Calculates the weighted average Curve Number (AMC II) for the region based on LULC data."""
    public_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'frontend', 'public', 'data')
    lulc_path = os.path.join(public_dir, 'lulc_v2.tif')
    
    try:
        if not os.path.exists(lulc_path):
            return 75.0 # Fallback
            
        with rasterio.open(lulc_path) as src:
            data = src.read(1)
            
        # Count pixels for each class
        unique, counts = np.unique(data, return_counts=True)
        pixel_counts = dict(zip(unique, counts))
        
        total_pixels = 0
        weighted_cn_sum = 0.0
        
        for lulc_class, count in pixel_counts.items():
            if lulc_class in LULC_CN_MAP:
                weighted_cn_sum += LULC_CN_MAP[lulc_class] * count
                total_pixels += count
                
        if total_pixels == 0:
            return 75.0
            
        return weighted_cn_sum / total_pixels
    except Exception as e:
        print(f"Error calculating dynamic CN: {e}")
        return 75.0

def calculate_runoff(rainfall_csv_content: str, amc_condition: str = "Normal") -> List[Dict[str, float]]:
    """
    Simulates Wflow hydrology routing using the SCS-CN method.
    Takes a CSV string with 'time' and 'precipitation' columns.
    Returns a list of dicts containing time, precipitation, and the calculated surface discharge (runoff).
    """
    # 1. Calculate base Curve Number (AMC II) dynamically from Satellite LULC
    base_cn = get_dynamic_curve_number()
    
    # 2. Apply Antecedent Moisture Condition (AMC) multiplier
    # Equations from standard SCS-CN methodology
    if amc_condition == "Dry":
        # AMC I
        final_cn = (4.2 * base_cn) / (10 - 0.058 * base_cn)
    elif amc_condition == "Saturated":
        # AMC III
        final_cn = (23 * base_cn) / (10 + 0.13 * base_cn)
    else:
        # AMC II (Normal)
        final_cn = base_cn
        
    print(f"Dynamic Hydrology | Base CN: {base_cn:.2f} | AMC: {amc_condition} | Final CN: {final_cn:.2f}")

    # S = potential maximum retention (in mm)
    # Ensure CN is not exactly 0 to prevent DivisionByZero, cap at 99.9 for stability
    final_cn = max(1.0, min(99.9, final_cn))
    S = (25400.0 / final_cn) - 254.0
    
    # Ia = Initial abstraction (water absorbed by dry soil/plants before any runoff begins)
    Ia = 0.2 * S
    
    reader = csv.DictReader(io.StringIO(rainfall_csv_content))
    
    cumulative_P = 0.0
    cumulative_Q = 0.0
    results = []
    
    for row in reader:
        time_val = float(row.get('time', 0))
        # Handle cases where column might be named 'precipitation' or 'rainfall'
        p_val = row.get('precipitation', row.get('rainfall', 0))
        P_inc = float(p_val)
        
        cumulative_P += P_inc
        
        # Calculate cumulative Runoff (Q) using the SCS-CN formula
        if cumulative_P > Ia:
            Q_total = ((cumulative_P - Ia) ** 2) / (cumulative_P - Ia + S)
        else:
            Q_total = 0.0
            
        # Incremental runoff for this specific hour (the 'Discharge')
        Q_inc = Q_total - cumulative_Q
        Q_inc = max(0.0, Q_inc) # Prevent negative rounding errors
        
        cumulative_Q = Q_total
        
        results.append({
            'time': time_val,
            'precipitation': P_inc,
            'discharge': round(Q_inc, 2)
        })
        
    return results

if __name__ == "__main__":
    # Quick test if run directly
    sample_csv = "time,precipitation\n0,0\n1,5\n2,20\n3,50\n4,100"
    print(calculate_runoff(sample_csv))
