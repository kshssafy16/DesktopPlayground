const api = window.playground;
const byId = id => document.getElementById(id);
const controls = {
  pc: byId('pc-button'), pets: byId('pets-button'), touch: byId('touch-button'),
  draw: byId('draw-button'), bomb: byId('bomb-button'), blackhole: byId('blackhole-button'),
  structures: byId('structures-button'), visibility: byId('visibility-button'),
  exit: byId('exit-button'), collapse: byId('collapse-button'),
  miniVisibility: byId('mini-visibility-button'),
  panel: byId('control-panel'), panelTitle: byId('panel-title'),
  panelList: byId('panel-list'), error: byId('error-message')
};
const categories = [
  { id: 'basic', name: '기본', icon: '✦', builtin: [
    { id: 'blob', label: '슬라임' }, { id: 'robot', label: '로봇' },
    { id: 'ghost', label: '유령' }, { id: 'star', label: '별' },
    { id: 'cloud', label: '구름' }
  ] },
  { id: 'cat', name: '고양이', icon: '🐈', builtin: [] },
  { id: 'dog', name: '강아지', icon: '🐕', builtin: [] },
  { id: 'character', name: '캐릭터', icon: '⭐', builtin: [] }
];
const colors = ['#e85b6b', '#4a90e2', '#f2c94c', '#55b88a', '#30384c', '#ffffff'];
let currentState = {
  enabled: true, structuresEnabled: false, mode: 'pc', petId: null,
  drawColor: colors[4], drawSize: 7, drawShape: 'freehand', eraser: false
};
let petSnapshot = { defaultPets: {}, localPets: [], customPets: [] };
let panelKind = null;
let errorTimer = null;
const panels = {};
if (window.innerWidth < 300) document.body.classList.add('collapsed');

function showError(error) {
  controls.error.textContent = error instanceof Error ? error.message : '요청을 처리하지 못했습니다.';
  clearTimeout(errorTimer);
  errorTimer = setTimeout(() => { controls.error.textContent = ''; }, 4000);
}
function button(label, title, action, className = '') {
  const element = document.createElement('button');
  element.type = 'button';
  element.className = className;
  element.textContent = label;
  element.title = title;
  element.setAttribute('aria-label', title);
  element.addEventListener('click', action);
  return element;
}
function makePanel(kind) {
  const element = document.createElement('div');
  element.className = 'panel-content panel-' + kind;
  element.hidden = true;
  controls.panelList.appendChild(element);
  panels[kind] = element;
  return element;
}
const petPanel = makePanel('pets');
const drawPanel = makePanel('draw');

