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
    BLOCK_DEFINITIONS[block].steps.forEach((step) => {
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
  const corners = options.blocks.reduce((total, block) => total + BLOCK_DEFINITIONS[block].steps.filter((step) => step.turn !== 0).length, 0);
  const sharpCorners = options.blocks.filter((block) => block === 'left90' || block === 'right90').length;
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
