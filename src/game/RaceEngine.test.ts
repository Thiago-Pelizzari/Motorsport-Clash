import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../storage/settingsStorage';
import { getTrack } from '../tracks';
import type { RaceSettings } from '../types/race';
import { RaceEngine } from './RaceEngine';

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
  it('completa uma corrida e classifica todos os carros', () => {
    const config = settings({ laps: 1, competitors: 6 });
    const engine = new RaceEngine(config, getTrack(config.trackId), 42);
    runUntilFinished(engine);

    expect(engine.state.phase).toBe('finished');
    expect(engine.state.cars).toHaveLength(6);
    expect(engine.state.cars.every((car) => car.finished)).toBe(true);
    expect(engine.state.cars.map((car) => car.position)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(engine.state.cars.every((car) => car.bestLapTime !== null)).toBe(true);
  });

  it('troca o pneu solicitado e registra o pit stop', () => {
    const config = settings({ laps: 2, competitors: 2 });
    const engine = new RaceEngine(config, getTrack(config.trackId), 7);
    const player = engine.state.cars.find((car) => car.id === 'player-0')!;
    engine.requestPitStop(player.id, 'hard');
    engine.start();

    for (let step = 0; step < 60_000 && player.pitStops.length === 0; step += 1) engine.update(1 / 30);

    expect(player.pitStops).toHaveLength(1);
    expect(player.tyreType).toBe('hard');
    expect(player.pitStops[0].toTyre).toBe('hard');
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
