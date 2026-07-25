'use strict';
// Regenerate the demo's SNMP layer: adds a UPS to the board, drops {code}
// tokens onto labels/links, and writes the matching snmp-status.json.
// Run after refreshing board.xcanvas from the CrossCanvas sample:
//   node demo/build-fixtures.js
// Idempotent: token lines are only appended once (guarded by marker).
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, 'fixtures');
const board = JSON.parse(fs.readFileSync(path.join(DIR, 'board.xcanvas'), 'utf8'));

const run = (text) => ({ text, bold: false, italic: false });
const fmt = () => ({ bold: false, italic: false });

// Append token lines to a device label (once).
function addLines(label, lines) {
    const d = board.devices.find((x) => (x.label || '').split('\n')[0].trim() === label);
    if (!d) { throw new Error('device not found: ' + label); }
    if (d.label.includes('{')) { return; }             // already tokenized
    d.label += '\n' + lines.join('\n');
    lines.forEach((l) => {
        d.spans.push([run(l)]);
        d.lineFormats.push(fmt());
    });
}

// --- the UPS (new device, Server VLAN 20, beside the cluster) ---------------
if (!board.devices.some((d) => d.image === '@UPS')) {
    board.devices.push({
        id: 'demo-ups', templateId: 'demo-t-ups', image: '@UPS', originalImage: '@UPS',
        x: 350, y: 970, w: 60, h: 60,
        label: 'Rack UPS', labelPosition: 'bottom', fontSize: 14, fontColor: '#333333',
        lineFormats: [fmt()], spans: [[run('Rack UPS')]], tintColor: null,
        attachmentPoints: [
            { rx: 30, ry: 0 }, { rx: 60, ry: 0 }, { rx: 60, ry: 30 }, { rx: 60, ry: 60 },
            { rx: 30, ry: 60 }, { rx: 0, ry: 60 }, { rx: 0, ry: 30 }, { rx: 0, ry: 0 }
        ],
        fields: {}
    });
}
// Set the addressing every run, not just on the run that creates the device.
// The guard above is a create-once guard, so a board that already had the UPS
// kept whatever fields it was first written with - which is how it ended up
// carrying an address and no Hostname, invisible to the lookups below that key
// on hostname. Idempotent means "ends in the same state", not "skipped".
Object.assign(board.devices.find((d) => d.image === '@UPS').fields ||
    (board.devices.find((d) => d.image === '@UPS').fields = {}),
    { Hostname: 'ups-01', 'IP-Address': '10.20.10.44' });

// --- tokens on labels (name lives in `display`, so tokens are bare) ---------
addLines('Rack UPS', ['{ub} {ur}', '{us}']);
addLines('Web Server', ['{wc}']);
addLines('Virtualization Cluster', ['{vc} {vm}']);
addLines('Backup NAS', ['{nf}']);
addLines('Core Switch', ['{ct}']);
addLines('Edge Firewall', ['{fu}']);
addLines('Monitoring Server', ['{mm}']);

// --- bandwidth pills on the two uplinks -------------------------------------
function annotate(connLabel, text) {
    const c = board.connections.find((x) => x.label === connLabel);
    if (!c) { throw new Error('connection not found: ' + connLabel); }
    if ((c.annotations || []).some((a) => a.text.includes('{'))) { return; }
    c.annotations.push({ id: 'demo-ann-' + c.id, text, position: 0.5, fontSize: 13, fontColor: c.color });
}
annotate('1 Gb Fiber', '{XW}');
annotate('Cloud Uplink', '{XC}');

fs.writeFileSync(path.join(DIR, 'board.xcanvas'), JSON.stringify(board) + '\n');

// --- address lookup, straight off the board ---------------------------------
const byHost = {};
board.devices.forEach((d) => {
    const f = d.fields || {};
    if (f.Hostname && f['IP-Address']) { byHost[f.Hostname] = f['IP-Address']; }
});
function ipOf(hostname) {
    const ip = byHost[hostname];
    if (!ip) { throw new Error('no address on the board for ' + hostname); }
    return ip;
}
// The subset the SNMP demo polls (the rest of the estate is ping-only).
const SNMP_HOSTS = ['edge-fw', 'core-sw', 'intranet-01', 'nas-01', 'mon-01', 'vhost-cluster', 'ups-01'];

