#!/usr/bin/env node
/**
 * Inline the model into the standalone web page.
 *
 * The page runs the *same* model source as the CLI rather than a
 * precomputed table, so every selector combination is reachable and a cell
 * in the browser is reproducible on the command line. Keeping one source of
 * truth is the whole point of this build step.
 *
 * The transform is deliberately narrow: concatenate parameters.js and
 * model.js and report.js in dependency order, drop their `import`
 * statements (everything ends up in one module scope) and drop the `export`
 * keyword. Nothing else is rewritten.
 *
 *   node web/build.js
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

/** Strip module syntax so several files can share one script scope. */
function inlineable(path) {
  return readFileSync(path, 'utf8')
    // Drop import statements, including the multi-line braced form.
    .replace(/^import\s+[\s\S]*?from\s+'[^']+';\s*$/gm, '')
    // `export const X` -> `const X`, `export function f` -> `function f`
    .replace(/^export\s+(const|function|class|let)\b/gm, '$1');
}

const sources = ['src/parameters.js', 'src/model.js', 'src/report.js']
  .map((relative) => `// ===== ${relative} =====\n${inlineable(join(root, relative))}`)
  .join('\n');

const template = readFileSync(join(here, 'template.html'), 'utf8');
if (!template.includes('/* __MODEL_SOURCE__ */')) {
  throw new Error('template.html is missing the /* __MODEL_SOURCE__ */ placeholder');
}

const html = template.replace('/* __MODEL_SOURCE__ */', sources);
const out = join(here, 'index.html');
writeFileSync(out, html);

console.log(`built ${out} (${(html.length / 1024).toFixed(0)} kB, model inlined from source)`);
