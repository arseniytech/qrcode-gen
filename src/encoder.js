// Turns a string into the data codeword bit stream:
// mode indicator + char count + payload + terminator + padding.

import { countBits, totalDataBits, totalDataCodewords } from './tables.js';

const MODE_INDICATOR = {
  numeric: 0b0001,
  alphanumeric: 0b0010,
  byte: 0b0100,
};

// Character set for the alphanumeric mode (ISO 18004, table 5).
const ALPHANUMERIC = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';

class BitBuffer {
  constructor() {
    this.bits = [];
  }

  push(value, length) {
    for (let i = length - 1; i >= 0; i--) {
      this.bits.push((value >> i) & 1);
    }
  }

  get length() {
    return this.bits.length;
  }
}

function detectMode(text) {
  if (/^\d+$/.test(text)) return 'numeric';
  if ([...text].every((c) => ALPHANUMERIC.includes(c))) return 'alphanumeric';
  return 'byte';
}

function encodeNumeric(text, buf) {
  for (let i = 0; i + 2 < text.length || i < text.length; i += 3) {
    const chunk = text.slice(i, i + 3);
    buf.push(parseInt(chunk, 10), chunk.length * 3 + 1);
  }
}

function encodeAlphanumeric(text, buf) {
  for (let i = 0; i < text.length; i += 2) {
    const pair = text.slice(i, i + 2);
    if (pair.length === 2) {
      buf.push(ALPHANUMERIC.indexOf(pair[0]) * 45 + ALPHANUMERIC.indexOf(pair[1]), 11);
    } else {
      buf.push(ALPHANUMERIC.indexOf(pair[0]), 6);
    }
  }
}

function encodeByte(text, buf) {
  const bytes = new TextEncoder().encode(text);
  for (const b of bytes) buf.push(b, 8);
}

const ENCODERS = {
  numeric: encodeNumeric,
  alphanumeric: encodeAlphanumeric,
  byte: encodeByte,
};

// Returns { bytes: Uint8Array, version, mode } for the smallest fitting version.
export function encode(text, eccLevel, minVersion = 1, maxVersion = 14) {
  const mode = detectMode(text);
  const encoder = ENCODERS[mode];

  let chosen = null;
  for (let version = minVersion; version <= maxVersion; version++) {
    const buf = new BitBuffer();
    buf.push(MODE_INDICATOR[mode], 4);
    buf.push(text.length, countBits(mode, version));
    encoder(text, buf);

    const capacity = totalDataBits(version, eccLevel);
    if (buf.length > capacity) {
      if (version === maxVersion) {
        throw new Error(`text too long for version ${maxVersion} / level ${eccLevel}`);
      }
      continue;
    }

    // Terminator (up to 4 zero bits), then pad to a full byte.
    buf.push(0, Math.min(4, capacity - buf.length));
    while (buf.length % 8 !== 0) buf.push(0, 1);

    const bytes = new Uint8Array(buf.length / 8);
    for (let i = 0; i < buf.length; i += 8) {
      let b = 0;
      for (let j = 0; j < 8; j++) b = (b << 1) | buf.bits[i + j];
      bytes[i / 8] = b;
    }

    // Fill remaining capacity with the 0xEC/0x11 pattern.
    const total = totalDataCodewords(version, eccLevel);
    const padded = new Uint8Array(total);
    padded.set(bytes);
    for (let i = bytes.length; i < total; i++) {
      padded[i] = i % 2 === 0 ? 0xec : 0x11;
    }

    chosen = { bytes: padded, version, mode };
    break;
  }

  return chosen;
}