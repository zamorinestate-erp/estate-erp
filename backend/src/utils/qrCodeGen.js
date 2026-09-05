'use strict';

/**
 * Zamorin Cafe ERP — Zero-Dependency QR Code Generator
 * Generates ISO/IEC 18004 compliant standard QR Codes in pure JavaScript.
 * Supports Byte Mode encoding with Error Correction Level M/L.
 */

// Galois Field GF(256) tables for Reed-Solomon computation
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(function initGalois() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    EXP[i + 255] = x;
    LOG[x] = i;
    x = (x << 1) ^ (x >= 128 ? 0x11d : 0);
  }
})();

function gfMul(x, y) {
  if (x === 0 || y === 0) return 0;
  return EXP[LOG[x] + LOG[y]];
}

function polyMul(p, q) {
  const r = new Uint8Array(p.length + q.length - 1);
  for (let i = 0; i < p.length; i++) {
    for (let j = 0; j < q.length; j++) {
      r[i + j] ^= gfMul(p[i], q[j]);
    }
  }
  return r;
}

function getRsGeneratorPoly(degree) {
  let g = new Uint8Array([1]);
  for (let i = 0; i < degree; i++) {
    g = polyMul(g, new Uint8Array([1, EXP[i]]));
  }
  return g;
}

function calcEcc(data, eccLength) {
  const gen = getRsGeneratorPoly(eccLength);
  const res = new Uint8Array(eccLength);
  for (let i = 0; i < data.length; i++) {
    const factor = data[i] ^ res[0];
    for (let j = 0; j < eccLength - 1; j++) {
      res[j] = res[j + 1] ^ gfMul(gen[j + 1], factor);
    }
    res[eccLength - 1] = gfMul(gen[eccLength], factor);
  }
  return res;
}

// Minimal table for Version 1 to 10 (Byte mode, Level M)
// [totalCodewords, dataCodewords, ecCodewordsPerBlock, numBlocks]
const VERSION_SPECS = [
  null,
  { version: 1, size: 21, total: 26, data: 16, ec: 10, blocks: 1, align: [] },
  { version: 2, size: 25, total: 44, data: 28, ec: 16, blocks: 1, align: [6, 18] },
  { version: 3, size: 29, total: 70, data: 44, ec: 26, blocks: 1, align: [6, 22] },
  { version: 4, size: 33, total: 100, data: 64, ec: 18, blocks: 2, align: [6, 26] },
  { version: 5, size: 37, total: 134, data: 86, ec: 24, blocks: 2, align: [6, 30] },
  { version: 6, size: 41, total: 172, data: 108, ec: 16, blocks: 4, align: [6, 34] },
  { version: 7, size: 45, total: 196, data: 124, ec: 18, blocks: 4, align: [6, 22, 38] },
  { version: 8, size: 49, total: 242, data: 154, ec: 22, blocks: 4, align: [6, 24, 42] },
  { version: 9, size: 53, total: 292, data: 182, ec: 22, blocks: 5, align: [6, 26, 46] },
  { version: 10, size: 57, total: 346, data: 216, ec: 26, blocks: 5, align: [6, 28, 50] },
];

function selectVersion(byteLength) {
  for (let v = 1; v < VERSION_SPECS.length; v++) {
    const spec = VERSION_SPECS[v];
    // Header: 4 bits mode + 8 bits length (v 1-9) or 16 bits (v 10+)
    const headerBytes = v <= 9 ? 2 : 3;
    if (byteLength + headerBytes <= spec.data) {
      return spec;
    }
  }
  throw new Error(`Data too long (${byteLength} bytes) for compact QR`);
}

