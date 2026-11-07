import * as THREE from 'three';

/**
 * Drone görsel efektleri (yalnız görüntü, çarpışmasız; fizik durumunu yalnız okur):
 * - Pervane: devirle artan bulanık disk, durağana yakınken kanat görünür
 * - Durum LED'leri: motorlar kapalı → turuncu yanıp söner, açık → yeşil,
 *   batarya < %20 → hızlı kırmızı, devre dışı/kaza → sabit kırmızı; hex'te beyaz çakar
 * - Yer gölgesi lekesi (takip kamerasında; yüksekliğe göre solar)
 * - Çarpışma kıvılcımı ve toz (tek Points, sabit havuz)
 */
const COLORS={lime:new THREE.Color('#d8fb81'),amber:new THREE.Color('#ffae4a'),red:new THREE.Color('#ff3b30'),off:new THREE.Color('#1c2420'),strobeOff:new THREE.Color('#3a3d3f'),white:new THREE.Color('#ffffff')};
const UP=new THREE.Vector3(0,1,0);

/** LED durumu (saf; testli): renk anahtarı ve yanık mı. */
export function ledState(f,time){
  if(f.health===0||f.respawnIn>0)return {color:'red',on:true};
  if(!f.armed)return {color:'amber',on:time%1.2<.6};
  if(f.battery?.enabled&&f.battery.charge<.2)return {color:'red',on:time%.4<.2};
  return {color:'lime',on:true};
}
/** Pervane görünümü (saf; testli): disk opaklığı ve kanadın görünürlüğü. */
export function propLook(omega,maxOmega){
  const r=Math.max(0,omega)/maxOmega;
  return {disc:omega<20?0:Math.min(.85,.25+.75*Math.min(1,r*1.6)),blade:omega<40};
}

let blurTex=null,blobTex=null;
function propBlurTexture(){
  if(blurTex)return blurTex;
  const S=128,c=document.createElement('canvas');c.width=c.height=S;const g=c.getContext('2d'),m=S/2;
  // İki kanadın hareket izi: kanat önünde keskin, arkasında üstel sönüm; uçlara doğru daha görünür
  for(let i=0;i<180;i++){
    const a=i/180*Math.PI,alpha=.05+.55*Math.exp(-i/26);
    for(const base of [0,Math.PI]){
      const grad=g.createRadialGradient(m,m,S*.06,m,m,m);
      grad.addColorStop(0,'rgba(255,255,255,0)');grad.addColorStop(.25,`rgba(255,255,255,${alpha*.35})`);
      grad.addColorStop(.85,`rgba(255,255,255,${alpha})`);grad.addColorStop(1,'rgba(255,255,255,0)');
      g.fillStyle=grad;g.beginPath();g.moveTo(m,m);g.arc(m,m,m,base-a-Math.PI/180*1.1,base-a+.002);g.closePath();g.fill();
    }
  }
  g.globalCompositeOperation='lighter';g.strokeStyle='rgba(255,255,255,.18)';g.lineWidth=2;g.beginPath();g.arc(m,m,m-3,0,Math.PI*2);g.stroke();
  blurTex=new THREE.CanvasTexture(c);blurTex.colorSpace=THREE.SRGBColorSpace;return blurTex;
}
function blobTexture(){
  if(blobTex)return blobTex;
  const S=64,c=document.createElement('canvas');c.width=c.height=S;const g=c.getContext('2d');
  const grad=g.createRadialGradient(S/2,S/2,0,S/2,S/2,S/2);
  grad.addColorStop(0,'rgba(255,255,255,1)');grad.addColorStop(.45,'rgba(255,255,255,.7)');grad.addColorStop(1,'rgba(255,255,255,0)');
  g.fillStyle=grad;g.fillRect(0,0,S,S);blobTex=new THREE.CanvasTexture(c);return blobTex;
}

