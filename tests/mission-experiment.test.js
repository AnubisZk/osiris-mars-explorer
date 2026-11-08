// Phases 4–6 and 9: Mars time and light delay, terrain provenance and physics consistency,
// missions (autonomous, FPV through the light-time link), energy budget, reproducibility,
// experiments and exports.
import test from 'node:test';
import assert from 'node:assert/strict';
import {initializeRapier} from '../src/physics/FlightPhysics.js';
import {marsTime,localSolarTime,sunPosition,earthMarsLink,JEZERO} from '../src/mars/time.js';
import {ProceduralTerrain,HeightmapTerrain} from '../src/terrain/terrain.js';
import {PlanetPhysics,MarsEnvironment} from '../src/planet/index.js';
import {Simulation} from '../src/sim/Simulation.js';
import {plan,runExperiment,toCSV} from '../src/experiment/Experiment.js';

await initializeRapier();
const rel=(a,b,t,m='')=>assert.ok(Math.abs(a-b)<=t*Math.abs(b),`${m} ${a} ≠ ${b} (±${t*100}%)`);

test('Mars24 time and Sun: reference values, solar noon, morning Sun in the east',()=>{
  const t=marsTime(947116800000); // 2000-01-06T00:00Z; values from NASA GISS Mars24 / pyMarsTime
  assert.ok(Math.abs(t.Ls-277.18677)<2e-4);assert.ok(Math.abs(t.MTC-23.99431)<2e-4);assert.ok(Math.abs(t.MSD-44795.99976)<2e-4);
  const day=Date.parse('2026-11-14T00:00:00Z');let best={e:-90};
  for(let m=0;m<26*60;m+=5){const s=sunPosition(day+m*6e4,JEZERO.lat,JEZERO.lonEast);if(s.elevation>best.e)best={e:s.elevation,t:s.localSolarTime};
    if(s.localSolarTime>8&&s.localSolarTime<9)assert.ok(s.azimuth>45&&s.azimuth<135,'morning Sun in the east');}
  assert.ok(Math.abs(best.t-12)<.15,`solar noon at ${best.t}`);
  rel(localSolarTime(day,JEZERO.lonEast+15)-localSolarTime(day,JEZERO.lonEast),1,1e-9,'15° east = 1 hour later');
});

test('Earth–Mars one-way light time stays within 3–22.5 min and matches known oppositions',()=>{
  let lo=Infinity,hi=0;for(let y=2003;y<2031;y+=.05){const L=earthMarsLink(Date.UTC(Math.floor(y),0,1)+(y%1)*365.25*864e5).oneWayLightTime/60;lo=Math.min(lo,L);hi=Math.max(hi,L);}
  assert.ok(lo>3&&lo<3.3&&hi>21.5&&hi<22.6,`range ${lo}–${hi} min`);
  rel(earthMarsLink(Date.parse('2003-08-27T00:00:00Z')).distanceAU,.3727,.01,'2003 closest approach (0.3727 AU)');
});

test('terrain: deterministic, labelled procedural, Rapier heightfield agrees with heightAt, rock model',()=>{
  const a=new ProceduralTerrain({seed:5,cells:[96,96],size:[600,600]}),b=new ProceduralTerrain({seed:5,cells:[96,96],size:[600,600]});
  assert.ok(a.heights.every((h,i)=>h===b.heights[i]));assert.equal(a.meta.source,'procedural');assert.match(a.meta.label.tr,/NASA verisi DEĞİL/);
  assert.throws(()=>new HeightmapTerrain(2,2,[10,10],new Float32Array(9),{source:'procedural'}),/real data source/);
  const P=new PlanetPhysics(MarsEnvironment());a.addToPhysics(P,{rockColliders:false});P.step();
  for(let k=0;k<50;k++){const x=Math.sin(k)*250,z=Math.cos(k*1.7)*250;assert.ok(Math.abs(200-P.groundDistance({x,y:200,z},500)-a.heightAt(x,z))<.25);}
  P.dispose();
  // Golombek–Rapp: rocks ≥ 0.5 m are a minority, sizes within the sampled range
  const big=a.rocks.filter(r=>r.d>=.5).length/a.rocks.length;assert.ok(big>0&&big<.3,`fraction ≥ 0.5 m: ${big}`);
});

