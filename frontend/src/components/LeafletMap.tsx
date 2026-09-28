"use client";
import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, ZoomControl, GeoJSON, useMap, ImageOverlay, useMapEvents, Circle, Rectangle, LayerGroup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import parseGeoraster from 'georaster';
import GeoRasterLayer from 'georaster-layer-for-leaflet';

// Fix for default marker icons in Leaflet with Next.js/Webpack
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const PrecipitationHeatmap = ({ rainfall }: { rainfall: number | null }) => {
  const map = useMap();
  
  useEffect(() => {
    // Create a custom pane for the heatmap to guarantee it renders above ALL raster/vector layers
    if (!map.getPane('heatmapPane')) {
      map.createPane('heatmapPane');
      const pane = map.getPane('heatmapPane');
      if (pane) {
        pane.style.zIndex = '650';
        pane.style.pointerEvents = 'none';
      }
    }
  }, [map]);

  if (rainfall === null || rainfall === 0) return null;
  
  let color = 'transparent';
  let opacity = Math.min(0.8, 0.3 + (rainfall / 200));
  
  if (rainfall < 20) color = '#22c55e'; // Green
  else if (rainfall < 60) color = '#eab308'; // Yellow
  else if (rainfall < 100) color = '#f97316'; // Orange
  else color = '#ef4444'; // Red

  // Exact bounding box matching the Bhuragaon DEM Raster image
  const bounds: [number, number][] = [[26.322, 92.192], [26.421, 92.342]];

  return (
    <Rectangle 
       key={`heatmap-${rainfall}`}
       bounds={bounds} 
       pathOptions={{ fillColor: color, fillOpacity: opacity, stroke: false, pane: 'heatmapPane' }} 
    />
  );
};

const RasterLayer = ({ url, options }: { url: string; options?: any }) => {
  const map = useMap();
  useEffect(() => {
    let layer: any;
    let isMounted = true;
    
    fetch(url)
      .then((response) => response.arrayBuffer())
      .then((arrayBuffer) => parseGeoraster(arrayBuffer))
      .then((georaster) => {
        if (!isMounted) return; // Prevent "ghost layers" if unchecked quickly
        
        layer = new GeoRasterLayer({
          georaster: georaster,
          opacity: 0.7,
          resolution: 256,
          ...options
        });
        layer.addTo(map);
      })
      .catch(err => console.error("Raster load error:", err));
      
    return () => {
      isMounted = false;
      if (layer && map.hasLayer(layer)) {
        map.removeLayer(layer);
      }
    };
  }, [map, url, options]);
  return null;
};

  // Map Click Listener for User Location
  const MapClickHandler = ({ setUserLocation }: { setUserLocation?: (loc: [number, number]) => void }) => {
    useMapEvents({
      click(e) {
        if (setUserLocation) {
          setUserLocation([e.latlng.lat, e.latlng.lng]);
        }
      }
    });
    return null;
  };
  const ResetViewButton = ({ center, zoom }: { center: [number, number], zoom: number }) => {
  const map = useMap();
  return (
    <button 
      onClick={(e) => { 
        e.preventDefault(); 
        map.flyTo(center, zoom, { duration: 1.5 }); 
      }}
      className="absolute z-[1000] cursor-pointer bg-white hover:bg-gray-50 rounded-[12px] flex items-center justify-center w-[44px] h-[44px]"
      style={{ left: '66px', bottom: '18px', boxShadow: '0 1px 4px rgba(0,0,0,0.3)' }}
      title="Recenter Map"
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-800 hover:text-blue-600 transition-colors">
        <circle cx="12" cy="12" r="5" />
        <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
        <line x1="12" y1="2" x2="12" y2="5" />
        <line x1="12" y1="19" x2="12" y2="22" />
        <line x1="2" y1="12" x2="5" y2="12" />
        <line x1="19" y1="12" x2="22" y2="12" />
      </svg>
    </button>
  );
};

