/* OSIRISZK — Teker / zemin etkileşimi (terramekanik). SI birimleri.
   • Batma: Bekker basınç-batma bağıntısından rijit teker için kapalı çözüm (Wong 2012, J. Terramechanics 49, Denk. 6)
       z = [ 3W / ( b (3-n) (kc/b + kφ) √D ) ]^(2/(2n+1))
   • Sıkıştırma direnci (yuvarlanma direnci): Rc = b (kc/b + kφ) z^(n+1) / (n+1)
   • En büyük çekiş: Mohr-Coulomb  Hmax = A·c + W·tanφ ,  A = b·l ,  l ≈ √(D·z)
   • Kaymaya bağlı çekiş: Janosi-Hanamoto  H = Hmax [1 - K/(s·l) (1 - e^(-s·l/K))]
   • Kayma-batma: kayma arttıkça teker kazar (z ≈ z0 (1 + 0.6|s|)) — oyun için basitleştirilmiş.
   Kaya (rijit) zeminde batma yoktur; çekiş Coulomb sürtünmesi μW ile sınırlıdır.
   Bu bir eğitim simülasyonudur; buldozer direnci, tırnak (grouser) etkisi ve dinamik etkiler ihmal edilmiştir. */
const DEG=Math.PI/180;

/** 5 sınıflı ağırlıklarla zemin parametrelerini karıştırır. */
export function blendSoil(w5,classes){
 let soft=0,rigid=0,c=0,tan=0,n=0,kc=0,kphi=0,K=0,mu=0,roll=0,dust=0,track=0;
 for(let i=0;i<5;i++){const w=w5[i];if(w<=0)continue;const p=classes[i].physics,e=classes[i].effects||{dust:1,track:.5};dust+=w*e.dust;track+=w*e.track;
  if(p.rigid){rigid+=w;mu+=w*(p.wheel_friction_mu??.75);roll+=w*(p.rolling_coef??.015);}
  else{soft+=w;c+=w*p.cohesion_kpa;tan+=w*Math.tan(p.friction_deg*DEG);n+=w*p.bekker_n;kc+=w*p.bekker_kc;kphi+=w*p.bekker_kphi;K+=w*p.shear_K_m;}}
 const s=soft>1e-6?1/soft:0,r=rigid>1e-6?1/rigid:0;
 return {rigidFrac:rigid/(soft+rigid||1),c:c*s,tanPhi:soft?tan*s:.7,n:soft?n*s:1,kc:kc*s,kphi:soft?kphi*s:5000,K:soft?K*s:.025,mu:rigid?mu*r:.75,roll:rigid?roll*r:.015,dust,track};}

/** Tek teker teması. W: tekere düşen normal yük (N), D çap (m), b genişlik (m), s kayma oranı (-1…1). */
export function wheelContact(soil,W,D,b,s){
 const k=soil.kc*1000/b+soil.kphi*1000, n=soil.n;
 const z0=Math.pow(3*W/(b*(3-n)*k*Math.sqrt(D)),2/(2*n+1));
 const zs=Math.min(.32,z0*(1+.6*Math.abs(s)));
 const l=Math.sqrt(D*Math.max(zs,1e-4)), A=b*l;
 const HmaxSoft=A*soil.c*1000+W*soil.tanPhi, RcSoft=b*k*Math.pow(zs,n+1)/(n+1);
 const rf=soil.rigidFrac;
 return {z:zs*(1-rf),l,K:soil.K,HmaxSoft,HmaxRigid:soil.mu*W,Rc:RcSoft*(1-rf)+soil.roll*W*rf,rf,
  Hmax:HmaxSoft*(1-rf)+soil.mu*W*rf};}

/** Kayma oranında çekiş kuvveti (N), işaretli (+ ileri). */
export function traction(ct,s){
 const a=Math.abs(s);if(a<1e-6)return 0;
 const j=a*ct.l,soft=j<1e-6?j/(2*ct.K):1-(ct.K/j)*(1-Math.exp(-j/ct.K));
 const rigid=Math.min(1,a/.12);
 return Math.sign(s)*(ct.HmaxSoft*soft*(1-ct.rf)+ct.HmaxRigid*rigid*ct.rf);}

/** Kayma oranı: sürüşte (vw-v)/vw, frenlemede (vw-v)/v. Düşük hızda paydanın alt sınırı 0.3 m/s. */
export function slipRatio(vw,v){const den=Math.max(Math.abs(vw),Math.abs(v),.3);return Math.max(-1,Math.min(1,(vw-v)/den));}
