import {FlightPhysics} from '../physics/FlightPhysics.js';
import {FLIGHT} from '../physics/config.js';
import {DEFAULT_DRONE} from '../drone/DroneTypes.js';
import {PlanetEnvironment,MarsEnvironment} from './PlanetEnvironment.js';

/**
 * The existing flight core (Rapier rigid body, motors, controller, crash logic) on any planet,
 * without changing a core file. Two things change:
 *   1. Rapier gravity = the environment's gravity.
 *   2. Every density-dependent quantity of the airframe follows the local air density:
 *      rotor thrust T = CT ρ n² D⁴ (and torque, since the core keeps Q/T fixed), body drag and
 *      rotational drag scale with σ = ρ / ρ_ref. Hover throttle, thrust/weight, idle thrust and
 *      the training-throttle cap are recomputed for the planet.
 *
 * With ρ = ρ_ref and g = 9.81 m/s² the result is bit-for-bit the core (tested against the
 * 5" reference trace). Phase 1 limits, listed in ASSUMPTIONS, are replaced in Phase 2.
 */
export const CORE_REFERENCE=Object.freeze({
  density:1.225,gravity:FLIGHT.gravity,
  note:'Core airframe thrust and drag values are taken as sea-level ISA air (1.225 kg/m³) calibrations (assumed).',
});
export const ASSUMPTIONS=Object.freeze([
  Object.freeze({id:'core-calibration',status:'assumed',
    en:'Core airframe thrust and drag values are treated as sea-level ISA (1.225 kg/m³) calibrations.',
    tr:'Çekirdek drone itki ve sürükleme değerleri deniz seviyesi ISA havası (1,225 kg/m³) kalibrasyonu kabul edildi.'}),
  Object.freeze({id:'constant-ct',status:'assumed',
    en:'CT and CQ are held at their Earth values: no Reynolds-number or Mach correction yet (Phase 2). At Mars Reynolds numbers real CT is lower, so Mars thrust here is an upper bound.',
    tr:'CT ve CQ Dünya değerinde sabit: henüz Reynolds ve Mach düzeltmesi yok (Aşama 2). Mars Reynolds sayılarında gerçek CT daha düşüktür; buradaki Mars itkisi bir üst sınırdır.'}),
  Object.freeze({id:'motor-speed-limit',status:'assumed',
    en:'Maximum motor speed does not depend on density (no motor/ESC model yet; Phase 2).',
    tr:'Azami motor devri yoğunluktan bağımsız (henüz motor/ESC modeli yok; Aşama 2).'}),
  Object.freeze({id:'drag-scaling',status:'assumed',
    en:'All body drag coefficients scale linearly with density (quadratic drag exactly; the core\'s linear term empirically).',
    tr:'Gövde sürükleme katsayıları yoğunlukla doğrusal ölçeklenir (karesel terim fiziksel olarak; çekirdeğin doğrusal terimi deneysel kabul).'}),
  Object.freeze({id:'controller-gravity',status:'assumed',
    en:'Training-throttle and position-hold feed-forward still use 9.81 m/s² inside the core controller; closed loops stay stable but respond more slowly on Mars.',
    tr:'Eğitim gazı ve konum tutma ileri beslemesi çekirdek kontrolcüde hâlâ 9,81 m/sn² kullanır; döngü kararlı kalır, Mars\'ta tepki daha yavaştır.'}),
  Object.freeze({id:'battery',status:'assumed',
    en:'Battery drain is the core\'s load model, not an electrical power model (Phase 2).',
    tr:'Batarya tüketimi çekirdeğin yük modelidir, elektrik güç modeli değildir (Aşama 2).'}),
]);

/** Airframe derived for a planet and air density. Accepts a core drone or an already planetized one. */
export function planetizeDrone(drone,environment,{altitude=0,density=environment.density(altitude)}={}){
  if(!(environment instanceof PlanetEnvironment))throw new TypeError('planetizeDrone needs a PlanetEnvironment');
  if(!(density>0))throw new RangeError('density must be > 0');
  const base=drone.planet?.base??drone,g=environment.gravity,sigma=density/CORE_REFERENCE.density;
  const n=base.motorCount,maxMotorThrust=base.maxMotorThrust*sigma;
  const hover=base.mass*g/(n*maxMotorThrust);
  const scale=a=>Object.freeze(a.map(c=>c*sigma));
  return Object.freeze({...base,
    maxMotorThrust,idle:(base.idle??.06)*sigma,hover,thrustToWeight:n*maxMotorThrust/(base.mass*g),
    drag:Object.freeze({linear:scale(base.drag.linear),quadratic:scale(base.drag.quadratic),angular:base.drag.angular*sigma}),
    assist:Object.freeze({...base.assist,cap:Math.min(1,base.assist.cap*(hover/base.hover))}),
    planet:Object.freeze({base,environment:environment.id,planet:environment.planet,gravity:g,density,sigma,altitude,assumptions:ASSUMPTIONS}),
  });
}

export class PlanetFlightPhysics extends FlightPhysics {
  /**
   * @param spawn [x,y,z] metres; y is height above the site
   * @param drone a core DroneTypes entry (planetized internally)
   * @param environment PlanetEnvironment (default: Mars, brief values)
   * @param options.siteElevation site altitude above the profile reference (m)
   * @param options.densityTolerance relative density change that triggers a re-derivation while flying
   */
  constructor(spawn=[0,.2,0],yaw=0,drone=DEFAULT_DRONE,environment=MarsEnvironment(),{siteElevation=0,densityTolerance=1e-3}={}){
    const base=drone.planet?.base??drone;
    super(spawn,yaw,planetizeDrone(base,environment,{altitude:siteElevation+spawn[1]}));
    this.environment=environment;this.siteElevation=siteElevation;this.densityTolerance=densityTolerance;this.baseDrone=base;
    this.world.gravity={x:0,y:-environment.gravity,z:0};
  }
  altitude(){return this.siteElevation+this.position.y;}
  /** Swap airframe while disarmed (the core rule); the new type is planetized for this environment. */
  setDrone(drone){
    const base=drone.planet?.base??drone;
    if(base===this.baseDrone)return true;
    if(this.armed)return false;
    const ok=super.setDrone(planetizeDrone(base,this.environment,{altitude:this.siteElevation+this.checkpoint.pos[1]}));
    if(ok)this.baseDrone=base;
    return ok;
  }
  /** Planet switch (disarmed only): gravity, airframe and checkpoint state are re-derived. */
  setEnvironment(environment){
    if(!(environment instanceof PlanetEnvironment))throw new TypeError('setEnvironment needs a PlanetEnvironment');
    if(this.armed)return false;
    this.environment=environment;this.world.gravity={x:0,y:-environment.gravity,z:0};
    return super.setDrone(planetizeDrone(this.baseDrone,environment,{altitude:this.siteElevation+this.checkpoint.pos[1]}));
  }
  step(dt,input){
    // Density follows altitude; with a uniform atmosphere this never triggers.
    if(this.environment.model!=='uniform'){
      const h=this.altitude(),rho=this.environment.density(h);
      if(Math.abs(rho/this.drone.planet.density-1)>this.densityTolerance)
        this.drone=planetizeDrone(this.baseDrone,this.environment,{density:rho,altitude:h});
    }
    super.step(dt,input);
  }
}
