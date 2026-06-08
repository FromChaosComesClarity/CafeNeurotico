'use strict';
const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const fs   = require('fs');
const os   = require('os');
const { spawn, execSync } = require('child_process');
const Database = require('better-sqlite3');

// Shared window-free GRINDER engine. Leaf helpers are re-bound here so existing
// call sites in this file keep working unchanged; engine.init() runs in initDb().
const grinderEngine = require('../../packages/core/grinder-engine.js');
const {
    sanitizeLogName, expandTilde, resolvePathCaseInsensitive,
    which, findLegendary, findGogdl, findComet, findUmu, findWineCached, findRuntime,
} = grinderEngine;

// GRINDER face keeps its own 'grinder' identity even inside the unified suite:
//  - userData stays ~/.config/grinder  → preserves existing data + the CNGM↔GRINDER DB bridge
//  - independent single-instance lock  → GRINDER GUI can open alongside the Manager window
app.setName('grinder');

// ── Paths ─────────────────────────────────────────────────────────────────────
const configDir = app.isPackaged
    ? app.getPath('userData')          // ~/.config/grinder on Linux (Electron uses lowercase app name)
    : path.join(__dirname, 'GRINDERConfig');

const prefixesDir = path.join(configDir, 'prefixes');
const logDir      = path.join(configDir, 'game_logs');
const dbPath      = path.join(configDir, 'grinder.db');

// Directory containing the AppImage (same folder as CNGM.AppImage)
const appImageDir  = process.env.APPIMAGE ? path.dirname(process.env.APPIMAGE) : configDir;
const progressFile = path.join(appImageDir, 'GameManagerConfig', 'grinder-progress.json');


let db;
let win;

// ── CLI mode detection ────────────────────────────────────────────────────────
const allArgs        = process.argv;
const launchIdx      = allArgs.indexOf('launch');
const cliGameId      = launchIdx !== -1 ? allArgs[launchIdx + 1] : null;
const cliMode        = !!cliGameId;
const searchIdx      = allArgs.indexOf('search');
const cliSearch      = searchIdx !== -1 ? allArgs.slice(searchIdx + 1).join(' ') : null;
const setupIdx       = allArgs.indexOf('setup');
const cliSetupId     = setupIdx  !== -1 ? allArgs[setupIdx  + 1] : null;
const installHIdx    = allArgs.indexOf('install');
const cliInstall     = installHIdx !== -1 ? allArgs.slice(installHIdx + 1) : null;
const uninstHIdx     = allArgs.indexOf('uninstall-headless');
const cliUninstall   = uninstHIdx  !== -1 ? allArgs.slice(uninstHIdx  + 1) : null;
const headlessInstMode = !!(cliInstall || cliUninstall);

// ── Headless progress file ────────────────────────────────────────────────────
function writeProgress(data) {
    try { fs.writeFileSync(progressFile, JSON.stringify(data), 'utf8'); } catch {}
}

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

async function headlessInstall(store, appId, platform, installDir) {
    const title = (() => { try { return db?.prepare("SELECT title FROM games WHERE app_id=? AND store=?").get(appId, store)?.title || appId; } catch { return appId; } })();
    const base = { title, store, appId, done: false };

    if (store === 'gog') {
        const gogdl = findGogdl();
        if (!gogdl) { writeProgress({ ...base, step: 'error', message: 'gogdl not found.', done: true }); return; }
        const dir = expandTilde(installDir) || path.join(HOME, 'Games', 'CafeNeurotico');
        try { fs.mkdirSync(dir, { recursive: true }); } catch {}
        try { fs.chmodSync(gogdl, '755'); } catch {}
        const manifestPath = path.join(configDir, 'gogdl', 'manifests', appId);
        try { fs.rmSync(manifestPath, { force: true }); } catch {}

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
                ], { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, GOGDL_CONFIG_PATH: configDir } });
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
                proc.on('close', code => resolve(code === 0)); proc.on('error', () => resolve(false));
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
        if (!dlOk) { writeProgress({ ...base, step: 'error', message: lastLines.slice(-2).join(' | ') || 'Download failed.', done: true }); return; }

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
            const proc = spawn(leg, ['install', appId, '--base-path', dir, '-y'], { stdio: ['ignore', 'pipe', 'pipe'] });
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
            proc.on('close', code => resolve(code === 0)); proc.on('error', () => resolve(false));
        });
        if (!dlOk) { writeProgress({ ...base, step: 'error', message: 'Download failed.', done: true }); return; }
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

// ── Database ──────────────────────────────────────────────────────────────────
function initDb() {
    fs.mkdirSync(configDir,  { recursive: true });
    fs.mkdirSync(prefixesDir, { recursive: true });

    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');

    // Wire the shared engine now that paths + DB handle are available.
    grinderEngine.init({ configDir, prefixesDir, logDir, binDir, appImageDir, homeDir: HOME, db, onProgress: writeProgress });

    db.exec(`
        CREATE TABLE IF NOT EXISTS games (
            id           TEXT PRIMARY KEY,
            title        TEXT NOT NULL,
            store        TEXT NOT NULL DEFAULT 'custom',
            app_id       TEXT,
            install_path TEXT,
            executable   TEXT,
            prefix_path  TEXT,
            proton_path  TEXT,
            installed    INTEGER DEFAULT 0,
            version      TEXT,
            notes        TEXT,
            added_at     INTEGER DEFAULT (strftime('%s','now'))
        );
        CREATE TABLE IF NOT EXISTS settings (
            key   TEXT PRIMARY KEY,
            value TEXT
        );
    `);
    // Migrations
    try { db.prepare("ALTER TABLE games ADD COLUMN platform TEXT").run(); } catch(e) {}
    try { db.prepare("ALTER TABLE games ADD COLUMN platforms TEXT").run(); } catch(e) {}
    try { db.prepare("ALTER TABLE games ADD COLUMN custom_env TEXT").run(); } catch(e) {}
    try { db.prepare("ALTER TABLE games ADD COLUMN winetricks TEXT").run(); } catch(e) {}
    try { db.prepare("ALTER TABLE games ADD COLUMN use_esync INTEGER DEFAULT 1").run(); } catch(e) {}
    try { db.prepare("ALTER TABLE games ADD COLUMN use_fsync INTEGER DEFAULT 1").run(); } catch(e) {}
    try { db.prepare("ALTER TABLE games ADD COLUMN use_dxvk_nvapi INTEGER DEFAULT 0").run(); } catch(e) {}
    try { db.prepare("ALTER TABLE games ADD COLUMN use_battleye INTEGER DEFAULT 0").run(); } catch(e) {}
    try { db.prepare("ALTER TABLE games ADD COLUMN use_eac INTEGER DEFAULT 0").run(); } catch(e) {}
    try { db.prepare("ALTER TABLE games ADD COLUMN launch_target TEXT").run(); } catch(e) {}
    try { db.prepare("ALTER TABLE games ADD COLUMN launch_args TEXT").run(); } catch(e) {}
    try { db.prepare("ALTER TABLE games ADD COLUMN is_dlc INTEGER DEFAULT 0").run(); } catch(e) {}
    try { db.prepare("ALTER TABLE games ADD COLUMN custom_exe TEXT").run(); } catch(e) {}
    try { db.exec(`CREATE TABLE IF NOT EXISTS achievements (
        app_id         TEXT NOT NULL,
        key            TEXT NOT NULL,
        name           TEXT,
        description    TEXT,
        image_locked   TEXT,
        image_unlocked TEXT,
        date_unlocked  TEXT,
        visible        INTEGER DEFAULT 1,
        PRIMARY KEY (app_id, key)
    )`); } catch(e) {}
}

// ── Proton scanner ────────────────────────────────────────────────────────────
const HOME = os.homedir();

// All directories that may contain Proton installations
const PROTON_DIRS = [
    // Steam native (multiple common paths)
    path.join(HOME, '.steam', 'root', 'steamapps', 'common'),
    path.join(HOME, '.steam', 'steam', 'steamapps', 'common'),
    path.join(HOME, '.local', 'share', 'Steam', 'steamapps', 'common'),
    // GE-Proton and custom compatibility tools
    path.join(HOME, '.steam', 'root', 'compatibilitytools.d'),
    path.join(HOME, '.steam', 'steam', 'compatibilitytools.d'),
    path.join(HOME, '.local', 'share', 'Steam', 'compatibilitytools.d'),
    // Flatpak Steam
    path.join(HOME, '.var', 'app', 'com.valvesoftware.Steam', 'data', 'Steam', 'steamapps', 'common'),
    path.join(HOME, '.var', 'app', 'com.valvesoftware.Steam', 'data', 'Steam', 'compatibilitytools.d'),
];

