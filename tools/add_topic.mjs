#!/usr/bin/env node
// Add a trivia topic tile to web/index.html from a JSON spec, deterministically.
// Usage:  node tools/add_topic.mjs <spec.json> [--force]
//
// Spec shape:
// {
//   "id": "vinny-biology",                 // lowercase slug, unique topic id
//   "name": "Vinny's Biology Test",        // tile + quiz title
//   "icon": "biotech",                     // Material Symbols name
//   "accent": "#276a2c",                   // #rrggbb, dark enough for white text
//   "tiers":      [6 level names],         // beginner -> top
//   "tiersShort": [6 short labels],        // for the stat tile
//   "blurbs":     [6 level-up blurbs],
//   "questions":  [ { "q": "...", "options": ["correct","w","w","w"], "correct": 0, "d": 1..4 }, ... ]
// }
//
// Idempotent: if a topic with that id already exists it SKIPS (exit 0) unless the
// file genuinely needs it. Validates structure before touching the file; on any
// problem it exits non-zero and changes nothing.
import fs from 'node:fs';
import path from 'node:path';

const HTML = path.resolve('web/index.html');
const specPath = process.argv[2];
const FORCE = process.argv.includes('--force');
if (!specPath) { console.error('usage: node tools/add_topic.mjs <spec.json> [--force]'); process.exit(2); }

const fail = m => { console.error('ERROR: ' + m); process.exit(1); };
let spec;
try { spec = JSON.parse(fs.readFileSync(specPath, 'utf8')); } catch (e) { fail('cannot parse spec JSON: ' + e.message); }

const slug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
if (!spec.id || !slug.test(spec.id)) fail('id must be a lowercase slug (a-z 0-9 and dashes)');
if (!spec.name || typeof spec.name !== 'string') fail('name required');
if (spec.name.includes('"')) fail('name must not contain a double-quote');
if (!spec.icon || !/^[a-z0-9_]+$/.test(spec.icon)) fail('icon must be a Material Symbols name');
if (!/^#[0-9a-fA-F]{6}$/.test(spec.accent || '')) fail('accent must be #rrggbb');
for (const k of ['tiers', 'tiersShort', 'blurbs']) {
  if (!Array.isArray(spec[k]) || spec[k].length !== 6 || spec[k].some(s => typeof s !== 'string' || !s || s.includes('"')))
    fail(k + ' must be exactly 6 non-empty strings without double-quotes');
}
if (!Array.isArray(spec.questions) || spec.questions.length < 20) fail('need at least 20 questions');

const norm = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const seen = new Set();
const byd = { 1: 0, 2: 0, 3: 0, 4: 0 };
spec.questions.forEach((q, i) => {
  if (!q.q || typeof q.q !== 'string' || q.q.includes('"')) fail('question #' + i + ' bad text or contains a double-quote');
  if (!Array.isArray(q.options) || q.options.length !== 4 || q.options.some(o => typeof o !== 'string' || !o || o.includes('"'))) fail('question #' + i + ' needs 4 plain-text options');
  if (q.correct !== 0) fail('question #' + i + ' correct must be 0 (answer first)');
  if (![1, 2, 3, 4].includes(q.d)) fail('question #' + i + ' d must be 1-4');
  if (new Set(q.options.map(norm)).size !== 4) fail('question #' + i + ' has duplicate options');
  const nq = norm(q.q);
  if (seen.has(nq)) fail('duplicate question: ' + q.q);
  seen.add(nq);
  byd[q.d]++;
});
if (byd[1] < 3 || byd[2] < 3 || byd[3] < 3) fail('need at least 3 questions each at d1, d2 and d3 (got ' + JSON.stringify(byd) + ')');

let html = fs.readFileSync(HTML, 'utf8');
const VAR = spec.id.toUpperCase().replace(/[^A-Z0-9]/g, '_') + '_Q';

const idRe = new RegExp("id:\\s*'" + spec.id.replace(/-/g, '\\-') + "'");
if (idRe.test(html)) { console.log('SKIP: topic id "' + spec.id + '" already exists in web/index.html.'); process.exit(0); }
if (html.includes('const ' + VAR + ' ')) fail('variable ' + VAR + ' already defined');

const J = s => JSON.stringify(s);
const fmtQ = q => '    { q: ' + J(q.q) + ', options: [' + q.options.map(J).join(', ') + '], correct: 0, d: ' + q.d + ' },';
const bankBlock = '  // ' + spec.name + ' (auto-generated from source material).\n'
  + '  const ' + VAR + ' = [\n' + spec.questions.map(fmtQ).join('\n') + '\n  ];\n';

const REG = '  // The topic registry.';
if (!html.includes(REG)) fail('could not find the topic-registry anchor');
html = html.replace(REG, bankBlock + REG);

const group = spec.group === 'fun' ? 'fun' : 'school';   // Drive-sourced test prep defaults to the School group
const entry = "    { id: '" + spec.id + "', name: " + J(spec.name) + ", icon: '" + spec.icon + "', accent: '" + spec.accent + "', questions: " + VAR + ", group: '" + group + "',\n"
  + '      tiers:      [' + spec.tiers.map(J).join(', ') + '],\n'
  + '      tiersShort: [' + spec.tiersShort.map(J).join(', ') + '],\n'
  + '      blurbs:     [' + spec.blurbs.map(J).join(', ') + '] },\n';

const CLOSE = '  ];\n  const topicById';
if (!html.includes(CLOSE)) fail('could not find the TOPICS closing anchor');
html = html.replace(CLOSE, entry + '  ];\n  const topicById');

fs.writeFileSync(HTML, html);
console.log('ADDED topic "' + spec.id + '" (' + spec.questions.length + ' questions, d1-4=' + [1, 2, 3, 4].map(d => byd[d]).join('/') + ') as ' + VAR);
