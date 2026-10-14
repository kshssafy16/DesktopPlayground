'use strict';
const assert = require('node:assert/strict');
const {spawn, execFileSync} = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const project = path.resolve(__dirname, '..');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'desktop-playground-window-order-'));
const appDir = path.join(scratch, 'app');
const appData = path.join(scratch, 'appdata');
let child, socket;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function port() { const s = net.createServer(); await new Promise(r => s.listen(0,'127.0.0.1',r)); const n=s.address().port; await new Promise(r=>s.close(r)); return n; }
async function until(fn, label) { for(let i=0;i<120;i++){try{const x=await fn();if(x)return x}catch{}await pause(100)}throw new Error('Timed out: '+label); }
async function connect(n) {
  const url=await until(async()=>{const rows=await(await fetch(`http://127.0.0.1:${n}/json/list`)).json();return rows.find(x=>x.url.endsWith('controls.html'))?.webSocketDebuggerUrl},'controls debugger');
  socket=new WebSocket(url);await new Promise((r,j)=>{socket.addEventListener('open',r,{once:true});socket.addEventListener('error',j,{once:true})});
  let seq=0;const pending=new Map();socket.addEventListener('message',e=>{const p=JSON.parse(e.data),item=pending.get(p.id);if(item){pending.delete(p.id);p.error?item.reject(new Error(p.error.message)):item.resolve(p.result)}});
  return expression=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method:'Runtime.evaluate',params:{expression,awaitPromise:true,returnByValue:true}}))}).then(r=>{if(r.exceptionDetails)throw new Error(r.exceptionDetails.text);return r.result.value});
}
const nativeScript = String.raw`
param([long]$Overlay,[long]$Controls,[long]$Probe,[int]$X,[int]$Y,[long]$Activate)
Add-Type @'
using System; using System.Runtime.InteropServices;
public class WinOrder {
 [StructLayout(LayoutKind.Sequential)] public struct Point { public int X,Y; }
 [DllImport("user32.dll")] public static extern IntPtr GetTopWindow(IntPtr h);
 [DllImport("user32.dll")] public static extern IntPtr GetWindow(IntPtr h,uint cmd);
 [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
 [DllImport("user32.dll")] public static extern IntPtr WindowFromPoint(Point p);
 [DllImport("user32.dll")] public static extern IntPtr GetAncestor(IntPtr h,uint flag);
 [DllImport("user32.dll")] public static extern IntPtr GetWindowLongPtr(IntPtr h,int index);
}
'@
if($Activate -gt 0){[void][WinOrder]::SetForegroundWindow([IntPtr]$Activate);Start-Sleep -Milliseconds 250}
$rank=@{};$h=[WinOrder]::GetTopWindow([IntPtr]::Zero);$i=0
while($h -ne [IntPtr]::Zero -and $i -lt 2000){$rank[$h.ToInt64()]=$i;$h=[WinOrder]::GetWindow($h,2);$i++}
$point=New-Object WinOrder+Point;$point.X=$X;$point.Y=$Y
$target=[WinOrder]::GetAncestor([WinOrder]::WindowFromPoint($point),2).ToInt64()
[pscustomobject]@{overlayRank=$rank[$Overlay];controlsRank=$rank[$Controls];probeRank=$rank[$Probe];activateRank=$rank[$Activate];foreground=[WinOrder]::GetForegroundWindow().ToInt64();hit=$target;overlayTopmost=([WinOrder]::GetWindowLongPtr([IntPtr]$Overlay,-20).ToInt64() -band 8) -ne 0;controlsTopmost=([WinOrder]::GetWindowLongPtr([IntPtr]$Controls,-20).ToInt64() -band 8) -ne 0;probeTopmost=([WinOrder]::GetWindowLongPtr([IntPtr]$Probe,-20).ToInt64() -band 8) -ne 0}|ConvertTo-Json -Compress
`;
function native(handles,activate=0) {
  return JSON.parse(execFileSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(scratch,'order.ps1'),String(handles.overlay),String(handles.controls),String(handles.probe),String(handles.x),String(handles.y),String(activate)],{encoding:'utf8'}));
}
async function run() {
  fs.mkdirSync(appDir,{recursive:true});fs.mkdirSync(appData,{recursive:true});
  fs.mkdirSync(path.join(appDir,'animation'),{recursive:true});
  for(const file of ['pet-animation.cjs','profiles.browser.js'])fs.copyFileSync(path.join(project,'animation',file),path.join(appDir,'animation',file));
  for(const file of ['main.js','local-pets.js','preload.js','index.html','renderer.js','screen-effects.js','styles.css','controls.html','controls.js','controls.css','spritesheet.webp','spritesheet_2.webp','package.json'])fs.copyFileSync(path.join(project,file),path.join(appDir,file));
  fs.mkdirSync(path.join(appDir,'assets'),{recursive:true});fs.copyFileSync(path.join(project,'assets/icon.png'),path.join(appDir,'assets/icon.png'));fs.cpSync(path.join(project,'assets/pets'),path.join(appDir,'assets/pets'),{recursive:true});
  for(const kind of ['weapons','tools'])fs.cpSync(path.join(project,'assets',kind),path.join(appDir,'assets',kind),{recursive:true});
  const main=path.join(appDir,'main.js');let code=fs.readFileSync(main,'utf8').replace("const USER_DATA_PATH = path.join(app.getPath('appData'), 'desktop-playground');","app.setPath('appData', process.env.WINDOW_TEST_APPDATA);\nconst USER_DATA_PATH = path.join(app.getPath('appData'), 'desktop-playground');");
  code+=String.raw`
let windowOrderProbe;
ipcMain.handle('smoke:window-order', (_event, action) => {
  if (action === 'create') {
    windowOrderProbe = new BrowserWindow({ x: 90, y: 90, width: 760, height: 520, show: true, title: 'Window order normal probe' });
    windowOrderProbe.loadURL('data:text/html,<body style="background:%23ffffff">Normal window probe</body>');
    windowOrderProbe.focus();
  } else if (action === 'focus') windowOrderProbe.focus();
  else if (action === 'maximize') { windowOrderProbe.maximize(); windowOrderProbe.focus(); }
  else if (action === 'minimize') windowOrderProbe.minimize();
  else if (action === 'restore') { windowOrderProbe.restore(); windowOrderProbe.focus(); }
  else if (action === 'hide-overlay') setState({enabled:false});
  else if (action === 'show-overlay') setState({enabled:true,mode:'pc'});
  else if (action === 'pc') setState({mode:'pc'});
  else if (['touch','draw','spawn','bomb','hammer','gun','blackhole'].includes(action)) setState({mode:action});
  else if (action === 'toolbar') showControls();
  else if (action === 'tray-click') tray.emit('click');
  else if (action === 'tray-menu') {
    const item = updateTrayMenu().getMenuItemById('show-toolbar');
    if (!item || item.label !== '툴바 표시') throw new Error('Tray toolbar restore item missing');
    item.click();
  }
  else if (action === 'demote') { overlayWindow.setAlwaysOnTop(false); controlsWindow.emit('blur'); }
  else if (action === 'minimize-overlay') overlayWindow.minimize();
  else if (action === 'restore-overlay') overlayWindow.restore();
  const handle = w => w && !w.isDestroyed() ? Number(w.getNativeWindowHandle().readBigUInt64LE()) : 0;
  const bounds=windowOrderProbe?.getBounds() || overlayWindow.getBounds();
  return {overlay:handle(overlayWindow),controls:handle(controlsWindow),probe:handle(windowOrderProbe),x:bounds.x+Math.floor(bounds.width/2),y:bounds.y+Math.floor(bounds.height/2),visible:overlayWindow.isVisible(),controlsVisible:controlsWindow.isVisible(),mode:state.mode,overlayFocused:overlayWindow.isFocused(),controlsFocused:controlsWindow.isFocused()};
});
`;
  fs.writeFileSync(main,code);
  const preload=path.join(appDir,'preload.js');fs.writeFileSync(preload,fs.readFileSync(preload,'utf8').replace('getState: () =>',"smokeWindowOrder: action => ipcRenderer.invoke('smoke:window-order',action),\n  getState: () =>"));
  fs.writeFileSync(path.join(scratch,'order.ps1'),nativeScript);
  const n=await port();child=spawn(path.join(project,'node_modules/electron/dist/electron.exe'),[appDir,`--remote-debugging-port=${n}`,'--host-resolver-rules=MAP * ~NOTFOUND'],{cwd:appDir,env:{...process.env,WINDOW_TEST_APPDATA:appData},stdio:'ignore'});
  const evaluate=await connect(n);await until(()=>evaluate('window.playground?.smokeWindowOrder'),'test hook');
  async function state(action){let h=await evaluate(`window.playground.smokeWindowOrder('${action}')`);
    if(['create','show-overlay','restore-overlay'].includes(action))h=await until(async()=>{const x=await evaluate("window.playground.smokeWindowOrder('status')");return x.visible?x:null},`${action} visible`);
    if(['hide-overlay','minimize-overlay'].includes(action))h=await until(async()=>{const x=await evaluate("window.playground.smokeWindowOrder('status')");return !x.visible?x:null},`${action} hidden`);
    await pause(160);return {h,z:native(h)}}
  for(const action of ['create','focus','maximize','minimize','restore','hide-overlay','show-overlay','toolbar','demote','minimize-overlay','restore-overlay','pc','touch','draw','spawn','bomb','hammer','gun','blackhole']){
    const {h,z}=await state(action);
    if(action==='hide-overlay'||action==='minimize-overlay'){
      assert.equal(h.visible,false,`${action}: overlay hidden`);
      assert.equal(h.controlsVisible,true,`${action}: toolbar stays visible`);
      continue;
    }
    if(action==='minimize')continue;
    assert.equal(h.visible,true,`${action}: overlay visible`);
    assert.equal(z.overlayTopmost,true,`${action}: overlay topmost ${JSON.stringify(z)}`);
    assert.equal(z.controlsTopmost,true,`${action}: controls topmost`);
    assert.ok(z.overlayRank<z.probeRank,`${action}: overlay above normal window ${JSON.stringify(z)}`);
    assert.ok(z.controlsRank<z.overlayRank,`${action}: toolbar above overlay ${JSON.stringify(z)}`);
    assert.equal(h.overlayFocused,false,`${action}: overlay must not steal focus`);
    if(action==='toolbar')assert.equal(h.controlsFocused,false,'toolbar restore must not steal focus');
    if(action==='pc')assert.ok(z.hit!==h.overlay&&z.hit!==h.controls,`${action}: native hit target ${JSON.stringify(z)}`);
    if(['touch','draw','spawn','bomb','hammer','gun','blackhole'].includes(action))assert.equal(z.hit,h.overlay,`${action}: native hit target ${JSON.stringify(z)}`);
    console.log(`PASS: ${action} z-order and input target`);
  }
  await evaluate("document.getElementById('touch-button').click()");
  await until(async()=> (await evaluate("window.playground.smokeWindowOrder('status')")).mode==='touch','touch mode before hiding toolbar');
  await evaluate("document.getElementById('toolbar-hide-button').click()");
  const hidden=await until(async()=>{
    const h=await evaluate("window.playground.smokeWindowOrder('status')");
    return !h.controlsVisible && h.mode==='pc' ? h : null;
  },'toolbar hidden in PC mode');
  let z=native(hidden);
  assert.equal(hidden.visible,true,'toolbar hide leaves Playground visible');
  assert.ok(z.overlayTopmost && z.overlayRank<z.probeRank,'hidden toolbar leaves overlay above normal window');
  assert.ok(z.hit!==hidden.overlay && z.hit!==hidden.controls,'hidden toolbar PC input passes through');
  console.log('PASS: toolbar hides independently and restores PC input passthrough');
  let result=await state('hide-overlay');
  assert.equal(result.h.controlsVisible,false,'Playground hide does not restore toolbar');
  result=await state('tray-menu');
  assert.ok(result.h.controlsVisible && !result.h.visible,'Tray menu restores toolbar while Playground stays hidden');
  assert.equal(result.z.controlsTopmost,true,'restored toolbar remains topmost');
  result=await state('show-overlay');
  assert.ok(result.h.controlsVisible && result.h.visible,'Playground show leaves restored toolbar visible');
  assert.ok(result.z.controlsRank<result.z.overlayRank && result.z.overlayRank<result.z.probeRank,'Tray restore keeps window order');
  assert.equal(result.h.controlsFocused,false,'Tray restore does not take normal window focus');
  await evaluate("document.getElementById('toolbar-hide-button').click()");
  await until(async()=>!(await evaluate("window.playground.smokeWindowOrder('status')")).controlsVisible,'toolbar hidden again');
  result=await state('tray-click');
  assert.ok(result.h.controlsVisible && result.h.visible,'Tray icon click still restores toolbar');
  console.log('PASS: Playground visibility is independent; Tray menu and icon restore toolbar');
  if(process.argv.includes('--real-apps')){
    const targets=JSON.parse(execFileSync('powershell.exe',['-NoProfile','-Command',"Get-Process chrome,Code,ChatGPT -ErrorAction SilentlyContinue | Where-Object MainWindowHandle -ne 0 | Select-Object ProcessName,MainWindowHandle | ConvertTo-Json -Compress"],{encoding:'utf8'}));
    for(const target of [].concat(targets||[])){
      const h=await evaluate("window.playground.smokeWindowOrder('toolbar')");
      const z=native(h,target.MainWindowHandle);
      if(z.foreground!==target.MainWindowHandle){console.log(`SKIP: ${target.ProcessName} foreground activation was denied`);continue}
      assert.ok(z.overlayRank<z.activateRank && z.controlsRank<z.overlayRank,`${target.ProcessName}: native order ${JSON.stringify(z)}`);
      console.log(`PASS: ${target.ProcessName} foreground keeps overlay/toolbar topmost`);
    }
  }
}
run().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{try{socket?.close();child?.kill()}catch{}await pause(200);fs.rmSync(scratch,{recursive:true,force:true})});
