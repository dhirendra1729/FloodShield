import os
import geopandas as gpd
from sqlalchemy import create_engine
from config import settings

def get_engine():
    # Construct SQLAlchemy URL for PostgreSQL
    db_url = f"postgresql://{settings.POSTGRES_USER}:{settings.POSTGRES_PASSWORD}@{settings.POSTGRES_HOST}:{settings.POSTGRES_PORT}/{settings.POSTGRES_DB}"
    return create_engine(db_url)

def check_connection():
    try:
        engine = get_engine()
        with engine.connect() as conn:
            return True
    except Exception as e:
        print(f"Database connection failed: {e}")
        return False

def ingest_geojson_to_postgis(geojson_path: str, table_name: str):
    """
    Reads a GeoJSON file and ingests it into the PostGIS database.
    """
    if not os.path.exists(geojson_path):
        print(f" -> Error: File {geojson_path} does not exist. Cannot ingest.")
        return False

    print(f" -> Reading {os.path.basename(geojson_path)}...")
    try:
        gdf = gpd.read_file(geojson_path)
        
        if gdf.empty:
            print(f" -> Warning: {geojson_path} is empty.")
            return False
            
        # Ensure we have a valid CRS, default to WGS84
        if gdf.crs is None:
            gdf = gdf.set_crs(epsg=4326)
        
        # We project to UTM 46N (metric) for accurate distance calculations in Assam
        gdf = gdf.to_crs(epsg=32646)
        
        # Ensure geometries are valid
        gdf['geometry'] = gdf['geometry'].make_valid()
        
        # Drop columns containing complex types (like lists or dicts) which PostgreSQL rejects
        for col in gdf.columns:
            if gdf[col].dtype == 'object':
                gdf[col] = gdf[col].astype(str)
        
        print(f" -> Ingesting {len(gdf)} records into PostGIS table '{table_name}'...")
        engine = get_engine()
        
        # Push to PostGIS using GeoPandas built-in method
        gdf.to_postgis(
            name=table_name,
            con=engine,
            if_exists='replace',
            index=False
        )
        print(f" -> ✅ Successfully ingested {table_name} into PostGIS!")
        return True
        
    except Exception as e:
        print(f" -> ❌ Failed to ingest {table_name}: {e}")
        return False
