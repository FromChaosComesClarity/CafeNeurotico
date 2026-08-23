'use strict';
/*
 * @cafeneurotico/core — the macOS platform backend.
 *
 * Sibling to linux.js, same shape, picked up by platform/index.js the moment this file
 * exists. Phase B: paths, store identifiers, system inventory and desktop integration are
 * real. `runtime.*` (the Windows-game compatibility layer — CrossOver on this host) stays
 * stubbed through Phase D; Phase E gives it a real implementation. See
 * docs/mac-port-phase-a.md and docs/mac-port-handoff.md.
 */

const path  = require('path');
const fs    = require('fs');
const os    = require('os');
const { execSync, spawnSync, spawn } = require('child_process');

// ── Injected context ─────────────────────────────────────────────────────────
// Mirrors linux.js's init() idiom — see its comment.
let HOME       = os.homedir();
let configDir  = '';
let getDb      = () => null;
let expandTilde = p => (p && p.startsWith('~') ? path.join(HOME, p.slice(1)) : p);

function init(ctx = {}) {
    HOME        = ctx.homeDir  || HOME;
    configDir   = ctx.configDir || configDir;
    if (typeof ctx.getDb === 'function')       getDb = ctx.getDb;
    if (typeof ctx.expandTilde === 'function') expandTilde = ctx.expandTilde;
}

// ── Paths ────────────────────────────────────────────────────────────────────
const binDirName = 'darwin-arm64';

// Not portable on macOS: an .app in /Applications cannot hold user data (and an unsigned
// dev build cannot reliably write beside itself either — see Trap 1 in the handoff). Every
// build, packaged or dev, keeps its data in the same per-user Library location.
function portableBaseDir() {
    return path.join(HOME, 'Library', 'Application Support', 'CafeNeurotico');
}

// There is no APPIMAGE equivalent. `process.execPath` is the real binary either way — inside
// the .app bundle when packaged, the Electron binary itself in dev.
function selfExecutable() { return process.execPath; }

// Electron sets `process.defaultApp` when running unpackaged (`electron .`); a packaged
// .app has no such flag and takes the face arguments directly, exactly like the AppImage.
function selfSpawnArgs(faceArgs, repoRoot) {
    return process.defaultApp ? [repoRoot, ...faceArgs] : [...faceArgs];
}

// grinder.db, in the order it should be looked for. Kept as a list (not a single path) so a
// pre-merge standalone GRINDER.app install is still found, same as Linux's ~/.config split.
function grinderDbCandidates(baseDir) {
    return [
        path.join(HOME, 'Library', 'Application Support', 'grinder', 'grinder.db'),
        path.join(HOME, 'Library', 'Application Support', 'GRINDER', 'grinder.db'),
        path.join(baseDir, 'GRINDERConfig', 'grinder.db'),
    ];
}
function findGrinderDb(baseDir) {
    return grinderDbCandidates(baseDir).find(p => fs.existsSync(p)) || null;
}

function grinderDbCreatePath(baseDir, isPackaged) {
    return isPackaged
        ? path.join(HOME, 'Library', 'Application Support', 'grinder', 'grinder.db')
        : path.join(baseDir, 'GRINDERConfig', 'grinder.db');
}

