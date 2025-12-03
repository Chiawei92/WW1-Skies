
import React, { useRef, useEffect, useState, useMemo, useLayoutEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { Vector3, Quaternion, Euler } from 'three';
import { Html } from '@react-three/drei';
import { Enemy, MobileInputState } from '../types';
import PlaneModel from './PlaneModel';

interface AirplaneProps {
  onUpdate: (data: { speed: number; altitude: number; heading: number }) => void;
  paused: boolean;
  enemies: Enemy[];
  enemyPositionsRef: React.MutableRefObject<{ [id: number]: THREE.Vector3 }>;
  onEnemyHit: (id: number, hitPos?: Vector3) => void;
  playerPosRef: React.MutableRefObject<THREE.Vector3>;
  isDead?: boolean; 
  controlMode: 'keyboard' | 'mouse';
  customModelUrl: string | null;
  modelRotation: [number, number, number];
  isMobile: boolean;
  mobileInputRef: React.MutableRefObject<MobileInputState>;
}

// --- Bullet System Interface ---
interface Bullet {
    id: number;
    active: boolean;
    position: Vector3;
    prevPosition: Vector3; // Added for continuous collision detection
    velocity: Vector3;
    life: number;
}

const MAX_BULLETS = 100;

// --- Custom Plane Loader ---
const CustomPlaneModel: React.FC<{ url: string, rotationOffset: [number, number, number] }> = ({ url, rotationOffset }) => {
    const { scene } = useGLTF(url);
    // Clone scene to avoid mutating the cached GLTF object if re-used
    const clonedScene = useMemo(() => scene.clone(), [scene]);
    const groupRef = useRef<THREE.Group>(null);
    
    // Auto-scale and Center logic
    useLayoutEffect(() => {
        if (!groupRef.current) return;
        
        // Reset transforms on the scene root before calculating box
        clonedScene.position.set(0,0,0);
        clonedScene.scale.set(1,1,1);
        clonedScene.rotation.set(0,0,0);
        
        const box = new THREE.Box3().setFromObject(clonedScene);
        const size = new THREE.Vector3();
        box.getSize(size);
        const center = new THREE.Vector3();
        box.getCenter(center);
        
        // Target approx size of 4 units length/width
        const maxDim = Math.max(size.x, size.y, size.z);
        const targetSize = 4.0;
        // Avoid division by zero
        const scale = maxDim > 0 ? targetSize / maxDim : 1;
        
        // Apply Center Offset: Move the scene so its center is at (0,0,0)
        clonedScene.position.sub(center);
        
        // Apply Scale to the container group
        groupRef.current.scale.setScalar(scale);

    }, [clonedScene, url]);

    // Apply Manual Rotation Offset
    useLayoutEffect(() => {
        if (!groupRef.current) return;
        // Apply the manual rotation offset to the container group
        groupRef.current.rotation.set(
            THREE.MathUtils.degToRad(rotationOffset[0]),
            THREE.MathUtils.degToRad(rotationOffset[1]),
            THREE.MathUtils.degToRad(rotationOffset[2])
        );
    }, [rotationOffset]);

    return (
        <group ref={groupRef}>
             <primitive object={clonedScene} />
        </group>
    );
};

// --- Speed Lines Effect Component ---
const SpeedLines = ({ speedRef }: { speedRef: React.MutableRefObject<number> }) => {
    const count = 40;
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const dummy = useMemo(() => new THREE.Object3D(), []);
    const particles = useMemo(() => {
        return new Array(count).fill(0).map(() => ({
            pos: new Vector3(
                (Math.random() - 0.5) * 40, 
                (Math.random() - 0.5) * 30, 
                (Math.random() - 0.5) * 60  
            ),
            speedOffset: Math.random() * 0.5 + 0.5
        }));
    }, []);

    useFrame((state, delta) => {
        if (!meshRef.current) return;
        const speed = speedRef.current;
        
        // Lower threshold for speed lines since max speed is now lower (approx 20)
        const opacity = Math.max(0, (speed - 20) / 15) * 0.4;
        if (opacity <= 0.01) {
            meshRef.current.visible = false;
            return;
        }
        meshRef.current.visible = true;
        (meshRef.current.material as THREE.MeshBasicMaterial).opacity = opacity;

        particles.forEach((p, i) => {
            p.pos.z += (speed + 50) * delta * p.speedOffset;
            
            if (p.pos.z > 30) {
                p.pos.z = -100; 
                p.pos.x = (Math.random() - 0.5) * 50;
                p.pos.y = (Math.random() - 0.5) * 40;
            }

            dummy.position.copy(p.pos);
            dummy.scale.set(1, 1, Math.max(5, speed / 4));
            dummy.updateMatrix();
            meshRef.current!.setMatrixAt(i, dummy.matrix);
        });
        meshRef.current.instanceMatrix.needsUpdate = true;
    });

    return (
        <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
            <boxGeometry args={[0.05, 0.05, 1]} />
            <meshBasicMaterial color="white" transparent blending={THREE.AdditiveBlending} depthWrite={false} />
        </instancedMesh>
    );
};

const Airplane: React.FC<AirplaneProps> = ({ 
    onUpdate, paused, enemies, enemyPositionsRef, onEnemyHit, playerPosRef, isDead, controlMode,
    customModelUrl, modelRotation, isMobile, mobileInputRef
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const bulletMeshRef = useRef<THREE.InstancedMesh>(null);
  const { camera } = useThree();

  const [crashed, setCrashed] = useState(false);
  
  const currentSpeed = useRef(0);
  const currentThrottle = useRef(0);
  const velocity = useRef(new Vector3(0, 0, 0));
  
  // Input Smoothing Refs
  const currentPitchInput = useRef(0);
  const currentRollInput = useRef(0);
  
  const bulletsRef = useRef<Bullet[]>([]);
  const lastShotTime = useRef(0);
  const bulletDummy = useMemo(() => new THREE.Object3D(), []);

  // Telemetry Throttle Ref
  const lastTelemetryUpdate = useRef(0);

  // Lazy Initialization of bullets
  if (bulletsRef.current.length === 0) {
      bulletsRef.current = new Array(MAX_BULLETS).fill(0).map((_, i) => ({
          id: i,
          active: false,
          position: new Vector3(),
          prevPosition: new Vector3(),
          velocity: new Vector3(),
          life: 0
      }));
  }
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const oscEngineRef = useRef<OscillatorNode | null>(null);
  const oscBassRef = useRef<OscillatorNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const noiseBufferRef = useRef<AudioBuffer | null>(null); 
  
  const MIN_SPEED = 0;
  const MAX_SPEED = 43; 
  const STALL_SPEED = 22; 
  // const GRAVITY_DROP = 10.0; // Handled dynamically now based on lift

  const PITCH_RATE = 1.0; // Slightly reduced max pitch rate
  const ROLL_RATE = 2.0; 
  const YAW_RATE = 0.5; 
  
  const GROUND_Y = 0.5; 

  const keys = useRef<{ [key: string]: boolean }>({});
  const isMouseDown = useRef(false);

  const _quat = new Quaternion();
  const _euler = new Euler(0, 0, 0, 'YXZ');
  const _forward = new Vector3();
  const _cameraIdealPos = new Vector3();
  const _cameraIdealLook = new Vector3();
  const _currentLookAt = useRef(new Vector3(0, 0, -100)); 

  const resetPlane = () => {
      if (!groupRef.current) return;
      
      groupRef.current.position.set(0, GROUND_Y, 400); 
      groupRef.current.rotation.set(0, 0, 0);
      
      currentSpeed.current = 0;
      currentThrottle.current = 0;
      velocity.current.set(0, 0, 0);
      
      currentPitchInput.current = 0;
      currentRollInput.current = 0;
      
      const planePos = groupRef.current.position;
      camera.position.set(planePos.x, planePos.y + 10, planePos.z + 30);
      camera.lookAt(planePos.x, planePos.y, planePos.z - 50);
      camera.up.set(0, 1, 0);
      _currentLookAt.current.copy(planePos).add(new Vector3(0, 0, -50));

      bulletsRef.current.forEach(b => b.active = false);

      setCrashed(false);
  };

  useEffect(() => {
    if (audioContextRef.current) {
        if (paused || isDead) audioContextRef.current.suspend();
        else audioContextRef.current.resume();
    }
  }, [paused, isDead]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (crashed || isDead) return;
        keys.current[e.key.toLowerCase()] = true;
        if (e.code === 'Space') keys.current['space'] = true;
    };
    const handleKeyUp = (e: KeyboardEvent) => {
        keys.current[e.key.toLowerCase()] = false;
        if (e.code === 'Space') keys.current['space'] = false;
    };
    const handleMouseDown = () => { isMouseDown.current = true; };
    const handleMouseUp = () => { isMouseDown.current = false; };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    
    return () => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
        window.removeEventListener('mousedown', handleMouseDown);
        window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [crashed, isDead]);

  useEffect(() => { resetPlane(); }, []);

  useEffect(() => {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    audioContextRef.current = ctx;

    const masterGain = ctx.createGain();
    masterGain.gain.value = 0.1;
    masterGain.connect(ctx.destination);
    gainNodeRef.current = masterGain;

    // High Speed Prop Sound - REDUCED FREQUENCY (10Hz)
    const osc1 = ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc1.frequency.value = 10; 
    osc1.connect(masterGain);

    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.value = 12.5; 
    const bassGain = ctx.createGain();
    bassGain.gain.value = 0.8; // Boost bass relative mix
    osc2.connect(bassGain).connect(masterGain);

    osc1.start();
    osc2.start();
    oscEngineRef.current = osc1;
    oscBassRef.current = osc2;

    const bufferSize = ctx.sampleRate * 2.0; 
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
    }
    noiseBufferRef.current = buffer;

    return () => { try { ctx.close(); } catch(e) {} };
  }, []);

  const playGunshot = () => {
      if (!audioContextRef.current || !noiseBufferRef.current || paused || isDead) return;
      const ctx = audioContextRef.current;
      
      const source = ctx.createBufferSource();
      source.buffer = noiseBufferRef.current;
      
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 1000;
      
      const gain = ctx.createGain();
      // Increased gun volume by 30% from 0.2 to ~0.3 (0.2 * 1.3 = 0.26, let's go 0.3 for clear effect)
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15); 
      
      source.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      
      source.start();
      source.stop(ctx.currentTime + 0.2);
  };

  const playExplosion = () => {
      if (!audioContextRef.current || !noiseBufferRef.current) return;
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      const t = ctx.currentTime;
      const source = ctx.createBufferSource();
      source.buffer = noiseBufferRef.current;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.Q.value = 1;
      filter.frequency.setValueAtTime(800, t);
      filter.frequency.exponentialRampToValueAtTime(50, t + 0.8);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(1.5, t + 0.05); 
      gain.gain.exponentialRampToValueAtTime(0.01, t + 1.2); 
      source.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      source.start();
  };

  const fireBullet = (planePos: Vector3, planeQuat: Quaternion, planeVelocity: Vector3, offset: number) => {
      const bullet = bulletsRef.current.find(b => !b.active);
      if (!bullet) return;

      const spawnOffset = new Vector3(offset, 0, -2); 
      spawnOffset.applyQuaternion(planeQuat);
      bullet.position.copy(planePos).add(spawnOffset);
      bullet.prevPosition.copy(bullet.position); // Init prev pos

      // Significantly increased muzzle velocity (300 -> 600) for "arcade" feel, less lead needed
      const muzzleVel = new Vector3(0, 0, -600); 
      muzzleVel.applyQuaternion(planeQuat);
      
      bullet.velocity.copy(planeVelocity).add(muzzleVel);
      
      bullet.active = true;
      bullet.life = 2.0; // Life

      playGunshot();
  };

  const getTerrainHeight = (x: number, z: number) => {
      if (Math.abs(x) < 200 && z > -1700 && z < 700) {
          return 0;
      }
      const SCALE = 400;
      const HEIGHT = 150;
      const STEPS = 15;
      const rawHeight = (Math.sin(x / SCALE) + Math.cos(z / (SCALE * 0.8))) * HEIGHT;
      const terracedHeight = Math.floor(Math.max(0, rawHeight) / STEPS) * STEPS;
      return terracedHeight;
  };

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    if (paused) return; 
    if (isDead) return;

    const dt = Math.min(delta, 0.1); 
    const plane = groupRef.current;
    const currentTime = state.clock.getElapsedTime();

    if (crashed) {
        if (gainNodeRef.current && audioContextRef.current) {
            gainNodeRef.current.gain.setTargetAtTime(0, audioContextRef.current.currentTime, 0.1);
        }
        return;
    }

    // --- UPDATE AUDIO LISTENER (THE PLAYER EARS) ---
    // We update the audio listener to match the player's position and rotation
    // This allows the PannerNodes in enemy planes to calculate 3D audio correctly
    if (audioContextRef.current) {
        const listener = audioContextRef.current.listener;
        const pos = plane.position;
        const forward = new Vector3(0, 0, -1).applyQuaternion(plane.quaternion);
        const up = new Vector3(0, 1, 0).applyQuaternion(plane.quaternion);
        
        // Handle API differences in browsers
        if (listener.positionX) {
            listener.positionX.value = pos.x;
            listener.positionY.value = pos.y;
            listener.positionZ.value = pos.z;
            listener.forwardX.value = forward.x;
            listener.forwardY.value = forward.y;
            listener.forwardZ.value = forward.z;
            listener.upX.value = up.x;
            listener.upY.value = up.y;
            listener.upZ.value = up.z;
        } else if ((listener as any).setPosition) {
             // Legacy
             (listener as any).setPosition(pos.x, pos.y, pos.z);
             (listener as any).setOrientation(forward.x, forward.y, forward.z, up.x, up.y, up.z);
        }
    }

    playerPosRef.current.copy(plane.position);

    // --- CONTROLS INPUT ---
    if (isMobile) {
        // Mobile Controls
        // Throttle is absolute from slider
        currentThrottle.current = mobileInputRef.current.throttle;
    } else {
        // Desktop Controls
        if (keys.current['shift']) currentThrottle.current = Math.min(currentThrottle.current + 0.5 * dt, 1.0);
        if (keys.current['control']) currentThrottle.current = Math.max(currentThrottle.current - 0.5 * dt, 0.0);
    }

    const targetSpeed = currentThrottle.current * MAX_SPEED;
    
    // --- HEAVY INERTIA ACCELERATION ---
    const acceleration = currentThrottle.current > 0 ? 0.08 : 0.03;
    currentSpeed.current += (targetSpeed - currentSpeed.current) * acceleration * dt; 
    
    if (currentSpeed.current < MIN_SPEED) currentSpeed.current = MIN_SPEED;

    // --- SMOOTH CONTROLS ---
    let targetPitch = 0;
    let targetRoll = 0;

    if (isMobile) {
        // Mobile Joystick
        targetPitch = mobileInputRef.current.stickY;
        // Fix roll: Right stick (positive X) should roll right (negative Z rotation in Three.js)
        targetRoll = -mobileInputRef.current.stickX;
    } else if (controlMode === 'keyboard') {
        targetPitch = (keys.current['s'] ? 1 : 0) - (keys.current['w'] ? 1 : 0);
        targetRoll = (keys.current['d'] ? -1 : 0) + (keys.current['a'] ? 1 : 0);
    } else {
        // Mouse Controls
        targetPitch = -state.pointer.y; // Inverted Y: Up is Down
        targetRoll = -state.pointer.x;  // Right is Right Roll
        
        targetPitch = THREE.MathUtils.clamp(targetPitch * 1.5, -1, 1);
        targetRoll = THREE.MathUtils.clamp(targetRoll * 1.5, -1, 1);
    }
    
    currentPitchInput.current += (targetPitch - currentPitchInput.current) * dt * 8.0;
    currentRollInput.current += (targetRoll - currentRollInput.current) * dt * 8.0;

    let pitchInput = currentPitchInput.current;
    let rollInput = currentRollInput.current;

    const terrainHeight = getTerrainHeight(plane.position.x, plane.position.z);
    const isOnGround = plane.position.y <= terrainHeight + GROUND_Y + 0.1;

    // --- AERODYNAMIC AUTHORITY SIMULATION ---
    const speedRatio = Math.min(1.0, currentSpeed.current / MAX_SPEED);
    const aerodynamicFactor = Math.pow(speedRatio, 3); // Cubic curve for responsiveness
    
    if (isOnGround) {
        rollInput *= 0.1;
    } 
    pitchInput *= aerodynamicFactor;
    rollInput *= aerodynamicFactor;

    const bankFactor = new Vector3(1,0,0).applyQuaternion(plane.quaternion).y;
    const yawInput = bankFactor * YAW_RATE * aerodynamicFactor; 

    _euler.set(
        pitchInput * PITCH_RATE * dt, 
        yawInput * dt,                
        rollInput * ROLL_RATE * dt,   
        'YXZ'
    );
    _quat.setFromEuler(_euler);
    
    plane.quaternion.multiply(_quat).normalize();

    // --- DYNAMIC PITCH LIMIT (TAKEOFF SIMULATION) ---
    if (isOnGround || plane.position.y < terrainHeight + GROUND_Y + 2.0) {
        const currentEuler = new Euler().setFromQuaternion(plane.quaternion, 'YXZ');
        const speedForPitch = THREE.MathUtils.clamp(currentSpeed.current, 20, 43);
        const maxPitchDeg = THREE.MathUtils.mapLinear(speedForPitch, 20, 43, 0, 30);
        const maxPitchRad = THREE.MathUtils.degToRad(maxPitchDeg);

        if (currentEuler.x > maxPitchRad) {
            currentEuler.x = maxPitchRad;
            plane.quaternion.setFromEuler(currentEuler);
        }
    }

    _forward.set(0, 0, -1).applyQuaternion(plane.quaternion);
    velocity.current.copy(_forward).multiplyScalar(currentSpeed.current);

    const moveStep = velocity.current.clone().multiplyScalar(dt);
    
    // --- LIFT PHYSICS ---
    const GRAVITY = 15.0;
    const liftRatio = Math.pow(currentSpeed.current / STALL_SPEED, 2); 
    const liftForce = Math.min(liftRatio * GRAVITY, GRAVITY * 1.5); 
    
    let verticalForce = liftForce - GRAVITY;
    
    if (isOnGround) {
        const currentEuler = new Euler().setFromQuaternion(plane.quaternion);
        if (verticalForce > 0 && currentEuler.x > 0.05) {
            moveStep.y += verticalForce * dt;
        } else {
            moveStep.y = 0;
            if (currentSpeed.current < STALL_SPEED * 0.5) {
                 if(currentEuler.x > 0.1) { 
                     currentEuler.x -= 1.0 * dt; 
                     plane.quaternion.setFromEuler(currentEuler);
                 }
            }
        }
    } else {
        moveStep.y += verticalForce * dt;
    }

    plane.position.add(moveStep);

    // --- COLLISION DETECTION ---
    if (plane.position.y < terrainHeight + GROUND_Y) {
        const onRunway = (Math.abs(plane.position.x) < 200 && plane.position.z > -1700 && plane.position.z < 700);
        const upVec = new Vector3(0, 1, 0).applyQuaternion(plane.quaternion);
        const isUpright = upVec.y > 0.8; 
        
        if (onRunway && isUpright) {
            plane.position.y = terrainHeight + GROUND_Y;
            const currentEuler = new Euler().setFromQuaternion(plane.quaternion);
            currentEuler.x *= 0.95; 
            currentEuler.z *= 0.95; 
            plane.quaternion.setFromEuler(currentEuler);
        } else {
            handleCrash();
            playExplosion();
        }
    }

    // Shooting
    let isFiring = false;
    if (isMobile) {
        isFiring = mobileInputRef.current.firing;
    } else {
        isFiring = keys.current['space'] || (controlMode === 'mouse' && isMouseDown.current);
    }

    if (isFiring && currentTime - lastShotTime.current > 0.08) {
        fireBullet(plane.position, plane.quaternion, velocity.current, 0.5);
        fireBullet(plane.position, plane.quaternion, velocity.current, -0.5);
        lastShotTime.current = currentTime;
    }

    if (bulletMeshRef.current) {
        bulletsRef.current.forEach((b, i) => {
            if (!b.active) {
                 bulletDummy.scale.set(0,0,0);
                 bulletDummy.updateMatrix();
                 bulletMeshRef.current!.setMatrixAt(i, bulletDummy.matrix);
                 return;
            }
            b.prevPosition.copy(b.position);
            b.position.addScaledVector(b.velocity, dt);
            b.velocity.y -= 0.5 * dt; 
            b.life -= dt;
            if (b.life <= 0 || b.position.y < getTerrainHeight(b.position.x, b.position.z)) {
                b.active = false;
            } else {
                const bStart = b.prevPosition;
                const bEnd = b.position;
                const segmentVec = new Vector3().subVectors(bEnd, bStart);
                const segmentLenSq = segmentVec.lengthSq();

                for (let eIdx = 0; eIdx < enemies.length; eIdx++) {
                     const enemy = enemies[eIdx];
                     const enemyPos = enemyPositionsRef.current[enemy.id];
                     if (!enemyPos) continue;

                     const enemyToStart = new Vector3().subVectors(enemyPos, bStart);
                     let t = 0;
                     if (segmentLenSq > 0) {
                        t = enemyToStart.dot(segmentVec) / segmentLenSq;
                        t = Math.max(0, Math.min(1, t));
                     }
                     const closestPoint = new Vector3().copy(bStart).addScaledVector(segmentVec, t);
                     const distSq = closestPoint.distanceToSquared(enemyPos);

                     // Tightened Hitbox: Radius ~3.5 (sqrt 12) to match actual model size
                     if (distSq < 12) { 
                         b.active = false;
                         onEnemyHit(enemy.id, closestPoint);
                         // Note: We don't play explosion here anymore, logic moved to GameCanvas for damage/death
                         break;
                     }
                }
            }
            bulletDummy.position.copy(b.position);
            const lookTarget = b.position.clone().add(b.velocity);
            bulletDummy.lookAt(lookTarget);
            bulletDummy.scale.set(1, 1, 1);
            bulletDummy.updateMatrix();
            bulletMeshRef.current!.setMatrixAt(i, bulletDummy.matrix);
        });
        bulletMeshRef.current.instanceMatrix.needsUpdate = true;
    }

    // Camera Lag
    const planeUp = new Vector3(0, 1, 0).applyQuaternion(plane.quaternion);
    const planeBack = new Vector3(0, 0, 1).applyQuaternion(plane.quaternion);

    _cameraIdealPos.copy(plane.position)
        .add(planeUp.clone().multiplyScalar(5))  
        .add(planeBack.clone().multiplyScalar(15)); 

    const posStiffness = 3.0; 
    camera.position.lerp(_cameraIdealPos, 1 - Math.exp(-posStiffness * dt));

    const rotStiffness = 6.0; 
    const currentUp = camera.up.clone();
    currentUp.lerp(planeUp, 1 - Math.exp(-rotStiffness * dt)).normalize();
    camera.up.copy(currentUp);

    _cameraIdealLook.copy(plane.position)
        .add(planeUp.clone().multiplyScalar(10)) 
        .add(new Vector3(0, 0, -50).applyQuaternion(plane.quaternion));

    _currentLookAt.current.lerp(_cameraIdealLook, 1 - Math.exp(-rotStiffness * dt));
    camera.lookAt(_currentLookAt.current);

    if (gainNodeRef.current && audioContextRef.current) {
        const v = currentSpeed.current / MAX_SPEED;
        gainNodeRef.current.gain.setTargetAtTime(v * 0.4 + 0.1, audioContextRef.current.currentTime, 0.1);
        if (oscEngineRef.current) oscEngineRef.current.frequency.setTargetAtTime(v * 50 + 10, audioContextRef.current.currentTime, 0.1); 
        if (oscBassRef.current) oscBassRef.current.frequency.setTargetAtTime(v * 25 + 12.5, audioContextRef.current.currentTime, 0.1); 
    }

    let heading = Math.atan2(_forward.x, _forward.z) * (180 / Math.PI);
    if (heading < 0) heading += 360;
    
    // THROTTLE TELEMETRY UPDATES to 10Hz to prevent React State Update overload
    if (currentTime - lastTelemetryUpdate.current > 0.1) {
        lastTelemetryUpdate.current = currentTime;
        onUpdate({
            speed: Math.round(currentSpeed.current * 1.86), 
            altitude: Math.round((plane.position.y - GROUND_Y)), 
            heading: Math.round(heading)
        });
    }

  });

  const handleCrash = () => {
      if (crashed) return;
      setCrashed(true);
      if ((window as any).triggerPlayerCrash) (window as any).triggerPlayerCrash();
  };

  return (
    <group>
        {crashed && !isDead && (
            <Html center>
                <div className="flex flex-col items-center">
                    <div className="text-6xl font-black text-red-600 bg-black/80 px-6 py-4 border-4 border-red-600 rotate-[-5deg] mb-4">
                        坠毁
                    </div>
                </div>
            </Html>
        )}
        
        <instancedMesh ref={bulletMeshRef} args={[undefined, undefined, MAX_BULLETS]} frustumCulled={false}>
            <boxGeometry args={[0.15, 0.15, 4]} />
            <meshBasicMaterial color="#ffaa00" toneMapped={false} />
        </instancedMesh>

        <group ref={groupRef} visible={!isDead}>
            <SpeedLines speedRef={currentSpeed} />
            {customModelUrl ? (
                <CustomPlaneModel url={customModelUrl} rotationOffset={modelRotation} />
            ) : (
                <PlaneModel color="#8B0000" propSpeed={currentSpeed.current / 100} />
            )}
        </group>
    </group>
  );
};

export default Airplane;
