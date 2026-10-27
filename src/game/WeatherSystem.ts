import { TYRES } from './gameConfig';
import type { TyreType, WeatherCondition, WeatherPreset, WeatherState } from '../types/race';
import { SeededRandom } from '../utils/random';

const TRANSITIONS: Record<WeatherCondition, WeatherCondition[]> = {
  dry: ['dry', 'overcast'],
  overcast: ['dry', 'overcast', 'light_rain'],
  light_rain: ['overcast', 'light_rain', 'heavy_rain'],
  heavy_rain: ['light_rain', 'heavy_rain'],
};

export function createInitialWeather(preset: WeatherPreset = 'clear', random: SeededRandom): WeatherState {
  if (preset === 'clear') {
    return {
      condition: 'dry',
      trackWetness: 0,
      rainIntensity: 0,
      ambientTemp: 24,
      trackTemp: 34,
      forecast: ['dry', 'dry', 'dry'],
      nextChangeTimer: 9999,
    };
  }

  let initialCondition: WeatherCondition = 'dry';
  let initialWetness = 0;

  if (preset === 'wet') {
    initialCondition = random.next() < 0.65 ? 'light_rain' : 'heavy_rain';
    initialWetness = initialCondition === 'heavy_rain' ? 0.78 : 0.48;
  } else if (preset === 'changeable') {
    initialCondition = random.next() < 0.5 ? 'overcast' : 'dry';
    initialWetness = 0;
  } else {
    initialCondition = random.pick<WeatherCondition>(['dry', 'overcast', 'light_rain', 'heavy_rain']);
    initialWetness = initialCondition === 'heavy_rain' ? 0.75 : initialCondition === 'light_rain' ? 0.42 : 0;
  }

  const forecast: WeatherCondition[] = [];
  let cursor = initialCondition;
  for (let i = 0; i < 3; i += 1) {
    if (preset === 'changeable' && i === 1 && cursor === 'dry') {
      cursor = 'light_rain';
    } else {
      cursor = random.pick(TRANSITIONS[cursor]);
    }
    forecast.push(cursor);
  }

  return {
    condition: initialCondition,
    trackWetness: initialWetness,
    rainIntensity: rainRateForCondition(initialCondition),
    ambientTemp: initialCondition === 'dry' ? 25 : 19,
    trackTemp: initialCondition === 'dry' ? 35 : 23,
    forecast,
    nextChangeTimer: random.range(38, 65),
  };
}

function rainRateForCondition(condition: WeatherCondition): number {
  switch (condition) {
    case 'dry':
      return 0;
    case 'overcast':
      return 0;
    case 'light_rain':
      return 0.48;
    case 'heavy_rain':
      return 0.92;
  }
}

export function updateWeather(
  weather: WeatherState,
  preset: WeatherPreset = 'clear',
  deltaTime: number,
  random: SeededRandom,
): WeatherCondition | null {
  let changedTo: WeatherCondition | null = null;

  if (preset !== 'clear') {
    weather.nextChangeTimer -= deltaTime;
    if (weather.nextChangeTimer <= 0) {
      const nextCondition = weather.forecast.shift() ?? weather.condition;
      const lastForecast = weather.forecast[weather.forecast.length - 1] ?? nextCondition;
      weather.forecast.push(random.pick(TRANSITIONS[lastForecast]));
      weather.nextChangeTimer = random.range(40, 72);
      if (nextCondition !== weather.condition) {
        weather.condition = nextCondition;
        changedTo = nextCondition;
      }
    }
  }

  const targetRain = rainRateForCondition(weather.condition);
  weather.rainIntensity += (targetRain - weather.rainIntensity) * Math.min(1, deltaTime * 0.4);

  if (weather.rainIntensity > 0) {
    const soakRate = weather.condition === 'heavy_rain' ? 0.018 : 0.009;
    weather.trackWetness = Math.min(1, weather.trackWetness + soakRate * deltaTime);
  } else {
    const dryRate = weather.condition === 'dry' ? 0.0085 : 0.004;
    weather.trackWetness = Math.max(0, weather.trackWetness - dryRate * deltaTime);
  }

  const targetTrackTemp = weather.condition === 'dry' ? 35 : weather.condition === 'overcast' ? 27 : 20;
  weather.trackTemp += (targetTrackTemp - weather.trackTemp) * Math.min(1, deltaTime * 0.15);

  return changedTo;
}

export function weatherGripMultiplier(tyreType: TyreType, trackWetness: number, driverWetSkill = 0.85): number {
  const compound = TYRES[tyreType];
  const isSlick = tyreType === 'soft' || tyreType === 'medium' || tyreType === 'hard';

  if (trackWetness <= 0.08) {
    if (isSlick) return 1;
    return tyreType === 'intermediate' ? 0.945 : 0.885;
  }

  // Within compound's ideal wetness window
  if (trackWetness >= compound.optimalWetnessMin && trackWetness <= compound.optimalWetnessMax) {
    return 0.96 + driverWetSkill * 0.035;
  }

  if (isSlick) {
    const excessWetness = Math.max(0, trackWetness - compound.optimalWetnessMax);
    const wetPenalty = excessWetness * (0.42 - driverWetSkill * 0.08);
    return Math.max(0.68, 1 - wetPenalty);
  }

  if (tyreType === 'intermediate') {
    if (trackWetness < compound.optimalWetnessMin) {
      return 0.945 + (trackWetness / compound.optimalWetnessMin) * 0.04;
    }
    const excessHeavyWet = trackWetness - compound.optimalWetnessMax;
    return Math.max(0.84, 0.98 - excessHeavyWet * 0.32);
  }

  // Full wet tyre on light damp track
  return 0.89 + (trackWetness / Math.max(0.01, compound.optimalWetnessMin)) * 0.09;
}

export function weatherWearMultiplier(tyreType: TyreType, trackWetness: number): number {
  if ((tyreType === 'intermediate' || tyreType === 'wet') && trackWetness < 0.15) {
    // Wet tyres shred on a dry track
    return tyreType === 'wet' ? 2.35 : 1.75;
  }
  if (trackWetness > 0.35 && (tyreType === 'soft' || tyreType === 'medium' || tyreType === 'hard')) {
    return 0.88;
  }
  return 1;
}

export function recommendedTyreForWetness(trackWetness: number): TyreType {
  if (trackWetness >= 0.56) return 'wet';
  if (trackWetness >= 0.22) return 'intermediate';
  return 'medium';
}
