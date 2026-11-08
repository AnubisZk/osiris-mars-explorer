import {sunPosition} from '../mars/time.js';

/**
 * Multi-sol energy balance of a solar-recharged Mars rotorcraft: the panel charges the battery
 * by day, heaters and sleeping avionics drain it at night, a flight takes a short, large bite.
 *
 *  Sun:      Mars24 position and top-of-atmosphere irradiance 1361 W/m² / r² (time.js)
 *  Beam:     Beer–Lambert, I0 exp(−τ / μ), μ = sin(elevation) (plane-parallel atmosphere)
 *  Diffuse:  scattered light reaching the ground ≈ 0.65 e^(−0.3 τ) of the light removed from
 *            the beam (ASSUMED shape, chosen to follow the trend of the Appelbaum & Flood (1989)
 *            normalised net flux: about 0.7 of top-of-atmosphere at τ = 1, 0.45 at τ = 2, 0.15 at τ = 5)
 *  Ambient:  diurnal temperature between the Viking 1 extremes 184–242 K (NASA Fact Sheet),
 *            minimum at sunrise (≈ 6 h), maximum at 14 h local solar time; curve shape assumed
 *  Heater:   P = G (T_set − T_ambient) when positive (lumped thermal conductance G, assumed)
 *  Dust:     panel output falls by `dustPerSol` each sol (no cleaning events)
 * Every vehicle's panel and thermal values are in presets.js with their status.
 */
export const SOL_SECONDS=88775.244;
const SOL_MS=SOL_SECONDS*1000,RAD=Math.PI/180;

/** Irradiance on a horizontal panel (W/m²): {beam, diffuse, global, mu}. */
export function surfaceIrradiance(sun,tau){
  const mu=Math.sin(sun.elevation*RAD);if(mu<=0)return {beam:0,diffuse:0,global:0,mu:0};
  const I0=sun.irradianceTOA,m=1/Math.max(mu,.05),beam=I0*mu*Math.exp(-tau*m);
  const diffuse=I0*mu*(1-Math.exp(-tau*m))*.65*Math.exp(-.3*tau);
  return {beam,diffuse,global:beam+diffuse,mu};
}
/** Ambient (near-surface) temperature in K at local solar time `lst` (h). */
export function ambientTemperature(lst,{min=184,max=242}={}){
  if(lst>=6&&lst<=14)return min+(max-min)*Math.sin(Math.PI/2*(lst-6)/8);
  const h=lst>14?lst-14:lst+10; // hours since 14:00 (wrapping through midnight), 16 h of cooling
  return min+(max-min)*Math.max(0,1-h/16)**1.6;
}

/**
 * Simulate `sols` sols at a site. vehicle: {battery (spec), solar {area, efficiency, packing,
 * chargeEfficiency}, thermal {conductance, setpoint, sleepPower}}. flight: {energyWh, lst} or null.
 * Policy: fly at `flight.lst` only if a look-ahead shows the battery stays above `survivalSoC`
 * until the next sunrise after the flight ("can we fly today?").
 */
export function simulateSols({vehicle,site,start,sols=10,tau=.5,dustPerSol=.002,flight=null,socStart=1,survivalSoC=.15,stepMinutes=5,panelArea=null,temperature={}}){
  const cap=vehicle.battery.nominalEnergyWh,sol=vehicle.solar??{area:0,efficiency:0,packing:1,chargeEfficiency:1},th=vehicle.thermal??{conductance:0,setpoint:0,sleepPower:0};
  const area=panelArea??sol.area,dt=stepMinutes*60,steps=Math.round(SOL_SECONDS/dt);
  const timeline=[],days=[];let soc=socStart,min=soc,flights=0,survived=true;
  const loads=(ms,t)=>{const s=sunPosition(ms,site.lat,site.lonEast),irr=surfaceIrradiance(s,tau);
    const pv=area*sol.efficiency*sol.packing*irr.global*(1-dustPerSol*t/SOL_SECONDS);
    const Ta=ambientTemperature(s.localSolarTime,temperature),heat=Math.max(0,th.conductance*(th.setpoint-Ta));
    return {pv,heat,sleep:th.sleepPower,lst:s.localSolarTime,Ta,elevation:s.elevation};};
  // battery floor at 0: below it the heaters stop (survival failure is recorded)
  const step=(state,l)=>{const net=l.pv*sol.chargeEfficiency-l.heat-l.sleep;state.soc=Math.max(0,Math.min(1,state.soc+net*dt/3600/cap));};
  // look-ahead: does the battery stay above the survival level until the Sun is up again?
  const survives=(soc0,t0,k0)=>{const st={soc:soc0};for(let k=k0;k<k0+steps;k++){const l=loads(start+(t0+(k-k0)*dt)*1000,t0+(k-k0)*dt);step(st,l);if(st.soc<survivalSoC)return false;if(k>k0+12&&l.elevation>10)return true;}return true;};
  for(let d=0;d<sols;d++){
    const rec={sol:d+1,harvestWh:0,heaterWh:0,sleepWh:0,flightWh:0,flew:false,socSunset:NaN,socMin:1,lstFlight:null};let flownToday=false,prevLst=null;
    for(let k=0;k<steps;k++){
      const t=(d*steps+k)*dt,l=loads(start+t*1000,t),st={soc};
      if(flight&&!flownToday&&prevLst!=null&&prevLst<flight.lst&&l.lst>=flight.lst){
        flownToday=true;const after=soc-flight.energyWh/cap;
        if(after>survivalSoC&&survives(after,t,0)){soc=after;rec.flew=true;rec.flightWh=flight.energyWh;rec.lstFlight=l.lst;flights++;st.soc=soc;}
      }
      step(st,l);soc=st.soc;
      rec.harvestWh+=l.pv*sol.chargeEfficiency*dt/3600;rec.heaterWh+=l.heat*dt/3600;rec.sleepWh+=l.sleep*dt/3600;
      if(prevLst!=null&&prevLst<18&&l.lst>=18)rec.socSunset=soc;
      rec.socMin=Math.min(rec.socMin,soc);min=Math.min(min,soc);if(soc<=1e-9)survived=false;
      if(k%3===0)timeline.push({sol:t/SOL_SECONDS,soc,pv:l.pv,heat:l.heat,Ta:l.Ta});
      prevLst=l.lst;
    }
    days.push(rec);
  }
  return {days,timeline,flights,minSoC:min,survived,capacityWh:cap,panelArea:area,tau,dustPerSol,
    meanHarvestWh:days.reduce((s,d)=>s+d.harvestWh,0)/sols,meanNightWh:days.reduce((s,d)=>s+d.heaterWh+d.sleepWh,0)/sols};
}
