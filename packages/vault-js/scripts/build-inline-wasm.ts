#!/usr/bin/env node
/**
 * @fileoverview Build script for inline WASM embedding
 * 
 * Generates a JavaScript module with the WASM binary embedded as base64.
 * This eliminates the need to copy WASM files at runtime.
 * 
 * Usage:
 *   node scripts/build-inline-wasm.js
 *   node scripts/build-inline-wasm.js --output dist/wasm-inline.js
 * 
 * @module scripts/build-inline-wasm
 * @license Apache-2.0
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface BuildOptions {
  wasmPath: string;
  outputPath: string;
  format: 'esm' | 'cjs' | 'iife';
}

function parseArgs(): BuildOptions {
  const args = process.argv.slice(2);
  
  const options: BuildOptions = {
    wasmPath: path.resolve(__dirname, '../wasm/p47h_wasm_core_bg.wasm'),
    outputPath: path.resolve(__dirname, '../dist/wasm-inline.js'),
    format: 'esm'
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--output':
      case '-o':
        options.outputPath = path.resolve(args[++i]);
        break;
      case '--wasm':
      case '-w':
        options.wasmPath = path.resolve(args[++i]);
        break;
      case '--format':
      case '-f':
        options.format = args[++i] as 'esm' | 'cjs' | 'iife';
        break;
      case '--help':
      case '-h':
        console.log(`
P47H Vault - Inline WASM Builder

Usage: node build-inline-wasm.js [options]

Options:
  -o, --output <path>   Output file path (default: dist/wasm-inline.js)
  -w, --wasm <path>     WASM source file (default: wasm/p47h_wasm_core_bg.wasm)
  -f, --format <type>   Module format: esm, cjs, iife (default: esm)
  -h, --help            Show this help message

Examples:
  node build-inline-wasm.js
  node build-inline-wasm.js -o my-app/wasm.js -f cjs
`);
        process.exit(0);
    }
  }

  return options;
}

function generateInlineModule(wasmBase64: string, format: 'esm' | 'cjs' | 'iife'): string {
  const loadFunction = `
/**
 * Loads the WASM module from embedded base64.
 * No network request required.
 * 
 * @returns Promise<WebAssembly.Module>
 */
async function loadInlineWasm() {
  const binaryString = atob(WASM_BASE64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return WebAssembly.compile(bytes);
}

/**
 * Instantiates the WASM module with imports.
 * 
 * @param imports - WebAssembly import object
 * @returns Promise<WebAssembly.Instance>
 */
async function instantiateInlineWasm(imports = {}) {
  const module = await loadInlineWasm();
  return WebAssembly.instantiate(module, imports);
}
`;

  switch (format) {
    case 'esm':
      return `// @generated - P47H Vault Inline WASM
// SPDX-License-Identifier: Apache-2.0

const WASM_BASE64 = "${wasmBase64}";

${loadFunction}

export { loadInlineWasm, instantiateInlineWasm, WASM_BASE64 };
export default loadInlineWasm;
`;

    case 'cjs':
      return `// @generated - P47H Vault Inline WASM
// SPDX-License-Identifier: Apache-2.0
"use strict";

const WASM_BASE64 = "${wasmBase64}";

${loadFunction}

module.exports = {
  loadInlineWasm,
  instantiateInlineWasm,
  WASM_BASE64,
  default: loadInlineWasm
};
`;

    case 'iife':
      return `// @generated - P47H Vault Inline WASM
// SPDX-License-Identifier: Apache-2.0
(function(global) {
  "use strict";

  const WASM_BASE64 = "${wasmBase64}";

  ${loadFunction}

  global.P47hWasm = {
    loadInlineWasm: loadInlineWasm,
    instantiateInlineWasm: instantiateInlineWasm,
    WASM_BASE64: WASM_BASE64
  };
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
`;
  }
}

async function main(): Promise<void> {
  const options = parseArgs();

  console.log('P47H Vault Inline WASM Builder');
  console.log('==============================');
  console.log(`WASM source: ${options.wasmPath}`);
  console.log(`Output: ${options.outputPath}`);
  console.log(`Format: ${options.format}`);
  console.log('');

  // Read WASM file
  if (!fs.existsSync(options.wasmPath)) {
    console.error(`ERROR: WASM file not found at ${options.wasmPath}`);
    process.exit(1);
  }

  const wasmBuffer = fs.readFileSync(options.wasmPath);
  const wasmBase64 = wasmBuffer.toString('base64');

  console.log(`WASM size: ${wasmBuffer.length} bytes`);
  console.log(`Base64 size: ${wasmBase64.length} bytes (+${Math.round((wasmBase64.length / wasmBuffer.length - 1) * 100)}%)`);
  console.log('');

  // Generate output
  const output = generateInlineModule(wasmBase64, options.format);

  // Ensure output directory exists
  const outputDir = path.dirname(options.outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Write output
  fs.writeFileSync(options.outputPath, output);

  const outputSize = Buffer.byteLength(output);
  console.log(`Generated ${options.outputPath}`);
  console.log(`Output size: ${outputSize} bytes (${(outputSize / 1024).toFixed(1)} KB)`);
  console.log('');
  console.log('✅ Done! Use the generated file in your project:');
  console.log('');
  
  if (options.format === 'esm') {
    console.log(`  import { loadInlineWasm } from './${path.basename(options.outputPath)}';`);
  } else if (options.format === 'cjs') {
    console.log(`  const { loadInlineWasm } = require('./${path.basename(options.outputPath)}');`);
  } else {
    console.log(`  <script src="${path.basename(options.outputPath)}"></script>`);
    console.log('  <script>P47hWasm.loadInlineWasm().then(module => { ... });</script>');
  }
}

main().catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});
