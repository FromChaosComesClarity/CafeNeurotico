'use strict';
/*
 * @cafeneurotico/core — GRINDER engine (window-free).
 *
 * The GOG/Epic install/uninstall/launch machinery, lifted out of GRINDER's
 * window-bound main.js so it can run in-process from any face of the suite
 * (the grinder GUI, and — Phase 2b — the Manager's in-process installer).
 *
 * All interactive UI (OAuth login windows, file/dir pickers) stays in
 * grinder/main.js IPC handlers; nothing here imports electron. Progress is
 * reported through an injected `onProgress(data)` callback instead of writing
 * a file directly, so the caller decides where it goes (grinder → progress
 * file; Manager → IPC event).
 *
 * Usage:
 *   const engine = require('../../packages/core/grinder-engine.js');
 *   engine.init({ configDir, prefixesDir, logDir, binDir, appImageDir,
 *                 homeDir, db, onProgress });
 *   // then call engine.findGogdl(), engine.launchGame(id), etc.
 *
 * This is built up in slices; slice 1 is the pure path/binary helper layer.
 */

const path = require('path');
const fs   = require('fs');
const os   = require('os');
const { spawn, execSync } = require('child_process');
const Database = require('better-sqlite3');

// ── Injected context (set by init) ────────────────────────────────────────────
let configDir, prefixesDir, logDir, binDir, appImageDir, HOME, db, _onProgress;
let BUNDLED_LEGENDARY, BUNDLED_GOGDL, BUNDLED_COMET;

function init(ctx = {}) {
    configDir    = ctx.configDir;
    prefixesDir  = ctx.prefixesDir;
    logDir       = ctx.logDir;
    binDir       = ctx.binDir;
    appImageDir  = ctx.appImageDir;
    HOME         = ctx.homeDir || os.homedir();
    db           = ctx.db || db;
    _onProgress  = ctx.onProgress || _onProgress || (() => {});

    BUNDLED_LEGENDARY = path.join(binDir, 'legendary');
    BUNDLED_GOGDL     = path.join(binDir, 'gogdl');
    BUNDLED_COMET     = path.join(binDir, 'comet');
}

// Allow the DB handle to be (re)attached after init (grinder opens it in initDb).
function setDb(handle) { db = handle; }

// Progress sink — callers inject the real destination via init({ onProgress }).
function writeProgress(data) { _onProgress(data); }

// ── Pure helpers ───────────────────────────────────────────────────────────────
function sanitizeLogName(title) {
    return (title || 'unknown').replace(/[^a-zA-Z0-9_\-]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '').slice(0, 80) || 'unknown';
}

function expandTilde(p) {
    if (!p) return p;
    if (p === '~') return HOME;
    if (p.startsWith('~/')) return path.join(HOME, p.slice(2));
    return p;
}

// Resolves a file path case-insensitively, segment by segment.
// Needed because GOG manifests declare Windows-style casing (e.g. DOOM3.exe)
// while the installer writes different casing on disk (e.g. Doom3.exe).
function resolvePathCaseInsensitive(filePath) {
    if (!filePath) return filePath;
    if (fs.existsSync(filePath)) return filePath;
    // Split and filter empty strings — leading '/' on absolute paths produces an
    // empty first element that would cause path.join to build a relative path.
    const isAbs = path.isAbsolute(filePath);
    const parts  = filePath.split(path.sep).filter(p => p !== '');
    let resolved = isAbs ? path.sep : parts[0];
    const start  = isAbs ? 0 : 1;
    for (let i = start; i < parts.length; i++) {
        const segment = parts[i];
        const exact   = path.join(resolved, segment);
        if (fs.existsSync(exact)) { resolved = exact; continue; }
        try {
            const match = fs.readdirSync(resolved).find(e => e.toLowerCase() === segment.toLowerCase());
            if (match) { resolved = path.join(resolved, match); }
            else       { resolved = path.join(resolved, ...parts.slice(i)); break; }
        } catch     { resolved = path.join(resolved, ...parts.slice(i)); break; }
    }
    return resolved;
}

// ── External tool helpers ─────────────────────────────────────────────────────
function which(bin) {
    try { return execSync(`which ${bin}`, { stdio: ['ignore','pipe','ignore'] }).toString().trim(); }
    catch { return null; }
}

// Tool paths resolved once — avoids repeated execSync('which ...') on every launch/IPC call
let _legendary = null, _gogdl = null, _comet = null, _umu = null, _wine = null;
let _activeInstallProc = null;   // the gogdl/legendary child currently downloading (for cancel)
let _activeKillTimer   = null;
let _installCancelled  = false;  // set by cancel → makes the failure message read "cancelled"
// Kill the in-flight headless download, if any. gogdl/legendary spawn parallel download workers, so a
// SIGTERM to just the main process often leaves it waiting on them (and the download running) → the
// close handler never fires and the UI hangs on "Cancelling…". We kill the whole PROCESS GROUP (the
// children are spawned detached = group leaders) and hard-kill with SIGKILL if it doesn't exit quickly.
// The spawn's close handler then resolves failure, headlessInstall emits an error event, and the
// caller's _grinderBusy clears + the queue advances.
function cancelActiveInstall() {
    const proc = _activeInstallProc;
    if (!proc || !proc.pid) return false;
    _installCancelled = true;
    const killGroup = (sig) => {
        try { process.kill(-proc.pid, sig); }        // negative pid = the whole process group
        catch { try { proc.kill(sig); } catch {} }   // fallback: at least the main child
    };
    killGroup('SIGTERM');
    if (_activeKillTimer) clearTimeout(_activeKillTimer);
    _activeKillTimer = setTimeout(() => killGroup('SIGKILL'), 3000);  // uncatchable — guarantees exit
    return true;
}
function findLegendary() {
    if (_legendary !== null) return _legendary;
    _legendary = fs.existsSync(BUNDLED_LEGENDARY) ? BUNDLED_LEGENDARY : (which('legendary') || '');
    return _legendary || null;
}
function findGogdl() {
    if (_gogdl !== null) return _gogdl;
    _gogdl = fs.existsSync(BUNDLED_GOGDL) ? BUNDLED_GOGDL : (which('gogdl') || '');
    return _gogdl || null;
}
function findComet() {
    if (_comet !== null) return _comet;
    _comet = fs.existsSync(BUNDLED_COMET) ? BUNDLED_COMET : (which('comet') || '');
    return _comet || null;
}
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

