const assert = require('node:assert/strict');
require('./autonomy.cjs');
const { evaluate, pet, test, event, passed } = require('./grab-throw.cjs');
const inherited = passed();
const sprites = ['cat_brown','cat_face','cat_sleepy','salary-cat','doge','puddle','usagi','kirby','kirby_sleepy'];

test('Gun moves a bullet to the red dot and reuses nonlethal Hit', () => {
  pet('doge',500,400);
  evaluate('lastGunShotAt=-Infinity;shootGun(500,400)');
  assert.equal(evaluate('bullets.length'),1);
  assert.equal(evaluate('p.externalMotion'),null);
  evaluate('updateBullets(120);p.advanceAnimation(0)');
  assert.equal(evaluate('bullets.length'),0);
  assert.equal(evaluate('p.externalMotion.source'),'gun');
  assert.equal(evaluate('p.animationVisualState'),'hit');
  assert.equal(evaluate('petInstances.length'),1);
  assert.ok(evaluate('screenEffects.groups.damage.length===1 && screenEffects.groups.damage[0].source==="gun"'));
  evaluate('p.advanceAnimation(180)');
  assert.equal(evaluate('p.animationVisualState'),'thrown');
});

test('nine Sprite Pets wake from Sleep, react and recover without deletion', () => {
  for (const id of sprites) {
    evaluate("clearPlayground('all');lastGunShotAt=-Infinity");pet(id,500,400);
    evaluate("p.enterAutonomy('sleep');shootGun(500,400);updateBullets(120);p.advanceAnimation(0)");
    assert.equal(evaluate('p.autonomy.state'),'roam',id);
    assert.equal(evaluate('p.animationVisualState'),'hit',id);
    assert.equal(evaluate('p.externalMotion.source'),'gun',id);
    assert.equal(evaluate('petInstances.length'),1,id);
    assert.ok(evaluate('p.spriteClip().clip.frames.length>0'),id);
    evaluate('p.advanceAnimation(180)');
    assert.equal(evaluate('p.animationVisualState'),'thrown',id);
  }
});

test('cooldown and 24-bullet cap bound sustained fire; misses expire', () => {
  evaluate('lastGunShotAt=-Infinity');
  assert.equal(evaluate('shootGun(700,300)'),true);
  assert.equal(evaluate('shootGun(700,300)'),false);
  assert.equal(evaluate('bullets.length'),1);
  evaluate('__now=150;shootGun(700,300)');
  assert.equal(evaluate('bullets.length'),2);
  evaluate('for(let i=0;i<70;i++){lastGunShotAt=-Infinity;shootGun(700,300)}');
  assert.equal(evaluate('bullets.length'),24);
  evaluate('updateBullets(2000);drawEffects(2000)');
  assert.equal(evaluate('bullets.length'),0);
  assert.equal(evaluate('petInstances.length'),0);
});

test('long-frame arrival catches the red dot and chooses the eligible Pet', () => {
  pet('doge',500,400);
  evaluate('globalThis.front=spawnPet("doge",450,417);front.isDragging=true;lastGunShotAt=-Infinity;shootGun(500,400);updateBullets(300)');
  assert.equal(evaluate('front.externalMotion'),null);
  assert.equal(evaluate('p.externalMotion.source'),'gun');
  assert.equal(evaluate('bullets.length'),0);
  assert.equal(evaluate('petInstances.length'),2);
});

test('repeated hits stay transient; auxiliary OFF hides number but keeps physics', () => {
  pet('doge',500,400);
  evaluate('p.enterAutonomy("sleep");auxiliaryEffectsEnabled=false;lastGunShotAt=-Infinity;shootGun(500,400);updateBullets(120)');
  assert.equal(evaluate('p.autonomy.state'),'roam');
  assert.equal(evaluate('p.externalMotion.source'),'gun');
  assert.equal(evaluate('screenEffects.groups.damage.length'),1);
  evaluate('__now=150;p.x=500;p.y=400;p.vx=0;p.vy=0;shootGun(500,400);updateBullets(120);p.advanceAnimation(180)');
  assert.equal(evaluate('petInstances.length'),1);
  assert.notEqual(evaluate('p.animationVisualState'),'hit');
  evaluate('drawEffects(2500)');
  assert.equal(evaluate('screenEffects.groups.damage.length'),0);
});

test('Gun mode left click fires and right click does not fire again', () => {
  pet('doge',500,400);
  evaluate('currentMode="gun";lastGunShotAt=-Infinity');
  event('canvas:mousedown',500,400,0);
  assert.equal(evaluate('bullets.length'),1);
  event('canvas:mousedown',500,400,1,2);
  assert.equal(evaluate('currentMode'),'gun'); // Native smoke verifies the asynchronous IPC mode switch.
  assert.equal(evaluate('bullets.length'),1);
});

