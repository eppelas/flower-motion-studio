import originalSVG from './assets/flower.svg?raw';

const storageKey = 'flower-logo-studio-colours-v1';
const parsed = new DOMParser().parseFromString(originalSVG, 'image/svg+xml');
const svg = document.importNode(parsed.documentElement, true);
svg.removeAttribute('xmlns:inkscape');
svg.classList.add('flower-logo');
svg.setAttribute('aria-hidden', 'true');
svg.setAttribute('focusable', 'false');
const image = document.querySelector('.flower img');
image.replaceWith(svg);

const defaults = {};
const colours = {};
const valid = value => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
const error = document.querySelector('#colour-error');
let saved = {};
try { saved = JSON.parse(localStorage.getItem(storageKey) || '{}') || {}; } catch {}

function store() { try { localStorage.setItem(storageKey, JSON.stringify(colours)); } catch {} }
function apply(part, value) {
  if (!valid(value)) return;
  const colour = value.toLowerCase();
  colours[part] = colour;
  svg.querySelectorAll(`#${CSS.escape(part)} path`).forEach(path => path.setAttribute('fill', colour));
  document.querySelector(`[data-color-part="${part}"]`).value = colour;
  const text = document.querySelector(`[data-hex-part="${part}"]`);
  text.value = colour.toUpperCase();
  text.removeAttribute('aria-invalid');
  error.textContent = document.querySelector('[data-hex-part][aria-invalid=true]') ? 'Use a hex colour such as #459865.' : '';
  store();
  document.dispatchEvent(new Event('flower:colours'));
}
for (const picker of document.querySelectorAll('[data-color-part]')) {
  const part = picker.dataset.colorPart;
  defaults[part] = svg.querySelector(`#${CSS.escape(part)} path`).getAttribute('fill');
  apply(part, valid(saved[part]) ? saved[part] : defaults[part]);
  picker.addEventListener('input', () => apply(part, picker.value));
  const text = document.querySelector(`[data-hex-part="${part}"]`);
  text.addEventListener('input', () => { if (valid(text.value)) apply(part, text.value); });
  text.addEventListener('change', () => {
    if (valid(text.value)) apply(part, text.value);
    else {
      text.setAttribute('aria-invalid', 'true');
      error.textContent = 'Use a hex colour such as #459865.';
    }
  });
}
document.querySelector('#reset-colours').addEventListener('click', () => {
  for (const [part, value] of Object.entries(defaults)) apply(part, value);
});
