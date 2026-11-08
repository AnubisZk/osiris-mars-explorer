import {atmosphereState,gasData,glennMarsState} from './atmosphere.js';
import {getProfile,SOURCES,STATUS_LABELS,DEFAULT_MARS} from './profiles.js';

/**
 * A planet environment: gravity plus an atmosphere model, built from a profile and optional
 * scenario overrides. Immutable; `with()` returns a modified copy. No Rapier, no DOM.
 *
 * Overrides (all optional):
 *   gravity (m/s²), surfaceDensity (kg/m³) or surfacePressure (Pa), surfaceTemperature (K),
 *   lapseRate (K/m, lowest layer, dT/dh), model ('layers' | 'uniform')
 * An overridden value is marked status 'scenario'. Setting surfaceDensity derives pressure
 * from the ideal-gas law and vice versa.
 */
const LIMITS=Object.freeze({
  gravity:[.1,30],surfaceDensity:[1e-5,10],surfacePressure:[.1,2e7],surfaceTemperature:[50,800],lapseRate:[-.05,.05],
});
const KEYS=Object.freeze(['gravity','surfaceDensity','surfacePressure','surfaceTemperature','lapseRate','model']);

function check(key,value){
  if(key==='model'){
    if(value!=='layers'&&value!=='uniform')throw new RangeError(`model must be 'layers' or 'uniform', got '${value}'`);
    return;
  }
  const [lo,hi]=LIMITS[key];
  if(typeof value!=='number'||!Number.isFinite(value)||value<lo||value>hi)
    throw new RangeError(`${key} must be a finite number in [${lo}, ${hi}], got ${value}`);
}

