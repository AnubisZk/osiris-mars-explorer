import * as THREE from 'three';
import {createRotorState,stepRotor} from '../aero/rotor.js';
import {Motor} from '../power/motor.js';
import {Battery} from '../power/battery.js';

/**
 * A rotorcraft as one Rapier rigid body driven only by forces and torques:
 *   rotor thrust and in-plane H-force at each hub (blade-element rotor, dynamic inflow),
 *   motor reaction torque on the airframe, hub moment from tip-path-plane tilt (coaxial cyclic),
 *   rotor gyroscopic torque, body drag with Reynolds-dependent cylinder drag.
 * Motors are speed-governed BLDC models fed by the battery model; electrical power comes out.
 *
 * Controls (set by FlightControl or tests):
 *   coax:       {collective, differential, tiltLon, tiltLat} (rad); rotor speed held at rpmRef
 *   multirotor: {omegaRef: [rad/s per rotor]}
 * Body axes: +X right, +Y up, −Z forward.
 */
const RPM=2*Math.PI/60;
// Cylinder drag in cross-flow, White (Fluid Mechanics): Cd ≈ 1 + 10 / Re^(2/3), 1 < Re < 2·10⁵
export const cylinderCd=Re=>1+10/Math.max(1,Re)**(2/3);
const PLATE_CD=1.17,BOX_CD=1.05; // flat plate normal to flow (Hoerner), bluff box (assumed)
const SLEW=400*RPM;

