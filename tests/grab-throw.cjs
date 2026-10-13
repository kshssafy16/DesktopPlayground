const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Execute the production renderer and its real input listeners with a controlled
// clock/DOM. Native mouse delivery and visual feel still need Windows QA.
const listeners = new Map();
const drawingCalls = [];
const ctx = new Proxy({}, { get: (_target, key) => key === 'createRadialGradient'
  ? () => ({ addColorStop() {} }) : (...args) => drawingCalls.push([key, ...args]) });
function element(surface) {
  return { style: {}, classList: { add() {}, remove() {} }, getContext: () => ctx,
    appendChild() {}, remove() {}, addEventListener: (name, callback) => listeners.set(surface + ':' + name, callback) };
}
const canvas = element('canvas');
const pending = new Promise(() => {});
const sandbox = {
  __now: 0, console,
  Image: class { constructor() { this.complete = true; this.naturalWidth = 1536; this.naturalHeight = 2288; } },
  document: { getElementById: id => id === 'playground-canvas' ? canvas : element('body'),
    createElement: () => element('created'), body: element('body') },
  performance: { now: () => sandbox.__now },
  window: { innerWidth: 1600, innerHeight: 900,
    addEventListener: (name, callback) => listeners.set('window:' + name, callback),
    playground: { onState() {}, onClear() {}, onPetDefinitions() {}, setMode() {},
      getState: () => pending, getPetDefinitions: () => pending } },
  setTimeout() {}, requestAnimationFrame: () => 1, cancelAnimationFrame() {}
};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'screen-effects.js'), 'utf8'), sandbox);
vm.runInContext(fs.readFileSync(process.env.PHYSICS_SOURCE || path.join(__dirname, '..', 'renderer.js'), 'utf8'), sandbox);
const evaluate = source => vm.runInContext(source, sandbox);
function event(type, x, y, time, button = 0) {
  sandbox.__now = time;
  listeners.get(type)({ clientX: x, clientY: y, timeStamp: time, button, preventDefault() {} });
}
function tick(count = 1, dt = 1) {
  for (let i = 0; i < count; i++) {
    sandbox.__now += dt * 1000 / 60;
    evaluate(`p.update(${dt})`);
  }
}
function near(value, expected, message) { assert.ok(Math.abs(value - expected) < 1e-8, message || `${value} != ${expected}`); }
let passed = 0;
function test(name, body) {
  sandbox.__now = 0;
  evaluate(`clearPlayground('all'); width=1600;height=900;structuresEnabled=false; enabled=true; currentMode='touch'; Math.random=()=>.5;`);
  drawingCalls.length = 0;
  body(); passed++;
  console.log('PASS:', name);
}
function pet(id = 'blob', x = 500, y = 400) {
  evaluate(`globalThis.p=spawnPet('${id}',${x},${y}); p.vx=0; p.vy=0;`);
}
function throwRight(y = 400) {
  pet('blob', 500, y);
  event('canvas:mousedown', 500, y, 0);
  event('canvas:mousemove', 550, y, 50);
  event('window:mouseup', 600, y, 100);
}

// Reproducible before/after trajectories: no boundaries, other Pets or AI randomness.
// Supply PHYSICS_SOURCE only in --measure mode to measure a saved renderer snapshot.
if (require.main === module && process.argv.includes('--measure')) {
  const metrics = [];
  for (const hz of [30, 60, 144]) for (const speed of [.3, 1.2, 3.6]) {
    evaluate(`clearPlayground('all');width=100000;height=100000;enabled=true;currentMode='touch';Math.random=()=>.5;`);
    pet('blob', 20000, 20000);
    event('canvas:mousedown', 20000, 20000, 0);
    event('canvas:mousemove', 20000 + 50 * speed, 20000, 50);
    event('window:mouseup', 20000 + 100 * speed, 20000, 100);
    const initial = evaluate('p.vx'), start = evaluate('p.x');
    tick(hz / 2, 60 / hz);
    const distance = evaluate('p.x') - start;
    evaluate(`clearPlayground('pets')`); pet('blob', 20000, 20000);
    event('canvas:mousedown', 20000, 20000, 0);
    event('canvas:mousemove', 20000, 20000 - 50 * speed, 50);
    event('window:mouseup', 20000, 20000 - 100 * speed, 100);
    const releaseY = evaluate('p.y'); let top = releaseY;
    for (let i = 0; i < hz * 8; i++) {
      tick(1, 60 / hz); top = Math.min(top, evaluate('p.y'));
      if (evaluate('p.vy >= 0')) break;
    }
    metrics.push({ hz, mousePxMs: speed, initial: +initial.toFixed(3), distance500ms: +distance.toFixed(2), rise: +(releaseY - top).toFixed(2) });
  }
  console.log(JSON.stringify(metrics, null, 2));
  process.exit(0);
}

