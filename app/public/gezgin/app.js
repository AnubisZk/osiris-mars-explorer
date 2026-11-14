/* =============================================================================
 * OSIRISZK Mars Pathfinder 3D — v3.0 oyun döngüsü
 *  · Fizik ve enerji: sistemler.js (momentum teorisi, ρ = p/(R·T), Beer–Lambert güneş, Li-ion sıcaklık)
 *  · Gerçek zamanlı veri: veri.js (Perseverance MEDA; ulaşılamazsa yayımlanmış aralık)
 *  · Makine öğrenmesi: yz.js → EnerjiModeli (çevrimiçi RLS) otonom dönüş kararını verir
 *  · Derin öğrenme: yz.js → SpektrumSiniflandirici (8-16-16-3 MLP) her taramada numuneyi sınıflandırır
 *  · Ölçüler: modeller.json (takımın mimari çizimleri v1.0) — değerler tek kaynaktan okunur
 * Eğitim simülasyonudur; gerçek uçuş yazılımı değildir.
 * ========================================================================== */
import {Renderer,I,T,S,RX,RZ,TR,matmul,clamp,lerp,terrainHeight,transformPoint,angleDiff} from './engine.js';
import {GamepadInput,PAD} from './gamepad.js';
import {loadTerrainConfig,TERRAIN_CONFIG,materialWeights,fullWeights,dominantClass,setMaterialMap} from './materials.js';
import {blendSoil} from './terramechanics.js';
import {buildTerrainTextures,loadManifest} from './textures.js';
import {TARGETS,ENGELLER,GEZGIN_OLCU,TERRAIN_SPAN,terrainMeshHeight,buildTerrain,buildEnvironment,buildRover,buildDrone,buildExtra} from './scene.js';
import {SABIT,medaHava,basincPa,zeminRuzgari,havaSicakligiC,yogunluk,gunesGucu,gunesYukseklikSin,ROTOR,rotorGucu,maksItki,gerekliDevir,ucMach,
  pilKapasitesiWh,GEZGIN,zeminSurusu,ISI,bolmeSicakligi,baglantiKalitesi,firtinaDurumu,tahminiKalanUcusS} from './sistemler.js';
import {EnerjiModeli,siniflandiriciHazirla,spektrumUret,rastgele,SINIFLAR} from './yz.js';
import {canliHavaAl} from './veri.js';
import {loadMeda,MedaPanel,sample,flightStatus,windVector,clockText} from './meda.js';
import {t,dilAyarla,baslangicDili,sayfayiCevir,aktifDil} from './dil.js';

const SURUM='3.2';
// v2.4: üç grafik kalitesi (doku boyutu, arazi ağı, kaya sayısı). Seçim hatırlanır; ?kalite=low|medium|high
const QUALITY={
  low:{grid:110,tex:256,macro:256,pixelRatio:1.0,boulders:220,rockLevel:0,dustMax:50,trackMax:500,level:0,aniso:1,bump:0},
  medium:{grid:166,tex:512,macro:512,pixelRatio:1.45,boulders:490,rockLevel:1,dustMax:120,trackMax:1500,level:1,aniso:4,bump:.035},
  high:{grid:256,tex:1024,macro:1024,pixelRatio:2.0,boulders:900,rockLevel:1,dustMax:220,trackMax:2500,level:2,aniso:8,bump:.06}};
const KALITE_ANAHTAR='osiriszk.quality';
function kaliteOku(){try{const q=new URLSearchParams(location.search).get('kalite')||localStorage.getItem(KALITE_ANAHTAR);return QUALITY[q]?q:'medium';}catch{return'medium';}}
let kalite=kaliteOku(),kaliteMesgul=false;
const dunya={matTex:null,macroTex:null,macroAmt:.45,manifest:null,dokuKaynak:'procedural'};
const TEKER_GENISLIK=.08;
const $=id=>document.getElementById(id);
const canvas=$('glcanvas');
const keys=new Set();
// v2.3: Xbox / standart oyun kumandası; klavye ile tek bir analog girişte (−1…1) birleşir.
const gamepad=new GamepadInput({onConnect:()=>{addLog(t('l.kumandaBagli'),'success');notify(t('m.kumandaBagli'));},onDisconnect:()=>addLog(t('l.kumandaAyrildi'),'warn')});
const eksen=(arti,eksi)=>(arti.some(k=>keys.has(k))?1:0)-(eksi.some(k=>keys.has(k))?1:0);
function girdi(){const g=gamepad.connected?gamepad:null,c=v=>clamp(v,-1,1);
  return{drone:{fwd:c(eksen(['w','arrowup'],['s','arrowdown'])-(g?g.ly:0)),strafe:c(eksen(['d'],['a'])+(g?g.lx:0)),
      rise:c(eksen([' '],['shift'])+(g?g.rt-g.lt:0)),turn:c(eksen(['arrowleft','q'],['arrowright','e'])-(g?g.rx:0))},
    rover:{gaz:c(eksen(['w','arrowup'],['s','arrowdown'])+(g?g.rt-g.lt-g.ly:0)),direksiyon:c(eksen(['d','arrowright'],['a','arrowleft'])+(g?g.lx:0)),
      fren:keys.has(' ')||!!g?.held(PAD.B)}};}
const efekt={toz:[],izler:[],izSon:null,izKirli:false,izSaat:0,izSira:0,tozSaat:0};
const IZ_A=[.21,.095,.065],IZ_B=[.30,.14,.095];
const KAMERA_MODLARI=['cinematic','drone','rover','top'];
const pusula=yaw=>((-yaw*180/Math.PI)%360+360)%360;

// ------------------------------------------------------------- yapılandırma
/** modeller.json'dan okunan değerler; dosya açılamazsa (file://) aynı değerlerle devam edilir. */
const CFG={droneKg:1.8,rotorCapM:1.2,gezginKg:45,gezginWh:1200,gunesTepeW:120,sarjW:100,engelM:.30,egimDeg:30,gezginHiz:.10,degisimS:150};
const DRONE_PIL_WH=44.4;            // [K2] 6 × Sony VTC4, 25 °C
const SARJ_VERIM=.85;               // VARSAYIM: indüktif aktarım verimi
const DRONE_GUNES_TEPE_W=6;         // VARSAYIM: drone'un küçük paneli (yerde beklerken)
const DRONE_UYKU_W=3;               // VARSAYIM: yerde uyku modu tüketimi
const UPLINK_MBS=1.8;               // VARSAYIM (oyun değeri): Dünya bağlantısı, MB/s
const PAKET_MB={tarama:2.8,yuzey:1.4,foto:1.0};
const SEYIR=4, TIRMANMA=1, TARAMA_IRTIFA=5, REZERV=.3;
const LST0=9;                       // görev Jezero yerel saatiyle 09:00'da başlar (Ingenuity sabah uçardı)
const TASKIN=[1,5,20,60];
const ML_ANAHTAR='osiriszk3d:ml';

// ------------------------------------------------------------- durum
function yeniDurum(){return{
  surum:SURUM,time:0,running:true,warp:1,selected:'drone',cameraMode:'cinematic',auto:false,phase:'ready',targetIndex:0,phaseTime:0,
  hava:state?.hava??medaHava(),tohum:7,
  rover:{x:0,z:16,yaw:0,speed:0,tekerHizi:0,kayma:0,batmaM:0,cekisN:0,saplandi:false,saplanmaS:0,wheelAngle:0,enerjiWh:900,bolmeC:5,isiyor:false,uplink:false,uyariT:-99,pitch:0,roll:0},
  drone:{x:0,y:0,z:0,yaw:0,vx:0,vy:0,vz:0,enerjiWh:.6*DRONE_PIL_WH,pilC:5,docked:true,landed:false,rotorAngle:0,
    tw:0,gucW:0,devir:0,ucusS:0,dayaniklilik:100,dustu:false,carpmaT:-99,sicakUyari:false,baglanti:100,kopukS:0},
  raf:[{wh:44.4},{wh:44.4},{wh:20}],degisim:null,
  collected:[false,false,false],siniflar:[null,null,null],
  paketler:{drone:[],rover:[],gonderilen:[]},paketNo:0,fotoNo:0,
  firtina:false,sonuc:null,sonKarar:null,events:[],
  gucGecmis:[],telemetri:[],telT:0,mlT:0,
  camera:{yaw:.57,pitch:.37,distance:9,focus:[0,1,15],eye:[6,5,22],dragging:false,heading:0},
};}
let state=null;state=yeniDurum();
let renderer,assets={},model=new EnerjiModeli(),clf=null,fotolar=[],fotoIste=null;
let toastTimer=0,uiTimer=0,frameCount=0,fpsTime=0,lastFrame=0;

// ------------------------------------------------------------- yardımcılar
let saatKayma=0;                     // MEDA panelindeki saat kaydırıcısıyla ayarlanır (saat)
const lst=()=>((LST0+saatKayma+state.time*24/SABIT.SOL_S)%24+24)%24;
/* v3.3: MEDA ölçümü (sol 105–110, 10 dk medyan). Canlı veri gelmediyse oyunun havası bu ölçümlerden okunur;
 * ölçüm dosyası yoksa sistemler.js'teki harmonik model (MEDA_MODEL) yedektir. */
