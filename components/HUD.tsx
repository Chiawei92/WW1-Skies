
import React from 'react';

interface HUDProps {
  telemetry: {
    speed: number;
    altitude: number;
    heading: number;
  };
  score: number;
  hp: number;
  isMobile: boolean;
}

const HUD: React.FC<HUDProps> = ({ telemetry, score, hp, isMobile }) => {
  return (
    <div className="absolute inset-0 pointer-events-none p-4 md:p-8 flex flex-col justify-between z-40">
        {/* Top Bar - On Mobile this contains EVERYTHING */}
        <div className={`flex ${isMobile ? 'justify-between items-start w-full' : 'justify-between items-start'}`}>
             
             {/* Left Group (Radar / HP / Speed on Mobile) */}
             <div className="flex flex-col gap-2">
                 {/* Radar Info */}
                 <div className="bg-black/30 backdrop-blur-md p-2 md:p-4 rounded-lg border border-white/20 text-white font-mono text-xs md:text-sm">
                     <div className="flex items-center gap-2">
                         <div className="w-2 h-2 md:w-3 md:h-3 bg-red-500 rounded-full animate-pulse"></div>
                         <span>敌机追踪</span>
                     </div>
                 </div>

                 {/* Mobile Specific: Show HP & Speed here */}
                 {isMobile && (
                     <>
                        <div className="bg-black/40 p-2 rounded-lg border border-white/20 backdrop-blur-sm">
                            <span className="text-[10px] text-gray-300 block mb-1">装甲</span>
                            <div className="w-24 h-2 bg-gray-700 rounded overflow-hidden">
                                <div className={`h-full ${hp < 4 ? 'bg-red-500' : 'bg-green-500'}`} style={{ width: `${hp * 10}%` }}></div>
                            </div>
                        </div>
                        <div className="bg-black/40 p-2 rounded-lg border border-white/20 backdrop-blur-sm flex items-center gap-2">
                            <span className="text-xl font-bold font-mono text-white">{telemetry.speed}</span>
                            <span className="text-[10px] text-gray-300">KM/H</span>
                        </div>
                     </>
                 )}
             </div>

             {/* Right Group (Score / Altitude on Mobile) */}
             <div className="text-right flex flex-col items-end gap-2">
                 <div>
                     <h2 className="text-lg md:text-2xl font-bold text-yellow-400 drop-shadow-md font-mono">任务 01</h2>
                     <p className="text-xs md:text-sm text-white drop-shadow-md">分数: <span className="text-yellow-300 font-bold">{score}</span></p>
                 </div>

                 {/* Mobile Specific: Show Altitude here */}
                 {isMobile && (
                     <div className="bg-black/40 p-2 rounded-lg border border-white/20 backdrop-blur-sm">
                        <span className="text-xl font-bold font-mono text-white block">{telemetry.altitude} <span className="text-[10px]">M</span></span>
                        <div className="text-[10px] text-gray-400">航向 {telemetry.heading}°</div>
                     </div>
                 )}
             </div>
        </div>

        {/* Bottom Instruments - Hidden on Mobile to clear space for controls */}
        {!isMobile && (
            <div className="flex justify-between items-end">
                
                {/* Armor / HP Gauge (Left) */}
                <div className="bg-black/40 p-4 rounded-lg w-32 flex flex-col items-center justify-center border-2 border-white/30 backdrop-blur-sm mr-4">
                    <span className="text-xs uppercase text-gray-300 tracking-wider mb-2">装甲强度</span>
                    <div className="w-full flex gap-1 mb-1">
                        {Array.from({length: 10}).map((_, i) => (
                            <div 
                                key={i} 
                                className={`h-4 flex-1 rounded-sm ${i < hp ? (hp < 4 ? 'bg-red-500' : 'bg-green-500') : 'bg-gray-700'}`}
                            ></div>
                        ))}
                    </div>
                    <span className="text-lg font-bold font-mono text-white">{hp * 10}%</span>
                </div>

                {/* Speed Gauge (Center Left) */}
                <div className="bg-black/40 p-4 rounded-full w-32 h-32 flex flex-col items-center justify-center border-2 border-white/30 backdrop-blur-sm relative overflow-hidden">
                    <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle,rgba(255,255,255,0.2)_0%,transparent_70%)]"></div>
                    <span className="text-3xl font-bold font-mono text-white">{telemetry.speed}</span>
                    <span className="text-xs uppercase text-gray-300 tracking-wider">公里/时</span>
                    {/* Bar fills up at 80 km/h (Max visual speed) */}
                    <div className="absolute bottom-0 h-1 bg-gradient-to-r from-green-500 to-red-500 w-full" style={{width: `${Math.min((telemetry.speed / 80) * 100, 100)}%`}}></div>
                </div>

                {/* Artificial Horizon Text (Center) */}
                <div className="mb-4 text-center">
                    <div className="bg-black/50 px-4 py-1 rounded-full text-white font-mono text-xs mb-1">
                        油门: {(Math.min(telemetry.speed / 80, 1) * 100).toFixed(0)}%
                    </div>
                </div>

                {/* Altitude Gauge (Center Right) */}
                <div className="bg-black/40 p-4 rounded-full w-32 h-32 flex flex-col items-center justify-center border-2 border-white/30 backdrop-blur-sm">
                    <span className="text-3xl font-bold font-mono text-white">{telemetry.altitude}</span>
                    <span className="text-xs uppercase text-gray-300 tracking-wider">米 (M)</span>
                    <div className="text-[10px] text-gray-400 mt-1">航向 {telemetry.heading}°</div>
                </div>
            </div>
        )}
    </div>
  );
};

export default HUD;