test('edge grab preserves both offsets and mouseup final position', () => {
  pet(); event('canvas:mousedown', 540, 420, 0);
  near(evaluate('p.x'), 500); near(evaluate('p.y'), 400);
  event('canvas:mousemove', 570, 450, 50);
  near(evaluate('p.x'), 530); near(evaluate('p.y'), 430);
  event('window:mouseup', 580, 460, 100);
  near(evaluate('p.x'), 540); near(evaluate('p.y'), 440);
  assert.equal(evaluate('p.isDragging'), false);
});
test('drag keeps the existing sprite drag clip and squish', () => {
  pet('cat'); event('canvas:mousedown', 520, 410, 0);
  evaluate('p.draw(ctx)');
  const draw = drawingCalls.find(call => call[0] === 'drawImage');
  assert.equal(draw[3], 5 * 208);
  near(evaluate('p.squish'), 1.4);
});
test('timestamp conversion and ground throw retain horizontal momentum', () => {
  throwRight(865);
  near(evaluate('p.vx'), 19.25925925925926);
  evaluate('p.exploreX=100; p.targetLadderId=123;'); // AI would steer against the throw.
  const x = evaluate('p.x'); tick();
  near(evaluate('p.vx'), 19.25925925925926 * .94);
  assert.ok(evaluate('p.x') > x + 15);
});
test('sample frequency does not change a constant-speed throw', () => {
  const velocities = [];
  for (const interval of [10, 25, 50]) {
    evaluate(`clearPlayground('pets')`); pet();
    event('canvas:mousedown', 500, 400, 0);
    for (let t = interval; t <= 100; t += interval) event('canvas:mousemove', 500 + t * .6, 400, t);
    event('window:mouseup', 560, 400, 100);
    velocities.push(evaluate('p.vx'));
  }
  velocities.forEach(value => near(value, 10.583333333333334));
});
test('only the recent window determines velocity after a change of direction', () => {
  pet(); event('canvas:mousedown', 500, 400, 0);
  event('canvas:mousemove', 700, 400, 100);
  event('canvas:mousemove', 670, 400, 150);
  event('window:mouseup', 640, 400, 200);
  near(evaluate('p.vx'), -10.583333333333334);
});
test('waiting after fast movement clears stale velocity without a mousemove', () => {
  pet(); event('canvas:mousedown', 500, 400, 0);
  event('canvas:mousemove', 650, 400, 50);
  event('window:mouseup', 650, 400, 200);
  near(evaluate('p.vx'), 0); near(evaluate('p.vy'), 0);
  tick(); near(evaluate('p.vx'), 0);
});
test('diagonal spikes, duplicate timestamps and no movement remain finite/bounded', () => {
  pet(); event('canvas:mousedown', 500, 400, 10);
  event('window:mouseup', 1200, 700, 11);
  near(evaluate('Math.hypot(p.vx,p.vy)'), 54);
  assert.ok(evaluate('p.vx > 0 && p.vy > 0'));
  event('canvas:mousedown', 1200, 700, 20);
  event('window:mouseup', 1250, 700, 20);
  near(evaluate('p.vx'), 0); near(evaluate('p.vy'), 0);
});
test('airborne throw ignores autonomous air steering', () => {
  pet('magpie', 500, 300);
  evaluate('p.facingRight=false; p.beginThrow(12,-8); p.exploreX=0;');
  tick(12);
  near(evaluate('p.vx'), 12 * Math.pow(.996, 12));
  assert.ok(evaluate('p.y < 300 && p.vx > 0'));
});
test('landing decays the throw and resumes ordinary roaming', () => {
  throwRight(865); tick(150);
  assert.equal(evaluate('p.externalMotion'), null);
  assert.ok(evaluate('p.exploreX !== null && Math.abs(p.vx) <= 2.8'));
  const x = evaluate('p.x'); tick(5); assert.notEqual(evaluate('p.x'), x);
});
test('the protection deadline releases even a pet that never lands', () => {
  pet('blob', 500, -100000);
  evaluate('p.beginThrow(0,0)'); tick(481);
  assert.equal(evaluate('p.externalMotion'), null);
});
test('release protection duration uses elapsed physics time at 60/144 Hz', () => {
  for (const hz of [60, 144]) {
    evaluate(`clearPlayground('pets')`); pet('blob', 500, 865);
    evaluate('p.beginThrow(0,0)'); tick(Math.floor(hz * .18), 60 / hz);
    assert.ok(evaluate('p.externalMotion !== null'));
    tick(Math.ceil(hz * .06), 60 / hz);
    assert.equal(evaluate('p.externalMotion'), null);
  }
});
test('autonomous jumping pauses during throw and resumes afterwards', () => {
  pet('blob', 500, 865); evaluate('Math.random=()=>.001; p.beginThrow(0,0)');
  tick(); assert.ok(evaluate('p.vy > -1.5'));
  tick(14); assert.ok(evaluate('p.vy < -5'));
});
test('shared ladder navigation/climbing still works and grab interrupts it', () => {
  pet('blob', 500, 865);
  evaluate(`structuresEnabled=true;
    world.structures=[{id:1,type:'platform',x:420,y:755,width:160,height:12,lastUsedAt:0},
      {id:2,type:'ladder',x:487,y:767,width:26,height:133,platformId:1,lastUsedAt:0}];
    p.targetLadderId=2;p.navigationUntil=9000;`);
  tick(2); assert.equal(evaluate('p.climbing'), 2); assert.ok(evaluate('p.y < 865'));
  const y = evaluate('p.y'); event('canvas:mousedown', 510, y, 100);
  assert.equal(evaluate('p.climbing'), null);
  event('window:mouseup', 560, y, 150); tick();
  assert.ok(evaluate('p.vx > 10 && p.climbing === null'));
});
test('strong platform landing rebounds without an autonomous jump', () => {
  pet('blob', 500, 260);
  evaluate(`structuresEnabled=true;world.structures=[{id:1,type:'platform',x:400,y:300,width:200,height:12,lastUsedAt:0}];
    Math.random=()=>.001;p.beginThrow(0,8);`);
  tick(); near(evaluate('p.y'), 265); assert.ok(evaluate('p.vy < -4'));
  assert.equal(evaluate('p.supportId'), null);
});
test('ordinary route generation still creates shared platform/ladder geometry', () => {
  pet('cat', 500, 861); sandbox.__now = 100000;
  evaluate('structuresEnabled=true;globalThis.route=buildRoute(p);');
  assert.ok(evaluate('route && world.structures.length===2 && route.ladder.platformId===route.platform.id'));
});
test('capped throw still respects an existing Draw wall at maximum frame delta', () => {
  pet('blob', 550, 400);
  evaluate(`world.drawnColliders=[{x1:600,y1:200,x2:600,y2:800,thickness:7}];p.beginThrow(18,0)`);
  tick(1, 3);
  assert.ok(evaluate('p.x+p.size<=596.5 && p.vx<0'));
});
test('Touch + Trash removes only the held instance, preserving definition/structure', () => {
  pet(); evaluate(`globalThis.other=spawnPet('blob',200,400);world.structures=[{id:1,creatorPetId:p.instanceId}];`);
  event('canvas:mousedown', 520, 400, 0);
  event('canvas:mousemove', 1560, 840, 100);
  event('window:mouseup', 1560, 840, 110);
  assert.equal(evaluate('petInstances.length'), 1);
  assert.ok(evaluate(`petInstances[0]===other && petDefinitions.has('blob') && world.structures.length===1 && draggedPet===null`));
});
test('blur, mouseleave, right click, mode change and Hide cancel without a stale throw', () => {
  for (const cancel of ['blur', 'mouseleave', 'right', 'mode', 'hide']) {
    evaluate(`clearPlayground('pets');enabled=true;currentMode='touch';`); pet();
    event('canvas:mousedown', 500, 400, 0); event('canvas:mousemove', 550, 400, 20);
    if (cancel === 'right') event('canvas:mousedown', 550, 400, 25, 2);
    else if (cancel === 'mode') evaluate(`applyAppState({enabled:true,mode:'pc'})`);
    else if (cancel === 'hide') evaluate(`applyAppState({enabled:false,mode:'touch'})`);
    else listeners.get('window:' + cancel)();
    event('window:mouseup', 600, 400, 40);
    assert.ok(evaluate('draggedPet===null && !p.isDragging && p.externalMotion===null && dragSamples.length===0'));
    near(evaluate('p.vx'), 0);
  }
});
test('re-grab clears old throw state and does not reuse its samples', () => {
  throwRight(); tick(); const x = evaluate('p.x'), y = evaluate('p.y');
  event('canvas:mousedown', x, y, 150);
  assert.equal(evaluate('p.externalMotion'), null);
  event('window:mouseup', x, y, 300);
  near(evaluate('p.vx'), 0); near(evaluate('p.vy'), 0);
});
test('25 instances remain addable', () => {
  evaluate(`for(let i=0;i<25;i++)spawnPet('blob',500,400)`);
  assert.equal(evaluate('petInstances.length'), 25);
});
test('slow, normal and flick inputs produce distinct half-second travel and rise', () => {
  const distances = [], heights = [], speeds = [];
  for (const mouseSpeed of [.3, 1.2, 3.6]) {
    evaluate(`clearPlayground('pets')`); pet('blob', 200, 200);
    event('canvas:mousedown', 200, 200, 0);
    event('canvas:mousemove', 200 + mouseSpeed * 50, 200, 50);
    event('window:mouseup', 200 + mouseSpeed * 100, 200, 100);
    const x = evaluate('p.x'); speeds.push(evaluate('p.vx'));
    // Wide, tall virtual world excludes screen bounces from flight measurements.
    evaluate('width=100000;height=100000;'); tick(30);
    distances.push(evaluate('p.x') - x);
    evaluate(`clearPlayground('pets')`); pet('blob', 20000, 20000);
    event('canvas:mousedown', 20000, 20000, 0);
    event('canvas:mousemove', 20000, 20000 - mouseSpeed * 50, 50);
    event('window:mouseup', 20000, 20000 - mouseSpeed * 100, 100);
    const y = evaluate('p.y'); let top = y;
    for (let i = 0; i < 480; i++) { tick(); top = Math.min(top, evaluate('p.y')); if (evaluate('p.vy>=0')) break; }
    heights.push(y-top);
  }
  near(speeds[0],5); assert.ok(speeds[1]>20 && speeds[2]>=50);
  assert.ok(distances[0]<160 && distances[1]>600 && distances[2]>1400);
  assert.ok(distances[2]>distances[1]*2 && distances[1]>distances[0]*4);
  assert.ok(heights[0]<100 && heights[1]>1000 && heights[2]>heights[1]*4);
});
test('a short final flick outweighs a preceding stationary hold; a pause cancels it', () => {
  pet(); event('canvas:mousedown',500,400,0);
  event('canvas:mousemove',500,400,80);
  event('canvas:mousemove',560,400,100);
  event('window:mouseup',560,400,100);
  assert.ok(evaluate('p.vx>20'));
  event('canvas:mousedown',560,400,150);
  event('canvas:mousemove',700,400,180);
  event('window:mouseup',700,400,240);
  near(evaluate('p.vx'),0);
});
test('stationary release falls lightly without horizontal drift or random jump', () => {
  pet(); event('canvas:mousedown',500,400,0); event('window:mouseup',500,400,300);
  tick(30); near(evaluate('p.x'),500);
  assert.ok(evaluate('p.y>490 && p.y<510 && p.vy>6 && p.externalMotion!==null'));
});
test('throw flight distance and height agree across 20/30/60/144 Hz and irregular dt', () => {
  const flights=[];
  for (const deltas of [[3],[2],[1],[60/144],[.4,1.6,3,.5]]) {
    evaluate(`clearPlayground('pets');width=100000;height=100000;`); pet('blob',20000,20000);
    evaluate('p.beginThrow(36,-20)'); let time=0,index=0,minY=20000, x500;
    while (time<180-1e-8) {
      let dt=Math.min(deltas[index++%deltas.length],180-time);
      if (time<30 && time+dt>30) dt=30-time;
      tick(1,dt); time+=dt; minY=Math.min(minY,evaluate('p.y'));
      if (Math.abs(time-30)<1e-8) x500=evaluate('p.x')-20000;
    }
    flights.push({distance:x500,rise:20000-minY});
  }
  for(const value of flights) {
    assert.ok(Math.abs(value.distance-flights[2].distance)/flights[2].distance<.005);
    assert.ok(Math.abs(value.rise-flights[2].rise)/flights[2].rise<.01);
  }
});
test('fast floor and screen side impacts rebound, and weak landing settles', () => {
  for(const [x,y,vx,vy,axis,sign] of [[500,830,0,54,'vy',-1],[1550,400,54,0,'vx',-1],[50,400,-54,0,'vx',1]]) {
    evaluate(`clearPlayground('pets')`);pet('blob',x,y);evaluate(`p.beginThrow(${vx},${vy})`);tick(2);
    assert.ok(evaluate(`p.${axis}`)*sign>10);
    assert.ok(evaluate('p.x>=p.size && p.x<=width-p.size && p.y<=height-p.size'));
  }
  evaluate(`clearPlayground('pets')`);pet('blob',500,864);evaluate('p.beginThrow(0,1)');tick(20);
  near(evaluate('p.y'),865);assert.ok(Math.abs(evaluate('p.vy'))<.6);
  assert.equal(evaluate('p.externalMotion'),null);
});
test('upward flick bounces at screen top instead of escaping', () => {
  pet('blob',500,60);evaluate('p.beginThrow(0,-54)');tick(2);
  assert.ok(evaluate('p.y>=p.size && p.vy>25'));
});
test('thin line/freehand/rectangle/ellipse walls rebound at high speed', () => {
  for(const shape of [
    {id:1,kind:'line',size:1,points:[{x:600,y:200},{x:600,y:600}]},
    {id:1,kind:'freehand',size:1,points:[{x:600,y:200},{x:600,y:400},{x:600,y:600}]},
    {id:1,kind:'rect',size:1,points:[{x:600,y:200},{x:800,y:600}]},
    {id:1,kind:'ellipse',size:1,points:[{x:600,y:200},{x:800,y:600}]}
  ]) {
    evaluate(`clearPlayground('pets');world.drawnColliders=shapeSegments(${JSON.stringify(shape)})`);
    pet('blob',500,400);evaluate('p.beginThrow(54,0)');tick(1,3);
    assert.ok(evaluate('p.x<565 && p.vx< -30'));
  }
});
test('closed Draw floor and ceiling block fast motion from inside', () => {
  for(const kind of ['rect','ellipse']) for(const direction of [-1,1]) {
    evaluate(`clearPlayground('pets');world.drawnColliders=shapeSegments({id:1,kind:'${kind}',size:1,points:[{x:500,y:200},{x:900,y:600}]})`);
    pet('blob',700,400);evaluate(`p.beginThrow(0,${direction*54})`);tick(5);
    assert.ok(evaluate('p.y>235 && p.y<565'));
    assert.ok(evaluate('p.vy')*direction< -20);
  }
});
test('open Draw floors and slopes bounce from above and permit rising through', () => {
  for(const points of [[{x:500,y:350},{x:900,y:350}],[{x:500,y:250},{x:900,y:450}]]) {
    evaluate(`clearPlayground('pets');world.drawnColliders=shapeSegments({id:1,kind:'freehand',size:1,points:${JSON.stringify(points)}})`);
    pet('blob',700,230);evaluate('p.beginThrow(0,54)');tick(4);
    assert.ok(evaluate('p.vy<0 && p.y<315'));
  }
  evaluate(`clearPlayground('pets');world.drawnColliders=shapeSegments({id:1,kind:'line',size:1,points:[{x:500,y:350},{x:900,y:350}]})`);
  pet('blob',700,400);evaluate('p.beginThrow(0,-30)');tick(4);
  assert.ok(evaluate('p.y<300 && p.vy<0'));
});
test('stroke endpoint sweep catches diagonal glancing impact', () => {
  evaluate(`world.drawnColliders=shapeSegments({id:1,kind:'line',size:1,points:[{x:600,y:400},{x:800,y:400}]})`);
  pet('blob',500,300);evaluate('p.beginThrow(38,38)');tick(3);
  assert.ok(evaluate('p.vx<0 || p.vy<0'));
});
test('weak Draw landing settles without micro bouncing and returns control', () => {
  evaluate(`world.drawnColliders=shapeSegments({id:1,kind:'line',size:1,points:[{x:300,y:500},{x:900,y:500}]})`);
  pet('blob',500,463);evaluate('p.beginThrow(0,1)');tick(60);
  assert.equal(evaluate('p.externalMotion'),null);
  assert.ok(evaluate('Math.abs(p.vy)<1 && Math.abs(p.y-464.5)<1'));
});
test('Platform remains one-way and ladder descent still completes', () => {
  evaluate(`structuresEnabled=true;world.structures=[{id:1,type:'platform',x:400,y:600,width:200,height:12,lastUsedAt:0},
    {id:2,type:'ladder',x:487,y:612,width:26,height:288,platformId:1,lastUsedAt:0}]`);
  pet('blob',500,650);evaluate('p.beginThrow(0,-25)');tick(5);
  assert.ok(evaluate('p.y+p.size<600 && p.vy<0'));
  evaluate('p.externalMotion=null;p.climbing=2;p.climbingDown=true;p.x=500;p.y=565');tick(120);
  assert.equal(evaluate('p.climbing'),null);assert.ok(evaluate('p.y>=860'));
});
test('ordinary air movement keeps its previous gravity and drag', () => {
  pet();evaluate('p.vx=8;p.vy=0');tick();
  near(evaluate('p.x'),508);near(evaluate('p.y'),400.5);near(evaluate('p.vx'),7.84);
});
test('wall/floor bounce trajectory stays close at different dt values', () => {
  const results=[];
  for(const dt of [3,2,1,60/144]) {
    evaluate(`clearPlayground('pets');world.drawnColliders=shapeSegments({id:1,kind:'rect',size:1,points:[{x:200,y:200},{x:1400,y:700}]})`);
    pet('blob',600,400);evaluate('p.beginThrow(40,25)');
    let elapsed=0;
    while(elapsed<60-1e-8){const step=Math.min(dt,60-elapsed);tick(1,step);elapsed+=step;}
    results.push(evaluate('({x:p.x,y:p.y,vx:p.vx,vy:p.vy})'));
  }
  for(const result of results) {
    assert.ok(Math.hypot(result.x-results[2].x,result.y-results[2].y)<12);
    assert.ok(Math.abs(result.vx-results[2].vx)<1 && Math.abs(result.vy-results[2].vy)<1);
  }
});
test('sprite drag resets frame immediately and drawing does not advance its clock', () => {
  pet('cat'); evaluate('p.vx=2; p.advanceAnimation(300)');
  assert.ok(evaluate('p.frame') > 0);
  event('canvas:mousedown',500,400,0);evaluate('p.draw(ctx)');
  assert.equal(evaluate('p.animationState'),'drag');near(evaluate('p.frame'),0);
  for(let i=0;i<100;i++)evaluate('p.draw(ctx)');
  near(evaluate('p.frame'),0);tick(7);near(evaluate('p.frame'),1);
});

