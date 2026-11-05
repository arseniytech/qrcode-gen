// Builds the raw matrix: function patterns first, then the data codewords
// placed in zigzag order, then format/version info.

import {
  ALIGNMENT_POSITIONS,
  ECC,
  LEVEL_BITS,
  MATRIX_SIZE,
} from './tables.js';
import { rsEncode } from './reed-solomon.js';

// --- BCH helpers ------------------------------------------------

// 15-bit format string: 5 data bits, BCH(15,5) with generator 0x537, XOR 0x5412.
export function formatString(eccLevel, maskId) {
  const data = (LEVEL_BITS[eccLevel] << 3) | maskId;
  let rem = data << 10;
  for (let i = 14; i >= 10; i--) {
    if ((rem >> i) & 1) rem ^= 0x537 << (i - 10);
  }
  return ((data << 10) | rem) ^ 0x5412;
}

// 18-bit version string (used for version >= 7): 6 data bits, BCH(18,6) with 0x1F25.
export function versionString(version) {
  let rem = version << 12;
  for (let i = 17; i >= 12; i--) {
    if ((rem >> i) & 1) rem ^= 0x1f25 << (i - 12);
  }
  return (version << 12) | rem;
}

// --- Function patterns ------------------------------------------

function drawFinder(matrix, row, col) {
  // 7x7 finder plus a one-module light separator ring around it.
  for (let r = -1; r <= 7; r++) {
    for (let c = -1; c <= 7; c++) {
      const rr = row + r;
      const cc = col + c;
      if (rr < 0 || rr >= matrix.length || cc < 0 || cc >= matrix.length) continue;

      const inFinder = r >= 0 && r <= 6 && c >= 0 && c <= 6;
      if (!inFinder) {
        matrix[rr][cc] = 0; // separator
        continue;
      }
      const border = r === 0 || r === 6 || c === 0 || c === 6;
      const ring = r >= 2 && r <= 4 && c >= 2 && c <= 4;
      matrix[rr][cc] = border || ring ? 1 : 0;
    }
  }
}

function drawTiming(matrix) {
  for (let i = 8; i < matrix.length - 8; i++) {
    matrix[6][i] = i % 2 === 0 ? 1 : 0;
    matrix[i][6] = i % 2 === 0 ? 1 : 0;
  }
}

function drawAlignment(matrix, version) {
  const centers = ALIGNMENT_POSITIONS[version];
  for (const row of centers) {
    for (const col of centers) {
      // Skip patterns that would overlap the finder modules.
      const corner = (row < 9 && col < 9) ||
        (row < 9 && col > matrix.length - 10) ||
        (row > matrix.length - 10 && col < 9);
      if (corner) continue;

      for (let r = -2; r <= 2; r++) {
        for (let c = -2; c <= 2; c++) {
          const ring = Math.max(Math.abs(r), Math.abs(c)) === 2;
          const center = r === 0 && c === 0;
          matrix[row + r][col + c] = ring || center ? 1 : 0;
        }
      }
    }
  }
}

function drawFormat(matrix, eccLevel, maskId) {
  const size = matrix.length;
  const bits = formatString(eccLevel, maskId);
  const bit = (i) => (bits >> i) & 1;

  // Copy 1 — around the top-left finder.
  for (let i = 0; i <= 5; i++) matrix[8][i] = bit(14 - i);
  matrix[8][7] = bit(8);
  matrix[8][8] = bit(7);
  matrix[7][8] = bit(6);
  for (let i = 0; i <= 5; i++) matrix[i][8] = bit(i);

  // Copy 2 — under the top-right finder (row 8 only).
  for (let i = 0; i <= 7; i++) matrix[8][size - 1 - i] = bit(i);

  // Copy 3 — right of the bottom-left finder.
  for (let i = 0; i <= 6; i++) matrix[size - 1 - i][8] = bit(14 - i);

  // Fixed dark module.
  matrix[size - 8][8] = 1;
}