// ── System inventory ─────────────────────────────────────────────────────────
// A Finder-launched .app has NO Homebrew in PATH (Trap 2) — `which` alone would report every
// Homebrew-installed tool as missing. Fall back to both Homebrew prefixes explicitly.
function which(bin) {
    try {
        const p = execSync(`which ${bin}`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
        if (p) return p;
    } catch {}
    for (const dir of ['/opt/homebrew/bin', '/usr/local/bin']) {
        const p = path.join(dir, bin);
        if (fs.existsSync(p)) return p;
    }
    return null;
}

// BSD du has no -B1 (that's GNU-only) — -sk reports 1K blocks everywhere, so multiply by
// 1024 ourselves instead of asking du for bytes it can't give.
function dirSizeBytesCommand(target) {
    return {
        cmd: `du -sk "${target}" 2>/dev/null`,
        parse: out => { const n = parseInt((String(out).split('\t')[0] || '').trim(), 10); return Number.isFinite(n) ? n * 1024 : null; },
    };
}
function dirSizeHumanCommand(target) {
    return { cmd: `du -sh "${target}" 2>/dev/null`, parse: out => String(out).split('\t')[0].trim() };
}

function legendaryConfigDir() { return path.join(HOME, 'Library', 'Application Support', 'legendary'); }

// ── Desktop integration ──────────────────────────────────────────────────────
// canInstallMenuEntries is false — the .app bundle IS the menu entry, there is no separate
// launcher-file mechanism to install one into. The "install to menu" UI path is gated on
// this flag already. What's below still backs the per-game "add shortcut" path (desktop only
// on this host) and the CREMA autostart toggle, both of which are called unconditionally.

function appsDir() { return null; } // no menu concept on this host; canInstallMenuEntries gates the caller

function desktopDir() { return path.join(HOME, 'Desktop'); }

// A double-clickable shell script, since a real .app bundle is more than a launcher can
// reasonably build on the fly. `.command` files are Finder-executable by convention.
function launcherFileName(id) { return `${id}.command`; }

// entry: { id, name, comment, exec, args[], icon, categories[], keywords[], wmClass, extraLines[] }
function launcherContent(entry) {
    const args = (entry.args || []).map(a => `"${String(a).replace(/"/g, '\\"')}"`).join(' ');
    const target = /\.app$/i.test(entry.exec)
        ? `open -n "${entry.exec}"${args ? ` --args ${args}` : ''}`
        : `"${entry.exec}"${args ? ` ${args}` : ''}`;
    return `#!/bin/bash\n# ${entry.name || entry.id}${entry.comment ? ' — ' + entry.comment : ''}\n${target}\n`;
}

function writeLauncher(dir, entry) {
    fs.mkdirSync(dir, { recursive: true });
    const p = path.join(dir, launcherFileName(entry.id));
    fs.writeFileSync(p, launcherContent(entry));
    try { fs.chmodSync(p, '755'); } catch {}
    return p;
}

function removeLauncher(dir, id) {
    try { fs.unlinkSync(path.join(dir, launcherFileName(id))); return true; } catch { return false; }
}

// No menu database to poke — Finder picks up Desktop changes on its own.
function refreshMenu() {}

// No quarantine-style "trust this launcher" step for a locally-created file (a build made
// on this machine never gets the quarantine bit — see Phase B.5 in the handoff).
function markTrusted() {}

// Login Items via a LaunchAgent plist — the macOS equivalent of XDG autostart.
function autostartPath(id) { return path.join(HOME, 'Library', 'LaunchAgents', `com.cafeneurotico.${id}.plist`); }
function getAutostart(id)  { try { return fs.existsSync(autostartPath(id)); } catch { return false; } }
function setAutostart(id, enabled, entry) {
    const file = autostartPath(id);
    if (!enabled) { try { fs.unlinkSync(file); } catch {} return { ok: true, enabled: false }; }
    try {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        const args = [entry?.exec, ...(entry?.args || [])].filter(Boolean)
            .map(a => `    <string>${String(a).replace(/&/g, '&amp;').replace(/</g, '&lt;')}</string>`).join('\n');
        const plist = `<?xml version="1.0" encoding="UTF-8"?>\n` +
            `<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n` +
            `<plist version="1.0"><dict>\n` +
            `  <key>Label</key><string>com.cafeneurotico.${id}</string>\n` +
            `  <key>ProgramArguments</key><array>\n${args}\n  </array>\n` +
            `  <key>RunAtLoad</key><true/>\n` +
            `</dict></plist>\n`;
        fs.writeFileSync(file, plist);
        try { spawn('launchctl', ['load', '-w', file], { stdio: 'ignore' }).unref(); } catch {}
        return { ok: true, enabled: true };
    } catch (e) { return { ok: false, error: e.message }; }
}

// Custom URL schemes (itch://, pico8-cart:) — `open` is macOS's xdg-open.
function openUrlScheme(url) { try { spawn('open', [url], { detached: true, stdio: 'ignore' }).unref(); } catch {} }

// Electron's own focus() is not fighting a window manager here the way it is under X11, so
// it needs no wmctrl-style workaround.
function focusWindow(win) { try { win.show(); win.focus(); } catch {} }

const desktop = {
    canInstallMenuEntries: false,
    appsDir, desktopDir, launcherFileName, writeLauncher, removeLauncher,
    refreshMenu, markTrusted,
    autostartPath, getAutostart, setAutostart,
    openUrlScheme, focusWindow,
    // No window-rule engine on this host; the UI already handles a null here.
    displayPicker: null,
};

// ── Steam ────────────────────────────────────────────────────────────────────
function steamLibraryPaths() {
    const root = path.join(HOME, 'Library', 'Application Support', 'Steam');
    const sa = path.join(root, 'steamapps');
    const dirs = new Set();
    if (fs.existsSync(sa)) {
        dirs.add(sa);
        try {
            const vdf = path.join(sa, 'libraryfolders.vdf');
            if (fs.existsSync(vdf)) {
                const content = fs.readFileSync(vdf, 'utf8');
                for (const m of content.matchAll(/"path"\s+"([^"]+)"/g)) {
                    const extra = path.join(m[1], 'steamapps');
                    if (fs.existsSync(extra)) dirs.add(extra);
                }
            }
        } catch (e) {}
    }
    return [...dirs];
}

