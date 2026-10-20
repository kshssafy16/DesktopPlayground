'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
const start = source.indexOf('function createTaskbarWatchStderrLogger(');
const end = source.indexOf('\nfunction startTaskbarOrderWatcher()', start);
assert.ok(start >= 0 && end > start, 'watcher stderr logger exists');
const createLogger = vm.runInNewContext(`(${source.slice(start, end).trim()})`);

function logged(chunks, flush = true) {
  const messages = [];
  const logger = createLogger(message => messages.push(message));
  for (const chunk of chunks) logger.write(Buffer.from(chunk));
  if (flush) logger.flush();
  return messages;
}

assert.deepEqual(logged(['#< CLIXML\r\n']), []);
assert.deepEqual(logged(['#< C', 'LIXML\r', '\n']), []);
assert.deepEqual(logged(['#< CLIXML']), []);
assert.deepEqual(logged(['#< CLIXML\r\n<Objs><S>Error</S></Objs>\r\n']),
  ['<Objs><S>Error</S></Objs>']);
assert.deepEqual(logged(['#< CLIXML\n', 'PowerShell exception']), ['PowerShell exception']);
assert.deepEqual(logged(['Could not subscribe to Windows z-order events\n']),
  ['Could not subscribe to Windows z-order events']);
console.log('PASS: watcher stderr ignores only a standalone CLIXML header');