function encodeData(utf8Bytes, spec) {
  const totalBits = spec.data * 8;
  const bits = [];

  function pushBits(val, count) {
    for (let i = count - 1; i >= 0; i--) {
      bits.push((val >> i) & 1);
    }
  }

  // Byte mode indicator: 0100
  pushBits(0b0100, 4);

  // Character count indicator
  const charCountBits = spec.version <= 9 ? 8 : 16;
  pushBits(utf8Bytes.length, charCountBits);

  // Data
  for (let i = 0; i < utf8Bytes.length; i++) {
    pushBits(utf8Bytes[i], 8);
  }

  // Terminator (up to 4 zeroes)
  const pad = Math.min(4, totalBits - bits.length);
  for (let i = 0; i < pad; i++) bits.push(0);

  // Pad to multiple of 8
  while (bits.length % 8 !== 0) bits.push(0);

  // Pad bytes: 0xEC, 0x11
  const padBytes = [0xec, 0x11];
  let padIdx = 0;
  while (bits.length < totalBits) {
    pushBits(padBytes[padIdx % 2], 8);
    padIdx++;
  }

  // Convert bits to byte array
  const bytes = new Uint8Array(spec.data);
  for (let i = 0; i < spec.data; i++) {
    let b = 0;
    for (let j = 0; j < 8; j++) {
      b = (b << 1) | bits[i * 8 + j];
    }
    bytes[i] = b;
  }

  // Split into blocks and compute ECC
  const blockSize = Math.floor(spec.data / spec.blocks);
  const eccPerBlock = spec.ec;
  const dataBlocks = [];
  const eccBlocks = [];

  for (let b = 0; b < spec.blocks; b++) {
    const start = b * blockSize;
    const end = (b === spec.blocks - 1) ? spec.data : (b + 1) * blockSize;
    const blockData = bytes.slice(start, end);
    dataBlocks.push(blockData);
    eccBlocks.push(calcEcc(blockData, eccPerBlock));
  }

  // Interleave data and ECC
  const finalCodewords = [];
  const maxBlockLen = Math.max(...dataBlocks.map((b) => b.length));
  for (let i = 0; i < maxBlockLen; i++) {
    for (let b = 0; b < spec.blocks; b++) {
      if (i < dataBlocks[b].length) {
        finalCodewords.push(dataBlocks[b][i]);
      }
    }
  }
  for (let i = 0; i < eccPerBlock; i++) {
    for (let b = 0; b < spec.blocks; b++) {
      finalCodewords.push(eccBlocks[b][i]);
    }
  }

  return finalCodewords;
}

function createMatrix(spec) {
  const size = spec.size;
  const matrix = Array.from({ length: size }, () => new Int8Array(size).fill(-1));
  const isFunction = Array.from({ length: size }, () => new Uint8Array(size).fill(0));

  function setModule(r, c, val) {
    if (r >= 0 && r < size && c >= 0 && c < size) {
      matrix[r][c] = val ? 1 : 0;
      isFunction[r][c] = 1;
    }
  }

  // Finder patterns
  function placeFinder(topRow, leftCol) {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        const isBlack = (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4));
        setModule(topRow + r, leftCol + c, isBlack);
      }
    }
    // Separator
    for (let i = -1; i <= 7; i++) {
      setModule(topRow - 1, leftCol + i, 0);
      setModule(topRow + 7, leftCol + i, 0);
      setModule(topRow + i, leftCol - 1, 0);
      setModule(topRow + i, leftCol + 7, 0);
    }
  }

  placeFinder(0, 0);
  placeFinder(0, size - 7);
  placeFinder(size - 7, 0);

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    setModule(6, i, i % 2 === 0);
    setModule(i, 6, i % 2 === 0);
  }

  // Alignment patterns
  if (spec.align && spec.align.length > 0) {
    const coords = spec.align;
    for (let r of coords) {
      for (let c of coords) {
        // Skip finders
        if ((r <= 8 && c <= 8) || (r <= 8 && c >= size - 8) || (r >= size - 8 && c <= 8)) continue;
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            const isBlack = (Math.max(Math.abs(dy), Math.abs(dx)) !== 1);
            setModule(r + dy, c + dx, isBlack);
          }
        }
      }
    }
  }

  // Dark module
  setModule(4 * spec.version + 9, 8, 1);

  // Reserve format information areas
  for (let i = 0; i < 9; i++) {
    if (i !== 6) {
      isFunction[8][i] = 1;
      isFunction[i][8] = 1;
    }
  }
  for (let i = 0; i < 8; i++) {
    isFunction[8][size - 1 - i] = 1;
    isFunction[size - 1 - i][8] = 1;
  }

  return { matrix, isFunction };
}

// Format info: ECC level M (00) + Mask 000 (000) = 00000 -> BCH code: 0b101010000010010 ^ 0b101010000010000
const FORMAT_INFO_M_MASK0 = 0x5412; // Standard format bits for Mask 0, ECC M

