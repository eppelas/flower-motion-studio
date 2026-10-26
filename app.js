import { frame, cancelFrame } from 'motion';
import { setupClickEffects } from './click-effects.js';
import { FlowerBody, presets, playgroundPresets } from './physics.js';

const media = matchMedia('(prefers-reduced-motion: reduce)');
const pauseButton = document.querySelector('#pause');
const status = document.querySelector('#motion-status');
let reduced = media.matches;
let paused = false;
let last = 0;
let accumulator = 0;
let playbackSpeed = 1;
let clickEffects = null;
const worlds = [...document.querySelectorAll('[data-world]')].map((arena, index) => ({
  arena, element: arena.querySelector('.flower'), shadow: arena.querySelector('.shadow'),
  body: new FlowerBody(presets[index]), drag: null,
}));

function say(message) { status.textContent = message; }
function controls() {
  pauseButton.textContent = paused ? 'Play motion' : 'Pause motion';
  pauseButton.disabled = reduced;
  pauseButton.setAttribute('aria-pressed', String(paused));
  say(reduced ? 'Reduced motion' : paused ? 'Paused' : 'Drag, lift, drop.');
}

function renderWorld(world) {
  const { body, element, shadow } = world;
  element.style.visibility = body.effectHidden ? 'hidden' : 'visible';
  shadow.style.visibility = body.effectHidden ? 'hidden' : 'visible';
  element.style.width = `${body.size}px`;
  element.style.height = `${body.size * 198 / 194}px`;
  element.style.left = `${body.x - body.size * 99 / 194}px`;
  element.style.top = `${body.y - body.size * 102 / 194}px`;
  element.style.transform = `rotate(${body.angle}rad) scale(${body.sx * body.responseScale}, ${body.sy * body.responseScale})`;
  const gap = Math.max(0, body.floor - body.snapshot().bottom);
  const proximity = Math.max(.18, 1 - gap / (world.arena.clientHeight * .8));
  shadow.style.left = `${body.x}px`;
  shadow.style.width = `${body.size * .76}px`;
  shadow.style.transform = `translateX(-50%) scaleX(${.5 + proximity * .5})`;
  shadow.style.opacity = String(.05 + proximity * .17);
}
const render = () => { worlds.forEach(renderWorld); clickEffects?.render(); };

function measure() {
  for (const world of worlds) {
    const rect = world.arena.getBoundingClientRect();
    // Identical logo sizes for peer frames, with enough room for full deformation.
    const size = Math.min(160, rect.width * .35, (rect.height - 54) * .65);
    world.body.resize(rect.width, rect.height, size);
    if (world.drag?.kind === 'pointer') {
      world.drag.offsetX = world.drag.clientX - rect.left - world.body.x;
      world.drag.offsetY = world.drag.clientY - rect.top - world.body.y;
      world.drag.samples = [];
    }
  }
  clickEffects?.resize();
  render();
}

function release(world, cancelled = false) {
  const drag = world.drag;
  if (!drag) return;
  let vx = 0, vy = 0;
  if (drag.kind === 'pointer' && !cancelled && !paused && !reduced) {
    const now = performance.now();
    const samples = drag.samples.filter(sample => now - sample.time <= 100);
    if (samples.length > 1 && now - samples.at(-1).time < 80) {
      const first = samples[0], end = samples.at(-1), dt = (end.time - first.time) / 1000;
      if (dt > .008) { vx = (end.x - first.x) / dt; vy = (end.y - first.y) / dt; }
    }
  }
  if (drag.kind === 'keyboard' || (drag.travel || 0) > 6) world.body.responseHeld = false;
  world.drag = null;
  world.element.classList.remove('dragging');
  world.element.removeAttribute('aria-pressed');
  world.body.drop(vx, vy);
  if (drag.kind === 'pointer' && world.element.hasPointerCapture(drag.id)) world.element.releasePointerCapture(drag.id);
  renderWorld(world);
  say(reduced || paused ? `${world.body.preset.name} placed` : `${world.body.preset.name} dropped`);
}

