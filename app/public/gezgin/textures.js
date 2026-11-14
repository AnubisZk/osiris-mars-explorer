/* OSIRISZK — Zemin dokuları.
   1) assets/terrain/manifest.json fotoğraf dokularını listeliyorsa (ML boru hattı üretir) onlar yüklenir.
   2) Eksik sınıflar için Mars yüzey fotoğraflarındaki görünüme göre prosedürel, kenarları dikişsiz doku üretilir:
      regolit (ince tane + çakıl), kum (bazaltik koyu kum + dalgacıklar), ana kaya (açık tonlu katmanlı tortul kaya + çatlaklar),
      çakıllı zemin (bazalt/kırmızı kırıntılar), toz (parlak oksit toz + rüzgâr izleri).
   Dokularda RGB = albedo, A = yükseklik (karışım ve kabartma için). */
import {clamp,lerp,fbm} from './engine.js';
import {MATERIAL_KEYS} from './materials.js';

// ── Periyodik (dikişsiz) gürültü
function hashi(x,y,s){let h=(Math.imul(x,374761393)+Math.imul(y,668265263)+Math.imul(s,1442695041))|0;h=Math.imul(h^(h>>>13),1274126177);h^=h>>>16;return (h>>>0)/4294967296;}
function pnoise(x,y,P,s){const xi=Math.floor(x),yi=Math.floor(y),fx=x-xi,fy=y-yi,u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy);
 const x0=((xi%P)+P)%P,y0=((yi%P)+P)%P,x1=(x0+1)%P,y1=(y0+1)%P,a=hashi(x0,y0,s),b=hashi(x1,y0,s),c=hashi(x0,y1,s),d=hashi(x1,y1,s);
 const top=a+(b-a)*u,bot=c+(d-c)*u;return top+(bot-top)*v;}
function pfbm(x,y,P,s,oct){let sum=0,amp=.5,f=1,norm=0;for(let o=0;o<oct;o++){sum+=amp*pnoise(x*f,y*f,P*f,s+o*17);norm+=amp;amp*=.5;f*=2;}return sum/norm;}
function upsample(f,L,S){if(L===S)return f;const o=new Float32Array(S*S),k=L/S;
 for(let j=0;j<S;j++){const y=j*k,y0=Math.floor(y),fy=y-y0,y1=(y0+1)%L;for(let i=0;i<S;i++){const x=i*k,x0=Math.floor(x),fx=x-x0,x1=(x0+1)%L;
  const a=f[y0*L+x0],b=f[y0*L+x1],c=f[y1*L+x0],d=f[y1*L+x1];o[j*S+i]=a+(b-a)*fx+((c+(d-c)*fx)-(a+(b-a)*fx))*fy;}}return o;}
/** Düşük çözünürlükte hesaplanıp büyütülen yumuşak alan (0..1). */
function field(S,P,seed,oct=4){const L=Math.min(S,256),f=new Float32Array(L*L);for(let j=0;j<L;j++)for(let i=0;i<L;i++)f[j*L+i]=pfbm(i/L*P,j/L*P,P,seed,oct);return upsample(f,L,S);}
function rng(seed){let s=seed>>>0||1;return()=>{s^=s<<13;s^=s>>>17;s^=s<<5;return (s>>>0)/4294967296;};}

class Canvas{constructor(S){this.S=S;this.r=new Float32Array(S*S);this.g=new Float32Array(S*S);this.b=new Float32Array(S*S);this.h=new Float32Array(S*S);}
 toRGBA(){const S=this.S,o=new Uint8Array(S*S*4);for(let i=0;i<S*S;i++){o[i*4]=clamp(this.r[i]*255,0,255);o[i*4+1]=clamp(this.g[i]*255,0,255);o[i*4+2]=clamp(this.b[i]*255,0,255);o[i*4+3]=clamp(this.h[i]*255,0,255);}return o;}}
