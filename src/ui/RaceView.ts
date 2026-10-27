import { soundEngine } from '../audio/SoundEngine';
import { FLAG_CONFIG, GAME_CONFIG, STRATEGIES, TYRES, WEATHER_LABELS } from '../game/gameConfig';
import { RaceEngine } from '../game/RaceEngine';
import type { CarState, SimulationSpeed, StrategyMode, TyreType } from '../types/race';
import { escapeHtml } from '../utils/dom';
import { formatGap, formatInterval, formatTime } from '../utils/format';
import { TrackCanvas } from './TrackCanvas';

interface LeaderRowRefs {
  root: HTMLButtonElement;
  pos: HTMLElement;
  dot: HTMLElement;
  name: HTMLElement;
  meta: HTMLElement;
  time: HTMLElement;
}

interface StrategyCardRefs {
  root: HTMLElement;
  posLabel: HTMLElement;
  telemetryMeta: HTMLElement;
  tyreRing: HTMLElement;
  tyreName: HTMLElement;
  tyrePct: HTMLElement;
  wearFill: HTMLElement;
  ersFill: HTMLElement;
  ersPct: HTMLElement;
  ersButton: HTMLButtonElement;
  modeButtons: Map<StrategyMode, HTMLButtonElement>;
  pitSelect: HTMLSelectElement;
  repairButton: HTMLButtonElement;
  pitButton: HTMLButtonElement;
}

export class RaceView {
  readonly element: HTMLElement;
  private readonly engine: RaceEngine;
  private readonly renderer: TrackCanvas;
  private readonly onFinished: (engine: RaceEngine) => void;
  private animationFrame = 0;
  private previousTime = performance.now();
  private accumulator = 0;
  private hudTimer = 0;
  private finishedNotified = false;
  private lastSpeed: Exclude<SimulationSpeed, 0> = 1;
  private readonly pitSelections = new Map<string, TyreType>();
  private readonly leaderRows = new Map<string, LeaderRowRefs>();
  private readonly strategyCards = new Map<string, StrategyCardRefs>();
  private selectedCarId: string | null = null;
  private followingSelectedCar = false;
  private showIntervalGap = false;
  private lastSeenEventId: string | null = null;

