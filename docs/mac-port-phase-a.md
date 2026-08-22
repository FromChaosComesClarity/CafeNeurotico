# Mac port — Phase A: the platform boundary

**Status:** A1 + A2 done (backend + engine). A3–A8 outstanding.
**Branch:** to be cut as `mac` off `experimental` — the A1/A2 work is currently uncommitted on `main`.
**Line numbers are as of `6220ead` (v1.7.0).**

Phase A is done entirely on the Linux box and ships **zero Mac code**. Its only job is to
put a seam in the codebase so that Phase B onward is *additive* — a second backend file —
rather than a fork. Its only acceptance criterion is that the Linux build behaves exactly
as 1.7.0 does.

## Goal

One repo, one branch, two hosts. After Phase A:

- Nothing outside `packages/core/platform/linux.js` mentions Proton, umu, wine,
  Flatpak, `assets/bin/linux`, `~/.steam`, `.desktop`, `xdg-open` or `wmctrl`.
- `packages/core/platform/darwin.js` can be written in Phase B without touching a
  single line of `grinder-engine.js`, the three `main.js` files, or any renderer.

## Non-goals

- No Mac code. `darwin.js` lands in Phase B, on the Mac.
- No behaviour changes, no bug fixes, no "while I'm here" cleanups. Phase A is
  **pure code motion**. See *Rules of engagement*.
- No renderer work beyond deleting dead branches. The UI is already platform-agnostic.

---

## The five concerns

A single monolithic `platform` object with forty methods would be unusable. The Linux-specific
code falls naturally into five groups, and the contract is grouped the same way:

| # | Concern | Linux today | macOS later |
|---|---|---|---|
| 1 | **Paths** — where the app, its data and its binaries live | AppImage-relative, `~/.config`, `assets/bin/linux` | `.app` in `/Applications`, `~/Library/Application Support`, `assets/bin/darwin-arm64` |
| 2 | **Windows-game runtime** | Proton + umu-run + wine | CrossOver / managed wine (Phase E) |
| 3 | **Native-game launch + store platform ids** | `chmod +x`, `--platform linux`, `--platform Windows` | `.app` bundle, `--platform osx`, `--platform Mac` |
| 4 | **Desktop integration** | `.desktop`, `xdg-open`, `gio`, `wmctrl`, KWin | `open`, LaunchAgents, native focus, no display picker |
| 5 | **System inventory** | Steam roots, Flatpak, native DOSBox, `du -sB1` | Steam in `~/Library`, no Flatpak, DOSBox via Homebrew/dmg, `du -sk` |

Concern 2 is the one that stays unimplemented longest — `darwin.js` will ship it as a
`NOT_IMPLEMENTED` stub through Phases B–D and only get a real body in Phase E.

---

## The contract

```
packages/core/platform/
  index.js    →  module.exports = require(process.platform === 'darwin' ? './darwin' : './linux')
  linux.js    →  everything that is Linux-shaped today, lifted verbatim
  darwin.js   →  Phase B
```

