import { TYRES } from '../game/gameConfig';
import type { RaceEngine } from '../game/RaceEngine';
import type { CarState, TyreType } from '../types/race';
import { escapeHtml } from '../utils/dom';
import { formatTime, ordinal } from '../utils/format';

export function renderResults(
  engine: RaceEngine,
  onNew: () => void,
  onRepeat: () => void,
  onMenu: () => void,
  onChampionship?: () => void,
): HTMLElement {
  const screen = document.createElement('main');
  screen.className = 'results-screen shell';
  const winner = engine.state.cars[0];
  const fastestCar = engine.state.cars.find((c) => c.id === engine.state.fastestLapCarId) ?? winner;
  const driverOfTheDay = [...engine.state.cars].sort(
    (a, b) => (b.gridPosition - b.position) - (a.gridPosition - a.position) || b.overtakesMade - a.overtakesMade,
  )[0];

  let fastestPitCar: CarState | null = null;
  let fastestPitDuration = Infinity;
  for (const car of engine.state.cars) {
    for (const stop of car.pitStops) {
      if (stop.duration < fastestPitDuration) {
        fastestPitDuration = stop.duration;
        fastestPitCar = car;
      }
    }
  }

  screen.innerHTML = `
    <header class="results-hero">
      <span class="eyebrow">Bandeira quadriculada</span>
      <h1>Corrida concluída</h1>
      <p>${escapeHtml(engine.track.name)} · ${engine.state.totalLaps} voltas · Tempo total: ${formatTime(winner.finishTime)}</p>
    </header>

    <section class="podium">
      ${engine.state.cars.slice(0, 3).map((car, index) => `
        <article class="podium-place podium-place--${index + 1}">
          <span>${ordinal(index + 1)}</span><i style="background:${car.color}">#${car.number}</i>
          <h2>${escapeHtml(car.name)}</h2>
          <small class="podium-team">${escapeHtml(car.teamName)}</small>
          <strong>${index === 0 ? formatTime(car.finishTime) : `+${((car.finishTime ?? 0) - (winner.finishTime ?? 0)).toFixed(3)}s`}</strong>
        </article>`).join('')}
    </section>

    <section class="results-awards">
      <article class="award-card award-card--purple">
        <span>🟣 VOLTA MAIS RÁPIDA</span>
        <strong>#${fastestCar.number} ${escapeHtml(fastestCar.name)}</strong>
        <small>${formatTime(engine.state.fastestLapTime)}</small>
      </article>
      <article class="award-card">
        <span>⭐ PILOTO DO DIA</span>
        <strong>#${driverOfTheDay.number} ${escapeHtml(driverOfTheDay.name)}</strong>
        <small>${driverOfTheDay.gridPosition - driverOfTheDay.position > 0 ? `+${driverOfTheDay.gridPosition - driverOfTheDay.position} posições ganhas` : `${driverOfTheDay.overtakesMade} ultrapassagens`}</small>
      </article>
      <article class="award-card">
        <span>🔧 MELHOR PIT STOP</span>
        <strong>${fastestPitCar ? `#${fastestPitCar.number} ${escapeHtml(fastestPitCar.teamName)}` : 'Sem paradas'}</strong>
        <small>${fastestPitCar ? `${fastestPitDuration.toFixed(2)}s nos boxes` : 'Corrida direta'}</small>
      </article>
    </section>

    <section class="results-table-wrap">
      <div class="panel-title"><h2>RESULTADO COMPLETO & ESTRATÉGIA</h2><span>${engine.settings.competitors} COMPETIDORES</span></div>
      <div class="results-table">
        <div class="results-head">
          <span>POS</span>
          <span>CARRO / PILOTO</span>
          <span>GRID</span>
          <span>TEMPO / DIF.</span>
          <span>MELHOR VOLTA</span>
          <span>HISTÓRICO DE PNEUS</span>
        </div>
        ${engine.state.cars.map((car) => {
          const delta = car.gridPosition - car.position;
          const deltaHtml = delta > 0
            ? `<span class="grid-delta is-up">▲ ${delta}</span>`
            : delta < 0
              ? `<span class="grid-delta is-down">▼ ${Math.abs(delta)}</span>`
              : `<span class="grid-delta">=</span>`;
          const isFastest = car.id === engine.state.fastestLapCarId;
          return `
          <div class="result-row ${car.isPlayer ? 'is-player' : ''}">
            <strong>${ordinal(car.position)}</strong>
            <div>
              <i style="background:${car.color}">#${car.number}</i>
              <div class="result-driver-cell">
                <span>${escapeHtml(car.name)}</span>
                <small>${escapeHtml(car.teamName)}</small>
              </div>
            </div>
            <div>${deltaHtml}</div>
            <time>${car.position === 1 ? formatTime(car.finishTime) : `+${((car.finishTime ?? 0) - (winner.finishTime ?? 0)).toFixed(3)}s`}</time>
            <time class="${isFastest ? 'fastest-lap-time' : ''}">${formatTime(car.bestLapTime)}${isFastest ? ' 🟣' : ''}</time>
            <div class="stint-badges">${renderStintBadges(car)}</div>
          </div>`;
        }).join('')}
      </div>
    </section>

    <section class="results-table-wrap lap-chart-section">
      <div class="panel-title"><h2>GRÁFICO DE EVOLUÇÃO DE POSIÇÕES (VOLTA A VOLTA)</h2><span>DESTAQUE: SEUS CARROS & TOP 5</span></div>
      <div class="lap-chart-wrap">
        ${renderLapPositionChartSvg(engine)}
      </div>
    </section>

    <div class="result-actions">
      <button class="button button--ghost" data-action="menu">VOLTAR AO MENU</button>
      <button class="button button--secondary" data-action="new">CONFIGURAR NOVA CORRIDA</button>
      ${onChampionship ? `<button class="button button--primary" data-action="champ">TABELA DO CAMPEONATO →</button>` : `<button class="button button--primary" data-action="repeat">REPETIR CORRIDA →</button>`}
    </div>
  `;

  screen.querySelector('[data-action="new"]')?.addEventListener('click', onNew);
  screen.querySelector('[data-action="repeat"]')?.addEventListener('click', onRepeat);
  screen.querySelector('[data-action="menu"]')?.addEventListener('click', onMenu);
  screen.querySelector('[data-action="champ"]')?.addEventListener('click', () => onChampionship?.());
  return screen;
}

function renderStintBadges(car: CarState): string {
  const compounds: TyreType[] = [];
  if (car.pitStops.length === 0) {
    compounds.push(car.tyreType);
  } else {
    compounds.push(car.pitStops[0].fromTyre);
    for (const stop of car.pitStops) {
      compounds.push(stop.toTyre);
    }
  }
  return compounds
    .map((tyre) => {
      const cfg = TYRES[tyre];
      return `<span class="stint-dot" style="--stint-color:${cfg.color}" title="${cfg.label}">${cfg.shortLabel}</span>`;
    })
    .join('<small>→</small>');
}

function renderLapPositionChartSvg(engine: RaceEngine): string {
  const { cars, totalLaps } = engine.state;
  const totalCars = cars.length;
  const width = 920;
  const height = 240;
  const padLeft = 42;
  const padRight = 56;
  const padTop = 20;
  const padBottom = 28;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const steps = Math.max(1, totalLaps);
  const xForLap = (lap: number) => padLeft + (lap / steps) * plotW;
  const yForPos = (pos: number) => padTop + ((pos - 1) / Math.max(1, totalCars - 1)) * plotH;

  const gridLines: string[] = [];
  for (let lap = 0; lap <= steps; lap += Math.max(1, Math.ceil(steps / 10))) {
    const x = xForLap(lap).toFixed(1);
    gridLines.push(`<line x1="${x}" y1="${padTop}" x2="${x}" y2="${height - padBottom}" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>`);
    gridLines.push(`<text x="${x}" y="${height - 8}" fill="#6e7785" font-size="9" font-weight="800" text-anchor="middle">V${lap}</text>`);
  }

  const lines: string[] = [];
  // Draw AI background cars first, then player cars on top
  const ordered = [...cars].sort((a, b) => Number(a.isPlayer) - Number(b.isPlayer));
  for (const car of ordered) {
    if (!car.isPlayer && car.position > 5) continue;
    const history = car.positionHistory.length > 0 ? car.positionHistory : [car.gridPosition, car.position];
    const pts = history
      .map((pos, idx) => `${xForLap(Math.min(steps, idx)).toFixed(1)},${yForPos(pos).toFixed(1)}`)
      .join(' ');
    const opacity = car.isPlayer ? '1' : '0.45';
    const strokeW = car.isPlayer ? '3' : '1.5';
    const lastPos = history[history.length - 1] ?? car.position;
    const endY = yForPos(lastPos).toFixed(1);
    lines.push(`<polyline points="${pts}" fill="none" stroke="${car.color}" stroke-width="${strokeW}" stroke-opacity="${opacity}" stroke-linecap="round" stroke-linejoin="round"/>`);
    lines.push(`<text x="${width - padRight + 8}" y="${Number(endY) + 3}" fill="${car.color}" font-size="9" font-weight="900">#${car.number} (${ordinal(car.position)})</text>`);
  }

  return `
    <svg viewBox="0 0 ${width} ${height}" class="lap-chart-svg" role="img" aria-label="Gráfico de posições por volta">
      <text x="${padLeft - 8}" y="${padTop + 4}" fill="#8e98a7" font-size="9" font-weight="800" text-anchor="end">P1</text>
      <text x="${padLeft - 8}" y="${height - padBottom}" fill="#8e98a7" font-size="9" font-weight="800" text-anchor="end">P${totalCars}</text>
      ${gridLines.join('')}
      ${lines.join('')}
    </svg>
  `;
}
