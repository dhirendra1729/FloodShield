"use client";
import React, { useState } from 'react';
import { LayoutDashboard, CloudRain, Shield, Smartphone, Users, LifeBuoy } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';

import MapOverview from '@/components/MapOverview';
import SafeSpotDashboard from '@/components/SafeSpotDashboard';
import SmsDashboard from '@/components/SmsDashboard';
import RainfallDashboard from '@/components/RainfallDashboard';
import RecipientsDashboard from '@/components/RecipientsDashboard';
import RescueDashboard from '@/components/RescueDashboard';
import NewsDashboard from '@/components/NewsDashboard';
import DataPipelineDashboard from '@/components/DataPipelineDashboard';
import DamBreakStudio from '@/components/DamBreakStudio';

// Dynamically import LeafletMap for the global background
const LeafletMap = dynamic(() => import('@/components/LeafletMap'), { 
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full flex-col items-center justify-center bg-background">
        <p className="text-primary font-bold animate-pulse">Initializing Map Engine...</p>
      </div>
    )
});

export default function Home() {
  const [activeTab, setActiveTab] = useState('dam-break');
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(true);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);
  
  // GLOBAL MAP STATE
  const [layers, setLayers] = useState({
    dem: false,
    lulc: false,
    buildings: false,
    roads: true,
    shelters: false,
    floodDepth: false,
    aiSafeSpots: true
  });
  
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [aiSafeSpots, setAiSafeSpots] = useState<any[]>([]);
  const [routeGeoJSON, setRouteGeoJSON] = useState<any>(null);
  const [destinationName, setDestinationName] = useState<string | null>(null);
  const [smsContext, setSmsContext] = useState<any>(null);
  const [activeRescueGroup, setActiveRescueGroup] = useState<any>(null);
  const [strandedGroups, setStrandedGroups] = useState<any[]>([]);

  const handleNavigateToSms = (context: any) => {
    setSmsContext(context);
    setActiveTab('sms');
  };

  const navItems = [
    { id: 'dam-break', label: 'Dam Breach Studio', icon: 'waves' },
    { id: 'overview', label: 'Dashboard', icon: 'dashboard' },
    { id: 'meteorology', label: 'Simulations', icon: 'model_training' },
    { id: 'safe-spot', label: 'Live Map', icon: 'map' },
    { id: 'rescue', label: 'Dispatch', icon: 'emergency_share' },
    { id: 'pipeline', label: 'Data Pipeline', icon: 'database' },
  ];

  return (
    <div className="bg-background text-on-background font-body-md h-screen w-screen overflow-hidden flex flex-col antialiased">
        {/* Global Map Canvas */}
      <div className="absolute inset-0 z-0">
        <LeafletMap 
            layers={layers} 
            aiSafeSpots={activeTab === "safe-spot" ? aiSafeSpots : undefined} 
            userLocation={userLocation}
            setUserLocation={activeTab === "safe-spot" ? setUserLocation : undefined}
            routeGeoJSON={activeTab === "safe-spot" ? routeGeoJSON : undefined}
            strandedGroups={activeTab === "rescue" ? strandedGroups : undefined}
            activeRescueGroup={activeTab === "rescue" ? activeRescueGroup : undefined}
            showRescueLayer={activeTab === "rescue"}
        />
      </div>

      {/* Top Navigation Bar */}
      <header className="bg-surface-glass fixed top-0 w-full z-50 backdrop-blur-24 border-b border-white/10 shadow-2xl flex justify-between items-center h-12 px-6">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsLeftPanelOpen(!isLeftPanelOpen)}
            className="text-on-surface-variant hover:text-primary hover:bg-white/5 p-1.5 rounded-full transition-colors active:scale-95 flex items-center justify-center cursor-pointer"
          >
            <span className="material-symbols-outlined text-[24px]">menu</span>
          </button>
          <span className="font-display-lg text-[24px] font-black text-primary tracking-tighter">FloodShield</span>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsRightPanelOpen(!isRightPanelOpen)}
            className={`hover:bg-white/5 p-1.5 rounded-full transition-colors active:scale-95 flex items-center justify-center cursor-pointer ${isRightPanelOpen ? 'text-primary' : 'text-on-surface-variant'}`}
            title="Toggle Operational Log"
          >
            <span className="material-symbols-outlined text-[24px]">feed</span>
          </button>
        </div>
      </header>

      {/* Main Workspace Area */}
      <main className="relative z-20 flex-1 flex mt-12 p-4 gap-4 h-[calc(100vh-48px)] pointer-events-none">
        
        {/* Left Panel: Side Navigation */}
        <AnimatePresence>
          {isLeftPanelOpen && (
            <motion.nav 
              initial={{ x: -300, opacity: 0, width: 0 }}
              animate={{ x: 0, opacity: 1, width: 224 }}
              exit={{ x: -300, opacity: 0, width: 0 }}
              transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
              className="bg-surface-glass backdrop-blur-24 border border-white/10 shadow-xl flex flex-col py-4 rounded-lg h-full pointer-events-auto shrink-0"
            >
          <div className="px-4 mb-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-8 w-8 rounded bg-surface-container-highest border border-white/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-primary text-[18px]">radar</span>
              </div>
              <div>
                <h2 className="font-title-lg text-title-lg text-primary leading-tight">Mission Control</h2>
                <p className="font-label-caps text-[10px] text-status-warning mt-1">Active Protocol: Alpha</p>
              </div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-2">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full rounded-lg mx-1 flex items-center gap-3 px-3 py-2.5 mb-1.5 transition-all hover:translate-x-1 ${isActive ? 'bg-secondary-container text-on-secondary-container' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'}`}
                >
                  <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                  <span className="font-body-md text-sm font-semibold">{item.label}</span>
                </button>
              );
            })}
          </div>
        </motion.nav>
        )}
        </AnimatePresence>

        {/* Center Space (Transparent, for map interaction) */}
        <div className="flex-1 relative flex flex-col justify-end pointer-events-none">
           {/* Render floating panels here based on tab, but pointer-events-auto so they can be clicked */}
           <div className="pointer-events-none flex items-center justify-center h-full w-full">
              {/* Dynamic Content Panel */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="w-full max-w-[1600px] h-full max-h-full overflow-hidden flex flex-col pointer-events-none"
                >
                    {activeTab === 'dam-break' && <DamBreakStudio />}
                    {activeTab === 'overview' && <MapOverview layers={layers} setLayers={setLayers} />}
                    {/* Meteorology -> Simulations Dashboard */}
                    {activeTab === 'meteorology' && <RainfallDashboard setLayers={setLayers} setAiSafeSpots={setAiSafeSpots} />}
                    {/* Safe-spot -> Live Map controls */}
                    {activeTab === 'safe-spot' && (
                      <SafeSpotDashboard 
                        setLayers={setLayers}
                        userLocation={userLocation}
                        setUserLocation={setUserLocation}
                        routeGeoJSON={routeGeoJSON}
                        setAiSafeSpots={setAiSafeSpots}
                        setRouteGeoJSON={setRouteGeoJSON}
                        destinationName={destinationName}
                        setDestinationName={setDestinationName}
                        onNavigateToSms={handleNavigateToSms} 
                      />
                    )}
                    {/* Rescue -> Dispatch Panel (3 columns) */}
                    {activeTab === 'rescue' && (
                      <div className="flex flex-row w-full h-full gap-6 justify-between">
                        <RescueDashboard 
                          onSelectGroup={(group) => {
                            setActiveRescueGroup(group);
                            setSmsContext({ 
                                phone_number: "+1 (555) 019-" + group.id, 
                                message: "", 
                                destinationName: "Unknown", 
                                destinationCoords: [group.latitude, group.longitude] 
                            });
                          }} 
                          onStrandedLoaded={(groups) => setStrandedGroups(groups)}
                        />
                        <div className="flex-1 flex flex-col justify-end pb-6 pointer-events-none">
                            {activeRescueGroup && (
                               <div className="bg-surface-glass backdrop-blur-24 rounded-xl p-6 shadow-xl flex-shrink-0 pointer-events-auto border border-white/10">
                                  <div className="flex justify-between items-start mb-4">
                                      <div>
                                          <div className="flex items-center gap-2 mb-1">
                                              <span className="font-headline-md text-headline-md text-on-surface">LOC-{activeRescueGroup.id}</span>
                                              <span className={`font-label-caps text-label-caps px-2 py-0.5 rounded ${activeRescueGroup.tier === 'CRITICAL' ? 'bg-status-emergency/20 text-status-emergency border border-status-emergency/50' : 'bg-status-warning/20 text-status-warning border border-status-warning/50'}`}>{activeRescueGroup.tier} PRIORITY</span>
                                          </div>
                                          <p className="font-data-mono text-data-mono text-on-surface-variant">Loc: {activeRescueGroup.latitude.toFixed(4)}° N, {activeRescueGroup.longitude.toFixed(4)}° W | Elev: {activeRescueGroup.elevation}m</p>
                                      </div>
                                      <button className="bg-primary-container text-primary border border-primary/30 px-4 py-2 rounded hover:bg-primary/10 transition-colors font-label-caps text-label-caps flex items-center gap-2 cursor-pointer">
                                          <span className="material-symbols-outlined text-sm">flight_takeoff</span> DISPATCH AIR
                                      </button>
                                  </div>
                                  <div className="bg-surface-container-lowest border border-white/10 rounded p-4">
                                      <div className="flex items-center gap-2 mb-2 text-secondary">
                                          <span className="material-symbols-outlined text-sm">smart_toy</span>
                                          <span className="font-label-caps text-label-caps">AI SITREP GENERATED</span>
                                      </div>
                                      <p className="font-body-md text-body-md text-on-surface/90 leading-relaxed">
                                          Location identified as high risk. Elevation data indicates {activeRescueGroup.elevation}m above sea level, with surrounding water levels rising. Immediate evacuation recommended. Nearest capable unit is H-4 (ETA 8m).
                                      </p>
                                  </div>
                               </div>
                            )}
                        </div>
                        <SmsDashboard context={smsContext} />
                      </div>
                    )}
                    {/* SMS Panel (Standalone) */}
                    {activeTab === 'sms' && (
                      <div className="flex justify-center items-center h-full">
                         <SmsDashboard context={smsContext} />
                      </div>
                    )}
                    {/* Data Pipeline Panel */}
                    {activeTab === 'pipeline' && (
                      <DataPipelineDashboard />
                    )}
                </motion.div>
              </AnimatePresence>
           </div>
        </div>

        {/* Right Panel: Operational Updates */}
        <AnimatePresence>
        {isRightPanelOpen && (
          <motion.aside 
            initial={{ x: 400, opacity: 0, width: 0 }}
            animate={{ x: 0, opacity: 1, width: 320 }}
            exit={{ x: 400, opacity: 0, width: 0 }}
            transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
            className="flex flex-col gap-4 pointer-events-auto h-full overflow-hidden shrink-0"
          >
          {/* Use the NewsDashboard component styled with Stitch wrappers */}
          <div className="bg-surface-glass backdrop-blur-24 border border-white/10 rounded-lg p-4 shadow-xl flex-1 flex flex-col overflow-hidden">
             <div className="flex justify-between items-center mb-3 border-b border-white/10 pb-2 shrink-0">
               <h3 className="font-title-lg text-lg text-on-surface">Information</h3>
               <span className="material-symbols-outlined text-on-surface-variant text-[20px]">format_list_bulleted</span>
             </div>
             <div className="flex-1 overflow-y-auto">
               <NewsDashboard />
             </div>
          </div>
        </motion.aside>
        )}
        </AnimatePresence>

      </main>
    </div>
  );
}
