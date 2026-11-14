/* OSIRISZK native WebGL2 3D engine — no dependencies or internet. */
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const lerp=(a,b,t)=>a+(b-a)*t;
export const V=(x=0,y=0,z=0)=>[x,y,z];
export const add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
export const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
export const mul=(a,s)=>[a[0]*s,a[1]*s,a[2]*s];
export const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
export const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export const len=a=>Math.sqrt(dot(a,a));
export const normalize=a=>{const l=len(a);return l>1e-9?mul(a,1/l):[0,1,0];};
export const I=()=>[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
export function matmul(a,b){let o=new Array(16).fill(0);for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)o[c*4+r]+=a[k*4+r]*b[c*4+k];return o;}
export const T=(x=0,y=0,z=0)=>[1,0,0,0,0,1,0,0,0,0,1,0,x,y,z,1];
export const S=(x=1,y=1,z=1)=>[x,0,0,0,0,y,0,0,0,0,z,0,0,0,0,1];
export const RX=a=>{const c=Math.cos(a),s=Math.sin(a);return [1,0,0,0,0,c,s,0,0,-s,c,0,0,0,0,1];};
export const RY=a=>{const c=Math.cos(a),s=Math.sin(a);return [c,0,-s,0,0,1,0,0,s,0,c,0,0,0,0,1];};
export const RZ=a=>{const c=Math.cos(a),s=Math.sin(a);return [c,s,0,0,-s,c,0,0,0,0,1,0,0,0,0,1];};
export const TR=(x,y,z,yaw=0)=>matmul(T(x,y,z),RY(yaw));
/* Yön kuralı (v2.2): RY(yaw) ile modelin burnu (yerel -Z) dünyada (-sin yaw, -cos yaw) yönüne bakar.
   Sağ (yerel +X) = (cos yaw, -sin yaw). Sola dönüş yaw'ı artırır, sağa dönüş azaltır. */
export const forwardOf=yaw=>[-Math.sin(yaw),-Math.cos(yaw)];
export const rightOf=yaw=>[Math.cos(yaw),-Math.sin(yaw)];
export const angleDiff=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
export const moveToward=(v,target,step)=>v<target?Math.min(target,v+step):Math.max(target,v-step);
export const positionOf=m=>[m[12],m[13],m[14]];
export function transformPoint(m,v){return [m[0]*v[0]+m[4]*v[1]+m[8]*v[2]+m[12],m[1]*v[0]+m[5]*v[1]+m[9]*v[2]+m[13],m[2]*v[0]+m[6]*v[1]+m[10]*v[2]+m[14]];}
export function perspective(fov,aspect,n=.12,f=600){const t=1/Math.tan(fov/2);return [t/aspect,0,0,0,0,t,0,0,0,0,(f+n)/(n-f),-1,0,0,2*f*n/(n-f),0];}
export function lookAt(eye,target){const z=normalize(sub(eye,target)),x=normalize(cross([0,1,0],z)),y=cross(z,x);return [x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1];}
export const palette={dust:[.64,.345,.232],rust:[.53,.24,.153],sand:[.78,.48,.31],dark:[.087,.115,.136],steel:[.28,.34,.37],steel2:[.44,.49,.49],white:[.80,.84,.79],ceramic:[.73,.72,.61],solar:[.084,.19,.25],solar2:[.13,.32,.40],black:[.065,.07,.077],tire:[.105,.10,.105],teal:[.22,.72,.67],amber:[1,.60,.27],gold:[.80,.59,.31],shadow:[.045,.04,.037]};
export const color=(r,g,b)=>[r,g,b];
const hash=n=>{const q=Math.sin(n*127.1+18.13)*43758.5453;return q-Math.floor(q);};
export function noise2(x,z){const xi=Math.floor(x),zi=Math.floor(z),a=x-xi,b=z-zi,u=a*a*(3-2*a),v=b*b*(3-2*b);return lerp(lerp(hash(xi+zi*123.45),hash(xi+1+zi*123.45),u),lerp(hash(xi+(zi+1)*123.45),hash(xi+1+(zi+1)*123.45),u),v)*2-1;}
export function fbm(x,z){return .53*noise2(x,z)+.27*noise2(x*2.06,z*2.06)+.14*noise2(x*4.2,z*4.2)+.06*noise2(x*8.6,z*8.6);}
function crater(x,z,cx,cz,r,depth){const d=Math.hypot(x-cx,z-cz)/r;return -depth*Math.exp(-d*d*5.6)+depth*.42*Math.exp(-Math.pow((d-1.08)/.17,2));}
// Uzak katmanlı tepeler (butte/mesa) — Gale kraterindeki tortul katmanlar gibi basamaklı yamaçlar. [x, z, yarıçap, yükseklik]
export const MESAS=[[-78,-62,14,6.5],[84,-48,17,8.0],[62,74,12,5.5],[-88,30,15,7.2],[8,-95,19,9.0],[-40,90,11,5.0]];
function mesa(x,z,mx,mz,r,h){const d=Math.hypot(x-mx,z-mz)+fbm(x*.09,z*.09)*4.2;if(d>r+8)return 0;const t=clamp((r+7-d)/7,0,1),s=t*t*(3-2*t),v=s*h/1.15,i=Math.floor(v);return 1.15*(i+Math.pow(v-i,3));}
export function terrainHeight(x,z){let h=-.38 +1.05*fbm(x*.065,z*.065)+.27*fbm(x*.24,z*.24) + crater(x,z,-42,-52,14,3.3)+crater(x,z,37,-5,21,2.8)+crater(x,z,-65,44,18,3.8) - .55*Math.exp(-x*x/420);
 if(x*x+z*z>2500)for(const m of MESAS)h+=mesa(x,z,m[0],m[1],m[2],m[3]);return h;}