let medaPanel=null,olcumDk=-1,olcumSol=null,olcumDeger=null;
function olcum(){
  if(!medaPanel?.data||state.hava.kaynak==='canli')return null;
  const dk=Math.floor(lst()*60);
  if(dk!==olcumDk||medaPanel.sol!==olcumSol){olcumDk=dk;olcumSol=medaPanel.sol;olcumDeger=sample(medaPanel.data,medaPanel.sol,dk);}
  return olcumDeger;
}
const ucusDurumu=()=>{const o=olcum();return o?flightStatus(o):null;};
const ortamC=()=>olcum()?.t??havaSicakligiC(lst(),state.hava);
const basinc=()=>olcum()?.p??basincPa(lst(),state.hava);
const rho=()=>yogunluk(basinc(),ortamC());
/** Rüzgâr: MEDA modelinin o saatteki ortalaması; fırtınada fırtına rüzgârı (hangisi büyükse). */
const ruzgar=f=>Math.max(olcum()?.ws??zeminRuzgari(lst(),state.hava),f.aktif?f.ruzgarMs:0);
const firtina=()=>firtinaDurumu(state.time,state.tohum);
const droneKap=()=>pilKapasitesiWh(state.drone.pilC,DRONE_PIL_WH);
const dronePct=()=>100*state.drone.enerjiWh/DRONE_PIL_WH;
const roverPct=()=>100*state.rover.enerjiWh/CFG.gezginWh;
const ileri=yaw=>[-Math.sin(yaw),-Math.cos(yaw)];      // yerel −z (RY ile aynı yön)
const sag=yaw=>[Math.cos(yaw),-Math.sin(yaw)];         // yerel +x
const agl=()=>state.drone.docked?0:Math.max(0,state.drone.y-terrainHeight(state.drone.x,state.drone.z));
const yatay=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const f1=v=>Number(v).toFixed(1), f2=v=>Number(v).toFixed(2);
const saatYaz=h=>`${String(Math.floor(h)).padStart(2,'0')}:${String(Math.floor(h%1*60)).padStart(2,'0')}`;
const stamp=()=>{const s=Math.floor(state.time);return `${String(Math.floor(s/3600)).padStart(2,'0')}:${String(Math.floor(s/60)%60).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;};
const escapeHTML=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const yuzde=n=>aktifDil()==='tr'?`%${n}`:`${n}%`;
const hedefAdi=i=>t('zaman.kaya',{n:String(i+1).padStart(2,'0')});

function addLog(message,type='info'){
  state.events.unshift({stamp:stamp(),message,type});state.events=state.events.slice(0,60);renderLog();
}
function renderLog(){$('eventLog').innerHTML=state.events.slice(0,14).map(e=>`<div class="log-line ${e.type}"><b>${e.stamp}</b>${escapeHTML(e.message)}</div>`).join('');}
function notify(message){const el=$('toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),3200);}

const _w4=new Float32Array(4);
/** Altı tekerin altındaki zemin (5 sınıfın karışımı) ve gezginin ortalama karışımı. */
function tekerZeminleri(r){const c=Math.cos(r.yaw),s=Math.sin(r.yaw),karisim=[0,0,0,0,0],cls=TERRAIN_CONFIG.classes;
  const zeminler=assets.rover.wheelLocs.map(([lx,,lz])=>{const w5=fullWeights(materialWeights(r.x+lx*c+lz*s,r.z-lx*s+lz*c,_w4));for(let i=0;i<5;i++)karisim[i]+=w5[i]/6;return blendSoil(w5,cls);});
  return{zeminler,karisim};}
const zeminAdi=i=>t('zemin.'+TERRAIN_CONFIG.classes[i].key);
const zeminNoktasi=(x,z)=>blendSoil(fullWeights(materialWeights(x,z,_w4)),TERRAIN_CONFIG.classes);
/** Gezgin gövdesinin dünya matrisi: arazi eğimine göre yunuslama ve yalpa. */
function roverMatrix(){const r=state.rover;return matmul(matmul(TR(r.x,terrainHeight(r.x,r.z),r.z,r.yaw),RX(r.pitch)),RZ(r.roll));}
function roverEgim(){const r=state.rover,[fx,fz]=ileri(r.yaw),[sx,sz]=sag(r.yaw),L=GEZGIN_OLCU.aks,W=GEZGIN_OLCU.iz/2;
  const on=terrainHeight(r.x+fx*L,r.z+fz*L),arka=terrainHeight(r.x-fx*L,r.z-fz*L),sg=terrainHeight(r.x+sx*W,r.z+sz*W),sl=terrainHeight(r.x-sx*W,r.z-sz*W);
  r.pitch=Math.atan2(on-arka,2*L);r.roll=Math.atan2(sg-sl,2*W);}
const padPos=()=>transformPoint(roverMatrix(),[0,GEZGIN_OLCU.platformY,GEZGIN_OLCU.platformZ]);
const antenPos=()=>transformPoint(roverMatrix(),[-.30,GEZGIN_OLCU.mastY,-.45]);

/** UHF görüş hattı: gezgin anteni ile drone arasındaki doğruyu araziye karşı örnekler. */
function gorusVar(){const a=antenPos(),d=state.drone,b=[d.x,d.y+.45,d.z];
  for(let i=1;i<16;i++){const k=i/16,x=lerp(a[0],b[0],k),y=lerp(a[1],b[1],k),z=lerp(a[2],b[2],k);if(terrainHeight(x,z)>y)return false;}return true;}

// ------------------------------------------------------------- araç seçimi ve kamera
function selectVehicle(which,sessiz=false){
  state.selected=which;$('selectDrone').classList.toggle('selected',which==='drone');$('selectRover').classList.toggle('selected',which==='rover');
  for(const b of ['selectDrone','selectRover'])$(b).querySelector('.status-pill')?.remove();
  const badge=document.createElement('span');badge.className='status-pill';badge.textContent=t('arac.aktif');$(which==='drone'?'selectDrone':'selectRover').append(badge);
  if(!sessiz)addLog(t(which==='drone'?'aktif.arac.drone':'aktif.arac.gezgin'));
}
function setCamera(which){
  state.cameraMode=which;document.querySelectorAll('.camera-btn').forEach(b=>b.classList.toggle('active',b.dataset.camera===which));
  $('viewModeLabel').textContent=t('kamera.etiket.'+which);
  const c=state.camera;
  if(which==='top'){c.pitch=1.46;c.distance=48;}
  else if(which==='drone'){c.pitch=.30;c.distance=5;c.yaw=.5;c.heading=state.drone.yaw;}
  else if(which==='rover'){c.pitch=.30;c.distance=6.5;c.yaw=.42;c.heading=state.rover.yaw;}
  else{c.pitch=.33;c.distance=9;c.yaw=.57;}
}

// ------------------------------------------------------------- drone eylemleri
function kalkisEngeli(){
  const d=state.drone;
  if(state.sonuc==='basarisiz'||d.dustu)return t('m.dustu');
  if(!d.docked&&!d.landed)return t('m.ucusta');
  if(state.degisim)return t('m.degisimSuruyor');
  if(dronePct()<25)return t('m.pilAz');
  const dev=gerekliDevir({rho:rho()});
  if(dev>ROTOR.DEVIR_MAKS)return t('m.havaSeyrek',{d:Math.round(dev)});
  const f=firtina();if(f.aktif&&f.siddet>.3)return t('m.firtinaKalkis',{r:f1(f.ruzgarMs)});
  const u=ucusDurumu();if(u?.level==='no')return t('m.medaYasak',{r:u.reasons.join(', ')});
  return null;
}
function takeoff(){
  const neden=kalkisEngeli();if(neden){notify(neden);if(neden===t('m.medaYasak',{r:ucusDurumu()?.reasons.join(', ')}))addLog(`${neden} • ${clockText(lst()*60)} LMST`,'warn');return false;}
  {const u=ucusDurumu();if(u?.level==='marginal')addLog(t('l.medaMarjinal',{r:u.reasons.join(', ')}),'warn');}
  const d=state.drone;
  if(d.docked){const p=padPos();d.x=p[0];d.y=p[1]+.03;d.z=p[2];}
  else d.y+=.03;
  d.docked=false;d.landed=false;d.vx=d.vy=d.vz=0;d.ucusS=0;d.sicakUyari=false;
  if(state.warp!==1)setWarp(1);
  selectVehicle('drone',true);
  gamepad.rumble(.3,.65,380);
  addLog(t('l.kalkis',{d:Math.round(gerekliDevir({rho:rho()}))}),'success');notify(t('m.kalkis'));return true;
}
function dock(oto=false){
  const d=state.drone;
  if(d.docked){notify(t('m.zatenKenetli'));return true;}
  const p=padPos(),hd=Math.hypot(d.x-p[0],d.z-p[2]),vd=d.y-p[1];
  if(!oto&&(hd>.5||vd<-.05||vd>.4||Math.hypot(d.vx,d.vy,d.vz)>.6)){notify(t('m.kenetUzak'));return false;}
  d.docked=true;d.landed=false;d.vx=d.vy=d.vz=0;[d.x,d.y,d.z]=p;d.yaw=state.rover.yaw;
  const n=state.paketler.drone.length;state.paketler.rover.push(...state.paketler.drone);state.paketler.drone=[];
  gamepad.rumble(.75,.3,200);
  addLog(t('l.kenetlendi'),'success');notify(t('m.kenetlendi',{n}));
  try{localStorage.setItem(ML_ANAHTAR,JSON.stringify(model.durum()));}catch{}
  return true;
}
function swapBattery(){
  const d=state.drone;
  if(state.degisim){notify(t('m.degisimSuruyor'));return;}
  if(!d.docked){notify(t('m.degisimKenet'));return;}
  if(state.rover.bolmeC<ISI.DEGISIM_MIN_C){notify(t('m.degisimSoguk',{c:f1(state.rover.bolmeC)}));return;}
  let iyi=-1;state.raf.forEach((p,i)=>{if(p.wh>d.enerjiWh+1&&(iyi<0||p.wh>state.raf[iyi].wh))iyi=i;});
  if(iyi<0){notify(t('m.yedekYok'));return;}
  state.degisim={kalan:CFG.degisimS,idx:iyi};notify(t('m.degisimBasladi'));
}
function degisimBitir(){
  const d=state.drone,{idx}=state.degisim,eski=d.enerjiWh,yeni=state.raf[idx].wh;
  d.enerjiWh=yeni;state.raf[idx].wh=eski;state.degisim=null;
  gamepad.rumble(.2,.5,160);
  addLog(t('l.degisimBitti',{a:f1(eski),b:f1(yeni)}),'success');
}
function toggleUplink(){
  const r=state.rover;
  if(!r.uplink&&!state.paketler.rover.length){notify(t('m.veriYok'));return;}
  r.uplink=!r.uplink;notify(r.uplink?t('m.aktarimAcik',{n:state.paketler.rover.length}):t('m.aktarimKapali'));
}
function paketEkle(arac,tur,hedef){
  const p={id:++state.paketNo,tur,hedef,mb:PAKET_MB[tur],kalanMb:PAKET_MB[tur]};
  state.paketler[arac==='drone'?'drone':'rover'].push(p);return p;
}

// ------------------------------------------------------------- bilim: tarama + derin öğrenme
function siniflandiriciyiHazirla(){
  if(clf)return clf;
  const t0=performance.now();clf=siniflandiriciHazirla();
  addLog(t('l.dl',{d:(clf.dogruluk*100).toFixed(1)})+` · ${Math.round(performance.now()-t0)} ms`,'success');
  return clf;
}
/** Gözlemi sınıflandırır: drone yükseldikçe ve fırtınada gürültü artar; gezginin yakın ölçümü daha temizdir. */
function gozlemle(i,yontem){
  const sinif=SINIFLAR[i],r=rastgele(Math.floor(state.time*1000)+i*7919);
  const gurultu=yontem==='drone'?.02+.012*agl()+.06*firtina().siddet:.012;
  const sonuc=siniflandiriciyiHazirla().siniflandir(spektrumUret(sinif,r,gurultu));
  return{...sonuc,gercek:sinif,dogru:sonuc.sinif===sinif,gurultu};
}
function collect(i,yontem){
  if(state.collected[i])return;
  const g=gozlemle(i,yontem);state.collected[i]=true;state.siniflar[i]=g;
  paketEkle(yontem,yontem==='drone'?'tarama':'yuzey',hedefAdi(i));
  const v={label:hedefAdi(i),yontem:t('yontem.'+(yontem==='drone'?'drone':'gezgin')),sinif:t('sinif.'+g.sinif),guven:Math.round(g.guven*100)};
  gamepad.rumble(.25,.85,260);
  addLog(t('l.tarandi',v),g.dogru?'success':'warn');notify(t('m.tarandi',v));
}
function scan(){
  if(state.sonuc){notify(t('m.bitti'));return;}
  const d=state.drone,r=state.rover,isDrone=state.selected==='drone',src=isDrone?d:r,menzil=isDrone?5:3.5;
  const near=TARGETS.map((s,i)=>({i,dist:Math.hypot(s.x-src.x,s.z-src.z)})).sort((a,b)=>a.dist-b.dist)[0];
  if(!near||near.dist>menzil){notify(t('m.yaklas',{m:menzil}));return;}
  if(isDrone&&(d.docked||d.landed||agl()<1.2)){notify(t('m.alcak'));return;}
  if(state.collected[near.i]){notify(t('m.taranmis'));return;}
  collect(near.i,isDrone?'drone':'rover');
}
function photo(){fotoIste=state.selected;}
function fotoKaydet(){
  const arac=fotoIste;fotoIste=null;
  try{
    const url=canvas.toDataURL('image/jpeg',.82);state.fotoNo++;
    fotolar.unshift({url,no:state.fotoNo,lst:saatYaz(lst()),arac,zaman:stamp()});fotolar=fotolar.slice(0,12);
    paketEkle(arac==='drone'&&!state.drone.docked?'drone':'rover','foto',`IMG ${state.fotoNo}`);
    notify(t('m.foto',{n:state.fotoNo}));
  }catch(e){notify(e.message);}
}

// ------------------------------------------------------------- makine öğrenmesi: otonom karar
/** Model yeterince öğrenmediyse (120 örnekten az) aynı bacak hesabı fizik modeliyle yapılır. */
function bacakWh({mesafeM,irtifaDegisimM}){
  const ro=rho(),ruzgar=firtina().ruzgarMs;
  if(model.hazir)return{wh:model.bacakEnerjisi({mesafeM,irtifaDegisimM,seyirHizi:SEYIR,tirmanma:TIRMANMA,rho:ro,ruzgar}),kaynak:'ML'};
  const W=CFG.droneKg*SABIT.g,tY=mesafeM/SEYIR,tD=Math.abs(irtifaDegisimM)/TIRMANMA;
  const pY=rotorGucu({itkiN:W,rho:ro,rotorCapM:CFG.rotorCapM,yatayHizMs:SEYIR}),pD=rotorGucu({itkiN:W,rho:ro,rotorCapM:CFG.rotorCapM,tirmanmaMs:irtifaDegisimM>0?TIRMANMA:0});
  return{wh:(pY*tY+pD*tD)/3600,kaynak:t('yz.yedek')};
}
function hoverWh(saniye){
  const ro=rho();
  const p=model.hazir?model.tahmin({yatayHiz:0,dikeyHiz:0,rho:ro,ruzgar:firtina().ruzgarMs}):rotorGucu({itkiN:CFG.droneKg*SABIT.g,rho:ro,rotorCapM:CFG.rotorCapM});
  return p*saniye/3600;
}
/** Bir sonraki hedefe gidip tarayıp gezgine dönmek kullanılabilir enerjiye sığıyor mu? */
function mlKarar(i){
  const d=state.drone,s=TARGETS[i],p=padPos();
  const hedefY=terrainHeight(s.x,s.z)+TARAMA_IRTIFA;
  const git=bacakWh({mesafeM:Math.hypot(s.x-d.x,s.z-d.z),irtifaDegisimM:hedefY-d.y});
  const don=bacakWh({mesafeM:Math.hypot(s.x-p[0],s.z-p[2]),irtifaDegisimM:p[1]-hedefY});
  const gerek=git.wh+hoverWh(6)+don.wh+hoverWh(12);
  const kullanilabilir=d.enerjiWh-REZERV*droneKap();
  const devam=gerek<kullanilabilir;
  state.sonKarar={hedef:hedefAdi(i),gerek,kullanilabilir,devam,kaynak:git.kaynak};
  addLog(t('l.mlKarar',{hedef:hedefAdi(i),e:f1(gerek),k:f1(kullanilabilir),karar:t(devam?'karar.devam':'karar.don')})+` [${git.kaynak}]`,devam?'info':'warn');
  return devam;
}

// ------------------------------------------------------------- otopilot
function startMission(){
  if(state.auto){state.auto=false;state.phase='manual';addLog(t('l.otonomDurdu'),'warn');notify(t('m.otonomDurdu'));return;}
  if(state.sonuc){notify(t('m.bitti'));return;}
  if(state.collected.every(Boolean)){notify(t('m.hepsiToplandi'));return;}
  const d=state.drone;
  if(d.docked||d.landed){if(!takeoff())return;}
  state.auto=true;setAutoPhase('takeoff');state.targetIndex=state.collected.findIndex(v=>!v);
  selectVehicle('drone',true);setCamera('drone');addLog(t('l.otonomBasla'),'success');notify(t('m.otonomBasla'));
}
function setAutoPhase(phase){state.phase=phase;state.phaseTime=0;}
function donuseGec(anahtar){if(!['return','land'].includes(state.phase)){setAutoPhase('return');if(anahtar)addLog(t(anahtar),'warn');}}
function sonrakiHedef(){
  const next=state.collected.findIndex(v=>!v);
  if(next<0){donuseGec();addLog(t('l.hepsiTarandi'),'success');return;}
  state.targetIndex=next;
  if(mlKarar(next))setAutoPhase('travel');else donuseGec();
}
function autoVelocity(dt){
  const d=state.drone;state.phaseTime+=dt;
  const kap=droneKap();
  if(d.enerjiWh<.18*kap)donuseGec('l.kritik');
  if(firtina().aktif&&firtina().siddet>.3&&!['return','land'].includes(state.phase))donuseGec('l.firtinaDonus');
  if(ucusDurumu()?.level==='no'&&!['return','land'].includes(state.phase))donuseGec('l.medaDonus');
  let dest=null,hiz=SEYIR,dikeyMaks=TIRMANMA;
  const zemin=terrainHeight(d.x,d.z);
  if(state.phase==='takeoff'){
    dest={x:d.x,y:Math.max(padPos()[1]+3,zemin+3),z:d.z};hiz=0;
    if(Math.abs(d.y-dest.y)<.2)sonrakiHedef();
  }else if(state.phase==='travel'){
    const s=TARGETS[state.targetIndex];if(!s){donuseGec();return[0,0,0];}
    dest={x:s.x,y:Math.max(terrainHeight(s.x,s.z)+TARAMA_IRTIFA,zemin+3),z:s.z};
    if(yatay(d,dest)<.8&&Math.abs(d.y-dest.y)<.5){setAutoPhase('scan');addLog(t('l.taramaBasla',{label:hedefAdi(state.targetIndex)}));}
  }else if(state.phase==='scan'){
    const s=TARGETS[state.targetIndex];dest={x:s.x,y:terrainHeight(s.x,s.z)+TARAMA_IRTIFA,z:s.z};
    if(state.phaseTime>=4){collect(state.targetIndex,'drone');sonrakiHedef();}
  }else if(state.phase==='return'){
    const p=padPos();dest={x:p[0],y:Math.max(p[1]+2.5,zemin+3),z:p[2]};
    if(yatay(d,dest)<.25&&Math.abs(d.y-dest.y)<.4)setAutoPhase('land');
  }else if(state.phase==='land'){
    const p=padPos();dest={x:p[0],y:p[1],z:p[2]};hiz=.6;dikeyMaks=clamp((d.y-p[1])*.8,.15,.6);
    if(Math.hypot(d.x-p[0],d.z-p[2])<.12&&d.y-p[1]<.05){
      dock(true);state.auto=false;setAutoPhase(state.collected.every(Boolean)?'completed':'ready');addLog(t('l.inis'),'success');notify(t('m.inis'));return[0,0,0];
    }
  }
  if(!dest)return[0,0,0];
  const dx=dest.x-d.x,dz=dest.z-d.z,dy=dest.y-d.y,h=Math.hypot(dx,dz);
  const v=Math.min(hiz,h*1.2);
  return[h>.01?dx/h*v:0,clamp(dy*1.2,-dikeyMaks,dikeyMaks),h>.01?dz/h*v:0];
}

// ------------------------------------------------------------- fizik adımı
function adim(dt){
  state.time+=dt;
  const r=state.rover,d=state.drone,pressed=k=>keys.has(k);
  const saat=lst(),hava=ortamC(),ro=rho(),f=firtina();
  if(f.aktif!==state.firtina){state.firtina=f.aktif;addLog(f.aktif?t('l.firtina',{r:f1(f.ruzgarMs)}):t('l.firtinaBitti'),f.aktif?'warn':'success');}

  // --- gezgin hareketi (en fazla 0,10 m/s, 0,30 m engel, 30° eğim)
  const gg=girdi().rover,fwd=gg.fren?0:gg.gaz,don=gg.direksiyon;   // SPACE / B: fren
  let tekerW=0;
  if(state.selected==='rover'&&r.enerjiWh>5&&!state.sonuc){
    // motorlar teker çevre hızını sürer; gerçek hız zemindeki kaymaya göre düşer (terramekanik, v2.4)
    r.tekerHizi=lerp(r.tekerHizi,fwd*CFG.gezginHiz,clamp(dt*(gg.fren?8:2),0,1));
    if(Math.abs(r.tekerHizi)>.002||don){
      r.yaw-=don*dt*.25;
      const [fx,fz]=ileri(r.yaw),egimF=Math.atan2(terrainHeight(r.x+fx*.7,r.z+fz*.7)-terrainHeight(r.x-fx*.7,r.z-fz*.7),1.4);
      const zs=zeminSurusu({zeminler:tekerZeminleri(r).zeminler,kutleKg:CFG.gezginKg,tekerHizi:r.tekerHizi,egimRad:egimF,capM:GEZGIN_OLCU.tekerYaricap*2,genislikM:TEKER_GENISLIK});
      r.speed=zs.hiz;r.kayma=zs.kayma;r.batmaM=zs.batmaM;r.cekisN=zs.cekisN;
      if(zs.saplandi&&Math.abs(fwd)>.3){r.saplanmaS+=dt;if(r.saplanmaS>3&&!r.saplandi){r.saplandi=true;gamepad.rumble(.6,.2,300);
        addLog(t('l.saplandi',{zemin:zeminAdi(dominantClass(tekerZeminleri(r).karisim))}),'warn');notify(t('m.saplandi'));}}
      else{r.saplanmaS=0;if(Math.abs(r.speed)>.01)r.saplandi=false;}
      const nx=clamp(r.x+fx*r.speed*dt,-93,93),nz=clamp(r.z+fz*r.speed*dt,-93,93);
      const engel=ENGELLER.find(e=>e.h>CFG.engelM&&Math.hypot(nx-e.x,nz-e.z)<e.r+.8&&Math.hypot(nx-e.x,nz-e.z)<Math.hypot(r.x-e.x,r.z-e.z));
      const isaret=Math.sign(r.tekerHizi)||1,egim=Math.atan2(terrainHeight(nx+fx*.7*isaret,nz+fz*.7*isaret)-terrainHeight(nx-fx*.7*isaret,nz-fz*.7*isaret),1.4);
      const egimDeg=Math.abs(egim)*180/Math.PI;
      if(engel||egimDeg>CFG.egimDeg){
        r.speed=0;r.tekerHizi=0;if(state.time-r.uyariT>6){r.uyariT=state.time;notify(engel?t('m.engel',{h:f2(engel.h)}):t('m.egim',{e:Math.round(egimDeg)}));}
      }else{
        r.x=nx;r.z=nz;r.wheelAngle+=r.tekerHizi*dt/GEZGIN_OLCU.tekerYaricap;
        tekerW=Math.max(0,zs.direncN)*Math.abs(r.tekerHizi)/GEZGIN.VERIM;     // kayma kaybı dahil: iş teker hızında yapılır
      }
    }else{r.speed=0;r.kayma=0;}
  }else{r.tekerHizi=lerp(r.tekerHizi,0,Math.min(1,dt*4));r.speed=0;r.kayma=0;}
  roverEgim();

  // --- ısı bölmesi (termostatlı ısıtıcı)
  const b=bolmeSicakligi({bolmeC:r.bolmeC,ortamC:hava,isiticiAcik:r.enerjiWh>20,dt});r.bolmeC=b.bolmeC;r.isiyor=b.isiyor;

  // --- pil değişimi
  if(state.degisim){state.degisim.kalan-=dt;if(state.degisim.kalan<=0)degisimBitir();}

  // --- şarj: drone kenetliyken 100 W indüktif; drone doluysa raftaki yedekler. Li-ion 0 °C altında şarj edilmez.
  let sarjW=0;
  if(d.docked&&!state.degisim&&r.bolmeC>=ISI.SARJ_MIN_C&&r.enerjiWh>50){
    const kap=droneKap();
    if(d.enerjiWh<kap-.02){sarjW=CFG.sarjW;d.enerjiWh=Math.min(kap,d.enerjiWh+sarjW*SARJ_VERIM*dt/3600);}
    else{const p=state.raf.find(p=>p.wh<pilKapasitesiWh(r.bolmeC)-.02);if(p){sarjW=CFG.sarjW;p.wh=Math.min(pilKapasitesiWh(r.bolmeC),p.wh+sarjW*SARJ_VERIM*dt/3600);}}
  }

  // --- Dünya bağlantısı
  let uplinkW=0;
  if(r.uplink){
    const q=state.paketler.rover;
    if(!q.length||r.enerjiWh<20){r.uplink=false;addLog(t('m.aktarimKapali'));}
    else{uplinkW=GEZGIN.UPLINK_W;let kalan=UPLINK_MBS*dt;
      while(kalan>0&&q.length){const p=q[0],x=Math.min(kalan,p.kalanMb);p.kalanMb-=x;kalan-=x;
        if(p.kalanMb<=1e-6){q.shift();state.paketler.gonderilen.push(p);addLog(t('l.paketGitti',{id:p.id,hedef:p.hedef}),'success');}}}
  }

  // --- gezgin enerji dengesi
  const gunesW=gunesGucu(CFG.gunesTepeW,saat,state.hava,f.tozCarpani);
  const yukW=GEZGIN.AVIYONIK_W+(r.isiyor?GEZGIN.ISITICI_W:0)+tekerW+uplinkW+sarjW;
  r.enerjiWh=clamp(r.enerjiWh+(gunesW-yukW)*dt/3600,0,CFG.gezginWh);
  r.gunesW=gunesW;r.yukW=yukW;r.sarjW=sarjW;

  // --- drone
  if(d.docked){
    const p=padPos();[d.x,d.y,d.z]=p;d.yaw=r.yaw;d.vx=d.vy=d.vz=0;d.tw=0;d.gucW=0;d.devir=0;d.pilC=r.bolmeC;d.baglanti=100;
  }else if(d.landed||d.dustu){
    d.vx=d.vy=d.vz=0;d.tw=0;d.gucW=0;d.devir=0;
    d.pilC=bolmeSicakligi({bolmeC:d.pilC,ortamC:hava,isiticiAcik:false,dt}).bolmeC;
    if(!d.dustu)d.enerjiWh=clamp(d.enerjiWh+(gunesGucu(DRONE_GUNES_TEPE_W,saat,state.hava,f.tozCarpani)-DRONE_UYKU_W)*dt/3600,0,droneKap());
    d.baglanti=baglantiKalitesi(Math.hypot(d.x-r.x,d.z-r.z),gorusVar());
  }else droneUcus(dt,ro,hava,f);
  d.pilC=d.docked?r.bolmeC:d.pilC;
  if(d.enerjiWh>droneKap())d.enerjiWh=droneKap();
  d.rotorAngle+=dt*(d.docked||d.landed||d.dustu?0:2400*Math.PI*2/60*.10); // görüntüde yavaşlatılmış dönüş

  // --- telemetri (1 s'de bir) ve görev sonucu
  state.telT+=dt;
  if(state.telT>=1){state.telT=0;telemetriKaydet(saat,hava,ro,f);}
  sonucDenetle();
}

function droneUcus(dt,ro,hava,f){
  const d=state.drone,pressed=k=>keys.has(k),W=CFG.droneKg*SABIT.g;
  d.ucusS+=dt;
  if(d.ucusS>170&&!d.sicakUyari){d.sicakUyari=true;addLog(t('l.motorSicak',{s:Math.round(d.ucusS)}),'warn');}
  // bağlantı: görüş hattı yoksa ya da menzil dışıysa 2 s sonra otonom dönüş (güvenli mod)
  d.baglanti=baglantiKalitesi(Math.hypot(d.x-state.rover.x,d.z-state.rover.z),gorusVar());
  d.kopukS=d.baglanti===0?d.kopukS+dt:0;
  if(d.kopukS>2&&!['return','land'].includes(state.phase)){state.auto=true;setAutoPhase('return');addLog(t('l.baglantiYok'),'warn');}

  let istek=[0,0,0];
  if(state.auto){istek=autoVelocity(dt);if(d.docked)return;}
  else if(state.selected==='drone'){
    // v2.3: W/S burnun yönünde, A/D yana kayma, ←/→ (Q/E) kendi ekseninde dönüş; kumandada analog
    const gd=girdi().drone;d.yaw+=gd.turn*dt*.9;
    const fw=gd.fwd,st=gd.strafe,rise=gd.rise,[fx,fz]=ileri(d.yaw),[sx,sz]=sag(d.yaw);
    istek=[(fx*fw+sx*st)*SEYIR,rise*1.5,(fz*fw+sz*st)*SEYIR];
  }
  // fırtına rüzgârı: sabit yönlü sürüklenme (VARSAYIM: rüzgârın %15'i)
  const suruklenme=f.aktif?f.ruzgarMs*.15:0;
  // v3.3: MEDA'da ölçülen rüzgâr (hız + yön) de hafif sürükler (VARSAYIM: rüzgârın %4,5'i; kuzey = −z)
  const o=olcum(),[rx,rz]=o?windVector((o.ws??0)*.045,o.wd):[0,0];
  const ax=(istek[0]+suruklenme*.8+rx-d.vx)*Math.min(1,dt*3.2),az=(istek[2]+suruklenme*.6+rz-d.vz)*Math.min(1,dt*3.2);
  let ay=(istek[1]-d.vy)*Math.min(1,dt*2.8)/Math.max(dt,1e-4);
  // itki sınırı: T_maks ∝ ρΩ² (2700 dev/dk); itki-ağırlık oranı bunu aşamaz
  const Tmaks=maksItki({kutleKg:CFG.droneKg,rho:ro}),ayMaks=Tmaks/CFG.droneKg-SABIT.g;
  ay=clamp(ay,-SABIT.g*.9,ayMaks);
  if(d.enerjiWh<=0){ay=-SABIT.g*.85;}
  d.vx+=ax;d.vz+=az;d.vy+=ay*dt;
  const yh=Math.hypot(d.vx,d.vz);
  const itki=Math.max(.05*W,CFG.droneKg*(SABIT.g+ay));
  let P=d.enerjiWh>0?rotorGucu({itkiN:itki,rho:ro,rotorCapM:CFG.rotorCapM,tirmanmaMs:d.vy,yatayHizMs:yh}):0;
  if(P>ROTOR.TEPE_GUC_W){P=ROTOR.TEPE_GUC_W;d.vy=Math.min(d.vy,.5);}
  d.gucW=P;d.tw=itki/W;d.devir=d.enerjiWh>0?gerekliDevir({rho:ro})*Math.sqrt(Math.max(.05,d.tw)):0;
  d.enerjiWh=Math.max(0,d.enerjiWh-P*dt/3600);
  d.pilC=bolmeSicakligi({bolmeC:d.pilC,ortamC:hava,isiticiAcik:false,dt}).bolmeC;

  // makine öğrenmesi: ölçülen güç ile modeli 5 Hz'de güncelle
  state.mlT+=dt;
  if(state.mlT>=.2&&P>0){
    state.mlT=0;const kosul={yatayHiz:yh,dikeyHiz:d.vy,rho:ro,ruzgar:ruzgar(f)};
    const tahmin=model.tahmin(kosul);model.ogren(kosul,P);
    state.gucGecmis.push({t:state.time,P,tahmin});if(state.gucGecmis.length>150)state.gucGecmis.shift();
  }

  // konum + arazi/engel temasları
  const ox=d.x,oz=d.z;
  d.x=clamp(d.x+d.vx*dt,-96,96);d.z=clamp(d.z+d.vz*dt,-96,96);d.y+=d.vy*dt;
  for(const e of ENGELLER){
    if(Math.hypot(d.x-e.x,d.z-e.z)<e.r+.3&&d.y-terrainHeight(e.x,e.z)<e.h){
      d.x=ox;d.z=oz;d.vx*=-.3;d.vz*=-.3;
      if(state.time-d.carpmaT>1.5){d.carpmaT=state.time;d.dayaniklilik-=15;addLog(t('l.carpma'),'warn');}
      break;
    }
  }
  const zemin=terrainHeight(d.x,d.z);
  if(d.y>zemin+40){d.y=zemin+40;d.vy=Math.min(0,d.vy);}
  // platforma yumuşak temas → kenetlenme
  const p=padPos();
  if(!state.auto&&Math.hypot(d.x-p[0],d.z-p[2])<.3&&d.y<=p[1]+.02&&d.y>p[1]-.15&&d.vy<=0){
    if(-d.vy>1)sertInis(-d.vy);
    d.y=p[1];dock(true);return;
  }
  if(d.y<=zemin){
    const carpma=-d.vy;d.y=zemin;d.vx=d.vy=d.vz=0;
    if(d.enerjiWh<=0){d.dustu=true;state.auto=false;addLog(t('l.pilBitti'),'warn');return;}
    if(carpma>1)sertInis(carpma);
    if(carpma>.05||(!state.auto&&girdi().drone.rise<=.1)){d.landed=true;state.auto=false;setAutoPhase('manual');addLog(t('l.indi'),'warn');}
  }
}
function sertInis(v){gamepad.rumble(1,1,300);const h=Math.round((v-1)*40);state.drone.dayaniklilik-=h;addLog(t('l.sertInis',{v:f2(v),h}),'warn');}

function sonucDenetle(){
  if(state.sonuc)return;
  const d=state.drone;
  if(d.dustu||d.dayaniklilik<=0){
    state.sonuc='basarisiz';state.auto=false;setAutoPhase('failed');
    addLog(t('l.basarisiz',{neden:t(d.dustu?'neden.dusme':'neden.hasar')}),'warn');notify(t('m.dustu'));return;
  }
  const q=state.paketler;
  if(state.collected.every(Boolean)&&d.docked&&!q.drone.length&&!q.rover.length&&q.gonderilen.filter(p=>p.tur!=='foto').length>=3){
    state.sonuc='basari';state.auto=false;setAutoPhase('completed');addLog(t('l.basari'),'success');notify(t('m.basari'));
  }
}
function telemetriKaydet(saat,hava,ro,f){
  const d=state.drone,r=state.rover;
  state.telemetri.push([state.time.toFixed(0),saatYaz(saat),hava.toFixed(1),ro.toFixed(4),f.aktif?1:0,ruzgar(f).toFixed(1),
    d.docked?'kenetli':d.landed?'yerde':d.dustu?'dustu':'ucus',d.x.toFixed(2),d.y.toFixed(2),d.z.toFixed(2),agl().toFixed(2),
    Math.hypot(d.vx,d.vz).toFixed(2),d.vy.toFixed(2),d.gucW.toFixed(1),Math.round(d.devir),d.enerjiWh.toFixed(2),d.pilC.toFixed(1),d.baglanti,
    r.x.toFixed(2),r.z.toFixed(2),r.enerjiWh.toFixed(1),(r.gunesW||0).toFixed(1),(r.yukW||0).toFixed(1),r.bolmeC.toFixed(1),state.phase]);
  if(state.telemetri.length>20000)state.telemetri.shift();
}

// ------------------------------------------------------------- zaman
function setWarp(x){
  if(x!==1&&!state.drone.docked){notify(t('m.hizKenet'));x=1;}
  state.warp=x;$('warpBtn').textContent=t('dugme.hizlandir',{x});$('warpBtn').classList.toggle('amber',x>1);
  if(x>1)notify(t('m.hiz',{x}));
}
const cycleWarp=()=>setWarp(TASKIN[(TASKIN.indexOf(state.warp)+1)%TASKIN.length]);
function togglePause(){state.running=!state.running;$('pauseBtn').textContent=t(state.running?'dugme.duraklat':'dugme.devam');notify(t(state.running?'m.devam':'m.duraklat'));}
function updatePhysics(gercekDt){
  if(!state.running)return;
  if(state.warp>1&&!state.drone.docked)setWarp(1);
  const sim=gercekDt*state.warp,parca=state.drone.docked?.5:1/60,n=Math.max(1,Math.ceil(sim/parca));
  for(let i=0;i<n;i++)adim(sim/n);
}

// ------------------------------------------------------------- görsel efektler (v2.3): rotor tozu ve tekerlek izi
function tozEkle(x,z,vx,vy,vz,boy,omur){if(efekt.toz.length>QUALITY[kalite].dustMax)efekt.toz.shift();efekt.toz.push({x,y:terrainMeshHeight(x,z)+.05,z,vx,vy,vz,boy,yas:0,omur});}
function izSeritleri(r){const c=Math.cos(r.yaw),s=Math.sin(r.yaw),pt=(lx,lz)=>[r.x+lx*c+lz*s,r.z-lx*s+lz*c],x=GEZGIN_OLCU.iz/2;return[pt(-x,GEZGIN_OLCU.aks),pt(x,GEZGIN_OLCU.aks)];}
function izBirak(r){
  const [L,R]=izSeritleri(r),son=efekt.izSon;
  if(!son){efekt.izSon={L,R};return;}
  const yol=Math.max(Math.hypot(L[0]-son.L[0],L[1]-son.L[1]),Math.hypot(R[0]-son.R[0],R[1]-son.R[1]));
  if(yol<.12)return;
  if(yol<2&&zeminNoktasi(r.x,r.z).track>.05){const col=(efekt.izSira++&1)?IZ_A:IZ_B,data=new Float32Array(108);let o=0;
    const koy=(x,z)=>{data.set([x,terrainMeshHeight(x,z)+.02,z,0,1,0,col[0],col[1],col[2]],o);o+=9;};
    for(const [a,b] of [[son.L,L],[son.R,R]]){const dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz)||1,nx=-dz/l*.045,nz=dx/l*.045;
      koy(a[0]+nx,a[1]+nz);koy(b[0]+nx,b[1]+nz);koy(b[0]-nx,b[1]-nz);koy(a[0]+nx,a[1]+nz);koy(b[0]-nx,b[1]-nz);koy(a[0]-nx,a[1]-nz);}
    efekt.izler.push(data);if(efekt.izler.length>QUALITY[kalite].trackMax)efekt.izler.shift();efekt.izKirli=true;}
  efekt.izSon={L,R};
}
function efektleriTemizle(){efekt.toz.length=0;efekt.izler.length=0;efekt.izSon=null;efekt.izKirli=true;}
function efektleriGuncelle(dt){
  const d=state.drone;
  if(state.running){
    izBirak(state.rover);
    const a=agl();   // alçak uçuşta rotor akımı yerden toz kaldırır
    if(!d.docked&&!d.landed&&!d.dustu&&a<2.5){efekt.tozSaat+=dt*(2.5-a)*6*zeminNoktasi(d.x,d.z).dust;
      while(efekt.tozSaat>=1){efekt.tozSaat-=1;const w=Math.random()*Math.PI*2,rad=.3+Math.random()*.5,ox=Math.cos(w),oz=Math.sin(w);
        tozEkle(d.x+ox*rad,d.z+oz*rad,ox*(.9+Math.random()*.7),.06+Math.random()*.18,oz*(.9+Math.random()*.7),.09+Math.random()*.07,1+Math.random()*.6);}}
    for(const p of efekt.toz){p.yas+=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;const sur=Math.max(0,1-dt*1.6);p.vx*=sur;p.vz*=sur;p.vy=p.vy*sur-.05*dt;}
    efekt.toz=efekt.toz.filter(p=>p.yas<p.omur);
  }
  efekt.izSaat+=dt;
  if(efekt.izKirli&&efekt.izSaat>.15){const hepsi=new Float32Array(efekt.izler.length*108);efekt.izler.forEach((seg,i)=>hepsi.set(seg,i*108));renderer.update(assets.extra.tracks,hepsi);efekt.izKirli=false;efekt.izSaat=0;}
}
// ------------------------------------------------------------- oyun kumandası (v2.3)
let rtOnceki=0;
function kumanda(dt){
  if(!gamepad.poll())return;
  const g=gamepad,c=state.camera,help=$('helpOverlay'),gal=$('galleryOverlay');
  if(!help.hidden||!gal.hidden){if(g.pressed(PAD.A)||g.pressed(PAD.B)||g.pressed(PAD.VIEW)){help.hidden=true;gal.hidden=true;}return;}
  if(g.pressed(PAD.VIEW)){help.hidden=false;return;}
  if(g.pressed(PAD.MENU))togglePause();
  const yerde=state.drone.docked||state.drone.landed;
  if(g.pressed(PAD.A)){if(yerde)takeoff();else dock();}
  if(g.rt>.5&&rtOnceki<=.5&&state.selected==='drone'&&yerde)takeoff();
  rtOnceki=g.rt;
  if(g.pressed(PAD.X))scan();
  if(g.pressed(PAD.Y))selectVehicle(state.selected==='drone'?'rover':'drone');
  if(g.pressed(PAD.LB))swapBattery();
  if(g.pressed(PAD.UP))startMission();
  if(g.pressed(PAD.DOWN))toggleUplink();
  if(g.pressed(PAD.LEFT)||g.pressed(PAD.RIGHT)){const i=KAMERA_MODLARI.indexOf(state.cameraMode);setCamera(KAMERA_MODLARI[(i+(g.pressed(PAD.RIGHT)?1:3))%4]);}
  if(g.pressed(PAD.RS)){c.zoomStep=((c.zoomStep||0)+1)%3;c.distance=clamp(c.distance*[1/1.75,.55,1.75/.55][c.zoomStep],1.8,88);}
  if(state.selected==='rover'&&g.rx)c.yaw-=g.rx*dt*2.2;      // sağ çubuk: gezginde kamerayı çevirir
  if(g.ry)c.pitch=clamp(c.pitch+g.ry*dt*1.1,.08,1.53);
  if(state.auto&&state.selected==='drone'&&(Math.hypot(g.lx,g.ly)>.35||Math.abs(g.rx)>.35||g.rt>.3||g.lt>.3)){
    state.auto=false;setAutoPhase('manual');addLog(t('l.manuel'),'warn');notify(t('m.manuel'));}
}

// ------------------------------------------------------------- çizim
function cameraFrame(dt){
  const c=state.camera,d=state.drone,r=state.rover,ry=terrainHeight(r.x,r.z);
  let target;
  if(state.cameraMode==='drone')target=[d.x,d.y+.25,d.z];
  else if(state.cameraMode==='rover')target=[r.x,ry+.6,r.z];
  else if(state.cameraMode==='top')target=[(d.x+r.x)*.5,1,(d.z+r.z)*.5];
  else{const p=state.selected==='drone'?[d.x,d.y+.2,d.z]:[r.x,ry+.5,r.z];target=p;}
  const blend=clamp(dt*2.8,0,1);c.focus=c.focus.map((v,i)=>lerp(v,target[i],blend));
  // v2.3 takip kamerası: drone/gezgin kamerası aracın arkasına gecikmeli döner (c.yaw burada sapma açısıdır)
  const takip=state.cameraMode==='drone'?d.yaw:state.cameraMode==='rover'?r.yaw:null;
  if(takip!==null)c.heading+=angleDiff(takip,c.heading)*clamp(dt*1.7,0,1);
  const p=c.pitch,y=takip!==null?c.heading+c.yaw:c.yaw,dist=c.distance;
  const dest=[c.focus[0]+Math.sin(y)*Math.cos(p)*dist,c.focus[1]+Math.sin(p)*dist,c.focus[2]+Math.cos(y)*Math.cos(p)*dist];
  c.eye=c.eye.map((v,i)=>lerp(v,dest[i],Math.min(1,dt*3.1)));
  c.eye[1]=Math.max(c.eye[1],terrainHeight(c.eye[0],c.eye[2])+.6);
  return{eye:c.eye,target:c.focus};
}
function drawScene(dt){
  const{eye,target}=cameraFrame(dt);
  const mu=gunesYukseklikSin(lst(),state.hava.ls);
  renderer.evening=clamp((.3-mu)/.3,0,1)*.82;
  renderer.begin(eye,target,state.time);
  renderer.drawTerrain(assets.terrain,{matTex:dunya.matTex,macroTex:dunya.macroTex,tiles:TERRAIN_CONFIG.classes.map(c=>c.tile_m),level:QUALITY[kalite].level,mapHalf:TERRAIN_SPAN/2,macroAmt:dunya.macroAmt,bump:QUALITY[kalite].bump});
  renderer.draw(assets.environment.scenery,I());renderer.draw(assets.environment.route,I(),.56,.14);
  renderer.draw(assets.extra.tracks,I(),.62);
  const r=state.rover,d=state.drone,rm=roverMatrix(),ry=terrainHeight(r.x,r.z);
  renderer.draw(assets.drone.shadow,matmul(T(r.x,ry+.03,r.z),S(1.6,1,1.9)),.33);
  renderer.draw(assets.rover.body,rm);
  for(const [x,y,z] of assets.rover.wheelLocs)renderer.draw(assets.rover.wheel,matmul(matmul(rm,T(x,y,z)),RX(r.wheelAngle)));
  renderer.draw(assets.extra.pad,matmul(rm,T(0,GEZGIN_OLCU.platformY+.012,GEZGIN_OLCU.platformZ)),1,.3);
  if(!d.docked){const zh=terrainHeight(d.x,d.z),k=clamp(1-(d.y-zh)/25,.35,1);renderer.draw(assets.drone.shadow,matmul(T(d.x,zh+.04,d.z),S(k,1,k)),.3*k);}
  let dm=d.docked?matmul(rm,matmul(T(0,GEZGIN_OLCU.platformY,GEZGIN_OLCU.platformZ),I())):TR(d.x,d.y,d.z,d.yaw);
  if(!d.docked&&!d.landed){
    const [fx,fz]=ileri(d.yaw),[sx,sz]=sag(d.yaw),vf=d.vx*fx+d.vz*fz,vr=d.vx*sx+d.vz*sz;
    dm=matmul(dm,matmul(RX(clamp(-vf*.045,-.2,.2)),RZ(clamp(-vr*.045,-.2,.2))));
  }
  renderer.draw(assets.drone.body,dm);
  renderer.draw(assets.drone.top,matmul(dm,matmul(T(0,.40,0),RYrot(d.rotorAngle))),1,.13);
  renderer.draw(assets.drone.bottom,matmul(dm,matmul(T(0,.33,0),RYrot(-d.rotorAngle*1.05))),1,.06);
  for(const p of efekt.toz){const k=p.yas/p.omur,boy=p.boy*(1+k*2.4),sol=(1-k)*(k<.12?k/.12:1);renderer.draw(assets.extra.dust,matmul(T(p.x,p.y,p.z),S(boy,boy,boy)),.42*sol,.22);}
  renderer.gl.bindVertexArray(null);
  updateWorldLabels();
}
function RYrot(a){const c=Math.cos(a),s=Math.sin(a);return[c,0,-s,0,0,1,0,0,s,0,c,0,0,0,0,1];}
function updateWorldLabels(){
  TARGETS.forEach((s,i)=>{
    const label=$(['rockA','rockB','rockC'][i]),pt=renderer.project([s.x,terrainHeight(s.x,s.z)+2.2,s.z]);
    const e=state.camera.eye,dist=Math.hypot(e[0]-s.x,e[2]-s.z);
    if(!pt||!pt.visible||dist>78){label.style.display='none';return;}
    label.style.display='flex';label.style.left=`${pt.x}px`;label.style.top=`${pt.y}px`;
    label.querySelector('span:nth-child(2)').firstChild.textContent=hedefAdi(i);
    const g=state.siniflar[i];
    label.style.borderColor=g?'#7dd5bd':'';label.querySelector('.target-icon').textContent=g?'✓':'◇';
    label.querySelector('small').textContent=g?`DL: ${t('sinif.'+g.sinif)} ${yuzde(Math.round(g.guven*100))}`:t('etiket.bekliyor');
  });
}
function drawMap(){
  const c=$('minimap'),ctx=c.getContext('2d'),w=c.width,h=c.height;
  ctx.clearRect(0,0,w,h);ctx.fillStyle='#192934';ctx.fillRect(0,0,w,h);
  const sc=2.3,ox=w/2,oz=h*.72,xy=(x,z)=>[ox+x*sc,oz+(z-10)*sc];
  for(let z=-60;z<=55;z+=4)for(let x=-120;x<=120;x+=4){const hh=terrainHeight(x,z);if(hh>.35){const[px,py]=xy(x,z);ctx.fillStyle=`rgba(210,148,100,${Math.min(.22,.035+hh*.027)})`;ctx.fillRect(px,py,10,10);}}
  ctx.strokeStyle='#334858';ctx.lineWidth=.5;
  for(let x=-120;x<=120;x+=10){const[px]=xy(x,0);ctx.beginPath();ctx.moveTo(px,0);ctx.lineTo(px,h);ctx.stroke();}
  for(let z=-60;z<=55;z+=10){const[,py]=xy(0,z);ctx.beginPath();ctx.moveTo(0,py);ctx.lineTo(w,py);ctx.stroke();}
  ctx.fillStyle='#6c5446';for(const e of ENGELLER)if(e.h>CFG.engelM){const[px,py]=xy(e.x,e.z);ctx.fillRect(px-1,py-1,2,2);}
  const d=state.drone,r=state.rover,route=[[r.x,r.z],...TARGETS.filter((_,i)=>!state.collected[i]).map(s=>[s.x,s.z])];
  ctx.strokeStyle='rgba(215,159,103,.7)';ctx.setLineDash([4,6]);ctx.beginPath();route.forEach(([x,z],i)=>{const[px,py]=xy(x,z);i?ctx.lineTo(px,py):ctx.moveTo(px,py);});ctx.stroke();ctx.setLineDash([]);
  if(!d.docked){const[a,b]=xy(r.x,r.z),[c2,e2]=xy(d.x,d.z);ctx.strokeStyle=d.baglanti>0?'rgba(120,210,190,.6)':'rgba(240,110,90,.9)';ctx.beginPath();ctx.moveTo(a,b);ctx.lineTo(c2,e2);ctx.stroke();}
  TARGETS.forEach((s,i)=>{const[x,y]=xy(s.x,s.z);ctx.strokeStyle=state.collected[i]?'#75cabb':'#e4a76d';ctx.lineWidth=1.6;ctx.beginPath();ctx.arc(x,y,5,0,Math.PI*2);ctx.stroke();ctx.fillStyle=ctx.strokeStyle;ctx.font='bold 10px Consolas';ctx.fillText(`${i+1}`,x+9,y-3);});
  const mk=(p,col,s)=>{const[x,y]=xy(p.x,p.z);ctx.strokeStyle=col;ctx.lineWidth=1;ctx.beginPath();ctx.arc(x,y,s+5,0,Math.PI*2);ctx.stroke();ctx.fillStyle=col;ctx.beginPath();ctx.arc(x,y,s,0,Math.PI*2);ctx.fill();};
  mk(r,'#77d0bf',4.5);mk(d,'#ffc284',3.2);
  ctx.fillStyle='#94adb8';ctx.font='10px Consolas';ctx.fillText(t('harita.olcek'),10,h-9);
  const o=olcum();if(o&&o.ws!=null&&o.wd!=null){const[ux,uz]=windVector(1,o.wd),cx=w-34,cy=h-30,L=9+Math.min(14,o.ws*1.6);   // akış yönü, kuzey yukarı
    ctx.strokeStyle='#9fc6e6';ctx.fillStyle='#9fc6e6';ctx.lineWidth=1.6;ctx.beginPath();ctx.moveTo(cx-ux*L,cy-uz*L);ctx.lineTo(cx+ux*L,cy+uz*L);ctx.stroke();
    const a=Math.atan2(uz,ux);ctx.beginPath();ctx.moveTo(cx+ux*L,cy+uz*L);ctx.lineTo(cx+ux*L-6*Math.cos(a-.45),cy+uz*L-6*Math.sin(a-.45));ctx.lineTo(cx+ux*L-6*Math.cos(a+.45),cy+uz*L-6*Math.sin(a+.45));ctx.fill();
    ctx.font='9px Consolas';ctx.textAlign='center';ctx.fillText(`${f1(o.ws)} m/s`,cx,h-6);ctx.fillText('N',cx,12);ctx.textAlign='left';}
}
/** Rotor gücü: ölçülen (düz) ve çevrimiçi ML modelinin o anki tahmini (kesikli). */
function drawPowerChart(){
  const c=$('scienceChart'),ctx=c.getContext('2d'),w=c.width,h=c.height,g=state.gucGecmis;
  ctx.clearRect(0,0,w,h);ctx.strokeStyle='#29424b';ctx.lineWidth=1;
  for(let n=1;n<4;n++){ctx.beginPath();ctx.moveTo(0,n*h/4);ctx.lineTo(w,n*h/4);ctx.stroke();}
  ctx.fillStyle='#a2bdc5';ctx.font='10px Consolas';ctx.fillText(t('grafik.guc'),9,13);
  if(g.length<2)return;
  const lo=200,hi=520,yv=v=>h-6-(clamp(v,lo,hi)-lo)/(hi-lo)*(h-22),xv=i=>i/(150-1)*w;
  const ciz=(k,renk,kesik)=>{ctx.strokeStyle=renk;ctx.lineWidth=kesik?1.4:2;ctx.setLineDash(kesik?[4,3]:[]);ctx.beginPath();g.forEach((p,i)=>{const y=yv(p[k]);i?ctx.lineTo(xv(i),y):ctx.moveTo(xv(i),y);});ctx.stroke();ctx.setLineDash([]);};
  ciz('P','#79c8ae',false);ciz('tahmin','#e7a96f',true);
  ctx.fillStyle='#6f8996';ctx.fillText(`${hi} W`,w-44,24);ctx.fillText(`${lo} W`,w-44,h-8);
}
const kv=rows=>rows.map(([k,v,cls])=>`<div${cls?` class="${cls}"`:''}><span>${escapeHTML(k)}</span><b>${escapeHTML(v)}</b></div>`).join('');

function updateUI(){
  const d=state.drone,r=state.rover,a=agl(),saat=lst(),hava=ortamC(),ro=rho(),f=firtina(),kap=droneKap();
  const speed=state.selected==='rover'?Math.abs(r.speed):Math.hypot(d.vx,d.vz);
  const el=(id,v)=>{$(id).textContent=v;},bar=(id,v)=>{$(id).style.width=`${clamp(v,0,100)}%`;};
  el('altitude',a.toFixed(2));el('hudAlt',a.toFixed(1));el('speed',speed.toFixed(2));el('thrust',d.tw.toFixed(2));
  el('signal',d.docked?100:d.baglanti);el('power',Math.round(d.gucW));el('rpm',Math.round(d.devir));el('hudRho',ro.toFixed(4));
  bar('altBar',a/20*100);bar('speedBar',speed/SEYIR*100);bar('thrustBar',d.tw/1.6*100);bar('signalBar',d.docked?100:d.baglanti);bar('powerBar',d.gucW/ROTOR.TEPE_GUC_W*100);bar('rpmBar',d.devir/ROTOR.DEVIR_MAKS*100);
  el('droneBatteryText',`${f1(d.enerjiWh)} Wh · ${yuzde(Math.round(dronePct()))}`);el('roverBatteryText',`${Math.round(r.enerjiWh)} Wh · ${yuzde(Math.round(roverPct()))}`);
  bar('droneBatteryBar',dronePct());bar('roverBatteryBar',roverPct());
  const ucusGuc=d.docked||d.landed?rotorGucu({itkiN:CFG.droneKg*SABIT.g,rho:ro,rotorCapM:CFG.rotorCapM}):Math.max(d.gucW,1);
  $('powerDetails').innerHTML=kv([
    [t('enerji.gunes'),`${f1(r.gunesW||0)} W`],[t('enerji.yuk'),`${f1(r.yukW||0)} W`],
    [t('enerji.sarj'),d.docked?`${Math.round(r.sarjW||0)} W${state.degisim?` · ${t('faz.degisim')} ${Math.ceil(state.degisim.kalan)} s`:''}`:'—'],
    [t('enerji.bolme'),`${f1(r.bolmeC)} °C${r.isiyor?' · 42 W':''}`,r.bolmeC<ISI.SARJ_MIN_C?'uyari':''],
    [t('enerji.yedek'),state.raf.map(p=>f1(p.wh)).join(' / ')+' Wh'],
    [t('enerji.menzil'),`${Math.round(tahminiKalanUcusS(d.enerjiWh,ucusGuc,REZERV,kap))} s · R ${yuzde(REZERV*100)}`],
  ]);
  const mach=ucMach(d.devir||gerekliDevir({rho:ro}),CFG.rotorCapM,hava);
  $('atmDetails').innerHTML=kv([
    [t('ust.saat'),saatYaz(saat)],[t('atm.basinc'),`${f1(basinc())} Pa`],[t('atm.sicaklik'),`${f1(hava)} °C`],
    [t('atm.yogunluk'),`${ro.toFixed(4)} kg/m³`],[t('atm.opaklik'),f2(state.hava.opaklik*f.tozCarpani)],[t('atm.ruzgar'),`${f1(ruzgar(f))} m/s${f.aktif?' · '+t('atm.firtina'):''}`,f.aktif?'uyari':''],
    [t('atm.mach'),f2(mach)],[t('atm.kaynak'),state.hava.kaynak==='canli'?`MEDA sol ${state.hava.sol}`:olcum()?t('durum.medaOlcum',{s:solAdi()}):state.hava.kaynak==='meda-model'?t('durum.medaModel'):t('durum.cevrimdisi')],
  ]);
  const tz=tekerZeminleri(r),bas=dominantClass(tz.karisim),zm=blendSoil(tz.karisim,TERRAIN_CONFIG.classes);
  $('soilDetails').innerHTML=kv([
    [t('zemin.tur'),`${zeminAdi(bas)} ${yuzde(Math.round(tz.karisim[bas]*100))}`],
    [t('zemin.kayma'),yuzde(Math.round(r.kayma*100)),r.kayma>.6?'uyari':''],[t('zemin.batma'),`${(r.batmaM*1000).toFixed(1)} mm`],
    [t('zemin.egim'),`${Math.round(Math.abs(r.pitch)*180/Math.PI)}°`],
    [t('zemin.mekanik'),zm.rigidFrac>.85?`μ ${f2(zm.mu)}`:`c ${f1(zm.c)} kPa · φ ${Math.round(Math.atan(zm.tanPhi)*180/Math.PI)}°`],
    [t('zemin.cekis'),r.saplandi?t('zemin.saplandi'):`${f1(r.cekisN)} N`,r.saplandi?'uyari':''],
  ]);
  $('soilBars').innerHTML=TERRAIN_CONFIG.classes.map((c,i)=>`<span title="${escapeHTML(zeminAdi(i))} ${Math.round(tz.karisim[i]*100)}%" style="flex:${Math.max(.0001,tz.karisim[i]).toFixed(4)};background:rgb(${c.base_color.map(v=>Math.round(Math.min(255,v*290))).join(',')})"></span>`).join('');
  const son=state.gucGecmis.at(-1),k=state.sonKarar,sonG=[...state.siniflar].reverse().find(Boolean);
  $('aiDetails').innerHTML=kv([
    [t('yz.ml'),`${model.ornek} ${t('yz.ornek')} · ${model.hazir?`${t('yz.hata')} ${yuzde((model.hataOrt*100).toFixed(1))}`:t('yz.ogreniyor')}`],
    [t('yz.tahmin'),son?`${Math.round(son.P)} / ${Math.round(son.tahmin)} W`:t('yz.yok')],
    [t('yz.karar'),k?`${k.hedef}: ${f1(k.gerek)} / ${f1(k.kullanilabilir)} Wh → ${t(k.devam?'karar.devam':'karar.don')}`:t('yz.yok'),k&&!k.devam?'uyari':''],
    [t('yz.dl'),clf?`${t('yz.dogruluk')} ${yuzde((clf.dogruluk*100).toFixed(1))}`:t('yz.ogreniyor')],
    [t('yz.son'),sonG?`${t('sinif.'+sonG.sinif)} ${yuzde(Math.round(sonG.guven*100))}${sonG.dogru?' ✓':' ✗'}`:t('yz.yok')],
  ]);
  const q=state.paketler,bilim=q.gonderilen.length;
  $('samples').innerHTML=`${String(state.collected.filter(Boolean).length).padStart(2,'0')} <em>/ 03</em>`;
  $('sent').innerHTML=`${String(bilim).padStart(2,'0')} <em>PKT · ${q.drone.length+q.rover.length} ${t('bilim.bekleyen')}</em>`;
  el('missionClock',stamp());el('lstClock',saatYaz(saat));el('flightTime','T+'+stamp());
  $('padBadge').hidden=!gamepad.connected;if(gamepad.connected)$('padAd').textContent=kumandaTuru()==='ps'?'PLAYSTATION':kumandaTuru()==='xbox'?'XBOX':t('kumanda.rozet');
  const act=state.selected==='drone'?d:r;el('heading',String(Math.round(pusula(act.yaw))%360).padStart(3,'0'));el('coordsLabel',`X ${f1(act.x)} / Z ${f1(act.z)}`);
  const sb=$('stormBanner');sb.hidden=!f.aktif;if(f.aktif)sb.textContent=`${t('atm.firtina')} · ${t('atm.ruzgar')} ${f1(f.ruzgarMs)} m/s · τ ${f2(state.hava.opaklik*f.tozCarpani)}`;
  const islem=state.sonuc==='basarisiz'?t('faz.failed'):state.sonuc==='basari'?t('faz.completed'):state.degisim?t('faz.degisim'):d.docked?t('faz.kenetli'):d.landed?t('faz.yerde'):state.auto?t('faz.'+state.phase):t('faz.manual');
  el('operationText',islem);
  el('flightBadge',t(d.docked?'rozet.kenetli':d.landed||d.dustu?'rozet.yerde':state.auto?'rozet.otonom':'rozet.ucusta'));
  el('operationSub',state.auto?t('alt.rota',{x:state.phase==='travel'||state.phase==='scan'?hedefAdi(state.targetIndex):t('faz.'+state.phase)}):d.docked?t('alt.hazir'):t('alt.manuel'));
  $('missionBtn').innerHTML=state.auto?`<span class="action-glyph">■</span><span>${t('eylem.durdur')} <small>${t('eylem.durdur.alt')}</small></span>`:`<span class="action-glyph">▶</span><span>${t('eylem.otonom')} <small>${t('eylem.otonom.alt')}</small></span>`;
  $('transmitBtn').classList.toggle('on',r.uplink);
  const adimlar=[t('zaman.kalkis'),hedefAdi(0),hedefAdi(1),hedefAdi(2),t('zaman.donus')];
  $('missionSteps').innerHTML=adimlar.map((label,i)=>{
    const done=(i===0&&(!d.docked||state.collected.some(Boolean)))||(i>0&&i<4&&state.collected[i-1])||(i===4&&state.sonuc==='basari');
    const active=state.auto&&((i===0&&state.phase==='takeoff')||(i===state.targetIndex+1&&['travel','scan'].includes(state.phase))||(i===4&&['return','land'].includes(state.phase)));
    return `<div class="step ${done?'done':active?'active':''}"><b>${i===4?'↵':i===0?'↑':i}</b><span>${escapeHTML(label)}</span></div>`;}).join('');
  el('missionDescription',state.sonuc==='basari'?t('aciklama.bitti'):state.auto?t('aciklama.otonom'):t('aciklama.hazir',{n:state.collected.filter(Boolean).length,p:q.drone.length+q.rover.length}));
  $('veriDurum').textContent=state.hava.kaynak==='canli'?t('durum.canli'):olcum()?t('durum.medaOlcum',{s:solAdi()}):state.hava.kaynak==='meda-model'?t('durum.medaModel'):t('durum.cevrimdisi');
  medaSenkron();
  drawMap();drawPowerChart();
}

// ------------------------------------------------------------- dosyalar: rapor, kaydet/yükle, CSV, galeri
function indir(ad,icerik,tur){
  const blob=icerik instanceof Blob?icerik:new Blob([icerik],{type:tur});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=ad;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href),1500);
}
function exportMissionReport(){
  const d=state.drone,r=state.rover;
  const rapor={proje:'OSIRISZK Mars Pathfinder 3D',surum:SURUM,olusturma:new Date().toISOString(),
    not:'Eğitim simülasyonu. Rotor gücü momentum teorisiyle (FM 0,27, Ingenuity ≈350 W kalibrasyonu); DL spektrumları TEMSİLÎdir (ölçülmüş değil).',
    atmosfer:{...state.hava,lst:saatYaz(lst()),sicaklikC:+ortamC().toFixed(1),yogunluk:+rho().toFixed(5),medaOlcum:olcum()?{sol:medaPanel.sol,basincPa:+olcum().p.toFixed(1),ruzgarMs:+(olcum().ws??0).toFixed(1),ucus:ucusDurumu().level,nedenler:ucusDurumu().reasons,kaynak:medaPanel.data.source}:null},
    gorevSuresiS:+state.time.toFixed(1),sonuc:state.sonuc??'suruyor',
    drone:{enerjiWh:+d.enerjiWh.toFixed(2),kapasiteWh:+droneKap().toFixed(2),dayaniklilik:d.dayaniklilik,durum:d.docked?'kenetli':d.landed?'yerde':d.dustu?'dustu':'ucus'},
    grafik:{kalite,doku:dunya.dokuKaynak},
    gezgin:{zemin:TERRAIN_CONFIG.classes[dominantClass(tekerZeminleri(r).karisim)].key,kayma:+r.kayma.toFixed(3),batmaMm:+(r.batmaM*1000).toFixed(2),x:+r.x.toFixed(2),z:+r.z.toFixed(2),enerjiWh:+r.enerjiWh.toFixed(1),bolmeC:+r.bolmeC.toFixed(1)},yedekPiller:state.raf,
    hedefler:TARGETS.map((s,i)=>({ad:hedefAdi(i),tarandi:state.collected[i],dl:state.siniflar[i]&&{sinif:state.siniflar[i].sinif,guven:+state.siniflar[i].guven.toFixed(3),dogru:state.siniflar[i].dogru}})),
    yz:{ml:{ornek:model.ornek,ortHata:model.hataOrt,agirliklar:model.w,sonKarar:state.sonKarar},dl:{mimari:'8-16-16-3 MLP',testDogrulugu:clf?.dogruluk??null}},
    paketler:{gonderilen:state.paketler.gonderilen.length,kuyruk:state.paketler.drone.length+state.paketler.rover.length},
    gunluk:[...state.events].reverse()};
  indir('OSIRISZK_Gorev_Raporu.json',JSON.stringify(rapor,null,2),'application/json');notify(t('m.rapor'));
}
function saveGame(){
  const{camera,...kalan}=state;
  const kayit={tur:'osiriszk3d-kayit',surum:SURUM,durum:{...kalan,telemetri:[],gucGecmis:[]},ml:model.durum()};
  indir(`OSIRISZK_Kayit_${stamp().replaceAll(':','')}.json`,JSON.stringify(kayit),'application/json');notify(t('m.kaydedildi'));
}
async function loadGame(file){
  try{
    const k=JSON.parse(await file.text());
    if(k.tur!=='osiriszk3d-kayit'||!k.durum?.drone||!k.durum?.rover)throw new Error('format');
    const kamera=state.camera;state=Object.assign(yeniDurum(),k.durum,{camera:kamera,running:false,warp:1});
    model.yukle(k.ml);keys.clear();efektleriTemizle();setCamera(state.cameraMode);selectVehicle(state.selected,true);
    $('pauseBtn').textContent=t('dugme.devam');setWarp(1);renderLog();notify(t('m.yuklendi'));
  }catch(e){notify(t('m.yuklemeHata',{e:e.message}));}
}
function exportCSV(){
  if(!state.telemetri.length){notify(t('m.csvBos'));return;}
  const bas='t_s,lst,ortam_C,rho_kg_m3,firtina,ruzgar_m_s,drone_durum,drone_x,drone_y,drone_z,agl_m,yatay_hiz_m_s,dikey_hiz_m_s,rotor_guc_W,devir_rpm,drone_Wh,drone_pil_C,baglanti_pct,gezgin_x,gezgin_z,gezgin_Wh,gunes_W,yuk_W,bolme_C,faz';
  indir('OSIRISZK_Telemetri.csv',[bas,...state.telemetri.map(r=>r.join(','))].join('\n'),'text/csv');notify(t('m.csv'));
}
function openGallery(){
  $('galleryBody').innerHTML=fotolar.length?fotolar.map(f=>`<figure><img src="${f.url}" alt="IMG ${f.no}"><figcaption>IMG ${f.no} · ${f.arac==='drone'?'UD-07':'RV-01'} · LST ${f.lst} · <a href="${f.url}" download="OSIRISZK_IMG_${f.no}.jpg">${t('galeri.indir')}</a></figcaption></figure>`).join(''):`<p>${t('galeri.bos')}</p>`;
  $('galleryOverlay').hidden=false;
}
async function canliVeri(){
  notify(t('m.veriAliniyor'));
  const h=await canliHavaAl();state.hava=h;
  if(h.kaynak==='canli')addLog(t('l.veriCanli',{sol:h.sol,tarih:h.tarih,p:Math.round(h.basincPa),lo:h.minC,hi:h.maxC}),'success');
  else{addLog(t('l.veriYok'),'warn');console.info('MEDA:',h.hata);}
}
function dilDegistir(d){
  dilAyarla(d);sayfayiCevir();medaPanel?.relabel();
  document.querySelectorAll('[data-dil]').forEach(b=>b.classList.toggle('active',b.dataset.dil===d));
  $('pauseBtn').textContent=t(state.running?'dugme.duraklat':'dugme.devam');$('warpBtn').textContent=t('dugme.hizlandir',{x:state.warp});
  kaliteDugmesi();setCamera(state.cameraMode);selectVehicle(state.selected,true);updateUI();
}
function reset(){
  state=yeniDurum();saatKayma=0;keys.clear();fotolar=[];efektleriTemizle();
  $('pauseBtn').textContent=t('dugme.duraklat');setWarp(1);setCamera('cinematic');selectVehicle('drone',true);
  addLog(t('l.sifir'),'success');notify(t('m.sifir'));
}

// ------------------------------------------------------------- kontroller
function bindControls(){
  const on=(id,f)=>$(id).addEventListener('click',f);
  on('selectDrone',()=>selectVehicle('drone'));on('selectRover',()=>selectVehicle('rover'));
  on('missionBtn',startMission);on('takeoffBtn',takeoff);on('scanBtn',scan);on('dockBtn',()=>dock());on('chargeBtn',swapBattery);
  on('transmitBtn',toggleUplink);on('photoBtn',photo);on('resetBtn',reset);on('pauseBtn',togglePause);on('warpBtn',cycleWarp);
  on('reportBtn',exportMissionReport);on('saveBtn',saveGame);on('loadBtn',()=>$('loadInput').click());on('csvBtn',exportCSV);on('dataBtn',canliVeri);
  $('qualitySeg').addEventListener('click',e=>{const b=e.target.closest('[data-q]');if(b)kaliteAyarla(b.dataset.q);});
  $('resSeg').addEventListener('click',e=>{const b=e.target.closest('[data-r]');if(b)cozunurlukAyarla(b.dataset.r);});
  let rz=0;window.addEventListener('resize',()=>{clearTimeout(rz);rz=setTimeout(()=>medaPanel?.render(),120);});
  $('loadInput').addEventListener('change',e=>{const f=e.target.files?.[0];if(f)loadGame(f);e.target.value='';});
  document.querySelectorAll('[data-dil]').forEach(b=>b.addEventListener('click',()=>dilDegistir(b.dataset.dil)));
  document.querySelectorAll('[data-camera]').forEach(b=>b.addEventListener('click',()=>setCamera(b.dataset.camera)));
  const help=$('helpOverlay'),gal=$('galleryOverlay');
  on('helpBtn',()=>help.hidden=false);on('closeHelp',()=>help.hidden=true);on('helpDone',()=>help.hidden=true);on('closeGallery',()=>gal.hidden=true);
  for(const o of [help,gal])o.addEventListener('click',e=>{if(e.target===o)o.hidden=true;});
  const manuelMudahale=key=>{
    if(state.auto&&state.selected==='drone'&&['w','a','s','d',' ','shift','q','e','arrowup','arrowdown','arrowleft','arrowright'].includes(key)){
      state.auto=false;setAutoPhase('manual');addLog(t('l.manuel'),'warn');notify(t('m.manuel'));}
  };
  document.addEventListener('keydown',e=>{
    if(['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName))return;
    const key=e.key.toLowerCase();if([' ','arrowup','arrowdown','arrowleft','arrowright','tab'].includes(key))e.preventDefault();
    if(!help.hidden||!gal.hidden){if(key==='escape'||key==='h'||key==='v'){help.hidden=true;gal.hidden=true;}return;}
    if(!e.repeat){
      if(key==='tab'){selectVehicle(state.selected==='drone'?'rover':'drone');return;}
      if(key==='h'){help.hidden=false;return;}
      if('1234'.includes(key)&&key.length===1){setCamera(['cinematic','drone','rover','top'][Number(key)-1]);return;}
      const k={f:()=>dock(),b:swapBattery,t:toggleUplink,g:scan,m:startMission,p:togglePause,x:cycleWarp,c:photo,v:openGallery,k:kaliteDegistir}[key];
      if(k){k();return;}
      if(key==='r'&&state.selected==='rover'){scan();return;}
      if(key===' '&&state.selected==='drone'&&(state.drone.docked||state.drone.landed)){takeoff();}
    }
    keys.add(key);manuelMudahale(key);
  });
  document.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
  window.addEventListener('blur',()=>keys.clear());
  // dokunmatik yön tuşları
  document.querySelectorAll('.touch-pad [data-key]').forEach(b=>{
    const k=b.dataset.key;
    b.addEventListener('pointerdown',e=>{e.preventDefault();if(k===' '&&state.selected==='drone'&&(state.drone.docked||state.drone.landed))takeoff();keys.add(k);manuelMudahale(k);b.setPointerCapture(e.pointerId);});
    for(const ev of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(ev,()=>keys.delete(k));
  });
  // kamera: sürükle + tekerlek + iki parmak yakınlaştırma
  const dokunmalar=new Map();let tutam=0;
  canvas.addEventListener('pointerdown',e=>{dokunmalar.set(e.pointerId,[e.clientX,e.clientY]);canvas.setPointerCapture(e.pointerId);state.camera.dragging=dokunmalar.size===1;state.camera.last=[e.clientX,e.clientY];
    if(dokunmalar.size===2){const[a,b]=[...dokunmalar.values()];tutam=Math.hypot(a[0]-b[0],a[1]-b[1]);}});
  canvas.addEventListener('pointermove',e=>{
    if(!dokunmalar.has(e.pointerId))return;dokunmalar.set(e.pointerId,[e.clientX,e.clientY]);
    if(dokunmalar.size===2){const[a,b]=[...dokunmalar.values()],dd=Math.hypot(a[0]-b[0],a[1]-b[1]);if(tutam)state.camera.distance=clamp(state.camera.distance*tutam/dd,1.8,88);tutam=dd;return;}
    if(!state.camera.dragging)return;const[x,y]=state.camera.last;
    state.camera.yaw-=(e.clientX-x)*.006;state.camera.pitch=clamp(state.camera.pitch+(e.clientY-y)*.005,.08,1.53);state.camera.last=[e.clientX,e.clientY];});
  const birak=e=>{dokunmalar.delete(e.pointerId);state.camera.dragging=false;tutam=0;};
  canvas.addEventListener('pointerup',birak);canvas.addEventListener('pointercancel',birak);
  canvas.addEventListener('wheel',e=>{e.preventDefault();state.camera.distance=clamp(state.camera.distance*Math.exp(e.deltaY*.00115),1.8,88);},{passive:false});
}

// ------------------------------------------------------------- dünya: dokular, arazi ağı, kayalar (v2.4)
const kareBekle=()=>new Promise(res=>requestAnimationFrame(()=>setTimeout(res,0)));
async function dunyaKur(q){
  const Q=QUALITY[q];renderer.pixelRatioCap=Q.pixelRatio;await kareBekle();
  const tex=await buildTerrainTextures(q,Q.tex,Q.macro,TERRAIN_SPAN/2,dunya.manifest);
  setMaterialMap(tex.materialMap?.data||null,tex.materialMap?.size||0,TERRAIN_SPAN/2);
  renderer.deleteTexture(dunya.matTex);renderer.deleteTexture(dunya.macroTex);
  dunya.matTex=renderer.createTextureArray(tex.layers,tex.size,Q.aniso);dunya.macroTex=renderer.createTexture2D(tex.macro,tex.macroSize);
  dunya.dokuKaynak=tex.source;dunya.macroAmt=dunya.manifest?.macro?.image?.8:.45;
  await kareBekle();
  if(assets.terrain)renderer.dispose(assets.terrain);
  if(assets.environment){renderer.dispose(assets.environment.scenery);renderer.dispose(assets.environment.route);}
  assets.terrain=buildTerrain(renderer,Q.grid);await kareBekle();
  assets.environment=buildEnvironment(renderer,{boulders:Q.boulders,rockLevel:Q.rockLevel});
  efektleriTemizle();
}
const kaliteDugmesi=()=>{
  document.querySelectorAll('#qualitySeg [data-q]').forEach(b=>{const on=b.dataset.q===kalite;b.classList.toggle('on',on);b.setAttribute('aria-pressed',String(on));});
  $('qualitySeg').classList.toggle('busy',kaliteMesgul);
  document.querySelectorAll('#resSeg [data-r]').forEach(b=>{const on=b.dataset.r===cozKey;b.classList.toggle('on',on);b.setAttribute('aria-pressed',String(on));});
};
/* v3.3 çözünürlük: OTO = ekranın piksel yoğunluğu (kaliteye göre en çok 1× / 1,45× / 2×); %75…%200 elle seçilir. En uzun kenar 4096 px ile sınırlı (engine.js). */
const COZ_SECENEK={auto:0,'0.75':.75,'1':1,'1.5':1.5,'2':2},COZ_ANAHTAR='osiriszk.res';
let cozKey=(()=>{try{const r=new URLSearchParams(location.search).get('cozunurluk')||localStorage.getItem(COZ_ANAHTAR);return r in COZ_SECENEK?r:'auto';}catch{return'auto';}})();
function cozUygula(){if(renderer){renderer.renderScale=COZ_SECENEK[cozKey];renderer.resize();$('resLabel').textContent=`${canvas.width}×${canvas.height}`;}kaliteDugmesi();}
function cozunurlukAyarla(k){if(!(k in COZ_SECENEK)||k===cozKey)return;cozKey=k;try{localStorage.setItem(COZ_ANAHTAR,k);}catch{}cozUygula();
  const m=`${canvas.width}×${canvas.height}`;notify(t('m.coz',{k:t('coz.'+k),px:m}));addLog(t('l.coz',{k:t('coz.'+k),px:m}));}
function kaliteDegistir(){return kaliteAyarla(['low','medium','high'][(['low','medium','high'].indexOf(kalite)+1)%3]);}
async function kaliteAyarla(k){
  if(kaliteMesgul||!QUALITY[k]||k===kalite)return;kaliteMesgul=true;
  kalite=k;kaliteDugmesi();
  try{localStorage.setItem(KALITE_ANAHTAR,kalite);}catch{}
  const calisiyordu=state.running;state.running=false;$('loading').hidden=false;
  try{await dunyaKur(kalite);}catch(e){console.error(e);notify(e.message);}
  $('loading').hidden=true;state.running=calisiyordu;kaliteDugmesi();
  const Q=QUALITY[kalite];notify(t('m.kalite',{k:t('kalite.'+kalite)}));addLog(t('l.kalite',{k:t('kalite.'+kalite),px:Q.tex,g:Q.grid}));
  kaliteMesgul=false;kaliteDugmesi();
}
/** Xbox ve PlayStation kumandaları tarayıcıda aynı "standart" düzeni kullanır; yalnızca düğme adları farklıdır. */
function kumandaTuru(){const id=(gamepad.id||'').toLowerCase();return /054c|dualsense|dualshock|playstation|wireless controller/.test(id)?'ps':/045e|xbox|xinput/.test(id)?'xbox':'diger';}

// ------------------------------------------------------------- döngü ve başlangıç
function frame(ts){
  if(!lastFrame)lastFrame=ts;const dt=Math.min((ts-lastFrame)/1000,.05);lastFrame=ts;
  try{
    kumanda(dt);updatePhysics(dt);efektleriGuncelle(dt);drawScene(dt);if(fotoIste)fotoKaydet();
    uiTimer+=dt;frameCount++;fpsTime+=dt;
    if(fpsTime>=.7){$('fps').textContent=Math.round(frameCount/fpsTime);$('resLabel').textContent=`${canvas.width}×${canvas.height}`;fpsTime=0;frameCount=0;}
    if(uiTimer>=.15){uiTimer=0;updateUI();}
  }catch(err){console.error('OSIRISZK frame:',err);notify(err.message);}
  requestAnimationFrame(frame);
}
async function yapilandirmaOku(){
  try{
    const m=await (await fetch('modeller.json')).json(),g=m.gezgin,d=m.drone;
    Object.assign(CFG,{droneKg:d.kutle_kg,rotorCapM:d.rotor_capi_m,gezginKg:g.kutle_kg,gezginWh:g.batarya_Wh,gunesTepeW:g.gunes_paneli_W,
      sarjW:g.drone_sarj_gucu_W,engelM:g.engel_asma_m,egimDeg:g.egim_tirmanma_derece,gezginHiz:g.maks_hiz_m_s,
      degisimS:60*(g.batarya_degisim_suresi_dk[0]+g.batarya_degisim_suresi_dk[1])/2});
    return true;
  }catch{return false;}
}
/* MEDA paneli: saat kaydırıcısı / grafik tıklaması oyunun Jezero saatini ayarlar; oyun saati de paneli yürütür. */
const solAdi=()=>medaPanel.sol==='birlesik'?(medaPanel.data.composite.sols||[]).join('+'):medaPanel.sol;
function medaDegisti(cur,st,onceki){
  const hedef=cur.minute/60,simdi=((LST0+state.time*24/SABIT.SOL_S)%24+24)%24;
  saatKayma=((hedef-simdi)%24+24)%24;olcumDk=-1;
  if(onceki&&st.level!==onceki)addLog(t('l.medaDurum',{d:t('meda.d.'+st.level),s:clockText(cur.minute)}),st.level==='no'?'warn':st.level==='ok'?'success':'');
}
let medaSonDk=-1,medaSonSol=null,medaSonSeviye=null;
function medaSenkron(){
  if(!medaPanel?.data)return;const dk=Math.floor(lst()*60);
  if(dk===medaSonDk&&medaPanel.sol===medaSonSol)return;medaSonDk=dk;medaSonSol=medaPanel.sol;
  medaPanel.minute=dk;medaPanel.cur=sample(medaPanel.data,medaPanel.sol,dk);medaPanel.status=flightStatus(medaPanel.cur);
  if(medaSonSeviye&&medaPanel.status.level!==medaSonSeviye&&state.selected==='drone')addLog(t('l.medaDurum',{d:t('meda.d.'+medaPanel.status.level),s:clockText(dk)}),medaPanel.status.level==='no'?'warn':'');
  medaSonSeviye=medaPanel.status.level;medaPanel.render();
}
async function init(){
  dilDegistirSessiz(baslangicDili());
  try{
    canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();$('webglError').hidden=false;});
    canvas.addEventListener('webglcontextrestored',()=>location.reload());
    renderer=new Renderer(canvas);renderer.renderScale=COZ_SECENEK[cozKey];
    await loadTerrainConfig();dunya.manifest=await loadManifest();
    Object.assign(assets,{rover:buildRover(renderer),drone:buildDrone(renderer),extra:buildExtra(renderer)});
    await dunyaKur(kalite);
  }catch(err){console.error('OSIRISZK startup:',err);$('loading').hidden=true;$('webglError').hidden=false;return;}
  const json=await yapilandirmaOku();
  try{const k=JSON.parse(localStorage.getItem(ML_ANAHTAR)||'null');if(k)model.yukle(k);}catch{}
  roverEgim();const p=padPos();Object.assign(state.drone,{x:p[0],y:p[1],z:p[2]});
  medaPanel=new MedaPanel(await loadMeda(),{onChange:medaDegisti,minute:Math.round(lst()*60)}).mount($('medaPanel'));medaPanel.status=flightStatus(medaPanel.cur);
  bindControls();kaliteDugmesi();setWarp(1);setCamera('cinematic');selectVehicle('drone',true);
  addLog(t('l.basla1'));addLog(t('l.basla2')+(json?' · modeller.json v1.0':''),'success');
  updateUI();$('loading').hidden=true;
  window.__OSIRISZK_TEST__={kaliteDegistir,kaliteAyarla,cozunurlukAyarla,get cozKey(){return cozKey;},get medaPanel(){return medaPanel;},olcum,ucusDurumu,get kalite(){return kalite;},dunya,ENGELLER,get state(){return state;},renderer,assets,model,get clf(){return clf;},CFG,adim,updatePhysics,takeoff,dock,scan,startMission,reset,swapBattery,toggleUplink,setWarp,selectVehicle,setCamera,saveGame,exportCSV,photo,canliVeri,dilDegistir,padPos,lst,rho,firtina:()=>firtina(),keys};
  requestAnimationFrame(frame);
  setTimeout(()=>{siniflandiriciyiHazirla();canliVeri();},400);
}
function dilDegistirSessiz(d){dilAyarla(d);sayfayiCevir();document.querySelectorAll('[data-dil]').forEach(b=>b.classList.toggle('active',b.dataset.dil===d));$('pauseBtn').textContent=t('dugme.duraklat');}
init();
