import {MeshBuilder,I,T,S,RX,RY,RZ,matmul,TR,terrainHeight,gradientTerrain,fbm,noise2,normalize,clamp,palette,lerp,cross,sub} from './engine.js';
import {weightsCore,applyMapToWeights,materialWeights} from './materials.js';
const P=palette;
const vary=(c,f)=>c.map(v=>clamp(v*f,0,1));
const rng=(n)=>{let x=Math.sin(n*127.32+12.73)*43758.5453;return x-Math.floor(x);};
export const TARGETS=[
 {name:'HEMATİT',label:'KAYA 01',x:-15.5,z:-10.5,tag:'Demir oksit oluşumu'},
 {name:'SEDİMAN',label:'KAYA 02',x:17.0,z:-24.5,tag:'Antik tortul katman'},
 {name:'BAZALT',label:'KAYA 03',x:-8,z:-43.0,tag:'Volkanik kayaç'},
];
function lerpColor(a,b,t){return a.map((v,i)=>lerp(v,b[i],t));}
export let TERRAIN_GRID=166;export const TERRAIN_SPAN=212;
export function setTerrainGrid(n){TERRAIN_GRID=n;}
// Height of the actual triangulated terrain mesh (used so tire tracks lie exactly on the visible ground).
export function terrainMeshHeight(x,z){const step=TERRAIN_SPAN/TERRAIN_GRID,half=TERRAIN_SPAN/2;
 const gx=clamp((x+half)/step,0,TERRAIN_GRID-1e-6),gz=clamp((z+half)/step,0,TERRAIN_GRID-1e-6);const i=Math.floor(gx),j=Math.floor(gz),u=gx-i,v=gz-j;
 const x0=-half+i*step,z0=-half+j*step,x1=x0+step,z1=z0+step;
 const ha=terrainHeight(x0,z0),hb=terrainHeight(x1,z0),hc=terrainHeight(x1,z1),hd=terrainHeight(x0,z1);
 return u+v<=1?ha+(hb-ha)*u+(hd-ha)*v:hc+(hd-hc)*(1-u)+(hb-hc)*(1-v);}
/** Arazi ağı: yumuşak normaller, köşe başına malzeme ağırlıkları ve oyuk gölgesi (AO). Köşe: konum3 normal3 renk3 ağırlık4. */
export function buildTerrain(renderer,grid=TERRAIN_GRID){setTerrainGrid(grid);
 const N=grid+1,step=TERRAIN_SPAN/grid,half=TERRAIN_SPAN/2,H=new Float32Array(N*N);
 for(let j=0;j<N;j++)for(let i=0;i<N;i++)H[j*N+i]=terrainHeight(-half+i*step,-half+j*step);
 const hAt=(i,j)=>H[clamp(j,0,grid)*N+clamp(i,0,grid)],k=Math.max(1,Math.round(5/step));
 const NRM=new Float32Array(N*N*3),AO=new Float32Array(N*N),W=new Float32Array(N*N*4),w=new Float32Array(4);
 for(let j=0;j<N;j++)for(let i=0;i<N;i++){const x=-half+i*step,z=-half+j*step,h=hAt(i,j),id=j*N+i;
  const dx=(hAt(i+1,j)-hAt(i-1,j))/(2*step),dz=(hAt(i,j+1)-hAt(i,j-1))/(2*step),nl=Math.hypot(dx,1,dz);
  NRM[id*3]=-dx/nl;NRM[id*3+1]=1/nl;NRM[id*3+2]=-dz/nl;
  const lap=(hAt(i+1,j)+hAt(i-1,j)+hAt(i,j+1)+hAt(i,j-1)-4*h)/(step*step);AO[id]=clamp(1-lap*.22,.80,1.05);
  const low=h-(hAt(i+k,j)+hAt(i-k,j)+hAt(i,j+k)+hAt(i,j-k))/4;
  weightsCore(x,z,h,Math.hypot(dx,dz),low,w);applyMapToWeights(x,z,w);W.set(w,id*4);}
 const out=new Float32Array(grid*grid*6*13);let o=0;
 const put=(i,j)=>{const id=j*N+i,a=AO[id];out[o++]=-half+i*step;out[o++]=H[id];out[o++]=-half+j*step;out[o++]=NRM[id*3];out[o++]=NRM[id*3+1];out[o++]=NRM[id*3+2];
  out[o++]=a;out[o++]=a;out[o++]=a;out[o++]=W[id*4];out[o++]=W[id*4+1];out[o++]=W[id*4+2];out[o++]=W[id*4+3];};
 for(let j=0;j<grid;j++)for(let i=0;i<grid;i++){put(i,j);put(i,j+1);put(i+1,j);put(i+1,j);put(i,j+1);put(i+1,j+1);}  // (a,d,b) (b,d,c) — terrainMeshHeight ile aynı bölme
 return renderer.upload(out,[3,3,3,4]);}
