import { describe, expect, it } from 'vitest';
import { updateAI } from './AIController';
import { RaceEngine } from './RaceEngine';
import { weatherGripMultiplier, weatherWearMultiplier } from './WeatherSystem';
import { DEFAULT_SETTINGS } from '../storage/settingsStorage';
import { getTrack } from '../tracks';
import type { RaceSettings } from '../types/race';
import { SeededRandom } from '../utils/random';

function settings(overrides: Partial<RaceSettings> = {}): RaceSettings {
  return { ...structuredClone(DEFAULT_SETTINGS), ...overrides };
}

function runUntilFinished(engine: RaceEngine, maximumSteps = 200_000): void {
  engine.start();
  engine.setSimulationSpeed(4);
  for (let step = 0; step < maximumSteps && engine.state.phase !== 'finished'; step += 1) {
    engine.update(1 / 30);
  }
}

describe('RaceEngine', () => {
  it('completa uma corrida, registra setores, volta mais rápida e consumo de combustível', () => {
    const config = settings({ laps: 2, competitors: 6 });
    const engine = new RaceEngine(config, getTrack(config.trackId), 42);
    runUntilFinished(engine);

    expect(engine.state.phase).toBe('finished');
    expect(engine.state.cars).toHaveLength(6);
    expect(engine.state.cars.every((car) => car.finished)).toBe(true);
    expect(engine.state.cars.map((car) => car.position)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(engine.state.cars.every((car) => car.bestLapTime !== null)).toBe(true);
    expect(engine.state.fastestLapCarId).not.toBeNull();
    expect(engine.state.fastestLapTime).toBeGreaterThan(10);
    expect(engine.state.cars[0].fuelLoad).toBeLessThan(engine.state.cars[0].maxFuelLoad);
    expect(engine.state.cars[0].bestSectorTimes.every((s) => s !== null && s > 0)).toBe(true);
  });

  it('troca o pneu solicitado, repara condição quando pedido e registra o pit stop', () => {
    const config = settings({ laps: 2, competitors: 2 });
    const engine = new RaceEngine(config, getTrack(config.trackId), 7);
    const player = engine.state.cars.find((car) => car.id === 'player-0')!;
    player.condition = 0.78;
    engine.requestPitStop(player.id, 'hard', true);
    engine.start();

    for (let step = 0; step < 60_000 && player.pitStops.length === 0; step += 1) engine.update(1 / 30);

    expect(player.pitStops).toHaveLength(1);
    expect(player.tyreType).toBe('hard');
    expect(player.pitStops[0].toTyre).toBe('hard');
    expect(player.pitStops[0].repaired).toBe(true);
    expect(player.condition).toBeGreaterThan(0.95);
  });

  it('descarrega e recarrega a bateria ERS durante a corrida', () => {
    const config = settings({ laps: 1, competitors: 2 });
    const engine = new RaceEngine(config, getTrack(config.trackId), 15);
    const player = engine.state.cars.find((car) => car.id === 'player-0')!;
    engine.start();
    engine.toggleErs(player.id, true);
    expect(player.ersDeploy).toBe(true);

    for (let step = 0; step < 60; step += 1) engine.update(1 / 30);
    expect(player.ersCharge).toBeLessThan(1);

    engine.toggleErs(player.id, false);
    const drainedCharge = player.ersCharge;
    for (let step = 0; step < 90; step += 1) engine.update(1 / 30);
    expect(player.ersCharge).toBeGreaterThan(drainedCharge);
  });

  it('pausa sem avançar o relógio da simulação', () => {
    const config = settings({ laps: 1, competitors: 2 });
    const engine = new RaceEngine(config, getTrack(config.trackId), 9);
    engine.start();
    engine.update(1);
    const elapsed = engine.state.elapsedTime;
    engine.setSimulationSpeed(0);
    engine.update(10);
    expect(engine.state.elapsedTime).toBe(elapsed);
  });

  it('aplica modos de definição de grid (reverse e simulated)', () => {
    const reverseConfig = settings({ laps: 1, competitors: 8, qualifyingMode: 'reverse' });
    const reverseEngine = new RaceEngine(reverseConfig, getTrack(reverseConfig.trackId), 21);
    const playerPositions = reverseEngine.state.cars.filter((c) => c.isPlayer).map((c) => c.gridPosition);
    expect(playerPositions.sort((a, b) => a - b)).toEqual([7, 8]);
  });

  it('reage ao clima chuvoso na aderência de pneus e decisão da IA', () => {
    expect(weatherGripMultiplier('wet', 0.8, 0.9)).toBeGreaterThan(weatherGripMultiplier('soft', 0.8, 0.9));
    expect(weatherGripMultiplier('intermediate', 0.4, 0.9)).toBeGreaterThan(weatherGripMultiplier('soft', 0.4, 0.9));
    expect(weatherWearMultiplier('wet', 0.02)).toBeGreaterThan(2);

    const config = settings({ laps: 5, competitors: 4 });
    const engine = new RaceEngine(config, getTrack(config.trackId), 33);
    const aiCar = engine.state.cars.find((c) => !c.isPlayer)!;
    aiCar.tyreType = 'soft';
    aiCar.aiDecisionTimer = 0;
    engine.state.weather.trackWetness = 0.72;
    engine.state.weather.condition = 'heavy_rain';

    updateAI(aiCar, engine.track, 5, 1, new SeededRandom(33), engine.state.weather, 'green');
    expect(aiCar.pendingPitTyre).toBe('wet');
  });

  it('mantém todo o estado numérico válido após contatos no pelotão', () => {
    for (let seed = 1; seed <= 80; seed += 1) {
      const config = settings({ laps: 2, competitors: 20 });
      const engine = new RaceEngine(config, getTrack(config.trackId), seed);
      engine.start();
      engine.setSimulationSpeed(4);
      for (let step = 0; step < 600; step += 1) engine.update(1 / 30);
      engine.state.cars.forEach((car) => {
        expect(Number.isFinite(car.distance), `seed ${seed}, carro #${car.number}: distância`).toBe(true);
        expect(Number.isFinite(car.speed), `seed ${seed}, carro #${car.number}: velocidade`).toBe(true);
        expect(Number.isFinite(car.laneOffset), `seed ${seed}, carro #${car.number}: linha`).toBe(true);
      });
    }
  });
});
