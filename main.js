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
const { spawn } = require('node:child_process');
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
const LIFECYCLE_LOG = path.join(USER_DATA_PATH, 'lifecycle.log');
function logLifecycle(event, detail = '') {
  try {
    if (fsSync.existsSync(LIFECYCLE_LOG) && fsSync.statSync(LIFECYCLE_LOG).size > 128 * 1024)
      fsSync.truncateSync(LIFECYCLE_LOG, 0);
    fsSync.appendFileSync(LIFECYCLE_LOG,
      `${new Date().toISOString()} pid=${process.pid} ${event}${detail ? ` ${detail}` : ''}\n`);
  } catch (error) {
    console.warn('Could not write lifecycle log:', error);
  }
}
logLifecycle('main-start');
process.on('uncaughtExceptionMonitor', error => logLifecycle('uncaught-exception', error.stack || String(error)));
process.on('exit', code => logLifecycle('process-exit', `code=${code}`));
const DEFAULT_PET_IDS = ['basic', 'blob', 'robot', 'bug', 'ghost', 'star', 'cloud', 'cat', 'magpie', ...LOCAL_PET_IDS];
const localPets = loadLocalPets(path.join(__dirname, 'assets', 'pets'));
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_IMAGE_PIXELS = 16 * 1024 * 1024;
const PET_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MODES = new Set(['pc', 'touch', 'draw', 'bomb', 'hammer', 'gun', 'blackhole', 'spawn']);
const BRUSH_COLORS = new Set(['#e85b6b', '#4a90e2', '#f2c94c', '#55b88a', '#30384c', '#ffffff']);
const DRAW_SHAPES = new Set(['freehand', 'line', 'rect', 'ellipse']);
const EMERGENCY_SHORTCUT = 'Control+Alt+Shift+P';
// On this Electron/Windows version lower levels can drop behind normal windows.
// Keep the stable topmost band. PC mode reserves the shell work area;
// tool modes use the full display so their input reaches the bottom edge.
const OVERLAY_TOPMOST_LEVEL = 'pop-up-menu';

const hasSingleInstance = app.requestSingleInstanceLock();
let overlayWindow = null;
let controlsWindow = null;
let tray = null;
let taskbarOrderWatcher = null;
let taskbarOrderWatcherReady = false;
let quitting = false;
let quitReady = false;
let quitPromise = null;
let state = {
  enabled: true,
  structuresEnabled: false,
  auxiliaryEffectsEnabled: true,
  crackMode: 'auto',
  mode: 'pc',
  gunWeapon: 'ak47',
  petId: null,
  drawColor: '#30384c',
  drawSize: 7,
  drawShape: 'freehand',
  eraser: false
};
const controlsUiState = { x: null, y: null, collapsed: false };
const CONTROLS_EXPANDED = { width: 440, height: 56 };
const CONTROLS_COLLAPSED = { width: 152, height: 52 };
const CONTROLS_PANEL_HEIGHT = 340;
const CONTROLS_EDGE_GUARD = 8;
let controlsPanelOpen = false;
let controlsPanelKind = null;
let currentPetInstances = [];
let currentPetRevision = 0;
let controlsPanelBaseBounds = null;
let overlayShapeKey = null;
let taskbarPetRegions = [];
let uiSaveTimer = null;
let uiWriteChain = Promise.resolve();
let petWriteChain = Promise.resolve();
let petSettings = defaultPetSettings();

function defaultPetSettings() {
  return { schemaVersion: 1, auxiliaryEffectsEnabled: true, crackMode: 'auto',
    defaultPets: Object.fromEntries(DEFAULT_PET_IDS.map(id => [id, true])), customPets: [] };
}

function isAllowedPet(id) {
  if (typeof id !== 'string') return false;
  return DEFAULT_PET_IDS.includes(id)
    ? (['basic', 'blob', 'robot', 'bug', 'ghost', 'star', 'cloud', 'cat', 'magpie'].includes(id) || localPets.some(pet => pet.id === id))
    : petSettings.customPets.some(pet => pet.id === id && pet.enabled);
}

