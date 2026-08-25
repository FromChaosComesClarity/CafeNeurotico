// ── Omarchy Linux integration ────────────────────────────────────────────────
// Omarchy is Arch with Hyprland and an opinionated set of defaults. It is NOT a platform
// backend: `host.id` is still `linux` and every path in platform/linux.js applies unchanged.
// What is different is the *desktop* — a Wayland tiling compositor instead of KDE — and the
// fact that a fresh install ships almost none of the gaming stack, because Omarchy is aimed
// at developers first. Both of those are things this module can answer questions about.
//
// This file deliberately imports nothing from the rest of the suite: node builtins only. It
// is meant to be copied into EmuLatte verbatim, where only the wiring differs.
//
// ⚠️ Nothing here escalates privileges. Installing packages needs root, and the honest way
// to ask for root from a GUI app is to hand the command to a terminal the user can watch —
// see openInstallTerminal(). Omarchy's own guidance says the same: sudo where a terminal
// exists to type the password into.
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn, spawnSync } = require('child_process');

const HOME = os.homedir();

function which(bin) {
    for (const dir of (process.env.PATH || '').split(path.delimiter)) {
        if (!dir) continue;
        const p = path.join(dir, bin);
        try { fs.accessSync(p, fs.constants.X_OK); return p; } catch {}
    }
    return '';
}

// ── Detection ────────────────────────────────────────────────────────────────
// os-release is the only thing that identifies the distribution. Omarchy 4 sets
// ID=omarchy with ID_LIKE=arch, which is why linux.js's pacman hints already fire
// correctly — its is() helper splits ID_LIKE. Do not assume ID_LIKE stays set: a future
// release dropping it would silently turn every "arch" branch off, so anything that needs
// "is this pacman-based" should ask isArchLike() rather than reading ID alone.
let _osRelease;
function osRelease() {
    if (_osRelease) return _osRelease;
    _osRelease = { id: '', idLike: '', versionId: '', prettyName: '', name: '' };
    try {
        const text = fs.readFileSync('/etc/os-release', 'utf8');
        const get = key => {
            const m = text.match(new RegExp('^' + key + '=(.*)$', 'm'));
            return m ? m[1].trim().replace(/^"(.*)"$/, '$1') : '';
        };
        _osRelease = {
            id: get('ID').toLowerCase(),
            idLike: get('ID_LIKE').toLowerCase(),
            versionId: get('VERSION_ID'),
            prettyName: get('PRETTY_NAME'),
            name: get('NAME'),
        };
    } catch {}
    return _osRelease;
}

function isOmarchy() { return osRelease().id === 'omarchy'; }
function isArchLike() {
    const { id, idLike } = osRelease();
    return id === 'arch' || id === 'omarchy' || idLike.split(/\s+/).includes('arch');
}
function version() { return osRelease().versionId || ''; }

// Hyprland is what Omarchy runs, but it is not exclusive to it — someone on plain Arch may
// well be running Hyprland too, and every window-management feature here works for them.
// Keep the two questions separate so neither gates the other.
function isHyprland() {
    const d = `${process.env.XDG_CURRENT_DESKTOP || ''} ${process.env.DESKTOP_SESSION || ''}`.toLowerCase();
    return d.includes('hyprland') || !!process.env.HYPRLAND_INSTANCE_SIGNATURE;
}

function hyprctlBin() { return which('hyprctl'); }

// hyprctl -j returns JSON for the query subcommands. A non-zero exit or unparseable output
// means the compositor is not listening (no session, or a version without that query), and
// every caller here treats that as "feature unavailable" rather than an error worth raising.
function hyprctl(args) {
    const bin = hyprctlBin();
    if (!bin) return null;
    try {
        const r = spawnSync(bin, args, { encoding: 'utf8', timeout: 4000, maxBuffer: 4 * 1024 * 1024 });
        if (r.status !== 0 || !r.stdout) return null;
        return r.stdout;
    } catch { return null; }
}

function hyprctlJson(args) {
    const out = hyprctl([...args, '-j']);
    if (!out) return null;
    try { return JSON.parse(out); } catch { return null; }
}

// The monitors Hyprland knows about, in its own order. `name` is the connector (eDP-1,
// LVDS-1, HDMI-A-1) and is what a window rule matches on — an index shifts when a monitor
// is unplugged, a connector name does not. Same reasoning as kwin-display.js.
function monitors() {
    const list = hyprctlJson(['monitors']);
    if (!Array.isArray(list)) return [];
    return list.map(m => ({
        name: String(m.name || ''),
        description: String(m.description || ''),
        width: Number(m.width) || 0,
        height: Number(m.height) || 0,
        refreshRate: Number(m.refreshRate) || 0,
        scale: Number(m.scale) || 1,
        focused: !!m.focused,
        id: Number(m.id),
    })).filter(m => m.name);
}