test('throw sprite stays airborne at apex and when sliding, then returns to walk', () => {
  pet('cat');evaluate('p.beginThrow(30,0);p.draw(ctx)');
  assert.equal(evaluate('p.animationState'),'fall');
  evaluate('p.vy=0;p.vx=-40;p.facingRight=false;p.advanceAnimation(250)');
  assert.equal(evaluate('p.animationState'),'fall');near(evaluate('p.frame'),2);
  evaluate('p.externalMotion=null;p.draw(ctx)');
  assert.equal(evaluate('p.animationState'),'walkLeft');near(evaluate('p.frame'),0);
});

test('sprite animation and squash recovery agree at 30/60/144 Hz', () => {
  const results=[];
  for(const hz of [30,60,144]) {
    evaluate("clearPlayground('pets')");pet('cat');
    evaluate('p.blackHoleOrbit={};p.squish=1.4;');
    tick(hz,60/hz);results.push(evaluate('({frame:p.frame,ms:p.animationMs,shape:p.squish})'));
  }
  for(const result of results) {
    near(result.ms,1000);assert.equal(result.frame,5);near(result.shape,results[0].shape);
  }
});

test('missing or invalid sprite clips fall back safely to idle', () => {
  pet('cat');evaluate('p.definition={...p.definition,clips:{idle:sheetClips.idle,drag:{row:99,frames:8,speed:6}}};p.isDragging=true;p.draw(ctx)');
  assert.equal(evaluate('p.animationState'),'idle');
  evaluate('p.definition={...p.definition,clips:{}};p.draw(ctx)');
  assert.ok(drawingCalls.filter(call=>call[0]==='save').length===drawingCalls.filter(call=>call[0]==='restore').length);
});

