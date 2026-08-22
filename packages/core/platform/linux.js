'use strict';
/*
 * @cafeneurotico/core — the Linux platform backend.
 *
 * Everything in here was lifted out of grinder-engine.js unchanged. The comments came with
 * it on purpose: nearly every one of them records a bug that took real debugging to find,
 * and they read as arbitrary without that history.
 *
 * Phase A moves only what grinder-engine.js needs. Paths, desktop integration and store
 * inventory follow in A3–A5, alongside their call sites.
 */

const path  = require('path');
const fs    = require('fs');
const os    = require('os');
const { execSync, spawnSync } = require('child_process');

// ── Injected context ─────────────────────────────────────────────────────────
// Mirrors grinder-engine's own init() idiom. `getDb` is a getter rather than a handle
// because the engine re-attaches its database after init (see setDb).
let HOME       = os.homedir();
let configDir  = '';
let getDb      = () => null;
let expandTilde = p => p;

function init(ctx = {}) {
    HOME        = ctx.homeDir  || HOME;
    configDir   = ctx.configDir || configDir;
    if (typeof ctx.getDb === 'function')       getDb = ctx.getDb;
    if (typeof ctx.expandTilde === 'function') expandTilde = ctx.expandTilde;
}

// ── System inventory ─────────────────────────────────────────────────────────
function which(bin) {
    try { return execSync(`which ${bin}`, { stdio: ['ignore','pipe','ignore'] }).toString().trim(); }
    catch { return null; }
}

// GNU coreutils. `-B1` is not portable — see dirSizeCommand's callers.
function dirSizeCommand(target) { return ['du', '-sB1', target]; }

// ── Store platform identifiers ───────────────────────────────────────────────
// What this host calls itself in the places a platform name is data rather than code:
// the `games.platform` column, GOG's `os` field, and the two downloaders' CLI flags.
const nativeOsKey       = 'linux';     // games.platform / GOG installer `os`
const gogdlPlatform     = 'linux';     // gogdl --platform {windows,osx,linux}
const legendaryPlatform = 'Windows';   // legendary --platform {Windows,Win32,Mac}

// ── Native game launch + install detection ───────────────────────────────────
// Returns the spawn spec for a game built for this host. The chmod is a side effect on
// purpose: gogdl does not preserve the executable bit, so without it a perfectly good
// native install simply refuses to start.
function launchNative({ exe, args = [] }) {
    try { fs.chmodSync(exe, '755'); } catch {}
    return { cmd: exe, args: [...args], env: {} };
}

function findNativeGameExe(gameDir) {
    const folderName = path.basename(gameDir).toLowerCase();
    try {
        const entries = fs.readdirSync(gameDir);
        // 1. .sh launcher at root
        const sh = entries.find(e => e.toLowerCase().endsWith('.sh') && !e.toLowerCase().startsWith('uninstall'));
        if (sh) return sh;
        // 2. Executable binary matching the folder name
        for (const e of entries) {
            if (e.toLowerCase() === folderName || e.toLowerCase() === folderName.replace(/ /g, '_')) {
                const full = path.join(gameDir, e);
                try { if (fs.statSync(full).mode & 0o111) return e; } catch {}
            }
        }
        // 3. Any executable binary (no extension) at root
        for (const e of entries) {
            if (e.includes('.')) continue;
            const full = path.join(gameDir, e);
            try { if (fs.statSync(full).isFile() && (fs.statSync(full).mode & 0o111)) return e; } catch {}
        }
    } catch {}
    return null;
}

// Is `gameDir` a native install of `appId`? gogdl writes .gogdl-linux-manifest after a
// successful Linux install and creates no .info file, so the manifest is the marker.
//
// Guard: verify this directory belongs to the right game so that a previously-installed
// Linux game in the same parent folder is never mistaken for the newly-installed one.
// null = not this game's native install; the caller moves on to the next directory.
function findNativeInstallResult(gameDir, appId, preExistingDirs = null) {
    const linuxManifest = path.join(gameDir, '.gogdl-linux-manifest');
    if (!fs.existsSync(linuxManifest)) return null;
    // Primary check: gogdl writes a plain-text "gameinfo" file whose lines include the
    // numeric appId — fast and reliable.
    try {
        const lines = fs.readFileSync(path.join(gameDir, 'gameinfo'), 'utf8')
            .split('\n').map(l => l.trim());
        if (!lines.includes(String(appId))) return null;
    } catch {
        // gameinfo absent — fall back to the pre-install snapshot: skip any directory
        // that already existed before this install.
        if (preExistingDirs?.has(path.basename(gameDir))) return null;
    }
    return { install_path: gameDir, executable: findNativeGameExe(gameDir) };
}