// ── The gaming stack ─────────────────────────────────────────────────────────
// What a fresh Omarchy lacks, measured against what the Nobara reference host has. Nobara
// is a gaming distribution and ships this whole list preinstalled, which is exactly why the
// gap only becomes visible on a machine like this one.
//
// Every entry names the binary the suite actually probes for, so this list stays honest:
// `required: true` means something in Cafe Neurotico degrades without it, and the `why`
// says what. The `extra` group is what Nobara ships and a gamer will want, but which the
// suite itself never calls — labelled so nobody is told they need something they don't.
//
// ⚠️ Package names are Arch's, and `repo` records where it comes from: everything here is
// in an official repo except dosbox-staging, which is AUR-only and therefore installed
// with a different command. Getting that wrong produces a "target not found" for the user.
const TOOLS = [
    { key: 'umu',      bin: 'umu-run',                 pkg: 'umu-launcher',       repo: 'multilib', required: true,
      label: 'umu-launcher',
      why: 'the recommended way to launch Windows games. Without it the suite falls back to invoking Proton directly, which works but loses umu\'s per-game compatibility fixes.' },
    { key: 'dosbox',   bin: 'dosbox-staging',           pkg: 'dosbox-staging',     repo: 'aur',      required: true,
      label: 'DOSBox Staging', alt: ['dosbox', 'dosbox-x'],
      why: 'DOS games from GOG launch through it. Without any DOSBox, those titles cannot start at all. Staging is the AUR build and the one worth having — but plain `dosbox` from the official repos also satisfies this, and an existing install of either counts.' },
    { key: 'wmctrl',   bin: 'wmctrl',                   pkg: 'wmctrl',             repo: 'extra',    required: false,
      label: 'wmctrl',
      why: 'used to raise the window after a game exits. It is an X11 tool, so on a pure Wayland session it does nothing even when installed — safe to skip on Hyprland.' },
    { key: 'pipx',     bin: 'pipx',                     pkg: 'python-pipx',        repo: 'extra',    required: false,
      label: 'pipx',
      why: 'lets the suite install umu-launcher into your home directory without root. Unnecessary if umu-launcher is installed from the repos.' },
    { key: 'wine',     bin: 'wine',                     pkg: 'wine',               repo: 'extra',    required: false,
      label: 'wine',
      why: 'a last-resort runner for the rare title that will not start under Proton.' },
    { key: 'flatpak',  bin: 'flatpak',                  pkg: 'flatpak',            repo: 'extra',    required: false,
      label: 'Flatpak',
      why: 'lets the suite find Flatpak-installed games and the Flatpak build of DOSBox.' },

    { key: 'gamemode', bin: 'gamemoderun',              pkg: 'gamemode',           repo: 'extra',    required: false, extra: true,
      label: 'GameMode',
      why: 'applies CPU governor and scheduling tweaks while a game runs. Nobara ships it; the suite does not call it itself.' },
    { key: 'mangohud', bin: 'mangohud',                 pkg: 'mangohud',           repo: 'extra',    required: false, extra: true,
      label: 'MangoHud',
      why: 'an in-game performance overlay. Nobara ships it; the suite does not call it itself.' },
    { key: 'gamescope',bin: 'gamescope',                pkg: 'gamescope',          repo: 'extra',    required: false, extra: true,
      label: 'gamescope',
      why: 'a micro-compositor useful for scaling and framerate limiting, and for games that behave badly on a tiling WM.' },
    { key: 'winetricks',bin: 'winetricks',              pkg: 'winetricks',         repo: 'extra',    required: false, extra: true,
      label: 'winetricks',
      why: 'installs Windows redistributables into a prefix by hand when a game needs one the automatic setup missed.' },
    { key: 'protontricks', bin: 'protontricks',         pkg: 'protontricks',       repo: 'extra',    required: false, extra: true,
      label: 'protontricks',
      why: 'the same idea as winetricks, aimed at Steam/Proton prefixes.' },
];

// ── Omarchy's own gaming installers ──────────────────────────────────────────
// Omarchy ships `omarchy install gaming <thing>`, and for anything it covers that command
// is strictly better than installing the package ourselves: `steam` also pulls the 32-bit
// graphics drivers picked for *this* GPU, which is the step people miss and the reason a
// fresh Arch install runs Proton games at software-rendering speed or not at all.
//
// So the rule is: if Omarchy has an installer for it, hand the user Omarchy's installer.
// We detect what is missing and get out of the way. Nothing here is installed by us.
//
// ⚠️ These are whole applications, not helper binaries — a missing one is never an error,
// only an offer. Steam missing is worth surfacing prominently because the library is built
// from it; the rest are opportunities.
const FLATPAK_EXPORTS = [
    path.join(HOME, '.local', 'share', 'flatpak', 'exports', 'bin'),
    '/var/lib/flatpak/exports/bin',
];