function scanProtonVersions() {
    const found = [];
    const seen  = new Set();

    for (const dir of PROTON_DIRS) {
        if (!fs.existsSync(dir)) continue;
        let entries;
        try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
        catch { continue; }

        for (const entry of entries) {
            if (!entry.isDirectory()) continue;
            const fullPath = path.join(dir, entry.name);
            // Resolve symlinks so ~/.steam/root, ~/.steam/steam, ~/.local/share/Steam
            // (which are all symlinks to the same location) don't produce duplicates.
            const realPath = (() => { try { return fs.realpathSync(fullPath); } catch { return fullPath; } })();
            if (seen.has(realPath)) continue;

            // A valid Proton dir has a 'proton' script and/or toolmanifest.vdf
            const isProton =
                fs.existsSync(path.join(realPath, 'proton')) ||
                fs.existsSync(path.join(realPath, 'toolmanifest.vdf')) ||
                fs.existsSync(path.join(realPath, 'compatibilitytool.vdf'));

            if (!isProton) continue;
            seen.add(realPath);

            const name = entry.name;
            let type = 'other';
            if (/^GE-Proton|^Proton-GE/i.test(name))  type = 'ge';
            else if (/^Proton/i.test(name))             type = 'steam';

            found.push({ name, path: realPath, type });
        }
    }

    // Sort: GE-Proton first (usually preferred), then Steam Proton, then others.
    // Within each group, newest (highest version number) first.
    const order = { ge: 0, steam: 1, other: 2 };
    return found.sort((a, b) => {
        const to = (order[a.type] ?? 2) - (order[b.type] ?? 2);
        if (to !== 0) return to;
        return b.name.localeCompare(a.name, undefined, { numeric: true, sensitivity: 'base' });
    });
}

// Expand ~ to HOME so spawn() (which doesn't use a shell) gets real paths
// ── Bundled binary paths ──────────────────────────────────────────────────────
// In packaged AppImage, extraResources land in process.resourcesPath/assets/bin/linux.
// In dev, they live in __dirname/assets/bin/linux.
const binDir = app.isPackaged
    ? path.join(process.resourcesPath, 'assets', 'bin', 'linux')
    : path.join(__dirname, 'assets', 'bin', 'linux');

// expandTilde, resolvePathCaseInsensitive, which, find* and findRuntime now live
// in packages/core/grinder-engine.js (re-bound at the top of this file).


// ── Launch engine ─────────────────────────────────────────────────────────────
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

// ── Window ────────────────────────────────────────────────────────────────────
function createWindow() {
    win = new BrowserWindow({
        width: 1100, height: 700,
        minWidth: 800, minHeight: 500,
        frame: false,
        show: false,
        backgroundColor: '#1a0f0a',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        }
    });
    win.setMenu(null);
    win.loadFile(path.join(__dirname, 'index.html'));

    const showWin = () => {
        if (!win.isVisible()) win.show();
        if (cliSearch)  win.webContents.send('cli-search', cliSearch);
        if (cliSetupId) win.webContents.send('cli-setup',  cliSetupId);
    };
    ipcMain.once('renderer-ready', showWin);
    win.once('ready-to-show', () => setTimeout(showWin, 2000));
}

// ── App lifecycle ─────────────────────────────────────────────────────────────
if (cliMode) {
    // Headless CLI: launch game and exit
    app.disableHardwareAcceleration();
    app.whenReady().then(() => {
        initDb();
        launchGame(cliGameId)
            .then(r  => { console.log(`GRINDER: launched via ${r.method}`); setTimeout(() => app.quit(), 300); })
            .catch(e => { console.error('GRINDER error:', e.message); app.quit(); });
    });
} else if (headlessInstMode) {
    // Headless install/uninstall mode — no window, writes progress to grinder-progress.json
    app.disableHardwareAcceleration();
    app.whenReady().then(async () => {
        initDb();
        try {
            if (cliInstall)    await headlessInstall(cliInstall[0], cliInstall[1], cliInstall[2], cliInstall[3]);
            else               await headlessUninstall(cliUninstall[0], cliUninstall[1]);
        } catch (e) {
            writeProgress({ step: 'error', message: e.message, done: true });
        }
        setTimeout(() => app.quit(), 500);
    });
} else {
    // Single-instance lock for windowed mode — second instance focuses existing window
    const gotLock = app.requestSingleInstanceLock();
    if (!gotLock) {
        app.quit();
    } else {
        app.on('second-instance', (_, argv) => {
            if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
            const args = argv.slice(2);
            const si = args.indexOf('search');
            if (si !== -1 && args[si + 1]) win?.webContents.send('cli-search', args.slice(si + 1).join(' '));
            const pi = args.indexOf('setup');
            if (pi !== -1 && args[pi + 1]) win?.webContents.send('cli-setup', args[pi + 1]);
            if (args.indexOf('sync-gog')  !== -1) win?.webContents.send('cli-sync', 'gog');
            if (args.indexOf('sync-epic') !== -1) win?.webContents.send('cli-sync', 'epic');
        });
        app.whenReady().then(() => {
            initDb();
            createWindow();
        });
        app.on('window-all-closed', () => app.quit());
    }
}

// ── IPC handlers ──────────────────────────────────────────────────────────────

ipcMain.on('window-minimize', () => BrowserWindow.getFocusedWindow()?.minimize());
ipcMain.on('window-maximize', () => {
    const w = BrowserWindow.getFocusedWindow();
    if (w) w.isMaximized() ? w.unmaximize() : w.maximize();
});
ipcMain.on('window-close',    () => BrowserWindow.getFocusedWindow()?.close());

// Games
ipcMain.handle('get-games', () => db.prepare('SELECT * FROM games ORDER BY title COLLATE NOCASE').all());

ipcMain.handle('add-game', (_, data) => {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    db.prepare(`
        INSERT INTO games (id, title, store, app_id, install_path, executable, prefix_path, proton_path, installed, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, data.title || 'Unnamed', data.store || 'custom', data.app_id || null,
           data.install_path || null, data.executable || null,
           data.prefix_path || null, data.proton_path || null,
           data.installed ? 1 : 0, data.notes || null);
    return id;
});

ipcMain.handle('update-game', (_, id, data) => {
    const allowed = ['title','store','app_id','install_path','executable','prefix_path','proton_path','installed','version','notes','platform','platforms','custom_env','winetricks','use_esync','use_fsync','use_dxvk_nvapi','use_battleye','use_eac','launch_target','launch_args','custom_exe'];
    const entries = Object.entries(data).filter(([k]) => allowed.includes(k));
    if (!entries.length) return false;
    const set = entries.map(([k]) => `${k}=?`).join(', ');
    const vals = entries.map(([,v]) => v);
    db.prepare(`UPDATE games SET ${set} WHERE id=?`).run(...vals, id);
    return true;
});

ipcMain.handle('delete-game', (_, id) => { db.prepare('DELETE FROM games WHERE id=?').run(id); return true; });

ipcMain.handle('uninstall-game-files', async (_, id) => {
    const game = db.prepare('SELECT * FROM games WHERE id=?').get(id);
    if (!game) return { ok: false, error: 'Game not found.' };

    const errors = [];

    const installPath = expandTilde(game.install_path || '');
    const defaultBase = expandTilde(
        db.prepare("SELECT value FROM settings WHERE key='default_install_dir'").get()?.value
        || path.join(HOME, 'Games', 'CafeNeurotico')
    );

    // Safety guard: never delete the base install directory or any ancestor of it.
    // A valid game path must be at least one level deeper than the base.
    const isSafe = installPath &&
        installPath !== defaultBase &&
        installPath !== HOME &&
        installPath !== '/' &&
        installPath.startsWith(defaultBase + path.sep);

    if (installPath && fs.existsSync(installPath)) {
        if (!isSafe) {
            errors.push(`Refusing to delete "${installPath}" — looks like a base directory, not a game folder. Remove files manually.`);
        } else {
            try { fs.rmSync(installPath, { recursive: true, force: true }); }
            catch (e) { errors.push(`Game files: ${e.message}`); }
        }
    }

    const prefixPath = expandTilde(game.prefix_path) || (() => {
        const legacy = path.join(prefixesDir, id);
        if (fs.existsSync(legacy)) return legacy;
        const safeName = (game.title || id).replace(/[/\\:*?"<>|]/g, '').trim().slice(0, 64) || id;
        return path.join(prefixesDir, safeName);
    })();
    if (fs.existsSync(prefixPath)) {
        try { fs.rmSync(prefixPath, { recursive: true, force: true }); }
        catch (e) { errors.push(`Prefix: ${e.message}`); }
    }

    // For Epic games, also tell legendary to remove its own install record
    if (game.store === 'epic' && game.app_id) {
        const leg = findLegendary();
        if (leg) await new Promise(resolve => {
            const proc = spawn(leg, ['uninstall', game.app_id, '-y'], { stdio: 'ignore' });
            proc.on('close', resolve);
            proc.on('error', resolve);
        });
    }

    db.prepare("UPDATE games SET installed=0, install_path=NULL, executable=NULL, version=NULL WHERE id=?").run(id);

    return errors.length ? { ok: false, error: errors.join('; ') } : { ok: true };
});

function appendGameLog(game, method, error) {
    try {
        fs.mkdirSync(logDir, { recursive: true });
        const logPath = path.join(logDir, sanitizeLogName(game.title) + '.md');
        const ts = new Date().toLocaleString('sv-SE').replace('T', ' ');
        const existed = fs.existsSync(logPath);
        let header = '';
        if (!existed) {
            header = `# Game Launch Log: ${game.title}\n\n`;
        }
        const entry = [
            `## ${ts}`,
            ``,
            `| Field | Value |`,
            `|---|---|`,
            `| Store | ${game.store || '—'} |`,
            `| App ID | ${game.app_id || '—'} |`,
            `| Method | ${method || '—'} |`,
            `| Executable | \`${game.executable || '—'}\` |`,
            `| Install Path | \`${game.install_path || '—'}\` |`,
            `| Proton | \`${game.proton_path || '(default)'}\` |`,
            `| Prefix | \`${game.prefix_path || '(auto)'}\` |`,
            `| Status | ${error ? `**ERROR**: ${error}` : '**OK**'} |`,
            ``,
        ].join('\n');
        fs.appendFileSync(logPath, header + entry + '\n');
    } catch {}
}

