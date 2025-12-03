
import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Vector3, Quaternion } from 'three';
import PlaneModel from './PlaneModel';
import { Enemy } from '../types';

interface AllyPlaneProps {
  startPosition: [number, number, number];
  playerSpeed: number;
  enemies: Enemy[];
  enemyPositionsRef: React.MutableRefObject<{ [id: number]: THREE.Vector3 }>;
  onEnemyHit: (id: number, hitPos?: Vector3) => void;
  paused: boolean;
  allyIndex: number;
}

const MAX_BULLETS = 20;
// Reduced to 43 (approx 80km/h) to match player
const MAX_SPEED = 43; 

const AllyPlane: React.FC<AllyPlaneProps> = ({ startPosition, playerSpeed, enemies, enemyPositionsRef, onEnemyHit, paused, allyIndex }) => {
  const groupRef = useRef<THREE.Group>(null);
  const bulletMeshRef = useRef<THREE.InstancedMesh>(null);
  
  // physics state
  const position = useRef(new Vector3(...startPosition));
  const quaternion = useRef(new Quaternion());
  const speed = useRef(0);
  
  // AI state
  const state = useRef<'WAIT' | 'TAKEOFF' | 'COMBAT'>('WAIT');
  const turnSpeed = 0.4; 
  
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

  useEffect(() => {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      audioContextRef.current = ctx;

      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = 12.5; // Reduced from 25

      const gain = ctx.createGain();
      gain.gain.value = 0;

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();

      engineOscRef.current = osc;
      engineGainRef.current = gain;

      const bufferSize = ctx.sampleRate * 0.5;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) { data[i] = Math.random() * 2 - 1; }
      noiseBufferRef.current = buffer;

      return () => { try { ctx.close(); } catch(e) {} };
  }, []);

  useEffect(() => {
      if(audioContextRef.current) {
          if (paused) audioContextRef.current.suspend();
          else audioContextRef.current.resume();
      }
  }, [paused]);

  const playGunshot = () => {
     if (paused || !audioContextRef.current || !noiseBufferRef.current) return;
     const ctx = audioContextRef.current;
     const source = ctx.createBufferSource();
     source.buffer = noiseBufferRef.current;
     const filter = ctx.createBiquadFilter();
     filter.type = 'lowpass';
     filter.frequency.value = 800;
     const gain = ctx.createGain();
     gain.gain.setValueAtTime(0.05, ctx.currentTime);
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

    // --- State Logic ---
    if (state.current === 'WAIT') {
        if (playerSpeed > 5) { // Lower threshold to start
            state.current = 'TAKEOFF';
        }
    } else if (state.current === 'TAKEOFF') {
        // Reduced acceleration again to match player (4 -> 1.5)
        speed.current += 1.5 * dt; 
        if (speed.current > MAX_SPEED) speed.current = MAX_SPEED;
        
        // Move Forward
        const forward = new Vector3(0, 0, -1).applyQuaternion(quaternion.current);
        position.current.add(forward.clone().multiplyScalar(speed.current * dt));

        // Gradual Pitch Up Logic
        const takeoffProgress = THREE.MathUtils.clamp((speed.current - 20) / 23, 0, 1);
        const targetPitch = takeoffProgress * THREE.MathUtils.degToRad(20);
        
        const currentQ = quaternion.current.clone();
        const targetQ = new Quaternion().setFromEuler(new THREE.Euler(targetPitch, 0, 0));
        quaternion.current.slerp(targetQ, dt * 1.0);
        
        // Transition to Combat
        if (position.current.y > 20) {
            state.current = 'COMBAT';
        }
    } else if (state.current === 'COMBAT') {
        
        // --- Target Selection Strategy ---
        const validEnemies = enemies
            .filter(e => enemyPositionsRef.current[e.id] !== undefined)
            .map(e => {
                const pos = enemyPositionsRef.current[e.id];
                return {
                    id: e.id,
                    pos: pos,
                    dist: position.current.distanceTo(pos)
                }
            })
            .sort((a, b) => a.dist - b.dist);

        let targetPos: Vector3 | null = null;
        let distToTarget = Infinity;

        if (validEnemies.length > 0) {
            let targetData;
            if (allyIndex === 0) {
                targetData = validEnemies[0];
            } else {
                targetData = validEnemies[validEnemies.length - 1];
            }
            
            if (targetData) {
                targetPos = targetData.pos;
                distToTarget = targetData.dist;
            }
        }

        const targetDir = new Vector3();
        if (targetPos) {
            targetDir.subVectors(targetPos, position.current).normalize();
        } else {
            // Patrol if no enemies
            const patrolCenter = new Vector3(...startPosition);
            patrolCenter.y = 100;
            patrolCenter.x += Math.sin(time * 0.2) * 500;
            patrolCenter.z += Math.cos(time * 0.2) * 500;
            targetDir.subVectors(patrolCenter, position.current).normalize();
        }

        const currentForward = new Vector3(0, 0, -1).applyQuaternion(quaternion.current);
        const targetQuat = new Quaternion().setFromUnitVectors(new Vector3(0, 0, -1), targetDir);
        quaternion.current.slerp(targetQuat, turnSpeed * dt);

        const forward = new Vector3(0, 0, -1).applyQuaternion(quaternion.current);
        position.current.add(forward.clone().multiplyScalar(speed.current * dt));

        // Shoot at enemy
        if (targetPos && distToTarget < 400) {
             const angle = currentForward.angleTo(targetDir);
             if (angle < 0.3 && time - lastShotTime.current > 0.25) {
                 const bullet = bullets.find(b => !b.active);
                 if (bullet) {
                     bullet.active = true;
                     bullet.life = 1.5;
                     bullet.position.copy(position.current);
                     bullet.velocity.copy(forward).multiplyScalar(speed.current + 150);
                     bullet.velocity.x += (Math.random() - 0.5) * 2;
                     bullet.velocity.y += (Math.random() - 0.5) * 2;
                     
                     lastShotTime.current = time;
                     playGunshot();
                 }
             }
        }
    }

    // Apply Transforms
    groupRef.current.position.copy(position.current);
    groupRef.current.quaternion.copy(quaternion.current);
    
    // Update Audio
    if (engineGainRef.current && engineOscRef.current && audioContextRef.current) {
        engineGainRef.current.gain.setTargetAtTime(0.02, audioContextRef.current.currentTime, 0.1);
        // Reduced frequency calc (base 15 instead of 30)
        engineOscRef.current.frequency.setTargetAtTime(15 + speed.current, audioContextRef.current.currentTime, 0.1);
    }

    // Bullet Physics
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
            
            // Check Collision against enemies
            for(const enemy of enemies) {
                const ePos = enemyPositionsRef.current[enemy.id];
                if (ePos && b.position.distanceToSquared(ePos) < 16) { // Use closer Hitbox like player
                    b.active = false;
                    onEnemyHit(enemy.id, ePos);
                }
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
             <PlaneModel color="#1e88e5" propSpeed={speed.current / 100} />
        </group>
        <instancedMesh ref={bulletMeshRef} args={[undefined, undefined, MAX_BULLETS]} frustumCulled={false}>
            <boxGeometry args={[0.2, 0.2, 3]} />
            <meshBasicMaterial color="#ffff00" toneMapped={false} />
        </instancedMesh>
    </>
  );
};

export default AllyPlane;
