'use strict';

// ── Theme sync with CNGM ──────────────────────────────────────────────────────
// When launched from CNGM, GRINDER reads CNGM's active theme and applies it
// so both apps look identical. Falls back to GRINDER's default if not found.
const CNGM_THEMES = {
    "DARK GRAY": {bg:"#141414",bg_panel:"rgba(0,0,0,0.5)",bg_menu:"#222222",accent:"#ffffff",text_main:"#ffffff",text_sec:"#bbbbbb",text_dim:"#777777",border:"rgba(255,255,255,0.1)",border_solid:"#555555"},
    "CREMA": {bg:"#2C1E16",bg_panel:"rgba(67,40,24,0.6)",bg_menu:"#432818",accent:"#D4A373",text_main:"#FFE6A7",text_sec:"#E6CC98",text_dim:"#A47148",border:"rgba(212,163,115,0.2)",border_solid:"#8B5A2B"},
    "CYBERPUNK": {bg:"#09090b",bg_panel:"rgba(26,26,46,0.7)",bg_menu:"#1a1a2e",accent:"#f3e600",text_main:"#00ffcc",text_sec:"#e0e0e0",text_dim:"#ff003c",border:"rgba(243,230,0,0.2)",border_solid:"#ff003c"},
    "VAPOUR OS": {bg:"#171a21",bg_panel:"rgba(27,40,56,0.7)",bg_menu:"#1b2838",accent:"#66c0f4",text_main:"#c7d5e0",text_sec:"#8f98a0",text_dim:"#556b82",border:"rgba(102,192,244,0.2)",border_solid:"#2a475e"},
    "PSIV BLUE": {bg:"#000022",bg_panel:"rgba(0,67,156,0.4)",bg_menu:"#001144",accent:"#ffffff",text_main:"#ffffff",text_sec:"#aaaaaa",text_dim:"#666666",border:"rgba(0,112,204,0.3)",border_solid:"#00439c"},
    "GREEN BOX": {bg:"#0e0e0e",bg_panel:"rgba(82,176,67,0.10)",bg_menu:"#111111",accent:"#52b043",text_main:"#ffffff",text_sec:"#a8d8a4",text_dim:"#3d8030",border:"rgba(82,176,67,0.22)",border_solid:"#1a3d1a"},
    "MOVIESFLIX": {bg:"#141414",bg_panel:"rgba(255,255,255,0.07)",bg_menu:"#000000",accent:"#e50914",text_main:"#ffffff",text_sec:"#b3b3b3",text_dim:"#6d6d6d",border:"rgba(229,9,20,0.30)",border_solid:"#404040"},
    "SNOW": {bg:"#0a1628",bg_panel:"rgba(32,68,110,0.65)",bg_menu:"#0f2040",accent:"#93d0f0",text_main:"#e8f4ff",text_sec:"#8bbbd8",text_dim:"#4a7898",border:"rgba(147,208,240,0.18)",border_solid:"#1c4060"},
    "WIN XP": {bg:"#003399",bg_panel:"rgba(236,233,216,0.2)",bg_menu:"#0054E3",accent:"#ffd700",text_main:"#FFFFFF",text_sec:"#ECE9D8",text_dim:"#99B4D1",border:"rgba(236,233,216,0.4)",border_solid:"#4fcc3a"},
    "PSIII CLASSIC": {bg:"#000000",bg_panel:"rgba(25,25,25,0.7)",bg_menu:"#111111",accent:"#dcdcdc",text_main:"#ffffff",text_sec:"#aaaaaa",text_dim:"#666666",border:"rgba(255,255,255,0.2)",border_solid:"#444444"},
    "PSIII RED": {bg:"#2b0000",bg_panel:"rgba(40,0,0,0.7)",bg_menu:"#1a0000",accent:"#ff4d4d",text_main:"#ffffff",text_sec:"#ffcccc",text_dim:"#cc6666",border:"rgba(255,77,77,0.2)",border_solid:"#800000"},
    "PSIII GREEN": {bg:"#001a00",bg_panel:"rgba(0,30,0,0.7)",bg_menu:"#000d00",accent:"#4dff4d",text_main:"#ffffff",text_sec:"#ccffcc",text_dim:"#66cc66",border:"rgba(77,255,77,0.2)",border_solid:"#004d00"},
    "PSIII BLUE": {bg:"#000a1a",bg_panel:"rgba(0,15,30,0.7)",bg_menu:"#00050d",accent:"#4d94ff",text_main:"#ffffff",text_sec:"#cce0ff",text_dim:"#66a3ff",border:"rgba(77,148,255,0.2)",border_solid:"#003380"},
    "PSIII PURPLE": {bg:"#1a001a",bg_panel:"rgba(30,0,30,0.7)",bg_menu:"#0d000d",accent:"#d24dff",text_main:"#ffffff",text_sec:"#f0ccff",text_dim:"#c266cc",border:"rgba(210,77,255,0.2)",border_solid:"#800080"},
    "PSIII GOLD": {bg:"#261a00",bg_panel:"rgba(40,25,0,0.7)",bg_menu:"#130d00",accent:"#ffcc00",text_main:"#ffffff",text_sec:"#ffeecc",text_dim:"#cca300",border:"rgba(255,204,0,0.2)",border_solid:"#997300"},
    "PSIII SILVER": {bg:"#1a1a1a",bg_panel:"rgba(35,35,35,0.7)",bg_menu:"#0d0d0d",accent:"#cccccc",text_main:"#ffffff",text_sec:"#e6e6e6",text_dim:"#999999",border:"rgba(204,204,204,0.2)",border_solid:"#666666"},
    "DRACULA": {bg:"#282a36",bg_panel:"rgba(68,71,90,0.7)",bg_menu:"#44475a",accent:"#bd93f9",text_main:"#f8f8f2",text_sec:"#8be9fd",text_dim:"#8290bc",border:"rgba(189,147,249,0.2)",border_solid:"#8290bc"},
    "GRUVBOX": {bg:"#282828",bg_panel:"rgba(60,56,54,0.8)",bg_menu:"#3c3836",accent:"#fabd2f",text_main:"#ebdbb2",text_sec:"#b8bb26",text_dim:"#a89984",border:"rgba(250,189,47,0.2)",border_solid:"#504945"},
    "NORD": {bg:"#2e3440",bg_panel:"rgba(59,66,82,0.8)",bg_menu:"#3b4252",accent:"#88c0d0",text_main:"#eceff4",text_sec:"#e5e9f0",text_dim:"#7a8ba0",border:"rgba(136,192,208,0.2)",border_solid:"#5e6f84"},
    "SOLARIZED DARK": {bg:"#002b36",bg_panel:"rgba(7,54,66,0.8)",bg_menu:"#073642",accent:"#2aa198",text_main:"#839496",text_sec:"#93a1a1",text_dim:"#7a9196",border:"rgba(42,161,152,0.2)",border_solid:"#1a5060"},
    "CATPPUCCIN MOCHA": {bg:"#1e1e2e",bg_panel:"rgba(30,30,46,0.8)",bg_menu:"#181825",accent:"#cba6f7",text_main:"#cdd6f4",text_sec:"#bac2de",text_dim:"#6c7086",border:"rgba(203,166,247,0.2)",border_solid:"#313244"},
    "CATPPUCCIN MACCHIATO": {bg:"#24273a",bg_panel:"rgba(36,39,58,0.8)",bg_menu:"#1e2030",accent:"#c6a0f6",text_main:"#cad3f5",text_sec:"#b8c0e0",text_dim:"#6e738d",border:"rgba(198,160,246,0.2)",border_solid:"#363a4f"},
    "CATPPUCCIN FRAPPÉ": {bg:"#303446",bg_panel:"rgba(48,52,70,0.8)",bg_menu:"#292c3c",accent:"#ca9ee6",text_main:"#c6d0f5",text_sec:"#b5bfe2",text_dim:"#737994",border:"rgba(202,158,230,0.2)",border_solid:"#414559"},
    "TOKYO NIGHT": {bg:"#1a1b26",bg_panel:"rgba(36,40,59,0.8)",bg_menu:"#16161e",accent:"#7aa2f7",text_main:"#c0caf5",text_sec:"#a9b1d6",text_dim:"#7885ac",border:"rgba(122,162,247,0.2)",border_solid:"#3d4468"},
    "EVERFOREST": {bg:"#2b3339",bg_panel:"rgba(50,56,62,0.8)",bg_menu:"#2f383e",accent:"#a7c080",text_main:"#d3c6aa",text_sec:"#a7c080",text_dim:"#859289",border:"rgba(167,192,128,0.2)",border_solid:"#4b565c"},
    "ROSÉ PINE": {bg:"#191724",bg_panel:"rgba(31,29,46,0.8)",bg_menu:"#1f1d2e",accent:"#c4a7e7",text_main:"#e0def4",text_sec:"#9ccfd8",text_dim:"#6e6a86",border:"rgba(196,167,231,0.2)",border_solid:"#26233a"},
    "GAME BOY DMG": {bg:"#0f380f",bg_panel:"rgba(48,98,48,0.70)",bg_menu:"#1a4a1a",accent:"#9bbc0f",text_main:"#9bbc0f",text_sec:"#8bac0f",text_dim:"#306230",border:"rgba(155,188,15,0.25)",border_solid:"#306230"},
    "PIP BOY": {bg:"#000000",bg_panel:"rgba(0,20,0,0.7)",bg_menu:"#001100",accent:"#14ff00",text_main:"#14ff00",text_sec:"#0ea000",text_dim:"#0a6000",border:"rgba(20,255,0,0.2)",border_solid:"#0ea000"},
    "SEVASTOPOL": {bg:"#050d05",bg_panel:"rgba(10,25,10,0.7)",bg_menu:"#081808",accent:"#f5e6b3",text_main:"#f5e6b3",text_sec:"#a39977",text_dim:"#4d594d",border:"rgba(245,230,179,0.1)",border_solid:"#1a331a"},
    "RIP AND TEAR CLASSIC": {bg:"#110000",bg_panel:"rgba(80,5,5,0.78)",bg_menu:"#1a0000",accent:"#ff0000",text_main:"#f5d020",text_sec:"#d0a000",text_dim:"#7a4400",border:"rgba(255,0,0,0.22)",border_solid:"#5a0000"},
    "SUPER BROTHERS": {bg:"#5C94FC",bg_panel:"rgba(0,0,0,0.75)",bg_menu:"#000070",accent:"#F8D820",text_main:"#ffffff",text_sec:"#F8D820",text_dim:"#6898F8",border:"rgba(248,216,32,0.30)",border_solid:"#000000"},
    "GREEN HILL": {bg:"#0044AA",bg_panel:"rgba(0,60,0,0.82)",bg_menu:"#003300",accent:"#F8D020",text_main:"#ffffff",text_sec:"#A8E888",text_dim:"#50A050",border:"rgba(248,208,32,0.30)",border_solid:"#006600"},
    "NES": {bg:"#18181A",bg_panel:"rgba(40,38,42,0.85)",bg_menu:"#222024",accent:"#C42020",text_main:"#F0F0F0",text_sec:"#C0B8C0",text_dim:"#706870",border:"rgba(196,32,32,0.22)",border_solid:"#3C3A3E"},
    "SNES": {bg:"#1E1828",bg_panel:"rgba(50,42,80,0.72)",bg_menu:"#160E20",accent:"#8060C8",text_main:"#E8E0F0",text_sec:"#A890C8",text_dim:"#605090",border:"rgba(128,96,200,0.22)",border_solid:"#302050"},
    "BLOODBORNE": {bg:"#0a0606",bg_panel:"rgba(60,20,10,0.78)",bg_menu:"#150808",accent:"#c0952a",text_main:"#e8d8b0",text_sec:"#b09070",text_dim:"#604830",border:"rgba(192,149,42,0.22)",border_solid:"#4a1818"},
    "METROID PRIME": {bg:"#050a12",bg_panel:"rgba(255,120,20,0.12)",bg_menu:"#080f1a",accent:"#ff6a00",text_main:"#e0f0ff",text_sec:"#60c8e0",text_dim:"#304858",border:"rgba(255,106,0,0.22)",border_solid:"#1a2a3a"},
    "SILENT HILL": {bg:"#141210",bg_panel:"rgba(80,50,35,0.72)",bg_menu:"#1a1510",accent:"#c85020",text_main:"#e0d0c0",text_sec:"#a09080",text_dim:"#605040",border:"rgba(200,80,32,0.22)",border_solid:"#4a3020"},
    "DIABLO": {bg:"#0c0808",bg_panel:"rgba(80,20,0,0.75)",bg_menu:"#140808",accent:"#e84000",text_main:"#f0d898",text_sec:"#c0a060",text_dim:"#705028",border:"rgba(232,64,0,0.22)",border_solid:"#4a1a00"},
    "HALF-LIFE": {bg:"#141618",bg_panel:"rgba(245,130,32,0.12)",bg_menu:"#1c1e20",accent:"#f58320",text_main:"#f0f0f0",text_sec:"#b0b8c0",text_dim:"#606870",border:"rgba(245,131,32,0.22)",border_solid:"#2a3038"},
    "SHOVEL KNIGHT": {bg:"#1a1a2e",bg_panel:"rgba(30,40,80,0.75)",bg_menu:"#100c20",accent:"#f8d840",text_main:"#e8f0ff",text_sec:"#88b8f8",text_dim:"#4060a0",border:"rgba(248,216,64,0.28)",border_solid:"#202858"},
    "EARTHY & ORGANIC": {bg:"#3E4E3A",bg_panel:"rgba(91,107,85,0.7)",bg_menu:"#4F5D48",accent:"#D4B28C",text_main:"#F3EDE4",text_sec:"#D8D3C8",text_dim:"#8E9E88",border:"rgba(212,178,140,0.2)",border_solid:"#6b7d63"},
    "DOPAMINE BRIGHTS": {bg:"#080810",bg_panel:"rgba(255,50,120,0.12)",bg_menu:"#100820",accent:"#FF2D78",text_main:"#ffffff",text_sec:"#FF80C0",text_dim:"#6030A0",border:"rgba(255,45,120,0.28)",border_solid:"#2A0850"},
    "RETRO REVIVAL": {bg:"#2A1A10",bg_panel:"rgba(80,50,30,0.70)",bg_menu:"#1E1008",accent:"#E8883A",text_main:"#F8E8C8",text_sec:"#C8A878",text_dim:"#7A5838",border:"rgba(232,136,58,0.22)",border_solid:"#5A3820"},
    "VAPORWAVE": {bg:"#0d0221",bg_panel:"rgba(80,10,100,0.65)",bg_menu:"#150330",accent:"#ff71ce",text_main:"#f0e0ff",text_sec:"#c080ff",text_dim:"#6030a0",border:"rgba(255,113,206,0.25)",border_solid:"#35005a"},
    "AURORA": {bg:"#0a1520",bg_panel:"rgba(0,80,80,0.55)",bg_menu:"#081018",accent:"#00e8c8",text_main:"#d0f8f0",text_sec:"#78d8c8",text_dim:"#306858",border:"rgba(0,232,200,0.20)",border_solid:"#0a4040"},
    "NOIR": {bg:"#0a0a0a",bg_panel:"rgba(45,45,45,0.78)",bg_menu:"#151515",accent:"#d4a030",text_main:"#e8e0d0",text_sec:"#a09888",text_dim:"#606058",border:"rgba(212,160,48,0.20)",border_solid:"#303028"},
    "BIOLUMINESCENCE": {bg:"#020810",bg_panel:"rgba(0,120,120,0.42)",bg_menu:"#030c18",accent:"#00e8a8",text_main:"#c0f8f0",text_sec:"#60d8c8",text_dim:"#206858",border:"rgba(0,232,168,0.22)",border_solid:"#0a3838"},
    "BRUTALIST": {bg:"#1a1a1a",bg_panel:"rgba(80,80,80,0.55)",bg_menu:"#222222",accent:"#e03000",text_main:"#f0f0f0",text_sec:"#c0c0c0",text_dim:"#808080",border:"rgba(224,48,0,0.25)",border_solid:"#404040"},
    "OXOCARBON": {bg:"#161616",bg_panel:"rgba(38,38,38,0.85)",bg_menu:"#262626",accent:"#0f62fe",text_main:"#f4f4f4",text_sec:"#c6c6c6",text_dim:"#8d8d8d",border:"rgba(15,98,254,0.25)",border_solid:"#393939"},
    "MATERIAL DARK": {bg:"#1a1c1e",bg_panel:"rgba(40,48,56,0.80)",bg_menu:"#212325",accent:"#4fc3f7",text_main:"#e1e2e8",text_sec:"#c1c2cb",text_dim:"#8589a0",border:"rgba(79,195,247,0.18)",border_solid:"#3a3f4a"},
    "N7": {bg:"#080c14",bg_panel:"rgba(20,30,60,0.78)",bg_menu:"#0c1428",accent:"#cc0000",text_main:"#e8eeff",text_sec:"#7aa0cc",text_dim:"#3d5880",border:"rgba(204,0,0,0.25)",border_solid:"#1a2848"},
    "TRON LEGACY": {bg:"#000000",bg_panel:"rgba(0,200,255,0.08)",bg_menu:"#000508",accent:"#00c8ff",text_main:"#ffffff",text_sec:"#80d8ff",text_dim:"#204858",border:"rgba(0,200,255,0.28)",border_solid:"#0a1a20"},
    "DEAD SPACE": {bg:"#020202",bg_panel:"rgba(255,100,20,0.10)",bg_menu:"#050505",accent:"#ff6400",text_main:"#f0f0f0",text_sec:"#ff9060",text_dim:"#602010",border:"rgba(255,100,32,0.25)",border_solid:"#200800"},
    "COLONY SHIP": {bg:"#10120e",bg_panel:"rgba(50,60,40,0.72)",bg_menu:"#141810",accent:"#c8b040",text_main:"#d8e0c0",text_sec:"#909a70",text_dim:"#485840",border:"rgba(200,176,64,0.22)",border_solid:"#303820"},
    "NECROMORPH": {bg:"#030808",bg_panel:"rgba(0,80,20,0.60)",bg_menu:"#040a04",accent:"#80ff20",text_main:"#c8ffc0",text_sec:"#70c060",text_dim:"#306020",border:"rgba(128,255,32,0.22)",border_solid:"#0a2808"},
    "CRIMSON PEAK": {bg:"#120508",bg_panel:"rgba(80,15,30,0.75)",bg_menu:"#1a080c",accent:"#d4904a",text_main:"#f0e0d8",text_sec:"#c0909a",text_dim:"#7a3848",border:"rgba(212,144,74,0.22)",border_solid:"#5a1520"},
    "LAKESIDE CURSE": {bg:"#0c0a08",bg_panel:"rgba(60,40,20,0.72)",bg_menu:"#141008",accent:"#e09030",text_main:"#f0e8d0",text_sec:"#b09070",text_dim:"#706050",border:"rgba(224,144,48,0.22)",border_solid:"#402808"},
    "THE BACKROOMS": {bg:"#1a1810",bg_panel:"rgba(220,200,100,0.10)",bg_menu:"#201e14",accent:"#d4c840",text_main:"#f0e8c8",text_sec:"#b0a870",text_dim:"#706840",border:"rgba(212,200,64,0.22)",border_solid:"#3a3820"},
};

