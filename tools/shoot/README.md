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
