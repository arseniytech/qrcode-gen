// Reed-Solomon error correction over GF(256).
// Primitive polynomial: x^8 + x^4 + x^3 + x^2 + 1 (0x11D).

const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);

let x = 1;
for (let i = 0; i < 255; i++) {
  EXP[i] = x;
  LOG[x] = i;
  x <<= 1;
  if (x & 0x100) x ^= 0x11d;
}
for (let i = 255; i < 512; i++) {
  EXP[i] = EXP[i - 255];
}

export function gfMul(a, b) {
  if (a === 0 || b === 0) return 0;
  return EXP[LOG[a] + LOG[b]];
}

// Generator polynomial: product of (x - alpha^i) for i in [0, degree).
function generatorPoly(degree) {
  // Coefficients stored with index 0 = x^0.
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= gfMul(poly[j], EXP[i]);
      next[j + 1] ^= poly[j];
    }
    poly = next;
  }
  return poly;
}

// Returns `ecLen` error correction codewords for the given data.
export function rsEncode(data, ecLen) {
  const gen = generatorPoly(ecLen);
  const tmp = new Uint8Array(data.length + ecLen);
  tmp.set(data);

  for (let i = 0; i < data.length; i++) {
    const coef = tmp[i];
    if (coef === 0) continue;
    // Gen coefficients are stored ascending (x^0 first) — apply reversed
    // so gen[gen.length - 1] (leading x^degree coeff = 1) cancels tmp[i].
    for (let j = 0; j < gen.length; j++) {
      tmp[i + j] ^= gfMul(gen[gen.length - 1 - j], coef);
    }
  }

  return tmp.slice(data.length);
}