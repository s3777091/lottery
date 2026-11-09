// Water-goat edition: static layers composited each frame through a WebGL liquid surface
// (refraction, caustics, specular crests, lens droplets). Falls back to plain 2D without WebGL.
export const WATER_W = 1320, WATER_H = 720;
let ornament, layers, renderer;
export function loadWaterCardAssets(){return new Promise(resolve=>{if(ornament)return resolve();const image=new Image();image.onload=()=>{ornament=image;resolve();};image.onerror=()=>resolve();image.src='/brand/tidal-goat-abstract-v2.webp';});}
function rim(x,inset=0){
 const pts=[[30,120],[85,64],[254,44],[370,48],[490,24],[610,24],[730,48],[930,38],[1010,62],[1074,118],[1052,390],[1000,453],[820,477],[280,477],[99,453],[46,390]];
 x.beginPath();pts.forEach(([a,b],i)=>{const px=550+(a-550)*(1-inset/550),py=260+(b-260)*(1-inset/260);i?x.lineTo(px,py):x.moveTo(px,py);});x.closePath();
}
function linear(x,colors,ax=0,ay=0,bx=1100,by=520){const g=x.createLinearGradient(ax,ay,bx,by);colors.forEach((v,i)=>g.addColorStop(i/(colors.length-1),v));return g;}
function layer(scale,origin=true){const c=document.createElement('canvas');c.width=Math.round(WATER_W*scale);c.height=Math.round(WATER_H*scale);const x=c.getContext('2d');x.scale(scale,scale);if(origin)x.translate(110,130);return [c,x];}
function pond(x){
 rim(x);x.fillStyle=linear(x,['#effdff','#518aab','#eaffff','#236284','#b9ebff']);x.fill();
 rim(x,8);x.fillStyle='#031523';x.fill();rim(x,16);x.strokeStyle='#b5f7ff';x.lineWidth=2;x.stroke();
 rim(x,22);x.fillStyle=linear(x,['#075b78','#052d53','#031627','#06485e']);x.fill();x.save();x.clip();
 // Faint seigaiha engraving on the pond floor gives the refraction real structure to bend.
 for(let row=0;row<24;row++)for(let col=-1;col<14;col++){
   const cx=col*84+(row%2?42:0),cy=row*24-10;
   x.beginPath();x.arc(cx,cy,42,0,Math.PI*2);x.fillStyle=row%3?'#05304b':'#062f49';x.fill();
   for(const r of [40,30,20,10]){x.beginPath();x.arc(cx,cy,r,Math.PI,Math.PI*2);x.strokeStyle=r===40?'#8eeeff2e':'#8eeeff16';x.lineWidth=r===40?1.6:1;x.stroke();}
 }
 const glow=x.createRadialGradient(280,70,5,280,70,660);glow.addColorStop(0,'#52e6f945');glow.addColorStop(1,'#52e6f900');x.fillStyle=glow;x.fillRect(0,0,1100,520);
 const calm=x.createRadialGradient(550,262,40,550,262,430);calm.addColorStop(0,'#02121ff2');calm.addColorStop(.55,'#03192bb0');calm.addColorStop(1,'#03192b00');x.fillStyle=calm;x.fillRect(0,0,1100,520);
 for(let i=0;i<5;i++){
   const g=x.createRadialGradient(170+i*195,85+i%2*300,0,170+i*195,85+i%2*300,180);g.addColorStop(0,i%2?'#ecbd6b1c':'#c7f9ff26');g.addColorStop(1,'#c7f9ff00');x.fillStyle=g;x.fillRect(0,0,1100,520);
 }
 x.restore();
}
function lettering(x,o){
 x.shadowColor='#000d17';x.shadowBlur=10;
 function text(value,cy,size,color,maxWidth=640){if(!value)return;x.textAlign='center';x.textBaseline='middle';do{x.font='700 '+size+'px "Be Vietnam Pro", sans-serif';if(x.measureText(String(value)).width<=maxWidth)break;size--;}while(size>1);x.fillStyle=color;x.fillText(String(value),550,cy);}
 text('TIDAL GOAT',111,21,'#aeedff');text('MYTHIC',150,12,'#7bc5d7');text(o.name,218,62,'#efffff');text(o.vietnameseName,287,27,'#8fe9f2');
 const value=String(o.description||'').trim();let size=24,lines=[];
 if(value){do{lines=[];let line='';x.font='700 '+size+'px "Be Vietnam Pro", sans-serif';for(const word of value.split(/\s+/)){const next=line?line+' '+word:word;if(line&&x.measureText(next).width>600){lines.push(line);line=word;}else line=next;}if(line)lines.push(line);if(lines.length<=2&&lines.every(v=>x.measureText(v).width<=600))break;size--;}while(size>1);lines.forEach((v,i)=>text(v,346+(i-(lines.length-1)/2)*29,size,'#dbf8ff',600));}
 text(o.info,411,20,'#c8edfa');
}
/** @returns {{canvas: HTMLCanvasElement, w: number, h: number}} */
export function waterWinnerCard(o,scale=1){
 const [bg,bx]=layer(scale);pond(bx);
 const [text,tx]=layer(scale);lettering(tx,o);
 // Red: water surface extent. Green: softened copy that raises a meniscus against the rail.
 const [mask,mx]=layer(scale);mx.fillStyle='#000';mx.fillRect(-110,-130,WATER_W,WATER_H);rim(mx,22);mx.fillStyle='#f00';mx.fill();
 mx.globalCompositeOperation='lighter';mx.filter='blur(16px)';rim(mx,30);mx.fillStyle='#0f0';mx.fill();mx.filter='none';
 const [orn,ox]=layer(scale,false);if(ornament)ox.drawImage(ornament,8,8,1304,688);
 const [canvas,x]=layer(scale,false);x.drawImage(bg,0,0,WATER_W,WATER_H);x.drawImage(text,0,0,WATER_W,WATER_H);
 layers={bg,text,mask,orn,scale};
 return {canvas,w:WATER_W,h:WATER_H};
}
// Small articulated koi, drawn into their own layer and refracted beneath the surface.
function koi(ctx,cx,cy,angle,size,time,variant){
 ctx.save();ctx.translate(cx,cy);ctx.rotate(angle);ctx.scale(size,size);
 const beat=Math.sin(time*6+variant*2)*.35;
 ctx.fillStyle='#fff8df99';ctx.beginPath();ctx.ellipse(-3,-8,12,5,-.6+beat*.3,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.ellipse(-3,8,12,5,.6-beat*.3,0,Math.PI*2);ctx.fill();
 ctx.save();ctx.translate(-24,0);ctx.rotate(beat);ctx.beginPath();ctx.moveTo(5,0);ctx.bezierCurveTo(-7,-4,-15,-15,-22,-13);ctx.quadraticCurveTo(-15,0,-22,13);ctx.bezierCurveTo(-12,15,-6,3,5,0);ctx.fillStyle=variant%2?'#ff9149cc':'#e8faffcc';ctx.fill();ctx.restore();
 const body=linear(ctx,['#c0d9de','#fff9e5','#c6dbe5'],0,-10,0,10);
 ctx.beginPath();ctx.moveTo(25,0);ctx.bezierCurveTo(23,-11,-2,-14,-26,0);ctx.bezierCurveTo(-2,14,23,11,25,0);ctx.fillStyle=body;ctx.fill();
 ctx.save();ctx.clip();ctx.fillStyle=variant%2?'#f6a424':'#f54d2b';
 for(const [px,py,rx,ry] of [[13,-3,9,7],[-6,4,8,6],[-17,-4,5,4]]){ctx.beginPath();ctx.ellipse(px,py,rx,ry,.4,0,Math.PI*2);ctx.fill();}
 if(variant%3===0){ctx.fillStyle='#18334b';ctx.beginPath();ctx.ellipse(0,-4,5,4,-.3,0,Math.PI*2);ctx.fill();}ctx.restore();
 ctx.fillStyle='#142634';ctx.beginPath();ctx.arc(19,-4,1.3,0,Math.PI*2);ctx.fill();
 ctx.beginPath();ctx.moveTo(-14,0);ctx.quadraticCurveTo(1,-3,17,0);ctx.strokeStyle='#fffdf477';ctx.lineWidth=1;ctx.stroke();ctx.restore();
}
function school(x,time){
 x.setTransform(.5,0,0,.5,0,0);x.clearRect(0,0,WATER_W,WATER_H);x.translate(110,130);
 for(const i of [0,2,5]){
   const t=time*(.19+i%3*.025)+i*1.13,rx=i%2?392:360,ry=i%2?158:182;
   x.globalAlpha=.75+(i%3)*.1;koi(x,550+Math.cos(t)*rx,260+Math.sin(t)*ry,Math.atan2(Math.cos(t)*ry,-Math.sin(t)*rx),.72+(i%3)*.16,time,i);
 }
 x.globalAlpha=1;
}
// Lens droplets: splash arcs off the plume and horn, bubbles rising along the sides, resting dew.
function droplets(time){
 const out=new Float32Array(DROPS*4);let n=0;const put=(px,py,r,a)=>{out.set([px,py,r,a],n*4);n++;};
 for(let i=0;i<10;i++){
   const f=(time*(.15+i%3*.025)+i*.137)%1,right=i%3!==0,s=Math.sin(f*Math.PI);
   put((right?1140+(i*29)%110:120+(i*23)%90)+s*(right?24:-18),560-f*440+f*f*190,2.6+(i%3)*1.7,s);
 }
 for(let i=0;i<5;i++){
   const f=(time*(.045+i%2*.02)+i*.23)%1;
   put((i%2?1060+(i*37)%90:170+(i*41)%90)+Math.sin(time*1.3+i*2)*5,590-f*400,3.5+(i%3)*1.8,Math.min(1,f*6,(1-f)*5)*.85);
 }
 [[1222,196,15],[1270,474,10],[112,604,12]].forEach(([px,py,r],i)=>put(px+Math.sin(time*.5+i)*2,py+Math.sin(time*.8+i*2)*4,r,1));
 return out;
}
const DROPS=18;
const VERT='attribute vec2 a;varying vec2 vUv;void main(){vUv=vec2(a.x*.5+.5,.5-a.y*.5);gl_Position=vec4(a,0.,1.);}';
const FRAG=`precision highp float;
varying vec2 vUv;
uniform sampler2D uBg,uText,uKoi,uOrn,uMask;
uniform float uTime;
uniform vec4 uDrops[${DROPS}];
const vec2 SIZE=vec2(${WATER_W}.,${WATER_H}.);
const vec3 V=vec3(0.,0.,1.);
float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*f*(f*(f*6.-15.)+10.);
 return mix(mix(hash(i),hash(i+vec2(1.,0.)),u.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.)),u.x),u.y);}
float fbm(vec2 p){float v=0.,a=.5;mat2 m=mat2(1.6,1.2,-1.2,1.6);for(int i=0;i<3;i++){v+=a*noise(p);p=m*p;a*=.5;}return v;}
vec4 tex(sampler2D s,vec2 p){return texture2D(s,p/SIZE);}
// Height in card pixels: domain-warped swell plus a meniscus climbing the rail.
float height(vec2 p){
 vec2 q=p/210.;float t=uTime;
 vec2 w=vec2(fbm(q+vec2(0.,t*.13)),fbm(q+vec2(5.2,1.3)-vec2(t*.11,0.)));
 return fbm(q*1.3+w*1.9+vec2(t*.05,-t*.08))*46.+(1.-tex(uMask,p).g)*30.;
}
vec2 cell(vec2 p){float n=hash(p);return vec2(n,hash(p+n+17.));}
float voronoi(vec2 p,float t){vec2 i=floor(p),f=fract(p);float d1=8.,d2=8.;
 for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 g=vec2(float(x),float(y));vec2 o=.5+.42*sin(t+6.2831*cell(i+g));float d=length(g+o-f);if(d<d1){d2=d1;d1=d;}else if(d<d2)d2=d;}
 return d2-d1;}
void main(){
 vec2 p=vUv*SIZE;
 float inside=tex(uMask,p).r;
 float zone=1.-smoothstep(.78,1.08,length((p-vec2(660.,392.))/vec2(385.,182.)));
 float h=height(p),e=2.;
 vec3 N=normalize(vec3(-(height(p+vec2(e,0.))-h)/e,-(height(p+vec2(0.,e))-h)/e,1.));
 vec2 off=N.xy*48.*mix(1.,.25,zone)*inside;
 // Chromatic refraction of the pond floor.
 vec4 col=tex(uBg,p+off*1.1);col.r=tex(uBg,p+off).r;col.b=tex(uBg,p+off*1.2).b;
 float slope=length(N.xy);
 // Volume shading: faces turned toward the key light brighten, the rest sink darker.
 vec3 L1=normalize(vec3(-.28,-.38,1.)),L2=normalize(vec3(.45,.3,1.));
 col.rgb*=1.+inside*clamp((dot(N,L1)-L1.z)*2.2,-.4,.4);
 vec2 cq=p/88.+N.xy*1.4;
 float c=pow(1.-smoothstep(0.,.16,voronoi(cq,uTime*.8)),3.)+.6*pow(1.-smoothstep(0.,.14,voronoi(cq*1.7+3.1,-uTime*.6)),3.);
 col.rgb+=c*vec3(.5,.92,1.)*.2*inside*(1.-.75*zone)*col.a;
 vec4 k=tex(uKoi,p+off*1.6);
 float shadow=tex(uKoi,p+off*1.3+vec2(-9.,15.)).a;
 col.rgb*=1.-.45*shadow*inside;
 k*=inside;k.rgb=mix(k.rgb,k.a*vec3(.15,.42,.52),.3);
 col=k+(1.-k.a)*col;
 vec4 t=tex(uText,p+N.xy*3.*inside);
 col=t+(1.-t.a)*col;
 // Surface: hard key glints, a warm gold rim light, and white crests on the steepest faces.
 float s1=max(dot(N,normalize(L1+V)),0.),s2=max(dot(N,normalize(L2+V)),0.);
 vec3 light=vec3(1.)*(pow(s1,520.)*1.6+pow(s1,70.)*.14)+vec3(1.,.82,.5)*pow(s2,260.)*.6+vec3(.78,.96,1.)*smoothstep(.26,.55,slope)*.28;
 col.rgb+=light*inside*mix(1.,.4,zone)*col.a;
 // Ornament: liquid parts shimmer and pick up a slowly orbiting light from their own relief.
 float v=(p.y-8.)/688.,u=(p.x-8.)/1304.;
 vec2 op=p+vec2(uTime>0.?sin(uTime*1.7-v*7.)*3.5*sin(clamp(v,0.,1.)*3.1416)*smoothstep(.69,.74,u):0.,0.);
 vec4 o0=tex(uOrn,op);
 op+=N.xy*3.*smoothstep(.02,.2,o0.b-o0.r);
 vec4 o=tex(uOrn,op);
 vec3 W=vec3(.3,.5,.2);
 vec2 g=vec2(dot(tex(uOrn,op+vec2(1.5,0.)).rgb-tex(uOrn,op-vec2(1.5,0.)).rgb,W),dot(tex(uOrn,op+vec2(0.,1.5)).rgb-tex(uOrn,op-vec2(0.,1.5)).rgb,W));
 vec3 On=normalize(vec3(-g*3.2,1.));
 vec3 Lm=normalize(vec3(cos(uTime*.45)*.55,-.3+sin(uTime*.37)*.4,1.));
 float lum=dot(o.rgb,W);
 float band=exp(-pow((p.x+p.y*.6-mod(uTime*360.,2800.)+300.)/70.,2.));
 o.rgb+=(pow(max(dot(On,normalize(Lm+V)),0.),80.)*.9+band*.4*smoothstep(.35,.8,lum))*o.a*vec3(.92,.98,1.);
 col=o+(1.-o.a)*col;
 for(int i=0;i<${DROPS};i++){
  vec4 d=uDrops[i];
  vec2 dv=(p-d.xy)/d.z;float r=length(dv);
  if(d.w<=0.||r>1.)continue;
  vec3 dn=vec3(dv,sqrt(1.-r*r));
  vec2 sp=d.xy-dv*d.z*.85;
  vec4 b=tex(uBg,sp),ob=tex(uOrn,sp);b=ob+(1.-ob.a)*b;
  float edge=smoothstep(.62,1.,r),glint=pow(max(dot(dn,normalize(L1+V)),0.),90.),under=pow(max(dot(dn,normalize(vec3(.3,.45,1.))),0.),12.)*smoothstep(.4,.9,r);
  vec4 drop=vec4(b.rgb*.85*(1.-.35*edge)+vec3(.6,.9,1.)*edge*.45+vec3(.55,.85,1.)*under*.35+glint*1.4,0.);
  drop.a=clamp(b.a*.85+.2+edge*.5+glint,0.,1.);
  col=mix(col,drop,d.w*(1.-smoothstep(.9,1.,r)));
 }
 col.rgb=min(col.rgb,vec3(col.a));
 gl_FragColor=col;
}`;
function createRenderer(){
 const canvas=document.createElement('canvas');
 const g=canvas.getContext('webgl',{alpha:true,premultipliedAlpha:true,antialias:false,preserveDrawingBuffer:true});
 if(!g)return null;
 const shader=(type,src)=>{const s=g.createShader(type);g.shaderSource(s,src);g.compileShader(s);if(!g.getShaderParameter(s,g.COMPILE_STATUS))throw new Error(g.getShaderInfoLog(s));return s;};
 const prog=g.createProgram();g.attachShader(prog,shader(g.VERTEX_SHADER,VERT));g.attachShader(prog,shader(g.FRAGMENT_SHADER,FRAG));g.linkProgram(prog);
 if(!g.getProgramParameter(prog,g.LINK_STATUS))throw new Error(g.getProgramInfoLog(prog));
 g.useProgram(prog);g.bindBuffer(g.ARRAY_BUFFER,g.createBuffer());g.bufferData(g.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),g.STATIC_DRAW);
 const a=g.getAttribLocation(prog,'a');g.enableVertexAttribArray(a);g.vertexAttribPointer(a,2,g.FLOAT,false,0,0);
 g.pixelStorei(g.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);
 const units={};['uBg','uText','uKoi','uOrn','uMask'].forEach((name,i)=>{
   const t=g.createTexture();g.activeTexture(g.TEXTURE0+i);g.bindTexture(g.TEXTURE_2D,t);
   for(const [k,v] of [[g.TEXTURE_MIN_FILTER,g.LINEAR],[g.TEXTURE_MAG_FILTER,g.LINEAR],[g.TEXTURE_WRAP_S,g.CLAMP_TO_EDGE],[g.TEXTURE_WRAP_T,g.CLAMP_TO_EDGE]])g.texParameteri(g.TEXTURE_2D,k,v);
   g.uniform1i(g.getUniformLocation(prog,name),i);units[name]=i;
 });
 const koiCanvas=document.createElement('canvas');koiCanvas.width=WATER_W/2;koiCanvas.height=WATER_H/2;
 const r={canvas,g,units,koi:koiCanvas.getContext('2d'),uTime:g.getUniformLocation(prog,'uTime'),uDrops:g.getUniformLocation(prog,'uDrops'),layers:null};
 canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();renderer=undefined;});
 return r;
}
function upload(r,name,source){const g=r.g;g.activeTexture(g.TEXTURE0+r.units[name]);g.texImage2D(g.TEXTURE_2D,0,g.RGBA,g.RGBA,g.UNSIGNED_BYTE,source);}
function flatOrnament(ctx,time,width,height){
 if(!ornament)return;ctx.save();ctx.scale(width/WATER_W,height/WATER_H);
 const sw=ornament.naturalWidth,sh=ornament.naturalHeight,split=Math.floor(sw*.71),dx=8,dy=8,dw=1304,dh=688;
 ctx.drawImage(ornament,0,0,split,sh,dx,dy,dw*split/sw,dh);
 for(let i=0;i<40;i++){
   const sy=sh*i/40,eh=Math.min(sh-sy,sh/40+1),f=i/40;
   const sway=time===0?0:Math.sin(time*1.7-f*7)*3.5*Math.sin(f*Math.PI);
   ctx.drawImage(ornament,split,sy,sw-split,eh,dx+dw*split/sw+sway,dy+dh*f,dw*(sw-split)/sw,dh*eh/sh);
 }ctx.restore();
}
// Draws the whole animated water card (surface, koi, ornament, droplets) over the static base.
export function waterForeground(ctx,time,width,height){
 if(renderer===undefined){try{renderer=createRenderer();}catch(error){console.warn('Water card shader unavailable',error);renderer=null;}}
 if(!renderer||!layers)return flatOrnament(ctx,time,width,height);
 const r=renderer,g=r.g,m=ctx.getTransform();
 // Render at roughly the on-screen resolution, stepped so the intro zoom rarely reallocates.
 const scale=Math.min(layers.scale,Math.max(.4,Math.ceil(Math.hypot(m.a,m.b)*width/WATER_W*5)/5));
 const cw=Math.round(WATER_W*scale),ch=Math.round(WATER_H*scale);
 if(r.canvas.width!==cw||r.canvas.height!==ch){r.canvas.width=cw;r.canvas.height=ch;}
 g.viewport(0,0,cw,ch);
 if(r.layers!==layers){for(const name of ['bg','text','orn','mask'])upload(r,'u'+name[0].toUpperCase()+name.slice(1),layers[name]);r.layers=layers;}
 school(r.koi,time);upload(r,'uKoi',r.koi.canvas);
 g.uniform1f(r.uTime,time);g.uniform4fv(r.uDrops,droplets(time));
 g.clearColor(0,0,0,0);g.clear(g.COLOR_BUFFER_BIT);g.drawArrays(g.TRIANGLE_STRIP,0,4);
 ctx.drawImage(r.canvas,0,0,width,height);
}


