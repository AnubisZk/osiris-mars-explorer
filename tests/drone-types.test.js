// ZSK-FPV tests/drone-types.test.js'ten; görev (yarış/depo/geçiş) ve giriş ekranı testleri çıkarıldı
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {DRONE_TYPES,DRONE_ORDER,DEFAULT_DRONE,getDrone} from '../src/drone/DroneTypes.js';
import {FLIGHT,MOTORS,HOVER,mixMotors} from '../src/physics/config.js';
import {FlightPhysics,initializeRapier} from '../src/physics/FlightPhysics.js';
import {FlightController} from '../src/drone/FlightController.js';
import {createDroneModel,cameraOrientation,fpvOrientation} from '../src/drone/DroneModel.js';
import {trainingThrottle} from '../src/controllers/TrainingThrottle.js';

await initializeRapier();
const dt=1/240;
const memory=()=>{const m=new Map();return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k),keys:()=>[...m.keys()]};};
function fly(drone,{mode,profile='sport',seconds,input,setup}){
  const f=new FlightPhysics([0,5,0],0,drone);f.body.setTranslation({x:0,y:5,z:0},true);f.sync();
  f.controller.setMode(mode??drone.modes[0]);f.controller.profile=profile;setup?.(f);f.toggleArm(0);
  for(let i=0;i<seconds*240;i++)f.step(dt,input(i*dt,f));
  return f;
}
const tiltDeg=q=>Math.acos(Math.min(1,1-2*(q.x*q.x+q.z*q.z)))*180/Math.PI;

test('the default drone is the v0.7.0 airframe, value for value',()=>{
  const d=DEFAULT_DRONE;
  assert.equal(d,DRONE_TYPES.freestyle5);assert.equal(getDrone('yok'),d);assert.equal(DRONE_ORDER[0],'freestyle5');
  for(const k of ['mass','diagonal','propDiameter','maxMotorThrust','motorTimeConstant','maxMotorOmega','reactionArm','maxRate','cameraTilt','crashImpulse','respawnSeconds'])
    assert.equal(d[k],FLIGHT[k],k);
  assert.equal(d.inertia,FLIGHT.inertia);assert.equal(d.motors,MOTORS);assert.equal(d.hover,HOVER);
  assert.equal(d.margin,.21);assert.equal(d.recordSuffix,'');assert.deepEqual(d.modes,['ANGLE','ACRO']);
  const a=FLIGHT.diagonal/(2*Math.sqrt(2));assert.equal(d.mixDenom,4*a*a);assert.equal(d.yawDenom,4*FLIGHT.reactionArm);
  // Karıştırıcı: tür verilmese de verilse de aynı sayılar
  const torque={x:.03,y:-.01,z:.02};
  assert.deepEqual([...mixMotors(.45,torque,new Float64Array(4),d)],[...mixMotors(.45,torque)]);
  const c=new FlightController();assert.equal(c.maxRate,FLIGHT.maxRate);assert.equal(c.mode,'ANGLE');assert.equal(c.gain,1);
});

test('every drone type is physically consistent: hover, thrust/weight, margin and span',()=>{
  assert.deepEqual([...DRONE_ORDER].sort(),Object.keys(DRONE_TYPES).sort());
  const ids=new Set(),suffixes=new Set();
  for(const id of DRONE_ORDER){
    const d=DRONE_TYPES[id];ids.add(d.id);suffixes.add(d.recordSuffix);
    assert.equal(d.id,id);assert.ok(Object.isFrozen(d));
    assert.equal(d.motorCount,d.motors.length);assert.ok(d.motorCount===4||d.motorCount===6,id);
    assert.ok(Math.abs(d.hover-d.mass*FLIGHT.gravity/(d.motorCount*d.maxMotorThrust))<1e-12,id+' hover');
    assert.ok(d.hover>.08&&d.hover<.45,id+' hover range');
    assert.ok(d.thrustToWeight>=3.5,id+' T/W');
    const [hx,,hz]=d.collider;assert.ok(d.margin>=Math.hypot(hx,hz)-1e-9,id+' margin covers collider diagonal');
    assert.ok(d.span>2*Math.max(hx,hz)*.9,id+' span vs collider');
    // Simetrik yerleşim: Σx = Σz = Σxz = 0, Σx² = Σz²; yaw dönüş yönleri dengeli
    const sum=f=>d.motors.reduce((s,m)=>s+f(m),0);
    for(const f of [m=>m.x,m=>m.z,m=>m.x*m.z,m=>m.spin,m=>m.spin*m.x,m=>m.spin*m.z])assert.ok(Math.abs(sum(f))<1e-12,id+' symmetry');
    assert.ok(Math.abs(sum(m=>m.x*m.x)-sum(m=>m.z*m.z))<1e-12&&Math.abs(sum(m=>m.x*m.x)-d.mixDenom)<1e-12,id+' mix denominator');
    assert.ok(d.modes.length>=2&&d.modes.every(m=>['ANGLE','ACRO','KONUM'].includes(m)),id+' modes');
    assert.equal(d.chase.length,3);assert.equal(d.camera.offset.length,3);
  }
  assert.equal(ids.size,DRONE_ORDER.length);assert.equal(suffixes.size,DRONE_ORDER.length,'records never collide');
  assert.deepEqual(DRONE_TYPES.hex.modes,['KONUM','ANGLE']);assert.equal(DRONE_TYPES.hex.camera.gimbal,true);
});

