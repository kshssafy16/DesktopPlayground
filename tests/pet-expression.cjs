const assert = require('node:assert/strict');
require('./autonomy.cjs');
const { evaluate, pet, tick, test, passed } = require('./grab-throw.cjs');
const before = passed();

function quiet(id, state = 'rest') {
  pet(id, 500, 900 - evaluate(`petDefinitions.get('${id}').defaultSize`));
  evaluate(`p.enterAutonomy('${state}');p.isAutonomouslyStill=true;p.vx=0;p.vy=0;auxiliaryEffectsEnabled=true;`);
}

test('fully overlapping resting pets have no separation force or position correction', () => {
  quiet('cat_brown');
  evaluate(`for(let i=0;i<100;i++) {
    const other=spawnPet('cat_brown',p.x,p.y);other.vx=0;other.vy=0;other.enterAutonomy('rest');
  }
  for(let i=0;i<120;i++)petInstances.forEach(p=>p.update(1));`);
  assert.equal(evaluate('petInstances.length'),101);
  assert.ok(evaluate('petInstances.every(p=>p.x===500 && p.y===861 && p.vx===0)'));
});

test('overlapping pets cannot change a thrown trajectory', () => {
  const trajectories=[];
  for(const neighbors of [0,20]) {
    evaluate("clearPlayground('pets')");pet('blob',500,300);
    evaluate(`p.externalMotion={elapsedMs:0,settledMs:0};p.vx=30;p.vy=-12;
      for(let i=0;i<${neighbors};i++){const q=spawnPet('blob',500,300);q.vx=0;}`);
    tick(20);trajectories.push(evaluate('[p.x,p.y,p.vx,p.vy,p.externalMotion.elapsedMs]'));
  }
  assert.deepEqual(trajectories[0],trajectories[1]);
});

test('Brown left walk uses clean right row mirrored with the matching foot anchor', () => {
  pet('cat_brown');evaluate('p.vx=-2;p.facingRight=false;p.advanceAnimation(0)');
  assert.ok(evaluate("p.spriteClip().state==='walkLeft' && p.spriteClip().clip.row===1 && p.spriteClip().clip.flip && p.spriteClip().clip.mirrorOf==='walkRight'"));
  evaluate(`globalThis.visualCalls=[];globalThis.visualCtx=new Proxy({}, {get:(_,key)=>(...args)=>visualCalls.push([key,...args])});p.draw(visualCtx)`);
  assert.ok(evaluate("visualCalls.some(c=>c[0]==='scale' && c[1]===-1 && c[2]===1)"));
  assert.ok(evaluate("visualCalls.some(c=>c[0]==='drawImage' && c[3]===208 && Math.abs(c[7]+p.size*2.5*.8462)<1e-8)"));
});

test('verified rest/look/sleep poses use explicit safe frame lists and fallbacks', () => {
  for(const [id,state,row,frames] of [['cat_brown','rest',7,[0,1,2,3,4,5]],['cat_face','look',8,[0,1,4,5]],
    ['puddle','rest',7,[0,1,2,3,4,5]],['kirby_sleepy','rest',5,[2,3,4]]]) {
    quiet(id,state);
    assert.equal(evaluate('p.spriteClip().clip.row'),row);
    assert.equal(evaluate('JSON.stringify(p.spriteClip().clip.frames)'),JSON.stringify(frames));
  }
  quiet('cat_sleepy');assert.ok(evaluate('p.spriteClip().clip.row===0 && Math.abs(p.spriteClip().clip.frameMs-483.3333333333)<1e-6'));
  for(const [id,row] of [['salary-cat',8],['doge',0],['kirby',6],['usagi',0]]) {
    quiet(id);assert.equal(evaluate('p.spriteClip().clip.row'),row);
  }
});

