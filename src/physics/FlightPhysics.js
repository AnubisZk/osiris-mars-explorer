import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import {FLIGHT,mixMotors,clamp} from './config.js';
import {FlightController} from '../drone/FlightController.js';
import {trainingThrottle,throttleToVertical} from '../controllers/TrainingThrottle.js';
import {DEFAULT_DRONE} from '../drone/DroneTypes.js';

let initialization;
export function initializeRapier(){return initialization??=RAPIER.init();}

export class FlightPhysics extends EventTarget {
  /** `drone` is a DroneTypes entry; the default is the v0.7.0 5" freestyle quad. */
  constructor(spawn=[0,.2,0],yaw=0,drone=DEFAULT_DRONE){
    super();this.drone=drone;this.world=new RAPIER.World({x:0,y:-FLIGHT.gravity,z:0});this.world.timestep=FLIGHT.fixedDt;
    this.world.integrationParameters.numSolverIterations=8;
    this.queue=new RAPIER.EventQueue(true);
    this.body=this.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setCanSleep(false).setCcdEnabled(true)
      .setAdditionalMassProperties(drone.mass,{x:0,y:0,z:0},drone.inertia,{x:0,y:0,z:0,w:1}));
    this.collider=this.createDroneCollider(drone);
    this.body.recomputeMassPropertiesFromColliders();
    this.controller=new FlightController(drone);this.allocateMotors(drone);
    this.wind=null;this.air=new THREE.Vector3();
    this.battery={enabled:false,charge:1};
    this.position=new THREE.Vector3();this.rotation=new THREE.Quaternion();this.previousPosition=new THREE.Vector3();this.previousRotation=new THREE.Quaternion();
    this.inverse=new THREE.Quaternion();this.bodyRate=new THREE.Vector3();this.velocity=new THREE.Vector3();
    this.force=new THREE.Vector3();this.point=new THREE.Vector3();this.localVelocity=new THREE.Vector3();this.reaction=new THREE.Vector3();
    this.impactVelocity=new THREE.Vector3();
    this.checkpoint={pos:[...spawn],yaw};this.time=0;this.contacts=0;this.crashes=0;this.lastContact=-10;this.lastImpact=-10;this.respawnIn=0;
    this.collisionMode='respawn';this.motorStop=false;
    this.armed=false;this.message='Gazı sıfırla, Space / A ile motorları aç.';this.reset();
  }
  createDroneCollider(drone){
    return this.world.createCollider(RAPIER.ColliderDesc.cuboid(...drone.collider).setDensity(0)
      .setFriction(.6).setRestitution(.08).setCollisionGroups(0x00020001)
      .setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS).setContactForceEventThreshold(drone.contact.force),this.body);
  }
  allocateMotors(drone){
    const n=drone.motorCount;
    this.motorOmega=new Float64Array(n);this.motorThrust=new Float64Array(n);this.motorCommands=new Float64Array(n);
    this.maxThrustRatio=drone.thrustToWeight;
  }
  /** Swap airframe while disarmed: mass, inertia, collider, motors and controller follow the new type. */
  setDrone(drone){
    if(drone===this.drone)return true;
    if(this.armed)return false;
    this.world.removeCollider(this.collider,false);
    this.drone=drone;this.collider=this.createDroneCollider(drone);
    this.body.setAdditionalMassProperties(drone.mass,{x:0,y:0,z:0},drone.inertia,{x:0,y:0,z:0,w:1},true);
    this.body.recomputeMassPropertiesFromColliders();
    this.controller.setDrone(drone);this.allocateMotors(drone);this.battery.charge=1;
    this.reset();return true;
  }
  addTrimesh(vertices,indices){
    return this.world.createCollider(RAPIER.ColliderDesc.trimesh(vertices,indices).setFriction(.7).setCollisionGroups(0x00010002));
  }
  addBox(position,halfSize,rotation={x:0,y:0,z:0,w:1}){
    return this.world.createCollider(RAPIER.ColliderDesc.cuboid(...halfSize).setTranslation(...position).setRotation(rotation).setFriction(.7).setCollisionGroups(0x00010002));
  }
  addCylinder(position,radius,height,rotation={x:0,y:0,z:0,w:1}){
    return this.world.createCollider(RAPIER.ColliderDesc.cylinder(height/2,radius).setTranslation(...position).setRotation(rotation).setCollisionGroups(0x00010002));
  }
  setCheckpoint(position,yaw){this.checkpoint={pos:[...position],yaw};}
  canSee(from,to){
    const dx=to.x-from.x,dy=to.y-from.y,dz=to.z-from.z,distance=Math.hypot(dx,dy,dz);
    if(distance<.03)return false;
    const ray=new RAPIER.Ray(from,{x:dx/distance,y:dy/distance,z:dz/distance});
    return !this.world.castRay(ray,distance-.02,true,RAPIER.QueryFilterFlags.EXCLUDE_DYNAMIC);
  }
  /** Yalnız okuma sorgusu: dronun altındaki ilk sabit yüzey (görsel gölge lekesi için; fiziği değiştirmez). */
  probeDown(maxDistance=30){
    const p=this.position,ray=new RAPIER.Ray({x:p.x,y:p.y,z:p.z},{x:0,y:-1,z:0});
    const hit=this.world.castRayAndGetNormal(ray,maxDistance,true,RAPIER.QueryFilterFlags.EXCLUDE_DYNAMIC|RAPIER.QueryFilterFlags.EXCLUDE_SENSORS);
    return hit?{distance:hit.timeOfImpact,nx:hit.normal.x,ny:hit.normal.y,nz:hit.normal.z}:null;
  }
  toggleArm(throttle){
    if(this.armed){this.disarm();this.message='Motorlar kapalı.';return true;}
    if(this.health===0){this.message='Drone hasarlı · R / B ile onar.';return false;}
    if(this.respawnIn>0){this.message='Yeniden başlama bekleniyor.';return false;}
    if(throttle>=.05){this.message='ARM ENGELLENDİ · Gazı %5 altına indir.';return false;}
    this.controller.reset();this.armed=true;this.message='Motorlar açık · gazı yavaşça artır.';return true;
  }
  disarm(){this.armed=false;this.collective=0;this.motorOmega.fill(0);this.motorThrust.fill(0);this.controller.reset();this.body.resetForces(true);this.body.resetTorques(true);}
  reset(){
    this.disarm();this.respawnIn=0;this.health=100;this.lastImpact=-10;if(this.battery)this.battery.charge=1;
    const p=this.checkpoint.pos,q=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),this.checkpoint.yaw);
    this.body.setTranslation({x:p[0],y:p[1],z:p[2]},true);this.body.setRotation(q,true);
    this.body.setLinvel({x:0,y:0,z:0},true);this.body.setAngvel({x:0,y:0,z:0},true);
    this.sync();this.previousPosition.copy(this.position);this.previousRotation.copy(this.rotation);
    this.message='Kontrol noktasındasın · gazı sıfırla, Space / A ile aç.';
    this.dispatchEvent(new Event('reset'));
  }
  crash(reason='Sert çarpışma'){
    if(this.respawnIn>0)return;
    this.crashes++;this.disarm();this.respawnIn=this.drone.respawnSeconds;
    this.message=reason+' · motorlar kapandı';this.dispatchEvent(new Event('crash'));
  }
  impact(){
    if(this.collisionMode!=='continue'){this.crash();return;}
    if(this.time-this.lastImpact<1)return;
    this.lastImpact=this.time;this.crashes++;this.message='Çarpışma · uçuş devam ediyor. Gerekirse R / B ile sıfırla.';
    this.dispatchEvent(new Event('impact'));
  }
  applyDamage(impulse,approachSpeed){
    if(this.health===0||this.time-this.lastImpact<.4)return;
    this.lastImpact=this.time;
    const damage=Math.round(this.drone.damage.speed*approachSpeed+this.drone.damage.impulse*impulse);
    this.health=Math.max(0,this.health-damage);
    this.crashes++;
    if(this.health===0)this.disarm();
    this.message=this.health===0?'Drone devre dışı · R / B ile onar.':`Çarpışma · sağlık %${this.health}`;
    this.dispatchEvent(new Event('impact'));
  }
  sync(){this.position.copy(this.body.translation());this.rotation.copy(this.body.rotation());this.velocity.copy(this.body.linvel());}
  step(dt,input){
    this.time+=dt;this.previousPosition.copy(this.position);this.previousRotation.copy(this.rotation);
    if(this.respawnIn>0){this.respawnIn-=dt;if(this.respawnIn<=0){this.reset();return;}}
    this.body.resetForces(true);this.body.resetTorques(true);
    this.rotation.copy(this.body.rotation());this.inverse.copy(this.rotation).invert();
    this.bodyRate.copy(this.body.angvel()).applyQuaternion(this.inverse);
    const d=this.drone;
    if(this.armed){
      const torque=this.controller.update(dt,input,this.rotation,this.bodyRate,this);
      const hold=this.controller.mode==='KONUM';
      const assisted=hold||this.controller.mode==='ANGLE'&&Number.isFinite(input.verticalCommand);
      this.collective=assisted
        ?trainingThrottle(hold&&!Number.isFinite(input.verticalCommand)?throttleToVertical(input.throttle,d.hover):input.verticalCommand,this.body.linvel().y,this.rotation,d)
        :clamp(input.throttle,0,1);
      mixMotors(this.collective,torque,this.motorCommands,d);
      // Motor Stop is a manual-throttle option; training descent retains lift.
      if(this.motorStop&&!assisted&&input.throttle<=.001){
        this.motorCommands.fill(0);this.controller.reset();
      }
      const alpha=1-Math.exp(-dt/d.motorTimeConstant);
      const kT=d.maxMotorThrust/(d.maxMotorOmega**2);
      const supply=this.battery.enabled?this.batteryFactor():1;
      for(let i=0;i<d.motorCount;i++){
        const m=d.motors[i],target=d.maxMotorOmega*Math.sqrt(this.motorCommands[i]/d.maxMotorThrust);
        this.motorOmega[i]+=(target-this.motorOmega[i])*alpha;
        let thrust=kT*this.motorOmega[i]**2*(.65+.35*this.health/100);
        if(this.battery.enabled)thrust*=supply;
        this.motorThrust[i]=thrust;
        this.force.set(0,thrust,0).applyQuaternion(this.rotation);
        this.point.set(m.x,0,m.z).applyQuaternion(this.rotation).add(this.position);
        this.body.addForceAtPoint(this.force,this.point,true);
        this.reaction.set(0,m.spin*d.reactionArm*thrust,0).applyQuaternion(this.rotation);
        this.body.addTorque(this.reaction,true);
      }
      if(this.battery.enabled)this.drainBattery(dt);
    }
    // Sürükleme havaya göre hızdan: rüzgâr yoksa gövde hızının kendisi (v0.7.0 ile aynı işlem)
    this.localVelocity.copy(this.body.linvel());
    if(this.wind?.active){this.air.copy(this.wind.velocity(this.time,this.position));this.localVelocity.sub(this.air);}
    this.localVelocity.applyQuaternion(this.inverse);
    const drag=d.drag;
    for(let k=0;k<3;k++){
      const axis=k===0?'x':k===1?'y':'z',v=this.localVelocity[axis];this.force[axis]=-drag.linear[k]*v-drag.quadratic[k]*Math.abs(v)*v;
    }
    this.force.applyQuaternion(this.rotation);this.body.addForce(this.force,true);
    this.reaction.copy(this.bodyRate).multiplyScalar(-drag.angular).applyQuaternion(this.rotation);this.body.addTorque(this.reaction,true);
    this.impactVelocity.copy(this.body.linvel());
    this.world.step(this.queue);
    let peakImpulse=0,approachSpeed=0;
    this.queue.drainContactForceEvents(event=>{
      if(event.collider1()!==this.collider.handle&&event.collider2()!==this.collider.handle)return;
      const impulse=event.totalForceMagnitude()*dt;
      if(impulse>d.contact.impulse&&this.time-this.lastContact>.5){this.contacts++;this.lastContact=this.time;this.dispatchEvent(new Event('contact'));}
      if(this.collisionMode==='damage'){
        if(impulse<=d.crashImpulse||impulse<=peakImpulse)return;
        const n=event.maxForceDirection();
        const normalSpeed=Math.abs(this.impactVelocity.x*n.x+this.impactVelocity.y*n.y+this.impactVelocity.z*n.z);
        if(normalSpeed<1.5)return;
        peakImpulse=impulse;approachSpeed=normalSpeed;
      }else if(this.armed&&impulse>d.crashImpulse)this.impact();
    });
    if(peakImpulse)this.applyDamage(peakImpulse,approachSpeed);
    this.sync();
    if(this.bounds&&(this.position.x<this.bounds.xMin-3||this.position.x>this.bounds.xMax+3||this.position.z<this.bounds.zMin-3||this.position.z>this.bounds.zMax+3||this.position.y>this.ceiling||this.position.y< -3)){
      if(this.respawnIn<=0)this.crash('Saha sınırı aşıldı');
    }
  }
  /** Batarya (isteğe bağlı): gerilim düşümü itkiyi azaltır; tükenince motorlar kapanır. */
  batteryFactor(){return 1-this.drone.battery.sag*(1-this.battery.charge)**1.3;}
  drainBattery(dt){
    const d=this.drone,hoverThrust=d.hover*d.maxMotorThrust;let load=0;
    for(let i=0;i<d.motorCount;i++)load+=(Math.max(0,this.motorThrust[i])/hoverThrust)**1.5;
    this.battery.charge=Math.max(0,this.battery.charge-load/d.motorCount*dt/(d.battery.minutes*60));
    if(this.battery.charge<=0){this.disarm();this.message='Batarya bitti · R / B ile yeni batarya.';}
  }
  dispose(){this.queue.free();this.world.free();}
}
