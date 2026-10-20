'use strict';
const assert = require('node:assert/strict');
const catalog = require('../animation/profiles.v1.json');
const { evaluate, pet, event, tick, test, sandbox, bundledLocalPets } = require('./grab-throw.cjs');
require('./autonomy.cjs'); // Registers the validated local packages in the renderer harness.
const ids = bundledLocalPets.map(({ id }) => id);
function state(expected) { assert.equal(evaluate('p.animationVisualState'), expected); }

test('every registered local package has a canonical runtime profile and real renderer definition', () => {
  assert.deepEqual([...ids].sort(), Object.keys(catalog.profiles).sort());
  assert.deepEqual(JSON.parse(evaluate('JSON.stringify(PlaygroundPetProfiles.profiles)')), catalog.profiles);
  assert.deepEqual(JSON.parse(evaluate('JSON.stringify(Object.fromEntries(Object.entries(spriteProfiles).filter(([id])=>PlaygroundPetProfiles.profiles[id])))')), catalog.profiles);
  for (const { id, rows, asset } of bundledLocalPets) {
    const definition = JSON.parse(evaluate(`JSON.stringify((({id,rows,renderKind,asset,animation})=>({id,rows,renderKind,assetSrc:asset.src,hasAnimation:!!animation}))(petDefinitions.get(${JSON.stringify(id)})))`));
    assert.deepEqual(definition, { id, rows, renderKind: 'sprite', assetSrc: asset, hasAnimation: true });
    assert.equal(catalog.profiles[id].rows, rows, id);
    assert.equal(evaluate(`petDefinitions.get(${JSON.stringify(id)}).asset.naturalHeight`), rows * catalog.sprite.cellHeight, id);
  }
});
test('all registered local pets play Grab/held/stationary release without physics changes', () => {
  for (const id of ids) {
    evaluate(`clearPlayground('all')`); pet(id);
    event('canvas:mousedown', 520, 400, 0); evaluate('p.draw(ctx)'); state('grabStart');
    const x=evaluate('p.x'); tick(1, 7.2); state('held');
    assert.equal(evaluate('p.frame'),0); assert.equal(evaluate('p.x'),x);
    evaluate('p.draw(ctx);p.draw(ctx)'); state('held');
    event('window:mouseup',520,400,200); evaluate('p.advanceAnimation(0)'); state('release');
    assert.equal(evaluate('p.vx'),0);
    evaluate('p.advanceAnimation(120)'); state('thrown');
  }
});
test('new animal packages walk in both directions using real 9-row image geometry', () => {
  for (const id of ['call_duck', 'baby_harp_seal']) {
    pet(id);
    for (const [speed, state] of [[2, 'walkRight'], [-2, 'walkLeft']]) {
      evaluate(`p.vx=${speed};p.facingRight=${speed > 0};p.advanceAnimation(0)`);
      assert.equal(evaluate('p.animationVisualState'), state, id);
      sandbox.drawingCalls.length = 0;
      evaluate('p.draw(ctx)');
      const draw = sandbox.drawingCalls.find(call => call[0] === 'drawImage');
      assert.ok(draw, `${id}/${state}: sprite drawn`);
      assert.equal(draw[4], catalog.sprite.cellWidth, `${id}/${state}: cell width`);
      assert.equal(draw[5], catalog.sprite.cellHeight, `${id}/${state}: cell height`);
      assert.equal(evaluate('p.spriteClip().clip.flip === true'), speed < 0, `${id}/${state}: mirror`);
    }
  }
});
test('a quick release interrupts GrabStart immediately and preserves fast Throw', () => {
  pet('doge'); event('canvas:mousedown',500,400,0); evaluate('p.draw(ctx)'); state('grabStart');
  event('canvas:mousemove',600,400,25); event('window:mouseup',700,400,50);
  evaluate('p.advanceAnimation(0)'); state('thrown');
  assert.ok(evaluate('p.vx>40 && p.externalMotion.source==="throw"'));
});
test('Grab overrides orbit/bounce and the rescued hole cannot restore an old animation', () => {
  pet('cat_brown'); evaluate('addBlackHole(500,400);updateBlackHoles(1);p.advanceAnimation(0)'); state('blackHoleOrbit');
  const x=evaluate('p.x'), y=evaluate('p.y');
  event('canvas:mousedown',x,y,0); evaluate('p.draw(ctx)'); state('grabStart');
  evaluate('updateBlackHoles(10);p.advanceAnimation(120)'); state('held');
  assert.equal(evaluate('p.blackHoleOrbit'),null);
});
test('autonomous rise/apex/fall follow velocity immediately and landing is a single short reaction', () => {
  for (const hz of [30,60,144]) {
    evaluate(`clearPlayground('all')`); pet('doge',500,865);
    evaluate('p.size=35;p.enterAutonomy("rest");p.autonomy.remainingMs=10000;p.beginAutonomousJump(-10)');
    let sawRise=false,sawFall=false,sawLand=false;
    for(let i=0;i<hz*3;i++) {
      tick(1,60/hz);
      const s=evaluate('p.animationVisualState');
      sawRise ||= s==='jumpRise'; sawFall ||= s==='fall'; sawLand ||= s==='land';
      if(sawLand) assert.ok(evaluate('p.vy>=0 && p.motionCause!=="autonomous-jump"'));
    }
    assert.ok(sawRise&&sawFall&&sawLand);
    assert.notEqual(evaluate('p.animationVisualState'),'land');
  }
});
test('strong Throw collision emits bounce, weak floor impact emits land, rest contact does not retrigger', () => {
  pet('doge',500,840);evaluate('p.size=35;p.beginThrow(0,30)');tick();state('bounce');
  pet('doge',500,864);evaluate('p.size=35;p.vy=2');tick();state('land');
  evaluate('p.advanceAnimation(130);p.enterAutonomy("rest");p.autonomy.remainingMs=10000');
  for(let i=0;i<30;i++)tick();
  assert.notEqual(evaluate('p.animationVisualState'),'land');
});
test('Bomb hit interrupts autonomous jump and expires to the current physical state', () => {
  pet('doge');evaluate('p.beginAutonomousJump(-9);p.advanceAnimation(0);fireBomb(450,400);p.advanceAnimation(0)');state('hit');
  assert.equal(evaluate('p.motionCause'),'bomb');
  evaluate('p.advanceAnimation(180)');state('thrown');
  tick(330);assert.equal(evaluate('p.externalMotion'),null);
  assert.notEqual(evaluate('p.animationVisualState'),'hit');
});
test('climb up/down supersede rest and recover to autonomous visual states', () => {
  pet('cat_sleepy');evaluate('p.isAutonomouslyStill=true;p.autonomy.state="rest";p.climbing=123;p.advanceAnimation(0)');state('climbUp');
  evaluate('p.climbingDown=true;p.advanceAnimation(0)');state('climbDown');
  evaluate('p.climbing=null;p.advanceAnimation(0)');state('sleep');
});
test('wake carries elapsed remainder, future knockout is visual-only and can be cleared', () => {
  pet('cat_sleepy');evaluate('p.isAutonomouslyStill=true;p.autonomy.state="rest";p.advanceAnimation(0)');state('sleep');
  evaluate('p.autonomy.state="idle";p.advanceAnimation(0)');state('wake');
  evaluate('p.advanceAnimation(200)');state('idle');assert.ok(Math.abs(evaluate('p.animationMs')-20)<1e-6);
  const before=evaluate('JSON.stringify([p.x,p.y,p.vx,p.vy,p.size,petInstances.length])');
  evaluate('p.setAnimationReaction("knockout");p.advanceAnimation(100)');state('knockout');
  assert.equal(evaluate('JSON.stringify([p.x,p.y,p.vx,p.vy,p.size,petInstances.length])'),before);
  evaluate('p.setAnimationReaction(null);p.advanceAnimation(0)');state('idle');
  assert.equal(evaluate('p.queueAnimationEvent("unknown")'),false);
  assert.equal(evaluate('p.setAnimationReaction("unknown")'),false);
});
test('draw is time-neutral; equal one-shot elapsed time has equal results at 30/60/144Hz', () => {
  const results=[];
  for(const hz of [30,60,144]) {
    pet('usagi');evaluate('p.isDragging=true;p.advanceAnimation(0)');
    for(let i=0;i<hz;i++)evaluate(`p.advanceAnimation(${1000/hz});p.draw(ctx);p.draw(ctx)`);
    results.push(JSON.parse(evaluate('JSON.stringify([p.animationVisualState,p.frame,p.animationMs])')));
  }
  results.forEach(result=>{assert.equal(result[0],'held');assert.equal(result[1],0);assert.ok(Math.abs(result[2]-880)<1e-6);});
});
test('RAF supplies uncapped visual milliseconds while screen effects and physics keep their own timing', () => {
  pet('doge');evaluate('p.isDragging=true');
  const original=sandbox.requestAnimationFrame;let callback;
  sandbox.requestAnimationFrame=fn=>{callback=fn;return 1;};
  try {
    evaluate('stopAnimation();addRing(50,50,"red",20,30);startAnimation()');callback(100);callback(1100);
    state('held');assert.ok(Math.abs(evaluate('p.animationMs')-(1000+1000/60-120))<1e-6);
    assert.equal(evaluate('rings.length'),0);
  } finally {evaluate('stopAnimation()');sandbox.requestAnimationFrame=original;}
});
test('instance removal clears visual references without deleting profile or other pets', () => {
  pet('doge');evaluate('p.advanceAnimation(0);spawnPet("doge",700,400);p.remove();petInstances=petInstances.filter(q=>q!==p)');
  assert.ok(evaluate('!p.animationPlayer && !p.animationEvent && petInstances.length===1 && spriteProfiles.doge.clips'));
});
test('all registered local pets replay Held loops across 30/60/144Hz without moving physics',()=>{
  for(const id of ids)for(const hz of [30,60,144]) {
    pet(id);evaluate('p.isDragging=true;p.advanceAnimation(120)');state('held');
    const start=evaluate('JSON.stringify([p.x,p.y,p.size,p.vx,p.vy])');
    const sequence=[];let last;
    for(let i=0;i<hz*3.2;i++) {
      tick(1,60/hz);const col=evaluate('p.spriteGeometry().column');
      if(col!==last){sequence.push(col);last=col;}
    }
    const frames=catalog.profiles[id].clips.drag.frames;
    assert.deepEqual(sequence.slice(0,frames.length),frames);
    assert.ok(sequence.length>frames.length,id+': no repeat');
    assert.equal(evaluate('JSON.stringify([p.x,p.y,p.size,p.vx,p.vy])'),start);
    evaluate('p.isDragging=false;p.externalMotion=null;p.advanceAnimation(0)');state('release');
    evaluate('p.advanceAnimation(120)');state('idle');
  }
});
test('Salary original full-cell gait keeps visible bounds and physical size in both directions',()=>{
  pet('salary-cat');const size=evaluate('p.size');
  for(const [direction,row] of [[1,1],[-1,2]]) {
    evaluate(`p.vx=${direction*2};p.facingRight=${direction>0};p.advanceAnimation(0)`);
    const clip=evaluate('p.spriteClip().clip');assert.equal(clip.row,row);
    assert.equal(clip.sourceCrop,undefined);
    assert.equal(clip.foot,199/208);
    for(let i=0;i<7;i++) {
      if(i)evaluate('p.advanceAnimation(83.3333333333)');
      const g=evaluate('p.spriteGeometry()');assert.equal(g.column,i);
      assert.equal(g.center,.5);assert.equal(g.anchorY,199/208);
      assert.equal(evaluate('p.size'),size);
    }
  }
});
console.log(`PASS: 15 animation integration cases for ${ids.length} local pets plus Grab/Throw/autonomy regressions`);
