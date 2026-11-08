#!/usr/bin/env node
// Anatomy Run security gate. No dependencies. Run: node scripts/security-check.mjs [--fix-csp]
// Fails the build if the page drifts from its security baseline.
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const FILE = 'index.html';
const EXPECTED_UPI = 'jose496@ybl';
const ALLOWED_HOSTS = new Set([
  'fonts.googleapis.com', 'fonts.gstatic.com',          // typefaces (disclosed in privacy policy)
  'www.physio-pedia.com', 'pubmed.ncbi.nlm.nih.gov',     // learning-resource links
  'claude.ai',                                           // Inclusive.Si landing page link
]);
let html = readFileSync(FILE, 'utf8');
const fail = [], ok = [];
const check = (cond, msg) => (cond ? ok : fail).push(msg);

// 1. exactly one inline script, no external scripts
const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
check(scripts.length === 1, `exactly one <script> block (found ${scripts.length})`);
check(scripts.every(m => !/\bsrc\s*=/.test(m[1])), 'no external <script src>');
const js = scripts[0]?.[2] ?? '';

// 2. CSP present and its script hash matches the inline script
const hash = createHash('sha256').update(js, 'utf8').digest('base64');
const cspMatch = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/);
if (process.argv.includes('--fix-csp') && cspMatch) {
  html = html.replace(/'sha256-[A-Za-z0-9+/=]+'/, `'sha256-${hash}'`);
  writeFileSync(FILE, html); console.log(`CSP hash updated to sha256-${hash}`);
}
const csp = (html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/) || [])[1] || '';
check(!!csp, 'Content-Security-Policy meta present');
check(csp.includes(`'sha256-${hash}'`), `CSP script hash matches inline script (run with --fix-csp after editing the script)`);
for (const d of ["default-src 'none'", "object-src 'none'", "base-uri 'none'", "form-action 'none'", "connect-src 'none'"])
  check(csp.includes(d), `CSP has ${d}`);
check(!/script-src[^;]*'unsafe-(inline|eval)'/.test(csp), "CSP script-src has no 'unsafe-inline' / 'unsafe-eval'");

// 3. dangerous sinks / dynamic code
for (const [re, name] of [[/\beval\s*\(/, 'eval('], [/new\s+Function\s*\(/, 'new Function('], [/document\.write/, 'document.write'],
  [/insertAdjacentHTML/, 'insertAdjacentHTML'], [/outerHTML\s*=/, 'outerHTML='], [/setTimeout\s*\(\s*['"`]/, 'string setTimeout'],
  [/\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon/, 'network calls'], [/<[^>]+\son[a-z]+\s*=/i, 'inline on* handler attributes']])
  check(!re.test(name === 'inline on* handler attributes' ? html.replace(js, '') : js), `no ${name}`);
// user-controlled values must never reach innerHTML
check(!/innerHTML[^;]{0,400}(save\.name|fbText|pname)/.test(js), 'player name / feedback text never written via innerHTML');

// 4. external URLs on the allowlist; links isolated
const hosts = new Set([...html.matchAll(/https?:\/\/([a-z0-9.-]+)/gi)].map(m => m[1].toLowerCase())
  .filter(h => h !== 'www.w3.org'));
for (const h of hosts) check(ALLOWED_HOSTS.has(h), `external host allowed: ${h}`);
const blank = [...html.matchAll(/<a\b[^>]*target="_blank"[^>]*>/gi)].map(m => m[0]);
check(blank.every(a => /rel="[^"]*noopener[^"]*noreferrer|rel="[^"]*noreferrer[^"]*noopener/.test(a)), `target=_blank links use rel="noopener noreferrer" (${blank.length})`);
check(!/http:\/\/(?!www\.w3\.org)/.test(html), 'no plain-http URLs');

// 5. secrets
const SECRET_RES = [/AKIA[0-9A-Z]{16}/, /gh[pousr]_[A-Za-z0-9]{36}/, /github_pat_[A-Za-z0-9_]{40,}/, /sk-[A-Za-z0-9]{32,}/,
  /AIza[0-9A-Za-z_-]{35}/, /xox[baprs]-[A-Za-z0-9-]{10,}/, /-----BEGIN [A-Z ]*PRIVATE KEY-----/, /rzp_(live|test)_[A-Za-z0-9]{10,}/];
check(SECRET_RES.every(re => !re.test(html)), 'no API keys, tokens or private keys');

// 6. donation integrity: every UPI deep link pays the expected ID
const upis = [...html.matchAll(/upi:\/\/pay\?pa=([^&"\\]+)/g)].map(m => decodeURIComponent(m[1]));
check(upis.length > 0 && upis.every(u => u === EXPECTED_UPI), `all ${upis.length} UPI links pay ${EXPECTED_UPI}`);
check((html.match(/jose496@ybl/g) || []).length >= upis.length + 1, 'UPI ID also shown as text so donors can verify it');

// 7. anti-clickjacking guard and save sanitiser still present
check(js.includes('window.top!==window.self'), 'frame guard present');
check(js.includes('/* sec: sanitize save */') && js.includes('function cleanName('), 'saved-data sanitiser present');

// 8. installable app files
let swSrc = ''; try { swSrc = readFileSync('sw.js', 'utf8'); } catch {}
check(!!swSrc, 'service worker sw.js present');
check(!/importScripts|eval\s*\(|new\s+Function/.test(swSrc), 'service worker loads no outside code');
check(/https?:\/\//.test(swSrc) === false || [...swSrc.matchAll(/https?:\/\/([a-z0-9.-]+)/gi)].every(m => ALLOWED_HOSTS.has(m[1])), 'service worker contacts only allowed hosts');
let man = {}; try { man = JSON.parse(readFileSync('manifest.webmanifest', 'utf8')); } catch {}
check(man.name === 'Anatomy Run' && man.start_url === './' && (man.icons || []).some(i => i.purpose === 'maskable'), 'web app manifest valid (name, start_url, maskable icon)');
check(csp.includes("worker-src 'self'"), "CSP allows only same-origin service worker");

// 9. script parses
try { const d = mkdtempSync(join(tmpdir(), 'ar-')); writeFileSync(join(d, 'c.js'), js);
  execFileSync(process.execPath, ['--check', join(d, 'c.js')]); ok.push('script parses (node --check)'); }
catch (e) { fail.push('script parses (node --check)'); }

for (const m of ok) console.log('  PASS', m);
for (const m of fail) console.log('  FAIL', m);
console.log(`\n${ok.length} passed, ${fail.length} failed`);
process.exit(fail.length ? 1 : 0);
