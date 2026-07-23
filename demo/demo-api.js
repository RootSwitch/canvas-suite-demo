'use strict';
// DEMO SHIM - this is the static showcase build (GitHub Pages). There is no
// server: window.fetch answers /api/* from the canned fixtures below, writes
// pretend to succeed, and nothing is ever monitored. The real apps are at
// github.com/RootSwitch - this exists so you can click around without
// deploying anything.
(function () {
    const realFetch = window.fetch.bind(window);

    const FIXTURES = {
        '/api/session': { authenticated: true, user: 'demo', needsSetup: false },
        '/api/settings': {
            sso: true,
            board: { enabled: false },
            // Tile destinations for the demo: CrossCanvas's live Pages editor,
            // the static kiosk with the mock fleet, GitHub for the apps whose
            // shimmed UIs are not built yet.
            url_crosscanvas: 'https://rootswitch.github.io/CrossCanvas/?sample=complex&fit=1',
            url_pingcanvas: 'kiosk/kiosk.html?board=data/board.xcanvas&status=data/status.json&snmp=data/snmp-status.json&staleMul=9999999',
            url_snmpcanvas: 'snmpcanvas/',
            url_syslogcanvas: 'syslogcanvas/',
            url_alertcanvas: 'alertcanvas/'
        },
        '/api/users': { users: [{ id: 1, username: 'demo', createdAt: '2026-07-20', self: true }] }
    };

    window.fetch = function (url, opts) {
        const path = String(url).split('?')[0];
        const key = path.startsWith('/') ? path : '/' + path;
        if (key.startsWith('/api/')) {
            const body = FIXTURES[key] || { ok: true };
            return Promise.resolve(new Response(JSON.stringify(body), {
                status: 200, headers: { 'Content-Type': 'application/json' }
            }));
        }
        return realFetch(url, opts);
    };

    // A quiet, persistent marker so screenshots of this page can never be
    // mistaken for a claim that something is deployed and monitoring - plus
    // the door to the incident variant of the wall (same board, bad-day
    // feeds: a power event in Building A).
    window.addEventListener('DOMContentLoaded', function () {
        const wrap = document.createElement('div');
        wrap.id = 'demo-ribbon';
        wrap.style.cssText = 'position:fixed;bottom:10px;right:10px;z-index:999;' +
            'display:flex;gap:8px;align-items:center;font-size:11px;letter-spacing:0.5px;';
        const chip = 'background:var(--se-panel,#262a33);border:1px solid var(--se-warn,#d9a92f);' +
            'padding:3px 10px;border-radius:9px;';
        const marker = document.createElement('span');
        marker.textContent = 'static demo - nothing is being monitored';
        marker.style.cssText = chip + 'color:var(--se-warn,#d9a92f);';
        const bad = document.createElement('a');
        bad.textContent = 'the 2 AM version';
        bad.title = 'The same wall during an incident: a power event in Building A';
        bad.href = 'kiosk/kiosk.html?board=data/board.xcanvas&status=data/bad-status.json&snmp=data/bad-snmp-status.json&staleMul=9999999';
        bad.target = '_blank'; bad.rel = 'noopener';
        bad.style.cssText = chip + 'color:var(--se-down,#d64545);border-color:var(--se-down,#d64545);text-decoration:none;';
        wrap.appendChild(marker); wrap.appendChild(bad);
        document.body.appendChild(wrap);
    });
})();
