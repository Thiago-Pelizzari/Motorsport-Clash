import { soundEngine } from '../audio/SoundEngine';

export function renderSettings(onBack: () => void): HTMLElement {
  const reducedMotion = localStorage.getItem('apex-reduced-motion') === 'true';
  const soundEnabled = soundEngine.isEnabled();
  const volume = Math.round(soundEngine.getVolume() * 100);

  const screen = document.createElement('main');
  screen.className = 'settings-screen shell';
  screen.innerHTML = `
    <header class="topbar">
      <button class="icon-button" type="button" data-back aria-label="Voltar">←</button>
      <div><span class="eyebrow">Preferências locais</span><h1>Configurações</h1></div>
    </header>
    <section class="settings-panel">
      <div><h2>Efeitos sonoros táticos</h2><p>Síntese Web Audio API para rádio da equipe, pit stops e alertas de corrida.</p></div>
      <label class="switch"><input type="checkbox" data-sound-toggle ${soundEnabled ? 'checked' : ''}><span></span></label>
    </section>
    <section class="settings-panel">
      <div><h2>Volume do áudio <output data-volume-out>${volume}%</output></h2><p>Ajuste a intensidade dos efeitos sonoros procedurais.</p></div>
      <input type="range" data-volume-slider min="0" max="100" value="${volume}" style="max-width: 220px;">
    </section>
    <section class="settings-panel">
      <div><h2>Movimento reduzido</h2><p>Reduz transições da interface, partículas de chuva e suavização de câmera.</p></div>
      <label class="switch"><input type="checkbox" data-motion-toggle ${reducedMotion ? 'checked' : ''}><span></span></label>
    </section>
    <section class="about-panel">
      <span>ATALHOS DE TECLADO NA CORRIDA</span>
      <div class="shortcuts-grid">
        <div><b>ESPAÇO</b><span>Pausar / Retomar</span></div>
        <div><b>1 / 2 / 3</b><span>Velocidades 1× / 2× / 4×</span></div>
        <div><b>Q / W / E</b><span>Ritmo Carro 1 (Conservar / Normal / Atacar)</span></div>
        <div><b>A / S / D</b><span>Ritmo Carro 2 (Conservar / Normal / Atacar)</span></div>
        <div><b>F / R</b><span>Seguir Piloto / Resetar Câmera</span></div>
        <div><b>+ / -</b><span>Aumentar / Diminuir Zoom</span></div>
      </div>
    </section>
    <section class="about-panel">
      <span>APEX STRATEGY 2.0</span>
      <p>Simulador offline de estratégia automobilística. Todos os dados permanecem salvos localmente neste dispositivo.</p>
      <small>Versão 2.0.0</small>
    </section>
  `;

  screen.querySelector('[data-back]')?.addEventListener('click', onBack);

  screen.querySelector<HTMLInputElement>('[data-sound-toggle]')?.addEventListener('change', (event) => {
    const enabled = (event.currentTarget as HTMLInputElement).checked;
    soundEngine.setEnabled(enabled);
    if (enabled) soundEngine.playRadioBeep();
  });

  const volOut = screen.querySelector<HTMLOutputElement>('[data-volume-out]')!;
  screen.querySelector<HTMLInputElement>('[data-volume-slider]')?.addEventListener('input', (event) => {
    const val = Number((event.currentTarget as HTMLInputElement).value);
    volOut.value = `${val}%`;
    soundEngine.setVolume(val / 100);
  });
  screen.querySelector<HTMLInputElement>('[data-volume-slider]')?.addEventListener('change', () => {
    soundEngine.playUiClick();
  });

  screen.querySelector<HTMLInputElement>('[data-motion-toggle]')?.addEventListener('change', (event) => {
    const enabled = (event.currentTarget as HTMLInputElement).checked;
    localStorage.setItem('apex-reduced-motion', String(enabled));
    document.documentElement.classList.toggle('reduced-motion', enabled);
  });

  return screen;
}
