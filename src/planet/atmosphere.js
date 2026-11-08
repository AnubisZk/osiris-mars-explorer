/**
 * Atmosphere models for the planet layer (pure functions, no Rapier, no DOM).
 *
 * Models
 * - 'layers'     Hydrostatic ideal-gas atmosphere made of constant-lapse layers (the ISA
 *                construction). Anchored at the profile's surface values; used for Earth (ISA)
 *                and for the Mars scenario profiles.
 * - 'nasa-glenn' The NASA Glenn Mars curve fit (Mars Global Surveyor data), used as published.
 * - 'uniform'    Constant temperature, pressure and density at every altitude. Useful as an
 *                experimental control when density is the independent variable.
 *
 * Units: m, K, Pa, kg/m³, Pa·s, m/s. Altitude is measured from the profile's reference level.
 */
export const R_UNIVERSAL=8.314462618; // J/(mol·K), exact in the 2019 SI (CODATA)

// kg/mol, from IUPAC standard atomic weights
const MOLAR_MASS=Object.freeze({CO2:.0440095,N2:.0280134,Ar:.039948,O2:.0319988,CO:.0280101});
// Ideal-gas molar heat capacity cp, J/(mol·K).
// CO2: NIST-JANAF table C-095 (linear interpolation between tabulated points).
// Minor species: 298.15 K JANAF values held constant (their share of a Mars mixture is < 5 %).
const CO2_CP=Object.freeze([[100,29.208],[200,32.359],[298.15,37.129],[300,37.221]]);
const MINOR_CP=Object.freeze({N2:29.124,Ar:20.786,O2:29.376,CO:29.142});

function interpolate(table,x){
  if(x<=table[0][0])return table[0][1];
  for(let i=1;i<table.length;i++)if(x<=table[i][0]){
    const [x0,y0]=table[i-1],[x1,y1]=table[i];return y0+(y1-y0)*(x-x0)/(x1-x0);
  }
  return table[table.length-1][1];
}

export const GASES=Object.freeze({
  'earth-air':Object.freeze({
    id:'earth-air',label:{en:'Dry air (ISA)',tr:'Kuru hava (ISA)'},
    // ISA defines R and γ directly
    gasConstant:287.05287,gamma:1.4,molarMass:.0289644,
    viscosity:Object.freeze({mu0:1.716e-5,T0:273.15,S:110.4}),sources:['isa','sutherlandAir'],
  }),
  'mars-co2':Object.freeze({
    id:'mars-co2',label:{en:'Mars atmosphere (CO₂-rich mixture)',tr:'Mars atmosferi (CO₂ ağırlıklı karışım)'},
    // Volume fractions from the NASA Mars Fact Sheet (normalised to 1 below)
    composition:Object.freeze({CO2:.951,N2:.0259,Ar:.0194,O2:.0016,CO:.0006}),
    // CO2 Sutherland constants (White); used for the whole mixture (CO2 is 95 %)
    viscosity:Object.freeze({mu0:1.370e-5,T0:273,S:222}),sources:['nasaFactSheet','janafCO2','sutherlandCO2'],
  }),
});

function mixture(gas){
  if(gas.gasConstant)return gas;
  const entries=Object.entries(gas.composition),total=entries.reduce((s,[,x])=>s+x,0);
  const molarMass=entries.reduce((s,[k,x])=>s+x*MOLAR_MASS[k],0)/total;
  return {...gas,molarMass,gasConstant:R_UNIVERSAL/molarMass,fractions:entries.map(([k,x])=>[k,x/total])};
}
const mixtures=new Map();
export function gasData(id){
  const gas=GASES[id];if(!gas)throw new RangeError(`Unknown gas '${id}'`);
  if(!mixtures.has(id))mixtures.set(id,Object.freeze(mixture(gas)));
  return mixtures.get(id);
}