test('sprite squash uses a foot pivot and authored left-facing rows without a double flip', () => {
  pet('cat');evaluate('p.vx=-2;p.facingRight=false;p.squish=1.4;p.draw(ctx)');
  assert.ok(drawingCalls.some(call=>call[0]==='translate' && call[1]===0 && call[2]===40));
  const scale=drawingCalls.find(call=>call[0]==='scale');near(scale[1],1.22);near(scale[2],1/1.22);
  const draw=drawingCalls.find(call=>call[0]==='drawImage');assert.equal(draw[3],2*208);
  near(draw[7],-100*.9375);
});

test('sprite profiles preserve different padding and limit flat portraits deformation', () => {
  evaluate("applyPetDefinitions({defaultPets:{},localPets:[{id:'cat_face',name:'Face',rows:11,asset:'face.webp'},{id:'kirby_sleepy',name:'Sleepy',rows:9,asset:'sleepy.webp'}],customPets:[]})");
  pet('cat_face');evaluate('p.squish=1.4;p.draw(ctx)');
  const scale=drawingCalls.find(call=>call[0]==='scale');near(scale[1],1.1);
  drawingCalls.length=0;pet('kirby_sleepy');evaluate('p.draw(ctx)');
  const draw=drawingCalls.find(call=>call[0]==='drawImage');near(draw[6],-85*.3854);near(draw[7],-85*.9423);
});

