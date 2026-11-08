// Earth / Mars flight demo (Phase 1): the unchanged flight core on a selectable planet.
// Physics: Rapier at 240 Hz fixed step; gravity and density-dependent thrust/drag from the planet
// layer. Visuals here are placeholder boxes and colours — NOT NASA terrain (Phase 4).
import * as THREE from 'three';
import {initializeRapier,FixedStepper,InputManager,DRONE_TYPES,DRONE_ORDER,getDrone,createDroneModel,cameraOrientation} from '../../src/index.js';
import {PlanetEnvironment,PlanetFlightPhysics,PROFILES,PROFILE_ORDER,rotorDiagnostics} from '../../src/planet/index.js';

await initializeRapier();

const COLLISION = [
  {pos: [0, -0.5, 0], half: [80, 0.5, 80], ground: true},
  {pos: [8, 2, -14], half: [2, 2, 2]},
  {pos: [-10, 3, -22], half: [1.5, 3, 1.5]},
  {pos: [-1.6, 1.25, -30], half: [0.1, 1.25, 0.1], gate: true},
  {pos: [1.6, 1.25, -30], half: [0.1, 1.25, 0.1], gate: true},
  {pos: [0, 2.6, -30], half: [1.7, 0.1, 0.1], gate: true},
];
const SPAWN = [0, 0.15, 0];
const PALETTE = {
  earth: {sky: '#9fc4d8', ground: '#5d6b4f', block: '#8a8f86', sun: '#fff3dc'},
  mars: {sky: '#c9a383', ground: '#9a5b3a', block: '#7d5440', sun: '#ffe2c4'}, // illustrative colours only
};

let lang = 'en';
let drone = getDrone('freestyle5');
let environment = new PlanetEnvironment('mars-brief');
const flight = new PlanetFlightPhysics(SPAWN, 0, drone, environment);
for (const b of COLLISION) flight.addBox(b.pos, b.half);
const stepper = new FixedStepper();

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({canvas, antialias: true});
renderer.setPixelRatio(Math.min(2, devicePixelRatio));
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(100, 1, 0.03, 600);
scene.add(new THREE.HemisphereLight('#dfefff', '#4a5240', 1.4));
const sun = new THREE.DirectionalLight('#fff3dc', 2.2); sun.position.set(30, 50, 20); scene.add(sun);
const meshes = COLLISION.map((b) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(b.half[0] * 2, b.half[1] * 2, b.half[2] * 2), new THREE.MeshStandardMaterial({roughness: 0.9}));
  m.position.set(...b.pos); m.userData = b; scene.add(m); return m;
});
function paint() {
  const p = PALETTE[environment.planet];
  scene.background = new THREE.Color(p.sky); scene.fog = new THREE.Fog(p.sky, 60, 220); sun.color.set(p.sun);
  for (const m of meshes) m.material.color.set(m.userData.gate ? '#e4ff65' : m.userData.ground ? p.ground : p.block);
}
let model = createDroneModel(drone); scene.add(model.group);

const input = new InputManager(() => {}); input.active = true;
const droneSelect = document.getElementById('drone'), planetSelect = document.getElementById('planet'), langSelect = document.getElementById('lang');
for (const id of DRONE_ORDER) droneSelect.add(new Option(DRONE_TYPES[id].name, id));
function fillPlanets() {
  const current = planetSelect.value || environment.id; planetSelect.length = 0;
  for (const id of PROFILE_ORDER) planetSelect.add(new Option(PROFILES[id].label[lang], id));
  planetSelect.value = current;
}
fillPlanets();
// H key / gamepad hover point follows the planetized airframe (capped at full throttle when hover is impossible)
const syncHover = () => { input.hover = Math.min(1, flight.drone.hover); };
const restart = () => { flight.reset(); stepper.reset(); input.resetThrottle(); syncHover(); canvas.focus(); };
droneSelect.onchange = () => {
  if (flight.armed) { droneSelect.value = drone.id; return; }
  drone = getDrone(droneSelect.value); flight.setDrone(drone);
  scene.remove(model.group); model = createDroneModel(drone); scene.add(model.group); restart(); report();
};
planetSelect.onchange = () => {
  if (flight.armed) { planetSelect.value = environment.id; return; }
  environment = new PlanetEnvironment(planetSelect.value); flight.setEnvironment(environment); paint(); restart(); report();
};
const LABELS = {
  en: {'l-planet': 'Planet profile (motors off)', 'l-drone': 'Airframe (motors off)', help: 'Space: arm · W/S: throttle · H: hover · arrows: tilt · A/D: yaw · M: mode · C: camera · R: reset · Q: cut motors'},
  tr: {'l-planet': 'Gezegen profili (motorlar kapalıyken)', 'l-drone': 'Drone türü (motorlar kapalıyken)', help: 'Space: motorlar · W/S: gaz · H: askı · oklar: eğim · A/D: dönüş · M: mod · C: kamera · R: sıfırla · Q: motorları kes'},
};
langSelect.onchange = () => {
  lang = langSelect.value; document.documentElement.lang = lang;
  for (const [id, text] of Object.entries(LABELS[lang])) document.getElementById(id).textContent = text;
  fillPlanets(); report(); canvas.focus();
};

