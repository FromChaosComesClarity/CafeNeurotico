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

module.exports = {
    init, setDb, writeProgress,
    sanitizeLogName, expandTilde, resolvePathCaseInsensitive,
    which, findLegendary, findGogdl, findComet, findUmu, findWineCached, findRuntime,
};
