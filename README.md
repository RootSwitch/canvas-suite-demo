# Canvas Suite Demo - the static showroom

> Click around the [Canvas suite](https://github.com/RootSwitch/LaunchCanvas)
> without installing anything. Nothing here is monitoring anything: it is the
> real apps' frontends served statically, answered by canned fixtures.

**Live at: https://rootswitch.github.io/canvas-suite-demo/**

What you're looking at:

- The **LaunchCanvas launcher** is the front page - the real portal UI with a
  demo shim standing in for its API (you are pre-logged-in as `demo`).
- The **suite docs** (Overview / Quickstart / The apps) are the real in-app
  documentation, byte-identical to what ships.
- The **PingCanvas kiosk** tile opens the real kiosk rendering a mock fleet:
  33 monitored devices, a down printer, two degraded app VMs, a rack UPS and
  live metric readouts - exactly what a live wall looks like, minus the
  poller. The **"2 AM version"** link (bottom-right of the launcher) is the
  same board during an incident - a power event in Building A: UPS on
  battery and draining, wall-powered gear dark, the server room warming,
  HQ traffic collapsed - told entirely through a different pair of feed
  files. Same diagram, different night.
- The **CrossCanvas** tile opens the editor's own live demo (it has run on
  GitHub Pages for a while - fully functional, entirely in-browser).
- The **SNMPCanvas** tile opens the real SNMPCanvas frontend over the same
  synthetic fleet: the devices table, per-device pages (CPU/memory cards,
  interface tables with code chips), 24-hour traffic graphs with
  95th-percentile lines, and the UPS page showing the battery / runtime /
  state / power / voltage sensor kinds. History is generated on the fly, so
  the graphs are always a full, fresh-looking day.
- The **SyslogCanvas** tile opens the real log UI over a deterministic
  synthetic stream - firewall pass/blocks, switch link events, VM
  migrations, SMB sessions, failed SSH attempts, and SNMP traps, one
  message every few seconds forever. The filter bar genuinely works
  (`host:nas-01`, `sev:<=4`, `proto:trap`, words, negation), as do paging
  and the raw-message detail view.
- The **AlertCanvas** tile opens the alerting UI mid-story: the Printer
  down (crit) and the virtualization cluster hot (warn, via a per-host
  override), the Watching page showing every value against its effective
  rule, and History carrying the cleared power-event alarms the "2 AM
  version" wall depicts - the two halves of the same incident.

## How this repo works

Everything outside `demo/` and `tools/` is **generated** - vendored copies of
the real apps' frontends, refreshed by `tools/build-demo.ps1` from sibling
checkouts. Do not hand-edit vendored files; changes belong in the app repos
(where real users get them too) and flow here on the next build.

Hand-edited files:

| Path | What it is |
|---|---|
| `demo/demo-api.js` | the fetch shim: canned `/api/*` answers + the demo ribbon |
| `demo/fixtures/` | the mock board (`board.xcanvas`) and status feed (`status.json`) |
| `README.md` | this file |

The `generated` timestamp in `status.json` is deliberately far-future so the
kiosk's staleness banner never fires and the ticker reads fresh - it is a
frozen exhibit, not a lie about uptime (see the ribbon).

## Editing the docs or the look

The docs pages and all styling live in the app repos (mostly
[LaunchCanvas](https://github.com/RootSwitch/LaunchCanvas)'s `public/`), not
here. Edit there - the GitHub web editor works fine, no Docker or Node
needed - and this demo picks the changes up on its next build. If you want to
*preview* a change quickly, editing the vendored copy here does render, but
the change must land in the app repo or the next build will erase it.

## License

[The Unlicense](https://github.com/RootSwitch/LaunchCanvas/blob/main/LICENSE) -
public domain, same as every app it showcases.