window.api.getCngmTheme().then(name => {
    const t = name && CNGM_THEMES[name];
    if (t) {
        const s = document.documentElement.style;
        s.setProperty('--bg',           t.bg);
        s.setProperty('--bg_panel',     t.bg_panel);
        s.setProperty('--bg_menu',      t.bg_menu);
        s.setProperty('--accent',       t.accent);
        s.setProperty('--text_main',    t.text_main);
        s.setProperty('--text_sec',     t.text_sec);
        s.setProperty('--text_dim',     t.text_dim);
        s.setProperty('--border',       t.border);
        s.setProperty('--border_solid', t.border_solid);
    }
    window.api.signalReady();
});

// ── State ─────────────────────────────────────────────────────────────────────
let allGames = [];
let _logIndex = new Set();
let selectedId = null;

// ── View switching ─────────────────────────────────────────────────────────────
const viewGames    = document.getElementById('view-games');
const viewSettings = document.getElementById('view-settings');

document.querySelectorAll('.nav-btn[data-view]').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.nav-btn[data-view]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const v = btn.dataset.view;
        viewGames.style.display    = v === 'games'    ? 'flex' : 'none';
        viewSettings.style.display = v === 'settings' ? 'block' : 'none';
        if (v === 'settings') loadSettings();
    });
});

// ── Window controls ───────────────────────────────────────────────────────────
document.getElementById('btn-min').addEventListener('click',   () => window.api.minimize());
document.getElementById('btn-max').addEventListener('click',   () => window.api.maximize());
document.getElementById('btn-close').addEventListener('click', () => window.api.close());

// ── Tool status indicators ────────────────────────────────────────────────────
async function checkTools() {
    const tools = await window.api.checkTools();
    function setDot(id, value) {
        const el = document.getElementById(id);
        if (!el) return;
        el.querySelector('.dot').className = 'dot ' + (value ? 'ok' : 'err');
        el.title = value || 'Not found';
    }
    setDot('status-legendary', tools.legendary);
    setDot('status-gogdl',     tools.gogdl);
    setDot('status-umu',       tools.umu);
    setDot('status-wine',      tools.wine);

    // Show install button only when umu is missing
    const umuWrap = document.getElementById('umu-install-wrap');
    if (umuWrap) umuWrap.style.display = tools.umu ? 'none' : 'flex';

    const info = document.getElementById('tools-info');
    if (!info) return;
    info.innerHTML = [
        `<strong style="color:var(--text_main)">legendary</strong>: ${
            tools.legendary
                ? (tools.legendary_bundled
                    ? `<span style="color:#66bb6a">✓ bundled (${tools.legendary})</span>`
                    : `<span style="color:#ffb74d">⚠ system install (${tools.legendary})</span>`)
                : '<span style="color:#ef5350">not found</span>'
        }`,
        `<strong style="color:var(--text_main)">gogdl</strong>: ${
            tools.gogdl
                ? (tools.gogdl_bundled
                    ? `<span style="color:#66bb6a">✓ bundled (${tools.gogdl})</span>`
                    : `<span style="color:#ffb74d">⚠ system install (${tools.gogdl})</span>`)
                : '<span style="color:var(--text_dim)">not found — required for GOG installation. Place gogdl binary next to GRINDER.AppImage.</span>'
        }`,
        `<strong style="color:var(--text_main)">umu-run</strong>: ${
            tools.umu
                ? `<span style="color:#66bb6a">✓ ${tools.umu}</span>`
                : '<span style="color:#ffb74d">not found — install via package manager for best compatibility. GRINDER will use direct Proton invocation as fallback.</span>'
        }`,
        `<strong style="color:var(--text_main)">wine</strong>: ${
            tools.wine
                ? `<span style="color:#66bb6a">✓ ${tools.wine}</span>`
                : '<span style="color:var(--text_dim)">not found (optional — only needed as last resort)</span>'
        }`,
    ].join('<br><br>');
}
checkTools();

// ── Welcome screen ────────────────────────────────────────────────────────────
const _welcomeModal = document.getElementById('modal-welcome');

async function showWelcome() {
    // Populate tools status in welcome modal
    const tools = await window.api.checkTools();
    const wlcInfo = document.getElementById('wlc-tools-info');
    if (wlcInfo) {
        const row = (label, found, note) => `
            <div style="display:flex; align-items:baseline; gap:8px;">
                <span style="font-weight:900; color:var(--text_main); min-width:90px;">${label}</span>
                ${found
                    ? `<span style="color:#66bb6a;">✓ found</span>`
                    : `<span style="color:var(--text_dim);">${note}</span>`}
            </div>`;
        wlcInfo.innerHTML = [
            row('legendary', tools.legendary, '✗ not found — required for Epic Games. Bundled with GRINDER or install via package manager.'),
            row('gogdl',     tools.gogdl,     '✗ not found — required for GOG games. Place gogdl binary next to GRINDER.AppImage.'),
            row('umu-run',   tools.umu,       '⚠ not found — recommended for best compatibility. Install via Settings → External Tools.'),
            row('wine',      tools.wine,      '— not found (optional — only needed as last resort if no Proton is set)'),
        ].join('');
    }
    _welcomeModal.classList.add('active');
}

function closeWelcome() {
    _welcomeModal.classList.remove('active');
    if (document.getElementById('wlc-dont-show')?.checked) {
        window.api.setSetting('welcome_shown', '1');
    }
}

document.getElementById('btn-wlc-close')?.addEventListener('click', closeWelcome);
_welcomeModal?.addEventListener('click', e => { if (e.target === _welcomeModal) closeWelcome(); });

document.getElementById('btn-show-welcome')?.addEventListener('click', () => showWelcome());

// Show on launch unless user opted out
window.api.getSetting('welcome_shown').then(shown => { if (!shown) showWelcome(); });

// ── Games list ────────────────────────────────────────────────────────────────
function storeBadge(store) {
    const map = { epic: 'badge-epic', gog: 'badge-gog', custom: 'badge-custom' };
    const cls = map[store] || 'badge-custom';
    return `<span class="game-store-badge ${cls}">${store}</span>`;
}

function renderGames(games) {
    const list  = document.getElementById('games-list');
    const count = document.getElementById('status-count');
    count.textContent = `${games.length} game${games.length !== 1 ? 's' : ''}`;

    if (!games.length) {
        list.innerHTML = `<div id="empty-state"><p>NO GAMES YET</p><p style="font-size:11px">Click + Add Custom Game or + Add Game Folder to get started.</p></div>`;
        return;
    }

    list.innerHTML = games.map(g => `
        <div class="game-row ${g.id === selectedId ? 'selected' : ''}" data-id="${g.id}">
            <div class="game-row-main">
                ${storeBadge(g.store)}
                <span class="game-title">${g.title}</span>
                <div class="game-actions">
                    ${g.installed  ? `<button class="btn-launch" data-launch="${g.id}">▶ Launch</button>` : ''}
                    ${!g.installed && g.store === 'epic' ? `<button class="btn-install-game" data-install="${g.id}" style="background:#0078f2;border:none;color:#fff;border-radius:4px;padding:4px 10px;font-family:Raleway,sans-serif;font-weight:900;font-size:10px;cursor:pointer;letter-spacing:0.5px;">↓ Install</button>` : ''}
                    ${!g.installed && g.store === 'gog'  ? `<button class="btn-install-game" data-install="${g.id}" style="background:#9b59d9;border:none;color:#fff;border-radius:4px;padding:4px 10px;font-family:Raleway,sans-serif;font-weight:900;font-size:10px;cursor:pointer;letter-spacing:0.5px;">↓ Install</button>` : ''}
                    <button class="btn-edit" data-edit="${g.id}">Edit</button>
                    ${_logIndex.has(g.id) ? `<button class="btn-see-log" data-see-log="${g.id}">See Log</button>` : ''}
                    ${g.installed ? `<button class="btn-uninstall" data-uninstall="${g.id}">Uninstall</button>` : ''}
                    <button class="btn-delete" data-delete="${g.id}">✕</button>
                </div>
            </div>
            <div class="game-row-sub">
                ${g.installed && g.install_path ? `<span data-size="${g.id}" class="game-size-badge">…</span>` : ''}
                <span class="game-status ${g.installed ? 'status-installed' : 'status-uninstalled'}">
                    ${g.installed ? '● Installed' : '○ Not installed'}
                </span>
            </div>
        </div>
    `).join('');

    // Row selection
    list.querySelectorAll('.game-row').forEach(row => {
        row.addEventListener('click', () => {
            selectedId = row.dataset.id;
            renderGames(filterGames());
        });
    });

    // Launch buttons
    list.querySelectorAll('[data-launch]').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const id = btn.dataset.launch;
            const title = allGames.find(g=>g.id===id)?.title || '';
            showNowPlaying(title);
            setStatus(`Launching "${title}"...`);
            btn.disabled = true;
            const result = await window.api.launchGame(id);
            btn.disabled = false;
            _logIndex.add(id);
            renderGames(filterGames());
            if (!result.ok) { closeNowPlaying(); setStatus(`Error: ${result.error}`); }
            else setStatus(`Launched via ${result.method}.`);
        });
    });

    // Install buttons
    list.querySelectorAll('[data-install]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const game = allGames.find(g => g.id === btn.dataset.install);
            if (game) openInstallModal(game);
        });
    });

    // Edit buttons
    list.querySelectorAll('[data-edit]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            openModal(allGames.find(g => g.id === btn.dataset.edit));
        });
    });

    // Delete buttons
    list.querySelectorAll('[data-delete]').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const game = allGames.find(g => g.id === btn.dataset.delete);
            const confirmed = await showConfirm(
                `Remove ${game?.title}?`,
                `This will remove <span style="color:var(--text_main)">${game?.title}</span> from GRINDER's library.<br><br>
                 <span style="color:#66bb6a; font-size:11px;">Game files on disk are NOT deleted.</span>`
            );
            if (!confirmed) return;
            await window.api.deleteGame(game.id);
            if (selectedId === game.id) selectedId = null;
            await loadGames();
        });
    });

    // See Log buttons
    list.querySelectorAll('[data-see-log]').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const game = allGames.find(g => g.id === btn.dataset.seeLog);
            if (!game) return;
            openLogModal(game.id, game.title);
        });
    });

    // Uninstall buttons
    list.querySelectorAll('[data-uninstall]').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const game = allGames.find(g => g.id === btn.dataset.uninstall);
            if (!game) return;
            const confirmed = await showConfirm(
                `Uninstall ${game.title}?`,
                `This will permanently delete:<br><br>
                 <span style="color:var(--text_main)">● Game files</span><br>
                 <span style="color:var(--text_dim); font-size:11px;">${game.install_path || '(unknown path)'}</span><br><br>
                 <span style="color:var(--text_main)">● Wine prefix</span><br>
                 <span style="color:var(--text_dim); font-size:11px;">All save data and settings for this game</span><br><br>
                 <span style="color:#ef5350; font-size:11px; font-weight:900;">This cannot be undone.</span>`
            );
            if (!confirmed) return;
            btn.textContent = 'Removing…';
            btn.disabled = true;
            const result = await window.api.uninstallGameFiles(game.id);
            setStatus(result.ok ? `"${game.title}" uninstalled.` : `Error: ${result.error}`);
            await loadGames();
        });
    });
}

