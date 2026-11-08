// Multi-sol energy: irradiance model limits, diurnal temperature, energy conservation of the
// battery ledger, "can we fly today?" policy, dust and panel-area trends.
import test from 'node:test';
import assert from 'node:assert/strict';
import {surfaceIrradiance,ambientTemperature,simulateSols} from '../src/power/solar.js';
import {VEHICLES} from '../src/vehicles/presets.js';
import {JEZERO} from '../src/mars/time.js';

const rel=(a,b,t,m='')=>assert.ok(Math.abs(a-b)<=t*Math.abs(b),`${m} ${a} ≠ ${b} (±${t*100}%)`);
const start=Date.UTC(2026,10,14,0),ing=VEHICLES['ingenuity-like'];

test('irradiance: no atmosphere = TOA·μ; beam follows Beer–Lambert; global follows the assumed Appelbaum–Flood trend',()=>{
  const sun={elevation:90,irradianceTOA:590};
  rel(surfaceIrradiance(sun,0).global,590,1e-12);rel(surfaceIrradiance(sun,1).beam,590*Math.exp(-1),1e-12);
  for(const [tau,frac] of [[1,.7],[2,.45],[5,.15]])rel(surfaceIrradiance(sun,tau).global/590,frac,.1,`τ=${tau}`);
  assert.equal(surfaceIrradiance({elevation:-5,irradianceTOA:590},.5).global,0);
  let last=Infinity;for(const tau of [0,.5,1,2,4]){const g=surfaceIrradiance({elevation:40,irradianceTOA:590},tau).global;assert.ok(g<last);last=g;}
});

test('diurnal temperature: Viking 1 extremes at sunrise and 14 h, continuous through the day',()=>{
  rel(ambientTemperature(6),184,1e-12);rel(ambientTemperature(14),242,1e-12);
  for(let h=0;h<24;h+=.01){const a=ambientTemperature(h),b=ambientTemperature((h+.01)%24);assert.ok(Math.abs(a-b)<1,`jump at ${h}`);assert.ok(a>=184-1e-9&&a<=242+1e-9);}
});

test('battery ledger closes: harvest − heaters − sleep − flights = ΔSoC · capacity (no clamping)',()=>{
  const vehicle={...ing,solar:{...ing.solar,area:.006},thermal:{conductance:.002,setpoint:230,sleepPower:.05}};
  const r=simulateSols({vehicle,site:JEZERO,start,sols:3,tau:.5,socStart:.5,flight:{energyWh:2,lst:12}});
  const net=r.days.reduce((s,d)=>s+d.harvestWh-d.heaterWh-d.sleepWh-d.flightWh,0),end=r.timeline[r.timeline.length-1].soc;
  assert.ok(r.minSoC>0&&Math.max(...r.timeline.map(x=>x.soc))<1,'no clamping in this scenario');
  rel((end-.5)*r.capacityWh,net,.02,'energy balance');assert.equal(r.flights,3);
});

test('Ingenuity-like: clear-sky harvest in a plausible range; flies every clear sol; dust storm stops flights',()=>{
  const clear=simulateSols({vehicle:ing,site:JEZERO,start,sols:5,tau:.5,flight:{energyWh:8.8,lst:11}});
  assert.ok(clear.meanHarvestWh>40&&clear.meanHarvestWh<65,`harvest ${clear.meanHarvestWh} Wh/sol`);
  assert.equal(clear.flights,5);assert.ok(clear.survived);
  const storm=simulateSols({vehicle:ing,site:JEZERO,start,sols:5,tau:4,flight:{energyWh:8.8,lst:11}});
  assert.ok(storm.flights<=1&&storm.meanHarvestWh<.35*clear.meanHarvestWh);
  // policy: a flight is only taken if the battery then stays above the survival level until sunrise
  for(const d of storm.days)if(d.flew)assert.ok(d.socMin>=0);
});

test('more panel area → never fewer flights; more dust → never more harvest',()=>{
  const q=VEHICLES['osiris-mars-quad'];let f=-1,h=Infinity;
  for(const area of [.05,.1,.2,.4]){const r=simulateSols({vehicle:q,site:JEZERO,start,sols:6,tau:1,panelArea:area,flight:{energyWh:10,lst:12}});assert.ok(r.flights>=f);f=r.flights;}
  for(const tau of [.3,1,2,4]){const r=simulateSols({vehicle:q,site:JEZERO,start,sols:2,tau});assert.ok(r.meanHarvestWh<=h);h=r.meanHarvestWh;}
  assert.equal(simulateSols({vehicle:VEHICLES.fpv5,site:JEZERO,start,sols:1}).meanHarvestWh,0,'no panel on the FPV quad');
});