test('the mixer reproduces requested torques and keeps collective for quad and hex layouts',()=>{
  for(const d of Object.values(DRONE_TYPES)){
    const n=d.motorCount,torque={x:.004*d.gain,y:-.002*d.gain,z:.003*d.gain},out=mixMotors(d.hover,torque,new Float64Array(n),d);
    let total=0,tx=0,tz=0,ty=0;
    for(let i=0;i<n;i++){const m=d.motors[i];total+=out[i];tx+=-m.z*out[i];tz+=m.x*out[i];ty+=m.spin*d.reactionArm*out[i];}
    assert.ok(Math.abs(total-n*d.hover*d.maxMotorThrust)<1e-9,d.id+' collective');
    assert.ok(Math.abs(tx-torque.x)<1e-9&&Math.abs(tz-torque.z)<1e-9&&Math.abs(ty-torque.y)<1e-9,d.id+' torque');
    for(const v of out)assert.ok(v>=0&&v<=d.maxMotorThrust,d.id+' range');
  }
});

test('each type hovers level at its own hover throttle and climbs at the training-throttle target',()=>{
  for(const d of Object.values(DRONE_TYPES)){
    const mode=d.modes.includes('ANGLE')?'ANGLE':d.modes[0];
    // Hover gazında toplam itki ağırlığa eşit; kalkış anındaki motor gecikmesinden kalan iniş hızı sürüklemeyle söner
    let v1=0;const h=fly(d,{mode:'ANGLE',seconds:4,input:(t,f)=>{if(Math.abs(t-1)<dt/2)v1=f.velocity.y;return {throttle:d.hover,pitch:0,roll:0,yaw:0};}});
    let T=0;for(let i=0;i<d.motorCount;i++)T+=h.motorThrust[i];
    assert.ok(Math.abs(T/(d.mass*FLIGHT.gravity)-1)<.005,`${d.id} thrust/weight ${T/(d.mass*FLIGHT.gravity)}`);
    assert.ok(Math.abs(h.velocity.y)<Math.abs(v1)*.75,`${d.id} transient decays ${v1} → ${h.velocity.y}`);
    assert.ok(tiltDeg(h.rotation)<1,d.id+' level');h.dispose();
    const c=fly(d,{mode,profile:'soft',seconds:3,input:()=>({throttle:0,verticalCommand:1,pitch:0,roll:0,yaw:0})});
    assert.ok(Math.abs(c.velocity.y-d.assist.up)<.25,`${d.id} climb ${c.velocity.y}`);c.dispose();
  }
});

test('ANGLE step response is stable for every type: bounded tilt, returns level after release',()=>{
  for(const d of Object.values(DRONE_TYPES)){
    let peak=0;
    const f=fly(d,{mode:'ANGLE',seconds:4,input:(t,f)=>{if(t<2.5)peak=Math.max(peak,tiltDeg(f.rotation));return {throttle:d.hover*1.08,verticalCommand:0,pitch:t<2?.5:0,roll:0,yaw:0};}});
    assert.ok(peak>10&&peak<40,`${d.id} peak ${peak}`);assert.ok(tiltDeg(f.rotation)<2,`${d.id} settles`);
    assert.ok(Number.isFinite(f.position.x)&&f.health===100);f.dispose();
  }
});

test('ACRO reaches the type rate without runaway; types without ACRO refuse the mode',()=>{
  for(const d of Object.values(DRONE_TYPES)){
    if(!d.modes.includes('ACRO')){const c=new FlightController(d);c.setMode('ACRO');assert.notEqual(c.mode,'ACRO');continue;}
    let peak=0;
    const f=fly(d,{mode:'ACRO',seconds:2,input:(t,f)=>{peak=Math.max(peak,Math.abs(f.bodyRate.z)*180/Math.PI);return {throttle:d.hover*1.5,pitch:0,roll:t>.5&&t<1.5?1:0,yaw:0};}});
    assert.ok(peak>d.maxRate*.85&&peak<d.maxRate*1.2,`${d.id} acro ${peak}`);f.dispose();
  }
});