// --- latency with a physical basis -----------------------------------------
// The old fixture had a load balancer at 1ms and the edge firewall at 36ms,
// which is backwards: your own firewall does not answer slower than someone
// else's object storage. Round-trip time is mostly distance and medium, so
// derive it from where the device actually sits.
//
// The warehouse is the point of the exercise. It is behind a geostationary
// satellite link, and ~600ms is not a fault - it is 71,000km of round trip at
// the speed of light. On the wall that branch reads visibly slower than
// everything else, which is the honest picture and a better teaching example
// than a board where every number is 1ms.
const LINKS = [
    [/^10\.20\.(0|10)\./,   0.4,   2, 'HQ switched LAN'],
    [/^10\.20\.20\.(10|80)$/, 3,  12, 'HQ wireless'],
    [/^10\.20\.20\./,       1,     4, 'HQ user VLAN'],
    [/^10\.20\.21\./,      18,    34, 'retail branch, IPsec over broadband'],
    [/^10\.20\.22\./,     580,   660, 'warehouse branch, geostationary satellite'],
    [/^10\.20\.30\./,       9,    18, 'cloud VPC across the region']
];
// Deterministic jitter - a fixture that changed on every run would make every
// rebuild a diff. Hash the address for a stable position inside the band.
function latencyFor(ip) {
    let h = 0;
    for (let i = 0; i < ip.length; i++) { h = (h * 31 + ip.charCodeAt(i)) & 0x7fffffff; }
    // Avalanche. Without it, .11 and .12 differ by one and land on the same
    // reading, so a whole VLAN comes out as a column of identical numbers -
    // which looks exactly as synthetic as it is.
    h ^= h >>> 15; h = Math.imul(h, 2246822519);
    h ^= h >>> 13; h = Math.imul(h, 3266489917);
    h = (h ^ (h >>> 16)) >>> 0;
    for (const [re, lo, hi] of LINKS) {
        if (re.test(ip)) {
            const v = lo + (h % 1000) / 1000 * (hi - lo);
            return v < 10 ? Math.round(v * 10) / 10 : Math.round(v);
        }
    }
    throw new Error('no link profile for ' + ip);
}

// --- the feed: everything the board references, spec-v3 shapes --------------
const status = {
    schemaVersion: 3,
    generator: 'snmpcanvas/0.5.0 (demo fixture)',
    generatedAt: '2099-01-01T00:00:00Z',
    pollIntervalSec: 30,
    // Read out of the board rather than restated here. The addresses live in
    // the CrossCanvas sample, flow into board.xcanvas, and arrive here - so a
    // renumbering happens in one place and cannot leave the feed pointing at
    // hosts the board no longer contains, which is exactly how the previous
    // fixtures drifted onto a flat 10.20.0.x scheme of their own.
    devices: SNMP_HOSTS.map((h) => ({ name: h, host: ipOf(h), status: 'up' })),
    interfaces: [
        { id: 'edge-fw:wan0', code: 'XW', operStatus: 'up', speedBps: 1000000000,
          inBps: 412000000, outBps: 96000000,
          inErrorsPerSec: 0, outErrorsPerSec: 0, inDiscardsPerSec: 0, outDiscardsPerSec: 0 },
        { id: 'edge-fw:cloud0', code: 'XC', operStatus: 'up', speedBps: 1000000000,
          inBps: 872000000, outBps: 240000000,
          inErrorsPerSec: 0, outErrorsPerSec: 0, inDiscardsPerSec: 0, outDiscardsPerSec: 0 }
    ],
    metrics: [
        { code: 'wc', kind: 'cpu', host: 'intranet-01', display: 'CPU 34%', value: 34, unit: '%', status: 'ok' },
        { code: 'vc', kind: 'cpu', host: 'vhost-cluster', display: 'CPU 81%', value: 81, unit: '%', status: 'warn' },
        { code: 'vm', kind: 'mem', host: 'vhost-cluster', display: 'Mem 74%', value: 74, unit: '%' },
        { code: 'nf', kind: 'fs', host: 'nas-01', display: 'Pool 71%', value: 71, unit: '%' },
        { code: 'ct', kind: 'temp', host: 'core-sw', display: '41C', value: 41, unit: 'C' },
        { code: 'fu', kind: 'uptime', host: 'edge-fw', display: 'up 142d', value: 12268800, unit: 's' },
        { code: 'mm', kind: 'mem', host: 'mon-01', display: 'Mem 63%', value: 63, unit: '%' },
        { code: 'ub', kind: 'battery', host: 'ups-01', display: 'Batt 100%', value: 100, unit: '%' },
        { code: 'ur', kind: 'runtime', host: 'ups-01', display: '52m', value: 3120, unit: 's' },
        { code: 'us', kind: 'state', host: 'ups-01', display: 'On mains', value: 0 }
    ]
};
fs.writeFileSync(path.join(DIR, 'snmp-status.json'), JSON.stringify(status, null, 1) + '\n');