  constructor(engine: RaceEngine, onExit: () => void, onFinished: (engine: RaceEngine) => void) {
    this.engine = engine;
    this.onFinished = onFinished;
    this.element = document.createElement('main');
    this.element.className = 'race-screen';
    this.element.innerHTML = `
      <header class="race-topbar">
        <div class="race-brand">APEX <em>STRATEGY</em></div>
        <div class="race-title">
          <span>${escapeHtml(engine.track.location)}</span>
          <strong>${escapeHtml(engine.track.name)}</strong>
        </div>
        <div class="race-weather-bar" data-weather-bar>
          <span class="flag-pill" data-flag-pill>PISTA LIVRE</span>
          <span class="weather-pill" data-weather-pill>☀ Pista Seca · 0%</span>
          <span class="forecast-pill" data-forecast-pill title="Previsão meteorológica">Prev: ☀</span>
        </div>
        <div class="lap-counter"><span>VOLTA</span><strong data-current-lap>1</strong><i>/</i><b>${engine.state.totalLaps}</b></div>
        <button class="icon-button" type="button" data-exit aria-label="Sair da corrida">×</button>
      </header>
      <div class="race-layout">
        <section class="track-stage">
          <canvas class="race-canvas" aria-label="Visualização da corrida"></canvas>
          <div class="live-badge"><i></i> AO VIVO</div>
          <div class="event-toast" data-event></div>
          <div class="camera-tools" aria-label="Controles de zoom">
            <button type="button" data-camera="follow" data-follow-toggle aria-label="Seguir piloto selecionado" disabled>◎</button>
            <button type="button" data-camera="zoom-out" aria-label="Diminuir zoom">−</button>
            <button type="button" class="zoom-readout" data-camera="reset" data-zoom aria-label="Enquadrar pista">100%</button>
            <button type="button" data-camera="zoom-in" aria-label="Aumentar zoom">＋</button>
          </div>
          <div class="camera-follow-status" data-follow-status hidden><i></i><span>SEGUINDO</span><b></b></div>
          <div class="camera-hint">CLIQUE NO CARRO OU RANKING: SEGUIR · ESPAÇO: PAUSA · 1/2/3: VELOCIDADE</div>
          <div class="track-data">
            <span>${(engine.track.length / 1000).toFixed(2)} KM</span>
            <span>${engine.track.corners} CURVAS</span>
            <span data-fastest-lap-banner>MELHOR VOLTA: —</span>
          </div>
        </section>
        <aside class="race-sidebar">
          <section class="leaderboard-panel">
            <div class="panel-title">
              <h2>CLASSIFICAÇÃO</h2>
              <span data-race-time>0:00.000</span>
            </div>
            <div class="leaderboard-head">
              <span>POS</span>
              <span>PILOTO / PNEU</span>
              <button type="button" class="gap-mode-toggle" data-toggle-gap title="Alternar entre diferença para o líder e intervalo">LÍDER ⇄</button>
            </div>
            <div class="leaderboard" data-leaderboard></div>
          </section>
          <section class="strategy-section">
            <div class="panel-title"><h2>SUA EQUIPE</h2><span>TELEMETRIA & BOX</span></div>
            <div data-strategy-panels></div>
          </section>
          <section class="radio-section">
            <div class="panel-title"><h2>RÁDIO DE CORRIDA</h2><span>HISTÓRICO</span></div>
            <div class="radio-log" data-radio-log></div>
          </section>
        </aside>
      </div>
      <footer class="race-controls">
        <div class="control-label"><span>VELOCIDADE DA SIMULAÇÃO</span><small>Atalhos: Espaço (Pausa) · 1/2/3 (Velocidade) · QWE/ASD (Ritmo)</small></div>
        <div class="speed-controls" role="group" aria-label="Velocidade da simulação">
          <button data-speed="0" aria-label="Pausar">Ⅱ</button>
          <button data-speed="1" class="is-active">1×</button>
          <button data-speed="2">2×</button>
          <button data-speed="4">4×</button>
        </div>
      </footer>
    `;

    const canvas = this.element.querySelector<HTMLCanvasElement>('canvas')!;
    this.renderer = new TrackCanvas(
      canvas,
      engine.track,
      (zoom) => this.updateZoomReadout(zoom),
      (following) => {
        this.followingSelectedCar = following;
        this.updateFollowUi();
      },
      (carId) => this.selectPilot(carId),
    );

    engine.state.cars
      .filter((car) => car.isPlayer)
      .forEach((car) => this.pitSelections.set(car.id, car.tyreType));

    this.initLeaderboardDOM();
    this.initStrategyPanelsDOM();
    this.lastSeenEventId = engine.state.eventLog[0]?.id ?? null;

    this.element.querySelector('[data-exit]')?.addEventListener('click', onExit);
    this.element.addEventListener('click', (event) => this.handleClick(event));
    this.element.addEventListener('change', (event) => this.handleChange(event));
    window.addEventListener('keydown', this.handleKeyDown);

    this.engine.start();
    this.renderHud();
    this.animationFrame = requestAnimationFrame((time) => this.loop(time));
  }

  destroy(): void {
    cancelAnimationFrame(this.animationFrame);
    window.removeEventListener('keydown', this.handleKeyDown);
    this.renderer.destroy();
  }

  private loop(time: number): void {
    const frameDelta = Math.min((time - this.previousTime) / 1000, GAME_CONFIG.maxFrameDelta);
    this.previousTime = time;
    this.accumulator += frameDelta;
    while (this.accumulator >= GAME_CONFIG.fixedStep) {
      this.engine.update(GAME_CONFIG.fixedStep);
      this.accumulator -= GAME_CONFIG.fixedStep;
    }
    this.renderer.draw(this.engine.state);
    this.hudTimer += frameDelta;
    if (this.hudTimer >= 0.1) {
      this.renderHud();
      this.hudTimer = 0;
    }
    if (this.engine.state.phase === 'finished' && !this.finishedNotified) {
      this.finishedNotified = true;
      soundEngine.playCheckeredFlag();
      this.renderHud();
      window.setTimeout(() => this.onFinished(this.engine), 900);
      return;
    }
    this.animationFrame = requestAnimationFrame((nextTime) => this.loop(nextTime));
  }

