/**
 * Motor sesi: pervane geçiş frekansı (devir × kanat) testere + kare dalga,
 * devirle açılan alçak geçiren süzgeç ve pervane rüzgârı gürültüsü.
 * Hava sesi: havaya göre hızla (ve ortam rüzgârıyla) yükselen süzgeçli gürültü.
 * Olay sesleri (`cue`): kapı, tur, rekor, motor açma/kapama, temas/çarpışma/kaza, düşük batarya.
 * Hepsi aynı ses açma/kapama ve düzey ayarına bağlıdır; fiziği yalnız okur.
 * Tarayıcı kuralı gereği ses bağlamı ilk kullanıcı etkileşiminde başlar.
 */
const STORE='zsk.sound.v1',CUE_STORE='zsk.sound.cues.v1';
/** Olay sesleri: [frekans Hz, başlangıç sn, süre sn, dalga, kazanç]. */
export const CUES=Object.freeze({
  gate:[[1320,0,.07,'sine',.32]],
  lap:[[880,0,.09,'sine',.3],[1320,.1,.15,'sine',.3]],
  record:[[784,0,.09,'triangle',.3],[988,.09,.09,'triangle',.3],[1175,.18,.09,'triangle',.3],[1568,.27,.24,'triangle',.32]],
  arm:[[660,0,.07,'square',.09],[990,.08,.11,'square',.09]],
  disarm:[[990,0,.07,'square',.09],[660,.08,.13,'square',.09]],
  battery:[[2093,0,.08,'square',.07],[2093,.16,.08,'square',.07]],
});
/** Gürültü olayları: [süre sn, alçak geçiren Hz, kazanç, gövde tonu Hz (0 = yok)]. */
export const HITS=Object.freeze({contact:[.06,1800,.22,0],impact:[.2,1000,.5,95],crash:[.5,1300,.7,70]});
/** Hava sesi düzeyi (saf; testli): havaya göre hız ve ortam rüzgârı (m/sn) → 0…1. */
export function airLevel(airspeed,wind){return Math.min(1,(Math.max(0,airspeed)/24)**2)*.8+Math.min(1,Math.max(0,wind)/9)*.2;}