// Locate BattlEye or EAC runtime: GRINDER's own copy first, then common Steam locations
function findRuntime(name) {
    const steamName = name === 'battleye_runtime' ? 'Battleye AntiCheat' : 'EasyAntiCheat';
    return [
        path.join(configDir, 'runtimes', name),
        path.join(HOME, '.steam', 'root', 'steamapps', 'common', steamName),
        path.join(HOME, '.local', 'share', 'Steam', 'steamapps', 'common', steamName),
        path.join(HOME, '.var', 'app', 'com.valvesoftware.Steam', '.local', 'share', 'Steam', 'steamapps', 'common', steamName),
    ].find(p => fs.existsSync(p)) || null;
}

// ── Moved from grinder/main.js (slice 2): GOG creds + install/launch/auth engine ──
const GOG_CLIENT_ID     = '46899977096215655';

const GOG_CLIENT_SECRET = '9d85c43b1482497dbbce61f6e4aa173a433796eeae2ca8c5f6129f2dc4de46d9';

const GOG_REDIRECT_URI  = 'https://embed.gog.com/on_login_success?origin=client';

function syncSharedDb(appId, installed) {
    const sharedDbPath = path.join(appImageDir, 'GameManagerConfig', 'games.db');
    if (!fs.existsSync(sharedDbPath)) return;
    try {
        const sdb = new Database(sharedDbPath);
        // Match by app_id column, or fall back to matching the ID inside the LaunchCommand
        const byAppId = sdb.prepare("UPDATE games SET Installed=? WHERE app_id=?").run(installed ? 1 : 0, appId);
        if (byAppId.changes === 0) {
            sdb.prepare("UPDATE games SET Installed=? WHERE LaunchCommand LIKE ?").run(installed ? 1 : 0, `%${appId}%`);
        }
        sdb.close();
    } catch {}
}

