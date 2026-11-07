import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {Wind,WIND_LEVELS} from '../src/physics/Wind.js';
import {FlightRecorder,RECORD_COLUMNS} from '../src/flight/FlightRecorder.js';
import {GhostLap} from '../src/flight/GhostLap.js';
import {FlightPhysics,initializeRapier} from '../src/physics/FlightPhysics.js';
import {DRONE_TYPES,DEFAULT_DRONE} from '../src/drone/DroneTypes.js';
import {createDroneModel} from '../src/drone/DroneModel.js';
import {HOVER} from '../src/physics/config.js';

await initializeRapier();
const dt=1/240;
const memory=()=>{const m=new Map();return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k),size:()=>m.size};};

test('wind is off by default, deterministic per seed and close to the nominal level at 10 m',()=>{
  const off=new Wind();assert.equal(off.active,false);assert.deepEqual({...off.velocity(12,{x:0,y:10,z:0})},{x:0,y:0,z:0});
  const unknown=new Wind({level:'tayfun'});assert.equal(unknown.level,'off');
  for(const level of ['light','moderate','strong']){
    const a=new Wind({level,seed:11}),b=new Wind({level,seed:11}),spec=WIND_LEVELS[level];
    let sum=0,peak=0,meanX=0,meanZ=0;const n=2400;
    for(let i=0;i<n;i++){
      const t=i*.25,p={x:i%40,y:10,z:-(i%30)},va={...a.velocity(t,p)},vb=b.velocity(t,p);
      assert.deepEqual(va,{...vb});const h=Math.hypot(va.x,va.z);sum+=h;peak=Math.max(peak,h);meanX+=va.x;meanZ+=va.z;
    }
    const mean=sum/n;assert.ok(Math.abs(mean-spec.speed)<spec.speed*.25,`${level} mean ${mean}`);
    assert.ok(peak<spec.speed+spec.gust+spec.turbulence*2,`${level} peak ${peak}`);
    // Varsayılan yön 225°: hava güneybatıya (+Z, −X) akar
    assert.ok(meanX<0&&meanZ>0,level+' direction');
  }
  const w=new Wind({level:'strong',seed:2}),p={x:5,y:10,z:5};
  const open=Math.hypot(w.velocity(40,p).x,w.out.z);w.shelter=()=>true;const inside=Math.hypot(w.velocity(40,p).x,w.out.z);
  assert.ok(inside<open*.2,'buildings shelter');w.shelter=null;
  const low=Math.hypot(w.velocity(40,{x:5,y:.4,z:5}).x,w.out.z);assert.ok(low<open*.6,'surface boundary layer');
});

test('wind pushes a free-flying drone downwind through air-relative drag; off leaves v0.7.0 drag',()=>{
  const flyFor=(level,seconds=4)=>{
    const f=new FlightPhysics([0,10,0],0);f.body.setTranslation({x:0,y:10,z:0},true);f.sync();
    f.wind=new Wind({level,direction:90,seed:5});f.controller.setMode('ANGLE');f.toggleArm(0);
    for(let i=0;i<seconds*240;i++)f.step(dt,{throttle:0,verticalCommand:0,pitch:0,roll:0,yaw:0});
    const r={x:f.position.x,vx:f.velocity.x};f.dispose();return r;
  };
  const calm=flyFor('off'),windy=flyFor('strong');
  assert.ok(Math.abs(calm.x)<.05,'no wind, no drift');assert.ok(windy.x>1&&windy.vx>.5,`drift ${windy.x}`);
  // Rüzgâr nesnesi kapalıyken iz, rüzgâr nesnesi hiç yokken ki izle bit düzeyinde aynı
  const a=new FlightPhysics([0,3,0],0),b=new FlightPhysics([0,3,0],0);b.wind=new Wind({level:'off'});
  a.toggleArm(0);b.toggleArm(0);
  for(let i=0;i<480;i++){const u={throttle:HOVER*1.05,pitch:.2,roll:-.1,yaw:.1};a.step(dt,u);b.step(dt,u);}
  assert.deepEqual([a.position.x,a.position.y,a.position.z,a.rotation.w],[b.position.x,b.position.y,b.position.z,b.rotation.w]);a.dispose();b.dispose();
});