export class MotorSound {
  constructor(storage=null){
    this.storage=storage;this.ctx=null;this.enabled=true;this.volume=.35;
    try{const s=JSON.parse(storage?.getItem(STORE)??'null');if(s){this.enabled=s.enabled!==false;if(Number.isFinite(s.volume))this.volume=Math.max(0,Math.min(1,s.volume));}}catch{}
    this.cues=true;try{this.cues=storage?.getItem(CUE_STORE)!=='0';}catch{}
    this.lastArmed=null;this.lastHit=-1e9;this.lastBattery=-1e9;this.distance=0;this.live=false;
    this.unlock=()=>this.ensure();
    for(const type of ['pointerdown','keydown'])window.addEventListener(type,this.unlock,{passive:true});
  }
  save(){try{this.storage?.setItem(STORE,JSON.stringify({enabled:this.enabled,volume:this.volume}));}catch{}}
  setEnabled(on){this.enabled=on;this.save();if(!on&&this.master){this.master.gain.setTargetAtTime(0,this.ctx.currentTime,.05);this.fx?.gain.setTargetAtTime(0,this.ctx.currentTime,.05);}}
  setCues(on){this.cues=!!on;try{this.storage?.setItem(CUE_STORE,on?'1':'0');}catch{}}
  setVolume(v){this.volume=Math.max(0,Math.min(1,v));this.save();}
  ensure(){
    if(this.ctx||!this.enabled)return this.ctx?.resume?.();
    const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
    try{
      const ctx=this.ctx=new AC();
      this.master=ctx.createGain();this.master.gain.value=0;this.master.connect(ctx.destination);
      this.filter=ctx.createBiquadFilter();this.filter.type='lowpass';this.filter.frequency.value=800;this.filter.Q.value=.7;this.filter.connect(this.master);
      this.osc=ctx.createOscillator();this.osc.type='sawtooth';this.osc.frequency.value=120;
      this.osc2=ctx.createOscillator();this.osc2.type='square';this.osc2.frequency.value=240;
      const g1=ctx.createGain();g1.gain.value=.55;const g2=ctx.createGain();g2.gain.value=.18;this.oscGain2=g2;
      this.osc.connect(g1).connect(this.filter);this.osc2.connect(g2).connect(this.filter);
      const len=ctx.sampleRate*2,buf=ctx.createBuffer(1,len,ctx.sampleRate),data=buf.getChannelData(0);
      for(let i=0;i<len;i++)data[i]=Math.random()*2-1;
      this.noise=ctx.createBufferSource();this.noise.buffer=buf;this.noise.loop=true;
      this.band=ctx.createBiquadFilter();this.band.type='bandpass';this.band.Q.value=.8;this.noiseGain=ctx.createGain();this.noiseGain.gain.value=.25;
      this.noise.connect(this.band).connect(this.noiseGain).connect(this.master);
      this.noiseBuffer=buf;
      // Olay ve hava sesleri ayrı çıkış: motor düzeyi (master) motorlar kapalıyken sıfırdır
      this.fx=ctx.createGain();this.fx.gain.value=0;this.fx.connect(ctx.destination);
      this.air=ctx.createBufferSource();this.air.buffer=buf;this.air.loop=true;
      this.airFilter=ctx.createBiquadFilter();this.airFilter.type='bandpass';this.airFilter.frequency.value=400;this.airFilter.Q.value=.6;
      this.airGain=ctx.createGain();this.airGain.gain.value=0;this.air.connect(this.airFilter).connect(this.airGain).connect(this.fx);
      this.osc.start();this.osc2.start();this.noise.start();this.air.start(0,.73);
    }catch{this.ctx=null;}
  }
  /** Her karede: etkin dron, motor hızları, kameraya uzaklık (m), duraklatma. */
  update(flight,{distance=0,paused=false,active=true}={}){
    if(!this.ctx||!this.master)return;
    this.distance=distance;this.live=this.enabled&&active&&!paused;
    const t=this.ctx.currentTime,d=flight.drone,n=d.motorCount;
    let omega=0,thrust=0,spread=0;
    for(let i=0;i<n;i++){omega+=flight.motorOmega[i];thrust+=flight.motorThrust[i];}
    omega/=n;thrust/=n;for(let i=0;i<n;i++)spread+=Math.abs(flight.motorOmega[i]-omega);spread/=n;
    const on=this.enabled&&active&&!paused&&flight.armed&&omega>1;
    const load=Math.sqrt(Math.max(0,thrust)/d.maxMotorThrust);
    const fall=1/(1+.08*distance*distance);
    const level=on?this.volume*d.sound.gain*(.18+.82*load)*fall*.5:0;
    const f=Math.max(30,omega/(2*Math.PI)*d.sound.blades*d.sound.tone);
    this.master.gain.setTargetAtTime(level,t,.04);
    this.osc.frequency.setTargetAtTime(f,t,.03);
    this.osc2.frequency.setTargetAtTime(f*2.01+spread*.05,t,.03);
    this.filter.frequency.setTargetAtTime(300+f*3.5+load*1800,t,.05);
    this.band.frequency.setTargetAtTime(600+f*4,t,.05);
    this.noiseGain.gain.setTargetAtTime(.12+.35*load,t,.05);
    // Hava sesi: havaya göre hız (rüzgâr kapalıyken yer hızı); takip kamerasında uzaklıkla azalır, ortam rüzgârı azalmaz
    const v=flight.velocity,air=flight.wind?.active?flight.air:null;
    const ax=(v?.x??0)-(air?.x??0),ay=(v?.y??0)-(air?.y??0),az=(v?.z??0)-(air?.z??0),airspeed=Math.hypot(ax,ay,az);
    const windSpeed=air?Math.hypot(air.x,air.z):0;
    if(this.fx){
      this.fx.gain.setTargetAtTime(this.live?this.volume:0,t,.05);
      const lvl=airLevel(airspeed*Math.sqrt(fall),windSpeed);
      this.airGain.gain.setTargetAtTime(this.live?lvl*.45:0,t,.12);
      this.airFilter.frequency.setTargetAtTime(320+airspeed*45,t,.15);
    }
    // Motor açma/kapama bip'i (kazadan hemen sonraki kapanmada değil) ve düşük batarya uyarısı
    if(this.lastArmed!==null&&flight.armed!==this.lastArmed){
      if(flight.armed)this.cue('arm');else if(t-this.lastHit>.6)this.cue('disarm');
    }
    this.lastArmed=!!flight.armed;
    const b=flight.battery;
    if(b?.enabled&&flight.armed&&b.charge<.2&&t-this.lastBattery>(b.charge<.1?3:8)){this.lastBattery=t;this.cue('battery');}
  }
  /** Olay sesi; ses kapalıysa, bağlam yoksa ya da olay sesleri kapalıysa sessiz. Hata uçuşu etkilemez. */
  cue(type){
    if(HITS[type]&&this.ctx)this.lastHit=this.ctx.currentTime;
    if(!this.ctx||!this.fx||!this.live||!this.cues)return false;
    try{
      const ctx=this.ctx,t0=ctx.currentTime+.01;
      const env=(g,start,dur)=>{const gn=ctx.createGain();gn.gain.setValueAtTime(0,start);gn.gain.linearRampToValueAtTime(g,start+.005);gn.gain.exponentialRampToValueAtTime(.0001,start+dur);gn.connect(this.fx);return gn;};
      if(CUES[type]){
        for(const [f,start,dur,wave,g] of CUES[type]){const o=ctx.createOscillator();o.type=wave;o.frequency.value=f;o.connect(env(g,t0+start,dur));o.start(t0+start);o.stop(t0+start+dur+.03);}
        return true;
      }
      const hit=HITS[type];if(!hit)return false;
      const [dur,cut,g,body]=hit,fall=1/(1+.08*this.distance*this.distance);
      const src=ctx.createBufferSource();src.buffer=this.noiseBuffer;const lp=ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=cut;
      src.connect(lp).connect(env(g*fall,t0,dur));src.start(t0,Math.random()*1.4,dur+.05);
      if(body){const o=ctx.createOscillator();o.type='sine';o.frequency.setValueAtTime(body*1.6,t0);o.frequency.exponentialRampToValueAtTime(body,t0+.08);o.connect(env(g*.9*fall,t0,dur*.6));o.start(t0);o.stop(t0+dur);}
      if(type==='crash')for(const dt of [.07,.16,.27]){ // parça tıkırtısı
        const c=ctx.createBufferSource();c.buffer=this.noiseBuffer;const hp=ctx.createBiquadFilter();hp.type='highpass';hp.frequency.value=2500;
        c.connect(hp).connect(env(.25*fall,t0+dt,.05));c.start(t0+dt,Math.random()*1.4,.08);
      }
      return true;
    }catch{return false;}
  }
  dispose(){
    for(const type of ['pointerdown','keydown'])window.removeEventListener(type,this.unlock);
    try{this.osc?.stop();this.osc2?.stop();this.noise?.stop();this.air?.stop();this.ctx?.close();}catch{}
    this.ctx=null;
  }
}
