import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import {FLIGHT} from '../physics/config.js';
import {PlanetEnvironment} from './PlanetEnvironment.js';

/**
 * MarsPhysics / PlanetPhysics: a Rapier world whose gravity comes from the selected planet,
 * with aerodynamic forces computed from the local atmosphere and applied to the rigid bodies
 * as forces and torques every fixed step. Positions and velocities are never written.
 *
 * Aerodynamic model (Phase 1, documented limits):
 *   F = −½ ρ |v_rel| (CdA_x v_x, CdA_y v_y, CdA_z v_z)   in body axes, v_rel = v − wind
 *   τ = −½ ρ |ω| (C_R,x ω_x, C_R,y ω_y, C_R,z ω_z)
 * Applied at the centre of mass (no aerodynamic pitching moment yet). CdA (m²) and C_R (m⁵)
 * are vehicle parameters; Cd itself depends on Reynolds number, which Phase 2 adds for rotors.
 *
 * World axes as in the flight core: +Y up, north = −Z, east = +X.
 * Altitude for the atmosphere = siteElevation + y (metres above the profile's reference level).
 */
const triple=v=>Array.isArray(v)?v:[v,v,v];

export class PlanetPhysics {
  constructor(environment,{fixedDt=FLIGHT.fixedDt,siteElevation=0,wind=null,solverIterations=8}={}){
    if(!(environment instanceof PlanetEnvironment))throw new TypeError('PlanetPhysics needs a PlanetEnvironment');
    if(!(fixedDt>0&&fixedDt<=.05))throw new RangeError('fixedDt must be in (0, 0.05] s');
    this.environment=environment;this.fixedDt=fixedDt;this.siteElevation=siteElevation;this.wind=wind;
    this.world=new RAPIER.World({x:0,y:-environment.gravity,z:0});
    this.world.timestep=fixedDt;this.world.integrationParameters.numSolverIterations=solverIterations;
    this.queue=new RAPIER.EventQueue(true);
    this.bodies=[];this.byCollider=new Map();this.hooks=[];
    this.time=0;this.steps=0;this.accumulator=0;this.droppedTime=0;
    this.atm={};this.q=new THREE.Quaternion();this.qi=new THREE.Quaternion();
    this.v=new THREE.Vector3();this.w=new THREE.Vector3();this.f=new THREE.Vector3();this.air=new THREE.Vector3();
  }
  get gravity(){return this.environment.gravity;}
  /** Planet switch: gravity and atmosphere follow at the next step. */
  setEnvironment(environment){
    if(!(environment instanceof PlanetEnvironment))throw new TypeError('setEnvironment needs a PlanetEnvironment');
    this.environment=environment;this.world.gravity={x:0,y:-environment.gravity,z:0};
  }
  altitude(y){return this.siteElevation+y;}
  /** Static ground slab whose top surface is at y. */
  addGround({y=0,half=[500,.5,500],friction=.7,restitution=0}={}){
    return this.world.createCollider(RAPIER.ColliderDesc.cuboid(...half).setTranslation(0,y-half[1],0)
      .setFriction(friction).setRestitution(restitution).setCollisionGroups(0x00010002));
  }
  addBox(position,halfSize,rotation={x:0,y:0,z:0,w:1}){
    return this.world.createCollider(RAPIER.ColliderDesc.cuboid(...halfSize).setTranslation(...position).setRotation(rotation).setFriction(.7).setCollisionGroups(0x00010002));
  }
  addBall(position,radius){
    return this.world.createCollider(RAPIER.ColliderDesc.ball(radius).setTranslation(...position).setFriction(.8).setCollisionGroups(0x00010002));
  }
  /**
   * Terrain as a Rapier heightfield: `heights` (Float32Array, (nx+1)·(nz+1), row-major in x then z…
   * Rapier expects column-major: index = i·(nz+1)+j for x-index i and z-index j), cell spacing in m.
   */
  addHeightfield(nx,nz,heights,size,center=[0,0,0]){
    const desc=RAPIER.ColliderDesc.heightfield(nz,nx,heights,{x:size[0],y:1,z:size[1]}).setTranslation(...center).setFriction(.8).setCollisionGroups(0x00010002);
    return this.world.createCollider(desc);
  }
  /** Distance straight down from a point to the first static surface (null if none within maxDist). */
  groundDistance(p,maxDist=50){
    const ray=new RAPIER.Ray({x:p.x,y:p.y,z:p.z},{x:0,y:-1,z:0});
    const hit=this.world.castRay(ray,maxDist,true,RAPIER.QueryFilterFlags.EXCLUDE_DYNAMIC|RAPIER.QueryFilterFlags.EXCLUDE_SENSORS);
    return hit?hit.timeOfImpact:null;
  }
  /**
   * Dynamic body. `mass` (kg) and principal `inertia` {x,y,z} (kg·m²) are given explicitly;
   * the collider only provides shape. `aero` {cdA, rotationalDrag} or null for vacuum behaviour.
   */
  addBody({position=[0,0,0],rotation={x:0,y:0,z:0,w:1},velocity=[0,0,0],angularVelocity=[0,0,0],
    mass,inertia,inertiaFrame={x:0,y:0,z:0,w:1},shape={type:'cuboid',half:[.1,.1,.1]},colliders=null,
    aero=null,friction=.6,restitution=.1,ccd=true,name='body'}){
    if(!(mass>0))throw new RangeError('mass must be > 0 kg');
    const I=inertia??{x:mass*.01,y:mass*.01,z:mass*.01};
    const body=this.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setCanSleep(false).setCcdEnabled(ccd)
      .setTranslation(...position).setRotation(rotation).setLinvel(...velocity).setAngvel({x:angularVelocity[0],y:angularVelocity[1],z:angularVelocity[2]})
      .setAdditionalMassProperties(mass,{x:0,y:0,z:0},I,inertiaFrame));
    // One or more mass-less collider shapes (e.g. landing feet + fuselage); mass comes from `mass`/`inertia`
    const shapes=colliders??[{...shape,offset:[0,0,0]}],list=[];
    for(const sh of shapes){
      const desc=sh.type==='ball'?RAPIER.ColliderDesc.ball(sh.radius):RAPIER.ColliderDesc.cuboid(...sh.half);
      const o=sh.offset??[0,0,0];
      list.push(this.world.createCollider(desc.setDensity(0).setTranslation(o[0],o[1],o[2]).setFriction(sh.friction??friction).setRestitution(sh.restitution??restitution)
        .setCollisionGroups(0x00020001).setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS).setContactForceEventThreshold(0),body));
    }
    const collider=list[0];
    body.recomputeMassPropertiesFromColliders();
    const handle={name,body,collider,colliders:list,mass,inertia:I,
      aero:aero?{cdA:triple(aero.cdA??0),rotationalDrag:triple(aero.rotationalDrag??0)}:null,
      aeroForce:new THREE.Vector3(),aeroTorque:new THREE.Vector3(),aeroWork:0,
      density:0,airspeed:0,dynamicPressure:0,contactForce:0,
      _x0:new THREE.Vector3(),_w0:new THREE.Vector3()};
    this.bodies.push(handle);for(const c of list)this.byCollider.set(c.handle,handle);return handle;
  }
  /** Extra per-step forces (e.g. rotors in later phases): fn(physics, dt) after aero, before the Rapier step. */
  addForceHook(fn,{first=false}={}){first?this.hooks.unshift(fn):this.hooks.push(fn);return()=>{this.hooks=this.hooks.filter(h=>h!==fn);};}
  applyAerodynamics(h){
    const b=h.body,t=b.translation();
    const s=this.environment.atmosphere(this.altitude(t.y),this.atm),rho=s.density;
    this.q.copy(b.rotation());this.qi.copy(this.q).invert();
    this.v.copy(b.linvel());
    if(this.wind?.active){this.air.copy(this.wind.velocity(this.time,t));this.v.sub(this.air);}
    this.v.applyQuaternion(this.qi);
    const speed=this.v.length(),k=-.5*rho*speed,[cx,cy,cz]=h.aero.cdA;
    this.f.set(k*cx*this.v.x,k*cy*this.v.y,k*cz*this.v.z).applyQuaternion(this.q);
    h.aeroForce.copy(this.f);b.addForce(this.f,true);
    this.w.copy(b.angvel()).applyQuaternion(this.qi);
    const spin=this.w.length(),kr=-.5*rho*spin,[rx,ry,rz]=h.aero.rotationalDrag;
    this.f.set(kr*rx*this.w.x,kr*ry*this.w.y,kr*rz*this.w.z).applyQuaternion(this.q);
    h.aeroTorque.copy(this.f);b.addTorque(this.f,true);
    h.density=rho;h.airspeed=speed;h.dynamicPressure=.5*rho*speed*speed;
  }
  /** One fixed step of `fixedDt`. */
  step(){
    const dt=this.fixedDt;this.time+=dt;
    for(const h of this.bodies){
      h.body.resetForces(true);h.body.resetTorques(true);h.contactForce=0;
      h._x0.copy(h.body.translation());h._w0.copy(h.body.angvel());
      if(h.aero)this.applyAerodynamics(h);else{h.aeroForce.set(0,0,0);h.aeroTorque.set(0,0,0);}
    }
    for(const fn of this.hooks)fn(this,dt);
    this.world.step(this.queue);
    this.queue.drainContactForceEvents(e=>{
      const a=this.byCollider.get(e.collider1()),b=this.byCollider.get(e.collider2()),F=e.totalForceMagnitude();
      if(a)a.contactForce+=F;if(b)b.contactForce+=F;
    });
    for(const h of this.bodies){
      // Work done by the aerodynamic force this step, J. The force is constant during the step
      // (also across Rapier's internal substeps), so F·Δx is exact; the torque term uses ω trapezoid.
      const x1=h.body.translation(),w1=h.body.angvel(),F=h.aeroForce,T=h.aeroTorque;
      h.aeroWork+=F.x*(x1.x-h._x0.x)+F.y*(x1.y-h._x0.y)+F.z*(x1.z-h._x0.z)
        +.5*dt*(T.x*(h._w0.x+w1.x)+T.y*(h._w0.y+w1.y)+T.z*(h._w0.z+w1.z));
    }
    this.steps++;
  }
  /**
   * Render-loop entry: advances whole fixed steps for a frame of `frameDt` seconds and returns
   * the interpolation factor (0…1) for drawing between the previous and current state.
   * Frames longer than 0.1 s are clipped (counted in droppedTime) so a stall cannot explode.
   */
  advance(frameDt,onStep=null){
    const accepted=Math.min(Math.max(frameDt,0),.1);
    this.droppedTime+=Math.max(0,frameDt-accepted);this.accumulator+=accepted;
    while(this.accumulator+1e-12>=this.fixedDt){this.step();onStep?.(this);this.accumulator-=this.fixedDt;}
    return Math.max(0,this.accumulator/this.fixedDt);
  }
  /** Mechanical energy of a body: kinetic (translation + rotation) and potential m g y, J. */
  energy(h){
    const v=h.body.linvel(),w=h.body.angvel(),y=h.body.translation().y;
    this.qi.copy(h.body.rotation()).invert();this.w.set(w.x,w.y,w.z).applyQuaternion(this.qi);
    const I=h.inertia,kinetic=.5*h.mass*(v.x*v.x+v.y*v.y+v.z*v.z),rotational=.5*(I.x*this.w.x**2+I.y*this.w.y**2+I.z*this.w.z**2);
    return {kinetic,rotational,potential:h.mass*this.environment.gravity*y,total:kinetic+rotational+h.mass*this.environment.gravity*y};
  }
  dispose(){this.queue.free();this.world.free();this.bodies=[];this.byCollider.clear();}
}
/** The brief's name for the Mars physics module. */
export {PlanetPhysics as MarsPhysics};
