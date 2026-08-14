// ── Which monitor games open on (KDE / KWin) ─────────────────────────────────
// On a nested Wayland session nothing inside the game decides where its window lands —
// the compositor does. gamescope's --prefer-output belongs to its DRM backend, so under a
// normal KDE session it has no say either. KWin's own window rules do, and KWin can be
// told to re-read them over D-Bus, so this takes effect without a logout.
//
// One rule for every game rather than one per game, because umu gives every non-Steam
// title the same window class — steam_app_0 — deriving it from GAMEID, and GAMEID is what
// umu looks its compatibility fixes up by, so it is not ours to fake for the sake of a
// window rule.
//
// ⚠️ This is the only place Cafe Neurotico writes outside its own folder. It therefore
// touches exactly one rule, identified by a fixed id, and leaves every other rule in the
// file alone — including ones the user wrote by hand.
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const RULE_ID = 'cafeneurotico-game-display';
const RULE_DESC = 'Cafe Neurotico — open games on a chosen screen';
const WM_CLASS = 'steam_app_';          // every umu/Proton launch, matched as a substring
// Every key this rule owns — written together, and removed together when it is turned off.
const RULE_KEYS = ['Description', 'wmclass', 'wmclasscomplete', 'wmclassmatch', 'screen', 'screenrule'];

const rulesFile = () => path.join(os.homedir(), '.config', 'kwinrulesrc');

function which(bin) {
    for (const dir of (process.env.PATH || '').split(path.delimiter)) {
        if (!dir) continue;
        const p = path.join(dir, bin);
        try { fs.accessSync(p, fs.constants.X_OK); return p; } catch {}
    }
    return '';
}

// KDE only, and only when the tools to do it properly are present.
function isSupported() {
    const desktop = `${process.env.XDG_CURRENT_DESKTOP || ''} ${process.env.DESKTOP_SESSION || ''}`.toLowerCase();
    return desktop.includes('kde') && !!which('kscreen-doctor') && !!(which('kwriteconfig6') || which('kwriteconfig5'));
}

// The monitors KWin can place a window on, in the order KWin numbers them — which is the
// order kscreen reports, and what a rule's `screen` index refers to.
function listDisplays() {
    const kd = which('kscreen-doctor');
    if (!kd) return [];
    const r = spawnSync(kd, ['-j'], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
    if (r.status !== 0) return [];
    let data;
    try { data = JSON.parse(r.stdout); } catch { return []; }

    return (data.outputs || [])
        .filter(o => o.enabled)
        .map((o, i) => {
            const size = o.size || {};
            const pos = o.pos || {};
            const cur = (o.modes || []).find(m => String(m.id) === String(o.currentModeId));
            return {
                index: i,
                name: o.name || `Screen ${i + 1}`,
                // Resolution and refresh are how someone recognises which physical monitor
                // this is — the connector name alone tells them nothing.
                mode: size.width && size.height ? `${size.width}x${size.height}` : '',
                hz: cur && cur.refreshRate ? Math.round(cur.refreshRate) : null,
                type: o.type || '',
                x: pos.x ?? null, y: pos.y ?? null,
                // KWin numbers its screens in priority order; 1 is the primary.
                primary: o.priority === 1,
            };
        })
        .sort((a, b) => a.index - b.index);
}

// ── Reading and writing the rule ─────────────────────────────────────────────

function readRulesFile() {
    try { return fs.readFileSync(rulesFile(), 'utf8'); } catch { return '[General]\nrules=\n'; }
}

function currentDisplay() {
    const text = readRulesFile();
    const group = text.split(/^\[/m).find(s => s.startsWith(`${RULE_ID}]`));
    if (!group) return null;
    const m = group.match(/^screen=(\d+)$/m);
    return m ? Number(m[1]) : null;
}

function kwriteconfig(args) {
    const bin = which('kwriteconfig6') || which('kwriteconfig5');
    if (!bin) return false;
    return spawnSync(bin, ['--file', 'kwinrulesrc', ...args], { encoding: 'utf8' }).status === 0;
}

// Keep the [General] rules list in step, without disturbing anyone else's entries.
function setRuleListed(listed) {
    const text = readRulesFile();
    const m = text.match(/^rules=(.*)$/m);
    const ids = (m ? m[1] : '').split(',').map(s => s.trim()).filter(Boolean);
    const without = ids.filter(id => id !== RULE_ID);
    const next = listed ? [...without, RULE_ID] : without;
    kwriteconfig(['--group', 'General', '--key', 'rules', next.join(',')]);
    // count is what older KWin reads; harmless and correct to keep aligned.
    kwriteconfig(['--group', 'General', '--key', 'count', String(next.length)]);
}

// Ask KWin to re-read its rules. Without this the change waits for a session restart.
function reconfigure() {
    const qdbus = which('qdbus6') || which('qdbus') || which('qdbus-qt6');
    if (!qdbus) return false;
    return spawnSync(qdbus, ['org.kde.KWin', '/KWin', 'reconfigure'], { encoding: 'utf8' }).status === 0;
}

// index === null clears the rule entirely and hands placement back to KDE.
function setGameDisplay(index) {
    if (!isSupported()) return { ok: false, error: 'This needs KDE with kscreen-doctor and kwriteconfig.' };

    if (index === null || index === undefined || index < 0) {
        // kwriteconfig can delete a key but not a group, so every key we wrote is removed
        // individually. What is left is an empty section, which KWin ignores — and editing
        // the file by hand to tidy that away would risk the rules someone else wrote.
        for (const k of RULE_KEYS) kwriteconfig(['--group', RULE_ID, '--key', k, '--delete', '']);
        setRuleListed(false);
        reconfigure();
        return { ok: true, display: null };
    }

    const displays = listDisplays();
    const target = displays.find(d => d.index === index);
    if (!target) return { ok: false, error: 'That screen is no longer connected.' };

    for (const [k, v] of [
        ['Description', `${RULE_DESC} (${target.name})`],
        ['wmclass', WM_CLASS],
        ['wmclasscomplete', 'false'],
        ['wmclassmatch', '2'],              // 2 = substring
        ['screen', String(index)],
        ['screenrule', '3'],                // 3 = Force
    ]) kwriteconfig(['--group', RULE_ID, '--key', k, v]);

    setRuleListed(true);
    const applied = reconfigure();
    return { ok: true, display: target, applied };
}

module.exports = { isSupported, listDisplays, currentDisplay, setGameDisplay, RULE_ID };
