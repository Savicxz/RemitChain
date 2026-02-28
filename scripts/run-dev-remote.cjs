#!/usr/bin/env node
/* eslint-disable no-console */
const { spawn } = require('child_process');
const path = require('path');

const root = path.resolve(__dirname, '..');
const ps1 = path.join(root, 'scripts', 'start-dev.ps1');
const sh = path.join(root, 'scripts', 'start-dev.sh');

const extraArgs = process.argv.slice(2);

const isWindows = process.platform === 'win32';

const command = isWindows ? 'powershell' : 'bash';
const args = isWindows
  ? ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ps1, ...extraArgs]
  : [sh, ...extraArgs];

const child = spawn(command, args, {
  cwd: root,
  stdio: 'inherit',
  shell: false,
});

child.on('error', (error) => {
  console.error(`[dev:remote] Failed to start ${command}: ${error.message}`);
  process.exit(1);
});

child.on('close', (code) => {
  process.exit(code ?? 1);
});