if (!hasSingleInstance) {
  logLifecycle('second-instance-exit');
  app.quit();
} else {
  app.setAppUserModelId(APP_ID);

  app.on('second-instance', () => showControls());
  app.on('before-quit', event => {
    logLifecycle('before-quit', `quitting=${quitting} ready=${quitReady}`);
    if (!quitting) {
      event.preventDefault();
      logLifecycle('unrequested-quit-blocked');
      return;
    }
    if (!quitReady) {
      event.preventDefault();
    }
  });
  app.on('will-quit', () => logLifecycle('will-quit'));
  // Keep the Tray alive if an Electron window unexpectedly disappears.
  app.on('window-all-closed', () => logLifecycle('window-all-closed'));

  app.whenReady().then(async () => {
    await loadUiState();
    await loadPetSettings();
    state.auxiliaryEffectsEnabled = petSettings.auxiliaryEffectsEnabled;
    state.crackMode = petSettings.crackMode;
    registerPetAssetProtocol();
    createWindows();
    startTaskbarOrderWatcher();
    createTray();
    if (!globalShortcut.register(EMERGENCY_SHORTCUT, () => setState({ mode: 'pc' }))) {
      console.warn('Could not register PC Mode shortcut:', EMERGENCY_SHORTCUT);
    }
    screen.on('display-metrics-changed', resizeOverlay);
    screen.on('display-added', resizeOverlay);
    screen.on('display-removed', resizeOverlay);
  }).catch(error => {
    logLifecycle('startup-failed', error.stack || String(error));
    console.error('DesktopPlayground could not start:', error);
    quitting = true;
    quitReady = true;
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
    hasShadow: false,
    resizable: false,
    alwaysOnTop: true,
    focusable: false,
    skipTaskbar: true,
    show: false,
    webPreferences: secureWebPreferences('preload.js')
  });
  overlayWindow.setAlwaysOnTop(true, OVERLAY_TOPMOST_LEVEL);
  fitOverlayToDisplay(primary);
  overlayWindow.setIgnoreMouseEvents(true);
  overlayWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  overlayWindow.webContents.on('will-navigate', (event, url) => {
    if (url !== pathToFileUrl('index.html')) event.preventDefault();
  });
  overlayWindow.on('close', event => preventWindowClose(event, overlayWindow));
  monitorWindow(overlayWindow, 'overlay');
  overlayWindow.on('show', () => {
    overlayShapeKey = null;
    applyOverlayShape();
    raiseOverlay();
  });
  overlayWindow.on('restore', () => {
    overlayShapeKey = null;
    applyOverlayShape();
    raiseOverlay();
  });
  let overlayRevealed = false;
  const revealOverlay = () => {
    if (overlayRevealed) return;
    overlayRevealed = true;
    fitOverlayToDisplay(screen.getPrimaryDisplay());
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
    hasShadow: false,
    resizable: false,
    alwaysOnTop: true,
    focusable: false,
    skipTaskbar: true,
    show: false,
    webPreferences: secureWebPreferences('preload.js')
  });
  controlsWindow.setAlwaysOnTop(true, OVERLAY_TOPMOST_LEVEL);
  controlsWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  controlsWindow.webContents.on('will-navigate', (event, url) => {
    if (url !== pathToFileUrl('controls.html')) event.preventDefault();
  });
  controlsWindow.on('close', event => preventWindowClose(event, controlsWindow));
  monitorWindow(controlsWindow, 'controls');
  controlsWindow.on('show', raiseOverlay);
  controlsWindow.on('restore', raiseOverlay);
  controlsWindow.on('focus', raiseOverlay);
  controlsWindow.on('blur', raiseOverlay);
  controlsWindow.on('hide', raiseOverlay);
  controlsWindow.on('closed', () => {
    controlsWindow = null;
  });
  controlsWindow.on('move', clampAndStoreControlsBounds);
  let controlsRevealed = false;
  const revealControls = () => {
    if (controlsRevealed) return;
    controlsRevealed = true;
    controlsWindow.showInactive();
    publishState();
  };
  controlsWindow.once('ready-to-show', revealControls);
  controlsWindow.webContents.once('did-finish-load', revealControls);
  controlsWindow.loadFile(path.join(__dirname, 'controls.html'));
}

function safeOverlayBounds(display) {
  // Retain full-display coordinates for Pet physics and existing DPI behavior.
  return { ...display.bounds };
}

function fitOverlayToDisplay(display) {
  if (!overlayWindow || overlayWindow.isDestroyed()) return;
  const bounds = safeOverlayBounds(display);
  const current = overlayWindow.getBounds();
  if (Object.keys(bounds).some(key => bounds[key] !== current[key])) overlayWindow.setBounds(bounds);
  applyOverlayShape(display);
}

