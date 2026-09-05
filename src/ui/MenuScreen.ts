export function renderMenu(onQuickRace: () => void, onCreateRace: () => void, onSettings: () => void): HTMLElement {
  const screen = document.createElement('main');
  screen.className = 'menu-screen';
  screen.innerHTML = `
    <div class="menu-glow menu-glow--one"></div>
    <div class="menu-glow menu-glow--two"></div>
    <section class="brand-block">
      <div class="eyebrow"><span></span> Estratégia em tempo real</div>
      <h1>APEX<br><em>STRATEGY</em></h1>
      <p>Você não segura o volante.<br>Você decide quem vence.</p>
    </section>
    <nav class="menu-actions" aria-label="Menu principal">
      <button class="button button--primary button--hero" data-action="play">
        <span class="button-index">01</span><span>JOGAR</span><b>→</b>
      </button>
      <button class="button button--secondary" data-action="create">
        <span class="button-index">02</span><span>CRIAR CORRIDA</span><b>＋</b>
      </button>
      <button class="button button--ghost" data-action="settings">
        <span class="button-index">03</span><span>CONFIGURAÇÕES</span><b>⚙</b>
      </button>
    </nav>
    <footer class="menu-footer"><span>OFFLINE · SINGLE PLAYER</span><span>v0.1 MVP</span></footer>
  `;
  screen.querySelector('[data-action="play"]')?.addEventListener('click', onQuickRace);
  screen.querySelector('[data-action="create"]')?.addEventListener('click', onCreateRace);
  screen.querySelector('[data-action="settings"]')?.addEventListener('click', onSettings);
  return screen;
}
