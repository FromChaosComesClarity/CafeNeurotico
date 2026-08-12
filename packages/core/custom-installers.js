// ── Custom installers ─────────────────────────────────────────────────────────
// Fan games, source ports and custom engines, installed from the file the user already
// downloaded. Deliberately a catalogue of *specific* recipes rather than one clever
// generic importer: the folders these projects ship are not consistent enough for a
// heuristic to get right, and getting it wrong is invisible. Brutal Doom is the example
// that settles the argument — the .bat beside gzdoom.exe carries the whole mod command
// line, so a generic "find the exe" importer launches vanilla Doom and looks like it
// worked.
//
// Two halves, and only the second one is ours to be clever about:
//   1. The port itself — the user downloads it. We say exactly where to get it and what
//      the file is called, then identify and unpack whatever they hand us.
//   2. The game data — this is the part worth automating. A source port is useless
//      without id1/pak0.pak, and the user very likely already owns Quake in the library
//      CN is already managing. We find it and wire it up rather than asking.
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

// ── The catalogue ────────────────────────────────────────────────────────────
// `archive` matches the file the user drops on us, so a mis-dropped download is caught
// before anything is unpacked. `entry` finds the executable inside whatever folder shape
// the project happens to ship this release. Both are deliberately loose on version
// numbers and tight on everything else.
const RECIPES = [
    {
        id: 'ironwail',
        title: 'Ironwail',
        kind: 'Source port',
        game: 'Quake',
        blurb: 'A fast, modern Quake engine — high frame rates, widescreen, and the original look kept intact.',
        source: {
            name: 'GitHub — andrei-drexler/ironwail',
            url: 'https://github.com/andrei-drexler/ironwail/releases/latest',
            hint: 'On the Releases page, download the Windows zip — it is named like ironwail-0.8.0-win64.zip.',
        },
        archive: /^ironwail.*\.(zip|7z)$/i,
        dirName: 'Ironwail',
        entry: { exe: /^ironwail\.exe$/i, platform: 'windows' },
        data: 'quake',
    },
    {
        id: 'vkquake',
        title: 'vkQuake',
        kind: 'Source port',
        game: 'Quake',
        blurb: 'Vulkan-based Quake port with modern rendering, water warp and scaling fixes.',
        source: {
            name: 'GitHub — Novum/vkQuake',
            url: 'https://github.com/Novum/vkQuake/releases/latest',
            hint: 'On the Releases page, download the Windows zip — it is named like vkquake-1.31.3_win64.zip.',
        },
        archive: /^vkquake.*\.(zip|7z)$/i,
        dirName: 'vkQuake',
        entry: { exe: /^vkquake\.exe$/i, platform: 'windows' },
        data: 'quake',
    },
    {
        id: 'quake-rt',
        title: 'Quake: Ray Traced',
        kind: 'Source port',
        game: 'Quake',
        blurb: 'Quake with full path tracing. Wants a ray-tracing capable GPU.',
        source: {
            name: 'GitHub — sultim-t/vkquake-rt',
            url: 'https://github.com/sultim-t/vkquake-rt/releases/latest',
            hint: 'On the Releases page, download the Windows zip — it is named like quake-rt-1_0_1.zip.',
        },
        archive: /^(quake[-_]rt|vkquake[-_]rt).*\.(zip|7z)$/i,
        dirName: 'Quake Ray Traced',
        entry: { exe: /^(vkquake|quake[-_]?rt)\.exe$/i, platform: 'windows' },
        data: 'quake',
    },
];

// ── Game data the ports need ─────────────────────────────────────────────────
// A data spec says which folders the engine expects and the file that proves a candidate
// folder is the real thing. Probing for the file rather than trusting the title is what
// makes this safe: a library row can be named anything, but only a genuine Quake install
// has id1/pak0.pak in it.
const DATA_SPECS = {
    quake: {
        label: 'Quake (the original 1996 release)',
        // Ports look for lowercase names; GOG ships Id1/PAK0.PAK. Resolution is
        // case-insensitive on both sides and the links we create use the lowercase
        // names the engines actually ask for.
        dirs: [
            { name: 'id1',      probe: /^pak0\.pak$/i, required: true },
            { name: 'hipnotic', probe: /^pak0\.pak$/i },   // Scourge of Armagon
            { name: 'rogue',    probe: /^pak0\.pak$/i },   // Dissolution of Eternity
        ],
        // Narrow the candidates by name, then confirm by probing. Quake Enhanced is
        // excluded on purpose: it is the KEX remaster and its data is not id1 paks.
        titles: [/^quake(:? the offering)?$/i, /^quake the offering/i],
        exclude: [/enhanced/i, /\bii\b|^quake ?2/i],
        owned: 'You own Quake but it is not installed. Install it first and this will find it automatically.',
    },
};

