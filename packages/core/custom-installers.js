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
            hint: 'On the Releases page, download the Windows zip — it is named like ironwail-0.8.2-win64.zip.',
        },
        archive: /ironwail.*\.(zip|7z)$/i,
        samples: ['ironwail-0.8.2-win64.zip'],
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
            hint: 'On the Releases page, download the Windows zip — it is named like vkQuake-1.35.0_windows_x64.zip.',
        },
        archive: /vkquake(?![-_]rt).*\.(zip|7z)$/i,
        samples: ['vkQuake-1.35.0_windows_x64.zip'],
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
        archive: /(quake[-_]rt|vkquake[-_]rt).*\.(zip|7z)$/i,
        samples: ['quake-rt-1_0_1.zip'],
        dirName: 'Quake Ray Traced',
        entry: { exe: /^(vkquake|quake[-_]?rt)\.exe$/i, platform: 'windows' },
        data: 'quake',
    },
    {
        id: 'gzdoom',
        title: 'GZDoom',
        kind: 'Source port',
        game: 'Doom',
        blurb: 'The Doom engine everything else is built on — mouselook, high resolutions, and the engine nearly every Doom mod expects.',
        source: {
            name: 'GitHub — ZDoom/gzdoom',
            url: 'https://github.com/ZDoom/gzdoom/releases/latest',
            hint: 'On the Releases page, download the Windows zip — it is named like gzdoom-4-14-2-windows.zip.',
        },
        archive: /gzdoom.*\.(zip|7z)$/i,
        samples: ['gzdoom-4-14-2-windows.zip'],
        dirName: 'GZDoom',
        entry: { exe: /^gzdoom\.exe$/i, platform: 'windows' },
        data: 'doom',
    },
    {
        id: 'uzdoom',
        title: 'UZDoom',
        kind: 'Source port',
        game: 'Doom',
        blurb: 'A fork of GZDoom made in late 2025, continuing the same 4.x line. Same command line and the same mods — GZDoom still has the larger ecosystem, so either works.',
        source: {
            name: 'GitHub — UZDoom/UZDoom',
            url: 'https://github.com/UZDoom/uzdoom/releases/latest',
            hint: 'On the Releases page, download the Windows zip — it is named like Windows-UZDoom-4.14.3.zip.',
        },
        archive: /uzdoom.*\.(zip|7z)$/i,
        samples: ['Windows-UZDoom-4.14.3.zip'],
        dirName: 'UZDoom',
        entry: { exe: /^uzdoom\.exe$/i, platform: 'windows' },
        data: 'doom',
    },
    {
        id: 'minidoom2',
        title: 'Mini Doom 2',
        kind: 'Fan game',
        game: '',
        blurb: 'A standalone Doom-flavoured action platformer. Complete in itself — no Doom data needed.',
        source: {
            name: 'ModDB — Mini Doom 2',
            url: 'https://www.moddb.com/games/mini-doom-2/downloads',
            hint: 'Download the Windows build; the file is named like miniDoom2 v3-1.zip.',
        },
        archive: /^minidoom[\s_-]*2.*\.(zip|7z|rar)$/i,
        samples: ['miniDoom2 v3-1.zip'],
        dirName: 'Mini Doom 2',
        entry: { exe: /^mini\s*doom[\s_-]*2.*\.exe$/i, platform: 'windows' },
        data: null,
    },
    {
        id: 'minidoom1',
        title: 'Mini Doom',
        kind: 'Fan game',
        game: '',
        blurb: 'The original standalone Mini Doom. Complete in itself — no Doom data needed.',
        source: {
            name: 'ModDB — MiniDoom',
            url: 'https://www.moddb.com/games/mini-doom/downloads',
            hint: 'Download the Windows build; the file is named like MiniDoom_v1_3.zip.',
        },
        // The lookahead is load-bearing: without it this also matched miniDoom2's download
        // and installed the sequel under the first game's name, which is exactly what
        // happened. Two recipes whose patterns overlap silently mislabel each other.
        archive: /^minidoom(?![\s_-]*2).*\.(zip|7z|rar)$/i,
        samples: ['MiniDoom_v1_3.zip'],
        dirName: 'Mini Doom',
        entry: { exe: /^mini\s*doom(?![\s_-]*2).*\.exe$/i, platform: 'windows' },
        data: null,
    },
    // ── Mods ────────────────────────────────────────────────────────────────
    // These are what people actually want to play. Nobody sets out to install GZDoom;
    // they set out to install Brutal Doom, and the engine is a means to that end. So a
    // mod recipe owns its whole stack: it will install the engine for you if you have
    // not got one, link the IWAD out of your library, and register itself as its own
    // library entry carrying the -file line that loads it. The engine is shared rather
    // than copied per mod, because that is how GZDoom is designed to work.
    {
        id: 'brutaldoom',
        title: 'Brutal Doom',
        kind: 'Mod',
        game: 'Doom',
        engine: ['gzdoom', 'uzdoom'],
        blurb: 'The famous overhaul — reworked weapons, gore and enemy behaviour, on top of the original maps.',
        source: {
            name: 'ModDB — Brutal Doom',
            url: 'https://www.moddb.com/mods/brutal-doom/downloads',
            hint: 'Download the latest release; the file is named like brutalv22.zip, and a bare .pk3 works too.',
        },
        // Excludes Black Edition, whose download is also called Brutal_Doom_something.
        // Sibling recipes must be mutually exclusive or they silently mislabel each other.
        archive: /^brutal(?!.*black).*\.(zip|7z|rar|pk3)$/i,
        samples: ['brutalv22.zip', 'brutal22test6.zip', 'brutalv21.pk3'],
        modFile: /\.(pk3|wad)$/i,
        dirName: 'Brutal Doom',
        iwad: /^doom2\.wad$/i,
        data: 'doom',
    },
    {
        id: 'brutaldoom-black',
        title: 'Brutal Doom: Black Edition',
        kind: 'Mod',
        game: 'Doom',
        engine: ['gzdoom', 'uzdoom'],
        blurb: 'A darker, heavily reworked take on Brutal Doom, with its own lighting and effects.',
        source: {
            name: 'ModDB — Brutal Doom: Black Edition',
            url: 'https://www.moddb.com/mods/brutal-doom/downloads/brutal-doom-v20b-black-edition',
            hint: 'Download the latest release; the file is named like BDBE_v3.5.zip.',
        },
        archive: /^(bdbe|brutal.*black).*\.(zip|7z|rar|pk3)$/i,
        samples: ['Brutal_Doom_Black_Edition.52.zip'],
        modFile: /\.(pk3|wad)$/i,
        dirName: 'Brutal Doom Black Edition',
        iwad: /^doom2\.wad$/i,
        data: 'doom',
    },
    // A shape rather than a title, and honest about it. There is no single "DOOM Ultra HD"
    // download — HD texture work is spread across DHTP, Hoover1979's pack, brightmap and
    // sprite projects, and most people end up with an assembled folder of numbered .pk3s.
    // A recipe naming one of those would be pretending to a precision it does not have, so
    // this one accepts any Doom mod archive, shows what is inside, and lets the user choose
    // and order what loads. Excluded from filename detection because it would otherwise
    // claim every archive; it only ever runs when the user picks it deliberately.
    {
        id: 'doom-mod',
        title: 'Any Doom mod or texture pack',
        kind: 'Mod',
        game: 'Doom',
        engine: ['gzdoom', 'uzdoom'],
        generic: true,
        blurb: 'For anything else that loads into GZDoom or UZDoom — HD texture packs like DHTP, brightmaps, sprite fixes, map sets. Pick the archive and choose which .pk3 and .wad files to load; several can be stacked and they load in name order.',
        source: {
            name: 'ModDB — Doom mods',
            url: 'https://www.moddb.com/games/doom/mods',
            hint: 'Any .zip, .7z, .rar, .pk3 or .wad. You will be shown everything loadable inside it and can tick as many as you want.',
        },
        archive: /\.(zip|7z|rar|pk3|wad)$/i,
        modFile: /\.(pk3|wad)$/i,
        dirName: 'Doom Mods',
        data: 'doom',
    },
    // Not a title but a shape. Every OpenBOR game is the same engine renamed, sitting
    // beside Paks/<game>.pak — so one recipe covers all of them, and the archive is
    // identified by what is inside rather than by whatever the download was called.
    // This is the same argument that made native DOSBox worth supporting: one engine,
    // one rigid layout, nothing to curate per game.
    {
        id: 'openbor',
        title: 'OpenBOR game',
        kind: 'OpenBOR',
        game: '',
        dynamic: true,
        blurb: 'Any OpenBOR game — Streets of Rage X, Streets of Vendetta and the rest. Drop in the archive you downloaded and the name is taken from the game itself.',
        source: {
            name: 'ChronoCrash — the OpenBOR community',
            url: 'https://www.chronocrash.com/forum/resources/',
            hint: 'Download the Windows build of any OpenBOR game — a zip or rar containing the game exe and a Paks folder.',
        },
        archive: /\.(zip|7z|rar)$/i,
        contains: { pak: /(^|\/)Paks\/[^/]+\.pak$/i },
        dirName: 'OpenBOR',
        entry: { exe: /\.exe$/i, platform: 'windows' },
        data: null,
        category: 'OpenBOR',
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

        // The soundtrack, from a *different* product. The 1996 release keeps its music on
        // the CD, which is why GLQuake is silent and why every port ships a note about
        // needing external tracks. The 2021 re-release ships the same music as ogg — so a
        // player who owns both (very common: GOG bundles them) already has, legitimately
        // on disk, exactly the files these engines want.
        //
        // Not a nicety: vkQuake-RT refuses to start cleanly without id1/music/track02..11
        // and offers to go copy them out of a Steam install. Providing them up front is
        // the difference between a clean launch and a dialog the user has to interpret.
        extras: [{
            id: 'quake-music',
            label: 'Quake soundtrack (from the re-release)',
            titles: [/quake.*enhanced|enhanced.*quake|quake.*re-?release/i],
            // Both the GOG re-release layout (id1/music) and Steam's (rerelease/id1/music).
            roots: ['', 'rerelease'],
            subdir: 'music',
            match: /^track\d+\.ogg$/i,
        }],
    },

    // Named by file rather than by folder: every storefront nests the IWAD somewhere
    // different (GOG's classic releases put it at the root, the 2024 re-release hides it
    // under rerelease/), and they move it between releases. Searching for the file itself
    // is what lets one spec survive all of those layouts.
    doom: {
        label: 'Doom or Doom II',
        files: [{ find: /^(doom|doom2|doomu|tnt|plutonia)\.wad$/i, into: '' }],
        requireAny: true,
        titles: [/^(the ultimate )?doom$/i, /^doom \+ doom ii/i, /^doom ii/i, /^final doom$/i, /^doom (i|ii) enhanced$/i, /^doom$/i],
        exclude: [/doom 3|doom 64|eternal|dark ages|\(2016\)|resurrection|phobos|akalabeth/i],
        owned: 'You own Doom but it is not installed. Install it first and this will find the IWAD automatically.',
    },
};