/** Çakıl/kırıntı serpiştirme: gölgeli elipsler, kenar sarmalı (dikişsiz). */
function pebbles(cv,count,rmin,rmax,palette,seed,heightGain=.5,dustCap=.25){
 const S=cv.S,R=rng(seed);
 for(let p=0;p<count;p++){const cx=R()*S,cy=R()*S,rad=(rmin+(rmax-rmin)*Math.pow(R(),2.2))*S,ax=rad*(.7+.6*R()),ay=rad*(.55+.5*R()),rot=R()*Math.PI,cr=Math.cos(rot),sr=Math.sin(rot);
  const col=palette[Math.floor(R()*palette.length)],tone=.85+.3*R(),ext=Math.ceil(Math.max(ax,ay))+1;
  for(let dy=-ext;dy<=ext;dy++)for(let dx=-ext;dx<=ext;dx++){const u=(dx*cr+dy*sr)/ax,v=(-dx*sr+dy*cr)/ay,d2=u*u+v*v;
   const px=((Math.floor(cx)+dx)%S+S)%S,py=((Math.floor(cy)+dy)%S+S)%S,i=py*S+px;
   if(d2>1.25)continue;
   if(d2>1){const sh=.12*(1.25-d2)/.25;cv.r[i]*=1-sh;cv.g[i]*=1-sh;cv.b[i]*=1-sh;continue;}  // temas gölgesi
   const dome=Math.sqrt(1-d2),light=.62+.5*clamp(dome*.6-u*.28-v*.32,0,1),cap=clamp((-v-.1)*1.4,0,1)*dustCap;
   cv.r[i]=lerp(col[0]*tone*light,.70,cap);cv.g[i]=lerp(col[1]*tone*light,.44,cap);cv.b[i]=lerp(col[2]*tone*light,.29,cap);
   cv.h[i]=Math.max(cv.h[i],.5+dome*heightGain);}}}
function grain(cv,amount,seed){const R=rng(seed);for(let i=0;i<cv.S*cv.S;i++){const g=(R()-.5)*amount;cv.r[i]+=g;cv.g[i]+=g*.85;cv.b[i]+=g*.7;}}

