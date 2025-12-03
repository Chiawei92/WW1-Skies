
import React, { Suspense, useState, useEffect, useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Sky, Stars, Html } from '@react-three/drei';
import Airplane from './Airplane';
import EnemyPlane from './EnemyPlane';
import AllyPlane from './AllyPlane';
import Terrain from './Terrain';
import HUD from './HUD';
import MobileControls from './MobileControls';
import * as THREE from 'three';
import { Enemy, Difficulty, MobileInputState } from '../types';

export interface MapObject {
  position: [number, number, number];
  scale: [number, number, number];
  color: string;
  type: 'ground' | 'mountain';
}

interface GameCanvasProps {
    controlMode: 'keyboard' | 'mouse';
    setControlMode: (mode: 'keyboard' | 'mouse') => void;
    difficulty: Difficulty;
    customModelUrl: string | null;
    isMobile: boolean;
}

const GameCanvas: React.FC<GameCanvasProps> = ({ controlMode, setControlMode, difficulty, customModelUrl, isMobile }) => {
  const [telemetry, setTelemetry] = useState({ speed: 0, altitude: 0, heading: 0 });
  const [playerHp, setPlayerHp] = useState(10);
  const [paused, setPaused] = useState(false);
  const [score, setScore] = useState(0);
  const [gameKey, setGameKey] = useState(0); // To force reset
  
  // Mobile Input Ref (Shared between UI and Game Loop)
  const mobileInputRef = useRef<MobileInputState>({
      stickX: 0,
      stickY: 0,
      throttle: 0,
      firing: false
  });
  
  // Custom Model Rotation State (X, Y, Z in degrees)
  const [modelRotation, setModelRotation] = useState<[number, number, number]>([0, 0, 0]);

  // Global Pause Handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        setPaused(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleRestart = () => {
      setScore(0);
      setPlayerHp(10);
      setGameKey(prev => prev + 1);
      setPaused(false);
      // Reset input
      mobileInputRef.current = { stickX: 0, stickY: 0, throttle: 0, firing: false };
  }

  const rotateModel = (axis: 0 | 1 | 2) => {
      setModelRotation(prev => {
          const next = [...prev] as [number, number, number];
          next[axis] = (next[axis] + 90) % 360;
          return next;
      });
  };

  return (
    <>
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [0, 5, 20], fov: 60, near: 0.1, far: 5000 }}
      >
        <Suspense fallback={null}>
          <GameScene 
            key={gameKey}
            onTelemetryUpdate={setTelemetry} 
            paused={paused} 
            score={score}
            setScore={setScore}
            playerHp={playerHp}
            setPlayerHp={setPlayerHp}
            onRestart={handleRestart}
            controlMode={controlMode}
            difficulty={difficulty}
            customModelUrl={customModelUrl}
            modelRotation={modelRotation}
            isMobile={isMobile}
            mobileInputRef={mobileInputRef}
          />
        </Suspense>
        {paused && (
          <Html fullscreen style={{ pointerEvents: 'none', zIndex: 100 }}>
            <div className="fixed inset-0 w-full h-full flex items-center justify-center bg-slate-900/90 pointer-events-auto backdrop-blur-sm">
                <div className="text-center max-w-md p-6 bg-gray-900 border border-yellow-600 rounded-lg shadow-2xl select-none">
                    <h1 className="text-4xl font-bold text-yellow-500 mb-2 uppercase tracking-widest">王牌飞行中队</h1>
                    <div className="w-full h-1 bg-yellow-600 mb-6"></div>
                    
                    <h2 className="text-2xl font-bold text-white mb-4 uppercase tracking-widest">任务暂停</h2>

                    {!isMobile && (
                        <div className="flex justify-center gap-4 mb-6">
                            <button 
                                onClick={() => setControlMode('keyboard')}
                                className={`px-4 py-2 rounded border ${controlMode === 'keyboard' ? 'bg-yellow-600 text-black border-yellow-600' : 'bg-transparent text-gray-400 border-gray-600 hover:border-yellow-600'}`}
                            >
                                键盘
                            </button>
                            <button 
                                onClick={() => setControlMode('mouse')}
                                className={`px-4 py-2 rounded border ${controlMode === 'mouse' ? 'bg-yellow-600 text-black border-yellow-600' : 'bg-transparent text-gray-400 border-gray-600 hover:border-yellow-600'}`}
                            >
                                鼠标
                            </button>
                        </div>
                    )}

                    {customModelUrl && (
                        <div className="mb-6 bg-gray-800 p-3 rounded border border-gray-600">
                             <p className="text-sm text-yellow-500 font-bold mb-2 uppercase tracking-wider">自定义模型校准</p>
                             <div className="flex justify-center gap-2 mb-2">
                                 <button onClick={() => rotateModel(0)} className="px-2 py-1 bg-gray-700 rounded text-xs hover:bg-gray-600 border border-gray-500">X轴 +90°</button>
                                 <button onClick={() => rotateModel(1)} className="px-2 py-1 bg-gray-700 rounded text-xs hover:bg-gray-600 border border-gray-500">Y轴 +90°</button>
                                 <button onClick={() => rotateModel(2)} className="px-2 py-1 bg-gray-700 rounded text-xs hover:bg-gray-600 border border-gray-500">Z轴 +90°</button>
                             </div>
                             <div className="text-[10px] text-gray-400">如果模型朝向不对（比如侧着飞），请点击上方按钮进行旋转修正。</div>
                        </div>
                    )}

                    <div className="bg-gray-800 p-4 rounded mb-6 text-left text-sm border border-gray-700">
                    <p className="font-bold text-yellow-500 mb-2">飞行操作 ({isMobile ? '触屏' : (controlMode === 'keyboard' ? '键盘' : '鼠标')}):</p>
                    <ul className="space-y-1 list-disc list-inside text-gray-300">
                        <li><span className="text-white font-bold">ESC</span>: 继续游戏</li>
                        {isMobile ? (
                            <>
                                <li><span className="text-white font-bold">左侧摇杆</span>: 俯仰与滚转</li>
                                <li><span className="text-white font-bold">右侧滑块</span>: 油门控制</li>
                                <li><span className="text-white font-bold">FIRE 按钮</span>: 开火</li>
                            </>
                        ) : (
                            <>
                                <li><span className="text-white font-bold">{controlMode === 'mouse' ? '左键' : '空格 (Space)'}</span>: 开火射击</li>
                                <li><span className="text-white font-bold">Shift/Ctrl</span>: 油门加/减</li>
                                {controlMode === 'keyboard' ? (
                                    <li><span className="text-white font-bold">W / S</span>: 俯冲 / 拉升</li>
                                ) : (
                                    <li><span className="text-white font-bold">鼠标 Y 轴</span>: 俯仰 (反向控制)</li>
                                )}
                            </>
                        )}
                    </ul>
                    </div>

                    <div className="text-gray-400 text-xs mb-4">
                        当前得分: <span className="text-yellow-400 font-mono font-bold">{score}</span>
                    </div>

                    <div className="flex gap-4 justify-center">
                        <button
                        onClick={() => setPaused(false)}
                        className="px-6 py-3 bg-yellow-600 hover:bg-yellow-500 text-black font-bold rounded transition-colors uppercase tracking-wider text-sm shadow-[0_0_15px_rgba(234,179,8,0.5)]"
                        >
                        继续
                        </button>
                        <button
                        onClick={handleRestart}
                        className="px-6 py-3 bg-red-700 hover:bg-red-600 text-white font-bold rounded transition-colors uppercase tracking-wider text-sm"
                        >
                        重新开始
                        </button>
                    </div>
                </div>
            </div>
          </Html>
        )}
      </Canvas>
      {!paused && <HUD telemetry={telemetry} score={score} hp={playerHp} isMobile={isMobile} />}
      {!paused && isMobile && <MobileControls inputRef={mobileInputRef} />}
    </>
  );
};

