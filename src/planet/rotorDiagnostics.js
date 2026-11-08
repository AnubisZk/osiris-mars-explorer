import {CORE_REFERENCE} from './PlanetFlightPhysics.js';

/**
 * Rotor numbers for an airframe in an environment: what the core calibration implies (CT, CQ),
 * what it gives on the planet, and the flow regime the blades would run in (tip Mach, chord
 * Reynolds number). Pure function, no Rapier.
 *
 * Coefficient conventions (both reported, they differ by a factor π³/4 ≈ 7.75):
 *   propeller:  T = CT ρ n² D⁴         (n in rev/s)          — the brief's formula
 *   rotorcraft: T = CT ρ A (ΩR)²       (A = πR², Ω in rad/s) — used in NASA Ingenuity papers
 */
export const DIAGNOSTIC_LIMITS=Object.freeze({
  // Thresholds for warnings. Reynolds and Mach values are common engineering rules of thumb (assumed).
  controlMargin:1.5,lowReynolds:1e4,tipMach:.7,hoverTipMach:.9,highPropCT:.2,
});
const TWO_PI=2*Math.PI;

export function rotorDiagnostics(drone,environment,{altitude=0,chordRatio=.1}={}){
  const base=drone.planet?.base??drone,s=environment.atmosphere(altitude);
  const D=base.propDiameter,R=D/2,A=Math.PI*R*R,omega=base.maxMotorOmega,n=omega/TWO_PI,motors=base.motorCount;
  const ctProp=base.maxMotorThrust/(CORE_REFERENCE.density*n*n*D**4);
  const cqProp=base.reactionArm*ctProp/D;
  const ctRotor=ctProp*4/Math.PI**3;
  const thrust=ctProp*s.density*n*n*D**4;
  const weight=base.mass*environment.gravity,thrustToWeight=motors*thrust/weight;
  const tipSpeed=omega*R,tipMach=tipSpeed/s.speedOfSound;
  const chord=base.rotor?.chord??chordRatio*D,chordAssumed=!base.rotor?.chord;
  const reynolds75=s.density*.75*tipSpeed*chord/s.dynamicViscosity;
  const hoverRevs=Math.sqrt(weight/(motors*ctProp*s.density*D**4));
  const hoverTipMach=TWO_PI*hoverRevs*R/s.speedOfSound;
  // Momentum theory: ideal induced hover power per rotor P = T^1.5 / √(2ρA) (lower bound; real = ideal / figure of merit)
  const hoverThrust=weight/motors,idealHoverPower=hoverThrust**1.5/Math.sqrt(2*s.density*A);
  const shaftPowerMax=TWO_PI*cqProp*s.density*n**3*D**5;
  const warnings=[];
  const warn=(code,en,tr)=>warnings.push({code,en,tr});
  if(thrustToWeight<1)warn('cannot-hover',`Maximum thrust is ${(thrustToWeight*100).toFixed(0)} % of weight: cannot take off.`,`Azami itki ağırlığın %${(thrustToWeight*100).toFixed(0)}'i: havalanamaz.`);
  else if(thrustToWeight<DIAGNOSTIC_LIMITS.controlMargin)warn('low-margin',`Thrust/weight ${thrustToWeight.toFixed(2)} leaves little control margin (< ${DIAGNOSTIC_LIMITS.controlMargin}, assumed criterion).`,`İtki/ağırlık ${thrustToWeight.toFixed(2)}: kontrol payı az (< ${DIAGNOSTIC_LIMITS.controlMargin}, varsayımsal ölçüt).`);
  if(reynolds75<DIAGNOSTIC_LIMITS.lowReynolds)warn('low-reynolds',`Blade Reynolds number ≈ ${Math.round(reynolds75)} at 75 % radius: laminar low-Re regime, constant CT overestimates thrust.`,`%75 yarıçapta pal Reynolds sayısı ≈ ${Math.round(reynolds75)}: laminer düşük Re rejimi, sabit CT itkiyi olduğundan yüksek gösterir.`);
  if(tipMach>DIAGNOSTIC_LIMITS.tipMach)warn('tip-mach',`Tip Mach ${tipMach.toFixed(2)} at maximum speed: compressibility losses.`,`Azami devirde uç Mach ${tipMach.toFixed(2)}: sıkıştırılabilirlik kayıpları.`);
  if(hoverTipMach>DIAGNOSTIC_LIMITS.hoverTipMach)warn('hover-tip-mach',`Hover would need ${Math.round(hoverRevs*60)} rpm, tip Mach ${hoverTipMach.toFixed(2)}.`,`Askıda kalmak için ${Math.round(hoverRevs*60)} dev/dk gerekir, uç Mach ${hoverTipMach.toFixed(2)}.`);
  if(ctProp>DIAGNOSTIC_LIMITS.highPropCT)warn('high-ct',`The core calibration implies CT = ${ctProp.toFixed(3)} (propeller convention), high for a real propeller (≈0.08–0.15); Phase 2 derives CT from geometry.`,`Çekirdek kalibrasyonu CT = ${ctProp.toFixed(3)} veriyor (pervane tanımı); gerçek pervaneler için yüksek (≈0,08–0,15). Aşama 2'de CT geometriden hesaplanacak.`);
  return {
    drone:base.id,environment:environment.id,planet:environment.planet,altitude,
    density:s.density,speedOfSound:s.speedOfSound,dynamicViscosity:s.dynamicViscosity,gravity:environment.gravity,
    diameter:D,motors,maxRpm:n*60,ctProp,cqProp,ctRotor,
    thrustPerMotor:thrust,totalThrust:motors*thrust,weight,thrustToWeight,hoverThrottle:weight/(motors*thrust),
    tipSpeed,tipMach,chord,chordAssumed,reynolds75,hoverRpm:hoverRevs*60,hoverTipMach,
    diskLoading:hoverThrust/A,idealHoverPowerPerRotor:idealHoverPower,idealHoverPowerTotal:motors*idealHoverPower,
    shaftPowerMaxPerRotor:shaftPowerMax,warnings,
  };
}
