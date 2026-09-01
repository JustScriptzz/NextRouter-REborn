#!/usr/bin/env node

const { spawn } = require('child_process');
const PORT = process.env.PORT || 3000;

console.log(`[server-wrapper] Starting Next.js server on port ${PORT}...`);
console.log(`[server-wrapper] NODE_ENV=${process.env.NODE_ENV}`);

const nextServer = spawn('npm', ['run', 'start'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    PORT: String(PORT),
  },
});

setTimeout(() => {
  console.log(`[server-wrapper] Server should be running on port ${PORT}`);
}, 5000);

nextServer.on('error', (err) => {
  console.error(`[server-wrapper] Process error:`, err);
  process.exit(1);
});

nextServer.on('exit', (code) => {
  console.error(`[server-wrapper] Process exited with code ${code}`);
  process.exit(code || 1);
});

process.on('SIGTERM', () => {
  console.log(`[server-wrapper] Received SIGTERM, killing server...`);
  nextServer.kill();
  process.exit(0);
});
