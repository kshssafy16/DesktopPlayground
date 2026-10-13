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
        if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
        return result.result.value;
      });
    },
    close() { socket.close(); }
  };
}
async function run() {
  fs.mkdirSync(appDir, { recursive: true });
  fs.mkdirSync(appData, { recursive: true });
  for (const file of [
    'main.js','local-pets.js','preload.js','index.html','renderer.js','styles.css',
    'controls.html','controls.js','controls.css','spritesheet.webp','spritesheet_2.webp','package.json'
  ]) fs.copyFileSync(path.join(project,file),path.join(appDir,file));
  fs.mkdirSync(path.join(appDir,'assets'),{recursive:true});
  fs.copyFileSync(path.join(project,'assets','icon.png'),path.join(appDir,'assets','icon.png'));
  fs.cpSync(path.join(project,'assets','pets'),path.join(appDir,'assets','pets'),{recursive:true});
  const mainPath = path.join(appDir,'main.js');
  fs.writeFileSync(mainPath, fs.readFileSync(mainPath,'utf8').replace(
    "const USER_DATA_PATH = path.join(app.getPath('appData'), 'desktop-playground');",
    "app.setPath('appData', process.env.SMOKE_APPDATA);\nconst USER_DATA_PATH = path.join(app.getPath('appData'), 'desktop-playground');"
  ));
  const debugPort = await port();
  child = spawn(path.join(project,'node_modules/electron/dist/electron.exe'),
    [appDir,'--remote-debugging-port=' + debugPort,'--host-resolver-rules=MAP * ~NOTFOUND'],
    { cwd: appDir, env: { ...process.env, SMOKE_APPDATA: appData }, stdio:'ignore' });
  const controls = await connect(debugPort,'controls.html');
  const overlay = await connect(debugPort,'index.html');
  await until(() => controls.eval("document.getElementById('pc-button')?.title"), 'toolbar ready');
  await until(() => overlay.eval("typeof buildRoute === 'function'"), 'overlay ready');
  assert.equal(await controls.eval("document.getElementById('pc-button')?.title"), 'PC 모드');
  assert.equal(await controls.eval("document.querySelectorAll('#control-bar button').length"), 10);
  assert.equal(await controls.eval("window.playground.getState().then(s=>s.structuresEnabled)"), false);
  assert.equal(await overlay.eval("structuresEnabled"), false);
  assert.equal(await overlay.eval("buildRoute({definition:{category:'cat'}},world.now())"), null);
  const local = await controls.eval("window.playground.getPetDefinitions().then(s=>s.localPets.map(p=>p.id))");
  assert.equal(local.length, 9);
  assert.equal(await overlay.eval("['basic','ghost','star','cloud','usagi'].every(id=>petDefinitions.has(id)) && !petDefinitions.has('Ripple') && !petDefinitions.has('Patchi')"), true);
  await until(() => overlay.eval("petInstances.length === 4"), 'four startup Pets');
  assert.deepEqual(await overlay.eval("petInstances.map(p=>p.definitionId)"), ['blob','cat_brown','doge','kirby']);
  assert.equal(await controls.eval("document.querySelectorAll('.pet-category').length"), 4);
  assert.deepEqual(await controls.eval("Array.from(document.querySelectorAll('.pet-category')).map(row=>[row.querySelector('.category-label').textContent,Array.from(row.querySelectorAll('[data-pet-id]')).map(p=>p.dataset.petId)])"), [
    ['기본',['blob','robot','ghost','star','cloud']],
    ['고양이',['cat_brown','cat_face','cat_sleepy','salary-cat']],
    ['강아지',['puddle','doge']],['캐릭터',['usagi','kirby','kirby_sleepy']]
  ]);
  assert.equal(await controls.eval("document.querySelectorAll('#blackhole-button svg path').length"),1);
  assert.equal(await controls.eval("document.querySelectorAll('.shape-button').length===4 && document.querySelectorAll('.color-swatch').length===6 && document.getElementById('draw-size-slider').max==='100'"),true);
  await controls.eval("globalThis.__petChoice=document.querySelector('.pet-choice');document.getElementById('pets-button').click()");
  assert.equal(await controls.eval("document.getElementById('panel-list').scrollHeight <= document.getElementById('panel-list').clientHeight"), true);
  await controls.eval("document.getElementById('pets-button').click();document.getElementById('pets-button').click()");
  assert.equal(await controls.eval("globalThis.__petChoice===document.querySelector('.pet-choice')"), true);
  await controls.eval("document.querySelector('[data-pet-id=cat_brown]').click()");
  await until(() => overlay.eval("selectedPetId === 'cat_brown' && currentMode === 'spawn'"), 'local variant selection');
  for (const [button, mode] of [['touch-button','touch'],['draw-button','draw'],
    ['bomb-button','bomb'],['blackhole-button','blackhole'],['pets-button','spawn']]) {
    if (mode === 'spawn') {
      await controls.eval("document.getElementById('pets-button').click();document.querySelector('[data-pet-id=blob]').click()");
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
  await controls.eval("document.getElementById('bomb-button').click();document.getElementById('collapse-button').click()");
  await until(() => overlay.eval("currentMode === 'pc'"), 'collapse PC mode');
  assert.equal(await controls.eval("document.body.classList.contains('collapsed') && document.querySelectorAll('#mini-controls button').length === 3"), true);
  await controls.eval("document.getElementById('mini-visibility-button').click()");
  await until(() => overlay.eval("enabled === false"), 'collapsed Hide');
  await controls.eval("document.getElementById('mini-visibility-button').click()");
  await until(() => overlay.eval("enabled === true"), 'collapsed Show');
  await controls.eval("document.getElementById('expand-button').click()");
  assert.equal(await controls.eval("!document.body.classList.contains('collapsed')"), true);
  assert.equal(await overlay.eval("currentMode === 'pc'"), true);
  await controls.eval("document.getElementById('visibility-button').click()");
  await until(() => overlay.eval("enabled === false"), 'Hide');
  await controls.eval("document.getElementById('visibility-button').click()");
  await until(() => overlay.eval("enabled === true && currentMode === 'pc'"), 'Show');
  await controls.eval("document.getElementById('structures-button').click()");
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
        if(Math.abs(bottom/208-profile.feet[ci])>.0001)errors.push(d.id+': foot '+state);
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
      for(const squash of [1,1.4]) {
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
  console.log('PASS: native Sprite audit: 11 sheets, 55 clips, 385 nonempty frames, fixed foot under squash');
  if(process.argv.includes('--sprite-preview')) {
    const previewPath=path.join(os.tmpdir(),'desktopplayground-phase1c-render.png');
    fs.writeFileSync(previewPath,Buffer.from(spriteAudit.preview,'base64'));console.log('Sprite preview: '+previewPath);
  }
  assert.equal(await overlay.eval("performance.getEntriesByType('resource').filter(e=>/^https?:/.test(e.name)).length"),0);
  await controls.eval("document.getElementById('exit-button').click()");
  await until(() => child.exitCode !== null, 'Exit process');
  controls.close(); overlay.close();
  console.log('PASS: 4 starters, current Pet variants, right-click PC, 3-button collapse, structure display/collision toggle, Draw collider, Grab/Throw/Trash, Hide/Show, HTTP 0, Exit');
}
run().catch(error => { console.error(error); process.exitCode=1; }).finally(async () => {
  if (child && child.exitCode === null) child.kill();
  await wait(150);
  fs.rmSync(scratch,{recursive:true,force:true});
});
