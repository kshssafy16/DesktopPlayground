const assert = require('node:assert/strict');
const { ScreenEffects, limits, frameMs } = require('../screen-effects.js');
let count = 0;
function check(name, body) { body(); count++; console.log('PASS:', name); }
function close(a, b) { assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`); }

check('all transient kinds expire at the same elapsed time at 30/60/144 Hz', () => {
  for (const hz of [30, 60, 144]) {
    const effects = new ScreenEffects();
    for (const kind of Object.keys(limits)) effects.add(kind, { x: 500, y: 500, vx: 0, vy: 0 }, 1000);
    for (let i = 0; i < hz / 2; i++) effects.update(1000 / hz);
    for (const group of Object.values(effects.groups)) close(group[0].remainingMs, 500);
    for (let i = 0; i < hz / 2; i++) effects.update(1000 / hz);
    for (const group of Object.values(effects.groups)) assert.equal(group.length, 0);
  }
});
check('particle trajectory matches original 60Hz and agrees at other FPS/irregular time', () => {
  const simulate = steps => {
    const effects = new ScreenEffects();
    const p = effects.add('particle', { x: 100, y: 100, vx: 2, vy: -3 }, 5000);
    steps.forEach(ms => effects.update(ms));
    return p;
  };
  const baseline = simulate(Array(30).fill(frameMs));
  close(baseline.x, 160); close(baseline.y, 100 - 90 + .09 * 30 * 29 / 2);
  for (const steps of [Array(15).fill(1000 / 30), Array(72).fill(1000 / 144), [2, 48, 150, 300]]) {
    const p = simulate(steps);
    close(p.x, baseline.x); close(p.y, baseline.y); close(p.vy, baseline.vy);
  }
});
check('burst stress bounds every group and evicts oldest effects', () => {
  const effects = new ScreenEffects();
  const references = { ...effects.groups };
  for (let i = 0; i < 10000; i++) for (const kind of Object.keys(limits)) {
    effects.add(kind, { x: i, y: 0, vx: 0, vy: 0 }, 5000);
  }
  for (const [kind, limit] of Object.entries(limits)) {
    assert.equal(effects.groups[kind], references[kind]);
    assert.equal(effects.groups[kind].length, limit);
    assert.equal(effects.groups[kind][0].x, 10000 - limit);
  }
  effects.update(6000);
  assert.ok(Object.values(effects.groups).every(group => !group.length));
});
check('cracks auto heal; accumulated cracks remain bounded; auto resumes healing', () => {
  const effects = new ScreenEffects();
  effects.addCrack(10, 10); effects.update(4999);
  assert.equal(effects.groups.crack.length, 1);
  effects.update(1); assert.equal(effects.groups.crack.length, 0);
  effects.setCrackMode('accumulate');
  for (let i = 0; i < 1000; i++) effects.addCrack(i, 10, 10000);
  effects.update(3600000); assert.equal(effects.groups.crack.length, 64);
  assert.equal(effects.groups.crack[0].paths.length, 6);
  assert.ok(effects.groups.crack[0].paths.every(path => path.length === 4 && path.every(p => Math.hypot(p.x, p.y) <= 200 + 1e-7)));
  assert.equal(effects.setCrackMode('invalid'), false);
  assert.equal(effects.crackMode, 'accumulate');
  effects.setCrackMode('auto'); effects.update(4999);
  assert.equal(effects.groups.crack.length, 64);
  effects.update(1); assert.equal(effects.groups.crack.length, 0);
});
check('clear crack is independent; clear all preserves bucket identity and is idempotent', () => {
  const effects = new ScreenEffects();
  const groups = { ...effects.groups };
  effects.addCrack(1, 1); effects.add('ring', { x: 1, y: 1 }, 1000);
  effects.clear('crack'); assert.equal(groups.crack.length, 0); assert.equal(groups.ring.length, 1);
  effects.clear(); effects.clear();
  for (const kind of Object.keys(groups)) assert.equal(effects.groups[kind], groups[kind]);
  assert.ok(Object.values(groups).every(group => group.length === 0));
});
check('bad input/time is ignored and escaped debris is removed', () => {
  const effects = new ScreenEffects();
  assert.equal(effects.add('unknown', { x: 0, y: 0 }, 1000), null);
  assert.equal(effects.add('constructor', { x: 0, y: 0 }, 1000), null);
  effects.clear('constructor');
  assert.equal(effects.add('ring', { x: NaN, y: 0 }, 1000), null);
  assert.equal(effects.add('ring', { x: 0, y: 0 }, Infinity), null);
  assert.equal(effects.add('particle', { x: 0, y: 0, vx: Infinity, vy: 0 }, 1000), null);
  assert.equal(effects.addCrack(0, 0, Infinity), null);
  const ring = effects.add('ring', { x: 0, y: 0 }, 1000);
  for (const dt of [NaN, Infinity, -1]) effects.update(dt);
  assert.equal(ring.remainingMs, 1000);
  effects.add('particle', { x: 99, y: 99, vx: 100, vy: 0 }, 1000);
  effects.update(frameMs, { width: 100, height: 100 });
  assert.equal(effects.groups.particle.length, 0);
});

// Execute actual renderer adapters, isolated from Pet animation implementation.
const { evaluate, pet, test, sandbox } = require('./grab-throw.cjs');
test('Bomb effects use bounded millisecond objects while Bomb/Throw/jump causes stay separate', () => {
  pet(); evaluate('fireBomb(450,400)');
  assert.equal(evaluate('p.externalMotion.source'), 'bomb');
  assert.equal(evaluate('p.motionCause'), 'bomb');
  assert.equal(evaluate('holes[0].remainingMs'), 5000);
  const vx = evaluate('p.vx');
  evaluate('screenEffects.addCrack(20,20);screenEffects.update(9000)');
  assert.equal(evaluate('p.vx'), vx);
  assert.equal(evaluate('p.motionCause'), 'bomb');
  evaluate('p.beginThrow(40,-20);screenEffects.clear()');
  assert.equal(evaluate('p.motionCause'), 'throw');
  assert.equal(evaluate('p.vx'), 40);
  evaluate('p.externalMotion=null;p.motionCause=null;p.beginAutonomousJump(-8);drawEffects(100)');
  assert.equal(evaluate('p.motionCause'), 'autonomous-jump');
  assert.equal(evaluate('p.vy'), -8);
});
test('hidden effects age, expire and do not change Pet or Draw geometry', () => {
  pet();
  evaluate(`auxiliaryEffectsEnabled=false;
    world.drawnShapes.push({id:123});world.drawnColliders.push({id:123});
    screenEffects.addCrack(50,50);addRing(50,50,'red',20,20);drawEffects(6000);`);
  assert.ok(evaluate('screenEffects.groups.crack.length===0 && rings.length===0 && petInstances.length===1 && world.drawnShapes.length===1 && world.drawnColliders.length===1'));
  evaluate('auxiliaryEffectsEnabled=true');
});
test('crack-only reset preserves Draw/colliders, Black Hole and Pet; global effects clear cleans orbit', () => {
  pet();
  evaluate(`world.drawnShapes.push({id:1});world.drawnColliders.push({id:1});
    addBlackHole(500,400);updateBlackHoles(1);screenEffects.addCrack(10,10);screenEffects.clear('crack');`);
  assert.ok(evaluate('blackHoles.length===1 && p.blackHoleOrbit && petInstances.length===1 && world.drawnColliders.length===1'));
  evaluate(`clearPlayground('effects')`);
  assert.ok(evaluate('blackHoles.length===0 && !p.blackHoleOrbit && petInstances.length===1 && world.drawnShapes.length===1 && world.drawnColliders.length===1'));
});
test('renderer burst generation and effects clear are bounded', () => {
  evaluate(`addParticles(50,50,'red',1e9);for(let i=0;i<100;i++){addRing(50,50,'red',20);addImpact(50,50,'red');fireBomb(50,50);}`);
  assert.ok(evaluate('particles.length<=160 && rings.length===24 && impacts.length===24 && holes.length===8'));
  evaluate(`clearPlayground('effects')`);
  assert.ok(evaluate('particles.length+rings.length+impacts.length+holes.length===0'));
});
test('requestAnimationFrame uses raw elapsed time for effects despite physics dt clamp', () => {
  const original = sandbox.requestAnimationFrame;
  let callback;
  sandbox.requestAnimationFrame = fn => { callback = fn; return 1; };
  try {
    evaluate(`stopAnimation();addRing(50,50,'red',20,30);startAnimation()`);
    callback(100); callback(1100);
    assert.equal(evaluate('rings.length'), 0);
  } finally {
    evaluate('stopAnimation()'); sandbox.requestAnimationFrame = original;
  }
});
console.log(`PASS: ${count} effect manager + 5 renderer cases (plus 55 Grab/Throw regressions)`);
