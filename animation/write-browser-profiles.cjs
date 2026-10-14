'use strict';
const fs = require('node:fs');
const path = require('node:path');
const target = path.join(__dirname, 'profiles.browser.js');
const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, 'profiles.v1.json'), 'utf8'));
const output = '// Generated from profiles.v1.json; run node animation/write-browser-profiles.cjs.\n'
  + 'globalThis.PlaygroundPetProfiles = ' + JSON.stringify(catalog, null, 2) + ';\n';
if (process.argv.includes('--check')) {
  if (fs.readFileSync(target, 'utf8').replace(/\r\n/g, '\n') !== output) throw new Error('Browser profiles are stale');
  console.log('Browser profiles match canonical JSON: PASS');
} else fs.writeFileSync(target, output);
