# qrcode-gen

A QR code generator written from scratch — no libraries, no dependencies, just the ISO/IEC 18004 spec and Node's standard library.

It turns your text into a real, scannable QR code: bit stuffing, Reed-Solomon error correction over GF(256), mask selection by penalty scoring, and its own 1-bit PNG encoder.

## Why

Most people `npm install qrcode` and move on. The fun part of the format lives underneath: Galois field arithmetic, BCH error-correcting codes, interleaving codeword blocks, and picking the least-penalty masking pattern out of eight candidates. This repo does all of it by hand, with each step isolated into a small module.

## Usage

### CLI

```sh
qrgen "hello world" -o hello.png
qrgen "https://github.com/arseniytech" -e H -s 8 -o link.png
```

```
Usage: qrgen <text> [options]

Options:
  -o, --output <file>   output PNG path (default: qr.png)
  -e, --ecc <level>     error correction level: L, M, Q, H (default: M)
  -s, --scale <n>       module size in pixels (default: 4)
  -v, --min-version <n> smallest QR version to use (default: 1)
  -h, --help            show this help
```

### Library

```js
import { generate, toPngBuffer } from 'qrcode-gen';

const { matrix, version, eccLevel, mask } = generate('hello', { eccLevel: 'M' });
const png = toPngBuffer(matrix, { scale: 4, quiet: 4 });
```

`generate()` returns the module matrix plus metadata, `toPngBuffer()` renders it to a PNG. No canvas, no DOM, no native bindings — it runs anywhere Node does.

### Live demo

```sh
npm run demo
# → http://localhost:3000
```

The demo generates codes in the browser by bundling the same source untouched — the generator is environment-agnostic.

## How it works

```
text
  │  encoder.js — mode detection (numeric / alphanumeric / byte),
  │               bit stream, padding to capacity
  ▼
data codewords
  │  reed-solomon.js — GF(256) tables for α=2 mod 0x11D, generator
  │               polynomial, synthetic-division RS encoding
  ▼
data + EC codewords
  │  matrix.js — codeword block interleaving, function patterns
  │               (finders, timing, alignment, format/version info),
  │               zigzag placement into the module matrix
  ▼
module matrix
  │  mask.js — 8 mask patterns, penalty scoring (N1–N4), best wins
  ▼
masked matrix
  │  png.js — 1-bit grayscale PNG writer with its own CRC-32
  ▼
qr.png
```

### Bits worth reading

- `src/reed-solomon.js` — the whole of GF(256) fits in ~50 lines: log/antilog tables, `gfMul`, generator polynomial as the product of `(x − αⁱ)`, and encoding via polynomial division with coefficients applied in reverse order. This was the finickiest part to get right.
- `src/matrix.js` — format string built by BCH-coding 5 bits against generator `10100110111` and XORing the 15-bit mask `101010000010010`; three copies placed around the finders plus the dark module. Version info (≥ v7) is the 18-bit Golay-coded variant.
- `src/mask.js` — the four ISO penalty rules: run-length, 2×2 blocks, the `1011101` finder-like pattern, and dark-module proportion.
- `src/png.js` — writes a valid PNG by hand: IHDR, a `zlib.deflateSync`-compressed IDAT, its own CRC-32 implementation. No image library involved.

## Verification

The generator is cross-checked against:

- [Thonky's QR tutorial](https://www.thonky.com/qr-code-tutorial/) worked examples (1-M and 5-Q error correction codewords match byte-for-byte, including interleaving)
- a pixel-level diff against the tutorial's reference `1-Q "HELLO WORLD"` image — function patterns match exactly
- `jsQR`, a third-party decoder, which successfully decodes generated codes across versions 1–11, all four error correction levels, and all three encoding modes

## Versions

Supports QR versions 1–14 (21–73 modules), modes numeric/alphanumeric/byte, and all four error correction levels. Successfully scanned with jsQR and rendered with 1-bit PNG output.

## License

MIT