// ── Kayalar: ikosahedron tabanlı, gürültüyle bozulmuş, düzlemsel kırıklı (köşeli bazalt / rüzgârla aşınmış ventifakt), kısmen gömülü, üstü tozlu
const PHI=(1+Math.sqrt(5))/2;
const ICO_V=[[-1,PHI,0],[1,PHI,0],[-1,-PHI,0],[1,-PHI,0],[0,-1,PHI],[0,1,PHI],[0,-1,-PHI],[0,1,-PHI],[PHI,0,-1],[PHI,0,1],[-PHI,0,-1],[-PHI,0,1]].map(v=>normalize(v));
const ICO_F=[[0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],[1,5,9],[5,11,4],[11,10,2],[10,7,6],[7,1,8],[3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],[4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1]];
function subdivide({V,F}){const nv=V.slice(),cache=new Map(),mid=(a,b)=>{const key=a<b?a+'_'+b:b+'_'+a;if(!cache.has(key)){nv.push(normalize([(V[a][0]+V[b][0])/2,(V[a][1]+V[b][1])/2,(V[a][2]+V[b][2])/2]));cache.set(key,nv.length-1);}return cache.get(key);};
 const nf=[];for(const [a,b,c] of F){const ab=mid(a,b),bc=mid(b,c),ca=mid(c,a);nf.push([a,ab,ca],[b,bc,ab],[c,ca,bc],[ab,bc,ca]);}return {V:nv,F:nf};}
const ROCK_GEO=[{V:ICO_V,F:ICO_F}];ROCK_GEO.push(subdivide(ROCK_GEO[0]));ROCK_GEO.push(subdivide(ROCK_GEO[1]));
function vnoise3(x,y,z,s){const h=(a,b,c)=>rng(a*157.31+b*311.7+c*74.7+s*13.1);const xi=Math.floor(x),yi=Math.floor(y),zi=Math.floor(z),fx=x-xi,fy=y-yi,fz=z-zi;
 const u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy),w=fz*fz*(3-2*fz),L=(a,b,t)=>a+(b-a)*t;
 return L(L(L(h(xi,yi,zi),h(xi+1,yi,zi),u),L(h(xi,yi+1,zi),h(xi+1,yi+1,zi),u),v),L(L(h(xi,yi,zi+1),h(xi+1,yi,zi+1),u),L(h(xi,yi+1,zi+1),h(xi+1,yi+1,zi+1),u),v),w);}
const ROCK_PAL={basalt:[[.21,.19,.18],[.27,.23,.21],[.33,.27,.23]],light:[[.58,.45,.36],[.66,.52,.41]],red:[[.44,.27,.19],[.52,.32,.22]]};
const DUST_COAT=[.66,.41,.27];
export function rock(b,x,z,r,seed,palette=ROCK_PAL.basalt,level=1,dustAmt=.55){
 const geo=ROCK_GEO[Math.min(level,2)],yaw=rng(seed)*Math.PI*2,fy=.42+.38*rng(seed+1),sx=.8+.45*rng(seed+2),sz=.8+.45*rng(seed+3),cy=Math.cos(yaw),sy=Math.sin(yaw);
 const cuts=[0,1,2].map(k=>{const a=rng(seed+10+k)*Math.PI*2,e=(rng(seed+20+k)-.3)*1.2;return [normalize([Math.cos(a)*Math.cos(e),Math.sin(e),Math.sin(a)*Math.cos(e)]),.55+.3*rng(seed+30+k)];});
 const ground=terrainHeight(x,z),P=geo.V.map(v=>{let d=1+.34*(vnoise3(v[0]*1.6,v[1]*1.6,v[2]*1.6,seed)-.5)*2+.1*(vnoise3(v[0]*4,v[1]*4,v[2]*4,seed+7)-.5);
  let p=[v[0]*d,v[1]*d,v[2]*d];for(const [n,c] of cuts){const t=p[0]*n[0]+p[1]*n[1]+p[2]*n[2];if(t>c){p=[p[0]-n[0]*(t-c),p[1]-n[1]*(t-c),p[2]-n[2]*(t-c)];}}
  const lx=p[0]*sx*r,ly=p[1]*fy*r,lz=p[2]*sz*r;return [x+lx*cy+lz*sy,ground+ly+r*fy*.28,z-lx*sy+lz*cy];});
 const base=palette[Math.floor(rng(seed+5)*palette.length)];
 for(const [a,c,d] of geo.F){const A=P[a],B=P[c],C=P[d],n=normalize(cross(sub(B,A),sub(C,A)));
  const up=clamp((n[1]-.25)/.6,0,1)*dustAmt,v=.86+.24*rng(seed+a*3.1+c*1.7+d*.9),low=clamp(((A[1]+B[1]+C[1])/3-ground)/(r*.25),.55,1);
  b.tri(A,B,C,[lerp(base[0]*v,DUST_COAT[0],up)*low,lerp(base[1]*v,DUST_COAT[1],up)*low,lerp(base[2]*v,DUST_COAT[2],up)*low]);}
 return Math.max(...P.map(p=>p[1]))-ground;}
