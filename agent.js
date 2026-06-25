const http = require('http');
const https = require('https');
const os = require('os');
const { exec } = require('child_process');

const SERVER = process.env.SERVER || 'http://localhost:3000';
const TOKEN = process.env.TOKEN || 'remote-control-secret';
const NAME = process.env.NAME || os.hostname();

let deviceId = null;

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

function request(path, data) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, SERVER);
    const body = JSON.stringify(data);
    const mod = url.protocol === 'https:' ? https : http;
    const req = mod.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, (res) => {
      let chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString())); }
        catch(e) { resolve({}); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function runCommand(cmd, args = {}) {
  return new Promise((resolve) => {
    let command = '';
    switch (cmd) {
      case 'open':
        if (os.platform() === 'win32') command = `start "" "${args.path}"`;
        else if (os.platform() === 'darwin') command = `open "${args.path}"`;
        else command = `${args.path} &`;
        break;
      case 'browser':
        const url = args.url.startsWith('http') ? args.url : `https://${args.url}`;
        if (os.platform() === 'win32') command = `start "" "${url}"`;
        else if (os.platform() === 'darwin') command = `open "${url}"`;
        else command = `xdg-open "${url}"`;
        break;
      case 'shutdown':
        command = os.platform() === 'win32' ? 'shutdown /s /t 0' : 'sudo shutdown -h now';
        break;
      case 'restart':
        command = os.platform() === 'win32' ? 'shutdown /r /t 0' : 'sudo reboot';
        break;
      case 'lock':
        if (os.platform() === 'win32') command = 'rundll32.exe user32.dll,LockWorkStation';
        else if (os.platform() === 'darwin') command = 'pmset displaysleepnow';
        else command = 'xdg-screensaver lock';
        break;
      case 'apps':
        if (os.platform() === 'win32') command = 'powershell "Get-ChildItem \'C:\\Program Files\',\'C:\\Program Files (x86)\' -Directory | Select-Object -ExpandProperty Name"';
        else if (os.platform() === 'darwin') command = 'ls /Applications';
        else command = 'ls /usr/bin | head -50';
        break;
      case 'shell':
        command = args.command;
        break;
      default:
        resolve({ ok: false, output: 'Unknown command' });
        return;
    }
    exec(command, { timeout: 30000 }, (err, stdout, stderr) => {
      if (err) resolve({ ok: false, output: err.message });
      else resolve({ ok: true, output: stdout || 'Done' });
    });
  });
}

async function register() {
  try {
    const res = await request('/api/register', { token: TOKEN, name: NAME, info: getSystemInfo() });
    if (res.id) {
      deviceId = res.id;
      console.log(`Registered as: ${NAME} (ID: ${deviceId})`);
      return true;
    }
  } catch(e) {}
  return false;
}

async function heartbeat() {
  if (!deviceId) {
    await register();
    return;
  }
  try {
    const res = await request('/api/heartbeat', { token: TOKEN, deviceId, info: getSystemInfo() });
    if (res.commands) {
      for (const cmd of res.commands) {
        console.log(`Command: ${cmd.command}`, cmd.args || '');
        const result = await runCommand(cmd.command, cmd.args);
        console.log(`Result: ${result.ok ? 'OK' : 'FAIL'}`);
        await request('/api/result', { token: TOKEN, deviceId, cmdId: cmd.cmdId, ...result });
      }
    }
  } catch(e) {
    console.log('Connection lost, reconnecting...');
    deviceId = null;
    await register();
  }
}

async function main() {
  console.log('=== Remote Control Agent ===');
  console.log(`Name: ${NAME}`);
  console.log(`Server: ${SERVER}`);
  console.log('============================\n');

  const ok = await register();
  if (!ok) {
    console.log('Failed to register. Retrying in 5s...');
    setInterval(register, 5000);
  }

  setInterval(heartbeat, 2000);
  console.log('Running. Press Ctrl+C to stop.\n');
}

main();
