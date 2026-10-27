import type { Point, Track, TrackBlockType } from '../types/race';

interface BlockStep {
  turn: number;
  length: number;
}

export interface BlockDefinition {
  label: string;
  shortLabel: string;
  glyph: string;
  description: string;
  steps: BlockStep[];
}

export const BLOCK_DEFINITIONS: Record<TrackBlockType, BlockDefinition> = {
  straight: { label: 'Reta longa', shortLabel: 'Reta', glyph: '━', description: 'Alta velocidade', steps: [{ turn: 0, length: 110 }] },
  short: { label: 'Reta curta', shortLabel: 'Curta', glyph: '─', description: 'Conecta setores', steps: [{ turn: 0, length: 68 }] },
  left45: { label: 'Curva E 45°', shortLabel: 'E 45°', glyph: '╱', description: 'Curva rápida', steps: [{ turn: -45, length: 82 }] },
  right45: { label: 'Curva D 45°', shortLabel: 'D 45°', glyph: '╲', description: 'Curva rápida', steps: [{ turn: 45, length: 82 }] },
  left90: { label: 'Cotovelo E', shortLabel: 'E 90°', glyph: '┏', description: 'Curva fechada', steps: [{ turn: -90, length: 78 }] },
  right90: { label: 'Cotovelo D', shortLabel: 'D 90°', glyph: '┓', description: 'Curva fechada', steps: [{ turn: 90, length: 78 }] },
  chicaneLeft: { label: 'Chicane E', shortLabel: 'Chic. E', glyph: '〽', description: 'Esquerda–direita', steps: [{ turn: -45, length: 50 }, { turn: 45, length: 50 }] },
  chicaneRight: { label: 'Chicane D', shortLabel: 'Chic. D', glyph: '〽', description: 'Direita–esquerda', steps: [{ turn: 45, length: 50 }, { turn: -45, length: 50 }] },
  hairpinLeft: { label: 'Grampo E 180°', shortLabel: 'Grampo E', glyph: '↶', description: 'Frenagem forte', steps: [{ turn: -90, length: 54 }, { turn: -90, length: 54 }] },
  hairpinRight: { label: 'Grampo D 180°', shortLabel: 'Grampo D', glyph: '↷', description: 'Frenagem forte', steps: [{ turn: 90, length: 54 }, { turn: 90, length: 54 }] },
  sCurve: { label: 'Esse Rápido', shortLabel: 'Esse', glyph: '〰', description: 'Sequência fluida', steps: [{ turn: -35, length: 54 }, { turn: 70, length: 54 }, { turn: -35, length: 54 }] },
};

export interface BlockTrackOptions {
  id: string;
  name: string;
  location: string;
  description: string;
  blocks: TrackBlockType[];
  length: number;
  averageSpeed: number;
  tyreWear: number;
  overtakeChance: number;
  accent: string;
  source: 'blocks' | 'custom';
  points?: Point[];
}

export function pointsFromBlocks(blocks: TrackBlockType[]): Point[] {
  let heading = 0;
  let x = 0;
  let y = 0;
  const rawPoints: Point[] = [{ x, y }];

  blocks.forEach((block) => {
    const def = BLOCK_DEFINITIONS[block] ?? BLOCK_DEFINITIONS.straight;
    def.steps.forEach((step) => {
      heading += (step.turn * Math.PI) / 180;
      x += Math.cos(heading) * step.length;
      y += Math.sin(heading) * step.length;
      rawPoints.push({ x, y });
    });
  });

  if (rawPoints.length > 2 && Math.hypot(rawPoints.at(-1)!.x - rawPoints[0].x, rawPoints.at(-1)!.y - rawPoints[0].y) < 8) rawPoints.pop();
  return normalizePoints(rawPoints);
}

