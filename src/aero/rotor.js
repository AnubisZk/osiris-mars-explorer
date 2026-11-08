import {airfoilData,polar} from './airfoil.js';

/**
 * Rotor / propeller aerodynamics: blade-element theory with uniform momentum inflow.
 *
 *  - Blade elements: local chord, twist, airfoil polar at the element's Reynolds and Mach number,
 *    so thrust and torque coefficients follow geometry, density, viscosity and tip speed.
 *  - Inflow: uniform; Glauert momentum theory for climb and edgewise flow, the empirical
 *    vortex-ring curve for slow descent, windmill branch beyond it (Leishman, Principles of
 *    Helicopter Aerodynamics, ch. 2–3).
 *  - Prandtl tip loss: lift integrated to B·R, B = 1 − √(2 CT) / N.
 *  - Ground effect: induced inflow × (1 − (R / 4z)²), Cheeseman & Bennett (valid z ≥ 0.5 R).
 *  - Coaxial pairs: the lower rotor also sees δ × the upper rotor's induced velocity (δ assumed).
 * Cyclic pitch is not resolved per element; vehicles tilt the thrust vector (tip-path plane).
 *
 * Conventions: thrust along the rotor axis; vAxial = rotor velocity relative to the air along
 * that axis (climb > 0); vEdge = in-plane relative speed; Q is the aerodynamic torque the shaft
 * must supply. Rotorcraft coefficients: CT = T / (ρ A (ΩR)²), CQ = Q / (ρ A (ΩR)² R).
 */
const RAD=Math.PI/180;

/** Piecewise-linear table lookup, [[x, y], …] sorted by x, clamped at the ends. */
export function lookup(table,x){
  if(x<=table[0][0])return table[0][1];
  for(let i=1;i<table.length;i++)if(x<=table[i][0]){const [x0,y0]=table[i-1],[x1,y1]=table[i];return y0+(y1-y0)*(x-x0)/(x1-x0);}
  return table[table.length-1][1];
}

/**
 * Rotor geometry. spec: {id, radius, blades, root (r/R), chord: m | [[r/R, c/R]], twist: [[r/R, deg]]
 * (variable pitch: collective is added) or pitch: m (fixed-pitch propeller), airfoil, stations,
 * inertia (kg·m², about the shaft), sources}.
 */
export function defineRotor(spec){
  const R=spec.radius,N=spec.blades,root=spec.root??.15,n=spec.stations??12,af=airfoilData(spec.airfoil);
  if(!(R>0&&N>=1&&root>=0&&root<1))throw new RangeError(`Invalid rotor geometry '${spec.id}'`);
  const stations=[];let bladeArea=0,thrustWeighted=0,weight=0;
  for(let j=0;j<n;j++){
    const x=root+(1-root)*(j+.5)/n,dx=(1-root)/n,r=x*R,dr=dx*R;
    const c=typeof spec.chord==='number'?spec.chord:lookup(spec.chord,x)*R;
    const theta=spec.pitch!=null?Math.atan(spec.pitch/(2*Math.PI*r)):lookup(spec.twist,x)*RAD;
    stations.push(Object.freeze({x,r,dr,c,theta}));
    bladeArea+=c*dr;thrustWeighted+=c*x*x*dx;weight+=x*x*dx;
  }
  const A=Math.PI*R*R;
  return Object.freeze({...spec,root,stations:Object.freeze(stations),af,disk:A,
    bladeArea,solidity:N*bladeArea/A,
    // thrust-weighted solidity (as in NASA geometry tables): ∫ c r² dr weighting
    solidityThrustWeighted:N*(thrustWeighted/weight)/(Math.PI*R),
    fixedPitch:spec.pitch!=null});
}

const scratch={cl:0,cd:0,stalled:false};
export function createRotorState(){return {lambdaI:.02,tipB:.97,T:0,Q:0,H:0,P:0,vi:0,CT:0,CQ:0,iterations:0,converged:true,stalledFraction:0};}

