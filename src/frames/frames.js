import {MassBuilder} from './massProperties.js';

/**
 * Three airframe structures for the same vehicle layout:
 *   carbon     conventional carbon-fibre tubes and plates
 *   fullerene  a cage on the C60 (truncated icosahedron) geometry: 60 nodes, 90 struts.
 *              The molecule is design inspiration only; no molecular property is transferred.
 *   hexcell    hexagonal shell of honeycomb-sandwich panels
 * Each builder returns structural members (for mass, drag and drawing) and rotor mounts.
 * This is NOT a strength analysis: Rapier and this module do not compute stresses — every
 * frame needs finite-element analysis (FEA) and testing before it can be called flightworthy.
 */
export const MATERIALS=Object.freeze({
  cfrp:{label:{en:'CFRP tube / plate',tr:'Karbon fiber tüp / plaka'},density:1600,status:'assumed typical'},
  node:{label:{en:'Printed lattice node',tr:'Basılı kafes düğümü'},density:1200,status:'assumed'},
  honeycomb:{label:{en:'Honeycomb sandwich panel',tr:'Bal peteği sandviç panel'},arealDensity:1.1,status:'assumed (6 mm Al core, 2 × 0.25 mm CF skins)'},
});
export const FRAME_TYPES=Object.freeze(['carbon','fullerene','hexcell']);
export const FRAME_LABELS=Object.freeze({
  carbon:{en:'Conventional carbon fibre',tr:'Geleneksel karbon fiber'},
  fullerene:{en:'C60-inspired lattice',tr:'C60 fulleren esinli kafes'},
  hexcell:{en:'Hexagonal-cell shell',tr:'Altıgen hücreli kabuk'},
});
export const FEA_NOTE=Object.freeze({
  en:'Mass, centre of mass, inertia and drag only. Structural strength is not simulated: finite-element analysis (FEA) and tests are required.',
  tr:'Yalnız kütle, kütle merkezi, atalet ve sürükleme. Yapısal dayanım simüle edilmez: sonlu elemanlar analizi (FEA) ve test gerekir.',
});

const PHI=(1+Math.sqrt(5))/2;
/** Truncated icosahedron (C60 geometry): 60 unit-circumradius vertices and 90 edges. */
export function truncatedIcosahedron(){
  const base=[[0,1,3*PHI],[1,2+PHI,2*PHI],[PHI,2,PHI**3]],verts=[];
  for(const [a,b,c] of base)for(const sa of a?[1,-1]:[1])for(const sb of [1,-1])for(const sc of [1,-1]){
    const p=[sa*a,sb*b,sc*c];
    for(let k=0;k<3;k++)verts.push([p[k%3],p[(k+1)%3],p[(k+2)%3]]); // cyclic = even permutations
  }
  const r=Math.hypot(...verts[0]),unit=verts.map(v=>v.map(x=>x/r)),edges=[],edge=2/r;
  for(let i=0;i<60;i++)for(let j=i+1;j<60;j++){
    const d=Math.hypot(unit[i][0]-unit[j][0],unit[i][1]-unit[j][1],unit[i][2]-unit[j][2]);
    if(Math.abs(d-edge)<1e-9)edges.push([i,j]);
  }
  return {vertices:unit,edges,edgeOverRadius:edge};
}

const add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]],scl=(a,s)=>[a[0]*s,a[1]*s,a[2]*s];

/**
 * layout: {kind: 'coax'|'multirotor', body: [w, h, l], mast: {base, top} (coax), arms: [[x,z]],
 *          armHeight, legs: [{from, to}]}
 * p: member sizes {tubeOD, tubeID, armOD, armID, mastOD, mastID, legOD, legID, plate, cageRadius,
 *    strutOD, strutID, nodeMass, hexRadius, hexHeight}
 */
