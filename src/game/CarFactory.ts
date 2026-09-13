import { DIFFICULTY, GAME_CONFIG } from './gameConfig';
import type { CarState, RaceSettings, Track, TyreType } from '../types/race';
import { SeededRandom } from '../utils/random';

const FIRST_NAMES = ['Lina', 'Theo', 'Maya', 'Davi', 'Nora', 'Enzo', 'Iris', 'Caio', 'Zoe', 'Hugo', 'Lia', 'Ravi', 'Eva', 'Noah', 'Bia', 'Otto', 'Yara', 'Gael'];
const LAST_NAMES = ['Valente', 'Keller', 'Sato', 'Moreau', 'Costa', 'Nielsen', 'Vega', 'Silva', 'Rossi', 'Moura', 'Tanaka', 'Weiss'];

function createBaseCar(index: number, number: number, name: string, color: string, isPlayer: boolean, tyreType: TyreType, skill: number, consistency: number, random: SeededRandom, track: Track): CarState {
  return {
    id: isPlayer ? `player-${index}` : `ai-${index}`,
    number,
    name,
    color,
    isPlayer,
    driver: {
      name,
      skill,
      aggression: random.range(0.55, 0.96),
      consistency,
    },
    speed: 0,
    baseSpeed: track.averageSpeed * random.range(0.97, 1.035),
    acceleration: random.range(16, 23),
    fuelEfficiency: random.range(0.86, 0.98),
    condition: 1,
    tyreType,
    tyreCondition: 1,
    tyreWearRate: random.range(0.94, 1.08),
    strategyMode: 'normal',
    distance: -index * GAME_CONFIG.gridGapMetres,
    lap: 0,
    position: index + 1,
    currentLapTime: 0,
    lastLapTime: null,
    bestLapTime: null,
    totalTime: 0,
    finishTime: null,
    finished: false,
    laneOffset: ((index % 3) - 1) * 8,
    targetLaneOffset: ((index % 3) - 1) * 8,
    pendingPitTyre: null,
    pitTimeRemaining: 0,
    pitStops: [],
    laps: [],
    aiDecisionTimer: random.range(0.2, GAME_CONFIG.aiReactionInterval),
    variationPhase: random.range(0, Math.PI * 2),
    collisionCooldown: 0,
    contactCount: 0,
  };
}

export function createCars(settings: RaceSettings, track: Track, random: SeededRandom): CarState[] {
  const difficulty = DIFFICULTY[settings.difficulty];
  const usedNumbers = new Set(settings.playerCars.map((car) => car.number));
  const cars: CarState[] = settings.playerCars.map((car, index) =>
    createBaseCar(
      index,
      car.number,
      index === 0 ? 'Você · Equipe Apex' : 'Você · Equipe Nova',
      GAME_CONFIG.playerColors[index],
      true,
      car.tyre,
      0.88 + index * 0.015,
      0.94,
      random,
      track,
    ),
  );

  for (let index = 2; index < settings.competitors; index += 1) {
    let number = Math.floor(random.range(2, 99));
    while (usedNumbers.has(number)) number = (number % 99) + 1;
    usedNumbers.add(number);
    const name = `${random.pick(FIRST_NAMES)} ${random.pick(LAST_NAMES)}`;
    const tyre = random.pick<TyreType>(['soft', 'medium', 'hard']);
    cars.push(
      createBaseCar(
        index,
        number,
        name,
        GAME_CONFIG.aiColors[(index - 2) % GAME_CONFIG.aiColors.length],
        false,
        tyre,
        random.range(difficulty.skillMin, difficulty.skillMax),
        difficulty.consistency,
        random,
        track,
      ),
    );
  }

  return cars;
}