// ── Filters ───────────────────────────────────────────────────────────────────
let installFilter = 'all'; // 'all' | 'installed' | 'uninstalled'
let storeFilter   = 'all'; // 'all' | 'epic' | 'gog' | 'custom'

function buildFilterBar() {
    const bar = document.getElementById('filter-bar');
    if (!bar) return;

    const stores = [...new Set(allGames.map(g => g.store).filter(Boolean))].sort();
    const storeButtons = stores.map(s => {
        const cls = `fs-${s}`;
        const label = s.charAt(0).toUpperCase() + s.slice(1);
        return `<button class="filter-btn ${cls}" data-store="${s}">${label}</button>`;
    }).join('');

    bar.innerHTML = `
        <button class="filter-btn fi-all ${installFilter==='all'?'active':''}" data-install="all">All</button>
        <button class="filter-btn fi-installed ${installFilter==='installed'?'active':''}" data-install="installed">● Installed</button>
        <button class="filter-btn fi-uninst ${installFilter==='uninstalled'?'active':''}" data-install="uninstalled">○ Not installed</button>
        <div class="filter-sep"></div>
        ${storeButtons}
    `;

    bar.querySelectorAll('[data-store]').forEach(btn => {
        if (btn.dataset.store === storeFilter) btn.classList.add('active');
    });

    bar.querySelectorAll('[data-install]').forEach(btn => {
        btn.addEventListener('click', () => {
            installFilter = btn.dataset.install;
            bar.querySelectorAll('[data-install]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderGames(filterGames());
        });
    });

    bar.querySelectorAll('[data-store]').forEach(btn => {
        btn.addEventListener('click', () => {
            storeFilter = storeFilter === btn.dataset.store ? 'all' : btn.dataset.store;
            bar.querySelectorAll('[data-store]').forEach(b => b.classList.remove('active'));
            if (storeFilter !== 'all') btn.classList.add('active');
            renderGames(filterGames());
        });
    });
}

function filterGames() {
    const q = document.getElementById('search-input').value.toLowerCase();
    return allGames.filter(g => {
        if (g.is_dlc) return false;
        if (q && !g.title.toLowerCase().includes(q) &&
            !(g.store||'').toLowerCase().includes(q) &&
            !(g.app_id||'').toLowerCase().includes(q)) return false;
        if (installFilter === 'installed'   && !g.installed) return false;
        if (installFilter === 'uninstalled' &&  g.installed) return false;
        if (storeFilter !== 'all' && (g.store||'').toLowerCase() !== storeFilter) return false;
        return true;
    });
}

async function loadGames() {
    [allGames] = await Promise.all([
        window.api.getGames(),
        window.api.getLogIndex().then(ids => { _logIndex = new Set(ids); }),
    ]);
    buildFilterBar();
    renderGames(filterGames());
    await loadGameSizes();
}

async function loadGameSizes() {
    // Single batch IPC — all du calls run in parallel on the main process side,
    // one response comes back, one synchronous DOM pass updates all badges.
    const sizes = await window.api.getAllDiskSizes();
    for (const { id, size } of sizes) {
        if (!size) continue;
        const el = document.querySelector(`[data-size="${id}"]`);
        if (el) el.textContent = size;
    }
}

let _searchDebounce = null;
document.getElementById('search-input').addEventListener('input', () => {
    clearTimeout(_searchDebounce);
    _searchDebounce = setTimeout(() => renderGames(filterGames()), 150);
});

document.getElementById('btn-verify-installs')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-verify-installs');
    btn.textContent = 'Checking...';
    btn.disabled = true;
    const { reset } = await window.api.verifyInstalls();
    await loadGames();
    btn.textContent = 'Refresh & Check Size';
    btn.disabled = false;
    setStatus(reset > 0
        ? `Reset ${reset} game${reset !== 1 ? 's' : ''} with missing files — ready to reinstall.`
        : 'All installed games verified OK.');
});

// ── Modal: Add / Edit game ─────────────────────────────────────────────────────
const modal = document.getElementById('modal-game');

function openModal(game = null) {
    document.getElementById('modal-title').textContent = game ? 'Edit Game' : 'Add Game';
    document.getElementById('edit-id').value           = game?.id           || '';
    document.getElementById('edit-title').value        = game?.title        || '';
    document.getElementById('edit-store').value        = game?.store        || 'custom';
    document.getElementById('edit-appid').value        = game?.app_id       || '';
    document.getElementById('edit-install-path').value = game?.install_path || '';
    document.getElementById('edit-exe').value          = game?.executable   || '';
    document.getElementById('edit-launch-args').value = game?.launch_args  || '';
    const hasCustomExe = !!(game?.custom_exe);
    document.getElementById('edit-custom-exe-enabled').checked = hasCustomExe;
    document.getElementById('edit-custom-exe').value           = game?.custom_exe || '';
    document.getElementById('edit-custom-exe-fields').style.display = hasCustomExe ? 'flex' : 'none';
    document.getElementById('edit-prefix').value       = game?.prefix_path  || '';
    populateProtonDropdown(protonVersions, game?.proton_path || '');
    document.getElementById('edit-notes').value        = game?.notes        || '';
    document.getElementById('edit-env').value              = game?.custom_env    || '';
    document.getElementById('edit-winetricks').value       = game?.winetricks    || '';
    document.getElementById('edit-esync').checked          = game ? (game.use_esync    !== 0) : true;
    document.getElementById('edit-fsync').checked          = game ? (game.use_fsync    !== 0) : true;
    document.getElementById('edit-dxvk-nvapi').checked     = !!(game?.use_dxvk_nvapi);
    document.getElementById('edit-battleye').checked       = !!(game?.use_battleye);
    document.getElementById('edit-eac').checked            = !!(game?.use_eac);
    const isGog = (game?.store === 'gog');
    const isGogOrEpic = isGog || game?.store === 'epic';
    document.getElementById('edit-gog-compat').style.display    = isGog       ? 'flex' : 'none';
    document.getElementById('edit-verify-repair').style.display = isGogOrEpic ? 'flex' : 'none';
    document.getElementById('edit-achievements').style.display  = isGog       ? 'flex' : 'none';

    // Load play tasks for launch target dropdown (GOG only)
    const launchTargetRow = document.getElementById('edit-launch-target-row');
    const launchTargetSel = document.getElementById('edit-launch-target');
    launchTargetSel.innerHTML = '<option value="">Default executable</option>';
    launchTargetRow.style.display = 'none';
    if (game?.id && isGog) {
        window.api.getPlayTasks(game.id).then(tasks => {
            if (!tasks || tasks.length <= 1) return;
            tasks.forEach(t => {
                const opt = document.createElement('option');
                opt.value = t.path;
                opt.textContent = t.name + (t.isPrimary ? ' (default)' : '');
                if (game.launch_target === t.path) opt.selected = true;
                launchTargetSel.appendChild(opt);
            });
            launchTargetRow.style.display = 'flex';
        });
        if (game.app_id) loadAchievements(game.app_id);
    } else {
        clearAchievements();
    }

    modal.classList.add('active');
    document.getElementById('edit-title').focus();
}

function closeModal() { modal.classList.remove('active'); }

document.getElementById('btn-add-game').addEventListener('click', () => openModal());
document.getElementById('btn-modal-cancel').addEventListener('click', closeModal);
modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });

// ── Add Game Folder ───────────────────────────────────────────────────────────
let _afolderSelected = null; // {type:'library', game, executable} | {type:'custom', title, executable}
let _afolderExes     = [];

function openAddFolderModal() {
    _afolderSelected = null;
    _afolderExes     = [];
    document.getElementById('afolder-path').value                   = '';
    document.getElementById('afolder-scan-section').style.display   = 'none';
    document.getElementById('afolder-scan-section').innerHTML       = '';
    document.getElementById('afolder-has-prefix').checked           = false;
    document.getElementById('afolder-prefix-row').style.display     = 'none';
    document.getElementById('afolder-prefix-path').value            = '';
    document.getElementById('btn-afolder-import').disabled          = true;
    document.getElementById('modal-add-folder').classList.add('active');
}

function closeAddFolderModal() {
    document.getElementById('modal-add-folder').classList.remove('active');
}

async function doAfolderScan() {
    const p = document.getElementById('afolder-path').value.trim();
    if (!p) return;

    const section = document.getElementById('afolder-scan-section');
    section.style.display = 'block';
    section.innerHTML = `<div style="font-size:12px; color:var(--text_dim); padding:10px 2px; letter-spacing:1px;">Scanning folder…</div>`;
    document.getElementById('btn-afolder-import').disabled = true;

    const result = await window.api.scanGameFolder(p);

    if (!result.ok) {
        section.innerHTML = `<div style="padding:11px 14px; background:rgba(239,83,80,0.07); border:1px solid rgba(239,83,80,0.3); border-radius:6px; font-size:12px; color:#ef5350;">✗ ${result.error || 'Could not read folder. Check the path and permissions.'}</div>`;
        return;
    }

    _afolderExes = result.exes || [];

    // Match detected markers against the local library
    const libraryMatches = [];
    for (const d of (result.detected || [])) {
        for (const g of allGames) {
            if (g.store === d.store && g.app_id === d.app_id) {
                libraryMatches.push({ game: g, detected: d });
            }
        }
    }

    renderAfolderResults(libraryMatches, result.detected || []);
}

function renderAfolderResults(libraryMatches, detected) {
    const section = document.getElementById('afolder-scan-section');
    const exes = _afolderExes;

    const storeColor = s => s === 'gog' ? '#9b59d9' : s === 'epic' ? '#4a9eff' : 'var(--accent)';
    const storeLabel = s => s === 'gog' ? 'GOG' : s === 'epic' ? 'EPIC' : (s || '').toUpperCase();

    if (libraryMatches.length === 0) {
        // No match — custom game
        const guessTitle = exes[0]?.replace(/\.(exe|bat|sh)$/i, '') || '';
        _afolderSelected = { type: 'custom', title: guessTitle, executable: exes[0] || '' };

        const noMatchDetail = detected.length > 0
            ? `<span style="font-size:11px; color:var(--text_dim); margin-top:4px; display:block; line-height:1.5;">Detected: ${detected.map(d => `<strong>${d.app_id}</strong> (${d.store})`).join(', ')} — not found in your library.</span>`
            : '';

        const exeOpts = exes.length > 0
            ? `<div class="modal-row" style="margin:10px 0 0;">
                <label>Executable <span style="font-size:11px; font-weight:400; color:var(--text_dim);">(relative to folder)</span></label>
                <select id="afolder-exe-sel" style="background:var(--bg); border:1px solid var(--border_solid); color:var(--text_main); border-radius:5px; padding:7px 10px; font-family:Raleway,sans-serif; font-size:13px; width:100%;">
                    <option value="">Leave blank — set later</option>
                    ${exes.map(e => `<option value="${e}" ${e === exes[0] ? 'selected' : ''}>${e}</option>`).join('')}
                </select>
               </div>`
            : '';

        section.innerHTML = `
            <div style="padding:11px 14px; background:rgba(255,179,0,0.05); border:1px solid rgba(255,179,0,0.25); border-radius:6px; margin-bottom:12px;">
                <div style="font-size:9px; font-weight:900; color:#ffb300; letter-spacing:2px; margin-bottom:4px;">NO LIBRARY MATCH</div>
                <div style="font-size:12px; color:var(--text_dim); line-height:1.5;">No matching game found in your library. Enter a title to add this as a custom game.</div>
                ${noMatchDetail}
            </div>
            <div class="modal-row" style="margin:0;">
                <label>Game Title <span style="color:#ef5350; font-weight:900;">*</span></label>
                <input id="afolder-custom-title" placeholder="Enter a name for this game" value="${guessTitle}">
            </div>
            ${exeOpts}`;

        const titleEl = document.getElementById('afolder-custom-title');
        const importBtn = document.getElementById('btn-afolder-import');
        importBtn.disabled = !titleEl?.value.trim();
        titleEl?.addEventListener('input', e => {
            _afolderSelected.title = e.target.value;
            importBtn.disabled = !e.target.value.trim();
        });
        document.getElementById('afolder-exe-sel')?.addEventListener('change', e => { _afolderSelected.executable = e.target.value; });

    } else if (libraryMatches.length === 1) {
        const m = libraryMatches[0];
        _afolderSelected = { type: 'library', game: m.game, executable: m.detected.executable };
        const sc = storeColor(m.game.store);
        const sl = storeLabel(m.game.store);

        section.innerHTML = `
            <div style="padding:13px 16px; background:rgba(102,187,106,0.06); border:1px solid rgba(102,187,106,0.3); border-radius:6px;">
                <div style="font-size:9px; font-weight:900; color:#66bb6a; letter-spacing:2px; margin-bottom:7px;">MATCH FOUND</div>
                <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                    <span style="font-size:15px; font-weight:900; color:var(--text_main);">${m.game.title}</span>
                    <span style="font-size:9px; font-weight:900; color:${sc}; background:rgba(0,0,0,0.3); padding:2px 8px; border-radius:3px; letter-spacing:1.5px;">${sl}</span>
                </div>
                <div style="font-size:11px; color:var(--text_dim); margin-top:6px; line-height:1.5;">This folder will be linked to the existing library entry — no re-download needed.</div>
            </div>`;
        document.getElementById('btn-afolder-import').disabled = false;

    } else {
        // Multiple matches — show radio chooser
        _afolderSelected = { type: 'library', game: libraryMatches[0].game, executable: libraryMatches[0].detected.executable };

        const radioItems = libraryMatches.map((m, i) => {
            const sc = storeColor(m.game.store);
            const sl = storeLabel(m.game.store);
            return `<label style="display:flex; align-items:center; gap:10px; padding:9px 13px; background:rgba(255,255,255,0.03); border:1px solid var(--border_solid); border-radius:5px; cursor:pointer;">
                <input type="radio" name="afolder-match" value="${i}" ${i === 0 ? 'checked' : ''} style="accent-color:var(--accent); flex-shrink:0;">
                <span style="font-size:13px; font-weight:700; color:var(--text_main); flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${m.game.title}</span>
                <span style="font-size:9px; font-weight:900; color:${sc}; background:rgba(0,0,0,0.3); padding:2px 8px; border-radius:3px; letter-spacing:1.5px; flex-shrink:0;">${sl}</span>
            </label>`;
        }).join('');

        section.innerHTML = `
            <div style="padding:11px 14px; background:rgba(255,179,0,0.05); border:1px solid rgba(255,179,0,0.25); border-radius:6px; margin-bottom:10px;">
                <div style="font-size:9px; font-weight:900; color:#ffb300; letter-spacing:2px; margin-bottom:4px;">MULTIPLE MATCHES</div>
                <div style="font-size:12px; color:var(--text_dim);">More than one library entry matched. Select the correct one.</div>
            </div>
            <div id="afolder-match-list" style="display:flex; flex-direction:column; gap:4px; margin-bottom:4px;">
                ${radioItems}
                <label style="display:flex; align-items:center; gap:10px; padding:9px 13px; background:rgba(255,255,255,0.02); border:1px solid var(--border_solid); border-radius:5px; cursor:pointer;">
                    <input type="radio" name="afolder-match" value="none" style="accent-color:var(--accent); flex-shrink:0;">
                    <span style="font-size:12px; color:var(--text_dim);">None of these — add as custom game</span>
                </label>
            </div>
            <div id="afolder-custom-section" style="display:none; margin-top:8px;">
                <div class="modal-row" style="margin:0;">
                    <label>Game Title <span style="color:#ef5350; font-weight:900;">*</span></label>
                    <input id="afolder-custom-title" placeholder="Enter a name for this game">
                </div>
            </div>`;

        document.getElementById('btn-afolder-import').disabled = false;

        document.getElementById('afolder-match-list').querySelectorAll('input[name=afolder-match]').forEach(radio => {
            radio.addEventListener('change', e => {
                const v = e.target.value;
                const customSec = document.getElementById('afolder-custom-section');
                const importBtn = document.getElementById('btn-afolder-import');
                if (v === 'none') {
                    _afolderSelected = { type: 'custom', title: '', executable: _afolderExes[0] || '' };
                    customSec.style.display = 'block';
                    const ti = document.getElementById('afolder-custom-title');
                    importBtn.disabled = !ti?.value.trim();
                    ti?.addEventListener('input', ev => {
                        _afolderSelected.title = ev.target.value;
                        importBtn.disabled = !ev.target.value.trim();
                    });
                } else {
                    const m = libraryMatches[parseInt(v)];
                    _afolderSelected = { type: 'library', game: m.game, executable: m.detected.executable };
                    customSec.style.display = 'none';
                    importBtn.disabled = false;
                }
            });
        });
    }
}

