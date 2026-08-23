# Cafe Neurotico on macOS — handoff

**Linux stays the primary platform.** It is the main gaming machine, it is what ships, and it
is not being replaced or wound down. macOS is a *second host in the same codebase* — an
Experimental build alongside the AppImage, not a successor to it. Both are maintained from here
on.

What moves to the Mac is the *macOS work*, because none of it can be written or tested from
Nobara. Everything below assumes an **M2 MacBook Air, 16 GB, macOS Tahoe (26)**, and the `mac`
branch.

Phase A is done and pushed: the host boundary exists, the Linux build still works, and
`binaries-mac-v1` is published. What's left is writing the macOS side of that boundary.

Background: **`docs/mac-port-phase-a.md`** (what was moved, what was verified, what was
deliberately left). This file is the do-this-next companion to it.

---

## Day 0 — get the Mac ready

Nothing here is Cafe Neurotico specific; it's the toolchain.

```bash
# 1. Xcode Command Line Tools — needed to rebuild better-sqlite3 against Electron
xcode-select --install

# 2. Node 22 (matches the Linux box: 22.22.2). Either the official installer, or:
#    brew install node@22        # if you want Homebrew
node -v                          # expect v22.x

# 3. git + gh (gh is optional, but you'll want it for binaries-mac-v2)
brew install gh && gh auth login
```

**Format the external SSD as APFS, not exFAT.** exFAT has no permission bits and no symlinks,
so game executables lose `+x` and `.app` bundles break. This makes the drive Mac-only (Linux
APFS support is read-only and flaky) — that's the accepted trade; the Linux box has its own
library.

---

## Day 1 — clone and see it fail honestly

```bash
git clone https://github.com/shampoo-is-a-lie/CafeNeurotico.git
cd CafeNeurotico
git checkout mac
npm install
```

`npm install` will:

- rebuild `better-sqlite3` for darwin-arm64 (this is why Xcode CLT is step 1),
- run `scripts/fetch-binaries.mjs`, which downloads **`binaries-mac-v1`** into
  `assets/bin/darwin-arm64/` — five arm64 helpers, all code-signed,
- print a warning that **gogdl is not in the tarball** and how to build it.

Then:

```bash
npm start
```

**It will throw**, and the error is the point:

```
Cafe Neurotico has no platform backend for "darwin". Supported: linux.
```

That's `packages/core/platform/index.js` doing its job. Writing the backend it's asking for is
the whole of Phase B.

---

## The one file you have to write

**`packages/core/platform/darwin.js`** — sibling to `linux.js`, same shape. `index.js` picks it
up automatically the moment it exists; nothing else needs touching.

Read `linux.js` first. It's ~1000 lines and every comment in it records a real bug, so it
doubles as the specification.

### The contract, and what each member should do on macOS

`init(ctx)` receives `{ homeDir, configDir, getDb, expandTilde }` from the engine.

**Paths — do these first.**