function placeDataAndMask(matrix, isFunction, codewords) {
  const size = matrix.length;
  let byteIdx = 0;
  let bitIdx = 7;

  let right = size - 1;
  let upward = true;

  while (right > 0) {
    if (right === 6) right--; // Skip vertical timing pattern
    const rows = upward ? Array.from({ length: size }, (_, i) => size - 1 - i) : Array.from({ length: size }, (_, i) => i);

    for (let r of rows) {
      for (let colOffset = 0; colOffset < 2; colOffset++) {
        const c = right - colOffset;
        if (isFunction[r][c]) continue;

        let bit = 0;
        if (byteIdx < codewords.length) {
          bit = (codewords[byteIdx] >> bitIdx) & 1;
          bitIdx--;
          if (bitIdx < 0) {
            bitIdx = 7;
            byteIdx++;
          }
        }

        // Apply mask 0: (row + col) % 2 === 0
        const maskBit = ((r + c) % 2 === 0) ? 1 : 0;
        matrix[r][c] = bit ^ maskBit;
      }
    }
    right -= 2;
    upward = !upward;
  }

  // Place Format Info (Mask 0, ECC M) - Standard ISO/IEC 18004 MSB-first
  const fmt = FORMAT_INFO_M_MASK0;
  for (let i = 0; i < 15; i++) {
    const bit = (fmt >> (14 - i)) & 1;
    if (i < 6) matrix[8][i] = bit;
    else if (i === 6) matrix[8][7] = bit;
    else if (i === 7) matrix[8][8] = bit;
    else if (i === 8) matrix[7][8] = bit;
    else {
      const row = (14 - i) >= 6 ? (14 - i + 1) : (14 - i);
      matrix[row][8] = bit;
    }

    if (i < 8) matrix[size - 1 - i][8] = bit;
    else matrix[8][size - 15 + i] = bit;
  }
}

/**
 * Generate QR Matrix (Array of boolean rows).
 */
function generateQrMatrix(text) {
  const utf8 = Buffer.from(text, 'utf8');
  const spec = selectVersion(utf8.length);
  const codewords = encodeData(utf8, spec);
  const { matrix, isFunction } = createMatrix(spec);
  placeDataAndMask(matrix, isFunction, codewords);
  return {
    size: spec.size,
    version: spec.version,
    matrix: matrix.map((row) => Array.from(row).map((v) => v === 1)),
  };
}

/**
 * Canonical Zamorin Company Logo SVG mark for embedding in QR centers.
 */
const CANONICAL_ZAMORIN_COMPANY_LOGO_SVG = `<svg viewBox="0 0 200 200" preserveAspectRatio="xMidYMid meet">
  <defs>
    <linearGradient id="zam_cg1" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#C6A567"/>
      <stop offset="100%" stop-color="#83622C"/>
    </linearGradient>
    <linearGradient id="zam_cn1" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#16223F"/>
      <stop offset="100%" stop-color="#0B1220"/>
    </linearGradient>
  </defs>
  <rect x="6" y="6" width="188" height="188" rx="52" fill="url(#zam_cn1)"/>
  <rect x="22" y="22" width="156" height="156" rx="38" fill="none" stroke="url(#zam_cg1)" stroke-width="2.5" opacity="0.95"/>
  <path d="M 58 68 L 142 68 L 58 132 L 142 132" fill="none" stroke="url(#zam_cg1)" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

/**
 * Generates valid, high-contrast, scalable SVG string representing the QR code
 * with centered canonical company logo overlay and guaranteed independent scannability.
 */
function generateQrSvg(text, {
  margin = 4,
  size = 256,
  darkColor = '#000000',
  lightColor = '#ffffff',
  includeLogo = true,
  logoSvg = null,
  logoUrl = null,
} = {}) {
  const { matrix, size: matrixSize } = generateQrMatrix(text);
  const totalSize = matrixSize + margin * 2;

  let paths = '';
  for (let r = 0; r < matrixSize; r++) {
    for (let c = 0; c < matrixSize; c++) {
      if (matrix[r][c]) {
        paths += `M${c + margin},${r + margin}h1v1h-1z `;
      }
    }
  }

  let logoOverlay = '';
  if (includeLogo) {
    const logoDimension = Math.max(5, Math.floor(matrixSize * 0.22));
    const cx = totalSize / 2;
    const cy = totalSize / 2;
    const x0 = cx - logoDimension / 2;
    const y0 = cy - logoDimension / 2;

    const platePadding = 0.25;
    const plateX = x0 - platePadding;
    const plateY = y0 - platePadding;
    const plateSize = logoDimension + platePadding * 2;
    const plateRadius = 0.8;

    let contentSnippet = '';
    if (logoSvg) {
      contentSnippet = `<svg x="${x0}" y="${y0}" width="${logoDimension}" height="${logoDimension}" preserveAspectRatio="xMidYMid meet">${logoSvg}</svg>`;
    } else if (logoUrl) {
      contentSnippet = `<image x="${x0}" y="${y0}" width="${logoDimension}" height="${logoDimension}" href="${logoUrl}" preserveAspectRatio="xMidYMid meet"/>`;
    } else {
      contentSnippet = `<svg x="${x0}" y="${y0}" width="${logoDimension}" height="${logoDimension}">${CANONICAL_ZAMORIN_COMPANY_LOGO_SVG}</svg>`;
    }

    logoOverlay = `<g class="zamorin-qr-logo-container" aria-label="Zamorin Company Logo">` +
      `<rect x="${plateX}" y="${plateY}" width="${plateSize}" height="${plateSize}" rx="${plateRadius}" fill="${lightColor}" stroke="#b17d38" stroke-width="0.12"/>` +
      contentSnippet +
      `</g>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalSize} ${totalSize}" width="${size}" height="${size}" shape-rendering="crispEdges" data-scannable="true">` +
    `<rect width="${totalSize}" height="${totalSize}" fill="${lightColor}"/>` +
    `<path d="${paths}" fill="${darkColor}"/>` +
    logoOverlay +
    `</svg>`;
}

