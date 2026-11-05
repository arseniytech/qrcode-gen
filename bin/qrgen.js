#!/usr/bin/env node
// qrgen — CLI for qrcode-gen.
// Usage:
//   qrgen "hello"                     -> qr.png
//   qrgen "hello" -o out.png -e H -s 8

import { writeFileSync } from 'node:fs';
import { generate, toPngBuffer } from '../src/index.js';

const args = process.argv.slice(2);

function usage() {
  console.log(`usage: qrgen <text> [-o out.png] [-e L|M|Q|H] [-s scale] [-v min-version]`);
  process.exit(1);
}

if (args.length === 0) usage();

const text = args[0];
const opts = {
  eccLevel: 'M',
  scale: 4,
  minVersion: 1,
  out: 'qr.png',
};

for (let i = 1; i < args.length; i++) {
  const flag = args[i];
  const value = args[i + 1];
  if (value === undefined) usage();
  switch (flag) {
    case '-o': opts.out = value; break;
    case '-e': opts.eccLevel = value; break;
    case '-s': opts.scale = parseInt(value, 10); break;
    case '-v': opts.minVersion = parseInt(value, 10); break;
    default: usage();
  }
  i++;
}

try {
  const qr = generate(text, opts);
  const png = toPngBuffer(qr.matrix, { scale: opts.scale });
  writeFileSync(opts.out, png);
  console.log(
    `wrote ${opts.out} (version ${qr.version}, level ${qr.eccLevel}, mode ${qr.mode}, mask ${qr.mask}, ${qr.modules}x${qr.modules})`
  );
} catch (err) {
  console.error(`error: ${err.message}`);
  process.exit(1);
}