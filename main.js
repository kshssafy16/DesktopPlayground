const {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain,
  Menu,
  nativeImage,
  protocol,
  screen,
  Tray
} = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { deflateSync } = require('node:zlib');
const fsSync = require('node:fs');
const fs = require('node:fs/promises');
const { loadLocalPets, LOCAL_PET_IDS } = require('./local-pets');

protocol.registerSchemesAsPrivileged([
  { scheme: 'pet-asset', privileges: { standard: true, secure: true, supportFetchAPI: false } }
]);

const APP_ID = 'com.desktopplayground.app';
// Keep the existing %APPDATA%\desktop-playground UI-state location when
// package.json supplies the Beta's capitalized productName.
app.setName('DesktopPlayground');
const USER_DATA_PATH = path.join(app.getPath('appData'), 'desktop-playground');
fsSync.mkdirSync(USER_DATA_PATH, { recursive: true });
app.setPath('userData', USER_DATA_PATH);
const DEFAULT_PET_IDS = ['basic', 'blob', 'robot', 'bug', 'ghost', 'star', 'cloud', 'cat', 'magpie', ...LOCAL_PET_IDS];
const localPets = loadLocalPets(path.join(__dirname, 'assets', 'pets'));
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_IMAGE_PIXELS = 16 * 1024 * 1024;
const PET_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MODES = new Set(['pc', 'touch', 'draw', 'bomb', 'blackhole', 'spawn']);
const BRUSH_COLORS = new Set(['#e85b6b', '#4a90e2', '#f2c94c', '#55b88a', '#30384c', '#ffffff']);
const DRAW_SHAPES = new Set(['freehand', 'line', 'rect', 'ellipse']);
const EMERGENCY_SHORTCUT = 'Control+Alt+Shift+P';

const hasSingleInstance = app.requestSingleInstanceLock();
let overlayWindow = null;
let controlsWindow = null;
let tray = null;
let quitting = false;
let quitReady = false;
let quitPromise = null;
let state = {
  enabled: true,
  structuresEnabled: false,
  auxiliaryEffectsEnabled: true,
  mode: 'pc',
  petId: null,
  drawColor: '#30384c',
  drawSize: 7,
  drawShape: 'freehand',
  eraser: false
};
const controlsUiState = { x: null, y: null, collapsed: false };
const CONTROLS_EXPANDED = { width: 490, height: 56 };
const CONTROLS_COLLAPSED = { width: 152, height: 52 };
const CONTROLS_PANEL = { width: 490, height: 335 };
const CONTROLS_EDGE_GUARD = 8;
let controlsPanelOpen = false;
let uiSaveTimer = null;
let uiWriteChain = Promise.resolve();
let petWriteChain = Promise.resolve();
let petSettings = defaultPetSettings();

function defaultPetSettings() {
  return { schemaVersion: 1, auxiliaryEffectsEnabled: true,
    defaultPets: Object.fromEntries(DEFAULT_PET_IDS.map(id => [id, true])), customPets: [] };
}

function isAllowedPet(id) {
  if (typeof id !== 'string') return false;
  return DEFAULT_PET_IDS.includes(id)
    ? (['basic', 'blob', 'robot', 'bug', 'ghost', 'star', 'cloud', 'cat', 'magpie'].includes(id) || localPets.some(pet => pet.id === id))
    : petSettings.customPets.some(pet => pet.id === id && pet.enabled);
}

if (!hasSingleInstance) {
  app.quit();
} else {
  app.setAppUserModelId(APP_ID);

  app.on('second-instance', () => showControls());
  app.on('before-quit', event => {
    if (!quitReady) {
      event.preventDefault();
      requestAppQuit();
    }
  });

  app.whenReady().then(async () => {
    await loadUiState();
    await loadPetSettings();
    state.auxiliaryEffectsEnabled = petSettings.auxiliaryEffectsEnabled;
    registerPetAssetProtocol();
    createWindows();
    createTray();
    if (!globalShortcut.register(EMERGENCY_SHORTCUT, () => setState({ mode: 'pc' }))) {
      console.warn('Could not register PC Mode shortcut:', EMERGENCY_SHORTCUT);
    }
    screen.on('display-metrics-changed', resizeOverlay);
    screen.on('display-added', resizeOverlay);
    screen.on('display-removed', resizeOverlay);
  }).catch(error => {
    console.error('DesktopPlayground could not start:', error);
    app.quit();
  });
}