function flatpakInstalled(appId) {
    if (!appId) return false;
    return FLATPAK_EXPORTS.some(d => { try { return fs.existsSync(path.join(d, appId)); } catch { return false; } });
}

function pacmanHas(pkg) {
    try {
        const r = spawnSync('pacman', ['-Qq', pkg], { encoding: 'utf8', timeout: 4000 });
        return r.status === 0;
    } catch { return false; }
}

const INSTALLERS = [
    { key: 'steam', label: 'Steam', bin: 'steam', flatpak: 'com.valvesoftware.Steam',
      command: 'omarchy install gaming steam', headline: true,
      why: 'the Steam library is the largest part of most collections here, and the suite reads it directly from disk. Omarchy\'s installer also pulls the 32-bit graphics drivers chosen for this GPU, which Proton needs.' },
    { key: 'gpu-lib32', label: '32-bit graphics drivers', pkg: 'lib32-vulkan-icd-loader',
      command: 'omarchy install gaming gpu-lib32',
      why: 'Proton and Wine are 32-bit-capable and need the lib32 Vulkan stack. Without it Windows games fail to start or fall back to software rendering. Installing Steam through Omarchy brings these in too.' },
    // ⚠️ Heroic and Lutris are deliberately absent. The suite signs in to GOG and Epic
    // itself and runs Windows games through Proton directly, so a second launcher is not a
    // missing piece — it is a competing one, and offering to install it would undercut the
    // thing this app exists to do. Omarchy can install both; that is the user's business,
    // not a gap for us to report.

    // Emulation belongs to EmuLatte, not here. Carried in the shared module so the EmuLatte
    // port has it, and filtered out of this app's UI by the `emulation` flag.
    { key: 'retroarch', label: 'RetroArch', bin: 'retroarch', flatpak: 'org.libretro.RetroArch',
      command: 'omarchy install gaming retroarch', emulation: true,
      why: 'Omarchy installs RetroArch with the full libretro core set in one step. Emulation is EmuLatte\'s pillar rather than this app\'s.' },
    { key: 'xbox-controllers', label: 'Xbox controller support', pkg: 'xpadneo-dkms',
      command: 'omarchy install gaming xbox-controllers',
      why: 'optional. Wireless Xbox pads need this to pair properly; CREMA is gamepad-first, so it is worth having if you play from the couch.' },
];

function installerStatus() {
    return INSTALLERS.map(i => {
        const binPath = i.bin ? which(i.bin) : '';
        const present = !!binPath || (i.flatpak ? flatpakInstalled(i.flatpak) : false) || (i.pkg ? pacmanHas(i.pkg) : false);
        return {
            key: i.key, label: i.label, command: i.command, why: i.why,
            headline: !!i.headline, emulation: !!i.emulation,
            present, path: binPath || null,
            via: binPath ? 'path' : (i.flatpak && flatpakInstalled(i.flatpak)) ? 'flatpak'
               : (i.pkg && pacmanHas(i.pkg)) ? 'package' : null,
        };
    });
}

// `includeEmulation` is false for Cafe Neurotico and true for EmuLatte — same module,
// each app reporting only what it is actually responsible for.
function missingInstallers({ includeEmulation = false } = {}) {
    return installerStatus().filter(i => !i.present && (includeEmulation || !i.emulation));
}

// Run one of Omarchy's installers in a terminal. Same reasoning as openInstallTerminal():
// these are `requires-sudo=true` scripts, and a terminal is where a password belongs.
function runInstaller(key) {
    const entry = INSTALLERS.find(i => i.key === key);
    if (!entry) return { ok: false, error: `Unknown installer: ${key}` };
    return openTerminalWith(entry.command);
}

// Resolve one tool against PATH, honouring the alternates — a user with plain `dosbox`
// installed has a working DOSBox and must not be told otherwise.
function resolveTool(t) {
    let found = which(t.bin);
    let via = found ? t.bin : '';
    if (!found && Array.isArray(t.alt)) {
        for (const a of t.alt) {
            const p = which(a);
            if (p) { found = p; via = a; break; }
        }
    }
    return {
        key: t.key, label: t.label, bin: t.bin, pkg: t.pkg, repo: t.repo,
        required: !!t.required, extra: !!t.extra, why: t.why,
        path: found || null, present: !!found, foundAs: via || null,
    };
}

