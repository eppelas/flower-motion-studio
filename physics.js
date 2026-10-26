import { outline } from './geometry.js';

export const presets = [
  { id: 'rubber', name: 'Rubber', gravity: 1550, rebound: .78, hop: 118, contact: .065, squash: .22, stiffness: 280, damping: 17, drag: .35, spin: .24 },
  { id: 'soft', name: 'Soft', gravity: 1150, rebound: .51, hop: 66, contact: .19, squash: .34, stiffness: 165, damping: 9, drag: 1.3, spin: -.15 },
  { id: 'heavy', name: 'Heavy', gravity: 2350, rebound: .32, hop: 25, contact: .085, squash: .065, stiffness: 420, damping: 31, drag: .7, spin: .7 },
];
export const playgroundPresets = [...presets,
  { ...presets[0], id: 'double', name: 'Double hop', gravity: 1500, rebound: .42, hop: 110, contact: .08 },
  { ...presets[1], id: 'float', name: 'Slow float', gravity: 520, rebound: .64, hop: 85, contact: .1, squash: .12, stiffness: 130, damping: 14, spin: .1 },
  { ...presets[2], id: 'settle', name: 'Drop and settle', gravity: 1900, rebound: .48, hop: 0, contact: .06, squash: .12 },
];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Physics positions describe the artwork's anchor, never a draggable loop origin.
export class FlowerBody {
  constructor(preset) {
    this.preset = preset;
    this.intensity = 1;
    this.deformation = true;
    this.width = 0;
    this.height = 0;
    this.size = 160;
    this.x = this.y = this.vx = this.vy = this.angle = this.spin = 0;
    this.sy = 1;
    this.shapeVelocity = 0;
    this.mode = 'flight';
    this.contactAge = 0;
    this.launch = 0;
    this.impacts = 0;
    this.dragging = false;
    this.responseScale = 1; this.responseHeld = false; this.effectHidden = false;
  }

  get unit() { return this.size / 160; }
  get sx() { return this.deformation ? 1 / Math.sqrt(this.sy) : 1; }
  get floor() { return this.height - 26; }
  get gravity() { return this.preset.gravity * this.unit; }

  support() {
    const cos = Math.cos(this.angle), sin = Math.sin(this.angle);
    let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
    for (const [x, y] of outline) {
      const px = this.size * this.responseScale * (x * this.sx * cos - y * this.sy * sin);
      const py = this.size * this.responseScale * (x * this.sx * sin + y * this.sy * cos);
      left = Math.min(left, px); right = Math.max(right, px);
      top = Math.min(top, py); bottom = Math.max(bottom, py);
    }
    return { left, right, top, bottom };
  }

  constrain(bounceWalls = false) {
    const bounds = this.support(), margin = 12;
    const lo = margin - bounds.left, hi = this.width - margin - bounds.right;
    if (this.x < lo || this.x > hi) {
      this.x = clamp(this.x, lo, hi);
      if (bounceWalls) {
        this.vx = (this.x === lo ? 1 : -1) * Math.abs(this.vx) * .67;
        this.spin *= -.6;
      }
    }
    const ceiling = margin - bounds.top;
    if (this.y < ceiling) { this.y = ceiling; if (bounceWalls) this.vy = Math.max(0, this.vy * -.3); }
    if (this.y + bounds.bottom > this.floor) this.y = this.floor - bounds.bottom;
    return bounds;
  }

  resize(width, height, size) {
    const previousWidth = this.width, previousFloor = this.floor, previousUnit = this.unit;
    const gap = previousFloor - this.y;
    this.width = width; this.height = height; this.size = size;
    if (!previousWidth) { this.reset(); return; }
    this.x = this.x / previousWidth * width;
    this.y = this.floor - gap * this.unit / previousUnit;
    this.vx *= this.unit / previousUnit;
    this.vy *= this.unit / previousUnit;
    this.launch *= this.unit / previousUnit;
    this.constrain();
    if (['rest', 'contact'].includes(this.mode)) this.y = this.floor - this.support().bottom;
  }

  reset() {
    this.x = this.width * .5;
    this.y = this.floor - (this.size * .46 + (this.preset.hop + 65) * this.unit);
    this.vx = this.vy = 0;
    this.angle = 0;
    this.spin = this.preset.spin;
    this.sy = 1; this.shapeVelocity = 0;
    this.mode = 'flight'; this.dragging = false; this.contactAge = 0; this.impacts = 0;
    this.responseScale = 1; this.responseHeld = false; this.effectHidden = false;
    this.constrain();
  }

  grab() {
    this.dragging = true;
    this.mode = 'held';
    this.vx = this.vy = this.spin = this.shapeVelocity = 0;
  }

  moveTo(x, y) { this.x = x; this.y = y; this.constrain(); }