// --- the ping feed, generated rather than hand-maintained -------------------
// It used to be a checked-in file this script only appended the UPS to, which
// is how it drifted: it carried addresses the board had stopped using and
// latencies nobody had looked at in a long time. Now every monitored address
// comes off the board and every reading comes from the link profile above.
const ping = {
    generated: '2099-01-01T00:00:00Z',
    pollIntervalSec: 15,
    devices: {}
};
Object.keys(byHost).sort().forEach((h) => {
    const ip = byHost[h];
    ping.devices[ip] = { state: 'up', latencyMs: latencyFor(ip), name: h };
});
// One red dot on an otherwise healthy wall. A board where everything is green
// demonstrates nothing, and a printer somebody switched off at the wall is the
// most ordinary outage there is.
ping.devices[ipOf('prn-01')] = { state: 'down', latencyMs: null, name: 'prn-01' };
fs.writeFileSync(path.join(DIR, 'status.json'), JSON.stringify(ping, null, 1) + '\n');

// --- the 2 AM version: same board, same codes, a power event in Building A --
// Utility power is out at HQ. The UPS carries the racks (on battery, draining),
// wall-powered gear is dark, the server room is warming, and HQ traffic has
// collapsed to a trickle. Branches and cloud untouched - blast radius reads at
// a glance. Board file is untouched: only the feeds differ.
const badPing = JSON.parse(JSON.stringify(ping));
const setState = (host, state, lat) => {
    badPing.devices[ipOf(host)] = { state, latencyMs: lat, name: host };
};
setState('fin-ws-01', 'down', null);       // wall power, nothing behind it
setState('prn-01', 'down', null);          // already the down one
setState('cam-hq-01', 'down', null);       // unbacked PoE leg
setState('wlc-01', 'degraded', 210);       // controller struggling on the brownout
// Branches and cloud are deliberately left alone: the blast radius is Building
// A and nowhere else, which is the thing a wall should make obvious at a glance.
fs.writeFileSync(path.join(DIR, 'bad-status.json'), JSON.stringify(badPing, null, 1) + '\n');

const bad = JSON.parse(JSON.stringify(status));
const m = Object.fromEntries(bad.metrics.map((x) => [x.code, x]));
Object.assign(m.ub, { display: 'Batt 64%', value: 64 });
Object.assign(m.ur, { display: '18m', value: 1080 });
Object.assign(m.us, { display: 'ON BATTERY', value: 1 });
Object.assign(m.vc, { display: 'CPU 97%', value: 97, status: 'crit' });   // consolidation storm
Object.assign(m.wc, { display: 'CPU 88%', value: 88, status: 'warn' });
Object.assign(m.ct, { display: '67C', value: 67 });                        // AC is off too
Object.assign(m.mm, { display: 'Mem 71%', value: 71 });
const iface = Object.fromEntries(bad.interfaces.map((x) => [x.code, x]));
Object.assign(iface.XW, { inBps: 88000000, outBps: 21000000 });    // HQ users are gone
Object.assign(iface.XC, { inBps: 310000000, outBps: 84000000 });   // cloud back to normal
fs.writeFileSync(path.join(DIR, 'bad-snmp-status.json'), JSON.stringify(bad, null, 1) + '\n');

console.log('fixtures rebuilt: board devices', board.devices.length,
    '| metrics', status.metrics.length, '| interfaces', status.interfaces.length,
    '| bad-day feeds written');
