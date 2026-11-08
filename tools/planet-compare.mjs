// Dünya–Mars karşılaştırması: her drone türü × her ortam için itki/ağırlık, askı gazı, uç Mach,
// pal Reynolds sayısı, askıda kalma devri, ideal askı gücü; ayrıca Rapier'de tam gaz kalkış denemesi.
// Kullanım: node tools/planet-compare.mjs [--out reports/planet-compare]   → .json ve .csv yazar
// Çıktı belirlenimcidir (tarih dışında): aynı kod aynı sayıları üretir.
import {writeFileSync,mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {execSync} from 'node:child_process';
import {initializeRapier} from '../src/physics/FlightPhysics.js';
import {FLIGHT} from '../src/physics/config.js';
import {DRONE_ORDER,getDrone} from '../src/drone/DroneTypes.js';
import {PlanetEnvironment,PlanetFlightPhysics,PlanetPhysics,rotorDiagnostics,ASSUMPTIONS,CORE_REFERENCE} from '../src/planet/index.js';

await initializeRapier();
const arg=(name,fallback)=>{const i=process.argv.indexOf(name);return i>0?process.argv[i+1]:fallback;};
const ENVIRONMENTS=['earth-isa','mars-brief','mars-nasa','mars-ingenuity-low-season'];
const round=(v,d=4)=>typeof v==='number'?+v.toPrecision(d+2):v;

/** Full throttle for 2 s from the ground in Rapier: climb height (m). */
function takeoff(drone,env){
  const y0=drone.collider[1]+.002,f=new PlanetFlightPhysics([0,y0,0],0,drone,env);
  f.addBox([0,-.5,0],[50,.5,50]);f.controller.setMode('ANGLE');f.toggleArm(0);
  for(let i=0;i<480;i++)f.step(FLIGHT.fixedDt,{throttle:1,pitch:0,roll:0,yaw:0});
  const climb=f.position.y-y0;f.dispose();return climb;
}
/** Disarmed vertical fall from 3000 m in Rapier with the planetized core drag: speed after 60 s (m/s). */
function fallSpeed(drone,env){
  const f=new PlanetFlightPhysics([0,3000,0],0,drone,env);
  for(let i=0;i<60*240;i++)f.step(FLIGHT.fixedDt,{throttle:0,pitch:0,roll:0,yaw:0});
  const v=-f.velocity.y;f.dispose();return v;
}

const environments=ENVIRONMENTS.map(id=>{
  const e=new PlanetEnvironment(id);
  return {id,planet:e.planet,label:e.label,parameters:e.parameters('en').map(r=>({key:r.key,value:round(r.value),unit:r.unit,status:r.status,source:r.source?.title??null}))};
});
const rows=[];
for(const id of DRONE_ORDER)for(const envId of ENVIRONMENTS){
  const drone=getDrone(id),env=new PlanetEnvironment(envId),d=rotorDiagnostics(drone,env);
  rows.push({drone:id,environment:envId,planet:env.planet,massKg:drone.mass,gravity:env.gravity,density:round(d.density),
    thrustToWeight:round(d.thrustToWeight),hoverThrottle:round(d.hoverThrottle),ctProp:round(d.ctProp),ctRotor:round(d.ctRotor),
    tipMach:round(d.tipMach),reynolds75:Math.round(d.reynolds75),hoverRpm:Math.round(d.hoverRpm),hoverTipMach:round(d.hoverTipMach),
    idealHoverPowerW:round(d.idealHoverPowerTotal),takeoffClimb2sM:round(takeoff(drone,env)),fallSpeed60sMs:round(fallSpeed(drone,env)),
    warnings:d.warnings.map(w=>w.code).join(' ')});
}
let commit=null;try{commit=execSync('git rev-parse --short HEAD',{stdio:['ignore','pipe','ignore']}).toString().trim();}catch{}
const report={tool:'planet-compare',generated:new Date().toISOString(),commit,
  method:{
    thrust:'T = CT ρ n² D⁴ with CT implied by the core calibration at ρ_ref = '+CORE_REFERENCE.density+' kg/m³ (held constant: Phase 1)',
    idealHoverPower:'Momentum theory, P = T^1.5 / √(2ρA) per rotor (ideal lower bound)',
    reynolds75:'ρ (0.75 ΩR) c / μ at maximum rpm, chord c = 0.1 D (assumed) unless the airframe defines it',
    takeoff:'Rapier, 240 Hz, ANGLE mode, full throttle for 2 s from the ground',
    fall:'Rapier, motors off, 60 s fall from 3000 m with the planetized core drag',
  },
  assumptions:ASSUMPTIONS.map(a=>({id:a.id,status:a.status,en:a.en})),environments,rows};

const out=arg('--out',null);
console.table(rows.map(r=>({drone:r.drone,env:r.environment,'T/W':r.thrustToWeight,'tipM':r.tipMach,'Re75':r.reynolds75,'hoverRpm':r.hoverRpm,'hovTipM':r.hoverTipMach,'P_ideal W':r.idealHoverPowerW,'climb 2s m':r.takeoffClimb2sM,'fall m/s':r.fallSpeed60sMs})));
if(out){
  mkdirSync(dirname(out+'.json'),{recursive:true});
  writeFileSync(out+'.json',JSON.stringify(report,null,2)+'\n');
  const cols=Object.keys(rows[0]),esc=v=>{const s=String(v??'');return /[",\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s;};
  writeFileSync(out+'.csv',[cols.join(','),...rows.map(r=>cols.map(c=>esc(r[c])).join(','))].join('\n')+'\n');
  console.log('Yazıldı:',out+'.json',out+'.csv');
}
export {report};