// ── Small helpers ────────────────────────────────────────────────────────────

function resolveCaseInsensitive(dir, name) {
    try {
        const hit = fs.readdirSync(dir, { withFileTypes: true })
            .find(e => e.name.toLowerCase() === String(name).toLowerCase());
        return hit ? path.join(dir, hit.name) : '';
    } catch { return ''; }
}

function dirHasProbe(dir, probe) {
    try { return fs.readdirSync(dir).some(f => probe.test(f)); }
    catch { return false; }
}

// bsdtar first: one binary that reads zip, 7z, rar and tar alike. unzip is the fallback
// and only covers zip — which is what every recipe here actually ships.
function findExtractor(archivePath) {
    const ext = path.extname(archivePath).toLowerCase();
    const bsdtar = which('bsdtar');
    if (bsdtar) return { cmd: bsdtar, args: (a, d) => ['-xf', a, '-C', d] };
    if (ext === '.zip') {
        const unzip = which('unzip');
        if (unzip) return { cmd: unzip, args: (a, d) => ['-q', '-o', a, '-d', d] };
    }
    return null;
}

function which(bin) {
    for (const dir of (process.env.PATH || '').split(path.delimiter)) {
        if (!dir) continue;
        const p = path.join(dir, bin);
        try { fs.accessSync(p, fs.constants.X_OK); return p; } catch {}
    }
    return '';
}

// Projects are inconsistent about whether the zip has a top-level folder. Collapse one if
// it is the only thing there, so every recipe below can assume a flat install directory.
function flattenSingleRoot(dir) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    if (entries.length !== 1 || !entries[0].isDirectory()) return;
    const inner = path.join(dir, entries[0].name);
    for (const name of fs.readdirSync(inner)) {
        fs.renameSync(path.join(inner, name), path.join(dir, name));
    }
    try { fs.rmdirSync(inner); } catch {}
}

// Depth-limited hunt for the entry point. Shallow on purpose — an .exe buried four levels
// down is a redistributable or a tool, not the game.
function findEntry(root, pattern, maxDepth = 3) {
    const walk = (dir, depth) => {
        let entries = [];
        try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return ''; }
        for (const e of entries) {
            if (e.isFile() && pattern.test(e.name)) return path.join(dir, e.name);
        }
        if (depth >= maxDepth) return '';
        for (const e of entries) {
            if (!e.isDirectory()) continue;
            const hit = walk(path.join(dir, e.name), depth + 1);
            if (hit) return hit;
        }
        return '';
    };
    return walk(root, 0);
}

// ── Public API ───────────────────────────────────────────────────────────────

function listRecipes() {
    return RECIPES.map(r => ({
        id: r.id, title: r.title, kind: r.kind, game: r.game, blurb: r.blurb,
        source: r.source, dirName: r.dirName,
        data: r.data ? { id: r.data, label: DATA_SPECS[r.data]?.label || r.data } : null,
    }));
}

function getRecipe(id) { return RECIPES.find(r => r.id === id) || null; }

// Which recipe does this download belong to? Returned as a list because a user could
// plausibly have a file that two recipes would both accept.
function detectRecipe(fileName) {
    const base = path.basename(String(fileName || ''));
    return RECIPES.filter(r => r.archive.test(base)).map(r => r.id);
}

// Find the user's own copy of the data a recipe needs.
//   { ok: true, path }                     → found, on disk, probed and confirmed
//   { ok: false, owned: [...], message }   → they own it but it is not installed
//   { ok: false, message }                 → nothing in the library matches
// `rows` is grinder.db's games table; passing it in keeps this module free of any
// database handle of its own.
function resolveGameData(dataId, rows) {
    const spec = DATA_SPECS[dataId];
    if (!spec) return { ok: false, message: `Unknown data requirement "${dataId}".` };

    const named = (rows || []).filter(g => {
        const t = String(g.title || '');
        if (spec.exclude && spec.exclude.some(rx => rx.test(t))) return false;
        return spec.titles.some(rx => rx.test(t));
    });

    const required = spec.dirs.filter(d => d.required);
    for (const g of named.filter(g => g.installed && g.install_path)) {
        const root = g.install_path;
        const ok = required.every(d => {
            const dir = resolveCaseInsensitive(root, d.name);
            return dir && dirHasProbe(dir, d.probe);
        });
        if (ok) return { ok: true, path: root, title: g.title };
    }

    const owned = named.map(g => g.title);
    if (owned.length) return { ok: false, owned, message: spec.owned || 'Install it first.' };
    return { ok: false, message: `No copy of ${spec.label} found in your library.` };
}

