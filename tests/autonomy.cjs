const assert = require('node:assert/strict');
const { evaluate, pet, event, tick, test, sandbox, passed } = require('./grab-throw.cjs');
const previous = passed();
const ids = ['cat_brown','cat_face','cat_sleepy','salary-cat','doge','puddle','usagi','kirby','kirby_sleepy','blob'];
evaluate(`applyPetDefinitions({defaultPets:{},customPets:[],localPets:${JSON.stringify(ids.filter(id => id !== 'blob').map(id => ({id,name:id,category:id.startsWith('cat_')||id==='salary-cat'?'cat':['doge','puddle'].includes(id)?'dog':'character',rows:['cat_brown','cat_face','puddle'].includes(id)?11:9,asset:'fixture.webp'})))}})`);

test('profile mapping and category/common fallbacks are data driven', () => {
  const expected=['calm','normal','sleepy','calm','active','normal','veryActive','lively','sleepy','normal'];
  ids.forEach((id,i)=>{pet(id);assert.ok(evaluate(`p.activity===activityProfiles.${expected[i]}`));});
  pet('cat');assert.ok(evaluate('p.activity===activityProfiles.calm'));
  pet('robot');assert.ok(evaluate('p.activity===activityProfiles.normal'));
});

test('rest brakes gradually and preserves its route until roam resumes', () => {
  pet('cat_brown',500,861);
  evaluate("p.enterAutonomy('rest');p.autonomy.remainingMs=1000;p.vx=2;p.exploreX=900;p.navigationUntil=9000");
  tick(30);assert.ok(evaluate('p.autonomy.state==="rest" && Math.abs(p.vx)<.01 && p.exploreX===900'));
  tick(32);assert.ok(evaluate('p.autonomy.state==="roam" && p.vx>0'));
});

test('rest/idle/look durations and look direction agree at 30/60/144 Hz', () => {
  for(const state of ['rest','idle','look']) for(const hz of [30,60,144]) {
    evaluate("clearPlayground('pets')");pet('blob',500,865);
    evaluate(`p.enterAutonomy('${state}');p.autonomy.remainingMs=p.autonomy.durationMs=1000;p.facingRight=true`);
    tick(hz/2,60/hz);
    assert.ok(evaluate('Math.abs(p.autonomy.remainingMs-500)<1e-6'));
    if(state==='look')assert.equal(evaluate('p.facingRight'),false);
    tick(hz/2+1,60/hz);assert.equal(evaluate('p.autonomy.state'),'roam');
  }
});

test('airborne or strong ground velocity cannot be braked by rest', () => {
  pet('blob',500,400);evaluate("p.enterAutonomy('rest');p.vx=8;p.vy=-10");
  const remaining=evaluate('p.autonomy.remainingMs');tick();
  assert.equal(evaluate('p.autonomy.remainingMs'),remaining);
  assert.ok(Math.abs(evaluate('p.vx')-7.84)<1e-8);
  evaluate('p.y=865;p.vy=0;p.vx=12');tick();assert.ok(evaluate('p.vx>11'));
});

test('bomb interrupts rest and climbing without changing the impulse physics', () => {
  for(const climbing of [null,2]) {
    evaluate("clearPlayground('all')");pet('blob',500,865);
    evaluate(`p.enterAutonomy('rest');p.climbing=${climbing};p.climbingDown=true;fireBomb(460,865)`);
    const vx=evaluate('p.vx');assert.ok(vx>10);
    assert.ok(evaluate('p.autonomy.state==="roam" && p.climbing===null && p.autonomyHoldMs===700'));
    tick();assert.ok(evaluate('p.vx')>vx*.9);
  }
});

test('ladder ascent and descent cannot be paused midway by rest', () => {
  for(const down of [false,true]) {
    evaluate("clearPlayground('all');structuresEnabled=true;world.structures=[{id:1,type:'platform',x:420,y:600,width:160,height:12,lastUsedAt:0},{id:2,type:'ladder',x:487,y:612,width:26,height:288,platformId:1,lastUsedAt:0}]");
    pet('blob',500,700);evaluate(`p.climbing=2;p.climbingDown=${down};p.enterAutonomy('rest')`);
    const remaining=evaluate('p.autonomy.remainingMs');tick(5);
    assert.ok(down?evaluate('p.y>700'):evaluate('p.y<700'));
    assert.equal(evaluate('p.autonomy.remainingMs'),remaining);
    tick(120);assert.equal(evaluate('p.climbing'),null);
  }
});

test('Grab/Throw and orbit interrupt quiet behavior and stable landing restores autonomy', () => {
  pet('blob',500,865);evaluate("p.enterAutonomy('rest')");
  event('canvas:mousedown',500,865,0);tick(10);
  assert.ok(evaluate('p.autonomy.state==="roam" && p.isDragging'));
  event('window:mouseup',500,865,300);tick(160);
  assert.ok(evaluate('!p.externalMotion && p.exploreX!==null'));
  evaluate("p.enterAutonomy('rest');addBlackHole(p.x,p.y);updateBlackHoles(1)");
  const remaining=evaluate('p.autonomy.remainingMs');tick(10);
  assert.ok(evaluate('p.blackHoleOrbit && p.autonomy.state==="roam"'));
  assert.equal(evaluate('p.autonomy.remainingMs'),remaining);
});

