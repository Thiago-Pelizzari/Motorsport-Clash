import { describe, expect, it } from 'vitest';
import { TrackGeometry } from '../game/TrackGeometry';
import { BLOCK_TRACKS, TRACK_TEMPLATES } from './blockTracks';
import {
  createTrackFromBlocks,
  estimateTrackMetrics,
  hasSelfIntersection,
  pointsFromBlocks,
  trackArea,
} from './blockBuilder';

describe('block track builder', () => {
  it('gera três modelos fechados, diversos e com área útil', () => {
    expect(BLOCK_TRACKS).toHaveLength(3);
    expect(new Set(BLOCK_TRACKS.map((track) => JSON.stringify(track.points))).size).toBe(3);
    BLOCK_TRACKS.forEach((track) => {
      expect(track.points.length).toBeGreaterThanOrEqual(4);
      expect(trackArea(track.points)).toBeGreaterThan(10_000);
      expect(track.points.every((point) => point.x >= 100 && point.x <= 900 && point.y >= 80 && point.y <= 540)).toBe(true);
    });
  });

  it('preserva a sequência de blocos em pistas personalizadas', () => {
    const blocks = TRACK_TEMPLATES[1].blocks;
    const track = createTrackFromBlocks({
      id: 'custom-test', name: 'Teste', location: 'Oficina', description: 'Teste de pista', blocks,
      length: 3000, averageSpeed: 180, tyreWear: 1, overtakeChance: 0.6, accent: '#ff334f', source: 'custom',
    });
    expect(track.blocks).toEqual(blocks);
    expect(track.points).toEqual(pointsFromBlocks(blocks));
    expect(track.corners).toBeGreaterThan(3);
  });

  it('usa os pontos modelados pelo jogador sem recalcular o formato', () => {
    const blocks = TRACK_TEMPLATES[0].blocks;
    const modeledPoints = pointsFromBlocks(blocks).map((point, index) => ({ ...point, y: point.y + (index % 2) * 25 }));
    const track = createTrackFromBlocks({
      id: 'modeled-test', name: 'Modelada', location: 'Oficina', description: 'Formato editado', blocks,
      points: modeledPoints, length: 2800, averageSpeed: 175, tyreWear: 1, overtakeChance: 0.55, accent: '#20d7ff', source: 'custom',
    });
    expect(track.points).toEqual(modeledPoints);
    expect(track.points).not.toBe(modeledPoints);
  });

  it('suporta novos blocos (grampos e esse), estima métricas e detecta auto-interseção', () => {
    const blocks = ['straight', 'hairpinRight', 'sCurve', 'hairpinLeft'] as const;
    const pts = pointsFromBlocks([...blocks]);
    const metrics = estimateTrackMetrics([...blocks], pts);
    expect(metrics.length).toBeGreaterThanOrEqual(1400);
    expect(metrics.corners).toBe(7);

    const cleanSquare = [
      { x: 100, y: 100 },
      { x: 400, y: 100 },
      { x: 400, y: 400 },
      { x: 100, y: 400 },
    ];
    const figureEight = [
      { x: 100, y: 100 },
      { x: 400, y: 400 },
      { x: 400, y: 100 },
      { x: 100, y: 400 },
    ];
    expect(hasSelfIntersection(cleanSquare, true)).toBe(false);
    expect(hasSelfIntersection(figureEight, true)).toBe(true);
  });

  it('calcula curvatura local e ápices de curva na geometria de pista', () => {
    const geometry = new TrackGeometry(BLOCK_TRACKS[0]);
    expect(geometry.cornerApexes.length).toBeGreaterThanOrEqual(4);
    expect(geometry.speedFactorAt(0)).toBeGreaterThan(0.6);
  });
});