const panel = document.getElementById('report');
function report() {
  const d = rotorDiagnostics(drone, environment, {altitude: flight.siteElevation + SPAWN[1]});
  const s = environment.surface, t = (en, tr) => (lang === 'tr' ? tr : en);
  const rows = [
    [t('Gravity', 'Yerçekimi'), `${environment.gravity} m/s²`],
    [t('Air density', 'Hava yoğunluğu'), `${s.density.toPrecision(3)} kg/m³`],
    [t('Speed of sound', 'Ses hızı'), `${s.speedOfSound.toFixed(0)} m/s`],
    [t('Thrust / weight', 'İtki / ağırlık'), d.thrustToWeight.toFixed(2)],
    [t('Hover throttle', 'Askı gazı'), d.hoverThrottle > 1 ? t('impossible', 'imkânsız') : `${(d.hoverThrottle * 100).toFixed(0)} %`],
    [t('Blade Re (75 % R)', 'Pal Re (%75 R)'), Math.round(d.reynolds75).toLocaleString()],
    [t('Tip Mach (max rpm)', 'Uç Mach (azami devir)'), d.tipMach.toFixed(2)],
  ];
  panel.innerHTML = rows.map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('') +
    d.warnings.map((w) => `<p class="warn">${w[lang]}</p>`).join('') +
    `<p class="note">${t('Phase 1: CT held at its Earth value — Mars thrust shown is an upper bound.', 'Aşama 1: CT Dünya değerinde sabit — gösterilen Mars itkisi bir üst sınırdır.')}</p>`;
}
paint(); report(); syncHover();

let chase = true, last = performance.now();
const renderPos = new THREE.Vector3(), renderRot = new THREE.Quaternion(), tmp = new THREE.Vector3();
const hud = document.getElementById('hud');
function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize(); canvas.focus();

renderer.setAnimationLoop((now) => {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  const s = input.update(dt);
  if (s.reset) restart();
  if (s.cut) { flight.disarm(); input.resetThrottle(); }
  if (s.camera) chase = !chase;
  if (s.mode && !flight.armed) { const m = drone.modes; flight.controller.setMode(m[(m.indexOf(flight.controller.mode) + 1) % m.length]); }
  // Arming releases the throttle lock set by reset / airframe or planet change (as in the ZSK app)
  if (s.arm && (flight.armed || input.canArm())) { flight.toggleArm(s.throttle); if (flight.armed) input.releaseThrottleLock(); }
  const alpha = stepper.advance(dt, (step) => flight.step(step, s));
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
  const thrust = flight.motorThrust.reduce((a, b) => a + b, 0), weight = environment.weight(drone.mass);
  hud.textContent = `${environment.label[lang]}  ·  ${drone.name}  ·  ${flight.controller.mode}  ·  ${flight.armed ? 'ARMED' : 'DISARMED'}\n` +
    `ALT ${flight.position.y.toFixed(1)} m   V ${flight.velocity.length().toFixed(1)} m/s   ρ ${flight.drone.planet.density.toPrecision(3)} kg/m³\n` +
    `THR ${Math.round((s.throttle ?? 0) * 100)} %   ${lang === 'tr' ? 'İTKİ' : 'THRUST'} ${thrust.toFixed(2)} N / ${lang === 'tr' ? 'AĞIRLIK' : 'WEIGHT'} ${weight.toFixed(2)} N\n` +
    `${chase ? 'CHASE' : 'FPV'}  ·  physics 240 Hz fixed\n${flight.message ?? ''}`;
});
// Exposed for automated checks (read-only use)
window.__planetDemo = {flight, get environment() { return environment; }};
