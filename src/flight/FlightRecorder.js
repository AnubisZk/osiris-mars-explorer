/**
 * Uçuş kaydı (kara kutu benzeri): simülasyon süresinde 50 Hz örnek, son ~10 dakika.
 * CSV öğretmenin tabloya alıp analiz etmesi içindir; render hızından bağımsızdır.
 */
export const RECORD_COLUMNS=['t_s','drone','mode','armed','x_m','y_m','z_m','vx_mps','vy_mps','vz_mps','speed_kmh',
  'roll_deg','pitch_deg','yaw_deg','in_throttle','in_vertical','in_pitch','in_roll','in_yaw','collective','motor_mean_pct',
  'health','crashes','battery_pct','wind_mps','event'];

const r=(v,d=3)=>Number.isFinite(v)?+v.toFixed(d):'';

export class FlightRecorder {
  constructor({rate=50,seconds=600}={}){
    this.interval=1/rate;this.capacity=Math.round(rate*seconds);this.rows=new Array(this.capacity);this.count=0;this.head=0;
    this.next=0;this.pendingEvent='';
  }
  clear(){this.count=0;this.head=0;this.next=0;this.pendingEvent='';}
  mark(event){this.pendingEvent=this.pendingEvent?`${this.pendingEvent};${event}`:event;}
  /** time: uçuş süresi (s). Fizik adımında çağrılır, yalnızca aralık dolunca kayıt alır. */
  sample(time,f,input,{wind=null}={}){
    if(time+1e-9<this.next)return;this.next=time+this.interval;
    const q=f.rotation,ys=2*(q.w*q.y+q.x*q.z),yc=1-2*(q.y*q.y+q.x*q.x);
    const pitch=Math.asin(Math.max(-1,Math.min(1,2*(q.w*q.x-q.y*q.z))));
    const roll=Math.atan2(2*(q.w*q.z+q.x*q.y),1-2*(q.x*q.x+q.z*q.z));
    let thrust=0;for(let i=0;i<f.drone.motorCount;i++)thrust+=f.motorThrust[i];
    const deg=180/Math.PI;
    const row=[r(time),f.drone.id,f.controller.mode,f.armed?1:0,r(f.position.x),r(f.position.y),r(f.position.z),
      r(f.velocity.x),r(f.velocity.y),r(f.velocity.z),r(f.velocity.length()*3.6,1),r(roll*deg,2),r(pitch*deg,2),r(Math.atan2(ys,yc)*deg,2),
      r(input?.throttle),r(input?.verticalCommand),r(input?.pitch),r(input?.roll),r(input?.yaw),r(f.collective??0),
      r(thrust/(f.drone.motorCount*f.drone.maxMotorThrust)*100,1),f.health,f.crashes,f.battery?.enabled?r(f.battery.charge*100,1):'',
      wind?r(Math.hypot(wind.x,wind.z),2):'',this.pendingEvent];
    this.pendingEvent='';
    this.rows[(this.head+this.count)%this.capacity]=row;
    if(this.count<this.capacity)this.count++;else this.head=(this.head+1)%this.capacity;
  }
  toCSV(){
    const out=[RECORD_COLUMNS.join(',')];
    for(let i=0;i<this.count;i++)out.push(this.rows[(this.head+i)%this.capacity].map(v=>typeof v==='string'&&/[,;"\n]/.test(v)?`"${v.replace(/"/g,'""')}"`:v).join(','));
    return out.join('\n')+'\n';
  }
  /** Tarayıcıda dosya indirme (uygulama sayfası; dosya yerel olarak oluşturulur). */
  download(name='zsk-ucus-kaydi.csv'){
    const blob=new Blob(['﻿'+this.toCSV()],{type:'text/csv;charset=utf-8'});
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;
    document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
}
