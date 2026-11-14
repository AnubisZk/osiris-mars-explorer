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
export function terrainHeight(x,z){return -.38 +1.05*fbm(x*.065,z*.065)+.27*fbm(x*.24,z*.24) + crater(x,z,-42,-52,14,3.3)+crater(x,z,37,-5,21,2.8)+crater(x,z,-65,44,18,3.8) - .55*Math.exp(-x*x/420);}
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
export class Renderer {
  constructor(canvas){this.canvas=canvas;this.gl=canvas.getContext('webgl2',{alpha:false,antialias:true,powerPreference:'high-performance'});if(!this.gl)throw new Error('WebGL2 unavailable');const g=this.gl;
  this.p=program(g,vertex,fragment);this.skyP=program(g,skyVert,skyFrag);this.u={};for(const name of ['uModel','uViewProj','uEye','uSun','uFogColor','uFogDensity','uOpacity','uGlow','uTime'])this.u[name]=g.getUniformLocation(this.p,name);
  this.skyVao=g.createVertexArray();g.bindVertexArray(this.skyVao);const sky=g.createBuffer();g.bindBuffer(g.ARRAY_BUFFER,sky);g.bufferData(g.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),g.STATIC_DRAW);g.enableVertexAttribArray(0);g.vertexAttribPointer(0,2,g.FLOAT,false,0,0);g.bindVertexArray(null);
  g.enable(g.DEPTH_TEST);g.depthFunc(g.LEQUAL);g.enable(g.BLEND);g.blendFunc(g.SRC_ALPHA,g.ONE_MINUS_SRC_ALPHA);this.meshes=[];this.time=0;this.evening=0;this.fog=.006;this.eye=[0,8,20];this.viewProj=I();}
  upload(data){const g=this.gl;const vao=g.createVertexArray();g.bindVertexArray(vao);const buffer=g.createBuffer();g.bindBuffer(g.ARRAY_BUFFER,buffer);g.bufferData(g.ARRAY_BUFFER,data,g.STATIC_DRAW);const stride=9*4;for(let i=0;i<3;i++){g.enableVertexAttribArray(i);g.vertexAttribPointer(i,3,g.FLOAT,false,stride,i*3*4);}g.bindVertexArray(null);const mesh={vao,count:data.length/9,buffer};this.meshes.push(mesh);return mesh;}
  resize(){const rect=this.canvas.getBoundingClientRect();const pixelRatio=Math.min(window.devicePixelRatio||1,1.45);const w=Math.max(1,Math.floor(rect.width*pixelRatio)),h=Math.max(1,Math.floor(rect.height*pixelRatio));if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;}this.gl.viewport(0,0,w,h);return {width:rect.width,height:rect.height,aspect:w/h};}
  begin(eye,target,time){const g=this.gl;this.time=time;this.eye=eye;const r=this.resize();this.viewProj=matmul(perspective(Math.PI/3.7,r.aspect,.14,550),lookAt(eye,target));g.disable(g.DEPTH_TEST);g.depthMask(false);g.useProgram(this.skyP);g.bindVertexArray(this.skyVao);g.uniform1f(g.getUniformLocation(this.skyP,'uTime'),time);g.uniform1f(g.getUniformLocation(this.skyP,'uEvening'),this.evening);g.drawArrays(g.TRIANGLES,0,6);g.bindVertexArray(null);g.enable(g.DEPTH_TEST);g.depthMask(true);g.clear(g.DEPTH_BUFFER_BIT);g.useProgram(this.p);g.uniformMatrix4fv(this.u.uViewProj,false,new Float32Array(this.viewProj));g.uniform3fv(this.u.uEye,new Float32Array(eye));g.uniform3fv(this.u.uSun,new Float32Array([-.48,.92-this.evening*.69,-.3]));g.uniform3fv(this.u.uFogColor,new Float32Array([.72-.11*this.evening,.43-.12*this.evening,.32-.08*this.evening]));g.uniform1f(this.u.uFogDensity,this.fog);g.uniform1f(this.u.uTime,time);}
  draw(mesh,model=I(),opacity=1,glow=0){if(!mesh||!mesh.count)return;const g=this.gl;g.useProgram(this.p);g.bindVertexArray(mesh.vao);g.uniformMatrix4fv(this.u.uModel,false,new Float32Array(model));g.uniform1f(this.u.uOpacity,opacity);g.uniform1f(this.u.uGlow,glow);if(opacity<1)g.depthMask(false);g.drawArrays(g.TRIANGLES,0,mesh.count);if(opacity<1)g.depthMask(true);}
  project(p){const m=this.viewProj,x=p[0],y=p[1],z=p[2],cx=m[0]*x+m[4]*y+m[8]*z+m[12],cy=m[1]*x+m[5]*y+m[9]*z+m[13],cz=m[2]*x+m[6]*y+m[10]*z+m[14],w=m[3]*x+m[7]*y+m[11]*z+m[15];if(w<=0.05)return null;const s=this.canvas.getBoundingClientRect();return {x:(cx/w*.5+.5)*s.width,y:(1-(cy/w*.5+.5))*s.height,visible:Math.abs(cx/w)<1.1&&Math.abs(cy/w)<1.1&&cz/w<1};}
}