/** q: {boulders, rockLevel} kalite ayarı. Kaya yoğunluğu zemine göre: çakıllı alanda çok, kumda az. */
/** Çarpışma ve gezgin engel denetimi için kaya listesi {x,z,r,h} (v3.0). Her buildEnvironment çağrısında yenilenir. */
export const ENGELLER=[];
const engel=(x,z,r,h)=>{if(r>=.12)ENGELLER.push({x,z,r,h});};
export function buildEnvironment(renderer,q={boulders:490,rockLevel:1}){const b=new MeshBuilder(),w=new Float32Array(4);let placed=0;ENGELLER.length=0;
 for(let i=0;placed<q.boulders&&i<q.boulders*4;i++){
 const x=(rng(i+5)-.5)*204,z=(rng(i+4153)-.5)*204;
 if((x*x+(z-19)*(z-19))<85 || TARGETS.some(p=>(p.x-x)**2+(p.z-z)**2<15))continue;
 materialWeights(x,z,w);const keep=.22+.95*w[2]+.35*w[1]-.75*w[0]-.35*w[3];if(rng(i+777)>keep)continue;
 const radius=.10+1.7*Math.pow(rng(i+920),3.4)*(1+.6*w[2]);const pal=rng(i+56)<.68?ROCK_PAL.basalt:rng(i+57)<.5?ROCK_PAL.red:ROCK_PAL.light;
 engel(x,z,radius,rock(b,x,z,radius,i*3.1+.7,pal,radius>.6?q.rockLevel+1:q.rockLevel,.35+.4*w[3]));placed++;
 }
 // Three distinct geology targets: layered/coloured rocks.
 const TARGET_PAL=[[[.42,.19,.14],[.50,.23,.16]],[[.62,.48,.37],[.70,.55,.42]],[[.20,.19,.19],[.26,.24,.22]]];
 TARGETS.forEach((site,i)=>{const y=terrainHeight(site.x,site.z);engel(site.x,site.z,2.0,rock(b,site.x,site.z,2.0,31+i*23,TARGET_PAL[i],q.rockLevel+1,.4));for(let l=0;l<3;l++){
 const ox=site.x+(rng(i*4+l+3)-.5)*4,oz=site.z+(rng(i*6+l+92)-.5)*4;
 const rr=.45+.42*rng(l+i*12);engel(ox,oz,rr,rock(b,ox,oz,rr,i*72+l,TARGET_PAL[i],q.rockLevel,.45));}
 // orbital marker strips and perimeter spikes
 b.ring(site.x,y+.17,site.z,3.5,3.59,P.amber,60);
 for(let k=0;k<12;k++){const a=k*Math.PI*2/12,bx=site.x+Math.cos(a)*3.62,bz=site.z+Math.sin(a)*3.62;b.box(bx,terrainHeight(bx,bz)+.04,bz,.35,.04,.07,P.amber);}
 b.tube([site.x+2.6,y+.05,site.z-2.6],[site.x+2.6,y+2.2,site.z-2.6],.035,P.steel2);
 b.sphere(site.x+2.6,y+2.25,site.z-2.6,.13,.13,.13,P.amber);
 });
 const scenery=b.build(renderer);
 // Route guidance painted on the ground (noninteractive navigation beacons).
 const route=new MeshBuilder();let previous={x:0,z:15};for(const site of TARGETS){const dx=site.x-previous.x,dz=site.z-previous.z,total=Math.hypot(dx,dz),steps=Math.floor(total/3.5);for(let k=1;k<steps;k++){const t=k/steps,x=previous.x+dx*t,z=previous.z+dz*t,y=terrainHeight(x,z)+.12,ang=Math.atan2(dx,dz);route.with(matmul(T(x,y,z),RY(ang)),()=>route.box(0,0,0,.08,.025,.45,P.gold));}previous=site;}
 return {scenery,route:route.build(renderer)};
}
// ---------------------------------------------------------------------------
// ARAÇ MODELLERİ — takımın mimari çizimlerine göre (modeller.json, v1.0). Birim: metre.
// Gezgin: 1,60 (boy, z) × 1,20 (en, x) × 1,25 (yükseklik) m; 6 teker Ø0,26 m, iz 0,90 m,
// aks aralığı 2 × 0,65 m, yerden yükseklik 0,30 m; önde kol + kamera direği + güneş paneli,
// arkada 0,60 × 0,60 m drone iniş platformu. Model kökü = tekerlerin yere bastığı düzlem.
// Drone: Ingenuity esaslı; gövde 0,136 × 0,163 × 0,195 m, yerden 0,13 m yüksekte; dört iniş
// ayağı (0,384 m); Ø1,20 m eş eksenli iki rotor; toplam yükseklik 0,49 m. Model kökü = ayak tabanı.
// ---------------------------------------------------------------------------
export const GEZGIN_OLCU=Object.freeze({tekerYaricap:.13,iz:.90,aks:.65,platformY:.70,platformZ:.42,platformKenar:.60,mastY:1.25});
export function buildRover(renderer){const b=new MeshBuilder();
 // Gövde (yerden 0,30 m yüksekte) ve üst plaka
 b.box(0,.40,0,.86,.20,1.30,P.steel2);
 b.box(0,.53,-.02,.92,.06,1.40,P.ceramic);
 b.box(0,.33,0,.70,.06,1.10,P.dark);
 for(const s of [-1,1]){
  // Rocker-bogie: gövdeden tekerlere bacaklar
  b.tube([s*.43,.42,-.10],[s*.45,.13,-.65],.022,P.steel);
  b.tube([s*.43,.42,-.10],[s*.45,.27,.33],.022,P.steel);
  b.tube([s*.45,.27,.33],[s*.45,.13,0],.020,P.steel);
  b.tube([s*.45,.27,.33],[s*.45,.13,.65],.020,P.steel);
  b.sphere(s*.44,.42,-.10,.035,.035,.035,P.dark,4,8);
  b.box(s*.47,.42,.18,.02,.10,.62,P.amber);
 }
 // Batarya ve ısı kontrollü depo (yanda), drone pil rafı
 b.box(.30,.62,.42,.30,.10,.50,P.gold);
 for(let i=0;i<3;i++)b.box(.30,.68,.25+i*.17,.24,.02,.12,P.dark);
 // Önde güneş paneli (120 W): hücre ızgarası
 b.box(0,.60,-.32,1.10,.03,.82,P.dark);
 for(let u=-4;u<=4;u++)for(let v=-3;v<=3;v++)b.box(u*.118,.618,-.32+v*.112,.108,.008,.100,((u+v)&1)?P.solar2:P.solar);
 // Arkada iniş platformu 0,60 × 0,60 m (H işareti, hizalama halkası, 4 noktalı kilit)
 const PY=GEZGIN_OLCU.platformY,PZ=GEZGIN_OLCU.platformZ;
 b.box(0,PY-.04,PZ,.62,.06,.62,P.steel);
 b.box(0,PY-.005,PZ,.56,.01,.56,P.black);
 b.ring(0,PY+.001,PZ,.20,.215,P.amber,40);
 b.box(-.07,PY+.003,PZ,.025,.004,.20,P.white);b.box(.07,PY+.003,PZ,.025,.004,.20,P.white);b.box(0,PY+.003,PZ,.14,.004,.025,P.white);
 for(const x of [-.25,.25])for(const z of [-.25,.25])b.box(x,PY+.03,PZ+z,.05,.06,.05,P.amber);
 // Kamera direği (ön sol) ve 360° kamera kafası: tepe 1,25 m
 b.tube([-.36,.63,-.62],[-.36,1.12,-.62],.028,P.steel2);
 b.box(-.36,1.18,-.62,.22,.12,.12,P.white);
 for(const x of [-.42,-.30]){b.cylinder(x,1.18,-.69,.028,.028,.02,P.black,10);}
 // İletişim anteni (UHF / X-bant)
 b.tube([.38,.63,-.05],[.38,1.10,-.05],.012,P.steel2);b.sphere(.38,1.11,-.05,.025,.025,.025,P.amber,4,8);
 // Robotik kol (önde) ve numune ucu
 b.tube([.22,.45,-.68],[.30,.40,-.88],.025,P.steel2);
 b.tube([.30,.40,-.88],[.26,.20,-1.00],.022,P.white);
 b.box(.26,.16,-1.02,.07,.06,.07,P.dark);
 // Ön sensörler
 for(const x of [-.20,.20])b.box(x,.42,-.66,.08,.05,.02,P.teal);
 const body=b.build(renderer);
 const w=new MeshBuilder();const R=GEZGIN_OLCU.tekerYaricap;
 w.with(RZ(Math.PI/2),()=>{
  w.cylinder(0,0,0,R,R,.08,P.tire,18);
  w.cylinder(0,.042,0,R*.62,R*.62,.01,P.steel2,16);
  w.cylinder(0,-.042,0,R*.62,R*.62,.01,P.steel,16);
  for(let k=0;k<12;k++){const a=k*Math.PI/6;w.box(Math.cos(a)*R*.97,0,Math.sin(a)*R*.97,.03,.082,.018,P.black);}
 });
 const z=GEZGIN_OLCU.aks,x=GEZGIN_OLCU.iz/2;
 return {body,wheel:w.build(renderer),wheelLocs:[[-x,R,-z],[x,R,-z],[-x,R,0],[x,R,0],[-x,R,z],[x,R,z]]};
}
export const DRONE_OLCU=Object.freeze({altRotorY:.33,ustRotorY:.40,rotorYaricap:.60,yukseklik:.49});
export function buildDrone(renderer){const b=new MeshBuilder();
 // Gövde 0,136 × 0,163 × 0,195 m, yerden 0,13 m yukarıda
 b.box(0,.2115,0,.136,.163,.195,P.gold);
 b.box(0,.2115,-.0985,.11,.12,.003,P.white);
 // Burun lambası (v2.3): yön uzaktan okunabilsin
 b.box(0,.145,-.103,.035,.018,.01,P.amber);
 b.cylinder(0,.115,-.04,.022,.022,.03,P.black,10);
 // İniş ayakları (dört adet, ≈0,38 m)
 for(const x of [-1,1])for(const z of [-1,1]){
  b.tube([x*.05,.16,z*.07],[x*.30,.012,z*.30],.008,P.steel);
  b.sphere(x*.30,.012,z*.30,.025,.012,.025,P.white,4,8);
 }
 // Direk, rotor göbekleri ve güneş paneli (425 × 165 mm)
 b.tube([0,.293,0],[0,.47,0],.012,P.steel2);
 b.cylinder(0,DRONE_OLCU.altRotorY,0,.03,.03,.025,P.black,10);
 b.cylinder(0,DRONE_OLCU.ustRotorY,0,.03,.03,.025,P.white,10);
 b.box(0,.475,0,.425,.012,.165,P.solar2);
 b.box(0,.482,0,.40,.003,.14,P.solar);
 const body=b.build(renderer);
 // Rotorlar ayrı hareketli parçalar: zıt yönde dönen iki pala çifti, yarıçap 0,60 m
 const rotor=(top)=>{
  const r=new MeshBuilder();const c=top?P.ceramic:P.steel2;
  for(const a of [0,Math.PI]){
   r.with(RY(a),()=>{
    r.box(.31,0,0,.56,.008,.075,c);
    r.box(.585,0,0,.03,.01,.05,P.gold);
   });
  }
  r.cylinder(0,0,0,.035,.035,.03,P.dark,10);
  return r.build(renderer);
 };
 const shadow=new MeshBuilder();shadow.ring(0,0,0,.001,.62,P.shadow,40);
 return {body,top:rotor(true),bottom:rotor(false),shadow:shadow.build(renderer)};
}
export function buildExtra(renderer){const marker=new MeshBuilder();marker.ring(0,0,0,.30,.32,P.teal,40);marker.ring(0,0,0,.40,.41,P.amber,40);const pad=marker.build(renderer);
 const beacons=new MeshBuilder();for(let i=0;i<16;i++){const a=i*Math.PI*2/16,rad=4.5+i%3*.4,x=Math.cos(a)*rad,z=Math.sin(a)*rad;beacons.box(x,.025,z,.13,.05,.21,P.steel2);}
 const dust=new MeshBuilder();dust.sphere(0,0,0,1,.72,1,[.97,.74,.58],4,9);
 return {pad,beacons:beacons.build(renderer),dust:dust.build(renderer),tracks:renderer.upload(new Float32Array(0))};
}
