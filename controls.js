const api = window.playground;
const byId = id => document.getElementById(id);
const controls = {
  pc: byId('pc-button'), pets: byId('pets-button'), touch: byId('touch-button'),
  play: byId('play-button'), draw: byId('draw-button'),
  visibility: byId('visibility-button'), toolbarHide: byId('toolbar-hide-button'),
  exit: byId('exit-button'), collapse: byId('collapse-button'),
  miniVisibility: byId('mini-visibility-button'),
  panel: byId('control-panel'), panelTitle: byId('panel-title'),
  panelList: byId('panel-list'), error: byId('error-message')
};
const categories = [
  { id: 'basic', name: '기본', builtin: [
    { id: 'blob', label: '슬라임' }
  ] },
  { id: 'cat', name: '고양이', builtin: [] },
  { id: 'dog', name: '강아지', builtin: [] },
  { id: 'character', name: '캐릭터', builtin: [] }
];
const colors = ['#e85b6b', '#4a90e2', '#f2c94c', '#55b88a', '#30384c', '#ffffff'];
let currentState = {
  enabled: true, structuresEnabled: false, mode: 'pc', petId: null,
  drawColor: colors[4], drawSize: 7, drawShape: 'freehand', eraser: false
};
let petSnapshot = { defaultPets: {}, localPets: [], customPets: [] };
let petInstancesSnapshot = [];
let petInstancesRevision = -1;
let petScaleSlider;
let petScaleValue;
let managePage = 0;
const managePageSize = 3;
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
const managePanel = makePanel('manage');
const drawPanel = makePanel('draw');
const playPanel = makePanel('play');
const gunPanel = document.createElement('div');
gunPanel.className = 'gun-options';
gunPanel.hidden = true;
for (const [id,label] of [['awm','AWM'],['ak47','AK-47'],['uzi','UZI'],['double_barrel','더블배럴 샷건']]) {
  const choice = button(label, label, () => { api.setGunWeapon(id); closePanel(); }, 'gun-choice');
  choice.dataset.weapon = id;
  const image = document.createElement('img');
  image.src = `assets/weapons/${id}.png`;
  image.alt = '';
  choice.prepend(image);
  gunPanel.appendChild(choice);
}
for (const [mode, label, image] of [
  ['bomb', '수류탄', 'assets/tools/bomb.png'],
  ['hammer', '망치', 'assets/tools/hammer.png'],
  ['gun', '총', 'assets/weapons/ak47.png'],
  ['blackhole', '블랙홀', 'assets/tools/ui-vortex.svg']
]) {
  const choice = button(label, label, () => {
    if (mode === 'gun') {
      gunPanel.hidden = !gunPanel.hidden;
    } else {
      api.setMode(mode);
      closePanel();
    }
  }, 'play-choice');
  choice.dataset.mode = mode;
  choice.id = `${mode}-button`;
  let icon;
  if (mode === 'blackhole') {
    icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('class', 'play-vortex');
    icon.setAttribute('viewBox', '0 0 32 32');
    icon.setAttribute('aria-hidden', 'true');
    const spiral = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    spiral.setAttribute('d', 'M16 3c9 0 14 6 13 13-1 8-8 13-15 12C6 27 2 21 4 14 6 7 12 5 18 7c6 2 8 8 5 13-3 5-9 6-13 3-4-3-4-8-1-11 3-3 8-2 10 1 2 3 0 6-3 6-2 0-3-2-2-3');
    icon.appendChild(spiral);
  } else {
    icon = document.createElement('img');
    icon.src = image;
    icon.alt = '';
  }
  choice.prepend(icon);
  playPanel.appendChild(choice);
}
playPanel.appendChild(gunPanel);
const structures = button('구조물', '구조물', () => api.setStructuresEnabled(!currentState.structuresEnabled), 'play-choice');
structures.id = 'structures-button';
structures.setAttribute('aria-pressed', 'false');
const ladderIcon = document.createElement('img');
ladderIcon.src = 'assets/tools/ui-ladder.svg';
ladderIcon.alt = '';
structures.prepend(ladderIcon);
playPanel.insertBefore(structures, gunPanel);
const clearCracks = button('균열 지우기', '총·망치 화면 균열 지우기',
  () => api.clear('crack'), 'play-clear-cracks');
