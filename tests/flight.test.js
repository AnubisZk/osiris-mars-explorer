import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {FlightPhysics,initializeRapier} from '../src/physics/FlightPhysics.js';
import {FLIGHT,MOTORS,HOVER,mixMotors,FixedStepper} from '../src/physics/config.js';
import {mapGamepad} from '../src/controllers/InputManager.js';
await initializeRapier();
const neutral={pitch:0,roll:0,yaw:0,throttle:0};
const near=(actual,expected,tol)=>assert.ok(Math.abs(actual-expected)<tol,`${actual} ≠ ${expected} (±${tol})`);
function tick(p,seconds,input){for(let n=0;n<Math.round(seconds/FLIGHT.fixedDt);n++)p.step(FLIGHT.fixedDt,input);}

test('225 mm motor diagonal, 5 inch props, 0.65 kg and 9.54 thrust/weight',()=>{
  near(Math.hypot(MOTORS[0].x-MOTORS[3].x,MOTORS[0].z-MOTORS[3].z),.225,1e-9);
  near(FLIGHT.propDiameter,.127,1e-9);
  near(4*FLIGHT.maxMotorThrust/(FLIGHT.mass*FLIGHT.gravity),9.53846,.0001);
  const p=new FlightPhysics();near(p.body.mass(),.65,1e-6);p.dispose();
});
test('mixer produces requested signed torques and desaturates without negative thrust',()=>{
  for(const axis of ['x','y','z']){
    const desired={x:0,y:0,z:0};desired[axis]=.1;
    const f=mixMotors(.5,desired);let tx=0,ty=0,tz=0;
    f.forEach((v,i)=>{tx-=MOTORS[i].z*v;ty+=MOTORS[i].spin*FLIGHT.reactionArm*v;tz+=MOTORS[i].x*v;});
    near(tx,desired.x,1e-9);near(ty,desired.y,1e-9);near(tz,desired.z,1e-9);
  }
  const f=mixMotors(0,{x:4,y:3,z:-2});assert.ok(f.every(v=>v>=0&&v<=FLIGHT.maxMotorThrust+1e-9));
});
test('arming threshold and motor speed first-order 30 ms response',()=>{
  const p=new FlightPhysics([0,10,0]);assert.equal(p.toggleArm(.1),false);assert.equal(p.toggleArm(0),true);
  p.step(FLIGHT.fixedDt,{...neutral,throttle:1});
  near(p.motorOmega[0],FLIGHT.maxMotorOmega*(1-Math.exp(-FLIGHT.fixedDt/.03)),.001);
  tick(p,.4,{...neutral,throttle:1});near(p.motorThrust.reduce((a,b)=>a+b,0),4*FLIGHT.maxMotorThrust,.1);
  assert.ok(p.velocity.y>15,'full throttle should climb aggressively');p.disarm();assert.equal(p.motorOmega[0],0);p.dispose();
});
test('steady hover balances gravity without directly setting body attitude',()=>{
  const p=new FlightPhysics([0,10,0]);p.toggleArm(0);p.motorOmega.fill(FLIGHT.maxMotorOmega*Math.sqrt(HOVER));
  tick(p,3,{...neutral,throttle:HOVER});near(p.position.y,10,.03);near(p.velocity.y,0,.02);p.dispose();
});
test('ACRO reaches near 670 deg/s and performs a full roll',()=>{
  const p=new FlightPhysics([0,20,0]);p.world.gravity={x:0,y:0,z:0};p.controller.setMode('ACRO');p.toggleArm(0);
  let traveled=0;
  for(let i=0;i<720;i++){p.step(FLIGHT.fixedDt,{...neutral,throttle:.25,roll:1});traveled+=Math.abs(p.bodyRate.z)*FLIGHT.fixedDt;}
  near(Math.abs(p.bodyRate.z)*180/Math.PI,670,35);assert.ok(traveled>Math.PI*2);p.dispose();
});
test('ANGLE achieves commanded pitch and recovers level on centered sticks',()=>{
  const p=new FlightPhysics([0,25,0]);p.world.gravity={x:0,y:0,z:0};p.toggleArm(0);
  tick(p,2,{...neutral,throttle:HOVER,pitch:.5});
  let e=new THREE.Euler().setFromQuaternion(p.rotation,'YXZ');near(e.x*180/Math.PI,-27.5,3);
  tick(p,2,{...neutral,throttle:HOVER});e.setFromQuaternion(p.rotation,'YXZ');near(e.x,0,.03);near(e.z,0,.03);p.dispose();
});
test('same fixed-step input gives matching trajectories at 30/60/144 Hz rendering',()=>{
  const results=[];
  for(const hz of [30,60,144]){
    const p=new FlightPhysics([0,15,0]);p.toggleArm(0);const clock=new FixedStepper();
    for(let frame=0;frame<hz*2;frame++)clock.advance(1/hz,dt=>p.step(dt,{...neutral,throttle:.13,pitch:.1}));
    results.push(p.position.clone());p.dispose();
  }
  assert.ok(results[0].distanceTo(results[1])<1e-6);assert.ok(results[0].distanceTo(results[2])<1e-6);
});

