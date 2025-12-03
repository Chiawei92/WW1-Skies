
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
        
        let touch: React.Touch | undefined;
        // Manual iteration for TypeScript safety with TouchList
        for (let i = 0; i < e.changedTouches.length; i++) {
            if (e.changedTouches[i].identifier === touchId) {
                touch = e.changedTouches[i];
                break;
            }
        }

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
        inputRef.current.stickX = newX / RADIUS;
        inputRef.current.stickY = newY / RADIUS; 
    };

    const handleStickEnd = (e: React.TouchEvent) => {
        let touch: React.Touch | undefined;
        for (let i = 0; i < e.changedTouches.length; i++) {
            if (e.changedTouches[i].identifier === touchId) {
                touch = e.changedTouches[i];
                break;
            }
        }

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
                    className="w-40 h-40 bg-white/5 rounded-full border border-white/20 backdrop-blur-sm relative pointer-events-auto touch-none flex items-center justify-center"
                    onTouchStart={handleStickStart}
                    onTouchMove={handleStickMove}
                    onTouchEnd={handleStickEnd}
                >
                    {/* Stick Knob - Glass Style */}
                    <div 
                        className="w-16 h-16 bg-white/20 rounded-full shadow-lg border border-white/30 backdrop-blur-md absolute transition-transform duration-75 ease-out"
                        style={{ transform: `translate(${joystickPos.x}px, ${joystickPos.y}px)` }}
                    ></div>
                    {/* Decor Labels */}
                    <div className="absolute text-white/30 text-[10px] font-mono font-bold top-4">DIVE</div>
                    <div className="absolute text-white/30 text-[10px] font-mono font-bold bottom-4">CLIMB</div>
                    <div className="absolute text-white/30 text-[10px] font-mono font-bold left-4">L</div>
                    <div className="absolute text-white/30 text-[10px] font-mono font-bold right-4">R</div>
                </div>

                {/* Right Controls Group */}
                <div className="flex gap-6 items-end pointer-events-auto">
                    
                    {/* Fire Button - Clean Glass Style */}
                    <div 
                        className="w-24 h-24 bg-white/10 rounded-full border border-white/20 backdrop-blur-md shadow-lg active:bg-white/30 active:scale-95 transition-all flex items-center justify-center touch-none"
                        onTouchStart={() => inputRef.current.firing = true}
                        onTouchEnd={() => inputRef.current.firing = false}
                    >
                         <div className="w-20 h-20 rounded-full border border-white/20 flex items-center justify-center">
                            <span className="text-white/80 font-black text-sm tracking-widest">FIRE</span>
                         </div>
                    </div>

                    {/* Throttle Slider - Glass Style */}
                    <div 
                        ref={throttleRef}
                        className="w-16 h-48 bg-white/5 rounded-lg border border-white/20 backdrop-blur-sm relative overflow-hidden touch-none"
                        onTouchStart={handleThrottleMove}
                        onTouchMove={handleThrottleMove}
                    >
                        {/* Fill */}
                        <div 
                            className="absolute bottom-0 w-full bg-white/20 transition-all duration-75"
                            style={{ height: `${throttleVis}%` }}
                        ></div>
                        {/* Handle */}
                        <div className="absolute w-full h-8 bg-white/40 border-y border-white/50 top-0 mt-[-16px] backdrop-blur-md shadow-sm" style={{ top: `${100 - throttleVis}%` }}></div>
                        
                        <div className="absolute inset-0 flex flex-col justify-between items-center py-3 text-[10px] text-white/50 font-mono pointer-events-none">
                            <span>100</span>
                            <span>THR</span>
                            <span>0</span>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default MobileControls;