test('strong and weak floor landings give distinct visual reactions without changing rebound', () => {
  const shapes=[];
  for(const speed of [2,30]) {
    evaluate("clearPlayground('pets')");pet('cat',500,860);
    evaluate(`p.beginThrow(0,${speed})`);tick();shapes.push(evaluate('p.squish'));
    if(speed===30)assert.ok(evaluate('p.vy < -19'));
  }
  assert.ok(shapes[0]<1.02 && shapes[1]>1.3);
  evaluate('p.blackHoleOrbit={}');tick(60);assert.ok(evaluate('Math.abs(p.squish-1)<.0001'));
});

test('platform and Draw landings produce squash for Sprite and Canvas', () => {
  for(const id of ['cat','blob']) for(const draw of [false,true]) {
    evaluate("clearPlayground('all');structuresEnabled=true");pet(id,500,400);
    evaluate(draw
      ? "world.drawnColliders=shapeSegments({id:1,kind:'line',size:2,points:[{x:100,y:470},{x:900,y:470}]})"
      : "world.structures=[{id:1,type:'platform',x:100,y:470,width:800,lastUsedAt:0}]");
    evaluate('p.beginThrow(0,40)');tick(2);
    assert.ok(evaluate('p.squish>1.2 && p.vy<0'));
  }
});

