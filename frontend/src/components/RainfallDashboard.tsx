"use client";
import React, { useState, useRef, useMemo } from 'react';
import { CloudRain, Upload, X } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts';
import Papa from 'papaparse';

export default function RainfallDashboard({ setLayers, setAiSafeSpots }: any) {
  const [rainfallData, setRainfallData] = useState<any[] | null>(null);
  const [hoveredData, setHoveredData] = useState<any | null>(null);
  const [isSimulatingWflow, setIsSimulatingWflow] = useState(false);
  const [soilMoisture, setSoilMoisture] = useState("Normal");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [rainfallIntensity, setRainfallIntensity] = useState(85);
  const [tidalOffset, setTidalOffset] = useState(1.2);

  const maxValues = useMemo(() => {
      if (!rainfallData) return { precip: 0, runoff: 0 };
      return {
          precip: Math.max(...rainfallData.map(d => d.precipitation || 0)),
          runoff: Math.max(...rainfallData.map(d => d.discharge || 0))
      };
  }, [rainfallData]);

  const handleWflowSimulate = async () => {
    if (!rainfallData) return;
    setIsSimulatingWflow(true);
    
    try {
      const csvString = Papa.unparse(rainfallData);
      const response = await fetch('/api/wflow/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv_data: csvString, soil_moisture: soilMoisture })
      });
      
      const result = await response.json();
      if (result.status === 'success') {
        setRainfallData(result.data);
        if(setAiSafeSpots) setAiSafeSpots(result.safe_spots || []);
        if(setLayers) setLayers((prev: any) => ({ ...prev, floodDepth: true }));
      } else {
        alert("WFlow API Error: " + result.message);
      }
    } catch (e: any) {
      alert("Network Error: Could not reach the FastAPI server.");
    } finally {
      setIsSimulatingWflow(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      Papa.parse(file, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: (results) => {
          const formatted = results.data.map((row: any, i) => {
             const keys = Object.keys(row);
             return {
                time: row[keys[0]] ?? i,
                precipitation: row[keys[1]] ?? 0,
                discharge: 0
             };
          });
          setRainfallData(formatted);
        }
      });
    }
  };

  const clearData = () => {
      setRainfallData(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const loadSampleData = async () => {
      try {
          const response = await fetch('/data/sample_rainfall.csv');
          const csvData = await response.text();
          Papa.parse(csvData, {
              header: true,
              dynamicTyping: true,
              skipEmptyLines: true,
              complete: (results) => {
                  const formatted = results.data.map((row: any, i) => {
                      const keys = Object.keys(row);
                      return {
                          time: row[keys[0]] ?? i,
                          precipitation: row[keys[1]] ?? 0,
                          discharge: 0
                      };
                  });
                  setRainfallData(formatted);
              }
          });
      } catch (e) {
          alert("Could not load sample data.");
      }
  };

  return (
    <div className="max-w-[900px] w-full flex flex-col gap-4 pointer-events-auto self-start mt-4 ml-4">
      {/* Header Row */}
      <header className="flex justify-between items-center bg-surface-glass backdrop-blur-24 border border-white/10 p-4 rounded-xl shadow-xl">
        <div>
          <h1 className="font-title-lg text-on-surface m-0">Simulation</h1>
          <p className="font-label-caps text-[10px] text-on-surface-variant mt-0.5">Sector 7G - Scenario Delta-V</p>
        </div>
        <div className="bg-status-warning/10 border border-status-warning/30 px-3 py-1.5 rounded flex items-center gap-2">
          <span className="material-symbols-outlined text-status-warning text-[16px]">cloud_sync</span>
          <span className="font-label-caps text-[10px] text-status-warning font-bold tracking-wider">LIVE</span>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex gap-4 items-start">
        {/* Controls Panel (Left Col) */}
        <div className="w-[300px] shrink-0 bg-surface-glass backdrop-blur-24 rounded-xl p-4 flex flex-col shadow-xl border border-white/10">
          <h3 className="font-title-sm text-sm text-primary border-b border-white/10 pb-2 mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px]">tune</span>
            Parameters
          </h3>
          
          <div className="flex flex-col gap-4 flex-1">
            {!rainfallData ? (
                <div className="flex flex-col gap-2">
                    <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" ref={fileInputRef} />
                    <button onClick={() => fileInputRef.current?.click()} className="w-full py-2 bg-surface-container-high/50 hover:bg-white/5 text-primary text-xs font-bold flex items-center justify-center gap-2 border border-white/10 transition-colors rounded-lg">
                        <Upload className="w-3 h-3" /> Upload CSV
                    </button>
                    <div className="text-[10px] text-center font-bold text-on-surface-variant uppercase">OR</div>
                    <button onClick={loadSampleData} className="w-full py-2 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold border border-primary/30 transition-colors rounded-lg">
                        Use Sample Data
                    </button>
                </div>
            ) : (
                <>
                {/* Rainfall Slider */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="font-label-caps text-[10px] text-on-surface-variant">Rainfall Intensity</label>
                    <span className="font-data-mono text-[10px] text-secondary">{rainfallIntensity} mm/h</span>
                  </div>
                  <input className="w-full accent-primary h-1" max="200" min="0" type="range" value={rainfallIntensity} onChange={(e)=>setRainfallIntensity(Number(e.target.value))} />
                </div>

                {/* Soil Moisture Toggle */}
                <div className="bg-surface-container-high/50 p-3 rounded-lg border border-white/10">
                  <div className="flex justify-between items-center mb-2">
                    <label className="font-label-caps text-[10px] text-on-surface-variant">Soil Saturation</label>
                    <span className="material-symbols-outlined text-on-surface-variant text-[14px]">water_drop</span>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={()=>setSoilMoisture('Dry')} className={`flex-1 py-1 border rounded text-[10px] font-bold transition-colors ${soilMoisture==='Dry' ? 'bg-secondary-container/50 border-secondary text-secondary' : 'border-white/10 text-on-surface-variant hover:bg-white/5'}`}>DRY</button>
                    <button onClick={()=>setSoilMoisture('Normal')} className={`flex-1 py-1 border rounded text-[10px] font-bold transition-colors ${soilMoisture==='Normal' ? 'bg-secondary-container/50 border-secondary text-secondary' : 'border-white/10 text-on-surface-variant hover:bg-white/5'}`}>MID</button>
                    <button onClick={()=>setSoilMoisture('Wet')} className={`flex-1 py-1 border rounded text-[10px] font-bold transition-colors ${soilMoisture==='Wet' ? 'bg-secondary-container/50 border-secondary text-secondary' : 'border-white/10 text-on-surface-variant hover:bg-white/5'}`}>MAX</button>
                  </div>
                </div>

                {/* Tidal Influence */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="font-label-caps text-[10px] text-on-surface-variant">Tidal Surge Offset</label>
                    <span className="font-data-mono text-[10px] text-secondary">+{tidalOffset}m</span>
                  </div>
                  <input className="w-full accent-primary h-1" max="5" min="-2" step="0.1" type="range" value={tidalOffset} onChange={(e)=>setTidalOffset(Number(e.target.value))} />
                </div>
                </>
            )}
          </div>
          
          <button 
             onClick={handleWflowSimulate}
             disabled={isSimulatingWflow || !rainfallData}
             className={`w-full mt-4 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-95 ${isSimulatingWflow || !rainfallData ? 'bg-surface-container-high/50 text-on-surface-variant border border-white/10 cursor-not-allowed' : 'bg-primary/20 hover:bg-primary/30 border border-primary text-primary shadow-[0_0_20px_rgba(190,198,224,0.15)] hover:shadow-[0_0_30px_rgba(190,198,224,0.25)]'}`}
          >
            {isSimulatingWflow ? (
               <><div className="w-3 h-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin"></div> CALCULATING...</>
            ) : (
               <><span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>play_arrow</span> RUN SIMULATION</>
            )}
          </button>
        </div>

        {/* Visualization Panel (Chart) - only show if there is data */}
        {rainfallData && (
          <div className="bg-surface-glass backdrop-blur-24 rounded-xl flex-1 relative overflow-hidden flex flex-col shadow-xl border border-white/10 h-[300px] w-full">
             <div className="absolute top-3 right-3 z-10 flex gap-2">
                  <button onClick={clearData} className="bg-surface-container-high/80 backdrop-blur-md px-2 py-1 rounded border border-white/10 font-label-caps text-[10px] text-on-surface-variant hover:text-error transition-colors flex items-center gap-1">
                       <X className="w-3 h-3" /> CLEAR
                  </button>
             </div>
             <div className="absolute top-3 left-3 z-10 bg-status-emergency/20 backdrop-blur-md px-2 py-1 rounded border border-status-emergency/30 font-label-caps text-[10px] text-status-emergency flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-status-emergency animate-pulse"></div>
                  HYDROGRAPH
             </div>
             <div className="flex-1 w-full p-2 pt-12 pb-4">
                  <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={rainfallData} onMouseMove={(e: any) => { if(e && e.activePayload) setHoveredData(e.activePayload[0].payload) }} onMouseLeave={() => setHoveredData(null)}>
                          <defs>
                              <linearGradient id="colorRain" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#bec6e0" stopOpacity={0.8}/>
                                  <stop offset="95%" stopColor="#bec6e0" stopOpacity={0}/>
                              </linearGradient>
                              <linearGradient id="colorRunoff" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#ffb4ab" stopOpacity={0.8}/>
                                  <stop offset="95%" stopColor="#ffb4ab" stopOpacity={0}/>
                              </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.1)" />
                          <XAxis dataKey="time" tick={{fontSize: 10, fill: '#798098'}} tickLine={false} axisLine={{stroke: 'rgba(255,255,255,0.1)'}} minTickGap={20} />
                          <YAxis tick={{fontSize: 10, fill: '#798098'}} tickLine={false} axisLine={false} width={30} />
                          <Tooltip contentStyle={{ fontSize: '10px', backgroundColor: '#1f1f21', border: '1px solid rgba(255,255,255,0.1)', color: '#e5e1e4' }} />
                          <Area type="monotone" dataKey="precipitation" stroke="#bec6e0" strokeWidth={2} fill="url(#colorRain)" />
                          <Area type="monotone" dataKey="discharge" stroke="#ffb4ab" strokeWidth={2} fill="url(#colorRunoff)" />
                      </AreaChart>
                  </ResponsiveContainer>
             </div>
          </div>
        )}
      </div>
    </div>
  );
}
