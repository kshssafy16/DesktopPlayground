'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const path = require('node:path');
const {assertProfile, createPlayer, resolveClip} = require('../animation/pet-animation.cjs');

const root = path.resolve(__dirname, '..');
const catalog = require('../animation/profiles.v1.json');
const snapshot = require('../docs/v1.1/qa/sprite-final/after-profiles.json');
const hashes = {cat_brown:'a12f1e408377',cat_face:'95f9d38500fa',
  cat_sleepy:'276cd3263e70','salary-cat':'69c485341384',doge:'e2c7216e564f',
  puddle:'5e1cfeace974',kirby:'10b66645a06d',kirby_sleepy:'eed96cfd7cd6',
  usagi:'5cd25a775f0a',call_duck:'542b2ef7487f',baby_harp_seal:'89b666fe24db'};
assert.equal(catalog.schemaVersion, 1);
assert.equal(catalog.sourceRendererSha256, snapshot.rendererSha256);
// Preserve unrelated mappings while allowing reviewed grab, gait and quiet poses.
const unchanged=structuredClone(Object.fromEntries(
  Object.keys(snapshot.profiles).map(id => [id, catalog.profiles[id]])));
for(const profile of Object.values(unchanged))delete profile.clips.grabStart;
for(const id of ['cat_face','doge'])unchanged[id].clips.drag=snapshot.profiles[id].clips.drag;
for(const state of ['walkRight','walkLeft'])unchanged['salary-cat'].clips[state]=snapshot.profiles['salary-cat'].clips[state];
for(const [id,states] of Object.entries({'salary-cat':['rest','sleep'],doge:['rest','sleep'],puddle:['sleep'],usagi:['sleep']})) {
  for(const state of states) {
    if (snapshot.profiles[id].clips[state]) unchanged[id].clips[state]=snapshot.profiles[id].clips[state];
    else delete unchanged[id].clips[state];
  }
}
assert.deepEqual(unchanged, snapshot.profiles);
assert.equal(Object.keys(catalog.profiles).length, 11);

for (const [id, profile] of Object.entries(catalog.profiles)) {
  assertProfile(profile);
  const meta = JSON.parse(fs.readFileSync(path.join(root, 'assets/pets', id, 'pet.json')));
  assert.equal(meta.spritesheetPath, 'spritesheet.webp');
  const webp = fs.readFileSync(path.join(root, 'assets/pets', id, 'spritesheet.webp'));
  assert.equal(webp.subarray(0, 4).toString(), 'RIFF');
  assert.equal(webp.subarray(8, 12).toString(), 'WEBP');
  assert.equal(crypto.createHash('sha256').update(webp).digest('hex').slice(0,12), hashes[id]);
  for (const state of ['idle','walkRight','walkLeft','jumpRise','jumpApex','fall','land',
    'grabStart','held','release','thrown','bounce','hit','rest','sleep','wake']) {
    const selected = resolveClip(profile, state);
    assert.ok(selected.clip.frames.length > 0, `${id}: ${state}`);
    for (const column of selected.clip.frames) {
      assert.ok(column >= 0 && column < 8, `${id}: ${state}`);
    }
  }
  const player = createPlayer(profile);
  assert.equal(player.update({}, 0).state, 'idle');
  assert.equal(player.update({event:'grabStart',held:true}, 50).state, 'grabStart');
  assert.equal(player.update({held:true}, 70).state, 'held');
  assert.equal(player.update({event:'release'}, 50).state, 'release');
  assert.equal(player.update({}, 70).state, 'idle');
  assert.equal(player.update({thrown:true}, 0).state, 'thrown');
  assert.equal(player.update({event:'bounce'}, 60).state, 'bounce');
  assert.equal(player.update({event:'land'}, 130).state, 'idle');
  assert.equal(player.update({event:'hit'}, 50).state, 'hit');
  assert.equal(player.update({}, 130).state, 'idle');
  assert.equal(player.update({resting:true,sleeping:true}, 20).state, 'sleep');
  assert.equal(player.update({event:'wake'}, 180).state, 'idle');
}

