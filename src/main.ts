import './styles.css';
import { RaceEngine } from './game/RaceEngine';
import { loadChampionship, recordChampionshipRaceResult } from './storage/championshipStorage';
import { loadSettings, saveSettings } from './storage/settingsStorage';
import { getTrack } from './tracks';
import type { RaceSettings } from './types/race';
import { renderChampionshipScreen } from './ui/ChampionshipScreen';
import { renderMenu } from './ui/MenuScreen';
import { renderRaceSetup } from './ui/RaceSetup';
import { RaceView } from './ui/RaceView';
import { renderResults } from './ui/ResultsScreen';
import { renderSettings } from './ui/SettingsScreen';
import { renderTrackCreator } from './ui/TrackCreator';

class App {
  private readonly root: HTMLElement;
  private raceView: RaceView | null = null;
  private settings = loadSettings();
  private inChampionshipRace = false;

  constructor(root: HTMLElement) {
    this.root = root;
    document.documentElement.classList.toggle('reduced-motion', localStorage.getItem('apex-reduced-motion') === 'true');
    this.showMenu();
  }

  private mount(element: HTMLElement): void {
    this.raceView?.destroy();
    this.raceView = null;
    this.root.replaceChildren(element);
    window.scrollTo({ top: 0 });
  }

  private showMenu = (): void => {
    this.inChampionshipRace = false;
    this.mount(
      renderMenu(
        () => this.startRace(this.settings, false),
        this.showSetup,
        this.showTrackCreator,
        this.showSettings,
        this.showChampionship,
      ),
    );
  };

  private showChampionship = (): void => {
    this.inChampionshipRace = false;
    this.mount(
      renderChampionshipScreen(
        this.settings,
        (roundSettings) => this.startRace(roundSettings, true),
        this.showMenu,
      ),
    );
  };

  private showSetup = (): void => {
    this.inChampionshipRace = false;
    this.mount(
      renderRaceSetup(
        this.settings,
        (settings) => {
          this.settings = settings;
          saveSettings(settings);
          this.startRace(settings, false);
        },
        this.showMenu,
      ),
    );
  };

  private showSettings = (): void => {
    this.mount(renderSettings(this.showMenu));
  };

  private showTrackCreator = (): void => {
    this.mount(
      renderTrackCreator(this.showMenu, (trackId) => {
        this.settings = { ...this.settings, trackId };
        saveSettings(this.settings);
        this.showSetup();
      }),
    );
  };

  private startRace(settings: RaceSettings, isChampionship = false): void {
    this.inChampionshipRace = isChampionship;
    const engine = new RaceEngine(settings, getTrack(settings.trackId));
    const raceView = new RaceView(
      engine,
      isChampionship ? this.showChampionship : this.showMenu,
      (finishedEngine) => this.showResults(finishedEngine),
    );
    this.raceView = raceView;
    this.root.replaceChildren(raceView.element);
  }

  private showResults(engine: RaceEngine): void {
    if (this.inChampionshipRace) {
      const champ = loadChampionship();
      if (champ) {
        recordChampionshipRaceResult(champ, engine);
      }
    }
    this.mount(
      renderResults(
        engine,
        this.showSetup,
        () => this.startRace(this.settings, false),
        this.showMenu,
        this.inChampionshipRace ? this.showChampionship : undefined,
      ),
    );
  }
}

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('Elemento #app não encontrado');
new App(root);