// Link the data into the port's own folder rather than pointing the engine at the original
// install. Symlinking the pak files (not the folders) means the port writes its configs and
// saves into its own id1/ while the multi-gigabyte data stays in one place — and the game
// CN installed for you is never written into by something else.
function linkGameData(dataId, sourceRoot, targetRoot) {
    const spec = DATA_SPECS[dataId];
    if (!spec) return { ok: false, error: `Unknown data requirement "${dataId}".` };

    const linked = [];
    for (const d of spec.dirs) {
        const src = resolveCaseInsensitive(sourceRoot, d.name);
        if (!src || !dirHasProbe(src, d.probe)) {
            if (d.required) return { ok: false, error: `${sourceRoot} has no ${d.name}/ with the expected data.` };
            continue;
        }
        const dst = path.join(targetRoot, d.name);   // lowercase: what engines ask for
        fs.mkdirSync(dst, { recursive: true });
        for (const f of fs.readdirSync(src)) {
            if (!/\.pak$/i.test(f)) continue;
            const link = path.join(dst, f.toLowerCase());
            try { fs.unlinkSync(link); } catch {}
            fs.symlinkSync(path.join(src, f), link);
        }
        linked.push(d.name);
    }
    return { ok: true, linked };
}

// Unpack a download into its own folder under `installRoot` and work out how to start it.
// Does not touch any database — the caller decides how to register the result.
function installFromArchive({ recipeId, archivePath, installRoot, dataRows, overwrite = false }) {
    const recipe = getRecipe(recipeId);
    if (!recipe) return { ok: false, error: `Unknown recipe "${recipeId}".` };
    if (!archivePath || !fs.existsSync(archivePath)) return { ok: false, error: 'That file no longer exists.' };

    if (!recipe.archive.test(path.basename(archivePath))) {
        return { ok: false, error: `That file does not look like ${recipe.title}. ${recipe.source.hint}` };
    }

    // Resolve the data before unpacking anything: an install that cannot be played is
    // worse than a refusal, and this is the failure the user can actually act on.
    let data = null;
    if (recipe.data) {
        data = resolveGameData(recipe.data, dataRows);
        if (!data.ok) return { ok: false, error: data.message, owned: data.owned || [], needsData: recipe.data };
    }

    const target = path.join(installRoot, recipe.dirName);
    if (fs.existsSync(target) && fs.readdirSync(target).length) {
        if (!overwrite) return { ok: false, error: `${target} already exists and is not empty.`, exists: true };
        fs.rmSync(target, { recursive: true, force: true });
    }
    fs.mkdirSync(target, { recursive: true });

    const ex = findExtractor(archivePath);
    if (!ex) return { ok: false, error: 'No archive tool available. Install bsdtar (libarchive) or unzip.' };
    const res = spawnSync(ex.cmd, ex.args(archivePath, target), { encoding: 'utf8' });
    if (res.status !== 0) {
        return { ok: false, error: `Could not unpack the archive: ${(res.stderr || '').trim().slice(0, 300)}` };
    }

    flattenSingleRoot(target);

    const exe = findEntry(target, recipe.entry.exe);
    if (!exe) {
        return { ok: false, error: `Unpacked, but no ${recipe.entry.exe.source.replace(/[\\^$]/g, '')} was found inside. The download may be the wrong file.` };
    }

    let linked = null;
    if (recipe.data) {
        // Link beside the executable — that is the engine's basedir, which is not always
        // the top of the archive.
        linked = linkGameData(recipe.data, data.path, path.dirname(exe));
        if (!linked.ok) return { ok: false, error: linked.error };
    }

    return {
        ok: true,
        recipeId: recipe.id,
        title: recipe.title,
        installPath: target,
        executable: path.relative(target, exe) || path.basename(exe),
        platform: recipe.entry.platform,
        dataFrom: data && data.ok ? { path: data.path, title: data.title, linked: linked.linked } : null,
    };
}

module.exports = {
    RECIPES, DATA_SPECS,
    listRecipes, getRecipe, detectRecipe,
    resolveGameData, linkGameData, installFromArchive,
    findEntry, flattenSingleRoot, findExtractor,
};
