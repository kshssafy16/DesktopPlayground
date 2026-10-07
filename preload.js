const { contextBridge, ipcRenderer } = require('electron');

function subscribe(channel, callback) {
  if (typeof callback !== 'function') return () => {};
  const listener = (_event, value) => callback(value);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld('playground', Object.freeze({
  getState: () => ipcRenderer.invoke('app:get-state'),
  getControlsUiState: () => ipcRenderer.invoke('app:get-controls-ui-state'),
  getPetDefinitions: () => ipcRenderer.invoke('app:get-pet-definitions'),
  setPetEnabled: (id, enabled) => ipcRenderer.invoke('app:set-pet-enabled', id, enabled),
  removeCustomPet: id => ipcRenderer.invoke('app:remove-custom-pet', id),
  setMode: mode => {
    if (['pc', 'touch', 'draw', 'bomb', 'blackhole'].includes(mode)) ipcRenderer.send('app:set-mode', mode);
  },
  setEnabled: enabled => {
    if (typeof enabled === 'boolean') ipcRenderer.send('app:set-enabled', enabled);
  },
  setStructuresEnabled: enabled => {
    if (typeof enabled === 'boolean') ipcRenderer.send('app:set-structures-enabled', enabled);
  },
  selectPet: id => {
    if (typeof id === 'string') ipcRenderer.send('app:select-pet', id);
  },
  setBrush: changes => {
    if (changes && typeof changes === 'object') ipcRenderer.send('app:set-brush', {
      drawColor: changes.drawColor,
      drawSize: changes.drawSize,
      drawShape: changes.drawShape,
      eraser: changes.eraser
    });
  },
  hideControls: () => ipcRenderer.send('app:hide-controls'),
  setControlsCollapsed: collapsed => {
    if (typeof collapsed === 'boolean') ipcRenderer.send('app:set-controls-collapsed', collapsed);
  },
  setControlsPanelOpen: open => {
    if (typeof open === 'boolean') ipcRenderer.send('app:set-controls-panel-open', open);
  },
  clear: kind => {
    if (['effects', 'drawing', 'structures', 'pets', 'all'].includes(kind)) ipcRenderer.send('app:clear', kind);
  },
  exit: () => ipcRenderer.send('app:exit'),
  onState: callback => subscribe('app:state', callback),
  onClear: callback => subscribe('playground:clear', callback),
  onPetDefinitions: callback => subscribe('app:pet-definitions', callback)
}));
