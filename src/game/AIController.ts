import { GAME_CONFIG } from './gameConfig';
import type { CarState, Track, TrackFlag, TyreType, WeatherState } from '../types/race';
import { SeededRandom } from '../utils/random';

export function tyreForDistance(lapsRemaining: number, track: Track, trackWetness = 0): TyreType {
  if (trackWetness >= 0.56) return 'wet';
  if (trackWetness >= 0.22) return 'intermediate';
  const wearDemand = lapsRemaining * track.tyreWear;
  if (wearDemand <= 4.2) return 'soft';
  if (wearDemand <= 7.5) return 'medium';
  return 'hard';
}

export function updateAI(
  car: CarState,
  track: Track,
  totalLaps: number,
  deltaTime: number,
  random: SeededRandom,
  weather?: WeatherState,
  flag: TrackFlag = 'green',
): void {
  if (car.isPlayer || car.finished || car.pitTimeRemaining > 0) return;
  car.aiDecisionTimer -= deltaTime;
  if (car.aiDecisionTimer > 0) return;
  car.aiDecisionTimer = GAME_CONFIG.aiReactionInterval + random.range(-0.45, 0.45);

  const lapsRemaining = Math.max(0, totalLaps - car.lap);
  const wetness = weather?.trackWetness ?? 0;
  const isSlick = car.tyreType === 'soft' || car.tyreType === 'medium' || car.tyreType === 'hard';
  const isWetTyre = car.tyreType === 'intermediate' || car.tyreType === 'wet';

  // Check weather mismatch
  const needsWetNow = wetness >= 0.58 && car.tyreType !== 'wet';
  const needsInterNow = wetness >= 0.25 && wetness < 0.58 && isSlick;
  const needsSlickNow = wetness < 0.12 && isWetTyre;
  const weatherMismatch = needsWetNow || needsInterNow || needsSlickNow;

  const tyreCritical = car.tyreCondition < 0.18;
  const tyreLow = car.tyreCondition < 0.34;
  const scOpportunity = (flag === 'sc' || flag === 'vsc') && car.tyreCondition < 0.52 && lapsRemaining >= 3;
  const undercutOpportunity = car.inDirtyAir && car.tyreCondition < 0.44 && lapsRemaining >= 3 && random.next() < car.driver.aggression * 0.55;

  if (!car.pendingPitTyre && lapsRemaining > 1) {
    const canPitSensibly = lapsRemaining >= 3 || car.tyreCondition < 0.12 || weatherMismatch;
    if (canPitSensibly && (weatherMismatch || tyreCritical || scOpportunity || undercutOpportunity || (tyreLow && random.next() < 0.72))) {
      car.pendingPitTyre = tyreForDistance(lapsRemaining - 1, track, wetness);
      car.pendingPitRepair = car.condition < 0.86 && lapsRemaining >= 3;
    }
  }

  // Pace strategy mode decision
  if (flag === 'sc' || flag === 'vsc' || flag === 'yellow') {
    car.strategyMode = 'conserve';
    car.ersDeploy = false;
    return;
  }

  const fuelRatio = car.maxFuelLoad > 0 ? car.fuelLoad / car.maxFuelLoad : 1;
  const raceProgressRemaining = totalLaps > 0 ? lapsRemaining / totalLaps : 0;
  const lowFuel = fuelRatio < raceProgressRemaining * 0.82;

  if (tyreCritical || lowFuel || car.tyreTemperature > 0.92) {
    car.strategyMode = 'conserve';
    car.ersDeploy = false;
  } else if (lapsRemaining <= 2 && car.tyreCondition > 0.35) {
    car.strategyMode = 'attack';
    car.ersDeploy = car.ersCharge > 0.2;
  } else if (car.tyreCondition < 0.38) {
    car.strategyMode = 'conserve';
    car.ersDeploy = false;
  } else {
    const attackBias = car.driver.archetype === 'aggressive' ? 0.34 : car.driver.archetype === 'tyre_whisperer' ? 0.12 : 0.22;
    car.strategyMode = random.next() < car.driver.aggression * attackBias ? 'attack' : 'normal';
    car.ersDeploy = (car.strategyMode === 'attack' && car.ersCharge > 0.45) || (car.inSlipstream && car.ersCharge > 0.3);
  }
}