const N=96;
export class DroneEffects {
  constructor(scene,renderer){
    this.scene=scene;this.renderer=renderer;this.model=null;this.size=new THREE.Vector2();
    const geo=new THREE.PlaneGeometry(1,1);geo.rotateX(-Math.PI/2);
    this.blob=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color:'#000',map:typeof document!=='undefined'?blobTexture():null,transparent:true,opacity:.4,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-4}));
    this.blob.visible=false;this.blob.renderOrder=1;this.blob.userData.noCollider=true;scene.add(this.blob);
    this.normal=new THREE.Vector3();
    // Parçacıklar
    this.pos=new Float32Array(N*3);this.col=new Float32Array(N*3);this.alpha=new Float32Array(N);this.psize=new Float32Array(N);
    this.vel=new Float32Array(N*3);this.life=new Float32Array(N);this.maxLife=new Float32Array(N);this.kind=new Uint8Array(N);this.base=new Float32Array(N);
    const pg=new THREE.BufferGeometry();
    pg.setAttribute('position',new THREE.BufferAttribute(this.pos,3).setUsage(THREE.DynamicDrawUsage));
    pg.setAttribute('aColor',new THREE.BufferAttribute(this.col,3).setUsage(THREE.DynamicDrawUsage));
    pg.setAttribute('aAlpha',new THREE.BufferAttribute(this.alpha,1).setUsage(THREE.DynamicDrawUsage));
    pg.setAttribute('aSize',new THREE.BufferAttribute(this.psize,1).setUsage(THREE.DynamicDrawUsage));
    this.points=new THREE.Points(pg,new THREE.ShaderMaterial({
      uniforms:{uScale:{value:400}},transparent:true,depthWrite:false,
      vertexShader:`attribute vec3 aColor;attribute float aAlpha;attribute float aSize;uniform float uScale;varying vec3 vColor;varying float vAlpha;
        void main(){vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;gl_PointSize=min(256.,aSize*uScale/max(.05,-mv.z));vColor=aColor;vAlpha=aAlpha;}`,
      fragmentShader:`varying vec3 vColor;varying float vAlpha;
        void main(){float d=length(gl_PointCoord-.5);if(d>.5||vAlpha<.003)discard;gl_FragColor=vec4(vColor,vAlpha*(1.-smoothstep(.12,.5,d)));}`,
    }));
    this.points.frustumCulled=false;this.points.visible=false;this.points.userData.noCollider=true;this.points.renderOrder=2;scene.add(this.points);
    this.next=0;this.alive=0;
  }
  attach(model){
    this.model=model;const map=typeof document!=='undefined'?propBlurTexture():null;
    model.props.forEach((p,i)=>{if(i%2===0&&map){p.material.map=map;p.material.opacity=0;p.material.needsUpdate=true;}});
  }
  /** Çarpışma efekti: tür 'impact' | 'crash' | 'contact'. */
  burst(type,position,velocity){
    const sparks=type==='crash'?34:type==='impact'?22:5,dust=type==='crash'?14:type==='impact'?9:4;
    const vx=velocity?.x??0,vy=velocity?.y??0,vz=velocity?.z??0;
    for(let n=0;n<sparks+dust;n++){
      const i=this.next;this.next=(this.next+1)%N;const spark=n<sparks;
      const th=Math.random()*Math.PI*2,up=spark?Math.random()*.9+.1:Math.random()*.5+.3,sp=spark?2+Math.random()*4.5:.25+Math.random()*.9;
      const h=Math.sqrt(1-up*up);
      this.pos[i*3]=position.x;this.pos[i*3+1]=position.y;this.pos[i*3+2]=position.z;
      this.vel[i*3]=Math.cos(th)*h*sp+vx*(spark?.25:.1);this.vel[i*3+1]=up*sp+vy*(spark?.15:.05);this.vel[i*3+2]=Math.sin(th)*h*sp+vz*(spark?.25:.1);
      this.kind[i]=spark?0:1;this.life[i]=0;this.maxLife[i]=spark?.25+Math.random()*.4:1+Math.random()*.7;
      this.base[i]=spark?.03+Math.random()*.02:.22+Math.random()*.15;
      const c=spark?COLORS.white.clone().lerp(COLORS.amber,Math.random()*.8):new THREE.Color('#a59f8f').multiplyScalar(.85+Math.random()*.25);
      this.col[i*3]=c.r;this.col[i*3+1]=c.g;this.col[i*3+2]=c.b;
    }
    this.alive=N;this.points.visible=true;
  }
  /** Her karede (drone grubu yerleştirildikten sonra). */
  update({flight:f,camera,dt,time,chase,paused,position}){
    const m=this.model;if(!m||!f)return;
    const d=f.drone,step=paused?0:dt;
    // Pervaneler
    for(let k=0;k<m.props.length;k+=2){
      const motor=k>>1,omega=f.motorOmega[motor]??0,look=propLook(omega,d.maxMotorOmega),spin=d.motors[motor]?.spin??1;
      const disc=m.props[k],blade=m.props[k+1];
      if(disc.material.map){disc.material.opacity=look.disc;disc.visible=look.disc>0;disc.rotation.z+=spin*Math.min(omega*step,.15);}
      if(blade){blade.visible=!disc.material.map||look.blade;blade.rotation.y+=omega*step;}
    }
    // LED'ler
    const s=ledState(f,time);m.lights.led.color.copy(s.on?COLORS[s.color]:COLORS.off);
    if(m.lights.strobe){const on=f.armed&&time%1.1<.07;m.lights.strobe.color.copy(on?COLORS.white:COLORS.strobeOff);m.lights.strobe.emissiveIntensity=on?2.4:0;}
    // Yer gölgesi lekesi
    const hit=chase?f.probeDown?.(30):null;
    if(hit){
      const h=hit.distance,fade=1-Math.min(1,h/14);
      this.blob.visible=fade>0;this.normal.set(hit.nx,hit.ny,hit.nz);
      this.blob.position.copy(position??f.position).addScaledVector(UP,-h).addScaledVector(this.normal,.03);
      this.blob.quaternion.setFromUnitVectors(UP,this.normal);
      const sc=d.span*(1.15+h*.05);this.blob.scale.set(sc,1,sc);this.blob.material.opacity=.42*fade;
    }else this.blob.visible=false;
    // Parçacıklar
    if(this.points.visible){
      let any=false;const drag=Math.exp(-step*1.6),dragDust=Math.exp(-step*3);
      for(let i=0;i<N;i++){
        if(this.life[i]>=this.maxLife[i]){this.alpha[i]=0;this.psize[i]=0;continue;}
        any=true;this.life[i]+=step;const t=Math.min(1,this.life[i]/this.maxLife[i]),dust=this.kind[i]===1;
        const g=dust?-.25:-9.8,dr=dust?dragDust:drag;
        this.vel[i*3]*=dr;this.vel[i*3+2]*=dr;this.vel[i*3+1]=this.vel[i*3+1]*dr+g*step;
        this.pos[i*3]+=this.vel[i*3]*step;this.pos[i*3+1]=Math.max(.02,this.pos[i*3+1]+this.vel[i*3+1]*step);this.pos[i*3+2]+=this.vel[i*3+2]*step;
        this.alpha[i]=dust?.38*(1-t)*Math.min(1,t*6):1-t*t;
        this.psize[i]=dust?this.base[i]*(1+2.4*t):this.base[i]*(1-.5*t);
      }
      const geo=this.points.geometry;for(const a of ['position','aColor','aAlpha','aSize'])geo.attributes[a].needsUpdate=true;
      this.renderer?.getDrawingBufferSize(this.size);
      if(camera&&this.size.y)this.points.material.uniforms.uScale.value=this.size.y/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov)/2));
      if(!any)this.points.visible=false;
    }
  }
  dispose(){
    this.scene.remove(this.blob,this.points);this.blob.geometry.dispose();this.blob.material.dispose();
    this.points.geometry.dispose();this.points.material.dispose();
  }
}
