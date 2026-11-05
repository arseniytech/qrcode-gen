// Public API: encode text into a QR code matrix, optionally rendered as PNG.

import { encode } from './encoder.js';
import { buildMatrix } from './matrix.js';
import { applyMask, penalty } from './mask.js';
import { toPng } from './png.js';

export { LEVELS } from './tables.js';

// Generates the best (lowest penalty) matrix for the given text.
export function generate(text, { eccLevel = 'M', minVersion = 1, maxVersion = 14 } = {}) {
  const normalized = eccLevel.toUpperCase();
  if (!['L', 'M', 'Q', 'H'].includes(normalized)) {
    throw new Error(`unknown EC level "${eccLevel}" (use L, M, Q or H)`);
  }

  const { bytes, version, mode } = encode(text, normalized, minVersion, maxVersion);

  let best = null;
  for (let maskId = 0; maskId < 8; maskId++) {
    const { matrix, isData } = buildMatrix(bytes, version, normalized, maskId);
    applyMask(matrix, maskId, isData);
    const score = penalty(matrix);
    if (!best || score < best.score) best = { matrix, score, mask: maskId };
  }

  return {
    matrix: best.matrix,
    version,
    eccLevel: normalized,
    mode,
    mask: best.mask,
    modules: best.matrix.length,
  };
}

export function toPngBuffer(matrix, options) {
  return toPng(matrix, options);
}