/** Ratio of specific heats at temperature T (K). Fixed for ISA air, from cp(T) for mixtures. */
export function gammaAt(gas,T){
  if(gas.gamma)return gas.gamma;
  let cp=0;
  for(const [k,x] of gas.fractions)cp+=x*(k==='CO2'?interpolate(CO2_CP,T):MINOR_CP[k]);
  return cp/(cp-R_UNIVERSAL);
}

/** Sutherland's law: μ = μ0 (T/T0)^1.5 (T0+S)/(T+S), Pa·s. */
export function sutherland({mu0,T0,S},T){return mu0*(T/T0)**1.5*(T0+S)/(T+S);}

/** One constant-lapse hydrostatic segment from h0 (T0, p0) to h1. */
function segment(T0,p0,lapse,h0,h1,g,R){
  const T1=T0+lapse*(h1-h0);
  if(!(T1>0))throw new RangeError(`Temperature falls to ${T1.toFixed(1)} K at ${h1} m: altitude outside the model`);
  const p1=Math.abs(lapse)<1e-12?p0*Math.exp(-g*(h1-h0)/(R*T0)):p0*(T1/T0)**(-g/(R*lapse));
  return [T1,p1];
}

/**
 * Temperature and pressure of a layered atmosphere at altitude h.
 * `layers` [{base, lapse}] sorted by base, first base 0; lapse = dT/dh (K/m).
 * Below 0 the first layer is extended downwards (flagged as extrapolated).
 */
export function layeredState(h,{surfaceTemperature:T0,surfacePressure:p0,layers},g,R){
  if(h<=0){const [T,p]=segment(T0,p0,layers[0].lapse,0,h,g,R);return [T,p,h<0];}
  let T=T0,p=p0;
  for(let i=0;i<layers.length;i++){
    const base=layers[i].base,top=i+1<layers.length?layers[i+1].base:Infinity;
    if(h<=base)break;
    [T,p]=segment(T,p,layers[i].lapse,base,Math.min(h,top),g,R);
  }
  return [T,p,false];
}

export const GLENN_GAS_CONSTANT=192.1; // J/(kg·K), the 0.1921 kJ/(kg·K) in the NASA Glenn density equation
/** NASA Glenn Mars model as published: T in °C, p in kPa, ρ = p / (0.1921 (T + 273.1)). */
export function glennMarsState(h){
  const lower=h<=7000;
  const Tc=lower?-31-.000998*h:-23.4-.00222*h;
  const pk=(lower?.699:.669)*Math.exp(-.00009*h);
  return {temperature:Tc+273.1,pressure:pk*1000,density:pk/(.1921*(Tc+273.1)),extrapolated:h<0};
}

/**
 * Full atmospheric state at altitude h for resolved parameters `p` (see PlanetEnvironment).
 * Writes into `out` (no allocation when reused) and returns it.
 */
export function atmosphereState(p,h,out={}){
  const gas=p.gasData;let T,P,rho,extrapolated=false;
  if(p.model==='uniform'){T=p.surfaceTemperature;P=p.surfacePressure;rho=p.surfaceDensity;}
  let R=gas.gasConstant;
  if(p.model==='nasa-glenn'){
    // The fit's own equation of state (R = 192.1 J/(kg·K)) keeps the published state self-consistent
    const s=glennMarsState(h);T=s.temperature;P=s.pressure;rho=s.density;extrapolated=s.extrapolated;R=GLENN_GAS_CONSTANT;
  }else if(p.model!=='uniform'){
    [T,P,extrapolated]=layeredState(h,p,p.gravity,R);rho=P/(R*T);
  }
  const gamma=gammaAt(gas,T),mu=sutherland(gas.viscosity,T);
  out.altitude=h;out.temperature=T;out.pressure=P;out.density=rho;
  out.gamma=gamma;out.gasConstant=R;out.speedOfSound=Math.sqrt(gamma*R*T);
  out.dynamicViscosity=mu;out.kinematicViscosity=mu/rho;out.extrapolated=extrapolated;
  return out;
}
