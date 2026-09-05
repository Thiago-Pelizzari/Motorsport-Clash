import type { Track } from '../types/race';
import { loadCustomTracks } from '../storage/trackStorage';
import { BLOCK_TRACKS } from './blockTracks';

export const TRACKS: Track[] = [
  {
    id: 'aurora',
    name: 'Circuito Aurora',
    location: 'Vale Boreal',
    description: 'Rápido e fluido, com duas grandes zonas de ultrapassagem.',
    length: 3200,
    corners: 11,
    difficulty: 2,
    averageSpeed: 188,
    tyreWear: 0.92,
    overtakeChance: 0.72,
    accent: '#4de2ff',
    points: [
      { x: 230, y: 510 }, { x: 115, y: 415 }, { x: 130, y: 235 }, { x: 245, y: 105 },
      { x: 475, y: 78 }, { x: 610, y: 165 }, { x: 805, y: 132 }, { x: 895, y: 265 },
      { x: 825, y: 430 }, { x: 645, y: 470 }, { x: 500, y: 555 }, { x: 345, y: 520 },
    ],
  },
  {
    id: 'coast',
    name: 'Circuito Costa Azul',
    location: 'Baía Celeste',
    description: 'Retas costeiras e curvas fechadas recompensam carros versáteis.',
    length: 3650,
    corners: 14,
    difficulty: 3,
    averageSpeed: 178,
    tyreWear: 1.05,
    overtakeChance: 0.61,
    accent: '#21e6a8',
    points: [
      { x: 175, y: 490 }, { x: 100, y: 345 }, { x: 170, y: 175 }, { x: 360, y: 115 },
      { x: 490, y: 190 }, { x: 600, y: 105 }, { x: 835, y: 120 }, { x: 920, y: 275 },
      { x: 820, y: 365 }, { x: 665, y: 330 }, { x: 585, y: 445 }, { x: 420, y: 520 },
      { x: 295, y: 430 },
    ],
  },
  {
    id: 'mountain',
    name: 'Circuito Montanha',
    location: 'Serra Rubra',
    description: 'Técnico e exigente: ritmo constante e pneus bem cuidados vencem.',
    length: 2890,
    corners: 17,
    difficulty: 5,
    averageSpeed: 159,
    tyreWear: 1.22,
    overtakeChance: 0.43,
    accent: '#ff5a52',
    points: [
      { x: 220, y: 500 }, { x: 105, y: 420 }, { x: 185, y: 315 }, { x: 110, y: 185 },
      { x: 285, y: 95 }, { x: 405, y: 175 }, { x: 520, y: 82 }, { x: 690, y: 135 },
      { x: 650, y: 255 }, { x: 850, y: 210 }, { x: 915, y: 350 }, { x: 770, y: 455 },
      { x: 625, y: 395 }, { x: 535, y: 530 }, { x: 370, y: 465 },
    ],
  },
];

export function getAvailableTracks(): Track[] {
  return [...TRACKS, ...BLOCK_TRACKS, ...loadCustomTracks()];
}

export function getTrack(id: string): Track {
  return getAvailableTracks().find((track) => track.id === id) ?? TRACKS[0];
}