  drop(vx = 0, vy = 0) {
    this.dragging = false;
    this.mode = 'flight';
    this.vx = clamp(vx, -1050 * this.unit, 1050 * this.unit);
    this.vy = clamp(vy, -1250 * this.unit, 1250 * this.unit);
    this.spin = clamp(this.vx / (this.size * .45), -5, 5) * .55;
    this.shapeVelocity = 0;
  }

  freeze() { this.vx = this.vy = this.spin = this.shapeVelocity = 0; }

  configure(preset, intensity = 1, deformation = true) {
    this.preset = preset;
    this.intensity = clamp(intensity, 0, 2);
    this.deformation = deformation;
    if (!deformation) { this.sy = 1; this.shapeVelocity = 0; }
    if (!this.dragging && ['rest', 'contact'].includes(this.mode)) {
      this.y = this.floor - this.support().bottom;
      this.mode = 'flight'; this.vy = 0;
    }
    this.constrain();
  }

  impact() {
    const speed = Math.abs(this.vy);
    this.impacts++;
    const bounds = this.support();
    const available = Math.max(0, this.floor - 12 - (bounds.bottom - bounds.top));
    const rhythm = this.preset.id === 'double' && this.impacts % 2 === 0 ? .25 : 1;
    const targetHeight = Math.min(this.preset.hop * this.unit * this.intensity * rhythm, available * .82);
    const maxLaunch = Math.sqrt(2 * this.gravity * available * .9);
    this.launch = Math.min(maxLaunch, Math.max(speed * Math.min(.94, this.preset.rebound * Math.sqrt(this.intensity)), Math.sqrt(2 * this.gravity * targetHeight)));
    this.vy = 0;
    this.vx *= this.preset.id === 'heavy' ? .82 : .72;
    this.shapeVelocity = this.deformation ? -this.preset.squash * 33 * clamp(speed / (650 * this.unit), .45, 1.2) : 0;
    this.spin = this.spin * .72 + this.vx / (this.size * .45) * .18;
    this.mode = this.launch < 35 * this.unit && targetHeight === 0 ? 'rest' : 'contact'; this.contactAge = 0;
    this.y = this.floor - bounds.bottom;
  }

  step(dt) {
    if (this.dragging || this.responseHeld || this.effectHidden) return;
    // Bounded fixed substeps are supplied by the frame controller.
    const p = this.preset;
    if (this.deformation) this.shapeVelocity += ((1 - this.sy) * p.stiffness - this.shapeVelocity * p.damping) * dt;
    else { this.sy = 1; this.shapeVelocity = 0; }
    this.sy = clamp(this.sy + this.shapeVelocity * dt, 1 - p.squash, 1.16);
    if ((this.sy <= 1 - p.squash && this.shapeVelocity < 0) || (this.sy >= 1.16 && this.shapeVelocity > 0)) this.shapeVelocity *= -.25;
    this.x += this.vx * dt;
    this.vx *= Math.exp(-p.drag * dt);
    this.angle += this.spin * dt;
    this.spin *= Math.exp(-(this.mode === 'rest' ? 10 : this.mode === 'contact' ? 1.7 : .16) * dt);
    if (this.mode === 'rest') {
      this.vx *= Math.exp(-8 * dt);
      if (Math.abs(this.vx) < .01) this.vx = 0;
      if (Math.abs(this.spin) < .001) this.spin = 0;
      if (Math.abs(this.sy - 1) < .00001 && Math.abs(this.shapeVelocity) < .0001) { this.sy = 1; this.shapeVelocity = 0; }
    }

    if (this.mode === 'rest') {
      this.y = this.floor - this.support().bottom;
    } else if (this.mode === 'contact') {
      this.contactAge += dt;
      this.y = this.floor - this.support().bottom;
      if (this.contactAge >= p.contact) {
        this.mode = 'flight'; this.vy = -this.launch;
      }
    } else {
      this.y += this.vy * dt + .5 * this.gravity * dt * dt;
      this.vy += this.gravity * dt;
      if (this.y + this.support().bottom >= this.floor && this.vy >= 0) this.impact();
    }
    this.constrain(true);
    if (['rest', 'contact'].includes(this.mode)) this.y = this.floor - this.support().bottom;
  }

  snapshot() {
    const support = this.support();
    return { id: this.preset.id, x: this.x, y: this.y, vx: this.vx, vy: this.vy, angle: this.angle, sx: this.sx, sy: this.sy,
      width: this.width, height: this.height, size: this.size, floor: this.floor,
      top: this.y + support.top, bottom: this.y + support.bottom, left: this.x + support.left, right: this.x + support.right,
      intensity: this.intensity, deformation: this.deformation, mode: this.mode, dragging: this.dragging, impacts: this.impacts };
  }
}