function applyOverlayShape(display = screen.getPrimaryDisplay()) {
  if (!overlayWindow || overlayWindow.isDestroyed()) return;
  const bounds = safeOverlayBounds(display);
  const full = { x: 0, y: 0, width: bounds.width, height: bounds.height };
  let shape = [full];
  if (state.mode === 'pc') {
    // A full-screen pop-up-menu window sits above Explorer's taskbar even when
    // its Canvas is transparent. Leave only the Pet-covered taskbar spans in
    // our native shape; the rest belongs directly to the Windows shell.
    const work = display.workArea;
    const wx = Math.max(0, Math.min(full.width, work.x - bounds.x));
    const wy = Math.max(0, Math.min(full.height, work.y - bounds.y));
    const right = Math.max(wx, Math.min(full.width, work.x - bounds.x + work.width));
    const bottom = Math.max(wy, Math.min(full.height, work.y - bounds.y + work.height));
    const workRect = { x: wx, y: wy, width: right - wx, height: bottom - wy };
    const strips = [
      { x: 0, y: 0, width: full.width, height: wy },
      { x: 0, y: bottom, width: full.width, height: full.height - bottom },
      { x: 0, y: wy, width: wx, height: bottom - wy },
      { x: right, y: wy, width: full.width - right, height: bottom - wy }
    ].filter(rect => rect.width > 0 && rect.height > 0);
    shape = [workRect];
    for (const strip of strips) {
      const spans = [];
      const horizontal = strip.width >= strip.height;
      for (const pet of taskbarPetRegions) {
        const x = Math.max(strip.x, pet.x), y = Math.max(strip.y, pet.y);
        const r = Math.min(strip.x + strip.width, pet.x + pet.width);
        const b = Math.min(strip.y + strip.height, pet.y + pet.height);
        if (r > x && b > y) spans.push(horizontal ? [x, r] : [y, b]);
      }
      spans.sort((a, b) => a[0] - b[0]);
      for (const [start, end] of spans) {
        const last = shape.at(-1);
        if (last && last._strip === strip && start <= last._end) {
          last._end = Math.max(last._end, end);
          if (horizontal) last.width = last._end - last.x;
          else last.height = last._end - last.y;
        } else shape.push(horizontal
          ? { x: start, y: strip.y, width: end - start, height: strip.height, _strip: strip, _end: end }
          : { x: strip.x, y: start, width: strip.width, height: end - start, _strip: strip, _end: end });
      }
    }
    shape = shape.map(({ x, y, width, height }) => ({ x, y, width, height }));
  }
  const shapeKey = JSON.stringify(shape);
  if (overlayShapeKey === shapeKey) return;
  overlayWindow.setShape(shape);
  overlayShapeKey = shapeKey;
}

function raiseControls() {
  if (!controlsWindow || controlsWindow.isDestroyed() || !controlsWindow.isVisible()) return;
  controlsWindow.setAlwaysOnTop(true, OVERLAY_TOPMOST_LEVEL);
  controlsWindow.moveTop();
}

function raiseOverlay() {
  if (overlayWindow && !overlayWindow.isDestroyed() && overlayWindow.isVisible()) {
    // Reasserting an existing topmost level does not reorder peers in that band.
    // moveTop uses SWP_NOACTIVATE on Windows, so it restores the Pet layer
    // without taking keyboard focus from the foreground application.
    overlayWindow.setAlwaysOnTop(true, OVERLAY_TOPMOST_LEVEL);
    overlayWindow.moveTop();
  }
  raiseControls();
}

