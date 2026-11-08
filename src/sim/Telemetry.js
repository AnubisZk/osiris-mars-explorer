import * as THREE from 'three';

/** Columnar flight-data recorder (fixed sample interval), CSV / JSON export. */
export const TELEMETRY_COLUMNS=Object.freeze([
  ['t','s'],['x','m'],['y','m'],['z','m'],['agl','m'],['vx','m/s'],['vy','m/s'],['vz','m/s'],['speed','m/s'],
  ['roll','deg'],['pitch','deg'],['yaw','deg'],['tilt','deg'],['rateNorm','deg/s'],
  ['thrust','N'],['power','W'],['shaftPower','W'],['energy','Wh'],['soc',''],['voltage','V'],
  ['rpm0','rpm'],['rpm1','rpm'],['collective','deg'],['density','kg/m3'],['windX','m/s'],['windZ','m/s'],['phase',''],
]);
const euler=new THREE.Euler(),quat=new THREE.Quaternion(),up=new THREE.Vector3();

export class Telemetry {
  constructor(interval=.1){this.interval=interval;this.next=0;this.cols=Object.fromEntries(TELEMETRY_COLUMNS.map(([k])=>[k,[]]));this.phases=[];this.events=[];}
  get length(){return this.cols.t.length;}
  event(t,type,detail={}){this.events.push({t,type,...detail});}
  sample(sim,force=false){
    const t=sim.time;if(!force&&t+1e-9<this.next)return;this.next=t+this.interval;
    const v=sim.vehicle,b=v.body,p=b.translation(),vel=b.linvel(),w=b.angvel(),c=this.cols;
    quat.copy(b.rotation());euler.setFromQuaternion(quat,'YXZ');up.set(0,1,0).applyQuaternion(quat);
    const wind=sim.wind?.active?sim.wind.velocity(sim.physics.time,p):{x:0,z:0};
    const phase=sim.mission?.phase??sim.control.mode;let pi=this.phases.indexOf(phase);if(pi<0){this.phases.push(phase);pi=this.phases.length-1;}
    const row={t,x:p.x,y:p.y,z:p.z,agl:(v.out.groundHeight??NaN)-v.footClearance,vx:vel.x,vy:vel.y,vz:vel.z,speed:Math.hypot(vel.x,vel.y,vel.z),
      roll:euler.z*57.29578,pitch:euler.x*57.29578,yaw:euler.y*57.29578,tilt:Math.acos(Math.min(1,up.y))*57.29578,rateNorm:Math.hypot(w.x,w.y,w.z)*57.29578,
      thrust:v.out.thrust,power:v.out.power,shaftPower:v.out.shaftPower,energy:v.energyWh,soc:v.battery.soc,voltage:v.battery.voltage,
      rpm0:v.rpm(0),rpm1:v.rotors.length>1?v.rpm(1):0,collective:v.controls.collective*57.29578,density:v.out.density??NaN,windX:wind.x,windZ:wind.z,phase:pi};
    for(const [k] of TELEMETRY_COLUMNS)c[k].push(row[k]);
  }
  /** Column statistics over an optional phase filter. */
  stats(key,phases=null){
    const a=this.cols[key],ph=this.cols.phase;let n=0,s=0,s2=0,mx=-Infinity,mn=Infinity;
    for(let i=0;i<a.length;i++){if(phases&&!phases.includes(this.phases[ph[i]]))continue;const x=a[i];if(!Number.isFinite(x))continue;n++;s+=x;s2+=x*x;if(x>mx)mx=x;if(x<mn)mn=x;}
    return n?{n,mean:s/n,rms:Math.sqrt(s2/n),max:mx,min:mn}:{n:0,mean:NaN,rms:NaN,max:NaN,min:NaN};
  }
  toCSV(){
    const keys=TELEMETRY_COLUMNS.map(([k])=>k),head=TELEMETRY_COLUMNS.map(([k,u])=>u?`${k} [${u}]`:k).join(',');
    const rows=[];for(let i=0;i<this.length;i++)rows.push(keys.map(k=>k==='phase'?this.phases[this.cols.phase[i]]:fmt(this.cols[k][i])).join(','));
    return head+'\n'+rows.join('\n')+'\n';
  }
  toJSON(){return {interval:this.interval,columns:TELEMETRY_COLUMNS.map(([k,u])=>({key:k,unit:u})),phases:this.phases,events:this.events,data:this.cols};}
}
const fmt=x=>Number.isFinite(x)?+x.toPrecision(7):'';
