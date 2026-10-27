import { DIFFICULTY, WEATHER_PRESETS } from '../game/gameConfig';
import { smoothSvgPoints } from '../game/TrackGeometry';
import {
  clearChampionship,
  createChampionship,
  getConstructorStandings,
  loadChampionship,
} from '../storage/championshipStorage';
import { getTrack } from '../tracks';
import type { ChampionshipState, Difficulty, RaceSettings } from '../types/race';
import { escapeHtml } from '../utils/dom';
import { ordinal } from '../utils/format';

export function renderChampionshipScreen(
  baseSettings: RaceSettings,
  onStartRound: (roundSettings: RaceSettings) => void,
  onBack: () => void,
): HTMLElement {
  const screen = document.createElement('main');
  screen.className = 'championship-screen shell';

  const renderContent = (): void => {
    const champ = loadChampionship();
    if (!champ) {
      renderCreationView(screen, baseSettings, renderContent, onBack);
    } else {
      renderDashboardView(screen, champ, baseSettings, onStartRound, renderContent, onBack);
    }
  };

  renderContent();
  return screen;
}

function renderCreationView(
  screen: HTMLElement,
  baseSettings: RaceSettings,
  onCreated: () => void,
  onBack: () => void,
): void {
  screen.innerHTML = `
    <header class="topbar">
      <button class="icon-button" type="button" data-back aria-label="Voltar">←</button>
      <div><span class="eyebrow">Temporada Oficial</span><h1>Modo Campeonato</h1></div>
      <div class="step-marker">SEASON / 01</div>
    </header>
    <form class="setup-form champ-create-form">
      <div class="setup-columns">
        <section class="setup-section setup-panel">
          <div class="section-heading"><span>01</span><div><h2>Formato da Temporada</h2><p>Dispute o título de Pilotos e Construtores etapa por etapa.</p></div></div>
          <label class="field-label" for="champ-name">NOME DO CAMPEONATO</label>
          <div class="number-field"><input id="champ-name" name="champ-name" type="text" maxlength="36" value="Copa Apex Mundial" required></div>

          <label class="field-label">NÚMERO DE ETAPAS</label>
          <div class="segmented">
            <label><input type="radio" name="rounds" value="3"><span>3 Etapas (Sprint)</span></label>
            <label><input type="radio" name="rounds" value="6" checked><span>6 Etapas (Padrão)</span></label>
            <label><input type="radio" name="rounds" value="9"><span>9 Etapas (Mundial)</span></label>
          </div>

          <label class="field-label" for="champ-laps">VOLTAS POR CORRIDA</label>
          <div class="number-field"><input id="champ-laps" name="laps" type="number" min="2" max="50" value="${Math.max(3, baseSettings.laps)}" required><span>voltas</span></div>
        </section>

        <section class="setup-section setup-panel">
          <div class="section-heading"><span>02</span><div><h2>Grid e Equipe</h2><p>Os pontos seguem o formato oficial (25-18-15-12-10-8-6-4-2-1 + 1 pt Volta Rápida).</p></div></div>
          <label class="field-label" for="champ-team">SUA ESCUDERIA</label>
          <div class="number-field"><input id="champ-team" name="team-name" type="text" maxlength="28" value="${escapeHtml(baseSettings.teamName ?? 'Equipe Apex')}" required></div>

          <label class="field-label" for="champ-comp">COMPETIDORES NO GRID <output id="champ-comp-out">${baseSettings.competitors}</output></label>
          <input id="champ-comp" name="competitors" type="range" min="6" max="20" step="2" value="${Math.max(6, baseSettings.competitors)}">

          <label class="field-label">DIFICULDADE DA IA</label>
          <div class="segmented">
            ${(Object.entries(DIFFICULTY) as [Difficulty, (typeof DIFFICULTY)[Difficulty]][]).map(([key, value]) => `<label><input type="radio" name="difficulty" value="${key}" ${key === baseSettings.difficulty ? 'checked' : ''}><span>${value.label}</span></label>`).join('')}
          </div>
        </section>
      </div>
      <div class="setup-submit">
        <div><span>INICIAR TEMPORADA?</span><small>O progresso é salvo automaticamente após cada corrida.</small></div>
        <button class="button button--primary" type="submit">CRIAR CAMPEONATO <b>→</b></button>
      </div>
    </form>
  `;

  screen.querySelector('[data-back]')?.addEventListener('click', onBack);
  const compInput = screen.querySelector<HTMLInputElement>('#champ-comp')!;
  const compOut = screen.querySelector<HTMLOutputElement>('#champ-comp-out')!;
  compInput.addEventListener('input', () => { compOut.value = compInput.value; });

  screen.querySelector('form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget as HTMLFormElement);
    createChampionship({
      name: String(data.get('champ-name') ?? 'Copa Apex Mundial'),
      roundCount: Number(data.get('rounds') ?? 6),
      lapsPerRace: Math.max(2, Math.min(50, Number(data.get('laps') ?? 5))),
      difficulty: (String(data.get('difficulty')) || 'normal') as Difficulty,
      competitors: Number(data.get('competitors') ?? 12),
      playerTeamName: String(data.get('team-name') ?? 'Equipe Apex'),
      playerCars: baseSettings.playerCars,
    });
    onCreated();
  });
}

