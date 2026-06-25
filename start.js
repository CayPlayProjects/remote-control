const { exec } = require('child_process');
const path = require('path');

console.log('=== Starting Remote Control ===\n');

// Start server
console.log('Starting server...');
const server = exec('node server/index.js', {
  cwd: __dirname
});

server.stdout.on('data', (data) => {
  console.log(`[Server] ${data.trim()}`);
});

server.stderr.on('data', (data) => {
  console.error(`[Server Error] ${data.trim()}`);
});

// Start agent after a short delay
setTimeout(() => {
  console.log('\nStarting agent...');
  const agent = exec('node agent.js', {
    cwd: __dirname
  });

  agent.stdout.on('data', (data) => {
    console.log(`[Agent] ${data.trim()}`);
  });

  agent.stderr.on('data', (data) => {
    console.error(`[Agent Error] ${data.trim()}`);
  });
}, 2000);

console.log('\nPress Ctrl+C to stop both server and agent');

process.on('SIGINT', () => {
  console.log('\nShutting down...');
  server.kill();
  process.exit(0);
});