function startTaskbarOrderWatcher() {
  if (process.platform !== 'win32' || !overlayWindow || overlayWindow.isDestroyed()) return;
  try {
    const handle = overlayWindow.getNativeWindowHandle().readBigUInt64LE().toString();
    const script = fsSync.readFileSync(path.join(__dirname, 'taskbar-zorder.ps1'), 'utf8');
    const command = `$OverlayHandle = [long]${handle}\n${script}`;
    const watcher = spawn('powershell.exe', [
      '-NoProfile', '-NonInteractive', '-EncodedCommand',
      Buffer.from(command, 'utf16le').toString('base64')
    ], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    taskbarOrderWatcher = watcher;
    let output = '';
    watcher.stdout.on('data', chunk => {
      output += chunk.toString();
      const lines = output.split(/\r?\n/);
      output = lines.pop();
      for (const line of lines) {
        if (line.trim() === 'ready') taskbarOrderWatcherReady = true;
        if (line.trim() === 'restore' && !quitting) raiseOverlay();
      }
    });
    watcher.stderr.on('data', chunk =>
      logLifecycle('taskbar-order-watch-error', chunk.toString().trim().slice(0, 500)));
    watcher.on('error', error => logLifecycle('taskbar-order-watch-error', String(error)));
    watcher.on('exit', code => {
      if (taskbarOrderWatcher === watcher) taskbarOrderWatcher = null;
      taskbarOrderWatcherReady = false;
      if (!quitting) logLifecycle('taskbar-order-watch-exit', `code=${code}`);
    });
  } catch (error) {
    logLifecycle('taskbar-order-watch-error', String(error));
  }
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
  logLifecycle('window-close-blocked', window === controlsWindow ? 'controls' : 'overlay');
  event.preventDefault();
  if (window === controlsWindow) hideControls();
}

function monitorWindow(window, name) {
  window.on('closed', () => logLifecycle('window-closed', name));
  window.webContents.on('render-process-gone', (_event, details) =>
    logLifecycle('render-process-gone', `${name} reason=${details.reason} exitCode=${details.exitCode}`));
  window.webContents.on('unresponsive', () => logLifecycle('window-unresponsive', name));
  window.webContents.on('did-fail-load', (_event, code, description) =>
    logLifecycle('window-load-failed', `${name} code=${code} ${description}`));
}

function resizeOverlay() {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    fitOverlayToDisplay(screen.getPrimaryDisplay());
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
      crackMode: parsed.crackMode === 'accumulate' ? 'accumulate' : 'auto',
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

function setCrackMode(mode) {
  if (!['auto', 'accumulate'].includes(mode)) return Promise.resolve();
  return queuePetChange(async () => {
    const next = { ...petSettings, crackMode: mode };
    await writePetSettings(next);
    petSettings = next;
    setState({ crackMode: mode });
  }).catch(error => {
    console.warn('Could not save crack mode:', error);
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
  if (controlsPanelOpen && controlsPanelBaseBounds) {
    controlsPanelBaseBounds.x = safe.x;
    controlsPanelBaseBounds.y = safe.y + safe.height - CONTROLS_EXPANDED.height;
  }
  controlsUiState.x = safe.x;
  controlsUiState.y = controlsPanelOpen ? safe.y + safe.height - CONTROLS_EXPANDED.height : safe.y;
  scheduleUiStateSave();
}

function scheduleUiStateSave() {
  if (!controlsWindow || controlsWindow.isDestroyed()) return;
  const { x, y, height } = controlsWindow.getBounds();
  controlsUiState.x = x;
  controlsUiState.y = controlsPanelOpen ? y + height - CONTROLS_EXPANDED.height : y;
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
    const { x, y, height } = controlsWindow.getBounds();
    controlsUiState.x = x;
    controlsUiState.y = controlsPanelOpen ? y + height - CONTROLS_EXPANDED.height : y;
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
  raiseOverlay();
}

function resizeControlsPanel(open, kind = null) {
  if (!controlsWindow || controlsWindow.isDestroyed()) return;
  if (!open && !controlsPanelOpen) return;
  const current = controlsWindow.getBounds();
  if (open && !controlsPanelOpen) controlsPanelBaseBounds = { ...current };
  const base = controlsPanelBaseBounds || { ...current, y: current.y + current.height - CONTROLS_EXPANDED.height };
  const height = open ? CONTROLS_PANEL_HEIGHT : CONTROLS_EXPANDED.height;
  const target = open
    ? { ...base, y: base.y + base.height - height, height }
    : { ...base, ...CONTROLS_EXPANDED };
  controlsPanelOpen = open;
  controlsPanelKind = open ? kind : null;
  controlsWindow.setBounds(clampControlsBounds(target, screen.getDisplayMatching(current)));
  applyOverlayShape();
  if (overlayWindow && !overlayWindow.isDestroyed())
    overlayWindow.setIgnoreMouseEvents(!state.enabled || (state.mode === 'pc' && !controlsPanelOpen));
  if (!open) {
    controlsPanelBaseBounds = null;
    scheduleUiStateSave();
  }
  raiseOverlay();
  publishState();
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
      window.webContents.send('app:state', { ...state, controlsPanelOpen, controlsPanelKind });
    }
  }
  updateTrayMenu();
}

function setState(changes) {
  const previous = state;
  const next = { ...state, ...changes };
  const visibilityChanged = next.enabled !== state.enabled;
  state = next;

  if (overlayWindow && !overlayWindow.isDestroyed()) {
    if (next.mode !== previous.mode || visibilityChanged) applyOverlayShape();
    overlayWindow.setIgnoreMouseEvents(!state.enabled || (state.mode === 'pc' && !controlsPanelOpen));
    if (state.enabled) {
      if (!overlayWindow.isVisible()) {
        overlayWindow.showInactive();
        overlayShapeKey = null;
        applyOverlayShape();
      }
    } else if (overlayWindow.isVisible()) {
      overlayWindow.hide();
    }
  }
  // show emits its own z-order repair; hiding only needs the toolbar raised.
  if (visibilityChanged && !state.enabled) raiseControls();
  publishState();
}

function showControls() {
  if (!state.enabled) setState({ enabled: true, mode: 'pc' });
  if (!controlsWindow || controlsWindow.isDestroyed()) return;
  clampAndStoreControlsBounds();
  if (controlsWindow.isVisible()) raiseOverlay();
  else controlsWindow.showInactive();
}

function setPlaygroundVisible(enabled) {
  if (!enabled && controlsPanelOpen) resizeControlsPanel(false);
  setState({ enabled, mode: enabled ? state.mode : 'pc' });
  if (enabled) showControls();
  else if (controlsWindow && !controlsWindow.isDestroyed()) controlsWindow.hide();
}

function hideControls() {
  if (!controlsWindow || controlsWindow.isDestroyed()) return;
  if (state.mode !== 'pc') setState({ mode: 'pc' });
  if (controlsPanelOpen) resizeControlsPanel(false);
  controlsWindow.hide();
}

function setMode(event, mode) {
  if (!state.enabled) return;
  if (!isTrustedSender(event, controlsWindow)
    && !(mode === 'pc' && isTrustedSender(event, overlayWindow))) return;
  if (!MODES.has(mode) || mode === 'spawn') return;
  if (mode === 'pc' && isTrustedSender(event, overlayWindow) && controlsPanelOpen)
    resizeControlsPanel(false);
  setState({ mode });
}

function setGunWeapon(event, weapon) {
  if (!state.enabled) return;
  if (!isTrustedSender(event, controlsWindow)) return;
  if (!['awm', 'ak47', 'uzi', 'double_barrel'].includes(weapon)) return;
  setState({ gunWeapon: weapon, mode: 'gun' });
}

function setEnabled(event, enabled) {
  if (!isTrustedSender(event, controlsWindow) || typeof enabled !== 'boolean') return;
  if (!enabled && overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.setIgnoreMouseEvents(true);
  setPlaygroundVisible(enabled);
}

function setStructuresEnabled(event, enabled) {
  if (!isTrustedSender(event, controlsWindow) || typeof enabled !== 'boolean') return;
  setState({ structuresEnabled: enabled });
}

function selectPet(event, id) {
  if (!state.enabled) return;
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
  logLifecycle('requested-quit');
  quitting = true;
  quitPromise = (async () => {
    const results = await Promise.allSettled([flushUiState(), petWriteChain]);
    for (const result of results) {
      if (result.status === 'rejected') console.warn('Could not finish state save before exit:', result.reason);
    }
    globalShortcut.unregisterAll();
    taskbarOrderWatcher?.stdin.end();
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
    return { ...state, controlsPanelOpen, controlsPanelKind };
  });
  ipcMain.handle('app:get-controls-ui-state', event => {
    if (!isTrustedSender(event, controlsWindow)) return null;
    return { collapsed: controlsUiState.collapsed };
  });
  ipcMain.handle('app:get-pet-definitions', event => {
    if (!isTrustedSender(event, overlayWindow) && !isTrustedSender(event, controlsWindow)) return null;
    return publicPetDefinitions();
  });
  ipcMain.handle('app:get-pet-instances', event =>
    isTrustedSender(event, controlsWindow)
      ? { revision: currentPetRevision, instances: currentPetInstances } : null);
  ipcMain.on('app:pet-instances-changed', (event, instances) => {
    if (!isTrustedSender(event, overlayWindow) || !Array.isArray(instances)) return;
    currentPetInstances = instances.filter(pet => Number.isSafeInteger(pet.instanceId)
      && pet.instanceId > 0 && typeof pet.definitionId === 'string')
      .map(({ instanceId, definitionId }) => ({ instanceId, definitionId }));
    currentPetRevision++;
    if (controlsWindow && !controlsWindow.isDestroyed() && !controlsWindow.webContents.isLoading())
      controlsWindow.webContents.send('app:pet-instances', {
        revision: currentPetRevision, instances: currentPetInstances
      });
  });
  ipcMain.on('app:taskbar-pet-regions', (event, regions) => {
    if (!isTrustedSender(event, overlayWindow) || !Array.isArray(regions)) return;
    taskbarPetRegions = regions.slice(0, 1024).filter(rect => rect &&
      [rect.x, rect.y, rect.width, rect.height].every(Number.isFinite) &&
      rect.width > 0 && rect.height > 0).map(rect => ({
      x: Math.round(rect.x), y: Math.round(rect.y),
      width: Math.round(rect.width), height: Math.round(rect.height)
    }));
    if (state.enabled && state.mode === 'pc') applyOverlayShape();
  });
  ipcMain.on('app:remove-pet-instance', (event, instanceId) => {
    if (!isTrustedSender(event, controlsWindow) || !Number.isSafeInteger(instanceId)
      || instanceId <= 0 || !overlayWindow || overlayWindow.isDestroyed()) return;
    overlayWindow.webContents.send('playground:remove-pet-instance', instanceId);
  });
  ipcMain.on('app:remove-pet-kind', (event, definitionId) => {
    if (!isTrustedSender(event, controlsWindow) || typeof definitionId !== 'string'
      || !currentPetInstances.some(pet => pet.definitionId === definitionId)
      || !overlayWindow || overlayWindow.isDestroyed()) return;
    overlayWindow.webContents.send('playground:remove-pet-kind', definitionId);
  });
  ipcMain.handle('app:set-pet-enabled', setPetEnabled);
  ipcMain.handle('app:remove-custom-pet', removeCustomPet);
  ipcMain.on('app:set-mode', setMode);
  ipcMain.on('app:set-gun-weapon', setGunWeapon);
  ipcMain.on('app:set-enabled', setEnabled);
  ipcMain.on('app:set-structures-enabled', setStructuresEnabled);
  ipcMain.on('app:select-pet', selectPet);
  ipcMain.on('app:set-brush', setBrush);
  ipcMain.on('app:hide-controls', event => {
    if (isTrustedSender(event, controlsWindow)) hideControls();
  });
  ipcMain.on('app:set-controls-collapsed', setControlsCollapsed);
  ipcMain.on('app:set-controls-panel-open', (event, open, kind) => {
    const fromControls = isTrustedSender(event, controlsWindow);
    const dismissDrawPanel = open === false && state.mode === 'draw' && controlsPanelKind === 'draw'
      && isTrustedSender(event, overlayWindow);
    if ((fromControls || dismissDrawPanel) && typeof open === 'boolean' && (!open || state.enabled)
      && (!open || (fromControls && ['pets', 'manage', 'draw', 'play'].includes(kind)))
      && !controlsUiState.collapsed) {
      resizeControlsPanel(open, kind);
    }
  });
  ipcMain.on('app:clear', (event, kind) => {
      if (isTrustedSender(event, controlsWindow) && ['crack', 'effects', 'drawing', 'structures', 'pets', 'all'].includes(kind)
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
    { label: state.enabled ? '전체 숨기기' : '전체 보이기', click: () => setPlaygroundVisible(!state.enabled) },
    { id: 'show-toolbar', label: '툴바 표시', click: showControls },
    { id: 'auxiliary-effects', label: '보조 효과 표시', type: 'checkbox',
      checked: state.auxiliaryEffectsEnabled,
      click: item => setAuxiliaryEffectsEnabled(item.checked) },
    { label: '균열 모드', submenu: [
      { id: 'crack-auto', label: '약 5초 뒤 복구', type: 'radio', checked: state.crackMode === 'auto',
        click: () => setCrackMode('auto') },
      { id: 'crack-accumulate', label: '누적 유지', type: 'radio', checked: state.crackMode === 'accumulate',
        click: () => setCrackMode('accumulate') }
    ] },
    { label: '정리', submenu: [
      { id: 'clear-crack', label: '균열만 지우기', click: () => clear('crack') },
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
  return menu;
}

installIpcHandlers();
