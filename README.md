# Machines

Interactive 3D simulators of real mechanisms. Each machine is one offline HTML page, driven by a single model in real units: every part, gauge and chart reads from it. Orbit, cut away, isolate subsystems, or let the auto tour drive.

**Live:** https://metaphorz.github.io/machines/

| Machine | Driven by | Source |
|---|---|---|
| Swiss lever watch escapement | time and balance amplitude (4 Hz, 15-tooth wheel, 52° lift) | `machines/escapement/` |
| Shimano 11-speed rear derailleur | cable pull and cadence (2.7 mm × 1.4 = 3.78 mm per cog) | `machines/derailleur/` |
| V8 engine, Cessna 337 landing gear, Strandbeest | the examples that ship with the teardown skill | built from [teardown](https://github.com/elvarofficial/teardown) |

Each page lists which numbers are sourced and which are approximations.

## Build

The pages are built with the [teardown](https://github.com/elvarofficial/teardown) Claude Code skill's bundler:

```
node ~/.claude/skills/teardown/sims/build.mjs ./machines/escapement-live
node ~/.claude/skills/teardown/sims/build.mjs ./machines/derailleur-live
```

Output lands in `teardown-out/dist/`; `simulators.html` loads the pages from there.

## Credits

The V8, Cessna and Strandbeest pages, the bundler and the fonts come from [elvarofficial/teardown](https://github.com/elvarofficial/teardown) (MIT, see `THIRD_PARTY_LICENSE-teardown`), which builds on [whaleyxbt/claude-motion](https://github.com/whaleyxbt/claude-motion) (MIT). Rendering by [three.js](https://threejs.org) (MIT).