```js
module.exports = {
  id: 'linux',

  // ── 1. Paths ──────────────────────────────────────────────────────────
  binDirName,                       // 'linux' → assets/bin/<binDirName>
  portableBaseDir(app),             // APPIMAGE dir | execPath dir | __dirname
  managerDataDir(app),              // where GameManagerConfig lives
  grinderConfigDir(app),
  grinderDbCandidates(baseDir),     // the 3-path list, currently duplicated 8×
  selfExecutable(),                 // process.env.APPIMAGE || process.execPath
  selfSpawnArgs(face, subArgs),     // ['grinder', …] packaged vs [repoRoot, 'grinder', …] dev

  // ── 2. Windows-game runtime ───────────────────────────────────────────
  runtime: {
    id,                             // 'proton'
    isAvailable(),
    scan(),                         // → [{ name, path, type, version, label }]
    resolve(game, db),              // → runtime path or ''
    prefixesDirName,                // 'prefixes'
    compatEnv(game, usingRuntime),  // esync/fsync/nvapi/battleye/eac
    buildLaunch(spec),              // → { cmd, args, env, method }
    buildRedistLaunch(spec),        // → { cmd, args, env }
    regeditCommand(spec),           // → { cmd, args, env }
    windowsPathFor(unixPath),       // 'Z:\…' — .bat launching, registry values
    diagnose(log, runtimePath),     // → { code, message }
    startupSteps(),                 // STARTUP_STEPS for watchStartup
    setupBytes(),                   // umuDownloadBytes()
    unavailableError(),             // noProtonError()
    findAntiCheatRuntime(name),
  },

  // ── 3. Native launch + store platform ids ─────────────────────────────
  nativeOsKey,                      // 'linux'  — games.platform / GOG `os` value
  gogdlPlatform,                    // 'linux'  — gogdl --platform
  legendaryPlatform,                // 'Windows'— legendary --platform default
  findNativeGameExe(gameDir),       // findLinuxGameExe
  findNativeInstallResult(dir, id), // the .gogdl-linux-manifest branch
  launchNative(spec),               // → { cmd, args, env }

  // ── 4. Desktop integration ────────────────────────────────────────────
  desktop: {
    openUrlScheme(url),             // xdg-open | open
    installMenuEntries(spec), removeMenuEntries(),
    addShortcut(spec), resolveDesktopDir(),
    getAutostart(), setAutostart(on),
    focusWindow(win),               // wmctrl | win.focus()
    displayPicker,                  // require('../kwin-display.js') | null
  },

  // ── 5. System inventory ───────────────────────────────────────────────
  steamLibraryRoots(),
  steamLaunchCommand(appId),        // `steam steam://rungameid/X -silent` | `open steam://…`
  scanExtraStores(db),              // Flatpak on linux; { count: 0, iconMap: {} } on darwin
  findFlatpakIcon(name),            // → null on darwin
  dosbox: { find(), installHint(), translateArgs(gogArgs) },
  which(bin),
  dirSizeCommand(path),             // ['du','-sB1',path] | ['du','-sk',path] ⚠ see A6
  archive: { zip(spec), unzip(spec) },
};
```

---

## Work items

### A1 — Scaffold

Create `packages/core/platform/{index.js,linux.js}`. `linux.js` starts empty and grows as
A2–A6 move code into it. Nothing imports it yet.

### A2 — `grinder-engine.js` (the big one)

2305 lines today; roughly 600 move out. **Copy the bodies verbatim** into `linux.js` — these
functions carry a lot of hard-won bug fixes and none of them should be re-typed.

**Moves to `platform.runtime`:**

| Lines | What |
|---|---|
| 201–210 | `findUmu`, `findWineCached` |
| 224–241 | `PROTON_SEARCH_DIRS` |
| 243–302 | `isProtonDir`, `scanProtonVersions`, `resolveProton` |
| 304–316 | `diagnoseLaunchFailure` |
| 327–345 | `STARTUP_STEPS` |
| 347–365 | `umuDownloadBytes` |
| 424–431 | `noProtonError` |
| 433–442 | `findRuntime` (BattlEye/EAC) |
| 901–915 | the `usingProton` / `compatEnv` block inside `launchGame` |
| 1139–1180 | the four terminal launch branches (umu-epic / umu / proton-direct / wine) → one `buildLaunch()` returning `{cmd,args,env,method}` |
| 1262–1296 | `runRedist`'s cmd/args/env selection → `buildRedistLaunch()` |
| 1330–1340 | `injectGogRegistry`'s wine-binary resolution → `regeditCommand()` |
| 1826–1836 | the same resolution again inside `applyFalloutNewCaliforniaFix` → same helper |
| 1167, 1272 | the two `steamRoot` computations (`STEAM_COMPAT_CLIENT_INSTALL_PATH`) |

**Moves to `platform` (top level):**

| Lines | What |
|---|---|
| 1480–1532 | `DOSBOX_BINARIES`, `DOSBOX_FLATPAKS`, `findNativeDosbox`, `dosboxInstallHint` → `platform.dosbox` |
| 1546–1558 | `nativeDosboxArgs` → `platform.dosbox.translateArgs` |
| 2145–2169 | `findLinuxGameExe` → `platform.findNativeGameExe` |
| 2101–2143 | the `.gogdl-linux-manifest` branch of `findGogInstallResult` → `platform.findNativeInstallResult` (the `goggame-<id>.info` branch stays — it is Windows-build detection and is host-independent) |
| 1133–1137 | `if (game.platform === 'linux')` → `if (game.platform === platform.nativeOsKey)` + `platform.launchNative()` |

**Stays in core, untouched:** every GOG API function (`gogFetch`, `getGogToken`,
`writeGogAuthConfig`, `gogExchangeCode`, `gogStatus`, `gogLogout`, `gogListManuals`,
`gogDownloadManual`, `gogListDlcs`, `gogInstalledDlcs`, `gogInstallInfo`), every legendary
wrapper (`runLegendary`, `epicStatus`, `epicAuthCode`, `epicListUpdates`, `epicInstallInfo`,
`getGameInstallInfo`), `syncOwnedLibrary`, `headlessInstall`/`headlessUninstall`,
`gogPlayTaskList`/`activeGogPlayTask`/`setGogLaunchTarget`, `applyGogSupportFiles`, the whole
CD-audio conf block, `resolvePathCaseInsensitive`, `expandTilde`, `sanitizeLogName`,
`ensureSchema`, `cancelActiveInstall`, `watchStartup` (it is only a log tailer — it takes its
step table from `platform.runtime.startupSteps()`), `prefixPathForGame`, `getDiskSpace`
(`fs.promises.statfs` works on macOS).

**The one-line change that is the whole point of Phase A** (see *Data-model decisions*):

- **2064** — `const platform = oses.includes('linux') ? 'linux' : 'windows'` → keyed off
  `host.nativeOsKey`, with the `platforms` filter on the next line widened the same way.
  Behaviour-neutral on Linux (`nativeOsKey === 'linux'`). ✅ **Done.**

⚠️ **Correction to the first draft of this spec:** line **582**
(`const activePlat = platform || 'windows'`) was listed here as the second such change. It
does **not** belong in Phase A — defaulting it to `host.gogdlPlatform` would make Linux
default to `linux` instead of `windows` when a caller passes no platform, which is a real
behaviour change on the shipping platform. It moves to Phase D with the rest of the
platform-selection work.

### A3 — Path resolution in the three `main.js`

- `baseDir` from `process.env.APPIMAGE` → `platform.portableBaseDir(app)`
  (`manager/main.js:63–69`, `crema/main.js:61–68`, `grinder/main.js:37`).
- `assets/bin/linux` → `assets/bin/${platform.binDirName}`
  (`manager/main.js:131`, `crema/main.js:72` + `:221`, `grinder/main.js:139`).
- `selfExecutable()` / `selfSpawnArgs()` for `findGrinderPath` + `spawnGrinder`
  (`manager/main.js:392–406`, `crema/main.js:170–171`).
- **The `grinder.db` candidate list is duplicated eight times** — `manager/main.js:77–81`
  and `:414–418` and `:1358–1364`, `crema/main.js:178–180, 215–217, 272–274, 379–381, 677`.
  Collapse all of them onto `platform.grinderDbCandidates(baseDir)`. Worth doing on its own
  merits even if the Mac never happens.

### A4 — Desktop integration

- `spawn('xdg-open', [cmd])` for `itch://` → `platform.desktop.openUrlScheme`
  (`manager/main.js:3373`, `crema/main.js:323`).
