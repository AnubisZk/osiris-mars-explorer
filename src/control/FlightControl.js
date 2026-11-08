import * as THREE from 'three';
import {evaluateRotor,createRotorState,trimCoaxial,evaluateCoaxial} from '../aero/rotor.js';

/**
 * Flight control for Mars and Earth rotorcraft. Cascaded: position → velocity → acceleration →
 * thrust vector → attitude → body rates → torques, then allocation to the actuators:
 *   coaxial:    collective (thrust), differential collective (yaw), tip-path-plane tilt (pitch/roll)
 *   multirotor: per-rotor thrust by pseudo-inverse mixing → rotor speed from the rotor model
 * Gravity, density and rotor trims come from the planet environment (no Earth constants).
 * Gains scale with each vehicle's inertia and actuator speed; tuning constants are assumed.
 *
 * Modes: 'manual'  sticks {pitch, roll, yaw, climb} ∈ [−1, 1] → tilt-angle / climb-rate commands
 *        'auto'    target {position: [x,y,z], yaw (rad) | null, speed (m/s)}
 *        'land'    descend at a safe rate and disarm on touchdown
 */
const RAD=Math.PI/180,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

export class FlightControl {
  constructor(vehicle){
    this.v=vehicle;this.mode='manual';this.stick={pitch:0,roll:0,yaw:0,climb:0};
    this.target={position:null,yaw:null,speed:null};this.heading=yawOf(vehicle.body.rotation());
    this.iRate=new THREE.Vector3();this.iVel=new THREE.Vector3();this.iThrust=0;this.iVz=0;
    this.status='idle';this.touchdown=false;
    this._q=new THREE.Quaternion();this._qd=new THREE.Quaternion();this._qe=new THREE.Quaternion();this._m=new THREE.Matrix4();
    this._F=new THREE.Vector3();this._bx=new THREE.Vector3();this._by=new THREE.Vector3();this._bz=new THREE.Vector3();
    this._w=new THREE.Vector3();this._e=new THREE.Vector3();this._t=new THREE.Vector3();
    this.prepare();
  }
  /** Trim and allocation data for the current environment (call again after a planet change). */
  prepare(){
    const v=this.v,env=v.physics.environment,g=env.gravity,m=v.built.mass,W=m*g,spec=v.spec;
    const p=v.body.translation(),atm=env.atmosphere(v.physics.altitude(p.y));
    this.g=g;this.W=W;this.mass=m;this.I=v.built.principal.moments;
    this.limits={tilt:spec.control.maxTiltDeg*RAD,climb:spec.control.maxClimb,descent:spec.control.maxDescent,
      speed:spec.control.maxSpeed,yawRate:spec.control.yawRateDeg*RAD};
    if(spec.kind==='coax'){
      // pre-flight rotor-speed setpoint: nominal if a trim exists with 15 % thrust margin, else the
      // nearest speed in [0.25, 1] × maximum that has one (as the Ingenuity team re-selected rpm per season)
      const rotor=v.rotors[0].rotor,rpmMax=spec.rpm.max,candidates=[spec.rpm.nominal];
      for(let k=1;k<=24;k++){const up=spec.rpm.nominal+k*(rpmMax-spec.rpm.nominal)/6,dn=spec.rpm.nominal*(1-k*.03);if(k<=6)candidates.push(up);if(dn>=.25*rpmMax)candidates.push(dn);}
      let omega=spec.rpm.nominal*2*Math.PI/60,t=null,t2=null;
      for(const rpm of candidates){const w=rpm*2*Math.PI/60,a=trimCoaxial(rotor,v.rotors[1].rotor,w,W,atm),b=a&&trimCoaxial(rotor,v.rotors[1].rotor,w,1.15*W,atm);if(a&&b){omega=w;t=a;t2=b;break;}if(a&&!t){t=a;omega=w;}}
      v.controls.rpmRef=omega;this.rpmSetpoint=omega*60/(2*Math.PI);
      this.canHover=!!t;
      if(t){
        this.trim={collective:t.collective,differential:t.differential,power:t.power,
          dTdTheta:t2?(.15*W)/Math.max(1e-4,t2.collective-t.collective):W/(4*RAD)};
        // yaw authority: d(Q_lower − Q_upper)/dδ around trim
        const su=createRotorState(),sl=createRotorState(),q=d=>{evaluateCoaxial(rotor,rotor,su,sl,{omega,collective:t.collective-d/2},{omega,collective:t.collective+d/2},{},atm);return sl.Q-su.Q;};
        this.trim.dQdDelta=Math.max(1e-4,(q(t.differential+RAD)-q(t.differential-RAD))/(2*RAD));
        // stall boundary: common collective of maximum total thrust at nominal rotor speed
        let best=-Infinity,bestTh=t.collective;
        for(let th=t.collective;th<=t.collective+16*RAD;th+=.5*RAD){evaluateCoaxial(rotor,rotor,su,sl,{omega,collective:th},{omega,collective:th},{},atm);if(su.T+sl.T>best){best=su.T+sl.T;bestTh=th;}else if(su.T+sl.T<.97*best)break;}
        this.trim.collectiveMax=bestTh;this.trim.thrustMax=best;
      }else this.trim={collective:20*RAD,differential:0,dTdTheta:W/(4*RAD),dQdDelta:.05,power:NaN,collectiveMax:20*RAD,thrustMax:0};
      const hubH=v.rotors.reduce((s,r)=>s+r.hub[1],0)/v.rotors.length;
      this.tiltAuthority=W*hubH+spec.flapping.hubStiffness;
      this.rateBandwidth=Math.min(10,.25/spec.flapping.tau);this.yawBandwidth=2.5;
    }else{
      // thrust and torque vs rotor speed (hover, out of ground effect) for the current air
      const r=v.rotors[0].rotor,mot=spec.motor,vFull=v.battery.openCircuit();
      const noLoad=mot.kvSI*vFull,st=createRotorState(),curve=[];
      for(let i=0;i<=60;i++){const w=noLoad*i/60;evaluateRotor(r,st,{omega:w},atm);curve.push([w,st.T,st.Q]);}
      // highest speed the motor can hold at full throttle: Kt((V − ω/kv)/R − i0) ≥ Q(ω)
      let wMax=0;for(const [w,,Q] of curve){const tq=mot.kt*Math.min(mot.maxCurrent,(vFull-w/mot.kvSI)/mot.resistance-mot.noLoadCurrent);if(tq>=Q)wMax=w;}
      wMax=Math.min(wMax,(spec.rpm.max??Infinity)*2*Math.PI/60);
      this.curve=curve.filter(c=>c[0]<=wMax+1e-9);this.tMax=this.curve[this.curve.length-1][1];
      const n=v.rotors.length,hoverT=W/n,hv=this.curve.find(c=>c[1]>=hoverT)??this.curve[this.curve.length-1];
      this.kq=hv[1]>0?hv[2]/hv[1]:.01;this.canHover=n*this.tMax>W;
      this.mixer=pseudoInverse(v.rotors.map(r=>[1,-r.hub[2],r.hub[0],-r.spin*this.kq]));
      // rotor-speed loop bandwidth sets how fast thrust can change
      const J=v.rotors[0].motor.inertia,bw=(mot.speedGain??4)/(mot.kvSI**2*mot.resistance*J);
      this.rateBandwidth=clamp(.3*bw,2,22);this.yawBandwidth=clamp(.12*bw,.8,6);
    }
    this.gains={rate:this.rateBandwidth,att:.35*this.rateBandwidth,vel:clamp(.2*this.rateBandwidth,.7,1.6),pos:.45,vz:1.6};
  }
  setManual(stick){this.mode='manual';Object.assign(this.stick,stick);}
  setTarget(position,{yaw=null,speed=null}={}){this.mode='auto';this.target={position:[...position],yaw,speed};if(yaw!=null)this.heading=yaw;}
  /** Descend and disarm on touchdown, holding the current target (or present) horizontal position. */
  land(){const p=this.v.body.translation(),t=this.target.position;this.landAt=t?[t[0],0,t[2]]:[p.x,0,p.z];this.mode='land';}
  update(dt){
    const v=this.v,b=v.body,L=this.limits,G=this.gains;
    if(!v.armed){this.iRate.set(0,0,0);this.iVel.set(0,0,0);this.iThrust=0;this.iVz=0;this.status=v.cutoff?'cutoff':'disarmed';this.idleActuators();return;}
    const p=b.translation(),vel=b.linvel(),q=this._q.copy(b.rotation());
    // contact with the ground (any collider of the vehicle touching static geometry)
    const onGround=v.handle.contactForce>.2*this.W||((v.out.groundHeight??Infinity)-v.footClearance<.03);
    // 1. acceleration command (world) and heading
    let ax=0,az=0,ay=0;
    if(this.mode==='manual'){
      const s=this.stick,f=fwd(this.heading),aMax=this.g*Math.tan(L.tilt);
      ax=aMax*(s.pitch*f[0]+s.roll*-f[2]);az=aMax*(s.pitch*f[2]+s.roll*f[0]);
      const vzCmd=s.climb>=0?s.climb*L.climb:s.climb*L.descent;
      ay=G.vz*(vzCmd-vel.y)+this.iVz;this.iVz=clamp(this.iVz+.4*(vzCmd-vel.y)*dt,-2,2);
      this.heading+=s.yaw*L.yawRate*dt;
    }else{
      let tp=this.target.position??[p.x,p.y,p.z];
      if(this.mode==='land')tp=[this.landAt[0],p.y,this.landAt[2]];
      // speed toward the target limited so the vehicle can stop with half its tilt-limited deceleration
      const ex=tp[0]-p.x,ez=tp[2]-p.z,eh=Math.hypot(ex,ez),vmax=Math.min(L.speed,this.target.speed??L.speed);
      const aStop=.5*this.g*Math.tan(L.tilt),sp=Math.min(vmax,Math.sqrt(2*aStop*eh),G.pos*eh*4);
      const k=eh>1e-6?Math.min(G.pos*2,sp/eh):0,vx=k*ex,vz=k*ez;
      let vyCmd;
      if(this.mode==='land'){const agl=(v.out.groundHeight??10)-v.footClearance;vyCmd=-clamp(.25+.5*agl,.25,L.descent);}
      else{const ey=tp[1]-p.y;vyCmd=clamp(Math.sign(ey)*Math.min(Math.abs(.8*ey),Math.sqrt(2*.3*this.g*Math.abs(ey))),-L.descent,L.climb);}
      const ivx=this.iVel.x,ivz=this.iVel.z;
      ax=G.vel*(vx-vel.x)+ivx;az=G.vel*(vz-vel.z)+ivz;
      this.iVel.x=clamp(ivx+.15*(vx-vel.x)*dt,-1,1);this.iVel.z=clamp(ivz+.15*(vz-vel.z)*dt,-1,1);
      ay=G.vz*(vyCmd-vel.y)+this.iVz;this.iVz=clamp(this.iVz+.4*(vyCmd-vel.y)*dt,-2,2);
      if(this.target.yaw!=null)this.heading=this.target.yaw;
    }
    // 2. thrust vector with tilt limit
    const F=this._F.set(this.mass*ax,this.mass*(this.g+ay),this.mass*az);
    if(F.y<.05*this.W)F.y=.05*this.W;
    const hor=Math.hypot(F.x,F.z),maxH=F.y*Math.tan(L.tilt);if(hor>maxH){F.x*=maxH/hor;F.z*=maxH/hor;}
    // 3. desired attitude: body Y along F, heading kept
    const by=this._by.copy(F).normalize(),f=fwd(this.heading);
    const bz=this._bz.set(-f[0],0,-f[2]);bz.addScaledVector(by,-bz.dot(by)).normalize();
    const bx=this._bx.copy(by).cross(bz);
    this._m.makeBasis(bx,by,bz);this._qd.setFromRotationMatrix(this._m);
    // 4. attitude error (body) → rate command
    const qe=this._qe.copy(q).invert().multiply(this._qd);if(qe.w<0){qe.x=-qe.x;qe.y=-qe.y;qe.z=-qe.z;qe.w=-qe.w;}
    const e=this._e.set(2*qe.x,2*qe.y,2*qe.z);
    const yawGain=.5*this.yawBandwidth;
    const wCmd=this._t.set(G.att*e.x,yawGain*e.y,G.att*e.z);
    // 5. rate loop → torque (body)
    const w=this._w.copy(b.angvel()).applyQuaternion(q.clone().invert());
    const kr=[G.rate,this.yawBandwidth,G.rate];
    const err=[wCmd.x-w.x,wCmd.y-w.y,wCmd.z-w.z],tau=[0,0,0];
    for(let k=0;k<3;k++){
      const ik=['x','y','z'][k];this.iRate[ik]=clamp(this.iRate[ik]+.3*kr[k]*err[k]*dt,-1,1);
      tau[k]=this.I[k]*(kr[k]*err[k]+kr[k]*this.iRate[ik]);
    }
    if(onGround&&this.mode!=='manual'&&F.y<this.W*.9){tau[0]=tau[2]=0;}
    // collective thrust along the current body Y
    const yAxis=this._t.set(0,1,0).applyQuaternion(q);
    let T=Math.max(0,F.dot(yAxis));
    // 6. touchdown / spin-up
    // touchdown: feet within 5 cm of the ground below and nearly at rest for 0.5 s
    const agl=(v.out.groundHeight??Infinity)-v.footClearance,still=Math.hypot(vel.x,vel.y,vel.z)<.3;
    this.groundTime=agl<.05&&still?(this.groundTime??0)+dt:0;this.touchdown=this.groundTime>.5;
    if(this.mode==='land'&&this.touchdown){v.disarm();this.status='landed';return;}
    this.status=onGround?'ground':'flying';
    this.allocate(T,tau,dt);
  }
  allocate(T,tau,dt){
    const v=this.v,c=v.controls;
    if(v.spec.kind==='coax'){
      // rotor speed ready: within 3 % of nominal to start, stays ready down to 85 % (hysteresis)
      const nominal=v.controls.rpmRef,low=Math.min(...v.rotors.map(r=>r.motor.omega));
      this.spun=this.spun?low>.85*nominal:low>.97*nominal;const spun=this.spun;
      if(!spun){T=0;this.iThrust=0;this.status='spin-up';}
      const tr=this.trim;
      // thrust tracking: feed-forward from the trim slope plus integral on the modelled thrust
      this.iThrust=clamp(this.iThrust+6*(T-v.out.thrust)/tr.dTdTheta*dt*(spun?1:0),-6*RAD,6*RAD);
      c.collective=clamp(tr.collective+(T-this.W)/tr.dTdTheta+this.iThrust,tr.collective-10*RAD,tr.collectiveMax);
      if(c.collective>=tr.collectiveMax&&this.iThrust>0)this.iThrust-=6*(T-v.out.thrust)/tr.dTdTheta*dt; // anti-windup at the stall limit
      c.differential=clamp(tr.differential+tau[1]/tr.dQdDelta,-6*RAD,6*RAD);
      const thrustNow=Math.max(.3*this.W,v.out.thrust),auth=this.tiltAuthority*thrustNow/this.W;
      c.tiltLon=-tau[0]/auth;c.tiltLat=-tau[2]/auth;
    }else{
      const n=v.rotors.length,tMin=.02*this.tMax,M=this.mixer;
      const base=T/n,rp=new Array(n),yw=new Array(n);
      for(let i=0;i<n;i++){rp[i]=M[i][1]*tau[0]+M[i][2]*tau[2];yw[i]=M[i][3]*tau[1];}
      const fit=(b0,d)=>{let s=1;for(let i=0;i<n;i++){const t=b0[i]+d[i];if(t>this.tMax)s=Math.min(s,(this.tMax-b0[i])/(d[i]||1e-12));if(t<tMin)s=Math.min(s,(tMin-b0[i])/(d[i]||-1e-12));}return clamp(s,0,1);};
      // attitude first: shift the collective so roll/pitch fit, scale them only if the spread is too wide
      const hi=Math.max(...rp),lo=Math.min(...rp),room=this.tMax-tMin;
      const scaleRp=hi-lo>room?room/(hi-lo):1;
      const b=clamp(base,tMin-lo*scaleRp,this.tMax-hi*scaleRp);
      const b0=Array(n).fill(b),rps=rp.map(x=>x*scaleRp);
      const b1=b0.map((x,i)=>x+rps[i]),s2=fit(b1,yw);
      for(let i=0;i<n;i++)c.omegaRef[i]=speedFor(this.curve,clamp(b1[i]+s2*yw[i],0,this.tMax));
    }
  }
  idleActuators(){const c=this.v.controls;c.omegaRef.fill(0);c.tiltLon=c.tiltLat=0;if(this.trim)c.collective=this.trim.collective-this.W/this.trim.dTdTheta;}
}

