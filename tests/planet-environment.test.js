// Planet environments: ISA reference values, Mars profiles against NASA sources, gas properties,
// hydrostatic and ideal-gas consistency, scenario overrides and validation.
import test from 'node:test';
import assert from 'node:assert/strict';
import {PlanetEnvironment,MarsEnvironment,EarthEnvironment,PROFILES,PROFILE_ORDER,SOURCES,gasData,gammaAt,glennMarsState} from '../src/planet/index.js';

const rel=(a,b,tol,msg='')=>assert.ok(Math.abs(a-b)<=tol*Math.abs(b),`${msg} ${a} ≠ ${b} (±${tol*100}%)`);

test('Earth ISA reproduces U.S. Standard Atmosphere 1976 table values',()=>{
  const e=EarthEnvironment();
  assert.equal(e.gravity,9.80665);
  // [altitude m, T K, p Pa, ρ kg/m³] from the 1976 tables
  for(const [h,T,p,rho] of [[0,288.15,101325,1.2250],[1000,281.65,89874.6,1.11164],[5000,255.65,54019.9,.736116],
    [11000,216.65,22632.1,.363918],[20000,216.65,5474.89,.0880349]]){
    const s=e.atmosphere(h);
    rel(s.temperature,T,1e-6,`T(${h})`);rel(s.pressure,p,2e-5,`p(${h})`);rel(s.density,rho,5e-5,`ρ(${h})`);
  }
  rel(e.surface.speedOfSound,340.294,1e-5,'a0');rel(e.surface.dynamicViscosity,1.7894e-5,1e-3,'μ0');
});

test('Mars brief profile uses the brief values and stays inside NASA Fact Sheet ranges',()=>{
  const m=MarsEnvironment();
  assert.equal(m.id,'mars-brief');assert.equal(m.planet,'mars');
  assert.equal(m.gravity,3.71);assert.equal(m.params.surfaceDensity,.020);assert.equal(m.params.surfaceTemperature,213.15);
  for(const k of ['gravity','surfaceDensity','surfaceTemperature'])assert.equal(m.meta[k].status,'brief',k);
  // Fact Sheet: ρ ~0.016 ± 0.006 kg/m³, surface pressure 4.0–8.7 mb depending on season
  assert.ok(m.surface.density>=.010&&m.surface.density<=.022);
  assert.ok(m.surface.pressure>=400&&m.surface.pressure<=870,`p0 ${m.surface.pressure}`);
  assert.equal(m.meta.surfacePressure.status,'derived');
});

test('Mars gas mixture: Fact Sheet molar mass, CO2 heat-capacity ratio, measured speed of sound',()=>{
  const gas=gasData('mars-co2');
  rel(gas.molarMass*1000,43.49,3e-4,'mean molecular weight (Fact Sheet 43.49)');
  const g213=gammaAt(gas,213.15);assert.ok(g213>1.33&&g213<1.35,`γ(213 K) ${g213}`);
  assert.ok(gammaAt(gas,250)<g213,'γ falls as CO2 vibrational modes wake up');
  // SuperCam (2022): ~240 m/s low-pitch and ~250 m/s high-pitch near the surface
  const a=new PlanetEnvironment('mars-brief',{surfaceTemperature:240}).surface.speedOfSound;
  assert.ok(a>235&&a<255,`a(240 K) ${a}`);
  rel(MarsEnvironment().surface.dynamicViscosity,1.075e-5,2e-3,'μ CO2 at 213 K (Sutherland)');
});

test('Mars scale height matches the Fact Sheet 11.0 km',()=>{
  rel(new PlanetEnvironment('mars-nasa').scaleHeight(),11000,.02,'H');
  rel(MarsEnvironment().scaleHeight(),11000,.02,'H brief');
});

test('every layered profile is hydrostatic (dp/dh = −ρg) and an ideal gas (p = ρRT)',()=>{
  for(const id of PROFILE_ORDER){
    const e=new PlanetEnvironment(id);
    for(const h of [-1000,0,150,2500,6999,7001,9000,15000]){
      if(e.planet==='earth'&&h<0)continue;
      const s=e.atmosphere(h);
      rel(s.pressure,s.density*s.gasConstant*s.temperature,1e-12,`${id} ideal gas at ${h}`);
      if(e.model!=='layers')continue;
      const d=.5,dp=(e.atmosphere(h+d).pressure-e.atmosphere(h-d).pressure)/(2*d);
      rel(dp,-s.density*e.gravity,1e-6,`${id} hydrostatic at ${h}`);
    }
  }
});