for (const world of worlds) {
  const { element, body, arena } = world;
  const move = event => {
    const drag = world.drag;
    if (drag?.kind !== 'pointer' || drag.id !== event.pointerId) return;
    const rect = arena.getBoundingClientRect();
    drag.travel = Math.max(drag.travel || 0, Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY));
    drag.clientX = event.clientX; drag.clientY = event.clientY;
    body.moveTo(event.clientX - rect.left - drag.offsetX, event.clientY - rect.top - drag.offsetY);
    const time = performance.now();
    drag.samples = drag.samples.filter(sample => time - sample.time <= 110);
    drag.samples.push({ x: body.x, y: body.y, time });
    renderWorld(world);
  };

  element.addEventListener('pointerdown', event => {
    if (event.button !== 0 || !event.isPrimary || world.drag) return;
    event.preventDefault();
    const rect = arena.getBoundingClientRect();
    body.grab();
    world.drag = { kind: 'pointer', id: event.pointerId, clientX: event.clientX, clientY: event.clientY, startX: event.clientX, startY: event.clientY, travel: 0,
      offsetX: event.clientX - rect.left - body.x, offsetY: event.clientY - rect.top - body.y,
      samples: [{ x: body.x, y: body.y, time: performance.now() }] };
    element.setPointerCapture(event.pointerId);
    element.classList.add('dragging');
    element.setAttribute('aria-pressed', 'true');
    element.focus({ preventScroll: true });
    say(`${body.preset.name} held`);
  });
  element.addEventListener('pointermove', move);
  element.addEventListener('pointerup', event => {
    const drag = world.drag;
    if (drag?.kind !== 'pointer' || drag.id !== event.pointerId) return;
    if (event.clientX !== drag.clientX || event.clientY !== drag.clientY) move(event);
    release(world);
  });
  for (const type of ['pointercancel', 'lostpointercapture']) {
    element.addEventListener(type, event => {
      if (world.drag?.kind === 'pointer' && world.drag.id === event.pointerId) release(world, true);
    });
  }

  element.addEventListener('keydown', event => {
    if (world.drag?.kind === 'pointer') return;
    const directions = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const direction = directions[event.key];
    if (!direction && ![' ', 'Enter', 'Escape'].includes(event.key)) return;
    event.preventDefault();
    if (event.key === 'Escape') { release(world, true); return; }
    if (!direction && world.drag) { release(world); return; }
    if (!world.drag) {
      body.grab(); world.drag = { kind: 'keyboard' };
      element.classList.add('dragging'); element.setAttribute('aria-pressed', 'true');
      say(`${body.preset.name} held. Arrow keys move; Space drops.`);
    }
    if (direction) {
      const step = event.shiftKey ? 30 : 10;
      body.moveTo(body.x + direction[0] * step, body.y + direction[1] * step);
      renderWorld(world);
    }
  });
  element.addEventListener('blur', () => { if (world.drag?.kind === 'keyboard') release(world, true); });
}

pauseButton.addEventListener('click', () => { paused = !paused; accumulator = 0; controls(); });
document.querySelector('#reset').addEventListener('click', () => {
  clickEffects?.reset();
  for (const world of worlds) {
    release(world, true); world.body.reset();
    if (reduced) world.body.freeze();
  }
  accumulator = 0; render(); controls(); say('All positions reset');
});
media.addEventListener('change', () => {
  reduced = media.matches;
  for (const world of worlds) {
    if (reduced) world.body.freeze();
    else if (!world.drag) world.body.drop();
  }
  accumulator = 0; controls(); render();
});

function tick({ timestamp }) {
  if (last && !paused && !reduced && !document.hidden) {
    accumulator += Math.min((timestamp - last) / 1000, .05) * playbackSpeed;
    while (accumulator >= 1 / 120) {
      for (const world of worlds) world.body.step(1 / 120);
      clickEffects?.step(1 / 120);
      accumulator -= 1 / 120;
    }
  }
  last = timestamp;
  render();
}
new ResizeObserver(measure).observe(document.querySelector('#stage'));
window.addEventListener('resize', measure);
document.addEventListener('visibilitychange', () => { last = 0; accumulator = 0; });
measure(); controls();
setupPlayground();
if (document.querySelector('#click-effects')) clickEffects = setupClickEffects({ world: worlds[0], paused: () => paused || reduced, reduced: () => reduced, paint: render });
if (reduced) worlds.forEach(world => world.body.freeze());
frame.update(tick, true);
window.addEventListener('pagehide', () => cancelFrame(tick));
window.addEventListener('pageshow', event => { if (event.persisted) { last = 0; accumulator = 0; frame.update(tick, true); } });
window.flowerStudy = {
  get effects() { return clickEffects?.snapshot() || null; },
  get state() { return { paused, reduced, playbackSpeed, bodies: worlds.map(world => world.body.snapshot()) }; },
};


function setupPlayground() {
  const pattern = document.querySelector('#pattern');
  if (!pattern) return;
  const intensity = document.querySelector('#intensity');
  const deformation = document.querySelector('#deformation');
  const speed = document.querySelector('#speed');
  const storageKey = document.body.dataset.settingsKey || 'flower-playground-settings-v1';
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(storageKey) || '{}') || {}; } catch {}
  if (playgroundPresets.some(preset => preset.id === saved.pattern)) pattern.value = saved.pattern;
  if (Number.isFinite(saved.intensity)) intensity.value = Math.max(0, Math.min(200, saved.intensity));
  if (typeof saved.deformation === 'boolean') deformation.checked = saved.deformation;
  if (Number.isFinite(saved.speed)) speed.value = Math.max(.5, Math.min(1.5, saved.speed));

  function apply() {
    const preset = playgroundPresets.find(preset => preset.id === pattern.value) || presets[0];
    const value = Number(intensity.value);
    playbackSpeed = Number(speed.value);
    worlds[0].body.configure(preset, value / 100, deformation.checked);
    document.querySelector('#intensity-value').textContent = `${value}%`;
    document.querySelector('#speed-value').textContent = `${playbackSpeed.toFixed(1)}×`;
    document.querySelector('#preview-pattern').textContent = preset.name;
    worlds[0].element.setAttribute('aria-label', `Grab ${preset.name} flower`);
    document.querySelector('#deformation-state').textContent = deformation.checked ? 'Squash and stretch' : 'Keep the logo rigid';
    try { localStorage.setItem(storageKey, JSON.stringify({ pattern: preset.id, intensity: value, deformation: deformation.checked, speed: playbackSpeed })); } catch {}
    render();
  }
  for (const control of [pattern, intensity, deformation, speed]) control.addEventListener('input', apply);
  apply();
}
