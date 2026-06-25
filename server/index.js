const express = require('express');
const http = require('http');
const { v4: uuidv4 } = require('uuid');
const os = require('os');
const { exec } = require('child_process');
const path = require('path');

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3000;
const AUTH_TOKEN = process.env.AUTH_TOKEN || 'remote-control-secret';

const devices = new Map();

app.use(express.static(path.join(__dirname, '../public')));
app.use(express.json());

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

// Agent registration
app.post('/api/register', (req, res) => {
  const { token, name, info } = req.body;
  if (token !== AUTH_TOKEN) {
    return res.status(401).json({ error: 'Invalid token' });
  }
  const id = uuidv4();
  devices.set(id, {
    id,
    name: name || 'Unknown',
    info: info || getSystemInfo(),
    online: true,
    lastSeen: Date.now(),
    commands: []
  });
  console.log('Device registered:', name, id);
  res.json({ id });
});

// Agent heartbeat
app.post('/api/heartbeat', (req, res) => {
  const { token, deviceId, info } = req.body;
  if (token !== AUTH_TOKEN) return res.status(401).json({ error: 'Invalid token' });
  const device = devices.get(deviceId);
  if (!device) return res.status(404).json({ error: 'Device not found' });
  device.online = true;
  device.lastSeen = Date.now();
  if (info) device.info = info;
  // Return pending commands
  const cmds = device.commands.splice(0);
  res.json({ commands: cmds });
});

// Agent reports command result
app.post('/api/result', (req, res) => {
  const { token, deviceId, cmdId, ok, output } = req.body;
  if (token !== AUTH_TOKEN) return res.status(401).json({ error: 'Invalid token' });
  console.log(`Result [${cmdId}]: ${ok ? 'OK' : 'FAIL'} - ${output}`);
  res.json({ ok: true });
});

// Web interface: get devices
app.get('/api/devices', (req, res) => {
  const now = Date.now();
  const list = Array.from(devices.values()).map(d => ({
    ...d,
    online: (now - d.lastSeen) < 15000
  }));
  res.json(list);
});

// Web interface: send command
app.post('/api/command', (req, res) => {
  const { deviceId, command, args } = req.body;
  const device = devices.get(deviceId);
  if (!device) return res.status(404).json({ error: 'Device not found' });
  const cmdId = Math.random().toString(36).substr(2, 9);
  device.commands.push({ cmdId, command, args });
  console.log(`Command queued: ${command} for ${device.name}`);
  res.json({ cmdId });
});

// Mark offline devices
setInterval(() => {
  const now = Date.now();
  for (const [id, device] of devices) {
    if ((now - device.lastSeen) > 30000) {
      device.online = false;
    }
  }
}, 10000);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n=== Remote Control Server ===`);
  console.log(`Port: ${PORT}`);
  console.log(`Token: ${AUTH_TOKEN}`);
  console.log(`=============================\n`);
});