const face = catalog.profiles.cat_face;
for(const [id,row,frames] of [
  ['cat_brown',5,[3,4]],['cat_face',8,[1,5]],['cat_sleepy',0,[0,1,2,3,4,5]],
  ['salary-cat',0,[0]],['doge',0,[3]],['puddle',5,[4]],
  ['usagi',0,[3]],['kirby',6,[3]],['kirby_sleepy',5,[2,3,4]]
]) {
  const sleep=resolveClip(catalog.profiles[id],'sleep').clip;
  assert.equal(sleep.row,row,`${id} sleep row`);
  assert.deepEqual(sleep.frames,frames,`${id} sleep frames`);
}
for (const state of ['idle','walkRight','walkLeft','rest','sleep','look','grabStart']) {
  const c = resolveClip(face,state).clip;
  assert.ok(!(c.row === 8 && c.frames.some(f => f === 2 || f === 3)), state);
}
const poodle = catalog.profiles.puddle;
assert.deepEqual(resolveClip(poodle,'walkRight').clip.frames, [0,1,2,3,4,5,6,7]);
assert.equal(resolveClip(poodle,'walkRight').clip.row, 1);
assert.equal(resolveClip(poodle,'walkLeft').clip.row, 2);
const salary = catalog.profiles['salary-cat'];
assert.equal(resolveClip(salary,'idle').clip.row, 8);
assert.equal(resolveClip(salary,'rest').clip.row, 8);
assert.equal(resolveClip(salary,'sleep').clip.foot, 188/208);
assert.deepEqual(resolveClip(salary,'walkRight').clip.frames, [0,1,2,3,4,5,6]);
assert.equal(resolveClip(salary,'walkRight').clip.row, 1);
assert.equal(resolveClip(salary,'walkLeft').clip.row, 2);
assert.equal(resolveClip(salary,'walkLeft').clip.flip, undefined);
assert.equal(resolveClip(salary,'walkRight').clip.sourceCrop, undefined);
assert.equal(resolveClip(salary,'walkRight').clip.foot, 199/208);
const usagi = catalog.profiles.usagi;
assert.equal(resolveClip(usagi,'jumpRise').clip.scale, 1.25);
assert.equal(resolveClip(usagi,'fall').clip.frameAdjustments['2'].foot, 0.7356);
const extended = structuredClone(catalog.profiles.doge);
extended.clips.grabStart = {row:0,frames:[0,1],frameMs:60,center:.5,foot:.976};
assertProfile(extended);
assert.equal(resolveClip(extended,'grabStart').name, 'grabStart');
const interruption = createPlayer(extended);
assert.equal(interruption.update({thrown:true}, 10).state, 'thrown');
assert.equal(interruption.update({thrown:true,event:'hit'}, 20).state, 'hit');
assert.equal(interruption.update({orbit:true}, 0).state, 'blackHoleOrbit');

for (const hz of [30,60,144]) {
  const player = createPlayer(catalog.profiles.doge);
  let result;
  for (let i = 0; i < hz; i++) result = player.update({vx:2}, 1000/hz);
  assert.equal(result.state, 'walkRight');
  assert.equal(result.frameIndex, 4);
}
assert.throws(() => createPlayer({rows:9,origin:'feet',clips:{idle:{row:9,frames:[0],frameMs:100}}}));
assert.throws(() => createPlayer(catalog.profiles.doge).update({}, -1));
console.log('animation-platform: 11 profiles, state transitions, clip safety, timing PASS');
const priority = createPlayer(catalog.profiles.doge);
assert.equal(priority.update({orbit:true,held:true},0).state,'held');
assert.equal(priority.update({held:true,event:'grabStart'},20).state,'grabStart');
assert.equal(priority.update({thrown:true},0).state,'thrown');
const rising = createPlayer(catalog.profiles.doge);
assert.equal(rising.update({airborne:true,vy:-1},20).state,'jumpRise');
assert.equal(rising.update({airborne:true,vy:.1},0).state,'fall');
const reaction = createPlayer(catalog.profiles.doge);
reaction.update({event:'hit'},50);
assert.equal(reaction.update({},150).elapsedMs,20);
assert.equal(reaction.update({knockout:true},0).state,'knockout');
console.log('animation-platform: integration priority, interruption and elapsed remainder PASS');
for(const profile of Object.values(catalog.profiles)) {
  const held=createPlayer(profile),columns=new Set();
  assert.equal(held.update({held:true,event:'grabStart'},0).mode,'once');
  assert.equal(held.update({held:true},60).frameIndex,1);
  held.update({held:true},60);
  for(let ms=0;ms<3200;ms+=20)columns.add(held.update({held:true},20).column);
  assert.deepEqual([...columns].sort((a,b)=>a-b),[...profile.clips.drag.frames].sort((a,b)=>a-b));
}
assert.ok(Object.values(catalog.profiles).every(profile=>Object.values(profile.clips).every(clip=>!clip.sourceCrop)));
const single=structuredClone(catalog.profiles.doge);single.clips.drag.frames=[0];
assert.equal(createPlayer(single).update({held:true},2000).mode,'hold');
console.log('animation-platform: eleven sequential Held loops over 3.2s, GrabStart and full-cell sources PASS');
