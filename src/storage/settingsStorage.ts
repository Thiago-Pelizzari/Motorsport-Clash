import type { RaceSettings } from '../types/race';

const STORAGE_KEY = 'apex-strategy-race-settings-v1';

export const DEFAULT_SETTINGS: RaceSettings = {
  trackId: 'aurora',
  laps: 5,
  competitors: 10,
  difficulty: 'normal',
  teamName: 'Equipe Apex',
  weatherPreset: 'clear',
  qualifyingMode: 'front_row',
  playerCars: [
    { number: 44, tyre: 'soft', driverName: 'Você · Equipe Apex' },
    { number: 16, tyre: 'medium', driverName: 'Você · Equipe Nova' },
  ],
};

export function loadSettings(): RaceSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_SETTINGS);
    const value = JSON.parse(raw) as Partial<RaceSettings>;
    if (!value.playerCars || value.playerCars.length !== 2) return structuredClone(DEFAULT_SETTINGS);
    return {
      ...structuredClone(DEFAULT_SETTINGS),
      ...value,
      playerCars: [
        { ...DEFAULT_SETTINGS.playerCars[0], ...value.playerCars[0] },
        { ...DEFAULT_SETTINGS.playerCars[1], ...value.playerCars[1] },
      ],
    } as RaceSettings;
  } catch {
    return structuredClone(DEFAULT_SETTINGS);
  }
}

export function saveSettings(settings: RaceSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