function drawVersion(matrix, version) {
  if (version < 7) return;

  const size = matrix.length;
  const bits = versionString(version);

  // Bottom-left 3x6 block.
  for (let j = 0; j < 6; j++) {
    for (let i = 0; i < 3; i++) {
      matrix[size - 11 + i][j] = (bits >> (j * 3 + i)) & 1;
    }
  }

  // Top-right 6x3 block.
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 3; j++) {
      matrix[i][size - 11 + j] = (bits >> (i * 3 + j)) & 1;
    }
  }
}

function drawReserved(matrix, version) {
  const size = matrix.length;
  for (const [row, col] of reservedPositions(size, version)) {
    if (matrix[row][col] === null) matrix[row][col] = 0;
  }
}

function reservedPositions(size, version) {
  const pos = [];

  // Format areas (corners).
  for (let i = 0; i < 8; i++) {
    pos.push([8, i], [i, 8], [8, size - 1 - i]);
    if (i < 7) pos.push([size - 1 - i, 8]);
  }

  // Always-dark module.
  pos.push([size - 8, 8]);

  // Version info areas: 3x6 bottom-left, 6x3 top-right (v7+).
  if (version >= 7) {
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 6; j++) {
        pos.push([size - 11 + i, j], [j, size - 11 + i]);
      }
    }
  }

  return pos;
}

// --- Data placement ----------------------------------------------

// Split data into blocks, RS-encode each, then interleave:
// all data codewords block by block, then all EC codewords block by block.
function buildBlocks(dataBytes, version, eccLevel) {
  const { ec, groups } = ECC[version][eccLevel];
  const blocks = [];
  let offset = 0;
  for (const [count, perBlock] of groups) {
    for (let i = 0; i < count; i++) {
      const data = dataBytes.slice(offset, offset + perBlock);
      blocks.push({ data, ec: rsEncode(data, ec) });
      offset += perBlock;
    }
  }
  return blocks;
}

function placeData(matrix, blocks) {
  const size = matrix.length;
  // Interleave: take one codeword from each block in turn (column-major),
  // like the spec's 5-Q example. Longer trailing codewords go last.
  const interleave = (key) => {
    const list = blocks.map((b) => b[key]);
    const longest = Math.max(...list.map((l) => l.length));
    const out = [];
    for (let i = 0; i < longest; i++) {
      for (const l of list) {
        if (i < l.length) out.push(l[i]);
      }
    }
    return out;
  };
  const data = [...interleave('data'), ...interleave('ec')];

  const isData = [];
  let bitIndex = 0;
  // Zigzag: column pairs from the right, direction flips each pair.
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col--; // skip the vertical timing column

    const upward = ((size - 1 - col) / 2) % 2 === 0;
    for (let i = 0; i < size; i++) {
      const row = upward ? size - 1 - i : i;
      for (let j = 0; j < 2; j++) {
        const c = col - j;
        if (matrix[row][c] !== null) continue;
        const byte = bitIndex >> 3;
        const bit = 7 - (bitIndex & 7);
        matrix[row][c] = byte >= data.length ? 0 : (data[byte] >> bit) & 1;
        isData.push([row, c]);
        bitIndex++;
      }
    }
  }
  return isData;
}

// --- Entry point -------------------------------------------------

export function buildMatrix(dataBytes, version, eccLevel, maskId) {
  const size = MATRIX_SIZE(version);
  const matrix = Array.from({ length: size }, () => new Array(size).fill(null));
  const blocks = buildBlocks(dataBytes, version, eccLevel);

  drawFinder(matrix, 0, 0);
  drawFinder(matrix, 0, size - 7);
  drawFinder(matrix, size - 7, 0);
  drawTiming(matrix);
  drawAlignment(matrix, version);
  drawReserved(matrix, version);
  drawFormat(matrix, eccLevel, maskId);
  drawVersion(matrix, version);
  const isData = placeData(matrix, blocks);

  return { matrix, isData };
}