/** One blade-element pass at a given induced inflow ratio; writes T, Q, H, stalledFraction. */
function bladePass(rotor,st,omega,coll,vEdge,lUp,B,atm){
  const R=rotor.radius,N=rotor.blades,rho=atm.density,a=atm.speedOfSound,mu=atm.dynamicViscosity;
  const muAdv=vEdge/(omega*R),npsi=muAdv<.005?1:muAdv<.1?4:8,drag=rotor.dragFactor??rotor.af.lossFactor??1;
  let T=0,Q=0,H=0,stalled=0;
  for(let k=0;k<npsi;k++){
    const sp=npsi>1?Math.sin((k+.5)*2*Math.PI/npsi):0;
    for(const s of rotor.stations){
      const UT=omega*s.r+vEdge*sp;if(UT<=0)continue;
      const phi=Math.atan2(lUp,UT),U2=UT*UT+lUp*lUp,U=Math.sqrt(U2);
      polar(rotor.af,s.theta+coll-phi,rho*U*s.c/mu,U/a,scratch);if(scratch.stalled)stalled++;
      const q=.5*rho*U2*s.c*s.dr,lift=s.x<=B?q*scratch.cl:0,dr=q*scratch.cd*drag;
      const cp=Math.cos(phi),sn=Math.sin(phi),inPlane=lift*sn+dr*cp;
      T+=lift*cp-dr*sn;Q+=inPlane*s.r;H+=inPlane*sp;
    }
  }
  st.T=T*N/npsi;st.Q=Q*N/npsi;st.H=H*N/npsi;st.stalledFraction=stalled/(npsi*rotor.stations.length);
  return st;
}
/** Momentum-theory equilibrium of the induced inflow ratio for a given CT (and its time scale). */
function inflowTarget(CT,muAdv,lc,li){
  if(CT<=0)return 0;
  if(muAdv<.05&&lc<0){
    // axial descent: momentum branch, empirical vortex-ring curve, windmill branch
    const lh=Math.sqrt(CT/2),x=lc/lh;
    return x>=0?lh*(-x/2+Math.sqrt(x*x/4+1))
      :x>=-2?lh*Math.max(.05,1-1.125*x-1.372*x*x-1.718*x**3-.655*x**4)
      :lh*(-x/2-Math.sqrt(x*x/4-1));
  }
  return CT/(2*Math.sqrt(muAdv*muAdv+(lc+li)**2));
}
function prepare(rotor,inp){
  const omega=inp.omega,R=rotor.radius,VT=omega*R,vEdge=Math.max(0,inp.vEdge??0);
  const h=inp.height??Infinity,ge=h>=.5*R?Math.max(0,1-(R/(4*h))**2):.75;
  // extraInflow (coaxial lower rotor in the upper wake) acts like an axial climb inflow: it enters the blade
  // elements and the momentum balance, so the lower rotor's own induced velocity is reduced accordingly.
  return {omega,VT,vEdge,muAdv:vEdge/VT,lc:((inp.vAxial??0)+(inp.extraInflow??0))/VT,lx:0,ge,coll:rotor.fixedPitch?0:(inp.collective??0)+(rotor.pitchOffset??0)*RAD};
}
function finish(rotor,state,c,atm){
  const denom=atm.density*rotor.disk*c.VT*c.VT;
  state.P=state.Q*c.omega;state.vi=state.lambdaI*c.ge*c.VT;state.CT=state.T/denom;state.CQ=state.Q/(denom*rotor.radius);
  return state;
}
const zero=state=>{state.T=state.Q=state.H=state.P=state.vi=state.CT=state.CQ=0;state.stalledFraction=0;return state;};

/**
 * Converged (quasi-static) evaluation of one rotor. inp: {omega (rad/s), collective (rad), vAxial,
 * vEdge, extraInflow (m/s), height (m above ground, Infinity = out of ground effect)};
 * atm: {density, speedOfSound, dynamicViscosity}. Writes into `state` (also the warm start).
 */
export function evaluateRotor(rotor,state,inp,atm){
  if(!(inp.omega>1))return zero(state);
  const c=prepare(rotor,inp),denom=atm.density*rotor.disk*c.VT*c.VT;
  // g(λ) = λ − λ_momentum(CT_BET(λ)) is increasing in λ: solve by bisection (robust for any
  // solidity or stall state), after bracketing; tip-loss factor follows CT at each trial.
  let B=.97;
  const g=li=>{
    bladePass(rotor,state,c.omega,c.coll,c.vEdge,(c.lc+li*c.ge)*c.VT,B,atm);
    const CT=state.T/denom;B=CT>0?Math.max(.9,1-Math.sqrt(2*CT)/rotor.blades):1;
    return li-inflowTarget(CT,c.muAdv,c.lc,li);
  };
  let lo=0,hi=.08;
  if(g(lo)>0){hi=lo;lo=-.3;}
  else for(let k=0;k<8&&g(hi)<0;k++){lo=hi;hi*=2;}
  let iter=0;
  for(;iter<40&&hi-lo>1e-7;iter++){const m=.5*(lo+hi);if(g(m)>0)hi=m;else lo=m;}
  const li=.5*(lo+hi);g(li);
  state.lambdaI=li;state.tipB=B;state.iterations=iter;state.converged=hi-lo<=1e-6;
  return finish(rotor,state,c,atm);
}

/**
 * Real-time step with dynamic inflow: one blade-element pass at the current inflow, then the
 * uniform inflow relaxes toward its momentum value with the apparent-mass time constant
 * τ = 4 / (3π Ω λ_total) (Pitt–Peters uniform mode), integrated exactly (stable for any dt).
 */
