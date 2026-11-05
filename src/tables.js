// Spec tables from ISO/IEC 18004, versions 1-14.
// Cross-checked against Thonky's QR tutorial tables.

// Alignment pattern center coordinates per version (row = column = value).
export const ALIGNMENT_POSITIONS = {
  1: [],
  2: [6, 18],
  3: [6, 22],
  4: [6, 26],
  5: [6, 30],
  6: [6, 34],
  7: [6, 22, 38],
  8: [6, 24, 42],
  9: [6, 26, 46],
  10: [6, 28, 50],
  11: [6, 30, 54],
  12: [6, 32, 58],
  13: [6, 34, 62],
  14: [6, 26, 46, 66],
};

// ECC block structure: { ec, groups: [[blockCount, dataCodewordsPerBlock], ...] }
export const ECC = {
  1: {
    L: { ec: 7, groups: [[1, 19]] },
    M: { ec: 10, groups: [[1, 16]] },
    Q: { ec: 13, groups: [[1, 13]] },
    H: { ec: 17, groups: [[1, 9]] },
  },
  2: {
    L: { ec: 10, groups: [[1, 34]] },
    M: { ec: 16, groups: [[1, 28]] },
    Q: { ec: 22, groups: [[1, 22]] },
    H: { ec: 28, groups: [[1, 16]] },
  },
  3: {
    L: { ec: 15, groups: [[1, 55]] },
    M: { ec: 26, groups: [[1, 44]] },
    Q: { ec: 18, groups: [[2, 17]] },
    H: { ec: 22, groups: [[2, 13]] },
  },
  4: {
    L: { ec: 20, groups: [[1, 80]] },
    M: { ec: 18, groups: [[2, 32]] },
    Q: { ec: 26, groups: [[2, 24]] },
    H: { ec: 16, groups: [[4, 9]] },
  },
  5: {
    L: { ec: 26, groups: [[1, 108]] },
    M: { ec: 24, groups: [[2, 43]] },
    Q: { ec: 18, groups: [[2, 15], [2, 16]] },
    H: { ec: 22, groups: [[2, 11], [2, 12]] },
  },
  6: {
    L: { ec: 18, groups: [[2, 68]] },
    M: { ec: 16, groups: [[4, 27]] },
    Q: { ec: 24, groups: [[4, 19]] },
    H: { ec: 28, groups: [[4, 15]] },
  },
  7: {
    L: { ec: 20, groups: [[2, 78]] },
    M: { ec: 18, groups: [[4, 31]] },
    Q: { ec: 18, groups: [[2, 14], [4, 15]] },
    H: { ec: 26, groups: [[4, 13], [1, 14]] },
  },
  8: {
    L: { ec: 24, groups: [[2, 97]] },
    M: { ec: 22, groups: [[2, 38], [2, 39]] },
    Q: { ec: 22, groups: [[4, 18], [2, 19]] },
    H: { ec: 26, groups: [[4, 14], [2, 15]] },
  },
  9: {
    L: { ec: 30, groups: [[2, 116]] },
    M: { ec: 22, groups: [[3, 36], [2, 37]] },
    Q: { ec: 20, groups: [[4, 16], [4, 17]] },
    H: { ec: 24, groups: [[4, 12], [4, 13]] },
  },
  10: {
    L: { ec: 18, groups: [[2, 68], [2, 69]] },
    M: { ec: 26, groups: [[4, 43], [1, 44]] },
    Q: { ec: 24, groups: [[6, 19], [2, 20]] },
    H: { ec: 28, groups: [[6, 15], [2, 16]] },
  },
  11: {
    L: { ec: 20, groups: [[4, 81]] },
    M: { ec: 30, groups: [[1, 50], [4, 51]] },
    Q: { ec: 28, groups: [[4, 22], [4, 23]] },
    H: { ec: 24, groups: [[3, 12], [8, 13]] },
  },
  12: {
    L: { ec: 24, groups: [[2, 92], [2, 93]] },
    M: { ec: 22, groups: [[6, 36], [2, 37]] },
    Q: { ec: 26, groups: [[4, 20], [6, 21]] },
    H: { ec: 28, groups: [[7, 14], [4, 15]] },
  },
  13: {
    L: { ec: 26, groups: [[4, 107]] },
    M: { ec: 28, groups: [[8, 37], [1, 38]] },
    Q: { ec: 24, groups: [[8, 20], [4, 21]] },
    H: { ec: 22, groups: [[12, 11], [4, 12]] },
  },
  14: {
    L: { ec: 30, groups: [[3, 115], [1, 116]] },
    M: { ec: 24, groups: [[4, 40], [5, 41]] },
    Q: { ec: 20, groups: [[11, 16], [5, 17]] },
    H: { ec: 24, groups: [[11, 12], [5, 13]] },
  },
};

// Unused matrix bits that are left as zero after data placement.
export const REMAINDER_BITS = {
  1: 0, 2: 7, 3: 7, 4: 7, 5: 7, 6: 7,
  7: 0, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0, 13: 0,
  14: 3,
};

export const MATRIX_SIZE = (version) => 17 + 4 * version;

export const LEVELS = ['L', 'M', 'Q', 'H'];

// Two-bit EC level indicator used inside the 15-bit format string.
export const LEVEL_BITS = { L: 1, M: 0, Q: 3, H: 2 };

// Total number of data codewords available for a version and EC level.
export function totalDataCodewords(version, level) {
  return ECC[version][level].groups.reduce((sum, [count, data]) => sum + count * data, 0);
}

export function totalCodewords(version, level) {
  const { ec, groups } = ECC[version][level];
  const data = groups.reduce((sum, [count, per]) => sum + count * per, 0);
  const blocks = groups.reduce((sum, [count]) => sum + count, 0);
  return data + blocks * ec;
}

export function totalDataBits(version, level) {
  return totalDataCodewords(version, level) * 8;
}

// Bit length of the character count field, grouped by version range.
export const COUNT_BITS = {
  numeric: [10, 12, 14],
  alphanumeric: [9, 11, 13],
  byte: [8, 16, 16],
};

export function countBits(mode, version) {
  const group = version <= 9 ? 0 : version <= 26 ? 1 : 2;
  return COUNT_BITS[mode][group];
}