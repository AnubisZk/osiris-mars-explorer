// MarsPhysics / PlanetPhysics: Rapier gravity per planet, aerodynamic forces as forces and torques,
// analytic checks (free fall, terminal velocity), energy bookkeeping, fixed step and seeds.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {initializeRapier} from '../src/physics/FlightPhysics.js';
import {Wind} from '../src/physics/Wind.js';
import {PlanetPhysics,MarsPhysics,MarsEnvironment,EarthEnvironment,PlanetEnvironment} from '../src/planet/index.js';

await initializeRapier();
const rel=(a,b,tol,msg='')=>assert.ok(Math.abs(a-b)<=tol*Math.abs(b),`${msg} ${a} ≠ ${b} (±${tol*100}%)`);
const ball={type:'ball',radius:.1};
const planets=()=>[EarthEnvironment(),MarsEnvironment()];
const run=(P,steps)=>{for(let i=0;i<steps;i++)P.step();};
// Rapier stores state in 32-bit floats: velocities summed over hundreds of steps carry ~1e-5 relative error
const F32=5e-5;

test('MarsPhysics is the planet world with Mars gravity in Rapier',()=>{
  const P=new MarsPhysics(MarsEnvironment());
  assert.ok(P instanceof PlanetPhysics);assert.equal(P.world.gravity.y,-3.71);assert.equal(P.gravity,3.71);
  assert.equal(P.fixedDt,1/240);P.dispose();
  assert.throws(()=>new PlanetPhysics({gravity:3.71}),/PlanetEnvironment/);
});

test('free fall in vacuum follows ½gt² on Earth and on Mars (first-order fixed-step error)',()=>{
  for(const env of planets()){
    const P=new PlanetPhysics(env),b=P.addBody({mass:1,shape:ball});
    const steps=480,t=steps*P.fixedDt;run(P,steps);
    const y=b.body.translation().y,exact=-.5*env.gravity*t*t,bound=.5*env.gravity*t*P.fixedDt;
    assert.ok(y<=exact+1e-6&&y>=exact-bound,`${env.id}: y ${y}, exact ${exact}, bound ${bound}`);
    rel(b.body.linvel().y,-env.gravity*t,F32,`${env.id} v`);P.dispose();
  }
});

test('Mars fall time is √(g_Earth/g_Mars) ≈ 1.63 times Earth\'s from the same height',()=>{
  const time=env=>{const P=new PlanetPhysics(env),b=P.addBody({position:[0,10,0],mass:1,shape:ball});
    while(b.body.translation().y>0)P.step();const t=P.time;P.dispose();return t;};
  const [earth,mars]=planets();
  rel(time(mars)/time(earth),Math.sqrt(earth.gravity/mars.gravity),.006,'ratio');
});

test('mass does not change free-fall acceleration (vacuum)',()=>{
  const P=new PlanetPhysics(MarsEnvironment());
  const light=P.addBody({position:[0,0,0],mass:.1,shape:ball}),heavy=P.addBody({position:[1,0,0],mass:10,shape:ball});
  run(P,720);
  assert.ok(Math.abs(light.body.translation().y-heavy.body.translation().y)<1e-6);P.dispose();
});

test('mass–weight consistency: a resting body pushes on the ground with m·g',()=>{
  for(const env of planets())for(const mass of [.65,1.8,12]){
    const P=new PlanetPhysics(env);P.addGround();
    const b=P.addBody({position:[0,.1,0],mass,shape:{type:'cuboid',half:[.1,.1,.1]}});
    run(P,480);
    rel(b.body.mass(),mass,1e-6,'Rapier mass');rel(b.contactForce,env.weight(mass),1e-4,`${env.id} ${mass} kg`);
    rel(env.weight(mass),mass*env.gravity,1e-15);P.dispose();
  }
});

