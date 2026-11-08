import * as THREE from 'three';

/**
 * Mars scene: terrain mesh (from the physics height grid), instanced rocks, sky and fog from dust
 * optical depth, Sun from Mars24 with Beer–Lambert attenuation, one shadow map that follows the
 * vehicle. Draws only; never touches physics. Quality presets trade detail for frame time.
 */
export const QUALITY={
  low:{pixelRatio:.75,shadows:false,rocks:1500,shadowSize:1024,antialias:false},
  medium:{pixelRatio:1,shadows:true,rocks:3500,shadowSize:1024,antialias:true},
  high:{pixelRatio:Math.min(2,globalThis.devicePixelRatio||1),shadows:true,rocks:6000,shadowSize:2048,antialias:true},
};

function detailTexture(){
  const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d'),img=g.createImageData(256,256);
  let s=1234567;const r=()=>(s=(s*16807)%2147483647)/2147483647;
  for(let i=0;i<256*256;i++){const v=200+r()*55;img.data[i*4]=v;img.data[i*4+1]=v*.93;img.data[i*4+2]=v*.86;img.data[i*4+3]=255;}
  g.putImageData(img,0,0);for(let k=0;k<900;k++){g.fillStyle=`rgba(${80+r()*60},${50+r()*30},${30+r()*20},${.08+r()*.15})`;g.beginPath();g.arc(r()*256,r()*256,.5+r()*2.5,0,7);g.fill();}
  const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t;
}

