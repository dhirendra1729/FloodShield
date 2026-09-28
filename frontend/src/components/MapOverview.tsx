import React, { useState } from 'react';
import { Layers, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function MapOverview({ layers, setLayers }: any) {
  const [isPanelOpen, setIsPanelOpen] = useState(true);

  const toggleLayer = (layer: keyof typeof layers) => {
    setLayers((prev: any) => {
      return { ...prev, [layer]: !prev[layer] };
    });
  };

  const layerOptions = [
    { id: 'dem', label: 'DEM' },
    { id: 'lulc', label: 'World Cover' },
    { id: 'roads', label: 'Roads' },
    { id: 'buildings', label: 'Buildings' },
    { id: 'shelters', label: 'Shelters' },
    { id: 'floodDepth', label: 'Peak Flood' }
  ];

  return (
    <div className="bg-surface-glass backdrop-blur-24 border border-white/10 pointer-events-auto rounded-xl shadow-xl w-[320px] absolute top-4 left-4 flex flex-col">
      <div 
        className="flex items-center justify-between p-3 border-b border-white/10 bg-white/5 cursor-pointer hover:bg-white/10 transition-colors rounded-t-xl"
        onClick={() => setIsPanelOpen(!isPanelOpen)}
      >
        <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-primary" />
            <h2 className="font-title-lg text-sm text-on-surface">Active Map Layers</h2>
        </div>
        {isPanelOpen ? <ChevronUp className="w-5 h-5 text-on-surface-variant" /> : <ChevronDown className="w-5 h-5 text-on-surface-variant" />}
      </div>

      <AnimatePresence>
      {isPanelOpen && (
      <motion.div 
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: 'auto', opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        className="p-3 space-y-1 overflow-hidden bg-background/50 rounded-b-xl"
      >
        {layerOptions.map(item => (
          <button 
            key={item.id} 
            onClick={() => toggleLayer(item.id as keyof typeof layers)}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-data-mono transition-all mb-1.5 ${
                layers[item.id as keyof typeof layers] 
                ? 'bg-primary/20 text-primary border border-primary/30' 
                : 'bg-surface-container-high/50 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest border border-white/5'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${layers[item.id as keyof typeof layers] ? 'bg-primary border-primary' : 'bg-transparent border-on-surface-variant'}`}>
                 {layers[item.id as keyof typeof layers] && <div className="w-2 h-2 bg-background rounded-full"></div>}
              </div>
              <span>{item.label}</span>
            </div>
          </button>
        ))}
      </motion.div>
      )}
      </AnimatePresence>
    </div>
  );
}
