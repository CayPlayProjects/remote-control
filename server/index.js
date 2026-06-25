
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const os = require('os');
const { exec } = require('child_process');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

const PORT = process.env.PORT || 3000;
const AUTH_TOKEN = process.env.AUTH_TOKEN || 'remote-control-secret';

// Store connected devices
const devices = new Map();

// Serve static files
app.use(express.static(path.join(__dirname, '../public')));
app.use(express.json());

// Get device system info
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

// Execute system command
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

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('Connected:', socket.id);

  // Device registration (agent connects)
  socket.on('register', (data) => {
    if (data.token !== AUTH_TOKEN) {
      socket.emit('error', { message: 'Invalid token' });
      return;
    }

    const id = uuidv4();
    devices.set(id, {
      id,
      name: data.name || os.hostname(),
      info: getSystemInfo(),
      socketId: socket.id,
      online: true,
      lastSeen: Date.now()
    });

    socket.deviceId = id;
    socket.emit('registered', { id });
    io.emit('devices', Array.from(devices.values()));
    console.log('Device registered:', data.name);
  });

  // Command from web interface to agent
  socket.on('cmd', async (data) => {
    const device = devices.get(data.deviceId);
    if (!device) {
      socket.emit('cmdResult', { error: 'Device not found' });
      return;
    }

    // Forward command to agent
    io.to(device.socketId).emit('execute', {
      cmdId: data.cmdId,
      command: data.command,
      args: data.args
    });
  });

  // Result from agent
  socket.on('cmdResult', (data) => {
    // Forward result to web interface
    io.emit('cmdResult', data);
  });

  // Device sends system info update
  socket.on('updateInfo', (data) => {
    const device = devices.get(socket.deviceId);
    if (device) {
      device.info = data;
      device.lastSeen = Date.now();
      io.emit('devices', Array.from(devices.values()));
    }
  });

  // Disconnect
  socket.on('disconnect', () => {
    if (socket.deviceId) {
      const device = devices.get(socket.deviceId);
      if (device) {
        device.online = false;
        io.emit('devices', Array.from(devices.values()));
      }
      console.log('Device disconnected:', socket.deviceId);
    }
  });
});

// API endpoints
app.get('/api/devices', (req, res) => {
  res.json(Array.from(devices.values()));
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', devices: devices.size, uptime: process.uptime() });
});

// Start server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n=== Remote Control Server ===`);
  console.log(`Port: ${PORT}`);
  console.log(`Token: ${AUTH_TOKEN}`);
  console.log(`=============================\n`);
});