function steamLaunchCommand(appId) { return `open steam://rungameid/${appId}`; }

// ── Other stores this host knows about ───────────────────────────────────────
// No Flatpak on macOS. scan-flatpak already no-ops on `supported: false`; find-flatpak-icon
// is called unconditionally, so findIcon still has to exist and answer null.
const extraStore = { supported: false, label: '', scan: () => [], findIcon: () => null };

// ── Store platform identifiers ───────────────────────────────────────────────
const nativeOsKey       = 'osx';      // games.platform / GOG installer `os`
const gogdlPlatform     = 'osx';      // gogdl --platform {windows,osx,linux}
const legendaryPlatform = 'Mac';      // legendary --platform {Windows,Win32,Mac} — its own default on darwin

// ── Native game launch + install detection ───────────────────────────────────
// A native macOS build is usually a .app bundle; `open -n` launches it without waiting and
// without going through LaunchServices' "already running" de-dup, which matters for games
// that might legitimately be reopened. Anything else (a bare Unix executable, e.g. a
// source-port build) is spawned directly, same as Linux.
function launchNative({ exe, args = [] }) {
    if (/\.app$/i.test(exe)) {
        return { cmd: 'open', args: args.length ? ['-n', exe, '--args', ...args] : ['-n', exe], env: {} };
    }
    try { fs.chmodSync(exe, '755'); } catch {}
    return { cmd: exe, args: [...args], env: {} };
}

function findNativeGameExe(gameDir) {
    try {
        const entries = fs.readdirSync(gameDir);
        // GOG's macOS installers drop the game as a .app bundle at the install root.
        const app = entries.find(e => e.toLowerCase().endsWith('.app'));
        if (app) return app;
        // Fallback: a bare executable matching the folder name (source-port style installs).
        const folderName = path.basename(gameDir).toLowerCase();
        for (const e of entries) {
            if (e.toLowerCase() === folderName || e.toLowerCase() === folderName.replace(/ /g, '_')) {
                const full = path.join(gameDir, e);
                try { if (fs.statSync(full).mode & 0o111) return e; } catch {}
            }
        }
    } catch {}
    return null;
}

// Is `gameDir` a native macOS install of `appId`? Verified against a real
// `gogdl --platform osx download` (Phase D): unlike Linux, gogdl writes no manifest file at
// all here — the game IS the .app bundle, dropped directly under the shared install root with
// no extra per-game wrapper folder. findGogInstallResult's caller peels one level off that
// root before calling us, so `gameDir` here typically already IS the bundle; a plain folder
// containing one (a source-port style install) is handled too. It carries its own
// goggame-<appId>.info inside Contents/Resources (same playTasks shape as the Windows .info
// file) — the filename already encodes the appId, so there's no ambiguity to guess at.
//
// install_path must be safe to `rm -rf` alone on uninstall (see headlessUninstall), so it has
// to be the bundle itself, never the shared root above it — which makes `executable` a
// self-reference ('.') rather than a name, so resolvedExe's path.join(install_path, executable)
// still lands on the bundle. launchNative's `open -n` then resolves the real binary through
// the bundle's own Info.plist (CFBundleExecutable), exactly as GOG's own installer would.
function findNativeInstallResult(gameDir, appId) {
    const isApp = /\.app$/i.test(gameDir);
    const bundle = isApp ? gameDir : (() => { const a = findNativeGameExe(gameDir); return a ? path.join(gameDir, a) : null; })();
    if (!bundle) return null;
    const infoFile = path.join(bundle, 'Contents', 'Resources', `goggame-${appId}.info`);
    if (!fs.existsSync(infoFile)) return null;
    return { install_path: bundle, executable: '.' };
}

