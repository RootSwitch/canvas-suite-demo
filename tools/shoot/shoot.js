#!/usr/bin/env node
/* Suite imagery rig: drive headless Chrome over CDP, write one PNG per shot.
   No dependencies - Node 22+ has a global WebSocket.

   Usage: node shoot.js shots.json outdir
   Each shot: { name, url, width, height, scale, storage: {k:v}, waitMs, script } */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const CHROME = process.env.CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.env.CDP_PORT) || 9333;

const shots = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
// Chrome refuses a relative --user-data-dir with a modal "Failed To Create Data
// Directory", which in headless mode just hangs the run. Always resolve.
const outdir = path.resolve(process.argv[3]);
fs.mkdirSync(outdir, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Hash-only navigation does not reload the document, so a re-visit needs a query
// buster - and it has to go BEFORE the hash or it lands inside the route.
function bust(url) {
    const hashAt = url.indexOf('#');
    const head = hashAt === -1 ? url : url.slice(0, hashAt);
    const hash = hashAt === -1 ? '' : url.slice(hashAt);
    return head + (head.includes('?') ? '&' : '?') + '_r=1' + hash;
}

async function main() {
    const profile = path.join(outdir, '_chrome-profile');
    const chrome = spawn(CHROME, [
        '--headless=new',
        `--remote-debugging-port=${PORT}`,
        `--user-data-dir=${profile}`,
        '--no-first-run',
        '--no-default-browser-check',
        '--hide-scrollbars',
        '--force-device-scale-factor=1',
        '--disable-gpu',
        'about:blank',
    ], { stdio: ['ignore', 'ignore', 'pipe'] });
    chrome.on('error', (e) => console.error('chrome spawn failed:', e.message));
    chrome.stderr.on('data', (d) => process.stderr.write(String(d)));

    let target = null;
    let lastErr = null;
    for (let i = 0; i < 120 && !target; i++) {
        await sleep(500);
        try {
            const r = await fetch(`http://127.0.0.1:${PORT}/json/list`);
            const list = await r.json();
            target = list.find((t) => t.type === 'page');
            if (!target) lastErr = new Error('no page target: ' + list.map((t) => t.type).join(','));
        } catch (e) { lastErr = e; }
    }
    if (!target) throw new Error('Chrome did not expose a debug target: ' + (lastErr && lastErr.message) + ' / ' + (lastErr && lastErr.cause && lastErr.cause.message));

    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

    let id = 0;
    const pending = new Map();
    const events = [];
    ws.onmessage = (m) => {
        const msg = JSON.parse(m.data);
        if (msg.id && pending.has(msg.id)) {
            const { res, rej } = pending.get(msg.id);
            pending.delete(msg.id);
            msg.error ? rej(new Error(JSON.stringify(msg.error))) : res(msg.result);
        } else if (msg.method) {
            events.push(msg.method);
        }
    };
    const send = (method, params = {}) => new Promise((res, rej) => {
        const n = ++id;
        pending.set(n, { res, rej });
        ws.send(JSON.stringify({ id: n, method, params }));
    });
    const waitFor = async (method, timeoutMs = 20000) => {
        const until = Date.now() + timeoutMs;
        while (Date.now() < until) {
            if (events.includes(method)) { events.length = 0; return true; }
            await sleep(50);
        }
        throw new Error(`timeout waiting for ${method}`);
    };

    await send('Page.enable');
    await send('Runtime.enable');

    for (const shot of shots) {
        const w = shot.width || 1120;
        const h = shot.height || 660;
        await send('Emulation.setDeviceMetricsOverride', {
            width: w, height: h, deviceScaleFactor: shot.scale || 2, mobile: false,
        });

        events.length = 0;
        await send('Page.navigate', { url: shot.url });
        await waitFor('Page.loadEventFired');

        // Theme and any other origin-scoped state must be seeded, then reloaded.
        if (shot.storage) {
            const sets = Object.entries(shot.storage)
                .map(([k, v]) => `localStorage.setItem(${JSON.stringify(k)}, ${JSON.stringify(v)});`)
                .join('');
            await send('Runtime.evaluate', { expression: sets });
            events.length = 0;
            await send('Page.navigate', { url: bust(shot.url) });
            await waitFor('Page.loadEventFired');
        }

        await sleep(shot.waitMs || 1800);

        if (shot.script) {
            await send('Runtime.evaluate', { expression: shot.script, awaitPromise: true });
            await sleep(shot.afterScriptMs || 900);
        }

        const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
        const file = path.join(outdir, `${shot.name}.png`);
        fs.writeFileSync(file, Buffer.from(data, 'base64'));
        console.log(`${shot.name}  ->  ${file}`);
    }

    ws.close();
    chrome.kill();
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
