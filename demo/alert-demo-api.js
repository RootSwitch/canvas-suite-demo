'use strict';
// DEMO SHIM for AlertCanvas - static showcase, no server. The alarm state
// mirrors the calm-day kiosk story: the Printer is down (crit, device-down)
// and the virtualization cluster is running hot (warn, cpu). History carries
// a week of cleared incidents including the power event the "2 AM version"
// wall depicts. Timestamps are generated at request time so ages read fresh.
(function () {
    const realFetch = window.fetch.bind(window);
    const now = () => Math.floor(Date.now() / 1000);
    const ago = (s) => now() - s;

    const THRESHOLDS = {
        cpu: { warn: 85, crit: 95 }, mem: { warn: 85, crit: 95 }, disk: { warn: 85, crit: 95 },
        temp: { warn: 45, crit: 55 }, util: { warn: 70, crit: 90 },
        battery: { warn: 50, crit: 20 }, runtime: { warn: 600, crit: 300 },
        fan: null, power: null, outlet: null, uptime: null, meter: null,
        state: { warn: null, crit: 1 }
    };
    const IF_RULES = {
        down: { enabled: true, severity: 'crit' },
        errors: { warn: 1, crit: 10 }, discards: { warn: 5, crit: 50 },
        util: { warn: 80, crit: 95 }
    };

    // The cluster runs 74+wobble in the SNMP demo; here its threshold is a
    // demo-friendly 75 (an override) so a live warn alarm exists to look at.
    const openAlerts = () => [
        { id: 41, key: 'device-down:Printer', state: 'active', severity: 'crit',
          kind: 'device-down', host: 'Printer', code: null, label: 'Printer down',
          value: null, peakValue: null, threshold: null, unit: '',
          breachCount: 271, clearCount: 0,
          firstBreachTs: ago(8180), raisedTs: ago(8120), clearedTs: null,
          ackedTs: null, clearReason: null, notifiedRaise: true, notifiedClear: false },
        { id: 42, key: 'cpu:vc', state: 'active', severity: 'warn',
          kind: 'cpu', host: 'vhost-cluster', code: 'vc', label: 'CPU',
          value: 81.4, peakValue: 86.2, threshold: 75, unit: '%',
          breachCount: 49, clearCount: 0,
          firstBreachTs: ago(1560), raisedTs: ago(1500), clearedTs: null,
          ackedTs: null, clearReason: null, notifiedRaise: true, notifiedClear: false }
    ];
    const history = () => [
        { id: 40, key: 'state:us', state: 'cleared', severity: 'crit', kind: 'state',
          host: 'ups-01', code: 'us', label: 'Output source', value: 1, peakValue: 1,
          threshold: 1, unit: '', breachCount: 82, clearCount: 2,
          firstBreachTs: ago(3 * 86400 + 2460), raisedTs: ago(3 * 86400 + 2400),
          clearedTs: ago(3 * 86400), ackedTs: ago(3 * 86400 + 1980),
          clearReason: 'recovered', notifiedRaise: true, notifiedClear: true },
        { id: 39, key: 'battery:ub', state: 'cleared', severity: 'warn', kind: 'battery',
          host: 'ups-01', code: 'ub', label: 'Battery charge', value: 64, peakValue: 47,
          threshold: 50, unit: '%', breachCount: 41, clearCount: 2,
          firstBreachTs: ago(3 * 86400 + 1200), raisedTs: ago(3 * 86400 + 1140),
          clearedTs: ago(3 * 86400 - 5400), ackedTs: null,
          clearReason: 'recovered', notifiedRaise: true, notifiedClear: true },
        { id: 38, key: 'device-down:Finance WS', state: 'cleared', severity: 'crit',
          kind: 'device-down', host: 'Finance WS', code: null, label: 'Finance WS down',
          value: null, peakValue: null, threshold: null, unit: '', breachCount: 88,
          clearCount: 2, firstBreachTs: ago(3 * 86400 + 2400), raisedTs: ago(3 * 86400 + 2340),
          clearedTs: ago(3 * 86400 - 900), ackedTs: ago(3 * 86400 + 1900),
          clearReason: 'recovered', notifiedRaise: true, notifiedClear: true },
        { id: 37, key: 'if-util:XC', state: 'cleared', severity: 'warn', kind: 'if-util',
          host: 'edge-fw', code: 'XC', label: 'cloud0 utilization', value: 78.2,
          peakValue: 93.1, threshold: 80, unit: '%', breachCount: 12, clearCount: 2,
          firstBreachTs: ago(2 * 86400 + 7300), raisedTs: ago(2 * 86400 + 7200),
          clearedTs: ago(2 * 86400), ackedTs: null,
          clearReason: 'recovered', notifiedRaise: true, notifiedClear: true },
        { id: 36, key: 'temp:ct', state: 'cleared', severity: 'warn', kind: 'temp',
          host: 'core-sw', code: 'ct', label: 'Switch temperature', value: 43,
          peakValue: 49, threshold: 45, unit: 'C', breachCount: 30, clearCount: 2,
          firstBreachTs: ago(5 * 86400 + 4000), raisedTs: ago(5 * 86400 + 3900),
          clearedTs: ago(5 * 86400), ackedTs: null,
          clearReason: 'recovered', notifiedRaise: true, notifiedClear: true },
        { id: 35, key: 'device-down:POE Camera', state: 'cleared', severity: 'crit',
          kind: 'device-down', host: 'POE Camera', code: null, label: 'POE Camera down',
          value: null, peakValue: null, threshold: null, unit: '', breachCount: 85,
          clearCount: 2, firstBreachTs: ago(3 * 86400 + 2400), raisedTs: ago(3 * 86400 + 2280),
          clearedTs: ago(3 * 86400 - 1500), ackedTs: null,
          clearReason: 'recovered', notifiedRaise: true, notifiedClear: true }
    ];

    const lvl = (kind) => THRESHOLDS[kind] || null;
    const met = (code, kind, host, display, value, unit, current, rule) => ({
        code, kind, host, display, value, unit: unit || '',
        lowerIsBad: kind === 'battery' || kind === 'runtime',
        rule: rule !== undefined ? rule : lvl(kind),
        source: rule !== undefined ? 'override' : 'default', muted: false, current
    });
    const WATCH_METRICS = [
        met('wc', 'cpu', 'web-01', 'CPU 34%', 33.8, '%', 'ok'),
        met('vc', 'cpu', 'vhost-cluster', 'CPU 81%', 81.4, '%', 'warn', { warn: 75, crit: 95 }),
        met('vm', 'mem', 'vhost-cluster', 'Mem 74%', 73.6, '%', 'ok'),
        met('nf', 'disk', 'nas-01', 'Pool 71%', 71.2, '%', 'ok'),
        met('ct', 'temp', 'core-sw', '41C', 41, 'C', 'ok'),
        met('mm', 'mem', 'mon-01', 'Mem 63%', 62.8, '%', 'ok'),
        met('ub', 'battery', 'ups-01', 'Batt 100%', 100, '%', 'ok'),
        met('ur', 'runtime', 'ups-01', '52m', 3120, 's', 'ok'),
        met('us', 'state', 'ups-01', 'On mains', 0, '', 'ok'),
        met('fu', 'uptime', 'edge-fw', 'up 142d', 12268800, 's', null)
    ];
    const ifWatch = (code, id, host, name, alias, inBps, outBps, speed) => ({
        code, id, host, name, alias, operStatus: 'up', adminStatus: 'up',
        deviceStatus: 'up',
        down: { rule: IF_RULES.down, source: 'default', muted: false, current: 'ok' },
        errors: { rule: IF_RULES.errors, source: 'default', muted: false, value: 0, current: 'ok' },
        discards: { rule: IF_RULES.discards, source: 'default', muted: false, value: 0, current: 'ok' },
        util: { rule: IF_RULES.util, source: 'default', muted: false,
                value: Math.round(Math.max(inBps, outBps) / speed * 1000) / 10,
                current: Math.max(inBps, outBps) / speed * 100 >= 80 ? 'warn' : 'ok' }
    });
    const WATCH_IFS = [
        ifWatch('XW', 'edge-fw:wan0', 'edge-fw', 'wan0', 'fiber uplink', 412e6, 96e6, 1e9),
        ifWatch('XC', 'edge-fw:cloud0', 'edge-fw', 'cloud0', 'cloud VPC', 872e6, 240e6, 1e9)
    ];
    const FLEET = [
        ['edge-fw', '10.20.0.15', 'up'], ['core-sw', '10.20.0.16', 'up'],
        ['web-01', '10.20.0.19', 'up'], ['nas-01', '10.20.0.21', 'up'],
        ['mon-01', '10.20.0.24', 'up'], ['vhost-cluster', '10.20.0.25', 'up'],
        ['ups-01', '10.20.0.44', 'up'], ['Printer', '10.20.0.28', 'down']
    ];
    const WATCH_DEVICES = FLEET.map(([host, ip, status]) => ({
        host, ip, status,
        rule: { enabled: true, severity: 'crit' }, source: 'default', muted: false
    }));

    window.fetch = function (url, opts) {
        const u = String(url);
        const qPos = u.indexOf('?');
        const path = (qPos < 0 ? u : u.slice(0, qPos)).replace(/^[^/]*\/\/[^/]*/, '');
        if (!path.startsWith('/api/')) { return realFetch(url, opts); }
        const reply = (body, status) => Promise.resolve(new Response(JSON.stringify(body), {
            status: status || 200, headers: { 'Content-Type': 'application/json' }
        }));
        if (path === '/api/session') { return reply({ authenticated: true, needsSetup: false }); }
        if (path === '/api/status') {
            return reply({
                worstActive: 'crit', silenceUntil: 0,
                lastScanTs: ago(11), lastScanOk: true, lastScanError: null,
                feed: { ok: true, generatedAt: new Date((now() - 9) * 1000).toISOString(),
                        ageSec: 9, staleAfterS: 120 },
                watching: { metrics: WATCH_METRICS.length, interfaces: WATCH_IFS.length, devices: FLEET.length },
                counts: { pending: 0, active: 2, clearing: 0 },
                emailError: null, scanIntervalS: 30
            });
        }
        if (path === '/api/alerts') { return reply({ alerts: openAlerts() }); }
        if (path === '/api/alerts/history') { return reply({ alerts: history() }); }
        if (path === '/api/notifications') {
            const n = (id, alertId, alertLabel, channel, event, ts) =>
                ({ id, alertId, alertLabel, channel, event, ts, ok: true, detail: null });
            return reply({ notifications: [
                n(120, 42, 'CPU', 'email', 'raise', ago(1490)),
                n(119, 41, 'Printer down', 'syslog', 'raise', ago(8110)),
                n(118, 41, 'Printer down', 'email', 'raise', ago(8112)),
                n(117, 40, 'Output source', 'email', 'clear', ago(3 * 86400 - 8)),
                n(116, 38, 'Finance WS down', 'email', 'clear', ago(3 * 86400 - 905)),
                n(115, 40, 'Output source', 'syslog', 'raise', ago(3 * 86400 + 2395)),
                n(114, 40, 'Output source', 'email', 'raise', ago(3 * 86400 + 2398)),
                n(113, 39, 'Battery charge', 'email', 'raise', ago(3 * 86400 + 1135)),
                n(112, 38, 'Finance WS down', 'email', 'raise', ago(3 * 86400 + 2335)),
                n(111, 37, 'cloud0 utilization', 'email', 'raise', ago(2 * 86400 + 7195))
            ] });
        }
        if (path === '/api/watching') {
            return reply({ available: true, generatedAt: new Date((now() - 9) * 1000).toISOString(),
                metrics: WATCH_METRICS, interfaces: WATCH_IFS, devices: WATCH_DEVICES });
        }
        if (path === '/api/sources') {
            return reply({ available: true, generatedAt: new Date((now() - 9) * 1000).toISOString(),
                interfaces: WATCH_IFS.map((i) => ({ code: i.code, id: i.id, host: i.host,
                    name: i.name, alias: i.alias, operStatus: 'up', deviceStatus: 'up', speedBps: 1e9 })),
                metrics: WATCH_METRICS.map((m) => ({ code: m.code, kind: m.kind, host: m.host,
                    display: m.display, value: m.value, unit: m.unit })) });
        }
        if (path === '/api/overrides') {
            return reply({ overrides: [
                { id: 1, host: 'vhost-cluster', code: 'vc', kind: 'cpu', enabled: true,
                  warn: 75, crit: 95, muted: false, note: 'cluster runs hot on purpose - earlier warning' }
            ] });
        }
        if (path === '/api/settings') {
            return reply({
                statusFile: '/status/snmp-status.json', scanIntervalS: 30,
                raiseScans: 2, clearScans: 2, staleAfterS: 0, missingScansToClear: 20,
                renotifyIntervalS: 0, retentionDays: 90,
                emailEnabled: true, emailTo: 'noc@example.com', emailFrom: 'alerts@example.com',
                smtpHost: 'mail.example.com', smtpPort: 587, smtpUser: 'alerts',
                ntfyEnabled: false, ntfyServer: '', ntfyTopic: '',
                syslogEnabled: true, syslogHost: '10.20.0.21', syslogPort: 514,
                thresholds: THRESHOLDS, ifRules: IF_RULES, deviceDown: {},
                smtpPassSet: true, ntfyTokenSet: false,
                dataDir: '/data (demo)', credentialEncryption: true
            });
        }
        return reply({ ok: true });
    };

    window.addEventListener('DOMContentLoaded', function () {
        const r = document.createElement('div');
        r.id = 'demo-ribbon';
        r.textContent = 'static demo - synthetic alarms, nothing will email you';
        r.style.cssText = 'position:fixed;bottom:10px;right:10px;z-index:999;' +
            'background:var(--se-panel,#262a33);border:1px solid var(--se-warn,#d9a92f);' +
            'color:var(--se-warn,#d9a92f);padding:3px 10px;border-radius:9px;' +
            'font-size:11px;letter-spacing:0.5px;pointer-events:none;';
        document.body.appendChild(r);
    });
})();
