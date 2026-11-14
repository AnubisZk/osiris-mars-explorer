import {MeshBuilder,I,T,S,RX,RY,RZ,matmul,TR,terrainHeight,gradientTerrain,fbm,noise2,normalize,clamp,palette,lerp} from './engine.js';
const P=palette;
const vary=(c,f)=>c.map(v=>clamp(v*f,0,1));
const rng=(n)=>{let x=Math.sin(n*127.32+12.73)*43758.5453;return x-Math.floor(x);};
export const TARGETS=[
 {name:'HEMATİT',label:'KAYA 01',x:-15.5,z:-10.5,tag:'Demir oksit oluşumu'},
 {name:'SEDİMAN',label:'KAYA 02',x:17.0,z:-24.5,tag:'Antik tortul katman'},
 {name:'BAZALT',label:'KAYA 03',x:-8,z:-43.0,tag:'Volkanik kayaç'},
];
function duneMaterial(x,z){const n=fbm(x*.36,z*.36),h=terrainHeight(x,z),v=rng((Math.floor(x*8)+1000)*13.33+Math.floor(z*9));const dust=Math.sin(x*.28+z*.33+fbm(x*.03,z*.03)*7)*.5+.5;const f=clamp(.84+.28*n+.08*(v-.5)+.12*dust-.045*Math.max(0,h),.63,1.16);return vary(lerpColor(P.rust,P.sand,.35+.23*dust),f);}
function lerpColor(a,b,t){return a.map((v,i)=>lerp(v,b[i],t));}
export function buildTerrain(renderer){const terrain=new MeshBuilder();const grid=166,span=212,step=span/grid;for(let z=0;z<grid;z++)for(let x=0;x<grid;x++){
 const x0=-span/2+x*step,x1=x0+step,z0=-span/2+z*step,z1=z0+step;
 const a=[x0,terrainHeight(x0,z0),z0],b=[x1,terrainHeight(x1,z0),z0],c=[x1,terrainHeight(x1,z1),z1],d=[x0,terrainHeight(x0,z1),z1];
 terrain.tri(a,d,b,duneMaterial(x0,z0));terrain.tri(b,d,c,duneMaterial(x1,z1));}
 return terrain.build(renderer);}
export const ENGELLER=[];
function boulder(b,x,z,r,col,seed){const y=terrainHeight(x,z)+r*.48;if(r>=.12)ENGELLER.push({x,z,r,h:r*.48+r*(.46+.34*rng(seed+17))});const n=7;const xs=[],zs=[];for(let i=0;i<n;i++){const a=i*Math.PI*2/n,radius=r*(.76+.38*rng(seed+i*1.44));xs.push(x+Math.cos(a)*radius);zs.push(z+Math.sin(a)*radius);}const top=[x+.2*r*(rng(seed+11)-.5),y+r*(.46+.34*rng(seed+17)),z+.2*r*(rng(seed+13)-.5)];for(let i=0;i<n;i++){const j=(i+1)%n;const a=[xs[i],terrainHeight(xs[i],zs[i])+.08,zs[i]],c=[xs[j],terrainHeight(xs[j],zs[j])+.08,zs[j]];const shade=.82+.25*rng(seed+i*12.3);b.tri(a,top,c,vary(col,shade));}}
export function buildEnvironment(renderer){const b=new MeshBuilder();for(let i=0;i<490;i++){
 const x=(rng(i+5)-.5)*207,z=(rng(i+4153)-.5)*207;
 if((x*x+(z-19)*(z-19))<85 || TARGETS.some(p=>(p.x-x)**2+(p.z-z)**2<15))continue;
 const radius=.12+1.9*Math.pow(rng(i+920),3.6);const c=rng(i+56)>.49?P.rust:P.steel;
 boulder(b,x,z,radius,c,i*3.1);
 }
 // Three distinct geology targets: rocks themselves use high-contrast layers.
 TARGETS.forEach((site,i)=>{const y=terrainHeight(site.x,site.z);boulder(b,site.x,site.z,2.0,[.36+i*.12,.21+i*.04,.16+i*.025],31+i*23);for(let l=0;l<3;l++){
 const ox=site.x+(rng(i*4+l+3)-.5)*4,oz=site.z+(rng(i*6+l+92)-.5)*4;
 boulder(b,ox,oz,.45+.42*rng(l+i*12),i===1?P.sand:P.rust,i*72+l);}
 // orbital marker strips and perimeter spikes
 b.ring(site.x,y+.17,site.z,3.5,3.59,P.amber,60);
 for(let k=0;k<12;k++){const a=k*Math.PI*2/12,bx=site.x+Math.cos(a)*3.62,bz=site.z+Math.sin(a)*3.62;b.box(bx,terrainHeight(bx,bz)+.04,bz,.35,.04,.07,P.amber);}
 b.tube([site.x+2.6,y+.05,site.z-2.6],[site.x+2.6,y+2.2,site.z-2.6],.035,P.steel2);
 b.sphere(site.x+2.6,y+2.25,site.z-2.6,.13,.13,.13,P.amber);
 });
 // Distant sediment shelves / rocky escarpments give scale and depth.
 for(let i=0;i<38;i++){const theta=i*2.39996,dist=68+36*rng(i+222),x=Math.cos(theta)*dist,z=Math.sin(theta)*dist;
 const y=terrainHeight(x,z),r=3.5+9*rng(i+173);
 if(Math.abs(x)>104||Math.abs(z)>104)continue;
 b.with(matmul(T(x,y+.15,z),RY(theta)),()=>{
 b.box(0,.25,0,r*.9,.45,r*.8,vary(P.rust,.73+.1*rng(i)));
 b.box(-r*.12,.52,-r*.11,r*.79,.3,r*.64,vary(P.sand,.62+.2*rng(i+9)));
 b.box(-r*.25,.85,-r*.04,r*.54,.42,r*.47,vary(P.rust,.75+.1*rng(i+11)));
 });
 }
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
 const beacons=new MeshBuilder();for(let i=0;i<16;i++){const a=i*Math.PI*2/16,rad=4.5+i%3*.4,x=Math.cos(a)*rad,z=Math.sin(a)*rad;beacons.box(x,.025,z,.13,.05,.21,P.steel2);}return {pad,beacons:beacons.build(renderer)};
}
