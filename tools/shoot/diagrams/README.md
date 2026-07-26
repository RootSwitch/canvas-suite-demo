# Hero diagrams for the CrossCanvas shot

CrossCanvas's hero is the odd one in the family: the other apps show **four views
of one app**, but a diagram editor has no interesting "views" - so its hero is
**four different diagrams**, each in a different theme. Two of those four are
purpose-built mockups, and this is where they live.

| quadrant | diagram | theme |
|---|---|---|
| top left | the built-in **Complex** sample | Classic, not recoloured |
| top right | the built-in **Simple** sample | Garnet, recoloured |
| bottom left | `homelab.xcanvas` (here) | Synthwave, recoloured |
| bottom right | `order-service.xcanvas` (here) | Ember, recoloured |

The two built-in samples come from the app itself and need nothing stored.

## Why these are stored NEUTRAL

Both files here carry **no tint colours**. The theme is applied at shoot time:
load the file, `applyTheme(name)`, then recolour. Verified 2026-07-25 that this
reproduces the previously hand-themed copies exactly - identical tints device for
device (`#7b52d0` Synthwave, `#d97528` Ember).

Storing them neutral rather than pre-themed means a palette change flows into the
next shoot on its own. Pre-themed files would freeze the tints and go stale
silently, which is the failure mode this whole rig exists to prevent.

## Why they are here at all

They previously lived only in `crosscanvas/.claude/`, which is **gitignored** -
so they existed on exactly one machine and were reported as lost. They were not
lost, just never committed. That is the same failure that put the suite's
regression tests in a temp directory: work survives only if it is tracked.

## Still missing

There is no `shots-hero-crosscanvas.json`. Writing one completes the set and
turns CrossCanvas's hero from a rebuild into a rerun - the shot list needs to
load each diagram, apply its theme, recolour, fit to the canvas, and capture four
quadrants for `hero.py` to composite.
