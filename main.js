'use strict';
/*
 * Cafe Neurotico — unified suite entry point.
 *
 * One Electron process, three faces, dispatched by argv:
 *   (default)              → Manager  (CNGM)      windowed library hub
 *   grinder <subcommand>   → GRINDER  engine/GUI   [wired in Phase 1]
 *   --crema | --fullscreen → CREMA    fullscreen   [wired in Phase 3]
 *
 * Each face owns its own app identity (app.setName) so the one that runs in a
 * given process resolves the correct userData / single-instance lock. The
 * GRINDER face keeps 'grinder' so its CLI (launch/install/uninstall-headless/
 * setup) and data dir behave exactly as the old standalone GRINDER.AppImage.
 */

const args        = process.argv.slice(1);
const positional   = args.filter(a => a !== '.' && !a.startsWith('-'));
const wantsGrinder = positional[0] === 'grinder';
const wantsCrema   = args.includes('--crema') || args.includes('--fullscreen');

if (wantsGrinder) {
    require('./apps/grinder/main.js');
} else if (wantsCrema) {
    // require('./apps/crema/main.js');      // Phase 3
    require('./apps/manager/main.js');
} else {
    require('./apps/manager/main.js');
}