export class MarsScene {
  constructor(renderer,terrain,quality='medium'){
    this.renderer=renderer;this.scene=new THREE.Scene();this.terrain=terrain;
    this.sun=new THREE.DirectionalLight('#fff1dd',2.4);this.sun.castShadow=true;this.scene.add(this.sun,this.sun.target);
    this.sky=new THREE.HemisphereLight('#d9b38c','#6b3c22',.55);this.scene.add(this.sky);
    this.scene.fog=new THREE.FogExp2('#c9a37f',.0016);
    this.buildTerrain();this.setQuality(quality);this.markers=new THREE.Group();this.scene.add(this.markers);
  }
  buildTerrain(){
    const T=this.terrain,W=T.nx+1,geo=new THREE.PlaneGeometry(T.size[0],T.size[1],T.nx,T.nz);geo.rotateX(-Math.PI/2);
    const pos=geo.attributes.position,col=new Float32Array(pos.count*3);
    for(let k=0;k<pos.count;k++){
      const x=pos.getX(k),z=pos.getZ(k),i=Math.round((x/T.size[0]+.5)*T.nx),j=Math.round((z/T.size[1]+.5)*T.nz),h=T.heights[i+j*W];
      pos.setY(k,h);
    }
    geo.computeVertexNormals();
    const nrm=geo.attributes.normal;
    for(let k=0;k<pos.count;k++){
      const slope=1-nrm.getY(k),h=pos.getY(k),n=.5+.5*Math.sin(pos.getX(k)*.05)*Math.cos(pos.getZ(k)*.043);
      const r=.62+.08*n-.18*slope+.004*h,g=.36+.05*n-.12*slope+.002*h,b=.22+.03*n-.06*slope;
      col[k*3]=r;col[k*3+1]=g;col[k*3+2]=b;
    }
    geo.setAttribute('color',new THREE.BufferAttribute(col,3));
    const tex=detailTexture();tex.repeat.set(T.size[0]/6,T.size[1]/6);
    this.ground=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({vertexColors:true,map:tex,roughness:.95,metalness:0}));
    this.ground.receiveShadow=true;this.scene.add(this.ground);
  }
  buildRocks(count){
    if(this.rockMeshes)for(const m of this.rockMeshes){this.scene.remove(m);m.geometry.dispose();}
    const rocks=this.terrain.rocks.slice(0,count),shapes=[0,1,2,3].map(s=>{
      const g=new THREE.IcosahedronGeometry(.5,1),p=g.attributes.position;let seed=s*97+13;const r=()=>(seed=(seed*16807)%2147483647)/2147483647;
      for(let k=0;k<p.count;k++){const f=.75+.4*r();p.setXYZ(k,p.getX(k)*f,p.getY(k)*f*.7,p.getZ(k)*f);}g.computeVertexNormals();return g;});
    const mat=new THREE.MeshStandardMaterial({color:'#6e4a35',roughness:.9,flatShading:true}),m4=new THREE.Matrix4(),q=new THREE.Quaternion(),e=new THREE.Euler();
    this.rockMeshes=shapes.map((g,s)=>{
      const list=rocks.filter(r=>r.shape===s),mesh=new THREE.InstancedMesh(g,mat,list.length);
      list.forEach((r,i)=>{e.set(0,r.rot,0);q.setFromEuler(e);m4.compose(new THREE.Vector3(r.x,r.y+r.d*.12,r.z),q,new THREE.Vector3(r.d,r.d,r.d));mesh.setMatrixAt(i,m4);});
      mesh.castShadow=this.quality.shadows;mesh.receiveShadow=true;this.scene.add(mesh);return mesh;
    });
  }
  setQuality(name){
    this.qualityName=name;this.quality=QUALITY[name];
    this.renderer.setPixelRatio(this.quality.pixelRatio);this.renderer.shadowMap.enabled=this.quality.shadows;
    this.sun.castShadow=this.quality.shadows;this.sun.shadow.mapSize.set(this.quality.shadowSize,this.quality.shadowSize);
    this.sun.shadow.map?.dispose();this.sun.shadow.map=null;
    const cam=this.sun.shadow.camera;cam.left=cam.bottom=-30;cam.right=cam.top=30;cam.near=1;cam.far=400;cam.updateProjectionMatrix();
    this.buildRocks(this.quality.rocks);
  }
  /**
   * Sky, fog and sunlight from the Sun's elevation/azimuth and dust optical depth τ.
   * Direct beam ∝ TOA irradiance · exp(−τ / cos Z) (Beer–Lambert); colours are illustrative.
   */
  setSky(sun,tau){
    const el=sun.elevation*Math.PI/180,az=sun.azimuth*Math.PI/180,up=Math.max(.02,Math.sin(el));
    const beam=Math.max(0,sun.irradianceTOA*Math.exp(-tau/up))*(el>0?1:0);
    this.sun.intensity=2.6*beam/590;this.sun.position.set(Math.sin(az)*Math.cos(el)*200,Math.sin(el)*200,-Math.cos(az)*Math.cos(el)*200);
    const day=Math.max(0,Math.min(1,el/(10*Math.PI/180)+.15)),dusty=Math.min(1,tau/2);
    const sky=new THREE.Color().setRGB(.78*day+.06,.6*day+.05,.45*day+.09).lerp(new THREE.Color('#b0896a'),dusty*.4*day);
    this.scene.background=sky;this.scene.fog.color.copy(sky);this.scene.fog.density=.0008+.0022*tau;
    this.sky.intensity=.3+.7*day*(.5+.5*Math.min(1,tau)); // night: faint ambient so the scene stays readablethis.sky.color.copy(sky);
    this.sunInfo={beam,tau};
  }
  followShadow(target){this.sun.target.position.copy(target);this.sun.position.add(target).sub(this._last??target);this._last=target.clone();}
  setWaypoints(wps,terrain){
    this.markers.clear();
    const mat=new THREE.MeshBasicMaterial({color:'#7ef0ff'}),home=new THREE.MeshBasicMaterial({color:'#ffd166'}),pts=[];
    const beacon=new THREE.MeshBasicMaterial({color:'#7ef0ff',transparent:true,opacity:.35,depthWrite:false});
    const add=(x,z,m,pole)=>{const y=terrain.heightAt(x,z);const ring=new THREE.Mesh(new THREE.TorusGeometry(1.2,.06,6,32),m);ring.rotation.x=-Math.PI/2;ring.position.set(x,y+.05,z);this.markers.add(ring);
      if(pole){const b=new THREE.Mesh(new THREE.CylinderGeometry(.03,.03,8,6),beacon);b.position.set(x,y+4,z);this.markers.add(b);}pts.push(new THREE.Vector3(x,y+.3,z));};
    add(0,0,home,false);for(const w of wps)add(w.x,w.z,mat,true);add(0,0,home,false);
    if(pts.length>1)this.markers.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:'#7ef0ff',transparent:true,opacity:.6})));
  }
}