const GEN={
 regolith(S){const cv=new Canvas(S),a=field(S,4,11,4),b=field(S,16,23,3),c=field(S,8,37,3),base=[.56,.30,.19];
  for(let i=0;i<S*S;i++){const crust=clamp((b[i]-.56)*7,0,1),t=.86+.24*a[i]+.12*(c[i]-.5)+crust*.05;
   cv.r[i]=base[0]*t;cv.g[i]=base[1]*t*(.98+.04*a[i]);cv.b[i]=base[2]*t;cv.h[i]=.38+.18*c[i]+crust*.14;}
  grain(cv,.07,5);pebbles(cv,Math.round(70*(S/512)**.6+30),.003,.013,[[.30,.22,.18],[.42,.30,.23],[.55,.36,.26]],91,.45,.35);return cv;},
 sand(S){const cv=new Canvas(S),warp=field(S,3,51,3),tone=field(S,5,63,3),base=[.36,.26,.21];
  for(let j=0;j<S;j++)for(let i=0;i<S;i++){const k=j*S+i,u=i/S,v=j/S,ph=2*Math.PI*(3*u+10*v)+warp[k]*7.5,s=Math.sin(ph);
   const rip=Math.pow(.5+.5*s,1.7),lee=Math.max(0,Math.cos(ph))*.5,t=.84+.16*rip+.1*(tone[k]-.5)-.05*lee;
   cv.r[k]=base[0]*t*1.02;cv.g[k]=base[1]*t;cv.b[k]=base[2]*t*.98;cv.h[k]=.2+.65*rip+.08*tone[k];}
  grain(cv,.045,7);return cv;},
 bedrock(S){const cv=new Canvas(S),warp=field(S,3,71,3),mott=field(S,6,83,4),dustF=field(S,4,97,3),breakF=field(S,5,109,3),wid=field(S,7,113,2),base=[.66,.47,.34];
  // Katmanlı tortul kaya (çamurtaşı): ince tabakalar + kesintili, düzensiz kırık ağı (iri ve ince iki ölçek)
  const vor=(N,seed)=>{const R=rng(seed),pts=[];for(let i=0;i<N*N;i++)pts.push([R(),R(),R()]);
   return (u,v)=>{const cx=Math.floor(u*N),cy=Math.floor(v*N);let f1=9,f2=9,id=0;for(let oy=-1;oy<=1;oy++)for(let ox=-1;ox<=1;ox++){const gx=cx+ox,gy=cy+oy,w=pts[((gy%N+N)%N)*N+((gx%N+N)%N)],dx=gx+w[0]-u*N,dy=(gy+w[1]-v*N)*1.35,d=Math.sqrt(dx*dx+dy*dy);
    if(d<f1){f2=f1;f1=d;id=w[2];}else if(d<f2)f2=d;}return [f2-f1,id];};};
  const big=vor(8,131),fine=vor(17,137);
  for(let j=0;j<S;j++)for(let i=0;i<S;i++){const k=j*S+i,u=i/S,v=j/S;
   const [e1,id]=big(u,v),[e2]=fine(u,v),w1=.02+.035*wid[k];
   const crack=(1-clamp(e1/w1,0,1))*clamp((breakF[k]-.38)*4,0,1),hair=(1-clamp(e2/.035,0,1))*clamp((breakF[k]-.5)*3,0,1)*.5;
   const strata=Math.sin(2*Math.PI*v*13+warp[k]*6),layer=.5+.5*strata,bandDark=clamp(-strata*1.6-.9,0,1);
   const plate=.92+.09*id+.1*(mott[k]-.5),t=plate*(.9+.12*layer)*(1-bandDark*.12);
   const dust=clamp((dustF[k]-.48)*2.4+crack*.7,0,1)*.5,dark=crack*.3+hair*.18;
   cv.r[k]=lerp(base[0]*t,.63,dust)*(1-dark);cv.g[k]=lerp(base[1]*t,.39,dust)*(1-dark*1.05);cv.b[k]=lerp(base[2]*t,.26,dust)*(1-dark*1.1);
   cv.h[k]=clamp(.6+.12*id+.1*layer-crack*.5-hair*.25-dust*.12,0,1);}
  grain(cv,.04,9);pebbles(cv,Math.round(25*(S/512)**.6+8),.003,.01,[[.58,.43,.33],[.48,.34,.26]],149,.3,.4);return cv;},
 gravel(S){const cv=new Canvas(S),a=field(S,6,141,4),base=[.48,.29,.20];
  for(let i=0;i<S*S;i++){const t=.82+.22*a[i];cv.r[i]=base[0]*t;cv.g[i]=base[1]*t;cv.b[i]=base[2]*t;cv.h[i]=.25+.15*a[i];}
  grain(cv,.06,13);pebbles(cv,Math.round(380*(S/512)**.6+80),.005,.03,[[.24,.21,.20],[.31,.26,.23],[.50,.31,.22],[.60,.46,.37],[.40,.27,.20]],151,.5,.3);return cv;},
 dust(S){const cv=new Canvas(S),a=field(S,3,161,4),warp=field(S,4,173,3),base=[.72,.45,.29];
  for(let j=0;j<S;j++)for(let i=0;i<S;i++){const k=j*S+i,streak=Math.sin(2*Math.PI*(i/S+14*j/S)+warp[k]*6)*.025,t=.9+.16*(a[k]-.5)*2*.5+streak;
   cv.r[k]=base[0]*t;cv.g[k]=base[1]*t;cv.b[k]=base[2]*t*.98;cv.h[k]=.3+.18*a[k]+streak;}
  grain(cv,.025,17);return cv;},
};
export function generateMaterialTexture(key,size){return GEN[key](size).toRGBA();}

/** Yörünge makro albedosu (HiRISE yoksa): büyük ölçekli parlak/koyu bölgeler. R kanalı 0..1, 0.5 nötr. */
export function generateMacro(size,half){const o=new Uint8Array(size*size*4);
 for(let j=0;j<size;j++)for(let i=0;i<size;i++){const x=-half+2*half*i/(size-1),z=-half+2*half*j/(size-1);
  const v=clamp(.5+.22*fbm(x*.021+3,z*.021-9)+.12*fbm(x*.07,z*.07)+.05*fbm(x*.19+7,z*.19),0,1),k=(j*size+i)*4;
  o[k]=o[k+1]=o[k+2]=v*255;o[k+3]=255;}return o;}

