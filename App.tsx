import React, { useState, useEffect } from 'react';
import GameCanvas from './components/GameCanvas';
import { Difficulty } from './types';

const App: React.FC = () => {
  const [started, setStarted] = useState(false);
  const [controlMode, setControlMode] = useState<'keyboard' | 'mouse'>('keyboard');
  const [difficulty, setDifficulty] = useState<Difficulty>('veteran');
  const [customModel, setCustomModel] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  // Detect Mobile Device
  useEffect(() => {
    const checkMobile = () => {
      const userAgent = typeof window.navigator === "undefined" ? "" : navigator.userAgent;
      const mobile = Boolean(
        userAgent.match(
          /Android|BlackBerry|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i
        ) || window.innerWidth < 768
      );
      setIsMobile(mobile);
      if (mobile) {
          setControlMode('mouse'); // Force mouse/touch mode on mobile
      }
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
          const url = URL.createObjectURL(file);
          setCustomModel(url);
      }
  };

  const startGame = () => {
      // 1. Request Fullscreen (Robust cross-browser method)
      const docEl = document.documentElement as any;
      const requestFullScreen = 
          docEl.requestFullscreen || 
          docEl.webkitRequestFullscreen || 
          docEl.mozRequestFullScreen || 
          docEl.msRequestFullscreen;

      if (requestFullScreen) {
          requestFullScreen.call(docEl).catch((err: any) => {
              console.log("Fullscreen request failed (likely iOS or user blocked):", err);
          });
      }
      
      // 2. Start Game state
      setStarted(true);
  };

  return (
    <div className="w-full h-full relative font-sans text-white select-none">
      {!started ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/90 backdrop-blur-sm overflow-y-auto">
          <div className="text-center max-w-md w-full m-4 p-6 bg-gray-900 border border-yellow-600 rounded-lg shadow-2xl">
            <h1 className="text-4xl font-bold text-yellow-500 mb-2 uppercase tracking-widest">王牌飞行中队</h1>
            <div className="w-full h-1 bg-yellow-600 mb-6"></div>
            
            <p className="mb-4 text-gray-300">
              一战飞行模拟器 · 街机物理引擎
            </p>

            {/* Control Mode Selection - Hidden on Mobile */}
            {!isMobile && (
                <div className="mb-6">
                    <p className="text-sm text-yellow-500 font-bold mb-2 uppercase tracking-wider">控制模式</p>
                    <div className="flex justify-center gap-4">
                        <button 
                            onClick={() => setControlMode('keyboard')}
                            className={`px-4 py-2 rounded border transition-colors ${controlMode === 'keyboard' ? 'bg-yellow-600 text-black border-yellow-600' : 'bg-transparent text-gray-400 border-gray-600 hover:border-yellow-600'}`}
                        >
                            键盘控制
                        </button>
                        <button 
                            onClick={() => setControlMode('mouse')}
                            className={`px-4 py-2 rounded border transition-colors ${controlMode === 'mouse' ? 'bg-yellow-600 text-black border-yellow-600' : 'bg-transparent text-gray-400 border-gray-600 hover:border-yellow-600'}`}
                        >
                            鼠标控制
                        </button>
                    </div>
                </div>
            )}

            {isMobile && (
                 <div className="mb-6 p-2 bg-blue-900/30 border border-blue-500 rounded text-sm text-blue-200">
                     📱 检测到移动设备，已自动启用触屏控制模式。
                     <br/><span className="text-xs text-blue-300">(建议 Safari 用户添加到主屏幕以全屏游玩)</span>
                 </div>
            )}

            {/* Difficulty Selection */}
            <div className="mb-6">
                <p className="text-sm text-yellow-500 font-bold mb-2 uppercase tracking-wider">战役难度</p>
                <div className="flex justify-center gap-2">
                    <button 
                        onClick={() => setDifficulty('rookie')}
                        className={`flex-1 px-2 py-2 rounded border text-sm transition-colors ${difficulty === 'rookie' ? 'bg-green-700 text-white border-green-500' : 'bg-transparent text-gray-400 border-gray-600 hover:border-green-500'}`}
                    >
                        菜鸟 (50%)
                    </button>
                    <button 
                        onClick={() => setDifficulty('veteran')}
                        className={`flex-1 px-2 py-2 rounded border text-sm transition-colors ${difficulty === 'veteran' ? 'bg-blue-700 text-white border-blue-500' : 'bg-transparent text-gray-400 border-gray-600 hover:border-blue-500'}`}
                    >
                        老兵 (75%)
                    </button>
                    <button 
                        onClick={() => setDifficulty('ace')}
                        className={`flex-1 px-2 py-2 rounded border text-sm transition-colors ${difficulty === 'ace' ? 'bg-red-700 text-white border-red-500' : 'bg-transparent text-gray-400 border-gray-600 hover:border-red-500'}`}
                    >
                        王牌 (100%)
                    </button>
                </div>
                <p className="text-xs text-gray-400 mt-2 h-4">
                    {difficulty === 'rookie' && "敌军性能减半，适合新手熟悉操作。"}
                    {difficulty === 'veteran' && "标准的空中缠斗体验，敌军会主动追击。"}
                    {difficulty === 'ace' && "敌军与你势均力敌，会使用机动规避动作。"}
                </p>
            </div>

            {/* Custom Model Upload */}
            <div className="mb-6">
                <p className="text-sm text-yellow-500 font-bold mb-2 uppercase tracking-wider">自定义座驾 (可选)</p>
                <div className="relative border border-gray-600 rounded p-2 hover:border-yellow-600 transition-colors">
                    <input 
                        type="file" 
                        accept=".glb,.gltf" 
                        onChange={handleFileUpload}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <div className="text-sm text-gray-300 flex items-center justify-center gap-2">
                         <span className="text-yellow-500">📂</span>
                         {customModel ? "模型已加载 (点击更换)" : "上传 .GLB / .GLTF 模型"}
                    </div>
                </div>
            </div>

            <div className="bg-gray-800 p-4 rounded mb-6 text-left text-sm border border-gray-700">
              <p className="font-bold text-yellow-500 mb-2">操作说明 ({isMobile ? '触屏' : (controlMode === 'keyboard' ? '键盘' : '鼠标')}):</p>
              <ul className="space-y-1 list-disc list-inside text-gray-300">
                {!isMobile ? (
                    <>
                        <li><span className="text-white font-bold">ESC</span>: 暂停 / 菜单</li>
                        <li><span className="text-white font-bold">{controlMode === 'mouse' ? '左键' : '空格'}</span>: 开火射击</li>
                        <li><span className="text-white font-bold">Shift / Ctrl</span>: 加速 / 减速</li>
                        {controlMode === 'keyboard' ? (
                            <li><span className="text-white font-bold">W/S/A/D</span>: 俯仰与滚转</li>
                        ) : (
                            <li><span className="text-white font-bold">鼠标移动</span>: 控制飞行方向</li>
                        )}
                    </>
                ) : (
                    <>
                         <li><span className="text-white font-bold">左侧摇杆</span>: 俯仰与滚转 (下拉拉升)</li>
                         <li><span className="text-white font-bold">右侧滑块</span>: 油门控制</li>
                         <li><span className="text-white font-bold">FIRE 按钮</span>: 开火射击</li>
                    </>
                )}
              </ul>
            </div>

            <button
              onClick={startGame}
              className="px-8 py-3 bg-yellow-600 hover:bg-yellow-500 text-black font-bold rounded transition-colors uppercase tracking-wider text-lg shadow-[0_0_15px_rgba(234,179,8,0.5)] w-full"
            >
              启动引擎
            </button>
          </div>
        </div>
      ) : (
        <GameCanvas 
            controlMode={controlMode} 
            setControlMode={setControlMode} 
            difficulty={difficulty} 
            customModelUrl={customModel}
            isMobile={isMobile}
        />
      )}
    </div>
  );
};

export default App;