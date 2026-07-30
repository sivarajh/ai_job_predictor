#!/usr/bin/env node
/**
 * Inline the model into the web page.
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
 * Two outputs, because the two hosts differ:
 *
 *   web/index.html   a document *fragment* - no doctype, no <head>. The
 *                    Claude artifact host supplies that skeleton and a CSS
 *                    reset at publish time, and rejects pages that bring
 *                    their own.
 *   site/index.html  a complete standalone document, for GitHub Pages,
 *                    which serves the file exactly as written and so needs
 *                    its own doctype, charset, viewport and reset.
 *
 *   node web/build.js
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

const DESCRIPTION =
  'A scenario model of how AI changes employment by job type, experience level, ' +
  'jurisdiction and year, 2026-2030, measured against a no-AI counterfactual.';

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
const fragmentPath = join(here, 'index.html');
writeFileSync(fragmentPath, html);

/**
 * Wrap the fragment in a real document for GitHub Pages.
 *
 * `<title>` and `<style>` have to be lifted into `<head>` rather than left
 * where they sit: a `<title>` inside `<body>` does not reliably set the
 * document title, which is what a browser tab and a shared link both read.
 */
function standalone(fragment) {
  const title = fragment.match(/<title>([\s\S]*?)<\/title>/);
  const style = fragment.match(/<style>[\s\S]*?<\/style>/);
  const body = fragment
    .replace(/<title>[\s\S]*?<\/title>\s*/, '')
    .replace(/<style>[\s\S]*?<\/style>\s*/, '');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>${title ? title[1] : 'AI Job Impact Predictor'}</title>
<meta name="description" content="${DESCRIPTION}">
<meta property="og:title" content="${title ? title[1] : 'AI Job Impact Predictor'}">
<meta property="og:description" content="${DESCRIPTION}">
<meta property="og:type" content="website">
<style>
  /* The artifact host ships a reset; a raw Pages file does not. */
  *, *::before, *::after { box-sizing: border-box; }
  body { margin: 0; }
  img, svg { max-width: 100%; }
</style>
${style ? style[0] : ''}
</head>
<body>
${body.trim()}
</body>
</html>
`;
}

const siteDir = join(root, 'site');
mkdirSync(siteDir, { recursive: true });
const page = standalone(html);
writeFileSync(join(siteDir, 'index.html'), page);
// Tell Pages to serve the files as-is rather than running them through Jekyll.
writeFileSync(join(siteDir, '.nojekyll'), '');

console.log(`built ${fragmentPath} (${(html.length / 1024).toFixed(0)} kB, model inlined from source)`);
console.log(`built ${join(siteDir, 'index.html')} (${(page.length / 1024).toFixed(0)} kB, standalone document)`);