interface GameSceneProps {
  onTelemetryUpdate: (data: { speed: number; altitude: number; heading: number }) => void;
  paused: boolean;
  score: number;
  setScore: React.Dispatch<React.SetStateAction<number>>;
  playerHp: number;
  setPlayerHp: React.Dispatch<React.SetStateAction<number>>;
  onRestart: () => void;
  controlMode: 'keyboard' | 'mouse';
  difficulty: Difficulty;
  customModelUrl: string | null;
  modelRotation: [number, number, number];
  isMobile: boolean;
  mobileInputRef: React.MutableRefObject<MobileInputState>;
}

interface ExplosionState {
  id: number;
  position: [number, number, number];
}

interface SparkState {
    id: number;
    position: [number, number, number];
}

const GameScene: React.FC<GameSceneProps> = ({ 
    onTelemetryUpdate, paused, setScore, playerHp, setPlayerHp, onRestart, controlMode, difficulty,
    customModelUrl, modelRotation, isMobile, mobileInputRef
}) => {
  const [enemies, setEnemies] = useState<Enemy[]>([]);
  // Use a Ref to store real-time positions of enemies for collision detection
  const enemyPositionsRef = useRef<{ [id: number]: THREE.Vector3 }>({});
  
  const playerPosRef = useRef(new THREE.Vector3(0, 0, 0));
  const [playerSpeed, setPlayerSpeed] = useState(0); 
  
  const [playerDead, setPlayerDead] = useState(false);
  const [explosions, setExplosions] = useState<ExplosionState[]>([]);
  const [hitSparks, setHitSparks] = useState<SparkState[]>([]);
  const [playerFlash, setPlayerFlash] = useState(0);

  // Audio Context
  const audioContextRef = useRef<AudioContext | null>(null);
  const noiseBufferRef = useRef<AudioBuffer | null>(null);

  // Init Audio
  useEffect(() => {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      audioContextRef.current = ctx;

      const bufferSize = ctx.sampleRate * 2.0; 
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) { data[i] = Math.random() * 2 - 1; }
      noiseBufferRef.current = buffer;

      return () => { try { ctx.close(); } catch(e){} };
  }, []);

  const playBigExplosion = () => {
      if (!audioContextRef.current || !noiseBufferRef.current) return;
      const ctx = audioContextRef.current;
      const t = ctx.currentTime;
      const source = ctx.createBufferSource();
      source.buffer = noiseBufferRef.current;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.Q.value = 1;
      filter.frequency.setValueAtTime(1000, t);
      filter.frequency.exponentialRampToValueAtTime(20, t + 2.0);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(2.0, t + 0.1); 
      gain.gain.exponentialRampToValueAtTime(0.01, t + 3.0);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      source.start();
  };

  const playHitSound = () => {
      if (!audioContextRef.current) return;
      const ctx = audioContextRef.current;
      const t = ctx.currentTime;

      // --- FM Synthesis for Hard Metal Impact ---
      const duration = 0.15;

      const modulator = ctx.createOscillator();
      modulator.type = 'square';
      modulator.frequency.value = 340; 
      
      const modGain = ctx.createGain();
      modGain.gain.setValueAtTime(2000, t); 
      modGain.gain.exponentialRampToValueAtTime(10, t + duration); 

      const carrier = ctx.createOscillator();
      carrier.type = 'sine';
      carrier.frequency.value = 800; 

      modulator.connect(modGain);
      modGain.connect(carrier.frequency);

      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0.5, t);
      masterGain.gain.exponentialRampToValueAtTime(0.01, t + duration);

      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 1000;

      carrier.connect(filter);
      filter.connect(masterGain);
      masterGain.connect(ctx.destination);

      modulator.start(t);
      carrier.start(t);
      modulator.stop(t + duration);
      carrier.stop(t + duration);

      if (noiseBufferRef.current) {
          const noiseSrc = ctx.createBufferSource();
          noiseSrc.buffer = noiseBufferRef.current;
          const noiseG = ctx.createGain();
          noiseG.gain.setValueAtTime(0.4, t);
          noiseG.gain.exponentialRampToValueAtTime(0.01, t + 0.05);
          noiseSrc.connect(noiseG);
          noiseG.connect(ctx.destination);
          noiseSrc.start(t);
      }
  };

  const playImpactSound = () => {
      if (!audioContextRef.current || !noiseBufferRef.current) return;
      const ctx = audioContextRef.current;
      const t = ctx.currentTime;
      
      const source = ctx.createBufferSource();
      source.buffer = noiseBufferRef.current;
      
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 600;
      
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.8, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
      
      source.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      source.start();
  };

  const createNewEnemy = (idOverride?: number): Enemy => {
    const id = idOverride ?? Date.now() + Math.random();
    const pos: [number, number, number] = [
        (Math.random() - 0.5) * 2000, // Wider spawn area
        300 + Math.random() * 300,
        -1000 - Math.random() * 1000
    ];
    return {
        id,
        position: pos,
        color: '#2e7d32',
        hp: 10,
        maxHp: 10
    };
  };

  // Init Enemies
  useEffect(() => {
      const spawns = [];
      enemyPositionsRef.current = {}; 
      for(let i=0; i<5; i++) {
          const enemy = createNewEnemy(i);
          spawns.push(enemy);
          enemyPositionsRef.current[i] = new THREE.Vector3(...enemy.position);
      }
      setEnemies(spawns);
      
      (window as any).triggerPlayerCrash = handlePlayerCrash;
      return () => { (window as any).triggerPlayerCrash = undefined; }
  }, []);

  const updateTelemetryWrapper = (data: { speed: number; altitude: number; heading: number }) => {
      setPlayerSpeed(data.speed);
      onTelemetryUpdate(data);
  };

  const handlePlayerCrash = () => {
      if (playerDead) return;
      setPlayerDead(true);
      playBigExplosion();
      setExplosions(prev => [...prev, { id: Date.now(), position: playerPosRef.current.toArray() as [number, number, number] }]);
      setTimeout(() => {
          onRestart();
      }, 3000);
  };

  const handlePlayerHit = () => {
      if (playerDead) return;
      
      setPlayerFlash(1.0);
      playImpactSound();
      
      setPlayerHp(prev => {
          const newHp = prev - 1;
          if (newHp <= 0) {
              handlePlayerCrash();
              return 0;
          }
          return newHp;
      });
  };

  useFrame((state, delta) => {
      if (playerFlash > 0) {
          setPlayerFlash(prev => Math.max(0, prev - delta * 3));
      }
  });

  const handleEnemyHit = (id: number, hitPos?: THREE.Vector3) => {
      setEnemies(prev => {
          return prev.map(e => {
              if (e.id === id) {
                  const newHp = e.hp - 1;
                  
                  // Visual & Audio Feedback
                  if (hitPos) {
                      setHitSparks(prevSparks => [...prevSparks, { id: Date.now() + Math.random(), position: hitPos.toArray() as [number, number, number] }]);
                  }
                  
                  if (newHp <= 0) {
                      // Destroyed Logic
                      const explPos = enemyPositionsRef.current[id];
                      if (explPos) {
                        setExplosions(prevExpl => [...prevExpl, { id: Date.now(), position: explPos.toArray() as [number, number, number] }]);
                        playBigExplosion();
                        setScore(s => s + 100);
                        delete enemyPositionsRef.current[id];
                      }
                      
                      const newEnemy = createNewEnemy(); 
                      enemyPositionsRef.current[newEnemy.id] = new THREE.Vector3(...newEnemy.position);
                      return newEnemy; 
                  } else {
                      playHitSound();
                      return { ...e, hp: newHp };
                  }
              }
              return e;
          });
      });
  };

  return (
    <>
      <color attach="background" args={['#8ba3b3']} /> 
      
      <ambientLight intensity={0.6} color="#90a4ae" />
      <directionalLight 
        position={[100, 300, 50]} 
        intensity={1.2} 
        castShadow 
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-1000}
        shadow-camera-right={1000}
        shadow-camera-top={1000}
        shadow-camera-bottom={-1000}
        color="#fff5e6"
      />

      <Sky distance={450000} sunPosition={[100, 20, 100]} turbidity={10} rayleigh={0.5} mieCoefficient={0.005} mieDirectionalG={0.8} />
      <Stars radius={4000} depth={50} count={2000} factor={4} saturation={0} fade speed={1} />
      <fog attach="fog" args={['#8ba3b3', 100, 3500]} />
      
      <LowPolyClouds />
      <Terrain />
      
      <Airplane 
        onUpdate={updateTelemetryWrapper} 
        paused={paused || playerDead} 
        enemies={enemies}
        enemyPositionsRef={enemyPositionsRef}
        onEnemyHit={handleEnemyHit}
        playerPosRef={playerPosRef}
        isDead={playerDead}
        controlMode={controlMode}
        customModelUrl={customModelUrl}
        modelRotation={modelRotation}
        isMobile={isMobile}
        mobileInputRef={mobileInputRef}
      />
      
      <AllyPlane 
        startPosition={[15, 1, 380]} 
        playerSpeed={playerSpeed} 
        enemies={enemies}
        enemyPositionsRef={enemyPositionsRef}
        onEnemyHit={handleEnemyHit}
        paused={paused || playerDead}
        allyIndex={0}
      />
      <AllyPlane 
        startPosition={[-15, 1, 380]} 
        playerSpeed={playerSpeed} 
        enemies={enemies}
        enemyPositionsRef={enemyPositionsRef}
        onEnemyHit={handleEnemyHit}
        paused={paused || playerDead}
        allyIndex={1}
      />
      
      {enemies.map(enemy => (
          <EnemyPlane 
            key={enemy.id} 
            id={enemy.id}
            startPosition={enemy.position} 
            playerPosRef={playerPosRef} 
            enemyPositionsRef={enemyPositionsRef}
            onHitPlayer={handlePlayerHit}
            paused={paused || playerDead}
            difficulty={difficulty}
          />
      ))}

      {playerFlash > 0 && !playerDead && (
          <Html fullscreen style={{pointerEvents: 'none'}}>
              <div style={{
                  width: '100vw', 
                  height: '100vh', 
                  backgroundColor: `rgba(255, 0, 0, ${playerFlash * 0.3})`,
                  transition: 'none'
              }} />
          </Html>
      )}

      {explosions.map(exp => (
          <Explosion key={exp.id} position={exp.position} />
      ))}
      
      {hitSparks.map(spark => (
          <HitSpark key={spark.id} position={spark.position} />
      ))}
    </>
  );
};

