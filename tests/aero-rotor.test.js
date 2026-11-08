// Phase 2 validation: airfoil anchor, CT depends on Re / Mach / geometry, momentum-theory
// consistency, NASA Ingenuity geometry and design numbers, calibrated hover power end to end.
import test from 'node:test';
import assert from 'node:assert/strict';
import {initializeRapier} from '../src/physics/FlightPhysics.js';
import {airfoilData,polar,AIRFOILS} from '../src/aero/airfoil.js';
import {evaluateRotor,stepRotor,createRotorState,trimCoaxial,figureOfMerit,withDragFactor,solveSpeed} from '../src/aero/rotor.js';
import {ROTORS} from '../src/aero/rotors.js';
import {PlanetEnvironment,MarsEnvironment,EarthEnvironment} from '../src/planet/index.js';
import {Simulation} from '../src/sim/Simulation.js';

await initializeRapier();
const RAD=Math.PI/180,RPM=Math.PI/30,rel=(a,b,t,m='')=>assert.ok(Math.abs(a-b)<=t*Math.abs(b),`${m} ${a} ≠ ${b} (±${t*100}%)`);
const ing=ROTORS.ingenuity,mars=d=>new PlanetEnvironment('mars-nasa',{surfaceDensity:d}).surface;

test('clf5605-like polar reproduces the published anchor (Re 2·10⁴, M 0.6: cl/cd 19.9 at cl 0.91, α 2.5°)',()=>{
  const af=airfoilData('clf5605-like'),o={};polar(af,2.5*RAD,2e4,.6,o);
  rel(o.cl,.91,1e-9,'cl');rel(o.cl/o.cd,19.9,1e-9,'L/D');
  let best=0;for(let a=-4;a<=10;a+=.01){polar(af,a*RAD,2e4,.6,o);best=Math.max(best,o.cl/o.cd);}
  rel(best,19.9,2e-3,'peak L/D');assert.equal(AIRFOILS['clf5605-like'].lossFactorStatus,'calibrated');
});

test('section coefficients depend on Reynolds and Mach numbers (CT is not a constant)',()=>{
  const af=airfoilData('clf5605-like'),a={},b={};
  polar(af,2*RAD,5e3,.5,a);polar(af,2*RAD,1e5,.5,b);assert.ok(a.cd>b.cd&&a.cl<b.cl,'lower Re: more drag, less lift');
  polar(af,2*RAD,2e4,.3,a);polar(af,2*RAD,2e4,.7,b);assert.ok(b.cl>a.cl,'Prandtl–Glauert: lift slope rises with M');
  polar(af,2*RAD,2e4,.9,b);assert.ok(b.cd>a.cd+.02,'drag divergence above M_crit');
  // rotor level: same geometry and speed, thinner air → lower CT and higher CQ/CT
  const s1=createRotorState(),s2=createRotorState(),om=2537*RPM;
  evaluateRotor(ing,s1,{omega:om,collective:2*RAD},mars(.020));evaluateRotor(ing,s2,{omega:om,collective:2*RAD},mars(.010));
  assert.ok(s2.CT<s1.CT,`CT ${s2.CT} < ${s1.CT}`);assert.ok(s2.CQ/s2.CT>s1.CQ/s1.CT);
});

test('momentum-theory consistency: FM < 1, induced power ≥ ideal, converged inflow, dynamic = static at steady state',()=>{
  for(const d of [.012,.017,.020]){
    const s=createRotorState();evaluateRotor(ing,s,{omega:2537*RPM,collective:0},mars(d));
    assert.ok(s.converged);const fm=figureOfMerit(s);assert.ok(fm>.2&&fm<1,`FM ${fm}`);
    const ideal=s.T**1.5/Math.sqrt(2*d*ing.disk);assert.ok(s.P>ideal,'shaft power above the ideal induced power');
  }
  const atm=mars(.017),a=createRotorState(),b=createRotorState();
  evaluateRotor(ing,a,{omega:265,collective:3*RAD},atm);for(let i=0;i<480;i++)stepRotor(ing,b,{omega:265,collective:3*RAD},atm,1/240);
  rel(b.T,a.T,1e-4,'dynamic inflow settles on the momentum solution');
});

test('Ingenuity geometry against NASA tables: blade area, solidity, tip Mach, CT/σ',()=>{
  rel(4*ing.bladeArea,.170,.10,'four-blade area (NASA 0.170 m²)');
  rel(2*ing.solidityThrustWeighted,.148,.05,'coaxial thrust-weighted solidity (NASA 0.148)');
  const atm=new PlanetEnvironment('mars-nasa').surface;
  rel(2575*RPM*ing.radius/atm.speedOfSound,.70,.02,'hover tip Mach at 2575 rpm (NASA 0.7)');
  // design CT/σ = 0.10 (NASA Ames Table 2) at the density where 1.8 kg hovers at 2575 rpm with CT/σ 0.10
  const W=1.8*3.73,VT=2575*RPM*ing.radius,rho=W/(.10*2*ing.solidityThrustWeighted*ing.disk*VT*VT);
  assert.ok(rho>.013&&rho<.017,`implied design density ${rho} within the Ingenuity range`);
  const t=trimCoaxial(ing,ing,2575*RPM,W,mars(rho));assert.ok(t,'trim exists at the design point');
  assert.ok(t.upper.stalledFraction<.1&&t.lower.stalledFraction<.2,'no significant stall at the design point');
});

test('calibrated loss factor: Ingenuity-like hover draws ≈ 350 W electrical in Rapier (JPL: about 350 W)',()=>{
  const sim=new Simulation({vehicle:'ingenuity-like',overrides:{surfaceDensity:.0165},waypoints:[],returnHome:false,cruiseAltitude:5},{terrain:false});
  sim.start();let P=0,n=0;
  for(let i=0;i<240*30;i++){sim.step();if(sim.time>22&&sim.mission.phase!=='takeoff'){P+=sim.vehicle.out.power;n++;}}
  assert.ok(n>100,'reached hover');rel(P/n,350,.08,'hover electrical power');
  // uncalibrated section polar gives far less: the factor is what closes the gap
  const raw=trimCoaxial(withDragFactor(ing,1),withDragFactor(ing,1),2537*RPM,1.8*3.71,mars(.0165));
  assert.ok(raw.power<.6*sim.control.trim.power,`uncalibrated shaft ${raw.power} W`);
  sim.dispose();
});

test('5-inch FPV propeller: plausible on Earth, cannot carry the quad on Mars at any motor speed',()=>{
  const fp=ROTORS.fpv5,s=createRotorState();
  evaluateRotor(fp,s,{omega:30000*RPM},EarthEnvironment().surface);
  assert.ok(s.T/9.81>.6&&s.T/9.81<1.6,`static thrust ${s.T/9.81*1000} gf at 30 000 rpm`);
  const fm=figureOfMerit(s);assert.ok(fm>.35&&fm<.8,`FM ${fm}`);
  const need=.65*3.71/4,w=solveSpeed(fp,need,MarsEnvironment().surface,46000*RPM);
  assert.equal(w,null,'no speed up to 46 000 rpm lifts a quarter of the 5" quad on Mars');
});
