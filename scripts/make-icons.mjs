// Generates PNG icons (roulette disc + book) with a minimal PNG encoder. Run: node scripts/make-icons.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

const COLORS = ['#e6194b', '#f58231', '#ffe119', '#3cb44b', '#42d4f4', '#4363d8', '#911eb4', '#f032e6'];
const BG = '#120c26';
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

// Book in unit coords (centered at 0,0, disc radius 1): two open pages + spine.
function bookCoverage(x, y) {
  const inRect = (x0, y0, x1, y1) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
  const spine = inRect(-0.025, -0.3, 0.025, 0.3);
  const pageL = inRect(-0.4, -0.28, -0.04, 0.28);
  const pageR = inRect(0.04, -0.28, 0.4, 0.28);
  return spine || pageL || pageR;
}

function render(size, { disc = 0.46 } = {}) {
  const buf = Buffer.alloc(size * size * 3);
  const SS = 3;
  const bg = hex(BG);
  const R = size * disc;
  const hub = 0.62; // book backing disc radius (unit)
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const dx = (px + (sx + 0.5) / SS - size / 2) / R;
          const dy = (py + (sy + 0.5) / SS - size / 2) / R;
          const d = Math.hypot(dx, dy);
          let c = bg;
          if (d <= 1) {
            const a = (Math.atan2(dy, dx) + Math.PI * 2.5) % (Math.PI * 2);
            c = hex(COLORS[Math.floor((a / (Math.PI * 2)) * 8) % 8]);
            if (d > 0.93) c = hex(BG);
            else if (d <= hub) c = hex(BG);
            if (d <= hub && bookCoverage(dx, dy)) c = [255, 255, 255];
          }
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
// disc 0.46 keeps content within the maskable safe zone (inner 80%)
for (const [name, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]]) {
  writeFileSync(`public/${name}`, encodePng(size, render(size)));
  console.log('wrote', name);
}
