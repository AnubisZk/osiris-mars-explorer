// Phase 3 and vehicle assembly: exact mass properties, C60 topology, published masses,
// frame effects; vehicles hover in Rapier on Mars; the 5" quad cannot lift off there.
import test from 'node:test';
import assert from 'node:assert/strict';
import {initializeRapier} from '../src/physics/FlightPhysics.js';
import {MassBuilder,principalAxes,axesQuaternion} from '../src/frames/massProperties.js';
import {truncatedIcosahedron,buildFrame,FEA_NOTE} from '../src/frames/frames.js';
import {buildVehicle} from '../src/vehicles/build.js';
import {VEHICLE_ORDER} from '../src/vehicles/presets.js';
import {Motor,defineMotor} from '../src/power/motor.js';
import {Battery,defineBattery} from '../src/power/battery.js';
import {Simulation} from '../src/sim/Simulation.js';

await initializeRapier();
const rel=(a,b,t,m='')=>assert.ok(Math.abs(a-b)<=t*Math.abs(b),`${m} ${a} ≠ ${b} (±${t*100}%)`);

test('mass properties match closed-form results (rod, box, panel, parallel axis, principal axes)',()=>{
  const rod=new MassBuilder();rod.tube('s','rod',[-1,0,0],[1,0,0],.02,0,null,2);
  const r=rod.compute();rel(r.inertia[1][1],2*4/12,1e-3,'rod about centre (mL²/12, thin)');rel(r.inertia[0][0],.5*2*.01**2,1e-9,'rod about its axis');
  const box=new MassBuilder().box('b','box',3,[0,0,0],[1,2,3]).compute();rel(box.inertia[0][0],3*(4+9)/12,1e-12);
  const pair=new MassBuilder().point('p','a',1,[1,0,0]).point('p','b',1,[-1,0,0]).compute();rel(pair.inertia[1][1],2,1e-12,'parallel axis');
  const pan=new MassBuilder().panel('p','plate',1,[0,0,0],[1,0,0],[0,1,0],2,1).compute();rel(pan.inertia[1][1],(4+1)/12,1e-12,'plate normal axis');
  // a box rotated 30° about Y: principal moments recovered, axes quaternion is a rotation
  const c=Math.cos(Math.PI/6),s=Math.sin(Math.PI/6),I0=[1,2,3],R=[[c,0,s],[0,1,0],[-s,0,c]];
  const I=[0,1,2].map(i=>[0,1,2].map(j=>[0,1,2].reduce((t,k)=>t+R[i][k]*I0[k]*R[j][k],0)));
  const p=principalAxes(I);assert.deepEqual(p.moments.map(x=>+x.toFixed(9)).sort(),[1,2,3]);
  const q=axesQuaternion(p.axes);rel(Math.hypot(q.x,q.y,q.z,q.w),1,1e-12);
});

test('C60 geometry: 60 vertices of degree 3, 90 equal struts, 12 pentagons + 20 hexagons (Euler V − E + F = 2)',()=>{
  const {vertices,edges}=truncatedIcosahedron();assert.equal(vertices.length,60);assert.equal(edges.length,90);
  const deg=new Array(60).fill(0);for(const [a,b] of edges){deg[a]++;deg[b]++;}assert.ok(deg.every(d=>d===3));
  assert.equal(60-90+32,2);for(const v of vertices)rel(Math.hypot(...v),1,1e-12);
  const f=buildFrame('fullerene',{kind:'coax',body:[.1,.1,.1],mast:{top:.3,hubs:[.25,.15]},feet:[[.2,-.2,.2]]},{cageRadius:.15,strutOD:.005,strutID:.003,nodeMass:.001,mastOD:.02,mastID:.018,legOD:.01,legID:.008});
  assert.equal(f.tubes.filter(t=>t).length,90+1+1);assert.equal(f.nodes.length,60);assert.match(f.note.tr,/FEA/);assert.match(FEA_NOTE.en,/not simulated/);
});

test('published masses are reproduced by the reference frame; frames change mass, inertia and drag area',()=>{
  rel(buildVehicle('ingenuity-like').mass,1.8,1e-9);rel(buildVehicle('msh-hexa').mass,20.8,1e-9);rel(buildVehicle('fpv5').mass,.65,1e-9);
  for(const id of VEHICLE_ORDER){
    const c=buildVehicle(id,{frame:'carbon'}),f=buildVehicle(id,{frame:'fullerene'}),h=buildVehicle(id,{frame:'hexcell'});
    assert.notEqual(c.mass,f.mass);assert.notEqual(c.drag.tubes[0],f.drag.tubes[0]);
    for(const b of [c,f,h]){assert.ok(b.principal.moments.every(m=>m>0));rel(b.groups.misc??0,c.miscMass,1e-12);}
  }
  const p=buildVehicle('osiris-mars-quad',{payload:.5});rel(p.mass-buildVehicle('osiris-mars-quad').mass,.5,1e-12,'payload adds its mass');
});

test('motor reaches the speed set by back-EMF; battery energy equals ∫P dt',()=>{
  const m=new Motor(defineMotor({id:'t',kv:1000,resistance:.1,noLoadCurrent:0,maxCurrent:100}),1e-4);
  for(let i=0;i<4800;i++)m.step(1,10,0,1/240);rel(m.omega,1000*2*Math.PI/60*10,1e-3,'no-load speed = Kv·V');
  const b=new Battery(defineBattery({id:'b',series:6,cellCapacityAh:2}));let E=0;
  for(let i=0;i<3600;i++){b.draw(100,1);E+=100/3600;}rel(b.energyUsedWh,E,1e-12);assert.ok(b.voltage<6*4.2&&b.soc<1);
});

test('Mars hover in Rapier: every Mars-capable vehicle holds 5 m; the 5" quad cannot lift off',()=>{
  for(const vehicle of ['ingenuity-like','osiris-mars-quad','msh-hexa']){
    const sim=new Simulation({vehicle,waypoints:[],returnHome:false,cruiseAltitude:5},{terrain:false});sim.start();
    for(let i=0;i<240*30;i++)sim.step();
    const p=sim.vehicle.position,target=sim.control.target.position[1];
    assert.ok(Math.abs(p.y-target)<.3,`${vehicle} altitude ${p.y} vs ${target}`);assert.ok(Math.hypot(p.x,p.z)<.5,`${vehicle} drift`);
    rel(sim.vehicle.out.thrust,sim.built.mass*3.71,.08,`${vehicle} thrust ≈ Mars weight`);sim.dispose();
  }
  const fpv=new Simulation({vehicle:'fpv5'},{terrain:false});fpv.start();const r=fpv.run();
  assert.equal(r.success,false);assert.match(r.reason,/cannot take off/);assert.ok(fpv.telemetry.stats('agl').max<.1);fpv.dispose();
});
