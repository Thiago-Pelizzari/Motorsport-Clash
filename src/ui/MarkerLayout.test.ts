import { describe, expect, it } from 'vitest';
import { separateMarkers, type MarkerPosition } from './MarkerLayout';

describe('separateMarkers', () => {
  it('separa marcadores sobrepostos em um pelotão', () => {
    const markers: MarkerPosition[] = Array.from({ length: 6 }, (_, index) => ({
      id: String(index), x: 200 + index * 3, y: 200 + (index % 2) * 2, radius: 11, raceDistance: 100 + index * 4,
    }));
    const separated = separateMarkers(markers, 3200);

    for (let first = 0; first < separated.length; first += 1) {
      for (let second = first + 1; second < separated.length; second += 1) {
        const distance = Math.hypot(separated[first].x - separated[second].x, separated[first].y - separated[second].y);
        expect(distance).toBeGreaterThanOrEqual(23.5);
      }
    }
  });

  it('não altera carros visualmente próximos que estão em setores cruzados diferentes', () => {
    const markers: MarkerPosition[] = [
      { id: 'a', x: 200, y: 200, radius: 11, raceDistance: 100 },
      { id: 'b', x: 202, y: 202, radius: 11, raceDistance: 900 },
    ];
    expect(separateMarkers(markers, 3200)).toEqual(markers);
  });
});