playPanel.appendChild(clearCracks);

function drawPetThumbnail(canvas, pet) {
  const ctx = canvas.getContext('2d');
  if (pet.id === 'blob') {
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#4a5568'; ctx.lineWidth = 1.5;
    for (const x of [8, 21]) {
      ctx.beginPath(); ctx.arc(x, 8, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(14.5, 16, 11, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffb3ba';
    for (const x of [7, 22]) { ctx.beginPath(); ctx.arc(x, 19, 2.4, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#2d3748';
    for (const x of [10, 19]) { ctx.beginPath(); ctx.arc(x, 14, 1.4, 0, Math.PI * 2); ctx.fill(); }
    return;
  }
  if (!pet.asset) return;
  const image = new Image();
  image.onload = () => {
    const frameWidth = image.naturalWidth / (pet.columns || 8);
    const frameHeight = image.naturalHeight / pet.rows;
    if (!frameWidth || !frameHeight) return;
    const frame = document.createElement('canvas');
    frame.width = frameWidth;
    frame.height = frameHeight;
    const frameContext = frame.getContext('2d');
    frameContext.drawImage(image, 0, 0, frameWidth, frameHeight, 0, 0, frameWidth, frameHeight);
    const pixels = frameContext.getImageData(0, 0, frameWidth, frameHeight).data;
    let left = frameWidth, top = frameHeight, right = -1, bottom = -1;
    for (let y = 0; y < frameHeight; y++) for (let x = 0; x < frameWidth; x++) {
      if (pixels[(y * frameWidth + x) * 4 + 3] === 0) continue;
      left = Math.min(left, x); top = Math.min(top, y);
      right = Math.max(right, x); bottom = Math.max(bottom, y);
    }
    if (right < left) return;
    const sourceWidth = right - left + 1, sourceHeight = bottom - top + 1;
    const scale = Math.min((canvas.width - 2) / sourceWidth, (canvas.height - 2) / sourceHeight);
    const width = sourceWidth * scale, height = sourceHeight * scale;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(frame, left, top, sourceWidth, sourceHeight,
      (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
  };
  image.src = pet.asset;
}
function addPetChoice(parent, pet) {
  const choice = button(pet.label, pet.name || pet.label, () => {
    api.selectPet(pet.id);
    closePanel();
  }, 'pet-choice');
  choice.dataset.petId = pet.id;
  const thumbnail = document.createElement('canvas');
  thumbnail.width = 29;
  thumbnail.height = 29;
  thumbnail.setAttribute('aria-hidden', 'true');
  choice.prepend(thumbnail);
  drawPetThumbnail(thumbnail, pet);
  parent.appendChild(choice);
}
function buildPetPanel() {
  petPanel.replaceChildren();
  const sizeArea = document.createElement('div');
  sizeArea.className = 'pet-size-area';
  const sizeHeading = document.createElement('label');
  sizeHeading.htmlFor = 'pet-size-slider';
  sizeHeading.textContent = '생성 크기';
  petScaleValue = document.createElement('output');
  petScaleValue.id = 'pet-size-value';
  petScaleValue.htmlFor = 'pet-size-slider';
  petScaleSlider = document.createElement('input');
  petScaleSlider.id = 'pet-size-slider';
  petScaleSlider.type = 'range';
  petScaleSlider.min = '50'; petScaleSlider.max = '1000'; petScaleSlider.step = '10';
  petScaleSlider.value = String(currentState.petScalePercent || 100);
  petScaleSlider.setAttribute('aria-label', '생성 크기');
  petScaleSlider.addEventListener('input', () => {
    petScaleValue.textContent = `${petScaleSlider.value}%`;
    api.setPetScalePercent(Number(petScaleSlider.value));
  });
  const quickSizes = document.createElement('div');
  quickSizes.className = 'pet-size-quick';
  for (const [percent, label] of [[100, '기본'], [200, '2배'], [500, '5배'], [1000, '10배']]) {
    const choice = button(label, `${percent}% 크기`, () => api.setPetScalePercent(percent), 'pet-size-choice');
    choice.dataset.percent = String(percent);
    quickSizes.appendChild(choice);
  }
  const sizeLine = document.createElement('div');
  sizeLine.className = 'pet-size-line';
  sizeLine.append(sizeHeading, petScaleSlider, petScaleValue);
  sizeArea.append(sizeLine, quickSizes);
  petPanel.appendChild(sizeArea);
  for (const category of categories) {
    const choices = [
      ...category.builtin,
      ...petSnapshot.localPets.filter(pet => pet.category === category.id)
        .sort((a, b) => {
          const order = category.id === 'dog' ? ['puddle', 'doge']
            : category.id === 'character' ? ['usagi', 'kirby', 'kirby_sleepy', 'call_duck', 'baby_harp_seal'] : [];
          return order.indexOf(a.id) - order.indexOf(b.id);
        })
        .map(pet => ({ id: pet.id, label: pet.label, name: pet.label,
          asset: pet.asset, columns: pet.columns, rows: pet.rows }))
    ];
    if (!choices.length) continue;
    const row = document.createElement('div');
    row.className = 'pet-category';
    const heading = document.createElement('span');
    heading.className = 'category-label';
    heading.textContent = category.name;
    const grid = document.createElement('div');
    grid.className = 'pet-variants';
    for (const choice of choices) addPetChoice(grid, choice);
    row.append(heading, grid);
    petPanel.appendChild(row);
  }
  const manage = button('현재 펫 관리', '현재 화면의 펫 관리', () => switchPanel('manage'), 'pet-manage-entry');
  manage.id = 'pet-manage-entry';
  petPanel.appendChild(manage);
  updateSelection();
}

function petDetails(definitionId) {
  if (definitionId === 'blob') return { id: 'blob', label: '슬라임' };
  const local = petSnapshot.localPets.find(pet => pet.id === definitionId);
  if (local) return { ...local, label: local.label || local.name };
  const custom = petSnapshot.customPets.find(pet => pet.id === definitionId);
  if (custom) return { id: custom.id, label: custom.name, assetUrl: custom.assetUrl,
    columns: 1, rows: 1 };
  if (definitionId === 'cat') return { id: 'cat', label: '고양이', asset: 'spritesheet.webp', columns: 8, rows: 9 };
  if (definitionId === 'magpie') return { id: 'magpie', label: '까치', asset: 'spritesheet_2.webp', columns: 8, rows: 9 };
  return { id: definitionId, label: definitionId };
}

function buildManagePanel() {
  managePanel.replaceChildren();
  const total = petInstancesSnapshot.length;
  const kindCounts = new Map();
  for (const pet of petInstancesSnapshot)
    kindCounts.set(pet.definitionId, (kindCounts.get(pet.definitionId) || 0) + 1);
  const kinds = [...kindCounts];
  const pageCount = Math.max(1, Math.ceil(kinds.length / managePageSize));
  managePage = Math.min(managePage, pageCount - 1);
  const header = document.createElement('div');
  header.className = 'manage-header';
  header.append(
    button('← 펫 선택', '펫 선택으로 돌아가기', () => switchPanel('pets')),
    Object.assign(document.createElement('strong'), { textContent: `총 ${total}마리 · ${kinds.length}종` })
  );
  managePanel.appendChild(header);
  const list = document.createElement('div');
  list.className = 'manage-list';
  for (const [definitionId, count] of kinds.slice(managePage * managePageSize,
    (managePage + 1) * managePageSize)) {
    const details = petDetails(definitionId);
    const row = document.createElement('div');
    row.className = 'manage-pet-row';
    row.dataset.definitionId = definitionId;
    const thumbnail = document.createElement(details.assetUrl ? 'img' : 'canvas');
    thumbnail.setAttribute('aria-hidden', 'true');
    if (details.assetUrl) {
      thumbnail.src = details.assetUrl;
      thumbnail.alt = '';
    } else {
      thumbnail.width = 29; thumbnail.height = 29;
      drawPetThumbnail(thumbnail, details);
    }
    const name = document.createElement('span');
    name.className = 'manage-pet-name';
    name.textContent = details.label;
    const countLabel = document.createElement('span');
    countLabel.className = 'manage-pet-count';
    countLabel.textContent = `${count}마리`;
    const remove = button('삭제', `${details.label} ${count}마리 삭제`, () => {
      remove.disabled = true;
      api.removePetKind(definitionId);
    }, 'manage-remove');
    row.append(thumbnail, name, countLabel, remove);
    list.appendChild(row);
  }
  if (!total) list.appendChild(Object.assign(document.createElement('p'), {
    className: 'manage-empty', textContent: '현재 화면에 펫이 없습니다.'
  }));
  managePanel.appendChild(list);
  const footer = document.createElement('div');
  footer.className = 'manage-footer';
  const previous = button('이전', '이전 페이지', () => { managePage--; buildManagePanel(); });
  previous.disabled = managePage === 0;
  const next = button('다음', '다음 페이지', () => { managePage++; buildManagePanel(); });
  next.disabled = managePage >= pageCount - 1;
  footer.append(previous, Object.assign(document.createElement('span'), {
    textContent: `${managePage + 1} / ${pageCount}`
  }), next);
  managePanel.appendChild(footer);
}

function applyPetInstances(snapshot) {
  if (!snapshot || !Number.isSafeInteger(snapshot.revision)
    || !Array.isArray(snapshot.instances) || snapshot.revision < petInstancesRevision) return;
  petInstancesRevision = snapshot.revision;
  petInstancesSnapshot = snapshot.instances;
  if (panelKind === 'manage') buildManagePanel();
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
  for (const [mode, element] of [['pc',controls.pc],['touch',controls.touch],['draw',controls.draw]]) {
    const selected = currentState.mode === mode;
    element.classList.toggle('active', selected);
    element.setAttribute('aria-pressed', String(selected));
  }
  const playing = ['bomb', 'hammer', 'gun', 'blackhole'].includes(currentState.mode);
  controls.play.classList.toggle('active', playing);
  controls.play.setAttribute('aria-pressed', String(playing));
  for (const choice of playPanel.querySelectorAll('[data-mode]'))
    choice.classList.toggle('selected', choice.dataset.mode === currentState.mode);
  const petsSelected = currentState.mode === 'spawn';
  controls.pets.classList.toggle('active', petsSelected);
  controls.pets.setAttribute('aria-pressed', String(petsSelected));
  structures.classList.toggle('selected', currentState.structuresEnabled);
  structures.setAttribute('aria-pressed', String(currentState.structuresEnabled));
  controls.visibility.classList.toggle('active', !currentState.enabled);
  controls.visibility.classList.toggle('is-hidden', !currentState.enabled);
  controls.visibility.title = currentState.enabled ? '전체 숨기기' : '전체 보이기';
  controls.visibility.setAttribute('aria-label', controls.visibility.title);
  controls.miniVisibility.classList.toggle('is-hidden', !currentState.enabled);
  controls.miniVisibility.title = currentState.enabled ? '전체 숨기기' : '전체 보이기';
  controls.miniVisibility.setAttribute('aria-label', controls.miniVisibility.title);
  for (const choice of petPanel.querySelectorAll('[data-pet-id]'))
    choice.classList.toggle('selected', currentState.mode === 'spawn' && choice.dataset.petId === currentState.petId);
  if (petScaleSlider && document.activeElement !== petScaleSlider)
    petScaleSlider.value = String(currentState.petScalePercent || 100);
  if (petScaleValue) petScaleValue.textContent = `${document.activeElement === petScaleSlider
    ? petScaleSlider.value : currentState.petScalePercent || 100}%`;
  for (const choice of petPanel.querySelectorAll('[data-percent]'))
    choice.classList.toggle('selected', Number(choice.dataset.percent) === currentState.petScalePercent);
  for (const choice of drawPanel.querySelectorAll('[data-shape]'))
    choice.classList.toggle('selected', choice.dataset.shape === currentState.drawShape && !currentState.eraser);
  for (const choice of drawPanel.querySelectorAll('[data-color]'))
    choice.classList.toggle('selected', choice.dataset.color === currentState.drawColor && !currentState.eraser);
  if (document.activeElement !== byId('draw-size-slider')) {
    byId('draw-size-slider').value = String(Math.round((currentState.drawSize - 1) * 100 / 29));
    byId('draw-size-value').textContent = byId('draw-size-slider').value;
  }
  drawPanel.querySelector('[data-eraser]').classList.toggle('selected', currentState.eraser);
  for (const choice of gunPanel.querySelectorAll('[data-weapon]'))
    choice.classList.toggle('selected', choice.dataset.weapon === (currentState.gunWeapon || 'ak47'));
}
function renderState(next) {
  if (!next || typeof next.enabled !== 'boolean') return;
  const previousMode = currentState.mode;
  const wasPanelOpen = currentState.controlsPanelOpen === true;
  currentState = next;
  if (panelKind && ((wasPanelOpen && next.controlsPanelOpen === false)
    || (previousMode !== 'pc' && next.mode === 'pc'))) {
    closePanel();
    return;
  }
  updateSelection();
}
function applyPetDefinitions(snapshot) {
  if (!snapshot || !Array.isArray(snapshot.localPets) || !Array.isArray(snapshot.customPets)) return;
  petSnapshot = snapshot;
  buildPetPanel();
  if (panelKind === 'manage') buildManagePanel();
}
function switchPanel(kind) {
  panelKind = kind;
  if (kind === 'manage') {
    buildManagePanel();
    api.getPetInstances().then(applyPetInstances).catch(showError);
  }
  controls.panel.hidden = false;
  for (const [name, element] of Object.entries(panels)) element.hidden = name !== kind;
  controls.panelTitle.textContent = { pets: '펫', manage: '현재 펫 관리', draw: '그리기', play: '놀이' }[kind];
  controls.pets.setAttribute('aria-expanded', String(kind === 'pets' || kind === 'manage'));
  controls.draw.setAttribute('aria-expanded', String(kind === 'draw'));
  controls.play.setAttribute('aria-expanded', String(kind === 'play'));
  api.setControlsPanelOpen(true, kind);
  updateSelection();
}
function closePanel() {
  if (!panelKind) return;
  panelKind = null;
  controls.panel.hidden = true;
  api.setControlsPanelOpen(false);
  controls.pets.setAttribute('aria-expanded', 'false');
  controls.draw.setAttribute('aria-expanded', 'false');
  controls.play.setAttribute('aria-expanded', 'false');
  gunPanel.hidden = true;
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
controls.play.addEventListener('click', () => togglePanel('play'));
controls.visibility.addEventListener('click', () => { api.setEnabled(!currentState.enabled); closePanel(); });
controls.toolbarHide.addEventListener('click', hideControls);
controls.exit.addEventListener('click', () => api.exit());
controls.collapse.addEventListener('click', () => setCollapsed(true));
controls.miniVisibility.addEventListener('click', () => api.setEnabled(!currentState.enabled));
byId('panel-close').addEventListener('click', closePanel);
document.addEventListener('pointerdown', event => {
  if (panelKind && !controls.panel.contains(event.target)
    && ![controls.pets, controls.draw, controls.play].some(button => button.contains(event.target))) closePanel();
});
byId('expand-button').addEventListener('click', () => setCollapsed(false));
byId('mini-exit-button').addEventListener('click', () => api.exit());
api.onState(renderState);
api.onPetDefinitions(applyPetDefinitions);
api.onPetInstances(applyPetInstances);
api.getState().then(renderState).catch(showError);
api.getPetDefinitions().then(applyPetDefinitions).catch(showError);
api.getPetInstances().then(applyPetInstances).catch(showError);
api.getControlsUiState().then(saved => {
  if (saved && typeof saved.collapsed === 'boolean') document.body.classList.toggle('collapsed', saved.collapsed);
}).catch(showError);
