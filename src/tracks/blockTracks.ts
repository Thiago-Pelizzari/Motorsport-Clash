import type { Track, TrackBlockType } from '../types/race';
import { createTrackFromBlocks } from './blockBuilder';

export interface TrackTemplate {
  id: string;
  name: string;
  tagline: string;
  blocks: TrackBlockType[];
}

export const TRACK_TEMPLATES: TrackTemplate[] = [
  {
    id: 'prism',
    name: 'Prisma Sprint',
    tagline: 'Retas fortes e quatro cotovelos',
    blocks: ['straight', 'right90', 'straight', 'right90', 'straight', 'right90', 'straight', 'right90'],
  },
  {
    id: 'solaris',
    name: 'Anel Solaris',
    tagline: 'Oito curvas rápidas e ritmo constante',
    blocks: ['straight', 'right45', 'straight', 'right45', 'straight', 'right45', 'straight', 'right45', 'straight', 'right45', 'straight', 'right45', 'straight', 'right45', 'straight', 'right45'],
  },
  {
    id: 'vector',
    name: 'Desafio Vector',
    tagline: 'Chicanes e mudanças de direção',
    blocks: ['straight', 'right90', 'short', 'chicaneLeft', 'straight', 'left45', 'short', 'right90', 'straight', 'right45', 'chicaneRight', 'right90', 'straight', 'right90'],
  },
];

export const BLOCK_TRACKS: Track[] = [
  createTrackFromBlocks({
    id: 'prism', name: 'Circuito Prisma', location: 'Distrito Neon', description: 'Quatro setores definidos e frenagens fortes favorecem ultrapassagens.',
    blocks: TRACK_TEMPLATES[0].blocks, length: 2680, averageSpeed: 194, tyreWear: 0.88, overtakeChance: 0.82, accent: '#c8ff38', source: 'blocks',
  }),
  createTrackFromBlocks({
    id: 'solaris', name: 'Anel Solaris', location: 'Planície Solar', description: 'Um anel veloz de curvas longas onde conservar embalo é essencial.',
    blocks: TRACK_TEMPLATES[1].blocks, length: 4120, averageSpeed: 207, tyreWear: 1.02, overtakeChance: 0.68, accent: '#ffb627', source: 'blocks',
  }),
  createTrackFromBlocks({
    id: 'vector', name: 'Circuito Vector', location: 'Cânion de Cobalto', description: 'Mudanças de direção e chicanes castigam pneus e pilotos.',
    blocks: TRACK_TEMPLATES[2].blocks, length: 3370, averageSpeed: 164, tyreWear: 1.25, overtakeChance: 0.48, accent: '#8b7cff', source: 'blocks',
  }),
];