// Wire up Add Game Folder buttons
document.getElementById('btn-add-game-folder').addEventListener('click', openAddFolderModal);
document.getElementById('btn-afolder-cancel').addEventListener('click', closeAddFolderModal);
document.getElementById('modal-add-folder').addEventListener('click', e => { if (e.target === document.getElementById('modal-add-folder')) closeAddFolderModal(); });

document.getElementById('btn-afolder-browse').addEventListener('click', async () => {
    const p = await window.api.selectDirectory();
    if (p) document.getElementById('afolder-path').value = p;
});

document.getElementById('btn-afolder-scan').addEventListener('click', doAfolderScan);

document.getElementById('afolder-has-prefix').addEventListener('change', e => {
    document.getElementById('afolder-prefix-row').style.display = e.target.checked ? 'flex' : 'none';
});

document.getElementById('btn-afolder-browse-prefix').addEventListener('click', async () => {
    const p = await window.api.selectDirectory();
    if (p) document.getElementById('afolder-prefix-path').value = p;
});

document.getElementById('btn-afolder-import').addEventListener('click', async () => {
    if (!_afolderSelected) return;
    const folderPath = document.getElementById('afolder-path').value.trim();
    if (!folderPath) return;

    const hasPrefix  = document.getElementById('afolder-has-prefix').checked;
    const prefixPath = hasPrefix ? (document.getElementById('afolder-prefix-path').value.trim() || null) : null;

    if (_afolderSelected.type === 'library') {
        const update = { install_path: folderPath, installed: 1 };
        if (_afolderSelected.executable) update.executable = _afolderSelected.executable;
        if (prefixPath)                  update.prefix_path = prefixPath;
        await window.api.updateGame(_afolderSelected.game.id, update);
        setStatus(`"${_afolderSelected.game.title}" linked to folder.`);
    } else {
        const title = document.getElementById('afolder-custom-title')?.value.trim() || 'Imported Game';
        const exe   = document.getElementById('afolder-exe-sel')?.value || null;
        await window.api.addGame({
            title,
            store:        'custom',
            install_path: folderPath,
            executable:   exe         || null,
            prefix_path:  prefixPath  || null,
            installed:    1,
        });
        setStatus(`"${title}" added to library.`);
    }

    closeAddFolderModal();
    await loadGames();
});

document.getElementById('btn-modal-save').addEventListener('click', async () => {
    const id    = document.getElementById('edit-id').value;
    const title = document.getElementById('edit-title').value.trim();
    if (!title) { alert('Title is required.'); return; }

    const data = {
        title,
        store:        document.getElementById('edit-store').value,
        app_id:       document.getElementById('edit-appid').value.trim()        || null,
        install_path: document.getElementById('edit-install-path').value.trim() || null,
        executable:   document.getElementById('edit-exe').value.trim()           || null,
        prefix_path:  document.getElementById('edit-prefix').value.trim()        || null,
        proton_path:  document.getElementById('edit-proton').value                || null,
        notes:        document.getElementById('edit-notes').value.trim()          || null,
        custom_env:    document.getElementById('edit-env').value.trim()           || null,
        winetricks:    document.getElementById('edit-winetricks').value.trim()    || null,
        use_esync:     document.getElementById('edit-esync').checked     ? 1 : 0,
        use_fsync:     document.getElementById('edit-fsync').checked     ? 1 : 0,
        use_dxvk_nvapi:document.getElementById('edit-dxvk-nvapi').checked? 1 : 0,
        use_battleye:  document.getElementById('edit-battleye').checked  ? 1 : 0,
        use_eac:          document.getElementById('edit-eac').checked            ? 1 : 0,
        launch_target:    document.getElementById('edit-launch-target').value      || null,
        launch_args:      document.getElementById('edit-launch-args').value.trim() || null,
        custom_exe:       document.getElementById('edit-custom-exe-enabled').checked
                            ? (document.getElementById('edit-custom-exe').value.trim() || null)
                            : null,
        installed:     document.getElementById('edit-install-path').value.trim() ? 1 : 0,
    };

    if (id) {
        await window.api.updateGame(id, data);
        setStatus(`Updated "${title}".`);
    } else {
        const newId = await window.api.addGame(data);
        setStatus(`Added "${title}" (ID: ${newId}).`);
    }
    closeModal();
    await loadGames();
});

// Toggle store-specific sections when store changes inside the modal
document.getElementById('edit-store').addEventListener('change', e => {
    const isGog = e.target.value === 'gog';
    const isGogOrEpic = isGog || e.target.value === 'epic';
    document.getElementById('edit-gog-compat').style.display    = isGog       ? 'flex' : 'none';
    document.getElementById('edit-verify-repair').style.display = isGogOrEpic ? 'flex' : 'none';
    document.getElementById('edit-achievements').style.display  = isGog       ? 'flex' : 'none';
    if (!isGog) document.getElementById('edit-launch-target-row').style.display = 'none';
});

// ── Compat modal (winetricks / redist) ────────────────────────────────────────
const modalCompat = document.getElementById('modal-compat');

function openCompatModal(title) {
    document.getElementById('modal-compat-title').textContent = title;
    document.getElementById('modal-compat-output').textContent = '';
    document.getElementById('btn-compat-close').style.display = 'none';
    document.getElementById('modal-compat-spinner').style.display = 'inline';
    modalCompat.classList.add('active');
}

function appendCompatLine(line) {
    const out = document.getElementById('modal-compat-output');
    out.textContent += line + '\n';
    out.scrollTop = out.scrollHeight;
}

function finishCompatModal(ok, msg) {
    document.getElementById('modal-compat-spinner').style.display = 'none';
    document.getElementById('btn-compat-close').style.display = 'inline-block';
    if (msg) appendCompatLine('\n' + (ok ? '✓ ' : '✗ ') + msg);
}

document.getElementById('btn-compat-close').addEventListener('click', () => {
    modalCompat.classList.remove('active');
});

window.api.onWinetricksProgress(data => {
    if (data.line)   appendCompatLine(data.line);
    if (data.done)   finishCompatModal(data.ok, data.msg);
});

window.api.onRedistProgress(data => {
    if (data.line)   appendCompatLine(data.line);
    if (data.done)   finishCompatModal(data.ok, data.msg);
});

// Browse install folder
document.getElementById('btn-browse-install').addEventListener('click', async () => {
    const p = document.getElementById('edit-install-path').value.trim();
    if (!p) { showAlert('Browse', 'Enter an install path first.'); return; }
    const err = await window.api.openPath(p);
    if (err) showAlert('Browse', `Could not open folder: ${err}`);
});

// Toggle custom exe input visibility
document.getElementById('edit-custom-exe-enabled').addEventListener('change', e => {
    document.getElementById('edit-custom-exe-fields').style.display = e.target.checked ? 'flex' : 'none';
});

// Browse for custom executable (file picker)
document.getElementById('btn-browse-custom-exe').addEventListener('click', async () => {
    const p = await window.api.selectFile();
    if (p) document.getElementById('edit-custom-exe').value = p;
});

// Browse prefix folder
document.getElementById('btn-browse-prefix').addEventListener('click', async () => {
    let p = document.getElementById('edit-prefix').value.trim();
    if (!p) {
        // Fall back to the resolved default prefix for this game
        const gameId = document.getElementById('edit-id').value;
        if (gameId) p = await window.api.getGamePrefix(gameId);
    }
    if (!p) { showAlert('Browse', 'No prefix path set and game not saved yet.'); return; }
    const err = await window.api.openPath(p);
    if (err) showAlert('Browse', `Could not open folder: ${err}`);
});

// Run .exe in Game Folder button
document.getElementById('btn-run-exe-in-game-folder').addEventListener('click', async () => {
    const gameId = document.getElementById('edit-id').value;
    if (!gameId) { showAlert('Run .exe', 'Save the game first so the install folder and prefix can be resolved.'); return; }
    const result = await window.api.runExeInGameFolder(gameId);
    if (result && !result.ok && !result.canceled) showAlert('Run .exe', result.error || 'Could not launch executable.');
});

// Run .exe on Prefix button
document.getElementById('btn-run-exe-on-prefix').addEventListener('click', async () => {
    const gameId = document.getElementById('edit-id').value;
    if (!gameId) { showAlert('Run .exe', 'Save the game first so the prefix can be resolved.'); return; }
    const result = await window.api.runExeOnPrefix(gameId);
    if (result && !result.ok && !result.canceled) showAlert('Run .exe', result.error || 'Could not launch executable.');
});

// Run Winetricks button
document.getElementById('btn-run-winetricks').addEventListener('click', async () => {
    const tricks = document.getElementById('edit-winetricks').value.trim();
    if (!tricks) { showAlert('Winetricks', 'Enter at least one component (e.g. vcrun2019).'); return; }
    const gameId = document.getElementById('edit-id').value;
    if (!gameId) { showAlert('Winetricks', 'Save the game first so a prefix can be resolved.'); return; }

    const { found } = await window.api.checkWinetricks();
    if (!found) { showAlert('Winetricks', 'winetricks not found. Install it via your package manager.'); return; }

    const prefix = await window.api.getGamePrefix(gameId);
    if (!prefix) { showAlert('Winetricks', 'Could not resolve Wine prefix for this game.'); return; }

    openCompatModal('Winetricks — ' + (document.getElementById('edit-title').value || gameId));
    window.api.runWinetricks(prefix, tricks);
});

// Install GOG Compat Files button
document.getElementById('btn-install-redist').addEventListener('click', async () => {
    const gameId = document.getElementById('edit-id').value;
    if (!gameId) { showAlert('GOG Compat', 'Save the game first.'); return; }
    const game = allGames.find(g => g.id === gameId);
    if (!game) return;
    if (game.store !== 'gog') { showAlert('GOG Compat', 'This is only available for GOG games.'); return; }
    if (!game.install_path) { showAlert('GOG Compat', 'Game has no install path — install it first.'); return; }
    const appId  = game.app_id;
    const plat   = game.platform || 'windows';
    const prefix = await window.api.getGamePrefix(game.id);
    openCompatModal('GOG Compat Files — ' + game.title);
    window.api.gogInstallRedist(appId, plat, game.install_path, prefix, game.proton_path || null);
});

// ── GOG Achievements ──────────────────────────────────────────────────────────

function clearAchievements() {
    document.getElementById('achievements-list').innerHTML = '';
    document.getElementById('achievements-summary').style.display = 'none';
    document.getElementById('achievements-status').style.display  = 'none';
}

function renderAchievements(achievements) {
    const list = document.getElementById('achievements-list');
    const summary = document.getElementById('achievements-summary');
    list.innerHTML = '';

    if (!achievements.length) {
        list.innerHTML = '<span style="font-size:12px; color:var(--text_dim); font-style:italic;">No achievements found. Click Sync Now to fetch them.</span>';
        summary.style.display = 'none';
        return;
    }

    const unlocked = achievements.filter(a => a.date_unlocked).length;
    summary.textContent = `${unlocked} / ${achievements.length} unlocked`;
    summary.style.display = 'block';

    for (const a of achievements) {
        const isUnlocked = !!a.date_unlocked;
        const row = document.createElement('div');
        row.style.cssText = `display:flex; align-items:center; gap:10px; padding:7px 10px; border-radius:5px; background:${isUnlocked ? 'rgba(101,180,101,0.08)' : 'rgba(255,255,255,0.03)'}; border:1px solid ${isUnlocked ? 'rgba(101,180,101,0.25)' : 'rgba(255,255,255,0.06)'};`;

        const iconUrl = isUnlocked ? a.image_unlocked : a.image_locked;
        if (iconUrl) {
            const img = document.createElement('img');
            img.src = iconUrl;
            img.style.cssText = 'width:32px; height:32px; border-radius:3px; object-fit:cover; flex-shrink:0;';
            img.onerror = () => { img.style.display = 'none'; };
            row.appendChild(img);
        } else {
            const placeholder = document.createElement('div');
            placeholder.style.cssText = 'width:32px; height:32px; border-radius:3px; background:rgba(255,255,255,0.06); flex-shrink:0;';
            row.appendChild(placeholder);
        }

        const info = document.createElement('div');
        info.style.cssText = 'flex:1; min-width:0;';
        const title = document.createElement('div');
        title.style.cssText = `font-size:12px; font-weight:700; color:${isUnlocked ? '#82c882' : 'var(--text_sec)'}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;`;
        title.textContent = a.name || a.key;
        info.appendChild(title);
        if (a.description) {
            const desc = document.createElement('div');
            desc.style.cssText = 'font-size:11px; color:var(--text_dim); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;';
            desc.textContent = a.description;
            info.appendChild(desc);
        }
        if (isUnlocked) {
            const date = document.createElement('div');
            date.style.cssText = 'font-size:10px; color:rgba(130,200,130,0.6); margin-top:2px;';
            try { date.textContent = new Date(a.date_unlocked).toLocaleDateString(); } catch { date.textContent = a.date_unlocked; }
            info.appendChild(date);
        }
        row.appendChild(info);
        list.appendChild(row);
    }
}

async function loadAchievements(appId) {
    document.getElementById('achievements-list').innerHTML = '';
    document.getElementById('achievements-summary').style.display = 'none';
    const statusEl = document.getElementById('achievements-status');
    statusEl.textContent = 'Loading…';
    statusEl.style.display = 'block';

    const res = await window.api.getGogAchievements(appId);
    statusEl.style.display = 'none';
    if (res.ok && res.achievements.length) {
        renderAchievements(res.achievements);
    } else {
        document.getElementById('achievements-list').innerHTML =
            '<span style="font-size:12px; color:var(--text_dim); font-style:italic;">No cached achievements. Click Sync Now to fetch from GOG.</span>';
    }
}