test('NASA Glenn profile follows the published equations; the hydrostatic model agrees within 8 % to 7 km',()=>{
  const glenn=new PlanetEnvironment('mars-glenn');
  for(const h of [0,1000,3000,7000,8000,12000]){
    const lower=h<=7000,Tc=lower?-31-.000998*h:-23.4-.00222*h,pk=(lower?.699:.669)*Math.exp(-.00009*h);
    const s=glenn.atmosphere(h);
    rel(s.temperature,Tc+273.1,1e-12);rel(s.pressure,pk*1000,1e-12);rel(s.density,pk/(.1921*(Tc+273.1)),1e-12);
  }
  const surface=glennMarsState(0);
  const layered=new PlanetEnvironment('mars-nasa',{surfaceTemperature:surface.temperature,surfacePressure:surface.pressure,gravity:3.73});
  for(const h of [500,2000,4000,7000]){
    rel(layered.atmosphere(h).pressure,glenn.atmosphere(h).pressure,.08,`p(${h})`);
    rel(layered.atmosphere(h).density,glenn.atmosphere(h).density,.08,`ρ(${h})`);
  }
});

test('scenario overrides: marked as scenario, ideal-gas partner derived, originals untouched',()=>{
  const m=MarsEnvironment(),thin=m.with({surfaceDensity:.012});
  assert.equal(m.params.surfaceDensity,.020);assert.equal(thin.params.surfaceDensity,.012);
  assert.equal(thin.meta.surfaceDensity.status,'scenario');assert.equal(thin.meta.surfacePressure.status,'derived');
  rel(thin.surface.pressure,.012*thin.surface.gasConstant*213.15,1e-12);
  const byPressure=m.with({surfacePressure:600});
  rel(byPressure.surface.density,600/(byPressure.surface.gasConstant*213.15),1e-12);
  assert.equal(byPressure.meta.surfaceDensity.status,'derived');
  const flat=m.with({model:'uniform'});
  for(const h of [0,100,5000])assert.equal(flat.density(h),.020);
  const lapse=m.with({lapseRate:-.0025});assert.equal(lapse.params.layers[0].lapse,-.0025);assert.equal(lapse.meta.layers.status,'scenario');
  const heavy=EarthEnvironment({gravity:9.81});assert.equal(heavy.gravity,9.81);assert.equal(heavy.meta.gravity.status,'scenario');
});

test('invalid scenario parameters are rejected with a clear error',()=>{
  const m=MarsEnvironment();
  assert.throws(()=>m.with({surfaceDensity:-1}),/surfaceDensity/);
  assert.throws(()=>m.with({gravity:NaN}),/gravity/);
  assert.throws(()=>m.with({surfaceTemperature:'cold'}),/surfaceTemperature/);
  assert.throws(()=>m.with({wind:3}),/Unknown environment parameter/);
  assert.throws(()=>new PlanetEnvironment('mars-brief',{surfaceDensity:.02,surfacePressure:700}),/not both/);
  assert.throws(()=>new PlanetEnvironment('mars-glenn',{surfaceDensity:.02}),/published fit/);
  assert.throws(()=>new PlanetEnvironment('venus'),/Unknown planet profile/);
  assert.throws(()=>m.atmosphere(120000),/outside the model/); // T would fall below 0 K
});

test('parameter table: every value has a unit and status; sourced and brief values name a source',()=>{
  for(const id of PROFILE_ORDER){
    const rows=new PlanetEnvironment(id).parameters('tr');
    for(const r of rows){
      assert.ok(['sourced','brief','assumed','derived','scenario'].includes(r.status),`${id}.${r.key} status ${r.status}`);
      assert.ok(typeof r.statusLabel==='string'&&r.statusLabel.length);
      if(r.status==='sourced'||r.status==='brief')assert.ok(r.source&&r.source.title,`${id}.${r.key} needs a source`);
    }
  }
  for(const s of Object.values(SOURCES))assert.ok(s.title&&(s.url===null||/^https:\/\//.test(s.url)));
  // Brief values are cross-checked against NASA in their notes
  assert.match(PROFILES['mars-brief'].meta.surfaceDensity.note,/0\.016/);
});

test('environments are immutable',()=>{
  const m=MarsEnvironment();
  assert.throws(()=>{'use strict';m.params.gravity=9;},TypeError);
  assert.throws(()=>{'use strict';m.extra=1;},TypeError);
  assert.equal(m.gravity,3.71);
});
