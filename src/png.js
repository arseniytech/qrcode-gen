// Minimal PNG writer: grayscale (bit depth 1) with a quiet zone around the
// symbol. Scale lets the CLI produce bigger images without resampling.
import { deflateSync } from 'node:zlib';

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const out = Buffer.alloc(8 + data.length + 4);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

// matrix: 0/1 grid, quiet: border modules, scale: pixels per module.
export function toPng(matrix, { quiet = 4, scale = 4 } = {}) {
  if (!(scale >= 1)) throw new Error('scale must be >= 1');

  const n = matrix.length;
  const size = (n + quiet * 2) * scale;

  // 1-bit rows, each prefixed with a 0 filter byte.
  const raw = Buffer.alloc(size * (1 + Math.ceil(size / 8)));
  const bytesPerRow = Math.ceil(size / 8);

  for (let py = 0; py < size; py++) {
    const rowStart = py * (1 + bytesPerRow);
    raw[rowStart] = 0; // filter: none

    const moduleRow = Math.floor(py / scale) - quiet;
    for (let px = 0; px < size; px++) {
      const moduleCol = Math.floor(px / scale) - quiet;
      const dark =
        moduleRow >= 0 && moduleRow < n && moduleCol >= 0 && moduleCol < n
          ? matrix[moduleRow][moduleCol] === 1
          : 0;
      if (dark) raw[rowStart + 1 + Math.floor(px / 8)] |= 0x80 >> (px % 8);
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 1; // bit depth
  ihdr[9] = 0; // color type: grayscale
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}