document.getElementById('btn-sync-achievements').addEventListener('click', async () => {
    const gameId = document.getElementById('edit-id').value;
    if (!gameId) { showAlert('Achievements', 'Save the game first.'); return; }
    const game = allGames.find(g => g.id == gameId);
    if (!game?.app_id) return;

    const btn = document.getElementById('btn-sync-achievements');
    const statusEl = document.getElementById('achievements-status');
    btn.disabled = true;
    btn.textContent = 'Syncing…';
    statusEl.textContent = 'Fetching from GOG…';
    statusEl.style.display = 'block';

    const res = await window.api.fetchGogAchievements(game.app_id);
    btn.disabled = false;
    btn.textContent = 'Sync Now';

    if (!res.ok) {
        const msg = res.error === 'not_logged_in' ? 'Not logged in to GOG.'
                  : res.error === 'no_user_id'    ? 'GOG user ID not found — log in first.'
                  : res.error;
        statusEl.textContent = `✗ ${msg}`;
        return;
    }
    statusEl.style.display = 'none';
    await loadAchievements(game.app_id);
});

// Verify & Repair button
document.getElementById('btn-verify-repair').addEventListener('click', async () => {
    const gameId = document.getElementById('edit-id').value;
    if (!gameId) { showAlert('Verify & Repair', 'Save the game first.'); return; }
    const game = allGames.find(g => g.id == gameId);
    if (!game) return;
    if (game.store !== 'gog' && game.store !== 'epic')
        { showAlert('Verify & Repair', 'Only available for GOG and Epic games.'); return; }
    if (!game.install_path)
        { showAlert('Verify & Repair', 'Game has no install path — install it first.'); return; }
    closeModal();
    beginRepair(game);
});

async function beginRepair(game) {
    activeInstallGame = game;
    installingGame    = game;
    installActive     = true;
    _miniPct          = 0;

    document.getElementById('install-modal-title').textContent      = 'Verify & Repair';
    document.getElementById('install-modal-subtitle').textContent   = game.title;
    document.getElementById('install-config-panel').style.display   = 'none';
    document.getElementById('install-progress-panel').style.display = 'flex';
    document.getElementById('install-done-panel').style.display     = 'none';
    document.getElementById('install-log').textContent              = '';
    document.getElementById('install-progress-bar').style.width     = '0%';
    document.getElementById('install-pct-label').textContent        = '0%';
    document.getElementById('install-speed-label').textContent      = '';
    document.getElementById('install-eta-label').textContent        = '';
    const cancelBtn = document.getElementById('btn-install-cancel-running');
    cancelBtn.disabled    = false;
    cancelBtn.textContent = 'Cancel';
    cancelBtn.className   = 'btn-danger modal-actions';
    cancelBtn.style.cssText = 'padding:9px 18px; border-radius:5px; font-family:Raleway,sans-serif; font-weight:900; font-size:14px; cursor:pointer; align-self:flex-start;';
    cancelBtn.onclick = null;

    if (!installModalMinimized) modalInstall.classList.add('active');
    else updateMiniWidget(0);
    setStatus(`Verifying ${game.title}...`);

    const result = game.store === 'gog'
        ? await window.api.gogRepair(game.id)
        : await window.api.epicRepair(game.id);

    installActive = false;
    document.getElementById('install-progress-panel').style.display = 'none';

    if (result.ok) {
        activeInstallGame = null;
        document.getElementById('install-done-msg').textContent = `${game.title} — Repair complete!`;
        const sub = document.getElementById('install-done-sub');
        if (sub) sub.textContent = 'All game files verified and repaired.';
        document.getElementById('install-done-panel').style.display = 'flex';
        setStatus(`${game.title} repaired successfully.`);
        updateMiniWidget();
    } else {
        document.getElementById('install-log').textContent +=
            `\n✗ Repair failed (${result.exitCode ?? result.error ?? 'error'}).\n`;
        document.getElementById('install-progress-panel').style.display = 'flex';
        const cb = document.getElementById('btn-install-cancel-running');
        cb.textContent  = 'Close';
        cb.className    = 'btn-cancel';
        cb.style.cssText = 'padding:9px 18px; border-radius:5px; font-family:Raleway,sans-serif; font-weight:900; font-size:14px; cursor:pointer; align-self:flex-start;';
        cb.onclick = closeInstallModal;
        setStatus(`Repair of ${game.title} failed.`);
        activeInstallGame = null;
        if (installModalMinimized) restoreInstallModal();
        updateMiniWidget();
    }
}

// ── Installation ──────────────────────────────────────────────────────────────
const modalInstall    = document.getElementById('modal-install');
let installingGame    = null; // game shown in modal config panel
let activeInstallGame = null; // game actually running in background
let selectedPlatform  = null; // platform choice for current config
let installQueue      = [];   // [{game, dir, platform}] waiting their turn
let installHistory    = [];   // [{game, success, completedAt}]
let installActive     = false;
let installModalMinimized = false;
let dlmModalOpen      = false;
let _miniPct          = 0;

function openInstallModal(game) {
    installingGame = game;
    const isDlc = !!game.is_dlc;

    document.getElementById('install-modal-title').textContent    = isDlc ? 'Install DLC' : 'Install Game';
    document.getElementById('install-modal-subtitle').textContent = game.title;
    document.getElementById('install-config-panel').style.display   = 'flex';
    document.getElementById('install-progress-panel').style.display = 'none';
    document.getElementById('install-done-panel').style.display     = 'none';
    document.getElementById('install-log').textContent = '';
    document.getElementById('install-progress-bar').style.width = '0%';
    document.getElementById('install-pct-label').textContent = '0%';
    document.getElementById('install-speed-label').textContent = '';
    document.getElementById('install-eta-label').textContent = '';

    // Swap label/hint for DLC vs game
    const dirLabel = document.getElementById('install-dir-label');
    const dirHint  = document.getElementById('install-dir-hint');
    if (dirLabel) dirLabel.textContent = isDlc ? 'Base Game Folder' : 'Install Directory';
    if (dirHint)  dirHint.textContent  = isDlc
        ? 'Select the folder where the base game is already installed. DLC files will be merged into it.'
        : 'The game will be installed inside a subfolder here. Make sure you have enough disk space.';

    // Platform selector — show only for GOG games with multiple platforms available
    const platRow    = document.getElementById('install-platform-row');
    const platLinux  = document.getElementById('plat-linux');
    const platWin    = document.getElementById('plat-windows');
    const availPlats = (game.platforms || game.platform || '').split(',').filter(Boolean);
    const hasChoice  = game.store === 'gog' && availPlats.includes('linux') && availPlats.includes('windows');

    selectedPlatform = game.platform || 'windows';

    if (platRow) platRow.style.display = hasChoice ? 'flex' : 'none';
    if (hasChoice) {
        const setPlat = p => {
            selectedPlatform = p;
            platLinux.classList.toggle('active', p === 'linux');
            platWin.classList.toggle('active', p === 'windows');
            fetchInstallSizes();
        };
        setPlat(selectedPlatform);
        platLinux.onclick  = () => setPlat('linux');
        platWin.onclick    = () => setPlat('windows');
    }

    if (isDlc) {
        // Try to auto-fill with the base game's install_path via title-prefix match
        const sep = game.title.search(/\s[–—-]\s/);
        const basePrefix = (sep > 0 ? game.title.slice(0, sep) : game.title.split(':')[0]).trim().toLowerCase();
        const baseGame = allGames.find(g =>
            !g.is_dlc && g.store === 'gog' && g.installed && g.install_path &&
            g.title.toLowerCase().startsWith(basePrefix)
        );
        document.getElementById('install-dir-input').value = baseGame?.install_path || '';
        fetchInstallSizes();
    } else {
        // Pre-fill install dir from settings, then fetch sizes
        window.api.getSetting('default_install_dir').then(d => {
            document.getElementById('install-dir-input').value = d || '~/Games/CafeNeurotico';
            fetchInstallSizes();
        });
    }

    updateInstallQueueBadge();
    modalInstall.classList.add('active');
}

function updateInstallQueueBadge() {
    const badge = document.getElementById('install-queue-badge');
    if (!badge) return;
    if (installQueue.length > 0) {
        badge.style.display = 'inline';
        badge.textContent   = `+${installQueue.length} QUEUED`;
    } else {
        badge.style.display = 'none';
    }
}

function updateMiniWidget(pct) {
    const widget = document.getElementById('install-mini');
    if (!widget) return;
    const show = installModalMinimized && installActive;
    widget.style.display = show ? 'flex' : 'none';
    if (!show) return;
    document.getElementById('mini-game-name').textContent = activeInstallGame?.title || '…';
    if (pct !== undefined) {
        _miniPct = pct;
        document.getElementById('mini-bar').style.width  = pct + '%';
        document.getElementById('mini-pct').textContent  = pct.toFixed(1) + '%';
    }
    const qc = document.getElementById('mini-queue-count');
    if (installQueue.length > 0) {
        qc.style.display = 'inline';
        qc.textContent   = `+${installQueue.length} queued`;
    } else {
        qc.style.display = 'none';
    }
}

function minimizeInstallModal() {
    modalInstall.classList.remove('active');
    installModalMinimized = true;
    updateMiniWidget(_miniPct);
}

function restoreInstallModal() {
    installModalMinimized = false;
    updateMiniWidget(); // hide widget
    modalInstall.classList.add('active');
}

// ── Download Manager Modal ─────────────────────────────────────────────────────

function openDlmModal() {
    dlmModalOpen = true;
    document.getElementById('modal-dlm').classList.add('active');
    renderDlmModal();
}

function closeDlmModal() {
    dlmModalOpen = false;
    document.getElementById('modal-dlm').classList.remove('active');
}

function updateDlmProgress(pct, speed, eta) {
    if (!dlmModalOpen) return;
    if (pct !== null) {
        document.getElementById('dlm-bar').style.width = pct + '%';
        document.getElementById('dlm-pct').textContent = pct.toFixed(1) + '%';
    }
    if (speed) document.getElementById('dlm-speed').textContent = speed;
    if (eta)   document.getElementById('dlm-eta').textContent   = 'ETA ' + eta;
}

function renderDlmModal() {
    if (!dlmModalOpen) return;

    const hasActive  = installActive && !!activeInstallGame;
    const hasQueue   = installQueue.length > 0;
    const hasHistory = installHistory.length > 0;

    // Active section
    const activeSection = document.getElementById('dlm-active-section');
    activeSection.style.display = hasActive ? 'flex' : 'none';
    if (hasActive) {
        document.getElementById('dlm-active-title').textContent = activeInstallGame.title;
        const storeEl = document.getElementById('dlm-active-store');
        if (activeInstallGame.store === 'gog')       { storeEl.textContent = 'GOG';        storeEl.style.color = '#9b59d9'; }
        else if (activeInstallGame.store === 'epic') { storeEl.textContent = 'Epic Games'; storeEl.style.color = '#4a9eff'; }
        else                                          { storeEl.textContent = activeInstallGame.store || ''; storeEl.style.color = 'var(--text_dim)'; }
        document.getElementById('dlm-bar').style.width   = _miniPct + '%';
        document.getElementById('dlm-pct').textContent   = _miniPct.toFixed(1) + '%';
        document.getElementById('dlm-speed').textContent = '';
        document.getElementById('dlm-eta').textContent   = '';
    }

    // Queue section
    const queueSection = document.getElementById('dlm-queue-section');
    queueSection.style.display = hasQueue ? 'flex' : 'none';
    if (hasQueue) {
        document.getElementById('dlm-queue-label').textContent = `${installQueue.length} waiting`;
        const list = document.getElementById('dlm-queue-list');
        list.innerHTML = installQueue.map((item, idx) => {
            const sc = item.game.store === 'gog' ? '#9b59d9' : item.game.store === 'epic' ? '#4a9eff' : 'var(--text_dim)';
            const sl = item.game.store === 'gog' ? 'GOG' : item.game.store === 'epic' ? 'EPIC' : (item.game.store || '').toUpperCase();
            return `<div style="display:flex; align-items:center; gap:12px; padding:10px 14px; background:rgba(255,255,255,0.03); border:1px solid var(--border_solid); border-radius:6px;">
                <div style="width:6px; height:6px; border-radius:50%; background:var(--text_dim); flex-shrink:0;"></div>
                <div style="flex:1; min-width:0;">
                    <div style="font-size:13px; font-weight:700; color:var(--text_sec); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${item.game.title}</div>
                    <div style="font-size:10px; color:${sc}; margin-top:2px; letter-spacing:0.5px; font-weight:700;">${sl} · Waiting</div>
                </div>
                <button class="btn-dlm-cancel-queue" data-idx="${idx}" style="flex-shrink:0; padding:4px 10px; background:rgba(255,255,255,0.04); border:1px solid var(--border_solid); color:var(--text_dim); border-radius:4px; font-family:Raleway,sans-serif; font-weight:900; font-size:10px; letter-spacing:1px; cursor:pointer; text-transform:uppercase; transition:0.15s;">✕ Remove</button>
            </div>`;
        }).join('');
        list.querySelectorAll('.btn-dlm-cancel-queue').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.dataset.idx);
                installQueue.splice(idx, 1);
                updateInstallQueueBadge();
                updateMiniWidget();
                renderDlmModal();
            });
        });
    }

    // History section
    const histSection = document.getElementById('dlm-history-section');
    histSection.style.display = hasHistory ? 'flex' : 'none';
    if (hasHistory) {
        const list = document.getElementById('dlm-history-list');
        list.innerHTML = installHistory.map((item, idx) => {
            const col  = item.success ? '#66bb6a' : '#ef5350';
            const icon = item.success ? '✓' : '✗';
            const statusText = item.success ? 'Installed successfully' : 'Installation failed';
            const sc = item.game.store === 'gog' ? '#9b59d9' : item.game.store === 'epic' ? '#4a9eff' : 'var(--text_dim)';
            const sl = item.game.store === 'gog' ? 'GOG' : item.game.store === 'epic' ? 'EPIC' : (item.game.store || '').toUpperCase();
            return `<div style="display:flex; align-items:center; gap:12px; padding:10px 14px; background:rgba(255,255,255,0.02); border:1px solid var(--border_solid); border-radius:6px; opacity:0.85;">
                <div style="font-size:15px; font-weight:900; color:${col}; flex-shrink:0; width:16px; text-align:center; line-height:1;">${icon}</div>
                <div style="flex:1; min-width:0;">
                    <div style="font-size:13px; font-weight:700; color:var(--text_main); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${item.game.title}</div>
                    <div style="display:flex; gap:6px; align-items:center; margin-top:2px;">
                        <span style="font-size:10px; color:${sc}; font-weight:700; letter-spacing:0.5px;">${sl}</span>
                        <span style="font-size:10px; color:${col}; font-weight:700; letter-spacing:0.5px;">· ${statusText}</span>
                    </div>
                </div>
                <button class="btn-dlm-remove-history" data-idx="${idx}" style="flex-shrink:0; padding:4px 8px; background:transparent; border:1px solid var(--border_solid); color:var(--text_dim); border-radius:4px; font-family:Raleway,sans-serif; font-weight:900; font-size:10px; cursor:pointer; transition:0.15s;" title="Remove from history">✕</button>
            </div>`;
        }).join('');
        list.querySelectorAll('.btn-dlm-remove-history').forEach(btn => {
            btn.addEventListener('click', () => {
                installHistory.splice(parseInt(btn.dataset.idx), 1);
                renderDlmModal();
            });
        });
    }

    // Empty state
    document.getElementById('dlm-empty').style.display = (!hasActive && !hasQueue && !hasHistory) ? 'flex' : 'none';
}

