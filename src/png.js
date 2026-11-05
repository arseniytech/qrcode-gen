// Minimal PNG writer: grayscale (bit depth 1) with a quiet zone around the
// symbol. Scale lets the CLI produce bigger images without resampling.
//
// Deliberately dependency-free and platform-agnostic: no Buffer, no
// node:zlib. IDAT is wrapped in a stored-deflate zlib stream built by hand,
// so the same code runs in Node and in the browser.

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

// RFC 1950 zlib stream containing RFC 1951 stored (uncompressed) blocks.
// Valid deflate, just not compressed — fine for a QR-sized payload.
function zlibStored(bytes) {
  const len = bytes.length;
  const out = new Uint8Array(len + 6 + Math.ceil(len / 65535) * 5);

  // Adler-32 over the payload.
  let a = 1;
  let b = 0;
  for (let i = 0; i < len; i++) {
    a = (a + bytes[i]) % 65521;
    b = (b + a) % 65521;
  }

  let o = 0;
  out[o++] = 0x78; // CMF: deflate, 32K window
  out[o++] = 0x01; // FLG: FCHECK for 0x78, no dict
  let off = 0;
  while (off < len || off === 0) {
    const blockLen = Math.min(65535, len - off);
    out[o++] = len - off === blockLen ? 0x01 : 0x00; // BFINAL + stored
    out[o++] = blockLen & 0xff;
    out[o++] = blockLen >> 8;
    out[o++] = (~blockLen) & 0xff;
    out[o++] = (~blockLen) >> 8;
    out.set(bytes.subarray(off, off + blockLen), o);
    o += blockLen;
    off += blockLen;
    if (len === 0) break;
  }
  out[o++] = (b >> 8) & 0xff;
  out[o++] = b & 0xff;
  out[o++] = (a >> 8) & 0xff;
  out[o++] = a & 0xff;
  return out;
}

function chunk(type, data) {
  const out = new Uint8Array(8 + (data ? data.length : 0) + 4);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, data ? data.length : 0);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  if (data) out.set(data, 8);
  const body = out.subarray(4, 8 + (data ? data.length : 0));
  dv.setUint32(8 + (data ? data.length : 0), crc32(body));
  return out;
}

// matrix: 0/1 grid, quiet: border modules, scale: pixels per module.
export function toPng(matrix, { quiet = 4, scale = 4 } = {}) {
  if (!(scale >= 1)) throw new Error('scale must be >= 1');

  const n = matrix.length;
  const size = (n + quiet * 2) * scale;

  // 1-bit rows, each prefixed with a 0 filter byte.
  const bytesPerRow = Math.ceil(size / 8);
  const raw = new Uint8Array(size * (1 + bytesPerRow));

  for (let py = 0; py < size; py++) {
    const rowStart = py * (1 + bytesPerRow);
    const moduleRow = Math.floor(py / scale) - quiet;
    for (let px = 0; px < size; px++) {
      const moduleCol = Math.floor(px / scale) - quiet;
      const dark =
        moduleRow >= 0 && moduleRow < n && moduleCol >= 0 && moduleCol < n
          ? matrix[moduleRow][moduleCol] === 1
          : 0;
      if (dark) raw[rowStart + 1 + (px >> 3)] |= 0x80 >> (px & 7);
    }
  }

  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, size);
  dv.setUint32(4, size);
  ihdr[8] = 1; // bit depth
  ihdr[9] = 0; // color type: grayscale
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const idat = zlibStored(raw);
  const parts = [
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', null),
  ];
  const total = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}