test('rest expression clocks agree at 30/60/144 Hz and draw never advances them', () => {
  for(const id of ['cat_brown','cat_face','cat_sleepy','puddle','kirby_sleepy']) {
    const clocks=[];
    for(const hz of [30,60,144]) {
      quiet(id,id==='cat_face'?'look':'rest');evaluate('p.autonomy.durationMs=p.autonomy.remainingMs=3000');
      tick(hz,60/hz);const clock=evaluate('[p.animationState,p.frame,p.animationMs]');
      evaluate('p.draw(ctx);p.draw(ctx)');assert.deepEqual(evaluate('[p.animationState,p.frame,p.animationMs]'),clock);
      clocks.push(clock);
    }
    for(const row of clocks){assert.equal(row[0],clocks[0][0]);assert.equal(row[1],clocks[0][1]);assert.ok(Math.abs(row[2]-1000)<1e-6);}
  }
});

test('Grab/Throw/orbit/ladder and airborne states suppress sleeping expression', () => {
  for(const override of ['p.isDragging=true','p.externalMotion={elapsedMs:0,settledMs:0}',
    'p.blackHoleOrbit={holeId:1}','p.climbing={id:1}','p.vy=-5']) {
    quiet('kirby_sleepy');evaluate(override);
    assert.equal(evaluate('p.quietAutonomy()'),false);
    assert.notEqual(evaluate('p.spriteClip().state'),'rest');
  }
});

test('no generated Zzz or decoration is added with effects ON or OFF; sleeping pose persists', () => {
  quiet('kirby_sleepy');
  evaluate(`globalThis.visualCalls=[];globalThis.visualCtx=new Proxy({}, {get:(_,key)=>(...args)=>visualCalls.push([key,...args])});p.draw(visualCtx)`);
  assert.ok(evaluate("!visualCalls.some(c=>c[0]==='fillText')"));
  const clip=evaluate('JSON.stringify(p.spriteClip())');
  evaluate('auxiliaryEffectsEnabled=false;visualCalls=[];p.draw(visualCtx)');
  assert.ok(evaluate("!visualCalls.some(c=>c[0]==='fillText') && visualCalls.some(c=>c[0]==='drawImage')"));
  assert.equal(evaluate('JSON.stringify(p.spriteClip())'),clip);
});

test('effects flag does not alter Bomb impulse or Throw movement', () => {
  const results=[];
  for(const enabled of [true,false]) {
    evaluate("clearPlayground('all')");pet('blob',500,400);
    evaluate(`auxiliaryEffectsEnabled=${enabled};fireBomb(500,400);`);
    const impulse=evaluate('[p.vx,p.vy,p.squish]');
    evaluate('p.externalMotion={elapsedMs:0,settledMs:0}');tick(30);
    results.push([impulse,evaluate('[p.x,p.y,p.vx,p.vy]')]);
  }
  assert.deepEqual(results[0],results[1]);
});

test('quiet expressions create no persistent particles or effects for many pets', () => {
  quiet('kirby_sleepy');
  evaluate(`for(let i=0;i<40;i++) {const q=spawnPet('cat_sleepy',100+i*20,900-39);q.vx=0;q.enterAutonomy('rest');}
    for(let i=0;i<120;i++)petInstances.forEach(q=>{q.update(1);q.draw(ctx)});`);
  assert.ok(evaluate('particles.length===0 && rings.length===0 && impacts.length===0 && petInstances.length===41'));
});

test('all nine profiles resolve explicit frames; forbidden Face and Salary frames remain excluded', () => {
  const ids=['cat_brown','cat_face','cat_sleepy','salary-cat','doge','puddle','kirby','kirby_sleepy','usagi'];
  for(const id of ids) {
    pet(id);
    assert.ok(evaluate(`(()=>{const profile=spriteProfiles['${id}'];return Object.values(profile.clips).every(c=>
      c.frames.length>0 && c.frames.every(f=>Number.isInteger(f)&&f>=0&&f<8) && c.row<profile.rows && c.frameMs>0 &&
      c.center>0&&c.center<1&&c.foot>0&&c.foot<=1)})()`));
  }
  assert.ok(evaluate("Object.values(spriteProfiles.cat_face.clips).every(c=>c.row!==8 || !c.frames.some(f=>f===2||f===3))"));
  assert.ok(evaluate("spriteProfiles.puddle.clips.walkRight.row===1 && spriteProfiles.puddle.clips.walkLeft.row===2 && spriteProfiles.puddle.clips.walkRight.frames.length===8"));
  assert.ok(evaluate("Object.entries(spriteProfiles['salary-cat'].clips).every(([name,c])=>name.startsWith('walk')? [1,2].includes(c.row)&&!c.sourceCrop&&c.frames.every(f=>f<7):![0,1,2,3,7].includes(c.row))"));
});

