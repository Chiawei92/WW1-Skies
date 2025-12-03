import React from 'react';

export interface GameState {
  speed: number;
  altitude: number;
  heading: number;
}

export interface PlaneControls {
  pitch: number; // -1 to 1
  roll: number; // -1 to 1
  throttle: number; // 0 to 1
}

export interface Enemy {
  id: number;
  position: [number, number, number];
  color: string;
  hp: number;
  maxHp: number;
}

export type Difficulty = 'rookie' | 'veteran' | 'ace';

export interface MobileInputState {
    stickX: number; // -1 to 1
    stickY: number; // -1 to 1
    throttle: number; // 0 to 1
    firing: boolean;
}

// Augment React module for React 18+ / strict module resolution
declare module 'react' {
    namespace JSX {
        interface IntrinsicElements {
            primitive: any;
            group: any;
            mesh: any;
            instancedMesh: any;
            ambientLight: any;
            directionalLight: any;
            pointLight: any;
            spotLight: any;
            fog: any;
            sphereGeometry: any;
            meshStandardMaterial: any;
            meshBasicMaterial: any;
            boxGeometry: any;
            planeGeometry: any;
            coneGeometry: any;
            cylinderGeometry: any;
            color: any;
        }
    }
}

// Augment global namespace for standard setups
declare global {
  namespace JSX {
    interface IntrinsicElements {
        primitive: any;
        group: any;
        mesh: any;
        instancedMesh: any;
        ambientLight: any;
        directionalLight: any;
        pointLight: any;
        spotLight: any;
        fog: any;
        sphereGeometry: any;
        meshStandardMaterial: any;
        meshBasicMaterial: any;
        boxGeometry: any;
        planeGeometry: any;
        coneGeometry: any;
        cylinderGeometry: any;
        color: any;
    }
  }
}