// Reuse the goat surface's noise and moving Voronoi caustics on a spherical water volume.
let orbRenderer;
// Noise, fbm and moving Voronoi shared with the orb and the frost hound card.
export const LIQUID_VERT=VERT,LIQUID_GLSL=FRAG.slice(FRAG.indexOf('float hash('),FRAG.indexOf('vec4 tex('))+FRAG.slice(FRAG.indexOf('vec2 cell('),FRAG.indexOf('void main()'));
const ORB_FRAG='precision highp float;varying vec2 vUv;uniform float uTime;'+LIQUID_GLSL+`float ripple(vec2 p){return fbm(p*3.4+vec2(uTime*.12,-uTime*.17))*.11+sin(p.x*19.+p.y*12.-uTime*2.)*.009;}
 void main(){
 vec2 p=(vUv-.5)*2.25;float rr=dot(p,p);if(rr>.99){gl_FragColor=vec4(0.);return;}
 float z=sqrt(1.-rr),h=ripple(p);vec2 grad=vec2(ripple(p+vec2(.009,0.))-h,ripple(p+vec2(0.,.009))-h)/.009;
 vec3 N=normalize(vec3(p+grad*.32,z)),V=vec3(0.,0.,1.),L=normalize(vec3(-.35,-.5,1.));
 vec2 refr=p+N.xy*.3;float wave=fbm(refr*5.+vec2(uTime*.1,-uTime*.15));
 // Sapphire body with a pale turquoise core; deep tones stay at the outer edge.
 vec3 col=mix(vec3(.045,.24,.66),vec3(.16,.64,.88),smoothstep(.15,.8,wave));
 float core=pow(z,2.)*.52;col=mix(col,vec3(.49,.91,.9),core);
 col*=1.-smoothstep(.7,.98,sqrt(rr))*.22;
 float c=pow(1.-smoothstep(0.,.16,voronoi(refr*5.+N.xy*.7,uTime*.8)),3.);
 c+=.6*pow(1.-smoothstep(0.,.14,voronoi(refr*8.5+3.1,-uTime*.6)),3.);
 col+=vec3(.42,.85,1.)*c*.22;
 float spec=pow(max(dot(N,normalize(L+V)),0.),190.);
 float crest=pow(max(dot(N,normalize(vec3(.45,.3,1.)+V)),0.),180.);
 float fres=pow(1.-z,2.4);
 col+=vec3(.96,.99,1.)*spec*1.1+vec3(.82,.94,1.)*crest*.65+vec3(.15,.42,.84)*fres*.32;
 float rim=smoothstep(.86,.985,sqrt(rr));col=mix(col,vec3(.86,.94,.99),rim*.9);
 float alpha=(1.-smoothstep(.965,.995,rr))*.97;gl_FragColor=vec4(col*alpha,alpha);
 }`;
