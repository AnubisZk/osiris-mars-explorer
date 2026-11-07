import {FLIGHT,MOTORS,HOVER} from '../physics/config.js';

/**
 * Drone türleri. Her tür fiziği, kontrolcüyü, gaz yardımını, kamerayı, çarpışma
 * kutusunu ve görev paylarını kendi tanımından okur. `freestyle5` v0.7.0'daki tek
 * dronun aynısıdır: değerler doğrudan FLIGHT / MOTORS / HOVER sabitlerinden gelir,
 * böylece varsayılan uçuş bit düzeyinde değişmez.
 *
 * Birimler: kg, m, N, rad/s, s. Gövde eksenleri: +X sağ, +Y yukarı, −Z ileri.
 */
const g=FLIGHT.gravity;
const quadX=diagonal=>{const a=diagonal/(2*Math.sqrt(2));return Object.freeze([{x:-a,z:-a,spin:1},{x:a,z:-a,spin:-1},{x:-a,z:a,spin:-1},{x:a,z:a,spin:1}].map(Object.freeze));};
// Altı motor, 30°'den başlayarak 60° aralıkla; dönüş yönleri sırayla değişir (yaw ayrışık).
const hexX=radius=>Object.freeze(Array.from({length:6},(_,k)=>{const t=(30+60*k)*Math.PI/180;return Object.freeze({x:radius*Math.cos(t),z:radius*Math.sin(t),spin:k%2?-1:1});}));

function define(spec){
  const motors=spec.motors,n=motors.length;
  // Simetrik yerleşimde Σx² = Σz²; karıştırıcı paydası buradan gelir (dörtlüde 4a²).
  const a=spec.layout==='quad'?spec.diagonal/(2*Math.sqrt(2)):null;
  const mixDenom=spec.layout==='quad'?4*a*a:motors.reduce((s,m)=>s+m.x*m.x,0);
  const hover=spec.hover??spec.mass*g/(n*spec.maxMotorThrust);
  const [hx,,hz]=spec.collider;
  return Object.freeze({
    ...spec,motorCount:n,mixDenom,yawDenom:n*spec.reactionArm,hover,
    thrustToWeight:n*spec.maxMotorThrust/(spec.mass*g),
    // Kapı/geçiş algılamasında yatay köşegenin yarısı kadar pay (cm'ye yukarı yuvarlanır)
    margin:spec.margin??Math.ceil(Math.hypot(hx,hz)*100)/100,
    span:2*Math.max(...motors.map(m=>Math.hypot(m.x,m.z)))+spec.propDiameter,
  });
}

