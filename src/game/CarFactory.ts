import { DIFFICULTY, GAME_CONFIG, TYRES } from './gameConfig';
import type { CarState, DriverArchetype, RaceSettings, Track, TyreType } from '../types/race';
import { SeededRandom } from '../utils/random';

const FIRST_NAMES = [
  'Lina', 'Theo', 'Maya', 'Davi', 'Nora', 'Enzo', 'Iris', 'Caio', 'Zoe',
  'Hugo', 'Lia', 'Ravi', 'Eva', 'Noah', 'Bia', 'Otto', 'Yara', 'Gael',
  'Alex', 'Clara', 'Marco', 'Sofia', 'Liam', 'Elena',
];
const LAST_NAMES = [
  'Valente', 'Keller', 'Sato', 'Moreau', 'Costa', 'Nielsen', 'Vega',
  'Silva', 'Rossi', 'Moura', 'Tanaka', 'Weiss', 'Vettel', 'Leclerc',
  'Alonso', 'Senna', 'Berger', 'Lindqvist',
];

const AI_TEAMS = [
  'Vortex GP',
  'Solaris Racing',
  'Krono Motorsport',
  'Aether Dynamics',
  'Valhalla Racing',
  'Nebula Corsa',
  'Titan Engineering',
  'Zenith GP',
  'Hyperion F1',
];

const ARCHETYPES: DriverArchetype[] = [
  'balanced',
  'aggressive',
  'tyre_whisperer',
  'rain_master',
  'calculated',
];

interface BaseCarParams {
  id: string;
  index: number;
  number: number;
  name: string;
  teamName: string;
  color: string;
  isPlayer: boolean;
  tyreType: TyreType;
  skill: number;
  consistency: number;
  laps: number;
  random: SeededRandom;
  track: Track;
}

function createBaseCar(params: BaseCarParams): CarState {
  const { id, index, number, name, teamName, color, isPlayer, tyreType, skill, consistency, laps, random, track } = params;
  const archetype = random.pick(ARCHETYPES);
  const aggressionBase = archetype === 'aggressive' ? random.range(0.82, 0.98) : random.range(0.55, 0.92);
  const wetSkill = archetype === 'rain_master' ? random.range(0.9, 0.99) : random.range(0.74, 0.93);
  const tyreManagement = archetype === 'tyre_whisperer' ? random.range(0.9, 0.99) : random.range(0.78, 0.94);
  const maxFuel = Math.max(1.5, laps * GAME_CONFIG.fuelPerLapKg);

  return {
    id,
    number,
    name,
    teamName,
    color,
    isPlayer,
    driver: {
      name,
      skill,
      aggression: aggressionBase,
      consistency,
      wetSkill,
      tyreManagement,
      archetype,
    },
    speed: 0,
    baseSpeed: track.averageSpeed * random.range(0.975, 1.032),
    acceleration: random.range(16.5, 23),
    fuelEfficiency: random.range(0.88, 0.98),
    condition: 1,
    tyreType,
    tyreCondition: 1,
    tyreWearRate: random.range(0.94, 1.07) * (1.08 - tyreManagement * 0.1),
    tyreTemperature: 0.72,
    fuelLoad: maxFuel,
    maxFuelLoad: maxFuel,
    ersCharge: 1,
    ersDeploy: false,
    inSlipstream: false,
    inDirtyAir: false,
    strategyMode: 'normal',
    distance: -index * GAME_CONFIG.gridGapMetres,
    lap: 0,
    position: index + 1,
    gridPosition: index + 1,
    currentLapTime: 0,
    lastLapTime: null,
    bestLapTime: null,
    totalTime: 0,
    finishTime: null,
    finished: false,
    laneOffset: ((index % 3) - 1) * 8,
    targetLaneOffset: ((index % 3) - 1) * 8,
    pitState: 'none',
    pendingPitTyre: null,
    pendingPitRepair: false,
    pitTimeRemaining: 0,
    pitStops: [],
    laps: [],
    currentSector: 0,
    sectorStartTime: 0,
    sectorTimes: [0, 0, 0],
    bestSectorTimes: [null, null, null],
    positionHistory: [index + 1],
    overtakesMade: 0,
    qualifyingTime: null,
    aiDecisionTimer: random.range(0.2, GAME_CONFIG.aiReactionInterval),
    variationPhase: random.range(0, Math.PI * 2),
    collisionCooldown: 0,
    contactCount: 0,
  };
}

