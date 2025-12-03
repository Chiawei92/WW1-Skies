
import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface PlaneModelProps {
  color: string;
  propSpeed: number;
}

const PlaneModel: React.FC<PlaneModelProps> = ({ color, propSpeed }) => {
  const propellerRef = useRef<THREE.Group>(null);

  // Helper to determine secondary wing color based on primary color
  const getSecondaryColor = (primary: string) => {
    if (primary === '#8B0000') return '#cc0000'; // Red -> Light Red
    if (primary === '#1e88e5') return '#1565c0'; // Blue -> Darker Blue
    return '#2e7d32'; // Green (default)
  };

  const secondaryColor = getSecondaryColor(color);

  useFrame((state, delta) => {
    if (propellerRef.current) {
      // Increased rotation multiplier from 25 to 30 for faster visual spin
      propellerRef.current.rotation.z += propSpeed * 30 * delta;
    }
  });

  return (
    <group>
      {/* Model Visualization */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[1, 1, 4]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* Wings */}
      <group>
        <mesh position={[0, -0.2, -0.5]} castShadow receiveShadow>
          <boxGeometry args={[9, 0.1, 1.8]} />
          <meshStandardMaterial color={secondaryColor} />
        </mesh>
        <group position={[0, 1.4, -0.5]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[9, 0.1, 1.8]} />
            <meshStandardMaterial color={secondaryColor} />
          </mesh>
        </group>
        <mesh position={[-3, 0.6, -0.5]}>
          <cylinderGeometry args={[0.05, 0.05, 1.6]} />
          <meshStandardMaterial color="#555" />
        </mesh>
        <mesh position={[3, 0.6, -0.5]}>
          <cylinderGeometry args={[0.05, 0.05, 1.6]} />
          <meshStandardMaterial color="#555" />
        </mesh>
      </group>
      {/* Tail */}
      <group position={[0, 0, 2]}>
        <mesh position={[0, 0.5, 1]}>
          <boxGeometry args={[0.2, 1.5, 1.5]} />
          <meshStandardMaterial color={secondaryColor} />
        </mesh>
        <mesh position={[0, 0.2, 1]}>
          <boxGeometry args={[3, 0.1, 1.2]} />
          <meshStandardMaterial color={secondaryColor} />
        </mesh>
      </group>
      {/* Propeller - Fixed to 2 Blades (Single Mesh) */}
      <group position={[0, 0, -2.1]} ref={propellerRef}>
        <mesh>
          <boxGeometry args={[2.8, 0.1, 0.05]} />
          <meshStandardMaterial color="#AA8855" />
        </mesh>
      </group>
      {/* Gear */}
      <group position={[0, -0.8, -1]}>
        <mesh position={[-0.6, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.3, 0.3, 0.2]} />
          <meshStandardMaterial color="#111" />
        </mesh>
        <mesh position={[0.6, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.3, 0.3, 0.2]} />
          <meshStandardMaterial color="#111" />
        </mesh>
      </group>
    </group>
  );
};

export default PlaneModel;