function createWindows() {
  const primary = screen.getPrimaryDisplay();
  const bounds = safeOverlayBounds(primary);

  overlayWindow = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    title: 'DesktopPlayground overlay',
    transparent: true,
    backgroundColor: '#00000000',
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    focusable: false,
    skipTaskbar: true,
    show: false,
    webPreferences: secureWebPreferences('preload.js')
  });
  overlayWindow.setAlwaysOnTop(true, 'floating');
  overlayWindow.setIgnoreMouseEvents(true);
  overlayWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  overlayWindow.webContents.on('will-navigate', (event, url) => {
    if (url !== pathToFileUrl('index.html')) event.preventDefault();
  });
  overlayWindow.on('close', event => preventWindowClose(event, overlayWindow));
  overlayWindow.on('show', raiseOverlay);
  overlayWindow.on('restore', raiseOverlay);
  const revealOverlay = () => {
    if (state.enabled) overlayWindow.showInactive();
    publishState();
  };
  overlayWindow.once('ready-to-show', revealOverlay);
  overlayWindow.webContents.once('did-finish-load', revealOverlay);
  overlayWindow.loadFile(path.join(__dirname, 'index.html'));

  const preferredSize = controlsUiState.collapsed ? CONTROLS_COLLAPSED : CONTROLS_EXPANDED;
  const savedBounds = controlsUiState.x === null || controlsUiState.y === null
    ? null
    : { x: controlsUiState.x, y: controlsUiState.y, ...preferredSize };
  const initialBounds = clampControlsBounds(savedBounds, savedBounds ? screen.getDisplayMatching(savedBounds) : primary);
  controlsWindow = new BrowserWindow({
    ...initialBounds,
    title: 'DesktopPlayground controls',
    transparent: true,
    backgroundColor: '#00000000',
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    webPreferences: secureWebPreferences('preload.js')
  });
  controlsWindow.setAlwaysOnTop(true, 'pop-up-menu');
  controlsWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  controlsWindow.webContents.on('will-navigate', (event, url) => {
    if (url !== pathToFileUrl('controls.html')) event.preventDefault();
  });
  controlsWindow.on('close', event => preventWindowClose(event, controlsWindow));
  controlsWindow.on('show', raiseControls);
  controlsWindow.on('restore', raiseControls);
  controlsWindow.on('blur', raiseOverlay);
  controlsWindow.on('closed', () => {
    controlsWindow = null;
  });
  controlsWindow.on('move', clampAndStoreControlsBounds);
  const revealControls = () => {
    controlsWindow.showInactive();
    raiseControls();
    publishState();
  };
  controlsWindow.once('ready-to-show', revealControls);
  controlsWindow.webContents.once('did-finish-load', revealControls);
  controlsWindow.loadFile(path.join(__dirname, 'controls.html'));
}

function safeOverlayBounds(display) {
  const area = display.workArea;
  const bounds = display.bounds;
  // Auto-hidden taskbars can make workArea equal the whole display.
  // Leave an edge strip free on all sides so the shell remains reachable.
  const needsEdgeStrip = area.x === bounds.x && area.y === bounds.y
    && area.width === bounds.width && area.height === bounds.height;
  const insetX = needsEdgeStrip ? Math.min(48, Math.floor((area.width - 1) / 2)) : 0;
  const insetY = needsEdgeStrip ? Math.min(48, Math.floor((area.height - 1) / 2)) : 0;
  return {
    x: area.x + insetX,
    y: area.y + insetY,
    width: Math.max(1, area.width - insetX * 2),
    height: Math.max(1, area.height - insetY * 2)
  };
}

