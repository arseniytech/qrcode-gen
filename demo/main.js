import { generate, toPngBuffer } from '../src/index.js';

const input = document.getElementById('input');
const level = document.getElementById('level');
const go = document.getElementById('go');
const dl = document.getElementById('dl');
const img = document.getElementById('qr');
const meta = document.getElementById('meta');

let current = null;

function render() {
  const text = input.value.trim();
  if (!text) return;
  current = generate(text, { eccLevel: level.value });
  const url = URL.createObjectURL(new Blob([toPngBuffer(current.matrix)], { type: 'image/png' }));
  img.src = url;
  meta.textContent = `version ${current.version} · level ${current.eccLevel} · mask ${current.mask} · ${current.matrix.length}×${current.matrix.length}`;
}

go.addEventListener('click', render);
input.addEventListener('input', render);
render();

dl.addEventListener('click', () => {
  if (!current) return;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([toPngBuffer(current.matrix)], { type: 'image/png' }));
  a.download = 'qr.png';
  a.click();
});