export function createTrackFromBlocks(options: BlockTrackOptions): Track {
  const corners = options.blocks.reduce((total, block) => {
    const def = BLOCK_DEFINITIONS[block] ?? BLOCK_DEFINITIONS.straight;
    return total + def.steps.filter((step) => step.turn !== 0).length;
  }, 0);
  const sharpCorners = options.blocks.filter(
    (block) => block === 'left90' || block === 'right90' || block === 'hairpinLeft' || block === 'hairpinRight',
  ).length;
  return {
    id: options.id,
    name: options.name,
    location: options.location,
    description: options.description,
    length: options.length,
    corners,
    difficulty: Math.max(1, Math.min(5, Math.round(1 + corners / 6 + sharpCorners / 3))),
    averageSpeed: options.averageSpeed,
    tyreWear: options.tyreWear,
    overtakeChance: options.overtakeChance,
    accent: options.accent,
    points: options.points?.map((point) => ({ ...point })) ?? pointsFromBlocks(options.blocks),
    source: options.source,
    blocks: [...options.blocks],
  };
}

export function trackArea(points: Point[]): number {
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    area += current.x * next.y - next.x * current.y;
  }
  return Math.abs(area / 2);
}

export function estimateTrackMetrics(blocks: TrackBlockType[], points: Point[]): {
  length: number;
  averageSpeed: number;
  tyreWear: number;
  overtakeChance: number;
  corners: number;
} {
  let perimeter = 0;
  for (let i = 0; i < points.length; i += 1) {
    const curr = points[i];
    const next = points[(i + 1) % points.length];
    perimeter += Math.hypot(next.x - curr.x, next.y - curr.y);
  }
  const corners = blocks.reduce((total, block) => {
    const def = BLOCK_DEFINITIONS[block] ?? BLOCK_DEFINITIONS.straight;
    return total + def.steps.filter((step) => step.turn !== 0).length;
  }, 0);
  const straights = blocks.filter((b) => b === 'straight' || b === 'short').length;
  const tightTurns = blocks.filter((b) => b === 'left90' || b === 'right90' || b === 'hairpinLeft' || b === 'hairpinRight').length;
  const technical = blocks.filter((b) => b === 'chicaneLeft' || b === 'chicaneRight' || b === 'sCurve').length;

  const length = Math.max(1400, Math.min(7200, Math.round((perimeter * 1.65 + blocks.length * 95) / 10) * 10));
  const rawSpeed = 195 + straights * 4.5 - tightTurns * 7.5 - technical * 6;
  const averageSpeed = Math.max(135, Math.min(232, Math.round(rawSpeed)));

  const wearScore = 0.85 + (corners * 0.025) + (tightTurns * 0.04) + (technical * 0.05);
  let tyreWear = 1;
  if (wearScore < 0.94) tyreWear = 0.85;
  else if (wearScore < 1.12) tyreWear = 1;
  else if (wearScore < 1.28) tyreWear = 1.2;
  else tyreWear = 1.35;

  const overtakeChance = Math.max(25, Math.min(88, Math.round(52 + straights * 5 - technical * 4 + tightTurns * 2)));

  return { length, averageSpeed, tyreWear, overtakeChance, corners };
}

export function hasSelfIntersection(points: Point[], closed: boolean): boolean {
  const n = points.length;
  if (n < 4) return false;
  const segCount = closed ? n : n - 1;

  for (let i = 0; i < segCount; i += 1) {
    const a1 = points[i];
    const a2 = points[(i + 1) % n];
    for (let j = i + 2; j < segCount; j += 1) {
      if (closed && i === 0 && j === segCount - 1) continue;
      const b1 = points[j];
      const b2 = points[(j + 1) % n];
      if (segmentsIntersect(a1, a2, b1, b2)) return true;
    }
  }
  return false;
}

function segmentsIntersect(p1: Point, p2: Point, p3: Point, p4: Point): boolean {
  const ccw = (a: Point, b: Point, c: Point) => (c.y - a.y) * (b.x - a.x) > (b.y - a.y) * (c.x - a.x);
  return ccw(p1, p3, p4) !== ccw(p2, p3, p4) && ccw(p1, p2, p3) !== ccw(p1, p2, p4);
}

function normalizePoints(points: Point[]): Point[] {
  const minX = Math.min(...points.map((point) => point.x));
  const maxX = Math.max(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxY = Math.max(...points.map((point) => point.y));
  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);
  const scale = Math.min(760 / width, 420 / height);
  const offsetX = 500 - ((minX + maxX) / 2) * scale;
  const offsetY = 310 - ((minY + maxY) / 2) * scale;
  return points.map((point) => ({ x: point.x * scale + offsetX, y: point.y * scale + offsetY }));
}
