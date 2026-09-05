import { deleteCustomTrack, loadCustomTracks, saveCustomTrack } from '../storage/trackStorage';
import { BLOCK_DEFINITIONS, createTrackFromBlocks, pointsFromBlocks, trackArea } from '../tracks/blockBuilder';
import { TRACK_TEMPLATES } from '../tracks/blockTracks';
import type { Track, TrackBlockType } from '../types/race';

const BLOCK_TYPES = Object.keys(BLOCK_DEFINITIONS) as TrackBlockType[];
const MAX_BLOCKS = 32;

export function renderTrackCreator(onBack: () => void, onUseTrack: (trackId: string) => void): HTMLElement {
  const screen = document.createElement('main');
  screen.className = 'track-creator-screen shell';
  let blocks = [...TRACK_TEMPLATES[0].blocks];

  screen.innerHTML = `
    <header class="topbar">
      <button class="icon-button" type="button" data-action="back" aria-label="Voltar">←</button>
      <div><span class="eyebrow">Oficina de circuitos</span><h1>Criador de pistas</h1></div>
      <div class="step-marker">BLOCK LAB / 01</div>
    </header>
    <section class="creator-intro">
      <div><span class="eyebrow">Monte · teste · corra</span><h2>Construa um traçado bloco a bloco</h2></div>
      <p>Escolha um modelo ou combine retas, curvas e chicanes. A última peça é ligada automaticamente à largada para fechar o circuito.</p>
    </section>
    <div class="creator-layout">
      <aside class="block-palette creator-panel">
        <div class="creator-panel-title"><span>01</span><div><h3>BLOCOS</h3><small>CLIQUE PARA ADICIONAR</small></div></div>
        <div class="block-grid">
          ${BLOCK_TYPES.map((type) => {
            const block = BLOCK_DEFINITIONS[type];
            return `<button type="button" data-add-block="${type}"><i>${block.glyph}</i><span>${block.label}</span><small>${block.description}</small></button>`;
          }).join('')}
        </div>
      </aside>
      <section class="creator-workspace creator-panel">
        <div class="creator-toolbar">
          <div><strong>MODELOS</strong>${TRACK_TEMPLATES.map((template) => `<button type="button" data-template="${template.id}">${template.name}</button>`).join('')}</div>
          <div><button type="button" data-action="undo">↶ DESFAZER</button><button type="button" data-action="clear">LIMPAR</button></div>
        </div>
        <div class="builder-preview" data-builder-preview></div>
        <div class="preview-legend"><span><i></i>LARGADA</span><span data-block-count></span><span data-corner-count></span></div>
        <div class="block-sequence" data-block-sequence aria-label="Sequência de blocos"></div>
      </section>
      <aside class="track-properties creator-panel">
        <div class="creator-panel-title"><span>02</span><div><h3>PROPRIEDADES</h3><small>IDENTIDADE E BALANCEAMENTO</small></div></div>
        <label>NOME DA PISTA<input name="track-name" maxlength="32" value="Minha Pista"></label>
        <label>COMPRIMENTO<input name="track-length" type="number" min="1000" max="8000" step="10" value="3200"><small>metros</small></label>
        <label>VELOCIDADE MÉDIA<input name="average-speed" type="number" min="120" max="240" value="180"><small>km/h</small></label>
        <label>DESGASTE DOS PNEUS
          <select name="tyre-wear"><option value="0.85">Baixo</option><option value="1" selected>Equilibrado</option><option value="1.2">Alto</option><option value="1.35">Extremo</option></select>
        </label>
        <label>CHANCE DE ULTRAPASSAGEM <output data-overtake-output>60%</output><input name="overtake" type="range" min="20" max="90" value="60"></label>
        <label>COR DE DESTAQUE<input name="accent" type="color" value="#ff334f"></label>
        <p class="creator-error" data-creator-message role="status" aria-live="polite"></p>
        <button class="button button--primary creator-save" type="button" data-action="save">SALVAR PISTA <b>＋</b></button>
      </aside>
    </div>
    <section class="saved-tracks creator-panel">
      <div class="creator-panel-title"><span>03</span><div><h3>MINHAS PISTAS</h3><small>SALVAS NESTE DISPOSITIVO</small></div></div>
      <div class="saved-track-grid" data-saved-tracks></div>
    </section>
  `;

  const renderEditor = (): void => {
    const points = pointsFromBlocks(blocks);
    const preview = screen.querySelector<HTMLElement>('[data-builder-preview]')!;
    const pathPoints = [...points, points[0]].map((point) => `${point.x},${point.y}`).join(' ');
    preview.innerHTML = `
      <svg viewBox="0 0 1000 620" role="img" aria-label="Prévia da pista criada">
        <defs><pattern id="builder-grid" width="50" height="50" patternUnits="userSpaceOnUse"><path d="M 50 0 L 0 0 0 50" fill="none" stroke="rgba(255,255,255,.05)" stroke-width="1"/></pattern></defs>
        <rect width="1000" height="620" fill="url(#builder-grid)"/>
        <polyline class="preview-shadow" points="${pathPoints}"/>
        <polyline class="preview-road" points="${pathPoints}"/>
        <polyline class="preview-line" points="${pathPoints}"/>
        ${points.map((point, index) => `<circle cx="${point.x}" cy="${point.y}" r="${index === 0 ? 12 : 6}" class="${index === 0 ? 'start-node' : 'block-node'}"/>`).join('')}
      </svg>`;
    screen.querySelector<HTMLElement>('[data-block-count]')!.textContent = `${blocks.length}/${MAX_BLOCKS} BLOCOS`;
    const corners = blocks.reduce((total, type) => total + BLOCK_DEFINITIONS[type].steps.filter((step) => step.turn !== 0).length, 0);
    screen.querySelector<HTMLElement>('[data-corner-count]')!.textContent = `${corners} CURVAS`;
    const sequence = screen.querySelector<HTMLElement>('[data-block-sequence]')!;
    sequence.innerHTML = blocks.length === 0
      ? '<p>Adicione o primeiro bloco usando a paleta.</p>'
      : blocks.map((type, index) => `<button type="button" data-remove-block="${index}" title="Remover ${BLOCK_DEFINITIONS[type].label}"><i>${BLOCK_DEFINITIONS[type].glyph}</i><span>${index + 1}. ${BLOCK_DEFINITIONS[type].shortLabel}</span><b>×</b></button>`).join('');
  };

  const renderSavedTracks = (): void => {
    const container = screen.querySelector<HTMLElement>('[data-saved-tracks]')!;
    const tracks = loadCustomTracks();
    container.innerHTML = tracks.length === 0
      ? '<div class="saved-empty">Nenhuma pista personalizada ainda. Monte um traçado e salve sua primeira criação.</div>'
      : tracks.map((track) => savedTrackCard(track)).join('');
  };

  screen.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
    if (!button) return;
    if (button.dataset.action === 'back') onBack();
    const blockType = button.dataset.addBlock as TrackBlockType | undefined;
    if (blockType && blocks.length < MAX_BLOCKS) { blocks.push(blockType); renderEditor(); }
    if (button.dataset.removeBlock !== undefined) { blocks.splice(Number(button.dataset.removeBlock), 1); renderEditor(); }
    const templateId = button.dataset.template;
    if (templateId) {
      const template = TRACK_TEMPLATES.find((item) => item.id === templateId);
      if (template) { blocks = [...template.blocks]; renderEditor(); setMessage(`${template.name} carregado.`, false); }
    }
    if (button.dataset.action === 'undo') { blocks.pop(); renderEditor(); }
    if (button.dataset.action === 'clear') { blocks = []; renderEditor(); }
    if (button.dataset.action === 'save') saveTrack();
    if (button.dataset.useTrack) onUseTrack(button.dataset.useTrack);
    if (button.dataset.deleteTrack) { deleteCustomTrack(button.dataset.deleteTrack); renderSavedTracks(); setMessage('Pista removida.', false); }
  });

  screen.querySelector<HTMLInputElement>('input[name="overtake"]')?.addEventListener('input', (event) => {
    screen.querySelector<HTMLOutputElement>('[data-overtake-output]')!.value = `${(event.currentTarget as HTMLInputElement).value}%`;
  });

  function saveTrack(): void {
    const name = screen.querySelector<HTMLInputElement>('input[name="track-name"]')!.value.trim();
    const points = pointsFromBlocks(blocks);
    const turns = blocks.filter((type) => BLOCK_DEFINITIONS[type].steps.some((step) => step.turn !== 0)).length;
    if (name.length < 3) { setMessage('Dê um nome com pelo menos 3 caracteres.', true); return; }
    if (blocks.length < 6 || turns < 3 || trackArea(points) < 10_000) { setMessage('Use pelo menos 6 blocos, 3 curvas e forme uma área fechada.', true); return; }
    const length = numberInput('track-length', 1000, 8000);
    const averageSpeed = numberInput('average-speed', 120, 240);
    const tyreWear = Number(screen.querySelector<HTMLSelectElement>('select[name="tyre-wear"]')!.value);
    const overtakeChance = Number(screen.querySelector<HTMLInputElement>('input[name="overtake"]')!.value) / 100;
    const accent = screen.querySelector<HTMLInputElement>('input[name="accent"]')!.value;
    const safeName = name.replace(/[<>&"']/g, '').slice(0, 32);
    const track = createTrackFromBlocks({
      id: `custom-${Date.now().toString(36)}`,
      name: safeName,
      location: 'Oficina do jogador',
      description: `Circuito personalizado construído com ${blocks.length} blocos.`,
      blocks,
      length,
      averageSpeed,
      tyreWear,
      overtakeChance,
      accent,
      source: 'custom',
    });
    saveCustomTrack(track);
    renderSavedTracks();
    setMessage(`${safeName} foi salva e já pode ser usada.`, false);
  }

  function numberInput(name: string, minimum: number, maximum: number): number {
    const value = Number(screen.querySelector<HTMLInputElement>(`input[name="${name}"]`)!.value);
    return Math.max(minimum, Math.min(maximum, Number.isFinite(value) ? value : minimum));
  }

  function setMessage(message: string, error: boolean): void {
    const element = screen.querySelector<HTMLElement>('[data-creator-message]')!;
    element.textContent = message;
    element.classList.toggle('is-error', error);
  }

  renderEditor();
  renderSavedTracks();
  return screen;
}

function savedTrackCard(track: Track): string {
  const points = [...track.points, track.points[0]].map((point) => `${point.x},${point.y}`).join(' ');
  return `<article class="saved-track-card" style="--track-accent:${track.accent}">
    <svg viewBox="0 0 1000 620" aria-hidden="true"><polyline points="${points}"/></svg>
    <div><span>PISTA PERSONALIZADA</span><h4>${track.name}</h4><small>${(track.length / 1000).toFixed(2)} km · ${track.corners} curvas · ${track.blocks?.length ?? 0} blocos</small></div>
    <button type="button" data-use-track="${track.id}">USAR NA CORRIDA →</button>
    <button type="button" class="delete-track" data-delete-track="${track.id}" aria-label="Excluir ${track.name}">×</button>
  </article>`;
}