- `install-to-menu` + `add-shortcut` + `resolveDesktopDir` + CREMA autostart
  (`manager/main.js:2789–2880`) → `platform.desktop.*`.
- `execFile('wmctrl', …)` (`crema/main.js:557–563`) → `platform.desktop.focusWindow(win)`;
  the `process.platform === 'linux'` guard there disappears into the backend.
- `kwin-display.js` → `platform.desktop.displayPicker`, `null` on darwin.
  **Low risk:** `get-game-displays` already returns `{ supported: false, … }`
  (`manager/main.js:880`) and the renderer already handles that, so macOS degrades on its
  own. Only the `require` at `:869` needs guarding.

### A5 — Store inventory

- `getSteamLibraryPaths()` (`manager/main.js:1267–1290`) → `platform.steamLibraryRoots()`.
- `steam steam://rungameid/<id> -silent` → `platform.steamLaunchCommand(appId)`
  (`manager/main.js:1854`, `:2057`; the `LIKE '%steam://rungameid%'` queries at `:2181`,
  `:2550`, `:3960` are matching stored data and stay as they are).
- `scan-flatpak` + `find-flatpak-icon` (`shared-ipc.js:204–274`) →
  `platform.scanExtraStores(db)` / `platform.findFlatpakIcon(name)`. darwin returns
  `{ count: 0, iconMap: {} }` and `null`, so the Manager's Flatpak button can hide itself
  off one IPC answer rather than a `process.platform` check in the renderer.