export class RotorcraftVehicle {
  constructor(physics,built,{position=[0,1,0],yaw=0,wind=null,soc=1}={}){
    this.physics=physics;this.built=built;this.spec=built.spec;this.wind=wind??physics.wind;
    const q=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),yaw);
    const footR=Math.max(.012,.03*Math.cbrt(built.mass));
    const [bx,by,bz]=built.spec.layout.body,colliders=[
      ...built.feet.map(f=>({type:'ball',radius:footR,offset:[f[0],f[1]+footR,f[2]],friction:.9,restitution:.05})),
      {type:'cuboid',half:[bx/2,by/2,bz/2],offset:built.bodyBox.center,restitution:.05},
    ];
    this.footClearance=-Math.min(...built.feet.map(f=>f[1])); // CoM height above the ground when standing
    this.handle=physics.addBody({position,rotation:q,mass:built.mass,
      inertia:{x:built.principal.moments[0],y:built.principal.moments[1],z:built.principal.moments[2]},
      inertiaFrame:built.inertiaFrame,colliders,aero:null,name:built.id});
    this.body=this.handle.body;
    this.rotors=built.rotors.map(r=>({...r,state:createRotorState(),motor:new Motor(this.spec.motor,r.rotor.inertia+(this.spec.motor.rotorInertia??0)),
      collective:0,tilt:{lon:0,lat:0},omegaRef:0,thrustVec:new THREE.Vector3(),hubWorld:new THREE.Vector3()}));
    this.battery=new Battery(this.spec.battery,soc);
    this.controls={collective:0,differential:0,tiltLon:0,tiltLat:0,omegaRef:this.rotors.map(()=>0),rpmRef:(this.spec.rpm.nominal??0)*RPM};
    this.armed=false;this.cutoff=false;this.time=0;this.energyWh=0;
    this.atm={};this.out={thrust:0,power:0,shaftPower:0,dragForce:new THREE.Vector3(),groundHeight:null};
    this._q=new THREE.Quaternion();this._qi=new THREE.Quaternion();this._v=new THREE.Vector3();this._w=new THREE.Vector3();
    this._r=new THREE.Vector3();this._a=new THREE.Vector3();this._f=new THREE.Vector3();this._t=new THREE.Vector3();this._h=new THREE.Vector3();
    this._air=new THREE.Vector3();this._p=new THREE.Vector3();
    this.unhook=physics.addForceHook((ph,dt)=>this.update(dt));
  }
  get position(){return this.body.translation();}
  get velocity(){return this.body.linvel();}
  /** Height of the CoM above the ground below it (m), via a ray against static geometry. */
  altitudeAGL(){const p=this.body.translation(),d=this.physics.groundDistance({x:p.x,y:p.y,z:p.z},500);return d==null?null:d;}
  arm(){if(this.battery.depleted)return false;this.armed=true;this.cutoff=false;
    if(this.spec.kind==='coax')for(const r of this.rotors)r.motor.reset(r.motor.omega);return true;}
  disarm(){this.armed=false;for(const r of this.rotors)r.omegaRef=0;}
  update(dt){
    const b=this.body,env=this.physics.environment,pos=b.translation();
    this.time+=dt;
    const s=env.atmosphere(this.physics.altitude(pos.y),this.atm);
    this._q.copy(b.rotation());this._qi.copy(this._q).invert();
    const v=b.linvel(),w=b.angvel();this._w.set(w.x,w.y,w.z);
    if(this.wind?.active)this._air.copy(this.wind.velocity(this.physics.time,pos));else this._air.set(0,0,0);
    this._p.set(pos.x,pos.y,pos.z);
    const gh=this.physics.groundDistance(pos,40);this.out.groundHeight=gh;
    const coax=this.spec.kind==='coax',c=this.controls,bus=this.battery.voltage;
    let thrust=0,shaft=0,elec=0;const gyro=this._h.set(0,0,0);
    for(let i=0;i<this.rotors.length;i++){
      const r=this.rotors[i];
      // commanded rotor speed and pitch
      let omegaRef,collective=0;
      if(coax){
        // soft start: rotor-speed reference slews at ≤ 400 rpm/s (assumed), as a governor would
        r.omegaRef+=Math.max(-SLEW*dt,Math.min(SLEW*dt,c.rpmRef-r.omegaRef));
        omegaRef=this.armed?r.omegaRef:0;collective=c.collective+(i===0?-.5:.5)*c.differential;
      }
      else omegaRef=c.omegaRef[i]??0;
      const live=this.armed&&!this.cutoff;
      const u=live?r.motor.govern(omegaRef,r.state.Q,bus,dt):0;
      elec+=r.motor.step(u,bus,r.state.Q,dt);
      // tip-path-plane tilt (coax cyclic) with first-order flapping lag
      if(coax){
        const fl=this.spec.flapping,k=1-Math.exp(-dt/fl.tau),lim=fl.maxTiltDeg*Math.PI/180;
        r.tilt.lon+=(Math.max(-lim,Math.min(lim,c.tiltLon))-r.tilt.lon)*k;
        r.tilt.lat+=(Math.max(-lim,Math.min(lim,c.tiltLat))-r.tilt.lat)*k;
      }
      // hub kinematics (world): v_hub = v + ω × r − wind
      this._r.set(r.hub[0],r.hub[1],r.hub[2]).applyQuaternion(this._q);
      r.hubWorld.copy(this._r).add(this._p);
      this._v.set(v.x,v.y,v.z).add(this._a.copy(this._w).cross(this._r)).sub(this._air);
      const n=this._a.set(Math.sin(r.tilt.lat),1,-Math.sin(r.tilt.lon)).normalize().applyQuaternion(this._q); // TPP normal
      const vAx=this._v.dot(n);this._f.copy(this._v).addScaledVector(n,-vAx);const vEdge=this._f.length();
      const below=gh==null?Infinity:Math.max(.05,gh+(r.hubWorld.y-pos.y));
      stepRotor(r.rotor,r.state,{omega:r.motor.omega,collective,vAxial:vAx,vEdge,
        extraInflow:coax&&i===1?this.rotors[0].state.vi:0,height:below},s,dt);
      r.collective=collective;
      // thrust along the TPP normal, H-force against the in-plane relative wind
      r.thrustVec.copy(n).multiplyScalar(r.state.T);
      if(vEdge>1e-6)r.thrustVec.addScaledVector(this._f,-r.state.H/vEdge);
      b.addForceAtPoint(r.thrustVec,r.hubWorld,true);
      // airframe reaction to the motor torque, about the shaft axis (body +Y)
      const shaftAxis=this._t.set(0,1,0).applyQuaternion(this._q);
      b.addTorque(this._f.copy(shaftAxis).multiplyScalar(-r.spin*r.motor.torque),true);
      // hingeless hub moment toward the tilted TPP: K_β (shaft × n)
      if(coax){const kb=this.spec.flapping.hubStiffness;b.addTorque(this._f.copy(shaftAxis).cross(n).multiplyScalar(kb),true);}
      gyro.addScaledVector(shaftAxis,r.spin*r.motor.inertia*r.motor.omega);
      thrust+=r.state.T;shaft+=r.state.P;
    }
    // rotor gyroscopic torque on the airframe: −ω × H_rotors
    b.addTorque(this._f.copy(this._w).cross(gyro).multiplyScalar(-1),true);
    // body drag, body axes: F_k = −½ ρ |v| CdA_k v_k, cylinder Cd from the member Reynolds number
    this._v.set(v.x,v.y,v.z).sub(this._air).applyQuaternion(this._qi);
    const speed=this._v.length(),d=this.built.drag;
    if(speed>1e-6){
      const Re=s.density*speed*d.memberDiameter/s.dynamicViscosity,cd=cylinderCd(Re),k=-.5*s.density*speed;
      this._f.set(k*(cd*d.tubes[0]+PLATE_CD*d.plates[0]+BOX_CD*d.boxes[0])*this._v.x,
        k*(cd*d.tubes[1]+PLATE_CD*d.plates[1]+BOX_CD*d.boxes[1])*this._v.y,
        k*(cd*d.tubes[2]+PLATE_CD*d.plates[2]+BOX_CD*d.boxes[2])*this._v.z).applyQuaternion(this._q);
      b.addForce(this._f,true);this.out.dragForce.copy(this._f);
    }else this.out.dragForce.set(0,0,0);
    // electrical system: motors + avionics from the battery
    const total=elec+this.spec.avionicsPower;
    this.battery.draw(total,dt);this.energyWh=this.battery.energyUsedWh;
    if(this.battery.depleted&&this.armed)this.cutoff=true;
    this.out.thrust=thrust;this.out.shaftPower=shaft;this.out.power=total;this.out.density=s.density;this.out.mach=0;
  }
  rpm(i){return this.rotors[i].motor.omega/RPM;}
  dispose(){this.unhook?.();}
}
