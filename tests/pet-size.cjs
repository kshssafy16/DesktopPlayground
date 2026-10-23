const assert = require('node:assert/strict');
const { evaluate, event, test, sandbox } = require('./grab-throw.cjs');
evaluate(`applyPetDefinitions({defaultPets:{},localPets:[{id:'doge',name:'Doge',rows:11,asset:'doge.webp'}],customPets:[]})`);

test('five selected percentages create independent Pet sizes, including same-kind copies', () => {
  evaluate(`selectedPetId='blob';currentMode='spawn';selectedPetScalePercent=100`);
  for (const percent of [50, 100, 200, 500, 1000]) {
    evaluate(`selectedPetScalePercent=${percent}`);
    event('canvas:mousedown', 350 + percent / 2, 300, percent);
    event('window:mouseup', 350 + percent / 2, 300, percent + 1);
  }
  assert.deepEqual(Array.from(evaluate('petInstances.map(p=>p.size)')), [17.5, 35, 70, 175, 350]);
  evaluate('selectedPetScalePercent=500');
  assert.deepEqual(Array.from(evaluate('petInstances.map(p=>p.size)')), [17.5, 35, 70, 175, 350]);
  assert.equal(evaluate('petInstances.length'), 5);
});

test('invalid percentages fall back to 100 without poisoning size or physics', () => {
  for (const value of ['NaN', 'Infinity', '-100', '45', '1050', 'null', '"200"']) {
    evaluate(`globalThis.invalid=spawnPet('blob',600,300,{scalePercent:${value}})`);
    assert.equal(evaluate('invalid.size'), 35, value);
    evaluate('invalid.update(1)');
    assert.equal(evaluate('Number.isFinite(invalid.x)&&Number.isFinite(invalid.y)'), true);
  }
  evaluate(`selectedPetScalePercent=Infinity;currentMode='spawn';selectedPetId='blob'`);
  event('canvas:mousedown', 600, 300, 20);
  assert.equal(evaluate('petInstances.at(-1).size'), 35);
});

test('large Pet stays stable at narrow side walls and on the floor', () => {
  evaluate(`width=500;height=300;globalThis.large=spawnPet('blob',490,0,{scalePercent:1000});large.vx=15`);
  evaluate('large.update(1)');
  assert.equal(evaluate('large.x'), 500);
  assert.equal(evaluate('large.vx'), 0);
  for (let i = 0; i < 120; i++) evaluate('large.update(1)');
  assert.equal(evaluate('large.x>=0&&large.x<=width'), true);
  assert.equal(evaluate('large.y+large.size'), 300);
  assert.equal(evaluate('Number.isFinite(large.y)&&Number.isFinite(large.vy)'), true);
});

test('Grab, Throw, Hammer and sprite Hit use scaled Pet geometry', () => {
  evaluate(`globalThis.large=spawnPet('blob',650,500,{scalePercent:500});large.vx=0`);
  event('canvas:mousedown', 810, 500, 0);
  assert.equal(evaluate('draggedPet===large'), true);
  event('canvas:mousemove', 850, 500, 40);
  event('window:mouseup', 900, 500, 80);
  assert.equal(evaluate('large.externalMotion.source'), 'throw');
  evaluate('large.externalMotion=null;large.isDragging=false;strikeHammer(large.x+160,large.y)');
  assert.equal(evaluate('large.externalMotion.source'), 'hammer');
  evaluate(`globalThis.sprite=spawnPet('doge',400,400,{scalePercent:500})`);
  assert.equal(evaluate('spriteHitArea(sprite,400,400)!==null'), true);
  assert.equal(evaluate('spriteHitArea(sprite,1000,400)'), null);
});

test('large Pet edges participate in Bomb and Black Hole reach', () => {
  evaluate(`globalThis.large=spawnPet('blob',700,400,{scalePercent:1000});fireBomb(300,400)`);
  assert.equal(evaluate('large.externalMotion.source'), 'bomb');
  evaluate(`large.externalMotion=null;addBlackHole(450,400);updateBlackHoles(1)`);
  assert.equal(evaluate('large.blackHoleOrbit!==null'), true);
});

test('Sprite, built-in Canvas and custom image visual scales match instance size', () => {
  evaluate(`globalThis.sprite=spawnPet('doge',400,400,{scalePercent:200});globalThis.basic=spawnPet('basic',500,400,{scalePercent:200});
    petDefinitions.set('test-image',{id:'test-image',renderKind:'image',assetUrl:'test.png',displayWidth:88,displayHeight:44,defaultSize:44,enabled:true});
    globalThis.image=spawnPet('test-image',600,400,{scalePercent:200})`);
  sandbox.drawingCalls.length = 0;
  evaluate('sprite.draw(ctx)');
  const spriteDraw = sandbox.drawingCalls.find(call => call[0] === 'drawImage');
  assert.ok(spriteDraw);
  assert.equal(spriteDraw.at(-1), evaluate('sprite.size*2.5*sprite.spriteGeometry().scale'));
  sandbox.drawingCalls.length = 0;
  evaluate('basic.draw(ctx)');
  assert.ok(sandbox.drawingCalls.some(call => call[0] === 'scale' && call[1] === 2 && call[2] === 2));
  assert.equal(evaluate('image.size'), 88);
  assert.equal(evaluate('image.imgElement.style.transform.includes("scale(2")'), true);
});

test('boss preserves its growth rule but caps at ten times species size', () => {
  evaluate(`globalThis.small=spawnPet('doge',400,400,{scalePercent:100});small.becomeBoss();
    globalThis.huge=spawnPet('doge',900,400,{scalePercent:1000});huge.becomeBoss()`);
  assert.ok(evaluate('small.size>small.definition.defaultSize'));
  assert.equal(evaluate('huge.size'), evaluate('huge.definition.defaultSize*10'));
  assert.ok(evaluate('huge.boss.health>0'));
  assert.equal(evaluate('Number.isFinite(huge.y-huge.size*1.9-20)'), true);
});

console.log('PASS: Pet size renderer cases');