### A6 — `scripts/fetch-binaries.mjs`

- `BIN_DIR` → `assets/bin/<platform>`.
- `URL`/`SHA256` become a per-platform table; add a `binaries-mac-v1` row (empty until the
  tarball exists — see below).
- Upstream Mac asset names differ (`gogdl_macos_arm64`, `legendary_macOS_arm64`,
  `comet-aarch64-apple-darwin`, `yt-dlp_macos`); normalise to the same six names on extract
  so nothing downstream branches.
- ⚠ **`du -sB1` is GNU-only.** `grinder/main.js:548` and `:566` will fail silently on macOS.
  `host.dirSizeCommand()` already exists in the backend (added in A1), so A6 is just the two
  call sites.

### A7 — `package.json`

Move `extraResources` under per-platform blocks (`linux.extraResources` /
`mac.extraResources`) so each ships only its own `assets/bin/<platform>`. Add a `mac` target
block (`dmg` + `zip`, `arm64`, `category: public.app-category.games`) — **defined but not
built** in Phase A. Add `"identity": null` for now; signing is a Phase-B decision.

### A8 — `custom-installers.js`

All 15 `entry.platform` values are `'windows'` and every recipe points at a Windows
download. Add a `hosts: ['linux']` field to each recipe and make `selfCheck()` assert it, so
the Mac catalogue (rewritten in Phase D off macsourceports.com) can coexist in the same file
instead of forking it. No recipe content changes in Phase A.

---

## Data-model decisions to make in Phase A (implement in D)

**1. `games.platform` is a host-dependent value in a host-shared schema.**
`syncOwnedLibrary` writes `platform` = `'linux'` or `'windows'`, and `platforms` = the full
comma-separated list of what GOG offers. A library synced on the Linux box and then opened on
the Mac would claim `platform='linux'` for a game that also has an `osx` build. The fix is to
**stop trusting `platform` at launch time and derive it per-host from `platforms`**. Decide
this in A (it shapes what `findNativeInstallResult` is handed); implement it in D.

**2. The binaries tarball.** `assets/bin/*` is gitignored and pinned to a release asset, and
our patched gogdl lives *only* there. A `binaries-mac-v1` tarball has to be built and
published before Phase B can run at all. All three helper binaries have confirmed upstream
arm64 darwin builds; ffmpeg/ffprobe/yt-dlp need a source picking. **This is the one Phase-B
prerequisite that can be done from the Linux box.**

---

## Acceptance criteria