test('soft profile controls real Rapier attitude at 20 degrees and preserves full ACRO rate',()=>{
  const p=new FlightPhysics([0,25,0]);p.world.gravity={x:0,y:0,z:0};p.controller.profile='soft';p.toggleArm(0);
  tick(p,2,{...neutral,throttle:HOVER,pitch:1});
  const e=new THREE.Euler().setFromQuaternion(p.rotation,'YXZ');near(e.x*180/Math.PI,-20,2);
  tick(p,2,{...neutral,throttle:HOVER});
  tick(p,2,{...neutral,throttle:HOVER,yaw:1});near(Math.abs(p.bodyRate.y)*180/Math.PI,180,20);
  p.controller.setMode('ACRO');tick(p,2,{...neutral,throttle:.25,roll:1});
  near(Math.abs(p.bodyRate.z)*180/Math.PI,670,35);p.dispose();
});

test('soft Xbox right stick gives gentle pitch and roll in both directions and levels on release',()=>{
  for(const axis of ['pitch','roll'])for(const direction of [-1,1]){
    const p=new FlightPhysics([0,25,0]);p.world.gravity={x:0,y:0,z:0};p.controller.profile='soft';p.toggleArm(0);
    const axes=[0,0,0,0];axes[axis==='pitch'?3:2]=direction*.5*(axis==='pitch'?-1:1);
    const input=mapGamepad({axes},{profile:'soft',throttle:'hover',deadzone:.04});
    tick(p,1.5,input);
    const e=new THREE.Euler().setFromQuaternion(p.rotation,'YXZ');
    const angle=(axis==='pitch'?e.x:e.z)*180/Math.PI;
    assert.equal(Math.sign(angle),-direction);
    assert.ok(Math.abs(angle)>2&&Math.abs(angle)<4,`half stick ${axis}: ${angle} degrees`);
    tick(p,1,{...neutral,throttle:HOVER});e.setFromQuaternion(p.rotation,'YXZ');
    assert.ok(Math.abs(e.x)<.01&&Math.abs(e.z)<.01,'release must level without sustained tilt');p.dispose();
  }
});

test('soft Xbox small throttle input climbs gently with unchanged motor thrust limits',()=>{
  const p=new FlightPhysics([0,10,0]);p.controller.profile='soft';p.toggleArm(0);
  p.motorOmega.fill(FLIGHT.maxMotorOmega*Math.sqrt(HOVER));
  const input=mapGamepad({axes:[0,-.1,0,0]},{profile:'soft',throttle:'hover',deadzone:0});
  tick(p,1,input);assert.ok(p.velocity.y>0&&p.velocity.y<1);
  tick(p,.4,{...input,throttle:1});assert.ok(p.velocity.y>15);p.dispose();
});
test('hard impact cuts motors and respawns disarmed at checkpoint after 1.5 seconds',()=>{
  const p=new FlightPhysics([0,2,0]);p.addBox([0,-.5,0],[20,.5,20]);p.toggleArm(0);
  for(let n=0;n<480&&p.crashes===0;n++)p.step(FLIGHT.fixedDt,neutral);
  assert.equal(p.crashes,1);assert.equal(p.armed,false);assert.ok(p.respawnIn>0);assert.ok(p.motorOmega.every(v=>v===0));
  const wait=p.respawnIn;tick(p,wait+.02,neutral);near(p.position.y,2,.05);assert.equal(p.armed,false);p.dispose();
});
test('open doorway stays flyable while adjacent structural parts collide',()=>{
  const p=new FlightPhysics([0,2,3]);p.world.gravity={x:0,y:0,z:0};
  p.addBox([-2,2,0],[1,2,.25]);p.addBox([2,2,0],[1,2,.25]);p.addBox([0,4,0],[1,.2,.25]);
  p.body.setLinvel({x:0,y:0,z:-12},true);tick(p,.5,neutral);assert.ok(p.position.z< -1);
  p.setCheckpoint([2,2,3],0);p.reset();p.body.setLinvel({x:0,y:0,z:-12},true);tick(p,.5,neutral);
  assert.ok(p.position.z>.3);p.dispose();
});
test('CCD prevents a fast drone tunneling through a thin wall',()=>{
  const p=new FlightPhysics([0,2,3]);p.world.gravity={x:0,y:0,z:0};p.addBox([0,2,0],[5,2,.125]);
  p.body.setLinvel({x:0,y:0,z:-120},true);tick(p,.05,neutral);assert.ok(p.position.z>.2);p.dispose();
});