test('autonomous mission: observations made, energy within budget estimate ±35 %, identical on repeat',()=>{
  const terrain=new ProceduralTerrain({seed:3});
  const run=()=>{const s=new Simulation({seed:3},{terrain});s.start();const r=s.run();const out={...r,budget:s.budget.energyWh,csv:s.telemetry.toCSV()};s.dispose();return out;};
  const r1=run(),r2=run();
  assert.equal(r1.success,true,r1.reason);assert.equal(r1.observations,2);
  rel(r1.budget,r1.energyWh,.35,'pre-flight energy budget vs simulation');
  assert.equal(r1.energyWh,r2.energyWh);assert.equal(r1.csv,r2.csv,'same seed → identical telemetry');
  assert.match(r1.csv.split('\n')[0],/^t \[s\],x \[m\]/);
});

test('FPV from Earth fails through the light-time delay; the same pilot with no delay completes the mission',()=>{
  const fly=control=>{
    const sim=new Simulation({control},{terrain:false});sim.start();
    for(let i=0;i<240*200&&!sim.mission.result;i++){
      const p=sim.vehicle.position,v=sim.vehicle.velocity,todo=sim.mission.spec.waypoints.find(w=>!sim.mission.observations.some(o=>o.name===w.name));
      let stick={pitch:0,roll:0,yaw:0,climb:-1};
      if(todo){const dx=todo.x-p.x,dz=todo.z-p.z,d=Math.hypot(dx,dz)||1,want=Math.min(2,d*.4);
        stick={pitch:Math.max(-1,Math.min(1,(-(dz/d)*want+v.z)*.25)),roll:Math.max(-1,Math.min(1,((dx/d)*want-v.x)*.25)),yaw:0,climb:0};}
      if(sim.mission.phase==='piloted')sim.mission.pilot(stick);sim.step();
    }
    const r=sim.mission.result;sim.dispose();return {r,delay:sim.link.oneWayLightTime};
  };
  const earth=fly('earth-fpv'),local=fly('local-fpv');
  assert.ok(earth.delay>180);assert.equal(earth.r.success,false);assert.match(earth.r.reason,/link delay/);
  assert.equal(local.r.success,true,local.r.reason);assert.equal(local.r.observations,2);
});

test('experiment: full-factorial plan, deterministic results, summary and CSV',()=>{
  const def={name:'t',base:{route:'short',waypoints:[{x:0,z:-20,action:'observe',dwell:2,name:'A'}],timeLimit:120},
    variables:[{key:'frame',values:['carbon','fullerene']}],seeds:[1],terrainSeed:9};
  assert.equal(plan({...def,variables:[{key:'frame',values:[1,2,3]},{key:'payload',values:[0,1]}],seeds:[1,2]}).length,12);
  const a=runExperiment(def),b=runExperiment(def);
  assert.deepEqual(a.rows,b.rows);assert.equal(a.summary.length,2);
  assert.ok(a.rows.every(r=>r.success),JSON.stringify(a.rows.map(r=>r.reason)));
  assert.ok(a.rows[1].mass>a.rows[0].mass&&a.rows[1].energyWh>a.rows[0].energyWh,'heavier C60 frame costs energy');
  const csv=toCSV(a.rows);assert.match(csv.split('\n')[0],/run,seed,frame,liftOff/);
});

test('real DTM import: GeoTIFF → height grid with provenance; HeightmapTerrain carries the source',async()=>{
  const {writeArrayBuffer}=await import('geotiff');const {importDtm}=await import('../tools/import-dtm.mjs');
  const W=200,H=200,values=new Float32Array(W*H);for(let j=0;j<H;j++)for(let i=0;i<W;i++)values[i+j*W]=-2600+.5*i-.25*j; // tilted plane
  const buf=writeArrayBuffer(values,{width:W,height:H,ModelPixelScale:[2,2,0],ModelTiepoint:[0,0,0,0,0,0]});
  const {meta,heights}=await importDtm(buf,{name:'test',size:300,cells:30,title:'synthetic plane',credit:'test'});
  assert.equal(meta.source,'dtm');assert.equal(meta.pixelSize[0],2);rel(meta.referenceElevation,-2600+.5*99.5-.25*99.5,.001);
  // slope preserved: +0.5 m per pixel east = 0.25 m/m, −0.25 m per pixel south = −0.125 m/m
  const T=new HeightmapTerrain(30,30,meta.size,heights,meta);
  rel(T.heightAt(50,0)-T.heightAt(-50,0),25,1e-3,'east slope');rel(T.heightAt(0,50)-T.heightAt(0,-50),-12.5,1e-3,'south slope');
  assert.equal(T.meta.procedural,false);assert.match(T.meta.label.en,/Real terrain/);
});
