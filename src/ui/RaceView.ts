import { GAME_CONFIG, STRATEGIES, TYRES } from '../game/gameConfig';
import { RaceEngine } from '../game/RaceEngine';
import type { SimulationSpeed, StrategyMode, TyreType } from '../types/race';
import { formatGap, formatTime } from '../utils/format';
import { TrackCanvas } from './TrackCanvas';

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
  private strategyInteractionUntil = 0;

  constructor(engine: RaceEngine, onExit: () => void, onFinished: (engine: RaceEngine) => void) {
    this.engine = engine;
    this.onFinished = onFinished;
    this.element = document.createElement('main');
    this.element.className = 'race-screen';
    this.element.innerHTML = `
      <header class="race-topbar">
        <div class="race-brand">APEX <em>STRATEGY</em></div>
        <div class="race-title"><span>${engine.track.location}</span><strong>${engine.track.name}</strong></div>
        <div class="lap-counter"><span>VOLTA</span><strong data-current-lap>1</strong><i>/</i><b>${engine.state.totalLaps}</b></div>
        <button class="icon-button" type="button" data-exit aria-label="Sair da corrida">×</button>
      </header>
      <div class="race-layout">
        <section class="track-stage">
          <canvas class="race-canvas" aria-label="Visualização da corrida"></canvas>
          <div class="live-badge"><i></i> AO VIVO</div>
          <div class="event-toast" data-event></div>
          <div class="camera-tools" aria-label="Controles de zoom">
            <button type="button" data-camera="zoom-out" aria-label="Diminuir zoom">−</button>
            <button type="button" class="zoom-readout" data-camera="reset" data-zoom aria-label="Enquadrar pista">100%</button>
            <button type="button" data-camera="zoom-in" aria-label="Aumentar zoom">＋</button>
          </div>
          <div class="camera-hint">RODA: ZOOM · ARRASTE: MOVER · DUPLO CLIQUE: AJUSTAR</div>
          <div class="track-data">
            <span>${(engine.track.length / 1000).toFixed(2)} KM</span><span>${engine.track.corners} CURVAS</span><span>${Math.round(engine.track.averageSpeed)} KM/H MÉDIA</span>
          </div>
        </section>
        <aside class="race-sidebar">
          <section class="leaderboard-panel">
            <div class="panel-title"><h2>CLASSIFICAÇÃO</h2><span data-race-time>0:00.000</span></div>
            <div class="leaderboard-head"><span>POS</span><span>PILOTO</span><span>INTERVALO</span></div>
            <div class="leaderboard" data-leaderboard></div>
          </section>
          <section class="strategy-section">
            <div class="panel-title"><h2>SUA EQUIPE</h2><span>ESTRATÉGIA</span></div>
            <div data-strategy-panels></div>
          </section>
        </aside>
      </div>
      <footer class="race-controls">
        <div class="control-label"><span>VELOCIDADE DA SIMULAÇÃO</span><small>O tempo do motor independe do FPS</small></div>
        <div class="speed-controls" role="group" aria-label="Velocidade da simulação">
          <button data-speed="0" aria-label="Pausar">Ⅱ</button>
          <button data-speed="1" class="is-active">1×</button>
          <button data-speed="2">2×</button>
          <button data-speed="4">4×</button>
        </div>
      </footer>
    `;
    const canvas = this.element.querySelector<HTMLCanvasElement>('canvas')!;
    this.renderer = new TrackCanvas(canvas, engine.track, (zoom) => this.updateZoomReadout(zoom));
    engine.state.cars.filter((car) => car.isPlayer).forEach((car) => this.pitSelections.set(car.id, car.tyreType));

    this.element.querySelector('[data-exit]')?.addEventListener('click', onExit);
    this.element.addEventListener('pointerdown', (event) => {
      if ((event.target as HTMLElement).closest('[data-strategy-panels]')) {
        this.strategyInteractionUntil = performance.now() + 600;
      }
    });
    this.element.addEventListener('click', (event) => this.handleClick(event));
    this.element.addEventListener('change', (event) => this.handleChange(event));
    this.engine.start();
    this.renderHud();
    this.animationFrame = requestAnimationFrame((time) => this.loop(time));
  }

  destroy(): void {
    cancelAnimationFrame(this.animationFrame);
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
    if (this.hudTimer >= 0.12) {
      this.renderHud();
      this.hudTimer = 0;
    }
    if (this.engine.state.phase === 'finished' && !this.finishedNotified) {
      this.finishedNotified = true;
      this.renderHud();
      window.setTimeout(() => this.onFinished(this.engine), 900);
      return;
    }
    this.animationFrame = requestAnimationFrame((nextTime) => this.loop(nextTime));
  }

  private handleClick(event: Event): void {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
    if (!button) return;
    const cameraAction = button.dataset.camera;
    if (cameraAction) {
      if (cameraAction === 'zoom-in') this.renderer.zoomIn();
      if (cameraAction === 'zoom-out') this.renderer.zoomOut();
      if (cameraAction === 'reset') this.renderer.resetView();
      return;
    }
    if (button.dataset.speed !== undefined) {
      const speed = Number(button.dataset.speed) as SimulationSpeed;
      if (speed === 0) {
        if (this.engine.state.simulationSpeed === 0) this.engine.setSimulationSpeed(this.lastSpeed);
        else {
          this.lastSpeed = this.engine.state.simulationSpeed as Exclude<SimulationSpeed, 0>;
          this.engine.setSimulationSpeed(0);
        }
      } else {
        this.lastSpeed = speed;
        this.engine.setSimulationSpeed(speed);
      }
      this.renderHud();
      return;
    }
    const carId = button.dataset.carId;
    const strategy = button.dataset.strategy as StrategyMode | undefined;
    if (carId && strategy) {
      this.engine.setStrategy(carId, strategy);
      this.strategyInteractionUntil = 0;
      this.renderStrategyPanels(true);
      return;
    }
    if (carId && button.dataset.action === 'pit') {
      const car = this.engine.state.cars.find((item) => item.id === carId);
      if (car?.pendingPitTyre) this.engine.cancelPitStop(carId);
      else this.engine.requestPitStop(carId, this.pitSelections.get(carId) ?? 'medium');
      this.strategyInteractionUntil = 0;
      this.renderStrategyPanels(true);
      return;
    }
    this.renderHud();
  }

  private handleChange(event: Event): void {
    const select = (event.target as HTMLElement).closest<HTMLSelectElement>('select[data-pit-tyre]');
    if (select?.dataset.carId) this.pitSelections.set(select.dataset.carId, select.value as TyreType);
  }

  private updateZoomReadout(zoom: number): void {
    const readout = this.element.querySelector<HTMLElement>('[data-zoom]');
    if (readout) readout.textContent = `${Math.round(zoom * 100)}%`;
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
    this.renderLeaderboard();
    this.renderStrategyPanels();
    this.element.querySelectorAll<HTMLButtonElement>('[data-speed]').forEach((button) => {
      const speed = Number(button.dataset.speed);
      button.classList.toggle('is-active', speed === state.simulationSpeed || (speed === 0 && state.simulationSpeed === 0));
      if (speed === 0) button.textContent = state.simulationSpeed === 0 ? '▶' : 'Ⅱ';
    });
  }

  private renderLeaderboard(): void {
    const container = this.element.querySelector<HTMLElement>('[data-leaderboard]');
    if (!container) return;
    const leader = this.engine.state.cars[0];
    const leaderTime = leader.finishTime ?? leader.totalTime;
    container.innerHTML = this.engine.state.cars.map((car) => {
      const distanceGap = Math.max(0, leader.distance - car.distance);
      const estimatedGap = distanceGap / Math.max(25, (leader.speed || this.engine.track.averageSpeed) / 3.6);
      const gap = car.finished && leader.finished ? (car.finishTime ?? leaderTime) - leaderTime : estimatedGap;
      const status = car.pitTimeRemaining > 0 ? 'BOX' : car.finished ? 'FIM' : formatGap(gap);
      return `
        <div class="leader-row ${car.isPlayer ? 'is-player' : ''}">
          <strong>${car.position}</strong>
          <span class="leader-dot" style="--car-color:${car.color}">${car.number}</span>
          <div><b>${car.name}</b><small>V${Math.min(this.engine.state.totalLaps, car.lap + 1)} · ${TYRES[car.tyreType].label}${car.collisionCooldown > 0 ? ' · CONTATO' : ''}</small></div>
          <time>${status}</time>
        </div>`;
    }).join('');
  }

  private renderStrategyPanels(force = false): void {
    const container = this.element.querySelector<HTMLElement>('[data-strategy-panels]');
    if (!container) return;
    if (!force && performance.now() < this.strategyInteractionUntil) return;
    if (!force && document.activeElement instanceof HTMLSelectElement && container.contains(document.activeElement)) return;
    container.innerHTML = this.engine.state.cars.filter((car) => car.isPlayer).map((car) => {
      const tyre = TYRES[car.tyreType];
      const pitSelection = this.pitSelections.get(car.id) ?? 'medium';
      const pitStatus = car.pitTimeRemaining > 0 ? `BOXES ${car.pitTimeRemaining.toFixed(1)}s` : car.pendingPitTyre ? 'CANCELAR BOX' : 'ENTRAR NOS BOXES';
      return `
        <article class="strategy-card" style="--car-color:${car.color}">
          <div class="strategy-car"><span>#${car.number}</span><div><b>${car.position}º LUGAR</b><small>${Math.round(car.speed)} km/h · carro ${Math.round(car.condition * 100)}%</small></div></div>
          <div class="tyre-status">
            <span class="tyre-ring" style="--tyre-color:${tyre.color};--life:${Math.round(car.tyreCondition * 100) * 3.6}deg"></span>
            <div><small>PNEU ${tyre.label.toUpperCase()}</small><strong>${Math.round(car.tyreCondition * 100)}%</strong></div>
            <div class="wear-bar"><i style="width:${Math.round(car.tyreCondition * 100)}%;background:${tyre.color}"></i></div>
          </div>
          <div class="mode-buttons">
            ${(Object.entries(STRATEGIES) as [StrategyMode, (typeof STRATEGIES)[StrategyMode]][]).map(([mode, config]) => `<button data-car-id="${car.id}" data-strategy="${mode}" class="${car.strategyMode === mode ? 'is-active' : ''}" ${car.finished ? 'disabled' : ''}>${config.label}</button>`).join('')}
          </div>
          <div class="pit-controls">
            <select data-pit-tyre data-car-id="${car.id}" aria-label="Próximo pneu" ${car.pendingPitTyre || car.pitTimeRemaining > 0 || car.finished ? 'disabled' : ''}>
              ${(Object.entries(TYRES) as [TyreType, (typeof TYRES)[TyreType]][]).map(([key, config]) => `<option value="${key}" ${key === pitSelection ? 'selected' : ''}>${config.label}</option>`).join('')}
            </select>
            <button data-action="pit" data-car-id="${car.id}" ${car.pitTimeRemaining > 0 || car.finished ? 'disabled' : ''}>${pitStatus}</button>
          </div>
        </article>`;
    }).join('');
  }
}
