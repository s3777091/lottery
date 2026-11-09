import { waterOrb } from './water-card.js';
// White jade dragon edition: a pearl-white dragon coils around a pale jade card, haloed by icy mist.
export const DRAGON_W=1360,DRAGON_H=740;
const TAU=Math.PI*2;
let solid,hair,glow,reach;
export function loadDragonCardAssets(){return new Promise(resolve=>{if(solid)return resolve();const image=new Image();image.onload=()=>{try{tintJade(image);glow=haze(solid);}catch{}resolve();};image.onerror=()=>resolve();image.src='/brand/dragon-calligraphy-v2.webp';});}
// Re-tints the gilded ornament as white jade and splits it in two layers: the dragon's body and clouds (gold → pearl)
// and the flowing ink mane (black → ice-blue), so the mane can billow on its own.
function tintJade(image){
 const sw=image.naturalWidth,sh=image.naturalHeight,make=()=>{const c=document.createElement('canvas');c.width=sw;c.height=sh;return c;};
 const src=make(),x=src.getContext('2d');x.drawImage(image,0,0);const s=x.getImageData(0,0,sw,sh).data;
 solid=make();hair=make();const sx=solid.getContext('2d'),hx=hair.getContext('2d'),a=sx.createImageData(sw,sh),b=hx.createImageData(sw,sh),da=a.data,db=b.data;
 const ramp=[[30,57,82],[103,139,161],[186,211,224],[235,246,252],[255,255,255]];
 for(let o=0;o<s.length;o+=4){
   if(!s[o+3])continue;const r=s[o],g=s[o+1],bl=s[o+2],lum=(r*.3+g*.59+bl*.11)/255;let cr,cg,cb,w;
   if(r>g*1.6&&r>80){cr=120+lum*90;cg=214+lum*40;cb=255;w=1;}
   else{const t=Math.min(1,Math.pow(lum,.8)*1.12)*4,k=Math.min(3,t|0),f=t-k,p=ramp[k],q=ramp[k+1];cr=p[0]+(q[0]-p[0])*f;cg=p[1]+(q[1]-p[1])*f;cb=p[2]+(q[2]-p[2])*f;w=Math.min(1,Math.max(0,(lum-.2)/.14));}
   da[o]=cr;da[o+1]=cg;da[o+2]=cb;da[o+3]=s[o+3]*w;db[o]=35+lum*120;db[o+1]=180+lum*75;db[o+2]=255;db[o+3]=s[o+3]*(1-w)*.94;
 }
 sx.putImageData(a,0,0);hx.putImageData(b,0,0);reach=distance(a.data,sw,sh);
}
// Coarse distance (in card pixels) from every point to the dragon's body: mane roots stay put, the tips sway widest.
function distance(alpha,sw,sh){
 const S=8,w=Math.ceil(sw/S),h=Math.ceil(sh/S),d=new Float32Array(w*h),k=1336/sw*S;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){let on=false;for(let yy=y*S;yy<Math.min(sh,y*S+S)&&!on;yy+=2)for(let xx=x*S;xx<Math.min(sw,x*S+S);xx+=2)if(alpha[(yy*sw+xx)*4+3]>140){on=true;break;}d[y*w+x]=on?0:1e9;}
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){let v=d[y*w+x];if(x)v=Math.min(v,d[y*w+x-1]+1);if(y)v=Math.min(v,d[(y-1)*w+x]+1);if(x&&y)v=Math.min(v,d[(y-1)*w+x-1]+1.41);if(y&&x<w-1)v=Math.min(v,d[(y-1)*w+x+1]+1.41);d[y*w+x]=v;}
 for(let y=h-1;y>=0;y--)for(let x=w-1;x>=0;x--){let v=d[y*w+x];if(x<w-1)v=Math.min(v,d[y*w+x+1]+1);if(y<h-1)v=Math.min(v,d[(y+1)*w+x]+1);if(x<w-1&&y<h-1)v=Math.min(v,d[(y+1)*w+x+1]+1.41);if(y<h-1&&x)v=Math.min(v,d[(y+1)*w+x-1]+1.41);d[y*w+x]=v;}
 return (u,v)=>{const x=Math.min(w-1,Math.round(u*(w-1))),y=Math.min(h-1,Math.round(v*(h-1)));return Math.min(400,d[y*w+x]*k);};
}
// A soft frost halo behind the dragon, blurred once so it can pulse cheaply.
function haze(src){
 const c=document.createElement('canvas');c.width=src.width/2;c.height=src.height/2;const x=c.getContext('2d');
 x.filter='blur(9px)';x.drawImage(src,0,0,c.width,c.height);x.filter='none';x.globalCompositeOperation='source-in';x.fillStyle='#00d9ff';x.fillRect(0,0,c.width,c.height);return c;
}
function panel(x,fresh=true){if(fresh)x.beginPath();x.moveTo(155,60);x.lineTo(930,60);x.lineTo(1028,122);x.lineTo(1028,397);x.lineTo(930,458);x.lineTo(155,458);x.lineTo(68,397);x.lineTo(68,122);x.closePath();}
function linear(x,colors,ax=0,ay=0,bx=1100,by=520){const g=x.createLinearGradient(ax,ay,bx,by);colors.forEach((v,i)=>g.addColorStop(i/(colors.length-1),v));return g;}
/** @returns {{canvas: HTMLCanvasElement, w: number, h: number}} */
export function dragonWinnerCard(o,scale=1){
 const canvas=document.createElement('canvas');canvas.width=Math.round(DRAGON_W*scale);canvas.height=Math.round(DRAGON_H*scale);const x=canvas.getContext('2d');x.scale(scale,scale);x.translate(130,110);
 panel(x);x.fillStyle=linear(x,['#417eab','#effcff','#70cfea','#ffffff','#4e9ebd']);x.shadowColor='#00d9ffbb';x.shadowBlur=30;x.fill();x.shadowBlur=0;x.save();x.clip();
 // Pale jade paper with indigo wave painting, like the reference fan, densest at the edges so names stay clear.
 const paper=x.createRadialGradient(560,250,60,560,260,560);paper.addColorStop(0,'#fbfdff');paper.addColorStop(.55,'#e9f0fb');paper.addColorStop(1,'#b9cbe8');x.fillStyle=paper;x.fillRect(12,18,1076,484);
 x.lineCap='round';
 for(let row=0;row<7;row++){
   const alpha=.32-row*.04;x.strokeStyle='rgba(84,120,184,'+alpha+')';x.lineWidth=row<2?2:1.3;
   for(const base of [478-row*20,40+row*20]){x.beginPath();for(let j=0;j<=110;j++){const px=40+j*9.6,py=base+Math.sin(j*.42+row*1.7)*6+Math.sin(j*1.1+row)*2;j?x.lineTo(px,py):x.moveTo(px,py);}x.stroke();}
 }
 for(const [cx,cy,s] of [[150,150,1],[960,390,1.2],[930,120,.8],[200,400,.9],[540,455,.7]]){x.strokeStyle='#6b8fca55';x.lineWidth=1.5;for(let k=0;k<3;k++){x.beginPath();x.arc(cx,cy,(8+k*8)*s,Math.PI*.9,Math.PI*2.25);x.stroke();}}
 for(let i=0;i<80;i++){x.fillStyle=i%3?'#60cde588':'#ffffffcc';x.beginPath();x.arc(30+(i*137)%1040,30+(i*71)%460,i%5?1.1:2,0,TAU);x.fill();}
 const veil=x.createRadialGradient(620,260,40,620,260,330);veil.addColorStop(0,'#ffffffcc');veil.addColorStop(1,'#ffffff00');x.fillStyle=veil;x.fillRect(0,0,1100,520);
 x.restore();
 x.save();x.translate(4,4);x.scale(1092/1100,512/520);panel(x);x.restore();x.strokeStyle='#ffffffaa';x.lineWidth=1.5;x.stroke();
 function text(value,cy,size,color,maxWidth=520,weight=700){if(!value)return;x.textAlign='center';x.textBaseline='middle';do{x.font=weight+' '+size+'px "Be Vietnam Pro", sans-serif';if(x.measureText(String(value)).width<=maxWidth)break;size--;}while(size>1);x.fillStyle=color;x.fillText(String(value),620,cy);}
 x.shadowColor='#ffffff';x.shadowBlur=8;
 text('WHITE JADE DRAGON',170,16,'#287d9c',300);text(o.name,228,60,'#13295a',520,800);text(o.vietnameseName,290,27,'#2f4f8c');
 const value=String(o.description||'').trim();let size=24,lines=[];
 if(value){do{lines=[];let line='';x.font='700 '+size+'px "Be Vietnam Pro", sans-serif';for(const word of value.split(/\s+/)){const next=line?line+' '+word:word;if(line&&x.measureText(next).width>520){lines.push(line);line=word;}else line=next;}if(line)lines.push(line);if(lines.length<=2&&lines.every(v=>x.measureText(v).width<=520))break;size--;}while(size>1);lines.forEach((v,i)=>text(v,344+(i-(lines.length-1)/2)*29,size,'#1d3a72',520));}
 text(o.info,402,19,'#28738e');
 x.shadowBlur=0;
 return {canvas,w:DRAGON_W,h:DRAGON_H};
}
// Slow, broad drift field shared by the mane and the flame tips: two crossing swells give a floating, underwater billow.
function drift(u,v,time){
 return {x:Math.sin(time*.9+u*6+v*2.5)+.55*Math.sin(time*1.55-v*8+u*3),y:Math.cos(time*.75+v*5.5-u*4.5)+.55*Math.sin(time*1.3+u*7.5)};
}
// Motion fades to zero at the boundaries of the two marked regions.
function motionRegion(u,v){
 const smooth=(a,b,t)=>{const k=Math.max(0,Math.min(1,(t-a)/(b-a)));return k*k*(3-2*k);};
 const head=(1-smooth(.23,.32,u))*(1-smooth(.43,.58,v));
 const tail=smooth(.62,.73,u)*(1-smooth(.76,.91,v));
 return {head,tail,weight:Math.max(head,tail)};
}
function bend(u,v,time){
 const {head,tail}=motionRegion(u,v),f=drift(u,v,time);
 return {x:head*(Math.sin(time*1.25)*5+f.x*3)+tail*(Math.sin(time*1.5-v*7)*7+f.x*7),
 y:head*(Math.sin(time*1.6+.6)*6+f.y*3)+tail*(Math.sin(time*1.7-v*8)*8+f.y*8)};
}
function billow(u,v,time){
 const {weight}=motionRegion(u,v),free=Math.min(1,Math.pow((reach?reach(u,v):30)/60,.8)),b=bend(u,v,time),f=drift(u,v,time),amp=(5+26*free)*weight;
 return {x:b.x+f.x*amp,y:b.y+f.y*amp};
}
function warp(ctx,image,cols,rows,move,time){
 const sw=image.width,sh=image.height,tw=sw/cols,th=sh/rows;
 const points=Array.from({length:rows+1},(_,r)=>Array.from({length:cols+1},(_,c)=>{const u=c/cols,v=r/rows,d=move(u,v,time);return {x:12+u*1336+d.x,y:10+v*716+d.y};}));
 function tile(a,b,c,origin,vx,vy,sx,sy){
   ctx.save();ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.lineTo(c.x,c.y);ctx.closePath();ctx.clip();
   ctx.transform(vx.x/tw,vx.y/tw,vy.x/th,vy.y/th,origin.x,origin.y);
   ctx.drawImage(image,sx,sy,tw,th,0,0,tw,th);ctx.restore();
 }
 for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
   const a=points[r][c],b=points[r][c+1],d=points[r+1][c],e=points[r+1][c+1];
   tile(a,b,d,a,{x:b.x-a.x,y:b.y-a.y},{x:d.x-a.x,y:d.y-a.y},c*tw,r*th);
   const origin={x:b.x+d.x-e.x,y:b.y+d.y-e.y};
   tile(b,e,d,origin,{x:e.x-d.x,y:e.y-d.y},{x:e.x-b.x,y:e.y-b.y},c*tw,r*th);
 }
}
// Only the head/mane on the left and the tail on the right animate.
export function dragonForeground(ctx,time,width,height){
 if(!solid)return;ctx.save();ctx.scale(width/DRAGON_W,height/DRAGON_H);
 celestialAccents(ctx,time,false);
 if(glow){ctx.globalAlpha=.85;ctx.globalCompositeOperation='screen';ctx.drawImage(glow,4,2,1352,732);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';}
 if(time===0){ctx.drawImage(hair,12,10,1336,716);ctx.drawImage(solid,12,10,1336,716);}
 else{
   // Small on-screen cards (the admin previews) need fewer mesh tiles; at projector size the mesh is unchanged.
   const T=ctx.getTransform(),s=Math.hypot(T.a,T.b),k=s>=.5?1:Math.max(.3,s*1.25);
   warp(ctx,hair,Math.ceil(34*k),Math.ceil(17*k),billow,time);warp(ctx,solid,Math.ceil(28*k),Math.ceil(14*k),bend,time);
 }
 celestialAccents(ctx,time,true);
 ctx.restore();
}

// Perspective-projected water ring: far water is hidden by the panel, near water crosses in front.
function celestialAccents(ctx,time,front){
 ctx.save();
 if(!front){ctx.beginPath();ctx.rect(-100,-100,DRAGON_W+200,DRAGON_H+200);ctx.translate(130,110);panel(ctx,false);ctx.translate(-130,-110);ctx.clip('evenodd');}
 const orbit=t=>{
 const a=t*TAU,X=Math.cos(a)*595,Y=Math.sin(a)*135,z=Math.sin(a)*270,p=1500/(1500-z),tilt=-.36;
 return {x:680+(X*Math.cos(tilt)-Y*Math.sin(tilt))*p,y:360+(X*Math.sin(tilt)+Y*Math.cos(tilt))*p,z,scale:p};
 };
 // Three liquid spheres in each group retain the approved diagonal depth motion.
 for(let side=0;side<2;side++)for(let i=0;i<3;i++){
 const phase=time/22+side*.5+i*.055,p=orbit(phase);if((p.z>=0)!==front)continue;
 waterOrb(ctx,time,p.x,p.y,[28,20,12][i]*p.scale,front?1:.7);
 // Small spherical droplets follow the same orbit, with the same liquid material.
 for(let j=0;j<2;j++){const q=orbit(phase-.012-j*.008);if((q.z>=0)===front)waterOrb(ctx,time,q.x,q.y,(2.5+j)*q.scale,front?.85:.5);}
 }
 ctx.restore();
}