test('four weapons keep their own cadence, pellet count and bounded lifetime', () => {
  const profiles = [['awm',4000,1],['ak47',120,1],['uzi',65,1],['double_barrel',1200,10]];
  for (const [id, cooldown, count] of profiles) {
    evaluate(`clearPlayground('all');gunWeapon='${id}';lastGunShotAt=-Infinity;__now=0`);
    assert.equal(evaluate('shootGun(500,400)'),true,id);
    assert.equal(evaluate('bullets.length'),count,id);
    assert.equal(evaluate('shootGun(500,400)'),false,id);
    evaluate(`__now=${cooldown-1}`);
    assert.equal(evaluate('shootGun(500,400)'),false,id);
    evaluate(`__now=${cooldown}`);
    assert.equal(evaluate('shootGun(500,400)'),true,id);
  }
  evaluate('drawEffects(2000)');
  assert.equal(evaluate('bullets.length'),0);
});

test('aimed paths miss empty space and first opaque Head contact gives more damage', () => {
  pet('doge',500,400);
  evaluate("gunWeapon='awm';lastGunShotAt=-Infinity;shootGun(500,400);updateBullets(120)");
  const body = evaluate('screenEffects.groups.damage[0].amount');
  assert.equal(evaluate('p.externalMotion.source'),'gun');
  let head=0;
  for (const [x,y] of [[515,360],[525,360],[535,360],[510,350],[520,345],[530,345]]) {
    evaluate(`clearPlayground("effects");p.vx=0;p.vy=0;lastGunShotAt=-Infinity;shootGun(${x},${y});updateBullets(120)`);
    head=Math.max(head,evaluate('screenEffects.groups.damage[0]?.amount || 0'));
  }
  assert.ok(head>body,`Head ${head}, Body ${body}`);
  evaluate('clearPlayground("effects");p.externalMotion=null;lastGunShotAt=-Infinity;shootGun(800,400);updateBullets(120)');
  assert.equal(evaluate('p.externalMotion'),null);
  assert.equal(evaluate('screenEffects.groups.damage.length'),0);
});

test('all four muzzles face the dot from lower right and edge poses stay bounded', () => {
  for(const id of ['awm','ak47','uzi','double_barrel']) {
    evaluate(`gunWeapon='${id}'`);
    const pose=evaluate('gunPose(800,450)');
    assert.ok(pose.muzzleX>800 && pose.muzzleY>450,id);
    assert.ok(Math.abs(Math.atan2(450-pose.muzzleY,800-pose.muzzleX)-pose.angle)<1e-8,id);
    for(const [x,y] of [[0,0],[1600,0],[0,900],[1600,900]]) {
      const result=evaluate(`(() => {const profile=weaponProfiles[gunWeapon],p=gunPose(${x},${y});
        const c=Math.cos(p.angle),s=Math.sin(p.angle);
        return [[0,0],[profile.width,0],[0,profile.height],[profile.width,profile.height]]
          .every(([cx,cy])=>{const dx=cx-profile.width*profile.muzzle[0],dy=cy-profile.height*profile.muzzle[1];
            const px=p.muzzleX+dx*c-dy*p.flipY*s,py=p.muzzleY+dx*s+dy*p.flipY*c;
            return px>=-0.01 && py>=-0.01 && px<=width+0.01 && py<=height+0.01;})})()`);
      assert.ok(result,`${id} at ${x},${y}`);
    }
  }
});

test('swept path hits an intervening Pet before the red dot, including a long frame', () => {
  pet('doge',500,400);
  evaluate('globalThis.front=spawnPet("doge",548,448);gunWeapon="awm";lastGunShotAt=-Infinity;shootGun(500,400)');
  assert.ok(evaluate('bullets[0].originX>500 && bullets[0].originY>400'));
  evaluate('updateBullets(300)');
  assert.equal(evaluate('front.externalMotion?.source'),'gun');
  assert.equal(evaluate('p.externalMotion'),null);
  assert.equal(evaluate('bullets.length'),0);
  const hitX=evaluate('screenEffects.groups.damage[0].x');
  assert.ok(hitX>500 && hitX<580,`hit at ${hitX}`);
  evaluate('clearPlayground("all");globalThis.front=spawnPet("doge",548,448);lastGunShotAt=-Infinity;shootGun(500,400);updateBullets(300)');
  assert.equal(evaluate('front.externalMotion?.source'),'gun','intervening Pet also hits with an empty dot');
});

test('shotgun emits ten independently resolved pellets and numbers', () => {
  pet('doge',500,400);
  evaluate("gunWeapon='double_barrel';lastGunShotAt=-Infinity;shootGun(500,400)");
  assert.equal(evaluate('bullets.length'),10);
  evaluate('updateBullets(120)');
  const hits=evaluate('screenEffects.groups.damage.length');
  assert.ok(hits>=2 && hits<=10,`shotgun pellet hits: ${hits}`);
  assert.equal(evaluate('bullets.length'),0);
  assert.equal(evaluate('petInstances.length'),1);
  assert.ok(evaluate('Math.abs(p.vx)<=30 && Math.abs(p.vy)<=30'));
});

