import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../storage/settingsStorage';
import { getTrack } from '../tracks';
import { RaceEngine } from './RaceEngine';
import { resolveCarCollisions } from './CollisionSystem';
import { calculateRacingLine } from './RacingLineSystem';

function testCars() {
  const settings = { ...structuredClone(DEFAULT_SETTINGS), competitors: 2 };
  const track = getTrack(settings.trackId);
  const engine = new RaceEngine(settings, track, 123);
  return { cars: engine.state.cars, track };
}

describe('CollisionSystem', () => {
  it('detecta contato, separa os carros e aplica consequência', () => {
    const { cars, track } = testCars();
    const behind = cars[0];
    const ahead = cars[1];
    behind.distance = 100;
    ahead.distance = 105;
    behind.laneOffset = 0;
    ahead.laneOffset = 2;
    behind.speed = 205;
    ahead.speed = 175;

    const events = resolveCarCollisions(cars, track.length);

    expect(events).toHaveLength(1);
    expect(behind.distance).toBeLessThan(100);
    expect(behind.speed).toBeLessThan(205);
    expect(behind.contactCount).toBe(1);
    expect(ahead.contactCount).toBe(1);
    expect(behind.condition).toBeLessThan(1);
  });

  it('não colide quando os carros ocupam linhas afastadas', () => {
    const { cars, track } = testCars();
    cars[0].distance = 100;
    cars[1].distance = 104;
    cars[0].laneOffset = -17;
    cars[1].laneOffset = 17;
    expect(resolveCarCollisions(cars, track.length)).toHaveLength(0);
  });
});

describe('RacingLineSystem', () => {
  it('produz linhas distintas, limitadas à pista e variáveis por volta', () => {
    const { cars, track } = testCars();
    cars[0].distance = track.length * 0.35;
    cars[1].distance = track.length * 0.35;
    const firstLine = calculateRacingLine(cars[0], track);
    const secondLine = calculateRacingLine(cars[1], track);
    cars[0].lap = 1;
    const nextLapLine = calculateRacingLine(cars[0], track);

    expect(firstLine).not.toBe(secondLine);
    expect(firstLine).not.toBe(nextLapLine);
    expect(Math.abs(firstLine)).toBeLessThanOrEqual(17);
    expect(Math.abs(secondLine)).toBeLessThanOrEqual(17);
  });
});
