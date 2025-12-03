
import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Vector3, Quaternion } from 'three';
import PlaneModel from './PlaneModel';
import { Difficulty } from '../types';

interface EnemyPlaneProps {
  id: number;
  startPosition: [number, number, number];
  playerPosRef: React.MutableRefObject<THREE.Vector3>;
  enemyPositionsRef: React.MutableRefObject<{ [id: number]: THREE.Vector3 }>;
  onHitPlayer: () => void;
  paused: boolean;
  difficulty: Difficulty;
}

const MAX_BULLETS = 20;

const EnemyPlane: React.FC<EnemyPlaneProps> = ({ id, startPosition, playerPosRef, enemyPositionsRef, onHitPlayer, paused, difficulty }) => {
  const groupRef = useRef<THREE.Group>(null);
  const bulletMeshRef = useRef<THREE.InstancedMesh>(null);
  
  // physics state
  const position = useRef(new Vector3(...startPosition));
  const quaternion = useRef(new Quaternion());
  const speed = useRef(35); 
  
  // AI state
  const state = useRef<'PATROL' | 'ATTACK' | 'EVADE'>('PATROL');
  const turnSpeed = useRef(0.35); 
  const seed = useRef(id * 123.45); // Seed for randomness
  const nextDecisionTime = useRef(0);
  const evasionEndTime = useRef(0); // For Ace evasion logic
  
  // Stats Config derived from difficulty
  const stats = useMemo(() => {
      switch(difficulty) {
          case 'rookie':
              return { 
                  speed: 21.5, 
                  turnSpeed: 0.2, 
                  aggressionDist: 300, 
                  fireRate: 0.5,
                  attackChance: 0.3
              };
          case 'ace':
              return { 
                  speed: 43, 
                  turnSpeed: 0.6, 
                  aggressionDist: 800, 
                  fireRate: 0.15,
                  attackChance: 0.8
              };
          case 'veteran':
          default:
              return { 
                  speed: 32, 
                  turnSpeed: 0.35, 
                  aggressionDist: 500, 
                  fireRate: 0.25,
                  attackChance: 0.5
              };
      }
  }, [difficulty]);
  
  // Bullets
  const bullets = useMemo(() => new Array(MAX_BULLETS).fill(0).map(() => ({
      active: false,
      position: new Vector3(),
      velocity: new Vector3(),
      life: 0
  })), []);
  const lastShotTime = useRef(0);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  // --- Audio System with 3D Spatialization ---
  const audioContextRef = useRef<AudioContext | null>(null);
  const engineOscRef = useRef<OscillatorNode | null>(null);
  const engineGainRef = useRef<GainNode | null>(null);
  const pannerNodeRef = useRef<PannerNode | null>(null); // NEW: 3D Panner
  const noiseBufferRef = useRef<AudioBuffer | null>(null);

  // Initialize Audio
  useEffect(() => {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      audioContextRef.current = ctx;

      // 1. Setup Panner Node (The 3D Audio Source)
      const panner = ctx.createPanner();
      panner.panningModel = 'HRTF'; // High quality 3D
      panner.distanceModel = 'exponential'; // Realistic drop-off
      panner.refDistance = 50; // Distance where volume is 100%
      panner.maxDistance = 2000;
      panner.rolloffFactor = 1.0;
      panner.connect(ctx.destination);
      pannerNodeRef.current = panner;

      // 2. Engine Sound (Lower pitch sawtooth)
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = 6.25;

      const gain = ctx.createGain();
      gain.gain.value = 0.1; // Base volume, distance handles the rest

      osc.connect(gain);
      gain.connect(panner); // Connect to Panner instead of destination
      osc.start();

      engineOscRef.current = osc;
      engineGainRef.current = gain;

      // 3. Gunshot Noise Buffer
      const bufferSize = ctx.sampleRate * 0.5;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) { data[i] = Math.random() * 2 - 1; }
      noiseBufferRef.current = buffer;

      return () => {
          try {
              osc.stop();
              ctx.close();
          } catch(e) {}
      };
  }, []);

  // Handle Pause
  useEffect(() => {
      if(audioContextRef.current) {
          if (paused) audioContextRef.current.suspend();
          else audioContextRef.current.resume();
      }
  }, [paused]);

  // Apply stats on difficulty change
  useEffect(() => {
      speed.current = stats.speed;
      turnSpeed.current = stats.turnSpeed;
  }, [stats]);

  const playGunshot = () => {
     if (paused || !audioContextRef.current || !noiseBufferRef.current || !pannerNodeRef.current) return;
     const ctx = audioContextRef.current;
     
     const source = ctx.createBufferSource();
     source.buffer = noiseBufferRef.current;
     
     const filter = ctx.createBiquadFilter();
     filter.type = 'lowpass';
     filter.frequency.value = 800;
     
     const gain = ctx.createGain();
     gain.gain.setValueAtTime(0.2, ctx.currentTime);
     gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
     
     source.connect(filter);
     filter.connect(gain);
     gain.connect(pannerNodeRef.current); // Connect gunshot to 3D panner
     source.start();
  };

  useFrame((stateRoot, delta) => {
    if (paused || !groupRef.current) return;
    const dt = Math.min(delta, 0.1);
    const time = stateRoot.clock.getElapsedTime();

    // --- Update Shared Position Ref for Collision ---
    if (enemyPositionsRef.current) {
        if (!enemyPositionsRef.current[id]) enemyPositionsRef.current[id] = new THREE.Vector3();
        enemyPositionsRef.current[id].copy(position.current);
    }

    // --- AI Logic ---
    const playerPos = playerPosRef.current;
    const distToPlayer = position.current.distanceTo(playerPos);
    
    // --- 3D AUDIO UPDATE ---
    if (pannerNodeRef.current && engineOscRef.current && audioContextRef.current) {
        const panner = pannerNodeRef.current;
        const currentPos = position.current;
        
        // Update Panner Position
        if(panner.positionX) {
            panner.positionX.value = currentPos.x;
            panner.positionY.value = currentPos.y;
            panner.positionZ.value = currentPos.z;
        } else {
            panner.setPosition(currentPos.x, currentPos.y, currentPos.z);
        }

        // --- SIMULATED DOPPLER EFFECT ---
        // Calculate relative velocity towards player
        // (Simplified: assuming player velocity is roughly their forward vector * speed, but just using distance delta is easier)
        // A better arcade approximation: Dot product of enemy velocity and vector to player.
        
        const toPlayer = new Vector3().subVectors(playerPos, currentPos).normalize();
        const enemyForward = new Vector3(0, 0, -1).applyQuaternion(quaternion.current);
        const closingSpeed = enemyForward.dot(toPlayer); // 1.0 = flying straight at player, -1.0 = flying away
        
        // Base Pitch + Doppler Shift
        // If closing in (positive), pitch up. If flying away (negative), pitch down.
        const baseFreq = 5 + (speed.current / 10);
        const dopplerShift = closingSpeed * 2.0; // Shift by +/- 2Hz
        const finalFreq = Math.max(1, baseFreq + dopplerShift);
        
        engineOscRef.current.frequency.setTargetAtTime(finalFreq, audioContextRef.current.currentTime, 0.1);
    }

    // 1. Determine State
    if (difficulty === 'ace' && state.current === 'EVADE') {
        if (time > evasionEndTime.current) {
            state.current = 'ATTACK'; 
        }
    } else if (time > nextDecisionTime.current) {
        if (distToPlayer < stats.aggressionDist && Math.random() < stats.attackChance) {
            state.current = 'ATTACK';
        } else {
            state.current = 'PATROL';
        }
        
        if (difficulty === 'ace' && distToPlayer < 400 && Math.random() > 0.6) {
             state.current = 'EVADE';
             evasionEndTime.current = time + 1.0 + Math.random(); 
        }
        nextDecisionTime.current = time + 2.0 + Math.random() * 2.0; 
    }

    // 2. Determine Target Direction
    const targetDir = new Vector3();
    
    if (state.current === 'EVADE') {
        const toPlayer = new Vector3().subVectors(playerPos, position.current).normalize();
        const up = new Vector3(0, 1, 0);
        const right = new Vector3().crossVectors(toPlayer, up).normalize();
        if (Math.random() > 0.5) right.negate();
        targetDir.copy(right).add(new Vector3(0, (Math.random()-0.5)*2, 0)).normalize();
        
    } else if (state.current === 'ATTACK') {
        targetDir.subVectors(playerPos, position.current).normalize();
    } else {
        const patrolCenter = new Vector3(...startPosition);
        const phase = seed.current;
        patrolCenter.x += Math.sin(time * 0.15 + phase) * 400; 
        patrolCenter.z += Math.cos(time * 0.15 + phase) * 400;
        targetDir.subVectors(patrolCenter, position.current).normalize();
    }

    // 3. Turn towards target
    const currentForward = new Vector3(0, 0, -1).applyQuaternion(quaternion.current);
    const targetQuat = new Quaternion().setFromUnitVectors(new Vector3(0, 0, -1), targetDir);
    
    const effectiveTurnSpeed = state.current === 'EVADE' ? stats.turnSpeed * 1.5 : stats.turnSpeed;
    quaternion.current.slerp(targetQuat, effectiveTurnSpeed * dt);

    // 4. Move Forward
    const forward = new Vector3(0, 0, -1).applyQuaternion(quaternion.current);
    position.current.add(forward.clone().multiplyScalar(speed.current * dt));

    // 5. Apply Transforms
    groupRef.current.position.copy(position.current);
    groupRef.current.quaternion.copy(quaternion.current);

    // --- Shooting Logic ---
    if ((state.current === 'ATTACK' || (difficulty === 'ace' && state.current === 'EVADE')) && distToPlayer < 400) {
        const angle = currentForward.angleTo(targetDir);
        const angleTol = difficulty === 'ace' ? 0.35 : 0.2;
        
        if (angle < angleTol) { 
            if (time - lastShotTime.current > stats.fireRate) { 
                const bullet = bullets.find(b => !b.active);
                if (bullet) {
                    bullet.active = true;
                    bullet.life = 1.5;
                    bullet.position.copy(position.current);
                    const bulletSpeedBonus = difficulty === 'ace' ? 250 : 150;
                    bullet.velocity.copy(forward).multiplyScalar(speed.current + bulletSpeedBonus);
                    
                    const spread = difficulty === 'ace' ? 2 : (difficulty === 'rookie' ? 12 : 8);
                    bullet.velocity.x += (Math.random() - 0.5) * spread; 
                    bullet.velocity.y += (Math.random() - 0.5) * spread;
                    
                    lastShotTime.current = time;
                    playGunshot();
                }
            }
        }
    }

    // --- Bullet Physics ---
    if (bulletMeshRef.current) {
        bullets.forEach((b, i) => {
            if (!b.active) {
                dummy.scale.set(0, 0, 0);
                dummy.updateMatrix();
                bulletMeshRef.current!.setMatrixAt(i, dummy.matrix);
                return;
            }

            b.position.addScaledVector(b.velocity, dt);
            b.life -= dt;

            if (b.position.distanceTo(playerPos) < 5) {
                b.active = false;
                onHitPlayer();
            }

            if (b.life <= 0) b.active = false;

            dummy.position.copy(b.position);
            dummy.scale.set(1, 1, 1);
            dummy.lookAt(b.position.clone().add(b.velocity));
            dummy.updateMatrix();
            bulletMeshRef.current!.setMatrixAt(i, dummy.matrix);
        });
        bulletMeshRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <>
        <group ref={groupRef}>
             <PlaneModel color={difficulty === 'ace' ? '#000000' : (difficulty === 'rookie' ? '#556b2f' : '#2e7d32')} propSpeed={speed.current / 100} />
        </group>
        <instancedMesh ref={bulletMeshRef} args={[undefined, undefined, MAX_BULLETS]} frustumCulled={false}>
            <boxGeometry args={[0.2, 0.2, 3]} />
            <meshBasicMaterial color="#ff5500" toneMapped={false} />
        </instancedMesh>
    </>
  );
};

export default EnemyPlane;
