// The flight core on a planet: bit-for-bit Earth equivalence, density/gravity scaling of every
// airframe, take-off checks, Mars hover balance, altitude-dependent density, planet switching
// and rotor diagnostics.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {initializeRapier} from '../src/physics/FlightPhysics.js';
import {FLIGHT} from '../src/physics/config.js';
import {DRONE_ORDER,DEFAULT_DRONE,getDrone} from '../src/drone/DroneTypes.js';
import {trainingThrottle} from '../src/controllers/TrainingThrottle.js';
import {PlanetFlightPhysics,planetizeDrone,rotorDiagnostics,CORE_REFERENCE,ASSUMPTIONS,
  MarsEnvironment,EarthEnvironment,PlanetEnvironment} from '../src/planet/index.js';

await initializeRapier();
const dt=FLIGHT.fixedDt;
const rel=(a,b,tol,msg='')=>assert.ok(Math.abs(a-b)<=tol*Math.abs(b),`${msg} ${a} ≠ ${b} (±${tol*100}%)`);
const tick=(f,seconds,input)=>{for(let i=0;i<Math.round(seconds/dt);i++)f.step(dt,input);};
const neutral={pitch:0,roll:0,yaw:0,throttle:0};

test('Earth at the core reference (ρ 1.225, g 9.81) reproduces the 5" reference trace bit for bit',()=>{
  // Same scenarios and state hash as tools/flighttrace.mjs; only the class differs.
  const reference=JSON.parse(readFileSync(new URL('../reference/trace-5inch.json',import.meta.url),'utf8'));
  const earth=EarthEnvironment({gravity:CORE_REFERENCE.gravity,surfaceDensity:CORE_REFERENCE.density,model:'uniform'});
  const state=f=>[f.position.x,f.position.y,f.position.z,f.rotation.x,f.rotation.y,f.rotation.z,f.rotation.w,
    f.velocity.x,f.velocity.y,f.velocity.z,...Object.values(f.body.angvel()),...f.motorOmega,...f.motorThrust,f.health,f.contacts,f.crashes,f.respawnIn,+f.armed,f.collective??0].join(',');
  const run=(setup,input,steps)=>{
    const f=new PlanetFlightPhysics([0,.2,0],0,DEFAULT_DRONE,earth),h=createHash('sha256');
    setup(f);for(let i=0;i<steps;i++){f.step(dt,input(i*dt,f));h.update(state(f));}
    const out=h.digest('hex').slice(0,16)+' @ '+[f.position.x,f.position.y,f.position.z].map(v=>v.toFixed(4)).join(',');f.dispose();return out;
  };
  const wave=(t,a,w)=>a*Math.sin(w*t);
  const scenarios={
    'angle-soft':[f=>{f.controller.profile='soft';f.toggleArm(0);},t=>({throttle:t<1?.2:.11+wave(t,.03,1.3),pitch:wave(t,.6,.9),roll:wave(t,.5,1.7),yaw:wave(t,.4,.5)}),240*6],
    'acro-sport':[f=>{f.controller.profile='sport';f.controller.setMode('ACRO');f.toggleArm(0);},t=>({throttle:t<.8?.3:.18,pitch:t>1&&t<1.4?1:0,roll:t>2&&t<2.5?-1:wave(t,.2,3),yaw:wave(t,.3,2)}),240*4],
    'training':[f=>{f.controller.profile='soft';f.toggleArm(0);},t=>({throttle:0,verticalCommand:t<2?.6:t<3?0:-.5,pitch:wave(t,.3,1),roll:0,yaw:0}),240*5],
    'motorstop':[f=>{f.motorStop=true;f.controller.profile='sport';f.toggleArm(0);},t=>({throttle:t<1.5?.25:t<2?0:.2,pitch:0,roll:wave(t,.4,2),yaw:0}),240*3],
    'wall-damage':[f=>{f.addBox([0,0,-4],[8,40,.2]);f.collisionMode='damage';f.controller.profile='sport';f.toggleArm(0);},t=>({throttle:t<.6?.3:.16,pitch:t>.6?.9:0,roll:0,yaw:0}),240*4],
    'wall-respawn':[f=>{f.addBox([0,0,-4],[8,40,.2]);f.collisionMode='respawn';f.controller.profile='sport';f.toggleArm(0);},t=>({throttle:t<.6?.3:.16,pitch:t>.6?1:0,roll:0,yaw:0}),240*4],
  };
  for(const [name,[setup,input,steps]] of Object.entries(scenarios))assert.equal(run(setup,input,steps),reference[name],name);
  const h2=createHash('sha256');
  for(let u=-1;u<=1;u+=.05)for(let v=-6;v<=6;v+=.5)h2.update(String(trainingThrottle(u,v,{x:.05,y:0,z:.02,w:.998},planetizeDrone(DEFAULT_DRONE,earth))));
  assert.equal(h2.digest('hex').slice(0,16),reference.trainingThrottle);
});

