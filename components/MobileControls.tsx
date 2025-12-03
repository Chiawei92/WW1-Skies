
import React, { useRef, useState, useEffect } from 'react';
import { MobileInputState } from '../types';

interface MobileControlsProps {
    inputRef: React.MutableRefObject<MobileInputState>;
}

const MobileControls: React.FC<MobileControlsProps> = ({ inputRef }) => {
    // Joystick State
    const joystickRef = useRef<HTMLDivElement>(null);
    const [joystickPos, setJoystickPos] = useState({ x: 0, y: 0 });
    const [touchId, setTouchId] = useState<number | null>(null);
    const centerRef = useRef({ x: 0, y: 0 });

    // Throttle State
    const throttleRef = useRef<HTMLDivElement>(null);
    const [throttleVis, setThrottleVis] = useState(0); // 0-100% for visual

    const RADIUS = 60; // Max joystick radius

    const handleStickStart = (e: React.TouchEvent) => {
        if (touchId !== null) return;
        const touch = e.changedTouches[0];
        setTouchId(touch.identifier);
        
        if (joystickRef.current) {
            const rect = joystickRef.current.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            centerRef.current = { x: centerX, y: centerY };
            
            updateStick(touch.clientX, touch.clientY);
        }
    };

    const handleStickMove = (e: React.TouchEvent) => {
        if (touchId === null) return;
        const touch = Array.from(e.changedTouches).find((t: React.Touch) => t.identifier === touchId);
        if (touch) {
            updateStick(touch.clientX, touch.clientY);
        }
    };

    const updateStick = (clientX: number, clientY: number) => {
        const dx = clientX - centerRef.current.x;
        const dy = clientY - centerRef.current.y;
        
        const distance = Math.sqrt(dx * dx + dy * dy);
        const clampedDist = Math.min(distance, RADIUS);
        
        const angle = Math.atan2(dy, dx);
        const newX = Math.cos(angle) * clampedDist;
        const newY = Math.sin(angle) * clampedDist;
        
        setJoystickPos({ x: newX, y: newY });
        
        // Normalize -1 to 1
        // Invert Y because screen Y down is positive, but standard flight stick Up is negative (pitch down)
        // However, we want "Pull Down to Climb". So Screen Down (+Y) = Climb. 
        // Logic in Airplane: Pitch Input > 0 = Climb (S key). 
        // So we send +Y as +Pitch.
        inputRef.current.stickX = newX / RADIUS;
        inputRef.current.stickY = newY / RADIUS; 
    };

    const handleStickEnd = (e: React.TouchEvent) => {
        const touch = Array.from(e.changedTouches).find((t: React.Touch) => t.identifier === touchId);
        if (touch) {
            setTouchId(null);
            setJoystickPos({ x: 0, y: 0 });
            inputRef.current.stickX = 0;
            inputRef.current.stickY = 0;
        }
    };

    // Throttle Logic
    const handleThrottleMove = (e: React.TouchEvent) => {
        const touch = e.touches[0];
        if (throttleRef.current) {
            const rect = throttleRef.current.getBoundingClientRect();
            // Calculate 0 to 1 based on height. Bottom is 0, Top is 1.
            const val = 1 - (touch.clientY - rect.top) / rect.height;
            const clamped = Math.max(0, Math.min(1, val));
            setThrottleVis(clamped * 100);
            inputRef.current.throttle = clamped;
        }
    };

    return (
        <div className="absolute inset-0 pointer-events-none z-50 flex flex-col justify-end pb-8 px-8">
            <div className="flex justify-between items-end w-full">
                
                {/* Left Stick Area */}
                <div 
                    ref={joystickRef}
                    className="w-40 h-40 bg-white/10 rounded-full border-2 border-white/30 backdrop-blur-sm relative pointer-events-auto touch-none flex items-center justify-center"
                    onTouchStart={handleStickStart}
                    onTouchMove={handleStickMove}
                    onTouchEnd={handleStickEnd}
                >
                    {/* Stick Knob */}
                    <div 
                        className="w-16 h-16 bg-yellow-500/80 rounded-full shadow-lg absolute transition-transform duration-75 ease-out"
                        style={{ transform: `translate(${joystickPos.x}px, ${joystickPos.y}px)` }}
                    ></div>
                    {/* Decor */}
                    <div className="absolute text-white/50 text-xs font-bold top-2">俯冲</div>
                    <div className="absolute text-white/50 text-xs font-bold bottom-2">拉升</div>
                    <div className="absolute text-white/50 text-xs font-bold left-2">左滚</div>
                    <div className="absolute text-white/50 text-xs font-bold right-2">右滚</div>
                </div>

                {/* Right Controls Group */}
                <div className="flex gap-6 items-end pointer-events-auto">
                    
                    {/* Fire Button */}
                    <div 
                        className="w-24 h-24 bg-red-600/80 rounded-full border-4 border-red-800 shadow-lg active:scale-95 transition-transform flex items-center justify-center touch-none"
                        onTouchStart={() => inputRef.current.firing = true}
                        onTouchEnd={() => inputRef.current.firing = false}
                    >
                         <span className="text-white font-black text-xl">FIRE</span>
                    </div>

                    {/* Throttle Slider */}
                    <div 
                        ref={throttleRef}
                        className="w-16 h-48 bg-black/40 rounded-lg border border-white/30 relative overflow-hidden touch-none"
                        onTouchStart={handleThrottleMove}
                        onTouchMove={handleThrottleMove}
                    >
                        {/* Fill */}
                        <div 
                            className="absolute bottom-0 w-full bg-gradient-to-t from-green-600 to-yellow-500 transition-all duration-75"
                            style={{ height: `${throttleVis}%` }}
                        ></div>
                        {/* Handle */}
                        <div className="absolute w-full h-8 bg-white/50 border-y border-white top-0 mt-[-16px]" style={{ top: `${100 - throttleVis}%` }}></div>
                        
                        <div className="absolute inset-0 flex flex-col justify-between items-center py-2 text-[10px] text-white/70 font-mono pointer-events-none">
                            <span>MAX</span>
                            <span>THR</span>
                            <span>IDLE</span>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default MobileControls;