ipcMain.handle('launch-game', async (_, gameId) => {
    const game = db.prepare('SELECT * FROM games WHERE id = ?').get(gameId);
    try {
        const result = await launchGame(gameId);
        if (game) appendGameLog(game, result.method, null);
        return result;
    } catch (e) {
        if (game) appendGameLog(game, null, e.message);
        return { ok: false, error: e.message };
    }
});

// Settings
ipcMain.handle('get-setting', (_, key) => db.prepare("SELECT value FROM settings WHERE key=?").get(key)?.value ?? null);
ipcMain.handle('set-setting', (_, key, value) => { db.prepare("INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)").run(key, value); return true; });

const installLogPath = path.join(configDir, 'installLog.json');
ipcMain.handle('get-install-log', () => {
    try { return JSON.parse(fs.readFileSync(installLogPath, 'utf8')); } catch { return []; }
});
ipcMain.handle('save-install-log', (_, entries) => {
    try { fs.writeFileSync(installLogPath, JSON.stringify(entries), 'utf8'); return true; } catch { return false; }
});

// Read the active theme name from CNGM's settings DB so GRINDER can match its appearance
ipcMain.handle('get-cngm-theme', () => {
    const cngmDb = path.join(appImageDir, 'GameManagerConfig', 'games.db');
    if (!fs.existsSync(cngmDb)) return null;
    try {
        const db2 = new Database(cngmDb, { readonly: true });
        const row = db2.prepare("SELECT value FROM settings WHERE key='cngm_theme'").get();
        db2.close();
        return row?.value || null;
    } catch { return null; }
});

// Environment checks
ipcMain.handle('check-tools', () => {
    const leg   = findLegendary();
    const gogdl = findGogdl();
    return {
        legendary:         leg,
        legendary_bundled: leg === path.join(binDir, 'legendary'),
        gogdl:             gogdl,
        gogdl_bundled:     gogdl === path.join(binDir, 'gogdl'),
        umu:               findUmu(),
        wine:              findWineCached(),
    };
});

ipcMain.handle('open-path', (_, p) => shell.openPath(p));

// Pre-install size info for GOG games
// Windows: use gogdl info (depot-based, returns precise sizes)
// Linux:   use GOG API directly (installer files; gogdl's linux manager doesn't expose size)
ipcMain.handle('gog-install-info', async (_, appId, platform) => {
    if (platform === 'linux') {
        // GOG API: sum all Linux installer file sizes
        try {
            const token = await getGogToken();
            if (!token) return null;
            const data = await gogFetch(
                `https://api.gog.com/products/${appId}?expand=downloads`, token
            );
            const installers = (data.downloads?.installers || []).filter(i => i.os === 'linux');
            let download_size = 0;
            for (const inst of installers) {
                for (const file of inst.files || []) download_size += file.size || 0;
            }
            return download_size > 0 ? { download_size, disk_size: download_size } : null;
        } catch { return null; }
    }

    // Windows: use gogdl info for depot-based size breakdown
    const gogdl = findGogdl();
    if (!gogdl) return null;
    try { fs.chmodSync(gogdl, '755'); } catch {}
    const authPath = writeGogAuthConfig();
    return new Promise(resolve => {
        let out = '';
        const proc = spawn(gogdl, [
            '--auth-config-path', authPath,
            'info', appId, '--platform', platform,
        ], { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, GOGDL_CONFIG_PATH: configDir } });
        proc.stdout.on('data', d => out += d);
        proc.stderr.on('data', d => out += d);
        proc.on('close', () => {
            try { fs.unlinkSync(authPath); } catch {}
            try {
                const jsonLine = out.split('\n').find(l => l.trim().startsWith('{'));
                const data = JSON.parse(jsonLine);
                let download_size = 0, disk_size = 0;
                for (const s of Object.values(data.size || {})) {
                    download_size += s.download_size || 0;
                    disk_size     += s.disk_size     || 0;
                }
                resolve({ download_size, disk_size, version: data.versionName });
            } catch { resolve(null); }
        });
        proc.on('error', () => { try { fs.unlinkSync(authPath); } catch {} resolve(null); });
    });
});

// Pre-install size info for Epic games via legendary info
ipcMain.handle('epic-install-info', async (_, appName) => {
    const leg = findLegendary();
    if (!leg) return null;
    return new Promise(resolve => {
        let out = '';
        const proc = spawn(leg, ['info', appName], { stdio: ['ignore', 'pipe', 'pipe'] });
        proc.stdout.on('data', d => out += d);
        proc.stderr.on('data', d => out += d);
        proc.on('close', () => {
            const toBytes = (n, u) => {
                const v = parseFloat(n);
                return u.toLowerCase().startsWith('g') ? v * 1024 ** 3
                     : u.toLowerCase().startsWith('m') ? v * 1024 ** 2
                     : v * 1024;
            };
            const dl   = out.match(/Download size[^:]*:\s*([\d.]+)\s*(\w+)/i);
            const disk = out.match(/Disk size[^:]*:\s*([\d.]+)\s*(\w+)/i);
            resolve(dl && disk ? {
                download_size: toBytes(dl[1], dl[2]),
                disk_size:     toBytes(disk[1], disk[2]),
            } : null);
        });
        proc.on('error', () => resolve(null));
    });
});

// Available disk space at the given path (walks up to find an existing parent)
ipcMain.handle('get-disk-space', async (_, dirPath) => {
    let check = expandTilde(dirPath) || HOME;
    while (!fs.existsSync(check) && path.dirname(check) !== check) check = path.dirname(check);
    try {
        const stats = await fs.promises.statfs(check);
        return stats.bavail * stats.bsize;
    } catch { return null; }
});

ipcMain.handle('verify-installs', async () => {
    const installed = db.prepare("SELECT id, title, store, app_id, install_path FROM games WHERE installed=1").all();
    let reset = 0;
    for (const g of installed) {
        const p = expandTilde(g.install_path || '');
        if (!p || !fs.existsSync(p)) {
            db.prepare("UPDATE games SET installed=0, install_path=NULL, executable=NULL, version=NULL WHERE id=?").run(g.id);
            // Also remove legendary's stale record for Epic games
            if (g.store === 'epic' && g.app_id) {
                const leg = findLegendary();
                if (leg) await new Promise(resolve => {
                    const proc = spawn(leg, ['uninstall', g.app_id, '-y'], { stdio: 'ignore' });
                    proc.on('close', resolve);
                    proc.on('error', resolve);
                });
            }
            reset++;
        }
    }
    return { reset };
});

ipcMain.handle('get-disk-size', (_, dirPath) => {
    const resolved = expandTilde(dirPath);
    if (!resolved || !fs.existsSync(resolved)) return null;
    return new Promise(resolve => {
        const { exec } = require('child_process');
        exec(`du -sh "${resolved}" 2>/dev/null`, { timeout: 15000 }, (err, stdout) => {
            resolve(err ? null : stdout.split('\t')[0].trim());
        });
    });
});

// Single batch call — returns { id: size } for all installed games at once.
// Avoids N concurrent IPC round-trips which can cause race conditions.
ipcMain.handle('get-all-disk-sizes', () => {
    const { exec } = require('child_process');
    const installed = db.prepare(
        "SELECT id, install_path FROM games WHERE installed=1 AND install_path IS NOT NULL"
    ).all();
    return Promise.all(installed.map(g => {
        const p = expandTilde(g.install_path);
        if (!p || !fs.existsSync(p)) return Promise.resolve({ id: g.id, size: null });
        return new Promise(resolve => {
            exec(`du -sh "${p}" 2>/dev/null`, { timeout: 15000 }, (err, stdout) => {
                resolve({ id: g.id, size: err ? null : stdout.split('\t')[0].trim() });
            });
        });
    }));
});
ipcMain.handle('get-config-dir', () => configDir);
ipcMain.handle('open-config-dir', () => shell.openPath(configDir));

