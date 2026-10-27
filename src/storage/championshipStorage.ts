import { CHAMPIONSHIP_POINTS, FASTEST_LAP_POINT } from '../game/gameConfig';
import type { RaceEngine } from '../game/RaceEngine';
import { getAvailableTracks } from '../tracks';
import type {
  ChampionshipStandingsEntry,
  ChampionshipState,
  Difficulty,
  PlayerCarSettings,
  WeatherPreset,
} from '../types/race';

const STORAGE_KEY = 'apex-strategy-championship-v1';

export interface ConstructorStanding {
  teamName: string;
  color: string;
  isPlayer: boolean;
  points: number;
  wins: number;
  podiums: number;
}

export function loadChampionship(): ChampionshipState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ChampionshipState;
    if (!parsed || typeof parsed.id !== 'string' || !Array.isArray(parsed.rounds)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveChampionship(state: ChampionshipState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function clearChampionship(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function createChampionship(options: {
  name: string;
  roundCount: number;
  lapsPerRace: number;
  difficulty: Difficulty;
  competitors: number;
  playerTeamName: string;
  playerCars: [PlayerCarSettings, PlayerCarSettings];
}): ChampionshipState {
  const allTracks = getAvailableTracks();
  const weatherPool: WeatherPreset[] = ['clear', 'clear', 'changeable', 'wet', 'changeable'];
  const rounds = Array.from({ length: options.roundCount }, (_, index) => {
    const track = allTracks[index % allTracks.length];
    return {
      trackId: track.id,
      laps: options.lapsPerRace,
      weatherPreset: weatherPool[index % weatherPool.length],
      completed: false,
    };
  });

  const state: ChampionshipState = {
    id: `champ-${Date.now().toString(36)}`,
    name: options.name.trim() || 'Copa Apex Mundial',
    difficulty: options.difficulty,
    competitors: options.competitors,
    currentRound: 0,
    rounds,
    standings: [],
    playerTeamName: options.playerTeamName.trim() || 'Equipe Apex',
    playerCars: structuredClone(options.playerCars),
  };

  saveChampionship(state);
  return state;
}

export function recordChampionshipRaceResult(
  championship: ChampionshipState,
  engine: RaceEngine,
): ChampionshipState {
  const updated = structuredClone(championship);
  const round = updated.rounds[updated.currentRound];
  if (!round || round.completed) return updated;

  const standingsMap = new Map<number, ChampionshipStandingsEntry>();
  for (const entry of updated.standings) {
    standingsMap.set(entry.carNumber, entry);
  }

  const fastestCarId = engine.state.fastestLapCarId;

  engine.state.cars.forEach((car) => {
    let entry = standingsMap.get(car.number);
    if (!entry) {
      entry = {
        driverName: car.name,
        carNumber: car.number,
        teamName: car.teamName,
        color: car.color,
        isPlayer: car.isPlayer,
        points: 0,
        wins: 0,
        podiums: 0,
        fastestLaps: 0,
      };
      standingsMap.set(car.number, entry);
    }

    const positionPoints = CHAMPIONSHIP_POINTS[car.position - 1] ?? 0;
    const fastestBonus = car.id === fastestCarId && car.position <= 10 ? FASTEST_LAP_POINT : 0;
    entry.points += positionPoints + fastestBonus;
    if (car.position === 1) entry.wins += 1;
    if (car.position <= 3) entry.podiums += 1;
    if (car.id === fastestCarId) entry.fastestLaps += 1;
  });

  updated.standings = [...standingsMap.values()].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.wins !== a.wins) return b.wins - a.wins;
    return b.podiums - a.podiums;
  });

  round.completed = true;
  round.winnerName = engine.state.cars[0]?.name ?? '—';
  if (updated.currentRound < updated.rounds.length - 1) {
    updated.currentRound += 1;
  }

  saveChampionship(updated);
  return updated;
}

export function getConstructorStandings(championship: ChampionshipState): ConstructorStanding[] {
  const byTeam = new Map<string, ConstructorStanding>();
  for (const driver of championship.standings) {
    let team = byTeam.get(driver.teamName);
    if (!team) {
      team = {
        teamName: driver.teamName,
        color: driver.color,
        isPlayer: driver.isPlayer,
        points: 0,
        wins: 0,
        podiums: 0,
      };
      byTeam.set(driver.teamName, team);
    }
    team.points += driver.points;
    team.wins += driver.wins;
    team.podiums += driver.podiums;
    if (driver.isPlayer) team.isPlayer = true;
  }
  return [...byTeam.values()].sort((a, b) => b.points - a.points || b.wins - a.wins);
}