// ── DOSBox for GOG's DOS games ───────────────────────────────────────────────
// GOG ships a Windows DOSBox 0.74 from 2010 and runs it through Proton: an emulator inside
// a translation layer, when the host can run the emulator directly. A native build is
// faster, gets working sound and fullscreen without Proton's help, and is still maintained.
//
// dosbox-staging is preferred: it is the actively maintained fork and the one distributions
// package today. Plain dosbox and dosbox-x are accepted too.
const DOSBOX_BINARIES = ['dosbox-staging', 'dosbox', 'dosbox-x'];

// Flatpak is the one way to get DOSBox that works on every distribution, so it is worth
// finding too — otherwise someone who installed it that way is told they have none.
const DOSBOX_FLATPAKS = ['io.github.dosbox-staging', 'com.dosbox_x.DOSBox-X'];

// { cmd, args, label } or null. args is non-empty only for the flatpak form.
let _dosboxCache;
function findDosbox() {
    if (_dosboxCache !== undefined) return _dosboxCache;
    _dosboxCache = null;
    for (const b of DOSBOX_BINARIES) {
        const p = which(b);
        if (p) { _dosboxCache = { cmd: p, args: [], label: path.basename(p) }; return _dosboxCache; }
    }
    const flatpak = which('flatpak');
    if (flatpak) {
        for (const id of DOSBOX_FLATPAKS) {
            try {
                const r = spawnSync(flatpak, ['info', id], { encoding: 'utf8', timeout: 4000 });
                if (r.status === 0) { _dosboxCache = { cmd: flatpak, args: ['run', id], label: id }; return _dosboxCache; }
            } catch {}
        }
    }
    return _dosboxCache;
}