async function headlessInstall(store, appId, platform, installDir, opts = {}) {
    const title = (() => { try { return db?.prepare("SELECT title FROM games WHERE app_id=? AND store=?").get(appId, store)?.title || appId; } catch { return appId; } })();
    const base = { title, store, appId, done: false };
    _installCancelled = false;   // fresh run — cleared so a prior cancel doesn't mislabel this one
    // DLC directives (opts): withDlcs/dlcIds = add DLCs; skipDlcs = base only ("Reset DLCs").
    // `dlcOp` = any DLC-scoped operation.
    //
    // SAFETY (learned the hard way — this caused base-game deletion):
    //  • NEVER pass --dlc-only: it makes gogdl's target set ONLY the DLC files, so reconciliation
    //    DELETES every other tracked file, wiping the base game.
    //  • NEVER pass --dlcs <ids> to filter: that also narrows the target and deletes tracked files
    //    outside the list. Empirically, `--with-dlcs` (all owned, no filter) reconciles with
    //    Deleted: 0 — it only ADDS missing DLC files and never removes the base. So every DLC-add
    //    installs the game's *complete* owned DLC set. Per-DLC selection is not safely possible.
    //  • --skip-dlcs keeps the base in the target (safe) and strips DLC files (the intended reset).
    const dlcOp = !!(opts.withDlcs || opts.dlcIds?.length || opts.skipDlcs);
    const dlcArgs = [];
    if (opts.skipDlcs)                          dlcArgs.push('--skip-dlcs');
    else if (opts.withDlcs || opts.dlcIds?.length) dlcArgs.push('--with-dlcs');

    if (store === 'gog') {
        const gogdl = findGogdl();
        if (!gogdl) { writeProgress({ ...base, step: 'error', message: 'gogdl not found.', done: true }); return; }
        // DLC changes / reinstalls target the base game's existing parent folder.
        let dir;
        if (dlcOp) {
            const cur = db?.prepare("SELECT install_path FROM games WHERE app_id=? AND store='gog'").get(appId)?.install_path;
            dir = cur ? path.dirname(expandTilde(cur)) : (expandTilde(installDir) || path.join(HOME, 'Games', 'CafeNeurotico'));
        } else {
            dir = expandTilde(installDir) || path.join(HOME, 'Games', 'CafeNeurotico');
        }
        try { fs.mkdirSync(dir, { recursive: true }); } catch {}
        try { fs.chmodSync(gogdl, '755'); } catch {}
        const manifestPath = path.join(configDir, 'gogdl', 'manifests', appId);
        // Keep the manifest for DLC operations (gogdl reconciles against the existing install); wipe it only for a fresh base install.
        if (!dlcOp) { try { fs.rmSync(manifestPath, { force: true }); } catch {} }

        // Refresh GOG token before writing auth config — avoids stale-token failures in headless mode
        writeProgress({ ...base, step: 'auth', percent: 0, message: 'Refreshing authentication...' });
        await getGogToken().catch(() => {});
        const authPath = writeGogAuthConfig();

        const runGogdlDownload = async (plat) => {
            let lastLines = [];
            const ok = await new Promise(resolve => {
                const proc = spawn(gogdl, [
                    '--auth-config-path', authPath, 'download', appId,
                    '--platform', plat, '--path', dir, '--lang', 'en-US',
                    ...dlcArgs,
                ], { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, GOGDL_CONFIG_PATH: configDir }, detached: true });
                _activeInstallProc = proc;
                let buf = '';
                const onData = d => {
                    buf += String(d);
                    const lines = buf.split('\n'); buf = lines.pop();
                    for (const line of lines) {
                        const trimmed = line.trim();
                        if (trimmed) { lastLines.push(trimmed); if (lastLines.length > 5) lastLines.shift(); }
                        const pct = line.match(/(\d+(?:\.\d+)?)\s*%/)?.[1];
                        const sz  = line.match(/([\d.]+\s*(?:GiB|MiB|GB|MB))\s*\/\s*([\d.]+\s*(?:GiB|MiB|GB|MB))/i);
                        if (pct || sz) writeProgress({ ...base, step: 'downloading', percent: pct ? parseFloat(pct) : 0, message: `[${plat}] ${sz ? `${sz[1]} / ${sz[2]}` : `${pct || 0}%`}` });
                    }
                };
                proc.stdout.on('data', onData); proc.stderr.on('data', onData);
                const done = ok => { if (_activeInstallProc === proc) _activeInstallProc = null; if (_activeKillTimer) { clearTimeout(_activeKillTimer); _activeKillTimer = null; } resolve(ok); };
                proc.on('close', code => done(code === 0));
                proc.on('error', () => done(false));
            });
            return { ok, lastLines };
        };

        // Snapshot subdirectories before gogdl runs (same guard as gogdl-install IPC).
        let preExistingDirsH;
        try {
            preExistingDirsH = new Set(
                fs.readdirSync(dir, { withFileTypes: true })
                  .filter(e => e.isDirectory()).map(e => e.name)
            );
        } catch { preExistingDirsH = new Set(); }

        const activePlat = platform || 'windows';
        writeProgress({ ...base, step: 'downloading', percent: 0, message: `Starting download (${activePlat})...` });
        const { ok: dlOk, lastLines } = await runGogdlDownload(activePlat);

        try { fs.unlinkSync(authPath); } catch {}
        if (!dlOk) { writeProgress({ ...base, step: 'error', message: _installCancelled ? 'Installation cancelled.' : (lastLines.slice(-2).join(' | ') || 'Download failed.'), done: true }); return; }

        // DLC operations reconcile the already-installed base folder (no NEW game dir is created, and the
        // base's install state / executable are unchanged) → skip new-install detection and finish.
        if (dlcOp) { writeProgress({ ...base, step: 'done', percent: 100, message: 'DLC changes complete!', done: true }); return; }

        const gameInfo = findGogInstallResult(dir, appId, preExistingDirsH);
        if (!gameInfo) { writeProgress({ ...base, step: 'error', message: 'Install verification failed.', done: true }); return; }
        writeProgress({ ...base, step: 'installing', percent: 100, message: 'Updating library...' });

        try {
            const game = db?.prepare("SELECT * FROM games WHERE app_id=? AND store='gog'").get(appId);
            if (game) {
                db.prepare("UPDATE games SET installed=1, install_path=?, executable=? WHERE id=?").run(gameInfo.install_path, gameInfo.executable, game.id);
                writeProgress({ ...base, step: 'redist', percent: 0, message: 'Checking compatibility files...' });
                const prefixPath = expandTilde(game.prefix_path) || path.join(prefixesDir, (game.title || appId).replace(/[/\\:*?"<>|]/g, '').trim().slice(0, 64) || appId);
                const protonPath = game.proton_path || db.prepare("SELECT value FROM settings WHERE key='default_proton_path'").get()?.value;
                const fakeSender = { send: (_ch, data) => { const line = typeof data === 'object' ? (data.line || '') : String(data); if (line.trim()) writeProgress({ ...base, step: 'redist', percent: 0, message: line.trim().slice(0, 120) }); } };
                await runRedist(fakeSender, 'x', appId, platform || 'windows', prefixPath, protonPath);
            }
        } catch {}
        syncSharedDb(appId, true);
        writeProgress({ ...base, step: 'done', percent: 100, message: 'Installation complete!', done: true });

    } else if (store === 'epic') {
        const leg = findLegendary();
        if (!leg) { writeProgress({ ...base, step: 'error', message: 'legendary not found.', done: true }); return; }
        const dir = expandTilde(installDir) || path.join(HOME, 'Games', 'CafeNeurotico');
        try { fs.mkdirSync(dir, { recursive: true }); } catch {}
        writeProgress({ ...base, step: 'downloading', percent: 0, message: 'Starting download...' });
        await new Promise(res => { const p = spawn(leg, ['uninstall', appId, '-y'], { stdio: 'ignore' }); p.on('close', res); p.on('error', res); });

        const dlOk = await new Promise(resolve => {
            const proc = spawn(leg, ['install', appId, '--base-path', dir, '-y'], { stdio: ['ignore', 'pipe', 'pipe'], detached: true });
            _activeInstallProc = proc;
            let buf = '';
            const onData = d => {
                buf += String(d);
                const lines = buf.split('\n'); buf = lines.pop();
                for (const line of lines) {
                    const pct = line.match(/(\d+(?:\.\d+)?)\s*%/)?.[1];
                    const sz  = line.match(/([\d.]+\s*(?:GiB|MiB|GB|MB))\s*\/\s*([\d.]+\s*(?:GiB|MiB|GB|MB))/i);
                    if (pct || sz) writeProgress({ ...base, step: 'downloading', percent: pct ? parseFloat(pct) : 0, message: sz ? `${sz[1]} / ${sz[2]}` : `${pct || 0}%` });
                }
            };
            proc.stdout.on('data', onData); proc.stderr.on('data', onData);
            const done = ok => { if (_activeInstallProc === proc) _activeInstallProc = null; if (_activeKillTimer) { clearTimeout(_activeKillTimer); _activeKillTimer = null; } resolve(ok); };
            proc.on('close', code => done(code === 0));
            proc.on('error', () => done(false));
        });
        if (!dlOk) { writeProgress({ ...base, step: 'error', message: _installCancelled ? 'Installation cancelled.' : 'Download failed.', done: true }); return; }
        writeProgress({ ...base, step: 'installing', percent: 100, message: 'Finalizing...' });
        try {
            const game = db?.prepare("SELECT * FROM games WHERE app_id=? AND store='epic'").get(appId);
            if (game) { const info = await getGameInstallInfo(appId); if (info) db.prepare("UPDATE games SET installed=1, install_path=?, executable=? WHERE id=?").run(info.install_path, info.executable, game.id); }
        } catch {}
        syncSharedDb(appId, true);
        writeProgress({ ...base, step: 'done', percent: 100, message: 'Installation complete!', done: true });
    }
}

async function headlessUninstall(store, appId) {
    const game = (() => { try { return db?.prepare("SELECT * FROM games WHERE app_id=? AND store=?").get(appId, store); } catch { return null; } })();
    const title = game?.title || appId;
    const base = { title, store, appId, done: false };
    writeProgress({ ...base, step: 'uninstalling', percent: 0, message: 'Removing game files...' });
    if (!game) { writeProgress({ ...base, step: 'error', message: 'Game not found.', done: true }); return; }

    const installPath = expandTilde(game.install_path || '');
    const defaultBase = expandTilde(db?.prepare("SELECT value FROM settings WHERE key='default_install_dir'").get()?.value || path.join(HOME, 'Games', 'CafeNeurotico'));
    if (installPath && fs.existsSync(installPath)) {
        const safe = installPath !== defaultBase && installPath !== HOME && installPath !== '/' && installPath.startsWith(defaultBase + path.sep);
        if (safe) { try { fs.rmSync(installPath, { recursive: true, force: true }); } catch {} }
    }
    writeProgress({ ...base, step: 'uninstalling', percent: 50, message: 'Removing Wine prefix...' });
    const safeName = (game.title || appId).replace(/[/\\:*?"<>|]/g, '').trim().slice(0, 64) || appId;
    const prefixPath = expandTilde(game.prefix_path) || path.join(prefixesDir, safeName);
    if (fs.existsSync(prefixPath)) { try { fs.rmSync(prefixPath, { recursive: true, force: true }); } catch {} }

    if (store === 'epic') {
        const leg = findLegendary();
        if (leg) {
            writeProgress({ ...base, step: 'uninstalling', percent: 75, message: 'Removing Epic record...' });
            await new Promise(res => { const p = spawn(leg, ['uninstall', appId, '-y'], { stdio: 'ignore' }); p.on('close', res); p.on('error', res); });
        }
    }
    try { db?.prepare("UPDATE games SET installed=0, install_path=NULL, executable=NULL, version=NULL WHERE id=?").run(game.id); } catch {}
    syncSharedDb(appId, false);
    writeProgress({ ...base, step: 'done', percent: 100, message: 'Game uninstalled.', done: true });
}

async function launchGame(gameId) {
    const game = db.prepare('SELECT * FROM games WHERE id = ?').get(gameId);
    if (!game)           throw new Error(`Game "${gameId}" not found in GRINDER database.`);
    if (!game.installed) throw new Error(`"${game.title}" is not marked as installed.`);

    // Parse per-game custom environment variables (KEY=VALUE, one per line)
    const customEnv = {};
    for (const line of (game.custom_env || '').split('\n')) {
        const eq = line.indexOf('=');
        if (eq > 0) customEnv[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
    }

    const prefix = expandTilde(game.prefix_path) || (() => {
        const legacy = path.join(prefixesDir, gameId);
        if (fs.existsSync(legacy)) return legacy;
        const safeName = (game.title || gameId).replace(/[/\\:*?"<>|]/g, '').trim().slice(0, 64) || gameId;
        return path.join(prefixesDir, safeName);
    })();
    const proton = expandTilde(game.proton_path)
        || db.prepare("SELECT value FROM settings WHERE key='default_proton_path'").get()?.value
        || '';

    fs.mkdirSync(prefix, { recursive: true });

    const installPath = expandTilde(game.install_path || '');
    // launch_target overrides the stored executable (e.g. alternate exe from playTasks)
    // resolvePathCaseInsensitive handles GOG manifests declaring wrong casing (e.g. DOOM3.exe → Doom3.exe)
    const resolvedExe = resolvePathCaseInsensitive((() => {
        if (game.custom_exe) return expandTilde(game.custom_exe);
        if (!installPath) return '';
        const rel = game.launch_target || game.executable;
        return rel ? path.join(installPath, ...rel.replace(/\\/g, '/').split('/')) : '';
    })());

    // Read arguments for the active task from goggame-*.info (GOG only).
    // GOG stores launch arguments in playTasks — without them mods/configs don't load.
    const gogTaskArgs = (() => {
        if (game.store !== 'gog' || !installPath || !game.app_id) return [];
        try {
            const infoFile = path.join(installPath, `goggame-${game.app_id}.info`);
            const info = JSON.parse(fs.readFileSync(infoFile, 'utf8'));
            const activeRel = (game.launch_target || game.executable || '').replace(/\\/g, '/');
            const task = (info.playTasks || []).find(t =>
                t.type === 'FileTask' && t.path && t.path.replace(/\\/g, '/') === activeRel
            );
            if (!task?.arguments) return [];
            // Simple shell-split that respects quoted tokens
            const args = []; let cur = ''; let inQ = false; let q = '';
            for (const ch of task.arguments.trim()) {
                if (inQ) { if (ch === q) inQ = false; else cur += ch; }
                else if (ch === '"' || ch === "'") { inQ = true; q = ch; }
                else if (ch === ' ' || ch === '\t') { if (cur) { args.push(cur); cur = ''; } }
                else cur += ch;
            }
            if (cur) args.push(cur);
            return args;
        } catch { return []; }
    })();

    // User-defined additional arguments — appended after auto-detected playTask args
    const userArgs = (() => {
        if (!game.launch_args?.trim()) return [];
        const args = []; let cur = ''; let inQ = false; let q = '';
        for (const ch of game.launch_args.trim()) {
            if (inQ) { if (ch === q) inQ = false; else cur += ch; }
            else if (ch === '"' || ch === "'") { inQ = true; q = ch; }
            else if (ch === ' ' || ch === '\t') { if (cur) { args.push(cur); cur = ''; } }
            else cur += ch;
        }
        if (cur) args.push(cur);
        return args;
    })();
    const allArgs = [...gogTaskArgs, ...userArgs];

    const umu = findUmu();
    const usingProton = !!(proton || umu);

    // Compat env vars — mirrors Heroic's launcher.ts logic exactly
    const compatEnv = {};
    if (usingProton) {
        if (!game.use_esync)     compatEnv.PROTON_NO_ESYNC = '1';
        if (!game.use_fsync)     compatEnv.PROTON_NO_FSYNC = '1';
        if (game.use_dxvk_nvapi) { compatEnv.PROTON_ENABLE_NVAPI = '1'; compatEnv.DXVK_NVAPI_ALLOW_OTHER_DRIVERS = '1'; }
    } else {
        if (game.use_esync !== 0) compatEnv.WINEESYNC = '1';
        if (game.use_fsync !== 0) compatEnv.WINEFSYNC = '1';
        if (game.use_dxvk_nvapi) { compatEnv.DXVK_ENABLE_NVAPI = '1'; compatEnv.DXVK_NVAPI_ALLOW_OTHER_DRIVERS = '1'; }
    }
    if (game.use_battleye) { const p = findRuntime('battleye_runtime'); if (p) compatEnv.PROTON_BATTLEYE_RUNTIME = p; }
    if (game.use_eac)      { const p = findRuntime('eac_runtime');       if (p) compatEnv.PROTON_EAC_RUNTIME      = p; }

    // Base env: system → custom user vars → compat flags → GRINDER's required vars (highest priority)
    const baseEnv = (extra = {}) => ({ ...process.env, ...customEnv, ...compatEnv, ...extra });

    // Launch Comet sidecar for GOG games (enables achievement unlocking via Galaxy SDK proxy)
    let cometProc = null;
    if (game.store === 'gog') {
        const cometBin = findComet();
        if (cometBin) {
            const userId = db.prepare("SELECT value FROM settings WHERE key='gog_user_id'").get()?.value;
            if (userId) {
                try { fs.chmodSync(cometBin, '755'); } catch {}
                const authPath = writeGogAuthConfig();
                const cometArgs = ['--from-heroic', '--credentials-path', authPath, '--user-id', userId];
                // Include per-game Galaxy client_id if available in goggame-*.info
                if (installPath && game.app_id) {
                    try {
                        const infoPath = path.join(installPath, `goggame-${game.app_id}.info`);
                        if (fs.existsSync(infoPath)) {
                            const info = JSON.parse(fs.readFileSync(infoPath, 'utf8'));
                            if (info.clientId) cometArgs.push('--game-id', info.clientId);
                        }
                    } catch {}
                }
                try { cometProc = spawn(cometBin, cometArgs, { stdio: 'ignore' }); } catch {}
            }
        }
    }

    const spawnGame = (cmd, args, opts) => {
        const proc = spawn(cmd, args, opts);
        if (cometProc) proc.once('exit', () => { try { cometProc.kill('SIGTERM'); } catch {} });
        proc.unref();
        if (cometProc) cometProc.unref();
        return proc;
    };

    if (!resolvedExe || !fs.existsSync(resolvedExe)) {
        if (game.store === 'epic') {
            const legendary = findLegendary();
            if (legendary) {
                spawn(legendary, ['launch', game.app_id], { detached: true, stdio: 'ignore' }).unref();
                return { ok: true, method: 'legendary' };
            }
            throw new Error('Cannot launch: exe not found, umu-run not available, and legendary not found.');
        }
        throw new Error(`Executable not found: ${resolvedExe || '(not set)'}`);
    }

    // .bat files must be launched via Wine's Z: drive Windows path — Proton/wine
    // can't run .bat from a raw Linux path. Z: maps to the filesystem root.
    const isBat = resolvedExe.toLowerCase().endsWith('.bat');
    const launchExe = isBat ? ('Z:' + resolvedExe.replace(/\//g, '\\')) : resolvedExe;

    if (game.store === 'epic' && umu) {
        spawnGame(umu, [launchExe, ...userArgs], { cwd: installPath || undefined, env: baseEnv({ WINEPREFIX: prefix, PROTONPATH: proton, GAMEID: game.app_id || `grinder-${gameId}` }), detached: true, stdio: 'ignore' });
        return { ok: true, method: 'umu-run' };
    }

    if (game.platform === 'linux') {
        try { fs.chmodSync(resolvedExe, '755'); } catch {}
        spawnGame(resolvedExe, [...userArgs], { cwd: installPath || undefined, env: baseEnv(), detached: true, stdio: 'ignore' });
        return { ok: true, method: 'native' };
    }

    if (umu) {
        spawnGame(umu, [launchExe, ...allArgs], { cwd: installPath || undefined, env: baseEnv({ WINEPREFIX: prefix, PROTONPATH: proton, GAMEID: game.app_id || `grinder-${gameId}` }), detached: true, stdio: 'ignore' });
        return { ok: true, method: isBat ? 'umu-run-bat' : 'umu-run' };
    }

    if (proton) {
        const steamRoot = which('steam') ? path.dirname(which('steam')) : path.join(HOME, '.steam', 'root');
        const protonBin = path.join(proton, 'proton');
        if (!fs.existsSync(protonBin)) throw new Error(`proton script not found in ${proton}`);
        spawnGame(protonBin, ['run', launchExe, ...allArgs], { cwd: installPath || undefined, env: baseEnv({ WINEPREFIX: prefix, STEAM_COMPAT_DATA_PATH: prefix, STEAM_COMPAT_CLIENT_INSTALL_PATH: steamRoot }), detached: true, stdio: 'ignore' });
        return { ok: true, method: isBat ? 'proton-bat' : 'proton-direct' };
    }

    const wine = findWineCached();
    if (!wine) throw new Error('No launch method: umu-run not found, no Proton path set, wine not installed.');
    spawnGame(wine, [launchExe, ...allArgs], { cwd: installPath || undefined, env: baseEnv({ WINEPREFIX: prefix }), detached: true, stdio: 'ignore' });
    return { ok: true, method: 'wine' };
}

function runLegendary(args) {
    const leg = findLegendary();
    if (!leg) return Promise.resolve({ ok: false, error: 'legendary not found' });
    return new Promise(resolve => {
        let out = '', err = '';
        const proc = spawn(leg, args, { stdio: ['ignore', 'pipe', 'pipe'] });
        proc.stdout.on('data', d => out += d);
        proc.stderr.on('data', d => err += d);
        proc.on('close', code => resolve({ ok: code === 0, stdout: out, stderr: err, code }));
        proc.on('error', e => resolve({ ok: false, error: e.message }));
    });
}

async function getGameInstallInfo(appName) {
    const r = await runLegendary(['list-installed', '--json']);
    if (!r.ok) return null;
    try {
        const all = JSON.parse(r.stdout);
        return all.find(g => g.app_name === appName) || null;
    } catch { return null; }
}

async function runRedist(sender, channel, appId, platform, prefixPath, protonPath) {
    const gogdl = findGogdl();
    if (!gogdl) return { ok: false, error: 'gogdl not found.' };
    try { fs.chmodSync(gogdl, '755'); } catch {}
    const sendLine = d => { try { sender.send(channel, { line: String(d) }); } catch {} };
    const sendDone = (ok, msg) => { try { sender.send(channel, { done: true, ok, msg }); } catch {} };
    const send = sendLine;
    const authPath = writeGogAuthConfig();

    send('Checking game dependencies...\n');
    let depIds = '';
    try {
        const infoOut = await new Promise((res, rej) => {
            let out = '';
            const p = spawn(gogdl, ['--auth-config-path', authPath, 'info', appId, '--platform', platform],
                { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, GOGDL_CONFIG_PATH: configDir } });
            p.stdout.on('data', d => out += d);
            p.stderr.on('data', d => out += d);
            p.on('close', () => res(out));
            p.on('error', rej);
        });
        const jsonLine = infoOut.split('\n').find(l => l.trim().startsWith('{'));
        const info = JSON.parse(jsonLine);
        const deps = (info.dependencies || []).filter(Boolean);
        depIds = deps.join(',');
    } catch {}

    if (!depIds) {
        try { fs.unlinkSync(authPath); } catch {}
        sendDone(true, 'No compatibility files required for this game.');
        return { ok: true, installed: 0 };
    }

    send(`Dependencies: ${depIds}\nDownloading compatibility files...\n`);

    const redistDir = path.join(configDir, 'redist');
    try { fs.mkdirSync(redistDir, { recursive: true }); } catch {}

    const dlCode = await new Promise(resolve => {
        const p = spawn(gogdl, ['--auth-config-path', authPath, 'redist', '--ids', depIds, '--path', redistDir],
            { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, GOGDL_CONFIG_PATH: configDir } });
        p.stdout.on('data', send);
        p.stderr.on('data', send);
        p.on('close', resolve);
        p.on('error', () => resolve(1));
    });
    try { fs.unlinkSync(authPath); } catch {}
    if (dlCode !== 0) { sendDone(false, `Download failed (exit ${dlCode})`); return { ok: false }; }

    const manifestPath = path.join(redistDir, '.gogdl-redist-manifest');
    let depots = [];
    try {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        const idSet = new Set(depIds.split(',').map(s => s.trim()));
        depots = (manifest.depots || []).filter(d => idSet.has(d.dependencyId) && d.executable?.path);
    } catch (e) {
        sendDone(false, 'Could not read redist manifest: ' + e.message);
        return { ok: false };
    }

    if (!depots.length) {
        sendDone(true, 'No installers found in manifest.');
        return { ok: true, installed: 0 };
    }

    const resolvedProton = expandTilde(protonPath)
        || db.prepare("SELECT value FROM settings WHERE key='default_proton_path'").get()?.value;
    const umu = findUmu();
    const prefix = expandTilde(prefixPath);
    const steamRoot = path.join(HOME, '.steam', 'root');

    if (!resolvedProton && !findWineCached()) {
        sendDone(false, 'No Proton version configured and Wine not found. Set a default Proton in Settings.');
        return { ok: false };
    }

    let installed = 0;
    for (const depot of depots) {
        const exeRel = depot.executable.path.split('/').join(path.sep);
        const exePath = path.join(redistDir, exeRel);
        const exeArgs = (depot.executable.arguments || '').trim().split(/\s+/).filter(Boolean);
        if (!fs.existsSync(exePath)) { send(`⚠ Missing installer: ${exeRel}\n`); continue; }
        send(`Installing ${path.basename(exePath)} (${depot.dependencyId})...\n`);
        const runEnv = { ...process.env, WINEPREFIX: prefix, STEAM_COMPAT_DATA_PATH: prefix,
                         STEAM_COMPAT_CLIENT_INSTALL_PATH: steamRoot, GAMEID: 'umu-0', PROTON_VERB: 'run' };
        if (resolvedProton) runEnv.PROTONPATH = resolvedProton;
        let cmd, args;
        if (umu && resolvedProton)      { cmd = umu;                               args = [exePath, ...exeArgs]; }
        else if (resolvedProton)        { cmd = path.join(resolvedProton, 'proton'); args = ['run', exePath, ...exeArgs]; }
        else                            { cmd = findWineCached();                      args = [exePath, ...exeArgs]; delete runEnv.PROTONPATH; }
        await new Promise(res => {
            const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], env: runEnv, cwd: redistDir });
            p.stdout.on('data', send);
            p.stderr.on('data', send);
            p.on('close', () => res());
            p.on('error', e => { send(`Error: ${e.message}\n`); res(); });
        });
        installed++;
    }
    sendDone(true, `Installed ${installed} compatibility package(s).`);
    return { ok: true, installed };
}

async function injectGogRegistry(game, prefix, proton) {
    const installPath = expandTilde(game.install_path || '');
    if (!installPath || !game.app_id) return;
    if (!(game.store || '').toLowerCase().includes('gog')) return;

    const appId   = String(game.app_id);
    const winPath = ('Z:' + installPath).replace(/\//g, '\\');
    const escaped = winPath.replace(/\\/g, '\\\\');

    const regContent =
        'Windows Registry Editor Version 5.00\r\n\r\n' +
        `[HKEY_LOCAL_MACHINE\\SOFTWARE\\GOG.com\\Games\\${appId}]\r\n` +
        `"path"="${escaped}"\r\n` +
        `"gameID"="${appId}"\r\n` +
        `"productID"="${appId}"\r\n\r\n` +
        `[HKEY_LOCAL_MACHINE\\SOFTWARE\\WOW6432Node\\GOG.com\\Games\\${appId}]\r\n` +
        `"path"="${escaped}"\r\n` +
        `"gameID"="${appId}"\r\n` +
        `"productID"="${appId}"\r\n`;

    const regFile = path.join(os.tmpdir(), `gog_reg_${appId}.reg`);
    fs.writeFileSync(regFile, regContent, 'utf8');

    // Find Wine binary: prefer Proton's bundled wine, fall back to system wine
    let wineBin = 'wine';
    if (proton) {
        const candidates = [
            path.join(proton, 'files', 'bin', 'wine64'),
            path.join(proton, 'files', 'bin', 'wine'),
        ];
        for (const c of candidates) {
            if (fs.existsSync(c)) { wineBin = c; break; }
        }
    }

    await new Promise(resolve => {
        const proc = spawn(wineBin, ['regedit', '/S', regFile], {
            env: { ...process.env, WINEPREFIX: prefix, WINEDEBUG: '-all' },
            stdio: 'ignore',
        });
        proc.on('close', () => { try { fs.unlinkSync(regFile); } catch {} resolve(); });
        proc.on('error', () => { try { fs.unlinkSync(regFile); } catch {} resolve(); });
    });
}

async function gogFetch(url, token) {
    const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}`, 'User-Agent': 'GRINDER/1.0' },
    });
    if (!res.ok) throw new Error(`GOG API ${res.status}: ${url}`);
    return res.json();
}

async function getGogToken() {
    const get = k => db.prepare("SELECT value FROM settings WHERE key=?").get(k)?.value;
    const access  = get('gog_access_token');
    const refresh = get('gog_refresh_token');
    const expiry  = parseInt(get('gog_token_expiry') || '0');

    if (!refresh) return null;
    if (access && Date.now() < expiry - 60000) return access;

    try {
        const res = await fetch('https://auth.gog.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id:     GOG_CLIENT_ID,
                client_secret: GOG_CLIENT_SECRET,
                grant_type:    'refresh_token',
                refresh_token: refresh,
            }).toString(),
        });
        const data = await res.json();
        if (!data.access_token) return null;
        const set = (k, v) => db.prepare("INSERT OR REPLACE INTO settings VALUES (?,?)").run(k, v);
        set('gog_access_token', data.access_token);
        set('gog_token_expiry', String(Date.now() + data.expires_in * 1000));
        if (data.refresh_token) set('gog_refresh_token', data.refresh_token);
        return data.access_token;
    } catch { return null; }
}

function writeGogAuthConfig() {
    const get    = k => db.prepare("SELECT value FROM settings WHERE key=?").get(k)?.value || '';
    const expiry = parseInt(get('gog_token_expiry') || '0');
    // gogdl expects the Heroic auth format: keyed by client_id
    const authPath = path.join(configDir, 'gogdl_auth.json');
    fs.writeFileSync(authPath, JSON.stringify({
        [GOG_CLIENT_ID]: {
            access_token:  get('gog_access_token'),
            refresh_token: get('gog_refresh_token'),
            user_id:       get('gog_user_id'),
            token_type:    'Bearer',
            expires_in:    Math.max(0, Math.floor((expiry - Date.now()) / 1000)),
            loginTime:     Math.floor((expiry - 3600000) / 1000),
        }
    }));
    return authPath;
}

// Headless owned-library refresh. Pulls the full owned-games list from the GOG
// and Epic store APIs into grinder.db (installed=0 = imported, NOT installed), so
// any face can pick up newly-purchased titles without opening the GRINDER GUI.
// Mirrors GRINDER's legendary-list-owned/legendary-import + gog-list-owned/gog-import,
// but does list+import in one pass (no interactive picker). Returns per-store
// { loggedIn, total, added, error }.
async function syncOwnedLibrary() {
    const result = {
        epic: { loggedIn: false, total: 0, added: 0, error: null },
        gog:  { loggedIn: false, total: 0, added: 0, error: null },
    };
    if (!db) return result;

    // ── Epic (legendary) ──────────────────────────────────────────────────────
    if (findLegendary()) {
        const r = await runLegendary(['list', '--json']);
        if (r.ok) {
            try {
                const all = JSON.parse(r.stdout || '[]');
                result.epic.loggedIn = true;
                result.epic.total = all.length;
                const stmt = db.prepare(`
                    INSERT OR IGNORE INTO games (id, title, store, app_id, install_path, executable, installed, version)
                    VALUES (?, ?, 'epic', ?, ?, ?, 0, ?)
                `);
                const tx = db.transaction(list => {
                    let n = 0;
                    for (const g of list) {
                        const title = g.app_title || g.metadata?.title || 'Unknown';
                        const info = stmt.run('epic_' + g.app_name, title, g.app_name, null, null, null);
                        if (info.changes) n++;
                    }
                    return n;
                });
                result.epic.added = tx(all);
            } catch { result.epic.error = 'Failed to parse legendary output.'; }
        } else {
            // Not logged in / legendary error — surface quietly (loggedIn stays false).
            result.epic.error = (r.error || r.stderr || '').trim() || 'Not logged in to Epic.';
        }
    }

    // ── GOG ────────────────────────────────────────────────────────────────────
    const token = await getGogToken();
    if (token) {
        result.gog.loggedIn = true;
        try {
            const owned = await gogFetch('https://embed.gog.com/user/data/games', token);
            const ids   = owned.owned || [];
            result.gog.total = ids.length;
            const games = [];
            for (let i = 0; i < ids.length; i += 50) {
                const batch = ids.slice(i, i + 50).join(',');
                const data  = await gogFetch(`https://api.gog.com/products?ids=${batch}&expand=downloads`, token);
                const items = Array.isArray(data) ? data : [data];
                for (const item of items) {
                    if (!item?.id) continue;
                    const oses      = [...new Set((item.downloads?.installers || []).map(x => x.os).filter(Boolean))];
                    const platform  = oses.includes('linux') ? 'linux' : 'windows';
                    const platforms = oses.filter(o => o === 'linux' || o === 'windows').join(',') || platform;
                    const is_dlc    = item.game_type && item.game_type !== 'game' ? 1 : 0;
                    games.push({ id: String(item.id), title: item.title || 'Unknown', platform, platforms, is_dlc });
                }
            }
            const stmtInsert = db.prepare(
                "INSERT OR IGNORE INTO games (id, title, store, app_id, platform, platforms, installed, is_dlc) VALUES (?, ?, 'gog', ?, ?, ?, 0, ?)"
            );
            const stmtUpdate = db.prepare(
                "UPDATE games SET platforms = ?, is_dlc = ? WHERE app_id = ? AND store = 'gog'"
            );
            const tx = db.transaction(list => {
                let n = 0;
                for (const g of list) {
                    const plats  = g.platforms || g.platform || 'windows';
                    const is_dlc = g.is_dlc ? 1 : 0;
                    const info = stmtInsert.run('gog_' + g.id, g.title, g.id, g.platform || 'windows', plats, is_dlc);
                    if (info.changes) n++;
                    stmtUpdate.run(plats, is_dlc, g.id);   // refresh platforms/is_dlc on existing rows too
                }
                return n;
            });
            result.gog.added = tx(games);
        } catch (e) { result.gog.error = e.message; }
    }

    return result;
}

function findGogInstallResult(baseDir, appId, preExistingDirs = null) {
    try {
        const entries = fs.readdirSync(baseDir, { withFileTypes: true });
        for (const entry of entries) {
            if (!entry.isDirectory()) continue;
            const gameDir = path.join(baseDir, entry.name);

            // ── Windows path ──────────────────────────────────────────────────
            const infoFile = path.join(gameDir, `goggame-${appId}.info`);
            if (fs.existsSync(infoFile)) {
                try {
                    const info = JSON.parse(fs.readFileSync(infoFile, 'utf8'));
                    const task = (info.playTasks || []).find(t => t.isPrimary && t.type === 'FileTask');
                    return { install_path: gameDir, executable: task?.path || null };
                } catch { return { install_path: gameDir, executable: null }; }
            }

            // ── Linux native path ─────────────────────────────────────────────
            // gogdl writes .gogdl-linux-manifest after a successful Linux install.
            // No .info file is created; find the main launcher instead.
            // Guard: verify this directory belongs to the right game so that a
            // previously-installed Linux game in the same parent folder is never
            // mistaken for the newly-installed one.
            const linuxManifest = path.join(gameDir, '.gogdl-linux-manifest');
            if (fs.existsSync(linuxManifest)) {
                // Primary check: gogdl writes a plain-text "gameinfo" file whose
                // lines include the numeric appId — fast and reliable.
                try {
                    const lines = fs.readFileSync(path.join(gameDir, 'gameinfo'), 'utf8')
                        .split('\n').map(l => l.trim());
                    if (!lines.includes(String(appId))) continue;
                } catch {
                    // gameinfo absent — fall back to the pre-install snapshot:
                    // skip any directory that already existed before this install.
                    if (preExistingDirs?.has(entry.name)) continue;
                }
                const exe = findLinuxGameExe(gameDir);
                return { install_path: gameDir, executable: exe };
            }
        }
    } catch {}
    return null;
}

function findLinuxGameExe(gameDir) {
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

// ── Pre-install size info + free disk space (shared by Manager & CREMA) ──────
// Available bytes at a path (walks up to the first existing parent).
async function getDiskSpace(dirPath) {
    let check = expandTilde(dirPath) || HOME;
    while (!fs.existsSync(check) && path.dirname(check) !== check) check = path.dirname(check);
    try { const st = await fs.promises.statfs(check); return st.bavail * st.bsize; }
    catch { return null; }
}

// GOG download/disk size. Linux uses the GOG API (installer files); Windows uses gogdl info.
async function gogInstallInfo(appId, platform) {
    if (platform === 'linux') {
        try {
            const token = await getGogToken(); if (!token) return null;
            const data = await gogFetch(`https://api.gog.com/products/${appId}?expand=downloads`, token);
            const installers = (data.downloads?.installers || []).filter(i => i.os === 'linux');
            let download_size = 0;
            for (const inst of installers) for (const f of inst.files || []) download_size += f.size || 0;
            return download_size > 0 ? { download_size, disk_size: download_size } : null;
        } catch { return null; }
    }
    const gogdl = findGogdl(); if (!gogdl) return null;
    try { fs.chmodSync(gogdl, '755'); } catch {}
    const authPath = writeGogAuthConfig();
    return new Promise(resolve => {
        let out = '';
        const proc = spawn(gogdl, ['--auth-config-path', authPath, 'info', appId, '--platform', platform || 'windows'],
            { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, GOGDL_CONFIG_PATH: configDir } });
        proc.stdout.on('data', d => out += d);
        proc.stderr.on('data', d => out += d);
        proc.on('close', () => {
            try { fs.unlinkSync(authPath); } catch {}
            try {
                const data = JSON.parse(out.split('\n').find(l => l.trim().startsWith('{')));
                let download_size = 0, disk_size = 0;
                for (const s of Object.values(data.size || {})) { download_size += s.download_size || 0; disk_size += s.disk_size || 0; }
                resolve({ download_size, disk_size, version: data.versionName });
            } catch { resolve(null); }
        });
        proc.on('error', () => { try { fs.unlinkSync(authPath); } catch {} resolve(null); });
    });
}

// Owned DLCs for a GOG game via `gogdl info --with-dlcs`. Returns { ok, dlcs:[{id,title,download_size,disk_size}] }.
async function gogListDlcs(baseAppId, platform) {
    const gogdl = findGogdl(); if (!gogdl) return { ok: false, error: 'gogdl not found.', dlcs: [] };
    try { fs.chmodSync(gogdl, '755'); } catch {}
    await getGogToken().catch(() => {});
    const authPath = writeGogAuthConfig();
    return new Promise(resolve => {
        let out = '';
        const proc = spawn(gogdl, ['--auth-config-path', authPath, 'info', String(baseAppId),
            '--platform', platform || 'windows', '--with-dlcs'],
            { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, GOGDL_CONFIG_PATH: configDir } });
        proc.stdout.on('data', d => out += d);
        proc.stderr.on('data', d => out += d);
        proc.on('close', () => {
            try { fs.unlinkSync(authPath); } catch {}
            try {
                const data = JSON.parse(out.split('\n').find(l => l.trim().startsWith('{')));
                const dlcs = (data.dlcs || []).map(x => {
                    const sz = (x.size && (x.size['en-US'] || x.size['*'])) || {};
                    return { id: String(x.id), title: x.title || 'DLC', download_size: sz.download_size || 0, disk_size: sz.disk_size || 0 };
                });
                resolve({ ok: true, dlcs });
            } catch { resolve({ ok: false, error: 'Could not read the DLC list. Make sure you are signed into GOG in GRINDER.', dlcs: [] }); }
        });
        proc.on('error', () => { try { fs.unlinkSync(authPath); } catch {} resolve({ ok: false, error: 'gogdl failed to run.', dlcs: [] }); });
    });
}

