export function renderSettings(onBack: () => void): HTMLElement {
  const reducedMotion = localStorage.getItem('apex-reduced-motion') === 'true';
  const screen = document.createElement('main');
  screen.className = 'settings-screen shell';
  screen.innerHTML = `
    <header class="topbar">
      <button class="icon-button" type="button" data-back aria-label="Voltar">←</button>
      <div><span class="eyebrow">Preferências locais</span><h1>Configurações</h1></div>
    </header>
    <section class="settings-panel">
      <div><h2>Movimento reduzido</h2><p>Reduz transições da interface sem alterar a simulação.</p></div>
      <label class="switch"><input type="checkbox" ${reducedMotion ? 'checked' : ''}><span></span></label>
    </section>
    <section class="about-panel"><span>APEX STRATEGY</span><p>Protótipo offline. Nenhum dado sai deste dispositivo.</p><small>Versão 0.1.0</small></section>
  `;
  screen.querySelector('[data-back]')?.addEventListener('click', onBack);
  screen.querySelector<HTMLInputElement>('input[type="checkbox"]')?.addEventListener('change', (event) => {
    const enabled = (event.currentTarget as HTMLInputElement).checked;
    localStorage.setItem('apex-reduced-motion', String(enabled));
    document.documentElement.classList.toggle('reduced-motion', enabled);
  });
  return screen;
}