export default function LeafletMap({ layers, hoveredRainfall, aiSafeSpots, userLocation, setUserLocation, routeGeoJSON, strandedGroups, activeRescueGroup, showRescueLayer }: { layers: any, hoveredRainfall?: number | null, aiSafeSpots?: any[], userLocation?: [number, number] | null, setUserLocation?: (loc: [number, number]) => void, routeGeoJSON?: any, strandedGroups?: any[], activeRescueGroup?: any, showRescueLayer?: boolean }) {
  // Exact center of Bhuragaon, Assam based on GeoJSON limits
  const bhuragaonPosition: [number, number] = [26.3715, 92.267]; 
  
  const [roadsData, setRoadsData] = useState(null);
  const [landuseData, setLanduseData] = useState(null);
  const [buildingsData, setBuildingsData] = useState(null);
  const [sheltersData, setSheltersData] = useState(null);

  useEffect(() => {
    // Fetch Vector Data
    fetch('/data/roads.geojson').then(r => r.json()).then(setRoadsData).catch(e => console.error("Roads error", e));
    fetch('/data/landuse.geojson').then(r => r.json()).then(setLanduseData).catch(e => console.error("Landuse error", e));
    fetch('/data/buildings.geojson').then(r => r.json()).then(setBuildingsData).catch(e => console.error("Buildings error", e));
    fetch('/data/shelters.geojson').then(r => r.json()).then(setSheltersData).catch(e => console.error("Shelters error", e));
    // This forces a resize event when the map mounts to prevent the classic Leaflet "grey tile" rendering bug
    setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
    }, 100);
  }, []);

  const mapRef = React.useRef<any>(null);

  // Fly to active rescue group
  useEffect(() => {
      if (activeRescueGroup && mapRef.current) {
          mapRef.current.flyTo([activeRescueGroup.lat, activeRescueGroup.lng], 16, { duration: 1.5 });
      }
  }, [activeRescueGroup]);

  return (
    <div className="h-full w-full relative z-0">
      <style>{`
        /* Modern Leaflet Zoom Controls */
        .leaflet-control-zoom.leaflet-bar {
            border: none !important;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06) !important;
            border-radius: 0.75rem !important;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            gap: 1px;
            background-color: #e5e7eb;
        }
        .leaflet-control-zoom.leaflet-bar a {
            width: 36px !important;
            height: 36px !important;
            line-height: 36px !important;
            background-color: rgba(255, 255, 255, 0.95) !important;
            color: #4b5563 !important;
            font-size: 1.25rem !important;
            font-weight: 500 !important;
            border: none !important;
            transition: all 0.2s ease-in-out !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
        }
        .leaflet-control-zoom.leaflet-bar a:hover {
            background-color: #ffffff !important;
            color: #2563eb !important;
        }
        .leaflet-control-zoom.leaflet-bar a:focus {
            outline: none !important;
        }
        .leaflet-control-zoom-in, .leaflet-control-zoom-out {
            text-indent: 0 !important;
        }
        .leaflet-bottom .leaflet-control {
            margin-bottom: 24px !important;
        }
        .leaflet-right .leaflet-control {
            margin-right: 24px !important;
        }
      `}</style>
      {hoveredRainfall !== undefined && hoveredRainfall !== null && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-white/90 text-blue-600 px-6 py-2 rounded-full shadow-2xl font-bold z-[9999] border border-blue-200 pointer-events-none transition-all">
          Map Engine Received Rainfall: {hoveredRainfall} mm
        </div>
      )}
      <MapContainer 
        center={bhuragaonPosition} 
        zoom={13} 
        className="h-full w-full"
        zoomControl={false}
        attributionControl={false}
        ref={mapRef}
      >
        <MapClickHandler setUserLocation={setUserLocation} />
        <ZoomControl position="bottomleft" />
        <ResetViewButton center={bhuragaonPosition} zoom={13} />
        
        {/* Base Map Layer */}
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CartoDB</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />

        {/* Raster Layer: DEM */}
        {layers.dem && (
          <ImageOverlay url="/data/dem_color.png" bounds={[[26.2501389, 91.9968055], [26.5329166, 92.5465277]]} opacity={0.65} />
        )}





        {/* Raster Layer: ANUGA Peak Flood Depth */}
        {layers.floodDepth && (
          <ImageOverlay 
            url={`/data/flood_depth.png?t=${new Date().getTime()}`}
            bounds={[[26.2501389, 91.9968055], [26.5329166, 92.5465277]]}
            opacity={0.7}
          />
        )}


        {/* Vector Layer: Roads */}

        {layers.lulc && (
          <ImageOverlay 
            url="/data/lulc_color.png?v=3" 
            bounds={[[26.2501389, 91.9968055], [26.5329166, 92.5465277]]}
            opacity={0.65}
          />
        )}
        
        {layers.buildings && buildingsData && (
          <GeoJSON 
            key="buildings-layer"
            data={buildingsData} 
            style={{ color: '#4a4a4a', weight: 1, fillColor: '#d4d4d4', fillOpacity: 0.8 }} 
          />
        )}

        {layers.roads && roadsData && (
          <GeoJSON 
            key="roads-layer"
            data={roadsData} 
            style={{ color: '#334155', weight: 1.2, opacity: 0.6, lineCap: 'round', lineJoin: 'round' }} 
          />
        )}

        {/* Vector Layer: Shelters */}
        {layers.shelters && sheltersData && (
          <GeoJSON 
            key="shelters-layer"
            data={sheltersData} 
            style={{ color: '#f59e0b', weight: 1, fillOpacity: 0.1 }} 
          />
        )}

                {/* User Location Marker */}
        {userLocation && (
          <Marker position={userLocation} icon={L.divIcon({ className: 'bg-transparent', html: '<div class="w-6 h-6 bg-blue-600 rounded-full border-2 border-white shadow-lg animate-pulse"></div>', iconSize: [24,24], iconAnchor: [12,12] })}>
            <Popup><strong>Your Start Location</strong></Popup>
          </Marker>
        )}

        {/* Evacuation Route */}
        {routeGeoJSON && (
          <GeoJSON 
            key={JSON.stringify(routeGeoJSON)}
            data={routeGeoJSON} 
            style={{ color: '#10b981', weight: 5, opacity: 0.8, lineCap: 'round', lineJoin: 'round' }} 
          />
        )}

        {/* Stranded Groups / Rescue Layer */}
        {showRescueLayer && strandedGroups && (
          <LayerGroup>
            {strandedGroups.map((group) => {
              const isActive = activeRescueGroup?.id === group.id;
              
              // Create a custom pulsing div icon for critical targets
              const customIcon = L.divIcon({
                className: 'custom-rescue-icon',
                html: `
                  <div style="
                    width: ${isActive ? '24px' : '16px'}; 
                    height: ${isActive ? '24px' : '16px'}; 
                    background-color: ${group.tier === 'CRITICAL' ? '#ef4444' : group.tier === 'HIGH' ? '#f97316' : '#eab308'}; 
                    border-radius: 50%; 
                    border: 2px solid white; 
                    box-shadow: 0 0 10px rgba(0,0,0,0.5);
                    ${group.tier === 'CRITICAL' ? 'animation: pulse 1.5s infinite;' : ''}
                    transition: all 0.3s ease;
                  "></div>
                `,
                iconSize: [24, 24],
                iconAnchor: [12, 12]
              });

              return (
                <Marker 
                  key={group.id} 
                  position={[group.lat, group.lng]}
                  icon={customIcon}
                  zIndexOffset={isActive ? 1000 : 0}
                >
                  <Popup>
                    <div className="font-sans text-sm p-1">
                      <div className="font-bold text-gray-800 border-b pb-1 mb-1">{group.id} (Safe Spot)</div>
                      <div className="text-gray-600">Elevation: <span className="font-bold text-orange-600">{group.elevation}m</span></div>
                      <div className={`mt-2 text-xs font-bold text-white px-2 py-1 rounded text-center ${group.tier === 'CRITICAL' ? 'bg-red-500' : group.tier === 'HIGH' ? 'bg-orange-500' : 'bg-yellow-500'}`}>
                        {group.tier} PRIORITY
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </LayerGroup>
        )}

        {/* AI-Generated Safe Spots */}
        {layers.aiSafeSpots && aiSafeSpots && aiSafeSpots.length > 0 && (
          <LayerGroup>
            {aiSafeSpots.map((spot: any, index: number) => (
          <Marker 
            key={`safe-spot-${index}`} 
            position={[spot.lat, spot.lng]}
            icon={L.icon({
              iconUrl: '/safe_spot_icon_transparent.png',
              iconSize: [80, 80],
              iconAnchor: [40, 80],
              popupAnchor: [0, -80]
            })}><Popup><div className="font-sans min-w-[160px]"><div className="flex items-center gap-2 mb-2"><div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div><strong className="text-emerald-800 text-[13px] tracking-wide uppercase">Verified Safe Zone</strong></div><div className="text-xs text-gray-600 mt-2 border-t pt-2 leading-relaxed"><span className="font-semibold text-gray-900">Area:</span> {spot.area ? Math.round(spot.area * 900).toLocaleString() : 0} m²<br/><span className="font-semibold text-gray-900">Coords:</span> {spot.lat.toFixed(4)}, {spot.lng.toFixed(4)}<br/><span className="font-semibold text-gray-900">Status:</span> Above Flood Level</div></div></Popup>
          </Marker>
            ))} 
          </LayerGroup>
        )}
{/* Global Precipitation Heatmap (Driven by Timeline Hover) */}
        <PrecipitationHeatmap rainfall={hoveredRainfall ?? null} />
      </MapContainer>
    </div>
  );
}