function raiseControls() {
  if (!controlsWindow || controlsWindow.isDestroyed() || !controlsWindow.isVisible()) return;
  controlsWindow.setAlwaysOnTop(true, 'pop-up-menu');
  controlsWindow.moveTop();
}

function raiseOverlay() {
  if (!overlayWindow || overlayWindow.isDestroyed() || !overlayWindow.isVisible()) return;
  // Reapply the native topmost band after show/restore or toolbar deactivation.
  // moveTop changes z-order without activating the click-through overlay.
  overlayWindow.setAlwaysOnTop(true, 'floating');
  overlayWindow.moveTop();
  raiseControls();
}

function pathToFileUrl(filename) {
  return pathToFileURL(path.join(__dirname, filename)).href;
}

function secureWebPreferences(preloadFile) {
  return {
    preload: path.join(__dirname, preloadFile),
    nodeIntegration: false,
    contextIsolation: true,
    sandbox: true
  };
}

function preventWindowClose(event, window) {
  if (quitting) return;
  event.preventDefault();
  if (window && window !== overlayWindow) window.hide();
}

function resizeOverlay() {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.setBounds(safeOverlayBounds(screen.getPrimaryDisplay()));
  }
  clampAndStoreControlsBounds();
  raiseOverlay();
}

function uiStatePath() {
  return path.join(app.getPath('userData'), 'playground', 'ui-state.json');
}

async function loadUiState() {
  try {
    const saved = JSON.parse(await fs.readFile(uiStatePath(), 'utf8'));
    const controls = saved && typeof saved === 'object' ? saved.controls : null;
    if (!controls || typeof controls !== 'object') return;
    if (Number.isFinite(controls.x) && Math.abs(controls.x) < 100000) controlsUiState.x = Math.round(controls.x);
    if (Number.isFinite(controls.y) && Math.abs(controls.y) < 100000) controlsUiState.y = Math.round(controls.y);
    if (typeof controls.collapsed === 'boolean') controlsUiState.collapsed = controls.collapsed;
  } catch (error) {
    if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) console.warn('Could not read controls UI state:', error);
  }
}

function petSettingsPath() {
  return path.join(app.getPath('userData'), 'playground', 'settings.json');
}

function petAssetsPath() {
  return path.join(app.getPath('userData'), 'playground', 'assets');
}

function publicPetDefinitions() {
  return {
    defaultPets: Object.fromEntries(DEFAULT_PET_IDS.map(id => [id, true])),
    localPets: localPets.map(pet => ({ ...pet })),
    customPets: petSettings.customPets.map(({ id, name, enabled, width, height }) => ({
      id, name, enabled, width, height, assetUrl: `pet-asset://local/${id}`
    }))
  };
}

function publishPetDefinitions() {
  const definitions = publicPetDefinitions();
  for (const window of [overlayWindow, controlsWindow]) {
    if (window && !window.isDestroyed() && !window.webContents.isLoading()) {
      window.webContents.send('app:pet-definitions', definitions);
    }
  }
}