test('battery is off by default; when on it sags thrust, drains with load and lands the drone empty',()=>{
  const f=new FlightPhysics([0,5,0],0);assert.equal(f.battery.enabled,false);assert.equal(f.battery.charge,1);
  f.toggleArm(0);for(let i=0;i<240;i++)f.step(dt,{throttle:HOVER,pitch:0,roll:0,yaw:0});assert.equal(f.battery.charge,1,'disabled battery never drains');
  f.battery.enabled=true;for(let i=0;i<2400;i++)f.step(dt,{throttle:HOVER,pitch:0,roll:0,yaw:0,verticalCommand:0});
  const used=1-f.battery.charge,expected=10/(DEFAULT_DRONE.battery.minutes*60);
  assert.ok(Math.abs(used-expected)<expected*.25,`10 s hover drains ${used} (≈${expected})`);
  f.battery.charge=.3;const sag=f.batteryFactor();assert.ok(sag<1&&sag>1-DEFAULT_DRONE.battery.sag,'voltage sag');
  f.battery.charge=1e-6;f.step(dt,{throttle:1,pitch:0,roll:0,yaw:0});assert.equal(f.armed,false);assert.match(f.message,/Batarya bitti/);
  f.reset();assert.equal(f.battery.charge,1,'respawn brings a fresh pack');f.dispose();
  // Uzun menzil bataryası 5" bataryasından çok daha uzun sürer
  assert.ok(DRONE_TYPES.longrange7.battery.minutes>3*DEFAULT_DRONE.battery.minutes);
});

test('flight recorder samples at 50 Hz in simulation time, keeps a ring buffer and writes a clean CSV',()=>{
  const f=new FlightPhysics([0,2,0],0),rec=new FlightRecorder({rate:50,seconds:2});
  f.toggleArm(0);rec.mark('kalkis');let t=0;
  for(let i=0;i<240*3;i++){f.step(dt,{throttle:HOVER,pitch:0,roll:0,yaw:0});t+=dt;rec.sample(t,f,{throttle:HOVER,pitch:0,roll:0,yaw:0},{wind:{x:3,y:0,z:4}});}
  assert.equal(rec.count,100,'capacity = rate × seconds');
  const csv=rec.toCSV(),rows=csv.trim().split('\n');
  assert.equal(rows[0],RECORD_COLUMNS.join(','));assert.equal(rows.length,101);
  const cells=rows.map(r=>r.split(','));assert.ok(cells.every(c=>c.length===RECORD_COLUMNS.length),'every row has every column');
  const ti=RECORD_COLUMNS.indexOf('t_s'),times=cells.slice(1).map(c=>Number(c[ti]));
  for(let i=1;i<times.length;i++)assert.ok(Math.abs(times[i]-times[i-1]-.02)<dt+1e-6,'50 Hz spacing');
  assert.ok(Math.abs(times.at(-1)-3)<.03,'newest sample kept');
  assert.equal(cells[1][RECORD_COLUMNS.indexOf('drone')],'freestyle5');assert.equal(Number(cells[1][RECORD_COLUMNS.indexOf('wind_mps')]),5);
  rec.clear();rec.mark('kaza');rec.mark('tur_12.5');rec.sample(10,f,null);
  const last=rec.toCSV().trim().split('\n')[1];assert.match(last,/kaza;tur_12\.5/);assert.equal(last.split(',').length,RECORD_COLUMNS.length);
  f.dispose();
});

