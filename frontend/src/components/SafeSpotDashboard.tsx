"use client";
import React, { useState } from 'react';
import { Shield, Navigation, Smartphone, MapPin, XCircle } from 'lucide-react';

export default function SafeSpotDashboard({ 
    setLayers,
    userLocation, 
    setUserLocation,
    routeGeoJSON,
    setAiSafeSpots, 
    setRouteGeoJSON, 
    destinationName, 
    setDestinationName,
    onNavigateToSms 
}: any) {
  const [isSimulating, setIsSimulating] = useState(false);
  const [destinationCoords, setDestinationCoords] = useState<[number, number] | null>(null);

  const handleFindRoute = async () => {
    if (!userLocation) {
      alert("Please click on the map to set your starting location first!");
      return;
    }

    setIsSimulating(true);
    try {
      const response = await fetch('/data/sample_rainfall.csv');
      const csvData = await response.text();

      const apiRes = await fetch('/api/wflow/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            csv_data: csvData, 
            soil_moisture: 'Normal',
            user_lat: userLocation[0],
            user_lng: userLocation[1]
        })
      });
      
      const result = await apiRes.json();
      if (result.status === 'success') {
        if(setAiSafeSpots) setAiSafeSpots(result.safe_spots || []);
        if (result.route_info) {
            if(setRouteGeoJSON) setRouteGeoJSON(result.route_info.route);
            if(setDestinationName) setDestinationName(result.route_info.safe_spot?.name || "Verified Safe Zone");
            if(setLayers) setLayers((prev: any) => ({ ...prev, prePeakFlood: true, floodDepth: false }));
            
            // Extract destination coords from routeGeoJSON (last coordinate)
            if (result.route_info.route?.geometry?.coordinates) {
                const coords = result.route_info.route.geometry.coordinates;
                if (coords.length > 0) {
                    const lastCoord = coords[coords.length - 1];
                    setDestinationCoords([lastCoord[1], lastCoord[0]]); // Leaflet uses [lat, lng], GeoJSON uses [lng, lat]
                }
            } else if (result.route_info.safe_spot) {
                setDestinationCoords([result.route_info.safe_spot.lat, result.route_info.safe_spot.lng]);
            }
            
            // Register this safe spot location as awaiting evac!
            try {
                let destLat = userLocation[0];
                let destLng = userLocation[1];
                if (result.route_info.route?.geometry?.coordinates?.length > 0) {
                    const lastCoord = result.route_info.route.geometry.coordinates[result.route_info.route.geometry.coordinates.length - 1];
                    destLat = lastCoord[1];
                    destLng = lastCoord[0];
                } else if (result.route_info.safe_spot) {
                    destLat = result.route_info.safe_spot.lat;
                    destLng = result.route_info.safe_spot.lng;
                }

                await fetch('/api/rescue/stranded', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        lat: destLat,
                        lng: destLng,
                        population: 1, // Hidden in UI
                        elevation: Math.floor(Math.random() * 20) + 2    // Random elevation 2-22m
                    })
                });
            } catch(e) {
                console.error("Failed to register rescue group", e);
            }

        } else {
            alert("No safe route could be found from this location during the Pre-Peak flood!");
            if(setRouteGeoJSON) setRouteGeoJSON(null);
            if(setDestinationName) setDestinationName(null);
            setDestinationCoords(null);
        }
      }
    } catch (e: any) {
      console.error(e);
      alert("Error calculating route.");
    } finally {
      setIsSimulating(false);
    }
  };

  const handleReset = () => {
      if(setUserLocation) setUserLocation(null);
      if(setRouteGeoJSON) setRouteGeoJSON(null);
      if(setDestinationName) setDestinationName(null);
      setDestinationCoords(null);
  };

  const handlePrepareSMS = () => {
      if(onNavigateToSms) {
          onNavigateToSms({
              phone_number: "",
              destinationName: destinationName,
              destinationCoords: destinationCoords,
              routeGeoJSON: routeGeoJSON
          });
      }
  };

  return (
    <div className="bg-surface-glass backdrop-blur-24 border border-white/10 w-[300px] flex flex-col pointer-events-auto rounded-xl shadow-xl self-start mt-4 ml-4 overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-white/10 bg-white/5">
            <div className="flex items-center gap-3">
                <div className="p-1.5 bg-primary/20 rounded-lg border border-primary/30">
                    <Shield className="w-5 h-5 text-primary" />
                </div>
                <div>
                    <h2 className="text-sm font-title-sm text-on-surface">Evacuation Route</h2>
                    <p className="text-[10px] text-on-surface-variant font-label-caps mt-0.5">Click map to set start point</p>
                </div>
            </div>
            {userLocation && (
                <button onClick={handleReset} className="p-1.5 text-on-surface-variant hover:text-error hover:bg-error/10 rounded-full transition-colors" title="Clear Location">
                    <XCircle className="w-4 h-4" />
                </button>
            )}
        </div>

        {/* Coordinates Display */}
        <div className="p-4 flex flex-col gap-4">
            <div className={`p-3 rounded-lg flex flex-col gap-1 transition-all ${userLocation ? 'bg-surface-container-high/50 border border-white/10' : 'bg-surface-container-highest/30 border border-dashed border-white/10'}`}>
                <div className="flex items-center gap-1.5 text-[10px] font-label-caps text-on-surface-variant">
                    <MapPin className="w-3 h-3" /> Start Position
                </div>
                {userLocation ? (
                    <div className="text-sm font-data-mono text-on-surface tracking-tight">
                        {userLocation[0].toFixed(4)}, {userLocation[1].toFixed(4)}
                    </div>
                ) : (
                    <div className="text-xs font-body-md text-on-surface-variant/50">
                        Waiting for map selection...
                    </div>
                )}
            </div>
            
            {destinationCoords && (
                <div className="p-3 rounded-lg border border-primary/30 bg-primary/10 flex flex-col gap-1">
                    <div className="flex items-center gap-1.5 text-[10px] font-label-caps text-primary">
                        <MapPin className="w-3 h-3" /> Safe Zone Target
                    </div>
                    <div className="text-sm font-data-mono text-on-surface tracking-tight">
                        {destinationCoords[0].toFixed(4)}, {destinationCoords[1].toFixed(4)}
                    </div>
                </div>
            )}

            <button 
                onClick={handleFindRoute}
                disabled={!userLocation || isSimulating}
                className={`w-full py-2 rounded-lg font-bold text-xs transition-all flex items-center justify-center gap-2 ${!userLocation ? 'bg-surface-container-high/50 text-on-surface-variant cursor-not-allowed border border-white/5' : 'bg-primary/20 hover:bg-primary/30 text-primary border border-primary shadow-[0_0_15px_rgba(190,198,224,0.15)] active:scale-95'}`}
            >
                {isSimulating ? <div className="w-3 h-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin"></div> : <Navigation className="w-3 h-3" />}
                {isSimulating ? "Calculating..." : (routeGeoJSON ? "Recalculate Route" : "Find Safe Route")}
            </button>

            {destinationName && (
                <div className="mt-1 pt-4 border-t border-white/10 flex flex-col gap-3">
                    <div>
                        <div className="text-[10px] font-label-caps text-on-surface-variant mb-1">Destination</div>
                        <div className="text-sm font-title-sm text-on-surface leading-tight truncate" title={destinationName}>{destinationName}</div>
                    </div>
                    
                    <button 
                        onClick={handlePrepareSMS}
                        className="w-full py-2 rounded-lg font-bold text-xs transition-all flex items-center justify-center gap-2 bg-secondary/20 border border-secondary text-secondary hover:bg-secondary/30 shadow-[0_0_15px_rgba(255,180,171,0.15)] active:scale-95"
                    >
                        <Smartphone className="w-3 h-3" />
                        Open SMS Dispatch
                    </button>
                </div>
            )}
        </div>
    </div>
  );
}
