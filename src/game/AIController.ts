import { GAME_CONFIG } from './gameConfig';
import type { CarState, Track, TyreType } from '../types/race';
import { SeededRandom } from '../utils/random';

function tyreForDistance(lapsRemaining: number, track: Track): TyreType {
  const wearDemand = lapsRemaining * track.tyreWear;
  if (wearDemand <= 4) return 'soft';
  if (wearDemand <= 7) return 'medium';
  return 'hard';
}

export function updateAI(car: CarState, track: Track, totalLaps: number, deltaTime: number, random: SeededRandom): void {
  if (car.isPlayer || car.finished || car.pitTimeRemaining > 0) return;
  car.aiDecisionTimer -= deltaTime;
  if (car.aiDecisionTimer > 0) return;
  car.aiDecisionTimer = GAME_CONFIG.aiReactionInterval + random.range(-0.45, 0.45);

  const lapsRemaining = Math.max(0, totalLaps - car.lap);
  const tyreCritical = car.tyreCondition < 0.2;
  const tyreLow = car.tyreCondition < 0.34;

  if (!car.pendingPitTyre && lapsRemaining > 1 && (tyreCritical || (tyreLow && random.next() < 0.7))) {
    car.pendingPitTyre = tyreForDistance(lapsRemaining - 1, track);
  }

  if (tyreCritical) car.strategyMode = 'conserve';
  else if (lapsRemaining <= 2 && car.tyreCondition > 0.42) car.strategyMode = 'attack';
  else if (car.tyreCondition < 0.4) car.strategyMode = 'conserve';
  else car.strategyMode = random.next() < car.driver.aggression * 0.22 ? 'attack' : 'normal';
}