  private handleKeyDown = (event: KeyboardEvent): void => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return;
    const key = event.key.toLowerCase();
    const playerCars = this.engine.state.cars.filter((c) => c.isPlayer);

    if (event.code === 'Space') {
      event.preventDefault();
      this.togglePause();
    } else if (key === '1') {
      this.setSpeed(1);
    } else if (key === '2') {
      this.setSpeed(2);
    } else if (key === '3' || key === '4') {
      this.setSpeed(4);
    } else if (key === 'f' && this.selectedCarId) {
      if (this.followingSelectedCar) this.renderer.stopFollowing();
      else this.renderer.followCar(this.selectedCarId);
    } else if (key === 'r' || key === '0') {
      this.renderer.resetView();
    } else if (key === '+' || key === '=') {
      this.renderer.zoomIn();
    } else if (key === '-') {
      this.renderer.zoomOut();
    } else if ((key === 'q' || key === 'w' || key === 'e') && playerCars[0]) {
      const mode: StrategyMode = key === 'q' ? 'conserve' : key === 'w' ? 'normal' : 'attack';
      this.engine.setStrategy(playerCars[0].id, mode);
      soundEngine.playUiClick();
      this.updateStrategyPanelsDOM();
    } else if ((key === 'a' || key === 's' || key === 'd') && playerCars[1]) {
      const mode: StrategyMode = key === 'a' ? 'conserve' : key === 's' ? 'normal' : 'attack';
      this.engine.setStrategy(playerCars[1].id, mode);
      soundEngine.playUiClick();
      this.updateStrategyPanelsDOM();
    }
  };

  private togglePause(): void {
    if (this.engine.state.simulationSpeed === 0) {
      this.engine.setSimulationSpeed(this.lastSpeed);
    } else {
      this.lastSpeed = this.engine.state.simulationSpeed as Exclude<SimulationSpeed, 0>;
      this.engine.setSimulationSpeed(0);
    }
    soundEngine.playUiClick();
    this.renderHud();
  }

  private setSpeed(speed: Exclude<SimulationSpeed, 0>): void {
    this.lastSpeed = speed;
    this.engine.setSimulationSpeed(speed);
    soundEngine.playUiClick();
    this.renderHud();
  }

  private handleClick(event: Event): void {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
    if (!button) return;

    if (button.dataset.toggleGap !== undefined) {
      this.showIntervalGap = !this.showIntervalGap;
      button.textContent = this.showIntervalGap ? 'INT. ⇄' : 'LÍDER ⇄';
      soundEngine.playUiClick();
      this.updateLeaderboardDOM();
      return;
    }

    const cameraAction = button.dataset.camera;
    if (cameraAction) {
      if (cameraAction === 'zoom-in') this.renderer.zoomIn();
      if (cameraAction === 'zoom-out') this.renderer.zoomOut();
      if (cameraAction === 'reset') this.renderer.resetView();
      if (cameraAction === 'follow' && this.selectedCarId) {
        if (this.followingSelectedCar) this.renderer.stopFollowing();
        else this.renderer.followCar(this.selectedCarId);
      }
      soundEngine.playUiClick();
      return;
    }

    const selectedCarId = button.dataset.selectCar;
    if (selectedCarId) {
      this.selectPilot(selectedCarId);
      soundEngine.playUiClick();
      return;
    }

    if (button.dataset.speed !== undefined) {
      const speed = Number(button.dataset.speed) as SimulationSpeed;
      if (speed === 0) this.togglePause();
      else this.setSpeed(speed);
      return;
    }

    const carId = button.dataset.carId;
    const strategy = button.dataset.strategy as StrategyMode | undefined;
    if (carId && strategy) {
      this.engine.setStrategy(carId, strategy);
      soundEngine.playUiClick();
      this.updateStrategyPanelsDOM();
      return;
    }

    if (carId && button.dataset.action === 'ers') {
      this.engine.toggleErs(carId);
      soundEngine.playUiClick();
      this.updateStrategyPanelsDOM();
      return;
    }

    if (carId && button.dataset.action === 'repair') {
      const car = this.engine.state.cars.find((item) => item.id === carId);
      if (car) {
        this.engine.setPitRepair(carId, !car.pendingPitRepair);
        soundEngine.playUiClick();
        this.updateStrategyPanelsDOM();
      }
      return;
    }

    if (carId && button.dataset.action === 'pit') {
      const car = this.engine.state.cars.find((item) => item.id === carId);
      if (car?.pendingPitTyre) {
        this.engine.cancelPitStop(carId);
        soundEngine.playUiClick();
      } else {
        this.engine.requestPitStop(carId, this.pitSelections.get(carId) ?? 'medium', car?.pendingPitRepair);
        soundEngine.playRadioBeep();
      }
      this.updateStrategyPanelsDOM();
      return;
    }
  }

  private handleChange(event: Event): void {
    const select = (event.target as HTMLElement).closest<HTMLSelectElement>('select[data-pit-tyre]');
    if (select?.dataset.carId) {
      this.pitSelections.set(select.dataset.carId, select.value as TyreType);
      const car = this.engine.state.cars.find((item) => item.id === select.dataset.carId);
      if (car?.pendingPitTyre) {
        this.engine.requestPitStop(car.id, select.value as TyreType, car.pendingPitRepair);
      }
    }
  }

  private updateZoomReadout(zoom: number): void {
    const readout = this.element.querySelector<HTMLElement>('[data-zoom]');
    if (readout) readout.textContent = `${Math.round(zoom * 100)}%`;
  }

  private initLeaderboardDOM(): void {
    const container = this.element.querySelector<HTMLElement>('[data-leaderboard]');
    if (!container) return;
    container.innerHTML = '';

    for (const car of this.engine.state.cars) {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = `leader-row ${car.isPlayer ? 'is-player' : ''}`;
      row.dataset.selectCar = car.id;
      row.style.setProperty('--car-color', car.color);
      row.setAttribute('aria-label', `Selecionar e seguir ${car.name}, carro ${car.number}`);

      const pos = document.createElement('strong');
      const dot = document.createElement('span');
      dot.className = 'leader-dot';
      dot.style.setProperty('--car-color', car.color);
      dot.textContent = String(car.number);

      const infoWrap = document.createElement('div');
      const name = document.createElement('b');
      name.textContent = car.name;
      const meta = document.createElement('small');
      infoWrap.append(name, meta);

      const time = document.createElement('time');
      row.append(pos, dot, infoWrap, time);
      container.appendChild(row);

      this.leaderRows.set(car.id, { root: row, pos, dot, name, meta, time });
    }
  }

  private initStrategyPanelsDOM(): void {
    const container = this.element.querySelector<HTMLElement>('[data-strategy-panels]');
    if (!container) return;
    container.innerHTML = '';

    const playerCars = this.engine.state.cars.filter((car) => car.isPlayer);
    for (const car of playerCars) {
      const card = document.createElement('article');
      card.className = 'strategy-card';
      card.style.setProperty('--car-color', car.color);
      const pitSelection = this.pitSelections.get(car.id) ?? car.tyreType;

      card.innerHTML = `
        <div class="strategy-car">
          <span>#${car.number}</span>
          <div>
            <b data-ref="pos">1º LUGAR</b>
            <small data-ref="meta">0 km/h · carro 100%</small>
          </div>
          <button type="button" class="ers-toggle-btn" data-action="ers" data-car-id="${car.id}" title="Ativar/Desativar potência extra ERS">⚡ ERS</button>
        </div>
        <div class="tyre-status">
          <span class="tyre-ring" data-ref="tyre-ring"></span>
          <div>
            <small data-ref="tyre-name">PNEU MACIO</small>
            <strong data-ref="tyre-pct">100%</strong>
          </div>
          <div class="wear-bar"><i data-ref="wear-fill"></i></div>
        </div>
        <div class="ers-bar-row">
          <small>BATERIA ERS</small>
          <div class="ers-bar"><i data-ref="ers-fill"></i></div>
          <span data-ref="ers-pct">100%</span>
        </div>
        <div class="mode-buttons">
          ${(Object.entries(STRATEGIES) as [StrategyMode, (typeof STRATEGIES)[StrategyMode]][])
            .map(([mode, config]) => `<button type="button" data-car-id="${car.id}" data-strategy="${mode}">${config.label}</button>`)
            .join('')}
        </div>
        <div class="pit-controls">
          <select data-pit-tyre data-car-id="${car.id}" aria-label="Próximo pneu">
            ${(Object.entries(TYRES) as [TyreType, (typeof TYRES)[TyreType]][])
              .map(([key, config]) => `<option value="${key}" ${key === pitSelection ? 'selected' : ''}>● ${config.label} (${config.shortLabel})</option>`)
              .join('')}
          </select>
          <button type="button" class="repair-btn" data-action="repair" data-car-id="${car.id}" title="Reparar avarias no próximo pit stop (+2.8s)">🔧</button>
          <button type="button" class="pit-btn" data-action="pit" data-car-id="${car.id}">ENTRAR NOS BOXES</button>
        </div>
      `;

      const modeButtons = new Map<StrategyMode, HTMLButtonElement>();
      card.querySelectorAll<HTMLButtonElement>('[data-strategy]').forEach((btn) => {
        modeButtons.set(btn.dataset.strategy as StrategyMode, btn);
      });

      this.strategyCards.set(car.id, {
        root: card,
        posLabel: card.querySelector<HTMLElement>('[data-ref="pos"]')!,
        telemetryMeta: card.querySelector<HTMLElement>('[data-ref="meta"]')!,
        tyreRing: card.querySelector<HTMLElement>('[data-ref="tyre-ring"]')!,
        tyreName: card.querySelector<HTMLElement>('[data-ref="tyre-name"]')!,
        tyrePct: card.querySelector<HTMLElement>('[data-ref="tyre-pct"]')!,
        wearFill: card.querySelector<HTMLElement>('[data-ref="wear-fill"]')!,
        ersFill: card.querySelector<HTMLElement>('[data-ref="ers-fill"]')!,
        ersPct: card.querySelector<HTMLElement>('[data-ref="ers-pct"]')!,
        ersButton: card.querySelector<HTMLButtonElement>('[data-action="ers"]')!,
        modeButtons,
        pitSelect: card.querySelector<HTMLSelectElement>('select[data-pit-tyre]')!,
        repairButton: card.querySelector<HTMLButtonElement>('[data-action="repair"]')!,
        pitButton: card.querySelector<HTMLButtonElement>('[data-action="pit"]')!,
      });

      container.appendChild(card);
    }
  }

  private renderHud(): void {
    const { state } = this.engine;
    const leader = state.cars[0];
    const currentLap = Math.min(state.totalLaps, Math.max(1, leader.lap + 1));

    const lapElement = this.element.querySelector<HTMLElement>('[data-current-lap]');
    if (lapElement) lapElement.textContent = String(currentLap);

    const timeElement = this.element.querySelector<HTMLElement>('[data-race-time]');
    if (timeElement) timeElement.textContent = formatTime(state.elapsedTime);

    const eventElement = this.element.querySelector<HTMLElement>('[data-event]');
    if (eventElement) {
      eventElement.textContent = state.eventMessage;
      eventElement.classList.toggle('is-visible', state.eventMessageUntil > state.elapsedTime);
    }

    // Weather & Flag status bar
    const flagPill = this.element.querySelector<HTMLElement>('[data-flag-pill]');
    if (flagPill) {
      const flagCfg = FLAG_CONFIG[state.flag];
      flagPill.textContent = flagCfg.label;
      flagPill.style.setProperty('--flag-color', flagCfg.color);
      flagPill.className = `flag-pill flag-pill--${state.flag}`;
    }

    const weatherPill = this.element.querySelector<HTMLElement>('[data-weather-pill]');
    if (weatherPill) {
      const wInfo = WEATHER_LABELS[state.weather.condition];
      const wetPct = Math.round(state.weather.trackWetness * 100);
      weatherPill.textContent = `${wInfo.icon} ${wInfo.label} · Água ${wetPct}% · ${Math.round(state.weather.trackTemp)}°C`;
    }

    const forecastPill = this.element.querySelector<HTMLElement>('[data-forecast-pill]');
    if (forecastPill) {
      const icons = state.weather.forecast.map((c) => WEATHER_LABELS[c].icon).join(' → ');
      forecastPill.textContent = `Prev: ${icons}`;
    }

    const fastestBanner = this.element.querySelector<HTMLElement>('[data-fastest-lap-banner]');
    if (fastestBanner) {
      if (state.fastestLapCarId && state.fastestLapTime !== null) {
        const holder = state.cars.find((c) => c.id === state.fastestLapCarId);
        fastestBanner.textContent = `VR: #${holder?.number ?? '?'} (${formatTime(state.fastestLapTime)})`;
      } else {
        fastestBanner.textContent = 'MELHOR VOLTA: —';
      }
    }

    this.checkAudioTriggers();
    this.updateLeaderboardDOM();
    this.updateStrategyPanelsDOM();
    this.updateRadioLogDOM();
    this.updateFollowUi();

    this.element.querySelectorAll<HTMLButtonElement>('[data-speed]').forEach((button) => {
      const speed = Number(button.dataset.speed);
      button.classList.toggle('is-active', speed === state.simulationSpeed || (speed === 0 && state.simulationSpeed === 0));
      if (speed === 0) button.textContent = state.simulationSpeed === 0 ? '▶' : 'Ⅱ';
    });
  }

  private checkAudioTriggers(): void {
    const latest = this.engine.state.eventLog[0];
    if (!latest || latest.id === this.lastSeenEventId) return;
    this.lastSeenEventId = latest.id;

    if (latest.type === 'pit') soundEngine.playPitStop();
    else if (latest.type === 'fastest_lap') soundEngine.playFastestLap();
    else if (latest.type === 'flag' || latest.type === 'weather') soundEngine.playFlagAlert();
  }

  private updateLeaderboardDOM(): void {
    const container = this.element.querySelector<HTMLElement>('[data-leaderboard]');
    if (!container) return;
    const { cars, totalLaps, fastestLapCarId } = this.engine.state;
    const leader = cars[0];

    cars.forEach((car, index) => {
      const refs = this.leaderRows.get(car.id);
      if (!refs) return;

      if (container.children[index] !== refs.root) {
        container.insertBefore(refs.root, container.children[index] ?? null);
      }

      refs.root.classList.toggle('is-selected', car.id === this.selectedCarId);
      refs.root.classList.toggle('is-fastest', car.id === fastestLapCarId);
      refs.pos.textContent = String(car.position);

      const referenceCar: CarState = this.showIntervalGap && index > 0 ? cars[index - 1] : leader;
      const refTime = referenceCar.finishTime ?? referenceCar.totalTime;
      const distanceGap = Math.max(0, referenceCar.distance - car.distance);
      const estimatedGap = distanceGap / Math.max(25, (referenceCar.speed || this.engine.track.averageSpeed) / 3.6);
      const gap = car.finished && referenceCar.finished ? (car.finishTime ?? refTime) - refTime : estimatedGap;

      let statusText: string;
      if (car.pitTimeRemaining > 0) statusText = 'BOX';
      else if (car.pitState === 'entering') statusText = 'PIT IN';
      else if (car.finished) statusText = 'FIM';
      else if (index === 0) statusText = 'LÍDER';
      else statusText = this.showIntervalGap ? formatInterval(gap) : formatGap(gap);

      const tyre = TYRES[car.tyreType];
      const deltaGrid = car.gridPosition - car.position;
      const deltaBadge = deltaGrid > 0 ? ` ▲${deltaGrid}` : deltaGrid < 0 ? ` ▼${Math.abs(deltaGrid)}` : '';
      const stopsTag = car.pitStops.length > 0 ? ` · ${car.pitStops.length}P` : '';
      const vrTag = car.id === fastestLapCarId ? ' · 🟣VR' : '';
      const contactTag = car.collisionCooldown > 0 ? ' · 💥' : '';

      refs.meta.textContent = `V${Math.min(totalLaps, car.lap + 1)} · ${tyre.shortLabel} (${Math.round(car.tyreCondition * 100)}%)${stopsTag}${deltaBadge}${vrTag}${contactTag}`;
      refs.time.textContent = statusText;
    });
  }

  private updateStrategyPanelsDOM(): void {
    const playerCars = this.engine.state.cars.filter((car) => car.isPlayer);
    for (const car of playerCars) {
      const refs = this.strategyCards.get(car.id);
      if (!refs) continue;

      const tyre = TYRES[car.tyreType];
      const tyrePctNum = Math.round(car.tyreCondition * 100);
      const tempCelsius = Math.round(55 + car.tyreTemperature * 60);
      const tempLabel = car.tyreTemperature < 0.55 ? 'Frio' : car.tyreTemperature > 0.9 ? 'Quente!' : 'Ideal';

      refs.posLabel.textContent = `${car.position}º LUGAR ${car.inSlipstream ? '· VÁCUO' : ''}`;
      refs.telemetryMeta.textContent = `${Math.round(car.speed)} km/h · Comb. ${car.fuelLoad.toFixed(1)}kg · Casco ${Math.round(car.condition * 100)}%`;

      refs.tyreRing.style.setProperty('--tyre-color', tyre.color);
      refs.tyreRing.style.setProperty('--life', `${tyrePctNum * 3.6}deg`);
      refs.tyreName.textContent = `PNEU ${tyre.label.toUpperCase()} (${tempCelsius}°C ${tempLabel})`;
      refs.tyrePct.textContent = `${tyrePctNum}%`;
      refs.wearFill.style.width = `${tyrePctNum}%`;
      refs.wearFill.style.background = tyre.color;

      const ersPctNum = Math.round(car.ersCharge * 100);
      refs.ersFill.style.width = `${ersPctNum}%`;
      refs.ersPct.textContent = `${ersPctNum}%`;
      refs.ersButton.classList.toggle('is-active', car.ersDeploy);
      refs.ersButton.disabled = car.finished || (car.ersCharge < 0.05 && !car.ersDeploy);

      for (const [mode, btn] of refs.modeButtons.entries()) {
        btn.classList.toggle('is-active', car.strategyMode === mode);
        btn.disabled = car.finished;
      }

      refs.pitSelect.disabled = Boolean(car.pendingPitTyre) || car.pitTimeRemaining > 0 || car.finished;
      refs.repairButton.classList.toggle('is-active', car.pendingPitRepair);
      refs.repairButton.disabled = car.pitTimeRemaining > 0 || car.finished || car.condition >= 0.99;

      refs.pitButton.disabled = car.pitTimeRemaining > 0 || car.finished;
      refs.pitButton.classList.toggle('is-pending', Boolean(car.pendingPitTyre));
      refs.pitButton.textContent =
        car.pitTimeRemaining > 0
          ? `BOXES ${car.pitTimeRemaining.toFixed(1)}s`
          : car.pendingPitTyre
            ? `CANCELAR (${TYRES[car.pendingPitTyre].shortLabel})`
            : 'ENTRAR NOS BOXES';
    }
  }

  private updateRadioLogDOM(): void {
    const container = this.element.querySelector<HTMLElement>('[data-radio-log]');
    if (!container) return;
    const events = this.engine.state.eventLog.slice(0, 8);
    const signature = events.map((e) => e.id).join(',');
    if (container.dataset.sig === signature) return;
    container.dataset.sig = signature;

    container.innerHTML = events
      .map(
        (evt) => `
        <div class="radio-item radio-item--${evt.type}">
          <span>V${evt.lap}</span>
          <p>${escapeHtml(evt.message)}</p>
        </div>`,
      )
      .join('');
  }

  private selectPilot(carId: string): void {
    if (!this.engine.state.cars.some((car) => car.id === carId)) return;
    this.selectedCarId = carId;
    this.followingSelectedCar = true;
    this.renderer.followCar(carId);
    this.updateLeaderboardDOM();
    this.updateFollowUi();
  }

  private updateFollowUi(): void {
    const car = this.engine.state.cars.find((candidate) => candidate.id === this.selectedCarId);
    const toggle = this.element.querySelector<HTMLButtonElement>('[data-follow-toggle]');
    if (toggle) {
      toggle.disabled = !car;
      toggle.classList.toggle('is-active', Boolean(car && this.followingSelectedCar));
      toggle.title = car
        ? this.followingSelectedCar
          ? `Parar de seguir #${car.number}`
          : `Seguir #${car.number}`
        : 'Selecione um piloto no leaderboard ou pista';
    }
    const status = this.element.querySelector<HTMLElement>('[data-follow-status]');
    if (status) {
      status.hidden = !car || !this.followingSelectedCar;
      const label = status.querySelector<HTMLElement>('b');
      if (label && car) label.textContent = `#${car.number} · ${car.name}`;
    }
  }
}