export function createCars(settings: RaceSettings, track: Track, random: SeededRandom, initialWetness = 0): CarState[] {
  const difficulty = DIFFICULTY[settings.difficulty];
  const usedNumbers = new Set(settings.playerCars.map((car) => car.number));
  const usedNames = new Set<string>();
  const playerTeam = settings.teamName?.trim() || 'Equipe Apex';

  const cars: CarState[] = settings.playerCars.map((car, index) => {
    const customName = car.driverName?.trim();
    const defaultLabel = index === 0 ? `Você · ${playerTeam}` : `Piloto 2 · ${playerTeam}`;
    return createBaseCar({
      id: `player-${index}`,
      index,
      number: car.number,
      name: customName || defaultLabel,
      teamName: playerTeam,
      color: GAME_CONFIG.playerColors[index],
      isPlayer: true,
      tyreType: car.tyre,
      skill: 0.88 + index * 0.015,
      consistency: 0.94,
      laps: settings.laps,
      random,
      track,
    });
  });

  for (let index = 2; index < settings.competitors; index += 1) {
    let number = Math.floor(random.range(2, 99));
    while (usedNumbers.has(number)) number = (number % 99) + 1;
    usedNumbers.add(number);

    let name = `${random.pick(FIRST_NAMES)} ${random.pick(LAST_NAMES)}`;
    let attempts = 0;
    while (usedNames.has(name) && attempts < 10) {
      name = `${random.pick(FIRST_NAMES)} ${random.pick(LAST_NAMES)}`;
      attempts += 1;
    }
    usedNames.add(name);

    const teamIndex = Math.floor((index - 2) / 2);
    const teamName = AI_TEAMS[teamIndex % AI_TEAMS.length];
    const color = GAME_CONFIG.aiColors[teamIndex % GAME_CONFIG.aiColors.length];

    let tyre: TyreType;
    if (initialWetness >= 0.56) {
      tyre = 'wet';
    } else if (initialWetness >= 0.2) {
      tyre = 'intermediate';
    } else {
      tyre = random.pick<TyreType>(['soft', 'medium', 'hard']);
    }

    cars.push(
      createBaseCar({
        id: `ai-${index}`,
        index,
        number,
        name,
        teamName,
        color,
        isPlayer: false,
        tyreType: tyre,
        skill: random.range(difficulty.skillMin, difficulty.skillMax),
        consistency: difficulty.consistency,
        laps: settings.laps,
        random,
        track,
      }),
    );
  }

  // Simulate qualifying times for all cars
  const idealLapSeconds = track.length / (track.averageSpeed / 3.6);
  for (const car of cars) {
    const skillFactor = 0.93 + car.driver.skill * 0.09;
    const tyreSpeed = TYRES[car.tyreType].speed;
    const lapVariance = random.range(0.991, 1.011);
    car.qualifyingTime = (idealLapSeconds / (skillFactor * tyreSpeed)) * lapVariance;
  }

  applyGridOrdering(cars, settings.qualifyingMode ?? 'front_row', random);
  return cars;
}

function applyGridOrdering(cars: CarState[], mode: NonNullable<RaceSettings['qualifyingMode']>, random: SeededRandom): void {
  if (mode === 'simulated') {
    cars.sort((a, b) => (a.qualifyingTime ?? 999) - (b.qualifyingTime ?? 999));
  } else if (mode === 'random') {
    for (let i = cars.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random.next() * (i + 1));
      [cars[i], cars[j]] = [cars[j], cars[i]];
    }
  } else if (mode === 'reverse') {
    const aiCars = cars.filter((car) => !car.isPlayer).sort((a, b) => (a.qualifyingTime ?? 999) - (b.qualifyingTime ?? 999));
    const playerCars = cars.filter((car) => car.isPlayer);
    cars.splice(0, cars.length, ...aiCars, ...playerCars);
  }

  cars.forEach((car, gridIndex) => {
    car.position = gridIndex + 1;
    car.gridPosition = gridIndex + 1;
    car.distance = -gridIndex * GAME_CONFIG.gridGapMetres;
    car.laneOffset = ((gridIndex % 3) - 1) * 8;
    car.targetLaneOffset = car.laneOffset;
    car.positionHistory = [gridIndex + 1];
  });
}