test('planetized airframes: thrust and drag scale with ρ/ρ_ref, hover and thrust/weight follow g',()=>{
  const mars=MarsEnvironment(),sigma=.020/CORE_REFERENCE.density;
  for(const id of DRONE_ORDER){
    const base=getDrone(id),d=planetizeDrone(base,mars);
    rel(d.maxMotorThrust,base.maxMotorThrust*sigma,1e-12,`${id} thrust`);
    rel(d.hover,base.mass*3.71/(base.motorCount*d.maxMotorThrust),1e-12,`${id} hover`);
    rel(d.thrustToWeight,base.motorCount*d.maxMotorThrust/(base.mass*3.71),1e-12,`${id} T/W`);
    d.drag.quadratic.forEach((c,k)=>rel(c,base.drag.quadratic[k]*sigma,1e-12));
    rel(d.drag.angular,base.drag.angular*sigma,1e-12);
    assert.equal(d.mass,base.mass);assert.equal(d.inertia,base.inertia);assert.equal(d.motors,base.motors);
    assert.equal(d.planet.base,base);assert.equal(d.planet.environment,'mars-brief');assert.equal(d.planet.assumptions,ASSUMPTIONS);
    assert.ok(Object.isFrozen(d)&&Object.isFrozen(d.drag));
    assert.equal(planetizeDrone(d,mars).planet.base,base,'re-planetizing starts from the core airframe');
  }
  assert.ok(ASSUMPTIONS.every(a=>a.status==='assumed'&&a.en&&a.tr));
});

test('take-off: every core airframe climbs on Earth at full throttle; none leaves the ground on Mars',()=>{
  for(const env of [EarthEnvironment(),MarsEnvironment()])for(const id of DRONE_ORDER){
    const base=getDrone(id),spawnY=base.collider[1]+.002;
    const f=new PlanetFlightPhysics([0,spawnY,0],0,base,env);f.addBox([0,-.5,0],[50,.5,50]);
    f.controller.setMode('ANGLE');f.toggleArm(0);tick(f,2,{...neutral,throttle:1});
    if(env.planet==='earth')assert.ok(f.position.y>5,`${id} Earth climb ${f.position.y}`);
    else{
      assert.ok(f.drone.thrustToWeight<1,`${id} Mars T/W ${f.drone.thrustToWeight}`);
      assert.ok(f.position.y<spawnY+.01,`${id} must stay on the ground on Mars (y ${f.position.y})`);
      rel([...f.motorThrust].reduce((a,b)=>a+b),base.motorCount*f.drone.maxMotorThrust,.01,`${id} full thrust (mixer keeps attitude authority)`);
    }
    f.dispose();
  }
});

test('Mars hover balance in Rapier: a vehicle with Mars T/W = 2 holds altitude at the predicted throttle',()=>{
  // Test fixture only (not a design): the hex airframe with motors strong enough for Mars.
  const hex=getDrone('hex'),mars=MarsEnvironment().with({model:'uniform'}),sigma=.020/CORE_REFERENCE.density;
  const thrust=2*hex.mass*mars.gravity/(hex.motorCount*sigma);
  const fixture=Object.freeze({...hex,id:'mars-test-fixture',maxMotorThrust:thrust,
    hover:hex.mass*FLIGHT.gravity/(hex.motorCount*thrust),thrustToWeight:hex.motorCount*thrust/(hex.mass*FLIGHT.gravity)});
  const f=new PlanetFlightPhysics([0,10,0],0,fixture,mars);
  rel(f.drone.thrustToWeight,2,1e-12);rel(f.drone.hover,.5,1e-12);
  f.controller.setMode('ANGLE');f.toggleArm(0);f.motorOmega.fill(hex.maxMotorOmega*Math.sqrt(f.drone.hover));
  tick(f,3,{...neutral,throttle:f.drone.hover});
  assert.ok(Math.abs(f.position.y-10)<.03,`altitude ${f.position.y}`);assert.ok(Math.abs(f.velocity.y)<.02);
  rel([...f.motorThrust].reduce((a,b)=>a+b),hex.mass*mars.gravity,.005,'thrust = Mars weight');f.dispose();
});

