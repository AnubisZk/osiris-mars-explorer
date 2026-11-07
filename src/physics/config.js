export const FLIGHT = Object.freeze({
  mass: 0.65, gravity: 9.81, diagonal: 0.225, propDiameter: 0.127,
  maxMotorThrust: 1.55 * 9.81, motorTimeConstant: 0.03,
  maxMotorOmega: 2600, reactionArm: 0.018,
  inertia: {x:0.0035,y:0.006,z:0.0035},
  fixedDt: 1/240, cameraTilt: 25, maxAngle: 55, maxRate: 670,
  crashImpulse: 1.8, respawnSeconds: 1.5,
});
const a=FLIGHT.diagonal/(2*Math.sqrt(2));
// Body axes: +X right, +Y up, -Z forward. Spin is body reaction torque sign.
export const MOTORS=Object.freeze([
  {x:-a,z:-a,spin:1}, {x:a,z:-a,spin:-1},
  {x:-a,z:a,spin:-1}, {x:a,z:a,spin:1},
]);
export const HOVER=FLIGHT.mass*FLIGHT.gravity/(4*FLIGHT.maxMotorThrust);
export const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));

/**
 * Thrust-linear collective. Differential desaturation preserves torque ratios.
 * `drone` (DroneTypes) selects the motor layout; without it the v0.7.0 quad is used.
 * Symmetric layouts (X quad, hex) share Σx² = Σz², so one denominator serves pitch and roll.
 */
export function mixMotors(throttle,torque,out=new Float64Array(4),drone=null){
  const motors=drone?.motors??MOTORS,n=motors.length,maxThrust=drone?.maxMotorThrust??FLIGHT.maxMotorThrust;
  const mixDenom=drone?.mixDenom??4*a*a,yawDenom=drone?.yawDenom??4*FLIGHT.reactionArm;
  let lo=Infinity,hi=-Infinity;
  for(let i=0;i<n;i++){
    const m=motors[i];
    out[i]=(-m.z*torque.x+m.x*torque.z)/mixDenom+m.spin*torque.y/yawDenom;
    lo=Math.min(lo,out[i]);hi=Math.max(hi,out[i]);
  }
  const idle=drone?.idle??.06,room=maxThrust-idle;
  const scale=hi-lo>room?room/(hi-lo):1;
  const base=clamp(throttle*maxThrust,idle-lo*scale,maxThrust-hi*scale);
  for(let i=0;i<n;i++)out[i]=base+out[i]*scale;
  return out;
}

export class FixedStepper {
  constructor(){this.accumulator=0;this.droppedTime=0;}
  advance(dt,step){
    const accepted=Math.min(Math.max(dt,0),.1);
    this.droppedTime+=Math.max(0,dt-accepted);this.accumulator+=accepted;
    while(this.accumulator+1e-12>=FLIGHT.fixedDt){step(FLIGHT.fixedDt);this.accumulator-=FLIGHT.fixedDt;}
    return Math.max(0,this.accumulator/FLIGHT.fixedDt);
  }
  reset(){this.accumulator=0;}
}
