import React, { useState, useEffect } from 'react';

export default function DataPipelineDashboard() {
  const [osmProgress, setOsmProgress] = useState(0);
  const [isFetchingOSM, setIsFetchingOSM] = useState(false);
  const [terminalLogs, setTerminalLogs] = useState<string[]>([
    "> initiating sequence...",
    "[INFO] Initializing Master Automation Pipeline...",
    "[DB] PostGIS connection established.",
    "[DB] Verifying spatial reference systems... OK.",
    "> awaiting manual trigger for external APIs..."
  ]);

  const handleFetchOSM = () => {
    setIsFetchingOSM(true);
    setOsmProgress(0);
    setTerminalLogs(prev => [...prev, "[OSM] Connecting to Overpass API..."]);

    let progress = 0;
    const interval = setInterval(() => {
        progress += 15;
        if (progress > 100) progress = 100;
        setOsmProgress(progress);
        
        if (progress === 30) setTerminalLogs(prev => [...prev, "[OSM] Downloading road network for Sector 7G..."]);
        if (progress === 75) setTerminalLogs(prev => [...prev, "[OSM] Extracting POI (shelter) boundaries..."]);

        if (progress === 100) {
            clearInterval(interval);
            setIsFetchingOSM(false);
            setTerminalLogs(prev => [...prev, "[OSM] Ingestion complete. 4,200 entities saved."]);
        }
    }, 500);
  };

  const handleSyncAPI = () => {
      setTerminalLogs(prev => [...prev, "[METEO] Syncing external telemetry data..."]);
      setTimeout(() => {
          setTerminalLogs(prev => [...prev, "[METEO] SUCCESS: Fetched 72hr high-res precipitation forecast."]);
      }, 1500);
  };

  return (
    <div className="flex-1 overflow-y-auto flex flex-col gap-6 relative w-full h-full p-4 pointer-events-auto">
        <div className="relative z-10 mb-2">
            <h1 className="font-headline-lg text-headline-lg text-on-surface">Data Pipeline Configuration</h1>
            <p className="text-on-surface-variant mt-2 max-w-2xl font-body-md">Configure and monitor automated data ingestion streams for simulation modeling.</p>
        </div>

        {/* Top Panels Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative z-10">
            {/* DB Infra */}
            <div className="bg-surface-glass backdrop-blur-24 rounded-xl flex flex-col shadow-xl border border-white/10">
                <div className="px-6 py-4 flex items-center gap-3 border-b border-white/10 bg-white/5">
                    <span className="material-symbols-outlined text-tertiary">database</span>
                    <h3 className="font-title-lg text-title-lg text-on-surface">Database Infrastructure</h3>
                </div>
                <div className="p-6 flex-1 flex flex-col justify-between gap-6">
                    <div className="space-y-4">
                        <div className="flex justify-between items-center p-3 rounded bg-surface-container-high/50 border border-white/10">
                            <span className="text-on-surface-variant text-sm font-body-md">Connection</span>
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-status-success animate-pulse"></div>
                                <span className="text-status-success font-data-mono text-data-mono">HEALTHY</span>
                            </div>
                        </div>
                        <div className="flex justify-between items-center p-3 rounded bg-surface-container-high/50 border border-white/10">
                            <span className="text-on-surface-variant text-sm font-body-md">PostGIS Extensions</span>
                            <span className="text-on-surface font-data-mono text-data-mono">READY</span>
                        </div>
                    </div>
                    <button className="w-full py-2.5 px-4 bg-tertiary/10 text-tertiary border border-tertiary/30 rounded hover:bg-tertiary/20 transition-colors font-label-caps text-label-caps active:scale-95">
                        Initialize PostGIS DB
                    </button>
                </div>
            </div>

            {/* OSM Ingestion */}
            <div className="bg-surface-glass backdrop-blur-24 rounded-xl flex flex-col shadow-xl border border-white/10">
                <div className="px-6 py-4 flex items-center gap-3 border-b border-white/10 bg-white/5">
                    <span className="material-symbols-outlined text-secondary">share</span>
                    <h3 className="font-title-lg text-title-lg text-on-surface">Geospatial Ingestion</h3>
                </div>
                <div className="p-6 flex-1 flex flex-col justify-between gap-6">
                    <div className="space-y-4">
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-on-surface-variant text-sm font-body-md">Target: OpenStreetMap</span>
                            <span className="text-on-surface text-xs font-body-md">{isFetchingOSM ? "Fetching..." : "Idle"}</span>
                        </div>
                        <div className="h-2 w-full bg-surface-container-high rounded-full overflow-hidden border border-white/5">
                            <div className="h-full bg-secondary transition-all duration-300" style={{ width: `${osmProgress}%` }}></div>
                        </div>
                        <p className="text-xs text-on-surface-variant font-data-mono text-data-mono">Awaiting command to fetch road networks and shelter POIs.</p>
                    </div>
                    <button 
                        disabled={isFetchingOSM}
                        onClick={handleFetchOSM}
                        className={`w-full py-2.5 px-4 rounded transition-colors font-label-caps text-label-caps active:scale-95 border ${isFetchingOSM ? 'bg-surface-container-high/50 text-on-surface-variant border-white/10 cursor-not-allowed' : 'bg-secondary/10 text-secondary border-secondary/30 hover:bg-secondary/20'}`}
                    >
                        {isFetchingOSM ? "FETCHING..." : "FETCH OSM NETWORKS & SHELTERS"}
                    </button>
                </div>
            </div>

            {/* Meteo Config */}
            <div className="bg-surface-glass backdrop-blur-24 rounded-xl flex flex-col shadow-xl border border-white/10">
                <div className="px-6 py-4 flex items-center gap-3 border-b border-white/10 bg-white/5">
                    <span className="material-symbols-outlined text-primary">cloud</span>
                    <h3 className="font-title-lg text-title-lg text-on-surface">Meteorological Config</h3>
                </div>
                <div className="p-6 flex-1 flex flex-col justify-between gap-6">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs text-on-surface-variant mb-1 font-label-caps text-label-caps">Latitude</label>
                            <input className="w-full rounded px-3 py-2 text-on-surface font-data-mono text-data-mono bg-transparent border border-white/20 focus:border-tertiary focus:outline-none transition-colors" type="text" defaultValue="34.0522"/>
                        </div>
                        <div>
                            <label className="block text-xs text-on-surface-variant mb-1 font-label-caps text-label-caps">Longitude</label>
                            <input className="w-full rounded px-3 py-2 text-on-surface font-data-mono text-data-mono bg-transparent border border-white/20 focus:border-tertiary focus:outline-none transition-colors" type="text" defaultValue="-118.2437"/>
                        </div>
                    </div>
                    <button onClick={handleSyncAPI} className="w-full py-2.5 px-4 bg-primary/10 text-primary border border-primary/30 rounded hover:bg-primary/20 transition-colors font-label-caps text-label-caps active:scale-95">
                        Sync API
                    </button>
                </div>
            </div>
        </div>

        {/* Terminal Log */}
        <div className="bg-surface-glass backdrop-blur-24 rounded-xl flex-1 flex flex-col relative z-10 min-h-[250px] shadow-xl border border-white/10 mb-6">
            <div className="px-6 py-3 flex items-center justify-between bg-black/40 rounded-t-xl border-b border-white/10">
                <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-on-surface-variant text-sm">terminal</span>
                    <h3 className="font-label-caps text-label-caps text-on-surface-variant">Pipeline Execution Log</h3>
                </div>
                <div className="flex gap-2">
                    <div className="w-3 h-3 rounded-full bg-status-emergency"></div>
                    <div className="w-3 h-3 rounded-full bg-status-warning"></div>
                    <div className="w-3 h-3 rounded-full bg-status-success"></div>
                </div>
            </div>
            <div className="flex-1 bg-[#0a0a0c]/80 p-6 font-data-mono text-data-mono text-sm overflow-y-auto custom-scrollbar rounded-b-xl border-t border-border-glass">
                <div className="space-y-2">
                    {terminalLogs.map((log, index) => {
                        let colorClass = "text-white";
                        if (log.startsWith(">")) colorClass = "text-[#8994b6]";
                        if (log.includes("[INFO]")) colorClass = "text-tertiary";
                        if (log.includes("[DB]")) colorClass = "text-secondary";
                        if (log.includes("[OSM]")) colorClass = "text-status-warning";
                        if (log.includes("[METEO]")) colorClass = "text-primary";
                        if (log.includes("SUCCESS")) colorClass = "text-status-success";
                        return <div key={index} className={colorClass}>{log}</div>;
                    })}
                    <div className="text-status-success mt-4 animate-pulse">_</div>
                </div>
            </div>
        </div>
    </div>
  );
}