const LowPolyClouds: React.FC = () => {
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const count = 60;
    
    useEffect(() => {
        if (!meshRef.current) return;
        const dummy = new THREE.Object3D();
        for(let i=0; i<count; i++) {
            dummy.position.set(
                (Math.random() - 0.5) * 3000,
                300 + Math.random() * 300,
                (Math.random() - 0.5) * 3000
            );
            const scale = 20 + Math.random() * 40;
            dummy.scale.set(scale, scale * 0.6, scale);
            dummy.rotation.set(0, Math.random() * Math.PI, 0);
            dummy.updateMatrix();
            meshRef.current.setMatrixAt(i, dummy.matrix);
        }
        meshRef.current.instanceMatrix.needsUpdate = true;
    }, []);

    return (
        <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
            <sphereGeometry args={[1, 7, 7]} />
            <meshStandardMaterial color="white" flatShading transparent opacity={0.8} />
        </instancedMesh>
    );
};

const Explosion: React.FC<{position: [number, number, number]}> = ({position}) => {
    const meshRef = useRef<THREE.Mesh>(null);
    const [finished, setFinished] = useState(false);

    useFrame((state, delta) => {
        if (meshRef.current && !finished) {
            const scale = meshRef.current.scale.x + delta * 40; 
            meshRef.current.scale.setScalar(scale);
            (meshRef.current.material as THREE.MeshBasicMaterial).opacity -= delta * 1.5;
            
            if ((meshRef.current.material as THREE.MeshBasicMaterial).opacity <= 0) {
                setFinished(true);
            }
        }
    });

    if (finished) return null;

    return (
        <mesh position={position} ref={meshRef}>
            <sphereGeometry args={[2, 16, 16]} />
            <meshBasicMaterial color="orange" transparent opacity={1} />
        </mesh>
    );
};

const HitSpark: React.FC<{position: [number, number, number]}> = ({position}) => {
    const meshRef = useRef<THREE.Mesh>(null);
    const [finished, setFinished] = useState(false);

    useFrame((state, delta) => {
        if (meshRef.current && !finished) {
            const scale = meshRef.current.scale.x + delta * 20; // Faster than big explosion
            meshRef.current.scale.setScalar(scale);
            (meshRef.current.material as THREE.MeshBasicMaterial).opacity -= delta * 5.0; // Quick fade
            
            if ((meshRef.current.material as THREE.MeshBasicMaterial).opacity <= 0) {
                setFinished(true);
            }
        }
    });

    if (finished) return null;

    return (
        <mesh position={position} ref={meshRef}>
            <sphereGeometry args={[0.5, 8, 8]} />
            <meshBasicMaterial color="#ffff00" transparent opacity={1} toneMapped={false} />
        </mesh>
    );
};

export default GameCanvas;
