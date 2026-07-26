'use strict';
// DEMO SHIM for SNMPCanvas - static showcase, no server. window.fetch answers
// /api/* from the synthetic Acme fleet below (the same fleet the kiosk demo
// shows). Timestamps and graph history are generated at request time relative
// to "now", so pages and 24h graphs read alive; writes pretend to succeed.
(function () {
    const realFetch = window.fetch.bind(window);
    const now = () => Math.floor(Date.now() / 1000);
    const DAY = 86400;

    // deterministic per-entity noise (no Math.random: reloads look identical)
    const wob = (seed, t, period, amp) =>
        amp * Math.sin((t / period) * 2 * Math.PI + seed * 2.7) +
        (amp / 3) * Math.sin((t / (period / 3.7)) * 2 * Math.PI + seed * 5.1);

    // --- entity catalog ------------------------------------------------------
    // gen(t) returns [v0..v5]; for 'if' v0=inBps v1=outBps.
    let EID = 100;
    const ent = (kind, name, o) => Object.assign({
        id: EID++, kind, snmpIndex: String(EID), name, alias: o && o.alias || '',
        code: null, speedBps: null, tracked: true, export: false, stale: false,
        // ifAdmin/ifOperStatus are NUMERIC (1=up); non-if kinds carry null.
        adminStatus: kind === 'if' ? 1 : null, operStatus: kind === 'if' ? 1 : null,
        hc: kind === 'if' ? true : undefined
    }, o || {});

    const IF = (name, speed, inBase, outBase, o) => ent('if', name, Object.assign({
        speedBps: speed,
        // clamped under line rate: the max-band rendering adds ~12% on top
        gen: (t) => [Math.min(speed * 0.86, Math.max(2e5, inBase + wob(inBase % 97, t, DAY, inBase * 0.45))),
                     Math.min(speed * 0.86, Math.max(1e5, outBase + wob(outBase % 89, t, DAY, outBase * 0.4))),
                     0, 0, 0, 0]
    }, o || {}));
    const PCT = (kind, name, base, amp, o) => ent(kind, name, Object.assign({
        gen: (t) => [Math.min(99, Math.max(1, base + wob(base, t, DAY, amp))), 0, 0, 0, 0, 0]
    }, o || {}));
    // mem/fs render as used/total BYTES (percent is derived by the UI).
    const USAGE = (kind, name, basePct, amp, totalBytes, o) => ent(kind, name, Object.assign({
        gen: (t) => {
            const pct = Math.min(99, Math.max(1, basePct + wob(basePct, t, DAY, amp)));
            return [pct / 100 * totalBytes, totalBytes, 0, 0, 0, 0];
        }
    }, o || {}));
    const FLAT = (kind, name, val, o) => ent(kind, name, Object.assign({ gen: () => [val, 0, 0, 0, 0, 0] }, o || {}));

    const upt = (days) => days * DAY + 14580;
    // Addresses come from the Complex sample's estate (the board is the single
    // source of truth): 10.20.0.x core, .10.x HQ servers, .20.x HQ users,
    // .21.x retail branch, .22.x warehouse branch, .30.x cloud VPC. The polled
    // set is a SUBSET on purpose - you do not SNMP-poll workstations, POS
    // terminals or cameras - so the infrastructure is here and the endpoints
    // are not.
    const DEVICES = [
        { id: 1, name: 'edge-fw', host: '10.20.0.1', vendorKey: 'generic',
          sysDescr: 'pfSense 2.7 (FreeBSD)', uptimeSeconds: upt(142), exportUptime: true,
          entities: [
              IF('wan0', 1e9, 412e6, 96e6, { alias: 'fiber uplink', code: 'XW2' }),
              IF('cloud0', 1e9, 872e6, 240e6, { alias: 'cloud VPC', code: 'XC', export: true }),
              IF('lan0', 1e9, 340e6, 310e6, { alias: 'inside' }),
              PCT('cpu', 'CPU', 22, 10),
              USAGE('mem', 'Memory', 41, 6, 8 * 1024 ** 3)
          ] },
        { id: 2, name: 'core-sw', host: '10.20.0.2', vendorKey: 'cisco',
          sysDescr: 'Cisco IOS Software, Catalyst L3 Switch', uptimeSeconds: upt(89),
          entities: [
              IF('Gi1/0/1', 1e9, 412e6, 96e6, { alias: 'WAN uplink', code: 'XW', export: true }),
              IF('Gi1/0/2', 1e9, 210e6, 180e6, { alias: 'server aggregation' }),
              IF('Gi1/0/3', 1e9, 88e6, 64e6, { alias: 'user access' }),
              IF('Gi1/0/4', 1e9, 41e6, 12e6, { alias: 'voice vlan' }),
              IF('Gi1/0/24', 1e9, 2e6, 1e6, { alias: 'mgmt' }),
              PCT('cpu', 'CPU', 18, 9),
              FLAT('temp', 'Switch temperature', 41, { unit: 'C', code: 'ct', export: true })
          ] },
        { id: 3, name: 'ids-01', host: '10.20.0.5', vendorKey: 'generic',
          sysDescr: 'Suricata 7 sensor (Debian 12, net-snmp)', uptimeSeconds: upt(76),
          entities: [
              PCT('cpu', 'CPU', 57, 16),
              USAGE('mem', 'Memory', 68, 5, 32 * 1024 ** 3),
              IF('mon0', 1e9, 640e6, 1e6, { alias: 'core SPAN' }),
              USAGE('fs', '/var/log/suricata', 62, 1, 2 * 1024 ** 4)
          ] },
        { id: 4, name: 'wlc-01', host: '10.20.0.6', vendorKey: 'cisco',
          sysDescr: 'Cisco Wireless LAN Controller', uptimeSeconds: upt(118),
          entities: [
              PCT('cpu', 'CPU', 26, 8),
              USAGE('mem', 'Memory', 44, 4, 8 * 1024 ** 3),
              IF('Gi0/0/1', 1e9, 180e6, 210e6, { alias: 'to core' }),
              FLAT('temp', 'Chassis temperature', 36, { unit: 'C' })
          ] },
        { id: 5, name: 'acc-sw-01', host: '10.20.0.10', vendorKey: 'cisco',
          sysDescr: 'Cisco IOS Software, Catalyst access switch', uptimeSeconds: upt(211),
          entities: [
              IF('Gi1/0/1', 1e9, 96e6, 122e6, { alias: 'uplink to core' }),
              IF('Gi1/0/8', 1e9, 18e6, 9e6, { alias: 'user ports' }),
              IF('Gi1/0/12', 1e9, 6e6, 22e6, { alias: 'PoE cameras' }),
              PCT('cpu', 'CPU', 12, 5),
              FLAT('temp', 'Switch temperature', 39, { unit: 'C' })
          ] },
        { id: 6, name: 'intranet-01', host: '10.20.10.11', vendorKey: 'generic',
          sysDescr: 'Ubuntu 24.04 LTS (net-snmp)', uptimeSeconds: upt(38),
          entities: [
              PCT('cpu', 'CPU', 31, 12, { code: 'wc', export: true }),
              USAGE('mem', 'Memory', 47, 6, 16 * 1024 ** 3),
              IF('ens18', 1e9, 96e6, 154e6, { alias: 'app traffic' }),
              USAGE('fs', '/', 44, 1, 512 * 1024 ** 3)
          ] },
        { id: 7, name: 'erp-01', host: '10.20.10.12', vendorKey: 'generic',
          sysDescr: 'Windows Server 2022 (SNMP service)', uptimeSeconds: upt(29),
          entities: [
              PCT('cpu', 'CPU', 48, 15),
              USAGE('mem', 'Memory', 76, 6, 64 * 1024 ** 3),
              IF('Ethernet0', 1e9, 210e6, 138e6, { alias: 'app + database' }),
              USAGE('fs', 'D: (database)', 67, 1, 2 * 1024 ** 4)
          ] },
        { id: 8, name: 'dc-01', host: '10.20.10.13', vendorKey: 'generic',
          sysDescr: 'Windows Server 2022 (domain controller)', uptimeSeconds: upt(96),
          entities: [
              PCT('cpu', 'CPU', 14, 6),
              USAGE('mem', 'Memory', 52, 4, 16 * 1024 ** 3),
              IF('Ethernet0', 1e9, 24e6, 31e6, { alias: 'directory + DNS' })
          ] },
        { id: 9, name: 'nac-01', host: '10.20.10.14', vendorKey: 'generic',
          sysDescr: 'Rocky Linux 9 (net-snmp) - NAC appliance', uptimeSeconds: upt(53),
          entities: [
              PCT('cpu', 'CPU', 22, 9),
              USAGE('mem', 'Memory', 58, 5, 32 * 1024 ** 3),
              IF('ens192', 1e9, 12e6, 8e6, { alias: 'RADIUS' })
          ] },
        { id: 10, name: 'mon-01', host: '10.20.10.15', vendorKey: 'generic',
          sysDescr: 'Debian 12 (net-snmp) - monitoring host', uptimeSeconds: upt(64),
          entities: [
              PCT('cpu', 'CPU', 9, 4),
              USAGE('mem', 'Memory', 62, 4, 16 * 1024 ** 3, { code: 'mm', export: true }),
              IF('eth0', 1e9, 8e6, 3e6, { alias: 'polling + feeds' })
          ] },
        { id: 11, name: 'nas-01', host: '10.20.10.20', vendorKey: 'synology',
          sysDescr: 'Synology DSM 7.2', uptimeSeconds: upt(121),
          entities: [
              PCT('cpu', 'CPU', 11, 5),
              USAGE('mem', 'Memory', 33, 4, 32 * 1024 ** 3),
              USAGE('fs', 'volume1', 71, 0.5, 48 * 1024 ** 4, { code: 'nf', export: true }),
              IF('eth0', 1e9, 120e6, 260e6, { alias: 'backup target' }),
              FLAT('temp', 'System temperature', 38, { unit: 'C' })
          ] },
        { id: 12, name: 'vhost-cluster', host: '10.20.10.30', vendorKey: 'generic',
          sysDescr: 'Proxmox VE 8 (Debian GNU/Linux)', uptimeSeconds: upt(204),
          entities: [
              PCT('cpu', 'CPU', 74, 14, { code: 'vc', export: true }),
              USAGE('mem', 'Memory', 71, 5, 256 * 1024 ** 3, { code: 'vm', export: true }),
              IF('bond0', 2e9, 610e6, 480e6, { alias: 'LACP to core' }),
              USAGE('fs', '/var/lib/vz', 58, 1, 4 * 1024 ** 4)
          ] },
        { id: 13, name: 'ups-01', host: '10.20.10.44', vendorKey: 'apc',
          sysDescr: 'APC Smart-UPS 2200 (AP9641)', uptimeSeconds: upt(203), exportUptime: true,
          entities: [
              FLAT('battery', 'Battery charge', 100, { unit: '%', code: 'ub', export: true }),
              FLAT('runtime', 'Runtime remaining', 52 * 60, { code: 'ur', export: true }),
              FLAT('state', 'Output source', 0, { okText: 'On mains', alarmText: 'ON BATTERY', code: 'us', export: true }),
              FLAT('power', 'Output load', 738),
              FLAT('temp', 'Internal temperature', 24, { unit: 'C' }),
              FLAT('meter', 'Output voltage', 230, { unit: 'V' })
          ] },
        { id: 14, name: 'ap-hq-01', host: '10.20.20.10', vendorKey: 'generic',
          sysDescr: 'OpenWrt 23.05 (hostapd)', uptimeSeconds: upt(47),
          entities: [
              PCT('cpu', 'CPU', 19, 7),
              USAGE('mem', 'Memory', 51, 4, 512 * 1024 ** 2),
              IF('br-lan', 1e9, 88e6, 142e6, { alias: 'HQ wireless' })
          ] },
        { id: 15, name: 'br1-rtr', host: '10.20.21.1', vendorKey: 'generic',
          sysDescr: 'MikroTik RouterOS 7 - retail branch', uptimeSeconds: upt(157),
          entities: [
              IF('ether1', 1e9, 62e6, 28e6, { alias: 'branch uplink' }),
              IF('ether2', 1e9, 30e6, 47e6, { alias: 'branch LAN' }),
              PCT('cpu', 'CPU', 16, 7),
              FLAT('temp', 'Board temperature', 43, { unit: 'C' })
          ] },
        { id: 16, name: 'pos-sw', host: '10.20.21.2', vendorKey: 'generic',
          sysDescr: 'Netgear smart switch - retail floor', uptimeSeconds: upt(157),
          entities: [
              IF('port1', 1e9, 28e6, 60e6, { alias: 'uplink to br1-rtr' }),
              IF('port4', 1e9, 4e6, 2e6, { alias: 'POS terminals' }),
              PCT('cpu', 'CPU', 8, 3)
          ] },
        { id: 17, name: 'br2-rtr', host: '10.20.22.1', vendorKey: 'generic',
          sysDescr: 'MikroTik RouterOS 7 - warehouse branch', uptimeSeconds: upt(88),
          entities: [
              // The warehouse rides a geostationary satellite: the link is slow
              // and busy, which is what makes it the interesting branch.
              IF('ether1', 20e6, 14e6, 5e6, { alias: 'satellite uplink' }),
              IF('ether2', 1e9, 22e6, 34e6, { alias: 'warehouse LAN' }),
              PCT('cpu', 'CPU', 21, 8),
              FLAT('temp', 'Board temperature', 47, { unit: 'C' })
          ] },
        { id: 18, name: 'br2-sw', host: '10.20.22.2', vendorKey: 'generic',
          sysDescr: 'Netgear smart switch - warehouse floor', uptimeSeconds: upt(88),
          entities: [
              IF('port1', 1e9, 34e6, 22e6, { alias: 'uplink to br2-rtr' }),
              IF('port6', 1e9, 3e6, 1e6, { alias: 'conveyor PLC' }),
              PCT('cpu', 'CPU', 7, 3)
          ] },
        { id: 19, name: 'sat-modem', host: '10.20.22.3', vendorKey: 'generic',
          sysDescr: 'VSAT terminal (SNMP agent)', uptimeSeconds: upt(88),
          entities: [
              IF('sat0', 20e6, 14e6, 5e6, { alias: 'space segment' }),
              FLAT('meter', 'Signal quality', 74, { unit: '%' }),
              FLAT('temp', 'Outdoor unit temperature', 51, { unit: 'C' })
          ] },
        { id: 20, name: 'wh-ap', host: '10.20.22.10', vendorKey: 'generic',
          sysDescr: 'OpenWrt 23.05 (hostapd) - warehouse', uptimeSeconds: upt(88),
          entities: [
              PCT('cpu', 'CPU', 15, 6),
              USAGE('mem', 'Memory', 46, 4, 512 * 1024 ** 2),
              IF('br-lan', 1e9, 18e6, 26e6, { alias: 'scanner wireless' })
          ] },
        { id: 21, name: 'lb-01', host: '10.20.30.10', vendorKey: 'generic',
          sysDescr: 'HAProxy 2.9 (Debian 12) - cloud VPC', uptimeSeconds: upt(230),
          entities: [
              PCT('cpu', 'CPU', 28, 11),
              USAGE('mem', 'Memory', 39, 5, 8 * 1024 ** 3),
              IF('eth0', 1e9, 512e6, 604e6, { alias: 'front end' }),
              IF('eth1', 1e9, 480e6, 430e6, { alias: 'to app VMs' })
          ] }
    ];

    const allEnts = {};
    DEVICES.forEach((d) => d.entities.forEach((e) => { e.deviceId = d.id; allEnts[e.id] = e; }));

    // The one device the wizard "finds": web-01, a cloud App VM that is on the
    // board but not yet in the polled set above - which is exactly the device
    // you would be adding next.
    const DISCOVER = new URLSearchParams(location.search).get('demo') === 'discover';
    const inv = (kind, snmpIndex, name, o) => Object.assign(
        { kind, snmpIndex, name, alias: '', tracked: kind !== 'if' || snmpIndex === '2',
          speedBps: null, operStatus: null, extra: null }, o || {});
    const probeResult = () => ({
        probeToken: 'demo-probe-token',
        vendorKey: 'generic',
        warnings: [],
        system: { sysName: 'web-01',
                  sysDescr: 'Linux web-01 6.8.0-41-generic #41-Ubuntu SMP x86_64' },
        entities: [
            inv('if', '1', 'lo', { speedBps: 10e6, operStatus: 1, tracked: false }),
            inv('if', '2', 'ens18', { alias: 'app traffic', speedBps: 1e9, operStatus: 1 }),
            inv('if', '3', 'ens19', { alias: 'backup vlan', speedBps: 1e9, operStatus: 2, tracked: false }),
            inv('cpu', '0', 'CPU (2 cores)'),
            inv('mem', '1', 'Physical memory'),
            inv('fs', '2', '/'),
            inv('fs', '3', '/var/log')
        ]
    });

    const latestOf = (e) => {
        const t = now();
        const v = e.gen(t);
        return { ts: t - 9, status: 'up', v };
    };

    const deviceSummary = (d) => ({
        id: d.id, name: d.name, host: d.host, port: 161, snmpVersion: '2c',
        sysDescr: d.sysDescr, sysName: d.name, vendorKey: d.vendorKey,
        enabled: true, status: 'up', notes: '',
        exportUptime: !!d.exportUptime, uptimeCode: d.exportUptime ? 'u' + d.id : null,
        lastPollTs: now() - 9, lastSeenTs: now() - 9,
        uptimeSeconds: d.uptimeSeconds, pollIntervalS: null, effectiveIntervalS: 30
    });

    const listEntry = (d) => {
        const cpu = d.entities.find((e) => e.kind === 'cpu');
        let topIf = null;
        d.entities.filter((e) => e.kind === 'if').forEach((e) => {
            const v = e.gen(now());
            const bps = Math.max(v[0], v[1]);
            if (!topIf || bps > topIf.bps) {
                topIf = { entityId: e.id, name: e.name, bps, pct: e.speedBps > 0 ? bps / e.speedBps * 100 : null };
            }
        });
        return Object.assign(deviceSummary(d), {
            interfaceCount: d.entities.filter((e) => e.kind === 'if').length,
            cpuPct: cpu ? cpu.gen(now())[0] : null,
            topIf
        });
    };

    function samples(e, q) {
        const to = parseInt(q.get('to'), 10) || now();
        const from = parseInt(q.get('from'), 10) || (to - DAY);
        const maxPoints = Math.min(2000, Math.max(50, parseInt(q.get('maxPoints'), 10) || 500));
        const base = 30;
        const bucket = Math.max(base, Math.ceil((to - from) / maxPoints / base) * base);
        const points = [];
        for (let t = Math.ceil(from / bucket) * bucket; t <= to; t += bucket) {
            const v = e.gen(t);
            points.push([t, v[0], v[0] * 1.12, v[1], v[1] * 1.12, v[2], v[3], v[4], v[5], 1]);
        }
        let p95 = null;
        if (e.kind === 'if') {
            const q95 = (i) => points.map((p) => p[i]).sort((a, b) => a - b)[Math.floor(points.length * 0.95)] || null;
            p95 = { in: q95(1), out: q95(3) };
        }
        return { kind: e.kind, name: e.name, code: e.code, speedBps: e.speedBps,
                 bucketSec: bucket, from, to, p95,
                 unit: e.unit, meterMax: e.meterMax, okText: e.okText, alarmText: e.alarmText,
                 points };
    }

    // --- the interceptor -----------------------------------------------------
    window.fetch = function (url, opts) {
        const u = String(url);
        const qPos = u.indexOf('?');
        const path = (qPos < 0 ? u : u.slice(0, qPos)).replace(/^[^/]*\/\/[^/]*/, '');
        const q = new URLSearchParams(qPos < 0 ? '' : u.slice(qPos + 1));
        if (!path.startsWith('/api/')) { return realFetch(url, opts); }
        const reply = (body, status) => Promise.resolve(new Response(JSON.stringify(body), {
            status: status || 200, headers: { 'Content-Type': 'application/json' }
        }));
        let m;
        if (path === '/api/session') { return reply({ authenticated: true, needsSetup: false }); }
        // Probe/rediscover reach for real devices - a clean, honest failure
        // beats the raw TypeError the {ok:true} catch-all used to cause.
        if (path === '/api/devices/probe' || /^\/api\/devices\/\d+\/rediscover$/.test(path)) {
            // ?demo=discover answers one canned probe instead, for the app
            // repo's hero image: the add-device wizard is the first thing a new
            // user meets and a 502 makes a poor screenshot. Opt-in, so the
            // honest failure above stays what the live demo actually does.
            if (DISCOVER) { return reply(probeResult()); }
            return reply({ error: 'probing live devices is disabled in this static demo' }, 502);
        }
        if (path === '/api/devices') { return reply({ devices: DEVICES.map(listEntry) }); }
        if ((m = path.match(/^\/api\/devices\/(\d+)$/))) {
            const d = DEVICES.find((x) => x.id === +m[1]);
            if (!d) { return reply({ error: 'not found' }, 404); }
            return reply({ device: deviceSummary(d), entities: d.entities.map((e) => Object.assign({}, e, { gen: undefined, latest: latestOf(e) })) });
        }
        if ((m = path.match(/^\/api\/entities\/(\d+)\/samples$/))) {
            const e = allEnts[+m[1]];
            if (!e) { return reply({ error: 'not found' }, 404); }
            return reply(samples(e, q));
        }
        if (path === '/api/settings') {
            return reply({ pollIntervalS: 30, retentionDays: 30,
                exportPath: '/data/snmp-status.json', exportError: null,
                dataDir: '/data (demo)', credentialEncryption: true });
        }
        return reply({ ok: true });   // writes and everything else: pretend
    };

    // demo marker (same look as the launcher's)

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
        r.textContent = 'static demo - synthetic fleet, nothing is polled';
        r.style.cssText = 'position:fixed;bottom:10px;right:10px;z-index:999;' +
            'background:var(--se-panel,#262a33);border:1px solid var(--se-warn,#d9a92f);' +
            'color:var(--se-warn,#d9a92f);padding:3px 10px;border-radius:9px;' +
            'font-size:11px;letter-spacing:0.5px;pointer-events:none;';
        document.body.appendChild(r);
    });
})();
