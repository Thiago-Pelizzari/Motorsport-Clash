import type { RaceSettings } from '../types/race';

const STORAGE_KEY = 'apex-strategy-race-settings-v1';

export const DEFAULT_SETTINGS: RaceSettings = {
  trackId: 'aurora',
  laps: 5,
  competitors: 10,
  difficulty: 'normal',
  playerCars: [
    { number: 44, tyre: 'soft' },
    { number: 16, tyre: 'medium' },
  ],
};

export function loadSettings(): RaceSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_SETTINGS);
    const value = JSON.parse(raw) as Partial<RaceSettings>;
    if (!value.playerCars || value.playerCars.length !== 2) return structuredClone(DEFAULT_SETTINGS);
    return { ...structuredClone(DEFAULT_SETTINGS), ...value } as RaceSettings;
  } catch {
    return structuredClone(DEFAULT_SETTINGS);
  }
}

export function saveSettings(settings: RaceSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