test('short click throws grenade with a 3-second fuse and lifts a grounded Pet', () => {
  evaluate("currentMode='bomb';lastGunShotAt=-Infinity");
  event('canvas:mousedown',420,850,0);
  event('window:mouseup',420,850,20);
  assert.equal(evaluate('grenades.length'),1);
  assert.equal(evaluate('holes.length'),0);
  evaluate('updateGrenades(1000);drawEffects(1000)');
  assert.equal(evaluate('grenades.length'),1);
  assert.ok(evaluate('grenades[0].x>420 && grenades[0].y<=height-16'));
  evaluate('updateGrenades(1999);drawEffects(1999)');
  assert.equal(evaluate('holes.length'),0);
  const blastX=evaluate('grenades[0].x');
  pet('doge',blastX,865);
  evaluate('updateGrenades(1)');
  assert.equal(evaluate('grenades.length'),0);
  assert.equal(evaluate('holes.length'),1);
  assert.equal(evaluate('screenEffects.groups.crack.length'),0);
  assert.equal(evaluate('p.externalMotion.source'),'bomb');
  assert.ok(evaluate('p.vy< -4'),`vertical impulse ${evaluate('p.vy')}`);
});

test('hammer repeat enlarges local crack without changing Bomb crack policy', () => {
  evaluate('strikeHammer(400,400)');
  const first=evaluate('Math.max(...screenEffects.groups.crack[0].paths.flat().map(point=>Math.hypot(point.x,point.y)))');
  evaluate('strikeHammer(402,400)');
  const second=evaluate('Math.max(...screenEffects.groups.crack[1].paths.flat().map(point=>Math.hypot(point.x,point.y)))');
  assert.ok(second>first);
  evaluate('fireBomb(700,400)');
  assert.equal(evaluate('screenEffects.groups.crack.length'),2);
});

test('projectile and grenade elapsed-time motion agrees across 30/60/144 Hz', () => {
  const samples=[];
  for (const hz of [30,60,144]) {
    evaluate("clearPlayground('all');gunWeapon='ak47';lastGunShotAt=-Infinity;shootGun(700,400);throwGrenade(400,500)");
    for (let i=0;i<hz*.5;i++) evaluate(`updateBullets(${500/hz});updateGrenades(${500/hz});drawEffects(${500/hz})`);
    samples.push({bullet:evaluate('bullets.length'),x:evaluate('grenades[0].x'),y:evaluate('grenades[0].y')});
  }
  assert.ok(samples.every(item=>item.bullet===0));
  assert.ok(Math.max(...samples.map(item=>item.x))-Math.min(...samples.map(item=>item.x))<7);
  assert.ok(Math.max(...samples.map(item=>item.y))-Math.min(...samples.map(item=>item.y))<7);
});

test('drag release changes grenade direction and a full 24-object queue preserves earlier fuses', () => {
  evaluate("currentMode='bomb'");
  event('canvas:mousedown',600,450,0);
  event('window:mouseup',400,350,100);
  assert.ok(evaluate('grenades[0].vx<0 && grenades[0].vy<0'));
  evaluate('for(let i=0;i<40;i++)throwGrenade(600,450)');
  assert.equal(evaluate('grenades.length'),24);
  assert.ok(evaluate('grenades[0].vx<0 && grenades[0].vy<0'));
  assert.equal(evaluate('throwGrenade(600,450)'),null);
  evaluate('updateGrenades(2999);drawEffects(2999)');
  assert.equal(evaluate('grenades.length'),24);
  evaluate('globalThis.__blastCount=0;globalThis.__originalFireBomb=fireBomb;fireBomb=(...args)=>{__blastCount++;return __originalFireBomb(...args)}');
  evaluate('updateGrenades(1);drawEffects(1)');
  assert.equal(evaluate('grenades.length'),0);
  assert.equal(evaluate('__blastCount'),24);
  evaluate('fireBomb=__originalFireBomb');
  assert.ok(evaluate('holes.length<=8 && particles.length<=160'));
});

test('short grenade clicks select left, right or near-vertical arcs', () => {
  for(const [chance,sign] of [[0,-1],[.5,1],[.99,0]]) {
    evaluate(`clearPlayground('effects');Math.random=()=>${chance};throwGrenade(500,450)`);
    assert.equal(Math.sign(evaluate('grenades[0].vx')),sign);
    assert.ok(evaluate('grenades[0].vy<0'));
  }
});

console.log(`PASS: ${passed()-inherited} Gun cases plus ${inherited} Grab/Throw regressions`);
