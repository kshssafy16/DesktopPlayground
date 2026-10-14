const assert = require('node:assert/strict');
require('./autonomy.cjs');
const { evaluate, pet, event, test, tick, passed } = require('./grab-throw.cjs');
const inherited = passed();
const ids = ['cat_brown','cat_face','cat_sleepy','salary-cat','doge','puddle','usagi','kirby','kirby_sleepy'];

test('all nine Sprite Pets reuse an authored Hit fallback without knockout or removal', () => {
  for (const id of ids) for (const source of ['bomb','hammer']) {
    evaluate("clearPlayground('all')"); pet(id,500,865);
    evaluate(`p.enterAutonomy('sleep');${source==='bomb'?'fireBomb(470,865)':'strikeHammer(500,865)'};p.advanceAnimation(0)`);
    assert.equal(evaluate('p.animationVisualState'),'hit',`${id}/${source}`);
    assert.equal(evaluate('p.externalMotion.source'),source);
    assert.equal(evaluate('p.autonomy.state'),'roam');
    assert.equal(evaluate('petInstances.length'),1);
    assert.ok(evaluate('screenEffects.groups.damage.length===1 && screenEffects.groups.damage[0].amount>0'));
    assert.ok(evaluate('p.spriteClip().clip.row>=0 && p.spriteClip().clip.frames.length>0'));
    evaluate('p.advanceAnimation(180)');
    assert.equal(evaluate('p.animationVisualState'),'thrown',`${id}/${source} recovers from Hit`);
  }
});

test('Sleep range is personality data from five minutes to one hour', () => {
  const cases = [
    ['cat_sleepy',1800000,3600000],['kirby_sleepy',1800000,3600000],
    ['cat_brown',1200000,2400000],['salary-cat',1200000,2400000],
    ['cat_face',600000,1500000],['puddle',600000,1500000],
    ['kirby',420000,1080000],['doge',300000,900000],['usagi',300000,600000]
  ];
  for (const [id,min,max] of cases) {
    evaluate("clearPlayground('all')");pet(id,500,865);evaluate("p.enterAutonomy('sleep')");
    const duration=evaluate('p.autonomy.durationMs');
    assert.ok(duration>=min && duration<=max,`${id}: ${duration}`);
  }
});

test('Rest can enter long Sleep; stable-time clocks agree at 30/60/144 Hz', () => {
  for (const hz of [30,60,144]) {
    evaluate("clearPlayground('all')");pet('cat_sleepy',500,865);
    evaluate("Math.random=()=>.1;p.enterAutonomy('rest');p.autonomy.remainingMs=1;p.updateAutonomy(2)");
    assert.equal(evaluate('p.autonomy.state'),'sleep');
    const before=evaluate('p.autonomy.remainingMs');
    for(let i=0;i<hz*5;i++) evaluate(`p.updateAutonomy(${1000/hz})`);
    assert.ok(Math.abs(evaluate('p.autonomy.remainingMs')-(before-5000))<1e-4);
    evaluate('p.updateAutonomy(300000)');
    assert.equal(evaluate('p.autonomy.state'),'sleep');
    evaluate('p.updateAutonomy(p.autonomy.remainingMs+1)');
    assert.equal(evaluate('p.autonomy.state'),'roam');
  }
});

test('Sleep uses raw RAF elapsed time even when physics dt is capped', () => {
  evaluate("clearPlayground('all')");pet('cat_sleepy',500,865);
  evaluate("p.y=height-p.size;p.enterAutonomy('sleep');p.vx=0;p.vy=0");
  const before=evaluate('p.autonomy.remainingMs');
  evaluate('p.update(3,5000)');
  assert.ok(Math.abs(evaluate('p.autonomy.remainingMs')-(before-5000))<1e-5);
  assert.equal(evaluate('p.autonomy.state'),'sleep');
});

test('Grab, Throw, Bomb, Hammer and Black Hole wake a sleeping Pet', () => {
  for(const source of ['grab','throw','bomb','hammer','blackhole']) {
    evaluate("clearPlayground('all')");pet('cat_sleepy',500,865);
    evaluate("p.enterAutonomy('sleep');p.isAutonomouslyStill=true;p.advanceAnimation(0)");
    assert.equal(evaluate('p.animationVisualState'),'sleep');
    if(source==='grab')event('canvas:mousedown',500,865,0);
    else evaluate(source==='throw'?'p.beginThrow(12,-8)':source==='bomb'?'fireBomb(460,865)':
      source==='hammer'?'strikeHammer(500,865)':'addBlackHole(500,865);updateBlackHoles(1)');
    assert.equal(evaluate('p.autonomy.state'),'roam',source);
    if(source==='grab')assert.equal(evaluate('p.isDragging'),true);
    if(source==='blackhole')assert.ok(evaluate('p.blackHoleOrbit'));
    else if(source!=='grab')assert.ok(evaluate('p.externalMotion'));
  }
});

test('Sleep does not start on a ladder and external Hit retains physics priority', () => {
  pet('doge',500,700);
  evaluate("structuresEnabled=true;world.structures=[{id:1,type:'platform',x:420,y:600,width:160,height:12,lastUsedAt:0},{id:2,type:'ladder',x:487,y:612,width:26,height:288,platformId:1,lastUsedAt:0}];p.climbing=2;p.enterAutonomy('rest');p.autonomy.remainingMs=1");
  tick(5);
  assert.notEqual(evaluate('p.autonomy.state'),'sleep');
  assert.equal(evaluate('p.climbing'),2);
  evaluate('p.beginAutonomousJump(-8);strikeHammer(p.x,p.y)');
  assert.equal(evaluate('p.motionCause'),'hammer');
  assert.equal(evaluate('p.externalMotion.source'),'hammer');
});

console.log(`PASS: ${passed()-inherited} Hit/Sleep cases plus ${inherited} inherited autonomy/Grab cases`);
