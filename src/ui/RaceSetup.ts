import { DIFFICULTY, TYRES } from '../game/gameConfig';
import { getAvailableTracks } from '../tracks';
import type { Difficulty, RaceSettings, Track, TyreType } from '../types/race';

const LAP_PRESETS = [3, 5, 10, 20, 30, 50];

export function renderRaceSetup(initial: RaceSettings, onStart: (settings: RaceSettings) => void, onBack: () => void): HTMLElement {
  const tracks = getAvailableTracks();
  const screen = document.createElement('main');
  screen.className = 'setup-screen shell';
  screen.innerHTML = `
    <header class="topbar">
      <button class="icon-button" type="button" data-back aria-label="Voltar">←</button>
      <div><span class="eyebrow">Configuração</span><h1>Criar corrida</h1></div>
      <div class="step-marker">GRID / 01</div>
    </header>
    <form class="setup-form">
      <section class="setup-section">
        <div class="section-heading"><span>01</span><div><h2>Escolha o circuito</h2><p>Circuitos clássicos, modelos em blocos e suas próprias criações.</p></div></div>
        <div class="track-grid">
          ${tracks.map((track) => `
            <label class="track-card ${track.id === initial.trackId ? 'is-selected' : ''}" style="--track-accent:${track.accent}">
              <input type="radio" name="track" value="${track.id}" ${track.id === initial.trackId ? 'checked' : ''}>
              <div class="track-map" data-track-preview="${track.id}"></div>
              <span class="track-location">${track.location}</span>
              <h3>${track.name}</h3>
              ${track.source === 'custom' ? '<span class="custom-track-badge">SUA PISTA</span>' : track.source === 'blocks' ? '<span class="custom-track-badge">MODELO EM BLOCOS</span>' : ''}
              <p>${track.description}</p>
              <div class="track-stats">
                <span><b>${(track.length / 1000).toFixed(2)}</b> KM</span>
                <span><b>${track.corners}</b> CURVAS</span>
                <span><b>${'◆'.repeat(track.difficulty)}${'◇'.repeat(5 - track.difficulty)}</b> NÍVEL</span>
              </div>
            </label>
          `).join('')}
        </div>
      </section>
      <div class="setup-columns">
        <section class="setup-section setup-panel">
          <div class="section-heading"><span>02</span><div><h2>Formato</h2><p>Defina a duração e o grid.</p></div></div>
          <label class="field-label" for="laps">VOLTAS</label>
          <div class="preset-row">
            ${LAP_PRESETS.map((laps) => `<button type="button" class="preset ${laps === initial.laps ? 'is-active' : ''}" data-laps="${laps}">${laps}</button>`).join('')}
          </div>
          <div class="number-field"><input id="laps" name="laps" type="number" min="1" max="100" value="${initial.laps}" required><span>voltas</span></div>
          <label class="field-label" for="competitors">COMPETIDORES <output id="competitor-output">${initial.competitors}</output></label>
          <input id="competitors" name="competitors" type="range" min="2" max="20" value="${initial.competitors}">
          <div class="range-labels"><span>2</span><span>20 carros</span></div>
          <label class="field-label" for="difficulty">DIFICULDADE DA IA</label>
          <div class="segmented">
            ${(Object.entries(DIFFICULTY) as [Difficulty, (typeof DIFFICULTY)[Difficulty]][]).map(([key, value]) => `<label><input type="radio" name="difficulty" value="${key}" ${key === initial.difficulty ? 'checked' : ''}><span>${value.label}</span></label>`).join('')}
          </div>
        </section>
        <section class="setup-section setup-panel">
          <div class="section-heading"><span>03</span><div><h2>Sua equipe</h2><p>Dois carros, uma estratégia.</p></div></div>
          ${initial.playerCars.map((car, index) => `
            <div class="driver-config">
              <div class="car-swatch car-swatch--${index + 1}">${index + 1}</div>
              <div class="driver-fields">
                <label class="field-label" for="car-${index}-number">NÚMERO DO CARRO ${index + 1}</label>
                <input id="car-${index}-number" name="car-${index}-number" type="number" min="1" max="99" value="${car.number}" required>
                <label class="field-label" for="car-${index}-tyre">PNEU INICIAL</label>
                <select id="car-${index}-tyre" name="car-${index}-tyre">
                  ${(Object.entries(TYRES) as [TyreType, (typeof TYRES)[TyreType]][]).map(([key, tyre]) => `<option value="${key}" ${key === car.tyre ? 'selected' : ''}>● ${tyre.label}</option>`).join('')}
                </select>
              </div>
            </div>
          `).join('')}
          <p class="form-error" role="alert" aria-live="polite"></p>
        </section>
      </div>
      <div class="setup-submit">
        <div><span>PRONTO PARA A LARGADA?</span><small>As configurações ficam salvas neste dispositivo.</small></div>
        <button class="button button--primary" type="submit">INICIAR CORRIDA <b>→</b></button>
      </div>
    </form>
  `;

  drawTrackPreviews(screen, tracks);
  screen.querySelector('[data-back]')?.addEventListener('click', onBack);
  screen.querySelectorAll<HTMLInputElement>('input[name="track"]').forEach((input) => {
    input.addEventListener('change', () => {
      screen.querySelectorAll('.track-card').forEach((card) => card.classList.remove('is-selected'));
      input.closest('.track-card')?.classList.add('is-selected');
    });
  });
  const lapsInput = screen.querySelector<HTMLInputElement>('#laps')!;
  screen.querySelectorAll<HTMLButtonElement>('[data-laps]').forEach((button) => {
    button.addEventListener('click', () => {
      lapsInput.value = button.dataset.laps ?? '5';
      screen.querySelectorAll('.preset').forEach((item) => item.classList.remove('is-active'));
      button.classList.add('is-active');
    });
  });
  lapsInput.addEventListener('input', () => screen.querySelectorAll('.preset').forEach((item) => item.classList.toggle('is-active', (item as HTMLElement).dataset.laps === lapsInput.value)));
  const competitorInput = screen.querySelector<HTMLInputElement>('#competitors')!;
  const competitorOutput = screen.querySelector<HTMLOutputElement>('#competitor-output')!;
  competitorInput.addEventListener('input', () => { competitorOutput.value = competitorInput.value; });

  screen.querySelector('form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget as HTMLFormElement);
    const firstNumber = Number(form.get('car-0-number'));
    const secondNumber = Number(form.get('car-1-number'));
    const error = screen.querySelector<HTMLElement>('.form-error')!;
    if (firstNumber === secondNumber) {
      error.textContent = 'Os dois carros precisam ter números diferentes.';
      return;
    }
    const laps = Math.max(1, Math.min(100, Number(form.get('laps'))));
    if (!Number.isInteger(firstNumber) || !Number.isInteger(secondNumber) || firstNumber < 1 || firstNumber > 99 || secondNumber < 1 || secondNumber > 99) {
      error.textContent = 'Use números inteiros entre 1 e 99.';
      return;
    }
    onStart({
      trackId: String(form.get('track')),
      laps,
      competitors: Number(form.get('competitors')),
      difficulty: String(form.get('difficulty')) as Difficulty,
      playerCars: [
        { number: firstNumber, tyre: String(form.get('car-0-tyre')) as TyreType },
        { number: secondNumber, tyre: String(form.get('car-1-tyre')) as TyreType },
      ],
    });
  });
  return screen;
}

function drawTrackPreviews(container: HTMLElement, tracks: Track[]): void {
  container.querySelectorAll<HTMLElement>('[data-track-preview]').forEach((preview) => {
    const track = tracks.find((item) => item.id === preview.dataset.trackPreview);
    if (!track) return;
    const svgPoints = [...track.points, track.points[0]].map((point) => `${point.x},${point.y}`).join(' ');
    preview.innerHTML = `<svg viewBox="50 45 900 540" aria-hidden="true"><polyline points="${svgPoints}" fill="none" stroke="currentColor" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/><line x1="${track.points[0].x - 15}" y1="${track.points[0].y}" x2="${track.points[0].x + 15}" y2="${track.points[0].y}" stroke="white" stroke-width="8"/></svg>`;
  });
}