test('air density follows altitude: site elevation at spawn and re-derivation in flight',()=>{
  const mars=MarsEnvironment(),base=getDrone('longrange7');
  const low=new PlanetFlightPhysics([0,.2,0],0,base,mars),high=new PlanetFlightPhysics([0,.2,0],0,base,mars,{siteElevation:5000});
  rel(low.drone.planet.density,mars.density(.2),1e-12);rel(high.drone.planet.density,mars.density(5000.2),1e-12);
  rel(high.drone.maxMotorThrust/low.drone.maxMotorThrust,mars.density(5000.2)/mars.density(.2),1e-12);
  high.dispose();
  low.body.setTranslation({x:0,y:3000,z:0},true);low.sync();low.step(dt,neutral);
  rel(low.drone.planet.density,mars.density(low.altitude()),2e-3,'re-derived near 3 km');
  assert.equal(low.drone.planet.base,base);low.dispose();
  // A uniform atmosphere never re-derives (density is the controlled variable)
  const flat=new PlanetFlightPhysics([0,.2,0],0,base,mars.with({model:'uniform'})),before=flat.drone;
  flat.body.setTranslation({x:0,y:3000,z:0},true);flat.sync();flat.step(dt,neutral);assert.equal(flat.drone,before);flat.dispose();
});

test('Earth ↔ Mars switch while disarmed; refused while armed; airframe swap is planetized',()=>{
  const earth=EarthEnvironment(),mars=MarsEnvironment();
  const f=new PlanetFlightPhysics([0,1,0],0,DEFAULT_DRONE,earth),onEarth=f.drone.maxMotorThrust;
  assert.equal(f.world.gravity.y,-9.80665);
  assert.equal(f.setEnvironment(mars),true);assert.equal(f.world.gravity.y,-3.71);assert.equal(f.drone.planet.environment,'mars-brief');
  assert.ok(f.drone.thrustToWeight<1);
  assert.equal(f.setEnvironment(earth),true);assert.equal(f.drone.maxMotorThrust,onEarth);
  f.toggleArm(0);assert.equal(f.setEnvironment(mars),false);assert.equal(f.world.gravity.y,-9.80665);
  assert.equal(f.setDrone(getDrone('race5')),false,'core rule: no swap while armed');
  f.disarm();assert.equal(f.setDrone(getDrone('race5')),true);
  assert.equal(f.drone.planet.base,getDrone('race5'));rel(f.drone.maxMotorThrust,getDrone('race5').maxMotorThrust*earth.density(1)/CORE_REFERENCE.density,1e-12);
  assert.throws(()=>f.setEnvironment({gravity:3.71}),/PlanetEnvironment/);f.dispose();
});

test('rotor diagnostics: conventions, Earth consistency and the Mars flow regime',()=>{
  const earth=EarthEnvironment(),mars=MarsEnvironment(),d=DEFAULT_DRONE;
  const e=rotorDiagnostics(d,earth),m=rotorDiagnostics(d,mars);
  rel(e.thrustToWeight,d.thrustToWeight*(earth.surface.density/CORE_REFERENCE.density)*(FLIGHT.gravity/earth.gravity),1e-12,'Earth T/W');
  rel(m.ctRotor,m.ctProp*4/Math.PI**3,1e-12,'CT conventions');
  rel(m.thrustToWeight,d.thrustToWeight*(.020/CORE_REFERENCE.density)*(FLIGHT.gravity/3.71),1e-12,'Mars T/W');
  for(const code of ['cannot-hover','low-reynolds','hover-tip-mach'])assert.ok(m.warnings.some(w=>w.code===code),code);
  assert.ok(!e.warnings.some(w=>w.code==='cannot-hover'));
  assert.ok(m.reynolds75<1e4&&e.reynolds75>5e4,`Re Earth ${e.reynolds75}, Mars ${m.reynolds75}`);
  rel(m.reynolds75/e.reynolds75,(mars.surface.density/mars.surface.dynamicViscosity)/(earth.surface.density/earth.surface.dynamicViscosity),1e-12);
  rel(m.tipMach/e.tipMach,earth.surface.speedOfSound/mars.surface.speedOfSound,1e-12);
  // Momentum theory: ideal hover power ∝ W^1.5 / √ρ
  rel(m.idealHoverPowerTotal/e.idealHoverPowerTotal,(mars.gravity/earth.gravity)**1.5*Math.sqrt(earth.surface.density/mars.surface.density),1e-12);
  assert.ok(m.warnings.every(w=>w.en&&w.tr));
});