async function loadPetSettings() {
  const file = petSettingsPath();
  try {
    const parsed = JSON.parse(await fs.readFile(file, 'utf8'));
    if (!parsed || parsed.schemaVersion !== 1 || typeof parsed.defaultPets !== 'object' || !Array.isArray(parsed.customPets)) {
      throw new Error('Invalid Pet settings schema');
    }
    const defaults = Object.fromEntries(DEFAULT_PET_IDS.map(id => [id, parsed.defaultPets[id] !== false]));
    const customPets = [];
    const seen = new Set();
    for (const pet of parsed.customPets) {
      if (!pet || !PET_ID_PATTERN.test(pet.id) || seen.has(pet.id) || !IMAGE_EXTENSIONS.has(pet.extension)
        || typeof pet.name !== 'string' || !pet.name.trim() || pet.name.length > 32
        || !Number.isInteger(pet.width) || !Number.isInteger(pet.height)
        || pet.width < 1 || pet.height < 1 || pet.width * pet.height > MAX_IMAGE_PIXELS) continue;
      try {
        const stat = await fs.stat(path.join(petAssetsPath(), `${pet.id}${pet.extension}`));
        if (!stat.isFile() || stat.size < 1 || stat.size > MAX_IMAGE_BYTES) continue;
      } catch { continue; }
      seen.add(pet.id);
      customPets.push({
        id: pet.id, name: pet.name.trim(), extension: pet.extension,
        width: pet.width, height: pet.height, enabled: pet.enabled !== false
      });
    }
    petSettings = { schemaVersion: 1, auxiliaryEffectsEnabled: parsed.auxiliaryEffectsEnabled !== false,
      defaultPets: defaults, customPets };
  } catch (error) {
    if (error.code !== 'ENOENT') {
      const backup = `${file}.corrupt-${Date.now()}`;
      try { await fs.rename(file, backup); } catch (backupError) { console.warn('Could not back up invalid Pet settings:', backupError); }
      console.warn('Invalid Pet settings; restoring defaults:', error);
    }
    petSettings = defaultPetSettings();
    await writePetSettings(petSettings);
  }
}