export function stepRotor(rotor,state,inp,atm,dt){
  if(!(inp.omega>1)){state.lambdaI=0;return zero(state);}
  const c=prepare(rotor,inp),denom=atm.density*rotor.disk*c.VT*c.VT;
  let li=Number.isFinite(state.lambdaI)?state.lambdaI:0;
  const B=state.tipB??.97;
  bladePass(rotor,state,c.omega,c.coll,c.vEdge,(c.lc+li*c.ge+c.lx)*c.VT,B,atm);
  const CT=state.T/denom;state.tipB=CT>0?Math.max(.9,1-Math.sqrt(2*CT)/rotor.blades):1;
  const target=inflowTarget(CT,c.muAdv,c.lc,li),lt=Math.max(.01,Math.sqrt(c.muAdv*c.muAdv+(c.lc+li)**2));
  const tau=4/(3*Math.PI*c.omega*lt);
  li=target+(li-target)*Math.exp(-dt/tau);
  state.lambdaI=li;state.iterations=1;state.converged=true;
  return finish(rotor,state,c,atm);
}

/** Ideal-to-actual power ratio in hover, FM = CT^1.5 / (√2 CQ) (CP = CQ in rotorcraft form). */
/** Same geometry with a different lumped profile-loss factor (1 = uncalibrated section polar). */
export function withDragFactor(rotor,factor){const {stations,af,disk,bladeArea,solidity,solidityThrustWeighted,fixedPitch,...spec}=rotor;return defineRotor({...spec,dragFactor:factor});}
export function figureOfMerit(state){return state.CQ>0&&state.CT>0?state.CT**1.5/(Math.SQRT2*state.CQ):0;}

/** Collective (rad) that gives thrust T at speed omega; null if outside [lo, hi]. */
export function solveCollective(rotor,omega,thrust,atm,flow={},lo=-8*RAD,hi=30*RAD){
  const st=createRotorState(),f=th=>evaluateRotor(rotor,st,{...flow,omega,collective:th},atm).T-thrust;
  if(f(lo)>0||f(hi)<0)return null;
  for(let i=0;i<50;i++){const m=.5*(lo+hi);if(f(m)>0)hi=m;else lo=m;}
  return .5*(lo+hi);
}
/** Rotor speed (rad/s) that gives thrust T at a fixed collective; null if not reachable below omegaMax. */
export function solveSpeed(rotor,thrust,atm,omegaMax,flow={},collective=0){
  const st=createRotorState(),f=w=>evaluateRotor(rotor,st,{...flow,omega:w,collective},atm).T-thrust;
  if(f(omegaMax)<0)return null;
  let lo=0,hi=omegaMax;
  for(let i=0;i<50;i++){const m=.5*(lo+hi);if(f(m)>0)hi=m;else lo=m;}
  return .5*(lo+hi);
}
/**
 * Coaxial pair: upper rotor first, the lower rotor adds δ × upper induced velocity.
 * Returns {upper, lower} states; inputs per rotor {omega, collective}; shared flow.
 */
export function evaluateCoaxial(upper,lower,su,sl,inU,inL,flow,atm,delta=1){
  evaluateRotor(upper,su,{...flow,...inU},atm);
  evaluateRotor(lower,sl,{...flow,...inL,extraInflow:delta*su.vi},atm);
  return {upper:su,lower:sl};
}

/**
 * Coaxial hover/axial trim: common collective for total thrust and differential collective
 * (lower − upper) for zero net torque. Returns {collective, differential, upper, lower} or null.
 */
export function trimCoaxial(upper,lower,omega,thrust,atm,flow={},delta=1){
  const su=createRotorState(),sl=createRotorState();
  const solve=(coll)=>{
    let lo=-8*RAD,hi=8*RAD;
    for(let i=0;i<26;i++){
      const d=.5*(lo+hi);evaluateCoaxial(upper,lower,su,sl,{omega,collective:coll-d/2},{omega,collective:coll+d/2},flow,atm,delta);
      if(sl.Q>su.Q)hi=d;else lo=d;
    }
    const d=.5*(lo+hi);evaluateCoaxial(upper,lower,su,sl,{omega,collective:coll-d/2},{omega,collective:coll+d/2},flow,atm,delta);
    return d;
  };
  let lo=-8*RAD,hi=25*RAD,d=0;
  for(let i=0;i<30;i++){const m=.5*(lo+hi);d=solve(m);if(su.T+sl.T>thrust)hi=m;else lo=m;}
  const coll=.5*(lo+hi);d=solve(coll);
  if(Math.abs(su.T+sl.T-thrust)>.01*thrust)return null;
  return {collective:coll,differential:d,upper:{...su},lower:{...sl},power:su.P+sl.P};
}