test('Canvas slime scales around its existing bottom instead of sinking on impact', () => {
  pet();evaluate('p.squish=1.4;p.draw(ctx)');
  assert.ok(drawingCalls.some(call=>call[0]==='translate' && Math.abs(call[2]-35*(1-1/1.4))<1e-8));
});
test('all five clip clocks keep their cadence at 60/144 Hz regardless of throw speed', () => {
  for(const state of ['idle','walkRight','walkLeft','fall','drag']) {
    const results=[];
    for(const hz of [60,144]) {
      evaluate("clearPlayground('pets')");pet('cat');
      evaluate(`p.blackHoleOrbit={};p.vx=${state==='walkRight'?2:state==='walkLeft'?-2:0};p.facingRight=${state!=='walkLeft'};p.isDragging=${state==='drag'};`);
      if(state==='fall')evaluate(`p.beginThrow(${hz===60?5:54},0)`);
      tick(hz,60/hz);results.push(evaluate('({state:p.animationState,frame:p.frame,ms:p.animationMs})'));
    }
    assert.equal(results[0].state,state);assert.equal(results[1].state,state);
    assert.equal(results[0].frame,results[1].frame);near(results[0].ms,results[1].ms);
  }
});
test('Canvas slime retains its surprised drag face during a throw and recovers', () => {
  pet();evaluate('p.beginThrow(20,0);p.draw(ctx)');
  const sweat=call=>call[0]==='arc' && call[1]===17.5 && Math.abs(call[2]+35/1.2)<1e-8;
  assert.ok(drawingCalls.some(sweat));drawingCalls.length=0;
  evaluate('p.externalMotion=null;p.draw(ctx)');assert.ok(!drawingCalls.some(sweat));
});
test('Grab rescues an orbiting Pet and release inside the old radius does not recapture', () => {
  pet();evaluate('p.beginThrow(20,0);addBlackHole(500,400);updateBlackHoles(1)');
  assert.ok(evaluate('p.blackHoleOrbit && !p.externalMotion'));
  const x=evaluate('p.x'),y=evaluate('p.y');event('canvas:mousedown',x,y,10);
  assert.equal(evaluate('p.blackHoleOrbit'),null);
  event('canvas:mousemove',x+30,y,50);evaluate('updateBlackHoles(1)');near(evaluate('p.x'),x+30);
  event('window:mouseup',x+30,y,200);evaluate('updateBlackHoles(1)');
  assert.equal(evaluate('p.blackHoleOrbit'),null);assert.ok(evaluate('p.externalMotion'));
  evaluate('p.x=900;p.y=400;updateBlackHoles(1)');assert.equal(evaluate('p.rescuedFromHoles.size'),0);
  evaluate('p.x=500;p.y=400;updateBlackHoles(1)');assert.ok(evaluate('p.blackHoleOrbit'));
});

