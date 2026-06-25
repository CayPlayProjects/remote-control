const { io } = require('socket.io-client');
const os = require('os');
const { exec } = require('child_process');

// Configuration
const SERVER = process.env.SERVER || 'http://localhost:3000';
const TOKEN = process.env.TOKEN || 'remote-control-secret';
const NAME = process.env.NAME || os.hostname();

let socket = null;

function getSystemInfo() {
  const nets = os.networkInterfaces();
  let ip = 'Unknown';
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        ip = net.address;
        break;
      }
    }
  }
  return {
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
    ip,
    uptime: Math.floor(os.uptime()),
    totalMem: Math.floor(os.totalmem() / 1024 / 1024),
    freeMem: Math.floor(os.freemem() / 1024 / 1024),
    cpus: os.cpus().length
  };
}

function runCommand(cmd, args = {}) {
  return new Promise((resolve) => {
    let command = '';

    switch (cmd) {
      case 'open':
        if (os.platform() === 'win32') {
          command = `start "" "${args.path}"`;
        } else if (os.platform() === 'darwin') {
          command = `open "${args.path}"`;
        } else {
          command = `${args.path} &`;
        }
        break;

      case 'browser':
        const url = args.url.startsWith('http') ? args.url : `https://${args.url}`;
        if (os.platform() === 'win32') {
          command = `start "" "${url}"`;
        } else if (os.platform() === 'darwin') {
          command = `open "${url}"`;
        } else {
          command = `xdg-open "${url}"`;
        }
        break;

      case 'shutdown':
        command = os.platform() === 'win32' ? 'shutdown /s /t 0' : 'sudo shutdown -h now';
        break;

      case 'restart':
        command = os.platform() === 'win32' ? 'shutdown /r /t 0' : 'sudo reboot';
        break;

      case 'lock':
        if (os.platform() === 'win32') {
          command = 'rundll32.exe user32.dll,LockWorkStation';
        } else if (os.platform() === 'darwin') {
          command = 'pmset displaysleepnow';
        } else {
          command = 'xdg-screensaver lock';
        }
        break;

      case 'apps':
        if (os.platform() === 'win32') {
          command = 'powershell "Get-ChildItem \'C:\\Program Files\',\'C:\\Program Files (x86)\' -Directory | Select-Object -ExpandProperty Name"';
        } else if (os.platform() === 'darwin') {
          command = 'ls /Applications';
        } else {
          command = 'ls /usr/bin | head -50';
        }
        break;

      case 'shell':
        command = args.command;
        break;

      default:
        resolve({ ok: false, output: 'Unknown command' });
        return;
    }

    exec(command, { timeout: 30000 }, (err, stdout, stderr) => {
      if (err) {
        resolve({ ok: false, output: err.message });
      } else {
        resolve({ ok: true, output: stdout || 'Done' });
      }
    });
  });
}

function connect() {
  console.log(`Connecting to ${SERVER}...`);
  
  socket = io(SERVER, {
    reconnection: true,
    reconnectionDelay: 2000,
    reconnectionAttempts: Infinity
  });

  socket.on('connect', () => {
    console.log('Connected! Registering...');
    socket.emit('register', { token: TOKEN, name: NAME });
  });

  socket.on('registered', (data) => {
    console.log(`Registered as: ${NAME} (ID: ${data.id})`);
    console.log('Waiting for commands...\n');
  });

  socket.on('execute', async (data) => {
    console.log(`Command: ${data.command}`, data.args || '');
    const result = await runCommand(data.command, data.args);
    socket.emit('cmdResult', {
      cmdId: data.cmdId,
      deviceId: socket.id,
      ...result
    });
  });

  socket.on('error', (data) => {
    console.error('Error:', data.message);
  });

  socket.on('disconnect', () => {
    console.log('Disconnected. Reconnecting...');
  });

  socket.on('connect_error', (err) => {
    console.error('Connection error:', err.message);
  });
}

// Periodic info update
setInterval(() => {
  if (socket && socket.connected) {
    socket.emit('updateInfo', getSystemInfo());
  }
}, 30000);

// Start
console.log('=== Remote Control Agent ===');
console.log(`Name: ${NAME}`);
console.log(`Server: ${SERVER}`);
console.log('============================\n');

connect();
