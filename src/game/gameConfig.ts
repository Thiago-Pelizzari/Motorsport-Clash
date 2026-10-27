import type { Difficulty, QualifyingMode, StrategyMode, TrackFlag, TyreType, WeatherCondition, WeatherPreset } from '../types/race';

export const GAME_CONFIG = {
  fixedStep: 1 / 30,
  maxFrameDelta: 0.25,
  gridGapMetres: 12,
  trafficRangeMetres: 38,
  trafficSpeedPenalty: 0.955,
  slipstreamRangeMetres: 44,
  slipstreamBonus: 1.028,
  dirtyAirPenalty: 0.978,
  collisionDistanceMetres: 16,
  collisionLaneDistance: 20,
  maximumLaneOffset: 17,
  pitLaneOffset: 24,
  pitEntryDistanceBeforeLine: 110,
  pitExitDistanceAfterLine: 85,
  pitLaneSpeedLimit: 80,
  collisionCooldown: 0.75,
  pitStopBaseDuration: 6.2,
  pitStopVariation: 1.1,
  pitRepairDuration: 2.8,
  aiReactionInterval: 2.2,
  tyreCliff: 0.18,
  minimumTyrePerformance: 0.72,
  fuelPerLapKg: 1.65,
  fuelWeightPenaltyPerKg: 0.0012,
  ersDrainPerSecond: 0.16,
  ersChargePerSecond: 0.065,
  ersSpeedBonus: 1.038,
  playerColors: ['#ff334f', '#20d7ff'],
  aiColors: ['#f7c948', '#9d7bff', '#42d392', '#ff8a3d', '#f15bb5', '#00bbf9', '#b8de6f', '#d4a373', '#ff5964'],
} as const;

export interface TyreCompoundConfig {
  label: string;
  shortLabel: string;
  speed: number;
  wear: number;
  color: string;
  optimalWetnessMin: number;
  optimalWetnessMax: number;
  warmupRate: number;
}

export const TYRES: Record<TyreType, TyreCompoundConfig> = {
  soft: {
    label: 'Macio',
    shortLabel: 'S',
    speed: 1.026,
    wear: 1.38,
    color: '#ff4058',
    optimalWetnessMin: 0,
    optimalWetnessMax: 0.2,
    warmupRate: 1.35,
  },
  medium: {
    label: 'Médio',
    shortLabel: 'M',
    speed: 1,
    wear: 1,
    color: '#ffd23f',
    optimalWetnessMin: 0,
    optimalWetnessMax: 0.24,
    warmupRate: 1,
  },
  hard: {
    label: 'Duro',
    shortLabel: 'H',
    speed: 0.982,
    wear: 0.68,
    color: '#e8ecf1',
    optimalWetnessMin: 0,
    optimalWetnessMax: 0.26,
    warmupRate: 0.78,
  },
  intermediate: {
    label: 'Intermediário',
    shortLabel: 'I',
    speed: 0.965,
    wear: 1.1,
    color: '#38d39f',
    optimalWetnessMin: 0.2,
    optimalWetnessMax: 0.68,
    warmupRate: 1.2,
  },
  wet: {
    label: 'Chuva',
    shortLabel: 'W',
    speed: 0.93,
    wear: 1.25,
    color: '#2898ff',
    optimalWetnessMin: 0.52,
    optimalWetnessMax: 1.0,
    warmupRate: 1.3,
  },
};

export const STRATEGIES: Record<StrategyMode, { label: string; speed: number; wear: number; fuel: number }> = {
  conserve: { label: 'Conservar', speed: 0.974, wear: 0.68, fuel: 0.85 },
  normal: { label: 'Normal', speed: 1, wear: 1, fuel: 1 },
  attack: { label: 'Atacar', speed: 1.028, wear: 1.42, fuel: 1.2 },
};

export const DIFFICULTY: Record<Difficulty, { label: string; skillMin: number; skillMax: number; consistency: number }> = {
  easy: { label: 'Fácil', skillMin: 0.66, skillMax: 0.83, consistency: 0.82 },
  normal: { label: 'Normal', skillMin: 0.75, skillMax: 0.92, consistency: 0.9 },
  hard: { label: 'Difícil', skillMin: 0.84, skillMax: 0.98, consistency: 0.96 },
};

export const WEATHER_LABELS: Record<WeatherCondition, { label: string; icon: string }> = {
  dry: { label: 'Pista Seca', icon: '☀' },
  overcast: { label: 'Nublado', icon: '☁' },
  light_rain: { label: 'Chuva Leve', icon: '🌦' },
  heavy_rain: { label: 'Tempestade', icon: '⛈' },
};

export const WEATHER_PRESETS: Record<WeatherPreset, { label: string; description: string }> = {
  clear: { label: 'Céu Limpo', description: 'Asfalto seco garantido' },
  changeable: { label: 'Instável', description: 'Risco real de chuva durante a prova' },
  wet: { label: 'Chuvoso', description: 'Largada em pista molhada' },
  random: { label: ' Imprevisível', description: 'Clima sorteado a cada etapa' },
};

export const QUALIFYING_MODES: Record<QualifyingMode, { label: string; description: string }> = {
  simulated: { label: 'Classificação', description: 'Grid definido por volta rápida simulada' },
  front_row: { label: 'Primeira Fila', description: 'Seus carros largam em P1 e P2' },
  random: { label: 'Grid Sorteado', description: 'Ordem de largada embaralhada' },
  reverse: { label: 'Desafio do Fundo', description: 'Seus carros largam nas últimas posições' },
};

export const FLAG_CONFIG: Record<TrackFlag, { label: string; color: string; speedMultiplier: number }> = {
  green: { label: 'PISTA LIVRE', color: '#38d39f', speedMultiplier: 1 },
  yellow: { label: 'BANDEIRA AMARELA', color: '#ffd23f', speedMultiplier: 0.82 },
  vsc: { label: 'VSC ATIVO', color: '#ff9233', speedMultiplier: 0.68 },
  sc: { label: 'SAFETY CAR', color: '#ff334f', speedMultiplier: 0.56 },
};

export const CHAMPIONSHIP_POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1] as const;
export const FASTEST_LAP_POINT = 1;