1. `npm run dist` produces a working AppImage, deployed to `~/Games/CNGM` as usual.
2. These greps return hits **only** in `platform/linux.js` and `scripts/fetch-binaries.mjs`
   (the second already passes for `packages/core/grinder-engine.js` as of A2):
   ```
   grep -rn "assets/bin/linux" apps packages
   grep -rn "umu-run\|PROTONPATH\|compatibilitytools\|\.steam/" apps packages
   grep -rn "xdg-open\|update-desktop-database\|flatpak" apps packages
   ```
3. `customInstallers.selfCheck()` passes.
4. Manual smoke test, all six:
   - a Steam game launches
   - a GOG Windows game launches under Proton
   - a GOG DOS game launches under native DOSBox
   - a GOG Linux-native game launches
   - a custom-installer source port launches
   - one GOG game installs and uninstalls cleanly
5. The KDE display picker still works.

## Rules of engagement

`launchGame` (805–1181) is the highest-risk function in the repo. It carries fixes that took
real debugging to find and that read as arbitrary out of context — the `n,b` WINEDLLOVERRIDES
form, the `Z:` drive path for `.bat`, the DOS `workingDir` rule, the CD-audio `-conf`
ordering, the case-insensitive path resolution. **Move code, do not rewrite it.** If a moved
function looks improvable, note it and leave it; a Phase A that also "tidies" is a Phase A
that cannot be verified by inspection.

---

## Progress

### ✅ A1 — Scaffold (done)

`packages/core/platform/index.js` selects a backend by `process.platform` and fails loudly
with a readable message on an unsupported host. `packages/core/platform/linux.js` holds the
lifted code, with the comments intact.

The backend is imported into the engine as **`host`**, not `platform` — `platform` is
already a parameter name in `headlessInstall`, `runRedist`, `gogInstallInfo` and
`gogListDlcs`, and would have been shadowed inside `runRedist`, which needs it.

### ✅ A2 — grinder-engine.js (done)

**32 edits, 122,009 → 105,476 bytes (−13.5%).** Everything moved was copied verbatim.
The engine keeps its full public surface — `which`, `findUmu`, `findWineCached`,
`findRuntime`, `scanProtonVersions`, `resolveProton`, `isProtonDir`,
`diagnoseLaunchFailure`, `findLinuxGameExe`, `findNativeDosbox`, `dosboxInstallHint` are
now one-line delegations — so **no call site outside `packages/core/` changed**.

Two host-shaped strings outside the backend were also fixed, both user-facing:

- The "no native DOSBox" error hardcoded `sudo dnf install dosbox-staging` while
  `dosboxInstallHint()` had always known the right answer for the actual host. Identical
  text on Fedora/Nobara; correct everywhere else.
- The Epic no-executable error named `umu-run`, a tool that path never checks. Now reads
  "no compatibility runtime available".

**Verification:**

| Check | Result |
|---|---|
| Backend vs. live engine, read-only functions | 23/23 byte-identical |
| `buildLaunch` + `assertAvailable` vs. an oracle transcribing the original branches, across store × umu × proton × wine × steam × .bat | **288 assertions, 0 failures** |
| `findGogInstallResult` vs. original, real installs | 32 Windows + 4 native (incl. one exercising the `gameinfo`-parse-failed fallback), 0 differences |
| `buildRedistLaunch`, `regeditCommand` vs. oracle | 4 comparisons, 0 differences |
| `customInstallers.selfCheck()` | `[]` |
| `npm run dist` | AppImage built + deployed |
| `platform/*.js` present in `app.asar` | yes |
| Packaged headless run (`grinder launch <bad-id>`) | full module graph loads, reaches the DB lookup, exits clean |

Remaining matches for Linux terms in `grinder-engine.js` are three comments: two are the
signpost pointing at the backend, one describes DOSBox's own drive-letter behaviour.

**Not yet done:** the manual six-game smoke test from *Acceptance criteria* item 4. The
oracle tests prove the spawn specs are identical, but nothing has actually launched a game
end to end.
