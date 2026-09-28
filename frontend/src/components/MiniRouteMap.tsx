"use client";
import React, { useEffect } from 'react';
import { MapContainer, TileLayer, GeoJSON, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix leaflet icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Component to fit bounds
function FitBounds({ routeGeoJSON, destinationCoords }: { routeGeoJSON: any, destinationCoords: any }) {
    const map = useMap();
    useEffect(() => {
        try {
            if (routeGeoJSON) {
                const geoJsonLayer = L.geoJSON(routeGeoJSON);
                map.fitBounds(geoJsonLayer.getBounds(), { padding: [20, 20] });
            } else if (destinationCoords) {
                map.setView(destinationCoords, 14);
            }
        } catch (e) {
            console.error("FitBounds error", e);
        }
    }, [map, routeGeoJSON, destinationCoords]);
    return null;
}

export default function MiniRouteMap({ routeGeoJSON, destinationCoords, interactive = false }: { routeGeoJSON?: any, destinationCoords?: any, interactive?: boolean }) {
    if (!destinationCoords) return null;
    
    // Check if window is defined (for Next.js SSR)
    if (typeof window === 'undefined') return null;

    return (
        <MapContainer 
            center={destinationCoords} 
            zoom={14} 
            zoomControl={interactive}
            dragging={interactive}
            scrollWheelZoom={interactive}
            doubleClickZoom={interactive}
            touchZoom={interactive}
            style={{ width: '100%', height: '100%', backgroundColor: '#f3f4f6', zIndex: 0 }}
        >
            <TileLayer
                url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                attribution='&copy; OpenStreetMap'
            />
            {routeGeoJSON && (
                <GeoJSON 
                    data={routeGeoJSON} 
                    style={{
                        color: '#10b981',
                        weight: 5,
                        opacity: 0.8,
                        lineCap: 'round',
                        lineJoin: 'round'
                    }}
                />
            )}
            <Marker position={destinationCoords} />
            <FitBounds routeGeoJSON={routeGeoJSON} destinationCoords={destinationCoords} />
        </MapContainer>
    );
}
