const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { loadLocalPets, webpSize } = require('../local-pets');

const project = path.resolve(__dirname, '..');
const bundled = loadLocalPets(path.join(project, 'assets', 'pets'));
assert.equal(bundled.length, 9);
assert.deepEqual(bundled.filter(pet => pet.category === 'cat').map(pet => [pet.id, pet.label]), [
  ['cat_brown', '황색냥'], ['cat_face', '얼굴냥'], ['cat_sleepy', '실눈냥'], ['salary-cat', '영업냥']
]);
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
