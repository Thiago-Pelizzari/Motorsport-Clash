export type TyreType = 'soft' | 'medium' | 'hard' | 'intermediate' | 'wet';
export type StrategyMode = 'conserve' | 'normal' | 'attack';
export type Difficulty = 'easy' | 'normal' | 'hard';
export type SimulationSpeed = 0 | 1 | 2 | 4;
export type RacePhase = 'ready' | 'running' | 'paused' | 'finished';
export type WeatherCondition = 'dry' | 'overcast' | 'light_rain' | 'heavy_rain';
export type WeatherPreset = 'clear' | 'changeable' | 'wet' | 'random';
export type QualifyingMode = 'front_row' | 'simulated' | 'random' | 'reverse';
export type TrackFlag = 'green' | 'yellow' | 'vsc' | 'sc';
export type PitState = 'none' | 'entering' | 'stationary' | 'exiting';
export type DriverArchetype = 'balanced' | 'aggressive' | 'tyre_whisperer' | 'rain_master' | 'calculated';
export type TrackBlockType =
  | 'straight'
  | 'short'
  | 'left45'
  | 'right45'
  | 'left90'
  | 'right90'
  | 'chicaneLeft'
  | 'chicaneRight'
  | 'hairpinLeft'
  | 'hairpinRight'
  | 'sCurve';

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
  source?: 'classic' | 'blocks' | 'custom';
  blocks?: TrackBlockType[];
}

export interface PlayerCarSettings {
  number: number;
  tyre: TyreType;
  driverName?: string;
}

export interface RaceSettings {
  trackId: string;
  laps: number;
  competitors: number;
  difficulty: Difficulty;
  playerCars: [PlayerCarSettings, PlayerCarSettings];
  teamName?: string;
  weatherPreset?: WeatherPreset;
  qualifyingMode?: QualifyingMode;
}

export interface Driver {
  name: string;
  skill: number;
  aggression: number;
  consistency: number;
  wetSkill?: number;
  tyreManagement?: number;
  archetype?: DriverArchetype;
}

export interface LapData {
  lap: number;
  time: number;
  tyre: TyreType;
  position?: number;
  sectors?: [number, number, number];
}

export interface PitStop {
  lap: number;
  duration: number;
  fromTyre: TyreType;
  toTyre: TyreType;
  repaired?: boolean;
}

export interface RaceEventLog {
  id: string;
  time: number;
  lap: number;
  message: string;
  type: 'info' | 'pit' | 'overtake' | 'incident' | 'weather' | 'fastest_lap' | 'flag';
}

export interface WeatherState {
  condition: WeatherCondition;
  trackWetness: number;
  rainIntensity: number;
  ambientTemp: number;
  trackTemp: number;
  forecast: WeatherCondition[];
  nextChangeTimer: number;
}

export interface CarState {
  id: string;
  number: number;
  name: string;
  teamName: string;
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
  tyreTemperature: number;
  fuelLoad: number;
  maxFuelLoad: number;
  ersCharge: number;
  ersDeploy: boolean;
  inSlipstream: boolean;
  inDirtyAir: boolean;
  strategyMode: StrategyMode;
  distance: number;
  lap: number;
  position: number;
  gridPosition: number;
  currentLapTime: number;
  lastLapTime: number | null;
  bestLapTime: number | null;
  totalTime: number;
  finishTime: number | null;
  finished: boolean;
  laneOffset: number;
  targetLaneOffset: number;
  pitState: PitState;
  pendingPitTyre: TyreType | null;
  pendingPitRepair: boolean;
  pitTimeRemaining: number;
  pitStops: PitStop[];
  laps: LapData[];
  currentSector: 0 | 1 | 2;
  sectorStartTime: number;
  sectorTimes: [number, number, number];
  bestSectorTimes: [number | null, number | null, number | null];
  positionHistory: number[];
  overtakesMade: number;
  qualifyingTime: number | null;
  aiDecisionTimer: number;
  variationPhase: number;
  collisionCooldown: number;
  contactCount: number;
}

export interface RaceState {
  phase: RacePhase;
  elapsedTime: number;
  simulationSpeed: SimulationSpeed;
  totalLaps: number;
  cars: CarState[];
  eventMessage: string;
  eventMessageUntil: number;
  flag: TrackFlag;
  flagTimer: number;
  weather: WeatherState;
  fastestLapCarId: string | null;
  fastestLapTime: number | null;
  bestSectors: [number | null, number | null, number | null];
  eventLog: RaceEventLog[];
}

export interface ChampionshipStandingsEntry {
  driverName: string;
  carNumber: number;
  teamName: string;
  color: string;
  isPlayer: boolean;
  points: number;
  wins: number;
  podiums: number;
  fastestLaps: number;
}

export interface ChampionshipState {
  id: string;
  name: string;
  difficulty: Difficulty;
  competitors: number;
  currentRound: number;
  rounds: {
    trackId: string;
    laps: number;
    weatherPreset: WeatherPreset;
    completed: boolean;
    winnerName?: string;
  }[];
  standings: ChampionshipStandingsEntry[];
  playerTeamName: string;
  playerCars: [PlayerCarSettings, PlayerCarSettings];
}