ipcMain.handle('reset-grinder', () => {
    if (db) { try { db.close(); } catch(e) {} db = null; }
    try { fs.unlinkSync(dbPath); } catch(e) {}
    try { fs.rmSync(prefixesDir, { recursive: true, force: true }); } catch(e) {}
    try { fs.rmSync(logDir,      { recursive: true, force: true }); } catch(e) {}
    initDb();
    return { ok: true };
});

ipcMain.handle('delete-all-grinder-data', () => {
    if (db) { try { db.close(); } catch(e) {} db = null; }
    try { fs.rmSync(configDir, { recursive: true, force: true }); } catch(e) {}
    app.quit();
    return { ok: true };
});

ipcMain.handle('get-game-log', (_, gameId) => {
    const game = db.prepare('SELECT title FROM games WHERE id = ?').get(gameId);
    if (!game) return { exists: false, content: '' };
    const logPath = path.join(logDir, sanitizeLogName(game.title) + '.md');
    if (!fs.existsSync(logPath)) return { exists: false, content: '' };
    return { exists: true, content: fs.readFileSync(logPath, 'utf8') };
});

ipcMain.handle('get-log-index', () => {
    if (!fs.existsSync(logDir)) return [];
    const files = new Set(fs.readdirSync(logDir).filter(f => f.endsWith('.md')).map(f => f.slice(0, -3)));
    return db.prepare('SELECT id, title FROM games').all()
        .filter(g => files.has(sanitizeLogName(g.title)))
        .map(g => g.id);
});

// Scan an existing game folder to detect store/app_id markers
ipcMain.handle('scan-game-folder', (_, folderPath) => {
    const expanded = expandTilde(folderPath);
    if (!expanded || !fs.existsSync(expanded)) return { ok: false, error: 'Folder not found.' };

    const detected = [];
    let exes = [];

    try {
        const entries = fs.readdirSync(expanded);

        // Top-level executables the user might want to set
        exes = entries.filter(f => /\.(exe|sh|bat)$/i.test(f));

        // GOG: goggame-{numericId}.info files at folder root
        for (const f of entries) {
            const m = f.match(/^goggame-(\d+)\.info$/i);
            if (!m) continue;
            const appId = m[1];
            let title = appId;
            let executable = null;
            try {
                const info = JSON.parse(fs.readFileSync(path.join(expanded, f), 'utf8'));
                title = info.gameTitle || info.gameId || appId;
                const primary = (info.playTasks || []).find(t => t.isPrimary && t.type === 'FileTask');
                if (primary?.path) executable = primary.path.replace(/\\/g, '/');
            } catch {}
            detected.push({ store: 'gog', app_id: appId, title, executable });
        }

        // Epic: .egstore/ directory contains *.item JSON manifests
        const egstoreDir = path.join(expanded, '.egstore');
        if (fs.existsSync(egstoreDir)) {
            try {
                for (const f of fs.readdirSync(egstoreDir)) {
                    if (!f.endsWith('.item')) continue;
                    try {
                        const item = JSON.parse(fs.readFileSync(path.join(egstoreDir, f), 'utf8'));
                        if (item.AppName) {
                            detected.push({
                                store: 'epic',
                                app_id: item.AppName,
                                title: item.DisplayName || item.AppName,
                                executable: item.LaunchExecutable ? item.LaunchExecutable.replace(/\\/g, '/') : null,
                            });
                        }
                    } catch {}
                }
            } catch {}
        }
    } catch (e) {
        return { ok: false, error: e.message };
    }

    return { ok: true, detected, exes };
});

// Proton
ipcMain.handle('scan-proton', () => scanProtonVersions());

ipcMain.handle('delete-proton', (_, dirPath) => {
    const resolved = (() => { try { return fs.realpathSync(expandTilde(dirPath)); } catch { return expandTilde(dirPath); } })();
    // Safety: only delete from compatibilitytools.d — resolve symlinks on base dirs too
    const safeBases = [
        path.join(HOME, '.steam', 'root', 'compatibilitytools.d'),
        path.join(HOME, '.steam', 'steam', 'compatibilitytools.d'),
        path.join(HOME, '.local', 'share', 'Steam', 'compatibilitytools.d'),
        path.join(HOME, '.var', 'app', 'com.valvesoftware.Steam', 'data', 'Steam', 'compatibilitytools.d'),
    ].map(b => { try { return fs.realpathSync(b); } catch { return b; } });
    const isSafe = safeBases.some(base => resolved.startsWith(base + path.sep));
    if (!isSafe) return { ok: false, error: 'Refusing to delete — path is not inside compatibilitytools.d.' };
    try {
        fs.rmSync(resolved, { recursive: true, force: true });
        return { ok: true };
    } catch (e) { return { ok: false, error: e.message }; }
});

// ── GE-Proton downloader ───────────────────────────────────────────────────────
let _protonDlReq = null;

ipcMain.handle('get-proton-releases', async () => {
    try {
        const releases = await new Promise((resolve, reject) => {
            require('https').get(
                'https://api.github.com/repos/GloriousEggroll/proton-ge-custom/releases?per_page=15',
                { headers: { 'User-Agent': 'GRINDER/1.0' } },
                res => {
                    let data = '';
                    res.on('data', d => data += d);
                    res.on('end', () => {
                        try { resolve(JSON.parse(data)); }
                        catch (e) { reject(new Error('Invalid JSON from GitHub API')); }
                    });
                }
            ).on('error', reject);
        });
        return {
            ok: true,
            releases: releases
                .map(r => {
                    const asset = r.assets.find(a => a.name.endsWith('.tar.gz'));
                    if (!asset) return null;
                    return {
                        tag:  r.tag_name,
                        name: r.name || r.tag_name,
                        date: r.published_at.split('T')[0],
                        size: asset.size,
                        url:  asset.browser_download_url,
                    };
                })
                .filter(Boolean),
        };
    } catch (e) { return { ok: false, error: e.message }; }
});

ipcMain.handle('download-proton', async (event, url, tag) => {
    const send = d => { try { event.sender.send('proton-dl-progress', d); } catch {} };

    // Install to first available compatibilitytools.d that exists (or create it)
    const ctDirs = [
        path.join(HOME, '.steam', 'root', 'compatibilitytools.d'),
        path.join(HOME, '.local', 'share', 'Steam', 'compatibilitytools.d'),
        path.join(HOME, '.var', 'app', 'com.valvesoftware.Steam', 'data', 'Steam', 'compatibilitytools.d'),
    ];
    const installBase = ctDirs.find(d => fs.existsSync(d)) || ctDirs[0];
    try { fs.mkdirSync(installBase, { recursive: true }); } catch {}

    const tmpFile = path.join(configDir, `${tag}.tar.gz`);
    send({ phase: 'downloading', percent: 0, message: `Downloading ${tag}...` });

    const dlOk = await new Promise(resolve => {
        function get(dlUrl, redirectCount = 0) {
            if (redirectCount > 5) { resolve(false); return; }
            const protocol = dlUrl.startsWith('https') ? require('https') : require('http');
            _protonDlReq = protocol.get(dlUrl, { headers: { 'User-Agent': 'GRINDER/1.0' } }, res => {
                if (res.statusCode === 301 || res.statusCode === 302) { get(res.headers.location, redirectCount + 1); return; }
                if (res.statusCode !== 200) { resolve(false); return; }
                const total = parseInt(res.headers['content-length'] || '0', 10);
                let downloaded = 0;
                const out = fs.createWriteStream(tmpFile);
                res.on('data', chunk => {
                    downloaded += chunk.length;
                    if (total) send({ phase: 'downloading', percent: Math.round(downloaded / total * 100), message: `${(downloaded/1e6).toFixed(0)} MB / ${(total/1e6).toFixed(0)} MB` });
                });
                res.pipe(out);
                out.on('finish', () => resolve(true));
                out.on('error', () => resolve(false));
            });
            _protonDlReq.on('error', () => resolve(false));
        }
        get(url);
    });

    _protonDlReq = null;
    if (!dlOk) { try { fs.unlinkSync(tmpFile); } catch {} return { ok: false, error: 'Download failed or cancelled.' }; }

    send({ phase: 'extracting', percent: 100, message: `Extracting ${tag}...` });
    const extractOk = await new Promise(resolve => {
        const proc = spawn('tar', ['-xzf', tmpFile, '-C', installBase], { stdio: 'ignore' });
        proc.on('close', code => resolve(code === 0));
        proc.on('error', () => resolve(false));
    });
    try { fs.unlinkSync(tmpFile); } catch {}
    if (!extractOk) return { ok: false, error: 'Extraction failed.' };

    send({ phase: 'done', percent: 100, message: `${tag} installed to ${installBase}` });
    return { ok: true, installBase };
});

