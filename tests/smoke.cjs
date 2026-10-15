const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const project = path.resolve(__dirname, '..');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'desktop-playground-ui-smoke-'));
const appDir = path.join(scratch, 'app');
const appData = path.join(scratch, 'appdata');
let child;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function port() {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const number = server.address().port;
      server.close(() => resolve(number));
    });
  });
}
async function until(fn, name, timeout = 12000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    try { const value = await fn(); if (value) return value; } catch {}
    await wait(80);
  }
  throw new Error('Timed out: ' + name);
}
async function connect(portNumber, suffix) {
  const url = await until(async () => {
    const targets = await (await fetch('http://127.0.0.1:' + portNumber + '/json/list')).json();
    return targets.find(item => item.type === 'page' && item.url.endsWith(suffix))?.webSocketDebuggerUrl;
  }, suffix);
  const socket = new WebSocket(url);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  let seq = 0;
  const pending = new Map();
  socket.addEventListener('message', event => {
    const packet = JSON.parse(event.data);
    if (!packet.id) return;
    const entry = pending.get(packet.id);
    if (!entry) return;
    pending.delete(packet.id);
    packet.error ? entry.reject(new Error(packet.error.message)) : entry.resolve(packet.result);
  });
  return {
    eval(expression) {
      const id = ++seq;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        socket.send(JSON.stringify({
          id, method: 'Runtime.evaluate',
          params: { expression, awaitPromise: true, returnByValue: true }
        }));
      }).then(result => {
        if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
        return result.result.value;
      });
    },
    close() { socket.close(); }
  };
}
async function run() {
  fs.mkdirSync(appDir, { recursive: true });
  fs.mkdirSync(appData, { recursive: true });
  fs.mkdirSync(path.join(appDir,'animation'),{recursive:true});
  for (const file of ['pet-animation.cjs','profiles.browser.js'])
    fs.copyFileSync(path.join(project,'animation',file),path.join(appDir,'animation',file));
  for (const file of [
    'main.js','taskbar-zorder.ps1','local-pets.js','preload.js','index.html','renderer.js','screen-effects.js','styles.css',
    'controls.html','controls.js','controls.css','spritesheet.webp','spritesheet_2.webp','package.json'
  ]) fs.copyFileSync(path.join(project,file),path.join(appDir,file));
  fs.mkdirSync(path.join(appDir,'assets'),{recursive:true});
  fs.copyFileSync(path.join(project,'assets','icon.png'),path.join(appDir,'assets','icon.png'));
  fs.cpSync(path.join(project,'assets','pets'),path.join(appDir,'assets','pets'),{recursive:true});
  for (const kind of ['weapons','tools']) fs.cpSync(path.join(project,'assets',kind),path.join(appDir,'assets',kind),{recursive:true});
  const mainPath = path.join(appDir,'main.js');
  fs.writeFileSync(mainPath, fs.readFileSync(mainPath,'utf8').replace(
    "const USER_DATA_PATH = path.join(app.getPath('appData'), 'desktop-playground');",
    "app.setPath('appData', process.env.SMOKE_APPDATA);\nconst USER_DATA_PATH = path.join(app.getPath('appData'), 'desktop-playground');"
  ));
  fs.writeFileSync(mainPath,fs.readFileSync(mainPath,'utf8').replace('tray.setContextMenu(menu);','smokeTrayMenu=menu;tray.setContextMenu(menu);'));
  fs.appendFileSync(mainPath, `
let smokeTrayMenu;
ipcMain.handle('smoke:overlay-bounds', event => {
  if (!isTrustedSender(event, controlsWindow)) throw new Error('Untrusted smoke sender');
  return { actual: overlayWindow.getBounds(), desired: screen.getPrimaryDisplay().bounds };
});
ipcMain.handle('smoke:auxiliary-effects', async (event, enabled) => {
  if (!isTrustedSender(event, controlsWindow)) throw new Error('Untrusted smoke sender');
  const item=smokeTrayMenu.getMenuItemById('auxiliary-effects');
  if(item.checked!==enabled)item.click(item);await petWriteChain;return state.auxiliaryEffectsEnabled;
});
ipcMain.handle('smoke:crack-mode', async (event, mode) => {
  if (!isTrustedSender(event, controlsWindow)) throw new Error('Untrusted smoke sender');
  const item=smokeTrayMenu.getMenuItemById('crack-'+mode);
  if (!item) throw new Error('Unknown crack mode');
  item.click(item);await petWriteChain;return state.crackMode;
});
ipcMain.handle('smoke:clear-crack', event => {
  if (!isTrustedSender(event, controlsWindow)) throw new Error('Untrusted smoke sender');
  const item=smokeTrayMenu.getMenuItemById('clear-crack');item.click(item);return true;
});
ipcMain.handle('smoke:restore-playground', event => {
  if (!isTrustedSender(event, controlsWindow)) throw new Error('Untrusted smoke sender');
  showControls();
  return { overlay: overlayWindow.isVisible(), controls: controlsWindow.isVisible(), enabled: state.enabled };
});
ipcMain.handle('smoke:window-visibility', event => {
  if (!isTrustedSender(event, controlsWindow)) throw new Error('Untrusted smoke sender');
  return { overlay: overlayWindow.isVisible(), controls: controlsWindow.isVisible(), enabled: state.enabled };
});
`);
  const preloadPath=path.join(appDir,'preload.js');
  fs.writeFileSync(preloadPath,fs.readFileSync(preloadPath,'utf8').replace(
    "getState: () =>", "smokeOverlayBounds: () => ipcRenderer.invoke('smoke:overlay-bounds'),\n  smokeAuxiliaryEffects: enabled => ipcRenderer.invoke('smoke:auxiliary-effects',enabled),\n  smokeCrackMode: mode => ipcRenderer.invoke('smoke:crack-mode',mode),\n  smokeClearCrack: () => ipcRenderer.invoke('smoke:clear-crack'),\n  smokeRestorePlayground: () => ipcRenderer.invoke('smoke:restore-playground'),\n  smokeWindowVisibility: () => ipcRenderer.invoke('smoke:window-visibility'),\n  getState: () =>"));
  // Legacy schema 1 has no effects field: retain all old settings and default ON.
  const settingsFile=path.join(appData,'desktop-playground','playground','settings.json');
  fs.mkdirSync(path.dirname(settingsFile),{recursive:true});
  const icon=fs.readFileSync(path.join(project,'assets','icon.png'));
  const legacyCustom={id:'11111111-1111-1111-1111-111111111111',name:'Preserved fixture',extension:'.png',
    width:icon.readUInt32BE(16),height:icon.readUInt32BE(20),enabled:false};
  const savedAsset=path.join(path.dirname(settingsFile),'assets',legacyCustom.id+'.png');
  fs.mkdirSync(path.dirname(savedAsset),{recursive:true});fs.writeFileSync(savedAsset,icon);
  fs.writeFileSync(settingsFile,JSON.stringify({schemaVersion:1,defaultPets:{cat_brown:false},customPets:[legacyCustom]}));
  const debugPort = await port();
  child = spawn(path.join(project,'node_modules/electron/dist/electron.exe'),
    [appDir,'--remote-debugging-port=' + debugPort,'--host-resolver-rules=MAP * ~NOTFOUND'],
    { cwd: appDir, env: { ...process.env, SMOKE_APPDATA: appData }, stdio:'ignore' });
  const controls = await connect(debugPort,'controls.html');
  const overlay = await connect(debugPort,'index.html');
  await until(() => controls.eval("document.getElementById('pc-button')?.title"), 'toolbar ready');
  await until(() => overlay.eval("typeof buildRoute === 'function'"), 'overlay ready');
  const extent=await overlay.eval('({inner:window.innerHeight,screen:window.screen.height,available:window.screen.availHeight})');
  const nativeBounds=await controls.eval('window.playground.smokeOverlayBounds()');
  assert.equal(extent.inner,extent.screen,
    'overlay and Pet floor include the primary display taskbar strip: '+JSON.stringify({extent,nativeBounds}));
  assert.deepEqual(nativeBounds.actual,nativeBounds.desired);
  if (process.argv.includes('--viewport-only')) {
    console.log('PASS: native overlay bounds include the full primary display and taskbar strip');
    return;
  }
  assert.equal(await controls.eval("document.getElementById('pc-button')?.title"), 'PC');
  assert.equal(await controls.eval("document.querySelectorAll('#control-bar button').length"), 9);
  assert.equal(await controls.eval("document.getElementById('hammer-button').title"), '망치');
  assert.equal(await controls.eval("document.getElementById('control-bar').scrollWidth<=document.getElementById('control-bar').clientWidth"),true);
  assert.equal(await controls.eval("window.playground.getState().then(s=>s.structuresEnabled)"), false);
  assert.equal(await overlay.eval("structuresEnabled"), false);
  assert.equal(await overlay.eval("buildRoute({definition:{category:'cat'}},world.now())"), null);
  const local = await controls.eval("window.playground.getPetDefinitions().then(s=>s.localPets.map(p=>p.id))");
  assert.equal(local.length, 11);
  assert.equal(await overlay.eval("['basic','ghost','star','cloud','usagi'].every(id=>petDefinitions.has(id)) && !petDefinitions.has('Ripple') && !petDefinitions.has('Patchi')"), true);
  await until(() => overlay.eval("petInstances.length === 3"), 'three startup Pets');
  assert.deepEqual(await overlay.eval("petInstances.map(p=>p.definitionId)"), ['kirby','cat_brown','doge']);
  assert.equal(await controls.eval("document.querySelectorAll('.pet-category').length"), 4);
  assert.deepEqual(await controls.eval("Array.from(document.querySelectorAll('.pet-category')).map(row=>[row.querySelector('.category-label').textContent,Array.from(row.querySelectorAll('[data-pet-id]')).map(p=>p.dataset.petId)])"), [
    ['기본',['blob']],
    ['고양이',['cat_brown','cat_face','cat_sleepy','salary-cat']],
    ['강아지',['puddle','doge']],['캐릭터',['usagi','kirby','kirby_sleepy','call_duck','baby_harp_seal']]
  ]);
  assert.equal(await controls.eval("document.querySelector('[data-mode=blackhole] svg path')!==null"),true);
  if (process.argv.includes('--startup-input-only')) {
    await controls.eval("document.getElementById('pets-button').click();document.getElementById('pet-manage-entry').click()");
    await until(() => controls.eval("panelKind==='manage' && petInstancesSnapshot.length===3"),'current Pet management list');
    assert.equal(await controls.eval("document.querySelectorAll('.manage-pet-row').length===3 && document.querySelector('.manage-header strong').textContent==='총 3마리 · 3종'"),true);
    await overlay.eval("for(let i=0;i<4;i++)spawnPet('kirby',500+i*20,400);spawnPet('blob',600,400);spawnPet('cat',650,400)");
    await until(() => controls.eval("petInstancesSnapshot.length===9 && document.querySelector('[data-definition-id=kirby] .manage-pet-count').textContent==='5마리'"),'Pet management grouped count');
    await controls.eval("document.querySelector('[data-definition-id=kirby] .manage-remove').click()");
    await until(() => controls.eval("petInstancesSnapshot.length===4 && !petInstancesSnapshot.some(p=>p.definitionId==='kirby')"),'Pet management removes one kind without confirmation');
    assert.equal(await overlay.eval("petInstances.every(p=>p.definitionId!=='kirby') && petDefinitions.has('kirby')"),true);
    await controls.eval("document.querySelector('.manage-footer button:last-child').click()");
    assert.equal(await controls.eval("document.querySelector('.manage-footer').textContent.includes('2 / 2')"), true);
    await controls.eval("document.querySelector('[data-definition-id=cat] .manage-remove').click()");
    await until(() => controls.eval("petInstancesSnapshot.length===3 && managePage===0 && document.querySelector('.manage-footer').textContent.includes('1 / 1')"),'Pet management page clamps after kind deletion');
    await controls.eval("document.getElementById('pets-button').click()");
    assert.equal(await controls.eval("document.getElementById('play-button').textContent==='🎲' && Array.from(document.querySelectorAll('.play-choice img,.gun-choice img')).every(img=>img.naturalWidth>0)"),true);
    for (const [button,mode,icon] of [
      ['touch-button','touch','data:image/png'],['bomb','bomb','bomb-cursor.png'],
      ['hammer','hammer','hammer-cursor.png'],['blackhole','blackhole','ui-vortex.svg']]) {
      await controls.eval(button==='touch-button' ? "document.getElementById('touch-button').click()"
        : `document.getElementById('play-button').click();document.querySelector('[data-mode=${button}]').click()`);
      await until(() => overlay.eval(`currentMode==='${mode}'`),`${mode} mode`);
      assert.match(await overlay.eval('getComputedStyle(canvas).cursor'),new RegExp(icon.replace('.','\\.')+(button==='bomb' ? '.*24 24' : button==='hammer' ? '.*11 18' : '.*16 16')));
    }
    await controls.eval("document.getElementById('pets-button').click();document.querySelector('[data-pet-id=blob]').click()");
    await until(() => overlay.eval("currentMode==='spawn'"),'Pet tool');
    assert.match(await overlay.eval('getComputedStyle(canvas).cursor'),/data:image\/png.*16 16/);
    await controls.eval("document.getElementById('draw-button').click()");
    await until(() => overlay.eval("currentMode==='draw'"),'Draw tool');
    assert.match(await overlay.eval('getComputedStyle(canvas).cursor'),/ui-pencil\.svg.*16 16/);
    await until(() => overlay.eval('controlsPanelOpen'),'Draw menu open');
    const drawCount = await overlay.eval('world.drawnShapes.length');
    await overlay.eval("canvas.dispatchEvent(new MouseEvent('mousedown',{button:0,clientX:500,clientY:400,bubbles:true}));canvas.dispatchEvent(new MouseEvent('mousemove',{button:0,clientX:540,clientY:400,bubbles:true}));window.dispatchEvent(new MouseEvent('mouseup',{button:0,clientX:540,clientY:400,bubbles:true}))");
    await until(() => overlay.eval('!controlsPanelOpen'),'Draw menu dismissed by stroke');
    await until(() => controls.eval('panelKind===null'),'Draw menu closed in controls');
    assert.equal(await overlay.eval(`currentMode==='draw' && world.drawnShapes.length===${drawCount + 1}`),true);
    await controls.eval("document.getElementById('draw-button').click()");
    await until(() => overlay.eval('controlsPanelOpen'),'Draw menu reopened');
    await controls.eval("document.querySelector('[data-eraser]').click()");
    await until(() => overlay.eval("canvas.className==='cursor-eraser'"),'Eraser cursor');
    assert.match(await overlay.eval('getComputedStyle(canvas).cursor'),/ui-eraser\.svg.*16 16/);
    await controls.eval("document.getElementById('play-button').click();document.querySelector('[data-mode=gun]').click()");
    await until(() => overlay.eval("controlsPanelOpen"),'Gun menu open');
    await overlay.eval("canvas.dispatchEvent(new MouseEvent('mousedown',{button:0,clientX:500,clientY:400,bubbles:true}))");
    await until(() => overlay.eval("currentMode==='pc' && !controlsPanelOpen"),'outside Gun menu click returns PC');
    assert.equal(await overlay.eval('bullets.length'),0);
    await until(() => controls.eval("panelKind===null"),'Gun menu dismissed in controls');
    await controls.eval("document.getElementById('play-button').click();document.querySelector('[data-mode=gun]').click();document.querySelector('[data-weapon=awm]').click()");
    await until(() => overlay.eval("currentMode==='gun' && gunWeapon==='awm' && !controlsPanelOpen"),'Gun selection');
    assert.match(await overlay.eval('getComputedStyle(canvas).cursor'),/ui-aim\.svg.*16 16/);
    assert.equal(await controls.eval("document.getElementById('play-button').title"),'놀이');
    assert.equal(await controls.eval("document.querySelectorAll('.play-choice').length===5 && document.querySelectorAll('.gun-choice').length===4 && !document.getElementById('more-button')"),true);
    await controls.eval("document.getElementById('play-button').click()");
    await until(() => overlay.eval('controlsPanelOpen'),'Play menu open');
    await until(() => controls.eval('window.innerHeight>56'),'Play menu sized');
    const panelHeight = await controls.eval("document.getElementById('control-panel').getBoundingClientRect().height");
    assert.equal(await controls.eval("panelKind==='play' && document.querySelectorAll('#control-bar button').length===9 && getComputedStyle(document.body).backgroundColor==='rgba(0, 0, 0, 0)'"),true);
    assert.equal(await controls.eval("(() => {const r=document.getElementById('control-panel').getBoundingClientRect();return r.top>=0 && r.left>=0 && r.right<=innerWidth && r.bottom<=innerHeight})()"),true);
    assert.equal(await controls.eval("document.getElementById('panel-list').scrollHeight<=document.getElementById('panel-list').clientHeight"),true);
    await overlay.eval('screenEffects.addCrack(400,400)');
    await controls.eval("document.querySelector('.play-clear-cracks').click()");
    await until(() => overlay.eval('screenEffects.groups.crack.length===0'),'Play crack clear');
    await controls.eval("document.querySelector('[data-mode=gun]').click()");
    assert.equal(await controls.eval("document.getElementById('panel-list').scrollHeight<=document.getElementById('panel-list').clientHeight"),true);
    await controls.eval("document.getElementById('pets-button').click()");
    assert.equal(await controls.eval("document.getElementById('control-panel').getBoundingClientRect().height"),panelHeight);
    assert.equal(await controls.eval("document.getElementById('panel-list').scrollHeight<=document.getElementById('panel-list').clientHeight"),true);
    assert.equal(await controls.eval("[...document.querySelectorAll('.pet-choice')].every(choice=>choice.querySelector('canvas'))"),true);
    await controls.eval("document.getElementById('draw-button').click()");
    assert.equal(await controls.eval("panelKind==='draw' && !document.querySelector('.panel-draw').hidden && document.getElementById('control-panel').getBoundingClientRect().height===260"),true);
    assert.equal(await controls.eval("document.getElementById('panel-list').scrollHeight<=document.getElementById('panel-list').clientHeight"),true);
    await controls.eval("document.getElementById('play-button').click()");
    await controls.eval("document.getElementById('structures-button').click()");
    await until(() => overlay.eval('structuresEnabled'),'structure toggle in Play menu');
    await controls.eval("document.getElementById('structures-button').click()");
    await until(() => overlay.eval('!structuresEnabled'),'structure toggle restored');
    await controls.eval("document.getElementById('pc-button').click()");
    await controls.eval("document.getElementById('visibility-button').click()");
    await until(() => controls.eval("window.playground.smokeWindowVisibility().then(s=>!s.overlay&&!s.controls&&!s.enabled)"),'full Hide closes both windows');
    await controls.eval("window.playground.smokeRestorePlayground()");
    await until(() => controls.eval("window.playground.smokeWindowVisibility().then(s=>s.overlay&&s.controls&&s.enabled)"),'Tray-style restore opens both windows');
    await controls.eval("document.getElementById('toolbar-hide-button').click()");
    await until(() => controls.eval("window.playground.smokeWindowVisibility().then(s=>s.overlay&&!s.controls&&s.enabled)"),'toolbar-only Hide keeps Pets visible');
    await controls.eval("window.playground.smokeRestorePlayground()");
    console.log('PASS: 3 starters, 9-button toolbar, Play/Draw menus, cursor hotspots and outside-click dismissal');
    return;
  }
  assert.equal(await controls.eval("document.querySelectorAll('.shape-button').length===4 && document.querySelectorAll('.color-swatch').length===6 && document.getElementById('draw-size-slider').max==='100'"),true);
  await controls.eval("globalThis.__petChoice=document.querySelector('.pet-choice');document.getElementById('pets-button').click()");
  assert.equal(await controls.eval("document.getElementById('panel-list').scrollHeight <= document.getElementById('panel-list').clientHeight"), true);
  await controls.eval("document.getElementById('pets-button').click();document.getElementById('pets-button').click()");
  assert.equal(await controls.eval("globalThis.__petChoice===document.querySelector('.pet-choice')"), true);
  assert.deepEqual(await controls.eval("['cat_brown','cat_face','cat_sleepy','salary-cat'].map(id=>document.querySelector('[data-pet-id=\"'+id+'\"]').textContent.trim())"),['황색냥','얼굴냥','실눈냥','영업냥']);
  assert.equal(await controls.eval("[...document.querySelectorAll('.pet-choice')].every(choice=>choice.querySelector('canvas'))"),true);
  await controls.eval("document.querySelector('[data-pet-id=cat_brown]').click()");
  await until(() => overlay.eval("selectedPetId === 'cat_brown' && currentMode === 'spawn'"), 'local variant selection');
  for (const [button, mode] of [['touch-button','touch'],['draw-button','draw'],
    ['bomb-button','bomb'],['hammer-button','hammer'],['gun-button','gun'],['blackhole-button','blackhole'],['pets-button','spawn']]) {
    if (mode === 'spawn') {
      await controls.eval("document.getElementById('pets-button').click();document.querySelector('[data-pet-id=blob]').click()");
    } else if (['bomb','hammer','gun','blackhole'].includes(mode)) {
      await controls.eval("document.getElementById('play-button').click();document.getElementById('" + button + "').click()" +
        (mode === 'gun' ? ";document.querySelector('[data-weapon=ak47]').click()" : ''));
    } else await controls.eval("document.getElementById('" + button + "').click()");
    await until(() => overlay.eval("currentMode === '" + mode + "'"), mode + ' mode');
    await overlay.eval("canvas.dispatchEvent(new MouseEvent('mousedown',{button:2,bubbles:true,cancelable:true}))");
    await until(() => overlay.eval("currentMode === 'pc' && !pointerDown && !activeStroke"), mode + ' right-click PC');
    assert.equal(await controls.eval("document.getElementById('pc-button').classList.contains('active')"), true);
  }
  assert.equal(await overlay.eval("!window.dispatchEvent(new MouseEvent('contextmenu',{button:2,bubbles:true,cancelable:true}))"), true);
  await controls.eval("document.getElementById('draw-button').click();const slider=document.getElementById('draw-size-slider');slider.value='100';slider.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('[data-color=\"#ffffff\"]').click()");
  await until(() => overlay.eval("drawSize === 30 && drawColor === '#ffffff'"), 'Draw slider and white preset');
  await controls.eval("document.getElementById('pc-button').click()");
  await until(() => overlay.eval("currentMode === 'pc' && enabled"), 'visible PC mode');
  await controls.eval("document.getElementById('play-button').click();document.getElementById('bomb-button').click();document.getElementById('collapse-button').click()");
  await until(() => overlay.eval("currentMode === 'pc'"), 'collapse PC mode');
  assert.equal(await controls.eval("document.body.classList.contains('collapsed') && document.querySelectorAll('#mini-controls button').length === 3"), true);
  await controls.eval("document.getElementById('mini-visibility-button').click()");
  await until(() => controls.eval("window.playground.smokeWindowVisibility().then(s=>!s.enabled&&!s.overlay&&!s.controls)"), 'collapsed Hide all');
  await controls.eval("window.playground.smokeRestorePlayground()");
  await until(() => overlay.eval("enabled === true"), 'collapsed Tray restore');
  await controls.eval("document.getElementById('expand-button').click()");
  assert.equal(await controls.eval("!document.body.classList.contains('collapsed')"), true);
  assert.equal(await overlay.eval("currentMode === 'pc'"), true);
  await controls.eval("document.getElementById('visibility-button').click()");
  await until(() => controls.eval("window.playground.smokeWindowVisibility().then(s=>!s.enabled&&!s.overlay&&!s.controls)"), 'Hide all');
  await controls.eval("window.playground.smokeRestorePlayground()");
  await until(() => overlay.eval("enabled === true && currentMode === 'pc'"), 'Tray restore all');
  await controls.eval("document.getElementById('play-button').click();document.getElementById('structures-button').click()");
  await until(() => overlay.eval('structuresEnabled === true'), 'structures ON IPC');
  assert.equal(await controls.eval("document.getElementById('structures-button').getAttribute('aria-pressed')"), 'true');
  const structureOn = await overlay.eval(`(() => {
    stopAnimation(); clearPlayground('pets');
    const platform=addStructure('platform',{x:300,y:300,width:160,height:12});
    ctx.clearRect(0,0,width,height); drawStructures();
    const alpha=ctx.getImageData(320,305,1,1).data[3];
    const pet=spawnPet('blob',320,300-35-5); pet.vx=0; pet.vy=8; pet.update(1);
    return {count:world.structures.length,alpha,support:pet.supportId===platform.id};
  })()`);
  assert.ok(structureOn.count===1 && structureOn.alpha>0 && structureOn.support);
  await controls.eval("document.getElementById('structures-button').click()");
  await until(() => overlay.eval('structuresEnabled === false'), 'structures OFF IPC');
  const structureOff = await overlay.eval(`(() => {
    stopAnimation(); ctx.clearRect(0,0,width,height); drawStructures();
    const pet=petInstances[0]; pet.x=320;pet.y=300-pet.size-5;pet.vx=0;pet.vy=8;pet.update(1);
    return {count:world.structures.length,alpha:ctx.getImageData(320,305,1,1).data[3],
      support:pet.supportId,below:pet.y+pet.size>300};
  })()`);
  assert.ok(structureOff.count===1 && structureOff.alpha===0 && structureOff.support===null && structureOff.below);
  assert.equal(await overlay.eval('blackHoleConsumeRadius'),22);
  const orbit = await overlay.eval(`(() => {
    clearPlayground('pets');clearPlayground('effects');
    const pet=spawnPet('blob',700,300);addBlackHole(700,300);
    for(let i=0;i<200;i++)updateBlackHoles(1);
    const midway=petInstances.includes(pet)&&pet.blackHoleOrbit.turns>2;
    for(let i=0;i<130;i++)updateBlackHoles(1);
    return {midway,consumed:!petInstances.includes(pet),definition:petDefinitions.has('blob')};
  })()`);
  assert.ok(orbit.midway && orbit.consumed && orbit.definition);
  const shapes = await overlay.eval(`(() => {
    const ellipse={id:99,kind:'ellipse',size:7,points:[{x:100,y:100},{x:260,y:180}]};
    const freehand={id:100,kind:'freehand',size:7,points:[{x:300,y:200},{x:360,y:200},{x:390,y:240}]};
    const rect={id:101,kind:'rect',size:7,points:[{x:420,y:100},{x:520,y:180}]};
    const segments=shapeSegments(ellipse), line=shapeSegments(freehand), box=shapeSegments(rect);
    world.drawnColliders=[...segments,...line];
    const side={x:245,y:140,size:10,vx:-20,vy:0};
    collideDrawnWalls(side,275,140);
    return {ellipse:segments.length,freehand:line.length,rect:box.length,wallX:side.x,
      bounds:[Math.min(...segments.map(s=>s.x1)),Math.max(...segments.map(s=>s.x1)),
        Math.min(...segments.map(s=>s.y1)),Math.max(...segments.map(s=>s.y1))],
      support:Boolean(drawnSurfaceAt(180,100,4)),
      landing:Boolean(drawnLandingAt({x:180,y:65,size:35},95))};
  })()`);
  assert.equal(shapes.ellipse,32);
  assert.equal(shapes.freehand,2);
  assert.equal(shapes.rect,4);
  assert.ok(shapes.wallX >= 250);
  assert.deepEqual(shapes.bounds,[100,260,100,180]);
  assert.ok(shapes.support && shapes.landing);
  await controls.eval("document.getElementById('touch-button').click()");
  await until(() => overlay.eval("currentMode === 'touch'"), 'Grab/Throw Touch mode');
  const grabThrow = await overlay.eval(`(() => {
    stopAnimation(); clearPlayground('pets'); clearPlayground('drawing');
    const p=spawnPet('blob',width*.4,height-35);
    const startX=p.x, startY=p.y, time=performance.now();
    const input=(type,x,y,offset)=>{
      const event=new MouseEvent(type,{button:0,clientX:x,clientY:y,bubbles:true});
      Object.defineProperty(event,'timeStamp',{value:time+offset});
      (type==='mouseup'?window:canvas).dispatchEvent(event);
    };
    input('mousedown',startX+20,startY,0);
    const grabbed=p.x;
    input('mousemove',startX+80,startY,50);
    const moved=p.x;
    input('mouseup',startX+140,startY,100);
    const released=p.vx;
    p.update(1);
    const retained=p.vx;
    input('mousedown',p.x,p.y,150);
    input('mousemove',p.x+60,p.y,180);
    input('mouseup',p.x,p.y,350);
    const stopped=p.vx;
    const other=spawnPet('blob',100,100), trash=trashRect();
    input('mousedown',p.x,p.y,400);
    input('mouseup',trash.x+trash.width/2,trash.y+trash.height/2,500);
    const trashOk=petInstances.length===1 && petInstances[0]===other;
    const shot=spawnPet('blob',width*.25,height*.4), wall=shot.x+100;
    world.drawnColliders=shapeSegments({id:1000,kind:'line',size:1,
      points:[{x:wall,y:20},{x:wall,y:height-20}]});
    shot.beginThrow(54,0);for(let i=0;i<3;i++)shot.update(1);
    return {offset:Math.abs(grabbed-startX)<1 && Math.abs(moved-startX-60)<1,
      released,retained,stopped,trash:trashOk,wall:shot.x<wall-35 && shot.vx< -30};
  })()`);
  assert.ok(grabThrow.offset && grabThrow.trash && grabThrow.wall);
  assert.ok(grabThrow.released>24 && grabThrow.released<25);
  assert.ok(grabThrow.retained>grabThrow.released*.9 && grabThrow.retained<grabThrow.released);
  assert.ok(Math.abs(grabThrow.stopped)<1e-8);
  const residualStates = await overlay.eval(`(() => {
    stopAnimation();clearPlayground('all');currentMode='touch';
    const p=spawnPet('blob',width*.4,height*.4);addBlackHole(p.x,p.y);updateBlackHoles(1);
    const input=(type,x,y)=> (type==='mouseup'?window:canvas).dispatchEvent(
      new MouseEvent(type,{button:0,clientX:x,clientY:y,bubbles:true}));
    input('mousedown',p.x,p.y);
    const detached=!p.blackHoleOrbit;
    input('mousemove',p.x+30,p.y);const moved=p.x;updateBlackHoles(1);
    const dragStable=p.x===moved && !p.blackHoleOrbit;
    input('mouseup',p.x,p.y);updateBlackHoles(1);
    const released=!p.blackHoleOrbit && Boolean(p.externalMotion);
    clearPlayground('effects');
    const references=p.rescuedFromHoles.size===0;
    drawShape='freehand';drawSize=30;eraser=false;beginDrawing(160,160);activeStroke=null;
    const painted=drawingCtx.getImageData(160,160,1,1).data[3]>0;
    drawSize=1;eraseDrawing(186,160);
    const erased=strokes.length===0 && world.drawnShapes.length===0 && world.drawnColliders.length===0
      && drawingCtx.getImageData(160,160,1,1).data[3]===0;
    p.recentStructures.set(999,0);p.targetHistory=[999];p.climbing=999;p.climbingDown=true;
    clearPlayground('structures');
    return {detached,dragStable,released,references,painted,erased,
      history:p.recentStructures.size===0 && p.targetHistory.length===0 && !p.climbingDown};
  })()`);
  assert.ok(Object.values(residualStates).every(Boolean),JSON.stringify(residualStates));
  console.log('PASS: Black Hole Grab rescue/release, reference cleanup, native dot erase, structure history');
  const autonomy = await overlay.eval(`(() => {
    stopAnimation();clearPlayground('all');
    const p=spawnPet('cat_brown',width*.5,height-39);p.vx=0;p.vy=0;
    p.enterAutonomy('rest');p.autonomy.remainingMs=p.autonomy.durationMs=2000;
    for(let i=0;i<60;i++)p.update(1);p.draw(ctx);
    const quiet=p.autonomy.state==='rest' && Math.abs(p.vx)<.01 && p.animationState==='rest';
    const remaining=p.autonomy.remainingMs;
    fireBomb(p.x-40,p.y);const vx=p.vx;p.update(1);
    const impulse=p.vx>vx*.9 && p.autonomy.state==='roam' && p.autonomyHoldMs>0;
    return {quiet,remaining,impulse,profile:p.activity===activityProfiles.calm};
  })()`);
  assert.ok(autonomy.quiet && autonomy.impulse && autonomy.profile);
  assert.ok(Math.abs(autonomy.remaining-1000)<1e-6);
  console.log('PASS: native rest/idle Sprite, elapsed state timer, Bomb interrupts rest');
  await controls.eval("document.getElementById('hammer-button').click()");
  await until(() => overlay.eval("currentMode==='hammer' && canvas.className==='cursor-hammer'"), 'Hammer mode and cursor');
  const toyEffects = await overlay.eval(`(() => {
    stopAnimation();clearPlayground('all');
    const pet=spawnPet('doge',320,320),other=spawnPet('doge',650,320);
    canvas.dispatchEvent(new MouseEvent('mousedown',{button:0,clientX:320,clientY:320,bubbles:true}));
    pet.advanceAnimation(0);
    const hammerHit=pet.externalMotion?.source==='hammer' && pet.animationVisualState==='hit'
      && pet.vx>0 && pet.vy<0 && !other.externalMotion && petInstances.length===2;
    const hammerCount=screenEffects.groups.hammer.length;
    const immediateCrack=screenEffects.groups.crack.length;
    ctx.clearRect(0,0,width,height);drawEffects(16);
    const crack=screenEffects.groups.crack[0];
    const hammerRadius=Math.max(...crack.paths.flat().map(point=>Math.hypot(point.x,point.y)));
    const contact=crack.x===320 && crack.y===320 && screenEffects.groups.hammer[0].x===320
      && screenEffects.groups.hammer[0].y===320;
    const hammerAlpha=ctx.getImageData(320,315,1,1).data[3];
    fireBomb(650,320);
    return {hammerHit,hammerRadius,hammerCount,hammerAlpha,contact,immediateCrack,
      bombCracks:screenEffects.groups.crack.length,bombEdge:holes[0].edge.length,
      bombSource:other.externalMotion?.source,damageCount:screenEffects.groups.damage.length,
      count:petInstances.length};
  })()`);
  assert.ok(toyEffects.hammerHit && toyEffects.hammerCount===1 && toyEffects.hammerAlpha>0
    && toyEffects.contact && toyEffects.immediateCrack===1
    && toyEffects.hammerRadius>150 && toyEffects.hammerRadius<=170.000001
    && toyEffects.bombCracks===1 && toyEffects.bombEdge===32
    && toyEffects.bombSource==='bomb' && toyEffects.damageCount>=2
    && toyEffects.count===2,JSON.stringify(toyEffects));
  console.log('PASS: native immediate Hammer contact/Hit/damage and Bomb irregular crater without cracks');
  assert.ok(await overlay.eval(`(() => {
    stopAnimation();clearPlayground('all');
    const pet=spawnPet('cat_sleepy',500,430);pet.enterAutonomy('sleep');
    pet.isAutonomouslyStill=true;pet.advanceAnimation(0);
    const sleeping=pet.animationVisualState==='sleep' && pet.autonomy.durationMs>=1800000;
    auxiliaryEffectsEnabled=false;strikeHammer(500,430);
    const awake=pet.autonomy.state==='roam' && pet.externalMotion?.source==='hammer';
    for(const kind of ['crack','hammer','ring','impact','particle'])screenEffects.clear(kind);
    const number=screenEffects.groups.damage[0];
    const visiblePixels=()=>{ctx.clearRect(0,0,width,height);drawEffects(0);
      const data=ctx.getImageData(number.x-38,number.y-24,76,48).data;
      let alpha=0;for(let i=3;i<data.length;i+=4)alpha+=data[i];return alpha};
    const hidden=visiblePixels()===0;auxiliaryEffectsEnabled=true;
    const shown=visiblePixels()>0;
    return sleeping && awake && hidden && shown && petInstances.length===1;
  })()`),'native Sleep wake and damage number auxiliary ON/OFF');
  console.log('PASS: native long Sleep wakes on Hammer, damage text hides without disabling impact');
  await controls.eval("document.getElementById('play-button').click();document.getElementById('gun-button').click();document.querySelector('[data-weapon=ak47]').click()");
  await until(() => overlay.eval("currentMode==='gun' && canvas.className==='cursor-gun'"), 'Gun mode and cursor');
  for (const id of ['awm','ak47','uzi','double_barrel']) {
    assert.ok(await controls.eval(`(() => {if(panelKind)closePanel();
      document.getElementById('play-button').click();document.getElementById('gun-button').click();
      const open=panelKind==='play' && !gunPanel.hidden;
      document.querySelector('[data-weapon="${id}"]').click();return open})()`),id+' visible weapon menu');
    await until(() => overlay.eval(`gunWeapon==='${id}' && currentMode==='gun'`),id+' tool selection');
  }
  await controls.eval("document.getElementById('play-button').click();document.getElementById('gun-button').click();document.querySelector('[data-weapon=ak47]').click()");
  await until(() => overlay.eval("gunWeapon==='ak47'"), 'restore AK-47');
  assert.ok(await overlay.eval(`(() => {
    stopAnimation();clearPlayground('all');lastGunShotAt=-Infinity;
    const pet=spawnPet('doge',500,400);pet.enterAutonomy('sleep');
    canvas.dispatchEvent(new MouseEvent('mousedown',{button:0,clientX:500,clientY:400,bubbles:true}));
    const moving=screenEffects.groups.bullet.length===1 && !pet.externalMotion;
    updateBullets(100);pet.advanceAnimation(0);
    const hit=screenEffects.groups.bullet.length===0 && pet.externalMotion?.source==='gun'
      && pet.animationVisualState==='hit' && pet.autonomy.state==='roam'
      && screenEffects.groups.damage[0]?.source==='gun' && petInstances.length===1;
    const damageCount=screenEffects.groups.damage.length;
    canvas.dispatchEvent(new MouseEvent('mousedown',{button:0,clientX:500,clientY:400,bubbles:true}));
    window.dispatchEvent(new MouseEvent('mouseup',{button:0,clientX:500,clientY:400,bubbles:true}));
    return moving && hit && screenEffects.groups.damage.length===damageCount && !gunTriggerHeld;
  })()`),'native moving Gun projectile, nonlethal Hit, Sleep wake and cooldown');
  console.log('PASS: native Gun projectile sweep/Hit/Sleep wake/cooldown and secure mode');
  const gunGeometry=await overlay.eval(`(() => {
    stopAnimation();clearPlayground('all');const pet=spawnPet('doge',500,400);
    let transparent=null,opaque=null;
    for(let y=pet.y-30;y<pet.y+31;y+=3)for(let x=pet.x-30;x<pet.x+31;x+=3) {
      const area=spriteHitArea(pet,x,y);
      if (!area && !transparent && x>pet.x+20 && y>pet.y+20) transparent={x,y};
      if (area && !opaque) opaque={x,y};
    }
    const transparentPixel=spriteHitArea(pet,transparent.x,transparent.y)===null;
    lastGunShotAt=-Infinity;gunWeapon='ak47';shootGun(800,800);updateBullets(100);
    const miss=!pet.externalMotion && screenEffects.groups.damage.length===0 && transparentPixel;
    clearPlayground('effects');lastGunShotAt=-Infinity;shootGun(opaque.x,opaque.y);updateBullets(100);
    const hit=pet.externalMotion?.source==='gun' && screenEffects.groups.damage.length===1;
    let within=true;
    for(const profile of Object.values(weaponProfiles))for(const [x,y] of [[0,0],[width,0],[0,height],[width,height]]) {
      const pose=gunPose(x,y,profile),c=Math.cos(pose.angle),s=Math.sin(pose.angle);
      for(const [px,py] of [[0,0],[profile.width,0],[0,profile.height],[profile.width,profile.height]]) {
        const dx=px-profile.width*profile.muzzle[0],dy=py-profile.height*profile.muzzle[1];
        const sx=pose.muzzleX+dx*c-dy*pose.flipY*s,sy=pose.muzzleY+dx*s+dy*pose.flipY*c;
        if(sx<-.01||sy<-.01||sx>width+.01||sy>height+.01)within=false;
      }
    }
    return {miss,hit,within,transparent,opaque};
  })()`);
  assert.ok(gunGeometry.miss && gunGeometry.hit && gunGeometry.within,JSON.stringify(gunGeometry));
  console.log('PASS: native Sprite alpha excludes transparent cell padding and red dot hits opaque pixels');
  if (process.argv.includes('--gun-preview')) {
    const png=await overlay.eval(`(() => {
      stopAnimation();
      const ids=['awm','ak47','uzi','double_barrel'];
      const out=document.createElement('canvas');out.width=1680;out.height=720;
      const qc=out.getContext('2d');qc.fillStyle='#edf2f6';qc.fillRect(0,0,out.width,out.height);
      auxiliaryEffectsEnabled=true;currentMode='gun';enabled=true;
      for (let col=0;col<4;col++) {
        clearPlayground('all');lastGunShotAt=-Infinity;gunWeapon=ids[col];
        mouseX=195;mouseY=240;
        const pet=spawnPet('doge',195,240);
        shootGun(mouseX,mouseY);updateBullets(18);
        ctx.clearRect(0,0,width,height);drawEffects(0);pet.draw(ctx);drawDamageNumbers();drawGunOverlay();
        qc.drawImage(canvas,0,0,420,330,col*420,0,420,330);
        updateBullets(100);pet.advanceAnimation(0);
        ctx.clearRect(0,0,width,height);drawEffects(0);pet.draw(ctx);drawDamageNumbers();drawGunOverlay();
        qc.drawImage(canvas,0,0,420,330,col*420,360,420,330);
        qc.fillStyle='#263f53';qc.font='bold 16px sans-serif';
        qc.fillText(weaponProfiles[ids[col]].label+' · flight',col*420+12,348);
        qc.fillText(weaponProfiles[ids[col]].label+' · hit',col*420+12,708);
      }
      return out.toDataURL('image/png').split(',')[1];
    })()`);
    const qaDir=path.join(project,'docs/v1.1/qa/phase3c');fs.mkdirSync(qaDir,{recursive:true});
    fs.writeFileSync(path.join(qaDir,'native-weapons.png'),Buffer.from(png,'base64'));
    console.log('Native Gun preview: '+path.join(qaDir,'native-weapons.png'));
    const toy=await overlay.eval(`(() => {
      stopAnimation();const out=document.createElement('canvas');out.width=1260;out.height=360;
      const qc=out.getContext('2d');qc.fillStyle='#edf2f6';qc.fillRect(0,0,out.width,out.height);
      clearPlayground('all');throwGrenade(100,280);updateGrenades(250);drawEffects(250);
      ctx.clearRect(0,0,width,height);drawEffects(0);
      qc.drawImage(canvas,0,0,420,330,0,0,420,330);
      updateGrenades(2750);const blast=holes[0];
      ctx.clearRect(0,0,width,height);drawEffects(0);
      qc.drawImage(canvas,blast.x-210,blast.y-165,420,330,420,0,420,330);
      clearPlayground('all');strikeHammer(210,165);strikeHammer(212,166);
      drawEffects(100);ctx.clearRect(0,0,width,height);drawEffects(0);
      qc.drawImage(canvas,0,0,420,330,840,0,420,330);
      qc.fillStyle='#263f53';qc.font='bold 16px sans-serif';
      qc.fillText('Grenade · flight',12,350);qc.fillText('Grenade · blast (no crack)',432,350);
      qc.fillText('Hammer · repeated local fracture',852,350);
      return out.toDataURL('image/png').split(',')[1];
    })()`);
    fs.writeFileSync(path.join(qaDir,'native-grenade-hammer.png'),Buffer.from(toy,'base64'));
    console.log('Native toy preview: '+path.join(qaDir,'native-grenade-hammer.png'));
  }
  if (process.argv.includes('--toy-preview')) {
    const png=await overlay.eval(`(() => {
      const out=document.createElement('canvas');out.width=900;out.height=420;
      const qc=out.getContext('2d');qc.fillStyle='#edf2f6';qc.fillRect(0,0,900,420);
      clearPlayground('all');spawnPet('doge',225,230);ctx.clearRect(0,0,width,height);strikeHammer(225,200);
      drawEffects(16);ctx.clearRect(0,0,width,height);drawEffects(0);
      qc.drawImage(canvas,0,0,450,400,0,0,450,400);
      clearPlayground('all');spawnPet('doge',675,230);ctx.clearRect(0,0,width,height);fireBomb(675,200);
      drawEffects(80);ctx.clearRect(0,0,width,height);drawEffects(0);
      qc.drawImage(canvas,450,0,450,400,450,0,450,400);
      qc.fillStyle='#263f53';qc.font='16px sans-serif';qc.fillText('Hammer · local',16,414);
      qc.fillText('Bomb · broad',466,414);
      return out.toDataURL('image/png').split(',')[1];
    })()`);
    const qaDir=path.join(project,'docs/v1.1/qa/phase3b');fs.mkdirSync(qaDir,{recursive:true});
    fs.writeFileSync(path.join(qaDir,'native-toys-hit.png'),Buffer.from(png,'base64'));
    console.log('Native hit preview: '+path.join(qaDir,'native-toys-hit.png'));
    const motion=await overlay.eval(`(() => {
      const out=document.createElement('canvas');out.width=900;out.height=420;
      const qc=out.getContext('2d');qc.fillStyle='#edf2f6';qc.fillRect(0,0,900,420);
      clearPlayground('all');spawnPet('doge',225,230);ctx.clearRect(0,0,width,height);strikeHammer(225,200);
      drawEffects(48);drawEffects(90);ctx.clearRect(0,0,width,height);drawEffects(0);
      qc.drawImage(canvas,0,0,450,400,0,0,450,400);
      clearPlayground('all');spawnPet('doge',675,230);ctx.clearRect(0,0,width,height);fireBomb(675,200);
      drawEffects(250);ctx.clearRect(0,0,width,height);drawEffects(0);
      qc.drawImage(canvas,450,0,450,400,450,0,450,400);
      qc.fillStyle='#263f53';qc.font='16px sans-serif';qc.fillText('Hammer · shards / crack only',16,414);
      qc.fillText('Bomb · expanding blast',466,414);
      return out.toDataURL('image/png').split(',')[1];
    })()`);
    fs.writeFileSync(path.join(qaDir,'native-toys-hit-motion.png'),Buffer.from(motion,'base64'));
    console.log('Native hit motion preview: '+path.join(qaDir,'native-toys-hit-motion.png'));
  }
  assert.ok(await overlay.eval(`(() => {
    clearPlayground('effects');screenEffects.setCrackMode('auto');
    strikeHammer(300,300);drawEffects(48);fireBomb(650,300);
    drawEffects(6000);ctx.clearRect(0,0,width,height);drawEffects(0);
    return screenEffects.groups.crack.length===0 && screenEffects.groups.crater.length===0
      && screenEffects.groups.hammer.length===0 && ctx.getImageData(300,300,1,1).data[3]===0
      && ctx.getImageData(650,300,1,1).data[3]===0;
  })()`),'native effects must leave no pixels after recovery');
  const spriteAudit = await overlay.eval(`(async () => {
    stopAnimation(); clearPlayground('all');
    const definitions=[...petDefinitions.values()].filter(d=>d.renderKind==='sprite');
    await Promise.all(definitions.map(d=>d.asset.decode()));
    const errors=[], counts={sheets:0,clips:0,frames:0};
    const preview=document.createElement('canvas');preview.width=840;preview.height=definitions.length*140;
    const pc=preview.getContext('2d');pc.fillStyle='#dde6ee';pc.fillRect(0,0,preview.width,preview.height);
    for(const [di,d] of definitions.entries()) {
      counts.sheets++;
      const cell=document.createElement('canvas');cell.width=192;cell.height=208;
      const cc=cell.getContext('2d',{willReadFrequently:true});
      if(d.asset.naturalWidth!==1536 || d.asset.naturalHeight!==(d.rows||11)*208)errors.push(d.id+': grid');
      let restingFrame=0,restingBottom=0;
      for(const [ci,state] of spriteStates.entries()) {
        const clip=d.clips[state];let bottom=0,left=192,right=0;
        if(clip.row>=(d.rows||11) || clip.frames>8)errors.push(d.id+': invalid clip '+state);
        for(let f=0;f<clip.frames;f++) {
          counts.frames++;cc.clearRect(0,0,192,208);
          cc.drawImage(d.asset,f*192,clip.row*208,192,208,0,0,192,208);
          const pixels=cc.getImageData(0,0,192,208).data;let visible=false,frameBottom=0;
          for(let y=0;y<208;y++)for(let x=0;x<192;x++)if(pixels[(y*192+x)*4+3]>16) {
            visible=true;frameBottom=Math.max(frameBottom,y+1);bottom=Math.max(bottom,y+1);left=Math.min(left,x);right=Math.max(right,x+1);
          }
          if(state==='idle' && frameBottom>restingBottom){restingBottom=frameBottom;restingFrame=f;}
          if(!visible)errors.push(d.id+': empty '+state+'/'+f);
        }
        counts.clips++;
        const profile=spriteProfiles[d.id];
        if(profile.feet && Math.abs(bottom/208-profile.feet[ci])>.0001)errors.push(d.id+': foot '+state);
        if(profile.centers && Math.abs((left+right)/384-profile.centers[ci])>.0001)errors.push(d.id+': center '+state);
        const p=new Pet(70+ci*140,di*140+70,d);
        p.vx=state==='walkRight'?2:state==='walkLeft'?-2:0;p.facingRight=state!=='walkLeft';
        p.isDragging=state==='drag';p.externalMotion=state==='fall'?{elapsedMs:0,stableMs:0}:null;
        p.squish=state==='drag'?1.4:1;p.draw(pc);
        pc.strokeStyle='#8a9eaf';pc.beginPath();pc.moveTo(p.x-60,p.y+p.size);pc.lineTo(p.x+60,p.y+p.size);pc.stroke();
        pc.fillStyle='#263f53';pc.fillText(d.id+' / '+state,p.x-62,di*140+132);
      }
      // Native Canvas transforms must leave the visible bottom at the physical foot.
      const p=new Pet(96,0,d);const native=document.createElement('canvas');native.width=192;native.height=208;
      const nc=native.getContext('2d',{willReadFrequently:true});p.y=100-p.size;p.vx=0;p.advanceAnimation(0);
      p.animationMs=restingFrame*(d.clips.idle.speed+1)*physicsFrameMs;
      for(const squash of spriteProfiles[d.id].feet ? [1,1.4] : []) {
        nc.clearRect(0,0,192,208);p.squish=squash;p.draw(nc);
        const pixels=nc.getImageData(0,0,192,208).data;let bottom=0;
        for(let y=0;y<208;y++)for(let x=0;x<192;x++)if(pixels[(y*192+x)*4+3]>16)bottom=Math.max(bottom,y+1);
        if(Math.abs(bottom-100)>1)errors.push(d.id+': rendered foot '+bottom);
      }
    }
    return {errors,counts,preview:preview.toDataURL('image/png').split(',')[1]};
  })()`);
  assert.deepEqual(spriteAudit.errors,[]);
  assert.deepEqual(spriteAudit.counts,{sheets:11,clips:55,frames:385});
  console.log('PASS: native Sprite audit: 11 original sheets / 55 legacy row selections / 385 nonempty cells, legacy foot checks');
  if(process.argv.includes('--sprite-preview')) {
    const previewPath=path.join(os.tmpdir(),'desktopplayground-phase1c-render.png');
    fs.writeFileSync(previewPath,Buffer.from(spriteAudit.preview,'base64'));console.log('Sprite preview: '+previewPath);
  }
  const expressionAudit=await overlay.eval(`(() => {
    const errors=[];let frames=0,clips=0;
    const cell=document.createElement('canvas');cell.width=192;cell.height=208;
    const c=cell.getContext('2d',{willReadFrequently:true});
    function drawSource(asset,clip,column) {
      c.clearRect(0,0,192,208);c.drawImage(asset,column*192,clip.row*208,192,208,0,0,192,208);
    }
    const states=['idle','walkRight','walkLeft','jump','fall','drag','rest','sleep','look'];
    function pose(p,state) {
      p.vx=0;p.vy=0;p.isDragging=false;p.externalMotion=null;p.motionCause=null;p.climbing=null;
      p.isAutonomouslyStill=['idle','rest','sleep','look'].includes(state);
      p.autonomy={state,remainingMs:4000,durationMs:4000};
      if(state==='walkRight'||state==='walkLeft'){p.vx=state==='walkRight'?2:-2;p.facingRight=p.vx>0;}
      if(state==='jump'){p.motionCause='autonomous-jump';p.vy=-6;}
      if(state==='fall'){p.externalMotion={source:'throw',elapsedMs:0,stableMs:0};p.vy=6;}
      if(state==='drag')p.isDragging=true;
    }
    for(const [id,profile] of Object.entries(spriteProfiles))if(profile.clips) {
      const d=petDefinitions.get(id);
      for(const state of states) {
        const q=new Pet(96,100-d.defaultSize,d);pose(q,state);q.advanceAnimation(0);
        const clip=q.spriteClip().clip;let left=192,right=0,top=208,bottom=0;clips++;
        for(const column of clip.frames) {
          drawSource(d.asset,clip,column);
          const data=c.getImageData(0,0,192,208).data;let visible=false;frames++;
          for(let y=0;y<208;y++)for(let x=0;x<192;x++)if(data[(y*192+x)*4+3]>16) {
            visible=true;left=Math.min(left,x);right=Math.max(right,x+1);top=Math.min(top,y);bottom=Math.max(bottom,y+1);
          }
          if(!visible)errors.push(id+': empty '+state+'/'+column);
          if(id==='cat_face' && clip.row===8 && [2,3].includes(column))errors.push('forbidden glasses');
          if(id==='puddle' && state==='walkRight' && clip.row!==1)errors.push('lost original right gait');
          if(id==='puddle' && state==='walkLeft' && clip.row!==2)errors.push('lost original left gait');
          if(id==='salary-cat' && [0,1,2,3,7].includes(clip.row)
              && !(state.startsWith('walk')&&[1,2].includes(clip.row)&&!clip.sourceCrop&&clip.frames.every(f=>f<7)))errors.push('forbidden salary pose');
        }
        const sourceW=192,sourceH=208;
        if(Math.abs(bottom/sourceH-clip.foot)>.0001)errors.push(id+': feet '+state);
        if(Math.abs((left+right)/(2*sourceW)-clip.center)>.0001)errors.push(id+': center '+state);
        if(profile.origin==='center' && Math.abs((top+bottom)/(2*sourceH)-clip.centerY)>.0001)errors.push(id+': centerY '+state);
        // Compare the deepest authored frame with the fixed foot (or portrait center), at two scales and squash values.
        let peakFrame=0,peak=0;
        for(let f=0;f<clip.frames.length;f++) {
          drawSource(d.asset,clip,clip.frames[f]);
          const data=c.getImageData(0,0,192,208).data;let b=0;
          for(let y=0;y<208;y++)for(let x=0;x<192;x++)if(data[(y*192+x)*4+3]>16)b=Math.max(b,y+1);
          if(b>peak){peak=b;peakFrame=f;}
        }
        const checks=clip.frames.map((_,f)=>[f,1,1]);
        checks.push([peakFrame,2,1],[peakFrame,1,1.4],[peakFrame,2,1.4]);
        for(const [frame,scale,squash] of checks) {
          const out=document.createElement('canvas');out.width=384;out.height=416;const oc=out.getContext('2d',{willReadFrequently:true});
          q.x=192/scale;q.y=200/scale-q.size;q.squish=squash;
          q.advanceAnimation(clip.frameMs);q.autonomy.remainingMs=q.autonomy.durationMs;
          oc.scale(scale,scale);q.draw(oc);const data=oc.getImageData(0,0,384,416).data;
          let drawnBottom=0;for(let y=0;y<416;y++)for(let x=0;x<384;x++)if(data[(y*384+x)*4+3]>16)drawnBottom=Math.max(drawnBottom,y+1);
          drawSource(d.asset,clip,clip.frames[q.frame]);
          const source=c.getImageData(0,0,192,208).data;let sourceBottom=0;
          for(let y=0;y<208;y++)for(let x=0;x<192;x++)if(source[(y*192+x)*4+3]>16)sourceBottom=Math.max(sourceBottom,y+1);
          const stretch=1+(squash-1)*profile.elasticity;
          const g=q.spriteGeometry();
          const expected=scale*(q.y+(profile.origin==='center'?0:q.size)+g.offsetY+g.bob+
            (sourceBottom/sourceH-g.anchorY)*q.size*2.5*g.scale/stretch);
          const tilt=(state==='look'?.035:0)+Math.abs(g.tilt);
          const tolerance=2+scale*q.size*2.5*g.scale*Math.sin(tilt)/2/stretch;
          if(Math.abs(drawnBottom-expected)>tolerance)errors.push(id+': rendered baseline '+state+'/'+frame+'/'+scale+'/'+squash+': '+drawnBottom+' vs '+expected);
        }
      }
    }
    // Every rendered Brown left frame must equal the mirrored intact right frame.
    const brown=petDefinitions.get('cat_brown'),p=new Pet(96,0,brown);
    p.size=192/2.5;p.y=100-p.size; // integer horizontal destination removes GPU subpixel sampling variance
    for(let f=0;f<8;f++) {
      p.vx=2;p.facingRight=true;p.advanceAnimation(f*5*physicsFrameMs);
      c.clearRect(0,0,192,208);p.draw(c);const right=c.getImageData(0,0,192,208).data;
      p.vx=-2;p.facingRight=false;p.advanceAnimation(f*5*physicsFrameMs);
      c.clearRect(0,0,192,208);p.draw(c);const left=c.getImageData(0,0,192,208).data;
      let bad=0;for(let y=0;y<208;y++)for(let x=0;x<192;x++) {
        const li=(y*192+x)*4,ri=(y*192+191-x)*4;
        if(Math.abs(left[li+3]-right[ri+3])>1)bad++;
        for(let k=0;k<3;k++)if(Math.abs(left[li+k]*left[li+3]/255-right[ri+k]*right[ri+3]/255)>2)bad++;
      }
      if(bad)errors.push('Brown mirror frame '+f+': '+bad);
    }
    const ids=['cat_brown','cat_face','cat_sleepy','salary-cat','doge','puddle','usagi','kirby','kirby_sleepy'];
    const preview=document.createElement('canvas');preview.width=1400;preview.height=ids.length*180;
    const pc=preview.getContext('2d');
    const pets=ids.map((id,i)=>[...states,'transition'].map((state,j)=>{
      const d=petDefinitions.get(id),q=new Pet(70+j*140,i*180+140-d.defaultSize,d);pose(q,state==='transition'?'idle':state);return q;
    }));
    const movie=[];
    const transition=['idle','walkRight','walkLeft','jump','fall','idle','rest','drag'];
    const samples=${process.argv.includes('--sprite-preview') ? 32 : 1};
    for(let t=0;t<samples;t++) {
      pc.fillStyle='#edf2f6';pc.fillRect(0,0,preview.width,preview.height);
      for(let i=0;i<ids.length;i++)for(let j=0;j<pets[i].length;j++) {
        const q=pets[i][j];if(j===states.length && t%4===0)pose(q,transition[Math.floor(t/4)%8]);
        if(j===states.length) {
          const phase=Math.floor(t/4)%8,progress=(t%4)/3,baseY=i*180+140-q.size;
          q.x=70+j*140-12+(phase===1?24*progress:phase===2?24*(1-progress):0);
          q.y=baseY-(phase===3?24*progress:phase===4?24*(1-progress):0);
          q.squish=phase===5?1+.2*Math.pow(.85,(t%4)*6):1;
        }
        q.autonomy.remainingMs=4000-t*100;q.advanceAnimation(t?100:0);q.draw(pc);
        pc.strokeStyle='#a9b7c5';pc.beginPath();pc.moveTo(q.x-55,i*180+140);pc.lineTo(q.x+55,i*180+140);pc.stroke();
        pc.fillStyle='#263f53';pc.font='11px sans-serif';pc.fillText(ids[i],j*140+5,i*180+162);
        pc.fillText(j===states.length?'transition: '+q.animationState:states[j],j*140+5,i*180+176);
      }
      if(samples>1)movie.push(preview.toDataURL('image/png'));
    }
    return {errors,clips,frames,preview:preview.toDataURL('image/png').split(',')[1],movie};
  })()`);
  assert.deepEqual(expressionAudit.errors,[]);assert.equal(expressionAudit.clips,81);assert.ok(expressionAudit.frames>350);
  console.log('PASS: 9 profiles / '+expressionAudit.clips+' runtime states / '+expressionAudit.frames+' frames, anchors, native 1x/2x baselines, forbidden poses and Brown mirror');
  const platformAudit=await overlay.eval(`(() => {
    const ids=Object.keys(PlaygroundPetProfiles.profiles),errors=[],samples=[];
    const phases=['idle','walkRight','walkLeft','jumpRise','jumpApex','fall','land',
      'rest','sleep','grabStart','held','release','thrown','bounce','hit','knockout','look'];
    const sheet=document.createElement('canvas');sheet.width=phases.length*140;sheet.height=ids.length*180;
    const sc=sheet.getContext('2d');sc.fillStyle='#edf2f6';sc.fillRect(0,0,sheet.width,sheet.height);
    const movie=document.createElement('canvas');movie.width=280;movie.height=ids.length*160;
    const mc=movie.getContext('2d'),frames=[];
    const pets=ids.map(id=>new Pet(0,0,petDefinitions.get(id)));
    for(let phase=0;phase<phases.length;phase++) {
      const name=phases[phase];
      for(let i=0;i<ids.length;i++) {
        const q=pets[i];q.isDragging=false;q.blackHoleOrbit=null;q.externalMotion=null;q.motionCause=null;
        q.climbing=null;q.animationReaction=null;q.vx=0;q.vy=0;q.squish=1;
        q.isAutonomouslyStill=true;q.autonomy={state:'idle',remainingMs:4000,durationMs:4000};
        if(name.startsWith('walk')){q.isAutonomouslyStill=false;q.vx=name==='walkRight'?2:-2;q.facingRight=q.vx>0;}
        if(['jumpRise','jumpApex','fall'].includes(name)){q.motionCause='autonomous-jump';q.vy=name==='jumpRise'?-6:name==='fall'?6:0;}
        if(['rest','sleep','look'].includes(name))q.autonomy.state=name;
        if(['grabStart','held'].includes(name))q.isDragging=true;
        if(['thrown','bounce'].includes(name))q.externalMotion={source:'throw'};
        if(name==='knockout')q.setAnimationReaction('knockout');
        if(['land','grabStart','release','bounce','hit'].includes(name))q.queueAnimationEvent(name);
        q.advanceAnimation(0);
        const expected=name==='rest' && q.definition.animation.sleeping?'sleep':name;
        if(q.animationVisualState!==expected)errors.push(ids[i]+': expected '+expected+', got '+q.animationVisualState);
      }
      for(let t=0;t<3;t++) {
        mc.fillStyle='#edf2f6';mc.fillRect(0,0,movie.width,movie.height);
        for(let i=0;i<ids.length;i++) {
          const q=pets[i];if(t)q.advanceAnimation(80);
          const before=JSON.stringify([q.vx,q.vy,q.motionCause,q.externalMotion,q.size]);
          q.x=140;q.y=i*160+120-q.size;q.draw(mc);
          if(before!==JSON.stringify([q.vx,q.vy,q.motionCause,q.externalMotion,q.size]))errors.push(ids[i]+': render changed physics');
          const clip=q.spriteClip().clip,g=q.spriteGeometry();
          if(!Number.isFinite(g.anchorY)||!Number.isFinite(g.scale)||g.column<0||g.column>=8||clip.row>=q.definition.rows)errors.push(ids[i]+': invalid geometry');
          const image=mc.getImageData(70,i*160+5,140,140).data;
          if(!image.some((v,k)=>k%4===3 && v>0 && image[k-3]!==237))errors.push(ids[i]+': empty '+name);
          mc.strokeStyle='#a9b7c5';mc.beginPath();mc.moveTo(70,i*160+120);mc.lineTo(210,i*160+120);mc.stroke();
          mc.fillStyle='#263f53';mc.font='11px sans-serif';mc.fillText(ids[i]+' / '+q.animationVisualState,8,i*160+150);
          if(t===0){
            q.x=phase*140+70;q.y=i*180+140-q.size;q.draw(sc);
            sc.strokeStyle='#a9b7c5';sc.beginPath();sc.moveTo(phase*140+10,i*180+140);sc.lineTo(phase*140+130,i*180+140);sc.stroke();
            sc.fillStyle='#263f53';sc.font='11px sans-serif';sc.fillText(ids[i],phase*140+4,i*180+160);sc.fillText(name,phase*140+4,i*180+175);
          }
          samples.push({id:ids[i],input:name,tMs:t*80,state:q.animationVisualState,row:clip.row,column:g.column,scale:g.scale,anchor:g.anchorY});
        }
        if(${process.argv.includes('--animation-preview')})frames.push(movie.toDataURL('image/png'));
      }
    }
    return {errors,samples,preview:${process.argv.includes('--animation-preview')}?sheet.toDataURL('image/png'):null,frames};
  })()`);
  assert.deepEqual(platformAudit.errors,[]);
  assert.equal(platformAudit.samples.length,459);
  console.log('PASS: native animation platform: 9 pets x 17 event/state transitions x 3 samples');
  if(process.argv.includes('--animation-preview')) {
    const qaDir=path.join(project,'docs','v1.1','qa','animation-integration');fs.mkdirSync(qaDir,{recursive:true});
    fs.writeFileSync(path.join(os.tmpdir(),'desktopplayground-animation-qa-frames.json'),JSON.stringify(platformAudit.frames));
    fs.writeFileSync(path.join(qaDir,'runtime-states.png'),Buffer.from(platformAudit.preview.split(',')[1],'base64'));
    fs.writeFileSync(path.join(qaDir,'samples.json'),JSON.stringify(platformAudit.samples,null,2)+'\n');
    fs.writeFileSync(path.join(qaDir,'runtime-preview.html'),'<!doctype html><meta charset="utf-8"><title>Electron animation integration QA</title><p>Native Pet.draw, scripted visual inputs, 9 pets / 17 phases / 80ms samples. Physics and Windows mouse feel require separate QA.</p><button onclick="paused=!paused">Pause</button><img id="sprite"><script>const frames='+JSON.stringify(platformAudit.frames)+';let i=0,paused=false;sprite.src=frames[0];setInterval(()=>{if(!paused)sprite.src=frames[++i%frames.length]},80)</script>');
    console.log('Native animation QA: '+qaDir);
  }
  if(process.argv.includes('--sprite-preview')) {
    const previewPath=path.join(os.tmpdir(),'desktopplayground-sprite-quality.png');
    fs.writeFileSync(previewPath,Buffer.from(expressionAudit.preview,'base64'));console.log('Expression preview: '+previewPath);
    const moviePath=path.join(os.tmpdir(),'desktopplayground-sprite-quality-preview.html');
    fs.writeFileSync(moviePath,'<!doctype html><meta charset="utf-8"><title>Native Sprite QA</title><style>body{margin:12px;background:#edf2f6;font:14px sans-serif}img{transform-origin:top left}</style><p>Native Pet.draw capture — 9 pets × 9 poses + transitions; 3.2 seconds, 100ms samples. <button onclick="sprite.style.transform=\'scale(1)\'">1x</button> <button onclick="sprite.style.transform=\'scale(2)\'">2x</button> <button onclick="paused=!paused">Pause</button></p><img id="sprite"><script>const frames='+JSON.stringify(expressionAudit.movie)+';let frame=0,paused=false;const sprite=document.getElementById("sprite");sprite.src=frames[0];setInterval(()=>{if(!paused)sprite.src=frames[(++frame)%frames.length]},100)</script>');
    console.log('Animated native preview: '+moviePath);
    if(process.argv.includes('--qa-before') || process.argv.includes('--qa-after')) {
      const label=process.argv.includes('--qa-before')?'before':'after';
      const qaDir=path.join(project,'docs','v1.1','qa','sprite-final');fs.mkdirSync(qaDir,{recursive:true});
      fs.writeFileSync(path.join(os.tmpdir(),'desktopplayground-sprite-qa-frames.json'),JSON.stringify(expressionAudit.movie));
      const profiles=await overlay.eval('Object.fromEntries(Object.entries(spriteProfiles).filter(([id,p])=>p.clips))');
      const crypto=require('node:crypto');
      const manifest={label,samples:32,frameMs:100,rendererSha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(project,'renderer.js'))).digest('hex'),profiles};
      fs.writeFileSync(path.join(qaDir,label+'-profiles.json'),JSON.stringify(manifest,null,2)+'\n');
      console.log('QA capture frames ready: '+label);
    }
  }
  assert.ok(await overlay.eval(`(() => {
    clearPlayground('effects');ctx.clearRect(0,0,width,height);
    addRing(60,60,'#ff0000',15,20);rings[0].remainingMs=10*physicsFrameMs;
    addImpact(60,60,'#ff0000',20);addParticles(60,60,'#ff0000',5);
    auxiliaryEffectsEnabled=false;drawEffects();
    const hidden=ctx.getImageData(20,20,80,80).data.every((v,i)=>i%4!==3 || v===0);
    const aging=Math.abs(rings[0].remainingMs-9*physicsFrameMs)<1e-7
      && Math.abs(impacts[0].remainingMs-19*physicsFrameMs)<1e-7 && particles.every(p=>p.remainingMs<32*physicsFrameMs);
    auxiliaryEffectsEnabled=true;drawEffects();
    const visible=ctx.getImageData(20,20,80,80).data.some((v,i)=>i%4===3 && v>0);
    clearPlayground('effects');return hidden && aging && visible;
  })()`));
  assert.equal(await controls.eval("playground.getState().then(s=>s.auxiliaryEffectsEnabled)"),true);
  assert.ok(await overlay.eval(`(() => {
    clearPlayground('effects');ctx.clearRect(0,0,width,height);
    screenEffects.addCrack(300,300);
    auxiliaryEffectsEnabled=false;drawEffects(0);
    const hidden=ctx.getImageData(240,240,120,120).data.every((v,i)=>i%4!==3 || v===0);
    auxiliaryEffectsEnabled=true;drawEffects(0);
    const visible=ctx.getImageData(240,240,120,120).data.some((v,i)=>i%4===3 && v>0);
    screenEffects.clear('crack');ctx.clearRect(0,0,width,height);drawEffects(0);
    const cleared=ctx.getImageData(240,240,120,120).data.every((v,i)=>i%4!==3 || v===0);
    return hidden && visible && cleared && ctx.globalAlpha===1;
  })()`));
  assert.equal(await controls.eval("playground.smokeAuxiliaryEffects(false)"),false);
  await until(()=>overlay.eval("auxiliaryEffectsEnabled===false"),'Tray effects broadcast');
  assert.equal(await controls.eval("playground.getState().then(s=>s.crackMode)"),'auto');
  assert.equal(await controls.eval("playground.smokeCrackMode('accumulate')"),'accumulate');
  await until(()=>overlay.eval("screenEffects.crackMode==='accumulate'"),'Tray crack mode broadcast');
  assert.ok(await overlay.eval(`(() => {
    clearPlayground('effects');screenEffects.addCrack(300,300);screenEffects.update(6000);
    world.drawnShapes.push({id:777});world.drawnColliders.push({id:777});
    return screenEffects.groups.crack.length===1 && world.drawnShapes.length===1;
  })()`));
  assert.equal(await controls.eval("playground.smokeClearCrack()"),true);
  await until(()=>overlay.eval("screenEffects.groups.crack.length===0"),'Tray crack-only clear');
  assert.equal(await overlay.eval("world.drawnShapes.length===1 && world.drawnColliders.length===1"),true);
  const persisted=JSON.parse(fs.readFileSync(settingsFile,'utf8'));
  assert.equal(persisted.auxiliaryEffectsEnabled,false);
  assert.equal(persisted.crackMode,'accumulate');
  assert.equal(persisted.defaultPets.cat_brown,false);
  assert.equal(persisted.schemaVersion,1);
  assert.deepEqual(persisted.customPets,[legacyCustom]);
  assert.deepEqual(fs.readFileSync(savedAsset),icon);
  assert.equal(await overlay.eval("performance.getEntriesByType('resource').filter(e=>/^https?:/.test(e.name)).length"),0);
  await controls.eval("document.getElementById('exit-button').click()");
  await until(() => child.exitCode !== null, 'Exit process');
  controls.close(); overlay.close();
  const restartPort=await port();
  child=spawn(path.join(project,'node_modules/electron/dist/electron.exe'),
    [appDir,'--remote-debugging-port='+restartPort,'--host-resolver-rules=MAP * ~NOTFOUND'],
    {cwd:appDir,env:{...process.env,SMOKE_APPDATA:appData},stdio:'ignore'});
  const restored=await connect(restartPort,'controls.html');
  const restoredOverlay=await connect(restartPort,'index.html');
  await until(()=>restoredOverlay.eval("definitionsLoaded && enabled"),'restart ready');
  assert.equal(await restored.eval("playground.getState().then(s=>s.auxiliaryEffectsEnabled)"),false);
  assert.equal(await restoredOverlay.eval("auxiliaryEffectsEnabled"),false);
  assert.equal(await restored.eval("playground.getState().then(s=>s.crackMode)"),'accumulate');
  assert.equal(await restoredOverlay.eval("screenEffects.crackMode"),'accumulate');
  assert.equal(await restored.eval("playground.smokeCrackMode('auto')"),'auto');
  await until(()=>restoredOverlay.eval("screenEffects.crackMode==='auto'"),'Tray auto-heal broadcast');
  assert.equal(await restoredOverlay.eval("screenEffects.addCrack(300,300);screenEffects.update(5000);screenEffects.groups.crack.length"),0);
  assert.equal(await restored.eval("playground.smokeAuxiliaryEffects(true)"),true);
  await until(()=>restoredOverlay.eval("auxiliaryEffectsEnabled===true"),'effects re-enable');
  assert.equal(JSON.parse(fs.readFileSync(settingsFile,'utf8')).auxiliaryEffectsEnabled,true);
  assert.deepEqual(JSON.parse(fs.readFileSync(settingsFile,'utf8')).customPets,[legacyCustom]);
  await restored.eval("document.getElementById('exit-button').click()");
  await until(()=>child.exitCode!==null,'restart exit');restored.close();restoredOverlay.close();
  console.log('PASS: legacy effects fallback, native Tray toggle/broadcast, atomic settings persistence and restart');
  console.log('PASS: 3 starters, current Pet variants, right-click PC, 3-button collapse, structure display/collision toggle, Draw collider, Grab/Throw/Trash, Hide/Show, HTTP 0, Exit');
}
run().catch(error => { console.error(error); process.exitCode=1; }).finally(async () => {
  if (child && child.exitCode === null) child.kill();
  await wait(150);
  fs.rmSync(scratch,{recursive:true,force:true});
});