// ── Catalogue self-check ─────────────────────────────────────────────────────
// Two mistakes have cost real installs here, and both were invisible at the time: a
// pattern that also matched a sibling's download (Mini Doom 2 installed as Mini Doom;
// Black Edition matching Brutal Doom too), and a pattern anchored to an asset name that
// was guessed rather than checked (UZDoom ships Windows-UZDoom-4.14.3.zip, so /^uzdoom/
// rejected the only file it was meant to accept).
//
// So every recipe carries `samples` — filenames actually observed from that project —
// and this asserts each one matches its own recipe and nothing else. Run it whenever a
// recipe is added or a pattern changed.
function selfCheck() {
    const problems = [];
    for (const r of RECIPES) {
        if (r.contains || r.generic) continue;        // matched on content or chosen deliberately
        if (!r.samples || !r.samples.length) { problems.push(`${r.id}: no samples to check`); continue; }
        for (const s of r.samples) {
            const m = detectRecipe(s);
            if (!m.includes(r.id))  problems.push(`${r.id}: its own sample "${s}" does not match its pattern`);
            if (m.length > 1)       problems.push(`"${s}" matches several recipes: ${m.join(' + ')}`);
        }
    }
    return problems;
}

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

// List an archive without unpacking it, so a download can be identified by what is inside
// rather than by what someone named the file. OpenBOR needs this: every one of its games is
// a differently-named archive around an identical layout.
function inspectArchive(archivePath) {
    const bsdtar = which('bsdtar');
    if (bsdtar) {
        const r = spawnSync(bsdtar, ['-tf', archivePath], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
        if (r.status === 0) return r.stdout.split('\n').filter(Boolean);
    }
    const unzip = which('unzip');
    if (unzip && path.extname(archivePath).toLowerCase() === '.zip') {
        const r = spawnSync(unzip, ['-Z1', archivePath], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
        if (r.status === 0) return r.stdout.split('\n').filter(Boolean);
    }
    return [];
}

// Depth-limited recursive search for data files. Used by the specs that name a file
// (DOOM.WAD) rather than a folder, because storefronts nest those differently and often
// move them between releases — searching is what makes one spec survive all the layouts.
function findFiles(root, pattern, maxDepth = 4) {
    const out = [];
    const walk = (dir, depth) => {
        let entries = [];
        try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
        for (const e of entries) {
            const p = path.join(dir, e.name);
            if (e.isFile() && pattern.test(e.name)) out.push(p);
            else if (e.isDirectory() && depth < maxDepth) walk(p, depth + 1);
        }
    };
    walk(root, 0);
    return out;
}

// Depth-limited hunt for the entry point. Shallow on purpose — an .exe buried four levels
// down is a redistributable or a tool, not the game.
// The executable that lives beside a marker directory. OpenBOR's engine is renamed to the
// game, so position is the only thing that identifies it.
function findEntryBesideDir(root, dirPattern, exePattern, maxDepth = 3) {
    const walk = (dir, depth) => {
        let entries = [];
        try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return ''; }
        if (entries.some(e => e.isDirectory() && dirPattern.test(e.name))) {
            const exe = entries.find(e => e.isFile() && exePattern.test(e.name));
            if (exe) return path.join(dir, exe.name);
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
        source: r.source, dirName: r.dirName, dynamic: !!r.dynamic, generic: !!r.generic,
        data: r.data ? { id: r.data, label: DATA_SPECS[r.data]?.label || r.data } : null,
    }));
}