// How to get one, in the words of the user's own distribution. Flatpak is always offered
// alongside, because it is the single instruction that works everywhere.
function dosboxInstallHint() {
    let id = '', like = '';
    try {
        const osr = fs.readFileSync('/etc/os-release', 'utf8');
        id   = (osr.match(/^ID=(.*)$/m)      || [, ''])[1].replace(/"/g, '').trim().toLowerCase();
        like = (osr.match(/^ID_LIKE=(.*)$/m) || [, ''])[1].replace(/"/g, '').trim().toLowerCase();
    } catch {}
    const is = (...names) => names.some(n => id === n || like.split(/\s+/).includes(n));
    const native =
        is('fedora', 'rhel', 'centos')  ? 'sudo dnf install dosbox-staging'
      : is('debian', 'ubuntu')          ? 'sudo apt install dosbox-staging'
      : is('arch')                      ? 'sudo pacman -S dosbox-staging'
      : is('opensuse', 'suse')          ? 'sudo zypper install dosbox-staging'
      : is('alpine')                    ? 'sudo apk add dosbox-staging'
      : '';
    return { native, flatpak: 'flatpak install flathub io.github.dosbox-staging' };
}

// Translate GOG's Windows DOSBox invocation for a native binary. Run from the same working
// directory, so the relative -conf paths and the config's own `mount C ".."` still resolve.
//   • backslashes → forward slashes, so ..\game.conf finds the file on Linux
//   • -noconsole is dropped: it exists only to hide a Windows console window, and a native
//     build rejects the unknown option outright
function translateDosboxArgs(gogArgs) {
    const out = [];
    for (let i = 0; i < gogArgs.length; i++) {
        const a = gogArgs[i];
        if (a === '-noconsole') continue;
        if (a === '-conf' && gogArgs[i + 1] !== undefined) {
            out.push('-conf', gogArgs[++i].replace(/\\/g, '/'));
            continue;
        }
        out.push(a);
    }
    return out;
}

const dosbox = { find: findDosbox, installHint: dosboxInstallHint, translateArgs: translateDosboxArgs };

// ═════════════════════════════════════════════════════════════════════════════
// Windows-game runtime: Proton via umu-run, with bare wine as the last resort.
// ═════════════════════════════════════════════════════════════════════════════

let _umu = null, _wine = null;

function findUmu() {
    if (_umu !== null) return _umu;
    _umu = which('umu-run') || '';
    return _umu || null;
}
function findWineCached() {
    if (_wine !== null) return _wine;
    _wine = which('wine') || '';
    return _wine || null;
}

// ── Proton runtime discovery ─────────────────────────────────────────────────
// Every face resolves Proton through here, and we ALWAYS hand umu-run an explicit
// PROTONPATH rather than letting it find its own. Two reasons, both of which showed up as a
// game that "launched" and then did absolutely nothing:
//   1. umu's own discovery (umu_proton.py `_get_from_compat`) keeps only folders whose name
//      `startswith("GE-Proton")` or `("UMU-Proton")`. A perfectly good build installed under
//      any other name — e.g. "Proton-GE Latest", which is what ProtonUp-Qt writes — is
//      invisible to it, so PROTONPATH stays empty and umu exits 1 immediately with
//      `FileNotFoundError: Environment variable not set or is empty: PROTONPATH`.
//   2. With nothing installed at all, umu tries to *download* GE-Proton — hundreds of MB with
//      no progress anywhere in our UI, and a hard failure when the machine is offline.
// Resolving it ourselves also means we can tell the user what's wrong (NO_PROTON below).
const PROTON_SEARCH_DIRS = () => [
    // Steam's own Proton builds
    path.join(HOME, '.steam', 'root', 'steamapps', 'common'),
    path.join(HOME, '.steam', 'steam', 'steamapps', 'common'),
    path.join(HOME, '.local', 'share', 'Steam', 'steamapps', 'common'),
    // GE-Proton and other custom compatibility tools
    path.join(HOME, '.steam', 'root', 'compatibilitytools.d'),
    path.join(HOME, '.steam', 'steam', 'compatibilitytools.d'),
    path.join(HOME, '.local', 'share', 'Steam', 'compatibilitytools.d'),
    // umu's own store, used when no Steam install exists
    path.join(HOME, '.local', 'share', 'umu', 'compatibilitytools'),
    // Flatpak Steam
    path.join(HOME, '.var', 'app', 'com.valvesoftware.Steam', 'data', 'Steam', 'steamapps', 'common'),
    path.join(HOME, '.var', 'app', 'com.valvesoftware.Steam', 'data', 'Steam', 'compatibilitytools.d'),
];

// Is this directory an actual Proton build we can hand to umu? The `proton` launcher script is
// the test that matters: `toolmanifest.vdf` alone also matches Steam's runtime containers
// (SteamLinuxRuntime_*), which are not Proton and would poison the "best available" pick.
function isProtonDir(dir) {
    try { return fs.existsSync(path.join(dir, 'proton')); }
    catch { return false; }
}

// All Proton builds on the machine, best first: GE-Proton, then Steam's, then anything else;
// newest within each group. Named folders are matched loosely on purpose — the *contents*
// decide what counts, not the folder name (that is exactly what umu gets wrong).
function scanRuntimes() {
    const found = [];
    const seen  = new Set();
    for (const dir of PROTON_SEARCH_DIRS()) {
        if (!fs.existsSync(dir)) continue;
        let entries;
        try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
        catch { continue; }
        for (const entry of entries) {
            if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
            const fullPath = path.join(dir, entry.name);
            // Resolve symlinks so ~/.steam/root, ~/.steam/steam and ~/.local/share/Steam
            // (all the same place) don't yield duplicates.
            const realPath = (() => { try { return fs.realpathSync(fullPath); } catch { return fullPath; } })();
            if (seen.has(realPath) || !isProtonDir(realPath)) continue;
            seen.add(realPath);
            const name = entry.name;
            let type = 'other';
            if (/GE-Proton|Proton-GE|UMU-Proton/i.test(name)) type = 'ge';
            else if (/^Proton/i.test(name))                   type = 'steam';
            // A folder called "Proton-GE Latest" says nothing about which build it holds;
            // GE ships the real version in `version` ("<epoch> GE-Proton11-3"), so prefer that
            // for ordering and for anything we show the user.
            let version = '';
            try { version = (fs.readFileSync(path.join(realPath, 'version'), 'utf8').trim().split(/\s+/).pop() || ''); } catch {}
            found.push({ name, path: realPath, type, version, label: version || name });
        }
    }
    const order = { ge: 0, steam: 1, other: 2 };
    return found.sort((a, b) => {
        const to = (order[a.type] ?? 2) - (order[b.type] ?? 2);
        if (to !== 0) return to;
        return b.label.localeCompare(a.label, undefined, { numeric: true, sensitivity: 'base' });
    });
}

// The Proton a given game should run with: its own override, then the configured default,
// then the best one found on disk. Configured paths are existence-checked — a `proton_path`
// left over from a build the user has since deleted is another way to end up launching
// nothing at all.
function resolveRuntime(game) {
    const usable = p => { const e = expandTilde(p || ''); return e && isProtonDir(e) ? e : ''; };
    const own = usable(game?.proton_path);
    if (own) return own;
    let configured = '';
    try { configured = getDb()?.prepare("SELECT value FROM settings WHERE key='default_proton_path'").get()?.value || ''; } catch {}
    const def = usable(configured);
    if (def) return def;
    return scanRuntimes()[0]?.path || '';
}

// Turn a dead game's output into something a person can act on. Anything we don't recognise
// stays UNKNOWN — the face shows the log tail rather than inventing a cause.
function diagnose(log, protonPath) {
    const t = String(log || '');
    if (/PROTONPATH/i.test(t) && /not set or is empty|FileNotFoundError/i.test(t))
        return { code: 'NO_PROTON', message: 'No Proton build was available to run this Windows game.' };
    if (/umu-run|umu_run\.py/i.test(t) && /Traceback/i.test(t))
        return { code: 'UMU_FAILED', message: 'umu-run could not start the game.' };
    if (/command not found|No such file or directory/i.test(t) && !protonPath)
        return { code: 'MISSING_RUNTIME', message: 'The compatibility runtime is missing.' };
    if (/wine: cannot find|is not a valid Win32|Bad EXE format/i.test(t))
        return { code: 'BAD_EXE', message: 'The game executable could not be run by Proton/Wine.' };
    return { code: 'UNKNOWN', message: 'The game closed immediately after starting.' };
}

// ── First-launch progress ────────────────────────────────────────────────────
// The first Windows game on a machine doesn't start for minutes: umu downloads the steamrt
// runtime (several hundred MB) and Proton then builds the game's Wine prefix. Every new game
// pays the prefix cost again.
//
// Phases are matched against umu's real output. Percentages are step markers, not byte counts:
// umu prints no percentage, so the honest live signal during the big download is the growing
// `.parts` file, reported as MB in the message.
const STARTUP_STEPS = [
    { re: /Setting up Unified Launcher/i,                    phase: 'setup',    percent: 5,   message: 'Preparing the compatibility layer…' },
    { re: /Downloading steamrt|Downloading SteamLinuxRuntime/i, phase: 'runtime', percent: 15, message: 'Downloading the compatibility runtime — one-time setup, this takes a few minutes.' },
    { re: /SHA256 is OK/i,                                   phase: 'verify',   percent: 45,  message: 'Checking the download…' },
    { re: /Verifying integrity of/i,                         phase: 'verify',   percent: 50,  message: 'Verifying the runtime…' },
    { re: /mtree is OK|Using steamrt/i,                      phase: 'ready',    percent: 60,  message: 'Compatibility runtime ready.' },
    // protonfixes runs on every launch and lands BEFORE the prefix build in umu's output, so it
    // sits below `prefix` here — percentages are clamped monotonic and must not walk backwards.
    { re: /Running protonfixes|Running checks/i,             phase: 'fixes',    percent: 70,  message: 'Applying compatibility fixes…' },
    // "Upgrading prefix" is printed only when the prefix is new or the Proton build changed —
    // deliberately NOT matching generic wine startup chatter, which would show the panel on
    // every ordinary launch.
    { re: /Upgrading prefix from|Creating prefix/i,          phase: 'prefix',   percent: 80,  message: "Setting up this game's Windows environment…" },
    { re: /Downloading upscaler file|Downloading .* dll/i,   phase: 'extras',   percent: 88,  message: 'Downloading graphics components…' },
    { re: /Executable is a unix path|^Proton: \//im,         phase: 'starting', percent: 95,  message: 'Starting the game…' },
    { re: /ntsync: up and running|wineserver: created/i,     phase: 'running',  percent: 100, message: 'Running.' },
];

// Bytes fetched so far by umu's resumable download (`<archive>.<buildid>.parts`, written under
// a temp dir in XDG_CACHE_HOME/umu). Best-effort: no file → no counter, just the phase text.
function setupBytes() {
    const cacheRoot = path.join(process.env.XDG_CACHE_HOME || path.join(HOME, '.cache'), 'umu');
    let total = 0;
    const walk = (dir, depth) => {
        if (depth > 2) return;
        let entries;
        try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
        for (const en of entries) {
            const p = path.join(dir, en.name);
            if (en.isDirectory()) walk(p, depth + 1);
            else if (en.name.endsWith('.parts')) { try { total += fs.statSync(p).size; } catch {} }
        }
    };
    walk(cacheRoot, 0);
    return total;
}

// Thrown before we spawn anything, so the faces can offer to install Proton instead of
// letting umu fail invisibly.
function unavailableError() {
    const err = new Error(
        'No Proton build found. Windows games need Proton (GE-Proton is recommended) — ' +
        'install one from the Control Panel, or point Cafe Neurotico at an existing build.');
    err.code = 'NO_PROTON';
    return err;
}

// Locate BattlEye or EAC runtime: GRINDER's own copy first, then common Steam locations
function findAntiCheatRuntime(name) {
    const steamName = name === 'battleye_runtime' ? 'Battleye AntiCheat' : 'EasyAntiCheat';
    return [
        path.join(configDir, 'runtimes', name),
        path.join(HOME, '.steam', 'root', 'steamapps', 'common', steamName),
        path.join(HOME, '.local', 'share', 'Steam', 'steamapps', 'common', steamName),
        path.join(HOME, '.var', 'app', 'com.valvesoftware.Steam', '.local', 'share', 'Steam', 'steamapps', 'common', steamName),
    ].find(p => fs.existsSync(p)) || null;
}

// Is a compatibility layer going to be involved at all? Decides both the compat env vars
// and whether a game's own shipped wrapper DLLs need an override to be seen.
function inUse(runtimePath) { return !!(runtimePath || findUmu()); }

// Whether *anything* can run a Windows executable here.
function canRun(runtimePath) { return !!(runtimePath || findWineCached()); }

// Compat env vars — mirrors Heroic's launcher.ts logic exactly
function compatEnv(game, runtimePath) {
    const env = {};
    if (inUse(runtimePath)) {
        if (!game.use_esync)     env.PROTON_NO_ESYNC = '1';
        if (!game.use_fsync)     env.PROTON_NO_FSYNC = '1';
        if (game.use_dxvk_nvapi) { env.PROTON_ENABLE_NVAPI = '1'; env.DXVK_NVAPI_ALLOW_OTHER_DRIVERS = '1'; }
    } else {
        if (game.use_esync !== 0) env.WINEESYNC = '1';
        if (game.use_fsync !== 0) env.WINEFSYNC = '1';
        if (game.use_dxvk_nvapi) { env.DXVK_ENABLE_NVAPI = '1'; env.DXVK_NVAPI_ALLOW_OTHER_DRIVERS = '1'; }
    }
    if (game.use_battleye) { const p = findAntiCheatRuntime('battleye_runtime'); if (p) env.PROTON_BATTLEYE_RUNTIME = p; }
    if (game.use_eac)      { const p = findAntiCheatRuntime('eac_runtime');       if (p) env.PROTON_EAC_RUNTIME      = p; }
    return env;
}

// A host path as the runtime sees it. Z: maps to the filesystem root under Wine, and .bat
// files must be launched via that Windows path — Proton/wine can't run .bat from a raw
// Linux path. The same form is what registry values have to carry.
function toWindowsPath(p) { return ('Z:' + p).replace(/\//g, '\\'); }

// Refuse a launch that is guaranteed to die in silence. Bare wine stays reachable only where
// it is genuinely the sole option — with umu-run installed, Proton is the supported path and
// quietly dropping to wine (no DXVK, no Proton patches) just trades a visible failure for a
// mysterious one.
function assertAvailable(runtimePath) {
    if (!runtimePath && (findUmu() || !findWineCached())) throw unavailableError();
}

// The spawn spec for one Windows game. `env` is the EXTRA environment only — the caller
// merges it over its own base (system → per-game custom vars → compat flags).
function buildLaunch({ game, gameId, launchExe, isBat, userArgs, allArgs, runtimePath, prefix }) {
    const umu = findUmu();
    const gameid = game.app_id || `grinder-${gameId}`;

    // Epic titles are launched with the user's own arguments only — legendary owns the rest.
    if (game.store === 'epic' && umu && runtimePath) {
        return { cmd: umu, args: [launchExe, ...userArgs],
                 env: { WINEPREFIX: prefix, PROTONPATH: runtimePath, GAMEID: gameid },
                 method: 'umu-run' };
    }

    if (umu && runtimePath) {
        return { cmd: umu, args: [launchExe, ...allArgs],
                 env: { WINEPREFIX: prefix, PROTONPATH: runtimePath, GAMEID: gameid },
                 method: isBat ? 'umu-run-bat' : 'umu-run' };
    }

    if (runtimePath) {
        const steamRoot = which('steam') ? path.dirname(which('steam')) : path.join(HOME, '.steam', 'root');
        const protonBin = path.join(runtimePath, 'proton');
        if (!fs.existsSync(protonBin)) throw new Error(`proton script not found in ${runtimePath}`);
        return { cmd: protonBin, args: ['run', launchExe, ...allArgs],
                 env: { WINEPREFIX: prefix, STEAM_COMPAT_DATA_PATH: prefix, STEAM_COMPAT_CLIENT_INSTALL_PATH: steamRoot },
                 method: isBat ? 'proton-bat' : 'proton-direct' };
    }

    const wine = findWineCached();
    if (!wine) throw new Error('No launch method: umu-run not found, no Proton path set, wine not installed.');
    return { cmd: wine, args: [launchExe, ...allArgs], env: { WINEPREFIX: prefix }, method: 'wine' };
}

// The spawn spec for one redistributable installer. Unlike buildLaunch this returns the
// COMPLETE env, because redists are run standalone rather than under a game's own base.
function buildRedistLaunch({ exePath, exeArgs, prefix, runtimePath }) {
    const umu = findUmu();
    const steamRoot = path.join(HOME, '.steam', 'root');
    const env = { ...process.env, WINEPREFIX: prefix, STEAM_COMPAT_DATA_PATH: prefix,
                  STEAM_COMPAT_CLIENT_INSTALL_PATH: steamRoot, GAMEID: 'umu-0', PROTON_VERB: 'run' };
    if (runtimePath) env.PROTONPATH = runtimePath;

    if (umu && runtimePath) return { cmd: umu, args: [exePath, ...exeArgs], env };
    if (runtimePath)        return { cmd: path.join(runtimePath, 'proton'), args: ['run', exePath, ...exeArgs], env };
    delete env.PROTONPATH;
    return { cmd: findWineCached(), args: [exePath, ...exeArgs], env };
}

const REDIST_UNAVAILABLE_MESSAGE =
    'No Proton version configured and Wine not found. Set a default Proton in Settings.';

// Merge a .reg file into a prefix. Proton's own wine is preferred; it runs outside umu's
// container, which is what lets regedit read a file from the host's /tmp at all.
function regeditCommand({ prefix, runtimePath, regFile }) {
    let wineBin = 'wine';
    if (runtimePath) {
        const candidates = [
            path.join(runtimePath, 'files', 'bin', 'wine64'),
            path.join(runtimePath, 'files', 'bin', 'wine'),
        ];
        for (const c of candidates) {
            if (fs.existsSync(c)) { wineBin = c; break; }
        }
    }
    return {
        cmd: wineBin,
        args: ['regedit', '/S', regFile],
        env: { ...process.env, WINEPREFIX: prefix, WINEDEBUG: '-all' },
    };
}

const runtime = {
    id: 'proton',
    prefixesDirName: 'prefixes',
    setupPhase: 'runtime',          // the STARTUP_STEPS phase whose byte counter is live
    scan: scanRuntimes,
    resolve: resolveRuntime,
    isRuntimeDir: isProtonDir,
    inUse, canRun, assertAvailable,
    compatEnv, buildLaunch, buildRedistLaunch, regeditCommand,
    toWindowsPath, diagnose, unavailableError,
    findAntiCheatRuntime,
    startupSteps: () => STARTUP_STEPS,
    setupBytes,
    redistUnavailableMessage: REDIST_UNAVAILABLE_MESSAGE,
    findUmu, findWine: findWineCached,
};

module.exports = {
    id: 'linux',
    init,
    which, dirSizeCommand,
    nativeOsKey, gogdlPlatform, legendaryPlatform,
    launchNative, findNativeGameExe, findNativeInstallResult,
    dosbox,
    runtime,
};
