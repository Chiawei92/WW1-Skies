
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
      // Player Max Speed is approx 43. 
      // Rookie: 50% (21.5)
      // Veteran: 75% (32)
      // Ace: 100% (43)
      
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

  // --- Audio System ---
  const audioContextRef = useRef<AudioContext | null>(null);
  const engineOscRef = useRef<OscillatorNode | null>(null);
  const engineGainRef = useRef<GainNode | null>(null);
  const noiseBufferRef = useRef<AudioBuffer | null>(null);

  // Initialize Audio
  useEffect(() => {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      audioContextRef.current = ctx;

      // 1. Engine Sound (Lower pitch sawtooth)
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = 6.25; // Reduced from 12.5 (was 25, was 50)

      const gain = ctx.createGain();
      gain.gain.value = 0; // Start silent

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();

      engineOscRef.current = osc;
      engineGainRef.current = gain;

      // 2. Gunshot Noise Buffer
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
     if (paused || !audioContextRef.current || !noiseBufferRef.current) return;
     const ctx = audioContextRef.current;
     
     const source = ctx.createBufferSource();
     source.buffer = noiseBufferRef.current;
     
     const filter = ctx.createBiquadFilter();
     filter.type = 'lowpass';
     filter.frequency.value = 800;
     
     const gain = ctx.createGain();
     // Gunshot volume also depends on distance, simplified here
     const dist = position.current.distanceTo(playerPosRef.current);
     const volume = Math.max(0, 1 - dist / 500) * 0.1;
     
     if (volume <= 0.001) return;

     gain.gain.setValueAtTime(volume, ctx.currentTime);
     gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
     
     source.connect(filter);
     filter.connect(gain);
     gain.connect(ctx.destination);
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
    
    // --- Spatial Audio Update ---
    if (engineGainRef.current && engineOscRef.current && audioContextRef.current) {
        // Arcade Logic: Linear attenuation
        const maxDist = 600;
        const volume = Math.max(0, 1 - distToPlayer / maxDist) * 0.1; 
        
        // Doppler-ish effect (Halved base pitch to 5)
        const pitch = 5 + (speed.current / 10) + (volume * 10);

        engineGainRef.current.gain.setTargetAtTime(volume, audioContextRef.current.currentTime, 0.1);
        engineOscRef.current.frequency.setTargetAtTime(pitch, audioContextRef.current.currentTime, 0.1);
    }

    // 1. Determine State
    // Ace Evasion Override
    if (difficulty === 'ace' && state.current === 'EVADE') {
        if (time > evasionEndTime.current) {
            state.current = 'ATTACK'; // Return to attack after evasion
        }
    } else if (time > nextDecisionTime.current) {
        // Standard State Machine
        if (distToPlayer < stats.aggressionDist && Math.random() < stats.attackChance) {
            state.current = 'ATTACK';
        } else {
            state.current = 'PATROL';
        }
        
        // Ace Difficulty: Random Evasion Check during Combat
        // If we are close and being chased (simplified by checking if player is looking at us roughly), EVADE
        if (difficulty === 'ace' && distToPlayer < 400 && Math.random() > 0.6) {
             state.current = 'EVADE';
             evasionEndTime.current = time + 1.0 + Math.random(); // Evade for 1-2 seconds
        }

        // Increased decision time
        nextDecisionTime.current = time + 2.0 + Math.random() * 2.0; 
    }

    // 2. Determine Target Direction
    const targetDir = new Vector3();
    
    if (state.current === 'EVADE') {
        // Fly perpendicular to player + random up/down
        const toPlayer = new Vector3().subVectors(playerPos, position.current).normalize();
        const up = new Vector3(0, 1, 0);
        const right = new Vector3().crossVectors(toPlayer, up).normalize();
        if (Math.random() > 0.5) right.negate();
        
        targetDir.copy(right).add(new Vector3(0, (Math.random()-0.5)*2, 0)).normalize();
        
    } else if (state.current === 'ATTACK') {
        targetDir.subVectors(playerPos, position.current).normalize();
    } else {
        const patrolCenter = new Vector3(...startPosition);
        // Use seed to offset phase
        const phase = seed.current;
        patrolCenter.x += Math.sin(time * 0.15 + phase) * 400; // Slower patrol weave
        patrolCenter.z += Math.cos(time * 0.15 + phase) * 400;
        targetDir.subVectors(patrolCenter, position.current).normalize();
    }

    // 3. Turn towards target
    const currentForward = new Vector3(0, 0, -1).applyQuaternion(quaternion.current);
    const targetQuat = new Quaternion().setFromUnitVectors(new Vector3(0, 0, -1), targetDir);
    
    // Ace turns faster during evasion
    const effectiveTurnSpeed = state.current === 'EVADE' ? stats.turnSpeed * 1.5 : stats.turnSpeed;
    quaternion.current.slerp(targetQuat, effectiveTurnSpeed * dt);

    // 4. Move Forward
    const forward = new Vector3(0, 0, -1).applyQuaternion(quaternion.current);
    position.current.add(forward.clone().multiplyScalar(speed.current * dt));

    // 5. Apply Transforms
    groupRef.current.position.copy(position.current);
    groupRef.current.quaternion.copy(quaternion.current);

    // --- Shooting Logic ---
    // Only shoot in Attack mode (or Ace Evade mode if lucky)
    if ((state.current === 'ATTACK' || (difficulty === 'ace' && state.current === 'EVADE')) && distToPlayer < 400) {
        const angle = currentForward.angleTo(targetDir);
        // Aces have wider firing angle tolerance (snap shooting)
        const angleTol = difficulty === 'ace' ? 0.35 : 0.2;
        
        if (angle < angleTol) { 
            if (time - lastShotTime.current > stats.fireRate) { 
                const bullet = bullets.find(b => !b.active);
                if (bullet) {
                    bullet.active = true;
                    bullet.life = 1.5;
                    bullet.position.copy(position.current);
                    // Bullet speed matches aggression
                    const bulletSpeedBonus = difficulty === 'ace' ? 250 : 150;
                    bullet.velocity.copy(forward).multiplyScalar(speed.current + bulletSpeedBonus);
                    
                    // Accuracy spread (Aces are more accurate)
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

            // Hit Check against Player
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