function toolStatus() { return TOOLS.map(resolveTool); }
function missingTools({ includeExtras = true } = {}) {
    return toolStatus().filter(t => !t.present && (includeExtras || !t.extra));
}

// A one-line summary for the UI: how far this host is from the reference.
function gapSummary() {
    const all = toolStatus();
    const missing = all.filter(t => !t.present);
    return {
        total: all.length,
        present: all.length - missing.length,
        missingRequired: missing.filter(t => t.required).map(t => t.key),
        missingOptional: missing.filter(t => !t.required && !t.extra).map(t => t.key),
        missingExtras: missing.filter(t => t.extra).map(t => t.key),
    };
}

// ── Installing what is missing ───────────────────────────────────────────────
// AUR packages go through a different command than repo packages, so a mixed selection has
// to become two commands rather than one. `omarchy pkg add` is a no-op for anything already
// installed, which makes re-running it after a partial failure safe.
function installCommand(keys) {
    const want = toolStatus().filter(t => keys.includes(t.key) && !t.present);
    const repo = want.filter(t => t.repo !== 'aur').map(t => t.pkg);
    const aur  = want.filter(t => t.repo === 'aur').map(t => t.pkg);
    const parts = [];
    if (repo.length) parts.push(`omarchy pkg add ${repo.join(' ')}`);
    if (aur.length)  parts.push(`omarchy pkg aur add ${aur.join(' ')}`);
    return parts.join(' && ');
}

// The terminal to hand a privileged command to. xdg-terminal-exec is the freedesktop
// indirection Omarchy itself uses (TERMINAL is set to it), so it honours whatever terminal
// the user actually chose; the rest are fallbacks for a non-Omarchy Hyprland box.
function terminalLauncher() {
    const xte = which('xdg-terminal-exec');
    if (xte) return { cmd: xte, wrap: args => args };
    for (const t of ['foot', 'alacritty', 'ghostty', 'kitty', 'wezterm']) {
        const p = which(t);
        if (p) return { cmd: p, wrap: args => (t === 'wezterm' ? ['start', '--', ...args] : ['-e', ...args]) };
    }
    return null;
}

// Open a terminal running a command, then keep it open so the result is readable — a
// terminal that closes the instant pacman finishes takes the error with it.
//
// ⚠️ detached + unref is what stops the install dying when the app is closed mid-way, and
// the 'error' listener is not optional: spawn reports a missing terminal asynchronously, so
// a try/catch alone would let an unhandled 'error' event take the whole app down. That is
// the same trap spawnOptional() exists for in linux.js.
function openTerminalWith(command) {
    if (!command) return { ok: false, error: 'Nothing to run.' };
    const term = terminalLauncher();
    if (!term) return { ok: false, error: 'No terminal emulator found to run this in.', command };
    const script = `${command}; echo; echo "── done. press enter to close ──"; read _`;
    try {
        const child = spawn(term.cmd, term.wrap(['bash', '-lc', script]), { detached: true, stdio: 'ignore' });
        child.on('error', () => {});   // a missing terminal must not take the app down
        child.unref();
        return { ok: true, command };
    } catch (e) {
        return { ok: false, error: e.message, command };
    }
}

function openInstallTerminal(keys) {
    const command = installCommand(keys);
    if (!command) return { ok: false, error: 'Nothing to install — every selected tool is already present.' };
    return openTerminalWith(command);
}

// ── Gate ─────────────────────────────────────────────────────────────────────
// Everything above is meaningful on any Arch-like host running Hyprland; the Omarchy-only
// parts (omarchy pkg, the theme bridge) need the real thing. Callers that only want window
// management should ask isHyprland() instead.
function isSupported() { return isOmarchy(); }

function describe() {
    return {
        isOmarchy: isOmarchy(),
        isArchLike: isArchLike(),
        isHyprland: isHyprland(),
        version: version(),
        prettyName: osRelease().prettyName,
        hyprland: isHyprland() ? (hyprctl(['version'])?.split('\n')[0] || '').trim() : '',
        monitors: isHyprland() ? monitors().length : 0,
    };
}

module.exports = {
    osRelease, isOmarchy, isArchLike, version, isHyprland,
    hyprctl, hyprctlJson, monitors,
    TOOLS, toolStatus, missingTools, gapSummary,
    INSTALLERS, installerStatus, missingInstallers, runInstaller,
    installCommand, openInstallTerminal, openTerminalWith, terminalLauncher,
    isSupported, describe, which,
};
