/* OSIRISZK — Zemin malzemeleri: sınıf tanımları (assets/terrain/terrain_classes.json) ve haritadaki dağılım.
   Sıra sabittir: 0 regolit, 1 kum, 2 ana kaya, 3 çakıl, 4 toz. Ağırlık vektörü [kum, kaya, çakıl, toz]; regolit = 1 - toplam. */
import {terrainHeight,fbm,clamp,lerp,CRATERS} from './engine.js';

// fetch başarısız olursa (ör. dosya doğrudan açıldıysa) kullanılan yedek — asıl kaynak terrain_classes.json
const FALLBACK={rover:{mass_kg:1025,wheel_count:6,wheel_diameter_m:.98,wheel_width_m:.31},classes:[
 {id:0,key:'regolith',name_tr:'Regolit (toprak)',base_color:[.56,.30,.19],tile_m:2.4,physics:{density_kg_m3:1520,cohesion_kpa:2.0,friction_deg:35,bekker_n:1.3,bekker_kc:572.1,bekker_kphi:4915.3,shear_K_m:.0254,rigid:false},effects:{dust:1.0,track:.65}},
 {id:1,key:'sand',name_tr:'Kum',base_color:[.36,.26,.21],tile_m:3.2,physics:{density_kg_m3:1200,cohesion_kpa:.5,friction_deg:30,bekker_n:1.1,bekker_kc:.9,bekker_kphi:1523.4,shear_K_m:.025,rigid:false},effects:{dust:1.4,track:.85}},
 {id:2,key:'bedrock',name_tr:'Ana kaya',base_color:[.66,.47,.34],tile_m:6.0,physics:{density_kg_m3:2600,cohesion_kpa:1000,friction_deg:45,rigid:true,wheel_friction_mu:.75,rolling_coef:.015},effects:{dust:.12,track:0}},
 {id:3,key:'gravel',name_tr:'Çakıllı / bloklu zemin',base_color:[.47,.29,.20],tile_m:1.8,physics:{density_kg_m3:1600,cohesion_kpa:6,friction_deg:30,bekker_n:.8,bekker_kc:102,bekker_kphi:5301,shear_K_m:.008,rigid:false},effects:{dust:.45,track:.35}},
 {id:4,key:'dust',name_tr:'Toz (sürüklenme)',base_color:[.72,.45,.29],tile_m:3.0,physics:{density_kg_m3:1150,cohesion_kpa:1.5,friction_deg:18,bekker_n:1.0,bekker_kc:.5,bekker_kphi:600,shear_K_m:.03,rigid:false},effects:{dust:2.2,track:.9}}]};

export let TERRAIN_CONFIG=FALLBACK;
export const MATERIAL_KEYS=['regolith','sand','bedrock','gravel','dust'];
export async function loadTerrainConfig(url='assets/terrain/terrain_classes.json'){
 try{const res=await fetch(url,{cache:'no-cache'});if(!res.ok)throw new Error(res.status);const cfg=await res.json();
  if(!Array.isArray(cfg.classes)||cfg.classes.length!==5)throw new Error('5 sınıf bekleniyor');
  cfg.classes.forEach((c,i)=>{if(c.key!==MATERIAL_KEYS[i])throw new Error(`Sınıf sırası bozuk: ${c.key}`);});
  TERRAIN_CONFIG=cfg;}catch(err){console.warn('terrain_classes.json okunamadı, yerleşik değerler kullanılıyor:',err.message);TERRAIN_CONFIG=FALLBACK;}
 return TERRAIN_CONFIG;}

// İsteğe bağlı malzeme haritası (ML boru hattının HiRISE görüntüsünden ürettiği): R=kum, G=kaya, B=çakıl, A=toz
let matMap=null;
export function setMaterialMap(data,size,half){matMap=data?{data,size,half}:null;}
function sampleMap(x,z,out){const {data,size,half}=matMap,u=clamp((x+half)/(2*half),0,1)*(size-1),v=clamp((z+half)/(2*half),0,1)*(size-1);
 const i=Math.floor(u),j=Math.floor(v),fu=u-i,fv=v-j,i1=Math.min(size-1,i+1),j1=Math.min(size-1,j+1);
 for(let c=0;c<4;c++){const a=data[(j*size+i)*4+c],b=data[(j*size+i1)*4+c],d=data[(j1*size+i)*4+c],e=data[(j1*size+i1)*4+c];out[c]=((a+(b-a)*fu)+((d+(e-d)*fu)-(a+(b-a)*fu))*fv)/255;}return out;}

