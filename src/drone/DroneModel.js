import * as THREE from 'three';
import {FLIGHT} from '../physics/config.js';
import {DEFAULT_DRONE} from './DroneTypes.js';

/**
 * Görsel drone modeli (çarpışmasız). `props` her motor için [disk, kanat] çifti tutar;
 * DroneEffects kanatları motor açısal hızıyla döndürür, diski devirle bulanıklaştırır.
 * `lights`: durum LED'leri (arka kollar) ve hex'te yanıp sönen beyaz çakar.
 */
export function createDroneModel(drone=DEFAULT_DRONE){
  const group=new THREE.Group(),props=[];
  const mat=(color,metalness=.4,roughness=.5,extra={})=>new THREE.MeshStandardMaterial({color,metalness,roughness,...extra});
  const carbon=mat('#202b2b',.45,.5),accent=mat('#d8fb81',.25,.4);
  const add=(geometry,material,pos,rot=null)=>{const m=new THREE.Mesh(geometry,material);m.position.set(...pos);if(rot)m.rotation.set(...rot);m.castShadow=true;group.add(m);return m;};
  const box=(size,pos,material=carbon,rot=null)=>add(new THREE.BoxGeometry(...size),material,pos,rot);
  const cyl=(rt,rb,h,pos,material,rot=null,seg=14,open=false)=>add(new THREE.CylinderGeometry(rt,rb,h,seg,1,open),material,pos,rot);
  const R=drone.propDiameter/2;
  // Durum LED'i: ışıktan etkilenmeyen tek malzeme; rengi her karede durumdan gelir
  const led=new THREE.MeshBasicMaterial({color:'#d8fb81'}),lights={led,strobe:null};
  const rearLeds=y=>{for(const m of drone.motors){if(m.z<=0)continue;const len=Math.hypot(m.x,m.z);
    const bar=new THREE.Mesh(new THREE.BoxGeometry(len*.36,.004,.007),led);bar.position.set(m.x*.56,y,m.z*.56);bar.rotation.y=-Math.atan2(m.z,m.x);group.add(bar);}};
  const rotor=(m,y,discColor,bladeMat,bladeThick=.0018)=>{
    const disc=new THREE.Mesh(new THREE.CircleGeometry(R,28),new THREE.MeshBasicMaterial({color:discColor,transparent:true,opacity:.22,side:THREE.DoubleSide,depthWrite:false}));
    disc.rotation.x=-Math.PI/2;disc.position.set(m.x,y,m.z);group.add(disc);props.push(disc);
    const blade=box([drone.propDiameter,bladeThick,Math.max(.009,R*.14)],[m.x,y+.002,m.z],bladeMat);props.push(blade);
  };
  const lensAt=(pos,radius,material=accent)=>{
    const lens=cyl(radius,radius,radius*1.8,pos,material);
    lens.rotation.x=Math.PI/2+THREE.MathUtils.degToRad(drone.cameraTilt);return lens;
  };
  if(drone.model==='whoop'){
    const duct=mat('#2d3436',.2,.55),guard=mat('#d8fb81',.1,.5);
    box([.07,.012,.07],[0,0,0]);box([.045,.03,.06],[0,.02,.006],mat('#3a3f44',.3,.5));
    box([.03,.02,.03],[0,.042,.012],mat('#111',.2,.4)); // üst kamera
    for(const m of drone.motors){
      box([Math.hypot(m.x,m.z)*1.2,.006,.012],[m.x/2,-.004,m.z/2],carbon,[0,-Math.atan2(m.z,m.x),0]);
      cyl(R+.007,R+.007,.03,[m.x,.004,m.z],duct,null,28,true);
      cyl(R+.009,R+.009,.004,[m.x,.019,m.z],guard,null,28,true);
      cyl(.009,.009,.012,[m.x,0,m.z],accent);
      rotor(m,.008,m.z<0?'#d8fb81':'#b6ccd1',accent);
    }
    lensAt([0,.012,-.04],.007);rearLeds(-.009);
  }else if(drone.model==='tinywhoop'){
    // 65 mm 1S: tek parça kanallı çerçeve, beyaz kanopi, alttan pil
    const duct=mat('#2b3036',.15,.6),canopy=mat('#eef1ee',.05,.45),pack=mat('#d9542c',.1,.5);
    box([.026,.006,.03],[0,0,0]);box([.02,.014,.024],[0,.01,.002],canopy);box([.012,.008,.03],[0,-.009,.002],pack);
    for(const m of drone.motors){
      box([Math.hypot(m.x,m.z),.004,.006],[m.x/2,-.001,m.z/2],duct,[0,-Math.atan2(m.z,m.x),0]);
      cyl(R+.003,R+.003,.012,[m.x,.002,m.z],duct,null,22,true);
      cyl(R+.0035,R+.0035,.0018,[m.x,.0085,m.z],accent,null,22,true);
      cyl(.0035,.0035,.006,[m.x,0,m.z],mat('#9aa3a8',.6,.4));
      rotor(m,.004,m.z<0?'#d8fb81':'#b6ccd1',accent,.001);
    }
    lensAt([0,.012,-.012],.0032);rearLeds(-.005);
  }else if(drone.model==='race'){
    // 5" yarış: ince kollar, alçak gövde, üstte pil, yüksek kamera açısı, turuncu motor çanları
    const bell=mat('#ff7a3d',.35,.4),pack=mat('#30353a',.2,.55);
    box([.04,.006,.09],[0,0,0]);box([.03,.016,.05],[0,.011,.004]);
    box([.034,.026,.068],[0,.032,.008],pack);box([.035,.004,.03],[0,.046,.008],accent); // pil ve kayış
    for(const angle of [-Math.PI/4,Math.PI/4]){const arm=box([drone.diagonal,.005,.012],[0,-.005,0]);arm.rotation.y=angle;}
    for(const m of drone.motors){
      cyl(.0115,.0115,.014,[m.x,.005,m.z],bell,null,14);
      rotor(m,.014,m.z<0?'#d8fb81':'#b6ccd1',bell,.0016);
    }
    for(const sx of [-1,1])box([.002,.05,.002],[sx*.012,.02,.05],mat('#111',.1,.6),[-.5,0,sx*.25]); // anten
    lensAt([0,.012,-.047],.008);rearLeds(-.009);
  }else if(drone.model==='longrange'){
    const pack=mat('#2a6db5',.2,.45),gps=mat('#e6e9e4',.1,.6);
    box([.06,.03,.13],[0,0,0]);box([.045,.035,.075],[0,.033,.012]);
    for(const m of drone.motors){
      const len=Math.hypot(m.x,m.z);
      box([len,.008,.02],[m.x/2,-.012,m.z/2],carbon,[0,-Math.atan2(m.z,m.x),0]);
      cyl(.017,.017,.02,[m.x,0,m.z],accent);
      rotor(m,.013,m.z<0?'#d8fb81':'#b6ccd1',accent,.0022);
    }
    for(const dx of [-.019,0,.019])cyl(.0095,.0095,.07,[dx,-.03,.01],pack,[Math.PI/2,0,0],12); // Li-ion hücreleri
    cyl(.003,.003,.07,[0,.08,.045],carbon);cyl(.022,.022,.008,[0,.117,.045],gps,null,20); // GPS direği
    for(const s of [-1,1])box([.003,.07,.003],[s*.02,.06,.07],mat('#111',.1,.6),[s*.35,0,0]); // antenler
    lensAt([0,.014,-.07],.011);rearLeds(-.018);
  }else if(drone.model==='hex'){
    const shell=mat('#e9ece6',.15,.4),dark=mat('#2b3033',.4,.45),red=mat('#ff4d4d',0,.4,{emissive:'#ff2020',emissiveIntensity:1.5}),green=mat('#5cff7a',0,.4,{emissive:'#20ff50',emissiveIntensity:1.5});
    const strobe=lights.strobe=mat('#fff',0,.4,{emissive:'#ffffff',emissiveIntensity:.8});
    cyl(.14,.15,.07,[0,0,0],shell,null,24);add(new THREE.SphereGeometry(.11,20,10,0,Math.PI*2,0,Math.PI/2),shell,[0,.035,0]);
    drone.motors.forEach((m,k)=>{
      const len=Math.hypot(m.x,m.z),angle=-Math.atan2(m.z,m.x);
      cyl(.014,.014,len-.12,[m.x*(.5+.06/len),0,m.z*(.5+.06/len)],dark,[0,angle,Math.PI/2],10);
      cyl(.032,.032,.04,[m.x,.02,m.z],dark,null,16);
      rotor(m,.045,'#c8d0d4',mat('#1c1f21',.2,.5),.003);
      const front=m.z<0;add(new THREE.SphereGeometry(.012,8,6),front?(m.x<0?red:green):strobe,[m.x*1.02,-.02,m.z*1.02]);
    });
    for(const s of [-1,1]){ // iniş takımı
      cyl(.008,.008,.5,[s*.16,-.24,0],dark,[Math.PI/2,0,0],8);
      for(const z of [-.13,.13])cyl(.007,.007,.22,[s*.13,-.13,z],dark,[0,0,s*.3],8);
    }
    const gimbal=new THREE.Group();gimbal.position.set(0,-.1,-.16);group.add(gimbal);
    const gm=new THREE.Mesh(new THREE.SphereGeometry(.045,16,12),dark);gm.castShadow=true;gimbal.add(gm);
    const lens=new THREE.Mesh(new THREE.CylinderGeometry(.02,.02,.03,14),accent);lens.rotation.x=Math.PI/2;lens.position.z=-.04;gimbal.add(lens);
    group.userData.gimbal=gimbal;
    const status=new THREE.Mesh(new THREE.BoxGeometry(.05,.006,.012),led);status.position.set(0,-.036,.15);group.add(status); // arka durum LED'i
  }else{
    // 5" freestyle (v0.7.0 modeli)
    box([.055,.025,.105],[0,0,0]);box([.037,.032,.07],[0,.027,.01]);
    for(const angle of [-Math.PI/4,Math.PI/4]){const arm=box([drone.diagonal,.008,.014],[0,-.01,0]);arm.rotation.y=angle;}
    for(const m of drone.motors){
      const motor=new THREE.Mesh(new THREE.CylinderGeometry(.012,.012,.015,12),accent);motor.position.set(m.x,0,m.z);group.add(motor);
      const prop=new THREE.Mesh(new THREE.CircleGeometry(R,24),new THREE.MeshBasicMaterial({color:m.z<0?'#d8fb81':'#b6ccd1',transparent:true,opacity:.25,side:THREE.DoubleSide,depthWrite:false}));
      prop.rotation.x=-Math.PI/2;prop.position.set(m.x,.012,m.z);group.add(prop);props.push(prop);
      const blade=box([drone.propDiameter,.0018,.009],[m.x,.014,m.z],accent);props.push(blade);
    }
    const lens=new THREE.Mesh(new THREE.CylinderGeometry(.009,.009,.016,12),accent);
    lens.rotation.x=Math.PI/2+THREE.MathUtils.degToRad(drone.cameraTilt);lens.position.set(0,.011,-.059);group.add(lens);
    rearLeds(-.0155);
  }
  group.userData.noCollider=true;group.traverse(o=>{o.userData.noCollider=true;});
  return {group,props,drone,lights};
}

export function fpvOrientation(rotation,tilt=FLIGHT.cameraTilt,out=new THREE.Quaternion()){
  return out.copy(rotation).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),THREE.MathUtils.degToRad(tilt)));
}

const _e=new THREE.Euler(0,0,0,'YXZ'),_q=new THREE.Quaternion();
/** Dronun kamera yönelimi: gimballi kamerada yalnızca yön (yaw) izlenir, ufuk düz kalır. */
export function cameraOrientation(drone,rotation,tilt,out=new THREE.Quaternion()){
  if(!drone?.camera?.gimbal)return fpvOrientation(rotation,tilt,out);
  _e.setFromQuaternion(rotation,'YXZ');_q.setFromAxisAngle(new THREE.Vector3(0,1,0),_e.y);
  return fpvOrientation(_q,tilt,out);
}
