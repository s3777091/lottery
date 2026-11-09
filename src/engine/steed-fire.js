// Jade Steed edition: molten fire rendered in WebGL. Two passes share one noise/colour library:
// low flames screened over the matte card interior, and the steed's plume tail set alight.
// Both work in card-local units (card 1100x520 at the origin); callers set up the transform.
const W = 1100, H = 520;
// Tail pass covers the right plume plus room for flames to lick off it.
const TX = 760, TY = -130, TW = 450, TH = 700;
let flames, tail;
const VERT='attribute vec2 a;varying vec2 vUv;void main(){vUv=vec2(a.x*.5+.5,.5-a.y*.5);gl_Position=vec4(a,0.,1.);}';
const COMMON=`precision highp float;
varying vec2 vUv;
uniform float uTime;
float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*f*(f*(f*6.-15.)+10.);
 return mix(mix(hash(i),hash(i+vec2(1.,0.)),u.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.)),u.x),u.y);}
float fbm(vec2 p){float v=0.,a=.5;mat2 m=mat2(1.6,1.2,-1.2,1.6);for(int i=0;i<5;i++){v+=a*noise(p);p=m*p;a*=.5;}return v;}
// Black-body ramp: ember red, orange, molten gold, white-hot core.
vec3 ramp(float h){
 vec3 c=mix(vec3(0.),vec3(.42,.03,0.),smoothstep(0.,.25,h));
 c=mix(c,vec3(1.,.3,.02),smoothstep(.2,.5,h));
 c=mix(c,vec3(1.,.68,.16),smoothstep(.45,.78,h));
 return mix(c,vec3(1.,.95,.78),smoothstep(.85,1.15,h));
}
// Sparse sparks drifting upward through cells of the given size.
float embers(vec2 c,float size,float speed,float t){
 vec2 g=c/size+vec2(0.,t*speed),id=floor(g),f=fract(g)-.5;float r=hash(id+size);
 vec2 j=(vec2(hash(id+7.),hash(id+13.))-.5)*.6+vec2(sin(t*2.+r*20.)*.18,0.);
 return smoothstep(.1,0.,length((f-j)*vec2(1.,.6)))*step(.84,r);
}
`;
const FLAMES=COMMON+`
const vec2 SIZE=vec2(${W}.,${H}.);
void main(){
 vec2 c=vUv*SIZE;float t=uTime;
 // Fire feeds from the lower rail and creeps a little way up both side rails.
 float side=smoothstep(60.,320.,c.y);
 float src=exp(-max(0.,450.-c.y)/105.)+.6*side*(exp(-max(0.,c.x-105.)/80.)+exp(-max(0.,995.-c.x)/80.));
 vec2 q=vec2(c.x/140.,c.y/165.+t*.8);
 vec2 w=vec2(fbm(q*1.1+vec2(0.,t*.25)),fbm(q*1.1+vec2(3.7,8.1)-vec2(t*.2,0.)));
 float n=fbm(vec2(q.x*1.6,q.y*1.15)+w*1.9);
 float heat=src*(.25+1.6*n)-.45;
 // Flow-aligned dark striations give the flames a liquid, ribboned surface.
 float s=abs(sin(c.x*.021+w.x*9.+n*6.5-c.y*.013+t*.6));
 heat=max(heat*(.7+.3*smoothstep(0.,.3,s)),0.);
 float zone=1.-smoothstep(.8,1.12,length((c-vec2(550.,232.))/vec2(330.,140.)));
 zone=max(zone,.7*(1.-smoothstep(.6,1.,length((c-vec2(550.,413.))/vec2(150.,34.)))));
 heat*=1.-.85*zone;
 vec3 col=ramp(heat*1.15)+vec3(.4,.06,0.)*src*.16*(1.-zone);
 float e=embers(c+vec2(13.,0.),44.,1.5,t)*1.3+embers(c,27.,2.3,t)*.8;
 col+=e*vec3(1.,.72,.32)*(1.-.85*zone)*smoothstep(40.,360.,c.y);
 gl_FragColor=vec4(col,1.);
}`;
const TAIL=COMMON+`
uniform sampler2D uTail;
uniform vec4 uRect;
const vec2 ORIGIN=vec2(${TX}.,${TY}.),SIZE=vec2(${TW}.,${TH}.);
// The plume sways like the old sliced mane: strongest at the tip, pinned at the root.
vec4 plume(vec2 p,float t){
 vec2 l=(p-uRect.xy)/uRect.zw;
 float f=clamp(l.y,0.,1.),w=pow(1.-f,1.6);
 l.x-=(sin(t*2.7-f*5.)*5.+sin(t*4.1-f*9.)*1.5)*w*step(.001,t)/uRect.z;
 if(l.x<0.||l.x>1.||l.y<0.||l.y>1.)return vec4(0.);
 return texture2D(uTail,l);
}
void main(){
 vec2 p=ORIGIN+vUv*SIZE;float t=uTime;
 vec2 shimmer=(vec2(noise(p/38.+vec2(0.,t*2.)),noise(p/38.+vec2(7.,t*2.)))-.5)*3.;
 vec4 a=plume(p+shimmer,t);
 // Smouldering recolour: the red and gold plume glows like embers under a flickering heat map,
 // while the jade inlays keep their colour and only catch a gem-like glint from the fire.
 float flick=fbm(p/55.+vec2(0.,t*1.6));
 vec3 base=a.rgb/max(a.a,.001);
 float jade=smoothstep(.04,.2,min(base.g,base.b)-base.r);
 float lum=dot(base,vec3(.35,.5,.15));
 a.rgb=mix(a.rgb,ramp(.3+lum*.55+flick*.45)*a.a,.6*(1.-jade))+vec3(1.,.45,.08)*pow(flick,4.)*a.a*.9*(1.-jade)
  +vec3(.35,1.,.85)*pow(flick,3.)*a.a*.45*jade;
 // Flames: fuel is the plume just below each point, so fire licks upward off its silhouette.
 float src=0.;
 for(int k=1;k<=5;k++){float d=float(k);src=max(src,plume(p+vec2(0.,d*15.)+shimmer*3.,t).a*(1.-d*.13));}
 vec2 q=vec2(p.x/65.,p.y/85.+t*1.5);
 vec2 wv=vec2(fbm(q+vec2(0.,t*.3)),fbm(q+vec2(4.,9.)-vec2(t*.2,0.)));
 float n=fbm(q*1.4+wv*1.7);
 float heat=max(src*(.15+1.65*n)-.48,0.)*(1.-.35*a.a);
 float fa=clamp(heat*2.,0.,1.);
 vec4 col=a;
 col.rgb+=ramp(.3+heat*1.1)*fa*(1.-col.rgb*.5)*(1.-.75*jade*a.a);
 col.a=max(col.a,fa);
 float near=plume(p+vec2(0.,80.),t).a;
 float e=(embers(p,30.,2.,t)+embers(p+vec2(9.,0.),19.,2.8,t)*.7)*near;
 col+=vec4(vec3(1.,.72,.32),1.)*e;
 col.rgb=min(col.rgb,vec3(col.a));
 gl_FragColor=col;
}`;
function program(frag,opaque){
 const canvas=document.createElement('canvas');
 const g=canvas.getContext('webgl',{alpha:!opaque,premultipliedAlpha:true,antialias:false,preserveDrawingBuffer:true});
 if(!g)return null;
 const shader=(type,src)=>{const s=g.createShader(type);g.shaderSource(s,src);g.compileShader(s);if(!g.getShaderParameter(s,g.COMPILE_STATUS))throw new Error(g.getShaderInfoLog(s));return s;};
 const prog=g.createProgram();g.attachShader(prog,shader(g.VERTEX_SHADER,VERT));g.attachShader(prog,shader(g.FRAGMENT_SHADER,frag));g.linkProgram(prog);
 if(!g.getProgramParameter(prog,g.LINK_STATUS))throw new Error(g.getProgramInfoLog(prog));
 g.useProgram(prog);g.bindBuffer(g.ARRAY_BUFFER,g.createBuffer());g.bufferData(g.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),g.STATIC_DRAW);
 const a=g.getAttribLocation(prog,'a');g.enableVertexAttribArray(a);g.vertexAttribPointer(a,2,g.FLOAT,false,0,0);
 const r={canvas,g,prog,uTime:g.getUniformLocation(prog,'uTime'),lost:false};
 canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();r.lost=true;});
 return r;
}
function ready(r,frag,opaque,label){
 if(r&&!r.lost)return r;
 try{return program(frag,opaque);}catch(error){console.warn(label+' shader unavailable',error);return null;}
}
// Render at roughly the on-screen resolution, stepped so the intro zoom rarely reallocates.
function render(r,ctx,time,w,h){
 const {canvas,g}=r,m=ctx.getTransform();
 const k=Math.min(2,Math.max(.4,Math.ceil(Math.hypot(m.a,m.b)*5)/5)),cw=Math.round(w*k),ch=Math.round(h*k);
 if(canvas.width!==cw||canvas.height!==ch){canvas.width=cw;canvas.height=ch;}
 g.viewport(0,0,cw,ch);g.uniform1f(r.uTime,time);g.clearColor(0,0,0,0);g.clear(g.COLOR_BUFFER_BIT);g.drawArrays(g.TRIANGLE_STRIP,0,4);
}
// Returns false when WebGL is unavailable so the caller can fall back to its 2D flames.
export function drawSteedFlames(ctx,time){
 if(flames!==null)flames=ready(flames,FLAMES,true,'Steed fire');
 if(!flames)return false;
 render(flames,ctx,time,W,H);ctx.drawImage(flames.canvas,0,0,W,H);
 return true;
}
// Burns the right-hand plume of the steed artwork (the part right of `split`, drawn into `rect`).
export function drawSteedTail(ctx,time,art,split,rect){
 if(tail!==null)tail=ready(tail,TAIL,false,'Steed tail');
 if(!tail)return false;
 const g=tail.g;
 if(tail.art!==art){
   const crop=document.createElement('canvas');crop.width=art.naturalWidth-split;crop.height=art.naturalHeight;
   crop.getContext('2d').drawImage(art,-split,0);
   g.activeTexture(g.TEXTURE0);g.bindTexture(g.TEXTURE_2D,g.createTexture());
   for(const [k,v] of [[g.TEXTURE_MIN_FILTER,g.LINEAR],[g.TEXTURE_MAG_FILTER,g.LINEAR],[g.TEXTURE_WRAP_S,g.CLAMP_TO_EDGE],[g.TEXTURE_WRAP_T,g.CLAMP_TO_EDGE]])g.texParameteri(g.TEXTURE_2D,k,v);
   g.pixelStorei(g.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);g.texImage2D(g.TEXTURE_2D,0,g.RGBA,g.RGBA,g.UNSIGNED_BYTE,crop);
   g.uniform1i(g.getUniformLocation(tail.prog,'uTail'),0);tail.art=art;
 }
 g.uniform4f(g.getUniformLocation(tail.prog,'uRect'),rect[0],rect[1],rect[2],rect[3]);
 render(tail,ctx,time,TW,TH);ctx.drawImage(tail.canvas,TX,TY,TW,TH);
 return true;
}
