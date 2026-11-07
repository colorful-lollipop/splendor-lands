/**
 * 一键启动：检查端口 → 按需构建 → 启动服务 → 打开浏览器。
 *
 * 用法：node scripts/launch.mjs   （或双击 启动游戏.bat）
 *
 * 设计要点：
 * - 3001 端口已有服务在跑时，直接开浏览器，不再重复启动（避免 EADDRINUSE）。
 * - dist 不存在或比 src 旧时自动重新构建。
 * - 服务在子进程里跑，本脚本退出后它仍继续；日志写入 server.log。
 */

import { spawn } from 'node:child_process';
import { existsSync, statSync, readdirSync, openSync, closeSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { exec } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
let PORT = Number(process.env.PORT) || 3001;
let URL = `http://localhost:${PORT}`;

function log(msg) {
  console.log(`  ${msg}`);
}

function openBrowser(url) {
  if (process.env.SPLENDOR_NO_OPEN) return;
  const cmd =
    process.platform === 'win32'
      ? `start "" "${url}"`
      : process.platform === 'darwin'
        ? `open "${url}"`
        : `xdg-open "${url}"`;
  exec(cmd, () => {});
}

function lanUrls(port) {
  return Object.values(networkInterfaces())
    .flat()
    .filter((info) => info && info.family === 'IPv4' && !info.internal)
    .map((info) => `http://${info.address}:${port}`);
}

async function probe(url, timeoutMs = 2500) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${url}/api/health`, { signal: ctrl.signal });
    if (!res.ok) return false;
    const json = await res.json();
    return Boolean(json?.ok);
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/** 目录里最新的修改时间 */
function newestMtime(dir) {
  let newest = 0;
  const walk = (d) => {
    for (const name of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, name.name);
      if (name.isDirectory()) walk(p);
      else {
        const t = statSync(p).mtimeMs;
        if (t > newest) newest = t;
      }
    }
  };
  if (existsSync(dir)) walk(dir);
  return newest;
}

function needsBuild() {
  const index = join(ROOT, 'dist', 'index.html');
  if (!existsSync(index)) return true;
  const built = statSync(index).mtimeMs;
  return newestMtime(join(ROOT, 'src')) > built || newestMtime(join(ROOT, 'shared')) > built;
}

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32' });
    child.on('error', reject);
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} 退出码 ${code}`))));
  });
}

/** 端口是否被别的程序占用（不关心占用者是谁） */
async function portBusy(port) {
  return new Promise((resolve) => {
    import('node:net').then(({ createConnection }) => {
      const sock = createConnection({ port, host: '127.0.0.1' });
      const done = (v) => {
        sock.destroy();
        resolve(v);
      };
      sock.setTimeout(700);
      sock.once('connect', () => done(true));
      sock.once('timeout', () => done(false));
      sock.once('error', () => done(false));
    });
  });
}

async function main() {
  console.log('');
  console.log('  Splendor Lands');

  // 1) 已经有人在 3001 上跑？直接开浏览器
  if (await probe(URL)) {
    log(`Already running at ${URL} - opening browser`);
    openBrowser(URL);
    return;
  }

  // 1.5) 3001 被别的程序占了？换一个端口
  if (await portBusy(PORT)) {
    const start = PORT;
    for (let p = PORT + 1; p <= start + 20; p += 1) {
      const busy = await portBusy(p);
      if (!busy) {
        PORT = p;
        URL = `http://localhost:${PORT}`;
        log(`Port ${start} is busy, using ${PORT} instead`);
        break;
      }
    }
  }

  // 2) 依赖
  if (!existsSync(join(ROOT, 'node_modules'))) {
    log('First run: installing dependencies...');
    await run('npm', ['install']);
  }

  // 3) 构建
  if (needsBuild()) {
    log('Building frontend...');
    await run('npm', ['run', 'build']);
  } else {
    log('Using existing build output');
  }

  // 4) 启动服务（独立进程，日志写文件）
  log(`Starting server on port ${PORT} ...`);
  const logFile = join(ROOT, 'server.log');
  const fd = openSync(logFile, 'a');
  const child = spawn(process.execPath, [join(ROOT, 'server', 'index.mjs')], {
    cwd: ROOT,
    detached: true,
    stdio: ['ignore', fd, fd],
    env: { ...process.env, PORT: String(PORT) },
  });
  child.unref();
  closeSync(fd);

  // 5) 等就绪后开浏览器
  for (let i = 0; i < 30; i += 1) {
    await new Promise((r) => setTimeout(r, 400));
    if (await probe(URL, 800)) {
      log(`Ready: ${URL}`);
      for (const lan of lanUrls(PORT)) log(`LAN: ${lan}`);
      openBrowser(URL);
      console.log('');
      console.log('  Closing this window will NOT stop the server. Run stop.bat (停止游戏.bat) to stop it.');
      console.log('');
      return;
    }
  }

  log('Server start timed out. Check server.log');
  process.exitCode = 1;
}

main().catch((err) => {
  console.error('\n  Failed to start:', err.message);
  console.error('  If the port is busy, run 停止游戏.bat first.\n');
  process.exitCode = 1;
});
