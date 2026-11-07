/**
 * Rüzgâr ve türbülans. Hava hızını üretir; FlightPhysics sürüklemeyi drone'un
 * havaya göre hızından hesaplar (konum/hız doğrudan değiştirilmez).
 * Deterministik: aynı tohum ve simülasyon süresi aynı rüzgârı verir; render hızından bağımsızdır.
 */
export const WIND_LEVELS=Object.freeze({
  off:{label:'Kapalı',speed:0,gust:0,turbulence:0},
  light:{label:'Hafif · 3 m/sn',speed:3,gust:1.5,turbulence:.5},
  moderate:{label:'Orta · 6 m/sn',speed:6,gust:3,turbulence:1},
  strong:{label:'Kuvvetli · 9 m/sn',speed:9,gust:4.5,turbulence:1.6},
});

function mulberry32(a){return()=>{a|=0;a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};}

export class Wind {
  constructor({level='off',direction=225,seed=7}={}){
    const r=mulberry32(seed);
    // Rüzgârın estiği yön (derece, +X doğu = 90, +Z güney = 180); hava bu yöne akar
    this.direction=direction;this.setLevel(level);
    this.waves=Array.from({length:5},(_,i)=>({w:.11*(i+1)**1.35+r()*.05,phase:r()*6.283,amp:1/(i+1)}));
    this.turb=Array.from({length:6},()=>({w:1.3+r()*2.4,phase:r()*6.283,ax:r()*2-1,ay:(r()*2-1)*.5,az:r()*2-1}));
    this.shelter=null; // (x,z) => true: kapalı alan (bina içi) → rüzgâr %12
    this.out={x:0,y:0,z:0};
  }
  setLevel(level){this.level=WIND_LEVELS[level]?level:'off';this.spec=WIND_LEVELS[this.level];}
  get active(){return this.spec.speed>0;}
  /** Dünya koordinatlarında hava hızı (m/sn). */
  velocity(t,p){
    const o=this.out,s=this.spec;
    if(!s.speed){o.x=o.y=o.z=0;return o;}
    let gust=0;for(const w of this.waves)gust+=w.amp*Math.sin(w.w*t+w.phase);
    gust/=2.28; // ~[-1, 1]
    const meander=.35*Math.sin(.031*t+this.waves[0].phase)+.15*Math.sin(.083*t+this.waves[2].phase);
    const dir=(this.direction*Math.PI/180)+meander;
    // Yer yüzeyine yakın rüzgâr zayıflar (logaritmik profil), 10 m'de nominal
    const h=Math.max(.3,p.y),profile=Math.min(1.25,Math.max(.35,Math.log(h/.3)/Math.log(10/.3)));
    const shelter=this.shelter?.(p.x,p.z)?.12:1;
    const speed=Math.max(0,s.speed+s.gust*gust)*profile*shelter;
    o.x=Math.sin(dir)*speed;o.z=-Math.cos(dir)*speed;o.y=0;
    if(s.turbulence){
      for(const k of this.turb){const v=Math.sin(k.w*t+k.phase+.13*(p.x+p.z))*s.turbulence*.35*shelter;o.x+=k.ax*v;o.y+=k.ay*v;o.z+=k.az*v;}
    }
    return o;
  }
}