function addPetChoice(parent, pet, icon) {
  const choice = button(icon + ' ' + pet.label, pet.name || pet.label, () => {
    api.selectPet(pet.id);
    closePanel();
  }, 'pet-choice');
  choice.dataset.petId = pet.id;
  parent.appendChild(choice);
}
function buildPetPanel() {
  petPanel.replaceChildren();
  for (const category of categories) {
    const choices = [
      ...category.builtin,
      ...petSnapshot.localPets.filter(pet => pet.category === category.id)
        .sort((a, b) => {
          const order = category.id === 'dog' ? ['puddle', 'doge']
            : category.id === 'character' ? ['usagi', 'kirby', 'kirby_sleepy'] : [];
          return order.indexOf(a.id) - order.indexOf(b.id);
        })
        .map(pet => ({ id: pet.id, label: pet.label, name: pet.name }))
    ];
    if (!choices.length) continue;
    const row = document.createElement('div');
    row.className = 'pet-category';
    const heading = document.createElement('span');
    heading.className = 'category-label';
    heading.textContent = category.name;
    const grid = document.createElement('div');
    grid.className = 'pet-variants';
    for (const choice of choices) addPetChoice(grid, choice, category.icon);
    row.append(heading, grid);
    petPanel.appendChild(row);
  }
  updateSelection();
}
function buildDrawPanel() {
  const shapes = document.createElement('div');
  shapes.className = 'brush-options shape-options';
  for (const [id, path, label] of [
    ['freehand', 'M3 17c3-11 5 5 9-6s5 7 9-4', '자유형'],
    ['line', 'M4 19 20 5', '직선'],
    ['rect', 'M4 5h16v14H4z', '사각형'],
    ['ellipse', 'M20 12a8 8 0 1 1-16 0 8 8 0 0 1 16 0z', '원형/타원']
  ]) {
    const choice = button('', label, () => api.setBrush({ drawShape: id, eraser: false }), 'shape-button');
    choice.appendChild(drawIcon(path));
    choice.dataset.shape = id;
    shapes.appendChild(choice);
  }
  const swatches = document.createElement('div');
  swatches.className = 'brush-options color-options';
  for (const color of colors) {
    const choice = button('', '색상 ' + color, () => api.setBrush({ drawColor: color, eraser: false }), 'color-swatch');
    choice.style.backgroundColor = color;
    choice.dataset.color = color;
    swatches.appendChild(choice);
  }
  const sizes = document.createElement('div');
  sizes.className = 'brush-options size-options';
  const slider = document.createElement('input');
  slider.id = 'draw-size-slider'; slider.type = 'range'; slider.min = '0'; slider.max = '100';
  slider.value = String(Math.round((currentState.drawSize - 1) * 100 / 29));
  slider.title = '굵기'; slider.setAttribute('aria-label', '굵기');
  slider.addEventListener('input', () => {
    byId('draw-size-value').textContent = slider.value;
    api.setBrush({ drawSize: 1 + Math.round(Number(slider.value) * 29 / 100) });
  });
  const value = document.createElement('span');
  value.id = 'draw-size-value'; value.textContent = slider.value;
  const actions = document.createElement('div');
  actions.className = 'brush-options draw-actions';
  const eraser = button('', '지우개', () => api.setBrush({ eraser: !currentState.eraser }), 'eraser-button');
  eraser.appendChild(drawIcon('m4 15 8-10 8 7-8 10H9zM7 18h13'));
  eraser.dataset.eraser = 'true';
  const clear = button('', '그림 전체 지우기', () => api.clear('drawing'), 'clear-drawing-button');
  clear.appendChild(drawIcon('M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 3v7m4-7v7'));
  actions.append(eraser, clear);
  sizes.append(slider, value);
  drawPanel.append(shapes, swatches, sizes, actions);
}
function drawIcon(pathData) {
  const namespace = 'http://www.w3.org/2000/svg';
  const icon = document.createElementNS(namespace, 'svg');
  icon.setAttribute('class', 'draw-option-icon');
  icon.setAttribute('viewBox', '0 0 24 24');
  icon.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(namespace, 'path');
  path.setAttribute('d', pathData);
  icon.appendChild(path);
  return icon;
}
function updateSelection() {
  for (const [mode, element] of [['pc',controls.pc],['touch',controls.touch],
    ['draw',controls.draw],['bomb',controls.bomb],['blackhole',controls.blackhole]]) {
    element.classList.toggle('active', currentState.mode === mode);
  }
  controls.pets.classList.toggle('active', currentState.mode === 'spawn' || panelKind === 'pets');
  controls.structures.classList.toggle('active', currentState.structuresEnabled);
  controls.structures.setAttribute('aria-pressed', String(currentState.structuresEnabled));
  controls.structures.title = currentState.structuresEnabled ? '구조물 끄기' : '구조물 켜기';
  controls.structures.setAttribute('aria-label', controls.structures.title);
  controls.visibility.classList.toggle('active', !currentState.enabled);
  controls.visibility.title = currentState.enabled ? 'Playground 숨기기' : 'Playground 보이기';
  controls.visibility.setAttribute('aria-label', currentState.enabled ? '숨기기' : '보이기');
  controls.visibility.textContent = currentState.enabled ? '👁' : '◉';
  controls.miniVisibility.title = controls.visibility.title;
  controls.miniVisibility.setAttribute('aria-label', currentState.enabled ? '숨기기' : '보이기');
  controls.miniVisibility.textContent = controls.visibility.textContent;
  for (const choice of petPanel.querySelectorAll('[data-pet-id]'))
    choice.classList.toggle('selected', currentState.mode === 'spawn' && choice.dataset.petId === currentState.petId);
  for (const choice of drawPanel.querySelectorAll('[data-shape]'))
    choice.classList.toggle('selected', choice.dataset.shape === currentState.drawShape && !currentState.eraser);
  for (const choice of drawPanel.querySelectorAll('[data-color]'))
    choice.classList.toggle('selected', choice.dataset.color === currentState.drawColor && !currentState.eraser);
  if (document.activeElement !== byId('draw-size-slider')) {
    byId('draw-size-slider').value = String(Math.round((currentState.drawSize - 1) * 100 / 29));
    byId('draw-size-value').textContent = byId('draw-size-slider').value;
  }
  drawPanel.querySelector('[data-eraser]').classList.toggle('selected', currentState.eraser);
}
function renderState(next) {
  if (!next || typeof next.enabled !== 'boolean') return;
  const previousMode = currentState.mode;
  currentState = next;
  if (previousMode !== 'pc' && next.mode === 'pc' && panelKind) {
    closePanel();
    return;
  }
  updateSelection();
}
function applyPetDefinitions(snapshot) {
  if (!snapshot || !Array.isArray(snapshot.localPets) || !Array.isArray(snapshot.customPets)) return;
  petSnapshot = snapshot;
  buildPetPanel();
}
function switchPanel(kind) {
  panelKind = kind;
  controls.panel.hidden = false;
  for (const [name, element] of Object.entries(panels)) element.hidden = name !== kind;
  controls.panelTitle.textContent = { pets: '펫 추가', draw: '그리기' }[kind];
  controls.pets.setAttribute('aria-expanded', String(kind === 'pets'));
  controls.draw.setAttribute('aria-expanded', String(kind === 'draw'));
  api.setControlsPanelOpen(true);
  updateSelection();
}
function closePanel() {
  if (!panelKind) return;
  panelKind = null;
  controls.panel.hidden = true;
  api.setControlsPanelOpen(false);
  controls.pets.setAttribute('aria-expanded', 'false');
  controls.draw.setAttribute('aria-expanded', 'false');
  updateSelection();
}
function togglePanel(kind) {
  if (panelKind === kind) closePanel();
  else switchPanel(kind);
}
function hideControls() { closePanel(); api.hideControls(); }
function setCollapsed(collapsed) {
  closePanel();
  if (collapsed) api.setMode('pc');
  document.body.classList.toggle('collapsed', collapsed);
  api.setControlsCollapsed(collapsed);
}
buildDrawPanel();
buildPetPanel();
controls.pc.addEventListener('click', () => { api.setMode('pc'); closePanel(); });
controls.pets.addEventListener('click', () => togglePanel('pets'));
controls.touch.addEventListener('click', () => { api.setMode('touch'); closePanel(); });
controls.draw.addEventListener('click', () => { api.setMode('draw'); togglePanel('draw'); });
controls.bomb.addEventListener('click', () => { api.setMode('bomb'); closePanel(); });
controls.blackhole.addEventListener('click', () => { api.setMode('blackhole'); closePanel(); });
controls.structures.addEventListener('click', () => api.setStructuresEnabled(!currentState.structuresEnabled));
controls.visibility.addEventListener('click', () => { api.setEnabled(!currentState.enabled); closePanel(); });
controls.exit.addEventListener('click', () => api.exit());
controls.collapse.addEventListener('click', () => setCollapsed(true));
controls.miniVisibility.addEventListener('click', () => api.setEnabled(!currentState.enabled));
byId('panel-close').addEventListener('click', closePanel);
byId('expand-button').addEventListener('click', () => setCollapsed(false));
byId('mini-exit-button').addEventListener('click', () => api.exit());
api.onState(renderState);
api.onPetDefinitions(applyPetDefinitions);
api.getState().then(renderState).catch(showError);
api.getPetDefinitions().then(applyPetDefinitions).catch(showError);
api.getControlsUiState().then(saved => {
  if (saved && typeof saved.collapsed === 'boolean') document.body.classList.toggle('collapsed', saved.collapsed);
}).catch(showError);
