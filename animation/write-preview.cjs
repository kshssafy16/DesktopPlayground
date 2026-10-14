'use strict';
const fs = require('node:fs');
const path = require('node:path');
const profiles = require('./profiles.v1.json').profiles;
const output = path.resolve(__dirname, '../docs/v1.1/animation/preview.html');
const html = `<!doctype html>
<html lang="ko"><meta charset="utf-8"><title>펫 상태 플랫폼 독립 프리뷰</title>
<style>
body{font:14px system-ui;background:#f4f7fa;color:#243747;margin:24px}
header,section{max-width:1200px;margin:auto}nav{display:flex;gap:12px;flex-wrap:wrap;margin:16px 0}
select,button{font:inherit;padding:6px}#grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px}
article{background:white;padding:12px;border:1px solid #d5dde5;border-radius:8px}
canvas{width:160px;height:170px;background:#edf2f6}small{display:block;line-height:1.4}
</style><header><h1>9종 상태 표현 독립 프리뷰</h1>
<p>원본 spritesheet와 분리한 프로필을 직접 읽는 시각 점검용입니다. 물리·squash·실제 앱 렌더링은 재현하지 않습니다.
<a href="../qa/sprite-final/index.html">기존 실제 Pet.draw 전후 비교</a>를 함께 보세요.</p>
<nav><label>상태 <select id="state"></select></label><button id="toggle">일시정지</button></nav></header>
<section id="grid"></section>
<script>
const profiles=${JSON.stringify(profiles)};
const states=['idle','look','walkRight','walkLeft','jumpRise','jumpApex','fall','land','grabStart','held','release','thrown','bounce','hit','rest','sleep','wake'];
const target={jumpRise:'jump',jumpApex:'jump',land:'idle',grabStart:'drag',held:'drag',release:'idle',thrown:'fall',bounce:'fall',hit:'drag',wake:'idle'};
const mode={jumpRise:'once',jumpApex:'hold',fall:'hold',land:'once',grabStart:'once',held:'loop',release:'once',thrown:'hold',bounce:'once',hit:'once',sleep:'hold',wake:'once'};
const select=document.querySelector('#state');for(const state of states)select.add(new Option(state,state));
const grid=document.querySelector('#grid'),items=[];let running=true,start=performance.now();
document.querySelector('#toggle').onclick=e=>{running=!running;e.target.textContent=running?'일시정지':'재생';if(running)start=performance.now()};
select.onchange=()=>{start=performance.now();draw()};
for(const [id,profile] of Object.entries(profiles)){
 const article=document.createElement('article'),title=document.createElement('b'),canvas=document.createElement('canvas'),note=document.createElement('small');
 title.textContent=id;canvas.width=160;canvas.height=170;article.append(title,canvas,note);grid.append(article);
 const img=new Image();img.src='../../../assets/pets/'+id+'/spritesheet.webp';img.onload=draw;items.push({profile,canvas,note,img});
}
function clipFor(profile,state){const wanted=profile.clips[state]?state:(target[state]||state);let name=wanted;const seen=new Set();
 while(name&&!seen.has(name)){seen.add(name);let clip=profile.clips[name];if(clip){if(clip.mirrorOf)clip={...profile.clips[clip.mirrorOf],...clip,frames:profile.clips[clip.mirrorOf].frames,row:profile.clips[clip.mirrorOf].row};return {clip,name,wanted}}name=profile.fallback?.[name]||(name==='idle'?null:'idle')}
 return null}
function draw(){const state=select.value,t=running?performance.now()-start:0;
 for(const {profile,canvas,note,img} of items){const ctx=canvas.getContext('2d'),selection=clipFor(profile,state);ctx.clearRect(0,0,160,170);
 ctx.strokeStyle='#a2b5c4';ctx.beginPath();ctx.moveTo(5,145);ctx.lineTo(155,145);ctx.stroke();if(!selection||!img.complete)continue;
 const {clip,name,wanted}=selection,frames=clip.frames,kind=mode[state]||'loop';
 const index=kind==='hold'?(state==='jumpApex'?frames.length-1:0):kind==='once'?Math.min(Math.floor(t/clip.frameMs),frames.length-1):Math.floor(t/clip.frameMs)%frames.length;
 const col=frames[index],w=120*(clip.scale||1),h=130*(clip.scale||1),cx=80,anchorX=clip.frameAdjustments?.[col]?.center??clip.center??.5,anchorY=profile.origin==='center'?(clip.centerY??.5):(clip.frameAdjustments?.[col]?.foot??clip.foot??.976);
 ctx.save();if(clip.flip){ctx.translate(160,0);ctx.scale(-1,1)}
 ctx.drawImage(img,col*192,clip.row*208,192,208,cx-w*anchorX,profile.origin==='center'?85-h*anchorY:145-h*anchorY,w,h);ctx.restore();
 note.textContent=kind+' · '+name+(name!==wanted?' (fallback)':'')+' · row '+clip.row+' / col '+col;
 }}
function loop(){draw();requestAnimationFrame(loop)}loop();
</script></html>`;
fs.writeFileSync(output, html);
console.log(output);