test('hard landing reaction pauses quiet timers and preserves squash recovery', () => {
  pet('blob',500,860);evaluate("p.enterAutonomy('rest');p.vy=30");tick();
  assert.ok(evaluate('p.autonomyHoldMs>=300 && p.squish>1.2'));
  const remaining=evaluate('p.autonomy.remainingMs');tick(10);
  assert.equal(evaluate('p.autonomy.remainingMs'),remaining);
});

test('quiet Sprite uses the individually verified Brown look clip', () => {
  pet('cat_brown',500,861);evaluate("p.enterAutonomy('look');p.vx=.8;p.update(1);p.draw(ctx)");
  assert.equal(evaluate('p.animationState'),'look');
  assert.equal(evaluate('p.spriteClip().clip.row'),9);
});

test('25 pets retain independent behavior and shared route generation', () => {
  evaluate("structuresEnabled=true;Math.random=()=>.5");
  for(let i=0;i<25;i++)evaluate(`spawnPet('cat_brown',100+${i}*55,861)`);
  evaluate("petInstances.forEach((p,i)=>p.enterAutonomy(i%2?'rest':'roam'));petInstances.forEach(p=>p.update(1))");
  evaluate('for(let i=0;i<1200;i++){__now=i*1000/60;petInstances.forEach(p=>p.update(1))}');
  assert.ok(evaluate('petInstances.every(p=>Number.isFinite(p.x+p.y+p.vx+p.vy) && p.autonomy.remainingMs>0)'));
  assert.equal(evaluate('petInstances.length'),25);
  assert.ok(evaluate('petInstances.some(p=>p.autonomy.state==="rest") && petInstances.some(p=>p.autonomy.state==="roam")'));
  sandbox.__now=100000;evaluate('globalThis.route=buildRoute(petInstances[5])');
  assert.ok(evaluate('route && world.structures.length===2'));
});

test('automatic route generation runs in Roam and is suspended during rest', () => {
  pet('cat_brown',500,861);sandbox.__now=100000;
  evaluate("structuresEnabled=true;Math.random=()=>.001;p.enterAutonomy('rest');p.update(1)");
  assert.equal(evaluate('world.structures.length'),0);
  evaluate("p.enterAutonomy('roam');p.update(1)");assert.equal(evaluate('world.structures.length'),2);
});

// Full production movement, seeded random, isolated pet on 1600x900 floor;
// structure-free observation, not a claim about native mouse feel or CPU/FPS.
function measure(id,hz=60,seconds=180,seed=731) {
  return evaluate(`(() => {
    clearPlayground('all');structuresEnabled=false;width=1600;height=900;
    let seed=${seed};Math.random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296};
    const p=spawnPet('${id}',800,900-petDefinitions.get('${id}').defaultSize);p.vx=0;p.vy=0;
    const counts={roam:0,idle:0,rest:0,look:0};let moving=0,quiet=0,streak=0,maxStreak=0,transitions=0,last=p.autonomy.state;
    for(let i=0;i<${hz*seconds};i++) {
      __now=i*1000/${hz};p.update(60/${hz});
      counts[p.autonomy.state]++;
      if(p.autonomy.state!==last){transitions++;last=p.autonomy.state}
      if(Math.abs(p.vx)>.5){moving++;streak++;maxStreak=Math.max(maxStreak,streak)}else streak=0;
      if(Math.abs(p.vx)<.5 && Math.abs(p.vy)<1.5)quiet++;
    }
    const n=${hz*seconds};return {id:'${id}',hz:${hz},states:Object.fromEntries(Object.entries(counts).map(([k,v])=>[k,+(100*v/n).toFixed(2)])),
      movingPct:+(100*moving/n).toFixed(2),quietPct:+(100*quiet/n).toFixed(2),maxMovingSec:+(maxStreak/${hz}).toFixed(2),transitions};
  })()`);
}
test('three-minute calm/active observations differ and never walk continuously', () => {
  const observations=ids.map(id=>measure(id));
  for(const row of observations) {
    assert.ok(row.quietPct>5 && row.transitions>=4 && row.maxMovingSec<30,JSON.stringify(row));
  }
  const byId=Object.fromEntries(observations.map(row=>[row.id,row]));
  assert.ok(byId.doge.movingPct>byId.cat_brown.movingPct+20);
  assert.ok(byId.usagi.movingPct>byId.cat_sleepy.movingPct+30);
  if(process.argv.includes('--measure'))console.log(JSON.stringify(observations,null,2));
});
console.log(`PASS: ${passed()-previous} autonomy cases plus ${previous} existing renderer cases`);
