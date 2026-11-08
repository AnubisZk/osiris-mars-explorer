import * as THREE from 'three';

/**
 * Procedural vehicle model from the assembled vehicle (same members that produced the mass
 * properties): frame tubes (instanced cylinders), C60 nodes, honeycomb panels, components,
 * rotors with blades that spin at the simulated rotor speed. Origin = centre of mass.
 */
const UP=new THREE.Vector3(0,1,0);
export function createVehicleModel(built){
  const group=new THREE.Group(),inner=new THREE.Group(),c=built.comOffset;inner.position.set(-c[0],-c[1],-c[2]);group.add(inner);
  const carbon=new THREE.MeshStandardMaterial({color:'#2b2f36',roughness:.45,metalness:.3});
  const gold=new THREE.MeshStandardMaterial({color:'#c9a24a',roughness:.35,metalness:.8});
  const panelMat=new THREE.MeshStandardMaterial({color:'#d8d4c8',roughness:.7});
  const f=built.frameData,m4=new THREE.Matrix4(),q=new THREE.Quaternion(),a=new THREE.Vector3(),b=new THREE.Vector3(),d=new THREE.Vector3();
  if(f.tubes.length){
    const cyl=new THREE.CylinderGeometry(.5,.5,1,8),mesh=new THREE.InstancedMesh(cyl,carbon,f.tubes.length);
    f.tubes.forEach((t,i)=>{a.fromArray(t.a);b.fromArray(t.b);d.subVectors(b,a);const L=d.length();q.setFromUnitVectors(UP,d.normalize());
      m4.compose(a.clone().add(b).multiplyScalar(.5),q,new THREE.Vector3(t.od,L,t.od));mesh.setMatrixAt(i,m4);});
    mesh.castShadow=true;inner.add(mesh);
  }
  if(f.nodes.length){
    const sph=new THREE.SphereGeometry(1,8,6),mesh=new THREE.InstancedMesh(sph,gold,f.nodes.length);
    f.nodes.forEach((n,i)=>{m4.compose(new THREE.Vector3(...n.p),new THREE.Quaternion(),new THREE.Vector3(n.r,n.r,n.r));mesh.setMatrixAt(i,m4);});inner.add(mesh);
  }
  for(const p of f.panels){
    let geo;
    if(p.hexCap){geo=new THREE.CylinderGeometry(p.radius,p.radius,.006,6);}
    else{geo=new THREE.BoxGeometry(p.w,p.hex?p.h:p.t??.004,p.hex?.006:p.h);}
    const m=new THREE.Mesh(geo,p.hex||p.hexCap?panelMat:carbon);m.position.fromArray(p.center);
    if(p.hex){const n=new THREE.Vector3(...p.n);m.lookAt(n.add(m.position));}
    m.castShadow=true;inner.add(m);
  }
  for(const comp of built.spec.components){
    const mat=comp.group==='solar'?new THREE.MeshStandardMaterial({color:'#1c2a4a',roughness:.3,metalness:.5}):gold;
    const places=comp.perMount?f.mounts.map(p=>[p[0],p[1]-.02,p[2]]):[comp.center];
    for(const pos of places){const m=new THREE.Mesh(new THREE.BoxGeometry(...comp.size),mat);m.position.fromArray(pos);m.castShadow=true;inner.add(m);}
  }
  // rotors: blades + a faint disc that becomes visible at speed
  const rotors=f.mounts.map((mnt,i)=>{
    const r=built.rotors[i].rotor,hub=new THREE.Group();hub.position.fromArray(mnt);
    const bladeMat=new THREE.MeshStandardMaterial({color:'#d9dde3',roughness:.5,metalness:.2});
    for(let k=0;k<r.blades;k++){
      const chord=r.stations[Math.floor(r.stations.length*.4)].c,bl=new THREE.Mesh(new THREE.BoxGeometry(r.radius*(1-r.root),.004,chord),bladeMat);
      bl.position.x=r.radius*(1+r.root)/2;const arm=new THREE.Group();arm.rotation.y=k*2*Math.PI/r.blades;arm.add(bl);hub.add(arm);bl.castShadow=true;
    }
    const disc=new THREE.Mesh(new THREE.CircleGeometry(r.radius,48),new THREE.MeshBasicMaterial({color:'#cfd8e0',transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide}));
    disc.rotation.x=-Math.PI/2;hub.add(disc);inner.add(hub);
    return {hub,disc,spin:built.rotors[i].spin};
  });
  return {group,rotors,
    update(vehicle,dt){rotors.forEach((r,i)=>{const w=vehicle.rotors[i].motor.omega;r.hub.rotation.y+=r.spin*Math.min(w*dt,.9);r.disc.material.opacity=Math.min(.22,w/2000);});},
    dispose(){group.traverse(o=>{o.geometry?.dispose();});}};
}