export function buildFrame(type,layout,p){
  if(!FRAME_TYPES.includes(type))throw new RangeError(`Unknown frame '${type}'`);
  const mb=new MassBuilder(),tubes=[],panels=[],nodes=[],cf=MATERIALS.cfrp.density;
  const tube=(name,a,b,od,id,group='structure')=>{mb.tube(group,name,a,b,od,id,cf);tubes.push({a,b,od});};
  const [w,h,l]=layout.body;
  let mounts=[],shell={radius:Math.max(w,l)/2,height:h};
  if(type==='carbon'){
    if(layout.kind==='coax'){
      // fuselage box frame: 12 edges
      const xs=[-w/2,w/2],ys=[-h/2,h/2],zs=[-l/2,l/2];
      for(const y of ys)for(const z of zs)tube('fuselage-x',[xs[0],y,z],[xs[1],y,z],p.tubeOD,p.tubeID);
      for(const x of xs)for(const z of zs)tube('fuselage-y',[x,ys[0],z],[x,ys[1],z],p.tubeOD,p.tubeID);
      for(const x of xs)for(const y of ys)tube('fuselage-z',[x,y,zs[0]],[x,y,zs[1]],p.tubeOD,p.tubeID);
    }else{
      const s=Math.max(w,l),t=p.plate;
      for(const y of [-h/2+t/2,h/2-t/2]){mb.box('structure','plate',cf*s*s*t,[0,y,0],[s,t,s]);panels.push({center:[0,y,0],u:[1,0,0],n:[0,1,0],w:s,h:s,t});}
    }
  }else if(type==='fullerene'){
    const {vertices,edges}=truncatedIcosahedron(),R=p.cageRadius,v=vertices.map(x=>scl(x,R));
    for(const [i,j] of edges)tube('c60-strut',v[i],v[j],p.strutOD,p.strutID);
    for(const q of v){mb.point('structure','c60-node',p.nodeMass,q);nodes.push({p:q,r:p.strutOD*1.1});}
    shell={radius:R,height:2*R};
  }else{
    const R=p.hexRadius,H=p.hexHeight,area=MATERIALS.honeycomb.arealDensity,side=R; // regular hexagon: side = circumradius
    const apothem=R*Math.sqrt(3)/2;
    for(let k=0;k<6;k++){
      const a=(k+.5)*Math.PI/3,n=[Math.cos(a),0,Math.sin(a)],c=scl(n,apothem),u=[-Math.sin(a),0,Math.cos(a)];
      mb.panel('structure','hex-side',area*side*H,c,u,n,side,H);panels.push({center:c,u,n,w:side,h:H,hex:true});
    }
    const capArea=3*Math.sqrt(3)/2*R*R;
    for(const y of [-H/2,H/2]){mb.panel('structure','hex-cap',area*capArea,[0,y,0],[1,0,0],[0,1,0],R*1.6,R*1.6);panels.push({center:[0,y,0],u:[1,0,0],n:[0,1,0],w:2*R,h:2*R,hexCap:true,radius:R});}
    shell={radius:R,height:H};
  }
  // Mast (coax) or arms (multirotor): carbon tubes in every frame type
  const top=type==='fullerene'?p.cageRadius:type==='hexcell'?p.hexHeight/2:h/2;
  if(layout.kind==='coax'){
    tube('mast',[0,top,0],[0,layout.mast.top,0],p.mastOD,p.mastID);
    mounts=layout.mast.hubs.map(y=>[0,y,0]);
  }else{
    const r0=type==='fullerene'?p.cageRadius*.85:type==='hexcell'?p.hexRadius*.85:0;
    for(const [x,z] of layout.arms){
      const d=Math.hypot(x,z),start=[x/d*r0,layout.armHeight,z/d*r0];
      tube('arm',start,[x,layout.armHeight,z],p.armOD,p.armID);mounts.push([x,layout.armHeight,z]);
    }
  }
  // Landing legs from the structure's bottom to the feet
  const bottom=type==='fullerene'?-p.cageRadius*.8:type==='hexcell'?-p.hexHeight/2:-h/2;
  const feet=layout.feet.map(([x,y,z])=>[x,y,z]);
  for(const f of feet){const d=Math.hypot(f[0],f[2])||1,r=Math.min(shell.radius*.8,d);tube('leg',[f[0]/d*r,bottom,f[2]/d*r],f,p.legOD,p.legID,'landing gear');}
  return {type,builder:mb,tubes,panels,nodes,mounts,feet,shell,note:FEA_NOTE};
}

/**
 * Projected areas of the structure along body X, Y, Z (no shadowing: conservative) and the
 * mean member diameter used for its Reynolds number. Tubes: L·OD·sin(angle); panels: area·|n·k|.
 */
export function projectedAreas(frame){
  const A=[0,0,0];let odSum=0,lenSum=0;
  for(const t of frame.tubes){
    const d=[t.b[0]-t.a[0],t.b[1]-t.a[1],t.b[2]-t.a[2]],L=Math.hypot(...d);
    for(let k=0;k<3;k++)A[k]+=L*t.od*Math.sqrt(Math.max(0,1-(d[k]/L)**2));
    odSum+=t.od*L;lenSum+=L;
  }
  const plates=[0,0,0];
  for(const pn of frame.panels){
    const area=pn.hexCap?3*Math.sqrt(3)/2*pn.radius**2:pn.w*pn.h;
    for(let k=0;k<3;k++)plates[k]+=area*Math.abs(pn.n[k]);
  }
  // A closed shell is seen once from each side: halve the summed panel projections
  for(let k=0;k<3;k++)plates[k]*=frame.type==='hexcell'?.5:1;
  return {tubes:A,plates,memberDiameter:lenSum?odSum/lenSum:.01};
}
export {add as addVec};