test('terminal velocity and the tanh solution: v(t) = v_t tanh(g t / v_t), v_t = √(2mg/(ρ CdA))',()=>{
  const vt={};
  for(const env of planets().map(e=>e.with({model:'uniform'}))){
    const m=1,cdA=.05,P=new PlanetPhysics(env),b=P.addBody({mass:m,shape:ball,aero:{cdA}});
    const v_t=Math.sqrt(2*m*env.gravity/(env.surface.density*cdA));vt[env.planet]=v_t;
    let worst=0;const seconds=Math.ceil(5*v_t/env.gravity);
    for(let i=1;i<=seconds*240;i++){
      P.step();
      if(i%60===0&&P.time>.5){const exact=v_t*Math.tanh(env.gravity*P.time/v_t);worst=Math.max(worst,Math.abs(-b.body.linvel().y-exact)/exact);}
    }
    assert.ok(worst<2e-3,`${env.id}: worst relative error ${worst}`);
    rel(-b.body.linvel().y,v_t,1e-3,`${env.id} terminal`);
    rel(b.dynamicPressure*cdA,m*env.gravity,2e-3,'drag balances weight');P.dispose();
  }
  // Same body falls ≈ 4.8× faster at terminal speed on Mars (brief values)
  const [earth,mars]=planets();
  rel(vt.mars/vt.earth,Math.sqrt(mars.gravity*earth.surface.density/(earth.gravity*mars.surface.density)),1e-12);
  assert.ok(vt.mars/vt.earth>4.7&&vt.mars/vt.earth<4.9);
});

test('drag uses the local density at the body altitude (site elevation included)',()=>{
  const env=MarsEnvironment(),P=new PlanetPhysics(env,{siteElevation:2000});
  const b=P.addBody({position:[0,500,0],velocity:[20,0,0],mass:1,shape:ball,aero:{cdA:.05}});
  P.step();
  rel(b.density,env.density(2500),1e-6,'density at 2.5 km');
  assert.ok(b.density<env.surface.density);P.dispose();
});

test('energy bookkeeping: vacuum flight conserves energy to first order; drag work closes the balance',()=>{
  // Vacuum: error shrinks ~linearly with the step
  const drift=dt=>{const P=new PlanetPhysics(EarthEnvironment(),{fixedDt:dt}),b=P.addBody({velocity:[10,20,0],mass:1,shape:ball});
    const E0=P.energy(b).total;run(P,Math.round(3/dt));const e=Math.abs(P.energy(b).total-E0)/E0;P.dispose();return e;};
  const coarse=drift(1/120),fine=drift(1/240);
  assert.ok(fine<1e-3,`relative drift ${fine}`);assert.ok(coarse/fine>1.6&&coarse/fine<2.5,`order ${coarse/fine}`);
  // With drag (translation and rotation): E(t) − W_aero(t) = E0, and E never increases
  for(const env of planets()){
    const P=new PlanetPhysics(env);
    const b=P.addBody({position:[0,50,0],velocity:[30,30,0],angularVelocity:[0,5,2],mass:1,inertia:{x:.02,y:.02,z:.02},
      shape:ball,aero:{cdA:.05,rotationalDrag:.002}});
    const E0=P.energy(b).total;let last=E0;
    for(let k=0;k<20;k++){
      run(P,60);const E=P.energy(b).total;
      assert.ok(E<=last+1e-6*E0,`${env.id}: energy rose at ${P.time.toFixed(2)} s`);last=E;
    }
    assert.ok(b.aeroWork<0,'drag dissipates');
    rel(P.energy(b).total-b.aeroWork,E0,1e-3,`${env.id} balance`);P.dispose();
  }
});

