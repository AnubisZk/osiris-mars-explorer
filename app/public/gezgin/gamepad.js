/* OSIRISZK — Xbox / standart oyun kumandası desteği (tarayıcının Gamepad API'si).
   Kurulum veya sürücü gerekmez: Xbox One / Series kumandası USB, Bluetooth ya da kablosuz adaptörle
   Windows'a bağlıyken Chrome ve Edge onu "standard" düzende tanır.
   Not: Tarayıcılar güvenlik gereği kumandayı ancak sayfa açıkken bir düğmeye basılınca gösterir. */

// Standart düzen (W3C "standard gamepad") — Xbox düğme adlarıyla
export const PAD = Object.freeze({A:0,B:1,X:2,Y:3,LB:4,RB:5,LT:6,RT:7,VIEW:8,MENU:9,LS:10,RS:11,UP:12,DOWN:13,LEFT:14,RIGHT:15,XBOX:16});

// Dairesel ölü bölge: çubuk merkezdeyken titreşmez, ölü bölgenin dışında 0→1 arası yumuşak başlar.
function radial(x, y, deadzone) {
  const m = Math.hypot(x, y);
  if (m < deadzone) return [0, 0];
  const s = Math.min(1, (m - deadzone) / (1 - deadzone)) / m;
  return [x * s, y * s];
}
const trigger = (v, deadzone = .06) => v < deadzone ? 0 : Math.min(1, (v - deadzone) / (1 - deadzone));

export class GamepadInput {
  constructor({onConnect, onDisconnect} = {}) {
    this.connected = false; this.id = ''; this.gp = null;
    this.now = []; this.prev = [];
    this.lx = this.ly = this.rx = this.ry = this.lt = this.rt = 0;
    if (typeof window !== 'undefined') {
      window.addEventListener('gamepadconnected', e => onConnect?.(e.gamepad));
      window.addEventListener('gamepaddisconnected', e => onDisconnect?.(e.gamepad));
    }
  }
  /** Her karede bir kez çağrılır. Kumanda yoksa false döner ve tüm girişler sıfırlanır. */
  poll() {
    const list = navigator.getGamepads ? Array.from(navigator.getGamepads()) : [];
    let gp = null;
    for (const g of list) if (g && g.connected && (!gp || (g.mapping === 'standard' && gp.mapping !== 'standard'))) gp = g;
    this.gp = gp;
    if (!gp) {
      this.connected = false; this.now = []; this.prev = [];
      this.lx = this.ly = this.rx = this.ry = this.lt = this.rt = 0;
      return false;
    }
    this.connected = true; this.id = gp.id;
    const ax = i => Number.isFinite(gp.axes[i]) ? gp.axes[i] : 0;
    const bv = i => { const b = gp.buttons[i]; return b ? (b.value || (b.pressed ? 1 : 0)) : 0; };
    [this.lx, this.ly] = radial(ax(0), ax(1), .16);
    [this.rx, this.ry] = radial(ax(2), ax(3), .16);
    this.lt = trigger(bv(PAD.LT)); this.rt = trigger(bv(PAD.RT));
    this.prev = this.now;
    this.now = gp.buttons.map(b => !!(b && b.pressed));
    return true;
  }
  held(i) { return !!this.now[i]; }
  /** Bu karede yeni basıldı mı (basılı tutmak tekrar tetiklemez). */
  pressed(i) { return !!this.now[i] && !this.prev[i]; }
  /** Titreşim — destekleyen tarayıcı/kumandada; desteklenmezse sessizce yok sayılır. */
  rumble(strong = .5, weak = .3, ms = 140) {
    try {
      const act = this.gp && this.gp.vibrationActuator;
      if (act && act.playEffect) act.playEffect('dual-rumble', {startDelay: 0, duration: ms, strongMagnitude: strong, weakMagnitude: weak})?.catch?.(() => {});
    } catch (_) { /* titreşim isteğe bağlı */ }
  }
}