test('air clip does not flicker to idle at the autonomous apex and holds its final frame', () => {
  pet('doge');evaluate('p.beginAutonomousJump(-12);p.advanceAnimation(1000)');
  assert.equal(evaluate('p.animationState'),'jump');assert.equal(evaluate('p.frame'),2);
  evaluate('p.vy=0;p.advanceAnimation(4000)');assert.equal(evaluate('p.frame'),2);
  evaluate('p.vy=.1;p.advanceAnimation(0)');assert.equal(evaluate('p.animationState'),'fall');
  assert.equal(evaluate('p.frame'),0);
  evaluate('p.advanceAnimation(4000)');assert.equal(evaluate('p.frame'),2);
});

test('all local clip clocks use elapsed milliseconds at 30/60/144 Hz', () => {
  for(const id of ['cat_brown','cat_face','cat_sleepy','salary-cat','doge','puddle','kirby','kirby_sleepy','usagi']) {
    for(const state of ['idle','walkRight','walkLeft','jump','fall','drag','rest','sleep','look']) {
      const result=[];
      for(const hz of [30,60,144]) {
        quiet(id,'idle');evaluate(`p.autonomy.state='${state}';p.externalMotion=null;p.motionCause=null;p.isDragging=false;`);
        if(state.startsWith('walk'))evaluate(`p.isAutonomouslyStill=false;p.vx=${state==='walkRight'?2:-2};p.facingRight=p.vx>0`);
        if(state==='jump')evaluate('p.motionCause="autonomous-jump";p.vy=-6');
        if(state==='fall')evaluate('p.externalMotion={source:"throw"}');
        if(state==='drag')evaluate('p.isDragging=true');
        for(let i=0;i<hz*2;i++)evaluate(`p.advanceAnimation(${1000/hz})`);
        result.push(evaluate('[p.animationState,p.frame,p.animationMs]'));
      }
      // GrabStart consumes 120ms once; Held keeps the remaining elapsed time.
      const expectedMs=2000-(state==='drag'?120:0);
      for(const row of result){assert.equal(row[0],result[0][0]);assert.equal(row[1],result[0][1]);assert.ok(Math.abs(row[2]-expectedMs)<1e-6,`${id}/${state}: ${row[2]}`);}
    }
  }
});

test('invalid frame lists and cyclic fallbacks fail safely without unbalanced rendering', () => {
  pet('cat');evaluate(`p.definitionId='test-invalid';spriteProfiles['test-invalid']={clips:{idle:{row:0,frames:[0],frameMs:100},drag:{row:0,frames:[0,8],frameMs:100}},fallback:{drag:'idle'}};p.isDragging=true`);
  assert.equal(evaluate('p.spriteClip().clip.frames[0]'),0);
  evaluate(`spriteProfiles['test-invalid'].clips.idle.frames=[];spriteProfiles['test-invalid'].fallback={drag:'fall',fall:'drag'}`);
  assert.equal(evaluate('p.spriteClip()'),null);
  evaluate(`globalThis.invalidCalls=[];p.draw(new Proxy({}, {get:(_,key)=>(...args)=>invalidCalls.push(key)}))`);
  assert.equal(evaluate('invalidCalls.filter(k=>k==="save").length'),evaluate('invalidCalls.filter(k=>k==="restore").length'));
  evaluate('delete spriteProfiles["test-invalid"]');
});

test('Poodle restores both original authored gaits without mirroring or clipping the source cell', () => {
  pet('puddle');
  for(const direction of [-1,1]) {
    evaluate(`p.vx=${direction*2};p.facingRight=${direction>0};p.advanceAnimation(0)`);
    assert.equal(evaluate('p.spriteClip().clip.row'),direction>0?1:2);
    assert.equal(evaluate('p.spriteClip().clip.frames.length'),8);
    assert.equal(evaluate('!!p.spriteClip().clip.flip'),false);
    assert.equal(evaluate('p.spriteGeometry().scale'),1.1);
  }
});

