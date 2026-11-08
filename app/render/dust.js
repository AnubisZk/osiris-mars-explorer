import * as THREE from 'three';

/**
 * Rotor-downwash dust (visual only): particles lifted from the ground ring under the rotor when
 * the vehicle is within ~2 rotor radii of the surface and the rotors are turning. Count fixed,
 * one draw call; the amount scales with the induced velocity estimate and proximity.
 */
function softDot(){
  const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d'),gr=g.createRadialGradient(32,32,0,32,32,32);
  gr.addColorStop(0,'rgba(255,255,255,1)');gr.addColorStop(.4,'rgba(255,255,255,.5)');gr.addColorStop(1,'rgba(255,255,255,0)');
  g.fillStyle=gr;g.fillRect(0,0,64,64);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}
export class DustPlume {
  constructor(scene,count=420){
    this.n=count;this.pos=new Float32Array(count*3);this.col=new Float32Array(count*4);this.vel=new Float32Array(count*3);this.age=new Float32Array(count).fill(1e9);this.life=new Float32Array(count);
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(this.pos,3));g.setAttribute('color',new THREE.BufferAttribute(this.col,4)); // RGBA: per-particle fade
    this.points=new THREE.Points(g,new THREE.PointsMaterial({size:.45,map:softDot(),vertexColors:true,transparent:true,depthWrite:false,opacity:.6,sizeAttenuation:true}));
    this.points.frustumCulled=false;scene.add(this.points);this.spawnAcc=0;this.seed=1;
  }
  rand(){this.seed=(this.seed*16807)%2147483647;return this.seed/2147483647;}
  /** center: vehicle position; ground(x,z) height; radius rotor radius; strength 0…1. */
  update(dt,center,ground,radius,strength,color){
    const rate=strength*900;this.spawnAcc+=rate*dt;let k=0;
    while(this.spawnAcc>=1&&k<this.n){
      this.spawnAcc-=1;let i=-1;for(let j=0;j<this.n;j++){const q=(this.cursor=((this.cursor??0)+1)%this.n);if(this.age[q]>=this.life[q]){i=q;break;}}
      if(i<0)break;k++;
      const a=this.rand()*Math.PI*2,r=radius*(.6+.8*this.rand()),x=center.x+Math.cos(a)*r,z=center.z+Math.sin(a)*r;
      this.pos[i*3]=x;this.pos[i*3+1]=ground(x,z)+.05;this.pos[i*3+2]=z;
      const sp=1.5+3*this.rand()*strength;this.vel[i*3]=Math.cos(a)*sp;this.vel[i*3+1]=.3+1.2*this.rand();this.vel[i*3+2]=Math.sin(a)*sp;
      this.age[i]=0;this.life[i]=1.2+1.6*this.rand();
    }
    for(let i=0;i<this.n;i++){
      if(this.age[i]>=this.life[i]){this.col[i*4+3]=0;this.pos[i*3+1]=-1e4;continue;}
      this.age[i]+=dt;const f=Math.max(0,1-this.age[i]/this.life[i]),damp=Math.exp(-.8*dt);
      this.vel[i*3]*=damp;this.vel[i*3+2]*=damp;this.vel[i*3+1]=this.vel[i*3+1]*damp-.3*dt;
      for(let c=0;c<3;c++)this.pos[i*3+c]+=this.vel[i*3+c]*dt;
      const fade=f*Math.min(1,this.age[i]*4);this.col[i*4]=color.r;this.col[i*4+1]=color.g;this.col[i*4+2]=color.b;this.col[i*4+3]=fade;
    }
    this.points.geometry.attributes.position.needsUpdate=true;this.points.geometry.attributes.color.needsUpdate=true;
  }
}