async function writePetSettings(snapshot) {
  const file = petSettingsPath();
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tempFile = `${file}.${process.pid}.tmp`;
  try {
    await fs.writeFile(tempFile, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
    await fs.rename(tempFile, file);
  } catch (error) {
    await fs.unlink(tempFile).catch(() => {});
    throw error;
  }
}

function registerPetAssetProtocol() {
  protocol.registerFileProtocol('pet-asset', (request, callback) => {
    try {
      const url = new URL(request.url);
      const id = url.hostname === 'local' && /^\/[0-9a-f-]{36}$/i.test(url.pathname) ? url.pathname.slice(1) : '';
      const pet = petSettings.customPets.find(item => item.id === id);
      if (!pet) return callback({ error: -6 });
      callback({ path: path.join(petAssetsPath(), `${pet.id}${pet.extension}`) });
    } catch {
      callback({ error: -6 });
    }
  });
}

function queuePetChange(action) {
  const result = petWriteChain.catch(() => {}).then(action);
  petWriteChain = result.catch(() => {});
  return result;
}

function setAuxiliaryEffectsEnabled(enabled) {
  return queuePetChange(async () => {
    const next = { ...petSettings, auxiliaryEffectsEnabled: enabled };
    await writePetSettings(next);
    petSettings = next;
    setState({ auxiliaryEffectsEnabled: enabled });
  }).catch(error => {
    console.warn('Could not save auxiliary effects setting:', error);
    updateTrayMenu();
  });
}

function applyPetSettings(next) {
  petSettings = next;
  publishPetDefinitions();
}

async function setPetEnabled(event, id, enabled) {
  if (!isTrustedSender(event, controlsWindow) || typeof id !== 'string' || typeof enabled !== 'boolean') return null;
  return queuePetChange(async () => {
    let next;
    if (DEFAULT_PET_IDS.includes(id)) {
      next = { ...petSettings, defaultPets: { ...petSettings.defaultPets, [id]: enabled } };
    } else if (petSettings.customPets.some(pet => pet.id === id)) {
      next = { ...petSettings, customPets: petSettings.customPets.map(pet => pet.id === id ? { ...pet, enabled } : pet) };
    } else throw new Error('Pet을 찾을 수 없습니다.');
    await writePetSettings(next);
    applyPetSettings(next);
    return { ok: true };
  });
}

async function removeCustomPet(event, id) {
  if (!isTrustedSender(event, controlsWindow) || typeof id !== 'string') return null;
  return queuePetChange(async () => {
    const pet = petSettings.customPets.find(item => item.id === id);
    if (!pet) throw new Error('Custom Pet을 찾을 수 없습니다.');
    const next = { ...petSettings, customPets: petSettings.customPets.filter(item => item.id !== id) };
    await writePetSettings(next);
    applyPetSettings(next);
    await fs.unlink(path.join(petAssetsPath(), `${pet.id}${pet.extension}`)).catch(error => {
      if (error.code !== 'ENOENT') console.warn('Could not remove copied Pet asset:', error);
    });
    return { ok: true };
  });
}

function clampControlsBounds(bounds, display = screen.getPrimaryDisplay()) {
  const area = display.workArea;
  const guardX = Math.min(CONTROLS_EDGE_GUARD, Math.max(0, Math.floor((area.width - 1) / 2)));
  const guardY = Math.min(CONTROLS_EDGE_GUARD, Math.max(0, Math.floor((area.height - 1) / 2)));
  const size = bounds ? { width: bounds.width, height: bounds.height } : CONTROLS_EXPANDED;
  const width = Math.max(1, Math.min(size.width, area.width - guardX * 2));
  const height = Math.max(1, Math.min(size.height, area.height - guardY * 2));
  const fallbackX = Math.round(area.x + (area.width - width) / 2);
  const fallbackY = Math.round(area.y + area.height - height - 16);
  const x = Number.isFinite(bounds?.x) ? bounds.x : fallbackX;
  const y = Number.isFinite(bounds?.y) ? bounds.y : fallbackY;
  return {
    x: Math.max(area.x + guardX, Math.min(x, area.x + area.width - guardX - width)),
    y: Math.max(area.y + guardY, Math.min(y, area.y + area.height - guardY - height)),
    width,
    height
  };
}

function clampAndStoreControlsBounds() {
  if (!controlsWindow || controlsWindow.isDestroyed()) return;
  const current = controlsWindow.getBounds();
  const display = screen.getDisplayMatching(current);
  const safe = clampControlsBounds(current, display);
  if (safe.x !== current.x || safe.y !== current.y || safe.width !== current.width || safe.height !== current.height) {
    controlsWindow.setBounds(safe);
  }
  controlsUiState.x = safe.x;
  controlsUiState.y = safe.y;
  scheduleUiStateSave();
}

function scheduleUiStateSave() {
  if (!controlsWindow || controlsWindow.isDestroyed()) return;
  const { x, y } = controlsWindow.getBounds();
  controlsUiState.x = x;
  controlsUiState.y = y;
  clearTimeout(uiSaveTimer);
  uiSaveTimer = setTimeout(() => {
    uiSaveTimer = null;
    writeUiState().catch(error => console.warn('Could not save controls UI state:', error));
  }, 250);
}

function writeUiState() {
  const file = uiStatePath();
  const snapshot = { controls: { ...controlsUiState } };
  uiWriteChain = uiWriteChain.catch(() => {}).then(async () => {
    await fs.mkdir(path.dirname(file), { recursive: true });
    const tempFile = `${file}.${process.pid}.tmp`;
    await fs.writeFile(tempFile, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
    await fs.rename(tempFile, file);
  });
  return uiWriteChain;
}

async function flushUiState() {
  clearTimeout(uiSaveTimer);
  uiSaveTimer = null;
  if (controlsWindow && !controlsWindow.isDestroyed()) {
    const { x, y } = controlsWindow.getBounds();
    controlsUiState.x = x;
    controlsUiState.y = y;
  }
  await writeUiState();
}

function setControlsCollapsed(event, collapsed) {
  if (!isTrustedSender(event, controlsWindow) || typeof collapsed !== 'boolean') return;
  if (collapsed && state.mode !== 'pc') setState({ mode: 'pc' });
  if (controlsUiState.collapsed === collapsed) return;
  if (controlsPanelOpen) resizeControlsPanel(false);
  controlsUiState.collapsed = collapsed;
  if (controlsWindow && !controlsWindow.isDestroyed()) {
    const current = controlsWindow.getBounds();
    const size = collapsed ? CONTROLS_COLLAPSED : CONTROLS_EXPANDED;
    controlsWindow.setBounds(clampControlsBounds({ ...current, ...size }, screen.getDisplayMatching(current)));
  }
  scheduleUiStateSave();
}

function resizeControlsPanel(open) {
  if (!controlsWindow || controlsWindow.isDestroyed() || controlsPanelOpen === open) return;
  const current = controlsWindow.getBounds();
  const delta = CONTROLS_PANEL.height - CONTROLS_EXPANDED.height;
  const target = open
    ? { ...current, y: current.y - delta, ...CONTROLS_PANEL }
    : { ...current, y: current.y + delta, ...CONTROLS_EXPANDED };
  controlsPanelOpen = open;
  controlsWindow.setBounds(clampControlsBounds(target, screen.getDisplayMatching(current)));
  scheduleUiStateSave();
}

function isTrustedSender(event, expectedWindow) {
  if (!expectedWindow || expectedWindow.isDestroyed()) return false;
  if (event.sender !== expectedWindow.webContents) return false;
  const frame = event.senderFrame;
  return Boolean(frame && frame === event.sender.mainFrame && frame.url === pathToFileUrl(expectedWindow === overlayWindow ? 'index.html' : 'controls.html'));
}

function publishState() {
  for (const window of [overlayWindow, controlsWindow]) {
    if (window && !window.isDestroyed() && !window.webContents.isLoading()) {
      window.webContents.send('app:state', { ...state });
    }
  }
  updateTrayMenu();
}

function setState(changes) {
  const next = { ...state, ...changes };
  state = next;

  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.setIgnoreMouseEvents(!state.enabled || state.mode === 'pc');
    if (state.enabled) {
      if (!overlayWindow.isVisible()) overlayWindow.showInactive();
    } else if (overlayWindow.isVisible()) {
      overlayWindow.hide();
    }
  }
  raiseOverlay();
  publishState();
}

function showControls() {
  if (!controlsWindow || controlsWindow.isDestroyed()) return;
  controlsWindow.show();
  controlsWindow.focus();
  raiseOverlay();
}

function setMode(event, mode) {
  if (!isTrustedSender(event, controlsWindow)
    && !(mode === 'pc' && isTrustedSender(event, overlayWindow))) return;
  if (!MODES.has(mode) || mode === 'spawn') return;
  setState({ mode });
}

function setEnabled(event, enabled) {
  if (!isTrustedSender(event, controlsWindow) || typeof enabled !== 'boolean') return;
  if (!enabled && overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.setIgnoreMouseEvents(true);
  setState({ enabled });
}

function setStructuresEnabled(event, enabled) {
  if (!isTrustedSender(event, controlsWindow) || typeof enabled !== 'boolean') return;
  setState({ structuresEnabled: enabled });
}

function selectPet(event, id) {
  if (!isTrustedSender(event, controlsWindow) || !isAllowedPet(id)) return;
  setState({ mode: 'spawn', petId: id });
}

function setBrush(event, changes) {
  if (!isTrustedSender(event, controlsWindow) || !changes || typeof changes !== 'object') return;
  const next = {};
  if (BRUSH_COLORS.has(changes.drawColor)) next.drawColor = changes.drawColor;
  if (Number.isInteger(changes.drawSize) && changes.drawSize >= 1 && changes.drawSize <= 30) next.drawSize = changes.drawSize;
  if (DRAW_SHAPES.has(changes.drawShape)) next.drawShape = changes.drawShape;
  if (typeof changes.eraser === 'boolean') next.eraser = changes.eraser;
  if (Object.keys(next).length) setState(next);
}

function requestAppQuit() {
  if (quitPromise) return quitPromise;
  quitting = true;
  quitPromise = (async () => {
    const results = await Promise.allSettled([flushUiState(), petWriteChain]);
    for (const result of results) {
      if (result.status === 'rejected') console.warn('Could not finish state save before exit:', result.reason);
    }
    globalShortcut.unregisterAll();
    if (tray && !tray.isDestroyed()) tray.destroy();
    tray = null;
    for (const window of [controlsWindow, overlayWindow]) {
      if (window && !window.isDestroyed()) window.close();
    }
  })().catch(error => {
    console.error('Exit cleanup failed:', error);
  }).finally(() => {
    quitReady = true;
    app.quit();
  });
  return quitPromise;
}

function installIpcHandlers() {
  ipcMain.handle('app:get-state', event => {
    if (!isTrustedSender(event, overlayWindow) && !isTrustedSender(event, controlsWindow)) return null;
    return { ...state };
  });
  ipcMain.handle('app:get-controls-ui-state', event => {
    if (!isTrustedSender(event, controlsWindow)) return null;
    return { collapsed: controlsUiState.collapsed };
  });
  ipcMain.handle('app:get-pet-definitions', event => {
    if (!isTrustedSender(event, overlayWindow) && !isTrustedSender(event, controlsWindow)) return null;
    return publicPetDefinitions();
  });
  ipcMain.handle('app:set-pet-enabled', setPetEnabled);
  ipcMain.handle('app:remove-custom-pet', removeCustomPet);
  ipcMain.on('app:set-mode', setMode);
  ipcMain.on('app:set-enabled', setEnabled);
  ipcMain.on('app:set-structures-enabled', setStructuresEnabled);
  ipcMain.on('app:select-pet', selectPet);
  ipcMain.on('app:set-brush', setBrush);
  ipcMain.on('app:hide-controls', event => {
    if (isTrustedSender(event, controlsWindow)) controlsWindow.hide();
  });
  ipcMain.on('app:set-controls-collapsed', setControlsCollapsed);
  ipcMain.on('app:set-controls-panel-open', (event, open) => {
    if (isTrustedSender(event, controlsWindow) && typeof open === 'boolean' && !controlsUiState.collapsed) {
      resizeControlsPanel(open);
    }
  });
  ipcMain.on('app:clear', (event, kind) => {
      if (isTrustedSender(event, controlsWindow) && ['effects', 'drawing', 'structures', 'pets', 'all'].includes(kind)
      && overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.webContents.send('playground:clear', kind);
    }
  });
  ipcMain.on('app:exit', event => {
    if (isTrustedSender(event, controlsWindow)) requestAppQuit();
  });
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(name, data) {
  const type = Buffer.from(name, 'ascii');
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  type.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([type, data])), 8 + data.length);
  return chunk;
}

function makeTrayIcon() {
  return nativeImage
    .createFromPath(path.join(__dirname, 'assets', 'icon.png'))
    .resize({ width: 32, height: 32 });
}

function createTray() {
  const icon = makeTrayIcon();
  if (icon.isEmpty()) throw new Error('Could not create the built-in Tray icon');
  tray = new Tray(icon);
  tray.setToolTip('DesktopPlayground');
  updateTrayMenu();
  tray.on('click', showControls);
}

function updateTrayMenu() {
  if (!tray || tray.isDestroyed()) return;
  const clear = kind => {
    if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.webContents.send('playground:clear', kind);
  };
  const menu = Menu.buildFromTemplate([
    { label: 'PC 모드', click: () => setState({ mode: 'pc' }) },
    { label: state.enabled ? 'Playground 숨기기' : 'Playground 보이기', click: () => setState({ enabled: !state.enabled }) },
    { label: '조작창 보이기', click: showControls },
    { id: 'auxiliary-effects', label: '보조 효과 표시', type: 'checkbox',
      checked: state.auxiliaryEffectsEnabled,
      click: item => setAuxiliaryEffectsEnabled(item.checked) },
    { label: '정리', submenu: [
      { label: '효과 지우기', click: () => clear('effects') },
      { label: '그림 지우기', click: () => clear('drawing') },
      { label: '구조물 지우기', click: () => clear('structures') },
      { label: '펫 지우기', click: () => clear('pets') },
      { label: '전체 초기화', click: () => clear('all') }
    ] },
    { type: 'separator' },
    { label: '종료', click: requestAppQuit }
  ]);
  tray.setContextMenu(menu);
}

installIpcHandlers();
