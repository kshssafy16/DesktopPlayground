const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { LOCAL_PETS, loadLocalPets, webpSize } = require('../local-pets');

const project = path.resolve(__dirname, '..');
const bundled = loadLocalPets(path.join(project, 'assets', 'pets'));
assert.equal(new Set(LOCAL_PETS.map(pet => pet.id)).size, LOCAL_PETS.length, 'duplicate app IDs');
assert.deepEqual(bundled.map(pet => pet.id), LOCAL_PETS.map(pet => pet.id), 'registered packages must load');
for (const pet of bundled) {
  const source = LOCAL_PETS.find(entry => entry.id === pet.id);
  const metadata = JSON.parse(fs.readFileSync(path.join(project, 'assets', 'pets', pet.id, 'pet.json')));
  assert.equal(metadata.id, source.sourceId, `${pet.id}: source ID`);
  assert.equal(metadata.spritesheetPath, 'spritesheet.webp', `${pet.id}: sheet path`);
  assert.deepEqual(webpSize(path.join(project, 'assets', 'pets', pet.id, 'spritesheet.webp')),
    { width: pet.columns * 192, height: pet.rows * 208 }, `${pet.id}: sheet dimensions`);
}
assert.deepEqual(bundled.filter(pet => pet.category === 'cat').map(pet => [pet.id, pet.label]), [
  ['cat_brown', '황색냥'], ['cat_face', '얼굴냥'], ['cat_sleepy', '실눈냥'], ['salary-cat', '영업냥']
]);
assert.deepEqual(bundled.filter(pet => ['call_duck', 'baby_harp_seal'].includes(pet.id))
  .map(pet => [pet.id, pet.label, pet.rows, pet.category]), [
  ['call_duck', '콜덕', 9, 'character'], ['baby_harp_seal', '아기 하프물범', 9, 'character']
]);
const animation = require('../animation/pet-animation.cjs');
const profiles = require('../animation/profiles.v1.json').profiles;
for (const id of ['call_duck', 'baby_harp_seal']) {
  animation.assertProfile(profiles[id]);
  for (const state of Object.keys(animation.STATES)) {
    const { clip } = animation.resolveClip(profiles[id], state);
    assert.ok(clip.row < 9 && clip.frames.every(frame => frame < 8), `${id}: ${state}`);
  }
  assert.deepEqual(profiles[id].clips.walkRight.frames, [0,1,2,3,4,5,6,7]);
  assert.equal(profiles[id].clips.walkLeft.flip, true);
  assert.equal(animation.resolveClip(profiles[id], 'held').name, 'drag');
  assert.equal(animation.resolveClip(profiles[id], 'sleep').name, 'sleep');
  assert.equal(animation.resolveClip(profiles[id], 'hit').name, 'hit');
}
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'desktop-playground-local-'));
try {
  for (const id of ['doge', 'kirby']) {
    const source = path.join(project, 'assets', 'pets', id);
    const destination = path.join(root, id);
    fs.cpSync(source, destination, { recursive: true });
    assert.deepEqual(webpSize(path.join(destination, 'spritesheet.webp')), { width: 1536, height: 1872 });
  }
  assert.deepEqual(loadLocalPets(root).map(pet => pet.id), ['doge', 'kirby']);
  const dogJson = path.join(root, 'doge', 'pet.json');
  const originalJson = fs.readFileSync(dogJson);
  fs.writeFileSync(dogJson, '{broken');
  assert.deepEqual(loadLocalPets(root).map(pet => pet.id), ['kirby']);
  fs.writeFileSync(dogJson, originalJson);
  const dogSheet = path.join(root, 'doge', 'spritesheet.webp');
  fs.writeFileSync(dogSheet, Buffer.alloc(200));
  assert.deepEqual(loadLocalPets(root).map(pet => pet.id), ['kirby']);
  fs.rmSync(dogSheet);
  assert.deepEqual(loadLocalPets(root).map(pet => pet.id), ['kirby']);
  console.log('PASS: valid local packages load; malformed JSON, invalid WebP and missing sheet skip');
} finally {
  const relative = path.relative(os.tmpdir(), root);
  if (relative && !relative.startsWith('..') && !path.isAbsolute(relative)
    && path.basename(root).startsWith('desktop-playground-local-')) {
    fs.rmSync(root, { recursive: true, force: true });
  }
}
