import * as THREE from 'three';
import {FLIGHT,clamp} from '../physics/config.js';
import {controlProfile} from '../controllers/ControlProfiles.js';
import {DEFAULT_DRONE} from './DroneTypes.js';

const radians=Math.PI/180;
export class FlightController {
  constructor(drone=DEFAULT_DRONE){
    this.mode='ANGLE';this.maxRate=FLIGHT.maxRate;this.profile='sport';this.drone=drone;this.gain=drone.gain;
    if(drone!==DEFAULT_DRONE){this.maxRate=drone.maxRate;this.mode=drone.modes[0];}
    this.hold=null;this.holdIntegral={x:0,z:0};this.virtual={pitch:0,roll:0,yaw:0};
    this.integral=new THREE.Vector3();this.previousRate=new THREE.Vector3();
    this.derivative=new THREE.Vector3();this.targetRate=new THREE.Vector3();this.torque=new THREE.Vector3();
    this.targetQ=new THREE.Quaternion();this.errorQ=new THREE.Quaternion();this.euler=new THREE.Euler(0,0,0,'YXZ');
    this.forward=new THREE.Vector3();this.up=new THREE.Vector3();this.filtered={pitch:0,roll:0,yaw:0};
  }
  reset(){this.integral.set(0,0,0);this.previousRate.set(0,0,0);this.derivative.set(0,0,0);this.torque.set(0,0,0);this.filtered={pitch:0,roll:0,yaw:0};this.hold=null;this.holdIntegral={x:0,z:0};}
  setMode(mode){if(!this.drone.modes.includes(mode))return;this.mode=mode;this.reset();}
  /** New airframe: PID gains scale with inertia; the type's primary mode is selected (5" → ANGLE, hex → KONUM). */
  setDrone(drone){
    this.drone=drone;this.gain=drone.gain;this.maxRate=drone.maxRate;this.mode=drone.modes[0];
    this.reset();
  }
  /**
   * KONUM (konum tutma): sağ çubuk yatay hız ister; bırakılınca son konum tutulur.
   * Çıktı, ANGLE iç döngüsüne giden sanal çubuk eğimidir: kuvvetler yine motorlardan.
   */
  positionHold(dt,s,q,state){
    const ph=this.drone.posHold,v=state.velocity,p=state.position;
    this.forward.set(0,0,-1).applyQuaternion(q);
    const heading=Math.atan2(-this.forward.x,-this.forward.z);
    const fx=-Math.sin(heading),fz=-Math.cos(heading),rx=Math.cos(heading),rz=-Math.sin(heading);
    const centered=Math.abs(s.pitch)<.04&&Math.abs(s.roll)<.04;
    const speed=Math.hypot(v.x,v.z);
    if(!centered)this.hold=null;
    else if(!this.hold&&speed<.6)this.hold={x:p.x,z:p.z};
    let tx=(s.pitch*fx+s.roll*rx)*ph.maxSpeed,tz=(s.pitch*fz+s.roll*rz)*ph.maxSpeed;
    if(this.hold){tx+=clamp((this.hold.x-p.x)*ph.positionGain,-2,2);tz+=clamp((this.hold.z-p.z)*ph.positionGain,-2,2);}
    const ex=tx-v.x,ez=tz-v.z,I=this.holdIntegral;
    I.x=clamp(I.x+ex*dt*ph.integral,-2.5,2.5);I.z=clamp(I.z+ez*dt*ph.integral,-2.5,2.5);
    let ax=ex*ph.velocityGain+I.x,az=ez*ph.velocityGain+I.z;
    const a=Math.hypot(ax,az);if(a>ph.maxAccel){ax*=ph.maxAccel/a;az*=ph.maxAccel/a;}
    const tilt=ph.tilt*radians,af=ax*fx+az*fz,ar=ax*rx+az*rz;
    this.virtual.pitch=clamp(Math.atan(af/FLIGHT.gravity)/tilt,-1,1);
    this.virtual.roll=clamp(Math.atan(ar/FLIGHT.gravity)/tilt,-1,1);
    this.virtual.yaw=s.yaw;
    return this.virtual;
  }
  rate(v){return this.maxRate*radians*(.5*v+.5*v*v*v);}
  update(dt,input,q,bodyRate,state=null){
    let profile=controlProfile(this.profile);
    for(const axis of ['pitch','roll','yaw']){
      // Gentle ANGLE tilt transitions; retain yaw and ACRO latency.
      const time=this.mode==='ANGLE'&&axis!=='yaw'?profile.angleInputTime:.018;
      this.filtered[axis]+=(input[axis]-this.filtered[axis])*(1-Math.exp(-dt/time));
    }
    let s=this.filtered;
    if(this.mode==='KONUM'&&state){
      s=this.positionHold(dt,s,q,state);
      profile={...profile,angleLimit:this.drone.posHold.tilt,angleYawRate:Math.min(this.maxRate,90)};
    }
    if(this.mode==='ACRO')this.targetRate.set(-this.rate(s.pitch),-this.rate(s.yaw),-this.rate(s.roll));
    else{
      this.forward.set(0,0,-1).applyQuaternion(q);
      const heading=Math.atan2(-this.forward.x,-this.forward.z);
      this.euler.set(-s.pitch*profile.angleLimit*radians,heading,-s.roll*profile.angleLimit*radians,'YXZ');
      this.targetQ.setFromEuler(this.euler);
      this.errorQ.copy(q).invert().multiply(this.targetQ).normalize();
      const sign=this.errorQ.w<0?-1:1;
      const angle=2*Math.acos(clamp(this.errorQ.w*sign,-1,1));
      const sin=Math.sqrt(Math.max(0,1-this.errorQ.w*this.errorQ.w));
      const factor=sin>.0001?sign*angle/sin:2*sign;
      const yawRate=this.rate(s.yaw)*(profile.angleYawRate===null?1:profile.angleYawRate/this.maxRate);
      this.targetRate.set(clamp(this.errorQ.x*factor*7,-6,6),-yawRate,clamp(this.errorQ.z*factor*7,-6,6));
    }
    const alpha=1-Math.exp(-dt/.012);
    for(const axis of ['x','y','z']){
      const error=this.targetRate[axis]-bodyRate[axis];
      this.derivative[axis]+=((bodyRate[axis]-this.previousRate[axis])/dt-this.derivative[axis])*alpha;
      this.previousRate[axis]=bodyRate[axis];
      // Gains scale with airframe inertia (gain 1 = v0.7.0 5" values, identical arithmetic).
      const g=this.gain,p=(axis==='y'?.065:.042)*g,i=(axis==='y'?.075:.065)*g,d=(axis==='y'?.0009:.0007)*g;
      // Bounded integral and conditional integration prevent saturation windup.
      const limit=(axis==='y'?.4:.8)*g;
      const proposed=this.integral[axis]+error*dt;
      const raw=p*error+i*proposed-d*this.derivative[axis];
      if(Math.abs(raw)<limit||Math.sign(error)!==Math.sign(raw))this.integral[axis]=clamp(proposed,-1.5,1.5);
      this.torque[axis]=clamp(p*error+i*this.integral[axis]-d*this.derivative[axis],-limit,limit);
    }
    return this.torque;
  }
}
