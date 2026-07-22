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
        fields: { 'IP-Address': '10.20.0.44' }
    });
}

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

// --- the feed: everything the board references, spec-v3 shapes --------------
const status = {
    schemaVersion: 3,
    generator: 'snmpcanvas/0.5.0 (demo fixture)',
    generatedAt: '2099-01-01T00:00:00Z',
    pollIntervalSec: 30,
    devices: [
        { name: 'edge-fw', host: '10.20.0.15', status: 'up' },
        { name: 'core-sw', host: '10.20.0.16', status: 'up' },
        { name: 'web-01', host: '10.20.0.19', status: 'up' },
        { name: 'nas-01', host: '10.20.0.21', status: 'up' },
        { name: 'mon-01', host: '10.20.0.24', status: 'up' },
        { name: 'vhost-cluster', host: '10.20.0.25', status: 'up' },
        { name: 'ups-01', host: '10.20.0.44', status: 'up' }
    ],
    interfaces: [
        { id: 'edge-fw:wan0', code: 'XW', operStatus: 'up', speedBps: 1000000000,
          inBps: 412000000, outBps: 96000000,
          inErrorsPerSec: 0, outErrorsPerSec: 0, inDiscardsPerSec: 0, outDiscardsPerSec: 0 },
        { id: 'edge-fw:cloud0', code: 'XC', operStatus: 'up', speedBps: 1000000000,
          inBps: 872000000, outBps: 240000000,
          inErrorsPerSec: 0, outErrorsPerSec: 0, inDiscardsPerSec: 0, outDiscardsPerSec: 0 }
    ],
    metrics: [
        { code: 'wc', kind: 'cpu', host: 'web-01', display: 'CPU 34%', value: 34, unit: '%', status: 'ok' },
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

// ping status: the UPS answers too
const ping = JSON.parse(fs.readFileSync(path.join(DIR, 'status.json'), 'utf8'));
ping.devices['10.20.0.44'] = { state: 'up', latencyMs: 2 };
fs.writeFileSync(path.join(DIR, 'status.json'), JSON.stringify(ping, null, 1) + '\n');

console.log('fixtures rebuilt: board devices', board.devices.length,
    '| metrics', status.metrics.length, '| interfaces', status.interfaces.length);
