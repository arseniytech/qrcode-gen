// Mask selection: applies all 8 masks, scores each, picks the best one.
// Masking only touches data modules — function patterns are never flipped.

const MASKS = [
  (r, c) => (r + c) % 2 === 0,
  (r, c) => r % 2 === 0,
  (r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

export function applyMask(matrix, maskId, isData) {
  const mask = MASKS[maskId];
  for (const [r, c] of isData) {
    if (mask(r, c)) matrix[r][c] ^= 1;
  }
}

// --- Penalty scoring (ISO 18004, 8.8.2) ---------------------------

function scoreRuns(line) {
  let score = 0;
  let run = 1;
  for (let i = 1; i < line.length; i++) {
    if (line[i] === line[i - 1]) {
      run++;
    } else {
      if (run >= 5) score += 3 + (run - 5);
      run = 1;
    }
  }
  if (run >= 5) score += 3 + (run - 5);
  return score;
}

function scoreFinderPatterns(line) {
  // Finder-like sequence 1,0,1,1,1,0,1 with 4+ light modules on one side.
  let score = 0;
  for (let i = 0; i <= line.length - 11; i++) {
    if (line.slice(i, i + 7).join('') !== '1011101') continue;
    const leading = i >= 4 && line.slice(i - 4, i).every((b) => b === 0);
    const trailing = line.slice(i + 7, i + 11).every((b) => b === 0);
    if (leading || trailing) score += 40;
  }
  return score;
}

export function penalty(matrix) {
  const size = matrix.length;
  let score = 0;

  // N1: runs of 5+ modules of the same color.
  for (const row of matrix) score += scoreRuns(row);
  for (let c = 0; c < size; c++) {
    const col = [];
    for (let r = 0; r < size; r++) col.push(matrix[r][c]);
    score += scoreRuns(col);
  }

  // N2: 2x2 blocks of the same color.
  for (let r = 0; r < size - 1; r++) {
    for (let c = 0; c < size - 1; c++) {
      const v = matrix[r][c];
      if (matrix[r][c + 1] === v && matrix[r + 1][c] === v && matrix[r + 1][c + 1] === v) {
        score += 3;
      }
    }
  }

  // N3: finder-like patterns.
  for (const row of matrix) score += scoreFinderPatterns(row);
  for (let c = 0; c < size; c++) {
    const col = [];
    for (let r = 0; r < size; r++) col.push(matrix[r][c]);
    score += scoreFinderPatterns(col);
  }

  // N4: proportion of dark modules vs 50%.
  let dark = 0;
  for (const row of matrix) {
    for (const v of row) if (v === 1) dark++;
  }
  const percent = (dark * 100) / (size * size);
  score += Math.floor(Math.abs(percent - 50) / 5) * 10;

  return score;
}