export const CRATERS=[[-42,-52,14],[37,-5,21],[-65,44,18]];
export function gradientTerrain(x,z){const h=terrainHeight(x,z);const dx=(terrainHeight(x+.2,z)-terrainHeight(x-.2,z))/.4,dz=(terrainHeight(x,z+.2)-terrainHeight(x,z-.2))/.4;return normalize([-dx,1,-dz]);}
export class MeshBuilder {
  constructor(){this.arr=[];this.stack=[I()];}
  get matrix(){return this.stack[this.stack.length-1];}
  with(matrix,fn){this.stack.push(matmul(this.matrix,matrix));fn();this.stack.pop();return this;}
  point(v){return transformPoint(this.matrix,v);}
  tri(a,b,c,col,normalOverride=null){a=this.point(a);b=this.point(b);c=this.point(c);const n=normalOverride?normalize(normalOverride):normalize(cross(sub(b,a),sub(c,a)));for(const p of [a,b,c])this.arr.push(...p,...n,...col);return this;}
  quad(a,b,c,d,col){this.tri(a,b,c,col);this.tri(a,c,d,col);return this;}
  box(x,y,z,sx,sy,sz,col){const X=sx/2,Y=sy/2,Z=sz/2;return this.with(T(x,y,z),()=>{
    this.quad([-X,-Y,Z],[X,-Y,Z],[X,Y,Z],[-X,Y,Z],col);this.quad([X,-Y,-Z],[-X,-Y,-Z],[-X,Y,-Z],[X,Y,-Z],col);
    this.quad([-X,-Y,-Z],[-X,-Y,Z],[-X,Y,Z],[-X,Y,-Z],col);this.quad([X,-Y,Z],[X,-Y,-Z],[X,Y,-Z],[X,Y,Z],col);
    this.quad([-X,Y,Z],[X,Y,Z],[X,Y,-Z],[-X,Y,-Z],col);this.quad([-X,-Y,-Z],[X,-Y,-Z],[X,-Y,Z],[-X,-Y,Z],col);
  });}
  cylinder(x,y,z,rBottom,rTop,h,col,sides=16){return this.with(T(x,y,z),()=>{for(let i=0;i<sides;i++){const a=i*2*Math.PI/sides,b=(i+1)*2*Math.PI/sides;const ca=Math.cos(a),sa=Math.sin(a),cb=Math.cos(b),sb=Math.sin(b);const p=[ca*rBottom,-h/2,sa*rBottom],q=[cb*rBottom,-h/2,sb*rBottom],u=[cb*rTop,h/2,sb*rTop],v=[ca*rTop,h/2,sa*rTop];this.quad(p,q,u,v,col);this.tri([0,h/2,0],v,u,col);this.tri([0,-h/2,0],q,p,col);}});}
  sphere(x,y,z,rx,ry,rz,col,rings=5,segments=9){return this.with(matmul(T(x,y,z),S(rx,ry,rz)),()=>{for(let i=0;i<rings;i++){const a=-Math.PI/2+i*Math.PI/rings,b=-Math.PI/2+(i+1)*Math.PI/rings;for(let j=0;j<segments;j++){const u=j*2*Math.PI/segments,v=(j+1)*2*Math.PI/segments;const p=[Math.cos(a)*Math.cos(u),Math.sin(a),Math.cos(a)*Math.sin(u)],q=[Math.cos(a)*Math.cos(v),Math.sin(a),Math.cos(a)*Math.sin(v)],r=[Math.cos(b)*Math.cos(v),Math.sin(b),Math.cos(b)*Math.sin(v)],s=[Math.cos(b)*Math.cos(u),Math.sin(b),Math.cos(b)*Math.sin(u)];this.quad(p,q,r,s,col);}}});}
  tube(a,b,r,col,sides=9){const dir=normalize(sub(b,a)),ref=Math.abs(dir[1])>.9?[1,0,0]:[0,1,0],u=normalize(cross(dir,ref)),v=cross(dir,u);for(let i=0;i<sides;i++){const f=i*2*Math.PI/sides,g=(i+1)*2*Math.PI/sides;const off=t=>add(mul(u,r*Math.cos(t)),mul(v,r*Math.sin(t)));this.quad(add(a,off(f)),add(a,off(g)),add(b,off(g)),add(b,off(f)),col);}return this;}
  ring(x,y,z,inner,outer,col,segments=48){return this.with(T(x,y,z),()=>{for(let i=0;i<segments;i++){const a=i*2*Math.PI/segments,b=(i+1)*2*Math.PI/segments;this.quad([Math.cos(a)*inner,0,Math.sin(a)*inner],[Math.cos(b)*inner,0,Math.sin(b)*inner],[Math.cos(b)*outer,0,Math.sin(b)*outer],[Math.cos(a)*outer,0,Math.sin(a)*outer],col);}});}
  build(renderer){return renderer.upload(new Float32Array(this.arr));}
}
const vertex=`#version 300 es
precision highp float;
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNormal;
layout(location=2) in vec3 aColor;
uniform mat4 uModel, uViewProj;
out vec3 vWorld,vNormal,vColor;
void main(){vec4 w=uModel*vec4(aPos,1.0);vWorld=w.xyz;vNormal=normalize(mat3(uModel)*aNormal);vColor=aColor;gl_Position=uViewProj*w;}
`;
const fragment=`#version 300 es
precision highp float;
in vec3 vWorld,vNormal,vColor;
uniform vec3 uEye,uSun,uFogColor;
uniform float uFogDensity,uOpacity,uGlow,uTime;
out vec4 outColor;
float hash(vec3 p){return fract(sin(dot(p,vec3(12.9898,78.233,21.871)))*43758.5453);}
void main(){vec3 n=normalize(vNormal);vec3 sun=normalize(uSun);
 float diffuse=max(dot(n,sun),0.0);float sky=.5+.5*n.y;
 float occ=clamp(.72+.28*sky,0.0,1.0);
 float dist=length(vWorld-uEye);
 float grain=(hash(floor(vWorld*9.7))-.5)*.065;
 vec3 base=vColor*(.38+.68*diffuse+.18*sky)*occ+grain;
 vec3 viewDir=normalize(uEye-vWorld);float spec=pow(max(dot(reflect(-sun,n),viewDir),0.),30.)*.12;
 base+=spec*vec3(1.,.83,.64);base+=uGlow*vColor*.8;
 float haze=1.0-exp(-dist*dist*uFogDensity*uFogDensity);
 haze=clamp(haze,0.0,.91);
 base=mix(base,uFogColor,haze);
 base=pow(max(base,vec3(0.0)),vec3(.88));
 outColor=vec4(base,uOpacity);
}`;
const skyVert=`#version 300 es
precision highp float;
layout(location=0) in vec2 aPos;
out vec2 vUV;
void main(){vUV=aPos*.5+.5;gl_Position=vec4(aPos,0,1);}`;
const skyFrag=`#version 300 es
precision highp float;
in vec2 vUV;
uniform float uTime, uEvening;
out vec4 outColor;
void main(){vec3 top=mix(vec3(.20,.32,.40),vec3(.085,.13,.22),uEvening);
vec3 mid=mix(vec3(.67,.40,.32),vec3(.50,.25,.26),uEvening);
vec3 horizon=mix(vec3(.80,.48,.35),vec3(.65,.30,.20),uEvening);
float h=clamp((vUV.y-.30)/.70,0.,1.);
vec3 c=mix(horizon,mix(mid,top,smoothstep(.21,.95,h)),smoothstep(.02,.86,h));
float sun=length((vUV-vec2(.74,.70))*vec2(1.8,1.0));c+=vec3(.65,.34,.19)*exp(-sun*sun*45.)*.45;
float disk=1.-smoothstep(.036,.040,sun);c+=disk*vec3(.92,.71,.47)*.25;
outColor=vec4(c,1.);}`;
function compile(gl,type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s;}
function program(gl,vs,fs){const p=gl.createProgram();gl.attachShader(p,compile(gl,gl.VERTEX_SHADER,vs));gl.attachShader(p,compile(gl,gl.FRAGMENT_SHADER,fs));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));return p;}
/* ── Arazi gölgelendiricisi (v2.4) ──
   5 zemin malzemesi tek bir doku dizisinde (TEXTURE_2D_ARRAY): 0 regolit, 1 kum, 2 ana kaya, 3 çakıl, 4 toz.
   Köşe ağırlıkları (kum, kaya, çakıl, toz; regolit = kalan) + doku alfa kanalındaki yükseklik ile karıştırılır.
   uLevel: 0 Düşük (tek ölçek, doğrusal karışım) · 1 Orta (iki ölçek, yükseklik karışımı, kabartma) · 2 Yüksek (+ mikro detay, güçlü kabartma). */
