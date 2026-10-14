const assert = require('node:assert/strict');
const { evaluate, pet, tick, test, passed } = require('./grab-throw.cjs');
const before = passed();

function surface(kind) {
  evaluate("clearPlayground('all');structuresEnabled=false;");
  const y = kind === 'floor' ? 900 : kind === 'draw' ? 599.5 : 600;
  if (kind === 'platform') evaluate("structuresEnabled=true;world.structures=[{id:1,type:'platform',x:50,y:600,width:1500,height:12,lastUsedAt:0}]");
  if (kind === 'draw') evaluate("world.drawnColliders=shapeSegments({id:1,kind:'line',size:1,points:[{x:50,y:600},{x:1550,y:600}]})");
  pet('blob',800,y-35);
  evaluate('p.exploreX=800;p.navigationUntil=Infinity');
  return y;
}

test('one autonomous jump lands once without floor/Platform/Draw rebound at 30/60/144 Hz', () => {
  for(const kind of ['floor','platform','draw']) for(const hz of [30,60,144]) {
    const y=surface(kind);
    evaluate('p.beginAutonomousJump(-12)');
    let landed=false, air=false;
    for(let i=0;i<hz*3;i++) {
      tick(1,60/hz);
      if(evaluate('p.vy>1'))air=true;
      if(air && evaluate('p.motionCause===null && p.vy===0')){landed=true;break;}
    }
    assert.ok(landed,`${kind}/${hz}: no landing`);
    assert.ok(Math.abs(evaluate('p.y+p.size')-y)<.01);
    assert.ok(evaluate('p.squish>1 && p.autonomyHoldMs>=200'));
    for(let i=0;i<hz;i++){tick(1,60/hz);assert.ok(evaluate('p.vy>=0'),`${kind}/${hz}: extra bounce`);}
    assert.equal(evaluate('p.externalMotion'),null);
    assert.equal(evaluate('p.autonomyHoldMs'),0);
    assert.ok(evaluate('Math.abs(p.squish-1)<.001'));
  }
});

test('the production autonomous floor and Platform decisions tag and finish their jump', () => {
  for(const kind of ['floor','platform']) {
    surface(kind);evaluate('Math.random=()=>0;p.update(1)');
    assert.ok(evaluate("p.vy<0 && p.motionCause==='autonomous-jump' && !p.externalMotion"));
    evaluate('Math.random=()=>.5');tick(180);
    assert.ok(evaluate('p.motionCause===null && p.vy===0'));
  }
});

test('ordinary falling also settles while deliberate Throw retains repeated rebounds', () => {
  surface('floor');evaluate('p.y=700;p.vy=20');tick(10);
  assert.equal(evaluate('p.vy'),0);
  surface('floor');evaluate('p.beginThrow(0,54)');
  let bounces=0,last=54;
  for(let i=0;i<400;i++){tick();const vy=evaluate('p.vy');if(last>0 && vy<0)bounces++;last=vy;}
  assert.ok(bounces>=2,`only ${bounces} external bounces`);
});

test('Throw and Bomb preserve floor/Platform/Draw rebound with explicit impulse ownership', () => {
  for(const kind of ['floor','platform','draw']) for(const source of ['throw','bomb']) {
    surface(kind);evaluate('p.y-=10');
    evaluate(source==='throw'?'p.beginThrow(0,35)':'p.beginImpact();p.vy=19');tick(2);
    assert.ok(evaluate('p.vy<0'),`${source}/${kind}: no rebound`);
    assert.equal(evaluate('p.externalMotion.source'),source);
  }
});

test('Bomb during an autonomous jump replaces its cause and eventually releases control', () => {
  surface('floor');evaluate('p.beginAutonomousJump(-12)');tick(10);
  evaluate('fireBomb(p.x+20,p.y+20)');
  assert.ok(evaluate("p.motionCause==='bomb' && p.externalMotion.source==='bomb' && p.vy<0"));
  let rebounds=0,last=evaluate('p.vy');
  for(let i=0;i<420;i++){tick();const vy=evaluate('p.vy');if(last>0 && vy<0)rebounds++;last=vy;}
  assert.ok(rebounds>0);
  assert.ok(evaluate('p.externalMotion===null && p.motionCause===null && p.exploreX!==null'));
});

test('Bomb protection has a deadline even if no landing is possible', () => {
  pet('blob');evaluate('height=1e8;p.beginAutonomousJump(-10);p.beginImpact();p.vx=10');tick(301);
  assert.equal(evaluate('p.externalMotion'),null);assert.equal(evaluate('p.motionCause'),null);
});

test('Bomb impulse uses the external wall path without autonomous steering', () => {
  for(const drawing of [false,true]) {
    surface('floor');evaluate('p.y=400;p.x=1550;p.beginImpact();p.vx=18');
    if(drawing)evaluate("p.x=700;world.drawnColliders=shapeSegments({id:1,kind:'line',size:1,points:[{x:750,y:100},{x:750,y:800}]})");
    tick(3);assert.ok(evaluate("p.vx<0 && p.externalMotion.source==='bomb'"));
  }
});

test('Grab/Throw/Black Hole cancel the previous autonomous jump owner', () => {
  const { event }=require('./grab-throw.cjs');
  surface('floor');evaluate('p.beginAutonomousJump(-12)');
  event('canvas:mousedown',800,865,0);assert.equal(evaluate('p.motionCause'),null);
  event('window:mouseup',800,865,100);assert.equal(evaluate('p.motionCause'),'throw');
  evaluate('p.externalMotion=null;p.beginAutonomousJump(-12);addBlackHole(p.x,p.y);updateBlackHoles(1)');
  assert.ok(evaluate('p.blackHoleOrbit && p.motionCause===null && p.externalMotion===null'));
});

console.log(`PASS: ${passed()-before} movement-cause cases plus ${before} legacy cases`);
