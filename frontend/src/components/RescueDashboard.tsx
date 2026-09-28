import React, { useState, useEffect } from 'react';
import { LifeBuoy, AlertTriangle, Users, MapPin, Loader2, ArrowRight } from 'lucide-react';

export default function RescueDashboard({ onSelectGroup, onStrandedLoaded }: { onSelectGroup: (group: any) => void, onStrandedLoaded: (groups: any[]) => void }) {
  const [strandedGroups, setStrandedGroups] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchStranded();
  }, []);

  const fetchStranded = async () => {
    try {
      const res = await fetch('/api/rescue/stranded');
      const data = await res.json();
      if (data.status === 'success') {
        setStrandedGroups(data.data);
        onStrandedLoaded(data.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const getTierClass = (tier: string) => {
    if (tier === 'CRITICAL') return 'bg-status-emergency/10 border-status-emergency text-status-emergency border-l-4';
    if (tier === 'HIGH') return 'bg-status-warning/10 border-status-warning text-status-warning border-l-4';
    return 'bg-primary/10 border-primary text-primary border-l-4';
  };

  const getBadgeClass = (tier: string) => {
    if (tier === 'CRITICAL') return 'bg-status-emergency text-on-error';
    if (tier === 'HIGH') return 'bg-status-warning/20 text-status-warning border border-status-warning/30';
    return 'bg-primary/20 text-primary border border-primary/30';
  };

  return (
    <section className="bg-surface-glass backdrop-blur-24 rounded-xl flex flex-col shadow-xl h-[600px] w-full max-w-sm border border-white/10 pointer-events-auto">
      <header className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5 rounded-t-xl">
        <h2 className="font-title-lg text-title-lg text-primary flex items-center gap-2">
          <span className="material-symbols-outlined text-[20px]">emergency</span>
          Incident Queue
        </h2>
        <span className="font-data-mono text-data-mono text-on-surface-variant bg-surface-container px-2 py-0.5 rounded border border-white/5">
          {strandedGroups.length} Active
        </span>
      </header>
      
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3 custom-scrollbar">
        {isLoading ? (
            <div className="py-10 flex justify-center text-status-emergency">
                <Loader2 className="w-6 h-6 animate-spin" />
            </div>
        ) : (
            strandedGroups.map((group, index) => (
                <div 
                    key={group.id} 
                    onClick={() => onSelectGroup(group)}
                    className={`p-4 rounded-lg cursor-pointer hover:bg-white/5 transition-colors relative overflow-hidden border border-white/5 ${getTierClass(group.tier)}`}
                >
                    {group.tier === 'CRITICAL' && (
                        <div className="absolute inset-0 bg-status-emergency/5 animate-[pulse-op_2s_infinite] pointer-events-none"></div>
                    )}
                    <div className="flex justify-between items-start mb-2 relative z-10">
                        <span className="font-data-mono text-data-mono text-on-surface">LOC-{group.id}</span>
                        <span className={`font-label-caps text-[10px] px-1.5 py-0.5 rounded-sm ${getBadgeClass(group.tier)}`}>
                            {group.tier}
                        </span>
                    </div>
                    <h3 className="font-body-md text-body-md font-semibold text-on-surface mb-2">Elev: {group.elevation}m</h3>
                    <div className="flex items-center gap-4 text-on-surface-variant font-data-mono text-[11px]">
                        <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">map</span> View Target</span>
                        <span className="flex items-center gap-1 text-primary"><span className="material-symbols-outlined text-[14px]">arrow_right</span></span>
                    </div>
                </div>
            ))
        )}
      </div>
    </section>
  );
}
