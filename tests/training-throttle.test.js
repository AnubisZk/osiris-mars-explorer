import test from 'node:test';
import assert from 'node:assert/strict';
import {FlightPhysics,initializeRapier} from '../src/physics/FlightPhysics.js';
import {FLIGHT,HOVER,FixedStepper} from '../src/physics/config.js';
import {mapGamepad} from '../src/controllers/InputManager.js';
await initializeRapier();
const input=up=>mapGamepad({axes:[0,-up,0,0]},{profile:'soft',throttle:'assist',deadzone:0});
const tick=(p,seconds,s)=>{for(let i=0;i<Math.round(seconds/FLIGHT.fixedDt);i++)p.step(FLIGHT.fixedDt,s);};
const setup=()=>{const p=new FlightPhysics([0,10,0]);p.controller.profile='soft';p.toggleArm(0);p.motorOmega.fill(FLIGHT.maxMotorOmega*Math.sqrt(HOVER));return p;};

test('education throttle preserves low-stick arming and maps only selected gamepad mode to assistance',()=>{
  const p=new FlightPhysics();
  assert.equal(p.toggleArm(input(0).throttle),false);
  assert.equal(p.toggleArm(input(-1).throttle),true);
  assert.equal(input(-1).verticalCommand,-1);assert.equal(Math.abs(input(0).verticalCommand),0);assert.equal(input(1).verticalCommand,1);
  for(const throttle of ['hover','rc'])assert.equal(mapGamepad({axes:[0,0,0,0]},{throttle}).verticalCommand,undefined);
  p.dispose();
});
test('small Xbox upward movement has a bounded gentle speed even when held for ten seconds',()=>{
  const p=setup();tick(p,10,input(.1));
  assert.ok(p.velocity.y>.1&&p.velocity.y<.2,`vertical speed ${p.velocity.y}`);
  assert.ok(p.position.y<12);p.dispose();
});
test('education throttle bounds climb/descent and brakes at center without teleporting',()=>{
  const p=setup();tick(p,4,input(1));
  assert.ok(p.velocity.y>2.6&&p.velocity.y<3.1);
  const height=p.position.y;tick(p,2,input(0));
  assert.ok(Math.abs(p.velocity.y)<.03);assert.ok(p.position.y-height<1.1);
  tick(p,4,input(-1));assert.ok(p.velocity.y< -1.3&&p.velocity.y> -1.6);
  tick(p,2,input(0));assert.ok(Math.abs(p.velocity.y)<.03);p.dispose();
});
test('education center compensates ANGLE tilt using motors and leaves ACRO/manual power intact',()=>{
  const p=setup();tick(p,2,{...input(0),pitch:.5});
  assert.ok(Math.abs(p.position.y-10)<.25);assert.ok(Math.abs(p.velocity.y)<.15);
  p.controller.setMode('ACRO');tick(p,.4,input(1));assert.ok(p.velocity.y>12);
  p.disarm();tick(p,.1,input(1));assert.ok(p.motorThrust.every(x=>x===0));p.dispose();
});
test('education low stick stays on the ground after arm and permits gentle landing',()=>{
  const p=new FlightPhysics([0,.04,0]);p.addBox([0,-.5,0],[20,.5,20]);p.toggleArm(0);
  tick(p,2,input(-1));assert.ok(p.position.y<.08);assert.equal(p.crashes,0);
  tick(p,2,input(.5));assert.ok(p.position.y>.8);
  tick(p,5,input(-.5));assert.ok(p.position.y<.08);assert.equal(p.crashes,0);p.dispose();
});
test('assisted trajectories are identical at 30/60/144 Hz render cadence',()=>{
  const heights=[];
  for(const hz of [30,60,144]){const p=setup(),clock=new FixedStepper();for(let i=0;i<hz*3;i++)clock.advance(1/hz,dt=>p.step(dt,input(.4)));heights.push(p.position.y);p.dispose();}
  assert.ok(Math.max(...heights)-Math.min(...heights)<1e-6);
});