ipcMain.handle('cancel-proton-download', () => {
    if (_protonDlReq) { try { _protonDlReq.destroy(); } catch {} _protonDlReq = null; }
    return { ok: true };
});

// ── Legendary / Epic ──────────────────────────────────────────────────────────

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

// Check if logged in
ipcMain.handle('legendary-status', async () => {
    const r = await runLegendary(['status']);
    if (!r.ok && r.error) return { ok: false, error: r.error };
    const text = r.stdout + r.stderr;
    const loggedIn = !text.includes('<not logged in>');
    const accountMatch = text.match(/Epic account:\s*(.+)/);
    const gamesMatch   = text.match(/Games available:\s*(\d+)/);
    return {
        ok: true,
        logged_in: loggedIn,
        account:   loggedIn ? (accountMatch?.[1]?.trim() || 'unknown') : null,
        games_available: parseInt(gamesMatch?.[1] || '0'),
    };
});

// Open Epic login window and authenticate legendary
ipcMain.handle('legendary-login', event => {
    // legendary.gl/epiclogin is maintained by the legendary team and always uses
    // the current valid Epic client ID — avoids hardcoding one that can be revoked.
    const AUTH_URL = 'https://legendary.gl/epiclogin';
    const leg = findLegendary();
    if (!leg) return Promise.resolve({ ok: false, error: 'legendary not found' });

    return new Promise(resolve => {
        let resolved = false;

        const authWin = new BrowserWindow({
            width: 560, height: 780, title: 'Login to Epic Games — close when done',
            webPreferences: { nodeIntegration: false, contextIsolation: true },
        });
        authWin.setMenu(null);
        // Force a fresh page load so we always get a new authorization code,
        // not a cached one with an already-expired code.
        authWin.loadURL(AUTH_URL, { extraHeaders: 'Cache-Control: no-cache\nPragma: no-cache\n' });

        const send = d => { try { event.sender.send('legendary-login-progress', String(d)); } catch {} };

        async function tryExtract() {
            if (resolved) return;
            try {
                const text = await authWin.webContents.executeJavaScript('document.body.innerText');

                // Epic returns the code in multiple places — try all of them:
                // 1. redirectUrl query param:  ...?code=<authCode>
                // 2. authorizationCode field (current flow)
                // 3. exchangeCode field (older flow)
                const m = text.match(/"redirectUrl"\s*:\s*"[^"]*[?&]code=([^"&\\s]+)/) ||
                          text.match(/"authorizationCode"\s*:\s*"([^"]+)"/) ||
                          text.match(/"exchangeCode"\s*:\s*"([^"]+)"/);
                if (!m) return;

                resolved = true;
                authWin.close();
                send(`Extracted auth code, running legendary auth...\n`);

                const proc = spawn(leg, ['auth', '--code', m[1]], { stdio: ['ignore', 'pipe', 'pipe'] });
                proc.stdout.on('data', send);
                proc.stderr.on('data', send);
                proc.on('close', exitCode => {
                    if (exitCode !== 0) {
                        // Show legendary's log file so the user can see what went wrong
                        try {
                            const logPath = path.join(HOME, '.config', 'legendary', 'logs', 'legendary.log');
                            const log = fs.readFileSync(logPath, 'utf8');
                            const tail = log.split('\n').slice(-25).join('\n');
                            send(`\n--- legendary log (last 25 lines) ---\n${tail}\n`);
                        } catch { send('\n(Could not read legendary log)\n'); }
                    }
                    resolve({ ok: exitCode === 0 });
                });
                proc.on('error', e => resolve({ ok: false, error: e.message }));
            } catch {}
        }

        authWin.webContents.on('did-finish-load',     tryExtract);
        authWin.webContents.on('did-navigate',         tryExtract);
        authWin.webContents.on('did-navigate-in-page', tryExtract);
        setTimeout(tryExtract, 1500);
        authWin.on('closed', () => { if (!resolved) resolve({ ok: false, error: 'Window closed before login completed.' }); });
    });
});

// List all owned Epic games (installed or not via legendary)
ipcMain.handle('legendary-list-owned', async () => {
    const r = await runLegendary(['list', '--json']);
    if (!r.ok && r.error) return { ok: false, error: r.error };
    try {
        const all = JSON.parse(r.stdout);
        return {
            ok: true,
            games: all.map(g => ({
                app_name:     g.app_name,
                title:        g.app_title || g.metadata?.title || 'Unknown',
                is_dlc:       false,
                install_path: null,
                executable:   null,
                version:      null,
            }))
        };
    } catch { return { ok: false, error: 'Failed to parse legendary output.' }; }
});

// List games that legendary itself has installed (subset of owned)
ipcMain.handle('legendary-list-installed', async () => {
    const r = await runLegendary(['list-installed', '--json']);
    if (!r.ok && r.error) return { ok: false, error: r.error };
    try {
        const all = JSON.parse(r.stdout);
        return { ok: true, games: all.filter(g => !g.is_dlc) };
    } catch { return { ok: false, error: 'Failed to parse legendary output.' }; }
});

// ── Game installation ─────────────────────────────────────────────────────────
let activeInstallProc = null;

// Directory picker dialog
ipcMain.handle('select-directory', async () => {
    const result = await dialog.showOpenDialog(win, {
        title: 'Choose Install Directory',
        properties: ['openDirectory', 'createDirectory'],
    });
    return result.canceled ? null : result.filePaths[0];
});

// File picker dialog (for custom exe selection)
ipcMain.handle('select-file', async () => {
    const result = await dialog.showOpenDialog(win, {
        title: 'Select Executable',
        properties: ['openFile'],
    });
    return result.canceled ? null : result.filePaths[0];
});

// Start installing a game via legendary
ipcMain.handle('legendary-install', async (event, appName, installDir) => {
    if (activeInstallProc) return { ok: false, error: 'An installation is already in progress.' };
    const leg = findLegendary();
    if (!leg) return { ok: false, error: 'legendary not found.' };

    const dir = expandTilde(installDir) || path.join(HOME, 'Games', 'CafeNeurotico');
    try { fs.mkdirSync(dir, { recursive: true }); } catch (e) {}

    // Validate write access before starting
    try { fs.accessSync(dir, fs.constants.W_OK); }
    catch { return { ok: false, error: `No write access to ${dir}` }; }

    const send = d => { try { event.sender.send('install-progress', String(d)); } catch {} };

    // Clear any stale legendary record for this game so it installs fresh
    send(`Clearing any existing legendary records for ${appName}...\n`);
    await new Promise(resolve => {
        const proc = spawn(leg, ['uninstall', appName, '-y'], { stdio: 'ignore' });
        proc.on('close', resolve);
        proc.on('error', resolve);
    });

    return new Promise(resolve => {
        // -y skips interactive prompts; --skip-sdl skips SDL check
        activeInstallProc = spawn(leg, ['install', appName, '--base-path', dir, '-y'], {
            stdio: ['ignore', 'pipe', 'pipe'],
        });

        activeInstallProc.stdout.on('data', send);
        activeInstallProc.stderr.on('data', send);

        activeInstallProc.on('close', async code => {
            activeInstallProc = null;
            if (code === 0) {
                // Get actual install path and executable from legendary
                const info = await getGameInstallInfo(appName);
                resolve({ ok: true, info });
            } else {
                resolve({ ok: false, exitCode: code });
            }
        });
        activeInstallProc.on('error', e => { activeInstallProc = null; resolve({ ok: false, error: e.message }); });
    });
});

// Cancel an in-progress installation
ipcMain.handle('legendary-cancel-install', () => {
    if (!activeInstallProc) return { ok: false };
    activeInstallProc.kill('SIGTERM');
    activeInstallProc = null;
    return { ok: true };
});

// Get install path/exe for a specific game from legendary
async function getGameInstallInfo(appName) {
    const r = await runLegendary(['list-installed', '--json']);
    if (!r.ok) return null;
    try {
        const all = JSON.parse(r.stdout);
        return all.find(g => g.app_name === appName) || null;
    } catch { return null; }
}
ipcMain.handle('legendary-install-info', (_, appName) => getGameInstallInfo(appName));

// Uninstall a game via legendary
ipcMain.handle('legendary-uninstall', (event, appName) => {
    const leg = findLegendary();
    if (!leg) return { ok: false, error: 'legendary not found.' };
    return new Promise(resolve => {
        const proc = spawn(leg, ['uninstall', appName, '-y'], { stdio: ['ignore', 'pipe', 'pipe'] });
        proc.on('close', code => resolve({ ok: code === 0 }));
        proc.on('error', e => resolve({ ok: false, error: e.message }));
    });
});

