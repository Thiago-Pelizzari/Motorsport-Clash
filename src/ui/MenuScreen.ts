import { loadChampionship } from '../storage/championshipStorage';
import { escapeHtml } from '../utils/dom';

export function renderMenu(
  onQuickRace: () => void,
  onCreateRace: () => void,
  onTrackCreator: () => void,
  onSettings: () => void,
  onChampionship?: () => void,
): HTMLElement {
  const activeChamp = loadChampionship();
  const completedRounds = activeChamp ? activeChamp.rounds.filter((r) => r.completed).length : 0;
  const champSubtitle = activeChamp
    ? `${escapeHtml(activeChamp.name)} (${completedRounds}/${activeChamp.rounds.length})`
    : 'MODO TEMPORADA';

  const screen = document.createElement('main');
  screen.className = 'menu-screen';
  screen.innerHTML = `
    <div class="menu-glow menu-glow--one"></div>
    <div class="menu-glow menu-glow--two"></div>
    <section class="brand-block">
      <div class="eyebrow"><span></span> Estratégia em tempo real</div>
      <h1>APEX<br><em>STRATEGY</em></h1>
      <p>Você não segura o volante.<br>Você decide quem vence.</p>
      <div class="brand-badges">
        <span>CLIMA DINÂMICO</span>
        <span>TELEMETRIA S1·S2·S3</span>
        <span>ERS & COMBUSTÍVEL</span>
      </div>
    </section>
    <nav class="menu-actions" aria-label="Menu principal">
      <button class="button button--primary button--hero" data-action="play">
        <span class="button-index">01</span><span>CORRIDA RÁPIDA</span><b>→</b>
      </button>
      <button class="button button--secondary" data-action="championship">
        <span class="button-index">02</span><span>CAMPEONATO <small class="button-sub">${champSubtitle}</small></span><b>🏆</b>
      </button>
      <button class="button button--secondary" data-action="create">
        <span class="button-index">03</span><span>CRIAR CORRIDA</span><b>＋</b>
      </button>
      <button class="button button--secondary" data-action="track-creator">
        <span class="button-index">04</span><span>OFICINA DE PISTAS</span><b>▦</b>
      </button>
      <button class="button button--ghost" data-action="settings">
        <span class="button-index">05</span><span>CONFIGURAÇÕES</span><b>⚙</b>
      </button>
    </nav>
    <footer class="menu-footer"><span>OFFLINE · TELEMETRIA TÁTICA</span><span>v2.0 EDITION</span></footer>
  `;
  screen.querySelector('[data-action="play"]')?.addEventListener('click', onQuickRace);
  screen.querySelector('[data-action="championship"]')?.addEventListener('click', () => (onChampionship ?? onCreateRace)());
  screen.querySelector('[data-action="create"]')?.addEventListener('click', onCreateRace);
  screen.querySelector('[data-action="track-creator"]')?.addEventListener('click', onTrackCreator);
  screen.querySelector('[data-action="settings"]')?.addEventListener('click', onSettings);
  return screen;
}