function getRecipe(id) { return RECIPES.find(r => r.id === id) || null; }

// Which recipe does this download belong to? Returned as a list because a user could
// plausibly have a file that two recipes would both accept.
// Shape-based recipes are excluded: their archive pattern is deliberately "any archive",
// so including them here would have every download claimed by OpenBOR. Those are matched
// by content at install time instead.
function detectRecipe(fileName) {
    const base = path.basename(String(fileName || ''));
    return RECIPES.filter(r => !r.contains && !r.generic && r.archive.test(base)).map(r => r.id);
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

    const required = (spec.dirs || []).filter(d => d.required);
    const hits = [];
    for (const g of named.filter(g => g.installed && g.install_path)) {
        const root = g.install_path;
        // Folder-shaped spec: every required folder must exist and hold its proving file.
        const dirsOk = required.length
            ? required.every(d => {
                const dir = resolveCaseInsensitive(root, d.name);
                return dir && dirHasProbe(dir, d.probe);
            })
            : true;
        // File-shaped spec: at least one of the named files must turn up somewhere inside.
        const filesOk = spec.files
            ? spec.files.some(f => findFiles(root, f.find).length > 0)
            : true;
        if (dirsOk && filesOk) hits.push({ path: root, title: g.title });
    }
    // File-shaped specs take from *every* matching product rather than the first, so
    // owning Ultimate Doom, Final Doom and both Enhanced releases puts doom.wad, doom2.wad,
    // tnt.wad and plutonia.wad side by side and the engine can offer the choice.
    if (hits.length) {
        return spec.files
            ? { ok: true, path: hits[0].path, paths: hits.map(h => h.path), title: hits.map(h => h.title).join(', ') }
            : { ok: true, path: hits[0].path, paths: [hits[0].path], title: hits[0].title };
    }

    const owned = named.map(g => g.title);
    if (owned.length) return { ok: false, owned, message: spec.owned || 'Install it first.' };
    return { ok: false, message: `No copy of ${spec.label} found in your library.` };
}