// ── DOSBox for GOG's DOS games ───────────────────────────────────────────────
// Same binaries, no Flatpak fallback (Homebrew is the one packaging story on this host).
const DOSBOX_BINARIES = ['dosbox-staging', 'dosbox', 'dosbox-x'];

let _dosboxCache;
function findDosbox() {
    if (_dosboxCache !== undefined) return _dosboxCache;
    _dosboxCache = null;
    for (const b of DOSBOX_BINARIES) {
        const p = which(b);
        if (p) { _dosboxCache = { cmd: p, args: [], label: path.basename(p) }; return _dosboxCache; }
    }
    return _dosboxCache;
}

function dosboxInstallHint() { return { native: 'brew install dosbox', flatpak: '' }; }

// Same path normalisation as Linux — host-agnostic string handling, not OS-specific logic.
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
// Windows-game runtime: stubbed through Phase D. CrossOver is the Phase E plan (its
// ARM64/FEX transition is still landing — see the handoff's Trap 3), so nothing here is
// wired to a real compatibility layer yet. assertAvailable() and the two build*
// functions throw unavailableError(); everything else answers "nothing available".
// ═════════════════════════════════════════════════════════════════════════════

function unavailableError() {
    const err = new Error(
        'Windows games are not supported on macOS yet. That work is Phase E of the mac port ' +
        '(CrossOver) — see docs/mac-port-handoff.md.');
    err.code = 'NO_RUNTIME';
    return err;
}

const management = {
    supported: false,
    label: 'CrossOver',
    installDirs:      () => [],
    managedDirs:       () => [],
    resolveInstallDir: () => { throw unavailableError(); },
    isManagedDir:      () => false,
    listReleases:  async () => ({ ok: false, error: 'Not available on macOS yet.', releases: [] }),
    latestRelease: async () => ({ ok: false, error: 'Not available on macOS yet.' }),
    install:       async () => ({ ok: false, error: 'Not available on macOS yet.' }),
    cancel: () => false,
    remove: () => ({ ok: false, error: 'Not available on macOS yet.' }),
};

function runnerTools() { return []; }
async function installRunner() { return { ok: false, error: 'Not available on macOS yet.' }; }

const runtime = {
    id: 'crossover',
    management,
    tools: runnerTools,
    canInstallRunner: false,
    installRunner,
    prefixesDirName: 'prefixes',
    setupPhase: 'runtime',
    scan: () => [],
    resolve: () => '',
    isRuntimeDir: () => false,
    inUse: () => false,
    canRun: () => false,
    assertAvailable: () => { throw unavailableError(); },
    compatEnv: () => ({}),
    buildLaunch: () => { throw unavailableError(); },
    buildRedistLaunch: () => { throw unavailableError(); },
    regeditCommand: () => null,
    toWindowsPath: p => p,
    diagnose: () => ({ code: 'UNKNOWN', message: 'Windows game compatibility is not available on macOS yet.' }),
    unavailableError,
    findAntiCheatRuntime: () => null,
    startupSteps: () => [],
    setupBytes: () => 0,
    redistUnavailableMessage: 'Windows game compatibility is not available on macOS yet.',
    findUmu: () => null,
    findWine: () => null,
};

module.exports = {
    id: 'darwin',
    init,
    binDirName, portableBaseDir, selfExecutable, selfSpawnArgs,
    grinderDbCandidates, findGrinderDb, grinderDbCreatePath,
    which, dirSizeBytesCommand, dirSizeHumanCommand, legendaryConfigDir,
    steamLibraryPaths, steamLaunchCommand, extraStore, desktop,
    nativeOsKey, gogdlPlatform, legendaryPlatform,
    launchNative, findNativeGameExe, findNativeInstallResult,
    dosbox,
    runtime,
};