test('expired/replaced/cleared Black Holes release references without resuming old Throw', () => {
  for(const action of ['expire','replace','clear']) {
    evaluate("clearPlayground('all')");pet();evaluate('p.beginThrow(30,0);addBlackHole(500,400);updateBlackHoles(1)');
    if(action==='expire')evaluate('blackHoles[0].life=.5;updateBlackHoles(1)');
    if(action==='replace')evaluate('addBlackHole(1100,100);addBlackHole(1300,100)');
    if(action==='clear')evaluate("clearPlayground('effects')");
    assert.equal(evaluate('p.blackHoleOrbit'),null);assert.equal(evaluate('p.externalMotion'),null);
    assert.ok(evaluate('Number.isFinite(p.x+p.y+p.vx+p.vy)'));tick();
    assert.ok(evaluate('p.vy!==0'));
  }
});

test('one orbit owner and consumption removes only its instance even with overlapping holes', () => {
  pet();evaluate('globalThis.other=spawnPet("blob",1200,700);addBlackHole(500,400);addBlackHole(510,400);updateBlackHoles(1)');
  assert.equal(evaluate('p.blackHoleOrbit.holeId'),evaluate('blackHoles[0].id'));
  evaluate('p.blackHoleOrbit.turns=3.5;updateBlackHoles(1)');
  assert.ok(evaluate('!petInstances.includes(p) && petInstances.includes(other) && petDefinitions.has("blob")'));
  assert.equal(evaluate('p.blackHoleOrbit'),null);assert.equal(evaluate('p.rescuedFromHoles.size'),0);
  const x=evaluate('p.x');evaluate('updateBlackHoles(1)');near(evaluate('p.x'),x);
  assert.equal(evaluate('blackHoles.length'),2);
});

test('Grab rescue exclusions are removed on hole clear and Trash clears the held reference', () => {
  pet();evaluate('addBlackHole(500,400);updateBlackHoles(1)');
  event('canvas:mousedown',evaluate('p.x'),evaluate('p.y'),0);
  assert.equal(evaluate('p.rescuedFromHoles.size'),1);evaluate("clearPlayground('effects')");
  assert.equal(evaluate('p.rescuedFromHoles.size'),0);
  const trash=evaluate('trashRect()');event('window:mouseup',trash.x+40,trash.y+40,100);
  assert.equal(evaluate('draggedPet'),null);assert.equal(evaluate('petInstances.length'),0);
});

test('expired hole cannot consume on its final frame and center capture stays finite', () => {
  pet();evaluate('addBlackHole(500,400);updateBlackHoles(1)');
  assert.ok(evaluate('Number.isFinite(p.x+p.y+p.vx+p.vy)'));
  evaluate('p.blackHoleOrbit.turns=3.5;blackHoles[0].life=.5;updateBlackHoles(1)');
  assert.ok(evaluate('petInstances.includes(p) && !p.blackHoleOrbit'));
});

