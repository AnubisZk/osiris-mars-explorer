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
function boulder(b,x,z,r,col,seed){const y=terrainHeight(x,z)+r*.48;const n=7;const xs=[],zs=[];for(let i=0;i<n;i++){const a=i*Math.PI*2/n,radius=r*(.76+.38*rng(seed+i*1.44));xs.push(x+Math.cos(a)*radius);zs.push(z+Math.sin(a)*radius);}const top=[x+.2*r*(rng(seed+11)-.5),y+r*(.46+.34*rng(seed+17)),z+.2*r*(rng(seed+13)-.5)];for(let i=0;i<n;i++){const j=(i+1)%n;const a=[xs[i],terrainHeight(xs[i],zs[i])+.08,zs[i]],c=[xs[j],terrainHeight(xs[j],zs[j])+.08,zs[j]];const shade=.82+.25*rng(seed+i*12.3);b.tri(a,top,c,vary(col,shade));}}
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
export function buildRover(renderer){const b=new MeshBuilder();
 // Lower body and titanium frame.
 b.box(0,-.02,0,2.15,.35,2.85,P.dark);b.box(0,.18,-.10,2.45,.48,3.15,P.steel2);
 b.box(0,.48,-.14,2.02,.23,2.57,P.ceramic);
 b.box(0,.56,-1.0,1.82,.19,.62,P.white);
 b.box(0,.54,1.24,2.4,.14,.38,P.dark);
 // Hull armor with highlights.
 for(const s of [-1,1]){
 b.box(s*1.16,.28,-.12,.11,.35,2.35,P.steel);
 for(const z of [-1.02,0,1.03]){
 b.tube([s*.83,-.14,z],[s*1.41,-.62,z],.075,P.steel2);
 b.tube([s*1.4,-.62,z],[s*1.48,-.75,z+.18],.055,P.dark);
 }
 b.box(s*1.06,.48,.98,.22,.15,.38,P.amber);
 }
 // Rover photovoltaic wings; satellite-grid cell details.
 for(const side of [-1,1]){
 const wing=matmul(T(side*1.55,.89,-.08),RZ(side*.13));
 b.with(wing,()=>{
 b.box(0,0,0,1.45,.08,2.22,P.dark);
 b.box(0,.055,0,1.30,.025,2.09,P.solar);
 for(let u=-3;u<=3;u++)for(let v=-5;v<=5;v++){
   b.box(u*.186,.074,v*.185,.165,.008,.160,((u+v)&1)?P.solar2:P.solar);
 }
 b.box(0,.085,0,1.42,.03,.03,P.gold);
 b.box(-.70,.08,0,.03,.03,2.24,P.gold);
 b.box(.70,.08,0,.03,.03,2.24,P.gold);
 });
 b.tube([side*.9,.48,-.75],[side*1.55,.82,-.75],.056,P.steel2);
 b.tube([side*.9,.48,.70],[side*1.55,.82,.70],.056,P.steel2);
 }
 // Helipad sized for Ingenuity-like rotor diameter and landing gear.
 b.box(0,.95,.30,1.85,.15,1.88,P.steel);
 b.box(0,1.035,.30,1.68,.02,1.68,P.black);
 b.ring(0,1.055,.30,.53,.56,P.amber,40);
 b.ring(0,1.057,.30,.74,.76,P.ceramic,40);
 b.box(0,1.062,.30,.12,.015,1.48,P.amber);
 b.box(0,1.063,.30,1.48,.015,.12,P.amber);
 for(const x of [-.8,.8])for(const z of [-.5,1.08]){
 b.box(x,1.12,z,.10,.16,.10,P.white);
 }
 // Mast, lenses, antenna, science instrument deck.
 b.tube([0,.54,-1.02],[0,2.36,-1.02],.095,P.steel2);
 b.box(0,2.40,-1.05,.55,.23,.29,P.white);
 for(const x of [-.17,.17]){
 b.cylinder(x,2.40,-1.23,.10,.10,.11,P.black,12);
 b.sphere(x,2.40,-1.29,.045,.045,.03,P.solar2,6,10);
 }
 b.tube([.80,.45,-.9],[1.35,2.18,-1.15],.035,P.steel2);
 b.sphere(1.35,2.2,-1.15,.12,.12,.12,P.white);
 b.tube([-.70,.45,1.04],[-1.28,1.82,1.2],.03,P.steel2);
 b.with(matmul(T(-1.28,1.82,1.2),RZ(.31)),()=>b.cylinder(0,0,0,.31,.31,.045,P.ceramic,20));
 // Robot arm and sample tube at the bow.
 b.tube([.50,.16,-1.26],[.64,-.17,-1.75],.095,P.steel2);
 b.tube([.64,-.17,-1.75],[.34,-.26,-2.03],.075,P.white);
 b.box(.33,-.25,-2.08,.32,.17,.30,P.dark);
 // Detail vents and status lamps.
 for(let i=0;i<5;i++)b.box(-.65+i*.31,.57,-1.12,.13,.02,.25,P.dark);
 b.box(.75,.65,-.82,.13,.1,.38,P.teal);
 const body=b.build(renderer);
 const w=new MeshBuilder();
 w.with(RZ(Math.PI/2),()=>{
 w.cylinder(0,0,0,.49,.49,.31,P.tire,20);
 w.cylinder(0,.185,0,.29,.29,.04,P.steel2,20);
 w.cylinder(0,-.185,0,.29,.29,.04,P.steel,20);
 w.cylinder(0,.216,0,.12,.12,.06,P.dark,16);
 for(let k=0;k<10;k++){
 const a=k*Math.PI/5;
 w.box(Math.cos(a)*.37,0,Math.sin(a)*.37,.16,.34,.075,P.steel);
 }
 for(let k=0;k<7;k++){const a=k*Math.PI*2/7;w.with(RY(a),()=>w.box(.0,0,.38,.18,.36,.10,P.black));}
 });
 return {body,wheel:w.build(renderer),wheelLocs:[[-1.41,-.73,-1.11],[1.41,-.73,-1.11],[-1.48,-.73,0],[1.48,-.73,0],[-1.41,-.73,1.12],[1.41,-.73,1.12]]};
}
export function buildDrone(renderer){const b=new MeshBuilder();
 b.box(0,0,0,.33,.24,.35,P.gold);b.box(0,.03,-.15,.28,.16,.10,P.white);
 b.box(0,-.04,.11,.28,.10,.21,P.ceramic);
 b.box(0,-.17,-.13,.21,.11,.14,P.black);
 b.sphere(0,-.18,-.21,.095,.07,.07,P.solar2,5,10);
 // Landing skids and tiny stabilizers.
 for(const x of [-1,1]){
 b.tube([x*.15,-.1,-.10],[x*.38,-.45,-.29],.026,P.steel);
 b.tube([x*.15,-.1,.13],[x*.38,-.45,.34],.026,P.steel);
 b.tube([x*.37,-.46,-.38],[x*.37,-.46,.40],.023,P.white);
 b.tube([x*.37,-.46,-.38],[x*.37,-.46,-.28],.023,P.amber);
 }
 b.tube([0,.10,0],[0,.62,0],.045,P.steel2);
 b.cylinder(0,.33,0,.095,.095,.04,P.black);
 b.cylinder(0,.61,0,.075,.075,.05,P.white);
 b.box(0,.16,.0,.12,.04,.22,P.solar2);
 const body=b.build(renderer);
 // The rotors are separate moving meshes: two coaxial counter-rotating disks.
 const rotor=(top)=>{
 const r=new MeshBuilder();const c=top?P.ceramic:P.steel2;
 for(const a of [0,Math.PI]){
 r.with(RY(a),()=>{
 r.box(.29,.016,0,.55,.021,.075,c);
 r.box(.54,.005,0,.12,.03,.09,P.gold);
 r.box(.35,.025,.01,.40,.016,.035,P.white);
 });
 }
 r.cylinder(0,0,0,.075,.075,.08,P.dark,12);
 return r.build(renderer);
 };
 const shadow=new MeshBuilder();shadow.ring(0,0,0,.001,.86,P.shadow,44);
 return {body,top:rotor(true),bottom:rotor(false),shadow:shadow.build(renderer)};
}
export function buildExtra(renderer){const marker=new MeshBuilder();marker.ring(0,0,0,.92,1.02,P.teal,50);marker.ring(0,0,0,1.27,1.31,P.amber,50);const pad=marker.build(renderer);
 const beacons=new MeshBuilder();for(let i=0;i<16;i++){const a=i*Math.PI*2/16,rad=4.5+i%3*.4,x=Math.cos(a)*rad,z=Math.sin(a)*rad;beacons.box(x,.025,z,.13,.05,.21,P.steel2);}return {pad,beacons:beacons.build(renderer)};
}
