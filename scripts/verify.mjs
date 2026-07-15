import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';

const edge = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const port = 9222;
const url = 'http://127.0.0.1:5173';
const userDataDir = `${process.env.TEMP}\\naus-edge-profile-${Date.now()}`;

const browser = spawn(edge, [
  '--headless=new',
  `--remote-debugging-port=${port}`,
  '--disable-gpu',
  '--hide-scrollbars',
  '--window-size=1920,1080',
  `--user-data-dir=${userDataDir}`,
  url,
]);

browser.stderr.on('data', () => {});
browser.stdout.on('data', () => {});

async function requestJson(path) {
  for (let i = 0; i < 60; i += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}${path}`);
      if (response.ok) return response.json();
    } catch {
      await delay(250);
    }
  }
  throw new Error(`CDP endpoint unavailable: ${path}`);
}

const targets = await requestJson('/json');
const target = targets.find((entry) => entry.type === 'page') ?? targets[0];
const socket = new WebSocket(target.webSocketDebuggerUrl);
let nextId = 1;
const pending = new Map();

socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result);
  }
});

await new Promise((resolve) => socket.addEventListener('open', resolve, { once: true }));

function send(method, params = {}) {
  const id = nextId;
  nextId += 1;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', {
  width: 1920,
  height: 1080,
  deviceScaleFactor: 1,
  mobile: false,
});
await send('Page.navigate', { url });
await delay(1200);

async function screenshot(path) {
  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  await writeFile(path, Buffer.from(shot.data, 'base64'));
}

await screenshot('verify-initial.png');

const initial = await send('Runtime.evaluate', {
  returnByValue: true,
  expression: `(() => ({
    scrollW: document.documentElement.scrollWidth,
    innerW: window.innerWidth,
    scrollH: document.documentElement.scrollHeight,
    innerH: window.innerHeight,
    red: Array.from(document.querySelectorAll('*')).filter(el => getComputedStyle(el).color === 'rgb(229, 72, 77)' || getComputedStyle(el).borderLeftColor === 'rgb(229, 72, 77)' || getComputedStyle(el).stroke === 'rgb(229, 72, 77)').length
  }))()`,
});

await send('Runtime.evaluate', {
  expression: `Array.from(document.querySelectorAll('button')).find((button) => button.textContent.trim() === 'run scenario')?.click()`,
});
await delay(18000);
await screenshot('verify-final.png');

const final = await send('Runtime.evaluate', {
  returnByValue: true,
  expression: `(() => {
    const ledgerRows = Array.from(document.querySelectorAll('[data-ledger-row]'));
    const status = document.querySelector('[data-status-line]');
    const traceButton = status?.closest('button');
    traceButton?.click();
    return {
      scrollW: document.documentElement.scrollWidth,
      innerW: window.innerWidth,
      scrollH: document.documentElement.scrollHeight,
      innerH: window.innerHeight,
      status: status?.textContent,
      ledgerRows: ledgerRows.length,
      wrappedLedgerRows: ledgerRows.filter((row) => row.scrollHeight > row.clientHeight + 1).length,
      closing: document.body.textContent.includes('regulated ai -> autonomous agents -> machine-assisted science')
    };
  })()`,
});

await delay(700);
await screenshot('verify-trace.png');
const trace = await send('Runtime.evaluate', {
  returnByValue: true,
  expression: `(() => {
    const trace = document.querySelector('[data-trace-panel]');
    return {
      visible: !!trace,
      scrollW: document.documentElement.scrollWidth,
      innerW: window.innerWidth,
      traceText: trace?.textContent
    };
  })()`,
});

await send('Runtime.evaluate', {
  expression: `Array.from(document.querySelectorAll('button')).find((button) => button.textContent.trim() === 'reset')?.click()`,
});
await delay(1600);
const reset = await send('Runtime.evaluate', {
  returnByValue: true,
  expression: `(() => ({
    messages: document.querySelectorAll('[data-message]').length,
    ledgerRows: document.querySelectorAll('[data-ledger-row]').length,
    status: document.querySelector('[data-status-line]')?.textContent,
    closing: document.body.textContent.includes('machine-assisted science'),
    scrollW: document.documentElement.scrollWidth,
    innerW: window.innerWidth,
    scrollH: document.documentElement.scrollHeight,
    innerH: window.innerHeight
  }))()`,
});

console.log(
  JSON.stringify(
    { initial: initial.result.value, final: final.result.value, trace: trace.result.value, reset: reset.result.value },
    null,
    2,
  ),
);

socket.close();
browser.kill();
