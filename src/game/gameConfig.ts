import type { Difficulty, StrategyMode, TyreType } from '../types/race';

export const GAME_CONFIG = {
  fixedStep: 1 / 30,
  maxFrameDelta: 0.25,
  gridGapMetres: 12,
  trafficRangeMetres: 38,
  trafficSpeedPenalty: 0.955,
  collisionDistanceMetres: 16,
  collisionLaneDistance: 20,
  maximumLaneOffset: 17,
  collisionCooldown: 0.75,
  pitStopBaseDuration: 7.2,
  pitStopVariation: 1.2,
  aiReactionInterval: 2.5,
  tyreCliff: 0.18,
  minimumTyrePerformance: 0.72,
  playerColors: ['#ff334f', '#20d7ff'],
  aiColors: ['#f7c948', '#9d7bff', '#42d392', '#ff8a3d', '#f15bb5', '#00bbf9', '#b8de6f', '#d4a373'],
} as const;

export const TYRES: Record<TyreType, { label: string; speed: number; wear: number; color: string }> = {
  soft: { label: 'Macio', speed: 1.024, wear: 1.38, color: '#ff4058' },
  medium: { label: 'Médio', speed: 1, wear: 1, color: '#ffd23f' },
  hard: { label: 'Duro', speed: 0.982, wear: 0.7, color: '#e8ecf1' },
};

export const STRATEGIES: Record<StrategyMode, { label: string; speed: number; wear: number }> = {
  conserve: { label: 'Conservar', speed: 0.974, wear: 0.68 },
  normal: { label: 'Normal', speed: 1, wear: 1 },
  attack: { label: 'Atacar', speed: 1.027, wear: 1.42 },
};

export const DIFFICULTY: Record<Difficulty, { label: string; skillMin: number; skillMax: number; consistency: number }> = {
  easy: { label: 'Fácil', skillMin: 0.66, skillMax: 0.83, consistency: 0.82 },
  normal: { label: 'Normal', skillMin: 0.74, skillMax: 0.91, consistency: 0.9 },
  hard: { label: 'Difícil', skillMin: 0.82, skillMax: 0.97, consistency: 0.96 },
};
