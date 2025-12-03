
import React, { useMemo } from 'react';
import * as THREE from 'three';
import { Instance, Instances } from '@react-three/drei';

const Terrain: React.FC = () => {
  
  // 1. Procedural Terraced Terrain Generation
  const terrainGeometry = useMemo(() => {
      // Large plane for the ground
      const geom = new THREE.PlaneGeometry(4000, 4000, 128, 128);
      const posAttribute = geom.attributes.position;
      
      // Constants for terrain generation
      const SCALE = 400;     // How wide hills are
      const HEIGHT = 150;    // Max height
      const STEPS = 15;      // Height of each terrace step
      
      for (let i = 0; i < posAttribute.count; i++) {
          const x = posAttribute.getX(i);
          const y = posAttribute.getY(i); // Plane is created on XY, we rotate it later. So Y here corresponds to World Z.
          
          // Runway safety zone: Flatten area around the runway (Z from -500 to +1700 approx)
          // Runway is at x=0, z=-500, length 2200. z range approx -1600 to +600
          if (Math.abs(x) < 200 && y > -1700 && y < 700) {
              posAttribute.setZ(i, 0); // Flat ground
              continue;
          }

          // Generate noise-like waves
          const rawHeight = (Math.sin(x / SCALE) + Math.cos(y / (SCALE * 0.8))) * HEIGHT;
          
          // Apply Terracing (Stepping)
          // Floor the height to nearest step
          let terracedHeight = Math.floor(Math.max(0, rawHeight) / STEPS) * STEPS;
          
          posAttribute.setZ(i, terracedHeight);
      }
      
      geom.computeVertexNormals();
      return geom;
  }, []);

  // 2. Clustered Tree Generation Algorithm
  const treeData = useMemo(() => {
      const data = [];
      const clusters = 40;
      
      for(let i=0; i<clusters; i++) {
          // Random cluster center
          const cx = (Math.random() - 0.5) * 3500;
          const cz = (Math.random() - 0.5) * 3500;
          
          // Safety check for runway
          if (Math.abs(cx) < 250 && cz > -1800 && cz < 800) continue;

          // Trees per cluster
          const treesInCluster = 20 + Math.floor(Math.random() * 30);
          
          for(let j=0; j<treesInCluster; j++) {
              const angle = Math.random() * Math.PI * 2;
              const dist = Math.random() * 80; // Radius of forest patch
              const tx = cx + Math.cos(angle) * dist;
              const tz = cz + Math.sin(angle) * dist;
              
              // Calculate terrain height at this position to place tree on ground
              // Approximate logic matching the terrain gen above
              const SCALE = 400;
              const HEIGHT = 150;
              const STEPS = 15;
              const rawHeight = (Math.sin(tx / SCALE) + Math.cos(tz / (SCALE * 0.8))) * HEIGHT;
              const terracedHeight = Math.floor(Math.max(0, rawHeight) / STEPS) * STEPS;

              data.push({ 
                  position: [tx, terracedHeight, tz], 
                  scale: 3 + Math.random() * 3 
              });
          }
      }
      return data;
  }, []);

  return (
    <group>
      {/* Terraced Ground Mesh */}
      <mesh rotation={[-Math.PI/2, 0, 0]} receiveShadow geometry={terrainGeometry}>
          <meshStandardMaterial color="#556b2f" flatShading roughness={1} />
      </mesh>

      {/* Dirt Runway - WWI Style */}
      <group position={[0, 0.2, -500]}>
          <mesh rotation={[-Math.PI/2, 0, 0]} receiveShadow>
              <planeGeometry args={[60, 2200]} />
              <meshStandardMaterial color="#8d7e61" roughness={1} />
          </mesh>
      </group>

      {/* Trees */}
      <Instances range={treeData.length}>
        <coneGeometry args={[2, 8, 8]} />
        <meshStandardMaterial color="#1a3300" flatShading />
        {treeData.map((data, i) => (
          <Instance
            key={i}
            position={new THREE.Vector3(data.position[0], data.position[1] + 4, data.position[2])}
            scale={[data.scale, data.scale, data.scale]}
          />
        ))}
      </Instances>
       <Instances range={treeData.length}>
        <cylinderGeometry args={[0.5, 0.8, 3]} />
        <meshStandardMaterial color="#3e2723" flatShading />
        {treeData.map((data, i) => (
          <Instance
            key={i}
            position={new THREE.Vector3(data.position[0], data.position[1], data.position[2])}
            scale={[data.scale, data.scale, data.scale]}
          />
        ))}
      </Instances>
    </group>
  );
};

export default Terrain;