function closeInstallModal() {
    modalInstall.classList.remove('active');
    installingGame = null;
    if (!installActive) {
        installModalMinimized = false;
        activeInstallGame = null;
        updateMiniWidget();
    }
    updateInstallQueueBadge();
}

function fmtBytes(b) {
    return b >= 1e9 ? (b / 1e9).toFixed(2) + ' GB' : (b / 1e6).toFixed(0) + ' MB';
}

async function fetchInstallSizes() {
    const el  = document.getElementById('install-size-text');
    const btn = document.getElementById('btn-install-start');
    if (!el || !installingGame) return;

    el.textContent = 'Fetching size info…';
    if (btn) { btn.disabled = false; btn.title = ''; }

    const dir = document.getElementById('install-dir-input').value.trim() || '~/Games/CafeNeurotico';

    const platform = selectedPlatform || installingGame.platform || 'windows';
    const [sizeInfo, available] = await Promise.all([
        installingGame.store === 'gog'
            ? window.api.gogInstallInfo(installingGame.app_id, platform)
            : window.api.epicInstallInfo(installingGame.app_id),
        window.api.getDiskSpace(dir),
    ]);

    if (!sizeInfo) { el.textContent = 'Size info unavailable.'; return; }

    const enough  = available === null || available >= sizeInfo.disk_size;
    const dlPart  = `Download: <strong style="color:var(--text_main)">${fmtBytes(sizeInfo.download_size)}</strong>`;
    const dkPart  = `On disk: <strong style="color:var(--text_main)">${fmtBytes(sizeInfo.disk_size)}</strong>`;
    const avColor = enough ? '#66bb6a' : '#ef5350';
    const avPart  = available !== null
        ? `Available: <strong style="color:${avColor}">${fmtBytes(available)}</strong>`
        : '';
    const warn    = !enough ? `<span style="color:#ef5350; font-weight:900;">⚠ Not enough space</span>` : '';

    el.innerHTML = [dlPart, dkPart, avPart, warn].filter(Boolean).join('<span style="color:var(--border_solid)"> · </span>');

    if (btn && !enough) {
        btn.disabled = true;
        btn.title = 'Not enough disk space';
    }
}

document.getElementById('btn-install-cancel-pre')?.addEventListener('click', closeInstallModal);
document.getElementById('btn-install-done')?.addEventListener('click', () => { closeInstallModal(); loadGames(); });

document.getElementById('btn-browse-install-dir')?.addEventListener('click', async () => {
    const dir = await window.api.selectDirectory();
    if (dir) { document.getElementById('install-dir-input').value = dir; fetchInstallSizes(); }
});

document.getElementById('btn-install-cancel-running')?.addEventListener('click', async () => {
    if (activeInstallGame?.store === 'gog') {
        await window.api.gogCancelInstall();
    } else {
        await window.api.cancelInstall();
    }
    document.getElementById('install-log').textContent += '\n⚠ Installation cancelled.\n';
    document.getElementById('btn-install-cancel-running').disabled = true;
    setStatus('Installation cancelled.');
    // Clear pending queue on explicit cancel
    installQueue = [];
    updateInstallQueueBadge();
});

// DLM modal controls
document.getElementById('btn-dlm-close')?.addEventListener('click', closeDlmModal);
document.getElementById('modal-dlm')?.addEventListener('click', e => { if (e.target === document.getElementById('modal-dlm')) closeDlmModal(); });

// Clicking the active-download card navigates back to the install modal console
document.getElementById('dlm-active-card')?.addEventListener('click', e => {
    if (e.target.closest('#dlm-btn-cancel-active')) return;
    if (!installActive) return;
    closeDlmModal();
    if (installModalMinimized) restoreInstallModal();
    else modalInstall.classList.add('active');
});

document.getElementById('dlm-btn-cancel-active')?.addEventListener('click', async () => {
    if (activeInstallGame?.store === 'gog') await window.api.gogCancelInstall();
    else await window.api.cancelInstall();
    installQueue = [];
    updateInstallQueueBadge();
    updateMiniWidget();
    renderDlmModal();
    setStatus('Installation cancelled.');
});

document.getElementById('dlm-btn-clear-all')?.addEventListener('click', () => {
    installHistory = [];
    window.api.saveInstallLog([]);
    renderDlmModal();
});

// Backdrop click: minimize when in progress, otherwise close
modalInstall.addEventListener('click', e => {
    if (e.target !== modalInstall) return;
    const inProgress = document.getElementById('install-progress-panel').style.display !== 'none';
    if (inProgress) minimizeInstallModal();
    else closeInstallModal();
});

// Mini widget click → open Download Manager
document.getElementById('install-mini')?.addEventListener('click', openDlmModal);

function parseProgress(line) {
    const pct   = line.match(/Progress:\s*([\d.]+)%/)?.[1];
    const speed = line.match(/([\d.]+\s*\w+\/s)/)?.[1];
    const eta   = line.match(/ETA:\s*([\d:]+)/)?.[1];
    return { pct: pct ? parseFloat(pct) : null, speed: speed || null, eta: eta || null };
}

window.api.onInstallProgress(data => {
    const log = document.getElementById('install-log');
    if (!log) return;
    log.textContent += data;
    log.scrollTop = log.scrollHeight;

    const { pct, speed, eta } = parseProgress(data);
    if (pct !== null) {
        document.getElementById('install-progress-bar').style.width = pct + '%';
        document.getElementById('install-pct-label').textContent = pct.toFixed(1) + '%';
        setStatus(`Installing ${activeInstallGame?.title || 'game'}: ${pct.toFixed(1)}%`);
        if (installModalMinimized) updateMiniWidget(pct);
    }
    if (speed) document.getElementById('install-speed-label').textContent = speed;
    if (eta) {
        document.getElementById('install-eta-label').textContent = 'ETA ' + eta;
        const me = document.getElementById('mini-eta');
        if (me) me.textContent = 'ETA ' + eta;
    }
    updateDlmProgress(pct, speed, eta);
});

// GOG install progress feeds the same install log/bar
window.api.onGogInstallProgress(data => {
    const log = document.getElementById('install-log');
    if (!log) return;
    const text = (typeof data === 'object') ? (data.line || '') : String(data);
    if (text) { log.textContent += text; log.scrollTop = log.scrollHeight; }
    if (typeof data === 'object' && data.done) {
        log.textContent += (data.ok ? '\n✓ ' : '\n✗ ') + (data.msg || '') + '\n';
        log.scrollTop = log.scrollHeight;
        return;
    }
    const { pct, speed, eta } = parseProgress(text);
    if (pct !== null) {
        document.getElementById('install-progress-bar').style.width = pct + '%';
        document.getElementById('install-pct-label').textContent = pct.toFixed(1) + '%';
        setStatus(`Installing ${activeInstallGame?.title || 'game'}: ${pct.toFixed(1)}%`);
        if (installModalMinimized) updateMiniWidget(pct);
    }
    if (speed) document.getElementById('install-speed-label').textContent = speed;
    if (eta) {
        document.getElementById('install-eta-label').textContent = 'ETA ' + eta;
        const me = document.getElementById('mini-eta');
        if (me) me.textContent = 'ETA ' + eta;
    }
    updateDlmProgress(pct, speed, eta);
});

document.getElementById('btn-install-start')?.addEventListener('click', async () => {
    if (!installingGame) return;
    const dir = document.getElementById('install-dir-input').value.trim();
    if (!dir) { setStatus('Choose an install directory first.'); return; }

    if (!installingGame.is_dlc) await window.api.setSetting('default_install_dir', dir);
    const platform = selectedPlatform || installingGame.platform || 'windows';

    if (installActive) {
        // Another install is running — queue this one
        const queued = installingGame;
        installQueue.push({ game: queued, dir, platform });
        installingGame = null;
        modalInstall.classList.remove('active');
        updateInstallQueueBadge();
        updateMiniWidget();
        setStatus(`"${queued.title}" added to install queue (${installQueue.length} in queue).`);
        return;
    }

    beginInstall(installingGame, dir, platform);
});

async function beginInstall(game, dir, platform) {
    activeInstallGame = game;
    installingGame    = game;
    selectedPlatform  = platform;
    installActive     = true;
    _miniPct          = 0;

    document.getElementById('install-modal-title').textContent      = 'Install Game';
    document.getElementById('install-modal-subtitle').textContent   = game.title;
    document.getElementById('install-config-panel').style.display   = 'none';
    document.getElementById('install-progress-panel').style.display = 'flex';
    document.getElementById('install-done-panel').style.display     = 'none';
    document.getElementById('install-log').textContent              = '';
    document.getElementById('install-progress-bar').style.width     = '0%';
    document.getElementById('install-pct-label').textContent        = '0%';
    document.getElementById('install-speed-label').textContent      = '';
    document.getElementById('install-eta-label').textContent        = '';
    const cancelBtn = document.getElementById('btn-install-cancel-running');
    cancelBtn.disabled    = false;
    cancelBtn.textContent = 'Cancel Download';
    cancelBtn.className   = 'btn-danger modal-actions';
    cancelBtn.style.cssText = 'padding:9px 18px; border-radius:5px; font-family:Raleway,sans-serif; font-weight:900; font-size:14px; cursor:pointer; align-self:flex-start;';
    cancelBtn.onclick = null;

    updateInstallQueueBadge();
    renderDlmModal();
    if (!installModalMinimized) modalInstall.classList.add('active');
    else updateMiniWidget(0);
    setStatus(`Starting installation of ${game.title}...`);

    let result;
    if (game.store === 'gog') {
        let baseAppId = null;
        if (game.is_dlc) {
            // Look up the base game by matching install_path so we can use
            // gogdl's --dlcs flag (requires the base game's app_id, not the DLC's)
            const base = allGames.find(g => !g.is_dlc && g.store === 'gog' && g.install_path === dir);
            baseAppId = base?.app_id || null;
        }
        result = await window.api.gogInstall(game.app_id, platform, dir, !!game.is_dlc, baseAppId);
    } else {
        result = await window.api.installGame(game.app_id, dir);
    }

    installActive = false;
    document.getElementById('install-progress-panel').style.display = 'none';

    if (result.ok) {
        if (game.store === 'gog') {
            const gi = result.gameInfo;
            await window.api.updateGame(game.id, {
                install_path: gi?.install_path || null,
                executable:   game.is_dlc ? null : (gi?.executable || null),
                platform,
                installed:    1,
            });
        } else {
            const info = result.info;
            if (info) {
                await window.api.updateGame(game.id, {
                    install_path: info.install_path || null,
                    executable:   info.executable   || null,
                    version:      info.version       || null,
                    installed:    1,
                });
            } else {
                await window.api.updateGame(game.id, { installed: 1 });
            }
        }
        installHistory.push({ game, success: true, completedAt: Date.now() });
        window.api.saveInstallLog(installHistory);
        setStatus(`${game.title} installed successfully.`);
        loadGames();

        if (installQueue.length > 0) {
            const next = installQueue.shift();
            updateInstallQueueBadge();
            updateMiniWidget();
            renderDlmModal();
            setStatus(`Next up: ${next.game.title}…`);
            setTimeout(() => beginInstall(next.game, next.dir, next.platform), 600);
        } else {
            activeInstallGame = null;
            renderDlmModal();
            if (installModalMinimized) {
                // Queue done while minimized — hide mini widget, open DLM to show history
                installModalMinimized = false;
                updateMiniWidget();
                openDlmModal();
            } else {
                document.getElementById('install-done-msg').textContent = game.is_dlc
                    ? `${game.title} — DLC installed!`
                    : `${game.title} installed!`;
                const sub = document.getElementById('install-done-sub');
                if (sub) sub.textContent = game.is_dlc
                    ? 'The DLC has been merged into the base game\'s installation folder.'
                    : 'The game is ready to launch from GRINDER.';
                document.getElementById('install-done-panel').style.display = 'flex';
                updateMiniWidget();
            }
        }
    } else {
        installHistory.push({ game, success: false, completedAt: Date.now() });
        window.api.saveInstallLog(installHistory);
        document.getElementById('install-log').textContent += `\n✗ Installation failed (exit ${result.exitCode ?? result.error ?? 'error'}).\n`;
        document.getElementById('install-progress-panel').style.display = 'flex';
        const cb = document.getElementById('btn-install-cancel-running');
        cb.textContent = 'Close';
        cb.className   = 'btn-cancel';
        cb.style.cssText = 'padding:9px 18px; border-radius:5px; font-family:Raleway,sans-serif; font-weight:900; font-size:14px; cursor:pointer; align-self:flex-start;';
        cb.onclick = closeInstallModal;
        setStatus(`Installation of ${game.title} failed.`);
        activeInstallGame = null;
        renderDlmModal();
        if (installModalMinimized) restoreInstallModal(); // show error in install modal
        updateMiniWidget();
        loadGames();
    }
}

// ── Legendary / Epic ──────────────────────────────────────────────────────────
let legendaryStatus = null;

async function refreshLegendaryStatus() {
    legendaryStatus = await window.api.legendaryStatus();
    const el = document.getElementById('s-legendary-status');
    const loginBtn  = document.getElementById('btn-s-epic-login');
    const logoutBtn = document.getElementById('btn-s-epic-logout');
    if (!el) return;
    if (!legendaryStatus.ok) {
        el.innerHTML = `<span style="color:#ef5350">legendary not found.</span>`;
        return;
    }
    if (legendaryStatus.logged_in) {
        el.innerHTML = `<span style="color:#66bb6a">✓ Logged in as <strong>${legendaryStatus.account}</strong></span>`;
        loginBtn.style.display  = 'none';
        logoutBtn.style.display = 'inline-block';
    } else {
        el.innerHTML = `<span style="color:var(--text_dim)">Not logged in to Epic Games.</span>`;
        loginBtn.style.display  = 'inline-block';
        logoutBtn.style.display = 'none';
    }
}

// Login flow (called from both Settings and Import modal)
async function doEpicLogin(progressElId) {
    const out = document.getElementById(progressElId);
    if (out) { out.style.display = 'block'; out.textContent = 'Opening Epic login window...\n'; }

    window.api.onLegendaryLoginProgress(data => {
        if (out) { out.textContent += data; out.scrollTop = out.scrollHeight; }
    });

    const result = await window.api.legendaryLogin();
    if (result.ok) {
        if (out) out.textContent += '\n✓ Login successful!\n';
        await refreshLegendaryStatus();
        return true;
    } else {
        if (out) out.textContent += `\n✗ ${result.error || 'Login failed.'}\n`;
        return false;
    }
}

