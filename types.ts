import { ThreeElements } from '@react-three/fiber';

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

declare global {
  namespace JSX {
    interface IntrinsicElements extends ThreeElements {
        primitive: any;
    }
  }
}