test('numerical stability: torque-free asymmetric body keeps |L| and flips about the intermediate axis',()=>{
  const P=new PlanetPhysics(EarthEnvironment());P.world.gravity={x:0,y:0,z:0};
  const I={x:.01,y:.02,z:.03},b=P.addBody({angularVelocity:[.05,6,.05],mass:1,inertia:I,shape:ball});
  const L=()=>{const q=new THREE.Quaternion().copy(b.body.rotation()),w=new THREE.Vector3().copy(b.body.angvel()).applyQuaternion(q.clone().invert());
    return {L:new THREE.Vector3(I.x*w.x,I.y*w.y,I.z*w.z).applyQuaternion(q),wy:w.y};};
  const L0=L().L;let flipped=false;
  for(let i=0;i<240*20;i++){P.step();if(L().wy<-5)flipped=true;}
  rel(L().L.length(),L0.length(),5e-3,'|L| after 20 s');
  assert.ok(L().L.angleTo(L0)<.01,'L keeps its direction');
  assert.ok(flipped,'intermediate-axis (Dzhanibekov) flip expected');P.dispose();
});

test('physics is independent of render rate: identical state after 480 fixed steps at 30/60/144/240 Hz',()=>{
  const snapshots=[];
  for(const hz of [30,60,144,240]){
    const P=new PlanetPhysics(MarsEnvironment(),{wind:new Wind({level:'moderate',seed:11})});P.addGround();
    const b=P.addBody({position:[0,20,0],velocity:[8,4,-3],angularVelocity:[1,2,3],mass:1.8,shape:{type:'cuboid',half:[.3,.1,.3]},aero:{cdA:[.06,.12,.06],rotationalDrag:.003}});
    let snap=null;
    for(let frame=0;!snap;frame++)P.advance(1/hz,()=>{if(P.steps===480){const t=b.body.translation(),v=b.body.linvel(),q=b.body.rotation();snap=[t.x,t.y,t.z,v.x,v.y,v.z,q.x,q.y,q.z,q.w];}});
    snapshots.push(snap);P.dispose();
  }
  for(const s of snapshots.slice(1))assert.deepEqual(s,snapshots[0]);
});

test('same wind seed gives the same trajectory; another seed does not',()=>{
  const fly=seed=>{const P=new PlanetPhysics(MarsEnvironment(),{wind:new Wind({level:'strong',seed})});
    const b=P.addBody({position:[0,100,0],mass:.5,shape:ball,aero:{cdA:.08}});run(P,1200);
    const t=b.body.translation(),out=[t.x,t.y,t.z];P.dispose();return out;};
  assert.deepEqual(fly(42),fly(42));
  const a=fly(42),c=fly(43);assert.ok(Math.hypot(a[0]-c[0],a[2]-c[2])>1e-3);
});

test('relative wind: drag acts on air-relative velocity and the body drifts at wind speed',()=>{
  const steady={active:true,velocity:()=>({x:10,y:0,z:0})};
  const env=MarsEnvironment().with({model:'uniform'}),P=new PlanetPhysics(env,{wind:steady});
  const cdA=.4,b=P.addBody({position:[0,0,0],mass:.2,shape:ball,aero:{cdA}});
  P.step();
  rel(b.aeroForce.x,.5*env.surface.density*cdA*100,1e-9,'first-step drag from 10 m/s wind');
  run(P,240*120);rel(b.body.linvel().x,10,.01,'drift speed');P.dispose();
});

test('planet switch changes Rapier gravity at the next step',()=>{
  const P=new PlanetPhysics(MarsEnvironment()),b=P.addBody({mass:1,shape:ball});
  run(P,240);const v0=b.body.linvel().y;rel(v0,-3.71,F32);
  P.setEnvironment(EarthEnvironment());assert.equal(P.world.gravity.y,-9.80665);
  run(P,240);rel(b.body.linvel().y-v0,-9.80665,F32);
  assert.throws(()=>P.setEnvironment({gravity:1}),/PlanetEnvironment/);P.dispose();
  // Profiles beyond the two defaults work the same way
  const Q=new PlanetPhysics(new PlanetEnvironment('mars-nasa'));assert.equal(Q.world.gravity.y,-3.73);Q.dispose();
});
