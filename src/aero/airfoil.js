/**
 * Airfoil section polars that depend on angle of attack, Reynolds number and Mach number.
 * The rotor model (rotor.js) evaluates these at every blade element, so CT is never a constant:
 * it follows blade geometry, Re (density, viscosity, chord, speed) and Mach (tip speed / a).
 *
 * Model (per section):
 *   lift slope   a(Re, M) = 2π k(Re) / √(1 − M²)        Prandtl–Glauert, k(Re) low-Re reduction
 *   lift         cl = a (α − α0), smoothly blended to a flat plate beyond stall (cl_max(Re))
 *   drag         cd = cd0(Re) + K (cl − cl_md)² + 20 (M − M_crit)⁴ for M > M_crit (Lock's law)
 *   cd0(Re)      cd0_ref (Re_ref / Re)^0.5, never below cd0_floor   (laminar, Blasius-like trend)
 * Anchors and shape constants are listed per airfoil with their status.
 */
export const AIRFOILS=Object.freeze({
  // Mars rotor section in the spirit of the Ingenuity clf5605. The anchor is the published point:
  // Re = 20 000, M = 0.6 → peak cl/cd = 19.90 at cl = 0.91, α = 2.5° (NASA Ames, MarsHeliCapabilities, Table 1).
  // cl_md, K split, k(Re) and stall values are assumed; α0 follows from the anchor.
  'clf5605-like':Object.freeze({
    id:'clf5605-like',label:{en:'Mars rotor airfoil (clf5605-like)',tr:'Mars rotor profili (clf5605 benzeri)'},
    anchor:{Re:2e4,M:.6,clStar:.91,ldMax:19.9,alphaStarDeg:2.5},clMd:.4,kRef:.7,
    clMaxRef:1.3,clMaxSlope:.12,mCrit:.74,cd0Floor:.008,stallBlendDeg:10,
    // Lumped profile-loss factor on section drag, calibrated so the Ingenuity-class coaxial rotor
    // needs the published ~350 W electrical hover power (JPL press kit) at 1.8 kg, 2537 rpm,
    // ρ = 0.0165 kg/m³, with assumed motor efficiency 0.8 and 20 W avionics. Uncalibrated
    // section polar = 1 (gives ≈ 200 W). It absorbs non-uniform inflow, swirl, root/hub and
    // rotor–rotor losses the uniform-inflow model leaves out (tests/aero-rotor.test.js).
    lossFactor:3.0,lossFactorStatus:'calibrated',
    status:'sourced anchor + assumed shape',source:'nasaMarsHeliCapabilities',
  }),
  // Generic thin cambered propeller section for Earth FPV propellers (all values assumed).
  'thin-cambered-prop':Object.freeze({
    id:'thin-cambered-prop',label:{en:'Thin cambered propeller section',tr:'İnce kamburlu pervane kesiti'},
    anchor:{Re:1e5,M:.3,clStar:.85,ldMax:45,alphaStarDeg:3.5},clMd:.4,kRef:.85,
    clMaxRef:1.35,clMaxSlope:.1,mCrit:.72,cd0Floor:.007,stallBlendDeg:14,
    status:'assumed',source:null,
  }),
});

const TWO_PI=2*Math.PI,RAD=Math.PI/180;
const resolved=new Map();
/** Derived constants from the anchor: cd0_ref and K from the peak-L/D condition, α0 from cl*. */
export function airfoilData(id){
  if(resolved.has(id))return resolved.get(id);
  const af=AIRFOILS[id];if(!af)throw new RangeError(`Unknown airfoil '${id}'`);
  const {Re,M,clStar,ldMax,alphaStarDeg}=af.anchor,c=clStar,m=af.clMd;
  // cd = cd0 + K (cl − m)²; at the L/D peak cd = cl dcd/dcl → cd0 = K (cl − m)(cl + m)
  const K=(clStar/ldMax)/((c-m)*(c+m)+(c-m)**2),cd0Ref=K*(c-m)*(c+m);
  const beta=Math.sqrt(1-M*M),slope=TWO_PI*af.kRef/beta;
  const alpha0=alphaStarDeg*RAD-clStar/slope;
  const d=Object.freeze({...af,K,cd0Ref,ReRef:Re,alpha0});
  resolved.set(id,d);return d;
}
/** Low-Re lift-slope factor k(Re): kRef at the anchor Re, +0.15 per 1.7 decades, limited to [kRef−0.06, 0.95]. */
export function liftSlopeFactor(af,Re){
  const x=Math.log10(Math.max(Re,1)/af.ReRef)/1.699;
  return Math.min(.95,Math.max(af.kRef-.06,af.kRef+.15*x));
}
export function clMax(af,Re){return af.clMaxRef+af.clMaxSlope*Math.log10(Math.max(Re,1e3)/af.ReRef);}

/**
 * Section coefficients. `af` from airfoilData(); writes {cl, cd, stalled} into `out`.
 * α in radians (any range), Re ≥ 0, M ≥ 0.
 */
export function polar(af,alpha,Re,M,out){
  const Mc=Math.min(M,.95),beta=Math.sqrt(1-Mc*Mc);
  const a=TWO_PI*liftSlopeFactor(af,Re)/beta;
  const clLin=a*(alpha-af.alpha0);
  const cmax=clMax(af,Re),cmin=-.6*cmax;
  const cd0=Math.max(af.cd0Floor,af.cd0Ref*Math.sqrt(af.ReRef/Math.max(Re,500)));
  const wave=M>af.mCrit?20*(M-af.mCrit)**4:0;
  // attached-flow values
  const clAtt=Math.max(cmin,Math.min(cmax,clLin));
  const cdAtt=cd0+af.K*(clAtt-af.clMd)**2+wave;
  // beyond stall: soft stall (thin low-Re sections), blended over stallBlendDeg of excess angle to a
  // flat plate (cl = 2 sin α cos α, cd = 2 sin²α + cd0). Shape assumed.
  const excess=clLin>cmax?(clLin-cmax)/a:clLin<cmin?(cmin-clLin)/a:0;
  if(excess<=0){out.cl=clAtt;out.cd=cdAtt;out.stalled=false;return out;}
  const t=Math.min(1,excess/(af.stallBlendDeg*RAD)),w=t*t*(3-2*t),s=Math.sin(alpha),c=Math.cos(alpha);
  out.cl=(1-w)*clAtt+w*2*s*c;out.cd=(1-w)*(cdAtt+.5*excess*excess)+w*(2*s*s+cd0);out.stalled=true;
  return out;
}
