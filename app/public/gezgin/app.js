import {Renderer,I,T,S,RX,RY,RZ,TR,matmul,V,clamp,lerp,len,sub,terrainHeight,gradientTerrain} from './engine.js';
import {TARGETS,buildTerrain,buildEnvironment,buildRover,buildDrone,buildExtra} from './scene.js';
import {INGENUITY_REFERANS,gerekliHavadaKalmaItisi,itisAnalizi} from './ingenuity.js';

const $=id=>document.getElementById(id);
const canvas=$('glcanvas');
const keys=new Set();
const state={
  time:0,running:true,selected:'drone',cameraMode:'cinematic',auto:false,phase:'ready',targetIndex:0,phaseTime:0,
  rover:{x:0,z:16,yaw:0,battery:92,speed:0,wheelAngle:0},
  drone:{x:0,z:16,y:0,yaw:0,vx:0,vy:0,vz:0,battery:100,docked:true,rotorAngle:0,thrust:1.0},
  collected:[false,false,false],sent:0,dataPackets:0,evening:false,events:[],
  camera:{yaw:.57,pitch:.37,distance:17,focus:[0,2.4,15],eye:[11,9,30],dragging:false},
};
let renderer, assets;
let toastTimer=0;
let uiTimer=0, frameCount=0,fpsTime=0,fps=0,lastFrame=0;
const roverY=()=>terrainHeight(state.rover.x,state.rover.z)+1.22;
const dronePad=()=>[state.rover.x+Math.sin(state.rover.yaw)*.30,roverY()+1.52,state.rover.z+Math.cos(state.rover.yaw)*.30];
const altitude=()=>state.drone.docked?0:Math.max(0,state.drone.y-terrainHeight(state.drone.x,state.drone.z)-.47);
const groundDistance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const vecDist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
const fmt=v=>v.toFixed(1);
const stamp=()=>{const s=Math.floor(state.time);return `${String(Math.floor(s/3600)).padStart(2,'0')}:${String(Math.floor(s/60)%60).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;};
function addLog(message,type='info'){
 const item={stamp:stamp(),message,type};state.events.unshift(item);state.events=state.events.slice(0,28);
 const panel=$('eventLog');panel.innerHTML=state.events.slice(0,12).map(e=>`<div class="log-line ${e.type}"><b>${e.stamp}</b>${escapeHTML(e.message)}</div>`).join('');
}
function escapeHTML(value){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}
function notify(message){const t=$('toast');t.textContent=message;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),3000);}
function selectVehicle(which){state.selected=which;$('selectDrone').classList.toggle('selected',which==='drone');$('selectRover').classList.toggle('selected',which==='rover');$('selectDrone').querySelector('.status-pill')?.remove();for(const b of ['selectDrone','selectRover']){const old=$(b).querySelector('.status-pill');if(old)old.remove();}const badge=document.createElement('span');badge.className='status-pill';badge.textContent='ACTIVE';$(which==='drone'?'selectDrone':'selectRover').append(badge);addLog(which==='drone'?'UD-07 kontrol devralındı':'RV-01 kontrol devralındı');}
function setCamera(which){state.cameraMode=which;document.querySelectorAll('.camera-btn').forEach(b=>b.classList.toggle('active',b.dataset.camera===which));$('viewModeLabel').textContent=({cinematic:'SİNEMATİK',drone:'DRONE TAKİP',rover:'GEZGİN TAKİP',top:'YÜZEY HARİTASI'})[which];
 if(which==='top'){state.camera.pitch=1.46;state.camera.distance=48;}
 else if(which==='drone'){state.camera.pitch=.34;state.camera.distance=10;state.camera.yaw=.57;}
 else if(which==='rover'){state.camera.pitch=.32;state.camera.distance=15;state.camera.yaw=.47;}
 else {state.camera.pitch=.37;state.camera.distance=17;state.camera.yaw=.57;}}
function takeoff(){const d=state.drone;if(!d.docked){notify('UD-07 zaten uçuşta. İniş için F tuşunu kullan.');return false;}if(d.battery<8){notify('Yetersiz enerji. Önce batarya değişimi yap.');return false;}
 d.docked=false;const p=dronePad();d.x=p[0];d.y=p[1]+.04;d.z=p[2];d.vx=0;d.vy=0;d.vz=0;state.selected='drone';selectVehicle('drone');addLog('UD-07 rotorlar çalıştı • Kalkış başladı','success');notify('Kalkış izni verildi • SPACE ile yüksel');return true;}
function dock(){const d=state.drone,r=state.rover;if(d.docked){notify('Helikopter zaten platformda kenetli.');return true;}
 const p=dronePad();const hd=Math.hypot(d.x-p[0],d.z-p[2]);const vd=Math.abs(d.y-p[1]);
 if(hd>1.6||vd>1.45){notify('Kenetlenmek için gezginin iniş platformuna yaklaş ve alçal.');return false;}
 d.docked=true;d.vx=d.vy=d.vz=0;d.x=p[0];d.y=p[1];d.z=p[2];addLog('UD-07 iniş platformuna kenetlendi','success');notify('Güvenli kenetlenme tamamlandı');return true;}
function swapBattery(){if(!state.drone.docked){notify('Batarya değişimi için helikopter platformda olmalı.');return;}
 if(state.rover.battery<10){notify('Gezginde yeterli enerji yok.');return;}
 const d=state.drone,needed=100-d.battery,available=state.rover.battery*.8,transferred=Math.min(needed,available);d.battery+=transferred;state.rover.battery-=transferred*1.2;addLog(`Batarya değişimi +${Math.round(transferred)}% • Gezgin rezervi kullanıldı`,'success');notify(`Batarya yenilendi: %${Math.round(d.battery)}`);}
function transmit(){if(state.dataPackets<=0){notify('Gönderilecek bilimsel veri bulunmuyor.');return;}
 if(!state.drone.docked){notify('Veri aktarmak için helikopterin gezgine kenetlenmesi gerekiyor.');return;}
 const amount=state.dataPackets;state.dataPackets=0;state.sent+=amount;addLog(`${amount} bilimsel veri paketi Dünya'ya aktarıldı (simülasyon)`,'success');notify(`${amount} veri paketi görev merkezine gönderildi`);}
function collect(index,method='drone'){if(state.collected[index])return;state.collected[index]=true;state.dataPackets++;const target=TARGETS[index];addLog(`${target.label} / ${target.name}: ${method==='drone'?'hava':'yüzey'} taraması tamam`,'success');notify(`✦ ${target.name} numunesi analiz edildi`);}
function scan(){const d=state.drone,r=state.rover;const isDrone=state.selected==='drone';const near=TARGETS.map((t,i)=>({i,dist:Math.hypot(t.x-(isDrone?d.x:r.x),t.z-(isDrone?d.z:r.z))})).sort((a,b)=>a.dist-b.dist)[0];
 if(!near||near.dist>(isDrone?5:4.8)){notify('Tarama için işaretli kaya hedefine yaklaş.');return;}
 if(isDrone&&(d.docked||altitude()<1.2)){notify('Helikopter tarama için en az 1,2 m yüksekte uçmalı.');return;}
 if(state.collected[near.i]){notify('Bu hedef daha önce tarandı.');return;}
 collect(near.i,isDrone?'drone':'rover');}
function startMission(){if(state.auto){state.auto=false;state.phase='manual';addLog('Otonom görev durduruldu • Manuel kontrol aktif','warn');notify('Otonom uçuş iptal edildi');return;}
 if(state.collected.every(Boolean)){notify('Tüm numuneler toplandı. Görevi sıfırlayabilirsin.');return;}
 if(state.drone.battery<20){notify('Otonom uçuş için drone bataryası en az %20 olmalı.');return;}
 if(state.drone.docked&&!takeoff())return;
 state.auto=true;state.phase='takeoff';state.phaseTime=0;state.targetIndex=state.collected.findIndex(v=>!v);selectVehicle('drone');setCamera('drone');addLog('JZR-03 otonom keşif rotası başlatıldı','success');notify('Otonom keşif: 3 kaya hedefi • Ardından üsse dönüş');}
function setAutoPhase(phase){state.phase=phase;state.phaseTime=0;}
function autoVelocity(dt){const d=state.drone,r=state.rover,phase=state.phase;let dest=null,desiredSpeed=3.45;
 if(d.battery<9&&!['return','land'].includes(phase)){setAutoPhase('return');addLog('Kritik enerji • Acil üsse dönüş','warn');}
 if(state.phase==='takeoff'){
  dest={x:d.x,y:roverY()+4.9,z:d.z};desiredSpeed=2.1;
  if(Math.abs(d.y-dest.y)<.25)setAutoPhase('travel');
 }else if(state.phase==='travel'){
  const site=TARGETS[state.targetIndex];if(!site){setAutoPhase('return');return [0,0,0];}
  dest={x:site.x,y:terrainHeight(site.x,site.z)+5.3,z:site.z};
  if(groundDistance(d,dest)<2.15&&Math.abs(d.y-dest.y)<1.4){setAutoPhase('scan');addLog(`${site.label}: multispektral gözlem başladı`);}
 }else if(state.phase==='scan'){
  state.phaseTime+=dt;
  const site=TARGETS[state.targetIndex];if(site&&state.phaseTime>=2.6){collect(state.targetIndex);const next=state.collected.findIndex(v=>!v);if(next>=0){state.targetIndex=next;setAutoPhase('travel');}else{setAutoPhase('return');addLog('Tüm hedefler tarandı • Üsse dönüş başladı','success');}}
  return [0,0,0];
 }else if(state.phase==='return'){
  dest={x:r.x,y:roverY()+4.2,z:r.z+.30};
  if(groundDistance(d,dest)<.85&&Math.abs(d.y-dest.y)<.7)setAutoPhase('land');
 }else if(state.phase==='land'){
  const p=dronePad();dest={x:p[0],y:p[1]+.06,z:p[2]};desiredSpeed=.95;
  if(vecDist(d,dest)<.20){d.x=p[0];d.y=p[1];d.z=p[2];d.docked=true;d.vx=d.vy=d.vz=0;state.auto=false;state.phase='completed';addLog('UD-07 güvenli iniş • JZR-03 görev döngüsü tamamlandı','success');notify('✓ Otonom keşif tamamlandı • Veri aktarımı hazır');return [0,0,0];}
 }
 if(!dest)return [0,0,0];
 const dx=dest.x-d.x,dy=dest.y-d.y,dz=dest.z-d.z,horizontal=Math.hypot(dx,dz);
 let speed=Math.min(desiredSpeed,horizontal*1.6);if(state.phase==='takeoff')speed=0;
 const vy=clamp(dy*1.25,-1.25,1.65);return [horizontal>.01?dx/horizontal*speed:0,vy,horizontal>.01?dz/horizontal*speed:0];
}
function updatePhysics(dt){if(!state.running)return;state.time+=dt;
 const r=state.rover,d=state.drone,pressed=k=>keys.has(k);
 const fwd=(pressed('w')?1:0)-(pressed('s')?1:0),strafe=(pressed('d')?1:0)-(pressed('a')?1:0);
 if(state.selected==='rover'){
  r.speed=lerp(r.speed,fwd*2.1,clamp(dt*2.2,0,1));
  if(Math.abs(r.speed)>.02){r.yaw+=strafe*dt*.85*(r.speed>=0?1:-1);r.x=clamp(r.x+Math.sin(r.yaw)*r.speed*dt,-93,93);r.z=clamp(r.z-Math.cos(r.yaw)*r.speed*dt,-93,93);r.wheelAngle+=r.speed*dt/.49;r.battery=Math.max(0,r.battery-dt*.011);}
 }else r.speed=lerp(r.speed,0,Math.min(1,dt*4));
 r.battery=clamp(r.battery+dt*(state.evening?.00003:.003),0,100);
 if(d.docked){const p=dronePad();d.x=p[0];d.y=p[1];d.z=p[2];d.yaw=r.yaw;d.vx=d.vy=d.vz=0;d.thrust=0;}
 else{
   const isManual=state.selected==='drone'&&!state.auto;
   if(isManual){d.yaw+=((pressed('e')?1:0)-(pressed('q')?1:0))*dt*.95;}
   let requested=[0,0,0];
   if(state.auto)requested=autoVelocity(dt);
   else if(isManual){const rise=(pressed(' ')?1:0)-(pressed('shift')?1:0);
      requested=[(Math.sin(d.yaw)*fwd+Math.cos(d.yaw)*strafe)*3.1,rise*1.9,(-Math.cos(d.yaw)*fwd+Math.sin(d.yaw)*strafe)*3.1];}
   // Velocity response with smoothing. This is deliberately not a certified rotorcraft model.
   const alpha=Math.min(1,dt*3.4);
   d.vx=lerp(d.vx,requested[0],alpha);d.vy=lerp(d.vy,requested[1],Math.min(1,dt*2.9));d.vz=lerp(d.vz,requested[2],alpha);
   d.x=clamp(d.x+d.vx*dt,-96,96);d.z=clamp(d.z+d.vz*dt,-96,96);d.y+=d.vy*dt;
   const minY=terrainHeight(d.x,d.z)+.49,maxY=terrainHeight(d.x,d.z)+19;
   if(d.y<minY){d.y=minY;d.vy=Math.max(0,d.vy);}if(d.y>maxY){d.y=maxY;d.vy=Math.min(0,d.vy);}
   d.battery=Math.max(0,d.battery-dt*(.28+Math.hypot(d.vx,d.vz)*.014+Math.abs(d.vy)*.032));
   // Shown thrust ratio is illustrative, not a full aerodynamic computation.
   const estimated=Math.max(0,1+d.vy*.075+Math.max(0,requested[1]-d.vy)*.12);
   d.thrust=itisAnalizi(gerekliHavadaKalmaItisi(INGENUITY_REFERANS.kutleKg)*estimated).itisOrani;
   if(d.battery<=0){state.auto=false;d.vx=d.vz=0;d.vy=-.55;d.thrust=.85;}
 }
 d.rotorAngle+=dt*(d.docked?0:INGENUITY_REFERANS.rotorDevirRpm*Math.PI*2/60*.12); // slower visible animation for display
}
function cameraFrame(dt){const c=state.camera,d=state.drone,r=state.rover;
 let target;
 if(state.cameraMode==='drone')target=[d.x,d.y+.45,d.z];
 else if(state.cameraMode==='rover')target=[r.x,roverY()+.9,r.z-.9];
 else if(state.cameraMode==='top')target=[(d.x+r.x)*.5,1,(d.z+r.z)*.5];
 else{const p=state.selected==='drone'?d:{x:r.x,y:roverY(),z:r.z};target=[p.x,p.y,p.z-1.25];}
 const blend=clamp(dt*2.8,0,1);c.focus=c.focus.map((v,i)=>lerp(v,target[i],blend));
 const p=c.pitch,y=c.yaw,distance=c.distance;
 const dest=[c.focus[0]+Math.sin(y)*Math.cos(p)*distance,c.focus[1]+Math.sin(p)*distance,c.focus[2]+Math.cos(y)*Math.cos(p)*distance];
 c.eye=c.eye.map((v,i)=>lerp(v,dest[i],Math.min(1,dt*3.1)));
 // Prevent the camera from passing below a dune.
 c.eye[1]=Math.max(c.eye[1],terrainHeight(c.eye[0],c.eye[2])+1.1);
 return {eye:c.eye,target:c.focus};}
function drawScene(dt){const {eye,target}=cameraFrame(dt);renderer.evening=state.evening?.78:0;renderer.begin(eye,target,state.time);
 renderer.draw(assets.terrain,I());renderer.draw(assets.environment.scenery,I());renderer.draw(assets.environment.route,I(),.56,.14);
 const r=state.rover,d=state.drone;
 const roverRoot=TR(r.x,roverY(),r.z,r.yaw);
 const shadowRover=matmul(T(r.x,terrainHeight(r.x,r.z)+.06,r.z),S(1.8,1,2.0));renderer.draw(assets.drone.shadow,shadowRover,.33);
 renderer.draw(assets.rover.body,roverRoot);
 for(const [x,y,z] of assets.rover.wheelLocs){const wm=matmul(matmul(roverRoot,T(x,y,z)),RX(r.wheelAngle));renderer.draw(assets.rover.wheel,wm);}
 // Landing pad marker and scan beacon.
 const padPosition=matmul(roverRoot,T(0,1.065,.30));renderer.draw(assets.extra.pad,padPosition,1,.3);
 if(!d.docked){renderer.draw(assets.drone.shadow,matmul(T(d.x,terrainHeight(d.x,d.z)+.07,d.z),S(1.25,1,.95)),.33);}
 let droneRoot=TR(d.x,d.y,d.z,d.yaw);
 if(!d.docked){droneRoot=matmul(droneRoot,matmul(RX(clamp(-d.vz*.045,-.18,.18)),RZ(clamp(-d.vx*.05,-.18,.18))));}
 renderer.draw(assets.drone.body,droneRoot);
 renderer.draw(assets.drone.top,matmul(droneRoot,matmul(T(0,.61,0),RY(d.rotorAngle))),1,.13);
 renderer.draw(assets.drone.bottom,matmul(droneRoot,matmul(T(0,.33,0),RY(-d.rotorAngle*1.05))),1,.06);
 renderer.gl.bindVertexArray(null);
 updateWorldLabels();}
function updateWorldLabels(){TARGETS.forEach((site,i)=>{
 const id=['rockA','rockB','rockC'][i],label=$(id),pt=renderer.project([site.x,terrainHeight(site.x,site.z)+3,site.z]);
 const focus=state.camera.eye,dist=Math.hypot(focus[0]-site.x,focus[2]-site.z);
 if(!pt||!pt.visible||dist>78){label.style.display='none';return;}
 label.style.display='flex';label.style.left=`${pt.x}px`;label.style.top=`${pt.y}px`;
 if(state.collected[i]){label.style.borderColor='#7dd5bd';label.querySelector('.target-icon').textContent='✓';label.querySelector('small').textContent='TARAMA TAMAMLANDI';}
 });}
function drawMap(){const canvas=$('minimap'),ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height;
 ctx.clearRect(0,0,w,h);ctx.fillStyle='#192934';ctx.fillRect(0,0,w,h);
 const scale=2.30,originX=w/2,originZ=h*.72;
 const xy=(x,z)=>[originX+x*scale,originZ+(z-10)*scale];
 for(let z=-60;z<=55;z+=4)for(let x=-120;x<=120;x+=4){let h1=terrainHeight(x,z);if(h1>0.35){const [px,py]=xy(x,z);ctx.fillStyle=`rgba(210,148,100,${Math.min(.22,.035+h1*.027)})`;ctx.fillRect(px,py,10,10);}}
 ctx.strokeStyle='#334858';ctx.lineWidth=.5;for(let x=-120;x<=120;x+=10){const [px]=xy(x,0);ctx.beginPath();ctx.moveTo(px,0);ctx.lineTo(px,h);ctx.stroke();}for(let z=-60;z<=55;z+=10){const [,py]=xy(0,z);ctx.beginPath();ctx.moveTo(0,py);ctx.lineTo(w,py);ctx.stroke();}
 const d=state.drone,r=state.rover;const route=[[r.x,r.z],...TARGETS.filter((_,i)=>!state.collected[i]).map(t=>[t.x,t.z])];
 ctx.strokeStyle='rgba(215,159,103,.7)';ctx.setLineDash([4,6]);ctx.beginPath();route.forEach(([x,z],i)=>{const [px,py]=xy(x,z);i?ctx.lineTo(px,py):ctx.moveTo(px,py);});ctx.stroke();ctx.setLineDash([]);
 TARGETS.forEach((t,i)=>{const [x,y]=xy(t.x,t.z);ctx.strokeStyle=state.collected[i]?'#75cabb':'#e4a76d';ctx.lineWidth=1.6;ctx.beginPath();ctx.arc(x,y,5,0,Math.PI*2);ctx.stroke();ctx.fillStyle=state.collected[i]?'#75cabb':'#d9a06e';ctx.font='bold 10px Consolas';ctx.fillText(`${i+1}`,x+9,y-3);});
 const marker=(p,col,size)=>{const [x,y]=xy(p.x,p.z);ctx.strokeStyle=col;ctx.beginPath();ctx.arc(x,y,size+5,0,Math.PI*2);ctx.stroke();ctx.fillStyle=col;ctx.beginPath();ctx.arc(x,y,size,0,Math.PI*2);ctx.fill();};
 marker(r,'#77d0bf',4.5);marker(d,'#ffc284',3.2);
 ctx.fillStyle='#94adb8';ctx.font='10px Consolas';ctx.fillText('LOCAL MAP / 220 × 78 m',10,h-9);
}
function drawScience(){const can=$('scienceChart'),ctx=can.getContext('2d'),w=can.width,h=can.height;
 ctx.clearRect(0,0,w,h);ctx.strokeStyle='#29424b';ctx.lineWidth=1;for(let n=1;n<4;n++){ctx.beginPath();ctx.moveTo(0,n*h/4);ctx.lineTo(w,n*h/4);ctx.stroke();}
 ctx.strokeStyle='#79c8ae';ctx.lineWidth=2;ctx.beginPath();for(let x=0;x<w;x+=3){const k=x/w;const y=h*.58-(Math.sin(k*16+state.time*.13)*.14+Math.sin(k*46+state.time*.08)*.045)*h -state.collected.filter(Boolean).length*h*.055;if(x===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.stroke();
 ctx.fillStyle='#a2bdc5';ctx.font='10px Consolas';ctx.fillText('SENSOR RETURN  //  NOMINAL',9,14);}
function updateUI(){const d=state.drone,r=state.rover,a=altitude(),speed=state.selected==='rover'?Math.abs(r.speed):Math.hypot(d.vx,d.vz),ratio=d.thrust;
 const el=(id,v)=>{$(id).textContent=v;};
 el('altitude',a.toFixed(2));el('hudAlt',a.toFixed(1));el('speed',speed.toFixed(2));el('thrust',ratio.toFixed(2));const signal=clamp(Math.round(100-Math.hypot(r.x-d.x,r.z-d.z)*.33),30,100);el('signal',signal);
 for(const [id,v] of [['altBar',a/19*100],['speedBar',speed/3.5*100],['thrustBar',ratio/1.8*100],['signalBar',signal]])$(id).style.width=`${clamp(v,0,100)}%`;
 el('droneBatteryText',`${Math.round(d.battery)}%`);el('roverBatteryText',`${Math.round(r.battery)}%`);$('droneBatteryBar').style.width=`${d.battery}%`;$('roverBatteryBar').style.width=`${r.battery}%`;
 el('samples',String(state.collected.filter(Boolean).length).padStart(2,'0'));$('samples').insertAdjacentHTML('beforeend',' <em>/ 03</em>');el('sent',String(state.sent).padStart(2,'0'));$('sent').insertAdjacentHTML('beforeend',' <em>PKT</em>');
 el('missionClock',stamp());el('flightTime','T+'+stamp());const active=state.selected==='drone'?d:r;el('coordsLabel',`X ${fmt(active.x).padStart(5,'0')} / Z ${fmt(active.z).padStart(5,'0')}`);
 const phases={ready:'Görev öncesi kontrol',takeoff:'Otonom kalkış',travel:'Hedefe yaklaşma',scan:'Bilimsel tarama',return:'Üsse dönüş',land:'Hassas iniş',manual:'Manuel uçuş',completed:'Görev tamamlandı'};
 el('operationText',d.docked?(state.phase==='completed'?'Görev tamamlandı':'Platformda kenetli'):(phases[state.phase]||'Manuel uçuş'));
 el('flightBadge',d.docked?'KENETLİ':state.auto?'OTONOM':'UÇUŞTA');el('operationSub',state.auto?`ROTA JZR-03 · ${state.phase==='scan'?'TARAMA AKTİF':state.phase==='travel'?TARGETS[state.targetIndex]?.name:'NAVİGASYON'}`:d.docked?'Sistemler nominal • Kalkışa hazır':'Manuel kontrol · Uçuş parametreleri izleniyor');
 $('missionBtn').innerHTML=state.auto?'<span class="action-glyph">■</span><span>GÖREVİ DURDUR <small>MANUEL KONTROL</small></span>':'<span class="action-glyph">▶</span><span>OTONOM KEŞİF <small>3 HEDEFLİ UÇUŞ</small></span>';
 const progress=state.collected.filter(Boolean).length;const stage=state.phase==='completed'?4:state.auto?(state.phase==='land'||state.phase==='return'?3:Math.min(2,Math.max(0,state.targetIndex))):Math.min(3,progress);
 $('missionSteps').innerHTML=['KALKIŞ','KAYA 01','KAYA 02','KAYA 03','DÖNÜŞ'].map((label,i)=>`<div class="step ${i===0&&!d.docked||i>0&&i<=3&&state.collected[i-1]||i===4&&state.phase==='completed'?'done':state.auto&&(i===0&&state.phase==='takeoff'||i===state.targetIndex+1&&['travel','scan'].includes(state.phase)||i===4&&['return','land'].includes(state.phase))?'active':''}"><b>${i===4?'↵':i===0?'↑':i}</b><span>${label}</span></div>`).join('');
 el('missionDescription',state.auto?`Otonom mod etkin. ${state.phase==='scan'?`Hedef taranıyor: ${TARGETS[state.targetIndex]?.name}`:'Navigasyon ve irtifa kontrolü sürüyor.'}`:state.phase==='completed'?'Keşif tamamlandı. VERİYİ GÖNDER düğmesiyle bilimsel paketleri iletebilirsin.':`${progress}/3 hedef tarandı. Manuel keşif veya otonom görev başlatabilirsin.`);
 drawMap();drawScience();}
function reset(){state.time=0;state.running=true;$('pauseBtn').textContent='Ⅱ DURAKLAT';state.auto=false;state.phase='ready';state.phaseTime=0;state.targetIndex=0;state.collected=[false,false,false];state.sent=0;state.dataPackets=0;state.rover={x:0,z:16,yaw:0,battery:92,speed:0,wheelAngle:0};state.drone={x:0,z:16,y:0,yaw:0,vx:0,vy:0,vz:0,battery:100,docked:true,rotorAngle:0,thrust:1};keys.clear();state.events=[];setCamera('cinematic');selectVehicle('drone');addLog('Sistem sıfırlandı • JZR-03 göreve hazır','success');notify('Yeni görev simülasyonu başlatıldı');}
// Tarayıcıda çalışan yerel görev raporu. Gerçek bir NASA veri aktarımı değildir.
function exportMissionReport(){
 const d=state.drone,r=state.rover;
 const report={
  project:'OSIRISZK Mars Pathfinder 3D',version:'2.0',
  mode:'Educational 3D simulation (simplified physics)',
  missionTimeSeconds:Number(state.time.toFixed(2)),
  flight:{position:{x:d.x,y:d.y,z:d.z},batteryPercent:d.battery,
    altitudeAGLMeters:altitude(),docked:d.docked},
  rover:{position:{x:r.x,z:r.z},batteryPercent:r.battery},
  gravityMetersPerSecondSquared:INGENUITY_REFERANS.marsYercekimiMps2,
  targetObservations:TARGETS.map((t,i)=>({name:t.name,type:t.tag,collected:state.collected[i]})),
  storedPackets:state.dataPackets,transmittedPackets:state.sent,
  log:[...state.events].reverse()
 };
 const blob=new Blob([JSON.stringify(report,null,2)],{type:'application/json'});
 const link=document.createElement('a');link.href=URL.createObjectURL(blob);
 link.download='OSIRISZK_Gorev_Raporu.json';document.body.appendChild(link);link.click();link.remove();
 setTimeout(()=>URL.revokeObjectURL(link.href),1000);
 notify('Görev raporu bilgisayarına kaydedildi');addLog('Yerel görev raporu oluşturuldu','success');
}
function toggleSun(){state.evening=!state.evening;
 $('sunBtn').textContent=state.evening?'☀ GÜNDÜZ':'◑ GÜN BATIMI';
 addLog(state.evening?'Akşam ışık profiline geçildi':'Gündüz ışık profiline geçildi');
}
function togglePause(){state.running=!state.running;
 $('pauseBtn').textContent=state.running?'Ⅱ DURAKLAT':'▶ DEVAM ET';
 notify(state.running?'Simülasyon devam ediyor':'Simülasyon duraklatıldı');
}
function bindControls(){
 $('selectDrone').addEventListener('click',()=>selectVehicle('drone'));
 $('selectRover').addEventListener('click',()=>selectVehicle('rover'));
 $('missionBtn').addEventListener('click',startMission);
 $('takeoffBtn').addEventListener('click',takeoff);
 $('scanBtn').addEventListener('click',scan);
 $('dockBtn').addEventListener('click',dock);
 $('chargeBtn').addEventListener('click',swapBattery);
 $('transmitBtn').addEventListener('click',transmit);
 $('resetBtn').addEventListener('click',reset);
 $('sunBtn').addEventListener('click',toggleSun);
 $('pauseBtn').addEventListener('click',togglePause);
 $('reportBtn').addEventListener('click',exportMissionReport);
 document.querySelectorAll('[data-camera]').forEach(b=>b.addEventListener('click',()=>setCamera(b.dataset.camera)));
 const overlay=$('helpOverlay');$('helpBtn').addEventListener('click',()=>overlay.hidden=false);
 $('closeHelp').addEventListener('click',()=>overlay.hidden=true);$('helpDone').addEventListener('click',()=>overlay.hidden=true);
 overlay.addEventListener('click',e=>{if(e.target===overlay)overlay.hidden=true;});
 document.addEventListener('keydown',e=>{
  if(['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName))return;
  const key=e.key.toLowerCase();if([' ','arrowup','arrowdown','tab'].includes(key))e.preventDefault();
  if(overlay.hidden===false){if(key==='escape'||key==='h')overlay.hidden=true;return;}
  if(!e.repeat){
   if(key==='tab'){selectVehicle(state.selected==='drone'?'rover':'drone');return;}
   if(key==='h'){overlay.hidden=false;return;}
   if('1234'.includes(key)&&key.length===1){setCamera(['cinematic','drone','rover','top'][Number(key)-1]);return;}
   if(key==='f'){dock();return;}if(key==='b'){swapBattery();return;}if(key==='t'){transmit();return;}
   if(key==='g'){scan();return;}if(key==='r'&&state.selected==='rover'){scan();return;}
   if(key==='m'){startMission();return;}
   if(key==='p'){togglePause();return;}
  }
  keys.add(key);
  if(state.auto&&state.selected==='drone'&&['w','a','s','d',' ','shift','q','e'].includes(key)){state.auto=false;state.phase='manual';addLog('Manuel müdahale • Otonom uçuş kesildi','warn');notify('Manuel kontrol devralındı');}
 });
 document.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
 window.addEventListener('blur',()=>keys.clear());
 canvas.addEventListener('pointerdown',e=>{if(e.button!==0)return;state.camera.dragging=true;state.camera.last=[e.clientX,e.clientY];canvas.setPointerCapture(e.pointerId);});
 canvas.addEventListener('pointermove',e=>{if(!state.camera.dragging)return;const [x,y]=state.camera.last;state.camera.yaw-=(e.clientX-x)*.006;state.camera.pitch=clamp(state.camera.pitch+(e.clientY-y)*.005,.10,1.53);state.camera.last=[e.clientX,e.clientY];});
 canvas.addEventListener('pointerup',()=>state.camera.dragging=false);canvas.addEventListener('pointercancel',()=>state.camera.dragging=false);
 canvas.addEventListener('wheel',e=>{e.preventDefault();state.camera.distance=clamp(state.camera.distance*Math.exp(e.deltaY*.00115),3.6,88);},{passive:false});
}
function frame(timestamp){if(!lastFrame)lastFrame=timestamp;let dt=Math.min((timestamp-lastFrame)/1000,.05);lastFrame=timestamp;
 try{updatePhysics(dt);drawScene(dt);uiTimer+=dt;frameCount++;fpsTime+=dt;if(fpsTime>=.7){fps=Math.round(frameCount/fpsTime);$('fps').textContent=fps;fpsTime=0;frameCount=0;}if(uiTimer>=.15){uiTimer=0;updateUI();}}catch(err){console.error('OSIRISZK frame:',err);notify('Görselleştirme hatası: '+err.message);return;}
 requestAnimationFrame(frame);}
function init(){try{
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();$('webglError').hidden=false;$('webglError').querySelector('p').textContent='3B ekran kartı bağlantısı kesildi. Sayfayı yeniden yükleyin.';});
 canvas.addEventListener('webglcontextrestored',()=>location.reload());
 renderer=new Renderer(canvas);
 assets={terrain:buildTerrain(renderer),environment:buildEnvironment(renderer),rover:buildRover(renderer),drone:buildDrone(renderer),extra:buildExtra(renderer)};
 const pad=dronePad();Object.assign(state.drone,{x:pad[0],y:pad[1],z:pad[2]});
 bindControls();addLog('Yüzey haritası yüklendi • Jezero hedefleri hazır');addLog('UD-07 / RV-01 kontrol bilgisayarı aktif','success');addLog('NASA Ingenuity kütle/rotor referansı yüklendi');
 setCamera('cinematic');updateUI();$('loading').hidden=true;
 window.__OSIRISZK_TEST__={state,renderer,assets,takeoff,dock,scan,startMission,reset,selectVehicle,setCamera,updatePhysics};
 requestAnimationFrame(frame);
 }catch(err){console.error('OSIRISZK startup:',err);$('loading').hidden=true;$('webglError').hidden=false;$('webglError').querySelector('p').textContent=err.message+' — Chrome veya Edge ile tekrar deneyin.';}}
init();