function fwd(yaw){return [-Math.sin(yaw),0,-Math.cos(yaw)];}
function yawOf(q){const f=new THREE.Vector3(0,0,-1).applyQuaternion(q);return Math.atan2(-f.x,-f.z);}
function speedFor(curve,T){
  if(T<=curve[0][1])return curve[0][0];
  for(let i=1;i<curve.length;i++)if(T<=curve[i][1]){const [w0,t0]=curve[i-1],[w1,t1]=curve[i];return w0+(w1-w0)*(T-t0)/Math.max(1e-12,t1-t0);}
  return curve[curve.length-1][0];
}
/** Moore–Penrose pseudo-inverse of an n×4 allocation (rows per rotor) → n×4 mixing matrix. */
function pseudoInverse(rows){
  const n=rows.length,A=[0,1,2,3].map(r=>rows.map(x=>x[r])),AAt=A.map(a=>A.map(b=>a.reduce((s,x,i)=>s+x*b[i],0)));
  const inv=invert4(AAt);return rows.map((_,i)=>[0,1,2,3].map(c=>[0,1,2,3].reduce((s,k)=>s+A[k][i]*inv[k][c],0)));
}
function invert4(m){
  const n=4,a=m.map((r,i)=>[...r,...[0,1,2,3].map(j=>i===j?1:0)]);
  for(let c=0;c<n;c++){
    let p=c;for(let r=c+1;r<n;r++)if(Math.abs(a[r][c])>Math.abs(a[p][c]))p=r;
    [a[c],a[p]]=[a[p],a[c]];const d=a[c][c]||1e-12;for(let j=0;j<2*n;j++)a[c][j]/=d;
    for(let r=0;r<n;r++)if(r!==c){const f=a[r][c];for(let j=0;j<2*n;j++)a[r][j]-=f*a[c][j];}
  }
  return a.map(r=>r.slice(n));
}
export {yawOf,fwd};