test('ghost lap stores only best laps per race key, replays by interpolation and stays visual-only',()=>{
  const scene=new THREE.Scene(),storage=memory(),ghost=new GhostLap(scene,storage);
  const {group}=createDroneModel(DRONE_TYPES.whoop3);ghost.setModel(group);
  assert.ok(ghost.model.userData.noCollider);ghost.model.traverse(o=>{assert.equal(o.userData.noCollider,true);if(o.material){assert.ok(o.material.transparent);assert.equal(o.material.depthWrite,false);}});
  assert.equal(ghost.load('zsk.race.factory01.v1.whoop3'),null);
  const q=new THREE.Quaternion();ghost.startLap();
  for(let i=0;i<=600;i++){const t=i/240;ghost.record(t,{x:t*4,y:2,z:-t},q);}
  assert.equal(ghost.current.length,51,'20 Hz');
  ghost.finishLap(2.5,false);assert.equal(storage.size(),0,'slower lap is not stored');
  ghost.startLap();for(let i=0;i<=480;i++){const t=i/240;ghost.record(t,{x:t*4,y:2,z:-t},q);}ghost.finishLap(2,true);
  assert.equal(storage.size(),1);
  const again=new GhostLap(scene,storage);again.setModel(group);assert.equal(again.load('zsk.race.factory01.v1.whoop3').time,2);
  again.show(1.025,true);assert.equal(again.model.visible,true);
  assert.ok(Math.abs(again.model.position.x-4.1)<.02&&Math.abs(again.model.position.z+1.025)<.01,'interpolated');
  again.show(2.5,true);assert.equal(again.model.visible,false,'hidden after the recorded lap');
  again.enabled=false;again.show(1,true);assert.equal(again.model.visible,false);
  assert.equal(new GhostLap(scene,storage).load('zsk.race.factory01.v1'),null,'5" ghost is separate');
  again.clear();assert.equal(storage.size(),0);
  storage.setItem('bozuk.ghost','{"s":12}');assert.equal(again.load('bozuk'),null,'invalid data ignored');
});

test('motor sound follows blade-pass frequency, distance and arming without touching physics',async()=>{
  const listeners={};
  globalThis.window={addEventListener:(t,f)=>listeners[t]=f,removeEventListener:t=>delete listeners[t]};
  const param=()=>({value:0,last:null,setTargetAtTime(v){this.last=v;}});
  const node=()=>({connect(n){return n;},gain:param(),frequency:param(),Q:param(),start(){},stop(){},type:''});
  class FakeContext{constructor(){this.currentTime=0;this.sampleRate=8000;this.destination={};}
    createGain(){return node();}createBiquadFilter(){return node();}createOscillator(){return node();}createBufferSource(){return node();}
    createBuffer(c,len){return {getChannelData:()=>new Float32Array(len)};}resume(){}close(){}}
  globalThis.window.AudioContext=FakeContext;
  try{
    const {MotorSound}=await import('../src/audio/MotorSound.js');
    const storage=memory(),s=new MotorSound(storage);assert.equal(s.enabled,true);assert.ok(listeners.pointerdown);
    s.ensure();assert.ok(s.ctx);
    const d=DEFAULT_DRONE,flight={drone:d,armed:true,motorOmega:new Float64Array([2000,2000,2000,2000]),motorThrust:new Float64Array(4).fill(d.hover*d.maxMotorThrust)};
    s.update(flight,{distance:0});
    assert.ok(Math.abs(s.osc.frequency.last-2000/(2*Math.PI)*d.sound.blades*d.sound.tone)<1e-9,'blade-pass frequency');
    const near=s.master.gain.last;assert.ok(near>0);
    s.update(flight,{distance:20});assert.ok(s.master.gain.last<near*.1,'distance attenuation');
    flight.armed=false;s.update(flight,{});assert.equal(s.master.gain.last,0,'silent when disarmed');
    s.setVolume(.8);s.setEnabled(false);assert.deepEqual(JSON.parse(storage.getItem('zsk.sound.v1')),{enabled:false,volume:.8});
    assert.equal(new MotorSound(storage).enabled,false,'preference persists');
    s.dispose();assert.equal(listeners.pointerdown,undefined);
  }finally{delete globalThis.window;}
});
