#!/usr/bin/env node
const { spawn } = require('child_process');

const name = process.env.SUBQUERY_NAME || 'remitchain-indexer';
const port = process.env.SUBQUERY_QUERY_PORT || '3001';
const args = ['subql-query', '--name', name, '--port', port, ...process.argv.slice(2)];

const quoted = args
  .map((part) => {
    if (/\s/.test(part)) {
      return process.platform === 'win32' ? `"${part.replace(/"/g, '\\"')}"` : `'${part.replace(/'/g, "'\\''")}'`;
    }
    return part;
  })
  .join(' ');

const command =
  process.platform === 'win32'
    ? `set TZ=UTC&& npx ${quoted}`
    : `TZ=UTC npx ${quoted}`;

const child =
  process.platform === 'win32'
    ? spawn('cmd.exe', ['/d', '/s', '/c', command], { stdio: 'inherit' })
    : spawn('sh', ['-lc', command], { stdio: 'inherit' });

child.on('exit', (code) => process.exit(code ?? 1));
child.on('error', (error) => {
  console.error(error.message);
  process.exit(1);
});
