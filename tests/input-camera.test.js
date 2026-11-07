import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {normalizeAxis,mapGamepad,InputManager} from '../src/controllers/InputManager.js';
import {fpvOrientation,createDroneModel} from '../src/drone/DroneModel.js';
import {HOVER} from '../src/physics/config.js';
const settings={throttle:'hover',deadzone:.04};
test('soft Xbox profile gives precise hover input while preserving full travel and RC throttle',()=>{
  const map=(up,profile='soft',throttle='hover')=>mapGamepad({axes:[up,-up,up,-up]},{deadzone:0,profile,throttle});
  const soft=map(.1),sport=map(.1,'sport');
  assert.ok(soft.throttle/HOVER<1.1,'small upward movement must stay below 1.1x hover thrust');
  assert.ok(sport.throttle/HOVER>1.8,'legacy sport response should remain available');
  assert.ok(soft.roll>0&&soft.roll<sport.roll*.4);
  for(const profile of ['soft','sport']){
    assert.equal(map(-1,profile).throttle,0);assert.equal(map(0,profile).throttle,HOVER);
    assert.deepEqual(map(1,profile),{yaw:1,pitch:1,roll:1,throttle:1});
    assert.equal(map(.2,profile,'rc').throttle,.6);
    let previous=-1;
    for(let i=-100;i<=100;i++){const value=map(i/100,profile).throttle;assert.ok(value>previous);previous=value;}
  }
});
test('Mode 2 axes, deadzone and spring throttle center/bottom/top',()=>{
  const neutral=mapGamepad({axes:[0,0,0,0]},settings);assert.equal(neutral.throttle,HOVER);
  assert.equal(normalizeAxis(.03),0);
  const stick=mapGamepad({axes:[1,-1,-1,-1]},settings);
  assert.deepEqual(stick,{yaw:1,pitch:1,roll:-1,throttle:1});
  assert.equal(mapGamepad({axes:[0,1,0,0]},settings).throttle,0);
  assert.equal(mapGamepad({axes:[0,0,0,0]},{...settings,throttle:'rc'}).throttle,.5);
  assert.equal(normalizeAxis(.15,{min:-.8,max:.9,center:.15}),0);
});
test('FPV camera points 25 degrees UP, not down, on a level drone',()=>{
  const forward=new THREE.Vector3(0,0,-1).applyQuaternion(fpvOrientation(new THREE.Quaternion(),25));
  assert.ok(Math.abs(forward.y-Math.sin(25*Math.PI/180))<1e-8);
  assert.ok(forward.z<0);
});
test('rendered drone fits a 5 inch prop envelope, not a 0.6 m body',()=>{
  const {group}=createDroneModel();const size=new THREE.Box3().setFromObject(group).getSize(new THREE.Vector3());
  assert.ok(size.x<.3&&size.z<.3&&size.y<.1);
});
test('quick keyboard zero/arm taps, Xbox button edges, calibration and disconnect',()=>{
  const names=['window','document','navigator','localStorage'];
  const saved=Object.fromEntries(names.map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
  const win=new EventTarget();win.closest=()=>false;const doc=new EventTarget();doc.hidden=false;
  let pad=null,blurCount=0;
  Object.defineProperties(globalThis,{
    window:{configurable:true,value:win},document:{configurable:true,value:doc},
    navigator:{configurable:true,value:{getGamepads:()=>[pad]}},
    localStorage:{configurable:true,value:{getItem:()=>null,setItem:()=>{}}},
  });
  const input=new InputManager(()=>blurCount++);input.active=true;
  try{
    const key=(type,code)=>{const e=new Event(type,{cancelable:true});Object.assign(e,{code,repeat:false});win.dispatchEvent(e);};
    input.keyboardThrottle=.5;key('keydown','KeyZ');key('keyup','KeyZ');key('keydown','Space');key('keyup','Space');
    const tap=input.update(1/60);assert.equal(tap.throttle,0);assert.equal(tap.arm,true);assert.equal(input.update(1/60).arm,false);
    pad={connected:true,mapping:'standard',axes:[0,1,0,0],buttons:Array.from({length:10},()=>({pressed:false}))};
    pad.buttons[0].pressed=true;const connected=input.update(1/60);assert.equal(connected.arm,false);assert.equal(connected.deviceChanged,true);assert.equal(input.update(1/60).arm,false);
    pad.buttons[0].pressed=false;input.update(1/60);pad.buttons[0].pressed=true;assert.equal(input.update(1/60).arm,true);
    pad.buttons[2].pressed=true;assert.equal(input.update(1/60).scan,true);assert.equal(input.update(1/60).scan,true);
    pad.buttons[2].pressed=false;assert.equal(input.update(1/60).scan,false);
    key('keydown','KeyX');assert.equal(input.update(1/60).scan,true);key('keyup','KeyX');assert.equal(input.update(1/60).scan,false);
    pad.axes=[0,0,0,0];input.update(1/60);assert.equal(input.calibrate(),true);
    pad.axes=[-1,-1,-1,-1];input.update(1/60);pad.axes=[1,1,1,1];input.update(1/60);
    pad.axes=[.01,.01,.01,.01];input.update(1/60);assert.equal(input.calibrate(),true);assert.equal(input.settings.calibration[0].center,.01);
    const goodCalibration=input.settings.calibration;
    input.calibrate();pad.axes=[-1,-1,-1,-1];input.update(1/60);pad.axes=[1,1,1,1];pad.buttons[0].pressed=true;
    const calibrationInput=input.update(1/60);assert.equal(calibrationInput.arm,false);assert.equal(calibrationInput.throttle,0);
    assert.equal(input.calibrate(),false,'ending at an extreme must not save a broken center');assert.equal(input.settings.calibration,goodCalibration);
    pad=null;assert.equal(input.update(1/60).deviceLost,true);assert.equal(input.update(1/60).deviceLost,false);
    // API restrictions and unknown layouts should never crash the render loop or arm a drone.
    input.source='gamepad';input.keyboardThrottle=1;
    navigator.getGamepads=()=>{throw new DOMException('denied','SecurityError');};
    const blocked=input.update(1/60);assert.equal(blocked.throttle,0);assert.equal(blocked.arm,false);
    assert.match(input.padStatus,/engelledi/);
    navigator.getGamepads=undefined;input.update(1/60);assert.match(input.padStatus,/sunmuyor/);
    navigator.getGamepads=()=>[{connected:true,mapping:'',axes:[0,0,0,0],buttons:[]}];
    input.update(1/60);assert.match(input.padStatus,/atamaları/);assert.equal(input.mappingReady,false);assert.ok(input.lastPad);
    win.dispatchEvent(new Event('blur'));assert.equal(blurCount,1);
  }finally{input.dispose();for(const name of names){if(saved[name])Object.defineProperty(globalThis,name,saved[name]);else delete globalThis[name];}}
});

test('Tab remains usable and focused form/button controls do not send flight commands',()=>{
  const names=['window','document','localStorage'],saved=names.map(k=>Object.getOwnPropertyDescriptor(globalThis,k));
  const win=new EventTarget(),doc=new EventTarget();let focusedControl=false;
  win.closest=()=>focusedControl;
  Object.defineProperties(globalThis,{window:{configurable:true,value:win},document:{configurable:true,value:doc},localStorage:{configurable:true,value:{getItem:()=>null}}});
  const input=new InputManager(()=>{});input.active=true;
  const key=code=>{const e=new Event('keydown',{cancelable:true});Object.assign(e,{code,repeat:false});win.dispatchEvent(e);return e;};
  try{
    assert.equal(key('Tab').defaultPrevented,false);
    focusedControl=true;assert.equal(key('Space').defaultPrevented,false);key('KeyW');key('ArrowUp');
    assert.equal(input.pressed.has('Space'),false);assert.equal(input.keys.has('KeyW'),false);assert.equal(input.keys.has('ArrowUp'),false);
    focusedControl=false;assert.equal(key('Space').defaultPrevented,true);assert.equal(input.pressed.has('Space'),true);
  }finally{input.dispose();names.forEach((k,i)=>{if(saved[i])Object.defineProperty(globalThis,k,saved[i]);else delete globalThis[k];});}
});