const terrainVertex=`#version 300 es
precision highp float;
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNormal;
layout(location=2) in vec3 aColor;
layout(location=3) in vec4 aWeights;
uniform mat4 uViewProj;
out vec3 vWorld,vNormal,vColor;out vec4 vW;
void main(){vWorld=aPos;vNormal=aNormal;vColor=aColor;vW=aWeights;gl_Position=uViewProj*vec4(aPos,1.0);}
`;
const terrainFragment=`#version 300 es
precision highp float;precision highp sampler2DArray;
in vec3 vWorld,vNormal,vColor;in vec4 vW;
uniform vec3 uEye,uSun,uFogColor;uniform float uFogDensity;
uniform sampler2DArray uMat;uniform sampler2D uMacro;
uniform float uTile[5];uniform int uLevel;uniform float uMapHalf;uniform float uMacroAmt;uniform float uBump;
out vec4 outColor;
float hash(vec3 p){return fract(sin(dot(p,vec3(12.9898,78.233,21.871)))*43758.5453);}
vec4 sampleMat(int i,vec2 p){
 vec4 a=texture(uMat,vec3(p/uTile[i],float(i)));
 if(uLevel>0){vec4 b=texture(uMat,vec3(p/(uTile[i]*5.3)+vec2(.37,.61),float(i)));a.rgb=mix(a.rgb,a.rgb*(b.rgb/max(vec3(.05),vec3(dot(b.rgb,vec3(.333))))),.33);a.a=mix(a.a,b.a,.25);}
 return a;}
void main(){
 float w[5];w[1]=vW.x;w[2]=vW.y;w[3]=vW.z;w[4]=vW.w;w[0]=max(0.0,1.0-vW.x-vW.y-vW.z-vW.w);
 vec2 p=vWorld.xz;vec4 s[5];float m=-1.0;
 for(int i=0;i<5;i++){if(w[i]>.004){s[i]=sampleMat(i,p);}else{s[i]=vec4(0.0);}}
 // Yükseklik tabanlı karışım: kum dalgacıklarının arasından çakıl, kaya çatlaklarına toz dolar.
 float bw[5];float tot=0.0;
 if(uLevel==0){for(int i=0;i<5;i++){bw[i]=w[i];tot+=bw[i];}}
 else{for(int i=0;i<5;i++){if(w[i]>.004)m=max(m,w[i]+s[i].a*.55);}
  for(int i=0;i<5;i++){bw[i]=w[i]>.004?max(0.0,w[i]+s[i].a*.55-m+.22):0.0;tot+=bw[i];}}
 vec3 albedo=vec3(0.0);float H=0.0;
 for(int i=0;i<5;i++){float k=bw[i]/max(tot,1e-4);albedo+=s[i].rgb*k;H+=s[i].a*k;}
 float dist=length(vWorld-uEye);
 if(uLevel==2){float near=1.0-smoothstep(4.0,22.0,dist);
  vec4 micro=texture(uMat,vec3(p/(uTile[0]*.21),0.0));albedo*=mix(1.0,.82+.36*micro.a,near*.6);H+=micro.a*.25*near;}
 // Yörünge (HiRISE) makro albedosu: uzak arazide parlak/koyu bölgeler
 float macro=texture(uMacro,(p+uMapHalf)/(2.0*uMapHalf)).r;
 albedo*=mix(1.0,.62+.76*macro,uMacroAmt);
 albedo*=vColor;
 vec3 n=normalize(vNormal);
 if(uLevel>0){vec3 dpdx=dFdx(vWorld),dpdy=dFdy(vWorld);float dhdx=dFdx(H),dhdy=dFdy(H);
  vec3 r1=cross(dpdy,n),r2=cross(n,dpdx);float det=dot(dpdx,r1);
  vec3 grad=sign(det)*(dhdx*r1+dhdy*r2);float fade=1.0-smoothstep(10.0,45.0,dist);
  n=normalize(abs(det)*n-grad*uBump*fade);}
 vec3 sun=normalize(uSun);
 float diffuse=max(dot(n,sun),0.0);float sky=.5+.5*n.y;float occ=clamp(.72+.28*sky,0.0,1.0)*mix(.82,1.04,H);
 float grain=(hash(floor(vWorld*9.7))-.5)*(uLevel==0?.05:.02);
 vec3 base=albedo*(.36+.70*diffuse+.17*sky)*occ+grain;
 vec3 viewDir=normalize(uEye-vWorld);float spec=pow(max(dot(reflect(-sun,n),viewDir),0.),24.)*.05*(1.0-H*.5);
 base+=spec*vec3(1.,.83,.64);
 float haze=clamp(1.0-exp(-dist*dist*uFogDensity*uFogDensity),0.0,.91);
 base=mix(base,uFogColor,haze);
 base=pow(max(base,vec3(0.0)),vec3(.88));
 outColor=vec4(base,1.0);
}`;
export class Renderer {
  constructor(canvas){this.canvas=canvas;this.gl=canvas.getContext('webgl2',{alpha:false,antialias:true,powerPreference:'high-performance'});if(!this.gl)throw new Error('WebGL2 unavailable');const g=this.gl;
  this.p=program(g,vertex,fragment);this.skyP=program(g,skyVert,skyFrag);this.u={};for(const name of ['uModel','uViewProj','uEye','uSun','uFogColor','uFogDensity','uOpacity','uGlow','uTime'])this.u[name]=g.getUniformLocation(this.p,name);
  this.tP=program(g,terrainVertex,terrainFragment);this.tu={};for(const name of ['uViewProj','uEye','uSun','uFogColor','uFogDensity','uMat','uMacro','uTile','uLevel','uMapHalf','uMacroAmt','uBump'])this.tu[name]=g.getUniformLocation(this.tP,name);
  this.skyVao=g.createVertexArray();g.bindVertexArray(this.skyVao);const sky=g.createBuffer();g.bindBuffer(g.ARRAY_BUFFER,sky);g.bufferData(g.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),g.STATIC_DRAW);g.enableVertexAttribArray(0);g.vertexAttribPointer(0,2,g.FLOAT,false,0,0);g.bindVertexArray(null);
  this.aniso=g.getExtension('EXT_texture_filter_anisotropic');this.maxAniso=this.aniso?g.getParameter(this.aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT):1;
  g.enable(g.DEPTH_TEST);g.depthFunc(g.LEQUAL);g.enable(g.BLEND);g.blendFunc(g.SRC_ALPHA,g.ONE_MINUS_SRC_ALPHA);this.meshes=[];this.time=0;this.evening=0;this.fog=.006;this.eye=[0,8,20];this.viewProj=I();this.pixelRatioCap=1.45;this.sun=[-.48,.92,-.3];this.fogColor=[.72,.43,.32];}
  /** sizes: köşe başına öznitelik boyutları; varsayılan konum(3) normal(3) renk(3). Arazi: [3,3,3,4]. */
  upload(data,sizes=[3,3,3]){const g=this.gl;const vao=g.createVertexArray();g.bindVertexArray(vao);const buffer=g.createBuffer();g.bindBuffer(g.ARRAY_BUFFER,buffer);g.bufferData(g.ARRAY_BUFFER,data,g.STATIC_DRAW);const stride=sizes.reduce((a,b)=>a+b,0);let off=0;sizes.forEach((n,i)=>{g.enableVertexAttribArray(i);g.vertexAttribPointer(i,n,g.FLOAT,false,stride*4,off*4);off+=n;});g.bindVertexArray(null);const mesh={vao,count:data.length/stride,buffer,stride};this.meshes.push(mesh);return mesh;}
  update(mesh,data){const g=this.gl;g.bindVertexArray(null);g.bindBuffer(g.ARRAY_BUFFER,mesh.buffer);g.bufferData(g.ARRAY_BUFFER,data,g.DYNAMIC_DRAW);mesh.count=data.length/(mesh.stride||9);return mesh;}
  dispose(mesh){if(!mesh)return;const g=this.gl;g.deleteBuffer(mesh.buffer);g.deleteVertexArray(mesh.vao);mesh.count=0;this.meshes=this.meshes.filter(m=>m!==mesh);}
  /** layers: Uint8Array RGBA (size×size) dizisi — RGB albedo, A yükseklik. */
  createTextureArray(layers,size,aniso=4){const g=this.gl,t=g.createTexture();g.bindTexture(g.TEXTURE_2D_ARRAY,t);
   g.texImage3D(g.TEXTURE_2D_ARRAY,0,g.RGBA8,size,size,layers.length,0,g.RGBA,g.UNSIGNED_BYTE,null);
   layers.forEach((d,i)=>g.texSubImage3D(g.TEXTURE_2D_ARRAY,0,0,0,i,size,size,1,g.RGBA,g.UNSIGNED_BYTE,d));
   g.texParameteri(g.TEXTURE_2D_ARRAY,g.TEXTURE_WRAP_S,g.REPEAT);g.texParameteri(g.TEXTURE_2D_ARRAY,g.TEXTURE_WRAP_T,g.REPEAT);
   g.texParameteri(g.TEXTURE_2D_ARRAY,g.TEXTURE_MIN_FILTER,g.LINEAR_MIPMAP_LINEAR);g.texParameteri(g.TEXTURE_2D_ARRAY,g.TEXTURE_MAG_FILTER,g.LINEAR);
   if(this.aniso)g.texParameterf(g.TEXTURE_2D_ARRAY,this.aniso.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(aniso,this.maxAniso));
   g.generateMipmap(g.TEXTURE_2D_ARRAY);g.bindTexture(g.TEXTURE_2D_ARRAY,null);return t;}
  createTexture2D(data,size){const g=this.gl,t=g.createTexture();g.bindTexture(g.TEXTURE_2D,t);g.texImage2D(g.TEXTURE_2D,0,g.RGBA8,size,size,0,g.RGBA,g.UNSIGNED_BYTE,data);
   g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_S,g.CLAMP_TO_EDGE);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_T,g.CLAMP_TO_EDGE);
   g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MIN_FILTER,g.LINEAR_MIPMAP_LINEAR);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MAG_FILTER,g.LINEAR);g.generateMipmap(g.TEXTURE_2D);g.bindTexture(g.TEXTURE_2D,null);return t;}
  deleteTexture(t){if(t)this.gl.deleteTexture(t);}
  resize(){const rect=this.canvas.getBoundingClientRect();const pixelRatio=this.renderScale>0?this.renderScale:Math.min(window.devicePixelRatio||1,this.pixelRatioCap);const lim=Math.min(1,4096/Math.max(1,rect.width*pixelRatio,rect.height*pixelRatio));const w=Math.max(1,Math.floor(rect.width*pixelRatio*lim)),h=Math.max(1,Math.floor(rect.height*pixelRatio*lim));if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;}this.gl.viewport(0,0,w,h);return {width:rect.width,height:rect.height,aspect:w/h};}
  begin(eye,target,time){const g=this.gl;this.time=time;this.eye=eye;const r=this.resize();this.viewProj=matmul(perspective(Math.PI/3.7,r.aspect,.14,550),lookAt(eye,target));this.sun=[-.48,.92-this.evening*.69,-.3];this.fogColor=[.72-.11*this.evening,.43-.12*this.evening,.32-.08*this.evening];g.disable(g.DEPTH_TEST);g.depthMask(false);g.useProgram(this.skyP);g.bindVertexArray(this.skyVao);g.uniform1f(g.getUniformLocation(this.skyP,'uTime'),time);g.uniform1f(g.getUniformLocation(this.skyP,'uEvening'),this.evening);g.drawArrays(g.TRIANGLES,0,6);g.bindVertexArray(null);g.enable(g.DEPTH_TEST);g.depthMask(true);g.clear(g.DEPTH_BUFFER_BIT);g.useProgram(this.p);g.uniformMatrix4fv(this.u.uViewProj,false,new Float32Array(this.viewProj));g.uniform3fv(this.u.uEye,new Float32Array(eye));g.uniform3fv(this.u.uSun,new Float32Array(this.sun));g.uniform3fv(this.u.uFogColor,new Float32Array(this.fogColor));g.uniform1f(this.u.uFogDensity,this.fog);g.uniform1f(this.u.uTime,time);}
  /** opts: {matTex, macroTex, tiles:[5], level:0|1|2, mapHalf, macroAmt, bump} */
  drawTerrain(mesh,opts){if(!mesh||!mesh.count)return;const g=this.gl,u=this.tu;g.useProgram(this.tP);
   g.uniformMatrix4fv(u.uViewProj,false,new Float32Array(this.viewProj));g.uniform3fv(u.uEye,new Float32Array(this.eye));g.uniform3fv(u.uSun,new Float32Array(this.sun));g.uniform3fv(u.uFogColor,new Float32Array(this.fogColor));g.uniform1f(u.uFogDensity,this.fog);
   g.activeTexture(g.TEXTURE0);g.bindTexture(g.TEXTURE_2D_ARRAY,opts.matTex);g.uniform1i(u.uMat,0);
   g.activeTexture(g.TEXTURE1);g.bindTexture(g.TEXTURE_2D,opts.macroTex);g.uniform1i(u.uMacro,1);g.activeTexture(g.TEXTURE0);
   g.uniform1fv(u.uTile,new Float32Array(opts.tiles));g.uniform1i(u.uLevel,opts.level);g.uniform1f(u.uMapHalf,opts.mapHalf);g.uniform1f(u.uMacroAmt,opts.macroAmt);g.uniform1f(u.uBump,opts.bump);
   g.bindVertexArray(mesh.vao);g.drawArrays(g.TRIANGLES,0,mesh.count);g.bindVertexArray(null);g.useProgram(this.p);}
  draw(mesh,model=I(),opacity=1,glow=0){if(!mesh||!mesh.count)return;const g=this.gl;g.useProgram(this.p);g.bindVertexArray(mesh.vao);g.uniformMatrix4fv(this.u.uModel,false,new Float32Array(model));g.uniform1f(this.u.uOpacity,opacity);g.uniform1f(this.u.uGlow,glow);if(opacity<1)g.depthMask(false);g.drawArrays(g.TRIANGLES,0,mesh.count);if(opacity<1)g.depthMask(true);}
  project(p){const m=this.viewProj,x=p[0],y=p[1],z=p[2],cx=m[0]*x+m[4]*y+m[8]*z+m[12],cy=m[1]*x+m[5]*y+m[9]*z+m[13],cz=m[2]*x+m[6]*y+m[10]*z+m[14],w=m[3]*x+m[7]*y+m[11]*z+m[15];if(w<=0.05)return null;const s=this.canvas.getBoundingClientRect();return {x:(cx/w*.5+.5)*s.width,y:(1-(cy/w*.5+.5))*s.height,visible:Math.abs(cx/w)<1.1&&Math.abs(cy/w)<1.1&&cz/w<1};}
}