export class PlanetEnvironment {
  constructor(profile=DEFAULT_MARS,overrides={}){
    const prof=typeof profile==='string'?getProfile(profile):profile;
    for(const k of Object.keys(overrides)){
      if(!KEYS.includes(k))throw new RangeError(`Unknown environment parameter '${k}'. Allowed: ${KEYS.join(', ')}`);
      check(k,overrides[k]);
    }
    if('surfaceDensity' in overrides&&'surfacePressure' in overrides)
      throw new RangeError('Give surfaceDensity or surfacePressure, not both (the other follows from the ideal-gas law)');
    if(prof.model==='nasa-glenn'){
      const atmosphereKeys=Object.keys(overrides).filter(k=>k!=='gravity');
      if(atmosphereKeys.length)throw new RangeError(`The NASA Glenn profile is a published fit; only gravity can be changed (got ${atmosphereKeys.join(', ')})`);
    }
    const gas=gasData(prof.gas);
    const p={...prof.params,model:prof.model};
    const meta={...prof.meta};
    if(prof.model==='nasa-glenn'){
      const s=glennMarsState(0);
      p.surfaceTemperature=s.temperature;p.surfacePressure=s.pressure;p.surfaceDensity=s.density;
      for(const k of ['surfaceTemperature','surfacePressure','surfaceDensity'])
        meta[k]={unit:k==='surfaceTemperature'?'K':k==='surfacePressure'?'Pa':'kg/m³',status:'sourced',source:'nasaGlenn',note:'Fit value at h = 0'};
    }
    for(const [k,v] of Object.entries(overrides)){
      if(k==='lapseRate'){
        if(!p.layers)throw new RangeError('This profile has no layers to change');
        p.layers=[{base:0,lapse:v},...p.layers.slice(1)];
        meta.layers={...meta.layers,status:'scenario',note:`Lowest-layer lapse set to ${v} K/m`};
        continue;
      }
      p[k]=v;
      if(k!=='model')meta[k]={...(meta[k]??{unit:k==='gravity'?'m/s²':k==='surfaceTemperature'?'K':k==='surfacePressure'?'Pa':'kg/m³'}),status:'scenario',source:'scenario',note:`Profile value ${prof.params[k]??'derived'}`};
      if(k==='surfaceDensity')p.surfacePressure=null;
      if(k==='surfacePressure')p.surfaceDensity=null;
    }
    if(p.surfacePressure==null){
      p.surfacePressure=p.surfaceDensity*gas.gasConstant*p.surfaceTemperature;
      meta.surfacePressure={unit:'Pa',status:'derived',source:null,note:'p = ρ R T'};
    }else if(p.surfaceDensity==null){
      p.surfaceDensity=p.surfacePressure/(gas.gasConstant*p.surfaceTemperature);
      meta.surfaceDensity={unit:'kg/m³',status:'derived',source:null,note:'ρ = p / (R T)'};
    }
    p.gasData=gas;
    this.profile=prof;this.overrides=Object.freeze({...overrides});
    this.params=Object.freeze(p);this.meta=Object.freeze(meta);
    this.surface=Object.freeze(atmosphereState(this.params,0));
    Object.freeze(this);
  }
  get id(){return this.profile.id;}
  get planet(){return this.profile.planet;}
  get label(){return this.profile.label;}
  get gravity(){return this.params.gravity;}
  get model(){return this.params.model;}
  /** Atmospheric state at altitude h (m above the profile's reference level). */
  atmosphere(h=0,out={}){return atmosphereState(this.params,h,out);}
  density(h=0){return this.params.model==='uniform'?this.params.surfaceDensity:atmosphereState(this.params,h,scratch).density;}
  weight(mass){return mass*this.params.gravity;}
  dynamicPressure(speed,h=0){return .5*this.density(h)*speed*speed;}
  reynolds(speed,length,h=0){const s=atmosphereState(this.params,h,scratch);return s.density*speed*length/s.dynamicViscosity;}
  mach(speed,h=0){return speed/atmosphereState(this.params,h,scratch).speedOfSound;}
  /** Pressure scale height H = R T / g at altitude h. */
  scaleHeight(h=0){const s=atmosphereState(this.params,h,scratch);return s.gasConstant*s.temperature/this.params.gravity;}
  with(overrides){return new PlanetEnvironment(this.profile,{...this.overrides,...overrides});}
  /** Parameter table for reports and the UI: value, unit, status (with label) and source. */
  parameters(lang='en'){
    const row=(key,value,m)=>({key,value,unit:m?.unit??'',status:m?.status??'derived',
      statusLabel:STATUS_LABELS[m?.status??'derived'][lang],source:m?.source&&SOURCES[m.source]?SOURCES[m.source]:null,note:m?.note??null});
    const s=this.surface,p=this.params,rows=[
      row('gravity',p.gravity,this.meta.gravity),
      row('surfaceDensity',p.surfaceDensity,this.meta.surfaceDensity),
      row('surfacePressure',p.surfacePressure,this.meta.surfacePressure),
      row('surfaceTemperature',p.surfaceTemperature,this.meta.surfaceTemperature),
    ];
    if(p.layers)rows.push(row('lapseRate',p.layers[0].lapse,this.meta.layers));
    rows.push(
      row('model',p.model,{unit:'',status:this.overrides.model?'scenario':'sourced',source:p.model==='nasa-glenn'?'nasaGlenn':p.model==='layers'?'isa':null,
        note:p.model==='layers'?'Hydrostatic ideal gas with constant-lapse layers':p.model==='uniform'?'Constant properties (experimental control)':'Published curve fit'}),
      row('gasConstant',p.gasData.gasConstant,{unit:'J/(kg·K)',status:p.gasData.gamma?'sourced':'derived',source:p.gasData.gamma?'isa':'nasaFactSheet',note:p.gasData.gamma?null:'R / mean molar mass of the Fact Sheet composition'}),
      row('gamma',s.gamma,{unit:'',status:p.gasData.gamma?'sourced':'derived',source:p.gasData.gamma?'isa':'janafCO2',note:p.gasData.gamma?null:'cp(T) of the mixture, CO₂ from NIST-JANAF'}),
      row('speedOfSound',s.speedOfSound,{unit:'m/s',status:'derived',source:null,note:'a = √(γ R T)'}),
      row('dynamicViscosity',s.dynamicViscosity,{unit:'Pa·s',status:'derived',source:p.gasData.gamma?'sutherlandAir':'sutherlandCO2',note:'Sutherland\'s law'}),
      row('scaleHeight',this.scaleHeight(0),{unit:'m',status:'derived',source:null,note:'H = R T / g at the surface'}),
    );
    return rows;
  }
  toJSON(){return {profile:this.id,planet:this.planet,overrides:this.overrides,parameters:this.parameters('en')};}
}
const scratch={};

export const createEnvironment=(profile,overrides)=>new PlanetEnvironment(profile,overrides);
/** The brief's names: MarsEnvironment / EarthEnvironment. */
export const MarsEnvironment=(overrides={},profile=DEFAULT_MARS)=>new PlanetEnvironment(profile,overrides);
export const EarthEnvironment=(overrides={})=>new PlanetEnvironment('earth-isa',overrides);
