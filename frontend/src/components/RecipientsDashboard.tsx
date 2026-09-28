"use client";
import React, { useState, useEffect } from 'react';
import { Users, MapPin, Clock, MessageSquare, AlertCircle, RefreshCw, Send, CheckCircle2, X } from 'lucide-react';
import dynamic from 'next/dynamic';

const MiniRouteMap = dynamic(() => import('./MiniRouteMap'), { ssr: false });

export default function RecipientsDashboard() {
  const [recipients, setRecipients] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<any | null>(null);

  useEffect(() => {
    fetchRecipients();
    const interval = setInterval(fetchRecipients, 5000); // Poll every 5s
    return () => clearInterval(interval);
  }, []);

  const fetchRecipients = async () => {
    try {
      const res = await fetch('/api/sms/recipients');
      const data = await res.json();
      if (data.status === 'success') {
        setRecipients(data.data);
      }
    } catch (e) {
      console.error("Failed to fetch recipients");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full h-full bg-white border border-gray-300 flex flex-col pointer-events-auto">
      
      {/* Header Area */}
      <div className="bg-slate-900 p-6 flex items-center justify-between shrink-0 border-b border-gray-300">
        <div className="flex items-center gap-4">
          <div className="p-2 border border-slate-700 bg-slate-800">
            <Users className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h1 className="text-white font-bold text-xl tracking-tight uppercase">Active Dispatches</h1>
            <p className="text-slate-400 text-xs mt-1 flex items-center gap-2 font-mono">
              <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Real-time evacuation tracking log
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-4 mr-12">
          {isLoading && <RefreshCw className="w-4 h-4 text-slate-400 animate-spin" />}
          <div className="bg-slate-800 border border-slate-700 px-4 py-2 text-white font-bold text-sm flex items-center gap-2 uppercase tracking-wide">
            Total Dispatched: <span className="text-blue-400 font-mono">{recipients.length}</span>
          </div>
        </div>
      </div>

      {/* Table Area */}
      <div className="flex-1 overflow-auto bg-white p-6">
        
        {isLoading && recipients.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center">
               <RefreshCw className="w-8 h-8 text-slate-400 animate-spin mb-4" />
               <span className="font-bold text-slate-500 uppercase tracking-widest text-xs">Syncing with backend...</span>
            </div>
          </div>
        ) : recipients.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full">
            <AlertCircle className="w-12 h-12 text-slate-300 mb-4" />
            <h3 className="text-lg font-bold text-slate-700 mb-2 uppercase tracking-wider">No Evacuations Dispatched</h3>
            <p className="text-slate-500 max-w-md text-center text-sm">Use the AI Evacuation tab to find a safe route, then dispatch an SMS warning to populate this list.</p>
          </div>
        ) : (
          <div className="bg-white border border-gray-300 overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-100 border-b border-gray-300">
                  <th className="py-3 px-4 text-xs font-bold text-slate-700 uppercase tracking-wider w-40 border-r border-gray-300">Recipient Mobile</th>
                  <th className="py-3 px-4 text-xs font-bold text-slate-700 uppercase tracking-wider w-48 border-r border-gray-300">Coordinates</th>
                  <th className="py-3 px-4 text-xs font-bold text-slate-700 uppercase tracking-wider w-56 border-r border-gray-300">Safe Zone (Landmark)</th>
                  <th className="py-3 px-4 text-xs font-bold text-slate-700 uppercase tracking-wider w-40 border-r border-gray-300">Dispatch Time</th>
                  <th className="py-3 px-4 text-xs font-bold text-slate-700 uppercase tracking-wider">SMS Payload</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {recipients.slice().reverse().map((rec, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 transition-colors group">
                    <td className="py-4 px-4 border-r border-gray-200">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-emerald-500 animate-pulse border border-emerald-600"></div>
                        <span className="font-bold text-slate-800 text-sm font-mono">{rec.phone_number}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4 border-r border-gray-200">
                      <div className="flex items-center gap-2 text-slate-600 font-mono text-xs">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{rec.destination_coords || "N/A"}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4 border-r border-gray-200">
                      <div className="font-bold text-slate-800 flex items-center gap-2 text-sm">
                        {rec.destination_name !== "Elevated Safe Zone" && rec.destination_name !== "Unknown Safe Area" ? (
                          <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] uppercase font-bold px-1.5 py-0.5 shrink-0">Verified</span>
                        ) : (
                          <span className="bg-amber-100 text-amber-800 border border-amber-300 text-[10px] uppercase font-bold px-1.5 py-0.5 shrink-0">Approx</span>
                        )}
                        <span className="truncate">{rec.destination_name}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-xs text-slate-600 font-mono border-r border-gray-200">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        {rec.timestamp}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="bg-gray-50 p-3 border border-gray-300 text-xs text-slate-800 font-medium flex flex-col gap-3">
                         <div className="whitespace-pre-wrap">{rec.message}</div>
                         
                         {/* Map Screenshot (Mini Route Map) */}
                         {rec.destination_coords && (
                           <div 
                             className="border border-gray-300 relative h-[150px] bg-gray-200 flex items-center justify-center cursor-pointer group/img"
                             onClick={() => setSelectedImage(rec)}
                           >
                             <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold z-10 pointer-events-none uppercase tracking-widest">
                               Click to Expand
                             </div>
                             <div className="absolute inset-0 z-10"></div> {/* Click capture overlay */}
                             <MiniRouteMap 
                               routeGeoJSON={rec.route_geojson} 
                               destinationCoords={[parseFloat(rec.destination_coords.split(',')[0]), parseFloat(rec.destination_coords.split(',')[1])]} 
                               interactive={false}
                             />
                           </div>
                         )}

                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Full Screen Image Modal */}
      {selectedImage && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/90 flex items-center justify-center p-8" onClick={() => setSelectedImage(null)}>
          <div className="relative max-w-5xl w-full max-h-full flex flex-col items-center">
            <button 
              className="absolute -top-12 right-0 text-white bg-slate-800 hover:bg-slate-700 border border-slate-600 p-2 transition-colors"
              onClick={() => setSelectedImage(null)}
            >
              <X className="w-5 h-5" />
            </button>
            <div className="w-full h-[70vh] border-4 border-slate-700 bg-white" onClick={(e) => e.stopPropagation()}>
              <MiniRouteMap 
                routeGeoJSON={selectedImage.route_geojson} 
                destinationCoords={[parseFloat(selectedImage.destination_coords.split(',')[0]), parseFloat(selectedImage.destination_coords.split(',')[1])]} 
                interactive={true}
              />
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