| Member | macOS |
|---|---|
| `id` | `'darwin'` |
| `binDirName` | `'darwin-arm64'` |
| `portableBaseDir({isPackaged, execPath, devDir})` | **Not portable on macOS** — an `.app` in `/Applications` cannot hold user data. Return `~/Library/Application Support/CafeNeurotico`, ignoring `devDir` when packaged. |
| `selfExecutable()` | `process.execPath` (there is no `APPIMAGE`) |
| `selfSpawnArgs(faceArgs, repoRoot)` | packaged → `faceArgs`; dev → `[repoRoot, ...faceArgs]` |
| `grinderDbCandidates(baseDir)` / `findGrinderDb` / `grinderDbCreatePath` | `~/Library/Application Support/grinder/grinder.db` (Electron's `userData` for `app.setName('grinder')`) |

**Store identifiers — small, and load-bearing.**

| Member | macOS |
|---|---|
| `nativeOsKey` | `'osx'` — GOG's own name for it, and what lands in `games.platform` |
| `gogdlPlatform` | `'osx'` |
| `legendaryPlatform` | `'Mac'` |

**System + stores.**

| Member | macOS |
|---|---|
| `which(bin)` | ⚠ A `.app` launched from Finder inherits a minimal PATH with **no Homebrew**. Search `/opt/homebrew/bin`, `/usr/local/bin` explicitly as well as PATH. |
| `dirSizeBytesCommand(p)` | `du -sk "p"` and multiply the parsed number by 1024 — BSD `du` has no `-B1` |
| `dirSizeHumanCommand(p)` | `du -sh "p"` works as-is |
| `legendaryConfigDir()` | `~/Library/Application Support/legendary` |
| `steamLibraryPaths()` | `~/Library/Application Support/Steam/steamapps`, plus extra roots from `libraryfolders.vdf` — the vdf parsing is identical, lift it |
| `steamLaunchCommand(appId)` | `open steam://rungameid/<id>` |
| `extraStore` | `{ supported: false, label: '', scan: () => [], findIcon: () => null }` — no Flatpak. `scan-flatpak` becomes a no-op on its own. |

**Native games.**

| Member | macOS |
|---|---|
| `launchNative({exe, args})` | If `exe` is a `.app` bundle → `{ cmd: 'open', args: ['-a', exe, '--args', ...args] }`. If it's a plain binary → chmod +x and spawn directly, like Linux. |
| `findNativeGameExe(dir)` | Look for `*.app` first, then a plain executable |
| `findNativeInstallResult(dir, appId, preExisting)` | **Unknown until you look.** Run one GOG macOS install and see what gogdl actually leaves behind — a `.app`, a `.pkg`, a plain tree. Don't guess. |
| `dosbox` | `find()` → look for `dosbox-staging` / `dosbox-x` via the widened `which`; `installHint()` → `brew install dosbox-staging`; `translateArgs` → lift verbatim from Linux |

**Desktop.**

| Member | macOS |
|---|---|
| `desktop.canInstallMenuEntries` | `false` — the `.app` *is* the menu entry. The Manager already handles this and returns a message. |
| `desktop.openUrlScheme(url)` | `spawn('open', [url])` |
| `desktop.focusWindow(win)` | `win.focus()` — no `wmctrl` equivalent needed or wanted |
| `desktop.displayPicker` | `null` — no window-rule engine. `manager/main.js` already guards on `isSupported()`; make sure a `null` here doesn't throw at require time. |
| `desktop.getAutostart` / `setAutostart` | A LaunchAgent plist in `~/Library/LaunchAgents`, or `app.setLoginItemSettings()` — the Electron API is simpler and probably enough |
| `desktop.appsDir` / `desktopDir` / `writeLauncher` / `removeLauncher` / `refreshMenu` / `markTrusted` / `launcherFileName` / `autostartPath` | Only reached when `canInstallMenuEntries` is true, except `desktopDir`. Stub them to no-ops returning `false`/`''` for now. |

**Runtime — leave stubbed until Phase E.**

Everything under `runtime.*` can throw `NOT_IMPLEMENTED` or report unavailable through Phases
B–D. The minimum that must behave so the app doesn't crash:

```js
runtime = {
  id: 'none',
  prefixesDirName: 'bottles',
  setupPhase: '',
  management: { supported: false, label: '', installDirs: () => [], managedDirs: () => [],
                resolveInstallDir: () => '', isManagedDir: () => false,
                listReleases: async () => ({ ok: false, error: 'not supported', releases: [] }),
                latestRelease: async () => ({ ok: false, error: 'not supported' }),
                install: async () => ({ ok: false, error: 'not supported' }),
                cancel: () => false, remove: () => ({ ok: false, error: 'not supported' }) },
  tools: () => [], canInstallRunner: false,
  installRunner: async () => ({ ok: false, error: 'not supported' }),
  scan: () => [], resolve: () => '', isRuntimeDir: () => false,
  inUse: () => false, canRun: () => false,
  assertAvailable() { throw this.unavailableError(); },
  compatEnv: () => ({}),
  buildLaunch() { throw this.unavailableError(); },
  buildRedistLaunch() { throw this.unavailableError(); },
  regeditCommand: () => ({ cmd: 'true', args: [], env: {} }),
  toWindowsPath: p => p,
  diagnose: () => ({ code: 'NO_RUNTIME', message: 'Windows games are not supported yet on macOS.' }),
  unavailableError() { const e = new Error('Windows games are not supported yet on this build.'); e.code = 'NO_RUNTIME'; return e; },
  findAntiCheatRuntime: () => null,
  startupSteps: () => [], setupBytes: () => 0,
  redistUnavailableMessage: 'Windows games are not supported yet on macOS.',
  findUmu: () => null, findWine: () => null,
};
```

Check your work against the real thing:

```bash
node -e "const h=require('./packages/core/platform/index.js');
  const l=require('./packages/core/platform/linux.js');
  const walk=(a,b,p='')=>{for(const k of Object.keys(b)){const q=p?p+'.'+k:k;
    if(!(k in a)) console.log('MISSING '+q);
    else if(b[k]&&typeof b[k]==='object'&&!Array.isArray(b[k])&&k!=='displayPicker') walk(a[k],b[k],q);
    else if(typeof a[k]!==typeof b[k]) console.log('TYPE    '+q+' '+typeof a[k]+' vs '+typeof b[k]);}};
  walk(h,l); console.log('contract check done');"
```

---

## Phases, with an acceptance test each

### Phase B — it launches
Write `darwin.js` (paths + stubs above). Then:

```bash
npm start                 # Manager
npm run start:crema       # CREMA
npx electron . grinder    # GRINDER GUI
```

**Done when:** all three windows open, the library renders, and nothing throws.
**Read the terminal, not the window** — an Electron main-process error dialog keeps the process
alive, so "it stayed open" proves nothing. That mistake cost two bugs in Phase A.

### Phase B.5 — build a real app
```bash
npm run dist:mac          # dmg + zip, arm64, unsigned
```
Needs an **`.icns`** — the project only has SVGs. Generate one from
`apps/manager/assets/icons/CNGM.svg` (`sips`/`iconutil`, or any converter) and point
`build.mac.icon` at it.

Because you build locally, the `.app` never gets a quarantine bit and **Gatekeeper won't
bother you at all**. That friction only exists for people who *download* the dmg — for them,
`xattr -dr com.apple.quarantine /Applications/Cafe\ Neurotico.app`.

### Phase B.6 — gogdl, and close the tarball gap
```bash
git clone <the fork> gogdl_fork && cd gogdl_fork
python3 -m pip install pyinstaller
python3 -m PyInstaller --onefile --name gogdl grinder_entry.py --clean --noconfirm
```
Copy `dist/gogdl` into `assets/bin/darwin-arm64/`, then rebuild the tarball with all six and
publish `binaries-mac-v2`, bumping `SOURCES.darwin` (url + sha256) and dropping the `missing`
block in `scripts/fetch-binaries.mjs`.

**Do not shortcut this with upstream's `gogdl_macos_arm64`.** It still has three of the four
bugs the fork exists for — see the table in `docs/mac-port-phase-a.md`.

### Phase C — scan and launch what's already installed
Steam library scan, `open steam://…`, GOG `.app` bundles, and external-volume awareness for
`/Volumes/`.
**Done when:** the library populates from a real Mac Steam install and a native game launches.

### Phase D — the actual goal: download and install
gogdl `--platform osx`, legendary `--platform Mac`, comet for achievements, installing to the
external SSD.

Two things to settle here:
- **`games.platform` per-host derivation.** `platforms` (plural) holds everything GOG offers;
  stop trusting the singular `platform` at launch time and pick per host. See *Data-model
  decisions* in the Phase A doc.
- **Line 582 of `grinder-engine.js`** (`activePlat = platform || 'windows'`) — deferred from
  Phase A because changing it there would have altered Linux behaviour. It belongs here.

**Done when:** a GOG macOS-native game installs to the SSD, launches, and uninstalls cleanly.

### Phase E — Windows games
Runner detection and management. Deliberately last: CrossOver's ARM64/FEX transition is still
landing, so anything written now against Rosetta-era assumptions rots. Check your exact point
release first — **the native ARM64 CrossOver build needs macOS 26.5+**.

---

## Three traps, in the order they'll bite

1. **App Management (macOS 15+, still in Tahoe).** Writing inside another app's `.app` bundle
   is blocked without permission, and TCC keys the grant to code signature — so an *unsigned*
   dev build can look like a new app and lose its grant on **every rebuild**.
   Mitigations: install games as plain directory trees on the SSD rather than into
   `/Applications`, and ad-hoc sign with a stable identifier:
   `codesign -s - --identifier com.cafeneurotico.suite <app>`.
   **Test this on day one of Phase B** — fifteen minutes, and it shapes the whole install layout.
2. **The minimal PATH.** A Finder-launched `.app` has no Homebrew in `PATH`. Anything found via
   `which()` — dosbox, wine, 7z — will be invisible unless `which` searches
   `/opt/homebrew/bin` explicitly.
3. **Rosetta's clock.** Full support through macOS 27; from macOS 28 (~autumn 2027) only a
   games-only subset survives. It doesn't affect Phases B–D (everything there is arm64-native)
   but it decides Phase E's shape.

---

## File map

**Read these:**

| File | Why |
|---|---|
| `packages/core/platform/linux.js` | The specification. ~1000 lines, comments record real bugs. |
| `packages/core/platform/index.js` | 31 lines. How a backend is selected. |
| `docs/mac-port-phase-a.md` | What moved, what was verified, what was left. |

**Write this:**

| File | |
|---|---|
| `packages/core/platform/darwin.js` | The whole of Phase B. |

**Touch these, but only later:**

| File | When |
|---|---|
| `scripts/fetch-binaries.mjs` | Phase B.6 — `SOURCES.darwin` after gogdl |
| `package.json` → `build.mac.icon` | Phase B.5 — the `.icns` |
| `packages/core/grinder-engine.js` (line ~582) | Phase D |
| `packages/core/custom-installers.js` | Phase D — Mac recipes, tagged `hosts: ['darwin']`, from macsourceports.com (192 notarized Universal 2 ports) |
| `apps/grinder/renderer.js` | Whenever — the External Tools panel hardcodes the Linux tool names; `check-tools` already returns a `runtimeTools` array for it to move onto |

**Don't touch:** the three `apps/*/main.js`. Phase A left them host-agnostic; if Phase B needs
to change one, that's a sign the boundary is in the wrong place — fix `darwin.js` instead.

---

## Rules for a two-host repo

One repo, one branch, both machines push and pull. **Don't fork.** Long-term, `mac` merges back
into `experimental` and both hosts live in one codebase — the boundary exists precisely so they
can.

**Linux is the shipping platform and outranks macOS in every conflict.**

1. **A Linux regression blocks the merge. A macOS gap does not.** The AppImage is the product;
   the Mac build is labelled Experimental and is allowed to be incomplete.
2. **Never reshape `linux.js` to suit `darwin.js`.** If the macOS backend wants a different
   contract, widen the contract — add a member, give it a sensible Linux value — rather than
   changing what Linux already does. Phase A deliberately deferred one such change (line ~582
   of `grinder-engine.js`) for exactly this reason.
3. **Anything shared gets verified on Linux before it merges** — the engine, `shared-ipc.js`,
   the renderers, `custom-installers.js`. That means `npm run dist` on the Linux box plus the
   six-path launch smoke test in `docs/mac-port-phase-a.md`, not just "it built".
4. **If a fix belongs to both hosts, make it on Linux first**, confirm the AppImage, then pull
   it over. The Linux box is the reference implementation: when something on the Mac looks
   wrong, diff against what `linux.js` does.
5. **`apps/*/main.js` should stay host-agnostic.** Phase A got them there. If macOS work needs
   to touch one, that is a signal the boundary is in the wrong place — fix `darwin.js` instead.

Copy the memory directory across too. The Mac's project key will be `-Users-jose-…`, so it's a
copy into the Mac's own memory dir, not a symlink.