function renderDashboardView(
  screen: HTMLElement,
  champ: ChampionshipState,
  baseSettings: RaceSettings,
  onStartRound: (roundSettings: RaceSettings) => void,
  onRefresh: () => void,
  onBack: () => void,
): void {
  const completedCount = champ.rounds.filter((r) => r.completed).length;
  const allCompleted = completedCount === champ.rounds.length;
  const activeRound = champ.rounds[champ.currentRound];
  const nextTrack = getTrack(activeRound.trackId);
  const constructors = getConstructorStandings(champ);
  const svgPoints = smoothSvgPoints(nextTrack.points, true);

  screen.innerHTML = `
    <header class="topbar">
      <button class="icon-button" type="button" data-back aria-label="Voltar">←</button>
      <div><span class="eyebrow">${escapeHtml(champ.name)} · ${DIFFICULTY[champ.difficulty].label}</span><h1>Central do Campeonato</h1></div>
      <div class="step-marker">ETAPA ${completedCount}/${champ.rounds.length}</div>
    </header>

    <section class="champ-hero-banner" style="--track-accent:${nextTrack.accent}">
      <div class="champ-next-info">
        <span class="eyebrow"><span></span> ${allCompleted ? 'TEMPORADA ENCERRADA' : `PRÓXIMA ETAPA · RODADA ${champ.currentRound + 1}`}</span>
        <h2>${allCompleted ? `Campeão: ${escapeHtml(champ.standings[0]?.driverName ?? 'Definido')}` : escapeHtml(nextTrack.name)}</h2>
        <p>${allCompleted
          ? `A temporada de ${champ.rounds.length} etapas foi concluída! Confira a classificação final abaixo.`
          : `${escapeHtml(nextTrack.location)} · ${activeRound.laps} voltas · Clima: ${WEATHER_PRESETS[activeRound.weatherPreset].label}`}</p>
        <div class="champ-hero-actions">
          ${!allCompleted ? `<button class="button button--primary" type="button" data-action="race-next">IR PARA A ETAPA ${champ.currentRound + 1} <b>→</b></button>` : ''}
          <button class="button button--ghost" type="button" data-action="reset-champ">NOVA TEMPORADA</button>
        </div>
      </div>
      <div class="champ-next-map">
        <svg viewBox="50 45 900 540" aria-hidden="true">
          <polyline points="${svgPoints}" fill="none" stroke="currentColor" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
    </section>

    <section class="champ-calendar-section">
      <div class="panel-title"><h2>CALENDÁRIO DE ETAPAS</h2><span>${completedCount} DE ${champ.rounds.length} CONCLUÍDAS</span></div>
      <div class="champ-calendar-grid">
        ${champ.rounds.map((round, idx) => {
          const track = getTrack(round.trackId);
          const isCurrent = !allCompleted && idx === champ.currentRound;
          return `
            <article class="champ-round-card ${round.completed ? 'is-completed' : ''} ${isCurrent ? 'is-current' : ''}" style="--track-accent:${track.accent}">
              <div class="champ-round-head"><span>R${idx + 1}</span><small>${WEATHER_PRESETS[round.weatherPreset].label}</small></div>
              <h4>${escapeHtml(track.name)}</h4>
              <p>${round.laps} voltas · ${(track.length / 1000).toFixed(2)} km</p>
              <footer>${round.completed ? `🏆 ${escapeHtml(round.winnerName ?? '')}` : isCurrent ? '● ETAPA ATUAL' : 'AGUARDANDO'}</footer>
            </article>
          `;
        }).join('')}
      </div>
    </section>

    <div class="setup-columns champ-tables">
      <section class="setup-panel">
        <div class="panel-title"><h2>MUNDIAL DE PILOTOS</h2><span>PONTOS</span></div>
        <div class="champ-standings-list">
          ${champ.standings.length === 0
            ? '<p class="saved-empty">Dispute a 1ª etapa para inaugurar a tabela de pontuação.</p>'
            : champ.standings.map((driver, idx) => `
              <div class="champ-row ${driver.isPlayer ? 'is-player' : ''}">
                <strong>${ordinal(idx + 1)}</strong>
                <i style="background:${driver.color}">#${driver.carNumber}</i>
                <div><b>${escapeHtml(driver.driverName)}</b><small>${escapeHtml(driver.teamName)} · ${driver.wins}V · ${driver.podiums} Pódios${driver.fastestLaps > 0 ? ` · ${driver.fastestLaps} VR` : ''}</small></div>
                <span class="champ-pts">${driver.points} PTS</span>
              </div>
            `).join('')}
        </div>
      </section>

      <section class="setup-panel">
        <div class="panel-title"><h2>MUNDIAL DE CONSTRUTORES</h2><span>EQUIPES</span></div>
        <div class="champ-standings-list">
          ${constructors.length === 0
            ? '<p class="saved-empty">Nenhuma equipe pontuou ainda.</p>'
            : constructors.map((team, idx) => `
              <div class="champ-row ${team.isPlayer ? 'is-player' : ''}">
                <strong>${ordinal(idx + 1)}</strong>
                <i style="background:${team.color}">EQ</i>
                <div><b>${escapeHtml(team.teamName)}</b><small>${team.wins} Vitórias · ${team.podiums} Pódios</small></div>
                <span class="champ-pts">${team.points} PTS</span>
              </div>
            `).join('')}
        </div>
      </section>
    </div>
  `;

  screen.querySelector('[data-back]')?.addEventListener('click', onBack);
  screen.querySelector('[data-action="reset-champ"]')?.addEventListener('click', () => {
    clearChampionship();
    onRefresh();
  });
  screen.querySelector('[data-action="race-next"]')?.addEventListener('click', () => {
    const initialTyre = activeRound.weatherPreset === 'wet' ? 'intermediate' : baseSettings.playerCars[0].tyre;
    const secondTyre = activeRound.weatherPreset === 'wet' ? 'intermediate' : baseSettings.playerCars[1].tyre;
    onStartRound({
      trackId: activeRound.trackId,
      laps: activeRound.laps,
      competitors: champ.competitors,
      difficulty: champ.difficulty,
      teamName: champ.playerTeamName,
      weatherPreset: activeRound.weatherPreset,
      qualifyingMode: 'simulated',
      playerCars: [
        { ...champ.playerCars[0], tyre: initialTyre },
        { ...champ.playerCars[1], tyre: secondTyre },
      ],
    });
  });
}
