import React, { useState, useEffect } from 'react';
import { CloudRain, Wind, Droplets, ThermometerSun, AlertCircle, Newspaper, Radio, Loader2, Navigation, Bookmark, Target, Smartphone, Share2 } from 'lucide-react';

export default function NewsDashboard() {
  const [weatherData, setWeatherData] = useState({
    temp: '--°C',
    condition: 'Loading...',
    humidity: '--%',
    wind: '-- km/h'
  });

  const [newsItems, setNewsItems] = useState<any[]>([]);
  const [isLoadingNews, setIsLoadingNews] = useState(true);

  useEffect(() => {
    // Fetch Weather
    fetch('/api/weather')
      .then(res => res.json())
      .then(data => {
        if (data.status === 'success') {
          setWeatherData(data.data);
        }
      })
      .catch(err => console.error(err));

    // Fetch News
    fetch('/api/news')
      .then(res => res.json())
      .then(data => {
        if (data.status === 'success') {
          setNewsItems(data.data);
        }
        setIsLoadingNews(false);
      })
      .catch(err => {
        console.error(err);
        setIsLoadingNews(false);
      });
  }, []);



  return (
    <div className="w-full h-full flex flex-col bg-white min-h-0 flex-1">
      
      {/* Header Image */}
      <div className="w-full h-24 shrink-0">
        <img src="/bhuragaon_landscape.png" alt="Bhuragaon" className="w-full h-full object-cover" />
      </div>

      {/* Title & Weather */}
      <div className="p-3 border-b border-gray-200 shrink-0 flex justify-between items-start">
        <div>
          <h2 className="text-[20px] font-bold text-gray-900 leading-tight">Bhuragaon</h2>
          <div className="text-gray-600 text-xs mt-0.5">ভুরাগাঁও</div>
          <div className="text-gray-500 text-xs mt-0.5">Assam</div>
        </div>
        <div className="flex flex-col items-end pt-1">
          <CloudRain className="w-6 h-6 text-gray-400 mb-1" strokeWidth={1} />
          <div className="text-gray-600 text-[12px] mt-1">{weatherData.condition} · {weatherData.temp}</div>
          <div className="text-gray-500 text-[11px]">3:14 AM</div>
        </div>
      </div>

      {/* News Feed */}
      <div className="p-5 flex flex-col gap-3 flex-1 overflow-y-auto custom-scrollbar min-h-0">
        <div className="flex items-center gap-2 text-slate-800 mb-2 pb-2 border-b border-gray-200 shrink-0">
          <Radio className="w-4 h-4 text-red-600" />
          <h3 className="font-bold text-xs uppercase tracking-wider">Live Updates</h3>
        </div>
        
        <div className="flex flex-col gap-2">
          {isLoadingNews ? (
            <div className="flex justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            </div>
          ) : newsItems.length > 0 ? (
            newsItems.map(item => (
              <div key={item.id} className="group bg-white p-3 border border-gray-200 hover:border-slate-800 transition-colors cursor-pointer flex gap-3 items-start">
                <div className={`mt-0.5 shrink-0 ${
                  item.type === 'alert' ? 'text-red-600' :
                  item.type === 'warning' ? 'text-orange-600' :
                  'text-blue-600'
                }`}>
                  {item.type === 'news' ? <Newspaper className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                </div>
                <div className="flex flex-col gap-1 w-full">
                  <h4 className="text-xs font-bold text-slate-800 leading-tight group-hover:underline">{item.title}</h4>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide truncate max-w-[150px]">{item.source}</span>
                    <span className="text-[10px] font-mono text-slate-500 whitespace-nowrap">{item.time}</span>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-xs text-slate-500 text-center py-4">No live updates available.</div>
          )}
        </div>
      </div>
    </div>
  );
}