function loadImage(url){return new Promise((res,rej)=>{const im=new Image();im.onload=()=>res(im);im.onerror=()=>rej(new Error('yüklenemedi: '+url));im.src=url;});}
// Not: tarayıcı tuvali alfa kanalını önçarpımlı saklar; bu yüzden yükseklik ve toz ağırlığı AYRI gri dosyalarda tutulur.
async function imagePixels(url,size){const im=await loadImage(url),c=document.createElement('canvas');c.width=c.height=size;
 const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(im,0,0,size,size);return ctx.getImageData(0,0,size,size).data;}
/** Opak RGB fotoğraf dokusu; yükseklik ayrı gri görüntüden ya da parlaklıktan türetilir. */
async function photoTexture(url,heightUrl,size){const d=await imagePixels(url,size),o=new Uint8Array(size*size*4);
 for(let i=0;i<o.length;i+=4){o[i]=d[i];o[i+1]=d[i+1];o[i+2]=d[i+2];}
 if(heightUrl){try{const h=await imagePixels(heightUrl,size);for(let i=0;i<o.length;i+=4)o[i+3]=h[i];return o;}catch(e){console.warn(e.message);}}
 let mn=255,mx=0;for(let i=0;i<o.length;i+=4){const l=.3*o[i]+.59*o[i+1]+.11*o[i+2];o[i+3]=l;if(l<mn)mn=l;if(l>mx)mx=l;}
 const k=255/Math.max(1,mx-mn);for(let i=3;i<o.length;i+=4)o[i]=(o[i]-mn)*k;return o;}
async function grayTexture(url,size){const d=await imagePixels(url,size),o=new Uint8Array(size*size*4);for(let i=0;i<o.length;i+=4){o[i]=o[i+1]=o[i+2]=d[i];o[i+3]=255;}return o;}
/** Malzeme haritası: RGB = kum, kaya, çakıl; toz ayrı gri görüntüde. Çıktı RGBA = kum, kaya, çakıl, toz. */
async function materialMapTexture(rgbUrl,dustUrl,size){const d=await imagePixels(rgbUrl,size),o=new Uint8Array(size*size*4);
 for(let i=0;i<o.length;i+=4){o[i]=d[i];o[i+1]=d[i+1];o[i+2]=d[i+2];}
 if(dustUrl){try{const t=await imagePixels(dustUrl,size);for(let i=0;i<o.length;i+=4)o[i+3]=t[i];}catch(e){console.warn(e.message);}}
 return o;}

export async function loadManifest(url='assets/terrain/manifest.json'){
 try{const r=await fetch(url,{cache:'no-cache'});if(!r.ok)throw new Error(r.status);return await r.json();}
 catch(e){return {version:1,source:'procedural',quality:{}};}}

/**
 * Oyun için tüm zemin dokularını hazırlar.
 * @returns {{layers:Uint8Array[], size:number, macro:Uint8Array, macroSize:number, materialMap:null|{data,size}, sources:string[], source:string}}
 */
export async function buildTerrainTextures(qualityKey,size,macroSize,half,manifest,onProgress=()=>{}){
 const base='assets/terrain/',q=manifest?.quality?.[qualityKey]?.textures||{},layers=[],sources=[];
 for(let i=0;i<MATERIAL_KEYS.length;i++){const key=MATERIAL_KEYS[i];onProgress(`Doku: ${key} (${size}px)`);
  await new Promise(r=>setTimeout(r,0));
  let data=null;
  const hq=manifest?.quality?.[qualityKey]?.heights||{};
  if(q[key]){try{data=await photoTexture(base+q[key],hq[key]?base+hq[key]:null,size);sources.push('photo');}catch(e){console.warn(e.message);}}
  if(!data){data=generateMaterialTexture(key,size);sources.push('procedural');}
  layers.push(data);}
 let macro=null;
 if(manifest?.macro?.image){try{macro=await grayTexture(base+manifest.macro.image,macroSize);}catch(e){console.warn(e.message);}}
 if(!macro)macro=generateMacro(macroSize,half);
 let materialMap=null;
 if(manifest?.materialMap?.image){try{const mm=manifest.materialMap,ms=mm.size||256;materialMap={data:await materialMapTexture(base+mm.image,mm.dust?base+mm.dust:null,ms),size:ms};}catch(e){console.warn(e.message);}}
 const photo=sources.filter(s=>s==='photo').length;
 return {layers,size,macro,macroSize,materialMap,sources,source:photo===5?'photos':photo>0?'mixed':'procedural',manifest};}