document.getElementById('btn-s-epic-login')?.addEventListener('click', () => doEpicLogin(null));
document.getElementById('btn-s-epic-logout')?.addEventListener('click', async () => {
    await window.api.legendaryStatus(); // placeholder — legendary logout via CLI
    setStatus('Logged out of Epic.');
    await refreshLegendaryStatus();
});

// ── Import modal ──────────────────────────────────────────────────────────────
const modalImport   = document.getElementById('modal-import');
let importGames     = [];
let importSelected  = new Set();

// ── Import modal tab switching ─────────────────────────────────────────────────
function switchImportTab(tab) {
    ['epic','gog'].forEach(t => {
        document.getElementById(`tab-panel-${t}`).style.display = tab === t ? 'flex' : 'none';
        document.getElementById(`tab-${t}`).classList.toggle('active', tab === t);
    });
}
document.getElementById('tab-epic')?.addEventListener('click', () => switchImportTab('epic'));
document.getElementById('tab-gog')?.addEventListener('click',  () => { switchImportTab('gog'); loadGogImportData(); });

async function openImportModal(tab = 'epic') {
    modalImport.classList.add('active');
    switchImportTab(tab);
    if (tab === 'epic') await loadImportData();
    if (tab === 'gog')  await loadGogImportData();
}
function closeImportModal() { modalImport.classList.remove('active'); }

document.getElementById('btn-import-legendary')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-import-legendary');
    btn.disabled = true; btn.textContent = 'Fetching...';
    await openImportModal('epic');
    btn.disabled = false; btn.textContent = 'Sync Epic';
});
document.getElementById('btn-import-gog')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-import-gog');
    btn.disabled = true; btn.textContent = 'Fetching...';
    await openImportModal('gog');
    btn.disabled = false; btn.textContent = 'Sync GOG';
});
document.getElementById('btn-import-cancel')?.addEventListener('click', closeImportModal);
document.getElementById('btn-gog-import-cancel')?.addEventListener('click', closeImportModal);
modalImport?.addEventListener('click', e => { if (e.target === modalImport) closeImportModal(); });

document.getElementById('btn-epic-login')?.addEventListener('click', async () => {
    document.getElementById('btn-epic-login').disabled = true;
    document.getElementById('btn-epic-login').textContent = '⏳ Opening login window...';
    const ok = await doEpicLogin('login-output');
    document.getElementById('btn-epic-login').disabled = false;
    document.getElementById('btn-epic-login').textContent = ok ? '✓ Logged in' : 'Login to Epic Games';
    if (ok) loadImportData();
});

async function loadImportData() {
    const status = legendaryStatus || await window.api.legendaryStatus();
    const loginPanel  = document.getElementById('import-login-panel');
    const gamesPanel  = document.getElementById('import-games-panel');
    const emptyPanel  = document.getElementById('import-empty');
    const confirmBtn  = document.getElementById('btn-import-confirm');
    const accountEl   = document.getElementById('import-account');

    if (!status.logged_in) {
        loginPanel.style.display  = 'block';
        gamesPanel.style.display  = 'none';
        emptyPanel.style.display  = 'none';
        confirmBtn.style.display  = 'none';
        return;
    }

    loginPanel.style.display = 'none';
    accountEl.textContent    = `✓ ${status.account}`;
    setStatus('Fetching installed Epic games...');
    document.getElementById('epic-loading').style.display = 'block';

    const result = await window.api.legendaryListOwned();
    document.getElementById('epic-loading').style.display = 'none';
    if (!result.ok || !result.games.length) {
        gamesPanel.style.display = 'none';
        emptyPanel.style.display = 'block';
        confirmBtn.style.display = 'none';
        setStatus(result.ok ? 'No Epic games found in your library.' : `Error: ${result.error}`);
        return;
    }

    importGames = result.games;
    importSelected = new Set(importGames.map(g => g.app_name)); // select all by default
    gamesPanel.style.display = 'flex';
    emptyPanel.style.display = 'none';
    confirmBtn.style.display = 'inline-block';
    renderImportList();
    setStatus(`Found ${importGames.length} installed Epic game${importGames.length !== 1 ? 's' : ''}.`);
}

function renderImportList() {
    const list = document.getElementById('import-game-list');
    const countEl = document.getElementById('import-sel-count');
    countEl.textContent = `${importSelected.size} / ${importGames.length} selected`;

    // Check which are already in GRINDER DB
    list.innerHTML = importGames.map(g => {
        const alreadyIn = allGames.some(ag => ag.app_id === g.app_name && ag.store === 'epic');
        const checked   = importSelected.has(g.app_name);
        return `
        <label style="display:flex; align-items:center; gap:10px; padding:7px 10px; background:rgba(0,0,0,0.2); border-radius:5px; cursor:${alreadyIn ? 'default' : 'pointer'}; border:1px solid var(--border_solid);">
            <input type="checkbox" data-appname="${g.app_name}" ${checked && !alreadyIn ? 'checked' : ''} ${alreadyIn ? 'disabled' : ''} style="accent-color:var(--accent); width:14px; height:14px; flex-shrink:0;">
            <span style="flex:1; font-size:12px; font-weight:700; color:${alreadyIn ? 'var(--text_dim)' : 'var(--text_main)'};">${g.title}</span>
            <span style="font-size:10px; color:var(--text_dim);">${g.version || ''}</span>
            ${alreadyIn ? '<span style="font-size:10px; color:#66bb6a; font-weight:700;">Already imported</span>' : ''}
        </label>`;
    }).join('');

    list.querySelectorAll('input[type=checkbox]').forEach(cb => {
        cb.addEventListener('change', () => {
            if (cb.checked) importSelected.add(cb.dataset.appname);
            else            importSelected.delete(cb.dataset.appname);
            document.getElementById('import-sel-count').textContent = `${importSelected.size} / ${importGames.length} selected`;
        });
    });
}

document.getElementById('btn-import-select-all')?.addEventListener('click', () => {
    importSelected = new Set(importGames.filter(g => !allGames.some(ag => ag.app_id === g.app_name)).map(g => g.app_name));
    renderImportList();
});
document.getElementById('btn-import-select-none')?.addEventListener('click', () => {
    importSelected.clear(); renderImportList();
});

document.getElementById('btn-import-confirm')?.addEventListener('click', async () => {
    const toImport = importGames.filter(g => importSelected.has(g.app_name));
    if (!toImport.length) { setStatus('Nothing selected.'); return; }
    const result = await window.api.legendaryImport(toImport);
    if (result.ok) {
        setStatus(`Imported ${result.count} game${result.count !== 1 ? 's' : ''} from Epic.`);
        closeImportModal();
        await loadGames();
    } else {
        setStatus(`Import failed: ${result.error}`);
    }
});

// ── GOG import ────────────────────────────────────────────────────────────────
let gogImportGames    = [];
let gogImportSelected = new Set();

async function refreshGogStatus() {
    const s = await window.api.gogStatus();
    const el         = document.getElementById('s-gog-status');
    const loginBtn   = document.getElementById('btn-s-gog-login');
    const logoutBtn  = document.getElementById('btn-s-gog-logout');
    const gogdlEl    = document.getElementById('s-gogdl-status');
    if (el) {
        el.innerHTML = s.logged_in
            ? `<span style="color:#66bb6a">✓ Logged in as <strong>${s.username}</strong></span>`
            : `<span style="color:var(--text_dim)">Not logged in to GOG.</span>`;
    }
    if (loginBtn)  loginBtn.style.display  = s.logged_in ? 'none' : '';
    if (logoutBtn) logoutBtn.style.display = s.logged_in ? ''     : 'none';
    if (gogdlEl)   gogdlEl.innerHTML = s.gogdl
        ? `<span style="color:#66bb6a">✓ gogdl found</span>`
        : `<span style="color:var(--text_dim)">gogdl not found — place it next to GRINDER.AppImage</span>`;
}

document.getElementById('btn-s-gog-login')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-s-gog-login');
    btn.disabled = true; btn.textContent = '⏳ Opening login window...';
    window.api.onGogLoginProgress(() => {});
    const result = await window.api.gogLogin();
    btn.disabled = false; btn.textContent = 'Login to GOG';
    await refreshGogStatus();
    if (!result.ok) setStatus(`GOG login failed: ${result.error}`);
});

document.getElementById('btn-s-gog-logout')?.addEventListener('click', async () => {
    await window.api.gogLogout();
    await refreshGogStatus();
    setStatus('Logged out of GOG.');
});

async function loadGogImportData() {
    const loginPanel = document.getElementById('gog-login-panel');
    const gamesPanel = document.getElementById('gog-games-panel');
    const emptyPanel = document.getElementById('gog-empty');
    const confirmBtn = document.getElementById('btn-gog-import-confirm');
    const accountEl  = document.getElementById('gog-account');

    const s = await window.api.gogStatus();
    if (!s.logged_in) {
        loginPanel.style.display = 'block';
        gamesPanel.style.display = 'none';
        emptyPanel.style.display = 'none';
        confirmBtn.style.display = 'none';
        return;
    }

    loginPanel.style.display = 'none';
    accountEl.textContent = `✓ ${s.username}`;
    setStatus('Fetching GOG library...');
    confirmBtn.style.display = 'none';
    document.getElementById('gog-loading').style.display = 'block';

    const result = await window.api.gogListOwned();
    document.getElementById('gog-loading').style.display = 'none';
    if (!result.ok || !result.games.length) {
        gamesPanel.style.display = 'none';
        emptyPanel.style.display = 'block';
        setStatus(result.ok ? 'No GOG games found.' : `Error: ${result.error}`);
        return;
    }

    gogImportGames    = result.games;
    gogImportSelected = new Set(gogImportGames.map(g => g.id));

    // Silently update platforms column for games already in the library
    window.api.gogSyncPlatforms(gogImportGames).then(() => loadGames());

    gamesPanel.style.display = 'flex';
    emptyPanel.style.display = 'none';
    confirmBtn.style.display = '';
    renderGogImportList();
    setStatus(`Found ${gogImportGames.length} GOG game${gogImportGames.length !== 1 ? 's' : ''}.`);
}

function renderGogImportList() {
    const list    = document.getElementById('gog-game-list');
    const countEl = document.getElementById('gog-sel-count');
    countEl.textContent = `${gogImportSelected.size} / ${gogImportGames.length} selected`;
    list.innerHTML = gogImportGames.map(g => {
        const alreadyIn = allGames.some(ag => ag.app_id === g.id && ag.store === 'gog');
        const checked   = gogImportSelected.has(g.id);
        const platBadge = g.platform === 'linux'
            ? `<span style="font-size:9px;color:#66bb6a;font-weight:900;padding:1px 6px;border:1px solid rgba(102,187,106,0.4);border-radius:3px;">LINUX</span>`
            : `<span style="font-size:9px;color:#9b59d9;font-weight:900;padding:1px 6px;border:1px solid rgba(155,89,217,0.4);border-radius:3px;">WIN</span>`;
        return `
        <label style="display:flex;align-items:center;gap:10px;padding:7px 10px;background:rgba(0,0,0,0.2);border-radius:5px;cursor:${alreadyIn?'default':'pointer'};border:1px solid var(--border_solid);">
            <input type="checkbox" data-gogid="${g.id}" ${checked && !alreadyIn ? 'checked' : ''} ${alreadyIn ? 'disabled' : ''} style="accent-color:#9b59d9;width:14px;height:14px;flex-shrink:0;">
            <span style="flex:1;font-size:12px;font-weight:700;color:${alreadyIn?'var(--text_dim)':'var(--text_main)'};">${g.title}</span>
            ${platBadge}
            ${alreadyIn ? '<span style="font-size:10px;color:#66bb6a;font-weight:700;">Already imported</span>' : ''}
        </label>`;
    }).join('');
    list.querySelectorAll('input[type=checkbox]').forEach(cb => {
        cb.addEventListener('change', () => {
            if (cb.checked) gogImportSelected.add(cb.dataset.gogid);
            else            gogImportSelected.delete(cb.dataset.gogid);
            document.getElementById('gog-sel-count').textContent = `${gogImportSelected.size} / ${gogImportGames.length} selected`;
        });
    });
}

document.getElementById('btn-gog-select-all')?.addEventListener('click', () => {
    gogImportSelected = new Set(gogImportGames.filter(g => !allGames.some(ag => ag.app_id === g.id && ag.store === 'gog')).map(g => g.id));
    renderGogImportList();
});
document.getElementById('btn-gog-select-none')?.addEventListener('click', () => { gogImportSelected.clear(); renderGogImportList(); });

document.getElementById('btn-gog-login')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-gog-login');
    const out = document.getElementById('gog-login-output');
    btn.disabled = true; btn.textContent = '⏳ Opening login window...';
    out.style.display = 'block'; out.textContent = '';
    window.api.onGogLoginProgress(d => { out.textContent += d; out.scrollTop = out.scrollHeight; });
    const result = await window.api.gogLogin();
    btn.disabled = false; btn.textContent = result.ok ? '✓ Logged in' : 'Login to GOG';
    if (result.ok) { await refreshGogStatus(); loadGogImportData(); }
    else out.textContent += `\n✗ ${result.error}\n`;
});

document.getElementById('btn-gog-import-confirm')?.addEventListener('click', async () => {
    const toImport = gogImportGames.filter(g => gogImportSelected.has(g.id));
    if (!toImport.length) { setStatus('Nothing selected.'); return; }
    const result = await window.api.gogImport(toImport);
    if (result.ok) {
        setStatus(`Imported ${result.count} game${result.count !== 1 ? 's' : ''} from GOG.`);
        closeImportModal();
        await loadGames();
    } else {
        setStatus(`Import failed: ${result.error}`);
    }
});

// ── umu-run installer ─────────────────────────────────────────────────────────
window.api.onUmuInstallProgress(data => {
    const out = document.getElementById('umu-install-output');
    if (!out) return;
    out.style.display = 'block';
    out.textContent += data;
    out.scrollTop = out.scrollHeight;
});

document.getElementById('btn-install-umu')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-install-umu');
    const out = document.getElementById('umu-install-output');
    btn.disabled = true;
    btn.textContent = '⏳ Installing...';
    out.style.display = 'block';
    out.textContent = '';
    setStatus('Installing umu-run...');

    const result = await window.api.installUmu();

    if (result.ok) {
        out.textContent += `\n✓ Installed successfully via ${result.method}.\n  Restart GRINDER if umu-run is not detected yet.`;
        btn.textContent = '✓ Installed';
        btn.style.color = '#66bb6a';
        setStatus('umu-run installed. Re-checking tools...');
        await checkTools();
    } else {
        out.textContent += `\n✗ Failed (exit ${result.exitCode ?? 'error'}).\n${result.error || ''}`;
        btn.textContent = '✗ Failed — try again';
        btn.disabled = false;
        setStatus('umu-run installation failed.');
    }
});

// ── Proton versions ───────────────────────────────────────────────────────────
let protonVersions = []; // cache

const TYPE_LABEL = { ge: '🟠 GE-Proton', steam: '🔵 Steam Proton', other: '⚪ Other' };