test('single-point and zero-length drawings erase at their visible edge plus eraser radius', () => {
  for(const kind of ['freehand','line','rect','ellipse']) {
    evaluate(`clearPlayground('drawing');eraser=false;drawShape='${kind}';drawSize=30;beginDrawing(500,400);activeStroke=null;drawSize=1`);
    assert.equal(evaluate('strokes.length'),1);assert.equal(evaluate('world.drawnColliders.length'),0);
    evaluate('eraseDrawing(527.1,400)');assert.equal(evaluate('strokes.length'),1);
    evaluate('eraseDrawing(526.9,400)');assert.equal(evaluate('strokes.length'),0);
    assert.equal(evaluate('world.drawnShapes.length+world.drawnColliders.length'),0);
  }
});

test('freehand/line/rect/ellipse erasing preserves other shapes and rebuilds colliders', () => {
  for(const kind of ['freehand','line','rect','ellipse']) {
    evaluate(`clearPlayground('drawing');eraser=false;drawShape='${kind}';drawSize=7;beginDrawing(200,200);extendDrawing(300,250);activeStroke=null;beginDrawing(800,200);extendDrawing(900,250);activeStroke=null`);
    const count=evaluate('world.drawnColliders.length');assert.ok(count>0);
    evaluate(`eraseDrawing(${kind==='ellipse'?250:200},200)`);
    assert.equal(evaluate('strokes.length'),1);assert.equal(evaluate('world.drawnColliders.length'),count/2);
    assert.ok(evaluate('world.drawnColliders.every(s=>s.shapeId===strokes[0].id)'));
    evaluate("clearPlayground('drawing')");assert.equal(evaluate('world.drawnShapes.length+world.drawnColliders.length'),0);
  }
});

test('structure cleanup removes obsolete history but preserves active shared routes', () => {
  pet();evaluate(`structuresEnabled=true;world.structures=[
    {id:1,type:'platform',lastUsedAt:0},{id:2,type:'ladder',platformId:1,lastUsedAt:0},
    {id:3,type:'platform',lastUsedAt:0}];p.climbing=2;p.climbingDown=true;
    p.recentStructures=new Map([[2,0],[3,0],[999,0]]);p.targetHistory=[999,2,3];p.lastStructureId=999;
    cleanupStructures(100000)`);
  assert.equal(evaluate('world.structures.length'),2);
  assert.equal(evaluate('p.climbing'),2);assert.equal(evaluate('p.climbingDown'),true);
  assert.equal(evaluate('p.recentStructures.size'),1);assert.ok(evaluate('p.recentStructures.has(2)'));
  assert.equal(evaluate('p.targetHistory.join(",")'),'2');assert.equal(evaluate('p.lastStructureId'),null);
  evaluate("clearPlayground('structures')");
  assert.ok(evaluate('p.recentStructures.size===0 && p.targetHistory.length===0 && !p.climbing && !p.climbingDown'));
});

test('deleted target/support references clear while OFF retains valid structures', () => {
  pet();evaluate(`structuresEnabled=false;world.structures=[{id:1,type:'platform',lastUsedAt:0}];
    p.supportId=99;p.targetLadderId=100;p.climbing=101;p.climbingDown=true;p.exploreX=600;p.navigationUntil=9000;
    p.recentStructures=new Map([[1,100000],[99,0]]);p.targetHistory=[1,99];cleanupStructures(100000)`);
  assert.equal(evaluate('world.structures.length'),1);
  assert.ok(evaluate('p.supportId===null && p.targetLadderId===null && p.climbing===null && !p.climbingDown && p.navigationUntil===0 && p.exploreX===null'));
  assert.equal(evaluate('p.recentStructures.size'),1);assert.equal(evaluate('p.targetHistory.join(",")'),'1');
});

test('Throw collision landing and autonomous recovery remain finite through rapid Grab cycles', () => {
  pet('cat',500,700);evaluate('p.beginThrow(30,25)');tick(450);
  assert.equal(evaluate('p.externalMotion'),null);
  assert.ok(evaluate('Number.isFinite(p.x+p.y+p.vx+p.vy) && Math.abs(p.squish-1)<.01'));
  for(let i=0;i<10;i++) {
    event('canvas:mousedown',evaluate('p.x'),evaluate('p.y'),10000+i*200);
    assert.equal(evaluate('p.externalMotion'),null);
    event('window:mouseup',evaluate('p.x'),evaluate('p.y'),10150+i*200);tick();
    assert.ok(evaluate('Number.isFinite(p.x+p.y+p.vx+p.vy)'));
  }
});
console.log(`PASS: ${passed} Grab/Throw renderer regression cases (mock DOM/clock)`);

// Share the real renderer/input harness; importing also runs the complete legacy suite.
module.exports = { evaluate, pet, event, tick, test, sandbox, passed: () => passed };
