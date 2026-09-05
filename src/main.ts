import './styles.css';
import { RaceEngine } from './game/RaceEngine';
import { getTrack } from './tracks';
import type { RaceSettings } from './types/race';
import { loadSettings, saveSettings } from './storage/settingsStorage';
import { renderMenu } from './ui/MenuScreen';
import { renderRaceSetup } from './ui/RaceSetup';
import { RaceView } from './ui/RaceView';
import { renderResults } from './ui/ResultsScreen';
import { renderSettings } from './ui/SettingsScreen';

class App {
  private readonly root: HTMLElement;
  private raceView: RaceView | null = null;
  private settings = loadSettings();

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
    this.mount(renderMenu(() => this.startRace(this.settings), this.showSetup, this.showSettings));
  };

  private showSetup = (): void => {
    this.mount(renderRaceSetup(this.settings, (settings) => {
      this.settings = settings;
      saveSettings(settings);
      this.startRace(settings);
    }, this.showMenu));
  };

  private showSettings = (): void => {
    this.mount(renderSettings(this.showMenu));
  };

  private startRace(settings: RaceSettings): void {
    const engine = new RaceEngine(settings, getTrack(settings.trackId));
    const raceView = new RaceView(engine, this.showMenu, (finishedEngine) => this.showResults(finishedEngine));
    this.raceView = raceView;
    this.root.replaceChildren(raceView.element);
  }

  private showResults(engine: RaceEngine): void {
    this.mount(renderResults(engine, this.showSetup, () => this.startRace(this.settings), this.showMenu));
  }
}

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('Elemento #app não encontrado');
new App(root);
