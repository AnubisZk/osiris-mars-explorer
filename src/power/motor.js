/**
 * Brushless DC motor with a speed-regulating controller (ESC / rotor-speed governor).
 *
 *   back-EMF  e = ω / Kv          (Kv in rad/s per volt)
 *   current   i = (u·V_bus − e) / R, limited to [0, i_max] (no regeneration)
 *   torque    τ = Kt (i − i0),    Kt = 1 / Kv
 *   rotor     J dω/dt = τ − Q_aero
 * The speed equation is integrated semi-implicitly (back-EMF implicit), so the electrical-
 * mechanical time constant J R Kv² may be shorter than the step. In thin air Q_aero is small, so
 * the same motor spins closer to its no-load speed: density changes the speed range by itself.
 * Electrical power drawn from the bus: P = u·V_bus·i / η_esc.
 */
export const RPM_PER_VOLT_TO_SI=2*Math.PI/60;

export function defineMotor(spec){
  const kv=spec.kv*RPM_PER_VOLT_TO_SI;
  if(!(kv>0&&spec.resistance>0))throw new RangeError(`Invalid motor '${spec.id}'`);
  return Object.freeze({escEfficiency:.95,noLoadCurrent:.5,maxCurrent:40,gearRatio:1,...spec,kvSI:kv,kt:1/kv});
}

export class Motor {
  /** `inertia` = rotor + motor inertia about the shaft (kg·m²). */
  constructor(spec,inertia){
    this.spec=spec;this.inertia=inertia;this.omega=0;this.current=0;this.throttle=0;this.power=0;this.torque=0;
    this.integral=0;this.saturated=false;
  }
  reset(omega=0){this.omega=omega;this.current=0;this.throttle=0;this.power=0;this.integral=0;}
  /** Steady-state throttle that holds ω against load torque Q at bus voltage V. */
  feedForward(omega,load,busVoltage){
    const m=this.spec,i=load/m.kt+m.noLoadCurrent;
    return (omega/m.kvSI+i*m.resistance)/Math.max(busVoltage,1e-6);
  }
  /**
   * Speed governor: PI on rotor speed plus feed-forward; returns throttle u ∈ [0, 1].
   * Gains are per unit of the motor's own time scale, so one tuning serves all sizes.
   */
  govern(omegaRef,load,busVoltage,dt){
    const m=this.spec,err=omegaRef-this.omega,scale=1/(m.kvSI*Math.max(busVoltage,1e-6));
    const ff=this.feedForward(omegaRef,load,busVoltage);
    const kp=(m.speedGain??4)*scale,ki=(m.speedIntegral??20)*scale;
    let u=ff+kp*err+this.integral;
    // conditional integration (no wind-up while saturated or current-limited)
    if(u>0&&u<1&&this.current<m.maxCurrent*.98)this.integral+=ki*err*dt;
    this.integral=Math.max(-.2,Math.min(.2,this.integral));
    u=Math.max(0,Math.min(1,u));this.saturated=u>=1;
    return u;
  }
  /** Advance one step with throttle u, bus voltage and aerodynamic load torque Q (N·m). */
  step(u,busVoltage,load,dt){
    const m=this.spec,R=m.resistance,kt=m.kt,kv=m.kvSI,J=this.inertia,V=Math.max(0,u)*busVoltage;
    // implicit in the back-EMF term: J (ω' − ω)/dt = kt ((V − ω'/kv)/R − i0) − Q
    let omega=(this.omega+dt/J*(kt*(V/R-m.noLoadCurrent)-load))/(1+dt*kt/(kv*R*J));
    let i=(V-omega/kv)/R;
    if(i<0||i>m.maxCurrent){
      i=Math.max(0,Math.min(m.maxCurrent,i));
      omega=this.omega+dt/J*(kt*Math.max(0,i-m.noLoadCurrent)-load);
    }
    if(omega<0)omega=0;
    this.omega=omega;this.current=i;this.throttle=u;this.torque=kt*Math.max(0,i-m.noLoadCurrent);
    this.power=V*i/m.escEfficiency;
    return this.power;
  }
}
