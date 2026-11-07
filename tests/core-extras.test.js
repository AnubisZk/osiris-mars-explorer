import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import * as core from '../src/index.js';
import {FlightPhysics,initializeRapier,DRONE_TYPES,DRONE_ORDER,DEFAULT_DRONE,getDrone,FlightController,FixedStepper,FLIGHT} from '../src/index.js';

await initializeRapier();

test('paket girişi: çekirdek dışa aktarımları tanımlı', ()=>{
  for(const k of ['FlightPhysics','initializeRapier','FixedStepper','Wind','DRONE_TYPES','FlightController','InputManager','trainingThrottle','FlightRecorder','GhostLap','createDroneModel','DroneEffects','MotorSound'])assert.ok(core[k],k);
});

test('altı drone türü: 5" yarış ACRO ile açılır, 65 mm tiny whoop en küçük, rekor ekleri ayrı', ()=>{
  assert.deepEqual([...DRONE_ORDER],['freestyle5','race5','whoop3','tiny65','longrange7','hex']);
  const all=Object.values(DRONE_TYPES);
  assert.equal(Math.max(...all.map(d=>d.thrustToWeight)),DRONE_TYPES.race5.thrustToWeight);
  assert.equal(new FlightController(DRONE_TYPES.race5).mode,'ACRO');
  assert.equal(Math.min(...all.map(d=>d.span)),DRONE_TYPES.tiny65.span);
  assert.equal(new Set(all.map(d=>d.recordSuffix)).size,all.length);assert.equal(DEFAULT_DRONE.recordSuffix,'');
});

test('tiny whoop hafif temasta düşmez, sert çarpmada kaza sayar', ()=>{
  const d=DRONE_TYPES.tiny65,run=speed=>{
    const f=new FlightPhysics([0,1,0],0,d);f.addBox([0,-.5,0],[20,.5,20]);f.addBox([0,1,-1.5],[2,1,.05]);
    f.body.setTranslation({x:0,y:1,z:-.8},true);f.sync();f.toggleArm(0);f.body.setLinvel({x:0,y:0,z:-speed},true);
    for(let i=0;i<120;i++)f.step(1/240,{throttle:d.hover,pitch:0,roll:0,yaw:0});
    const out={crashes:f.crashes,armed:f.armed};f.dispose();return out;
  };
  assert.deepEqual(run(1.5),{crashes:0,armed:true});assert.equal(run(9).crashes,1);
});

test('yer sorgusu (probeDown) yalnız okur: araya sorgu girse de fizik izi bit düzeyinde aynı', ()=>{
  const run=probe=>{
    const f=new FlightPhysics([0,.15,0],0,getDrone('freestyle5'));f.addBox([0,-.5,0],[50,.5,50]);f.addBox([3,1,-2],[.5,1,.5]);
    f.toggleArm(0);
    for(let i=0;i<720;i++){f.step(1/240,{throttle:i<300?.3:.08,pitch:i>200?.2:0,roll:i>400?-.15:0,yaw:.1});if(probe)f.probeDown(30);}
    const out=[f.position.x,f.position.y,f.position.z,f.rotation.x,f.rotation.y,f.rotation.z,f.rotation.w,...f.motorOmega];f.dispose();return out;
  };
  assert.deepEqual(run(true),run(false));
});

test('çizimden bağımsızlık: 30/60/144/240 Hz kare hızında aynı 720 fizik adımı birebir aynı durumu verir; görsel nesne fiziği etkilemez', ()=>{
  const N=720,fly=fps=>{
    const f=new FlightPhysics([0,.15,0],0,DEFAULT_DRONE),stepper=new FixedStepper();f.addBox([0,-.5,0],[50,.5,50]);f.toggleArm(0);
    const visual=new THREE.Group();visual.add(new THREE.Mesh(new THREE.BoxGeometry(1,1,1))); // görsel dünya: fizik dünyasına hiç eklenmez
    let n=0;
    while(n<N){stepper.advance(1/fps,step=>{if(n<N){f.step(step,{throttle:.25,pitch:.1,roll:0,yaw:0});n++;}});visual.position.copy(f.position);visual.scale.setScalar(1+Math.random());}
    const out=[f.position.x,f.position.y,f.position.z,f.rotation.w];f.dispose();return out;
  };
  const ref=fly(240);for(const fps of [30,60,144])assert.deepEqual(fly(fps),ref,`${fps} Hz`);
  assert.ok(ref[1]>1,'drone kalktı');
});
