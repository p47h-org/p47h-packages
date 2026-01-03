#!/usr/bin/env node

/**
 * P47H Vault JS - Postinstall Helper
 * 
 * This script prints instructions for setting up WASM binaries.
 * It does NOT modify the user's filesystem automatically.
 * 
 * For automatic WASM handling, use the bundler plugins:
 * - @p47h/vault-js/plugins/vite
 * - @p47h/vault-js/plugins/webpack
 */

const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';

console.log(`${CYAN}
╔══════════════════════════════════════════════════════════════╗
║                 P47H VAULT JS - INSTALLED                    ║
╚══════════════════════════════════════════════════════════════╝
${RESET}`);

console.log(`${GREEN}✔ Installation complete!${RESET}

${YELLOW}📦 WASM Setup Options:${RESET}

${CYAN}Option 1: Bundler Plugin (Recommended)${RESET}
  Import the plugin for automatic WASM handling:
  
  ${GREEN}// vite.config.ts${RESET}
  import { p47hVitePlugin } from '@p47h/vault-js/plugins/vite';
  export default { plugins: [p47hVitePlugin()] };

  ${GREEN}// webpack.config.js${RESET}
  const { P47hWebpackPlugin } = require('@p47h/vault-js/plugins/webpack');
  module.exports = { plugins: [new P47hWebpackPlugin()] };

${CYAN}Option 2: Manual Copy${RESET}
  Copy WASM files to your public folder:
  
  ${GREEN}cp node_modules/@p47h/vault-js/wasm/* public/wasm/${RESET}

${CYAN}Documentation:${RESET} https://p47h.com/docs/vault-js
`);