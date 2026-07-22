'use strict';
// DEMO SHIM for SyslogCanvas - static showcase, no server. A deterministic
// message stream for the Acme fleet is generated at request time (one message
// every ~6s, content hashed from the slot number), so the tail is always
// full, always fresh, and identical on every reload. Filtering supports the
// common cases: words, "quoted phrases", host:/app:/ip:/proto:, sev:<=N, -not.
(function () {
    const realFetch = window.fetch.bind(window);
    const now = () => Math.floor(Date.now() / 1000);
    const SLOT = 6;
    const h = (s) => { let x = (s | 0) + 0x9e3779b9; x = Math.imul(x ^ (x >>> 16), 0x21f0aaad); x = Math.imul(x ^ (x >>> 15), 0x735a2d97); return (x ^ (x >>> 15)) >>> 0; };

    // [weight, host, ip, proto, app, facility, sev(hash), msg(hash)]
    const sev = (base, spice) => (k) => (k % 17 === 0 ? spice : base);
    const POOL = [];
    const add = (w, host, ip, proto, app, fac, sevFn, msgFn) => { for (let i = 0; i < w; i++) POOL.push({ host, ip, proto, app, fac, sevFn, msgFn }); };
    add(5, 'edge-fw', '10.20.0.15', 'syslog', 'filterlog', 16, sev(6, 4), (k) =>
        `${k % 2 ? 'pass' : 'block'},in,igb0,tcp,10.31.${k % 254}.${(k >> 3) % 254}:${1024 + (k % 50000)},10.20.0.19:443`);
    add(2, 'edge-fw', '10.20.0.15', 'syslog', 'openvpn', 1, sev(5, 5), (k) =>
        `user 'remote${1 + (k % 9)}' authenticated, session established from 172.16.${k % 254}.${(k >> 2) % 254}`);
    add(1, 'edge-fw', '10.20.0.15', 'syslog', 'dhcpd', 1, sev(6, 6), (k) =>
        `DHCPACK on 10.20.0.${100 + (k % 120)} to aa:bb:cc:${(k % 256).toString(16).padStart(2, '0')}:1f:0${k % 10} via lan0`);
    add(3, 'core-sw', '10.20.0.16', 'syslog', 'link', 23,
        (k) => (k % 23 === 0 ? (k % 2 ? 5 : 3) : 5),   // LINEPROTO down = err
        (k) => k % 23 === 0 ? `%LINEPROTO-5-UPDOWN: Line protocol on Interface GigabitEthernet1/0/${1 + (k % 24)}, changed state to ${k % 2 ? 'up' : 'down'}`
                            : `%SEC_LOGIN-5-LOGIN_SUCCESS: Login Success [user: netops] [Source: 10.20.0.24] [localport: 22]`);
    add(1, 'core-sw', '10.20.0.16', 'trap', 'snmptrap', 23, () => 5, (k) =>
        `linkUp trap: ifIndex ${1 + (k % 24)}, ifDescr GigabitEthernet1/0/${1 + (k % 24)}, ifOperStatus up(1)`);
    add(3, 'web-01', '10.20.0.19', 'syslog', 'nginx', 1, sev(6, 4), (k) =>
        `10.31.${(k >> 1) % 254}.${k % 254} "GET /${['', 'api/orders', 'assets/app.js', 'login', 'api/health'][k % 5]} HTTP/1.1" ${k % 29 === 0 ? 502 : 200} ${180 + (k % 42000)}`);
    add(1, 'web-01', '10.20.0.19', 'syslog', 'sshd', 4, sev(6, 4), (k) =>
        k % 11 === 0 ? `Failed password for invalid user admin from 10.31.7.${k % 254} port ${40000 + (k % 20000)} ssh2`
                     : `Accepted publickey for deploy from 10.20.0.24 port ${40000 + (k % 20000)} ssh2`);
    add(2, 'nas-01', '10.20.0.21', 'syslog', 'smbd', 1, sev(6, 5), (k) =>
        `connection to service backup from web-01 (10.20.0.19) ${k % 2 ? 'opened' : 'closed'}`);
    add(1, 'nas-01', '10.20.0.21', 'syslog', 'zfs', 1, sev(5, 5), (k) =>
        `zpool volume1 scrub in progress: ${(k % 97) + 1}% done, 0 errors`);
    add(2, 'vhost-cluster', '10.20.0.25', 'syslog', 'pvedaemon', 1, sev(6, 5), (k) =>
        `<root@pam> ${['starting task vzdump', 'end task vzdump OK', 'VM 10${k % 9} qmp command success', 'migration of VM 10' + (k % 9) + ' finished'][k % 4]}`);
    add(1, 'mon-01', '10.20.0.24', 'syslog', 'cron', 9, () => 6, (k) =>
        `(root) CMD (/usr/local/bin/feed-check.sh${k % 2 ? ' --quiet' : ''})`);
    add(1, 'ap-attic', '10.20.0.30', 'syslog', 'hostapd', 1, sev(6, 5), (k) =>
        `wlan0: STA 3a:7f:12:9d:2${k % 10}:1b IEEE 802.11: ${k % 2 ? 'associated' : 'disassociated'}`);
    add(1, 'ups-01', '10.20.0.44', 'trap', 'snmptrap', 23, () => 5, (k) =>
        `upsTrapOnBatteryTest: self-test ${k % 2 ? 'started' : 'passed'}, battery 100%, runtime 3120s`);

    const msgAt = (s) => {
        const k = h(s);
        const t = POOL[k % POOL.length];
        return {
            id: s, ts: s * SLOT + (k % SLOT), msgTs: null,
            sourceIp: t.ip, proto: t.proto, facility: t.fac,
            severity: t.sevFn(k), host: t.host, app: t.app, msg: t.msgFn(k)
        };
    };

    function parseQ(q) {
        const toks = [];
        const re = /"([^"]*)"|(\S+)/g;
        let m;
        while ((m = re.exec(q || ''))) toks.push(m[1] !== undefined ? { text: m[1] } : { raw: m[2] });
        return toks.map((t) => {
            if (t.text !== undefined) return { type: 'text', v: t.text.toLowerCase(), neg: false };
            let raw = t.raw, neg = false;
            if (raw.startsWith('-')) { neg = true; raw = raw.slice(1); }
            const kv = raw.match(/^(host|app|ip|proto):(.*)$/i);
            if (kv) return { type: kv[1].toLowerCase(), v: kv[2].toLowerCase(), neg };
            const sv = raw.match(/^sev:(<=|>=|=)?(\d)$/i);
            if (sv) return { type: 'sev', op: sv[1] || '=', v: +sv[2], neg };
            return { type: 'text', v: raw.toLowerCase(), neg };
        });
    }
    const matches = (r, toks) => toks.every((t) => {
        let hit;
        if (t.type === 'sev') hit = t.op === '<=' ? r.severity <= t.v : t.op === '>=' ? r.severity >= t.v : r.severity === t.v;
        else if (t.type === 'text') hit = (r.msg + ' ' + r.host + ' ' + r.app).toLowerCase().includes(t.v);
        else hit = String(t.type === 'ip' ? r.sourceIp : r[t.type]).toLowerCase().includes(t.v);
        return t.neg ? !hit : hit;
    });

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
        if (path === '/api/messages') {
            const limit = Math.min(1000, Math.max(1, parseInt(q.get('limit'), 10) || 200));
            const toks = parseQ(q.get('q'));
            const beforeTs = parseInt(q.get('before_ts'), 10);
            const beforeId = parseInt(q.get('before_id'), 10);
            let s = !Number.isNaN(beforeId) ? beforeId - 1 : Math.floor((now() - 3) / SLOT);
            if (!Number.isNaN(beforeTs)) { s = Math.min(s, Math.floor(beforeTs / SLOT)); }
            const out = [];
            for (let i = 0; i < 60000 && out.length <= limit && s >= 0; i++, s--) {
                const r = msgAt(s);
                if (matches(r, toks)) out.push(r);
            }
            const hasMore = out.length > limit;
            if (hasMore) out.pop();
            return reply({ messages: out, hasMore });
        }
        if ((m = path.match(/^\/api\/messages\/(\d+)$/))) {
            const r = msgAt(+m[1]);
            const pri = r.facility * 8 + r.severity;
            const stamp = new Date(r.ts * 1000).toISOString();
            return reply({ message: Object.assign({}, r, {
                raw: `<${pri}>1 ${stamp} ${r.host} ${r.app} - - - ${r.msg}`
            }) });
        }
        if (path === '/api/stats') {
            return reply({
                rowCount: 500000, oldestTs: now() - 26 * 86400, newestTs: now() - 4,
                dbBytes: 241563648,
                topSources: [
                    { sourceIp: '10.20.0.15', n: 168044 }, { sourceIp: '10.20.0.19', n: 92310 },
                    { sourceIp: '10.20.0.16', n: 74921 }, { sourceIp: '10.20.0.25', n: 55870 },
                    { sourceIp: '10.20.0.21', n: 48112 }, { sourceIp: '10.20.0.30', n: 24788 },
                    { sourceIp: '10.20.0.24', n: 20416 }, { sourceIp: '10.20.0.44', n: 8241 }
                ],
                ingest: { received: 1834211, dropped: 0, queued: 2 }
            });
        }
        if (path === '/api/settings') {
            return reply({ retentionDays: 90, maxRows: 500000, dataDir: '/data (demo)',
                syslogPort: 5514, trapPort: 5162 });
        }
        return reply({ ok: true });
    };

    window.addEventListener('DOMContentLoaded', function () {
        const r = document.createElement('div');
        r.id = 'demo-ribbon';
        r.textContent = 'static demo - synthetic log stream, nothing is listening';
        r.style.cssText = 'position:fixed;bottom:10px;right:10px;z-index:999;' +
            'background:var(--se-panel,#262a33);border:1px solid var(--se-warn,#d9a92f);' +
            'color:var(--se-warn,#d9a92f);padding:3px 10px;border-radius:9px;' +
            'font-size:11px;letter-spacing:0.5px;pointer-events:none;';
        document.body.appendChild(r);
    });
})();