// Which owned DLCs are ACTUALLY installed, from gogdl's manifest HGLdlcs field — the only reliable
// signal. A completed --with-dlcs install records each installed DLC there (verified). We deliberately
// do NOT fall back to products[]/depots[]: those hold the full OWNED/planned set whenever --with-dlcs
// is passed, so they list DLCs that were only planned, not downloaded → false "installed" badges.
function gogInstalledDlcs(baseAppId) {
    try {
        const j = JSON.parse(fs.readFileSync(path.join(configDir, 'gogdl', 'manifests', String(baseAppId)), 'utf8'));
        return Array.isArray(j.HGLdlcs) ? j.HGLdlcs.map(d => String((d && d.id) ?? d)).filter(Boolean) : [];
    } catch { return []; }
}

// Epic download/disk size via legendary info.
async function epicInstallInfo(appName) {
    const leg = findLegendary(); if (!leg) return null;
    return new Promise(resolve => {
        let out = '';
        const proc = spawn(leg, ['info', appName], { stdio: ['ignore', 'pipe', 'pipe'] });
        proc.stdout.on('data', d => out += d);
        proc.stderr.on('data', d => out += d);
        proc.on('close', () => {
            const toBytes = (n, u) => { const v = parseFloat(n); return u.toLowerCase().startsWith('g') ? v*1024**3 : u.toLowerCase().startsWith('m') ? v*1024**2 : v*1024; };
            const dl   = out.match(/Download size[^:]*:\s*([\d.]+)\s*(\w+)/i);
            const disk = out.match(/Disk size[^:]*:\s*([\d.]+)\s*(\w+)/i);
            resolve(dl && disk ? { download_size: toBytes(dl[1], dl[2]), disk_size: toBytes(disk[1], disk[2]) } : null);
        });
        proc.on('error', () => resolve(null));
    });
}

module.exports = {
    init, setDb, writeProgress,
    sanitizeLogName, expandTilde, resolvePathCaseInsensitive,
    which, findLegendary, findGogdl, findComet, findUmu, findWineCached, findRuntime,
    GOG_CLIENT_ID, GOG_CLIENT_SECRET, GOG_REDIRECT_URI,
    syncSharedDb, headlessInstall, headlessUninstall, launchGame, runLegendary,
    getGameInstallInfo, runRedist, injectGogRegistry, gogFetch, getGogToken,
    writeGogAuthConfig, findGogInstallResult, findLinuxGameExe,
    getDiskSpace, gogInstallInfo, epicInstallInfo, syncOwnedLibrary, cancelActiveInstall,
    gogListDlcs, gogInstalledDlcs,
};
