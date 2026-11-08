// Fizik adımı performans ölçümü (Node, çizim yok): her senaryoda 240 Hz adımın ortalama ve p95 süresi.
// Kullanım: node tools/physics-bench.mjs [--out reports/physics-bench.json] [--seconds 20]
// Not: bu ölçüm CPU fizik maliyetidir; GPU / kare süresi ölçümü tarayıcıda ayrıca yapılır.
import {writeFileSync,mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import os from 'node:os';
import {FlightPhysics,initializeRapier} from '../src/physics/FlightPhysics.js';
import {FLIGHT} from '../src/physics/config.js';
import {DRONE_ORDER,getDrone} from '../src/drone/DroneTypes.js';

await initializeRapier();
const arg=(name,fallback)=>{const i=process.argv.indexOf(name);return i>0?process.argv[i+1]:fallback;};
const seconds=Number(arg('--seconds',20)),out=arg('--out',null);
const steps=Math.round(seconds/FLIGHT.fixedDt);
const input=t=>({throttle:.2+.05*Math.sin(t),pitch:.3*Math.sin(.9*t),roll:.25*Math.sin(1.7*t),yaw:.2*Math.sin(.5*t)});

/** `make()` returns {flight, step(dt,input)}; extra scenarios (e.g. planet layer) register through `scenarios`. */
export const scenarios=[];
for(const id of DRONE_ORDER)scenarios.push({name:`core:${id}`,make(){
  const f=new FlightPhysics([0,30,0],0,getDrone(id));f.addBox([0,-.5,0],[200,.5,200]);
  f.controller.setMode(f.drone.modes.includes('ANGLE')?'ANGLE':f.drone.modes[0]);f.toggleArm(0);return f;
}});

export async function runBench(list=scenarios){
  const rows=[];
  for(const s of list){
    const f=s.make(),times=new Float64Array(steps);
    for(let i=0;i<240;i++)f.step(FLIGHT.fixedDt,input(i*FLIGHT.fixedDt)); // ısınma
    for(let i=0;i<steps;i++){
      const t0=process.hrtime.bigint();f.step(FLIGHT.fixedDt,input(i*FLIGHT.fixedDt));
      times[i]=Number(process.hrtime.bigint()-t0)/1e3;
    }
    f.dispose();
    const sorted=[...times].sort((a,b)=>a-b),mean=times.reduce((a,b)=>a+b,0)/steps;
    rows.push({scenario:s.name,steps,meanMicroseconds:+mean.toFixed(2),p95Microseconds:+sorted[Math.floor(.95*steps)].toFixed(2),
      budgetShareAt240Hz:+(mean/(1e6/240)).toFixed(5)});
  }
  return rows;
}

if(import.meta.url===`file://${process.argv[1]}`){
  const extra=arg('--with',null);
  if(extra)for(const s of (await import(new URL(extra,`file://${process.cwd()}/`))).benchScenarios)scenarios.push(s);
  const rows=await runBench();
  const report={tool:'physics-bench',date:new Date().toISOString(),node:process.version,cpu:os.cpus()[0]?.model??'?',
    cores:os.cpus().length,fixedDt:FLIGHT.fixedDt,seconds,rows};
  console.table(rows);
  if(out){mkdirSync(dirname(out),{recursive:true});writeFileSync(out,JSON.stringify(report,null,2)+'\n');console.log('Yazıldı:',out);}
}