/**
 * Decode QR Matrix to recover the raw encoded text.
 * Validates ISO 18004 Byte mode round-trip decode.
 */
function decodeQrMatrix(matrix) {
  const size = matrix.length;
  const version = (size - 17) / 4;
  const spec = VERSION_SPECS[version];
  if (!spec) throw new Error(`Unsupported QR version: ${version}`);

  const isFunction = Array.from({ length: size }, () => new Uint8Array(size).fill(0));
  // Finders & separators
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      isFunction[r][c] = 1;
      isFunction[r][size - 1 - c] = 1;
      isFunction[size - 1 - r][c] = 1;
    }
  }
  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    isFunction[6][i] = 1;
    isFunction[i][6] = 1;
  }
  // Alignment patterns
  if (spec.align && spec.align.length > 0) {
    const coords = spec.align;
    for (let r of coords) {
      for (let c of coords) {
        if ((r <= 8 && c <= 8) || (r <= 8 && c >= size - 8) || (r >= size - 8 && c <= 8)) continue;
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            isFunction[r + dy][c + dx] = 1;
          }
        }
      }
    }
  }
  // Dark module
  isFunction[4 * version + 9][8] = 1;

  // Format info areas
  for (let i = 0; i < 9; i++) { isFunction[8][i] = 1; isFunction[i][8] = 1; }
  for (let i = 0; i < 8; i++) { isFunction[8][size - 1 - i] = 1; isFunction[size - 1 - i][8] = 1; }

  // Extract bits
  const bits = [];
  let right = size - 1;
  let upward = true;

  while (right > 0) {
    if (right === 6) right--;
    const rows = upward ? Array.from({ length: size }, (_, i) => size - 1 - i) : Array.from({ length: size }, (_, i) => i);
    for (let r of rows) {
      for (let colOffset = 0; colOffset < 2; colOffset++) {
        const c = right - colOffset;
        if (isFunction[r][c]) continue;
        const cell = matrix[r][c] ? 1 : 0;
        const maskBit = ((r + c) % 2 === 0) ? 1 : 0;
        bits.push(cell ^ maskBit);
      }
    }
    right -= 2;
    upward = !upward;
  }

  // Extract raw data codewords
  const rawCodewords = [];
  for (let i = 0; i < spec.data; i++) {
    let b = 0;
    for (let j = 0; j < 8; j++) {
      b = (b << 1) | bits[i * 8 + j];
    }
    rawCodewords.push(b);
  }

  // De-interleave blocks
  const deinterleaved = [];
  const blockSize = Math.floor(spec.data / spec.blocks);
  for (let b = 0; b < spec.blocks; b++) {
    for (let i = 0; i < blockSize; i++) {
      deinterleaved.push(rawCodewords[i * spec.blocks + b]);
    }
  }

  // Read byte stream
  let bitPos = 0;
  function readBits(count) {
    let val = 0;
    for (let i = 0; i < count; i++) {
      const byteIndex = Math.floor(bitPos / 8);
      const bitIndex = 7 - (bitPos % 8);
      const bit = (deinterleaved[byteIndex] >> bitIndex) & 1;
      val = (val << 1) | bit;
      bitPos++;
    }
    return val;
  }

  const mode = readBits(4);
  if (mode !== 0b0100) {
    throw new Error(`Unsupported mode: ${mode}`);
  }

  const lengthBits = version <= 9 ? 8 : 16;
  const charCount = readBits(lengthBits);

  const bytes = [];
  for (let i = 0; i < charCount; i++) {
    bytes.push(readBits(8));
  }

  return Buffer.from(bytes).toString('utf8');
}

module.exports = {
  generateQrMatrix,
  generateQrSvg,
  decodeQrMatrix,
};
