export type TyreType = 'soft' | 'medium' | 'hard';
export type StrategyMode = 'conserve' | 'normal' | 'attack';
export type Difficulty = 'easy' | 'normal' | 'hard';
export type SimulationSpeed = 0 | 1 | 2 | 4;
export type RacePhase = 'ready' | 'running' | 'paused' | 'finished';

export interface Point {
  x: number;
  y: number;
}

export interface Track {
  id: string;
  name: string;
  location: string;
  description: string;
  length: number;
  corners: number;
  difficulty: number;
  averageSpeed: number;
  tyreWear: number;
  overtakeChance: number;
  accent: string;
  points: Point[];
}

export interface PlayerCarSettings {
  number: number;
  tyre: TyreType;
}

export interface RaceSettings {
  trackId: string;
  laps: number;
  competitors: number;
  difficulty: Difficulty;
  playerCars: [PlayerCarSettings, PlayerCarSettings];
}

export interface Driver {
  name: string;
  skill: number;
  aggression: number;
  consistency: number;
}

export interface LapData {
  lap: number;
  time: number;
  tyre: TyreType;
}

export interface PitStop {
  lap: number;
  duration: number;
  fromTyre: TyreType;
  toTyre: TyreType;
}

export interface CarState {
  id: string;
  number: number;
  name: string;
  color: string;
  isPlayer: boolean;
  driver: Driver;
  speed: number;
  baseSpeed: number;
  acceleration: number;
  fuelEfficiency: number;
  condition: number;
  tyreType: TyreType;
  tyreCondition: number;
  tyreWearRate: number;
  strategyMode: StrategyMode;
  distance: number;
  lap: number;
  position: number;
  currentLapTime: number;
  lastLapTime: number | null;
  bestLapTime: number | null;
  totalTime: number;
  finishTime: number | null;
  finished: boolean;
  laneOffset: number;
  targetLaneOffset: number;
  pendingPitTyre: TyreType | null;
  pitTimeRemaining: number;
  pitStops: PitStop[];
  laps: LapData[];
  aiDecisionTimer: number;
  variationPhase: number;
}

export interface RaceState {
  phase: RacePhase;
  elapsedTime: number;
  simulationSpeed: SimulationSpeed;
  totalLaps: number;
  cars: CarState[];
  eventMessage: string;
  eventMessageUntil: number;
}
