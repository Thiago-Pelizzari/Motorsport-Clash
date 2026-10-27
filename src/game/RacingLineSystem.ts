import { GAME_CONFIG, STRATEGIES } from './gameConfig';
import { TrackGeometry } from './TrackGeometry';
import type { CarState, Track } from '../types/race';

const MAXIMUM_LANE_OFFSET = GAME_CONFIG.maximumLaneOffset ?? 17;
const geometryCache = new WeakMap<Track, TrackGeometry>();

export function getCachedTrackGeometry(track: Track): TrackGeometry {
  let geometry = geometryCache.get(track);
  if (!geometry) {
    geometry = new TrackGeometry(track);
    geometryCache.set(track, geometry);
  }
  return geometry;
}

export function calculateRacingLine(car: CarState, track: Track): number {
  const progress = ((car.distance / track.length) % 1 + 1) % 1;
  const geometry = getCachedTrackGeometry(track);

  // Curvature at entry (ahead), apex (current), and exit (behind)
  const curvAtApex = geometry.curvatureAt(progress);
  const curvAhead = geometry.curvatureAt(progress + 0.028);
  // Out-in-out racing line: move toward inside at apex, wide before entry
  const apexHug = curvAtApex * 11.5;
  const entrySetup = -curvAhead * 5.2;

  const angle = progress * Math.PI * 2;
  const sectionFrequency = Math.max(2, Math.round(track.corners / 4));
  const strategyAmplitude = STRATEGIES[car.strategyMode].wear;
  const lapVariation = car.lap * (0.42 + car.driver.aggression * 0.31);
  const primaryLine = Math.sin(angle * sectionFrequency + car.variationPhase + lapVariation) * 3.2;
  const correction = Math.sin(angle * (sectionFrequency + 1.5) - car.variationPhase * 0.7 + lapVariation * 0.35) * 1.8;
  const driverBias = (car.driver.aggression - 0.75) * 5.5;
  const imperfectLine = (1 - car.driver.skill) * Math.sin(angle * 7 + car.variationPhase * 2 + car.lap) * 4.5;

  const line = apexHug + entrySetup + (primaryLine + correction) * Math.min(1.3, 0.72 + strategyAmplitude * 0.35) + driverBias + imperfectLine;
  return Math.max(-MAXIMUM_LANE_OFFSET, Math.min(MAXIMUM_LANE_OFFSET, line));
}