const ss=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
/** Çekirdek kural seti. h: yükseklik, slope: eğim (tan), low: çevresine göre çukurluk (negatif = çukur). */
export function weightsCore(x,z,h,slope,low,out=new Float32Array(4)){
 const n1=fbm(x*.045+11.3,z*.045-7.1)*.5+.5,n2=fbm(x*.11-3.7,z*.11+5.2)*.5+.5,n3=fbm(x*.023+40,z*.023-12)*.5+.5;
 let sand=ss(-.04,-.32,low)*.95+ss(.56,.74,n1)*.8, bed=ss(.30,.62,slope)+ss(.66,.82,n2)*.55*(1-ss(-.05,-.3,low)),
     grav=ss(.60,.78,n2*.55+n3*.45)*.55, dust=ss(.55,1.5,h)*(1-ss(.10,.28,slope))*.75+ss(.62,.80,n3)*.45;
 for(const [cx,cz,r] of CRATERS){const d=Math.hypot(x-cx,z-cz)/r;
  bed+=Math.exp(-(((d-1.06)/.10)**2))*.75;                                 // krater kenarı: yüzeye çıkmış kaya
  grav+=(d>1.12&&d<2.3?(1-ss(1.3,2.3,d))*.85:0)*(.55+.45*n2);              // fırlatma örtüsü (ejecta)
  sand+=(d<.55?(1-ss(.25,.55,d))*.7:0);}                                   // krater tabanında kum birikintisi
 sand*=1-ss(.22,.45,slope);dust*=1-ss(.2,.45,slope);
 const start=ss(5,13,Math.hypot(x,z-16));                                  // iniş bölgesi: sağlam regolit
 sand*=start;dust*=.4+.6*start;bed*=.3+.7*start;grav*=.5+.5*start;
 out[0]=clamp(sand,0,1);out[1]=clamp(bed,0,1);out[2]=clamp(grav,0,1);out[3]=clamp(dust,0,1);
 const sum=out[0]+out[1]+out[2]+out[3];if(sum>.97){const k=.97/sum;for(let c=0;c<4;c++)out[c]*=k;}
 return out;}
const tmp=new Float32Array(4);
/** Dünya koordinatında malzeme ağırlıkları [kum, kaya, çakıl, toz]. Fizik ve toz/iz efektleri bunu kullanır. */
export function materialWeights(x,z,out=new Float32Array(4)){
 const h=terrainHeight(x,z),e=.6,dx=(terrainHeight(x+e,z)-terrainHeight(x-e,z))/(2*e),dz=(terrainHeight(x,z+e)-terrainHeight(x,z-e))/(2*e);
 const low=h-(terrainHeight(x+5,z)+terrainHeight(x-5,z)+terrainHeight(x,z+5)+terrainHeight(x,z-5))/4;
 weightsCore(x,z,h,Math.hypot(dx,dz),low,out);
 return applyMapToWeights(x,z,out);}
/** Yörünge malzeme haritası baskın gelir; ancak HiRISE sınıflarında ana kaya olmadığı için eğimden gelen kaya korunur. */
export function applyMapToWeights(x,z,out){if(!matMap)return out;sampleMap(x,z,tmp);
 for(let c=0;c<4;c++)out[c]=c===1?Math.max(out[c],tmp[c]):lerp(out[c],tmp[c],.85);
 const sum=out[0]+out[1]+out[2]+out[3];if(sum>.97){const k=.97/sum;for(let c=0;c<4;c++)out[c]*=k;}return out;}
/** 4'lü ağırlıktan 5 sınıflı vektör (regolit başta). */
export function fullWeights(w4){const r=Math.max(0,1-w4[0]-w4[1]-w4[2]-w4[3]);return [r,w4[0],w4[1],w4[2],w4[3]];}
export function dominantClass(w5){let best=0;for(let i=1;i<5;i++)if(w5[i]>w5[best])best=i;return best;}