function populateProtonDropdown(versions, selectedPath = '') {
    const sel = document.getElementById('edit-proton');
    const prev = sel.value || selectedPath;
    sel.innerHTML = '<option value="">Use system default</option>';
    for (const v of versions) {
        const opt = document.createElement('option');
        opt.value = v.path;
        opt.textContent = `${TYPE_LABEL[v.type] ?? v.type} — ${v.name}`;
        sel.appendChild(opt);
    }
    if (prev) sel.value = prev;
}

async function loadProtonVersions() {
    // Load cached list from DB first
    const cached = await window.api.getSetting('proton_versions_cache');
    if (cached) {
        try { protonVersions = JSON.parse(cached); }
        catch { protonVersions = []; }
    }
    populateProtonDropdown(protonVersions);
    renderProtonList(protonVersions);
}

function renderProtonList(versions) {
    const container = document.getElementById('proton-list');
    if (!versions.length) {
        container.innerHTML = '<span style="color:var(--text_dim)">No Proton versions found yet. Click Scan.</span>';
        return;
    }
    const defaultPath = document.getElementById('s-proton').value;
    container.innerHTML = versions.map(v => {
        const canDelete = v.path.includes('compatibilitytools.d');
        const delBtn = canDelete
            ? `<button onclick="deleteProton('${v.path.replace(/'/g, "\\'")}')" style="font-size:10px;font-weight:900;padding:3px 8px;border:1px solid #c62828;background:rgba(198,40,40,0.10);color:#ef5350;border-radius:3px;cursor:pointer;font-family:Raleway,sans-serif;" title="Uninstall this Proton version">Delete</button>`
            : '';
        return `
        <div style="display:flex;align-items:center;gap:10px;padding:6px 10px;background:rgba(0,0,0,0.2);border-radius:5px;border:1px solid var(--border_solid);">
            <span style="font-size:10px;font-weight:900;color:var(--accent);min-width:80px;">${TYPE_LABEL[v.type] ?? v.type}</span>
            <span style="flex:1;font-size:12px;color:var(--text_main);">${v.name}</span>
            <span style="font-size:10px;color:var(--text_dim);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:180px;" title="${v.path}">${v.path}</span>
            <button onclick="setDefaultProton('${v.path.replace(/'/g, "\\'")}')" style="font-size:10px;font-weight:900;padding:3px 8px;border:1px solid var(--border_solid);background:transparent;color:var(--text_sec);border-radius:3px;cursor:pointer;font-family:Raleway,sans-serif;${v.path===defaultPath?'border-color:var(--accent);color:var(--accent);':''}">${v.path===defaultPath?'✓ Default':'Set Default'}</button>
            ${delBtn}
        </div>`;
    }).join('');
}

window.setDefaultProton = async (p) => {
    document.getElementById('s-proton').value = p;
    await window.api.setSetting('default_proton_path', p);
    renderProtonList(protonVersions);
    setStatus(`Default Proton set: ${p.split('/').pop()}`);
};

window.deleteProton = async (p) => {
    const name = p.split('/').pop();
    const isDefault = document.getElementById('s-proton').value === p;
    const warning = isDefault ? `<br><br><strong style="color:#f57c00">⚠ This is your current default Proton. You'll need to set another one.</strong>` : '';
    const ok = await showConfirm('Uninstall Proton', `Delete <strong>${name}</strong> from disk?${warning}`);
    if (!ok) return;
    const result = await window.api.deleteProton(p);
    if (!result.ok) { showAlert('Delete failed', result.error); return; }
    if (isDefault) { document.getElementById('s-proton').value = ''; await window.api.setSetting('default_proton_path', ''); }
    protonVersions = await window.api.scanProton();
    renderProtonList(protonVersions);
    setStatus(`${name} uninstalled.`);
};

document.getElementById('btn-scan-proton').addEventListener('click', async () => {
    setStatus('Scanning for Proton versions...');
    document.getElementById('btn-scan-proton').textContent = '⏳ Scanning...';
    protonVersions = await window.api.scanProton();
    await window.api.setSetting('proton_versions_cache', JSON.stringify(protonVersions));
    populateProtonDropdown(protonVersions);
    renderProtonList(protonVersions);
    document.getElementById('btn-scan-proton').textContent = '🔍 Scan for Proton Versions';
    setStatus(`Found ${protonVersions.length} Proton version${protonVersions.length !== 1 ? 's' : ''}.`);
});

// ── Settings view ─────────────────────────────────────────────────────────────
async function loadSettings() {
    const [proton, prefixDir] = await Promise.all([
        window.api.getSetting('default_proton_path'),
        window.api.getSetting('default_prefix_dir'),
    ]);
    document.getElementById('s-proton').value      = proton    || '';
    document.getElementById('s-prefix-dir').value  = prefixDir || '';
    renderProtonList(protonVersions);
    await Promise.all([checkTools(), refreshLegendaryStatus(), refreshGogStatus()]);
}

document.getElementById('btn-save-settings').addEventListener('click', async () => {
    await window.api.setSetting('default_proton_path', document.getElementById('s-proton').value.trim());
    await window.api.setSetting('default_prefix_dir',  document.getElementById('s-prefix-dir').value.trim());
    setStatus('Settings saved.');
});

document.getElementById('btn-browse-config-dir')?.addEventListener('click', () => window.api.openConfigDir());

// Danger zone modals
document.getElementById('btn-reset-grinder')?.addEventListener('click', () => {
    document.getElementById('modal-reset-grinder').classList.add('active');
});
document.getElementById('btn-reset-grinder-cancel')?.addEventListener('click', () => {
    document.getElementById('modal-reset-grinder').classList.remove('active');
});
document.getElementById('btn-reset-grinder-confirm')?.addEventListener('click', async () => {
    document.getElementById('modal-reset-grinder').classList.remove('active');
    await window.api.resetGrinder();
    allGames = [];
    renderGames([]);
    setStatus('GRINDER has been reset.');
});

document.getElementById('btn-delete-grinder-data')?.addEventListener('click', () => {
    document.getElementById('modal-delete-grinder-data').classList.add('active');
});
document.getElementById('btn-delete-data-cancel')?.addEventListener('click', () => {
    document.getElementById('modal-delete-grinder-data').classList.remove('active');
});
document.getElementById('btn-delete-data-confirm')?.addEventListener('click', async () => {
    await window.api.deleteAllGrinderData();
});

// ── Log Modal ─────────────────────────────────────────────────────────────────
async function openLogModal(gameId, gameTitle) {
    const modal   = document.getElementById('modal-game-log');
    const titleEl = document.getElementById('log-modal-title');
    const content = document.getElementById('log-modal-content');
    const copyBtn = document.getElementById('btn-log-copy');
    if (!modal) return;

    titleEl.textContent = gameTitle;
    content.textContent = 'Loading…';
    modal.style.display = 'flex';

    const res = await window.api.getGameLog(gameId);
    if (!res.exists) {
        content.textContent = '(no log file found)';
        return;
    }
    content.textContent = res.content;

    copyBtn.onclick = async () => {
        await navigator.clipboard.writeText(res.content);
        const orig = copyBtn.textContent;
        copyBtn.textContent = 'Copied!';
        setTimeout(() => { copyBtn.textContent = orig; }, 1500);
    };
}

document.getElementById('btn-log-close')?.addEventListener('click', () => {
    document.getElementById('modal-game-log').style.display = 'none';
});

// ── GE-Proton downloader ──────────────────────────────────────────────────────
let _protonReleases = [];

document.getElementById('btn-proton-dl-load')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-proton-dl-load');
    const sel = document.getElementById('proton-dl-select');
    const status = document.getElementById('proton-dl-status');
    btn.disabled = true; btn.textContent = 'Loading...';
    const res = await window.api.getProtonReleases();
    btn.disabled = false; btn.textContent = 'Fetch Versions';
    if (!res.ok) { status.style.color = '#ef5350'; status.textContent = `Error: ${res.error}`; return; }
    _protonReleases = res.releases;
    sel.innerHTML = '<option value="">— Select a version —</option>' +
        _protonReleases.map(r => `<option value="${r.url}" data-tag="${r.tag}">${r.tag}  (${r.date})  —  ${(r.size/1e6).toFixed(0)} MB</option>`).join('');
    document.getElementById('btn-proton-dl-install').style.display = '';
    status.textContent = `${_protonReleases.length} versions available.`;
    status.style.color = 'var(--text_dim)';
});

document.getElementById('btn-proton-dl-install')?.addEventListener('click', async () => {
    const sel    = document.getElementById('proton-dl-select');
    const status = document.getElementById('proton-dl-status');
    const wrap   = document.getElementById('proton-dl-progress-wrap');
    const bar    = document.getElementById('proton-dl-bar');
    const msg    = document.getElementById('proton-dl-msg');
    const installBtn = document.getElementById('btn-proton-dl-install');
    if (!sel.value) { status.style.color = '#f57c00'; status.textContent = 'Select a version first.'; return; }
    const tag = sel.options[sel.selectedIndex].dataset.tag;
    installBtn.style.display = 'none';
    wrap.style.display = 'flex';
    bar.style.width = '0%';
    msg.textContent = 'Starting...';
    status.textContent = '';

    window.api.onProtonDlProgress(d => {
        bar.style.width = (d.percent || 0) + '%';
        msg.textContent = d.message || '';
        if (d.phase === 'done') {
            status.style.color = '#66bb6a';
            status.textContent = `✓ ${tag} installed. Click "Scan Proton Versions" to pick it up.`;
            wrap.style.display = 'none';
            installBtn.style.display = '';
        }
        if (d.phase === 'error') {
            status.style.color = '#ef5350';
            status.textContent = `✗ ${d.message}`;
            wrap.style.display = 'none';
            installBtn.style.display = '';
        }
    });

    const result = await window.api.downloadProton(sel.value, tag);
    if (!result.ok && result.error !== 'Download failed or cancelled.') {
        wrap.style.display = 'none';
        installBtn.style.display = '';
        status.style.color = '#ef5350';
        status.textContent = `✗ ${result.error}`;
    }
    if (result.ok) {
        // Auto-scan so the new version appears immediately
        protonVersions = await window.api.scanProton();
        renderProtonList(protonVersions);
    }
});

document.getElementById('btn-proton-dl-cancel')?.addEventListener('click', async () => {
    await window.api.cancelProtonDownload();
    document.getElementById('proton-dl-progress-wrap').style.display = 'none';
    document.getElementById('btn-proton-dl-install').style.display = '';
    document.getElementById('proton-dl-status').style.color = 'var(--text_dim)';
    document.getElementById('proton-dl-status').textContent = 'Cancelled.';
});

// ── Confirm modal ─────────────────────────────────────────────────────────────
function showConfirm(title, bodyHtml) {
    return new Promise(resolve => {
        const modal  = document.getElementById('modal-confirm');
        const okBtn  = document.getElementById('modal-confirm-ok');
        const canBtn = document.getElementById('modal-confirm-cancel');
        document.getElementById('modal-confirm-title').textContent = title;
        document.getElementById('modal-confirm-body').innerHTML    = bodyHtml;
        canBtn.style.display = '';
        okBtn.textContent = 'Uninstall';
        modal.classList.add('active');
        const done = (result) => {
            modal.classList.remove('active');
            okBtn.onclick = canBtn.onclick = modal.onclick = null;
            resolve(result);
        };
        okBtn.onclick  = () => done(true);
        canBtn.onclick = () => done(false);
        modal.onclick  = (e) => { if (e.target === modal) done(false); };
    });
}

function showAlert(title, msg) {
    return new Promise(resolve => {
        const modal  = document.getElementById('modal-confirm');
        const okBtn  = document.getElementById('modal-confirm-ok');
        const canBtn = document.getElementById('modal-confirm-cancel');
        document.getElementById('modal-confirm-title').textContent = title;
        document.getElementById('modal-confirm-body').innerHTML    = msg;
        canBtn.style.display = 'none';
        okBtn.textContent = 'OK';
        okBtn.style.background = 'transparent';
        okBtn.style.borderColor = 'var(--border_solid)';
        okBtn.style.color = 'var(--text_sec)';
        modal.classList.add('active');
        const done = () => {
            modal.classList.remove('active');
            okBtn.onclick = modal.onclick = null;
            okBtn.style.background = '';
            okBtn.style.borderColor = '';
            okBtn.style.color = '';
            resolve();
        };
        okBtn.onclick  = () => done();
        modal.onclick  = (e) => { if (e.target === modal) done(); };
    });
}

// ── Now Playing popup ─────────────────────────────────────────────────────────
let _npTimer = null;

function showNowPlaying(title) {
    const modal   = document.getElementById('modal-now-playing');
    const titleEl = document.getElementById('np-title');
    if (!modal) return;
    titleEl.textContent = title || '';
    modal.classList.add('active');
    clearTimeout(_npTimer);
    _npTimer = setTimeout(closeNowPlaying, 5000);
}

function closeNowPlaying() {
    clearTimeout(_npTimer);
    document.getElementById('modal-now-playing')?.classList.remove('active');
}

document.getElementById('modal-now-playing')?.addEventListener('click', e => {
    if (e.target === document.getElementById('modal-now-playing')) closeNowPlaying();
});
document.getElementById('np-close-btn')?.addEventListener('click', closeNowPlaying);
// ─────────────────────────────────────────────────────────────────────────────

// ── Status bar ────────────────────────────────────────────────────────────────
function setStatus(msg) { document.getElementById('status-msg').textContent = msg; }

// ── Keyboard shortcuts ────────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') { e.preventDefault(); openModal(); }
});

// ── CLI search (launched from CNGM with a game name) ─────────────────────────
// Opened by CNGM's "Setup with GRINDER" button — go straight to Edit modal for this game
window.api.onCliSetup(id => {
    const game = allGames.find(g => g.id === id);
    if (game) {
        openModal(game);
    } else {
        // Game not in library yet (shouldn't happen if CNGM wrote it first, but search as fallback)
        const input = document.getElementById('search-input');
        if (input) { input.value = id; renderGames(filterGames()); }
    }
});

window.api.onCliSync(tab => openImportModal(tab));

window.api.onCliSearch(term => {
    const input = document.getElementById('search-input');
    if (!input) return;
    input.value = term;
    // Switch to games view and filter
    document.querySelectorAll('.nav-btn[data-view]').forEach(b => b.classList.remove('active'));
    document.querySelector('.nav-btn[data-view="games"]')?.classList.add('active');
    document.getElementById('view-games').style.display    = 'flex';
    document.getElementById('view-settings').style.display = 'none';
    renderGames(filterGames());
    input.focus();
});

// ── Init ──────────────────────────────────────────────────────────────────────
window.api.getInstallLog().then(log => { if (log?.length) installHistory = log; });

document.getElementById('btn-open-dlm')?.addEventListener('click', openDlmModal);

loadProtonVersions();
refreshLegendaryStatus();
refreshGogStatus();

// Auto-verify on startup: check for missing game files, then load
window.api.verifyInstalls().then(({ reset }) => {
    loadGames();
    if (reset > 0) setStatus(`${reset} game${reset !== 1 ? 's' : ''} with missing files reset — ready to reinstall.`);
});