test('hexacopter KONUM: velocity command, stops on release and holds position in moderate wind',async()=>{
  const {Wind}=await import('../src/physics/Wind.js');
  const d=DRONE_TYPES.hex;let top=0,stop=null;
  const f=fly(d,{mode:'KONUM',seconds:9,input:(t,f)=>{const v=Math.hypot(f.velocity.x,f.velocity.z);if(t<3)top=v;if(t>=3&&stop===null&&v<.2)stop=t-3;return {throttle:0,verticalCommand:0,pitch:t<3?1:0,roll:0,yaw:0};}});
  assert.ok(top>4.5&&top<5.8,`top ${top}`);assert.ok(stop!==null&&stop<3,`stop ${stop}`);assert.ok(f.velocity.length()<.2);f.dispose();
  let x0=null,z0=null,drift=0,y0=null;
  const g=fly(d,{mode:'KONUM',seconds:14,setup:g=>{g.wind=new Wind({level:'moderate',direction:90,seed:3});},input:(t,g)=>{
    if(t>4){x0??=g.position.x;z0??=g.position.z;y0??=g.position.y;drift=Math.max(drift,Math.hypot(g.position.x-x0,g.position.z-z0));}
    return {throttle:0,verticalCommand:0,pitch:0,roll:0,yaw:0};}});
  assert.ok(drift<1,`wind drift ${drift}`);assert.ok(Math.abs(g.position.y-y0)<.5,'altitude held');g.dispose();
});

test('setDrone swaps airframe only while disarmed and returning to 5" is bit-identical to a fresh drone',()=>{
  const input=t=>({throttle:HOVER*1.1,pitch:Math.sin(t*3)*.4,roll:Math.cos(t*2)*.3,yaw:.2,verticalCommand:0});
  const run=f=>{f.toggleArm(0);for(let i=0;i<480;i++)f.step(dt,input(i*dt));return [f.position.x,f.position.y,f.position.z,f.rotation.x,f.rotation.y,f.rotation.z,f.rotation.w];};
  const fresh=new FlightPhysics([0,3,0],0);const a=run(fresh);fresh.dispose();
  const swapped=new FlightPhysics([0,3,0],0);
  swapped.setDrone(DRONE_TYPES.hex);assert.equal(swapped.drone.id,'hex');assert.equal(swapped.controller.mode,'KONUM');
  const he=swapped.collider.halfExtents();assert.ok(Math.abs(he.x-.48)<1e-6&&Math.abs(he.y-.12)<1e-6&&Math.abs(he.z-.48)<1e-6);assert.ok(Math.abs(swapped.body.mass()-2.4)<1e-6);
  swapped.toggleArm(0);assert.equal(swapped.armed,true);
  assert.equal(swapped.setDrone(DRONE_TYPES.whoop3),false);assert.equal(swapped.drone.id,'hex','armed swap refused');
  swapped.disarm();swapped.setDrone(DRONE_TYPES.whoop3);swapped.setDrone(DEFAULT_DRONE);
  assert.equal(swapped.controller.mode,'ANGLE');assert.equal(swapped.controller.maxRate,FLIGHT.maxRate);
  const b=run(swapped);swapped.dispose();
  assert.deepEqual(b,a);
});

test('training throttle uses the type hover and assist limits; default call is unchanged',()=>{
  const q=new THREE.Quaternion();
  assert.equal(trainingThrottle(.5,0,q),trainingThrottle(.5,0,q,DEFAULT_DRONE));
  const hex=DRONE_TYPES.hex,c=trainingThrottle(0,0,q,hex);assert.ok(Math.abs(c-hex.hover)<1e-9,'neutral = hover');
  assert.ok(trainingThrottle(1,0,q,hex)<=hex.hover+hex.assist.cap+1e-9);
});

test('drone models: one rotor per motor, no colliders, gimbal only on the hexacopter',()=>{
  for(const d of Object.values(DRONE_TYPES)){
    const {group,props,drone}=createDroneModel(d);assert.equal(drone,d);assert.equal(props.length,2*d.motorCount,d.id);
    let meshes=0;group.traverse(o=>{assert.equal(o.userData.noCollider,true);if(o.isMesh)meshes++;});assert.ok(meshes>=d.motorCount*2);
    assert.equal(!!group.userData.gimbal,d.camera.gimbal,d.id);
    const box=new THREE.Box3().setFromObject(group),size=box.getSize(new THREE.Vector3());
    assert.ok(Math.abs(Math.max(size.x,size.z)-d.span)<d.span*.35,`${d.id} model span ${size.x}`);
  }
  // FPV: kamera gövdeye bağlı; gimbal: yalnızca yön, ufuk düz
  const tilted=new THREE.Quaternion().setFromEuler(new THREE.Euler(.3,.8,-.4,'YXZ'));
  const a=cameraOrientation(DEFAULT_DRONE,tilted,25),b=fpvOrientation(tilted,25);assert.ok(a.angleTo(b)<1e-6);
  const h=cameraOrientation(DRONE_TYPES.hex,tilted,0),e=new THREE.Euler().setFromQuaternion(h,'YXZ');
  assert.ok(Math.abs(e.x)<1e-6&&Math.abs(e.z)<1e-6&&Math.abs(e.y-.8)<1e-6);
});