// Import selected games into GRINDER DB
ipcMain.handle('legendary-import', (_, games) => {
    const stmt = db.prepare(`
        INSERT OR IGNORE INTO games (id, title, store, app_id, install_path, executable, installed, version)
        VALUES (?, ?, 'epic', ?, ?, ?, 0, ?)
    `);
    const tx = db.transaction(list => {
        let n = 0;
        for (const g of list) {
            // installed=0 by default — will be updated when user installs via GRINDER
        stmt.run('epic_' + g.app_name, g.title, g.app_name,
                     g.install_path || null, g.executable || null, g.version || null);
            n++;
        }
        return n;
    });
    try { return { ok: true, count: tx(games) }; }
    catch (e) { return { ok: false, error: e.message }; }
});


// Returns the computed Wine prefix path for a game (same logic as launchGame)
ipcMain.handle('get-game-prefix', (_, gameId) => {
    const game = db.prepare('SELECT * FROM games WHERE id=?').get(gameId);
    if (!game) return null;
    const explicit = expandTilde(game.prefix_path);
    if (explicit && fs.existsSync(explicit)) return explicit;
    const legacy = path.join(prefixesDir, gameId);
    if (fs.existsSync(legacy)) return legacy;
    const safe = (game.title || gameId).replace(/[/\\:*?"<>|]/g, '').trim().slice(0, 64) || gameId;
    return path.join(prefixesDir, safe);
});

// Winetricks: detect and run
ipcMain.handle('check-winetricks', () => ({ found: !!which('winetricks') }));

ipcMain.handle('run-winetricks', (event, prefixPath, tricks) => {
    const wt = which('winetricks');
    if (!wt) return { ok: false, error: 'winetricks not found.' };
    const prefix = expandTilde(prefixPath);
    const args = tricks.trim().split(/\s+/).filter(Boolean);
    const sendLine = d => { try { event.sender.send('winetricks-progress', { line: String(d) }); } catch {} };
    const sendDone = (ok, msg) => { try { event.sender.send('winetricks-progress', { done: true, ok, msg }); } catch {} };
    return new Promise(resolve => {
        const proc = spawn(wt, args, {
            stdio: ['ignore', 'pipe', 'pipe'],
            env: { ...process.env, WINEPREFIX: prefix, WINEARCH: 'win64' },
        });
        proc.stdout.on('data', sendLine);
        proc.stderr.on('data', sendLine);
        proc.on('close', code => {
            const ok = code === 0;
            sendDone(ok, ok ? 'Winetricks finished.' : `winetricks exited with code ${code}.`);
            resolve({ ok });
        });
        proc.on('error', e => { sendDone(false, e.message); resolve({ ok: false, error: e.message }); });
    });
});

// Standalone redist function — called by both the IPC handler and auto-install after gogdl-install
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

ipcMain.handle('gogdl-install-redist', async (event, appId, platform, _installPath, prefixPath, protonPath) => {
    return runRedist(event.sender, 'redist-progress', appId, platform, prefixPath, protonPath);
});

// Play tasks from goggame-<id>.info (GOG only)
ipcMain.handle('get-play-tasks', (_, gameId) => {
    const game = db.prepare('SELECT * FROM games WHERE id=?').get(gameId);
    if (!game || !game.install_path || game.store !== 'gog') return [];
    const infoFile = path.join(expandTilde(game.install_path), `goggame-${game.app_id}.info`);
    if (!fs.existsSync(infoFile)) return [];
    try {
        const info = JSON.parse(fs.readFileSync(infoFile, 'utf8'));
        return (info.playTasks || [])
            .filter(t => t.type === 'FileTask' && t.path)
            .map(t => ({ name: t.name || t.path, path: t.path.replace(/\\/g, '/'),
                         arguments: t.arguments || '', isPrimary: !!t.isPrimary }));
    } catch { return []; }
});

// Run any .exe / .msi inside the game's Wine prefix (mod installers, tools, etc.)
// Inject GOG game registry entries into a Wine prefix so DLC/tool .exe installers
// can detect the base game (they check HKLM\SOFTWARE\GOG.com\Games\<ID>\path).
// Wine maps Z:\ to the filesystem root, so Linux paths are reachable via Z:\.
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

ipcMain.handle('run-exe-on-prefix', async (_, gameId) => {
    const result = await dialog.showOpenDialog(win, {
        title: 'Select executable to run in game prefix',
        filters: [{ name: 'Windows Executables', extensions: ['exe', 'msi', 'bat'] }],
        properties: ['openFile'],
    });
    if (result.canceled || !result.filePaths.length) return { ok: false, canceled: true };

    const game = db.prepare('SELECT * FROM games WHERE id=?').get(gameId);
    if (!game) return { ok: false, error: 'Game not found' };

    const exe = result.filePaths[0];
    const prefix = expandTilde(game.prefix_path) || (() => {
        const safeName = (game.title || gameId).replace(/[/\\:*?"<>|]/g, '').trim().slice(0, 64) || gameId;
        return path.join(prefixesDir, safeName);
    })();
    const proton = expandTilde(game.proton_path)
        || db.prepare("SELECT value FROM settings WHERE key='default_proton_path'").get()?.value || '';
    fs.mkdirSync(prefix, { recursive: true });
    await injectGogRegistry(game, prefix, proton);
    const umu = findUmu();
    const steamRoot = path.join(HOME, '.steam', 'root');

    const customEnv = {};
    for (const line of (game.custom_env || '').split('\n')) {
        const eq = line.indexOf('=');
        if (eq > 0) customEnv[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
    }
    const env = { ...process.env, ...customEnv, WINEPREFIX: prefix,
                  STEAM_COMPAT_DATA_PATH: prefix, STEAM_COMPAT_CLIENT_INSTALL_PATH: steamRoot,
                  GAMEID: 'umu-0', PROTON_VERB: 'run' };
    if (proton) env.PROTONPATH = proton;

    if (umu && proton) {
        spawn(umu, [exe], { env, detached: true, stdio: 'ignore' }).unref();
        return { ok: true, method: 'umu-run' };
    }
    if (proton) {
        const protonBin = path.join(proton, 'proton');
        spawn(protonBin, ['run', exe], { env, detached: true, stdio: 'ignore' }).unref();
        return { ok: true, method: 'proton-direct' };
    }
    const wine = findWineCached();
    if (!wine) return { ok: false, error: 'No runner: umu-run not found, no Proton set, wine not installed.' };
    spawn(wine, [exe], { env, detached: true, stdio: 'ignore' }).unref();
    return { ok: true, method: 'wine' };
});

ipcMain.handle('run-exe-in-game-folder', async (_, gameId) => {
    const game = db.prepare('SELECT * FROM games WHERE id=?').get(gameId);
    if (!game) return { ok: false, error: 'Game not found' };

    const installDir = expandTilde(game.install_path) || undefined;
    const result = await dialog.showOpenDialog(win, {
        title: 'Select executable in game folder',
        defaultPath: installDir,
        filters: [{ name: 'Windows Executables', extensions: ['exe', 'msi', 'bat'] }],
        properties: ['openFile'],
    });
    if (result.canceled || !result.filePaths.length) return { ok: false, canceled: true };

    const exe = result.filePaths[0];
    const prefix = expandTilde(game.prefix_path) || (() => {
        const safeName = (game.title || gameId).replace(/[/\\:*?"<>|]/g, '').trim().slice(0, 64) || gameId;
        return path.join(prefixesDir, safeName);
    })();
    const proton = expandTilde(game.proton_path)
        || db.prepare("SELECT value FROM settings WHERE key='default_proton_path'").get()?.value || '';
    fs.mkdirSync(prefix, { recursive: true });
    await injectGogRegistry(game, prefix, proton);
    const umu = findUmu();
    const steamRoot = path.join(HOME, '.steam', 'root');

    const customEnv = {};
    for (const line of (game.custom_env || '').split('\n')) {
        const eq = line.indexOf('=');
        if (eq > 0) customEnv[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
    }
    const env = { ...process.env, ...customEnv, WINEPREFIX: prefix,
                  STEAM_COMPAT_DATA_PATH: prefix, STEAM_COMPAT_CLIENT_INSTALL_PATH: steamRoot,
                  GAMEID: 'umu-0', PROTON_VERB: 'run' };
    if (proton) env.PROTONPATH = proton;

    if (umu && proton) {
        spawn(umu, [exe], { env, detached: true, stdio: 'ignore' }).unref();
        return { ok: true, method: 'umu-run' };
    }
    if (proton) {
        const protonBin = path.join(proton, 'proton');
        spawn(protonBin, ['run', exe], { env, detached: true, stdio: 'ignore' }).unref();
        return { ok: true, method: 'proton-direct' };
    }
    const wine = findWineCached();
    if (!wine) return { ok: false, error: 'No runner: umu-run not found, no Proton set, wine not installed.' };
    spawn(wine, [exe], { env, detached: true, stdio: 'ignore' }).unref();
    return { ok: true, method: 'wine' };
});

// ── GOG / gogdl ───────────────────────────────────────────────────────────────

const GOG_CLIENT_ID     = '46899977096215655';
const GOG_CLIENT_SECRET = '9d85c43b1482497dbbce61f6e4aa173a433796eeae2ca8c5f6129f2dc4de46d9';
const GOG_REDIRECT_URI  = 'https://embed.gog.com/on_login_success?origin=client';
const GOG_AUTH_URL      =
    `https://auth.gog.com/auth?client_id=${GOG_CLIENT_ID}` +
    `&layout=client2&redirect_uri=${encodeURIComponent(GOG_REDIRECT_URI)}&response_type=code`;

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

ipcMain.handle('gog-status', async () => {
    const token = await getGogToken();
    if (!token) return { logged_in: false, gogdl: !!findGogdl() };
    try {
        const user = await gogFetch('https://embed.gog.com/userData.json', token);
        return { logged_in: true, username: user.username, userId: user.userId, gogdl: !!findGogdl() };
    } catch { return { logged_in: false, gogdl: !!findGogdl() }; }
});

ipcMain.handle('gog-login', event => {
    const send = d => { try { event.sender.send('gog-login-progress', String(d)); } catch {} };
    return new Promise(resolve => {
        let resolved = false;
        const authWin = new BrowserWindow({
            width: 600, height: 780, title: 'Login to GOG — close when done',
            webPreferences: { nodeIntegration: false, contextIsolation: true },
        });
        authWin.setMenu(null);
        authWin.loadURL(GOG_AUTH_URL);

        async function tryExtract() {
            if (resolved) return;
            const url   = authWin.webContents.getURL();
            const match = url.match(/[?&]code=([^&\s]+)/);
            if (!match) return;
            resolved = true;
            authWin.close();
            send('Exchanging auth code...\n');
            try {
                const res = await fetch('https://auth.gog.com/token', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({
                        client_id:     GOG_CLIENT_ID,
                        client_secret: GOG_CLIENT_SECRET,
                        grant_type:    'authorization_code',
                        code:          match[1],
                        redirect_uri:  GOG_REDIRECT_URI,
                    }).toString(),
                });
                const data = await res.json();
                if (!data.access_token) { resolve({ ok: false, error: `No token: ${JSON.stringify(data)}` }); return; }
                const set = (k, v) => db.prepare("INSERT OR REPLACE INTO settings VALUES (?,?)").run(k, v);
                set('gog_access_token',  data.access_token);
                set('gog_refresh_token', data.refresh_token);
                set('gog_token_expiry',  String(Date.now() + data.expires_in * 1000));
                const user = await gogFetch('https://embed.gog.com/userData.json', data.access_token);
                if (user.userId) set('gog_user_id', String(user.userId));
                send(`✓ Logged in as ${user.username}\n`);
                resolve({ ok: true, username: user.username });
            } catch (e) { resolve({ ok: false, error: e.message }); }
        }

        authWin.webContents.on('did-navigate',         tryExtract);
        authWin.webContents.on('did-navigate-in-page', tryExtract);
        authWin.on('closed', () => { if (!resolved) resolve({ ok: false, error: 'Window closed before login.' }); });
    });
});

ipcMain.handle('gog-logout', () => {
    for (const k of ['gog_access_token', 'gog_refresh_token', 'gog_token_expiry', 'gog_user_id'])
        db.prepare("DELETE FROM settings WHERE key=?").run(k);
    return true;
});

ipcMain.handle('gog-list-owned', async () => {
    const token = await getGogToken();
    if (!token) return { ok: false, error: 'Not logged in to GOG.' };
    try {
        const owned = await gogFetch('https://embed.gog.com/user/data/games', token);
        const ids   = owned.owned || [];
        if (!ids.length) return { ok: true, games: [] };

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
        return { ok: true, games };
    } catch (e) { return { ok: false, error: e.message }; }
});

ipcMain.handle('gog-import', (_, games) => {
    const stmtInsert = db.prepare(
        "INSERT OR IGNORE INTO games (id, title, store, app_id, platform, platforms, installed, is_dlc) VALUES (?, ?, 'gog', ?, ?, ?, 0, ?)"
    );
    // Always update platforms + is_dlc so re-importing refreshes metadata
    const stmtUpdate = db.prepare(
        "UPDATE games SET platforms = ?, is_dlc = ? WHERE app_id = ? AND store = 'gog'"
    );
    const tx = db.transaction(list => {
        let n = 0;
        for (const g of list) {
            const plats  = g.platforms || g.platform || 'windows';
            const is_dlc = g.is_dlc ? 1 : 0;
            stmtInsert.run('gog_' + g.id, g.title, g.id, g.platform || 'windows', plats, is_dlc);
            stmtUpdate.run(plats, is_dlc, g.id);
            n++;
        }
        return n;
    });
    try { return { ok: true, count: tx(games) }; }
    catch (e) { return { ok: false, error: e.message }; }
});

// Update platforms column for all existing GOG games from a fresh library fetch
ipcMain.handle('gog-sync-platforms', (_, games) => {
    const stmt = db.prepare("UPDATE games SET platforms = ? WHERE app_id = ? AND store = 'gog'");
    const tx = db.transaction(list => {
        for (const g of list) stmt.run(g.platforms || g.platform || 'windows', g.id);
    });
    try { tx(games); return { ok: true }; }
    catch (e) { return { ok: false, error: e.message }; }
});

// ── GOG Achievements ──────────────────────────────────────────────────────────

ipcMain.handle('fetch-gog-achievements', async (_, appId) => {
    const token = await getGogToken();
    if (!token) return { ok: false, error: 'not_logged_in' };
    const userId = db.prepare("SELECT value FROM settings WHERE key='gog_user_id'").get()?.value;
    if (!userId) return { ok: false, error: 'no_user_id' };
    try {
        const data = await gogFetch(
            `https://gameplay.gog.com/clients/${appId}/users/${userId}/achievements`, token
        );
        const items = data.items || [];
        const upsert = db.prepare(`
            INSERT OR REPLACE INTO achievements
            (app_id, key, name, description, image_locked, image_unlocked, date_unlocked, visible)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const tx = db.transaction(list => {
            for (const a of list) {
                upsert.run(
                    appId,
                    a.achievement_key,
                    a.name,
                    a.description,
                    a.image_url_locked,
                    a.image_url_unlocked,
                    a.date_unlocked || null,
                    a.visible === false ? 0 : 1
                );
            }
        });
        tx(items);

        // Mirror to shared DB so CNGM / CREMA can read without opening GRINDER's DB
        try {
            const sharedDbPath = path.join(appImageDir, 'GameManagerConfig', 'games.db');
            if (fs.existsSync(sharedDbPath)) {
                const sdb = new Database(sharedDbPath);
                sdb.exec(`CREATE TABLE IF NOT EXISTS achievements (
                    app_id TEXT NOT NULL, key TEXT NOT NULL, name TEXT,
                    description TEXT, image_locked TEXT, image_unlocked TEXT,
                    date_unlocked TEXT, visible INTEGER DEFAULT 1,
                    PRIMARY KEY (app_id, key)
                )`);
                const sup = sdb.prepare(`INSERT OR REPLACE INTO achievements
                    (app_id, key, name, description, image_locked, image_unlocked, date_unlocked, visible)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
                const stx = sdb.transaction(list => {
                    for (const a of list) sup.run(
                        appId, a.achievement_key, a.name, a.description,
                        a.image_url_locked, a.image_url_unlocked, a.date_unlocked || null,
                        a.visible === false ? 0 : 1
                    );
                });
                stx(items);
                sdb.close();
            }
        } catch {}

        return { ok: true, count: items.length };
    } catch (e) { return { ok: false, error: e.message }; }
});

ipcMain.handle('get-gog-achievements', (_, appId) => {
    try {
        const rows = db.prepare(
            "SELECT * FROM achievements WHERE app_id = ? ORDER BY date_unlocked DESC, name COLLATE NOCASE"
        ).all(appId);
        return { ok: true, achievements: rows };
    } catch (e) { return { ok: false, error: e.message }; }
});

// After gogdl installs, find the actual game subfolder and primary exe
// Detect a successful GOG install by reading the metadata gogdl leaves behind.
// Windows games: goggame-<id>.info  →  play tasks include the primary executable.
// Linux native:  .gogdl-linux-manifest  →  no .info file; scan dir for launcher.
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

// Heuristic: find the primary executable in a Linux GOG game directory.
// Prefers .sh launchers, then executable binaries matching the folder name,
// then any executable binary at the root.
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

let activeGogInstallProc = null;

ipcMain.handle('gogdl-install', (event, appId, platform, installDir, isDlc = false, baseAppId = null) => {
    if (activeGogInstallProc) return { ok: false, error: 'An installation is already in progress.' };
    const gogdl = findGogdl();
    if (!gogdl) return { ok: false, error: 'gogdl not found. Place the gogdl binary in the same folder as GRINDER.AppImage.' };

    const dir = expandTilde(installDir) || path.join(HOME, 'Games', 'CafeNeurotico');

    // For DLCs the user selects the base game's install folder.
    // gogdl --path expects the PARENT of the game folder; we pass dirname(dir).
    // We download using the base game's app_id and --dlcs <dlc_id> so gogdl
    // knows how to merge the DLC into the existing installation correctly.
    const gogdlPath  = isDlc ? path.dirname(dir) : dir;
    const downloadId = isDlc && baseAppId ? baseAppId : appId;
    if (!isDlc) { try { fs.mkdirSync(dir, { recursive: true }); } catch {} }

    // Snapshot subdirectories before gogdl runs so findGogInstallResult can
    // skip pre-existing Linux-native game folders (avoids metadata cross-contamination).
    let preExistingDirs;
    try {
        preExistingDirs = new Set(
            fs.readdirSync(dir, { withFileTypes: true })
              .filter(e => e.isDirectory()).map(e => e.name)
        );
    } catch { preExistingDirs = new Set(); }

    // Ensure the binary is executable
    try { fs.chmodSync(gogdl, '755'); } catch {}

    // Clear cached manifest so gogdl does a fresh file comparison
    const manifestPath = path.join(configDir, 'gogdl', 'manifests', downloadId);
    try { fs.rmSync(manifestPath, { force: true }); } catch {}

    const authPath = writeGogAuthConfig();
    const send = d => { try { event.sender.send('gog-install-progress', String(d)); } catch {} };

    return new Promise(resolve => {
        const args = [
            '--auth-config-path', authPath,
            'download', downloadId,
            '--platform', platform,
            '--path',     gogdlPath,
            '--lang',     'en-US',
        ];
        if (isDlc && baseAppId) { args.push('--dlcs', appId); args.push('--dlc-only'); }
        else if (isDlc)         args.push('--dlc-only');
        send(`Running: gogdl download ${downloadId} --platform ${platform} --path ${gogdlPath}${isDlc ? ` --dlcs ${appId} --dlc-only` : ''}\n`);

        activeGogInstallProc = spawn(gogdl, args, {
            stdio: ['ignore', 'pipe', 'pipe'],
            // Point gogdl to GRINDER's own config dir so manifests don't
            // collide with Heroic's cached manifests causing false "Nothing to do"
            env: { ...process.env, GOGDL_CONFIG_PATH: configDir },
        });

        activeGogInstallProc.stdout.on('data', send);
        activeGogInstallProc.stderr.on('data', send);
        activeGogInstallProc.on('close', async code => {
            activeGogInstallProc = null;
            try { fs.unlinkSync(authPath); } catch {}

            if (isDlc) {
                // DLCs merge into the existing base game folder — no new subfolder to scan.
                // Success is determined solely by exit code.
                resolve({ ok: code === 0, exitCode: code, install_dir: dir,
                          gameInfo: code === 0 ? { install_path: dir, executable: null } : null });
                return;
            }

            const gameInfo = code === 0 ? findGogInstallResult(dir, appId, preExistingDirs) : null;
            const ok = code === 0 && gameInfo !== null;

            if (ok) {
                // Auto-install compatibility files right after a successful GOG install
                const game = db.prepare("SELECT * FROM games WHERE app_id=? AND store='gog'").get(appId);
                if (game) {
                    const prefixPath = expandTilde(game.prefix_path) || (() => {
                        const safeName = (game.title || game.id).replace(/[/\\:*?"<>|]/g, '').trim().slice(0, 64) || game.id;
                        return path.join(prefixesDir, safeName);
                    })();
                    const protonPath = game.proton_path
                        || db.prepare("SELECT value FROM settings WHERE key='default_proton_path'").get()?.value;
                    send('\n─── Auto-installing compatibility files ───\n');
                    await runRedist(event.sender, 'gog-install-progress', appId, platform, prefixPath, protonPath);
                }
            }

            resolve({ ok, exitCode: code, install_dir: dir, gameInfo,
                      error: code === 0 && !gameInfo
                          ? 'gogdl exited without downloading any files. The game may not support this platform or the manifest is cached incorrectly. Try verifying your GOG login.'
                          : undefined });
        });
        activeGogInstallProc.on('error', e => {
            activeGogInstallProc = null;
            send(`\nSpawn error: ${e.message}\n`);
            resolve({ ok: false, error: e.message });
        });
    });
});

ipcMain.handle('gogdl-cancel-install', () => {
    if (!activeGogInstallProc) return { ok: false };
    activeGogInstallProc.kill('SIGTERM');
    activeGogInstallProc = null;
    return { ok: true };
});

ipcMain.handle('gogdl-repair', (event, gameId) => {
    if (activeGogInstallProc) return { ok: false, error: 'An installation is already in progress.' };
    const game = db.prepare('SELECT * FROM games WHERE id=?').get(gameId);
    if (!game) return { ok: false, error: 'Game not found.' };
    const installPath = expandTilde(game.install_path || '');
    if (!installPath || !fs.existsSync(installPath))
        return { ok: false, error: 'Install path not found. Is the game installed?' };

    const gogdl = findGogdl();
    if (!gogdl) return { ok: false, error: 'gogdl not found.' };
    try { fs.chmodSync(gogdl, '755'); } catch {}

    // gogdl --path expects the parent of the game folder (same as at install time)
    const gogdlPath = path.dirname(installPath);
    const platform  = game.platform || 'windows';
    const authPath  = writeGogAuthConfig();
    const send = d => { try { event.sender.send('gog-install-progress', String(d)); } catch {} };

    return new Promise(resolve => {
        send(`Running: gogdl download ${game.app_id} --platform ${platform} --path ${gogdlPath}\n`);
        activeGogInstallProc = spawn(gogdl, [
            '--auth-config-path', authPath,
            'download', String(game.app_id),
            '--platform', platform,
            '--path', gogdlPath,
            '--lang', 'en-US',
        ], {
            stdio: ['ignore', 'pipe', 'pipe'],
            env: { ...process.env, GOGDL_CONFIG_PATH: configDir },
        });
        activeGogInstallProc.stdout.on('data', send);
        activeGogInstallProc.stderr.on('data', send);
        activeGogInstallProc.on('close', code => {
            activeGogInstallProc = null;
            try { fs.unlinkSync(authPath); } catch {}
            resolve({ ok: code === 0, exitCode: code });
        });
        activeGogInstallProc.on('error', e => {
            activeGogInstallProc = null;
            try { fs.unlinkSync(authPath); } catch {}
            send(`\nSpawn error: ${e.message}\n`);
            resolve({ ok: false, error: e.message });
        });
    });
});

ipcMain.handle('legendary-repair', (event, gameId) => {
    if (activeInstallProc) return { ok: false, error: 'An installation is already in progress.' };
    const game = db.prepare('SELECT * FROM games WHERE id=?').get(gameId);
    if (!game) return { ok: false, error: 'Game not found.' };

    const leg = findLegendary();
    if (!leg) return { ok: false, error: 'legendary not found.' };

    const send = d => { try { event.sender.send('install-progress', String(d)); } catch {} };

    return new Promise(resolve => {
        send(`Running: legendary install ${game.app_id} --repair\n`);
        activeInstallProc = spawn(leg, ['install', game.app_id, '--repair', '-y'], {
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        activeInstallProc.stdout.on('data', send);
        activeInstallProc.stderr.on('data', send);
        activeInstallProc.on('close', code => {
            activeInstallProc = null;
            resolve({ ok: code === 0, exitCode: code });
        });
        activeInstallProc.on('error', e => {
            activeInstallProc = null;
            send(`\nSpawn error: ${e.message}\n`);
            resolve({ ok: false, error: e.message });
        });
    });
});

// umu-run installer — tries pipx first, falls back to pip --user
ipcMain.handle('install-umu', (event) => {
    const pipx = which('pipx');
    const pip  = which('pip3') || which('pip');

    if (!pipx && !pip) {
        return { ok: false, error: 'Neither pipx nor pip found. Install pipx first:\n  Fedora: sudo dnf install pipx\n  Debian/Ubuntu: sudo apt install pipx\n  Arch: sudo pacman -S python-pipx' };
    }

    const cmd  = pipx || pip;
    const args = pipx ? ['install', 'umu-launcher'] : ['install', '--user', 'umu-launcher'];

    return new Promise(resolve => {
        const proc = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });

        const send = (data) => {
            try { event.sender.send('umu-install-progress', String(data)); } catch {}
        };

        proc.stdout.on('data', send);
        proc.stderr.on('data', send);
        proc.on('close', code => resolve({ ok: code === 0, exitCode: code, method: pipx ? 'pipx' : 'pip --user' }));
        proc.on('error', err => resolve({ ok: false, error: err.message }));
    });
});