test('Face has directional source gaze, mirrored left lean and tiny elapsed-time bob', () => {
  pet('cat_face');evaluate('p.vx=2;p.facingRight=true;p.advanceAnimation(90)');
  assert.equal(evaluate('p.spriteClip().clip.row'),9);
  assert.ok(evaluate('p.spriteGeometry().tilt>0 && p.spriteGeometry().bob<0 && Math.abs(p.spriteGeometry().bob)<=p.size*.025'));
  evaluate('p.vx=-2;p.facingRight=false;p.advanceAnimation(0)');
  assert.ok(evaluate('p.spriteClip().clip.flip && p.frame===0'));
  const motion=evaluate('JSON.stringify([p.x,p.y,p.vx,p.vy,p.size])');evaluate('p.draw(ctx)');
  assert.equal(evaluate('JSON.stringify([p.x,p.y,p.vx,p.vy,p.size])'),motion);
});

test('Salary uses restored source gait independently of office/rest and air fallback', () => {
  pet('salary-cat');evaluate('p.vx=2;p.advanceAnimation(0)');
  assert.ok(evaluate('p.spriteClip().clip.row===1 && p.spriteClip().clip.frames.length===7 && !p.spriteClip().clip.sourceCrop'));
  evaluate('p.beginAutonomousJump(-9);p.advanceAnimation(0)');assert.equal(evaluate('p.spriteClip().clip.row'),4);
  quiet('salary-cat');assert.equal(evaluate('p.spriteClip().clip.row'),8);
  quiet('salary-cat','idle');assert.equal(evaluate('p.spriteClip().clip.row'),8);
});

test('Usagi air display height matches walking scale and each baked-in airborne foot is corrected', () => {
  pet('usagi');evaluate('p.beginAutonomousJump(-9);p.advanceAnimation(0)');
  for(let i=0;i<3;i++) {
    evaluate(`p.advanceAnimation(${i===0?0:100})`);
    const g=evaluate('p.spriteGeometry()');
    const bottoms=[185,153,194],heights=[146,147,148];
    assert.ok(Math.abs(g.anchorY-bottoms[i]/208)<.0001);
    assert.equal(g.scale,1.25);
    assert.ok(heights[i]*g.scale/196>.9 && heights[i]*g.scale/196<1.05);
  }
});

test('source-column frame corrections are reusable, finite, and never change physical coordinates', () => {
  pet('cat');evaluate(`p.definitionId='test-correction';spriteProfiles['test-correction']={clips:{idle:{row:0,frames:[2,0,2],frameMs:100,center:.5,foot:.9,
    frameAdjustments:{2:{scale:1.1,foot:.8,center:.45,offsetX:.01,offsetY:-.02}}}}};p.advanceAnimation(0)`);
  assert.ok(evaluate('p.spriteGeometry().column===2 && p.spriteGeometry().scale===1.1 && p.spriteGeometry().foot===.8'));
  assert.ok(evaluate('p.spriteGeometry().offsetX===p.size*.025 && p.spriteGeometry().offsetY===-p.size*.05'));
  evaluate('p.advanceAnimation(100)');assert.equal(evaluate('p.spriteGeometry().scale'),1);
  evaluate('p.advanceAnimation(100)');assert.equal(evaluate('p.spriteGeometry().scale'),1.1);
  evaluate("spriteProfiles['test-correction'].clips.idle.frameAdjustments[2].scale=NaN");
  assert.equal(evaluate('p.spriteClip()'),null);evaluate("delete spriteProfiles['test-correction']");
});

test('walk display hysteresis prevents work/idle flashing near the speed threshold', () => {
  pet('salary-cat');evaluate('p.vx=1;p.advanceAnimation(0)');assert.equal(evaluate('p.animationState'),'walkRight');
  evaluate('p.vx=.4;p.advanceAnimation(100)');assert.equal(evaluate('p.animationState'),'walkRight');
  evaluate('p.vx=.1;p.advanceAnimation(100)');assert.equal(evaluate('p.animationState'),'idle');
  assert.equal(evaluate('p.vx'),.1);
});

console.log(`PASS: ${passed()-before} expression/overlap/quality cases plus ${before} existing renderer/autonomy cases`);