function waterOrbRenderer(){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=192;
 const g=canvas.getContext('webgl',{alpha:true,premultipliedAlpha:true,preserveDrawingBuffer:true});if(!g)return null;
 const shader=(type,source)=>{const sh=g.createShader(type);g.shaderSource(sh,source);g.compileShader(sh);if(!g.getShaderParameter(sh,g.COMPILE_STATUS))throw Error(g.getShaderInfoLog(sh));return sh;};
 const prog=g.createProgram();g.attachShader(prog,shader(g.VERTEX_SHADER,VERT));g.attachShader(prog,shader(g.FRAGMENT_SHADER,ORB_FRAG));g.linkProgram(prog);if(!g.getProgramParameter(prog,g.LINK_STATUS))throw Error(g.getProgramInfoLog(prog));g.useProgram(prog);
 g.bindBuffer(g.ARRAY_BUFFER,g.createBuffer());g.bufferData(g.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),g.STATIC_DRAW);const a=g.getAttribLocation(prog,'a');g.enableVertexAttribArray(a);g.vertexAttribPointer(a,2,g.FLOAT,false,0,0);g.viewport(0,0,192,192);
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();orbRenderer=undefined;});
 const snap=document.createElement('canvas');snap.width=snap.height=192;
 return {canvas,g,snap:snap.getContext('2d'),time:g.getUniformLocation(prog,'uTime'),lastTime:null};
}
export function waterOrb(ctx,time,x,y,r,alpha=1){
 if(orbRenderer===undefined){try{orbRenderer=waterOrbRenderer();}catch(error){console.warn('Water orb shader unavailable',error);orbRenderer=null;}}
 ctx.save();ctx.globalAlpha*=alpha;
 // The sphere is rendered once per frame and copied to a 2D canvas, so the many orbs drawn from it skip WebGL readbacks.
 if(orbRenderer){const o=orbRenderer;if(o.lastTime!==time){o.g.uniform1f(o.time,time);o.g.clearColor(0,0,0,0);o.g.clear(o.g.COLOR_BUFFER_BIT);o.g.drawArrays(o.g.TRIANGLE_STRIP,0,4);o.snap.clearRect(0,0,192,192);o.snap.drawImage(o.canvas,0,0);o.lastTime=time;}ctx.drawImage(o.snap.canvas,x-r*1.125,y-r*1.125,r*2.25,r*2.25);}
 else{const g=ctx.createRadialGradient(x-r*.35,y-r*.4,1,x,y,r);g.addColorStop(0,'#d0fff5');g.addColorStop(.25,'#70dbdf');g.addColorStop(.62,'#358fdb');g.addColorStop(.9,'#1855a8');g.addColorStop(1,'#dbefff');ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();}
 ctx.restore();
}
