import {HOVER,clamp} from '../physics/config.js';
import {CONTROL_PROFILES,controlProfile,expo} from './ControlProfiles.js';
import {AXES,ACTIONS,defaultBindings,bindingError,bindingDown} from './ControlBindings.js';

const validCalibration=c=>c&&[c.min,c.max,c.center].every(Number.isFinite)&&c.center-c.min>.4&&c.max-c.center>.4;

export function normalizeAxis(value,calibration,deadzone=.04){
  const c=calibration??{min:-1,max:1,center:0};
  const scale=value>=c.center?c.max-c.center:c.center-c.min;
  const n=clamp((value-c.center)/Math.max(.2,scale),-1,1);
  return Math.abs(n)<=deadzone?0:Math.sign(n)*(Math.abs(n)-deadzone)/(1-deadzone);
}
export function mapGamepad(pad,settings,hover=HOVER){
  const HOVER_=hover;
  const axes=mappedAxes(pad,settings);
  const up=-(axes[1]??0);
  const profile=controlProfile(settings.profile);
  // Keep the lower half linear for predictable cut/arming. RC remains a linear 0–100% axis.
  const throttle=settings.throttle!=='rc'?(up<0?HOVER_*(1+up):HOVER_+(1-HOVER_)*expo(up,profile.throttleExpo)):(up+1)/2;
  const result={yaw:expo(axes[0]??0,profile.stickExpo),pitch:expo(-(axes[3]??0),profile.rightStickExpo),roll:expo(axes[2]??0,profile.rightStickExpo),throttle:clamp(throttle,0,1)};
  if(settings.throttle==='assist')result.verticalCommand=expo(up,.5);
  return result;
}
export function mappedAxes(pad,settings){
  return AXES.map((name,i)=>{const a=settings.binding?.axes[name]??{index:i,inverted:false};
    return normalizeAxis(pad.axes[a.index]??0,settings.calibration?.[a.index],settings.deadzone)*(a.inverted?-1:1);
  });
}
export class InputManager {
  constructor(onBlur){
    this.hover=HOVER; // etkin dronun hover itkisi (App.setDrone günceller)
    this.keys=new Set();this.pressed=new Set();this.previousButtons=new Set();this.lastPad=null;this.controlDevice=null;
    this.keyboardThrottle=0;this.source='auto';this.name='KLAVYE';this.active=false;
    this.settings={profile:'soft',throttle:'assist',deadzone:.04,calibration:null,motorStop:false,rate:670,cameraTilt:25,binding:defaultBindings()};this.calibrating=false;this.sample=null;
    this.deviceProfiles=Object.create(null);this.pads=[];this.preferredPad='';this.profileId=null;this.mappingReady=false;
    this.throttleLocked=false;this.lowThrottle=true;this.lockReason='';
    this.padStatus='Simülatöre tıkla, kumandada bir tuşa bas.';this.sticks=null;
    try{const stored=JSON.parse(localStorage.getItem('zsk.input')??'null');if(stored){
      if(['assist','hover','rc'].includes(stored.throttle))this.settings.throttle=stored.throttle;
      if(Object.hasOwn(CONTROL_PROFILES,stored.profile))this.settings.profile=stored.profile;
      if(Number.isFinite(stored.deadzone))this.settings.deadzone=clamp(stored.deadzone,0,.2);
      if(typeof stored.motorStop==='boolean')this.settings.motorStop=stored.motorStop;
      if(Number.isFinite(stored.rate))this.settings.rate=clamp(stored.rate,100,1200);
      if(Number.isFinite(stored.cameraTilt))this.settings.cameraTilt=clamp(stored.cameraTilt,0,80);
      if(Array.isArray(stored.calibration)&&stored.calibration.length===4&&stored.calibration.every(validCalibration))this.settings.calibration=stored.calibration;
    }}catch{/* defaults remain usable */}
    try{const saved=JSON.parse(localStorage.getItem('zsk.devices.v1')??'null');if(saved&&typeof saved==='object'&&!Array.isArray(saved))this.deviceProfiles=Object.assign(Object.create(null),saved);}catch{}
    this.abort=new AbortController();const options={signal:this.abort.signal};
    window.addEventListener('keydown',e=>{
      if(!this.active||e.target.closest('input,select,textarea,button,a,summary,[contenteditable="true"]')||e.ctrlKey||e.metaKey||e.altKey)return;
      if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();
      if(!e.repeat)this.pressed.add(e.code);this.keys.add(e.code);
    },options);
    window.addEventListener('keyup',e=>this.keys.delete(e.code),options);
    window.addEventListener('blur',()=>{this.clear();onBlur();},options);
    document.addEventListener('visibilitychange',()=>{if(document.hidden){this.clear();onBlur();}},options);
  }
  clear(){this.keys.clear();this.pressed.clear();}
  save(){const {binding,calibration,...general}=this.settings;
    if(this.lastPad&&this.mappingReady)this.deviceProfiles[this.lastPad.id]={binding:structuredClone(binding),calibration:structuredClone(calibration),throttle:this.settings.throttle};
    try{localStorage.setItem('zsk.input',JSON.stringify(general));
    localStorage.setItem('zsk.devices.v1',JSON.stringify(this.deviceProfiles));
  }catch{}}
  resetThrottle(){this.keyboardThrottle=0;this.clear();this.throttleLocked=true;this.lowThrottle=false;this.lockReason='Gaz kilitli · çubuğu en alta çek, sonra yeniden motor aç.';}
  canArm(){return !this.throttleLocked||this.lowThrottle;}
  releaseThrottleLock(){this.throttleLocked=false;this.lockReason='';}
  applyBinding(binding){
    if(!this.lastPad)return 'Önce kumandayı bağla ve bir tuşa bas.';
    const error=bindingError(binding,this.lastPad);if(error)return error;
    this.settings.binding=structuredClone(binding);this.settings.calibration=null;this.mappingReady=true;
    this.previousButtons=new Set(ACTIONS.filter(name=>bindingDown(this.lastPad,binding.buttons[name])));
    this.calibrating=false;this.sample=null;this.resetThrottle();this.save();return '';
  }
  calibrate(){
    if(!this.lastPad)return false;
    if(!this.mappingReady)return false;
    if(!this.calibrating){this.sample=this.lastPad.axes.map(v=>({min:v,max:v,center:v}));this.calibrating=true;return true;}
    const calibration=this.sample.map((c,i)=>({...c,center:this.lastPad.axes[i]}));
    const valid=AXES.every(name=>validCalibration(calibration[this.settings.binding.axes[name].index]));
    if(valid){this.settings.calibration=calibration;this.save();}
    this.calibrating=false;this.resetThrottle();return valid;
  }
  update(dt){
    const k=code=>this.keys.has(code)?1:0;
    this.keyboardThrottle=this.throttleLocked?0:clamp(this.keyboardThrottle+(k('KeyW')-k('KeyS'))*dt*controlProfile(this.settings.profile).keyboardThrottleRate,0,1);
    if(this.keys.has('KeyZ'))this.keyboardThrottle=0;
    const consume=code=>{const yes=this.pressed.has(code);this.pressed.delete(code);return yes;};
    if(consume('KeyZ'))this.keyboardThrottle=0;
    const hover=consume('KeyH');if(hover&&!this.throttleLocked)this.keyboardThrottle=this.hover;
    const out={pitch:k('ArrowUp')-k('ArrowDown'),roll:k('ArrowRight')-k('ArrowLeft'),yaw:k('KeyD')-k('KeyA'),throttle:this.keyboardThrottle,
      arm:consume('Space'),cut:consume('KeyQ'),reset:consume('KeyR'),camera:consume('KeyC'),mode:consume('KeyM'),pause:consume('Escape'),scan:!!k('KeyX'),deviceLost:false};
    let pads=[];
    this.padStatus='Kumanda bekleniyor · simülatöre tıkla, Y tuşuna bas.';
    try{
      if(typeof navigator.getGamepads==='function')pads=Array.from(navigator.getGamepads()).filter(p=>p?.connected);
      else this.padStatus='Bu tarayıcı kumanda erişimi sunmuyor. Chrome veya Edge ile dene.';
    }catch{this.padStatus='Tarayıcı kumanda erişimini engelledi. Siteyi ayrı bir tarayıcı sekmesinde aç.';}
    this.pads=pads;
    const pad=(this.preferredPad?pads.find(p=>`${p.index}:${p.id}`===this.preferredPad):null)??(!this.preferredPad?(pads.find(p=>p.mapping==='standard'&&p.axes.length>=4)??pads.find(p=>p.axes.length>=4)):null);
    if(pad&&this.profileId!==pad.id){
      this.profileId=pad.id;const saved=this.deviceProfiles[pad.id];
      this.mappingReady=!!saved&&!bindingError(saved.binding,pad);
      this.settings.binding=this.mappingReady?structuredClone(saved.binding):defaultBindings();
      this.settings.calibration=this.mappingReady&&Array.isArray(saved.calibration)?saved.calibration.map(c=>validCalibration(c)?c:null):null;
      if(this.mappingReady&&['assist','hover','rc'].includes(saved.throttle))this.settings.throttle=saved.throttle;
      else if(pad.mapping!=='standard')this.settings.throttle='rc';
      else if(Object.keys(this.deviceProfiles).length)this.settings.throttle='assist';
      if(pad.mapping==='standard')this.mappingReady=true;
      this.calibrating=false;this.sample=null;
    }
    if(pad)this.padStatus=`Bağlı · ${pad.id||'Standart kumanda'}`;
    else if(pads.length)this.padStatus='Seçili kumanda yok veya dört uçuş ekseni bulunamadı.';
    if(pad&&!this.mappingReady)this.padStatus='Kumanda bağlı · uçuş için Kumanda atamaları menüsünü tamamla.';
    const usePad=this.source!=='keyboard'&&!!pad&&this.mappingReady;
    const device=usePad?`pad:${pad.index}:${pad.id}`:this.source==='gamepad'?'missing':'keyboard';
    out.deviceChanged=this.controlDevice!==null&&device!==this.controlDevice;
    this.controlDevice=device;
    out.deviceLost=!!this.lastPad&&!pad&&this.source!=='keyboard';
    this.lastPad=pad??null;
    if(!pad){this.calibrating=false;this.sample=null;this.profileId=null;this.mappingReady=false;}
    this.sticks=usePad?mappedAxes(pad,this.settings):null;
    this.lowThrottle=!this.keys.has('KeyW')&&!hover&&this.keyboardThrottle<=.005;
    if(usePad){
      if(this.calibrating)pad.axes.forEach((v,i)=>{if(this.sample[i]){this.sample[i].min=Math.min(this.sample[i].min,v);this.sample[i].max=Math.max(this.sample[i].max,v);}});
      Object.assign(out,mapGamepad(pad,this.settings,this.hover));
      this.lowThrottle=this.sticks[1]>=.95;
      for(const name of ACTIONS){
        const binding=this.settings.binding.buttons[name],down=bindingDown(pad,binding),was=this.previousButtons.has(name);
        if(name==='arm'&&binding?.startsWith('a:')&&was&&!down)out.cut=true;
        out[name]=out[name]||(name==='scan'?down:down&&!was);
        if(down)this.previousButtons.add(name);else this.previousButtons.delete(name);
      }
      this.name=pad.mapping==='standard'?'XBOX / MODE 2':'FPV KUMANDA';
    }else{
      this.previousButtons.clear();this.name=this.source==='gamepad'?'KUMANDA BEKLENİYOR':'KLAVYE';
      if(this.source==='gamepad'||(pad&&!this.mappingReady&&this.source!=='keyboard')){Object.assign(out,{pitch:0,roll:0,yaw:0,throttle:0,arm:false});this.lowThrottle=false;if(pad&&!this.mappingReady)this.name='ATAMA BEKLENİYOR';}
    }
    // A button held while plugging in/switching a controller must not trigger an action.
    if(out.deviceChanged){this.resetThrottle();for(const action of ACTIONS)out[action]=false;}
    if(this.throttleLocked){out.throttle=0;delete out.verticalCommand;out.pitch=out.roll=out.yaw=0;
      this.lockReason=this.lowThrottle?'Gaz sıfırlandı · A / Space veya atanan tuşla motor aç.':'Gaz kilitli · çubuğu en alta çek, sonra yeniden motor aç.';
    }
    if(this.calibrating)Object.assign(out,{pitch:0,roll:0,yaw:0,throttle:0,arm:false,scan:false});
    return out;
  }
  dispose(){this.abort.abort();}
}
