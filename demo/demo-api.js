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
            url_pingcanvas: 'kiosk/kiosk.html?board=data/board.xcanvas&status=data/status.json&staleMul=9999999',
            url_snmpcanvas: 'https://github.com/RootSwitch/SNMPCanvas',
            url_syslogcanvas: 'https://github.com/RootSwitch/SyslogCanvas',
            url_alertcanvas: 'https://github.com/RootSwitch/AlertCanvas'
        },
        '/api/users': { users: [{ username: 'demo', createdTs: 0 }] }
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
    // mistaken for a claim that something is deployed and monitoring.
    window.addEventListener('DOMContentLoaded', function () {
        const r = document.createElement('div');
        r.id = 'demo-ribbon';
        r.textContent = 'static demo - nothing is being monitored';
        r.style.cssText = 'position:fixed;bottom:10px;right:10px;z-index:999;' +
            'background:var(--se-panel,#262a33);border:1px solid var(--se-warn,#d9a92f);' +
            'color:var(--se-warn,#d9a92f);padding:3px 10px;border-radius:9px;' +
            'font-size:11px;letter-spacing:0.5px;pointer-events:none;';
        document.body.appendChild(r);
    });
})();
