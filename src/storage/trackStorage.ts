import type { Track } from '../types/race';

const STORAGE_KEY = 'apex-strategy-custom-tracks-v1';
const MAX_CUSTOM_TRACKS = 12;

export function loadCustomTracks(): Track[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isStoredTrack).slice(0, MAX_CUSTOM_TRACKS);
  } catch {
    return [];
  }
}

export function saveCustomTrack(track: Track): void {
  const tracks = loadCustomTracks().filter((item) => item.id !== track.id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify([track, ...tracks].slice(0, MAX_CUSTOM_TRACKS)));
}

export function deleteCustomTrack(trackId: string): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(loadCustomTracks().filter((track) => track.id !== trackId)));
}

function isStoredTrack(value: unknown): value is Track {
  if (!value || typeof value !== 'object') return false;
  const track = value as Partial<Track>;
  return typeof track.id === 'string'
    && typeof track.name === 'string'
    && track.source === 'custom'
    && Array.isArray(track.points)
    && track.points.length >= 4
    && Array.isArray(track.blocks)
    && typeof track.length === 'number';
}
