import { loadDogCardAssets, dogWinnerCard, dogForeground } from './dog-card';
import { loadOxCardAssets, oxWinnerCard, oxEffect } from './ox-card';
import { loadMonkeyCardAssets, monkeyWinnerCard, monkeyEffect } from './monkey-card';
import { loadRoosterCardAssets, roosterWinnerCard, roosterForeground } from './rooster-card';
import { snakeWinnerCard, snakeForeground, snakeEffect } from './snake-card';
import { loadTigerCardAssets, tigerWinnerCard, tigerEffect } from './tiger-card';
import { loadDragonCardAssets, dragonWinnerCard, dragonForeground } from './dragon-card';
import { loadWaterCardAssets, waterWinnerCard, waterForeground } from './water-card';
import { drawSteedFlames, drawSteedTail } from './steed-fire';
import { loadZodiacFrameAssets } from './zodiac-frame';
// Shared collectible-card artwork for the projector and preview.
export const CARD_STYLES = {
  dog: { label: 'Linh Khuyển', edition: 'FROST HOUND', rarity: 'SACRED', base: '#081b35', edge: '#95dcff', light: '#eafaff', rank: 12 },
  ox: { label: 'Linh Ngưu', edition: 'CELESTIAL OX', rarity: 'ZODIAC', base: '#191925', edge: '#c9b5ff', light: '#eef5ff', rank: 11 },
  monkey: { label: 'Kim Hầu', edition: 'GOLDEN MONKEY', rarity: 'ZODIAC', base: '#101013', edge: '#e8cf94', light: '#f1f4ff', rank: 10 },
  rooster: { label: 'Ngọc Kê', edition: 'DAWN ROOSTER', rarity: 'CELESTIAL', base: '#f5f0df', edge: '#78c5bb', light: '#ffffff', rank: 9 },
  tiger: { label: 'Hỏa Hổ', edition: 'CRIMSON TIGER', rarity: 'SOVEREIGN', base: '#3d0b0d', edge: '#f2c46b', light: '#fff3d6', rank: 8 },
  snake: { label: 'Linh Xà', edition: 'CELESTIAL SERPENT', rarity: 'ZODIAC', base: '#170d68', edge: '#a9b6ff', light: '#f3f5ff', rank: 7 },
  dragon: { label: 'Bạch Ngọc Long', edition: 'WHITE JADE DRAGON', rarity: 'IMPERIAL', base: '#0d1d3d', edge: '#cfe6ff', light: '#ffffff', rank: 6 },
  water: { label: 'Thủy dương', edition: 'TIDAL GOAT', rarity: 'MYTHIC', base: '#04314b', edge: '#80e8f5', light: '#edffff', rank: 5 },
  blue: { label: 'Sapphire', edition: 'CHAMPIONS', rarity: 'ELITE', base: '#071d59', edge: '#68cfff', light: '#e7f7ff', rank: 1 },
  gold: { label: 'Thiên mã', edition: 'JADE STEED', rarity: 'LEGEND', base: '#560b10', edge: '#efcf81', light: '#fff4cd', rank: 3 },
};
let sapphireArt, horseArt, assetPromise, steedGL = false;
export function loadWinnerCardAssets() {
 if(!assetPromise) assetPromise=Promise.all([
  ['/brand/sapphire-gold-forged.webp',image=>{sapphireArt=image;}],
  ['/brand/jade-steed-calligraphy.webp',image=>{horseArt=image;}]
 ].map(([url,assign])=>new Promise(resolve=>{const image=new Image();image.onload=()=>{assign(image);resolve();};image.onerror=()=>{assetPromise=undefined;resolve();};image.src=url;})).concat([loadDogCardAssets(), loadOxCardAssets(), loadMonkeyCardAssets(), loadRoosterCardAssets(), loadWaterCardAssets(), loadDragonCardAssets(), loadZodiacFrameAssets(), loadTigerCardAssets()]));
 return assetPromise;
}

