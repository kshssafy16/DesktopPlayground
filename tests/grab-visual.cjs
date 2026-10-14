// Real project via npm start, real RAF time, DOM pointer events via local CDP.
// Does not rewrite product files, settings, assets or physics. Hardware mouse QA is separate.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const net = require('node:net');
const { spawn, execFileSync } = require('node:child_process');
const crypto = require('node:crypto');
const root=path.resolve(__dirname,'..');
const label=process.argv[2];
if(!['before','after','legacy'].includes(label))throw new Error('Expected before, after or legacy');
const folder=path.join(root,'docs/v1.1/qa/grab-regression');fs.mkdirSync(folder,{recursive:true});
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let child,overlay,controls,started=false;
async function until(fn,name){for(let i=0;i<150;i++){try{const value=await fn();if(value)return value;}catch{}await wait(80);}throw new Error('Timeout: '+name);}
async function connect(port,suffix){
  const target=await until(async()=> (await (await fetch('http://127.0.0.1:'+port+'/json/list')).json()).find(x=>x.url.endsWith(suffix)),suffix);
  const socket=new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
  let id=0;const pending=new Map();
  socket.addEventListener('message',e=>{const p=JSON.parse(e.data),entry=pending.get(p.id);if(!entry)return;pending.delete(p.id);p.error?entry.reject(new Error(p.error.message)):entry.resolve(p.result);});
  return {eval(expression){return new Promise((resolve,reject)=>{const seq=++id;pending.set(seq,{resolve,reject});socket.send(JSON.stringify({id:seq,method:'Runtime.evaluate',params:{expression,awaitPromise:true,returnByValue:true}}));}).then(p=>{if(p.exceptionDetails)throw new Error(p.exceptionDetails.exception?.description||p.exceptionDetails.text);return p.result.value;});},close(){socket.close();}};
}
async function run(){
  const port=await new Promise(resolve=>{const server=net.createServer();server.listen(0,'127.0.0.1',()=>{const n=server.address().port;server.close(()=>resolve(n));});});
  child=process.platform==='win32'
    ? spawn(process.env.ComSpec||'cmd.exe',['/d','/s','/c','npm start -- --remote-debugging-port='+port],{cwd:root,windowsHide:true,stdio:['ignore','pipe','pipe']})
    : spawn('npm',['start','--','--remote-debugging-port='+port],{cwd:root,stdio:['ignore','pipe','pipe']});
  let log='';child.stdout.on('data',x=>{log=(log+x).slice(-6000);});child.stderr.on('data',x=>{log=(log+x).slice(-6000);});
  child.on('error',e=>console.error(e));
  try {overlay=await connect(port,'index.html');controls=await connect(port,'controls.html');}
  catch(e){throw new Error(e.message+'\n'+log+'\nIf an existing app holds the instance lock, close it before this QA.');}
  started=true;
  await controls.eval("playground.setEnabled(true);playground.setMode('touch')");
  await until(()=>overlay.eval("enabled && currentMode==='touch' && PlaygroundPetAnimation && petDefinitions.has('cat_face')"),'app ready');
  if(label==='legacy') {
    const original=execFileSync('git',['show','v1.0.0:renderer.js'],{cwd:root,encoding:'utf8'});
    assert.match(original,/walkRight: \{ row: 1, frames: 8, speed: 4 \}/);
    assert.match(original,/walkLeft: \{ row: 2, frames: 8, speed: 4 \}/);
    assert.ok(original.includes('-renderSize / 2, -renderSize / 2 - offsetY, renderSize, renderSize'));
    const png=await overlay.eval(`(() => {
      const out=document.createElement('canvas');out.width=1120;out.height=360;const c=out.getContext('2d');
      c.fillStyle='#edf2f6';c.fillRect(0,0,1120,360);const image=petDefinitions.get('salary-cat').asset;
      const size=39,renderSize=size*2.5,fw=image.naturalWidth/8,fh=image.naturalHeight/9;
      for(let r=0;r<2;r++)for(let col=0;col<8;col++){
        c.save();c.translate(col*140+70,r*180+90);
        c.drawImage(image,col*fw,(r+1)*fh,fw,fh,-renderSize/2,-renderSize/2-10,renderSize,renderSize);c.restore();
        c.fillStyle='#263f53';c.font='11px sans-serif';c.fillText('v1.0 row '+(r+1)+' col '+col,col*140+5,r*180+160);
      }
      return out.toDataURL('image/png');
    })()`);
    fs.writeFileSync(path.join(folder,'legacy-salary.png'),Buffer.from(png.split(',')[1],'base64'));
    console.log('PASS: v1.0.0 rows 1/2, eight cells and original offset/size replayed in real Electron Canvas');return;
  }
  const ids=await overlay.eval('Object.keys(PlaygroundPetProfiles.profiles)');
  const result={label,launch:'npm start -- --remote-debugging-port=<ephemeral-local-port>',input:'DOM MouseEvent via CDP; actual project RAF',heldMs:3200,samples:[],heldExtended:[],hashes:{}};
  for(const name of ['renderer.js','animation/pet-animation.cjs','animation/profiles.v1.json','screen-effects.js'])result.hashes[name]=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,name))).digest('hex');
  await overlay.eval(`clearPlayground('all');globalThis.grabQaCanvas=document.createElement('canvas');grabQaCanvas.width=1820;grabQaCanvas.height=${ids.length*180};globalThis.grabQaContext=grabQaCanvas.getContext('2d');grabQaContext.fillStyle='#edf2f6';grabQaContext.fillRect(0,0,1820,grabQaCanvas.height);`);
  async function capture(id,row,column,phase){
    const sample=await overlay.eval(`(() => {
      const q=globalThis.qaPet, c=grabQaContext; c.save();c.translate(${column*140+70}-q.x,${row*180+140}-q.size-q.y);q.draw(c);c.restore();
      c.strokeStyle='#a9b7c5';c.beginPath();c.moveTo(${column*140+8},${row*180+140});c.lineTo(${column*140+132},${row*180+140});c.stroke();
      c.fillStyle='#263f53';c.font='11px sans-serif';c.fillText('${id}',${column*140+4},${row*180+158});c.fillText('${phase}',${column*140+4},${row*180+175});
      const clip=q.spriteClip().clip,g=q.spriteGeometry();return {state:q.animationVisualState,column:g.column,row:clip.row,ms:q.animationMs,scale:g.scale,anchor:g.anchorY,clock:performance.now(),vx:q.vx,vy:q.vy};
    })()`);
    result.samples.push({id,phase,...sample});return sample;
  }
  for(let row=0;row<ids.length;row++){
    const id=ids[row];
    await overlay.eval(`clearPlayground('all');globalThis.qaPet=spawnPet('${id}',width/2,height/2);canvas.dispatchEvent(new MouseEvent('mousedown',{clientX:qaPet.x,clientY:qaPet.y,button:0,bubbles:true}));`);
    const start=await capture(id,row,0,'GrabStart');
    const columns=new Set();
    for(let t=1;t<=6;t++){await wait(400);const s=await capture(id,row,t,'Held '+t*400+'ms');columns.add(s.column);assert.equal(s.state,'held');}
    const last=result.samples.at(-1);assert.ok(last.clock-start.clock>=2300);
    await wait(800);
    const extended=await overlay.eval('({state:qaPet.animationVisualState,column:qaPet.spriteGeometry().column,clock:performance.now()})');
    assert.equal(extended.state,'held');assert.ok(extended.clock-start.clock>=3100);
    result.heldExtended.push({id,...extended});columns.add(extended.column);
    if(label==='after')assert.ok(columns.size>1,id+': Held is frozen');
    await overlay.eval("window.dispatchEvent(new MouseEvent('mouseup',{clientX:qaPet.x,clientY:qaPet.y,button:0,bubbles:true}))");
    assert.equal((await capture(id,row,7,'Release')).state,'release');
    await wait(180);await capture(id,row,8,'Recover');
    await overlay.eval(`qaPet.x=width/2;qaPet.y=height/2;globalThis.qaX=qaPet.x;globalThis.qaY=qaPet.y;canvas.dispatchEvent(new MouseEvent('mousedown',{clientX:qaX,clientY:qaY,button:0,bubbles:true}));`);
    await wait(25);await overlay.eval("canvas.dispatchEvent(new MouseEvent('mousemove',{clientX:qaX+60,clientY:qaY-30,bubbles:true}))");
    await wait(25);await overlay.eval("window.dispatchEvent(new MouseEvent('mouseup',{clientX:qaX+120,clientY:qaY-60,button:0,bubbles:true}))");
    assert.equal((await capture(id,row,9,'Throw')).state,'thrown');
    await wait(80);await capture(id,row,10,'Flight');
    await overlay.eval("qaPet.externalMotion=null;qaPet.motionCause=null;qaPet.vx=0;qaPet.vy=2;qaPet.y=height-qaPet.size-1;qaPet.autonomyHoldMs=500;qaPet.animationPlayer.reset();qaPet.animationEvent=null");
    await wait(50);assert.equal((await capture(id,row,11,'Landing')).state,'land');
    await wait(180);await capture(id,row,12,'Recovered');
    console.log(label+': '+id+' Held observed '+columns.size+' frames over real 3.2s; release/throw/land PASS');
  }
  fs.writeFileSync(path.join(folder,label+'-held.png'),Buffer.from((await overlay.eval("grabQaCanvas.toDataURL('image/png')")).split(',')[1],'base64'));
  // Eight time samples of each initial left/right clip, through the same live RAF.
  await overlay.eval("clearPlayground('all');grabQaCanvas.width=1120;grabQaCanvas.height=360;grabQaContext.fillStyle='#edf2f6';grabQaContext.fillRect(0,0,1120,360);globalThis.qaPet=spawnPet('salary-cat',width/2,height-39)");
  for(let row=0;row<2;row++){
    const sign=row===0?1:-1;
    await overlay.eval(`qaPet.x=width/2;qaPet.y=height-qaPet.size;qaPet.vy=0;qaPet.vx=${sign*2};qaPet.facingRight=${sign>0};qaPet.enterAutonomy('roam');qaPet.autonomy.remainingMs=10000;qaPet.exploreX=${sign>0?'width-80':'80'};qaPet.navigationUntil=performance.now()+10000;qaPet.animationPlayer?.reset();`);
    for(let t=0;t<8;t++){await wait(90);await capture('salary-cat',row,t,(sign>0?'Right ':'Left ')+t*90+'ms');}
  }
  fs.writeFileSync(path.join(folder,label+'-salary.png'),Buffer.from((await overlay.eval("grabQaCanvas.toDataURL('image/png')")).split(',')[1],'base64'));
  fs.writeFileSync(path.join(folder,label+'-samples.json'),JSON.stringify(result,null,2)+'\n');
  fs.copyFileSync(path.join(root,'animation/profiles.v1.json'),path.join(folder,label+'-profiles.json'));
  console.log('PASS: actual npm start / nine 3.2s Held sequences / native render QA: '+folder);
}
run().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{
  if(started&&controls){try{await controls.eval('playground.exit()');}catch{}await wait(700);}
  overlay?.close();controls?.close();
  // Only terminate the shell we spawned; an unrelated existing app is never closed.
  if(child&&child.exitCode===null)child.kill();
});
