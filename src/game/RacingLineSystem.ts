import { GAME_CONFIG, STRATEGIES } from './gameConfig';
import type { CarState, Track } from '../types/race';

const MAXIMUM_LANE_OFFSET = GAME_CONFIG.maximumLaneOffset ?? 17;

export function calculateRacingLine(car: CarState, track: Track): number {
  const progress = ((car.distance / track.length) % 1 + 1) % 1;
  const angle = progress * Math.PI * 2;
  const sectionFrequency = Math.max(2, Math.round(track.corners / 4));
  const strategyAmplitude = STRATEGIES[car.strategyMode].wear;
  const lapVariation = car.lap * (0.42 + car.driver.aggression * 0.31);
  const primaryLine = Math.sin(angle * sectionFrequency + car.variationPhase + lapVariation) * 4.2;
  const correction = Math.sin(angle * (sectionFrequency + 1.5) - car.variationPhase * 0.7 + lapVariation * 0.35) * 2.4;
  const driverBias = (car.driver.aggression - 0.75) * 7;
  const imperfectLine = (1 - car.driver.skill) * Math.sin(angle * 7 + car.variationPhase * 2 + car.lap) * 5;
  const line = (primaryLine + correction) * Math.min(1.3, 0.72 + strategyAmplitude * 0.35) + driverBias + imperfectLine;
  return Math.max(-MAXIMUM_LANE_OFFSET, Math.min(MAXIMUM_LANE_OFFSET, line));
}
