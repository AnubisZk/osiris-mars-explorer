// En küçük örnek: fizik 240 Hz'de sabit adımla döner, çizim ara konumla (interpolasyon) yapılır.
// Çarpışma, görsel ağlardan DEĞİL, ayrı bir çarpışma düzeninden (COLLISION) kurulur:
// görselde LOD / küme (cluster) / impostor ne olursa olsun fizik değişmez.
import * as THREE from 'three';
import {FlightPhysics,initializeRapier,FixedStepper,InputManager,DRONE_TYPES,DRONE_ORDER,getDrone,createDroneModel,cameraOrientation} from '../../src/index.js';

await initializeRapier();

// 1) Çarpışma düzeni (veri). Kutular yarım boyutla verilir: [x,y,z] merkez, [hx,hy,hz] yarım boyut.
const COLLISION = [
  {pos: [0, -0.5, 0], half: [80, 0.5, 80], color: '#5d6b4f'},          // zemin
  {pos: [8, 2, -14], half: [2, 2, 2], color: '#8a8f86'},               // blok
  {pos: [-10, 3, -22], half: [1.5, 3, 1.5], color: '#8a8f86'},         // kule
  // Kapı: iki direk + üst kiriş (3 m genişlik, 2,5 m yükseklik)
  {pos: [-1.6, 1.25, -30], half: [0.1, 1.25, 0.1], color: '#e4ff65'},
  {pos: [1.6, 1.25, -30], half: [0.1, 1.25, 0.1], color: '#e4ff65'},
  {pos: [0, 2.6, -30], half: [1.7, 0.1, 0.1], color: '#e4ff65'},
];
const SPAWN = [0, 0.15, 0];

// 2) Fizik
let drone = getDrone('freestyle5');
const flight = new FlightPhysics(SPAWN, 0, drone);
for (const b of COLLISION) flight.addBox(b.pos, b.half);
const stepper = new FixedStepper();

// 3) Görsel dünya (fizikten ayrı). Burada basit kutular; gerçek projede ağaç/arazi/LOD sistemi buraya gelir.
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({canvas, antialias: true});
renderer.setPixelRatio(Math.min(2, devicePixelRatio));
const scene = new THREE.Scene(); scene.background = new THREE.Color('#9fc4d8'); scene.fog = new THREE.Fog('#9fc4d8', 60, 220);
const camera = new THREE.PerspectiveCamera(100, 1, 0.03, 600);
scene.add(new THREE.HemisphereLight('#dfefff', '#4a5240', 1.4));
const sun = new THREE.DirectionalLight('#fff3dc', 2.2); sun.position.set(30, 50, 20); scene.add(sun);
for (const b of COLLISION) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(b.half[0] * 2, b.half[1] * 2, b.half[2] * 2), new THREE.MeshStandardMaterial({color: b.color, roughness: 0.9}));
  m.position.set(...b.pos); scene.add(m);
}
let model = createDroneModel(drone); scene.add(model.group);

// 4) Kumanda (klavye, standart kumanda, FPV vericisi)
const input = new InputManager(() => {});
input.active = true; // klavye olayları yalnız active iken okunur (simülatörde uçuş görünümüne girince açılır)
const select = document.getElementById('drone');
for (const id of DRONE_ORDER) select.add(new Option(`${DRONE_TYPES[id].name} · ${DRONE_TYPES[id].tag}`, id));
select.onchange = () => {
  if (flight.armed) { select.value = drone.id; return; } // tür yalnız motorlar kapalıyken değişir
  drone = getDrone(select.value); flight.setDrone(drone); flight.reset(); stepper.reset(); input.resetThrottle();
  scene.remove(model.group); model = createDroneModel(drone); scene.add(model.group); canvas.focus();
};

// 5) Döngü
let chase = true, last = performance.now();
const renderPos = new THREE.Vector3(), renderRot = new THREE.Quaternion(), tmp = new THREE.Vector3();
const hud = document.getElementById('hud');
function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize(); canvas.focus();

renderer.setAnimationLoop((now) => {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  const s = input.update(dt);
  if (s.reset) { flight.reset(); stepper.reset(); input.resetThrottle(); }
  if (s.cut) { flight.disarm(); input.resetThrottle(); }
  if (s.camera) chase = !chase;
  if (s.mode && !flight.armed) { const m = drone.modes; flight.controller.setMode(m[(m.indexOf(flight.controller.mode) + 1) % m.length]); }
  if (s.arm) flight.toggleArm(s.throttle);
  const alpha = stepper.advance(dt, (step) => flight.step(step, s)); // fizik: her zaman 240 Hz
  renderPos.lerpVectors(flight.previousPosition, flight.position, alpha);
  renderRot.slerpQuaternions(flight.previousRotation, flight.rotation, alpha);
  model.group.position.copy(renderPos); model.group.quaternion.copy(renderRot);
  model.props.forEach((p, i) => { if (i % 2 === 1) p.rotation.y += flight.motorOmega[i >> 1] * dt; });
  if (chase) {
    const yaw = new THREE.Euler().setFromQuaternion(renderRot, 'YXZ').y, [cx, cy, cz] = drone.chase;
    camera.position.copy(renderPos).add(tmp.set(cx, cy, cz).applyAxisAngle(THREE.Object3D.DEFAULT_UP, yaw));
    camera.lookAt(renderPos); model.group.visible = true;
  } else {
    const [ox, oy, oz] = drone.camera.offset;
    camera.position.copy(renderPos).add(tmp.set(ox, oy, oz).applyQuaternion(renderRot));
    cameraOrientation(drone, renderRot, drone.cameraTilt, camera.quaternion); model.group.visible = false;
  }
  renderer.render(scene, camera);
  hud.textContent = `${drone.name}  ·  ${flight.controller.mode}  ·  ${flight.armed ? 'ARMED' : 'DISARM'}\n` +
    `ALT ${flight.position.y.toFixed(1)} m   HIZ ${(flight.velocity.length() * 3.6).toFixed(0)} km/sa\n` +
    `GAZ ${Math.round((s.throttle ?? 0) * 100)}%   HOVER ≈${(drone.hover * 100).toFixed(1)}%   ÇARPIŞMA ${flight.crashes}\n` +
    `${chase ? 'TAKİP' : 'FPV'} kamera  ·  fizik ${Math.round(1 / 0.0041667)} Hz sabit\n${flight.message ?? ''}`;
});
