import * as THREE from 'three';

/**
 * Hayalet tur: en iyi turun konum/yönelim izi (20 Hz) harita + drone türü başına
 * yerel olarak saklanır ve yarış sırasında yarı saydam bir drone olarak oynatılır.
 * Yalnızca görseldir; fizik ve puanla etkileşmez.
 */
export class GhostLap {
  constructor(scene,storage=null){
    this.scene=scene;this.storage=storage;this.enabled=true;this.rate=20;this.current=[];this.best=null;this.model=null;
    this.q=new THREE.Quaternion();this.qb=new THREE.Quaternion();this.p=new THREE.Vector3();this.pb=new THREE.Vector3();
  }
  key(raceKey){return `${raceKey}.ghost`;}
  load(raceKey){
    this.raceKey=raceKey;this.best=null;
    try{const g=JSON.parse(this.storage?.getItem(this.key(raceKey))??'null');if(g&&Array.isArray(g.s)&&g.s.length>2&&Number.isFinite(g.time))this.best=g;}catch{}
    return this.best;
  }
  /** Görsel: verilen drone modelinin yarı saydam kopyası. */
  setModel(group){
    if(this.model){this.scene.remove(this.model);this.model.traverse(o=>{if(o.material?.userData?.ghost)o.material.dispose();});}
    const clone=group.clone(true);
    clone.traverse(o=>{if(o.material){const m=o.material.clone();m.transparent=true;m.opacity=Math.min(m.opacity??1,.38);m.depthWrite=false;
      if(m.color)m.color.lerp(new THREE.Color('#7fe7ff'),.6);if(m.emissive)m.emissive.set('#1a6f80');m.userData.ghost=true;o.material=m;o.castShadow=false;}});
    clone.visible=false;clone.userData.noCollider=true;clone.traverse(o=>{o.userData.noCollider=true;});
    this.model=clone;this.scene.add(clone);
  }
  startLap(){this.current=[];}
  /** Fizik adımında: tur içi süre t (s) ile örnek. */
  record(t,position,rotation){
    const last=this.current.at(-1);if(last&&t-last[0]<1/this.rate-1e-9)return;
    this.current.push([+t.toFixed(3),+position.x.toFixed(2),+position.y.toFixed(2),+position.z.toFixed(2),+rotation.x.toFixed(3),+rotation.y.toFixed(3),+rotation.z.toFixed(3),+rotation.w.toFixed(3)]);
  }
  /** Tur bitti: en iyiyse sakla. */
  finishLap(time,best){
    if(best&&this.current.length>2&&this.raceKey){
      this.best={time,s:this.current};
      try{this.storage?.setItem(this.key(this.raceKey),JSON.stringify(this.best));}catch{/* Depolama doluysa hayalet saklanmaz. */}
    }
    this.current=[];
  }
  /** Tur içi süre t'de hayaleti konumla (yoksa gizle). */
  show(t,visible){
    const m=this.model,g=this.best;
    if(!m)return;
    if(!this.enabled||!visible||!g||t<0||t>g.time){m.visible=false;return;}
    const s=g.s;let lo=0,hi=s.length-1;
    while(hi-lo>1){const mid=(lo+hi)>>1;if(s[mid][0]<=t)lo=mid;else hi=mid;}
    const a=s[lo],b=s[hi],k=b[0]>a[0]?Math.min(1,Math.max(0,(t-a[0])/(b[0]-a[0]))):0;
    m.position.copy(this.p.set(a[1],a[2],a[3]).lerp(this.pb.set(b[1],b[2],b[3]),k));
    m.quaternion.copy(this.q.set(a[4],a[5],a[6],a[7]).normalize().slerp(this.qb.set(b[4],b[5],b[6],b[7]).normalize(),k));
    m.visible=true;
  }
  clear(){try{this.storage?.removeItem(this.key(this.raceKey));}catch{}this.best=null;if(this.model)this.model.visible=false;}
}