// A second product in the library that can contribute optional files — the re-release's
// ogg soundtrack being the case this exists for. Returns null when nothing suitable is
// installed, which is never an error: the port still works, it is just quieter.
function resolveExtra(extra, rows) {
    for (const g of (rows || [])) {
        if (!g.installed || !g.install_path) continue;
        if (!extra.titles.some(rx => rx.test(String(g.title || '')))) continue;
        for (const rel of extra.roots) {
            const base = rel ? resolveCaseInsensitive(g.install_path, rel) : g.install_path;
            if (!base) continue;
            // Confirm by looking for the files themselves under a known dir, not by trusting
            // the layout: the two storefronts nest this differently.
            const id1 = resolveCaseInsensitive(base, 'id1');
            const music = id1 && resolveCaseInsensitive(id1, extra.subdir);
            if (music && dirHasProbe(music, extra.match)) return { path: base, title: g.title };
        }
    }
    return null;
}

// Link the data into the port's own folder rather than pointing the engine at the original
// install. Symlinking the pak files (not the folders) means the port writes its configs and
// saves into its own id1/ while the multi-gigabyte data stays in one place — and the game
// CN installed for you is never written into by something else.
function linkGameData(dataId, sourceRoot, targetRoot, extraSource) {
    const spec = DATA_SPECS[dataId];
    if (!spec) return { ok: false, error: `Unknown data requirement "${dataId}".` };

    const roots = Array.isArray(sourceRoot) ? sourceRoot : [sourceRoot];
    const link = (from, to) => {
        try { fs.unlinkSync(to); } catch {}
        fs.symlinkSync(from, to);
    };

    const linked = [];

    // File-shaped specs: link each named file it finds beside the executable, which is
    // where these engines look. Deduplicated by target name across every source, so
    // owning four Doom products does not produce four fights over doom.wad.
    const seen = new Set();
    for (const f of (spec.files || [])) {
        for (const root of roots) {
            for (const found of findFiles(root, f.find)) {
                const name = path.basename(found).toLowerCase();
                if (seen.has(name)) continue;
                seen.add(name);
                const dstDir = path.join(targetRoot, f.into || '');
                fs.mkdirSync(dstDir, { recursive: true });
                link(found, path.join(dstDir, name));
                linked.push(name);
            }
        }
    }
    if (spec.requireAny && !linked.length) {
        return { ok: false, error: `No ${spec.label} data files were found in ${sourceRoot}.` };
    }

    const extra = spec.extras && spec.extras[0];
    for (const d of (spec.dirs || [])) {
        const src = resolveCaseInsensitive(sourceRoot, d.name);
        if (!src || !dirHasProbe(src, d.probe)) {
            if (d.required) return { ok: false, error: `${sourceRoot} has no ${d.name}/ with the expected data.` };
            continue;
        }
        const dst = path.join(targetRoot, d.name);   // lowercase: what engines ask for
        fs.mkdirSync(dst, { recursive: true });
        for (const f of fs.readdirSync(src)) {
            if (!/\.pak$/i.test(f)) continue;
            link(path.join(src, f), path.join(dst, f.toLowerCase()));
        }
        linked.push(d.name);

        // Same episode folder, other product: id1's music comes from the re-release's id1,
        // hipnotic's from its hipnotic, and so on.
        if (!extraSource || !extra) continue;
        const eDir = resolveCaseInsensitive(extraSource.path, d.name);
        const eMusic = eDir && resolveCaseInsensitive(eDir, extra.subdir);
        if (!eMusic) continue;
        const mDst = path.join(dst, extra.subdir);
        fs.mkdirSync(mDst, { recursive: true });
        let n = 0;
        for (const f of fs.readdirSync(eMusic)) {
            if (!extra.match.test(f)) continue;
            link(path.join(eMusic, f), path.join(mDst, f.toLowerCase()));
            n++;
        }
        if (n) linked.push(`${d.name}/${extra.subdir} (${n})`);
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

    // Shape-based recipes are identified by what is inside, because the filename carries
    // nothing: every OpenBOR game is a differently-named archive around the same layout.
    // The game's own name comes from the pak, which is the only place it is written down.
    let title = recipe.title;
    let dirName = recipe.dirName;
    let key = recipe.id;
    if (recipe.contains) {
        const entries = inspectArchive(archivePath);
        if (!entries.length) return { ok: false, error: 'Could not read that archive. Install bsdtar (libarchive) if it is a .rar.' };
        const pak = entries.find(e => recipe.contains.pak.test(e));
        if (!pak) return { ok: false, error: `That archive does not look like an OpenBOR game — it has no Paks folder inside. ${recipe.source.hint}` };
        title = path.basename(pak).replace(/\.pak$/i, '').replace(/[_]+/g, ' ').trim() || recipe.title;
        dirName = title.replace(/[/\\:*?"<>|]/g, '').trim().slice(0, 64) || recipe.dirName;
        key = `${recipe.id}_${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
    }

    // Resolve the data before unpacking anything: an install that cannot be played is
    // worse than a refusal, and this is the failure the user can actually act on.
    let data = null;
    if (recipe.data) {
        data = resolveGameData(recipe.data, dataRows);
        if (!data.ok) return { ok: false, error: data.message, owned: data.owned || [], needsData: recipe.data };
    }

    const target = path.join(installRoot, dirName);
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

    // For a shape-based recipe the entry point is defined by position, not by name: the
    // OpenBOR engine is renamed per game, so the only reliable rule is "the exe that sits
    // beside Paks/". A name-matching search would just pick the first .exe it tripped over.
    const exe = recipe.contains ? findEntryBesideDir(target, /^Paks$/i, recipe.entry.exe)
                                : findEntry(target, recipe.entry.exe);
    if (!exe) {
        return { ok: false, error: recipe.contains
            ? 'Unpacked, but no game executable was found next to the Paks folder.'
            : `Unpacked, but no matching executable was found inside. The download may be the wrong file.` };
    }

    let linked = null;
    let extra = null;
    if (recipe.data) {
        const spec = DATA_SPECS[recipe.data];
        if (spec && spec.extras) extra = resolveExtra(spec.extras[0], dataRows);
        // Link beside the executable — that is the engine's basedir, which is not always
        // the top of the archive.
        linked = linkGameData(recipe.data, data.paths || data.path, path.dirname(exe), extra);
        if (!linked.ok) return { ok: false, error: linked.error };
    }

    return {
        ok: true,
        recipeId: recipe.id,
        key,
        category: recipe.category || '',
        title,
        installPath: target,
        executable: path.relative(target, exe) || path.basename(exe),
        platform: recipe.entry.platform,
        dataFrom: data && data.ok ? { path: data.path, title: data.title, linked: linked.linked } : null,
        extraFrom: extra ? extra.title : null,
    };
}

// Install a mod alongside an engine that is already on disk. The engine is shared rather
// than copied per mod — that is how ZDoom-family ports are designed to work, and it keeps
// four Doom mods from meaning four copies of the same 50MB engine. Each mod still becomes
// its own library entry, distinguished by the -file line it carries.
// The loadable files inside a mod archive, read from the listing without unpacking. Mod
// packs routinely ship the mod plus a pile of optional extras — Black Edition's download
// carries the 199MB mod alongside thirty-odd alternate footstep and voice packs — so
// "take the first .pk3" picks a hero voice and produces something that installs cleanly
// and plays nothing. Which file is the mod is the user's call, not a heuristic's.
function listModCandidates(archivePath, recipe) {
    const bsdtar = which('bsdtar');
    if (!bsdtar) return [];
    const r = spawnSync(bsdtar, ['-tvf', archivePath], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
    if (r.status !== 0) return [];

    const out = [];
    for (const line of r.stdout.split('\n')) {
        if (!line.trim()) continue;
        // bsdtar -tvf: perms links owner group size <date fields> name
        const m = line.match(/^\S+\s+\d+\s+\S+\s+\S+\s+(\d+)\s+\S+\s+\S+\s+\S+\s+(.*)$/);
        if (!m) continue;
        const [, size, name] = m;
        if (name.endsWith('/') || !recipe.modFile.test(name)) continue;
        out.push({ rel: name, name: path.basename(name), dir: path.dirname(name), size: Number(size) });
    }
    return out.sort((a, b) => b.size - a.size);   // biggest first: the mod, then its extras
}

// The IWADs sitting beside the engine, with names a person recognises. Anything unknown
// is offered under its filename rather than hidden — a mod set can legitimately ship its
// own IWAD, and Freedoom is a real answer for someone who owns nothing.
const IWAD_LABELS = [
    [/^doom2\.wad$/i,        'Doom II: Hell on Earth'],
    [/^doomu\.wad$/i,        'The Ultimate Doom'],
    [/^doom\.wad$/i,         'Doom / The Ultimate Doom'],
    [/^doom1\.wad$/i,        'Doom (shareware)'],
    [/^tnt\.wad$/i,          'Final Doom: TNT Evilution'],
    [/^plutonia\.wad$/i,     'Final Doom: The Plutonia Experiment'],
    [/^freedoom2\.wad$/i,    'Freedoom: Phase 2'],
    [/^freedoom1?\.wad$/i,   'Freedoom: Phase 1'],
    [/^heretic\.wad$/i,      'Heretic'],
    [/^hexen\.wad$/i,        'Hexen'],
];

function listIwads(engineRoot) {
    let names = [];
    try { names = fs.readdirSync(engineRoot).filter(f => /\.wad$/i.test(f)); } catch { return []; }
    return names
        .map(file => {
            const hit = IWAD_LABELS.find(([rx]) => rx.test(file));
            return { file, label: hit ? hit[1] : file };
        })
        .sort((a, b) => a.label.localeCompare(b.label));
}

// launch_args is a shell-ish string because that is what the engine parses. Splitting it
// the same way lets the IWAD be changed after the fact without reinstalling the mod —
// swapping which Doom you play on should not mean re-extracting an 83MB pk3.
function parseArgs(str) {
    const out = [];
    let cur = '', inQ = false, q = '';
    for (const ch of String(str || '').trim()) {
        if (inQ) { if (ch === q) inQ = false; else cur += ch; }
        else if (ch === '"' || ch === "'") { inQ = true; q = ch; }
        else if (ch === ' ' || ch === '\t') { if (cur) { out.push(cur); cur = ''; } }
        else cur += ch;
    }
    if (cur) out.push(cur);
    return out;
}

const formatArgs = (arr) => arr.map(a => (/\s/.test(a) ? `"${a}"` : a)).join(' ');

// Replace, add or drop the -iwad in an existing launch line. An empty iwad removes it,
// which is what hands the choice back to the engine's own picker at every launch.
function withIwad(launchArgs, iwad) {
    const args = parseArgs(launchArgs);
    const out = [];
    for (let i = 0; i < args.length; i++) {
        if (args[i].toLowerCase() === '-iwad') { i++; continue; }   // drop flag and its value
        out.push(args[i]);
    }
    return formatArgs(iwad ? ['-iwad', iwad, ...out] : out);
}

const currentIwad = (launchArgs) => {
    const args = parseArgs(launchArgs);
    const i = args.findIndex(a => a.toLowerCase() === '-iwad');
    return i >= 0 && args[i + 1] ? args[i + 1] : '';
};

function installMod({ recipeId, archivePath, engineRoot, engineExe, dataRows, selected, iwad }) {
    const recipe = getRecipe(recipeId);
    if (!recipe) return { ok: false, error: `Unknown recipe "${recipeId}".` };
    if (!archivePath || !fs.existsSync(archivePath)) return { ok: false, error: 'That file no longer exists.' };
    if (!engineRoot || !fs.existsSync(engineRoot)) return { ok: false, error: 'The engine folder is missing — reinstall GZDoom or UZDoom.' };
    if (!recipe.archive.test(path.basename(archivePath))) {
        return { ok: false, error: `That file does not look like ${recipe.title}. ${recipe.source.hint}` };
    }

    // Which Doom to play on is asked at *launch*, not here — see _iwadForLaunch in the
    // renderer. It is a per-session decision, like picking a disc off a shelf, and asking
    // once at install time answers it for all time. The recipe's preference is written in
    // as the starting default so that dialog opens somewhere sensible.
    const iwads = listIwads(engineRoot);

    const candidates = (ext => ext === '.pk3' || ext === '.wad' ? [] : listModCandidates(archivePath, recipe))(path.extname(archivePath).toLowerCase());
    const needFiles = candidates.length > 1 && !(selected && selected.length) && !recipe.modAll;
    if (needFiles) {
        return { ok: false, choose: candidates, iwads: [], title: recipe.title };
    }

    // Its own folder under the engine, so two mods never fight over a filename and
    // removing one is just deleting a directory.
    const modsDir = path.join(engineRoot, 'mods', recipe.dirName);
    fs.rmSync(modsDir, { recursive: true, force: true });
    fs.mkdirSync(modsDir, { recursive: true });

    // A mod arrives either as the loadable file itself or as an archive around it.
    const ext = path.extname(archivePath).toLowerCase();
    let picked = [];
    if (ext === '.pk3' || ext === '.wad') {
        const dst = path.join(modsDir, path.basename(archivePath));
        fs.copyFileSync(archivePath, dst);
        picked = [dst];
    } else {
        if (!candidates.length) return { ok: false, error: `No .pk3 or .wad was found inside that archive. ${recipe.source.hint}` };

        const take0 = (selected && selected.length)
            ? candidates.filter(c => selected.includes(c.rel))
            : candidates;                      // single candidate, or modAll
        if (!take0.length) return { ok: false, error: 'None of the chosen files are in that archive.' };
        let take = take0;

        // Load order matters once several files are loaded together, and these packs are
        // conventionally numbered ("10 DHTP normal.pk3", "11 HD SFX.wad"), so honour that.
        take = [...take].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cn-mod-'));
        try {
            const bsdtar = which('bsdtar');
            if (!bsdtar) return { ok: false, error: 'No archive tool available. Install bsdtar (libarchive).' };
            // Extract only the chosen members — these archives run to hundreds of megabytes
            // and unpacking the other thirty addons to throw them away is pure waste.
            const res = spawnSync(bsdtar, ['-xf', archivePath, '-C', tmp, ...take.map(t => t.rel)], { encoding: 'utf8' });
            if (res.status !== 0) return { ok: false, error: `Could not unpack the mod: ${(res.stderr || '').trim().slice(0, 300)}` };

            for (const t of take) {
                const src = path.join(tmp, t.rel);
                if (!fs.existsSync(src)) continue;
                const dst = path.join(modsDir, t.name);
                fs.copyFileSync(src, dst);
                picked.push(dst);
            }
            if (!picked.length) return { ok: false, error: 'The chosen files could not be extracted from that archive.' };
        } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
    }

    // The user's choice wins; '' means they asked to be prompted at launch, so no -iwad
    // goes on the line and the engine's own picker handles it. With nothing chosen, fall
    // back to the recipe's preference, and to the engine's picker if even that is absent.
    const args = [];
    const chosen = iwad !== undefined
        ? iwad
        : (recipe.iwad ? (iwads.find(i => recipe.iwad.test(i.file))?.file || '') : '');
    if (chosen) args.push('-iwad', chosen);
    for (const f of picked) args.push('-file', path.relative(engineRoot, f));

    return {
        ok: true,
        recipeId: recipe.id,
        key: recipe.id,
        title: recipe.title,
        installPath: engineRoot,
        executable: engineExe,
        platform: 'windows',
        launchArgs: args.map(a => (/\s/.test(a) ? `"${a}"` : a)).join(' '),
        modFiles: picked.map(f => path.basename(f)),
        iwad: chosen,
        iwadLabel: chosen ? (iwads.find(i => i.file === chosen)?.label || chosen) : 'chosen at launch',
    };
}

module.exports = {
    RECIPES, DATA_SPECS, installMod, listModCandidates, listIwads,
    parseArgs, formatArgs, withIwad, currentIwad,
    listRecipes, getRecipe, detectRecipe, selfCheck,
    resolveGameData, resolveExtra, linkGameData, installFromArchive,
    findEntry, flattenSingleRoot, findExtractor,
};