const W = 1100, H = 520;
// Separate silhouettes and compositions; only typography and rendering helpers are shared.
function outline(x, rank, inset=0) {
  const paths = [
    [[20,105],[90,25],[375,25],[402,44],[1000,44],[1080,115],[1080,430],[1015,495],[110,495],[20,405]],
    [[18,90],[70,38],[460,38],[490,18],[610,18],[640,38],[1030,38],[1082,90],[1082,430],[1030,482],[640,482],[610,502],[490,502],[460,482],[70,482],[18,430]],
    [[15,70],[155,28],[480,28],[510,48],[1010,20],[1085,105],[1058,240],[1085,390],[990,492],[660,472],[625,492],[110,492],[35,420],[55,235]],
    [[30,58],[100,25],[1000,25],[1070,58],[1070,450],[1000,495],[100,495],[30,450]],
    [[15,112],[75,72],[145,72],[170,35],[450,35],[480,15],[620,15],[650,35],[930,35],[955,72],[1025,72],[1085,112],[1085,410],[1030,452],[735,452],[700,477],[400,477],[365,452],[70,452],[15,410]]
  ];
  x.beginPath();paths[rank].forEach(([a,b],i)=>{const px=550+(a-550)*(1-inset/550),py=260+(b-260)*(1-inset/260);if(i)x.lineTo(px,py);else x.moveTo(px,py);});x.closePath();
}
function gradient(x, colors, x0=0,y0=0,x1=W,y1=H){const g=x.createLinearGradient(x0,y0,x1,y1);colors.forEach((v,i)=>g.addColorStop(i/(colors.length-1),v));return g;}
function polygon(x,points,fill,stroke){x.beginPath();points.forEach(([a,b],i)=>i?x.lineTo(a,b):x.moveTo(a,b));x.closePath();if(fill){x.fillStyle=fill;x.fill();}if(stroke){x.strokeStyle=stroke;x.lineWidth=1;x.stroke();}}
function star(x,cx,cy,r,color){x.beginPath();for(let j=0;j<10;j++){const a=j*Math.PI/5-Math.PI/2,d=j%2?r*.42:r;x.lineTo(cx+Math.cos(a)*d,cy+Math.sin(a)*d);}x.closePath();x.fillStyle=color;x.fill();}
function artwork(x,st){const {rank,base,edge,light}=st;
  outline(x,rank);x.fillStyle=gradient(x,[light,edge,'#302b31',light,edge,'#554438',light]);x.fill();
  outline(x,rank,7);x.fillStyle='#060a13';x.fill();outline(x,rank,13);x.strokeStyle=edge+'aa';x.lineWidth=2;x.stroke();
  outline(x,rank,19);x.fillStyle=gradient(x,[base,'#080d19',base]);x.fill();x.save();x.clip();
  if(rank===0){
    // Emerald: asymmetrical forged armour, a large jewel on the left, engraved ribs.
    polygon(x,[[0,0],[328,0],[263,520],[0,520]],gradient(x,['#041f1d','#195d49','#051e1d']));
    for(let i=0;i<8;i++)polygon(x,[[20+i*29,20],[45+i*29,20],[165+i*14,500],[144+i*14,500]],i%2?edge+'16':edge+'30');
    polygon(x,[[170,115],[265,210],[222,331],[140,365],[71,265],[95,170]],gradient(x,[light,'#1a8b6a','#042e26',edge]),edge);
    polygon(x,[[170,115],[174,247],[95,170]],'#dcfff166');polygon(x,[[174,247],[265,210],[222,331]],'#000b');
    polygon(x,[[140,365],[174,247],[71,265]],'#79ffc455');
    polygon(x,[[300,55],[985,55],[1038,102],[290,102]],edge+'15',edge+'66');
    polygon(x,[[280,405],[1070,405],[1010,465],[267,465]],'#06392dcc',edge+'55');
  } else if(rank===1){
    // Detailed gold-leaf artwork replaces the stadium for this edition.
    if (sapphireArt) x.drawImage(sapphireArt,20,25,1060,470);
    const shade=x.createRadialGradient(550,295,80,550,295,460);
    shade.addColorStop(0,'#01091ce8');shade.addColorStop(.65,'#02102e88');shade.addColorStop(1,'#02102e00');x.fillStyle=shade;x.fillRect(0,0,W,H);
    outline(x,rank,22);x.strokeStyle='#1dece9';x.shadowColor='#03fff2';x.shadowBlur=18;x.lineWidth=3;x.stroke();x.shadowBlur=0;
    outline(x,rank,30);x.strokeStyle='#ffe4a1';x.lineWidth=2;x.stroke();
  } else if(rank===2){
    // Phantom: diagonal fractured holographic wings; right-aligned rarity block.
    for(let i=0;i<15;i++){const px=i*90-130;polygon(x,[[px,0],[px+180,0],[px+10,520],[px-65,520]],gradient(x,['#b9fbff33','#cc77ff18','#ff96e844']),i%3===0?edge+'66':undefined);}
    for(const side of [0,1]){x.save();if(side){x.translate(1100,520);x.rotate(Math.PI);}for(let i=0;i<5;i++)polygon(x,[[25+i*38,50],[330+i*40,65],[85+i*32,205+i*31]],i%2?'#c3faff44':'#df9cff44',light+'77');x.restore();}
    polygon(x,[[160,190],[1030,130],[954,361],[100,405]],'#10091eea',edge+'77');
    polygon(x,[[780,60],[1002,48],[1040,110],[800,127]],gradient(x,['#a4edff','#e8b0ff','#7865a4']));
  } else if(rank===3){
    // Matte black grain, like sand-blasted iron; only a faint ember warmth near the lower rail.
    x.fillStyle=gradient(x,['#100c0d','#18110f','#0b0909','#140e0d'],0,0,W,H);x.fillRect(0,0,W,H);
    x.fillStyle=x.createPattern(matteGrain(),'repeat');x.fillRect(0,0,W,H);
    for(const [cx,cy,r] of [[90,500,360],[1010,500,360]]){
      const g=x.createRadialGradient(cx,cy,0,cx,cy,r);g.addColorStop(0,'#6e0d0630');g.addColorStop(1,'#6e0d0600');x.fillStyle=g;x.fillRect(0,0,W,H);
    }
    const depth=x.createRadialGradient(550,255,95,550,255,460);depth.addColorStop(0,'#05030380');depth.addColorStop(1,'#05030300');x.fillStyle=depth;x.fillRect(0,0,W,H);
    x.strokeStyle='#f0cf7a';x.lineWidth=2;x.strokeRect(55,55,990,410);
    // Engraved corner brackets instead of the old metal wings.
    for(const [cx,cy,angle] of [[65,65,0],[1035,65,Math.PI/2],[1035,455,Math.PI],[65,455,-Math.PI/2]]){
      x.save();x.translate(cx,cy);x.rotate(angle);x.beginPath();x.moveTo(0,40);x.lineTo(0,0);x.lineTo(70,0);x.moveTo(10,28);x.lineTo(10,10);x.lineTo(52,10);x.strokeStyle='#ffe3a0';x.lineWidth=3;x.stroke();x.restore();
    }
  } else {
    // Ultimate: black obsidian, sculpted gold wings and a suspended central crown.
    const halo=x.createRadialGradient(550,120,10,550,180,420);halo.addColorStop(0,'#f8d48c44');halo.addColorStop(1,'#00000000');x.fillStyle=halo;x.fillRect(0,0,W,H);
    for(const side of [0,1]){x.save();if(side){x.translate(W,0);x.scale(-1,1);}for(let i=0;i<7;i++)polygon(x,[[30+i*22,110+i*34],[277-i*14,160+i*21],[175-i*12,190+i*31],[30+i*17,156+i*32]],gradient(x,['#fff1ba','#96713e','#efce88','#49351b']),edge+'88');x.restore();}
    polygon(x,[[472,97],[458,57],[510,78],[550,36],[590,78],[642,57],[628,97]],gradient(x,[light,'#bd8b43',edge]),light);
    polygon(x,[[340,160],[760,160],[815,190],[815,347],[760,377],[340,377],[285,347],[285,190]],gradient(x,['#443529','#0b0b13','#31271f']),edge+'88');
    for(let i=0;i<5;i++)star(x,490+i*30,410,8,edge);
  }
  x.restore();
}
// Tileable speckle: pale and dark grit plus rare warm glints give the black a matte, gritty surface.
let grain;
function matteGrain(){
 if(grain)return grain;
 grain=document.createElement('canvas');grain.width=grain.height=160;
 const g=grain.getContext('2d'),img=g.createImageData(160,160),d=img.data;
 for(let i=0;i<d.length;i+=4){
   const r=Math.random();
   if(r<.004){d[i]=255;d[i+1]=180;d[i+2]=120;d[i+3]=70+Math.random()*90;}
   else if(r<.5){d[i]=d[i+1]=d[i+2]=235;d[i+3]=Math.random()*16;}
   else{d[i+3]=Math.random()*60;}
 }
 g.putImageData(img,0,0);return grain;
}
// Layered fire tongues and rising embers; lettering remains in the darker center.
function drawSteedFire(ctx,time){
 ctx.save();
 for(let layer=0;layer<3;layer++)for(let i=0;i<24;i++){
   const px=28+i*46+Math.sin(i*5.3)*14,edge=Math.abs(px-550)/550;
   const h=(48+edge*150+(i*37)%83)*(1-layer*.23);
   const sway=Math.sin(time*(2.1+i%3*.3)+i*2.4)*17,top=492-h*(.92+Math.sin(time*3+i)*.10);
   ctx.beginPath();ctx.moveTo(px-27,495);
   ctx.bezierCurveTo(px-48,450,px+24+sway,top+45,px+sway,top);
   ctx.bezierCurveTo(px+62+sway,top+48,px+10,453,px+32,495);ctx.closePath();
   ctx.fillStyle=gradient(ctx,layer===0?['#ff2400cc','#e52b0099','#a70a0000']:layer===1?['#ff8a13dd','#ff4c0088','#ff380000']:['#ffe9a7ee','#ffb12a99','#ff700000'],px,500,px,top);ctx.fill();
 }
 for(const side of [0,1]){
   ctx.save();if(side){ctx.translate(W,0);ctx.scale(-1,1);}
   for(let i=0;i<7;i++){
     const py=480-i*62,wave=Math.sin(time*2.8+i*1.9)*13;
     ctx.beginPath();ctx.moveTo(38,py+35);ctx.bezierCurveTo(165,py+10,68,py-44,120+wave,py-96);ctx.bezierCurveTo(30,py-62,60,py-5,38,py-12);ctx.closePath();
     ctx.fillStyle=gradient(ctx,['#ff3000bb','#ffaf39bb','#ff4a0000'],35,py+25,125,py-95);ctx.fill();
   }ctx.restore();
 }
 ctx.globalCompositeOperation='screen';
 for(let i=0;i<65;i++){
   const f=(time*(.13+i%5*.019)+i*.137)%1;
   const px=48+(i*157)%1005+Math.sin(time*1.4+i)*16,py=488-f*445;
   const center=px>300&&px<800&&py>85&&py<370;
   ctx.globalAlpha=Math.sin(f*Math.PI)*(center?.12:.85);ctx.fillStyle=i%4?'#ff802d':'#ffe4a0';
   ctx.beginPath();ctx.ellipse(px,py,1.2+i%3*.6,2.5+i%4,.45,0,Math.PI*2);ctx.fill();
 }
 ctx.restore();
}
// Foreground gold leaf lives outside the card clip, with transparent canvas bleed.
function goldBreakout(x,time=0, floatingOnly=false){
 const pieces=[
  {cx:925,cy:66,r:72,a:-.5},{cx:991,cy:20,r:49,a:.15},
  {cx:1052,cy:84,r:55,a:.75},{cx:1090,cy:25,r:30,a:-.3},
  {cx:1026,cy:-42,r:19,a:.6},{cx:1124,cy:88,r:22,a:.4},
  {cx:1150,cy:37,r:15,a:-.4},{cx:961,cy:-29,r:14,a:.2}
 ];
 pieces.forEach((p,i)=>{
   if(floatingOnly&&i<4)return;if(!floatingOnly&&i>=4)return;
   x.save();x.translate(p.cx,p.cy+(i>=4?Math.sin(time*.9+i)*6:0));x.rotate(p.a+(i>=4?Math.sin(time*.6+i)*.08:0));
   const r=p.r;
   const points=[[-r*.8,-r*.35],[r*.3,-r],[r*.92,-r*.1],[r*.4,r*.75],[-r*.65,r*.6]];
   x.shadowColor='#000b';x.shadowBlur=12;x.shadowOffsetY=7;
   polygon(x,points,gradient(x,['#fff6bb','#ad7924','#f5d68a'],-r,-r,r,r),'#ffe9a8');
   x.shadowBlur=0;x.shadowOffsetY=0;
   x.save();polygon(x,points);x.clip();
   if(sapphireArt){const sw=sapphireArt.naturalWidth,sh=sapphireArt.naturalHeight;x.drawImage(sapphireArt,sw*.78,sh*.03,sw*.2,sh*.35,-r,-r,r*2,r*2);}
   x.restore();
   polygon(x,[[-r*.8,-r*.35],[r*.1,0],[r*.3,-r]],'#fff4bb66');
   polygon(x,[[r*.1,0],[r*.92,-r*.1],[r*.4,r*.75]],'#38220855');
   x.beginPath();x.moveTo(-r*.65,r*.6);x.lineTo(r*.1,0);x.lineTo(r*.3,-r);x.strokeStyle='#fff4c9bb';x.lineWidth=1.5;x.stroke();x.restore();
 });
}
/** @returns {{canvas: HTMLCanvasElement, w: number, h: number}} */
export function winnerCard(o,scale=1){
 if(o.tier==='dog')return dogWinnerCard(o,scale);
 if(o.tier==='ox')return oxWinnerCard(o,scale);
 if(o.tier==='monkey')return monkeyWinnerCard(o,scale);
 if(o.tier==='rooster')return roosterWinnerCard(o,scale);
 if(o.tier==='tiger')return tigerWinnerCard(o,scale);
 if(o.tier==='snake')return snakeWinnerCard(o,scale);
 if(o.tier==='dragon')return dragonWinnerCard(o,scale);
 if(o.tier==='water')return waterWinnerCard(o,scale);
 const breakout=o.tier==='blue',horse=o.tier==='gold';const canvasW=breakout?1260:horse?1320:W,canvasH=breakout?660:horse?700:H;
 const c=document.createElement('canvas');c.width=Math.round(canvasW*scale);c.height=Math.round(canvasH*scale);const x=c.getContext('2d');x.scale(scale,scale);if(breakout)x.translate(45,100);else if(horse)x.translate(110,130);
 const st=CARD_STYLES[o.tier]||CARD_STYLES.gold;artwork(x,st);const {rank,edge,light}=st;
 function text(value,cx,cy,size,color,maxWidth=700,weight=700){if(!value)return;value=String(value);x.textAlign='center';x.textBaseline='middle';let m;do{x.font=weight+' '+size+'px "Be Vietnam Pro", sans-serif';m=x.measureText(value);if(m.width<=maxWidth&&(m.actualBoundingBoxAscent||size)+(m.actualBoundingBoxDescent||0)<=size*1.4)break;size--;}while(size>1);x.fillStyle=color;x.fillText(value,cx,cy);}
 const ink=rank===3?'#fff2c0':light;
 // Different placement and hierarchy for each edition, not a shared recolored template.
 const layouts=[{cx:660,ny:220,vy:296,dy:354,iy:439,mw:690},{cx:550,ny:254,vy:324,dy:382,iy:449,mw:780},{cx:560,ny:258,vy:325,dy:396,iy:452,mw:720},{cx:550,ny:217,vy:286,dy:345,iy:413,mw:650},{cx:550,ny:234,vy:305,dy:351,iy:447,mw:500}];
 const l=layouts[rank];
 if(rank===0){text(st.edition,640,80,21,edge,600);text(st.rarity,166,414,24,light,160);}
 if(rank===1){text(st.edition,550,147,20,'#ffe3a0');text(st.rarity,550,185,13,'#e5c987');}
 if(rank===2){text(st.edition,260,119,22,light,330);text(st.rarity,910,87,25,'#201130',180);}
 if(rank===3){text(st.edition,550,112,22,'#ffe3a1');text(st.rarity,550,150,13,'#e3c07a');}
 if(rank===4){text(st.edition,550,127,19,edge);text(st.rarity,550,190,18,edge);}
 text(o.name,l.cx,l.ny,rank===4?56:64,ink,l.mw,800);
 text(o.vietnameseName,l.cx,l.vy,27,rank===3?'#f2d78f':edge,l.mw);
 const value=String(o.description||'').trim();let lines=[],size=24;
 if(value){do{lines=[];let line='';x.font='600 '+size+'px "Be Vietnam Pro", sans-serif';for(const word of value.split(/\s+/)){const next=line?line+' '+word:word;if(line&&x.measureText(next).width>l.mw-40){lines.push(line);line=word;}else line=next;}if(line)lines.push(line);if(lines.length<=2&&lines.every(v=>x.measureText(v).width<=l.mw-40))break;size--;}while(size>1);lines.forEach((v,i)=>text(v,l.cx,l.dy+(i-(lines.length-1)/2)*28,size,ink,l.mw-40,600));}
 text(o.info,l.cx,l.iy,20,rank===3?'#fff0b4':light,l.mw,600);
 if(breakout){goldBreakout(x);}
 // Abstract gold calligraphy and flame mane sit above the frame; the center stays open.
 if(horse){
   // Small lacquer cuts interrupt the exposed rail and overlap its silhouette.
   for(const [px,py,flip] of [[265,28,1],[355,32,1],[731,30,-1],[816,29,-1],[294,493,-1],[782,494,1]]){
     x.save();x.translate(px,py);x.scale(flip,py>260?-1:1);
     polygon(x,[[-30,13],[-8,-8],[29,-16],[13,3],[36,9],[0,23]],gradient(x,['#6a0c12','#bd2b1f','#40060e']), '#e4b65c88');
     x.beginPath();x.moveTo(-23,13);x.lineTo(11,2);x.lineTo(27,-12);x.strokeStyle='#f5d48d';x.lineWidth=1;x.stroke();x.restore();
   }
 }

 return {canvas:c,w:canvasW,h:canvasH};
}
// Foreground is separate from the cached card so the mane itself can flutter.
export function drawWinnerCardForeground(ctx,tier,time,width,height){
 if(tier==='dog')return dogForeground(ctx,time,width,height);
 if(tier==='ox'||tier==='monkey')return;
 if(tier==='rooster')return roosterForeground(ctx,time,width,height);
 if(tier==='tiger')return; // the tiger frame is painted into the cached card
 if(tier==='snake')return snakeForeground(ctx,time,width,height);
 if(tier==='dragon')return dragonForeground(ctx,time,width,height);
 if(tier==='water')return waterForeground(ctx,time,width,height);
 if(tier!=='gold'||!horseArt)return;
 ctx.save();ctx.scale(width/1320,height/700);ctx.translate(110,130);
 const sw=horseArt.naturalWidth,sh=horseArt.naturalHeight,split=Math.floor(sw*.70);
 const dx=-105,dy=-120,dw=1310,dh=655;
 ctx.shadowColor='#16000699';ctx.shadowBlur=8;ctx.shadowOffsetY=5;
 ctx.drawImage(horseArt,0,0,split,sh,dx,dy,dw*split/sw,dh);
 ctx.shadowBlur=0;ctx.shadowOffsetY=0;
 if(drawSteedTail(ctx,time,horseArt,split,[dx+dw*split/sw,dy,dw*(sw-split)/sw,dh])){ctx.restore();return;}
 const count=44;
 for(let i=0;i<count;i++){
   const sy=sh*i/count,eh=Math.min(sh-sy,sh/count+1),f=i/count;
   const weight=Math.pow(Math.max(0,1-f),1.6);
   const sway=time===0?0:Math.sin(time*2.7-f*5)*5*weight+Math.sin(time*4.1-f*9)*1.5*weight;
   ctx.drawImage(horseArt,split,sy,sw-split,eh,dx+dw*split/sw+sway,dy+dh*i/count,dw*(sw-split)/sw,dh*eh/sh);
 }
 ctx.restore();
}
export function drawWinnerCardEffect(ctx,tier,time,width,height){
 if(tier==='dog')return; // the dog card animates entirely in its foreground pass
 if(tier==='ox')return oxEffect(ctx,time,width,height);
 if(tier==='monkey')return monkeyEffect(ctx,time,width,height);
 if(tier==='rooster'||tier==='dragon')return; // these cards animate only in their foreground pass
 if(tier==='tiger')return tigerEffect(ctx,time,width,height);
 if(tier==='snake')return snakeEffect(ctx,time,width,height);
 if(tier==='water')return; // the water card animates entirely in its foreground pass
 const st=CARD_STYLES[tier]||CARD_STYLES.gold;const {rank,edge,light}=st;ctx.save();ctx.scale(width/(rank===1?1260:rank===3?1320:W),height/(rank===1?660:rank===3?700:H));if(rank===1)ctx.translate(45,100);else if(rank===3)ctx.translate(110,130);ctx.save();outline(ctx,rank,19);ctx.clip();ctx.globalCompositeOperation='screen';
 if(rank===0){for(let i=0;i<5;i++){const y=(time*48+i*90)%440+40;ctx.fillStyle=edge+'60';ctx.fillRect(39,y,230,2);}}
 else if(rank===1){
   // One soft diagonal foil reflection travels from upper-right to lower-left.
   const phase=(time*.18)%1;
   const sx=1280-phase*1500,sy=-100+phase*730;
   const foil=ctx.createLinearGradient(sx+110,sy-54,sx-110,sy+54);
   foil.addColorStop(0,'#ffe7a000');foil.addColorStop(.36,'#ffdf8810');foil.addColorStop(.5,'#fff6d53d');foil.addColorStop(.64,'#ffdf8810');foil.addColorStop(1,'#ffe7a000');
   ctx.fillStyle=foil;ctx.fillRect(25,25,1050,470);
   // Delicate moving engraved arcs and diamond flashes hug both sides.
   for(const side of [0,1]){
     ctx.save();if(side){ctx.translate(W,H);ctx.rotate(Math.PI);}
     for(let i=0;i<3;i++){
       ctx.beginPath();ctx.moveTo(53+i*13,95);ctx.bezierCurveTo(125+i*8,190,45+i*17,340,163+i*24,455);
       ctx.strokeStyle=i===0?'#91ecff55':'#f9d89433';ctx.lineWidth=1;ctx.stroke();
     }
     for(let i=0;i<8;i++){
       const f=(time*.07+i*.131)%1,px=61+Math.sin(f*Math.PI)*56,py=88+f*355;
       ctx.globalAlpha=Math.sin(f*Math.PI)*.6;
       star(ctx,px,py,i%3?2:5,i%2?'#a9efff':'#ffe0a0');
     }
     ctx.restore();
   }
   for(let i=0;i<34;i++){
     const px=70+(i*157)%960,py=480-((time*(20+i%4*9)+i*37)%430);
     if(px>170&&px<930&&py>205&&py<410)continue;
     ctx.globalAlpha=.2+.8*Math.pow(Math.sin(time*2+i*1.7),6);
     star(ctx,px,py,i%5===0?8:3,'#ffe5a1');
   }
   ctx.globalAlpha=.25+.65*Math.pow(Math.sin(time*1.4),12);
   ctx.beginPath();ctx.moveTo(97,174);ctx.lineTo(235,133);ctx.lineTo(219,157);ctx.lineTo(383,101);ctx.lineTo(366,126);ctx.lineTo(546,87);ctx.lineTo(535,113);ctx.lineTo(790,77);
   ctx.strokeStyle='#fff5c3';ctx.shadowColor='#ffc83b';ctx.shadowBlur=15;ctx.lineWidth=2;ctx.stroke();
 }
 else if(rank===2){const pos=(time*170)%1500-200;polygon(ctx,[[pos,30],[pos+40,30],[pos-100,490],[pos-145,490]],'#e9baff30');}
 else if(rank===3){
   steedGL=drawSteedFlames(ctx,time);
   if(!steedGL)drawSteedFire(ctx,time);

 }
 else {for(let i=0;i<22;i++){const px=100+(i*173)%900,py=475-((time*35+i*41)%400);if(px>280&&px<820&&py>160&&py<380)continue;ctx.globalAlpha=.25+.65*Math.pow(Math.sin(time+i),2);star(ctx,px,py,i%4?2:5,light);}}
 ctx.restore();
 // 2D mane tongues only when the WebGL tail (drawn in the foreground) is unavailable.
 if(rank===3&&!steedGL){
   ctx.globalCompositeOperation='screen';
   for(let i=0;i<12;i++){
     const bx=997+(i*47)%172,by=260-(i*31)%300;
     const wave=Math.sin(time*3.4+i*1.7),length=24+(i%4)*10+wave*7;
     ctx.beginPath();ctx.moveTo(bx-6,by+10);
     ctx.bezierCurveTo(bx-17,by-10,bx+14+wave*8,by-length*.6,bx+wave*12,by-length);
     ctx.bezierCurveTo(bx+26,by-length*.5,bx+9,by-2,bx+6,by+10);ctx.closePath();
     ctx.fillStyle=gradient(ctx,['#ffe8a0aa','#ff782455','#d6170600'],bx,by+10,bx,by-length);ctx.globalAlpha=.35+.2*Math.sin(time*2+i);ctx.fill();
   }
   for(let i=0;i<24;i++){
     const f=(time*(.12+i%3*.035)+i*.137)%1;
     const px=1005+(i*43)%175+Math.sin(time+i)*8,py=320-f*420;
     ctx.globalAlpha=Math.sin(f*Math.PI)*.7;star(ctx,px,py,i%4?1.3:2.5,'#ffc76f');
   }
 }
 if(rank===1){
   ctx.globalCompositeOperation='source-over';goldBreakout(ctx,time,true);
   for(const side of [0,1]){
     ctx.save();if(side){ctx.translate(W,H);ctx.rotate(Math.PI);}
     for(let i=0;i<5;i++){
       const px=19+(i%2)*23,py=147+i*59+Math.sin(time*.8+i)*3,r=8+(i%3)*4;
       ctx.save();ctx.translate(px,py);ctx.rotate(-.5+i*.67+Math.sin(time*.5+i)*.06);
       const shape=[[-r,-r*.25],[-r*.2,-r],[r*.8,-r*.5],[r*.5,r*.75],[-r*.7,r*.5]];
       ctx.shadowColor='#0009';ctx.shadowBlur=5;ctx.shadowOffsetY=3;
       polygon(ctx,shape,gradient(ctx,['#fff4bc','#bb8731','#efd58a'],-r,-r,r,r),'#ffecb6aa');ctx.shadowBlur=0;ctx.shadowOffsetY=0;
       if(sapphireArt){ctx.save();polygon(ctx,shape);ctx.clip();ctx.drawImage(sapphireArt,sapphireArt.naturalWidth*.80,sapphireArt.naturalHeight*.04,sapphireArt.naturalWidth*.15,sapphireArt.naturalHeight*.25,-r,-r,r*2,r*2);ctx.restore();}
       polygon(ctx,[[-r,-r*.25],[-r*.2,-r],[0,0]],'#fff6be77');ctx.restore();
     }
     ctx.restore();
   }
   ctx.globalCompositeOperation='screen';
   for(let i=0;i<8;i++){const px=950+(i*47)%205,py=-40+(i*31)%160;ctx.globalAlpha=Math.pow(Math.max(0,Math.sin(time*1.8+i)),8);star(ctx,px,py,6,'#fff2bd');}
 }
 ctx.restore();
}
