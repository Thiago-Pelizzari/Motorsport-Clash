import type { RaceEngine } from '../game/RaceEngine';
import { formatTime, ordinal } from '../utils/format';

export function renderResults(engine: RaceEngine, onNew: () => void, onRepeat: () => void, onMenu: () => void): HTMLElement {
  const screen = document.createElement('main');
  screen.className = 'results-screen shell';
  const winner = engine.state.cars[0];
  screen.innerHTML = `
    <header class="results-hero">
      <span class="eyebrow">Bandeira quadriculada</span>
      <h1>Corrida concluída</h1>
      <p>${engine.track.name} · ${engine.state.totalLaps} voltas · ${formatTime(winner.finishTime)}</p>
    </header>
    <section class="podium">
      ${engine.state.cars.slice(0, 3).map((car, index) => `
        <article class="podium-place podium-place--${index + 1}">
          <span>${ordinal(index + 1)}</span><i style="background:${car.color}">#${car.number}</i>
          <h2>${car.name}</h2><strong>${index === 0 ? formatTime(car.finishTime) : `+${((car.finishTime ?? 0) - (winner.finishTime ?? 0)).toFixed(3)}s`}</strong>
        </article>`).join('')}
    </section>
    <section class="results-table-wrap">
      <div class="panel-title"><h2>RESULTADO COMPLETO</h2><span>${engine.settings.competitors} COMPETIDORES</span></div>
      <div class="results-table">
        <div class="results-head"><span>POS</span><span>CARRO / PILOTO</span><span>TEMPO / DIF.</span><span>MELHOR VOLTA</span><span>BOXES</span></div>
        ${engine.state.cars.map((car) => `
          <div class="result-row ${car.isPlayer ? 'is-player' : ''}">
            <strong>${ordinal(car.position)}</strong>
            <div><i style="background:${car.color}">#${car.number}</i><span>${car.name}</span></div>
            <time>${car.position === 1 ? formatTime(car.finishTime) : `+${((car.finishTime ?? 0) - (winner.finishTime ?? 0)).toFixed(3)}s`}</time>
            <time>${formatTime(car.bestLapTime)}</time>
            <b>${car.pitStops.length}</b>
          </div>`).join('')}
      </div>
    </section>
    <div class="result-actions">
      <button class="button button--ghost" data-action="menu">VOLTAR AO MENU</button>
      <button class="button button--secondary" data-action="new">NOVA CORRIDA</button>
      <button class="button button--primary" data-action="repeat">REPETIR CONFIGURAÇÃO →</button>
    </div>
  `;
  screen.querySelector('[data-action="new"]')?.addEventListener('click', onNew);
  screen.querySelector('[data-action="repeat"]')?.addEventListener('click', onRepeat);
  screen.querySelector('[data-action="menu"]')?.addEventListener('click', onMenu);
  return screen;
}
