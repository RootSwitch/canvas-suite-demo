'use strict';
// DEMO SHIM for AlertCanvas - static showcase, no server. The alarm state
// mirrors the calm-day kiosk story: prn-01 is down (crit, device-down)
// and the virtualization cluster is running hot (warn, cpu). History carries
// a week of cleared incidents including the power event the "2 AM version"
// wall depicts. Timestamps are generated at request time so ages read fresh.
//
// ?demo=storm switches to that power event happening NOW - the same incident
// the "2 AM version" wall shows, from the alerting side. It is opt-in so the
// demo's front door and the launcher tile stay calm; the app repo's hero image
// uses it, because AlertCanvas is the one app whose documentation has to show
// alarms actually firing.
(function () {
    const realFetch = window.fetch.bind(window);
    const now = () => Math.floor(Date.now() / 1000);
    const ago = (s) => now() - s;
    const STORM = new URLSearchParams(location.search).get('demo') === 'storm';

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
    // The power event, live: mains lost in Building A, so the UPS is carrying
    // the rack while everything on wall power has dropped. Values match the
    // "2 AM version" wall's feed (bad-snmp-status.json) so the two agree.
    const stormAlerts = () => [
        { id: 61, key: 'state:us', state: 'active', severity: 'crit', kind: 'state',
          host: 'ups-01', code: 'us', label: 'Output source', value: 1, peakValue: 1,
          threshold: 1, unit: '', breachCount: 44, clearCount: 0,
          firstBreachTs: ago(2660), raisedTs: ago(2600), clearedTs: null,
          ackedTs: null, clearReason: null, notifiedRaise: true, notifiedClear: false },
        { id: 62, key: 'device-down:fin-ws-01', state: 'active', severity: 'crit',
          kind: 'device-down', host: 'fin-ws-01', code: null, label: 'fin-ws-01 down',
          value: null, peakValue: null, threshold: null, unit: '', breachCount: 42,
          clearCount: 0, firstBreachTs: ago(2600), raisedTs: ago(2540), clearedTs: null,
          ackedTs: null, clearReason: null, notifiedRaise: true, notifiedClear: false },
        { id: 63, key: 'device-down:prn-01', state: 'active', severity: 'crit',
          kind: 'device-down', host: 'prn-01', code: null, label: 'prn-01 down',
          value: null, peakValue: null, threshold: null, unit: '', breachCount: 42,
          clearCount: 0, firstBreachTs: ago(2590), raisedTs: ago(2530), clearedTs: null,
          ackedTs: null, clearReason: null, notifiedRaise: true, notifiedClear: false },
        { id: 64, key: 'device-down:cam-hq-01', state: 'active', severity: 'crit',
          kind: 'device-down', host: 'cam-hq-01', code: null, label: 'cam-hq-01 down',
          value: null, peakValue: null, threshold: null, unit: '', breachCount: 41,
          clearCount: 0, firstBreachTs: ago(2580), raisedTs: ago(2520), clearedTs: null,
          ackedTs: ago(1900), clearReason: null, notifiedRaise: true, notifiedClear: false },
        { id: 65, key: 'cpu:vc', state: 'active', severity: 'crit',
          kind: 'cpu', host: 'vhost-cluster', code: 'vc', label: 'CPU',
          value: 97.2, peakValue: 98.4, threshold: 95, unit: '%',
          breachCount: 38, clearCount: 0,
          firstBreachTs: ago(2400), raisedTs: ago(2340), clearedTs: null,
          ackedTs: null, clearReason: null, notifiedRaise: true, notifiedClear: false },
        { id: 66, key: 'temp:ct', state: 'active', severity: 'crit', kind: 'temp',
          host: 'core-sw', code: 'ct', label: 'Switch temperature', value: 67,
          peakValue: 67, threshold: 55, unit: 'C', breachCount: 31, clearCount: 0,
          firstBreachTs: ago(2100), raisedTs: ago(2040), clearedTs: null,
          ackedTs: null, clearReason: null, notifiedRaise: true, notifiedClear: false },
        { id: 67, key: 'battery:ub', state: 'active', severity: 'warn', kind: 'battery',
          host: 'ups-01', code: 'ub', label: 'Battery charge', value: 64, peakValue: 64,
          threshold: 50, unit: '%', breachCount: 12, clearCount: 0,
          firstBreachTs: ago(900), raisedTs: ago(840), clearedTs: null,
          ackedTs: null, clearReason: null, notifiedRaise: true, notifiedClear: false },
        { id: 68, key: 'if-util:XW', state: 'active', severity: 'warn', kind: 'if-util',
          host: 'edge-fw', code: 'XW', label: 'wan0 utilization', value: 88.4,
          peakValue: 91.0, threshold: 80, unit: '%', breachCount: 9, clearCount: 0,
          firstBreachTs: ago(700), raisedTs: ago(640), clearedTs: null,
          ackedTs: null, clearReason: null, notifiedRaise: false, notifiedClear: false }
    ];
    // Older, unrelated incidents - the power event is not in here, it is live.
    const stormHistory = () => [
        { id: 60, key: 'disk:nf', state: 'cleared', severity: 'warn', kind: 'disk',
          host: 'nas-01', code: 'nf', label: 'Pool usage', value: 84, peakValue: 88,
          threshold: 85, unit: '%', breachCount: 26, clearCount: 2,
          firstBreachTs: ago(2 * 86400 + 5400), raisedTs: ago(2 * 86400 + 5340),
          clearedTs: ago(2 * 86400), ackedTs: null,
          clearReason: 'recovered', notifiedRaise: true, notifiedClear: true },
        { id: 59, key: 'if-util:XC', state: 'cleared', severity: 'warn', kind: 'if-util',
          host: 'edge-fw', code: 'XC', label: 'cloud0 utilization', value: 78.2,
          peakValue: 93.1, threshold: 80, unit: '%', breachCount: 12, clearCount: 2,
          firstBreachTs: ago(3 * 86400 + 7300), raisedTs: ago(3 * 86400 + 7200),
          clearedTs: ago(3 * 86400), ackedTs: null,
          clearReason: 'recovered', notifiedRaise: true, notifiedClear: true },
        { id: 58, key: 'mem:vm', state: 'cleared', severity: 'warn', kind: 'mem',
          host: 'vhost-cluster', code: 'vm', label: 'Memory', value: 86, peakValue: 89,
          threshold: 85, unit: '%', breachCount: 18, clearCount: 2,
          firstBreachTs: ago(4 * 86400 + 3000), raisedTs: ago(4 * 86400 + 2940),
          clearedTs: ago(4 * 86400), ackedTs: ago(4 * 86400 + 2500),
          clearReason: 'recovered', notifiedRaise: true, notifiedClear: true },
        { id: 57, key: 'device-down:lt-042', state: 'cleared', severity: 'crit',
          kind: 'device-down', host: 'lt-042', code: null, label: 'lt-042 down',
          value: null, peakValue: null, threshold: null, unit: '', breachCount: 54,
          clearCount: 2, firstBreachTs: ago(5 * 86400 + 1800), raisedTs: ago(5 * 86400 + 1740),
          clearedTs: ago(5 * 86400), ackedTs: null,
          clearReason: 'recovered', notifiedRaise: true, notifiedClear: true },
        { id: 56, key: 'temp:ct', state: 'cleared', severity: 'warn', kind: 'temp',
          host: 'core-sw', code: 'ct', label: 'Switch temperature', value: 43,
          peakValue: 49, threshold: 45, unit: 'C', breachCount: 30, clearCount: 2,
          firstBreachTs: ago(6 * 86400 + 4000), raisedTs: ago(6 * 86400 + 3900),
          clearedTs: ago(6 * 86400), ackedTs: null,
          clearReason: 'recovered', notifiedRaise: true, notifiedClear: true }
    ];

    const calmAlerts = () => [
        { id: 41, key: 'device-down:prn-01', state: 'active', severity: 'crit',
          kind: 'device-down', host: 'prn-01', code: null, label: 'prn-01 down',
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
    const calmHistory = () => [
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
        { id: 38, key: 'device-down:fin-ws-01', state: 'cleared', severity: 'crit',
          kind: 'device-down', host: 'fin-ws-01', code: null, label: 'fin-ws-01 down',
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
        { id: 35, key: 'device-down:cam-hq-01', state: 'cleared', severity: 'crit',
          kind: 'device-down', host: 'cam-hq-01', code: null, label: 'cam-hq-01 down',
          value: null, peakValue: null, threshold: null, unit: '', breachCount: 85,
          clearCount: 2, firstBreachTs: ago(3 * 86400 + 2400), raisedTs: ago(3 * 86400 + 2280),
          clearedTs: ago(3 * 86400 - 1500), ackedTs: null,
          clearReason: 'recovered', notifiedRaise: true, notifiedClear: true }
    ];

    const openAlerts = () => (STORM ? stormAlerts() : calmAlerts());
    const history = () => (STORM ? stormHistory() : calmHistory());

    const lvl = (kind) => THRESHOLDS[kind] || null;
    const met = (code, kind, host, display, value, unit, current, rule) => ({
        code, kind, host, display, value, unit: unit || '',
        lowerIsBad: kind === 'battery' || kind === 'runtime',
        rule: rule !== undefined ? rule : lvl(kind),
        source: rule !== undefined ? 'override' : 'default', muted: false, current
    });
    const WATCH_METRICS = STORM ? [
        met('wc', 'cpu', 'intranet-01', 'CPU 38%', 37.5, '%', 'ok'),
        met('vc', 'cpu', 'vhost-cluster', 'CPU 97%', 97.2, '%', 'crit', { warn: 75, crit: 95 }),
        met('vm', 'mem', 'vhost-cluster', 'Mem 78%', 78.1, '%', 'ok'),
        met('nf', 'disk', 'nas-01', 'Pool 71%', 71.2, '%', 'ok'),
        met('ct', 'temp', 'core-sw', '67C', 67, 'C', 'crit'),
        met('mm', 'mem', 'mon-01', 'Mem 64%', 63.9, '%', 'ok'),
        met('ub', 'battery', 'ups-01', 'Batt 64%', 64, '%', 'warn'),
        met('ur', 'runtime', 'ups-01', '18m', 1080, 's', 'ok'),
        met('us', 'state', 'ups-01', 'ON BATTERY', 1, '', 'crit'),
        met('fu', 'uptime', 'edge-fw', 'up 142d', 12268800, 's', null)
    ] : [
        met('wc', 'cpu', 'intranet-01', 'CPU 34%', 33.8, '%', 'ok'),
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
        ['edge-fw', '10.20.0.1', 'up'], ['core-sw', '10.20.0.2', 'up'],
        ['intranet-01', '10.20.10.11', 'up'], ['nas-01', '10.20.10.20', 'up'],
        ['mon-01', '10.20.10.15', 'up'], ['vhost-cluster', '10.20.10.30', 'up'],
        ['ups-01', '10.20.10.44', 'up'], ['prn-01', '10.20.20.60', 'down']
    ].concat(STORM ? [
        // Building A lost wall power: everything not on the UPS went with it.
        ['fin-ws-01', '10.20.20.51', 'down'], ['cam-hq-01', '10.20.20.80', 'down']
    ] : []);
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
                counts: { pending: 0, active: openAlerts().length, clearing: 0 },
                emailError: null, scanIntervalS: 30
            });
        }
        if (path === '/api/alerts') { return reply({ alerts: openAlerts() }); }
        if (path === '/api/alerts/history') { return reply({ alerts: history() }); }
        if (path === '/api/notifications') {
            const n = (id, alertId, alertLabel, channel, event, ts) =>
                ({ id, alertId, alertLabel, channel, event, ts, ok: true, detail: null });
            return reply({ notifications: STORM ? [
                n(140, 68, 'wan0 utilization', 'email', 'raise', ago(635)),
                n(139, 67, 'Battery charge', 'email', 'raise', ago(835)),
                n(138, 66, 'Switch temperature', 'email', 'raise', ago(2035)),
                n(137, 65, 'CPU', 'syslog', 'raise', ago(2334)),
                n(136, 65, 'CPU', 'email', 'raise', ago(2336)),
                n(135, 64, 'cam-hq-01 down', 'email', 'raise', ago(2515)),
                n(134, 63, 'prn-01 down', 'email', 'raise', ago(2525)),
                n(133, 62, 'fin-ws-01 down', 'syslog', 'raise', ago(2534)),
                n(132, 62, 'fin-ws-01 down', 'email', 'raise', ago(2536)),
                n(131, 61, 'Output source', 'syslog', 'raise', ago(2595)),
                n(130, 61, 'Output source', 'email', 'raise', ago(2597))
            ] : [
                n(120, 42, 'CPU', 'email', 'raise', ago(1490)),
                n(119, 41, 'prn-01 down', 'syslog', 'raise', ago(8110)),
                n(118, 41, 'prn-01 down', 'email', 'raise', ago(8112)),
                n(117, 40, 'Output source', 'email', 'clear', ago(3 * 86400 - 8)),
                n(116, 38, 'fin-ws-01 down', 'email', 'clear', ago(3 * 86400 - 905)),
                n(115, 40, 'Output source', 'syslog', 'raise', ago(3 * 86400 + 2395)),
                n(114, 40, 'Output source', 'email', 'raise', ago(3 * 86400 + 2398)),
                n(113, 39, 'Battery charge', 'email', 'raise', ago(3 * 86400 + 1135)),
                n(112, 38, 'fin-ws-01 down', 'email', 'raise', ago(3 * 86400 + 2335)),
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
                statusFile: '/status/snmp-status.json',
                pingStatusFile: '/status/status-all.json', pingDegradedWarn: false,
                scanIntervalS: 30,
                raiseScans: 2, clearScans: 2, staleAfterS: 0, missingScansToClear: 20,
                renotifyIntervalS: 0, retentionDays: 90,
                rebootDetect: true, rebootSeverity: 'warn',
                emailEnabled: true, smtpTo: 'noc@example.com', smtpFrom: 'alerts@example.com',
                smtpHost: 'mail.example.com', smtpPort: 587, smtpMode: 'starttls',
                smtpUser: 'alerts', smtpAllowSelfSigned: false,
                ntfyEnabled: false, ntfyServer: 'https://ntfy.sh', ntfyTopic: '',
                syslogEnabled: true, syslogHost: '10.20.10.20', syslogPort: 514,
                syslogFacility: 16, syslogSevCrit: 2, syslogSevWarn: 4, syslogSevClear: 5,
                tmplSubjectRaise: '[AlertCanvas] {{severity}}: {{label}}',
                tmplBodyRaise: '{{time}}\n{{label}} is {{severity}}: {{detail}}.\n\n-- AlertCanvas',
                tmplSubjectClear: '[AlertCanvas] cleared: {{label}}',
                tmplBodyClear: '{{time}}\n{{label}} returned to normal after {{duration}}.{{reading}}\n\n-- AlertCanvas',
                tmplSyslogRaise: '{{severity}} {{label}} {{detail}}',
                tmplSyslogClear: 'clear {{label}} after {{duration}}{{reading}}',
                thresholds: THRESHOLDS, ifRules: IF_RULES, deviceDown: {},
                smtpPassSet: true, ntfyTokenSet: false,
                dataDir: '/data (demo)', credentialEncryption: true
            });
        }
        return reply({ ok: true });
    };


    // Downloads and exports NAVIGATE (href / location.href) and bypass the
    // fetch shim - on Pages they would land on GitHub 404s. Capture-phase
    // guard: block any /api/* navigation with a small toast instead.
    let toastTimer = null;
    function demoToast(msg) {
        let t = document.getElementById('demo-toast');
        if (!t) {
            t = document.createElement('div');
            t.id = 'demo-toast';
            t.style.cssText = 'position:fixed;bottom:42px;right:10px;z-index:999;background:var(--se-panel,#262a33);border:1px solid var(--se-accent,#4c8bf5);color:var(--se-txt,#e6e9ef);padding:5px 12px;border-radius:6px;font-size:12px;';
            document.body.appendChild(t);
        }
        t.textContent = msg;
        t.style.display = '';
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function () { t.style.display = 'none'; }, 2600);
    }
    document.addEventListener('click', function (ev) {
        const el = ev.target && ev.target.closest ? ev.target.closest('a[href*=\'/api/\']') : null;
        if (el) {
            ev.preventDefault();
            ev.stopPropagation();
            demoToast('static demo - downloads and exports are disabled');
        }
    }, true);
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