export const DRONE_TYPES=Object.freeze({
  freestyle5:define({
    id:'freestyle5',name:'5" freestyle',short:'5 İNÇ',tag:'Yarış · freestyle',
    description:'Mevcut eğitim dronu. Hızlı, çevik; kapı yarışı ve hassas geçiş için.',
    layout:'quad',diagonal:FLIGHT.diagonal,motors:MOTORS,propDiameter:FLIGHT.propDiameter,
    mass:FLIGHT.mass,inertia:FLIGHT.inertia,maxMotorThrust:FLIGHT.maxMotorThrust,motorTimeConstant:FLIGHT.motorTimeConstant,
    maxMotorOmega:FLIGHT.maxMotorOmega,reactionArm:FLIGHT.reactionArm,maxRate:FLIGHT.maxRate,cameraTilt:FLIGHT.cameraTilt,
    crashImpulse:FLIGHT.crashImpulse,respawnSeconds:FLIGHT.respawnSeconds,hover:HOVER,
    collider:[.143,.035,.143],margin:.21,
    drag:{linear:[.035,.07,.035],quadratic:[.012,.026,.012],angular:.0006},
    gain:1,assist:{up:3,down:1.5,accel:4,cap:.35},damage:{speed:3,impulse:2},contact:{force:25,impulse:.35},
    camera:{offset:[0,.015,-.061],gimbal:false},chase:[0,1.1,2.5],modes:['ANGLE','ACRO'],model:'freestyle',
    battery:{minutes:4.5,sag:.16},sound:{blades:2,gain:1,tone:1},recordSuffix:'',
  }),
  whoop3:define({
    id:'whoop3',name:'3" cinewhoop',short:'3 İNÇ CİNEWHOOP',tag:'Kapalı alan · dar geçiş',
    description:'Pervane korumalı, hafif ve yavaş. Hafif temasta düşmez; depo ve dar geçişte yeni başlayanlar için.',
    layout:'quad',diagonal:.136,motors:quadX(.136),propDiameter:.076,
    mass:.32,inertia:{x:.001,y:.0017,z:.001},maxMotorThrust:.45*g,motorTimeConstant:.025,
    maxMotorOmega:3700,reactionArm:.012,maxRate:500,cameraTilt:12,
    // Kanal korumaları darbeyi dağıtır: kütleye göre daha yüksek eşik, yarı hasar
    crashImpulse:1.9,respawnSeconds:1.5,collider:[.098,.032,.098],
    drag:{linear:[.02,.055,.02],quadratic:[.007,.018,.007],angular:.00025},
    gain:.29,assist:{up:2.5,down:1.5,accel:4,cap:.6},damage:{speed:1.5,impulse:1},contact:{force:10,impulse:.2},
    camera:{offset:[0,.022,-.05],gimbal:false},chase:[0,.75,1.7],modes:['ANGLE','ACRO'],model:'whoop',
    battery:{minutes:4,sag:.18},sound:{blades:3,gain:.75,tone:1.45},recordSuffix:'.whoop3',
  }),
  longrange7:define({
    id:'longrange7',name:'7" uzun menzil',short:'7 İNÇ UZUN MENZİL',tag:'Açık alan · uzun uçuş',
    description:'Ağır, büyük eylemsizlikli. Geniş dönüş, uzun fren mesafesi; batarya yönetimi burada önemli.',
    layout:'quad',diagonal:.295,motors:quadX(.295),propDiameter:.178,
    mass:.95,inertia:{x:.0085,y:.015,z:.0085},maxMotorThrust:1.4*g,motorTimeConstant:.05,
    maxMotorOmega:1900,reactionArm:.024,maxRate:500,cameraTilt:20,
    crashImpulse:2.6,respawnSeconds:1.5,collider:[.195,.045,.195],
    drag:{linear:[.05,.1,.05],quadratic:[.018,.04,.018],angular:.0018},
    gain:2.4,assist:{up:3,down:1.5,accel:3.5,cap:.57},damage:{speed:3,impulse:2},contact:{force:40,impulse:.5},
    camera:{offset:[0,.022,-.085],gimbal:false},chase:[0,1.3,3],modes:['ANGLE','ACRO'],model:'longrange',
    battery:{minutes:18,sag:.14},sound:{blades:2,gain:1.1,tone:.72},recordSuffix:'.longrange7',
  }),
  race5:define({
    id:'race5',name:'5" yarış',short:'5 İNÇ YARIŞ',tag:'Yarış · ACRO',
    description:'Hafif ve çok güçlü yarış dronu. ACRO ile açılır (M ile ANGLE); düşük sürükleme, yüksek kamera açısı. Rekor kovalamak için.',
    layout:'quad',diagonal:.215,motors:quadX(.215),propDiameter:.13,
    mass:.46,inertia:{x:.0022,y:.0038,z:.0022},maxMotorThrust:1.4*g,motorTimeConstant:.02,
    maxMotorOmega:3300,reactionArm:.016,maxRate:850,cameraTilt:35,
    crashImpulse:1.3,respawnSeconds:1.5,collider:[.13,.03,.13],
    drag:{linear:[.025,.045,.025],quadratic:[.008,.016,.008],angular:.0004},
    gain:.63,assist:{up:4,down:2,accel:6,cap:.3},damage:{speed:3,impulse:2},contact:{force:18,impulse:.25},
    camera:{offset:[0,.014,-.056],gimbal:false},chase:[0,1,2.4],modes:['ACRO','ANGLE'],model:'race',
    battery:{minutes:2.5,sag:.15},sound:{blades:3,gain:1.1,tone:.85},recordSuffix:'.race5',
  }),
  tiny65:define({
    id:'tiny65',name:'65 mm tiny whoop',short:'65 MM TINY WHOOP',tag:'Kapalı alan · ilk uçuş',
    description:'Avuç içi kadar, 1S, pervane korumalı. En yavaş ve en affedici tür; temasta düşmez ama rüzgârda savrulur. Depo ve dar geçiş için.',
    layout:'quad',diagonal:.065,motors:quadX(.065),propDiameter:.031,
    mass:.027,inertia:{x:.00002,y:.000034,z:.00002},maxMotorThrust:.025*g,motorTimeConstant:.015,
    maxMotorOmega:5200,reactionArm:.008,maxRate:600,cameraTilt:15,
    // Kanallar ve çok küçük kütle: darbeler küçük; kaza eşiği ~6 m/sn çarpmaya karşılık gelir
    crashImpulse:.17,respawnSeconds:1.5,collider:[.047,.018,.047],
    drag:{linear:[.006,.006,.006],quadratic:[.0026,.003,.0026],angular:.000005},
    gain:.0057,assist:{up:1.8,down:1.2,accel:6,cap:.55},damage:{speed:1.5,impulse:1},contact:{force:.8,impulse:.02},
    camera:{offset:[0,.012,-.02],gimbal:false},chase:[0,.45,1],modes:['ANGLE','ACRO'],model:'tinywhoop',
    battery:{minutes:3.5,sag:.22},sound:{blades:3,gain:.45,tone:.9},recordSuffix:'.tiny65',
  }),
  hex:define({
    id:'hex',name:'Denetim hexacopter',short:'DENETİM HEXACOPTER',tag:'Endüstriyel denetim · konum tutma',
    description:'Altı motorlu, gimballi kamera. KONUM modunda çubuklar hız ister, bırakınca yerinde durur; yakın inceleme için.',
    layout:'hex',motors:hexX(.33),propDiameter:.3,
    mass:2.4,inertia:{x:.09,y:.16,z:.09},maxMotorThrust:1.6*g,motorTimeConstant:.07,
    maxMotorOmega:1100,reactionArm:.03,maxRate:200,cameraTilt:0,
    crashImpulse:6.6,respawnSeconds:2,collider:[.48,.12,.48],
    drag:{linear:[.12,.25,.12],quadratic:[.05,.1,.05],angular:.02},
    gain:24,assist:{up:3,down:2,accel:3,cap:.7},damage:{speed:3,impulse:1},contact:{force:120,impulse:1.2},
    camera:{offset:[0,-.13,-.2],gimbal:true},chase:[0,2.2,5],modes:['KONUM','ANGLE'],model:'hex',
    // KONUM: sağ çubuk yatay hız ister (en çok 5 m/sn), bırakınca konumu tutar
    posHold:{maxSpeed:5,velocityGain:1.6,positionGain:.9,maxAccel:3.2,tilt:25,integral:.35},
    battery:{minutes:25,sag:.12},sound:{blades:2,gain:1.25,tone:.5},recordSuffix:'.hex',
  }),
});
export const DRONE_ORDER=Object.freeze(['freestyle5','race5','whoop3','tiny65','longrange7','hex']);
export const DEFAULT_DRONE=DRONE_TYPES.freestyle5;
export const getDrone=id=>DRONE_TYPES[id]??DEFAULT_DRONE;
