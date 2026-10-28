// Generates PNG icons (brass-on-walnut roulette ring + pointer) with a minimal PNG encoder. Run: node scripts/make-icons.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

// Muted book-cloth slices (oxblood, forest, navy, ochre, rust, slate, olive, teal).
const COLORS = ['#6e2f2a', '#34503a', '#2d3d55', '#8a6a2e', '#7a4a2e', '#4a5560', '#5c5a33', '#2f5552'];
const BG = '#1b1712';
const BRASS = '#d7a54a';
const BRASS_D = '#8a6020';
const LINE = '#0f0d0a';
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};
function encodePng(size, rgb) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 2; // RGB, no alpha
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    rgb.copy(raw, y * (size * 3 + 1) + 1, y * size * 3, (y + 1) * size * 3);
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// Pointer wedge (unit coords, disc radius 1): downward triangle above the ring at 12 o'clock.
function inPointer(x, y) {
  const top = -1.12, tip = -0.8, half = 0.18;
  if (y < top || y > tip) return false;
  const t = (y - top) / (tip - top); // 0 at top edge, 1 at tip
  return Math.abs(x) <= half * (1 - t);
}

function colorAt(dx, dy) {
  if (inPointer(dx, dy)) return hex(dx < 0 ? BRASS : BRASS_D); // two-tone metallic facet
  const d = Math.hypot(dx, dy);
  if (d > 1) return hex(BG);
  if (d > 0.86) return hex(BRASS); // brass ring
  if (d > 0.82) return hex(LINE);
  if (d <= 0.2) return hex(BRASS_D); // hub centre
  if (d <= 0.3) return hex(BRASS); // brass hub
  if (d <= 0.34) return hex(LINE);
  const a = (Math.atan2(dy, dx) + Math.PI * 2.5) % (Math.PI * 2);
  const f = (a / (Math.PI * 2)) * 8;
  const edge = Math.min(f % 1, 1 - (f % 1)) * ((Math.PI * 2) / 8) * d; // arc distance to slice edge
  if (edge < 0.025) return hex(LINE);
  return hex(COLORS[Math.floor(f) % 8]);
}

function render(size, { disc = 0.36 } = {}) {
  const buf = Buffer.alloc(size * size * 3);
  const SS = 3;
  const R = size * disc;
  const cy = size / 2 + size * 0.02; // nudge down so the pointer sits inside the safe zone
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const dx = (px + (sx + 0.5) / SS - size / 2) / R;
          const dy = (py + (sy + 0.5) / SS - cy) / R;
          const c = colorAt(dx, dy);
          r += c[0]; g += c[1]; b += c[2];
        }
      }
      const n = SS * SS, i = (py * size + px) * 3;
      buf[i] = r / n; buf[i + 1] = g / n; buf[i + 2] = b / n;
    }
  }
  return buf;
}

mkdirSync('public', { recursive: true });
// disc 0.36 keeps ring + pointer within the maskable safe zone (inner 80%)
for (const [name, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]]) {
  writeFileSync(`public/${name}`, encodePng(size, render(size)));
  console.log('wrote', name);
}
