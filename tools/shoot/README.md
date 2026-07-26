# The shoot rig

Screenshots for the suite are taken here, not by hand, so the next round is a
rerun instead of archaeology. This demo is the natural rig: it is statically
served, fully populated with one estate, and needs no live infrastructure.

`shoot.js` drives headless Chrome over the DevTools protocol and writes one PNG
per entry in a shot list. `tiles.py` downscales those PNGs to the 560x330
launcher tile size. Neither has dependencies beyond Node 22+ (for the global
`WebSocket`) and Pillow.

## Running it

Serve this repo on port 8095 and CrossCanvas on 3000, then:

```bash
node tools/shoot/shoot.js tools/shoot/shots-tiles.json out
python tools/shoot/tiles.py out tiles
```

`shots-tiles.json` reproduces the six LaunchCanvas launcher tiles. The results
belong in `LaunchCanvas/public/tiles/`; this repo's `tiles/` is a vendored copy
that `build-demo.ps1` refreshes from there.

For an app's hero image, shoot its four quadrants and composite them:

```bash
node tools/shoot/shoot.js tools/shoot/shots-hero-alertcanvas.json out
python tools/shoot/hero.py out hero-quadrants.png q1-alarms q2-watching q3-history q4-settings
```

The result belongs in that app's own `docs/hero-quadrants.png`. Heroes are
3200x2000 - four 1600x1000 quadrants butted together with no gap.

### The two shot lists that need more than this repo

- **LaunchCanvas** shows its login page and its multi-user Settings, and this
  demo auto-authenticates, so there is no login page here to shoot. Run the
  real thing on 9170 first, seeded and with SSO on so Settings shows the
  feature active rather than "Off":

  ```bash
  LAUNCHCANVAS_DATA=/tmp/lc-shoot ADMIN_PASSWORD=shootrig-throwaway \
    SUITE_SECRET=shootrig-throwaway-suite-secret PORT=9170 node server/server.js
  ```

  The password is in the shot list on purpose: it is a throwaway for a scratch
  data dir that exists for one shoot and is deleted after. Do not point this at
  a real instance.
- **SNMPCanvas** needs `?demo=discover` for its add-device quadrant, which the
  shim answers with one canned probe. Everything else comes from here.

## The rules the shot list encodes

- **Heroes show themes, tiles show the product.** Every tile is shot in
  Classic, with the app header in frame. Never re-crop a hero quadrant into a
  tile - that is how the tiles drifted into four different themes.
- PingCanvas is exempt from the header rule. It is a kiosk, it has no header,
  its tile is a full-bleed canvas.
- The demo ribbon is demo scaffolding, not product UI, so the shot list removes
  `#demo-ribbon` before capturing.
- Tiles are shot at 2x the tile box and supersampled down, which is sharper
  than a 1x grab. Keep one viewport size across the chromed tiles: identical
  header scale is most of what makes the grid look calm.

## Gotchas that cost time once

- Chrome rejects a **relative** `--user-data-dir` with a modal "Failed To
  Create Data Directory", which in headless mode reads as a silent hang.
  `shoot.js` resolves the path; do not undo that.
- Hash-only navigation does not reload the document, so seeding `localStorage`
  (the theme) needs a query buster - and it has to go *before* the `#` or it
  lands inside the route.
- A rerun is not byte-identical for every tile. The SNMP, Syslog and kiosk
  views carry wall-clock relative times ("9s ago", log timestamps), so those
  three change on every run. CrossCanvas, AlertCanvas and the docs page do
  reproduce byte-for-byte. Nothing is wrong when the three drift.
- The kiosk needs its full query string or it shows "No Board Loaded", and
  `staleMul` matters because the fixtures are dated 2099 and read as stale
  without it.

## CrossCanvas is the exception

Every other app is shot against the demo on :8095. CrossCanvas is **not vendored
into the demo**, so it is shot against its own dev server on **:3000** (the
`network-diagram` launch config).

Its hero is also a different shape: four *diagrams* rather than four views,
because a diagram editor has no interesting second view. Two are the built-in
samples; the other two are tracked in the **CrossCanvas repo** at `docs/hero/`,
not here. That is forced by design, not preference - `?board=` enforces
same-origin, so the files have to be reachable from CrossCanvas's own origin.
Those two are stored NEUTRAL and recoloured at shoot time, so a palette change
flows into the next shoot instead of freezing into the file.

No scripting is needed for it: `theme`, `sample`, `board`, `recolor` and `fit`
are all public URL parameters, so every quadrant is a plain URL.

**Known gap:** `shots-social.json` has no PingCanvas entry, though
`pingcanvas/docs/social-preview.png` exists - that one was shot ad hoc and never
written down, so it is the one social that cannot currently be reproduced.
