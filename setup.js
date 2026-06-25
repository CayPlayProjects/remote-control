const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const CONFIG_FILE = path.join(__dirname, '.env');

function setupEnv() {
  const envContent = `
# Server Configuration
PORT=3000
DEVICE_TOKEN=my-secret-token-123

# Remote Access (choose one)
# Option 1: Cloudflare Tunnel (recommended)
# CLOUDFLARE_TOKEN=your-cloudflare-token

# Option 2: ngrok
# NGROK_TOKEN=your-ngrok-token

# Option 3: Direct IP (if you have public IP)
# PUBLIC_IP=your-public-ip
`.trim();

  if (!fs.existsSync(CONFIG_FILE)) {
    fs.writeFileSync(CONFIG_FILE, envContent);
    console.log('Created .env file. Please configure it.');
  }
}

function checkDependencies() {
  console.log('Checking dependencies...');
  
  const packages = ['express', 'socket.io', 'uuid', 'socket.io-client'];
  
  packages.forEach(pkg => {
    try {
      require.resolve(pkg);
      console.log(`✓ ${pkg}`);
    } catch (e) {
      console.log(`✗ ${pkg} - Installing...`);
      exec(`npm install ${pkg}`, (err) => {
        if (err) {
          console.error(`Failed to install ${pkg}:`, err.message);
        } else {
          console.log(`✓ ${pkg} installed`);
        }
      });
    }
  });
}

function startServer() {
  console.log('\nStarting server...');
  const server = exec('node server/index.js');
  
  server.stdout.on('data', (data) => {
    console.log(`[Server] ${data}`);
  });
  
  server.stderr.on('data', (data) => {
    console.error(`[Server Error] ${data}`);
  });
}

function startAgent() {
  console.log('\nStarting agent...');
  const agent = exec('node agent.js');
  
  agent.stdout.on('data', (data) => {
    console.log(`[Agent] ${data}`);
  });
  
  agent.stderr.on('data', (data) => {
    console.error(`[Agent Error] ${data}`);
  });
}

console.log('=== Remote Control Setup ===\n');

setupEnv();
checkDependencies();

console.log('\n=== Setup Complete ===');
console.log('\nTo run:');
console.log('1. Server only: node server/index.js');
console.log('2. Agent only: node agent.js');
console.log('3. Both: node start.js');
console.log('\nFor remote access, see README.md');
