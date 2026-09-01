#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;

function runStep(cmd, args, label) {
  return new Promise((resolve) => {
    console.log(`[server-wrapper] ${label}...`);
    const p = spawn(cmd, args, { stdio: 'inherit' });
    p.on('exit', (code) => {
      if (code !== 0) {
        console.error(`[server-wrapper] ${label} exited with code ${code} (continuing anyway)`);
      } else {
        console.log(`[server-wrapper] ${label} done`);
      }
      resolve();
    });
    p.on('error', (err) => {
      console.error(`[server-wrapper] ${label} error:`, err);
      resolve();
    });
  });
}

async function main() {
  const buildDir = path.join(__dirname, '.next');
  if (!fs.existsSync(buildDir)) {
    await runStep('npm', ['run', 'build'], 'Building app');
  }

  if (process.env.DATABASE_URL) {
    // Push drizzle schema to DB (creates tables if missing). Non-interactive.
    await runStep('npx', ['drizzle-kit', 'push', '--force'], 'Pushing DB schema');
  } else {
    console.log('[server-wrapper] No DATABASE_URL set, skipping schema push');
  }

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
}

main();
