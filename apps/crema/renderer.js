window.onerror = function(message, source, lineno) {
  const txt = document.getElementById('splash-text');
  if (txt) { txt.innerText = `ERR: ${message} (Line ${lineno})`; txt.style.color = "red"; }
};

let baseDir = ""; let sfxNav, sfxSelect, sfxBack; let bgmAudio = new Audio();
let audioCfg = { bgm: true, sfx: true, vol: 0.3, bgm_mode: "AMBIENT", theme: "CREMA (DEFAULT)", themeSource: "MANAGER", screensaver: "CN WALLPAPERS", screensaverDelay: 3, gamepadLayout: "XBOX", wakeMethod: "START + SELECT", startScreenMode: "CAROUSEL", browseMode: "LIST", gamepageStyle: "CLASSIC", homeEnabled: false, homeRows: ["recent","gems","played"] };
let customPlaylist = []; let customIndex = 0; let isCustom = false;
let npTimeout = null;

let strings = {};
let currentLang = 'en';
function t(key, vars = {}) {
  const val = key.split('.').reduce((o, k) => o?.[k], strings);
  if (!val) return key;
  return String(val).replace(/\{(\w+)\}/g, (_, k) => vars[k] !== undefined ? vars[k] : `{${k}}`);
}
const CAT_KEYS = { "ALL GAMES": "cat.all_games", "OTHERS": "cat.others", "PHYSICAL": "cat.physical", "EMULATION": "cat.emulation", "APPS": "cat.apps", "WANT TO PLAY": "cat.want", "FAVS": "cat.favs", "INSTALLED": "cat.installed" };

function isManualCategory(game) {
    if (game.GrinderGameId) return false;
    const s = (game.Store || '').toLowerCase();
    return /physical|others|emulation|apps/.test(s) && !/steam|epic|gog|itch|pico/.test(s);
}

function getInstallCommand(game) {
    const cmd = game.LaunchCommand || '';
    if (/grinder:\/\/launch/i.test(cmd)) {
        const m = cmd.match(/grinder:\/\/launch\/[^"\s]+/i);
        return m ? m[0] : null;
    }
    if (/steam:\/\/rungameid/i.test(cmd) && game.SteamAppID && String(game.SteamAppID).trim() !== '' && String(game.SteamAppID) !== 'None') {
        return `steam://install/${String(game.SteamAppID).replace(/\.0+$/, '')}`;
    }
    return null;
}

// ── GALLERY STATE ──────────────────────────────────────────────────────────
let galleryIndex = 0, galleryCatIndex = 0, galleryQuery = '';
let galleryGames = [], galleryCurrentGame = null, galleryNumRecent = 0;
let galleryMediaMode = 'cover'; // 'cover' | 'screenshot' | 'video'
let galleryScreenshots = [], galleryScreenIndex = 0, galleryScreenInterval = null;
let ggpFocus = 'BUTTONS'; // 'BUTTONS' | 'SS_BANNER' | 'CONTENT'
let ggpButtonIndex = 0;
let ggpButtonIds = [];   // built each time gamepage opens
let ggpSlideshowOpen = false;
let ggpTrailerMode = false;
let ggpSlideshowScreens = [];
let ggpSlideshowIndex = 0;
let ggpSsBannerInterval = null;
let ggpTrailerAvailable = false;
// ── SETUP SCREEN STATE ────────────────────────────────────────────────────
let setupPhase = 1;        // 1 = start screen, 2 = browse mode
let setupStartIndex = 0;   // 0=CAROUSEL 1=GRID
let setupBrowseIndex = 0;  // 0=LIST 1=GALLERY
// ───────────────────────────────────────────────────────────────────────────
function tCat(name) { const k = CAT_KEYS[name]; return k ? t(k) : name; }

function getLocalizedDescription(game) {
  if (game.Description_i18n) {
    try { const d = JSON.parse(game.Description_i18n); return d[currentLang] || d['en'] || game.Description || ''; } catch(e) {}
  }
  return game.Description || '';
}

function applyI18nToDOM() {
  document.querySelectorAll('[data-i18n]').forEach(el => { const v = t(el.getAttribute('data-i18n')); if (v) el.textContent = v; });
  document.querySelectorAll('[data-i18n-html]').forEach(el => { const v = t(el.getAttribute('data-i18n-html')); if (v) el.innerHTML = v; });
  document.querySelectorAll('[data-i18n-ph]').forEach(el => { const v = t(el.getAttribute('data-i18n-ph')); if (v) el.placeholder = v; });
}

let gameState = 'SPLASH';
let allGames = [], filteredGames = [];
let currentCategoryIndex = 0, currentGameIndex = 0, currentOverlayIndex = 0, currentSearchIndex = 0;
let overlayItems = [], searchResults = [];

// Default to 5 recent games for CREMA
let recentGamesCount = 9;
let _cremaHidePico8 = false; // when true, PICO-8 games show only inside the PICO-8 category
let numRecentInList = 0;

let trailerTimeout = null, screenshotInterval = null, bgmFadeInterval = null;
let screenshotArray = [], currentScreenshotIndex = 0;
let gameHasTrailer = false, mediaSwapped = false;
let activeThemeCategory = ""; let activeTheme = "CREMA (DEFAULT)";

let hasBooted = false; let idleTimer = null; let screensaverInterval = null; let ssClockInterval = null;
let screensaverStartTime = 0;
let availableScreenshots = []; let currentSSGame = null;
let availableWallpapers = [];
const delayOptions = [1, 2, 3, 4, 5, 10, 15, 30];

let _grinderConfirmGame = null; let _grinderInstallDir = ''; let _grinderProgressInterval = null; let _grinderProgressActive = false; let _grinderConfirmActive = false;
let _lpGame = null; let _lpList = []; let _lpIndex = 0;

let oskMode = 'SEARCH'; let tempOskString = '';
const OSK_COLS = 7; const OSK_ROWS = 6;
const oskKeys = [ ['A', 'B', 'C', 'D', 'E', 'F', 'G'], ['H', 'I', 'J', 'K', 'L', 'M', 'N'], ['O', 'P', 'Q', 'R', 'S', 'T', 'U'], ['V', 'W', 'X', 'Y', 'Z', '0', '1'], ['2', '3', '4', '5', '6', '7', '8'], ['9', 'SPACE', 'BKSP', 'CLEAR', 'DONE', '.', '-'] ];
let oskR = 0, oskC = 0; let searchQuery = "";

let sgdbResults = []; let sgdbIndex = 0;
let activeScrapeMode = ''; let scrapeSource = 'STEAM';
let steamSearchResults = []; let selectedAppId = null; let selectedResolvedName = null;
let igdbSearchResults = []; let selectedIgdbId = null;

// `categories` is the live, navigable filter list. The base entries are fixed;
// game playlists + a "RECENTLY IMPORTED" auto-category are appended at runtime by
// rebuildCategories(). It's mutated IN PLACE (never reassigned) so the many
// closures that captured this reference keep seeing updates.
const categories = ["ALL GAMES", "INSTALLED", "STEAM", "GOG", "EPIC", "FLATPAK", "ITCH", "PICO-8", "OTHERS", "PHYSICAL", "EMULATION", "APPS", "WANT TO PLAY", "FAVS", "BACKLOG", "PLAYED"];
const BASE_CATEGORIES = [...categories];
const RECENTLY_IMPORTED_CAT = "RECENTLY IMPORTED";
const RECENTLY_IMPORTED_LIMIT = 50;
// Playlist category labels are prefixed so they can never collide with a base
// category name (e.g. a playlist literally named "STEAM") or the Recently-Imported
// entry, and so users can tell playlists apart from stores at a glance.
const PLAYLIST_CAT_PREFIX = "≡ ";
let gamePlaylists = [];          // [{id, name}] from the shared games.db
let playlistMembers = {};        // playlistId -> Set(gameId)
let playlistCatMap = {};         // category-label -> playlistId
let recentlyImportedIds = new Set();

const THEMES = {
  "DARK GRAY": {bg: "#141414", bg_panel: "rgba(0,0,0,0.5)", bg_menu: "#222222", accent: "#ffffff", accent_menu: "#00e5ff", text_main: "#ffffff", text_sec: "#bbbbbb", text_dim: "#777777", border: "rgba(255,255,255,0.1)", border_solid: "#555555"},
  "CREMA (DEFAULT)": {bg: "#2C1E16", bg_panel: "rgba(67, 40, 24, 0.6)", bg_menu: "#432818", accent: "#D4A373", accent_menu: "#D4A373", text_main: "#FFE6A7", text_sec: "#E6CC98", text_dim: "#A47148", border: "rgba(212, 163, 115, 0.2)", border_solid: "#8B5A2B"},
  "CYBERPUNK": {bg: "#09090b", bg_panel: "rgba(26, 26, 46, 0.7)", bg_menu: "#1a1a2e", accent: "#f3e600", accent_menu: "#00ffcc", text_main: "#00ffcc", text_sec: "#e0e0e0", text_dim: "#ff003c", border: "rgba(243, 230, 0, 0.2)", border_solid: "#ff003c"},
  "VAPOUR OS": {bg: "#171a21", bg_panel: "rgba(27, 40, 56, 0.7)", bg_menu: "#1b2838", accent: "#66c0f4", accent_menu: "#66c0f4", text_main: "#c7d5e0", text_sec: "#8f98a0", text_dim: "#556b82", border: "rgba(102, 192, 244, 0.2)", border_solid: "#2a475e"},
  "PSIV BLUE": {bg: "#000022", bg_panel: "rgba(0, 67, 156, 0.4)", bg_menu: "#001144", accent: "#ffffff", accent_menu: "#0070cc", text_main: "#ffffff", text_sec: "#aaaaaa", text_dim: "#666666", border: "rgba(0, 112, 204, 0.3)", border_solid: "#00439c"},
  "GREEN BOX": {bg: "#0e0e0e", bg_panel: "rgba(82, 176, 67, 0.10)", bg_menu: "#111111", accent: "#52b043", accent_menu: "#107C10", text_main: "#ffffff", text_sec: "#a8d8a4", text_dim: "#3d8030", border: "rgba(82, 176, 67, 0.22)", border_solid: "#1a3d1a"},
  "MOVIESFLIX": {bg: "#141414", bg_panel: "rgba(255, 255, 255, 0.07)", bg_menu: "#000000", accent: "#e50914", accent_menu: "#e50914", text_main: "#ffffff", text_sec: "#b3b3b3", text_dim: "#6d6d6d", border: "rgba(229, 9, 20, 0.30)", border_solid: "#404040"},
  "SNOW": {bg: "#0a1628", bg_panel: "rgba(32, 68, 110, 0.65)", bg_menu: "#0f2040", accent: "#93d0f0", accent_menu: "#b8e4f8", text_main: "#e8f4ff", text_sec: "#8bbbd8", text_dim: "#4a7898", border: "rgba(147, 208, 240, 0.18)", border_solid: "#1c4060"},
  "WIN XP": {bg: "#0055e5", bg_panel: "rgba(236, 233, 216, 0.3)", bg_menu: "#003399", accent: "#ffd700", accent_menu: "#ffd700", text_main: "#ffffff", text_sec: "#ece9d8", text_dim: "#c0c0c0", border: "rgba(255, 255, 255, 0.3)", border_solid: "#4fcc3a"},
  "PSIII CLASSIC": {bg: "#000000", bg_panel: "rgba(25, 25, 25, 0.7)", bg_menu: "#111111", accent: "#dcdcdc", accent_menu: "#ffffff", text_main: "#ffffff", text_sec: "#aaaaaa", text_dim: "#666666", border: "rgba(255, 255, 255, 0.2)", border_solid: "#444444"},
  "PSIII RED": {bg: "#2b0000", bg_panel: "rgba(40, 0, 0, 0.7)", bg_menu: "#1a0000", accent: "#ff4d4d", accent_menu: "#ff4d4d", text_main: "#ffffff", text_sec: "#ffcccc", text_dim: "#cc6666", border: "rgba(255, 77, 77, 0.2)", border_solid: "#800000"},
  "PSIII GREEN": {bg: "#001a00", bg_panel: "rgba(0, 30, 0, 0.7)", bg_menu: "#000d00", accent: "#4dff4d", accent_menu: "#4dff4d", text_main: "#ffffff", text_sec: "#ccffcc", text_dim: "#66cc66", border: "rgba(77, 255, 77, 0.2)", border_solid: "#004d00"},
  "PSIII BLUE": {bg: "#000a1a", bg_panel: "rgba(0, 15, 30, 0.7)", bg_menu: "#00050d", accent: "#4d94ff", accent_menu: "#4d94ff", text_main: "#ffffff", text_sec: "#cce0ff", text_dim: "#66a3ff", border: "rgba(77, 148, 255, 0.2)", border_solid: "#003380"},
  "PSIII PURPLE": {bg: "#1a001a", bg_panel: "rgba(30, 0, 30, 0.7)", bg_menu: "#0d000d", accent: "#d24dff", accent_menu: "#d24dff", text_main: "#ffffff", text_sec: "#f0ccff", text_dim: "#c266cc", border: "rgba(210, 77, 255, 0.2)", border_solid: "#800080"},
  "PSIII GOLD": {bg: "#261a00", bg_panel: "rgba(40, 25, 0, 0.7)", bg_menu: "#130d00", accent: "#ffcc00", accent_menu: "#ffcc00", text_main: "#ffffff", text_sec: "#ffeecc", text_dim: "#cca300", border: "rgba(255, 204, 0, 0.2)", border_solid: "#997300"},
  "PSIII SILVER": {bg: "#1a1a1a", bg_panel: "rgba(35, 35, 35, 0.7)", bg_menu: "#0d0d0d", accent: "#cccccc", accent_menu: "#cccccc", text_main: "#ffffff", text_sec: "#e6e6e6", text_dim: "#999999", border: "rgba(204, 204, 204, 0.2)", border_solid: "#666666"},
  "DRACULA": {bg: "#282a36", bg_panel: "rgba(68, 71, 90, 0.7)", bg_menu: "#44475a", accent: "#bd93f9", accent_menu: "#ff79c6", text_main: "#f8f8f2", text_sec: "#8be9fd", text_dim: "#8290bc", border: "rgba(189, 147, 249, 0.2)", border_solid: "#8290bc"},
  "GRUVBOX": {bg: "#282828", bg_panel: "rgba(60, 56, 54, 0.8)", bg_menu: "#3c3836", accent: "#fabd2f", accent_menu: "#fe8019", text_main: "#ebdbb2", text_sec: "#b8bb26", text_dim: "#a89984", border: "rgba(250, 189, 47, 0.2)", border_solid: "#504945"},
  "NORD": {bg: "#2e3440", bg_panel: "rgba(59, 66, 82, 0.8)", bg_menu: "#3b4252", accent: "#88c0d0", accent_menu: "#81a1c1", text_main: "#eceff4", text_sec: "#e5e9f0", text_dim: "#7a8ba0", border: "rgba(136, 192, 208, 0.2)", border_solid: "#5e6f84"},
  "SOLARIZED DARK": {bg: "#002b36", bg_panel: "rgba(7, 54, 66, 0.8)", bg_menu: "#073642", accent: "#2aa198", accent_menu: "#268bd2", text_main: "#839496", text_sec: "#93a1a1", text_dim: "#7a9196", border: "rgba(42, 161, 152, 0.2)", border_solid: "#1a5060"},
  "CATPPUCCIN MOCHA": {bg: "#1e1e2e", bg_panel: "rgba(30, 30, 46, 0.8)", bg_menu: "#181825", accent: "#cba6f7", accent_menu: "#f5c2e7", text_main: "#cdd6f4", text_sec: "#bac2de", text_dim: "#6c7086", border: "rgba(203, 166, 247, 0.2)", border_solid: "#313244"},
  "CATPPUCCIN MACCHIATO": {bg: "#24273a", bg_panel: "rgba(36, 39, 58, 0.8)", bg_menu: "#1e2030", accent: "#c6a0f6", accent_menu: "#f4b8e4", text_main: "#cad3f5", text_sec: "#b8c0e0", text_dim: "#6e738d", border: "rgba(198, 160, 246, 0.2)", border_solid: "#363a4f"},
  "CATPPUCCIN FRAPPÉ": {bg: "#303446", bg_panel: "rgba(48, 52, 70, 0.8)", bg_menu: "#292c3c", accent: "#ca9ee6", accent_menu: "#f2d5cf", text_main: "#c6d0f5", text_sec: "#b5bfe2", text_dim: "#737994", border: "rgba(202, 158, 230, 0.2)", border_solid: "#414559"},
  "TOKYO NIGHT": {bg: "#1a1b26", bg_panel: "rgba(36, 40, 59, 0.8)", bg_menu: "#16161e", accent: "#7aa2f7", accent_menu: "#bb9af7", text_main: "#c0caf5", text_sec: "#a9b1d6", text_dim: "#7885ac", border: "rgba(122, 162, 247, 0.2)", border_solid: "#3d4468"},
  "EVERFOREST": {bg: "#2b3339", bg_panel: "rgba(50, 56, 62, 0.8)", bg_menu: "#2f383e", accent: "#a7c080", accent_menu: "#e67e80", text_main: "#d3c6aa", text_sec: "#a7c080", text_dim: "#859289", border: "rgba(167, 192, 128, 0.2)", border_solid: "#4b565c"},
  "ROSÉ PINE": {bg: "#191724", bg_panel: "rgba(31, 29, 46, 0.8)", bg_menu: "#1f1d2e", accent: "#c4a7e7", accent_menu: "#ebbcba", text_main: "#e0def4", text_sec: "#9ccfd8", text_dim: "#6e6a86", border: "rgba(196, 167, 231, 0.2)", border_solid: "#26233a"},
  "GAME BOY DMG": {bg: "#0f380f", bg_panel: "rgba(48, 98, 48, 0.70)", bg_menu: "#1a4a1a", accent: "#9bbc0f", accent_menu: "#8bac0f", text_main: "#9bbc0f", text_sec: "#8bac0f", text_dim: "#306230", border: "rgba(155, 188, 15, 0.25)", border_solid: "#306230"},
  "PIP BOY": {bg: "#000000", bg_panel: "rgba(0, 20, 0, 0.7)", bg_menu: "#001100", accent: "#14ff00", accent_menu: "#14ff00", text_main: "#14ff00", text_sec: "#0ea000", text_dim: "#0a6000", border: "rgba(20, 255, 0, 0.2)", border_solid: "#0ea000"},
  "SEVASTOPOL": {bg: "#050d05", bg_panel: "rgba(10, 25, 10, 0.7)", bg_menu: "#081808", accent: "#f5e6b3", accent_menu: "#ff0000", text_main: "#f5e6b3", text_sec: "#a39977", text_dim: "#4d594d", border: "rgba(245, 230, 179, 0.1)", border_solid: "#1a331a"},
  "RIP AND TEAR CLASSIC": {bg: "#110000", bg_panel: "rgba(80, 5, 5, 0.78)", bg_menu: "#1a0000", accent: "#ff0000", accent_menu: "#cc0000", text_main: "#f5d020", text_sec: "#d0a000", text_dim: "#7a4400", border: "rgba(255, 0, 0, 0.22)", border_solid: "#5a0000"},
  "SUPER BROTHERS": {bg: "#5C94FC", bg_panel: "rgba(0, 0, 0, 0.75)", bg_menu: "#000070", accent: "#F8D820", accent_menu: "#F87020", text_main: "#ffffff", text_sec: "#F8D820", text_dim: "#6898F8", border: "rgba(248, 216, 32, 0.30)", border_solid: "#000000"},
  "GREEN HILL": {bg: "#0044AA", bg_panel: "rgba(0, 60, 0, 0.82)", bg_menu: "#003300", accent: "#F8D020", accent_menu: "#F8D020", text_main: "#ffffff", text_sec: "#A8E888", text_dim: "#50A050", border: "rgba(248, 208, 32, 0.30)", border_solid: "#006600"},
  "NES": {bg: "#18181A", bg_panel: "rgba(40, 38, 42, 0.85)", bg_menu: "#222024", accent: "#C42020", accent_menu: "#CC3030", text_main: "#F0F0F0", text_sec: "#C0B8C0", text_dim: "#706870", border: "rgba(196, 32, 32, 0.22)", border_solid: "#3C3A3E"},
  "SNES": {bg: "#1E1828", bg_panel: "rgba(50, 42, 80, 0.72)", bg_menu: "#160E20", accent: "#8060C8", accent_menu: "#A888E8", text_main: "#E8E0F0", text_sec: "#A890C8", text_dim: "#605090", border: "rgba(128, 96, 200, 0.22)", border_solid: "#302050"},
  "BLOODBORNE": {bg: "#0a0606", bg_panel: "rgba(60, 20, 10, 0.78)", bg_menu: "#150808", accent: "#c0952a", accent_menu: "#d4a838", text_main: "#e8d8b0", text_sec: "#b09070", text_dim: "#604830", border: "rgba(192, 149, 42, 0.22)", border_solid: "#4a1818"},
  "METROID PRIME": {bg: "#050a12", bg_panel: "rgba(255, 120, 20, 0.12)", bg_menu: "#080f1a", accent: "#ff6a00", accent_menu: "#ff8a30", text_main: "#e0f0ff", text_sec: "#60c8e0", text_dim: "#304858", border: "rgba(255, 106, 0, 0.22)", border_solid: "#1a2a3a"},
  "SILENT HILL": {bg: "#141210", bg_panel: "rgba(80, 50, 35, 0.72)", bg_menu: "#1a1510", accent: "#c85020", accent_menu: "#e06030", text_main: "#e0d0c0", text_sec: "#a09080", text_dim: "#605040", border: "rgba(200, 80, 32, 0.22)", border_solid: "#4a3020"},
  "DIABLO": {bg: "#0c0808", bg_panel: "rgba(80, 20, 0, 0.75)", bg_menu: "#140808", accent: "#e84000", accent_menu: "#c03000", text_main: "#f0d898", text_sec: "#c0a060", text_dim: "#705028", border: "rgba(232, 64, 0, 0.22)", border_solid: "#4a1a00"},
  "HALF-LIFE": {bg: "#141618", bg_panel: "rgba(245, 130, 32, 0.12)", bg_menu: "#1c1e20", accent: "#f58320", accent_menu: "#ff9a40", text_main: "#f0f0f0", text_sec: "#b0b8c0", text_dim: "#606870", border: "rgba(245, 131, 32, 0.22)", border_solid: "#2a3038"},
  "SHOVEL KNIGHT": {bg: "#1a1a2e", bg_panel: "rgba(30, 40, 80, 0.75)", bg_menu: "#100c20", accent: "#f8d840", accent_menu: "#f0c020", text_main: "#e8f0ff", text_sec: "#88b8f8", text_dim: "#4060a0", border: "rgba(248, 216, 64, 0.28)", border_solid: "#202858"},
  "EARTHY & ORGANIC": {bg: "#3E4E3A", bg_panel: "rgba(91, 107, 85, 0.7)", bg_menu: "#4F5D48", accent: "#D4B28C", accent_menu: "#A9C298", text_main: "#F3EDE4", text_sec: "#D8D3C8", text_dim: "#8E9E88", border: "rgba(212, 178, 140, 0.2)", border_solid: "#6b7d63"},
  "DOPAMINE BRIGHTS": {bg: "#080810", bg_panel: "rgba(255, 50, 120, 0.12)", bg_menu: "#100820", accent: "#FF2D78", accent_menu: "#00F5D4", text_main: "#ffffff", text_sec: "#FF80C0", text_dim: "#6030A0", border: "rgba(255, 45, 120, 0.28)", border_solid: "#2A0850"},
  "RETRO REVIVAL": {bg: "#2A1A10", bg_panel: "rgba(80, 50, 30, 0.70)", bg_menu: "#1E1008", accent: "#E8883A", accent_menu: "#4AAA98", text_main: "#F8E8C8", text_sec: "#C8A878", text_dim: "#7A5838", border: "rgba(232, 136, 58, 0.22)", border_solid: "#5A3820"},
  "VAPORWAVE": {bg: "#0d0221", bg_panel: "rgba(80, 10, 100, 0.65)", bg_menu: "#150330", accent: "#ff71ce", accent_menu: "#01cdfe", text_main: "#f0e0ff", text_sec: "#c080ff", text_dim: "#6030a0", border: "rgba(255, 113, 206, 0.25)", border_solid: "#35005a"},
  "AURORA": {bg: "#0a1520", bg_panel: "rgba(0, 80, 80, 0.55)", bg_menu: "#081018", accent: "#00e8c8", accent_menu: "#b060ff", text_main: "#d0f8f0", text_sec: "#78d8c8", text_dim: "#306858", border: "rgba(0, 232, 200, 0.20)", border_solid: "#0a4040"},
  "NOIR": {bg: "#0a0a0a", bg_panel: "rgba(45, 45, 45, 0.78)", bg_menu: "#151515", accent: "#d4a030", accent_menu: "#f0b838", text_main: "#e8e0d0", text_sec: "#a09888", text_dim: "#606058", border: "rgba(212, 160, 48, 0.20)", border_solid: "#303028"},
  "BIOLUMINESCENCE": {bg: "#020810", bg_panel: "rgba(0, 120, 120, 0.42)", bg_menu: "#030c18", accent: "#00e8a8", accent_menu: "#00ffc0", text_main: "#c0f8f0", text_sec: "#60d8c8", text_dim: "#206858", border: "rgba(0, 232, 168, 0.22)", border_solid: "#0a3838"},
  "BRUTALIST": {bg: "#1a1a1a", bg_panel: "rgba(80, 80, 80, 0.55)", bg_menu: "#222222", accent: "#e03000", accent_menu: "#ff4010", text_main: "#f0f0f0", text_sec: "#c0c0c0", text_dim: "#808080", border: "rgba(224, 48, 0, 0.25)", border_solid: "#404040"},
  "OXOCARBON": {bg: "#161616", bg_panel: "rgba(38, 38, 38, 0.85)", bg_menu: "#262626", accent: "#0f62fe", accent_menu: "#4589ff", text_main: "#f4f4f4", text_sec: "#c6c6c6", text_dim: "#8d8d8d", border: "rgba(15, 98, 254, 0.25)", border_solid: "#393939"},
  "MATERIAL DARK": {bg: "#1a1c1e", bg_panel: "rgba(40, 48, 56, 0.80)", bg_menu: "#212325", accent: "#4fc3f7", accent_menu: "#0288d1", text_main: "#e1e2e8", text_sec: "#c1c2cb", text_dim: "#8589a0", border: "rgba(79, 195, 247, 0.18)", border_solid: "#3a3f4a"},
  "N7": {bg: "#080c14", bg_panel: "rgba(20, 30, 60, 0.78)", bg_menu: "#0c1428", accent: "#cc0000", accent_menu: "#4488cc", text_main: "#e8eeff", text_sec: "#7aa0cc", text_dim: "#3d5880", border: "rgba(204, 0, 0, 0.25)", border_solid: "#1a2848"},
  "TRON LEGACY": {bg: "#000000", bg_panel: "rgba(0, 200, 255, 0.08)", bg_menu: "#000508", accent: "#00c8ff", accent_menu: "#ff8c00", text_main: "#ffffff", text_sec: "#80d8ff", text_dim: "#204858", border: "rgba(0, 200, 255, 0.28)", border_solid: "#0a1a20"},
  "DEAD SPACE": {bg: "#020202", bg_panel: "rgba(255, 100, 20, 0.10)", bg_menu: "#050505", accent: "#ff6400", accent_menu: "#ff8030", text_main: "#f0f0f0", text_sec: "#ff9060", text_dim: "#602010", border: "rgba(255, 100, 32, 0.25)", border_solid: "#200800"},
  "COLONY SHIP": {bg: "#10120e", bg_panel: "rgba(50, 60, 40, 0.72)", bg_menu: "#141810", accent: "#c8b040", accent_menu: "#e0c850", text_main: "#d8e0c0", text_sec: "#909a70", text_dim: "#485840", border: "rgba(200, 176, 64, 0.22)", border_solid: "#303820"},
  "NECROMORPH": {bg: "#030808", bg_panel: "rgba(0, 80, 20, 0.60)", bg_menu: "#040a04", accent: "#80ff20", accent_menu: "#60c010", text_main: "#c8ffc0", text_sec: "#70c060", text_dim: "#306020", border: "rgba(128, 255, 32, 0.22)", border_solid: "#0a2808"},
  "CRIMSON PEAK": {bg: "#120508", bg_panel: "rgba(80, 15, 30, 0.75)", bg_menu: "#1a080c", accent: "#d4904a", accent_menu: "#e0b060", text_main: "#f0e0d8", text_sec: "#c0909a", text_dim: "#7a3848", border: "rgba(212, 144, 74, 0.22)", border_solid: "#5a1520"},
  "LAKESIDE CURSE": {bg: "#0c0a08", bg_panel: "rgba(60, 40, 20, 0.72)", bg_menu: "#141008", accent: "#e09030", accent_menu: "#f0b040", text_main: "#f0e8d0", text_sec: "#b09070", text_dim: "#706050", border: "rgba(224, 144, 48, 0.22)", border_solid: "#402808"},
  "THE BACKROOMS": {bg: "#1a1810", bg_panel: "rgba(220, 200, 100, 0.10)", bg_menu: "#201e14", accent: "#d4c840", accent_menu: "#f0e050", text_main: "#f0e8c8", text_sec: "#b0a870", text_dim: "#706840", border: "rgba(212, 200, 64, 0.22)", border_solid: "#3a3820"}
};
const THEME_CATEGORIES = {
  "Originals & System": ["CREMA (DEFAULT)", "DARK GRAY", "CYBERPUNK", "SNOW", "MOVIESFLIX", "VAPOUR OS", "PSIV BLUE", "GREEN BOX", "WIN XP"],
  "Gaming Legends": ["GAME BOY DMG", "PIP BOY", "SEVASTOPOL", "RIP AND TEAR CLASSIC", "SUPER BROTHERS", "GREEN HILL", "NES", "SNES", "BLOODBORNE", "METROID PRIME", "SILENT HILL", "DIABLO", "HALF-LIFE", "SHOVEL KNIGHT"],
  "Aesthetics": ["EARTHY & ORGANIC", "DOPAMINE BRIGHTS", "RETRO REVIVAL", "VAPORWAVE", "AURORA", "NOIR", "BIOLUMINESCENCE", "BRUTALIST"],
  "Linux Ricing": ["DRACULA", "GRUVBOX", "NORD", "SOLARIZED DARK", "CATPPUCCIN FRAPPÉ", "CATPPUCCIN MACCHIATO", "CATPPUCCIN MOCHA", "TOKYO NIGHT", "EVERFOREST", "ROSÉ PINE", "OXOCARBON", "MATERIAL DARK"],
  "Sci-Fi Universes": ["N7", "TRON LEGACY", "DEAD SPACE", "COLONY SHIP", "NECROMORPH"],
  "Horror Realm": ["CRIMSON PEAK", "LAKESIDE CURSE", "THE BACKROOMS"],
  "PSIII Colors": ["PSIII CLASSIC", "PSIII RED", "PSIII GREEN", "PSIII BLUE", "PSIII PURPLE", "PSIII GOLD", "PSIII SILVER"]
};

function updateAppScale() { const wrapper = document.getElementById('app-scale-wrapper'); if (!wrapper) return; const scaleX = window.innerWidth / 1920; const scaleY = window.innerHeight / 1080; const scale = Math.min(scaleX, scaleY); wrapper.style.transform = `scale(${scale})`; wrapper.style.left = `${(window.innerWidth - (1920 * scale)) / 2}px`; wrapper.style.top = `${(window.innerHeight - (1080 * scale)) / 2}px`; } window.addEventListener('resize', updateAppScale);
function setBlur(enable) { document.querySelectorAll('.blur-target').forEach(el => el.classList.toggle('is-blurred', enable)); }
function isVideoActive() { const vid = document.getElementById('video-player'); return vid && !vid.paused && vid.src && vid.src.includes('file://'); }
function applyTheme(themeName) { activeTheme = THEMES[themeName] ? themeName : "CREMA (DEFAULT)"; const t = THEMES[activeTheme]; const root = document.documentElement; Object.keys(t).forEach(key => root.style.setProperty(`--${key}`, t[key])); }

// ── THEME INHERITANCE (follow The Manager) ─────────────────────────────────────
// The Manager stores its chosen theme in the shared games.db under the setting key
// 'cngm_theme'. When audioCfg.themeSource === 'MANAGER' (the default), CREMA mirrors
// it; picking a theme by hand switches to 'CUSTOM'. Most theme names are identical
// across both faces; the only special cases are The Manager's "CREMA" (== CREMA's
// "CREMA (DEFAULT)") and the ~8 light themes CREMA doesn't ship (→ graceful fallback).
const FOLLOW_MANAGER_LABEL = 'FOLLOW THE MANAGER';
function mapManagerThemeToCrema(name) {
  if (!name) return null;
  if (name === 'CREMA') return 'CREMA (DEFAULT)';
  return THEMES[name] ? name : null;
}
async function resolveAndApplyTheme() {
  if ((audioCfg.themeSource || 'MANAGER') === 'MANAGER') {
    try {
      const mapped = mapManagerThemeToCrema(await window.api.getSetting('cngm_theme'));
      if (mapped) { applyTheme(mapped); return; }
    } catch (e) {}
  }
  applyTheme(audioCfg.theme && THEMES[audioCfg.theme] ? audioCfg.theme : 'CREMA (DEFAULT)');
}

// App Assets Helper
function convertSafePath(rawPath) {
  if (!rawPath) return "";
  let p = String(rawPath).replace(/\\/g, '/');
  if (p.startsWith('GameManagerConfig') && baseDir) {
    p = baseDir + '/' + p; if (!p.startsWith('/')) p = '/' + p; return 'file://' + encodeURI(p).replace(/#/g, '%23').replace(/\?/g, '%3F');
  } else if (p.startsWith('~') && baseDir) {
    p = p.replace('~/GameAppBuild', baseDir); if (p.startsWith('~')) p = baseDir + p.substring(1); if (!p.startsWith('/')) p = '/' + p; return 'file://' + encodeURI(p).replace(/#/g, '%23').replace(/\?/g, '%3F');
  }
  if (p.startsWith('/') || /^[a-zA-Z]:\//.test(p)) return 'file://' + encodeURI(p).replace(/#/g, '%23').replace(/\?/g, '%3F');
    return encodeURI(p).replace(/#/g, '%23').replace(/\?/g, '%3F');
}

let usingKeyboard = false;
function getBtn(icon) { const iconPath = convertSafePath('assets/gamepad_icons/' + icon + '.png'); return `<span class="gp-btn-masked" style="-webkit-mask-image: url('${iconPath}');"></span>`; }
function getKey(label) { return `<span class="kb-key">${label}</span>`; }
const KNOWN_LOGOS = new Set(['all_games','amazon','apps','emulation','epic','favs','flatpak','gog','installed','itch','others','physical','pico8','playable','steam','want_to_play']);
function logoPath(name) { let safe = String(name).toLowerCase().replace(/ /g, '_'); if (safe === 'pico-8') safe = 'pico8'; const file = KNOWN_LOGOS.has(safe) ? safe : 'playable'; return convertSafePath(`assets/logos/${file}.png`); }

// ── GAME PLAYLISTS ────────────────────────────────────────────────────────────
// A playlist (and the "RECENTLY IMPORTED" auto-collection) is exposed as a regular
// browse category, so all the existing list/carousel/grid/gallery/hero machinery
// works unchanged. These helpers tell that machinery how to match a game.
function isPlaylistCat(catName) { return catName === RECENTLY_IMPORTED_CAT || Object.prototype.hasOwnProperty.call(playlistCatMap, catName); }
function playlistCatMatch(g, catName) {
  if (catName === RECENTLY_IMPORTED_CAT) return recentlyImportedIds.has(g.id);
  const id = playlistCatMap[catName];
  return id != null && playlistMembers[id] ? playlistMembers[id].has(g.id) : false;
}
function computeRecentlyImported() {
  recentlyImportedIds = new Set(
    allGames
      .filter(g => g.date_added && g.date_added > 0)
      .sort((a, b) => b.date_added - a.date_added)
      .slice(0, RECENTLY_IMPORTED_LIMIT)
      .map(g => g.id)
  );
}
// Rebuild the live `categories` array in place: base entries, then Recently
// Imported (only if there's anything in it), then one entry per game playlist.
function rebuildCategories() {
  const labels = [...BASE_CATEGORIES];
  if (recentlyImportedIds.size > 0) labels.push(RECENTLY_IMPORTED_CAT);
  for (const pl of gamePlaylists) labels.push(PLAYLIST_CAT_PREFIX + pl.name);
  categories.length = 0;
  categories.push(...labels);
  if (currentCategoryIndex >= categories.length) currentCategoryIndex = 0;
  if (galleryCatIndex >= categories.length) galleryCatIndex = 0;
}
// Load playlists + their membership sets from the shared DB, then rebuild nav.
async function loadGamePlaylists() {
  try {
    gamePlaylists = (await window.api.getGamePlaylists()) || [];
    playlistMembers = {};
    playlistCatMap = {};
    for (const pl of gamePlaylists) {
      const rows = (await window.api.getPlaylistGames(pl.id)) || [];
      playlistMembers[pl.id] = new Set(rows.map(r => r.id));
      playlistCatMap[PLAYLIST_CAT_PREFIX + pl.name] = pl.id;
    }
  } catch (e) { gamePlaylists = []; playlistMembers = {}; playlistCatMap = {}; }
  computeRecentlyImported();
  rebuildCategories();
}

// ── KANBAN STATUS (shared `kb_played`, same semantics as The Manager board) ────
// The Manager buckets each game into exactly one column by priority
// Played > Want > Playing > Backlog. As couch FILTERS we surface two of them:
//   PLAYED  = manually marked done (kb_played = 1)
//   BACKLOG = not played, not currently playing, not flagged Want (the "to-do" pile)
function isPlayed(g)  { return g.kb_played == 1; }
function isBacklog(g) { return !(g.kb_played == 1) && !(g.LastPlayed && g.LastPlayed > 0) && g.WANT_TO_PLAY !== 'YES'; }

// ── FLATPAK SCAN + ART GENERATION ────────────────────────────────────────

function maybeRunFlatpakScan(catName) {
    if (catName !== 'FLATPAK') return;
    window.api.scanFlatpak().then(r => {
        refreshDatabase().then(() => {
            if (r.iconMap && Object.keys(r.iconMap).length) generateFlatpakArt(r.iconMap);
        });
    });
}

function maybeRunPico8Scan(catName) {
    if (catName !== 'PICO-8') return;
    window.api.scanPico8().then(() => refreshDatabase());
}

async function generateFlatpakArt(iconMap) {
    for (const [gameId, iconName] of Object.entries(iconMap)) {
        const iconPath = await window.api.findFlatpakIcon(iconName);
        if (!iconPath) continue;
        const b64 = await window.api.readFileBase64(iconPath);
        if (!b64) continue;
        const isSvg = iconPath.endsWith('.svg');
        const dataUrl = `data:image/${isSvg ? 'svg+xml' : 'png'};base64,${b64}`;
        const img = await new Promise(resolve => {
            const el = new Image();
            el.onload = () => resolve(el);
            el.onerror = () => resolve(null);
            el.src = dataUrl;
        });
        if (!img) continue;
        const color = _fpExtractColor(img);
        const coverB64 = _fpDrawCover(img, color);
        const heroB64  = _fpDrawHero(color);
        await window.api.saveFlatpakArt(Number(gameId), coverB64, heroB64, iconPath);
    }
    if (Object.keys(iconMap).length > 0) refreshDatabase();
}

function _fpExtractColor(img) {
    const c = document.createElement('canvas'); c.width = c.height = 48;
    const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0, 48, 48);
    const d = ctx.getImageData(0, 0, 48, 48).data;
    let r = 0, g = 0, b = 0, n = 0, maxSat = -1, sr = 80, sg = 100, sb = 180;
    for (let i = 0; i < d.length; i += 4) {
        if (d[i+3] < 100) continue;
        const pr = d[i], pg = d[i+1], pb = d[i+2];
        r += pr; g += pg; b += pb; n++;
        const mx = Math.max(pr,pg,pb), mn = Math.min(pr,pg,pb);
        const sat = mx < 20 ? 0 : (mx-mn)/mx;
        if (sat > maxSat && mx > 40) { maxSat = sat; sr = pr; sg = pg; sb = pb; }
    }
    if (n === 0) return [80, 100, 180];
    return maxSat > 0.25 ? [sr, sg, sb] : [Math.round(r/n), Math.round(g/n), Math.round(b/n)];
}

function _fpGradient(ctx, w, h, r, g, b, dir) {
    const d1 = `rgb(${Math.round(r*.10)},${Math.round(g*.10)},${Math.round(b*.10)})`;
    const d2 = `rgb(${Math.round(r*.22)},${Math.round(g*.22)},${Math.round(b*.22)})`;
    const grad = dir === 'h' ? ctx.createLinearGradient(0,0,w,0) : ctx.createLinearGradient(0,0,w,h);
    grad.addColorStop(0, d1); grad.addColorStop(1, d2);
    ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);
    const glow = ctx.createRadialGradient(w/2,h/2,0, w/2,h/2, Math.max(w,h)*.55);
    glow.addColorStop(0, `rgba(${r},${g},${b},.32)`); glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h);
}

function _fpDrawCover(img, [r,g,b]) {
    const c = document.createElement('canvas'); c.width = 600; c.height = 900;
    const ctx = c.getContext('2d');
    _fpGradient(ctx, 600, 900, r, g, b, 'diagonal');
    const sz = 380; ctx.drawImage(img, (600-sz)/2, (900-sz)/2, sz, sz);
    return c.toDataURL('image/png').split(',')[1];
}

function _fpDrawHero([r,g,b]) {
    const c = document.createElement('canvas'); c.width = 1200; c.height = 400;
    const ctx = c.getContext('2d');
    _fpGradient(ctx, 1200, 400, r, g, b, 'h');
    return c.toDataURL('image/png').split(',')[1];
}

// ─────────────────────────────────────────────────────────────────────────────
function getMappedBtn(logicalBtn) {
  const layout = audioCfg.gamepadLayout || "XBOX"; let iconName = logicalBtn;
  if (layout === "XBOX") { const map = { 'SOUTH': 'XBOX_A', 'EAST': 'XBOX_B', 'WEST': 'XBOX_X', 'NORTH': 'XBOX_Y', 'START': 'XBOX_start', 'SELECT': 'XBOX_select' }; if (map[logicalBtn]) iconName = map[logicalBtn]; }
  else if (layout === "PS") { const map = { 'SOUTH': 'playstation_X', 'EAST': 'playstation_circle', 'WEST': 'playstation_square', 'NORTH': 'playstation_triangle', 'START': 'playstation_start', 'SELECT': 'playstation_select' }; if (map[logicalBtn]) iconName = map[logicalBtn]; }
  else if (layout === "N") { const map = { 'SOUTH': 'switch_b.300dpi', 'EAST': 'switch_a.300dpi', 'WEST': 'switch_y.300dpi', 'NORTH': 'switch_x.300dpi', 'START': 'switch_plus.300dpi', 'SELECT': 'switch_minus.300dpi' }; if (map[logicalBtn]) iconName = map[logicalBtn]; }
  return getBtn(iconName);
}
function renderHardwareIcons() {
  const startF = document.getElementById('start-footer'); if (startF) startF.innerHTML = `${getBtn('dpad_up')}${getBtn('dpad_down')} ${t('footer.navigate')} &nbsp;&nbsp;&nbsp; ${getMappedBtn('SOUTH')} ${t('footer.select')} &nbsp;&nbsp;&nbsp; ${getMappedBtn('START')} ${t('footer.menu')}`;
  const mainF = document.getElementById('main-footer'); if (mainF) mainF.innerHTML = `${getBtn('dpad_up')}${getBtn('dpad_down')}${getBtn('L1')}${getBtn('R1')} ${t('footer.navigate')} &nbsp;&nbsp; ${getBtn('dpad_left')}${getBtn('dpad_right')} ${t('footer.page')} &nbsp;&nbsp; ${getMappedBtn('SOUTH')} ${t('footer.play')} &nbsp;&nbsp; ${getMappedBtn('EAST')} ${t('footer.back')} &nbsp;&nbsp; ${getMappedBtn('WEST')} ${t('footer.media')} &nbsp;&nbsp; ${getMappedBtn('NORTH')} ${t('footer.search')} &nbsp;&nbsp; ${getMappedBtn('SELECT')} ${t('footer.options')} &nbsp;&nbsp; ${getBtn('L3')}${getBtn('R3')} ${t('footer.music')}`;
  const prmpt = document.getElementById('mini-prompt'); if (prmpt) prmpt.innerHTML = t('footer.trailer', {btn: getMappedBtn('WEST')});
  const ssA = document.getElementById('ss-btn-a'); if (ssA) ssA.innerHTML = getMappedBtn('SOUTH'); const ssY = document.getElementById('ss-btn-y'); if (ssY) ssY.innerHTML = getMappedBtn('NORTH'); const ssX = document.getElementById('ss-btn-x'); if (ssX) ssX.innerHTML = getMappedBtn('WEST');
  const jbF = document.getElementById('jb-footer'); if (jbF) jbF.innerHTML = `${getBtn('dpad_up')}${getBtn('dpad_down')}${getBtn('L1')}${getBtn('R1')} ${t('footer.navigate')} &nbsp;&nbsp; ${getMappedBtn('SOUTH')} ${t('footer.play')} &nbsp;&nbsp; ${getMappedBtn('EAST')} ${t('footer.back')} &nbsp;&nbsp; ${getMappedBtn('NORTH')} ${t('footer.search')} &nbsp;&nbsp; ${getMappedBtn('WEST')} ${t('footer.fullscreen')} &nbsp;&nbsp; ${getMappedBtn('SELECT')} ${t('footer.options')}`;
  const galF = document.getElementById('gallery-footer'); if (galF) galF.innerHTML = `${getBtn('dpad_up')}${getBtn('dpad_down')}${getBtn('dpad_left')}${getBtn('dpad_right')} ${t('footer.navigate')} &nbsp;&nbsp; ${getBtn('L1')}${getBtn('R1')} ${t('footer.category')} &nbsp;&nbsp; ${getMappedBtn('SOUTH')} ${t('footer.select')} &nbsp;&nbsp; ${getMappedBtn('NORTH')} ${t('footer.search')} &nbsp;&nbsp; ${getMappedBtn('START')} ${t('footer.menu')}`;
  const ggpF = document.getElementById('ggp-footer'); if (ggpF) ggpF.innerHTML = `${getMappedBtn('EAST')} ${t('footer.back')} &nbsp;&nbsp; ${getMappedBtn('SOUTH')} ${t('footer.select')} &nbsp;&nbsp; ${getBtn('dpad_up')}${getBtn('dpad_down')} ${t('footer.navigate')} &nbsp;&nbsp; ${getBtn('L1')}${getBtn('R1')} ${t('footer.page')} &nbsp;&nbsp; ${getMappedBtn('NORTH')} Achievements &nbsp;&nbsp; ${getMappedBtn('SELECT')} ${t('footer.options')}`;
  const cfgpF = document.getElementById('cfgp-footer'); if (cfgpF) cfgpF.innerHTML = `${getMappedBtn('EAST')} ${t('footer.back')} &nbsp;&nbsp; ${getMappedBtn('SOUTH')} ${t('footer.select')} &nbsp;&nbsp; ${getBtn('dpad_left')}${getBtn('dpad_right')} ${t('footer.navigate')} &nbsp;&nbsp; ${getBtn('L1')}${getBtn('R1')} ${t('footer.page')}`;
}
function renderFootersForKeyboard() {
  const k = getKey;
  const startF = document.getElementById('start-footer'); if (startF) startF.innerHTML = `${k('↑')}${k('↓')} ${t('footer.navigate')} &nbsp;&nbsp;&nbsp; ${k('Enter')} ${t('footer.select')} &nbsp;&nbsp;&nbsp; ${k('M')} ${t('footer.menu')}`;
  const mainF = document.getElementById('main-footer'); if (mainF) mainF.innerHTML = `${k('↑')}${k('↓')}${k('PgUp')}${k('PgDn')} ${t('footer.navigate')} &nbsp;&nbsp; ${k('←')}${k('→')} ${t('footer.category')} &nbsp;&nbsp; ${k('Enter')} ${t('footer.play')} &nbsp;&nbsp; ${k('Esc')} ${t('footer.back')} &nbsp;&nbsp; ${k('X')} ${t('footer.media')} &nbsp;&amp; ${k('Y')} ${t('footer.search')} &nbsp;&nbsp; ${k('O')} ${t('footer.options')} &nbsp;&nbsp; ${k('M')} ${t('footer.menu')} &nbsp;&nbsp; ${k('[')}${k(']')} ${t('footer.music')}`;
  const prmpt = document.getElementById('mini-prompt'); if (prmpt) prmpt.innerHTML = t('footer.trailer', {btn: k('X')});
  const ssA = document.getElementById('ss-btn-a'); if (ssA) ssA.innerHTML = k('Enter'); const ssY = document.getElementById('ss-btn-y'); if (ssY) ssY.innerHTML = k('Y'); const ssX = document.getElementById('ss-btn-x'); if (ssX) ssX.innerHTML = k('X');
  const jbF = document.getElementById('jb-footer'); if (jbF) jbF.innerHTML = `${k('↑')}${k('↓')}${k('PgUp')}${k('PgDn')} ${t('footer.navigate')} &nbsp;&nbsp; ${k('Enter')} ${t('footer.play')} &nbsp;&nbsp; ${k('Esc')} ${t('footer.back')} &nbsp;&nbsp; ${k('Y')} ${t('footer.search')} &nbsp;&nbsp; ${k('X')} ${t('footer.fullscreen')} &nbsp;&nbsp; ${k('O')} ${t('footer.options')}`;
  const galF = document.getElementById('gallery-footer'); if (galF) galF.innerHTML = `${k('↑')}${k('↓')}${k('←')}${k('→')} ${t('footer.navigate')} &nbsp;&nbsp; ${k(',')}${k('.')} ${t('footer.category')} &nbsp;&nbsp; ${k('Enter')} ${t('footer.select')} &nbsp;&nbsp; ${k('Y')} ${t('footer.search')} &nbsp;&nbsp; ${k('M')} ${t('footer.menu')}`;
  const ggpF = document.getElementById('ggp-footer'); if (ggpF) ggpF.innerHTML = `${k('Esc')} ${t('footer.back')} &nbsp;&nbsp; ${k('Enter')} ${t('footer.select')} &nbsp;&nbsp; ${k('↑')}${k('↓')} ${t('footer.navigate')} &nbsp;&nbsp; ${k(',')}${k('.')} ${t('footer.page')} &nbsp;&nbsp; ${k('Y')} Achievements &nbsp;&nbsp; ${k('O')} ${t('footer.options')}`;
}
function updateJbFsHints() {
  const hint = document.getElementById('jb-fs-controls-hint'); if (!hint) return;
  const popup = document.getElementById('jb-fs-controls-popup'); if (!popup) return;
  const rows = Array.from(popup.children);
  const k = getKey;
  if (usingKeyboard) {
    hint.innerHTML = `${k('Y')} ${t('jb_fs.controls')}`;
    if (rows[1]) rows[1].innerHTML = `${k('Enter')} ${t('jb_fs.play_pause')}`;
    if (rows[2]) rows[2].innerHTML = `${k('[')} / ${k(']')} ${t('jb_fs.prev_next')}`;
    if (rows[3]) rows[3].innerHTML = `${k('X')} / ${k('Esc')} ${t('jb_fs.exit')}`;
  } else {
    hint.innerHTML = `${getMappedBtn('NORTH')} ${t('jb_fs.controls')}`;
    if (rows[1]) rows[1].innerHTML = `${getMappedBtn('SOUTH')} ${t('jb_fs.play_pause')}`;
    if (rows[2]) rows[2].innerHTML = `${getBtn('L3')} / ${getBtn('R3')} ${t('jb_fs.prev_next')}`;
    if (rows[3]) rows[3].innerHTML = `${getMappedBtn('WEST')} / ${getMappedBtn('EAST')} ${t('jb_fs.exit')}`;
  }
}
function setInputMethod(keyboard) {
  if (keyboard === usingKeyboard) return;
  usingKeyboard = keyboard;
  if (keyboard) renderFootersForKeyboard(); else renderHardwareIcons();
  updateJbFsHints();
}
function renderFooters() {
  if (usingKeyboard) renderFootersForKeyboard(); else renderHardwareIcons();
}

async function initAudio() {
  let rawCfg = await window.api.getAudioConfig();
  if (rawCfg) { audioCfg.bgm = rawCfg.bgm !== undefined ? rawCfg.bgm : true; audioCfg.sfx = rawCfg.sfx !== undefined ? rawCfg.sfx : true; audioCfg.vol = rawCfg.vol !== undefined ? rawCfg.vol : 0.3; audioCfg.bgm_mode = rawCfg.bgm_mode !== undefined ? rawCfg.bgm_mode : "AMBIENT"; audioCfg.screensaver = rawCfg.screensaver !== undefined ? rawCfg.screensaver : "CN WALLPAPERS"; audioCfg.screensaverDelay = rawCfg.screensaverDelay !== undefined ? rawCfg.screensaverDelay : 3; audioCfg.gamepadLayout = rawCfg.gamepadLayout !== undefined ? rawCfg.gamepadLayout : "XBOX"; audioCfg.wakeMethod = rawCfg.wakeMethod !== undefined ? rawCfg.wakeMethod : "START + SELECT"; if (rawCfg.theme && THEMES[rawCfg.theme]) { activeTheme = rawCfg.theme; audioCfg.theme = rawCfg.theme; } audioCfg.themeSource = rawCfg.themeSource === 'CUSTOM' ? 'CUSTOM' : 'MANAGER'; audioCfg.startScreenMode = (rawCfg.startScreenMode === 'GRID') ? 'GRID' : 'CAROUSEL'; /* legacy 'STATIC' (vertical list) removed → carousel */ audioCfg.browseMode = rawCfg.browseMode || 'LIST'; audioCfg.gamepageStyle = rawCfg.gamepageStyle || 'CLASSIC'; audioCfg.homeEnabled = rawCfg.homeEnabled === true; audioCfg.homeRows = Array.isArray(rawCfg.homeRows) ? rawCfg.homeRows : ["recent","gems","played"]; }
  baseDir = await window.api.getBaseDir();
  const bp = `assets/sounds`;
  sfxNav = new Audio(`${bp}/nav.wav`); sfxSelect = new Audio(`${bp}/select.wav`); sfxBack = new Audio(`${bp}/back.wav`);
  bgmAudio.addEventListener('ended', handleBgmEnded);
}
async function applyBgmMode() { if (!hasBooted) return; bgmAudio.pause(); if (!audioCfg.bgm || audioCfg.bgm_mode === "OFF") return; bgmAudio.volume = audioCfg.vol; if (audioCfg.bgm_mode === "CUSTOM") { isCustom = true; customPlaylist = await window.api.getCustomMusic(); if (customPlaylist.length > 0) { customPlaylist.sort(() => Math.random() - 0.5); customIndex = 0; if (!isVideoActive()) playNextCustom(); } } else { isCustom = false; const stdPath = await window.api.getStandardBgm(audioCfg.bgm_mode); if (stdPath) { bgmAudio.src = stdPath; bgmAudio.loop = true; if (!isVideoActive()) bgmAudio.play().catch(e=>{}); } } }

function showNowPlaying(path) {
  const widget = document.getElementById('now-playing-widget'); if (!widget) return;
  window.api.getAudioMetadata(path).then(track => {
    document.getElementById('np-title').innerText = track.title;
    document.getElementById('np-artist').innerText = track.artist;
    const cover = document.getElementById('np-cover');
    if (track.cover) { cover.src = track.cover; cover.style.display = 'block'; }
    else { cover.style.display = 'none'; }
    widget.classList.remove('hidden'); widget.style.transform = 'translateY(0)';
    clearTimeout(npTimeout);
    npTimeout = setTimeout(() => { widget.style.transform = 'translateY(50px)'; setTimeout(() => widget.classList.add('hidden'), 500); }, 6000);
  });
}

function playNextCustom(forcePrev = false) {
  if (!hasBooted || customPlaylist.length === 0) return;
  if (forcePrev) { customIndex = customIndex - 2; if (customIndex < 0) customIndex = customPlaylist.length - 1; }
  if (customIndex >= customPlaylist.length) { customPlaylist.sort(() => Math.random() - 0.5); customIndex = 0; }
  const p = customPlaylist[customIndex++];
  bgmAudio.src = p; bgmAudio.loop = false;
  window.manualBgmPause = false;
  if (!isVideoActive()) { bgmAudio.play().catch(e=>{}); showNowPlaying(p); }
}

function handleBgmEnded() { if (isCustom) playNextCustom(); }
function playSound(snd) { if (hasBooted && snd && audioCfg.sfx) { snd.currentTime = 0; snd.play().catch(e => {}); } }
function fadeBGM(targetVolume) { clearInterval(bgmFadeInterval); if (!audioCfg.bgm || !hasBooted) { bgmAudio.volume = 0; bgmAudio.pause(); return; } let vol = bgmAudio.volume; const step = (targetVolume - vol) / 20; let ticks = 0; bgmFadeInterval = setInterval(() => { ticks++; let n = bgmAudio.volume + step; if (n > 1) n = 1; if (n < 0) n = 0; bgmAudio.volume = n; if (ticks >= 20) { bgmAudio.volume = targetVolume; clearInterval(bgmFadeInterval); if (targetVolume === 0) bgmAudio.pause(); } }, 50); }

function resetIdleTimer() { clearTimeout(idleTimer); if (audioCfg.screensaver !== 'OFF' && hasBooted && gameState !== 'SPLASH' && gameState !== 'SCREENSAVER') { idleTimer = setTimeout(startScreensaver, audioCfg.screensaverDelay * 60000); } }


function updateSSClock() { const now = new Date(); let h = now.getHours(), m = now.getMinutes(); const ampm = h >= 12 ? 'PM' : 'AM'; h = h % 12; h = h ? h : 12; m = m < 10 ? '0' + m : m; const clk = document.getElementById('ss-clock'); if (clk) clk.innerText = h + ':' + m + ' ' + ampm; }

// --- SCREENSAVER LOGIC ---
function startScreensaver() {
  if (gameState === 'SCREENSAVER' || gameState === 'SPLASH') return;
  if (gameState === 'START' || gameState === 'MAIN') previousGameState = gameState;
  gameState = 'SCREENSAVER';
  screensaverStartTime = Date.now();
  document.getElementById('screensaver-backdrop').classList.remove('hidden');
  updateSSClock(); ssClockInterval = setInterval(updateSSClock, 10000);
  if (audioCfg.screensaver === 'CN WALLPAPERS') playRandomWallpaper(); else playRandomScreenshot();
}

function updateSSUI(game) { if (!game) return; document.getElementById('ss-game-title').innerText = game.Game; const scL = document.getElementById('ss-lbl-y'); scL.style.color = (game.FAV === 'YES') ? 'var(--accent)' : 'var(--text_sec)'; const wtL = document.getElementById('ss-lbl-x'); wtL.style.color = (game.WANT_TO_PLAY === 'YES') ? 'var(--accent)' : 'var(--text_sec)'; const storeContainer = document.getElementById('ss-store-icons'); storeContainer.innerHTML = ''; if (game.Store && String(game.Store).trim() !== "") { const stores = String(game.Store).split(',').map(s => s.trim().toLowerCase().replace(/\s+/g, '_')).filter(s => s !== ""); stores.forEach(s => { const div = document.createElement('div'); div.className = 'store-icon'; div.style.webkitMaskImage = `url('${logoPath(s)}')`; storeContainer.appendChild(div); }); } }

async function playRandomWallpaper() {
  if (gameState !== 'SCREENSAVER') return; document.getElementById('ss-video').style.display = 'none';
  const bottomRow = document.getElementById('ss-bottom-row'); if (bottomRow) bottomRow.style.display = 'none';
  if (availableWallpapers.length === 0) availableWallpapers = await window.api.getWallpapers();
  const img = document.getElementById('ss-image'); img.style.display = 'block';
  if (availableWallpapers && availableWallpapers.length > 0) { let wp = availableWallpapers[Math.floor(Math.random() * availableWallpapers.length)]; img.src = wp; }
  clearTimeout(screensaverInterval); screensaverInterval = setTimeout(playRandomWallpaper, 8000);
}

function playRandomScreenshot() {
  if (gameState !== 'SCREENSAVER') return; document.getElementById('ss-video').style.display = 'none';
  const bottomRow = document.getElementById('ss-bottom-row'); if (bottomRow) bottomRow.style.display = 'flex';
  const img = document.getElementById('ss-image'); img.style.display = 'block';
  if (availableScreenshots.length > 0) { let data = availableScreenshots[Math.floor(Math.random() * availableScreenshots.length)]; currentSSGame = data.game; updateSSUI(data.game); img.src = convertSafePath(data.path); }
  clearTimeout(screensaverInterval); screensaverInterval = setTimeout(playRandomScreenshot, 8000);
}

function stopScreensaver() { gameState = previousGameState; document.getElementById('screensaver-backdrop').classList.add('hidden'); const v = document.getElementById('ss-video'); v.pause(); v.removeAttribute('src'); clearTimeout(screensaverInterval); clearInterval(ssClockInterval); if (!isVideoActive() && audioCfg.bgm && audioCfg.bgm_mode !== 'OFF') bgmAudio.play().catch(e=>{}); resetIdleTimer(); }

function handleSSAction(action) {
  if (audioCfg.screensaver === 'CN WALLPAPERS' || !currentSSGame) return stopScreensaver();
  if (action === 'LAUNCH') { const cmd = currentSSGame.LaunchCommand; if (cmd) { stopScreensaver(); tryLaunch(currentSSGame); } else { stopScreensaver(); } }
  else if (action === 'FAV') { playSound(sfxSelect); currentSSGame.FAV = currentSSGame.FAV === "YES" ? "NO" : "YES"; window.api.saveDbField({game: currentSSGame.Game, field: 'FAV', value: currentSSGame.FAV}); updateSSUI(currentSSGame); if (gameState === 'MAIN') updateGameSelection(); }
  else if (action === 'WANT') { playSound(sfxSelect); currentSSGame.WANT_TO_PLAY = currentSSGame.WANT_TO_PLAY === "YES" ? "NO" : "YES"; window.api.saveDbField({game: currentSSGame.Game, field: 'WANT_TO_PLAY', value: currentSSGame.WANT_TO_PLAY}); updateSSUI(currentSSGame); if (gameState === 'MAIN') updateGameSelection(); }
}

function setDebug(msg, show = true) { const dbg = document.getElementById('media-debug'); if(dbg){ dbg.innerText = msg; dbg.style.display = show ? "block" : "none"; } }

// ══════════════════════════════════════════════════════════════════════════
// FIRST-TIME SETUP SCREEN
// ══════════════════════════════════════════════════════════════════════════

function setupOptions() {
  return {
    start: [
      { id: 'CAROUSEL', img: 'assets/setup/start_carousel.png', name: t('start_screen.carousel'), desc: 'Bold, immersive, built for a couch and a controller.' },
      { id: 'GRID',     img: 'assets/setup/start_grid.png',     name: t('start_screen.grid'),     desc: 'Your cover art in a mosaic grid. Your entire collection at a glance.' },
    ],
    browse: [
      { id: 'LIST',    img: 'assets/setup/browse_list.png',    name: t('browse.list'),    desc: '1-click play. A focused side-by-side layout — game list on the left, screenshots and metadata on the right.' },
      { id: 'GALLERY', img: 'assets/setup/browse_gallery.png', name: t('browse.gallery'), desc: 'An immersive cover art grid. Select any game to open its full dedicated gamepage with rich details.' },
    ]
  };
}

function showSetupScreen() {
  gameState = 'SETUP';
  setupPhase = 1;
  setupStartIndex = 0;
  setupBrowseIndex = 0;
  document.getElementById('splash-screen').classList.add('hidden');
  document.getElementById('setup-screen').classList.remove('hidden');
  renderSetupScreen();
}

function renderSetupScreen() {
  const opts = setupOptions();
  const isPhase1 = setupPhase === 1;
  const options = isPhase1 ? opts.start : opts.browse;
  const selectedIdx = isPhase1 ? setupStartIndex : setupBrowseIndex;

  // Progress dots
  document.querySelectorAll('.setup-dot').forEach((dot, i) => dot.classList.toggle('active', i === setupPhase - 1));
  document.getElementById('setup-phase-label').innerText = `STEP ${setupPhase} OF 2`;

  // Title / subtitle
  document.getElementById('setup-title').innerText = isPhase1
    ? 'CHOOSE YOUR START SCREEN'
    : 'HOW WOULD YOU LIKE TO BROWSE?';
  document.getElementById('setup-subtitle').innerText = isPhase1
    ? 'Select the view that greets you every time CREMA opens. You can change this anytime in the System Menu.'
    : 'Pick your preferred way to browse your game library. You can change this anytime in the System Menu.';

  // Cards
  const cardsEl = document.getElementById('setup-cards');
  cardsEl.innerHTML = '';
  options.forEach((opt, i) => {
    const card = document.createElement('div');
    card.className = 'setup-card' + (i === selectedIdx ? ' selected' : '');
    card.innerHTML =
      `<div class="setup-card-imgwrap">
        <img src="${convertSafePath(opt.img)}" alt="${opt.name}">
        <div class="setup-card-check">✓</div>
      </div>
      <div class="setup-card-body">
        <div class="setup-card-name">${opt.name}</div>
        <div class="setup-card-desc">${opt.desc}</div>
      </div>`;
    cardsEl.appendChild(card);
  });

  // Footer hints
  const kb = usingKeyboard;
  const left  = kb ? getKey('←') + getKey('→') : getBtn('dpad_left') + getBtn('dpad_right');
  const back  = kb ? getKey('Esc') : getMappedBtn('EAST');
  const ok    = kb ? getKey('Enter') : getMappedBtn('SOUTH');
  document.getElementById('setup-footer-left').innerHTML =
    isPhase1 ? '' : `${back} ${t('footer.back')}`;
  document.getElementById('setup-footer-right').innerHTML =
    `${left} ${t('footer.navigate')} &nbsp;&nbsp; ${ok} ${isPhase1 ? t('footer.select') : 'CONFIRM &amp; START'}`;
}

function handleSetupInput(action) {
  const isPhase1 = setupPhase === 1;
  const maxIdx = 1;  // start: CAROUSEL/GRID (0-1); browse: LIST/GALLERY (0-1)
  if (action === 'LEFT') {
    if (isPhase1) setupStartIndex = Math.max(0, setupStartIndex - 1);
    else setupBrowseIndex = Math.max(0, setupBrowseIndex - 1);
    playSound(sfxNav); renderSetupScreen();
  } else if (action === 'RIGHT') {
    if (isPhase1) setupStartIndex = Math.min(maxIdx, setupStartIndex + 1);
    else setupBrowseIndex = Math.min(maxIdx, setupBrowseIndex + 1);
    playSound(sfxNav); renderSetupScreen();
  } else if (action === 'BACK' && setupPhase === 2) {
    setupPhase = 1; playSound(sfxBack); renderSetupScreen();
  } else if (action === 'ACCEPT') {
    if (setupPhase === 1) { setupPhase = 2; playSound(sfxSelect); renderSetupScreen(); }
    else { completeSetup(); }
  }
}

async function completeSetup() {
  playSound(sfxSelect);
  const startModes = ['CAROUSEL', 'GRID'];
  const browseModes = ['LIST', 'GALLERY'];
  audioCfg.startScreenMode = startModes[setupStartIndex];
  audioCfg.browseMode = browseModes[setupBrowseIndex];
  window.api.saveAudioConfig(audioCfg);
  window.api.setSetting('setup_complete', '1');
  document.getElementById('setup-screen').classList.add('hidden');
  transitionToStart();
  resetIdleTimer();
}

// ════════════════════════════════════════════════════════════════════════════
//  HOME — "Marquee" couch dashboard (optional start screen, precedes the library)
//  Data comes from the shared core engine (window.api.getHomeStats), the same
//  one The Manager uses — so the numbers never drift between the two faces.
// ════════════════════════════════════════════════════════════════════════════
let homeRows = [];                 // [{ key, cells:[{type,game?,id,el}] }]
let homeFocus = { row: 0, col: 0 };
const _CH_LIB  = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`;
const _CH_DICE = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.3" fill="currentColor"/><circle cx="16" cy="16" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/></svg>`;
function _che(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function _chImg(t, hero) { if (!t) return ''; const p = hero ? (t.HeroArt || t.Screenshot || t.CoverArt) : (t.CoverArt || t.HeroArt || t.Logo); return p ? convertSafePath(String(p).split('|')[0]) : ''; }
function _chFmt(amount, currency) { if (amount == null) return ''; const a = Number(amount); if (!isFinite(a)) return ''; if (currency === 'USD' || currency === 'CAD' || currency === 'AUD') return '$' + a.toFixed(2); if (currency === 'EUR') return '€' + a.toFixed(2); if (currency === 'GBP') return '£' + a.toFixed(2); if (currency === 'BRL') return 'R$' + a.toFixed(2); return a.toFixed(2) + (currency ? (' ' + currency) : ''); }

function transitionToHome() {
  gameState = 'HOME';
  clearMediaLoaders(); clearGalleryMedia();
  ['splash-screen', 'start-screen', 'main-screen', 'gallery-screen', 'ggp-screen', 'wrapped-screen'].forEach(id => { const el = document.getElementById(id); if (el) el.classList.add('hidden'); });
  document.getElementById('overlay-backdrop')?.classList.add('hidden');
  document.getElementById('home-screen').classList.remove('hidden');
  setBlur(false);
  renderHomeScreen();
}

async function renderHomeScreen() {
  const enabled = audioCfg.homeRows || ['recent', 'gems', 'played'];
  const wantWishlist = enabled.includes('wishlist'), wantFree = enabled.includes('freebies'), wantNews = enabled.includes('news'),
        wantProton = enabled.includes('protonwatch'), wantGameNews = enabled.includes('gamenews');
  const [snap, wlRes, freeRes, newsRes, protonRes, gnRes, itadCurrency, itadClick, achRes] = await Promise.all([
    window.api.getHomeStats({ hidePico8: _cremaHidePico8 }).then(s => s || {}),
    wantWishlist ? window.api.wishlistDeals() : Promise.resolve(null),
    wantFree ? window.api.freeGames() : Promise.resolve(null),
    wantNews ? window.api.getNews() : Promise.resolve(null),
    wantProton ? window.api.protonWatchGet() : Promise.resolve(null),
    wantGameNews ? window.api.getGameNews() : Promise.resolve(null),
    wantWishlist ? window.api.getSetting('itad_currency') : Promise.resolve(''),
    wantWishlist ? window.api.getSetting('itad_click') : Promise.resolve('store'),
    window.api.achGet(),
  ]);
  const c = snap.counts || {}, dp = snap.dailyPick;
  const rows = [];
  let html = '<div class="ch-wrap">';
  const dateStr = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  html += `<div class="ch-top"><div class="ch-greet"><div class="g1">CREMA</div><div class="g2">${_che(dateStr)}</div></div><div class="ch-stats">`
    + `<div class="ch-stat"><div class="n">${c.total || 0}</div><div class="l">Games</div></div>`
    + `<div class="ch-stat"><div class="n">${c.installed || 0}</div><div class="l">Installed</div></div>`
    + `<div class="ch-stat"><div class="n">${c.backlog || 0}</div><div class="l">Backlog</div></div>`
    + `<div class="ch-stat"><div class="n">${(snap.backlog && snap.backlog.hours) || 0}h</div><div class="l">To Clear</div></div>`
    + ((snap.playtime && snap.playtime.totalHours) ? `<div class="ch-stat"><div class="n">${snap.playtime.totalHours}h</div><div class="l">Played</div></div>` : '')
    + (c.total ? `<div class="ch-stat"><div class="n">${snap.beatenPct || 0}%</div><div class="l">Beaten</div></div>` : '')
    + ((achRes && achRes.avgPct) ? `<div class="ch-stat"><div class="n">${achRes.avgPct}%</div><div class="l">Achiev</div></div>` : '')
    + `</div></div>`;
  if (dp) {
    const img = _chImg(dp, true);
    const meta = [dp.Store, (dp.GENRE || '').split(',')[0].trim(), dp.METACRITIC ? ('MC ' + dp.METACRITIC) : '', dp.HLTB_Main].filter(Boolean).join('   •   ');
    html += `<div class="ch-hero" id="che-h">${img ? `<img src="${img}">` : ''}<div class="ov"><span class="pill">Today's Pick</span><div class="ht">${_che(dp.Game)}</div><div class="hs">${_che(meta)}</div></div></div>`;
    rows.push({ key: 'featured', cells: [{ type: 'game', game: dp, id: 'che-h' }] });
  }
  const aCells = [];
  let aHtml = '<div class="ch-actions">';
  aHtml += `<div class="ch-act" id="che-a0"><div class="ai">${_CH_LIB}</div><div><div class="at">Enter Library</div><div class="asub">Browse everything</div></div></div>`;
  aCells.push({ type: 'library', id: 'che-a0' });
  aHtml += `<div class="ch-act" id="che-a1"><div class="ai">${_CH_DICE}</div><div><div class="at">Surprise Me</div><div class="asub">Random pick</div></div></div>`;
  aCells.push({ type: 'roulette', id: 'che-a1' });
  if (snap.continuePlaying) { const cg = snap.continuePlaying, cov = _chImg(cg, false); aHtml += `<div class="ch-act" id="che-a2">${cov ? `<img class="cov" src="${cov}">` : `<div class="ai">${_CH_LIB}</div>`}<div><div class="at">Continue</div><div class="asub">${_che(cg.Game)}</div></div></div>`; aCells.push({ type: 'game', game: cg, id: 'che-a2' }); }
  aHtml += `<div class="ch-act" id="che-aw"><div class="ai">${_CH_STAR}</div><div><div class="at">Your Year</div><div class="asub">Library Wrapped</div></div></div>`;
  aCells.push({ type: 'wrapped', id: 'che-aw' });
  aHtml += '</div>';
  html += aHtml;
  rows.push({ key: 'actions', cells: aCells });
  const rowData = { recent: ['Recently Imported', snap.recentlyImported], gems: ['Hidden Gems', snap.hiddenGems], played: ['Recently Played', snap.recentlyPlayed] };
  ['recent', 'gems', 'played'].forEach(k => {
    if (!enabled.includes(k)) return;
    const [title, items] = rowData[k];
    if (!items || !items.length) return;
    let rh = `<div class="ch-rowsec"><h3>${title}</h3><div class="ch-row">`;
    const cells = [];
    items.forEach((g, i) => { const cov = _chImg(g, false), id = `che-${k}-${i}`; rh += `<div class="ch-tile" id="${id}">${cov ? `<img src="${cov}" loading="lazy">` : `<div class="ph"></div>`}<div class="tn">${_che(g.Game)}</div></div>`; cells.push({ type: 'game', game: g, id }); });
    rh += '</div></div>';
    html += rh;
    rows.push({ key: k, cells });
  });
  if (enabled.includes('mostplayed') && snap.mostPlayed && snap.mostPlayed.length) {
    let rh = `<div class="ch-rowsec"><h3>Most Played</h3><div class="ch-row">`;
    const cells = [];
    snap.mostPlayed.forEach((g, i) => {
      const cov = _chImg(g, false), id = `che-mp-${i}`, m = Number(g.Playtime) || 0;
      rh += `<div class="ch-tile" id="${id}">${cov ? `<img src="${cov}" loading="lazy">` : `<div class="ph"></div>`}<div class="tn">${_che(g.Game)}</div><div class="ch-price">${m >= 60 ? Math.round(m / 60) + 'h' : m + 'm'}</div></div>`;
      cells.push({ type: 'game', game: g, id });
    });
    rh += '</div></div>'; html += rh; rows.push({ key: 'mostplayed', cells });
  }
  if (enabled.includes('couchnight') && snap.couchNight && snap.couchNight.length) {
    let rh = `<div class="ch-rowsec"><h3>Couch Night</h3><div class="ch-row">`;
    const cells = [];
    snap.couchNight.forEach((g, i) => { const cov = _chImg(g, false), id = `che-cn-${i}`; rh += `<div class="ch-tile" id="${id}">${cov ? `<img src="${cov}" loading="lazy">` : `<div class="ph"></div>`}<div class="tn">${_che(g.Game)}</div></div>`; cells.push({ type: 'game', game: g, id }); });
    rh += '</div></div>'; html += rh; rows.push({ key: 'couchnight', cells });
  }
  if (wantWishlist && wlRes && wlRes.rows && wlRes.rows.length) {
    let rh = `<div class="ch-rowsec"><h3>Wishlist</h3><div class="ch-row">`;
    const cells = [];
    wlRes.rows.forEach((r, i) => {
      const id = `che-wl-${i}`, deal = r.deal;
      const storeUrl = (deal && deal.url) ? deal.url : '', itadUrl = r.slug ? `https://isthereanydeal.com/game/${r.slug}/info/` : '';
      const url = (itadClick === 'itad') ? (itadUrl || storeUrl) : (storeUrl || itadUrl);
      const priceTxt = deal ? `${_chFmt(deal.price, itadCurrency || deal.currency)}${deal.cut ? `  -${deal.cut}%` : ''}` : '';
      rh += `<div class="ch-tile" id="${id}">${r.cover ? `<img src="${_che(r.cover)}" loading="lazy">` : `<div class="ph"></div>`}<div class="tn">${_che(r.title)}</div>${priceTxt ? `<div class="ch-price">${_che(priceTxt)}</div>` : ''}</div>`;
      cells.push({ type: 'url', url, id });
    });
    rh += '</div></div>'; html += rh; rows.push({ key: 'wishlist', cells });
  }
  if (wantFree && freeRes && freeRes.length) {
    let rh = `<div class="ch-rowsec"><h3>Free This Week</h3><div class="ch-row">`;
    const cells = [];
    freeRes.forEach((g, i) => {
      const id = `che-fr-${i}`;
      rh += `<div class="ch-tile" id="${id}">${g.cover ? `<img src="${_che(g.cover)}" loading="lazy">` : `<div class="ph"></div>`}<div class="tn">${_che(g.title)}</div><div class="ch-price ch-free">FREE</div></div>`;
      cells.push({ type: 'url', url: g.url, id });
    });
    rh += '</div></div>'; html += rh; rows.push({ key: 'freebies', cells });
  }
  if (wantNews && newsRes && newsRes.length) {
    let rh = `<div class="ch-rowsec"><h3>Gaming News</h3><div class="ch-row">`;
    const cells = [];
    newsRes.slice(0, 12).forEach((n, i) => {
      const id = `che-nw-${i}`;
      rh += `<div class="ch-news" id="${id}"><div class="ch-news-t">${_che(n.title)}</div><div class="ch-news-s">${_che(n.source)}</div></div>`;
      cells.push({ type: 'url', url: n.link, id });
    });
    rh += '</div></div>'; html += rh; rows.push({ key: 'news', cells });
  }
  if (wantProton && protonRes && protonRes.changes) {
    const PW_R = { BORKED: 0, PENDING: 1, BRONZE: 2, SILVER: 3, GOLD: 4, PLATINUM: 5, NATIVE: 6 };
    const PW_C = { NATIVE: '#66bb6a', PLATINUM: '#b8c6db', GOLD: '#d4af37', SILVER: '#9aa0a6', BRONZE: '#cd7f32' };
    const climbed = protonRes.changes.filter(c => c.improved && (PW_R[c.now] ?? -1) >= 4).sort((a, b) => (PW_R[b.now] ?? 0) - (PW_R[a.now] ?? 0)).slice(0, 12);
    if (climbed.length) {
      let rh = `<div class="ch-rowsec"><h3>Proton Watch</h3><div class="ch-row">`;
      const cells = [];
      climbed.forEach((cc, i) => { const id = `che-pw-${i}`; rh += `<div class="ch-news" id="${id}"><div class="ch-news-t">${_che(cc.game)}</div><div class="ch-news-s" style="color:${PW_C[cc.now] || 'var(--accent)'}">${cc.old ? _che(String(cc.old).toUpperCase()) + ' → ' : ''}${_che(cc.now)}</div></div>`; cells.push({ type: 'game', game: { id: cc.id }, id }); });
      rh += '</div></div>'; html += rh; rows.push({ key: 'protonwatch', cells });
    }
  }
  if (wantGameNews && gnRes && gnRes.length) {
    let rh = `<div class="ch-rowsec"><h3>Your Games &mdash; What's New</h3><div class="ch-row">`;
    const cells = [];
    gnRes.slice(0, 12).forEach((n, i) => { const id = `che-gn-${i}`; rh += `<div class="ch-news" id="${id}"><div class="ch-news-t">${_che(n.title)}</div><div class="ch-news-s">${_che(n.source)}</div></div>`; cells.push({ type: 'url', url: n.url, id }); });
    rh += '</div></div>'; html += rh; rows.push({ key: 'gamenews', cells });
  }
  html += `<div class="ch-foot">D-Pad Navigate &nbsp;&bull;&nbsp; A Select &nbsp;&bull;&nbsp; B Library &nbsp;&bull;&nbsp; Start Menu</div>`;
  html += '</div>';
  document.getElementById('home-content').innerHTML = html;
  rows.forEach(r => r.cells.forEach(cell => { cell.el = document.getElementById(cell.id); }));
  homeRows = rows.filter(r => r.cells.some(c => c.el));
  homeFocus = { row: 0, col: 0 };
  updateHomeFocus();
}

function updateHomeFocus() {
  document.querySelectorAll('#home-content .ch-focus').forEach(e => e.classList.remove('ch-focus'));
  const row = homeRows[homeFocus.row]; if (!row) return;
  const cell = row.cells[homeFocus.col]; if (!cell || !cell.el) return;
  cell.el.classList.add('ch-focus');
  cell.el.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
}

function homeHandleInput(action) {
  if (action === 'START') { openOverlay('MAIN_MENU'); return; }
  if (action === 'BACK')  { playSound(sfxBack); transitionToStart(); return; }
  if (!homeRows.length) return;
  const row = homeRows[homeFocus.row]; if (!row) return;
  if (action === 'UP') { if (homeFocus.row > 0) { homeFocus.row--; homeFocus.col = Math.min(homeFocus.col, homeRows[homeFocus.row].cells.length - 1); playSound(sfxNav); updateHomeFocus(); } }
  else if (action === 'DOWN') { if (homeFocus.row < homeRows.length - 1) { homeFocus.row++; homeFocus.col = Math.min(homeFocus.col, homeRows[homeFocus.row].cells.length - 1); playSound(sfxNav); updateHomeFocus(); } }
  else if (action === 'LEFT') { if (homeFocus.col > 0) { homeFocus.col--; playSound(sfxNav); updateHomeFocus(); } }
  else if (action === 'RIGHT') { if (homeFocus.col < row.cells.length - 1) { homeFocus.col++; playSound(sfxNav); updateHomeFocus(); } }
  else if (action === 'ACCEPT') {
    const cell = row.cells[homeFocus.col]; if (!cell) return; playSound(sfxSelect);
    if (cell.type === 'game') cremaOpenGame(cell.game);
    else if (cell.type === 'library') transitionToStart();
    else if (cell.type === 'roulette') homeSpin();
    else if (cell.type === 'wrapped') openWrapped();
    else if (cell.type === 'url') { if (cell.url) window.api.openInstallUrl(cell.url); }
  }
}

async function homeSpin() { const g = await window.api.getRandomGame({ hidePico8: _cremaHidePico8 }); if (g) cremaOpenGame(g); }

// Open a specific game from Home, honoring the browse mode: GALLERY opens that
// game's gamepage (like clicking a gallery cell); LIST selects it in the library
// (its classic gamepage panel is always shown for the selected game).
function cremaOpenGame(game) {
  if (!game) return;
  document.getElementById('home-screen')?.classList.add('hidden');
  const i = categories.indexOf('ALL GAMES'); currentCategoryIndex = i >= 0 ? i : 0;
  if ((audioCfg.browseMode || 'LIST') === 'GALLERY') {
    transitionToGallery();
    const idx = galleryGames.findIndex(g => String(g.id) === String(game.id));
    if (idx >= 0) { galleryIndex = idx; openGalleryGamepage(galleryGames[idx]); }
  } else {
    transitionToMain();
    const idx = filteredGames.findIndex(g => String(g.id) === String(game.id));
    if (idx >= 0) { currentGameIndex = idx; updateGameSelection(); }
  }
}

function openHomeMenu() {
  gameState = 'OVERLAY'; currentOverlayType = 'HOME_MENU'; playSound(sfxSelect);
  const items = [(audioCfg.homeEnabled ? '★ ' : '') + 'SHOW HOME ON STARTUP'];
  [['recent', 'RECENTLY IMPORTED'], ['gems', 'HIDDEN GEMS'], ['played', 'RECENTLY PLAYED'], ['mostplayed', 'MOST PLAYED'], ['couchnight', 'COUCH NIGHT'], ['wishlist', 'WISHLIST'], ['freebies', 'FREE THIS WEEK'], ['news', 'GAMING NEWS'], ['gamenews', 'YOUR GAMES NEWS'], ['protonwatch', 'PROTON WATCH']]
    .forEach(([k, l]) => items.push((audioCfg.homeRows.includes(k) ? '★ ' : '') + l));
  items.push(t('common.back_to_menu'));
  renderGenericOverlay('HOME SCREEN', items);
}

// ── Cinematic "Wrapped" — full-screen, gamepad-paged library year-in-review ──
const _CH_STAR = `<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M12 2l2.9 6.3 6.9.6-5.2 4.6 1.6 6.8L12 17.3 5.8 20.9l1.6-6.8L2.2 8.9l6.9-.6z"/></svg>`;
let wrappedSlides = [], wrappedIndex = 0;
function buildWrappedSlides(w) {
  const s = [];
  s.push(`<div class="wr-intro"><div class="wr-kick">Your Library</div><div class="wr-title">WRAPPED</div><div class="wr-year">${w.year || new Date().getFullYear()}</div><div class="wr-hint">A to begin &middot; B to exit</div></div>`);
  if (w.totalHours) s.push(`<div class="wr-slide"><div class="wr-kick">Time well spent</div><div class="wr-num">${w.totalHours}<span>h</span></div><div class="wr-lbl">hours played</div><div class="wr-sub">on Steam</div></div>`);
  if (w.topPlayed) { const cov = _chImg(w.topPlayed, false); s.push(`<div class="wr-slide"><div class="wr-kick">Your #1</div>${cov ? `<img class="wr-cover" src="${cov}">` : ''}<div class="wr-big2">${_che(w.topPlayed.Game)}</div><div class="wr-lbl">your most played &mdash; ${w.topPlayed.hours || 0}h</div></div>`); }
  if (w.addedThisYear) s.push(`<div class="wr-slide"><div class="wr-num">${w.addedThisYear}</div><div class="wr-lbl">games added in ${w.year}</div></div>`);
  if (w.topGenre) s.push(`<div class="wr-slide"><div class="wr-kick">Your vibe</div><div class="wr-big2">${_che(w.topGenre)}</div><div class="wr-lbl">your top genre${w.topDecade ? `, mostly the ${_che(w.topDecade)}` : ''}</div></div>`);
  if (w.protonReadyPct != null) s.push(`<div class="wr-slide"><div class="wr-kick">Penguin approved</div><div class="wr-num">${w.protonReadyPct}<span>%</span></div><div class="wr-lbl">of your rated library runs Gold+ on Proton</div></div>`);
  if (w.beaten) s.push(`<div class="wr-slide"><div class="wr-num">${w.beaten}</div><div class="wr-lbl">games beaten</div></div>`);
  s.push(`<div class="wr-intro"><div class="wr-kick">${w.totalGames || 0} games strong</div><div class="wr-title">THAT'S A WRAP</div><div class="wr-hint">Press B to return</div></div>`);
  return s;
}
async function openWrapped() {
  playSound(sfxSelect);
  const snap = (await window.api.getHomeStats({ hidePico8: _cremaHidePico8 })) || {};
  wrappedSlides = buildWrappedSlides(snap.wrapped || {});
  wrappedIndex = 0;
  gameState = 'WRAPPED';
  document.getElementById('home-screen')?.classList.add('hidden');
  document.getElementById('wrapped-screen').classList.remove('hidden');
  renderWrappedSlide();
}
function renderWrappedSlide() {
  document.getElementById('wrapped-content').innerHTML = wrappedSlides[wrappedIndex] || '';
  document.getElementById('wrapped-dots').innerHTML = wrappedSlides.map((_, i) => `<div class="wr-dot${i === wrappedIndex ? ' on' : ''}"></div>`).join('');
}
function wrappedHandleInput(action) {
  if (action === 'BACK' || action === 'START') { closeWrapped(); return; }
  if (action === 'RIGHT' || action === 'ACCEPT' || action === 'DOWN') {
    if (wrappedIndex < wrappedSlides.length - 1) { wrappedIndex++; playSound(sfxNav); renderWrappedSlide(); }
    else closeWrapped();
  } else if (action === 'LEFT' || action === 'UP') {
    if (wrappedIndex > 0) { wrappedIndex--; playSound(sfxNav); renderWrappedSlide(); }
  }
}
function closeWrapped() {
  playSound(sfxBack);
  document.getElementById('wrapped-screen').classList.add('hidden');
  transitionToHome();
}

async function boot() {
  currentLang = await window.api.getSetting('language') || 'en';
  strings = await window.api.getStrings(currentLang);
  applyI18nToDOM();
  updateAppScale(); await initAudio(); await resolveAndApplyTheme(); renderHardwareIcons();
  const recSetting = await window.api.getSetting('crema_recent_count'); if (recSetting !== null) { recentGamesCount = parseInt(recSetting, 10); }
  _cremaHidePico8 = (await window.api.getSetting('crema_hide_pico8')) === '1';
  await window.api.syncGrinderInstalled().catch(() => {});
  const res = await window.api.getGames(); allGames = (res.games || []).filter(g => g.Game && String(g.Game).trim() !== "");
  await loadGamePlaylists();
  for (let g of allGames) { if (g.Screenshot && String(g.Screenshot).trim() !== "") { let paths = String(g.Screenshot).split('|').filter(s => s.trim() !== ""); paths.forEach(p => availableScreenshots.push({ path: p, game: g })); } }
  let prog = 0; const bar = document.getElementById('splash-bar'); const txt = document.getElementById('splash-text');
  const l = setInterval(() => { prog += 2; bar.style.width = `${prog}%`; if (prog === 30) txt.innerText = t('status.grinding'); if (prog === 60) txt.innerText = t('status.brewing'); if (prog >= 100) { clearInterval(l); document.querySelector('.splash-logo').classList.add('boot-anim'); setTimeout(async () => { hasBooted = true; const setupDone = await window.api.getSetting('setup_complete'); if (!setupDone) { applyBgmMode(); showSetupScreen(); } else { if (audioCfg.homeEnabled) transitionToHome(); else transitionToStart(); applyBgmMode(); resetIdleTimer(); } }, 800); } }, 30);
  requestAnimationFrame(pollGamepad); window.api.onDownloadProgress(updateDownloadProgressBar);
  window.api.onInstallStatusUpdated(() => refreshDatabase());
}

let inputDebounce = false; let navRepeatDelay = 180; let lastSelectionTime = 0; let wakeHoldFrames = 0;

function tryLaunch(game) {
  let launchers = [];
  try { launchers = JSON.parse(game.LaunchCommands || '[]'); } catch(e) {}
  if (launchers.length >= 2) {
    showLauncherPicker(game, launchers);
  } else {
    const cmd = launchers.length === 1 ? launchers[0].cmd : game.LaunchCommand;
    enterSleepMode(cmd ? { ...game, LaunchCommand: cmd } : game);
  }
}

function showLauncherPicker(game, launchers) {
  _lpGame = game; _lpList = launchers; _lpIndex = 0;
  document.getElementById('lp-game-title').textContent = game.Game;
  renderLpList();
  document.getElementById('launcher-pick-backdrop').classList.remove('hidden');
  previousGameState = gameState;
  gameState = 'LAUNCHER_PICK';
}

function hideLauncherPicker() {
  document.getElementById('launcher-pick-backdrop').classList.add('hidden');
  _lpGame = null;
  gameState = previousGameState;
}

function renderLpList() {
  const el = document.getElementById('lp-list');
  el.innerHTML = '';
  _lpList.forEach((l, i) => {
    const div = document.createElement('div');
    div.className = 'overlay-item' + (i === _lpIndex ? ' selected' : '');
    div.textContent = l.label || l.cmd;
    el.appendChild(div);
  });
}

function enterSleepMode(game) {
  document.body.style.backgroundColor = 'var(--text_sec)';
  setTimeout(() => { document.body.style.backgroundColor = '#000000'; }, 150);
  gameState = 'GAME_RUNNING'; wakeHoldFrames = 0; clearMediaLoaders(); fadeBGM(0);

  const sleepScreen = document.getElementById('sleep-screen'); const sleepCover = document.getElementById('sleep-cover'); const sleepTitle = document.getElementById('sleep-title'); const sleepInst = document.getElementById('sleep-instruction');
  if (game.CoverArt && game.CoverArt.trim() !== "") { sleepCover.src = convertSafePath(game.CoverArt); sleepCover.style.display = 'block'; } else { sleepCover.style.display = 'none'; }
  sleepTitle.innerText = game.Game;
  let instructionText = audioCfg.wakeMethod || "START + SELECT";
  if (instructionText.includes("HOLD")) {
    const method = instructionText.replace(" (HOLD 2 SEC)", "");
    sleepInst.innerText = t('sleep.hold_return', {method});
  } else {
    sleepInst.innerText = t('sleep.press_return', {method: instructionText});
  }
  sleepScreen.classList.remove('hidden');

  window.api.updateLastPlayed(game.Game).then(() => { refreshDatabase(); });
  window.api.launchGame(game.LaunchCommand);
}

function wakeUpCrema() {
  playSound(sfxSelect);
  document.body.style.backgroundColor = 'var(--bg)';
  document.getElementById('sleep-screen').classList.add('hidden');
  // Clean up immersive gamepage if it was open
  const cfgp = document.getElementById('cfgp-screen');
  if (cfgp && !cfgp.classList.contains('hidden')) {
    _cfgpStopKenBurns();
    const v = document.getElementById('cfgp-video'); if (v) { v.pause(); v.src = ''; v.style.display = 'none'; }
    cfgp.classList.add('hidden');
    _cfgpGame = null;
  }
  transitionToMain(); // restores correct screen (main-screen or gallery-screen per browseMode)
  window.api.forceFocus();
}

function pollGamepad() {
  const pads = navigator.getGamepads ? Array.from(navigator.getGamepads()) : [];
  const gp = pads.find(g => g && g.buttons && g.buttons.length > 0);

  if (gameState === 'GAME_RUNNING') {
    if (gp) {
      const st = gp.buttons[9]?.pressed; const sel = gp.buttons[8]?.pressed; const l1 = gp.buttons[4]?.pressed; const r1 = gp.buttons[5]?.pressed; const l3 = gp.buttons[10]?.pressed; const r3 = gp.buttons[11]?.pressed;
      let comboMatched = false; const method = audioCfg.wakeMethod || "START + SELECT";
      if (method.includes("L1 + R1 + START + SELECT")) { comboMatched = l1 && r1 && st && sel; } else if (method.includes("L3 + R3")) { comboMatched = l3 && r3; } else { comboMatched = st && sel; }
      if (comboMatched) { if (method.includes("HOLD 2 SEC")) { wakeHoldFrames++; if (wakeHoldFrames >= 120) { wakeHoldFrames = 0; wakeUpCrema(); } } else { wakeHoldFrames = 0; wakeUpCrema(); } } else { wakeHoldFrames = 0; }
    }
    requestAnimationFrame(pollGamepad); return;
  }

  // Screensaver input is checked outside the debounce gate so the first button press always works.
  // A 300ms cooldown after start prevents the button that triggered the screensaver from
  // immediately dismissing it (e.g. holding A on "VIEW SCREENSAVER NOW").
  if (gp && gameState === 'SCREENSAVER') {
    if (Date.now() - screensaverStartTime >= 300) {
      const a = gp.buttons[0]?.pressed, x = gp.buttons[2]?.pressed, yBtn = gp.buttons[3]?.pressed;
      const anyBtn = Array.from(gp.buttons).some(b => b?.pressed);
      if (anyBtn) {
        setInputMethod(false);
        inputDebounce = true; setTimeout(() => { inputDebounce = false; }, 180);
        if (a) handleSSAction('LAUNCH'); else if (yBtn) handleSSAction('FAV'); else if (x) handleSSAction('WANT'); else stopScreensaver();
      }
    }
    requestAnimationFrame(pollGamepad); return;
  }

  if (gp && !inputDebounce) {
    const a = gp.buttons[0]?.pressed, b = gp.buttons[1]?.pressed, x = gp.buttons[2]?.pressed, yBtn = gp.buttons[3]?.pressed;
    const selBtn = gp.buttons[8]?.pressed, st = gp.buttons[9]?.pressed, l1 = gp.buttons[4]?.pressed, r1 = gp.buttons[5]?.pressed;
    const l2 = gp.buttons[6]?.pressed, r2 = gp.buttons[7]?.pressed; const l3 = gp.buttons[10]?.pressed, r3 = gp.buttons[11]?.pressed;
    const u = gp.buttons[12]?.pressed || (gp.axes && gp.axes[1] < -0.5); const d = gp.buttons[13]?.pressed || (gp.axes && gp.axes[1] > 0.5);
    const l = gp.buttons[14]?.pressed || (gp.axes && gp.axes[0] < -0.5); const r = gp.buttons[15]?.pressed || (gp.axes && gp.axes[0] > 0.5);

    if (u || d || l || r || a || b || x || yBtn || selBtn || st || l1 || r1 || l2 || r2 || l3 || r3) {
      setInputMethod(false);
      inputDebounce = true; setTimeout(() => { inputDebounce = false; }, navRepeatDelay);
      if (u || d || l || r || l1 || r1) { navRepeatDelay = Math.max(40, navRepeatDelay - 35); } else { navRepeatDelay = 180; }
      try {
        if (l3) handleInput('L3'); else if (r3) handleInput('R3'); else if (l2) handleInput('L2'); else if (r2) handleInput('R2');
        else {
          resetIdleTimer();
          if (u) handleInput('UP'); else if (d) handleInput('DOWN'); else if (l) handleInput('LEFT'); else if (r) handleInput('RIGHT');
          else if (a) handleInput('ACCEPT'); else if (b) handleInput('BACK'); else if (x) handleInput('X_BUTTON'); else if (yBtn) handleInput('Y_BUTTON');
          else if (selBtn) handleInput('SELECT_BTN'); else if (st) handleInput('START'); else if (l1) handleInput('L1'); else if (r1) handleInput('R1');
        }
      } catch (err) { setDebug("ERR: " + err.message, true); }
    }
  } else if (gp && inputDebounce) {
    if ((!gp.axes || (Math.abs(gp.axes[1]) < 0.2 && Math.abs(gp.axes[0]) < 0.2)) && !gp.buttons[12]?.pressed && !gp.buttons[13]?.pressed && !gp.buttons[14]?.pressed && !gp.buttons[15]?.pressed && !gp.buttons[0]?.pressed && !gp.buttons[1]?.pressed && !gp.buttons[2]?.pressed && !gp.buttons[3]?.pressed && !gp.buttons[8]?.pressed && !gp.buttons[9]?.pressed && !gp.buttons[4]?.pressed && !gp.buttons[5]?.pressed && !gp.buttons[6]?.pressed && !gp.buttons[7]?.pressed && !gp.buttons[10]?.pressed && !gp.buttons[11]?.pressed) {
      inputDebounce = false; navRepeatDelay = 180;
    }
  }
  requestAnimationFrame(pollGamepad);
}

const keysHeld = new Set();
window.addEventListener('keyup', (e) => { keysHeld.delete(e.key); });

window.addEventListener('keydown', (e) => {
  try {
    keysHeld.add(e.key);
    if (e.key === 'Tab') e.preventDefault();
    if (gameState === 'GAME_RUNNING') {
      if (e.key === 'Escape' || e.key === 'Backspace') { wakeUpCrema(); return; }
      if (keysHeld.has(',') && keysHeld.has('.')) { wakeUpCrema(); return; }
      return;
    }
    setInputMethod(true);
    if (gameState === 'SCREENSAVER') { if (e.key === 'Enter') handleSSAction('LAUNCH'); else if (e.key === 'y' || e.key === 'Y') handleSSAction('FAV'); else if (e.key === 'x' || e.key === 'X') handleSSAction('WANT'); else stopScreensaver(); }
    else {
      resetIdleTimer();
      if (gameState === 'OSK') {
        if (e.key === 'Backspace') {
          if (oskMode === 'SEARCH') { searchQuery = searchQuery.slice(0, -1); applyLiveFilters(false); }
          else if (oskMode === 'JB_SEARCH') { jbSearchQuery = jbSearchQuery.slice(0, -1); renderJbList(); }
          else if (oskMode === 'GALLERY_SEARCH') { galleryQuery = galleryQuery.slice(0, -1); applyGalleryFilter(); renderGalleryGrid(); }
          else tempOskString = tempOskString.slice(0, -1);
          playSound(sfxNav); renderOSK(); return;
        }
        if (e.key === 'Enter') {
          const savedR = oskR, savedC = oskC;
          oskR = 5; oskC = 4; // DONE key position in the grid
          handleOSKInput('ACCEPT');
          if (gameState === 'OSK') { oskR = savedR; oskC = savedC; renderOSK(); }
          return;
        }
        if (e.key.length === 1) {
          const ch = e.key.toUpperCase();
          if (oskMode === 'SEARCH') { searchQuery += ch; applyLiveFilters(false); }
          else if (oskMode === 'JB_SEARCH') { jbSearchQuery += ch; renderJbList(); }
          else if (oskMode === 'GALLERY_SEARCH') { galleryQuery += ch; applyGalleryFilter(); renderGalleryGrid(); }
          else tempOskString += ch;
          playSound(sfxNav); renderOSK(); return;
        }
        // Arrow keys + Escape fall through to the existing routing below (OSK grid navigation)
      }
      if (e.key === 'ArrowUp') handleInput('UP'); else if (e.key === 'ArrowDown') handleInput('DOWN'); else if (e.key === 'ArrowLeft') handleInput('LEFT'); else if (e.key === 'ArrowRight') handleInput('RIGHT');
      else if (e.key === 'Enter' || e.key === ' ') handleInput('ACCEPT'); else if (e.key === 'Escape' || e.key === 'Backspace') handleInput('BACK');
      else if (e.key === 'x' || e.key === 'X') handleInput('X_BUTTON'); else if (e.key === 'y' || e.key === 'Y') handleInput('Y_BUTTON');
      else if (e.key === 'o' || e.key === 'O') handleInput('SELECT_BTN'); else if (e.key === 'm' || e.key === 'M') handleInput('START');
      else if (e.key === 'PageUp') handleInput('L1'); else if (e.key === 'PageDown') handleInput('R1');
      else if (e.key === '[' || e.key === ',') {
        const inGallery = gameState === 'GALLERY' || gameState === 'GALLERY_GAMEPAGE';
        handleInput(inGallery ? 'L1' : 'L3');
      }
      else if (e.key === ']' || e.key === '.') {
        const inGallery = gameState === 'GALLERY' || gameState === 'GALLERY_GAMEPAGE';
        handleInput(inGallery ? 'R1' : 'R3');
      }
    }
  } catch (err) { setDebug("ERR: " + err.message, true); }
});

function jumpPages(direction) {
  const count = filteredGames.length; if (count === 0) return;
  if (direction === "R1") { currentGameIndex = Math.min(currentGameIndex + 10, count - 1); } else { currentGameIndex = Math.max(currentGameIndex - 10, 0); }
  playSound(sfxNav); updateGameSelection();
}

function handleInput(action) {
  if (gameState === 'SETUP') { handleSetupInput(action); return; }
  if (action === 'L3' && isCustom && audioCfg.bgm && audioCfg.bgm_mode === "CUSTOM") { if (bgmAudio.currentTime > 3) { bgmAudio.currentTime = 0; } else { playNextCustom(true); } return; }
  if (action === 'R3' && isCustom && audioCfg.bgm && audioCfg.bgm_mode === "CUSTOM") { playNextCustom(); return; }

  if (audioCfg.bgm && bgmAudio.paused && bgmAudio.src !== "" && gameState !== 'SPLASH' && audioCfg.bgm_mode !== "OFF" && !isVideoActive() && !window.manualBgmPause) { bgmAudio.volume = audioCfg.vol; bgmAudio.play().catch(e=>{}); } else if (isVideoActive() && !bgmAudio.paused) { bgmAudio.pause(); }
  if (gameState === 'SPLASH' || gameState === 'PROGRESS') return;

  if (gameState === 'START') {
    if (action === 'BACK' && audioCfg.homeEnabled) { playSound(sfxBack); transitionToHome(); return; }
    const _mode = audioCfg.startScreenMode; if (_mode === 'GRID') { if (action === 'UP' || action === 'DOWN' || action === 'LEFT' || action === 'RIGHT') { playSound(sfxNav); navigateGrid(action); } else if (action === 'ACCEPT') { playSound(sfxSelect); transitionToMain(); } else if (action === 'START') openOverlay("MAIN_MENU"); } else { if (action === 'LEFT' || action === 'UP') { playSound(sfxNav); navigateCarousel('left'); } else if (action === 'RIGHT' || action === 'DOWN') { playSound(sfxNav); navigateCarousel('right'); } else if (action === 'ACCEPT') { playSound(sfxSelect); transitionToMain(); } else if (action === 'START') openOverlay("MAIN_MENU"); }
  }
  else if (gameState === 'HOME') { homeHandleInput(action); }
  else if (gameState === 'WRAPPED') { wrappedHandleInput(action); }
  else if (gameState === 'MAIN') {
    if (filteredGames.length === 0 && action !== 'BACK' && action !== 'LEFT' && action !== 'RIGHT' && action !== 'START' && action !== 'Y_BUTTON') return;
    if (action === 'DOWN') { currentGameIndex = (currentGameIndex + 1) % filteredGames.length; playSound(sfxNav); updateGameSelection(); } else if (action === 'UP') { currentGameIndex = (currentGameIndex - 1 + filteredGames.length) % filteredGames.length; playSound(sfxNav); updateGameSelection(); } else if (action === 'L1' || action === 'R1') { jumpPages(action); } else if (action === 'L2') { currentGameIndex = 0; playSound(sfxNav); updateGameSelection(); } else if (action === 'R2') { currentGameIndex = Math.max(0, filteredGames.length - 1); playSound(sfxNav); updateGameSelection(); } else if (action === 'LEFT') { currentCategoryIndex = (currentCategoryIndex - 1 + categories.length) % categories.length; playSound(sfxNav); transitionToMain(); } else if (action === 'RIGHT') { currentCategoryIndex = (currentCategoryIndex + 1) % categories.length; playSound(sfxNav); transitionToMain(); } else if (action === 'BACK') { playSound(sfxBack); transitionToStart(); } else if (action === 'START') { openOverlay("MAIN_MENU"); } else if (action === 'SELECT_BTN') { openOverlay("GAME_MENU"); } else if (action === 'Y_BUTTON') { openOSK('SEARCH', t('html.osk_search_title'), searchQuery); }
    else if (action === 'X_BUTTON') {
      if (gameHasTrailer) { playSound(sfxSelect); mediaSwapped = !mediaSwapped; const md = document.getElementById('media-container'), mn = document.getElementById('mini-dock'), v = document.getElementById('video-player'), s = document.getElementById('screenshot-player'), wp = !v.paused; if (mediaSwapped) { md.appendChild(s); mn.appendChild(v); } else { md.appendChild(v); mn.appendChild(s); } if (wp) v.play().catch(e=>{}); }
      else openSearchOverlay();
    }
    else if (action === 'ACCEPT') {
      playSound(sfxSelect);
      const g = filteredGames[currentGameIndex];
      if (g.LaunchCommand) {
        const isInstalled = g.Installed == null || g.Installed == 1;
        const stL = (g.Store || '').toLowerCase();
        if (!isInstalled && (stL.includes('gog') || stL.includes('epic'))) { showGrinderConfirm(g); }
        else { tryLaunch(g); }
      }
      else if (isManualCategory(g)) { openOverlay("GAME_MENU"); }
    }
  }
  else if (gameState === 'GALLERY') {
    if (action === 'LEFT') { navigateGallery('LEFT'); }
    else if (action === 'RIGHT') { navigateGallery('RIGHT'); }
    else if (action === 'UP') { navigateGallery('UP'); }
    else if (action === 'DOWN') { navigateGallery('DOWN'); }
    else if (action === 'ACCEPT') { if (galleryGames.length > 0) { playSound(sfxSelect); openSmartGamepage(galleryGames[galleryIndex]); } }
    else if (action === 'BACK') { playSound(sfxBack); transitionToStart(); }
    else if (action === 'L1') { galleryCatIndex = (galleryCatIndex - 1 + categories.length) % categories.length; playSound(sfxNav); maybeRunFlatpakScan(categories[galleryCatIndex]); maybeRunPico8Scan(categories[galleryCatIndex]); applyGalleryFilter(); renderGalleryGrid(); }
    else if (action === 'R1') { galleryCatIndex = (galleryCatIndex + 1) % categories.length; playSound(sfxNav); maybeRunFlatpakScan(categories[galleryCatIndex]); maybeRunPico8Scan(categories[galleryCatIndex]); applyGalleryFilter(); renderGalleryGrid(); }
    else if (action === 'Y_BUTTON') { openOSK('GALLERY_SEARCH', t('html.osk_search_title'), galleryQuery); }
    else if (action === 'START') { openOverlay("MAIN_MENU"); }
  }
  else if (gameState === 'GALLERY_GAMEPAGE') {
    // Slideshow mode swallows all input except close
    if (ggpSlideshowOpen) {
      if (!ggpTrailerMode && action === 'LEFT') { ggpSlideshowNav(-1); }
      else if (!ggpTrailerMode && action === 'RIGHT') { ggpSlideshowNav(1); }
      else if (action === 'BACK' || action === 'ACCEPT' || ggpTrailerMode) { ggpCloseSlideshow(); }
      return;
    }
    if (action === 'BACK') { playSound(sfxBack); closeGalleryGamepage(); }
    else if (action === 'Y_BUTTON') { if (_cAchAll.length) { playSound(sfxSelect); openCremaAchievementsOverlay(); } }
    else if (action === 'START') { openOverlay("MAIN_MENU"); }
    else if (action === 'SELECT_BTN') { if (galleryCurrentGame) { filteredGames = galleryGames; currentGameIndex = galleryIndex; openOverlay("GAME_MENU"); } }
    else if (action === 'L1') { galleryGamepageNavigate(-1); }
    else if (action === 'R1') { galleryGamepageNavigate(1); }
    else if (ggpFocus === 'BUTTONS') {
      if (action === 'LEFT')  { ggpMoveButton(-1); }
      else if (action === 'RIGHT') { ggpMoveButton(1); }
      else if (action === 'DOWN')  { ggpSetFocus(galleryScreenshots.length > 0 ? 'SS_BANNER' : 'CONTENT'); }
      else if (action === 'ACCEPT') { ggpActivateButton(); }
    }
    else if (ggpFocus === 'SS_BANNER') {
      if (action === 'UP')     { ggpSetFocus('BUTTONS'); }
      else if (action === 'DOWN')   { ggpSetFocus('CONTENT'); }
      else if (action === 'ACCEPT') { ggpOpenSlideshow(); }
    }
    else if (ggpFocus === 'CONTENT') {
      if (action === 'UP') {
        const s = document.getElementById('ggp-scroll');
        if (s && s.scrollTop <= 0) ggpSetFocus(galleryScreenshots.length > 0 ? 'SS_BANNER' : 'BUTTONS');
        else if (s) s.scrollBy({ top: -150, behavior: 'smooth' });
      }
      else if (action === 'DOWN') { const s = document.getElementById('ggp-scroll'); if (s) s.scrollBy({ top: 150, behavior: 'smooth' }); }
    }
  }
  else if (gameState === 'CREMA_FGP') {
    if (action === 'LEFT')         { playSound(sfxNav); _cfgpFocusBtn(_cfgpBtnIdx - 1); }
    else if (action === 'RIGHT')   { playSound(sfxNav); _cfgpFocusBtn(_cfgpBtnIdx + 1); }
    else if (action === 'ACCEPT')  { _cfgpActivateBtn(); }
    else if (action === 'L1')      { galleryGamepageNavigate(-1); openCremaFlatGamepage(galleryCurrentGame); }
    else if (action === 'R1')      { galleryGamepageNavigate(1);  openCremaFlatGamepage(galleryCurrentGame); }
    else if (action === 'BACK')    { playSound(sfxBack); closeCremaFlatGamepage(); document.getElementById('gallery-screen').classList.remove('hidden'); gameState = 'GALLERY'; renderFooters(); }
    else if (action === 'START')   { openOverlay('MAIN_MENU'); }
  }
  else if (gameState === 'OSK') { handleOSKInput(action); }
  else if (gameState === 'GRINDER_CONFIRM') {
    if (action === 'ACCEPT') { triggerGrinderInstall(); }
    else if (action === 'BACK') { playSound(sfxBack); hideGrinderConfirm(); }
    else if (action === 'Y_BUTTON') { hideGrinderConfirm(); openOSK('INSTALL_DIR', 'Install Directory', _grinderInstallDir); }
  }
  else if (gameState === 'LAUNCHER_PICK') {
    if (action === 'DOWN') { _lpIndex = (_lpIndex + 1) % _lpList.length; playSound(sfxNav); renderLpList(); }
    else if (action === 'UP') { _lpIndex = (_lpIndex - 1 + _lpList.length) % _lpList.length; playSound(sfxNav); renderLpList(); }
    else if (action === 'ACCEPT') { playSound(sfxSelect); const chosen = _lpList[_lpIndex]; hideLauncherPicker(); enterSleepMode({ ..._lpGame, LaunchCommand: chosen.cmd }); }
    else if (action === 'BACK') { playSound(sfxBack); hideLauncherPicker(); }
  }
  else if (gameState === 'GRINDER_PROGRESS') {
    if (action === 'BACK') { window.api.grinderCancelHeadless(); hideGrinderProgress(); }
  }
  else if (gameState === 'ACH_OVERLAY') {
    if (action === 'BACK') { playSound(sfxBack); closeCremaAchievementsOverlay(); }
    else if (action === 'L1' || action === 'LEFT')  { playSound(sfxNav); cAchCycleFilter(-1); }
    else if (action === 'R1' || action === 'RIGHT') { playSound(sfxNav); cAchCycleFilter(1); }
    else if (action === 'UP')   { const g = document.getElementById('crema-ach-grid'); if (g) g.scrollBy({ top: -150, behavior: 'smooth' }); }
    else if (action === 'DOWN') { const g = document.getElementById('crema-ach-grid'); if (g) g.scrollBy({ top:  150, behavior: 'smooth' }); }
    else if ((action === 'L2' || action === 'L3') && Object.keys(_cAchStores).length > 1) { playSound(sfxNav); cAchSwitchStore(-1); }
    else if ((action === 'R2' || action === 'R3') && Object.keys(_cAchStores).length > 1) { playSound(sfxNav); cAchSwitchStore(1); }
  }
  else if (gameState === 'JUKEBOX' || gameState === 'JUKEBOX_OVERLAY') { handleJukeboxInput(action); }
  else if (['OVERLAY', 'THEME_CATS', 'THEMES', 'MUSIC_STYLE', 'GAME_SCRAPE_MENU', 'CONFIRM_SCRAPE', 'SCRAPE_RESULT', 'GAMEPAD_MENU', 'WAKE_METHOD_MENU', 'START_SCREEN_MENU', 'LANGUAGE_MENU', 'BROWSE_MODE_MENU', 'GAMEPAGE_STYLE_MENU', 'PLAYLIST_ASSIGN'].includes(gameState)) {
    if (action === 'DOWN') { currentOverlayIndex = nextOverlayIndex(currentOverlayIndex, 1); playSound(sfxNav); updateOverlaySelection(); } else if (action === 'UP') { currentOverlayIndex = nextOverlayIndex(currentOverlayIndex, -1); playSound(sfxNav); updateOverlaySelection(); }
    else if (action === 'BACK') {
      if (gameState === 'THEMES') openThemeCategoryMenu(); else if (gameState === 'THEME_CATS') openOverlay("MAIN_MENU"); else if (gameState === 'MUSIC_STYLE') openSoundOverlay(); else if (gameState === 'GAMEPAD_MENU' || gameState === 'WAKE_METHOD_MENU') openOverlay("MAIN_MENU"); else if (gameState === 'START_SCREEN_MENU') openOverlay("MAIN_MENU"); else if (gameState === 'LANGUAGE_MENU') openOverlay("MAIN_MENU"); else if (gameState === 'PLAYLIST_ASSIGN') openOverlay("GAME_MENU");
      else if (gameState === 'BROWSE_MODE_MENU') { document.getElementById('overlay-backdrop').classList.add('hidden'); openOverlay("MAIN_MENU"); }
      else if (gameState === 'GAMEPAGE_STYLE_MENU') { document.getElementById('overlay-backdrop').classList.add('hidden'); openOverlay("MAIN_MENU"); }
      else if (gameState === 'GAME_SCRAPE_MENU' || gameState === 'SCRAPE_RESULT') openOverlay("GAME_MENU");
      else if (gameState === 'CONFIRM_SCRAPE') openGameScrapeMenu();
      else if (['STEAM_MATCH_SELECTOR','STEAM_SEARCH_FAILED','IGDB_MATCH_SELECTOR','IGDB_SEARCH_FAILED'].includes(currentOverlayType)) { closeOverlay(); openGameScrapeMenu(); }
      else if (currentOverlayType === 'CONFIRM_QUIT' || currentOverlayType === 'ABOUT_CREMA') { openOverlay("MAIN_MENU"); }
      else if (currentOverlayType === 'HISTORY_MENU' || currentOverlayType === 'HISTORY_CLEARED') { openOverlay("MAIN_MENU"); }
      else closeOverlay();
    }
    else if (action === 'ACCEPT') {
      if (gameState === 'GAME_SCRAPE_MENU') executeGameScrapeAction();
      else if (gameState === 'CONFIRM_SCRAPE') executeConfirmScrapeAction();
      else if (gameState === 'SCRAPE_RESULT') openOverlay("GAME_MENU");
      else executeOverlayAction();
    }
  }
  else if (gameState === 'SGDB_GRID') {
    if (sgdbResults.length === 0 && action !== 'BACK') return;
    if (action === 'LEFT') { sgdbIndex = Math.max(0, sgdbIndex - 1); playSound(sfxNav); renderSgdbGrid(); } else if (action === 'RIGHT') { sgdbIndex = Math.min(sgdbResults.length - 1, sgdbIndex + 1); playSound(sfxNav); renderSgdbGrid(); } else if (action === 'UP') { sgdbIndex = Math.max(0, sgdbIndex - 4); playSound(sfxNav); renderSgdbGrid(); } else if (action === 'DOWN') { sgdbIndex = Math.min(sgdbResults.length - 1, sgdbIndex + 4); playSound(sfxNav); renderSgdbGrid(); }
    else if (action === 'BACK') { playSound(sfxBack); document.getElementById('sgdb-backdrop').classList.add('hidden'); openGameScrapeMenu(); }
    else if (action === 'ACCEPT') { playSound(sfxSelect); executeSgdbApply(); }
  }
  else if (gameState === 'SCREENSAVER_MENU') {
    if (action === 'DOWN') { currentOverlayIndex = (currentOverlayIndex + 1) % overlayItems.length; playSound(sfxNav); renderScreensaverMenu(); } else if (action === 'UP') { currentOverlayIndex = (currentOverlayIndex - 1 + overlayItems.length) % overlayItems.length; playSound(sfxNav); renderScreensaverMenu(); } else if (action === 'LEFT' || action === 'RIGHT') handleScreensaverMenuHorizontal(action); else if (action === 'BACK') { playSound(sfxBack); openOverlay("MAIN_MENU"); } else if (action === 'ACCEPT') executeScreensaverMenuAction();
  }
  else if (gameState === 'KEYBINDINGS') { if (action === 'BACK' || action === 'ACCEPT') closeKeybindingsOverlay(); }
  else if (gameState === 'SEARCH') {
    if (searchResults.length === 0 && action !== 'BACK') return;
    if (action === 'DOWN') { currentSearchIndex = (currentSearchIndex + 1) % searchResults.length; playSound(sfxNav); updateSearchSelection(); } else if (action === 'UP') { currentSearchIndex = (currentSearchIndex - 1 + searchResults.length) % searchResults.length; playSound(sfxNav); updateSearchSelection(); } else if (action === 'BACK') closeSearchOverlay(); else if (action === 'ACCEPT') executeSearchAction();
  }
  else if (gameState === 'SOUND') {
    if (action === 'DOWN') { currentOverlayIndex = (currentOverlayIndex + 1) % overlayItems.length; playSound(sfxNav); renderSoundMenu(); } else if (action === 'UP') { currentOverlayIndex = (currentOverlayIndex - 1 + overlayItems.length) % overlayItems.length; playSound(sfxNav); renderSoundMenu(); } else if (action === 'LEFT' || action === 'RIGHT') handleSoundHorizontal(action); else if (action === 'BACK') closeSoundOverlay(); else if (action === 'ACCEPT') executeSoundAction();
  }
}
function openOSK(mode, title, initialVal) {
  gameState = 'OSK'; playSound(sfxSelect); oskR = 0; oskC = 0; oskMode = mode;
  if (mode === 'SEARCH') searchQuery = initialVal || ""; else if (mode === 'GALLERY_SEARCH') galleryQuery = initialVal || ""; else tempOskString = initialVal || "";
  document.getElementById('osk-title').innerText = title; setBlur(true); document.getElementById('osk-backdrop').classList.remove('hidden'); renderOSK();
}
function closeOSK() { playSound(sfxBack); document.getElementById('osk-backdrop').classList.add('hidden'); gameState = 'MAIN'; setBlur(false); }
function renderOSK() {
  let targetStr = oskMode === 'SEARCH' ? searchQuery : oskMode === 'GALLERY_SEARCH' ? galleryQuery : tempOskString; document.getElementById('osk-query').innerText = targetStr + (targetStr.length < 50 ? "_" : "");
  const grid = document.getElementById('osk-grid'); grid.innerHTML = '';
  for(let r=0; r<OSK_ROWS; r++) {
    for(let c=0; c<OSK_COLS; c++) {
      const key = oskKeys[r][c]; const div = document.createElement('div'); div.innerText = key;
      div.style.padding = "15px 5px"; div.style.fontSize = "24px"; div.style.fontWeight = "bold"; div.style.borderRadius = "8px"; div.style.color = "var(--text_sec)"; div.style.backgroundColor = "var(--bg_panel)";
      if (r === oskR && c === oskC) { div.style.backgroundColor = "var(--accent)"; div.style.color = "var(--bg)"; div.style.transform = "scale(1.1)"; div.style.boxShadow = "0 0 15px var(--accent)"; }
      grid.appendChild(div);
    }
  }
}
function handleOSKInput(action) {
  if (action === 'UP') { oskR = (oskR - 1 + OSK_ROWS) % OSK_ROWS; playSound(sfxNav); renderOSK(); } else if (action === 'DOWN') { oskR = (oskR + 1) % OSK_ROWS; playSound(sfxNav); renderOSK(); } else if (action === 'LEFT') { oskC = (oskC - 1 + OSK_COLS) % OSK_COLS; playSound(sfxNav); renderOSK(); } else if (action === 'RIGHT') { oskC = (oskC + 1) % OSK_COLS; playSound(sfxNav); renderOSK(); }
  else if (action === 'BACK' || action === 'START') {
    if (oskMode === 'SEARCH') closeOSK();
    else if (oskMode === 'LAUNCH_CMD' || oskMode === 'RENAME_GAME') { playSound(sfxBack); document.getElementById('osk-backdrop').classList.add('hidden'); openOverlay('GAME_MENU'); }
    else if (oskMode === 'SGDB_API' || oskMode === 'REFINE_SEARCH') { playSound(sfxBack); document.getElementById('osk-backdrop').classList.add('hidden'); openGameScrapeMenu(); }
    else if (oskMode === 'NEW_PLAYLIST' || oskMode === 'NEW_PLAYLIST_ADD' || oskMode === 'JB_SEARCH' || oskMode === 'RENAME_PLAYLIST') { playSound(sfxBack); document.getElementById('osk-backdrop').classList.add('hidden'); gameState = 'JUKEBOX'; }
    else if (oskMode === 'NEW_GAME_PLAYLIST') { playSound(sfxBack); document.getElementById('osk-backdrop').classList.add('hidden'); renderPlaylistAssignMenu(); }
    else if (oskMode === 'GALLERY_SEARCH') { playSound(sfxBack); document.getElementById('osk-backdrop').classList.add('hidden'); setBlur(false); gameState = 'GALLERY'; }
    else if (oskMode === 'INSTALL_DIR') { playSound(sfxBack); document.getElementById('osk-backdrop').classList.add('hidden'); showGrinderConfirm(_grinderConfirmGame); }
  }
  else if (action === 'Y_BUTTON') {
    if (oskMode === 'SEARCH') { searchQuery = ""; applyLiveFilters(false); }
    else if (oskMode === 'JB_SEARCH') { jbSearchQuery = ""; renderJbList(); }
    else if (oskMode === 'GALLERY_SEARCH') { galleryQuery = ""; applyGalleryFilter(); renderGalleryGrid(); }
    else tempOskString = "";
    playSound(sfxBack); renderOSK();
  }
  else if (action === 'ACCEPT') {
    playSound(sfxSelect); const key = oskKeys[oskR][oskC]; let targetStr = oskMode === 'SEARCH' ? searchQuery : oskMode === 'JB_SEARCH' ? jbSearchQuery : oskMode === 'GALLERY_SEARCH' ? galleryQuery : tempOskString;
    if (key === 'SPACE') targetStr += " "; else if (key === 'BKSP') targetStr = targetStr.slice(0, -1); else if (key === 'CLEAR') targetStr = "";
    else if (key === 'DONE') {
      if (oskMode === 'GALLERY_SEARCH') { galleryQuery = targetStr; applyGalleryFilter(); renderGalleryGrid(); document.getElementById('osk-backdrop').classList.add('hidden'); setBlur(false); gameState = 'GALLERY'; return; }
      if (oskMode === 'SEARCH') { closeOSK(); return; }
      else if (oskMode === 'LAUNCH_CMD') {
        const g = filteredGames[currentGameIndex];
        g.LaunchCommand = targetStr;
        window.api.saveDbField({game: g.Game, field: 'LaunchCommand', value: targetStr});
        if (targetStr && isManualCategory(g)) { g.Installed = 1; window.api.saveDbField({game: g.Game, field: 'Installed', value: 1}); }
        document.getElementById('osk-backdrop').classList.add('hidden'); refreshDatabase(); openOverlay('GAME_MENU'); return;
      }
      else if (oskMode === 'RENAME_GAME') { const oldName = filteredGames[currentGameIndex].Game; filteredGames[currentGameIndex].Game = targetStr; window.api.saveDbField({game: oldName, field: 'Game', value: targetStr}); document.getElementById('osk-backdrop').classList.add('hidden'); refreshDatabase(); openOverlay('GAME_MENU'); return; }
      else if (oskMode === 'INSTALL_DIR') { _grinderInstallDir = targetStr || _grinderInstallDir; document.getElementById('osk-backdrop').classList.add('hidden'); document.getElementById('gc-dir').textContent = _grinderInstallDir; showGrinderConfirm(_grinderConfirmGame); return; }
      else if (oskMode === 'SGDB_API') { window.api.setSetting('steamgriddb_api', targetStr).then(() => { document.getElementById('osk-backdrop').classList.add('hidden'); openSgdbOverlay(targetStr, selectedResolvedName, selectedAppId); }); return; }
      else if (oskMode === 'REFINE_SEARCH') { document.getElementById('osk-backdrop').classList.add('hidden'); document.getElementById('overlay-backdrop').classList.remove('hidden'); triggerSteamSearch(targetStr); return; }
      else if (oskMode === 'NEW_GAME_PLAYLIST') {
        document.getElementById('osk-backdrop').classList.add('hidden');
        const nm = String(targetStr).trim();
        const gid = _plAssignGame ? _plAssignGame.id : null;
        if (nm) {
          window.api.addPlaylist(nm).then(newId => {
            const after = () => loadGamePlaylists().then(() => renderPlaylistAssignMenu());
            if (newId && gid != null) window.api.addGameToPlaylist(newId, gid).then(after);
            else after();
          });
        } else { renderPlaylistAssignMenu(); }
        return;
      }
      else if (oskMode === 'NEW_PLAYLIST') {
        if (targetStr && !jbPlaylists[targetStr]) {
          jbPlaylists[targetStr] = [];
          window.api.savePlaylists(jbPlaylists);
        }
        document.getElementById('osk-backdrop').classList.add('hidden');
        gameState = 'JUKEBOX';
        renderJbList();
        return;
      }
      else if (oskMode === 'NEW_PLAYLIST_ADD') {
        if(targetStr && !jbPlaylists[targetStr]) {
          jbPlaylists[targetStr] = [];
          if (currentOverlayType === 'JB_BATCH_ADD') {
            let tracksToAdd = [];
            if (jbActionTarget.type === 'ARTIST') {
              tracksToAdd = jbLibrary.filter(t => t.artist === jbActionTarget.name);
            } else if (jbActionTarget.type === 'ALBUM') {
              if (jbView === 'ARTIST_ALBUMS') {
                tracksToAdd = jbLibrary.filter(t => t.artist === jbActionTarget.artist && t.album === jbActionTarget.name);
              } else {
                tracksToAdd = jbLibrary.filter(t => t.album === jbActionTarget.name);
              }
            }
            tracksToAdd.forEach(t => { if (!jbPlaylists[targetStr].includes(t.path)) jbPlaylists[targetStr].push(t.path); });
          } else if (currentOverlayType === 'JB_SONG_OPTS') {
            jbPlaylists[targetStr].push(jbActionTarget.path);
          }
          window.api.savePlaylists(jbPlaylists);
        }
        document.getElementById('osk-backdrop').classList.add('hidden');
        gameState = 'JUKEBOX';
        renderJbList();
        return;
      }
      else if (oskMode === 'RENAME_PLAYLIST') { if(targetStr && targetStr !== jbActionTarget && !jbPlaylists[targetStr]) { jbPlaylists[targetStr] = [...jbPlaylists[jbActionTarget]]; delete jbPlaylists[jbActionTarget]; window.api.savePlaylists(jbPlaylists); } document.getElementById('osk-backdrop').classList.add('hidden'); gameState = 'JUKEBOX'; renderJbList(); return; }
      else if (oskMode === 'JB_SEARCH') { document.getElementById('osk-backdrop').classList.add('hidden'); gameState = 'JUKEBOX'; return; }
    }
    else if (key !== '' && key !== '-') targetStr += key;

    if (oskMode === 'SEARCH') { searchQuery = targetStr; applyLiveFilters(false); }
    else if (oskMode === 'JB_SEARCH') { jbSearchQuery = targetStr; renderJbList(); }
    else if (oskMode === 'GALLERY_SEARCH') { galleryQuery = targetStr; applyGalleryFilter(); renderGalleryGrid(); }
    else { tempOskString = targetStr; }
    renderOSK();
  }
}

function pico8HiddenFor(g, catName) {
  if (!_cremaHidePico8 || catName === 'PICO-8') return false;
  return (g.Store ? String(g.Store).toLowerCase() : '').includes('pico');
}

function applyLiveFilters(preserveIndex = false) {
  const savedGame = preserveIndex && filteredGames[currentGameIndex] ? filteredGames[currentGameIndex].Game : null;
  const catName = categories[currentCategoryIndex]; const q = searchQuery.toLowerCase();

  let baseFiltered = allGames.filter(g => {
    const store = g.Store ? String(g.Store).toLowerCase() : ""; const title = g.Game ? String(g.Game).toLowerCase() : ""; let matchCat = false;
    if (isPlaylistCat(catName)) matchCat = playlistCatMatch(g, catName); else if (catName === "ALL GAMES") matchCat = true; else if (catName === "INSTALLED") { const isManual = !g.GrinderGameId && (store.includes("others") || store.includes("emulation") || store.includes("physical") || store.includes("apps")); matchCat = isManual ? !!g.LaunchCommand : g.Installed == 1; } else if (catName === "STEAM") matchCat = store.includes("steam"); else if (catName === "GOG") matchCat = store.includes("gog"); else if (catName === "EPIC") matchCat = store.includes("epic"); else if (catName === "FLATPAK") matchCat = store.includes("flatpak"); else if (catName === "ITCH") matchCat = store.includes("itch"); else if (catName === "PICO-8") matchCat = store.includes("pico"); else if (catName === "OTHERS") matchCat = store.includes("others"); else if (catName === "PHYSICAL") matchCat = store.includes("physical"); else if (catName === "EMULATION") matchCat = store.includes("emulation"); else if (catName === "APPS") matchCat = store.includes("apps"); else if (catName === "FAVS") matchCat = g.FAV === 'YES'; else if (catName === "WANT TO PLAY") matchCat = g.WANT_TO_PLAY === 'YES'; else if (catName === "BACKLOG") matchCat = isBacklog(g); else if (catName === "PLAYED") matchCat = isPlayed(g);
    if (!matchCat) return false; if (pico8HiddenFor(g, catName)) return false; if (q !== "" && !title.includes(q)) return false; return true;
  });

    let recentGames = [];
    let regularGames = [...baseFiltered];

    if (recentGamesCount > 0) {
      let playedGames = baseFiltered.filter(g => g.LastPlayed && g.LastPlayed > 0).sort((a, b) => b.LastPlayed - a.LastPlayed);
      recentGames = playedGames.slice(0, recentGamesCount);

      const recentNames = new Set(recentGames.map(g => g.Game));
      regularGames = baseFiltered.filter(g => !recentNames.has(g.Game));

      numRecentInList = recentGames.length;
    } else {
      numRecentInList = 0;
    }

    filteredGames = [...recentGames, ...regularGames];

    if (preserveIndex && savedGame) {
      let newIdx = filteredGames.findIndex(g => g.Game === savedGame);
      currentGameIndex = newIdx !== -1 ? newIdx : 0;
    } else {
      currentGameIndex = 0;
    }

    renderGameList();
}

async function refreshDatabase() {
  const res = await window.api.getGames();
  allGames = res.games || [];
  await loadGamePlaylists();
  // Stay in sync if The Manager changed its theme while CREMA is open (no reflow when unchanged).
  if ((audioCfg.themeSource || 'MANAGER') === 'MANAGER') { try { const mapped = mapManagerThemeToCrema(await window.api.getSetting('cngm_theme')); if (mapped && mapped !== activeTheme) applyTheme(mapped); } catch (e) {} }

  availableScreenshots = [];
  for (let g of allGames) {
    if (g.Screenshot && String(g.Screenshot).trim() !== "") {
      let paths = String(g.Screenshot).split('|').filter(s => s.trim() !== "");
      paths.forEach(p => availableScreenshots.push({ path: p, game: g }));
    }
  }

  applyLiveFilters(true);
  const viewState = (gameState === 'GALLERY' || gameState === 'GALLERY_GAMEPAGE') ? gameState : previousGameState;
  if (viewState === 'GALLERY' || viewState === 'GALLERY_GAMEPAGE') {
    applyGalleryFilter();
    if (viewState === 'GALLERY') renderGalleryGrid();
    else if (galleryCurrentGame) {
      galleryCurrentGame = galleryGames.find(g => g.id === galleryCurrentGame.id) || galleryCurrentGame;
      updateGalleryGamepageContent(galleryCurrentGame);
    }
  }
  // `categories` is dynamic now (playlists / Recently Imported), so if a refresh
  // changed the set while we're on the start screen, rebuild it — otherwise the
  // carousel/list DOM desyncs from the category count.
  if (gameState === 'START') refreshStartScreen();
}
function refreshStartScreen() {
  if (currentCategoryIndex >= categories.length) currentCategoryIndex = 0;
  if (audioCfg.startScreenMode === 'GRID') renderGridMode();
  else renderCarouselMode();
}

let previousGameState = 'START'; let currentOverlayType = 'MAIN_MENU';

function isOverlaySection(item) { return typeof item === 'string' && item.startsWith('§'); }
function nextOverlayIndex(from, dir) {
  const N = overlayItems.length; let idx = (from + dir + N) % N; let guard = 0;
  while (isOverlaySection(overlayItems[idx]) && guard++ < N) idx = (idx + dir + N) % N;
  return idx;
}
function renderGenericOverlay(title, items, hintText = "") {
  playSound(sfxSelect); const bd = document.getElementById('overlay-backdrop'); const tit = document.getElementById('overlay-title'); const lst = document.getElementById('overlay-list');
  lst.innerHTML = ''; tit.innerText = title; overlayItems = items;
  currentOverlayIndex = items.findIndex(it => !isOverlaySection(it));
  if (currentOverlayIndex < 0) currentOverlayIndex = 0;
  overlayItems.forEach((item, i) => {
    const div = document.createElement('div');
    if (isOverlaySection(item)) { div.className = 'overlay-section'; div.innerText = item.slice(1); }
    else { div.className = 'overlay-item'; div.innerText = item; div.id = `overlay-${i}`; }
    lst.appendChild(div);
  });

  let hintEl = document.getElementById('overlay-hint');
  if (!hintEl) {
    hintEl = document.createElement('div');
    hintEl.id = 'overlay-hint';
    hintEl.style.cssText = "text-align: center; color: var(--text_dim); font-size: 14px; margin-top: 25px; opacity: 0.7; line-height: 1.5;";
    bd.querySelector('.overlay-modal').appendChild(hintEl);
  }
  if (hintText) { hintEl.innerHTML = hintText; hintEl.style.display = 'block'; } else { hintEl.style.display = 'none'; }

  bd.classList.remove('hidden'); updateOverlaySelection();
}

function openHistoryMenu() {
  gameState = 'OVERLAY';
  currentOverlayType = 'HISTORY_MENU';
  playSound(sfxSelect);

  const counts = [0, 5, 9, 18];
  const labels = counts.map(n => n === 0 ? 'OFF' : `${n} ${t('history.games')}`);
  const mapped = labels.map((label, i) => counts[i] === recentGamesCount ? '★ ' + label : label);

  mapped.push(t('history.clear'), t('common.back_to_menu'));
  renderGenericOverlay(t('history.title'), mapped);
}

function openPico8Menu() {
  gameState = 'OVERLAY';
  currentOverlayType = 'PICO8_MENU';
  playSound(sfxSelect);
  const mapped = ['SHOWN', 'HIDDEN'].map(o => ((o === 'HIDDEN') === _cremaHidePico8) ? '★ ' + o : o);
  mapped.push(t('common.back_to_menu'));
  renderGenericOverlay('PICO-8 GAMES', mapped);
}

async function openOverlay(type) {
  if (gameState === 'START' || gameState === 'HOME' || gameState === 'MAIN' || gameState === 'GALLERY' || gameState === 'GALLERY_GAMEPAGE') { previousGameState = gameState; }
  gameState = 'OVERLAY'; currentOverlayType = type; setBlur(true);

  if (type === "MAIN_MENU") { renderGenericOverlay(t('menu.system'), [`§${t('section.audio')}`, t('menu.jukebox_mode'), t('menu.sound_settings'), `§${t('section.appearance')}`, t('menu.color_scheme'), t('menu.start_screen'), t('browse.mode'), 'GAMEPAGE STYLE', 'HOME SCREEN', t('menu.screensaver'), `§${t('section.controls')}`, t('menu.keybindings'), t('menu.gamepad_icons'), t('menu.wake_method'), `§${t('section.library')}`, t('menu.history'), 'PICO-8 GAMES', `§${t('section.system')}`, t('menu.about'), t('menu.language'), t('menu.quit'), t('common.close_menu')]); }
  else if (type === "GAME_MENU") {
    const game = filteredGames[currentGameIndex]; const localUrl = await window.api.checkLocalTrailer(game.Game);
    const favStr = game.FAV === "YES" ? t('game_menu.remove_fav') : t('game_menu.add_fav'); const wantStr = game.WANT_TO_PLAY === "YES" ? t('game_menu.remove_want') : t('game_menu.add_want'); const playedStr = game.kb_played == 1 ? 'UNMARK PLAYED' : 'MARK AS PLAYED'; const cmdStr = (game.LaunchCommand && game.LaunchCommand.trim() !== "") ? t('game_menu.edit_launch') : t('game_menu.add_launch'); const trStr = localUrl ? t('game_menu.delete_trailer') : t('game_menu.download_trailer');
    const storeL = (game.Store || '').toLowerCase();
    const isGrinderStore = ((storeL.includes('gog') || storeL.includes('epic')) && game.app_id) || !!game.GrinderGameId;
    const isInstalled = game.Installed == null || game.Installed == 1;
    const grinderItems = isGrinderStore ? (isInstalled ? ['§GRINDER', 'UNINSTALL VIA GRINDER'] : ['§GRINDER', 'INSTALL VIA GRINDER']) : [];
    const gogId = _cGogAppId(game); const steamRaw = game.SteamAppID ? String(game.SteamAppID).replace(/\.0+$/, '') : null;
    let hasAchievements = false;
    if (gogId) { const r = await window.api.getGameAchievements(gogId); if (r.ok && r.achievements.length) hasAchievements = true; }
    if (!hasAchievements && steamRaw) { const r = await window.api.getGameAchievements(`steam_${steamRaw}`); if (r.ok && r.achievements.length) hasAchievements = true; }
    const achItems = hasAchievements ? ['§ACHIEVEMENTS', 'VIEW ACHIEVEMENTS'] : [];
    renderGenericOverlay(t('menu.game_options'), [trStr, favStr, wantStr, playedStr, 'ADD TO PLAYLIST', cmdStr, t('game_menu.rename'), t('game_menu.scraping'), ...achItems, ...grinderItems, t('common.close_menu')]);
  }
}

function updateOverlaySelection() {
  document.querySelectorAll('#overlay-backdrop .overlay-item').forEach(el => el.classList.remove('selected'));
  const el = document.getElementById(`overlay-${currentOverlayIndex}`);
  if (el) { el.classList.add('selected'); el.scrollIntoView({ behavior: "smooth", block: "center" }); }
}
function closeOverlay() { playSound(sfxBack); document.getElementById('overlay-backdrop').classList.add('hidden'); gameState = previousGameState; if (gameState === 'START' || gameState === 'HOME' || gameState === 'MAIN' || gameState === 'GALLERY' || gameState === 'GALLERY_GAMEPAGE') setBlur(false); }

function executeOverlayAction() {
  playSound(sfxSelect); const action = overlayItems[currentOverlayIndex];

  if (gameState === 'LANGUAGE_MENU') {
    const langMap = { [t('language.en')]: 'en', [t('language.pt_BR')]: 'pt_BR' };
    if (action === t('common.back_to_menu')) { openOverlay("MAIN_MENU"); return; }
    const lang = langMap[action];
    if (lang) {
      window.api.setSetting('language', lang).then(() => window.location.reload());
    }
    return;
  }

  if (gameState === 'START_SCREEN_MENU') {
    const modeMap = { [t('start_screen.carousel')]: 'CAROUSEL', [t('start_screen.grid')]: 'GRID' };
    const raw = String(action).replace('★ ', '');
    if (raw === t('common.back_to_menu')) { openOverlay("MAIN_MENU"); return; }
    if (modeMap[raw]) {
      audioCfg.startScreenMode = modeMap[raw];
      window.api.saveAudioConfig(audioCfg);
      const m = modeMap[raw];
      document.getElementById('start-carousel').style.display = m === 'CAROUSEL' ? 'flex' : 'none';
      document.getElementById('start-grid').style.display = m === 'GRID' ? 'flex' : 'none';
      if (m === 'GRID') renderGridMode();
      else renderCarouselMode();
      openStartScreenMenu();
    }
    return;
  }

  if (currentOverlayType === 'CONFIRM_QUIT') {
    if (action === t('confirm.yes_quit')) { window.api.quitApp(); }
    else { openOverlay("MAIN_MENU"); }
    return;
  }

  if (currentOverlayType === 'ABOUT_CREMA') {
    openOverlay("MAIN_MENU");
    return;
  }

  if (currentOverlayType === 'STEAM_MATCH_SELECTOR') {
    if (action === t('common.cancel_search')) { openGameScrapeMenu(); }
    else { const match = steamSearchResults[currentOverlayIndex]; proceedWithScrape(match.id, match.name); }
    return;
  }

  if (currentOverlayType === 'STEAM_SEARCH_FAILED') {
    if (action === t('dialog.refine_search')) { document.getElementById('overlay-backdrop').classList.add('hidden'); openOSK('REFINE_SEARCH', t('osk.refine_search'), filteredGames[currentGameIndex].Game); }
    else if (action === t('dialog.search_igdb')) { triggerIgdbSearch(filteredGames[currentGameIndex].Game); }
    else { openGameScrapeMenu(); }
    return;
  }

  if (currentOverlayType === 'IGDB_MATCH_SELECTOR') {
    if (action === t('common.cancel_search')) { openGameScrapeMenu(); }
    else { const match = igdbSearchResults[currentOverlayIndex]; scrapeSource = 'IGDB'; proceedWithIgdbScrape(match.id, match.name); }
    return;
  }

  if (currentOverlayType === 'IGDB_SEARCH_FAILED') { openGameScrapeMenu(); return; }

  if (currentOverlayType === 'HISTORY_MENU') {
    if (action === t('common.back_to_menu')) {
      openOverlay("MAIN_MENU");
    } else if (action === t('history.clear')) {
      window.api.clearHistory().then(() => {
        refreshDatabase().then(() => {
          renderGenericOverlay(t('dialog.action_completed'), [t('status.history_cleared'), t('common.back_to_menu')]);
          currentOverlayType = 'HISTORY_CLEARED';
        });
      });
    } else {
      let raw = action.replace('★ ', '');
      let val = isNaN(parseInt(raw.split(' ')[0], 10)) ? 0 : parseInt(raw.split(' ')[0], 10);
      recentGamesCount = val;
      window.api.setSetting('crema_recent_count', val);
      applyLiveFilters();
      openHistoryMenu();
    }
    return;
  }

  if (currentOverlayType === 'HISTORY_CLEARED') {
    openHistoryMenu();
    return;
  }

  if (currentOverlayType === 'PICO8_MENU') {
    if (action === t('common.back_to_menu')) { openOverlay("MAIN_MENU"); return; }
    _cremaHidePico8 = (String(action).replace('★ ', '') === 'HIDDEN');
    window.api.setSetting('crema_hide_pico8', _cremaHidePico8 ? '1' : '');
    applyLiveFilters();
    openPico8Menu();
    return;
  }

  if (currentOverlayType === 'HOME_MENU') {
    if (action === t('common.back_to_menu')) { openOverlay("MAIN_MENU"); return; }
    const label = String(action).replace('★ ', '');
    if (label === 'SHOW HOME ON STARTUP') { audioCfg.homeEnabled = !audioCfg.homeEnabled; }
    else {
      const map = { 'RECENTLY IMPORTED': 'recent', 'HIDDEN GEMS': 'gems', 'RECENTLY PLAYED': 'played', 'MOST PLAYED': 'mostplayed', 'COUCH NIGHT': 'couchnight', 'WISHLIST': 'wishlist', 'FREE THIS WEEK': 'freebies', 'GAMING NEWS': 'news', 'YOUR GAMES NEWS': 'gamenews', 'PROTON WATCH': 'protonwatch' };
      const k = map[label];
      if (k) { if (audioCfg.homeRows.includes(k)) audioCfg.homeRows = audioCfg.homeRows.filter(x => x !== k); else audioCfg.homeRows.push(k); }
    }
    window.api.saveAudioConfig(audioCfg);
    openHomeMenu();
    return;
  }

  if (gameState === 'OVERLAY') {
    if (action === t('menu.jukebox_mode')) { document.getElementById('overlay-backdrop').classList.add('hidden'); openJukebox(); }
    else if (action === t('menu.quit')) { currentOverlayType = 'CONFIRM_QUIT'; renderGenericOverlay(t('confirm.quit_title'), [t('confirm.yes_quit'), t('common.cancel')]); }
    else if (action === t('game_menu.add_fav') || action === t('game_menu.remove_fav')) { const val = action === t('game_menu.add_fav') ? "YES" : "NO"; filteredGames[currentGameIndex].FAV = val; window.api.saveDbField({game: filteredGames[currentGameIndex].Game, field: 'FAV', value: val}); refreshDatabase(); closeOverlay(); }
    else if (action === t('game_menu.add_want') || action === t('game_menu.remove_want')) { const val = action === t('game_menu.add_want') ? "YES" : "NO"; filteredGames[currentGameIndex].WANT_TO_PLAY = val; window.api.saveDbField({game: filteredGames[currentGameIndex].Game, field: 'WANT_TO_PLAY', value: val}); refreshDatabase(); closeOverlay(); }
    else if (action === 'MARK AS PLAYED' || action === 'UNMARK PLAYED') { const val = action === 'MARK AS PLAYED' ? 1 : 0; filteredGames[currentGameIndex].kb_played = val; window.api.saveDbField({game: filteredGames[currentGameIndex].Game, field: 'kb_played', value: val}); refreshDatabase(); closeOverlay(); }
    else if (action === 'ADD TO PLAYLIST') { openPlaylistAssignMenu(); }
    else if (action === t('game_menu.add_launch') || action === t('game_menu.edit_launch')) { document.getElementById('overlay-backdrop').classList.add('hidden'); openOSK('LAUNCH_CMD', t('osk.launch_command'), filteredGames[currentGameIndex].LaunchCommand || ""); }
    else if (action === t('game_menu.rename')) { document.getElementById('overlay-backdrop').classList.add('hidden'); openOSK('RENAME_GAME', t('osk.rename_game'), filteredGames[currentGameIndex].Game); }
    else if (action === t('game_menu.scraping')) { document.getElementById('overlay-backdrop').classList.add('hidden'); openGameScrapeMenu(); }
    else if (action === t('game_menu.download_trailer')) openSearchOverlay();
    else if (action === t('game_menu.delete_trailer')) { clearMediaLoaders(); window.api.deleteTrailer(filteredGames[currentGameIndex].Game).then(() => { setDebug("🗑️ Trailer Deleted", true); refreshDatabase(); closeOverlay(); }); }
    else if (action === 'INSTALL VIA GRINDER') { closeOverlay(); const _ig = filteredGames[currentGameIndex]; const _stL = (_ig.Store || '').toLowerCase(); if (_ig.GrinderGameId && !_stL.includes('gog') && !_stL.includes('epic')) { window.api.openGrinderGui(_ig.Game); } else { showGrinderConfirm(_ig); } }
    else if (action === 'UNINSTALL VIA GRINDER') { closeOverlay(); triggerGrinderUninstall(filteredGames[currentGameIndex]); }
    else if (action === 'VIEW ACHIEVEMENTS') {
      const game = filteredGames[currentGameIndex];
      document.getElementById('overlay-backdrop').classList.add('hidden');
      gameState = previousGameState;
      setBlur(false);
      galleryCurrentGame = game;
      loadCremaAchievements(game).then(() => {
        if (_cAchAll.length) openCremaAchievementsOverlay();
      });
    }
    else if (action === t('menu.sound_settings')) { document.getElementById('overlay-backdrop').classList.add('hidden'); openSoundOverlay(); }
    else if (action === t('menu.keybindings')) { document.getElementById('overlay-backdrop').classList.add('hidden'); openKeybindingsOverlay(); }
    else if (action === t('menu.gamepad_icons')) { document.getElementById('overlay-backdrop').classList.add('hidden'); openGamepadMenu(); }
    else if (action === t('menu.wake_method')) { document.getElementById('overlay-backdrop').classList.add('hidden'); openWakeMethodMenu(); }
    else if (action === t('menu.color_scheme')) { document.getElementById('overlay-backdrop').classList.add('hidden'); openThemeCategoryMenu(); }
    else if (action === t('menu.screensaver')) { document.getElementById('overlay-backdrop').classList.add('hidden'); openScreensaverMenu(); }
else if (action === t('menu.history')) { document.getElementById('overlay-backdrop').classList.add('hidden'); openHistoryMenu(); }
    else if (action === 'PICO-8 GAMES') { document.getElementById('overlay-backdrop').classList.add('hidden'); openPico8Menu(); }
    else if (action === t('menu.start_screen')) { document.getElementById('overlay-backdrop').classList.add('hidden'); openStartScreenMenu(); }
    else if (action === t('browse.mode')) { document.getElementById('overlay-backdrop').classList.add('hidden'); openBrowseModeMenu(); }
    else if (action === 'GAMEPAGE STYLE') { document.getElementById('overlay-backdrop').classList.add('hidden'); openGamepageStyleMenu(); }
    else if (action === 'HOME SCREEN') { document.getElementById('overlay-backdrop').classList.add('hidden'); openHomeMenu(); }
    else if (action === t('menu.language')) { document.getElementById('overlay-backdrop').classList.add('hidden'); openLanguageMenu(); }
    else if (action === t('menu.about')) {
      currentOverlayType = 'ABOUT_CREMA';
      renderGenericOverlay(t('about.title'), [t('common.back_to_menu')], t('about.content'));
    }
    else if (action === t('common.close_menu')) closeOverlay();
    else closeOverlay();
  }
  else if (gameState === 'THEME_CATS') { if (action === t('common.back_to_menu')) { openOverlay("MAIN_MENU"); } else if (String(action).replace("★ ", "") === FOLLOW_MANAGER_LABEL) { audioCfg.themeSource = 'MANAGER'; window.api.saveAudioConfig(audioCfg); resolveAndApplyTheme().then(openThemeCategoryMenu); } else { openThemeMenu(action); } }
  else if (gameState === 'THEMES') { if (action === t('common.back')) { openThemeCategoryMenu(); } else if (action) { let raw = String(action).replace("★ ", ""); audioCfg.theme = raw; audioCfg.themeSource = 'CUSTOM'; window.api.saveAudioConfig(audioCfg); applyTheme(raw); openThemeCategoryMenu(); } }
  else if (gameState === 'MUSIC_STYLE') { if (action === t('common.back')) { openSoundOverlay(); } else if (action) { let raw = String(action).replace("★ ", ""); audioCfg.bgm_mode = raw; window.api.saveAudioConfig(audioCfg); applyBgmMode(); openSoundOverlay(); } }
  else if (gameState === 'GAMEPAD_MENU') {
    if (action === t('common.back_to_menu')) { openOverlay("MAIN_MENU"); }
    else if (action) {
      let raw = String(action).replace("★ ", "");
      if (raw.startsWith("XBOX")) audioCfg.gamepadLayout = "XBOX";
      else if (raw.startsWith("PS")) audioCfg.gamepadLayout = "PS";
      else if (raw.startsWith("N ")) audioCfg.gamepadLayout = "N";
      window.api.saveAudioConfig(audioCfg);
      renderHardwareIcons();
      openGamepadMenu();
    }
  }
  else if (gameState === 'WAKE_METHOD_MENU') {
    if (action === t('common.back_to_menu')) { openOverlay("MAIN_MENU"); }
    else if (action) {
      let raw = String(action).replace("★ ", "");
      audioCfg.wakeMethod = raw;
      window.api.saveAudioConfig(audioCfg);
      openWakeMethodMenu();
    }
  }
  else if (gameState === 'BROWSE_MODE_MENU') {
    if (action === t('common.back_to_menu')) { openOverlay("MAIN_MENU"); }
    else if (action) {
      const raw = String(action).replace("★ ", "");
      if (raw === t('browse.list')) audioCfg.browseMode = 'LIST';
      else if (raw === t('browse.gallery')) audioCfg.browseMode = 'GALLERY';
      window.api.saveAudioConfig(audioCfg);
      document.getElementById('overlay-backdrop').classList.add('hidden');
      setBlur(false);
      if (audioCfg.browseMode === 'GALLERY') transitionToGallery();
      else transitionToMain();
    }
  }
  else if (gameState === 'GAMEPAGE_STYLE_MENU') {
    if (action === t('common.back_to_menu')) { openOverlay("MAIN_MENU"); }
    else if (action) {
      const raw = String(action).replace("★ ", "");
      if (raw === 'Classic')   audioCfg.gamepageStyle = 'CLASSIC';
      else if (raw === 'Immersive') audioCfg.gamepageStyle = 'IMMERSIVE';
      window.api.saveAudioConfig(audioCfg);
      document.getElementById('overlay-backdrop').classList.add('hidden');
      setBlur(false);
      gameState = previousGameState;
    }
  }
  else if (gameState === 'PLAYLIST_ASSIGN') {
    if (action === t('common.back_to_game_options')) { openOverlay("GAME_MENU"); return; }
    if (action === '+ NEW PLAYLIST') { document.getElementById('overlay-backdrop').classList.add('hidden'); openOSK('NEW_GAME_PLAYLIST', 'NEW PLAYLIST NAME', ''); return; }
    // The first gamePlaylists.length items map 1:1 to gamePlaylists — toggle by index
    // rather than parsing the (★-prefixed) label.
    if (currentOverlayIndex < gamePlaylists.length && _plAssignGame) {
      const pl = gamePlaylists[currentOverlayIndex];
      const gid = _plAssignGame.id;
      const set = playlistMembers[pl.id] || (playlistMembers[pl.id] = new Set());
      if (set.has(gid)) { set.delete(gid); window.api.removeGameFromPlaylist(pl.id, gid); }
      else { set.add(gid); window.api.addGameToPlaylist(pl.id, gid); }
      rebuildCategories();
      renderPlaylistAssignMenu();
    }
  }
}

// Per-game "add to playlist" menu: lists every playlist with a ★ when the current
// game is a member; selecting one toggles membership. _plAssignGame is the game
// the GAME_MENU was opened for (always filteredGames[currentGameIndex]).
let _plAssignGame = null;
async function openPlaylistAssignMenu() {
  _plAssignGame = filteredGames[currentGameIndex];
  await loadGamePlaylists();
  renderPlaylistAssignMenu();
}
function renderPlaylistAssignMenu() {
  gameState = 'PLAYLIST_ASSIGN';
  document.getElementById('overlay-backdrop').classList.remove('hidden');
  const gid = _plAssignGame ? _plAssignGame.id : null;
  const items = gamePlaylists.map(pl => (playlistMembers[pl.id] && playlistMembers[pl.id].has(gid) ? '★ ' : '   ') + pl.name);
  if (gamePlaylists.length) items.push('§MANAGE');
  items.push('+ NEW PLAYLIST', t('common.back_to_game_options'));
  const title = _plAssignGame ? _plAssignGame.Game : 'PLAYLISTS';
  renderGenericOverlay(title, items, '★ = in playlist · ACCEPT toggles');
}

function openKeybindingsOverlay() {
  gameState = 'KEYBINDINGS'; playSound(sfxSelect); setBlur(true);
  const bd = document.getElementById('keybindings-backdrop');
  const gp = document.getElementById('gb-gamepad');
  if (gp) {
    gp.innerHTML = `${getMappedBtn('SOUTH')} - ${t('keybindings.gp_select')}<br>${getMappedBtn('EAST')} - ${t('keybindings.gp_back')}<br>${getBtn('dpad_up')}${getBtn('dpad_down')}${getBtn('L1')}${getBtn('R1')} - ${t('keybindings.gp_navigate')}<br>${getBtn('dpad_left')}${getBtn('dpad_right')} - ${t('keybindings.gp_category')}<br>${getMappedBtn('SELECT')} - ${t('keybindings.gp_options')}<br>${getMappedBtn('START')} - ${t('keybindings.gp_menu')}<br>${getMappedBtn('WEST')} - ${t('keybindings.gp_media')}<br>${getMappedBtn('NORTH')} - ${t('keybindings.gp_search')}<br>${getBtn('L3')} - ${t('keybindings.gp_prev')}<br>${getBtn('R3')} - ${t('keybindings.gp_next')}`;
  }
  const kb = document.getElementById('gb-keyboard');
  if (kb) {
    kb.innerHTML = `<strong>[ENTER] / [SPACE]</strong> - ${t('keybindings.kb_select')}<br><strong>[ESC] / [BKSP]</strong> - ${t('keybindings.kb_back')}<br><strong>[ARROWS]</strong> - ${t('keybindings.kb_navigate')}<br><strong>[PG UP] / [PG DN]</strong> - ${t('keybindings.kb_page')}<br><strong>[ , ] / [ . ]</strong> - ${t('keybindings.kb_prev_next')}<br><strong>[TAB]</strong> - ${t('keybindings.kb_options')}<br><strong>[M]</strong> - ${t('keybindings.kb_menu')}<br><strong>[X]</strong> - ${t('keybindings.kb_media')}<br><strong>[Y]</strong> - ${t('keybindings.kb_search')}`;
  }
  bd.classList.remove('hidden');
}

function closeKeybindingsOverlay() {
  playSound(sfxBack);
  document.getElementById('keybindings-backdrop').classList.add('hidden');
  openOverlay("MAIN_MENU");
}

function openGameScrapeMenu() {
  gameState = 'GAME_SCRAPE_MENU'; playSound(sfxSelect); currentOverlayIndex = 0; scrapeSource = 'STEAM';
  document.getElementById('overlay-backdrop').classList.remove('hidden');
  renderGenericOverlay(t('scraping.title'), [t('scraping.all'), t('scraping.clear_all'), t('scraping.custom_cover'), t('scraping.cover'), t('scraping.remove_cover'), t('scraping.screenshots'), t('scraping.remove_screenshots'), t('scraping.metadata'), t('scraping.remove_metadata'), t('common.back_to_game_options')]);
}

async function executeGameScrapeAction() {
  playSound(sfxSelect); const action = overlayItems[currentOverlayIndex]; const game = filteredGames[currentGameIndex];
  if (action === t('common.back_to_game_options')) { document.getElementById('overlay-backdrop').classList.add('hidden'); openOverlay("GAME_MENU"); }
  else if (action === t('scraping.clear_all')) {
    const fields = ['CoverArt', 'Screenshot', 'DEV', 'PUB', 'RELEASED', 'GENRE', 'METACRITIC', 'Description', 'ProtonTier', 'SteamAppID'];
    fields.forEach(f => { game[f] = ""; window.api.saveDbField({game: game.Game, field: f, value: ""}); });
    await refreshDatabase(); gameState = 'SCRAPE_RESULT'; renderGenericOverlay(t('dialog.action_completed'), [t('status.all_cleared'), t('common.back_to_game_options')]);
  }
  else if (action === t('scraping.remove_cover')) { game.CoverArt = ""; window.api.saveDbField({game: game.Game, field: 'CoverArt', value: ""}); await refreshDatabase(); gameState = 'SCRAPE_RESULT'; renderGenericOverlay(t('dialog.action_completed'), [t('status.cover_removed'), t('common.back_to_game_options')]); }
  else if (action === t('scraping.remove_screenshots')) { game.Screenshot = ""; window.api.saveDbField({game: game.Game, field: 'Screenshot', value: ""}); await refreshDatabase(); gameState = 'SCRAPE_RESULT'; renderGenericOverlay(t('dialog.action_completed'), [t('status.screenshots_removed'), t('common.back_to_game_options')]); }
  else if (action === t('scraping.remove_metadata')) { const fields = ['DEV', 'PUB', 'RELEASED', 'GENRE', 'METACRITIC', 'Description', 'ProtonTier', 'SteamAppID']; fields.forEach(f => { game[f] = ""; window.api.saveDbField({game: game.Game, field: f, value: ""}); }); await refreshDatabase(); gameState = 'SCRAPE_RESULT'; renderGenericOverlay(t('dialog.action_completed'), [t('status.metadata_removed'), t('common.back_to_game_options')]); }
  else {
    if (action === t('scraping.all')) activeScrapeMode = 'ALL';
    else if (action === t('scraping.custom_cover')) activeScrapeMode = 'SGDB';
    else if (action === t('scraping.cover')) activeScrapeMode = 'COVER';
    else if (action === t('scraping.screenshots')) activeScrapeMode = 'SCREENSHOTS';
    else if (action === t('scraping.metadata')) activeScrapeMode = 'METADATA';
    document.getElementById('overlay-backdrop').classList.remove('hidden');
    triggerSteamSearch(game.Game);
  }
}

async function triggerSteamSearch(searchTerm) {
  document.getElementById('overlay-title').innerText = t('status.searching');
  document.getElementById('overlay-list').innerHTML = `<div class='overlay-item selected' style='color: var(--accent);'>${t('status.querying_steam')}</div>`;

  steamSearchResults = await window.api.searchSteam(searchTerm);
  if (steamSearchResults.length === 0) {
    currentOverlayType = 'STEAM_SEARCH_FAILED'; gameState = 'OVERLAY';
    renderGenericOverlay(t('dialog.no_matches'), [t('dialog.refine_search'), t('dialog.search_igdb'), t('common.back_to_scraping')]);
    return;
  }

  currentOverlayType = 'STEAM_MATCH_SELECTOR'; gameState = 'OVERLAY';
  let items = steamSearchResults.map(r => `${r.name} (${r.id})`); items.push(t('common.cancel_search'));
  renderGenericOverlay(t('dialog.select_match'), items);
}

function proceedWithScrape(appId, resolvedName) {
  selectedAppId = appId; selectedResolvedName = resolvedName; gameState = 'CONFIRM_SCRAPE';
  let modeText = activeScrapeMode === 'ALL' ? 'ALL DATA' : activeScrapeMode;
  renderGenericOverlay(t('confirm.confirm_action'), [t('confirm.proceed_scrape', {mode: modeText}), t('common.cancel')]);
}

async function triggerIgdbSearch(searchTerm) {
  document.getElementById('overlay-title').innerText = t('status.searching');
  document.getElementById('overlay-list').innerHTML = `<div class='overlay-item selected' style='color: var(--accent);'>${t('status.contacting_api')}</div>`;
  igdbSearchResults = await window.api.searchIgdb(searchTerm);
  if (igdbSearchResults.length === 0) {
    currentOverlayType = 'IGDB_SEARCH_FAILED'; gameState = 'OVERLAY';
    renderGenericOverlay(t('dialog.no_matches'), [t('common.back_to_scraping')]);
    return;
  }
  currentOverlayType = 'IGDB_MATCH_SELECTOR'; gameState = 'OVERLAY';
  const items = igdbSearchResults.map(r => r.year ? `${r.name} (${r.year})` : r.name);
  items.push(t('common.cancel_search'));
  renderGenericOverlay(t('dialog.select_match'), items);
}

function proceedWithIgdbScrape(igdbId, resolvedName) {
  selectedIgdbId = igdbId; selectedResolvedName = resolvedName; gameState = 'CONFIRM_SCRAPE';
  let modeText = activeScrapeMode === 'ALL' ? 'ALL DATA' : activeScrapeMode;
  renderGenericOverlay(t('confirm.confirm_action'), [t('confirm.proceed_scrape', {mode: modeText}), t('common.cancel')]);
}

async function executeConfirmScrapeAction() {
  playSound(sfxSelect); const action = overlayItems[currentOverlayIndex];
  if (action === t('common.cancel')) { openGameScrapeMenu(); }
  else {
    const game = filteredGames[currentGameIndex];
    if (activeScrapeMode === 'SGDB') {
      document.getElementById('overlay-backdrop').classList.add('hidden');
      const key = await window.api.getSetting('steamgriddb_api');
      if (!key) { openOSK('SGDB_API', t('osk.sgdb_api_key'), ''); } else { openSgdbOverlay(key, selectedResolvedName, selectedAppId); }
    } else {
      document.getElementById('overlay-title').innerText = t('status.searching');
      document.getElementById('overlay-list').innerHTML = `<div class='overlay-item selected' style='color: var(--accent);'>${t('status.contacting_api')}</div>`;
      let modeText = activeScrapeMode === 'ALL' ? 'ALL DATA' : activeScrapeMode;
      let success = false;
      try {
        if (scrapeSource === 'IGDB') {
          success = await window.api.scrapeIgdbData(game.Game, activeScrapeMode, selectedIgdbId);
        } else {
          success = await window.api.scrapeSteamData(game.Game, activeScrapeMode, selectedAppId);
        }
      } catch (err) { console.error('[scrape] failed:', err); }
      // Refresh separately so a DB/view-refresh error can't strand the 'contacting api'
      // message on screen — the result overlay below must always replace it.
      try { await refreshDatabase(); } catch (err) { console.error('[scrape] refresh failed:', err); }
      gameState = 'SCRAPE_RESULT';
      renderGenericOverlay(t('dialog.scraping_status'), [success ? t('status.scraped_ok', {mode: modeText}) : t('status.no_data'), t('common.back_to_game_options')]);
    }
  }
}

async function openSgdbOverlay(apiKey, resolvedName, appId) {
  gameState = 'SGDB_GRID'; sgdbIndex = 0; sgdbResults = [];
  const bd = document.getElementById('sgdb-backdrop'); const stat = document.getElementById('sgdb-status'); const grid = document.getElementById('sgdb-grid');
  grid.innerHTML = ''; stat.innerText = t('status.connecting_sgdb'); bd.classList.remove('hidden');
  let searchName = resolvedName || selectedResolvedName || filteredGames[currentGameIndex].Game;
  let sAppId = appId || selectedAppId;
  sgdbResults = await window.api.sgdbSearch(searchName, apiKey, sAppId);
  if (sgdbResults.length === 0) { stat.innerText = t('status.no_covers'); setTimeout(() => { bd.classList.add('hidden'); gameState = 'SCRAPE_RESULT'; document.getElementById('overlay-backdrop').classList.remove('hidden'); renderGenericOverlay(t('dialog.search_failed'), [t('status.no_custom_covers'), t('common.back_to_game_options')]); }, 2000); return; }
  stat.innerText = t('sgdb.select_cover'); renderSgdbGrid();
}

function renderSgdbGrid() {
  const grid = document.getElementById('sgdb-grid'); grid.innerHTML = '';
  sgdbResults.forEach((res, i) => {
    const div = document.createElement('div');
    div.style.border = (i === sgdbIndex) ? "4px solid var(--accent)" : "4px solid transparent";
    div.style.borderRadius = "8px"; div.style.overflow = "hidden"; div.style.transition = "transform 0.2s";
    div.style.transform = (i === sgdbIndex) ? "scale(1.05)" : "scale(1)";
    const img = document.createElement('img'); img.src = res.thumb; img.style.width = "100%"; img.style.display = "block";
    div.appendChild(img); grid.appendChild(div);
    if (i === sgdbIndex) div.scrollIntoView({ behavior: "smooth", block: "center" });
  });
}

async function executeSgdbApply() {
  const bd = document.getElementById('sgdb-backdrop'); const stat = document.getElementById('sgdb-status'); stat.innerText = t('sgdb.downloading_cover');
  const success = await window.api.sgdbApply(filteredGames[currentGameIndex].Game, sgdbResults[sgdbIndex].url);
  bd.classList.add('hidden'); await refreshDatabase(); gameState = 'SCRAPE_RESULT'; document.getElementById('overlay-backdrop').classList.remove('hidden');
  renderGenericOverlay(t('dialog.scraping_status'), [success ? t('status.cover_applied') : t('status.download_failed'), t('common.back_to_game_options')]);
}

function openScreensaverMenu() { gameState = 'SCREENSAVER_MENU'; playSound(sfxSelect); currentOverlayIndex = 0; document.getElementById('overlay-backdrop').classList.remove('hidden'); renderScreensaverMenu(); }
function renderScreensaverMenu() { const bd = document.getElementById('overlay-backdrop'); const tit = document.getElementById('overlay-title'); const lst = document.getElementById('overlay-list'); lst.innerHTML = ''; tit.innerText = t('screensaver.title'); overlayItems = [`${t('screensaver.mode_prefix')}: ${audioCfg.screensaver}`, t('screensaver.delay', {n: audioCfg.screensaverDelay}), t('screensaver.view_now'), t('common.back_to_menu')]; overlayItems.forEach((item, i) => { const div = document.createElement('div'); div.className = 'overlay-item'; div.innerText = item; div.id = `ssm-${i}`; lst.appendChild(div); }); document.querySelectorAll('#overlay-backdrop .overlay-item').forEach(el => el.classList.remove('selected')); const el = document.getElementById(`ssm-${currentOverlayIndex}`); if (el) el.classList.add('selected'); }
function handleScreensaverMenuHorizontal(dir) { if (currentOverlayIndex === 1) { let idx = delayOptions.indexOf(audioCfg.screensaverDelay); if (dir === 'RIGHT') idx = Math.min(delayOptions.length - 1, idx + 1); else idx = Math.max(0, idx - 1); audioCfg.screensaverDelay = delayOptions[idx]; window.api.saveAudioConfig(audioCfg); resetIdleTimer(); renderScreensaverMenu(); playSound(sfxNav); } }
function executeScreensaverMenuAction() {
  playSound(sfxSelect);
  if (currentOverlayIndex === 0) {
    if (audioCfg.screensaver === 'SCREENSHOTS') audioCfg.screensaver = 'CN WALLPAPERS';
    else if (audioCfg.screensaver === 'CN WALLPAPERS') audioCfg.screensaver = 'OFF';
    else audioCfg.screensaver = 'SCREENSHOTS';
    window.api.saveAudioConfig(audioCfg);
    resetIdleTimer();
    renderScreensaverMenu();
  } else if (currentOverlayIndex === 2) {
    document.getElementById('overlay-backdrop').classList.add('hidden');
    gameState = 'MAIN';
    setBlur(false);
    startScreensaver();
  } else if (currentOverlayIndex === 3) {
    document.getElementById('overlay-backdrop').classList.add('hidden');
    openOverlay("MAIN_MENU");
  }
}

function openThemeCategoryMenu() { gameState = 'THEME_CATS'; const follow = (audioCfg.themeSource === 'MANAGER' ? '★ ' : '') + FOLLOW_MANAGER_LABEL; let cats = [follow, '§BY CATEGORY', ...Object.keys(THEME_CATEGORIES)]; cats.push(t('common.back_to_menu')); renderGenericOverlay("THEME CATEGORIES", cats); }
function openThemeMenu(category) { gameState = 'THEMES'; activeThemeCategory = category; let themes = THEME_CATEGORIES[category].map(th => th === activeTheme ? "★ " + th : th); themes.push(t('common.back')); renderGenericOverlay(category.toUpperCase(), themes); }
function openGamepadMenu() {
  gameState = 'GAMEPAD_MENU';
  let layouts = ["XBOX LAYOUT", "PS LAYOUT", "N LAYOUT"];
  let mapped = layouts.map(l => l.startsWith(audioCfg.gamepadLayout) ? "★ " + l : l);
  mapped.push(t('common.back_to_menu'));
  renderGenericOverlay(t('gamepad.title'), mapped);
}
function openWakeMethodMenu() {
  gameState = 'WAKE_METHOD_MENU';
  let methods = ["START + SELECT", "L1 + R1 + START + SELECT", "L3 + R3", "START + SELECT (HOLD 2 SEC)", "L1 + R1 + START + SELECT (HOLD 2 SEC)", "L3 + R3 (HOLD 2 SEC)"];
  let mapped = methods.map(m => m === audioCfg.wakeMethod ? "★ " + m : m);
  mapped.push(t('common.back_to_menu'));
  renderGenericOverlay(t('wake.title'), mapped);
}
function openLanguageMenu() {
  gameState = 'LANGUAGE_MENU';
  playSound(sfxSelect);
  currentOverlayIndex = 0;
  document.getElementById('overlay-backdrop').classList.remove('hidden');
  const items = [t('language.en'), t('language.pt_BR'), t('common.back_to_menu')];
  renderGenericOverlay(t('language.title'), items);
}
function openMusicStyleMenu() { document.getElementById('sound-backdrop').classList.add('hidden'); gameState = 'MUSIC_STYLE'; let styles = ["PIANO", "AMBIENT", "JAZZ", "LO-FI", "CUSTOM", "OFF"]; let mapped = styles.map(s => s === audioCfg.bgm_mode ? "★ " + s : s); mapped.push("BACK"); renderGenericOverlay("MUSIC STYLE", mapped, "Default styles composed by Schwarzenegger Belonio (Migfus20)<br>freesound.org/people/Migfus20/"); }
function openSoundOverlay() { if (document.getElementById('overlay-backdrop')) document.getElementById('overlay-backdrop').classList.add('hidden'); gameState = 'SOUND'; playSound(sfxSelect); currentOverlayIndex = 0; document.getElementById('sound-backdrop').classList.remove('hidden'); renderSoundMenu(); }
function renderSoundMenu() { const lst = document.getElementById('sound-list'); lst.innerHTML = ''; overlayItems = [t('sound.music_style_label'), audioCfg.bgm ? t('sound.bgm_on') : t('sound.bgm_off'), audioCfg.sfx ? t('sound.sfx_on') : t('sound.sfx_off'), t('sound.bgm_vol', {vol: Math.round(audioCfg.vol * 100)}), t('common.back_to_menu')]; overlayItems.forEach((item, i) => { const div = document.createElement('div'); div.className = 'overlay-item'; div.innerText = item; div.id = `snd-${i}`; lst.appendChild(div); }); document.querySelectorAll('#sound-list .overlay-item').forEach(el => el.classList.remove('selected')); const el = document.getElementById(`snd-${currentOverlayIndex}`); if (el) el.classList.add('selected'); }
function handleSoundHorizontal(dir) { if (currentOverlayIndex === 3) { let v = audioCfg.vol; if (dir === 'RIGHT') v = Math.min(1.0, v + 0.05); else v = Math.max(0.0, v - 0.05); audioCfg.vol = v; if (audioCfg.bgm && !isVideoActive()) bgmAudio.volume = v; window.api.saveAudioConfig(audioCfg); renderSoundMenu(); playSound(sfxNav); } }
function executeSoundAction() { playSound(sfxSelect); if (currentOverlayIndex === 0) { openMusicStyleMenu(); } else if (currentOverlayIndex === 1) { audioCfg.bgm = !audioCfg.bgm; window.api.saveAudioConfig(audioCfg); applyBgmMode(); renderSoundMenu(); } else if (currentOverlayIndex === 2) { audioCfg.sfx = !audioCfg.sfx; window.api.saveAudioConfig(audioCfg); renderSoundMenu(); } else if (currentOverlayIndex === 4) closeSoundOverlay(); }
function closeSoundOverlay() { playSound(sfxBack); document.getElementById('sound-backdrop').classList.add('hidden'); gameState = previousGameState; if (gameState === 'START' || gameState === 'HOME' || gameState === 'MAIN' || gameState === 'GALLERY' || gameState === 'GALLERY_GAMEPAGE') setBlur(false); }


async function openSearchOverlay() { if (document.getElementById('overlay-backdrop')) document.getElementById('overlay-backdrop').classList.add('hidden'); gameState = 'SEARCH'; playSound(sfxSelect); setBlur(true); const bd = document.getElementById('search-backdrop'); const lst = document.getElementById('search-list'); const stat = document.getElementById('search-status'); lst.innerHTML = ''; currentSearchIndex = 0; searchResults = []; stat.innerText = t('status.searching_yt'); bd.classList.remove('hidden'); const results = await window.api.searchYoutube(filteredGames[currentGameIndex].Game); if(results.length === 0) { stat.innerText = t('status.no_results'); setTimeout(closeSearchOverlay, 2000); return; } stat.innerText = "Select a video to download:"; searchResults = results; searchResults.forEach((res, i) => { const div = document.createElement('div'); div.className = 'overlay-item'; div.id = `search-${i}`; div.style.display = "flex"; div.style.gap = "20px"; div.style.alignItems = "center"; div.style.textAlign = "left"; const img = document.createElement('img'); img.src = res.thumbnail; img.style.width = "120px"; img.style.borderRadius = "4px"; let ttl = String(res.title); if(ttl.length > 50) ttl = ttl.substring(0, 47) + "..."; div.appendChild(img); const txt = document.createElement('div'); txt.innerText = ttl; div.appendChild(txt); lst.appendChild(div); }); updateSearchSelection(); }
function updateSearchSelection() { document.querySelectorAll('#search-list .overlay-item').forEach(el => el.classList.remove('selected')); const el = document.getElementById(`search-${currentSearchIndex}`); if (el) el.classList.add('selected'); }
function closeSearchOverlay() { playSound(sfxBack); document.getElementById('search-backdrop').classList.add('hidden'); gameState = 'MAIN'; setBlur(false); }
function executeSearchAction() { playSound(sfxSelect); const selectedVideo = searchResults[currentSearchIndex]; closeSearchOverlay(); openProgressOverlay(filteredGames[currentGameIndex].Game, selectedVideo.title, selectedVideo.id); }
function openProgressOverlay(gameName, videoTitle, videoId) { gameState = 'PROGRESS'; setBlur(true); const bd = document.getElementById('progress-backdrop'); const gameEl = document.getElementById('progress-game'); const fillEl = document.getElementById('progress-fill'); const percentEl = document.getElementById('progress-percent'); const statusEl = document.getElementById('progress-status'); let ttl = String(videoTitle); if(ttl.length > 45) ttl = ttl.substring(0, 42) + "..."; gameEl.innerText = gameName; statusEl.innerText = t('status.requesting_formats', {title: ttl}); fillEl.style.width = "0%"; percentEl.innerText = "0%"; bd.classList.remove('hidden'); window.api.downloadTrailer(gameName, videoId).then(success => { if(success) { statusEl.innerText = t('status.complete'); setDebug("🎬 Download successful", true); setTimeout(closeProgressOverlay, 1500); } else { statusEl.innerText = t('status.download_failed'); setDebug("❌ Download failed", true); setTimeout(closeProgressOverlay, 3000); } }).catch(() => { statusEl.innerText = t('status.download_failed'); setTimeout(closeProgressOverlay, 3000); }); }
function updateDownloadProgressBar(percentage) { const fillEl = document.getElementById('progress-fill'); const percentEl = document.getElementById('progress-percent'); const statusEl = document.getElementById('progress-status'); if (gameState !== 'PROGRESS' || !fillEl || !percentEl) return; statusEl.innerText = t('status.ripping'); fillEl.style.width = `${percentage}%`; percentEl.innerText = `${Math.floor(percentage)}%`; }
function closeProgressOverlay() { document.getElementById('progress-backdrop').classList.add('hidden'); gameState = 'MAIN'; setBlur(false); updateGameSelection(); }

function getMediaForCategory(catName) {
  const filtered = allGames.filter(g => { const s = g.Store ? String(g.Store).toLowerCase() : ''; if (pico8HiddenFor(g, catName)) return false; if (isPlaylistCat(catName)) return playlistCatMatch(g, catName); if (catName === "ALL GAMES") return true; if (catName === "INSTALLED") { const isManual = !g.GrinderGameId && (s.includes("others") || s.includes("emulation") || s.includes("physical") || s.includes("apps")); return isManual ? !!g.LaunchCommand : g.Installed == 1; } if (catName === "STEAM") return s.includes("steam"); if (catName === "GOG") return s.includes("gog"); if (catName === "EPIC") return s.includes("epic"); if (catName === "FLATPAK") return s.includes("flatpak"); if (catName === "ITCH") return s.includes("itch"); if (catName === "PICO-8") return s.includes("pico"); if (catName === "OTHERS") return s.includes("others"); if (catName === "PHYSICAL") return s.includes("physical"); if (catName === "EMULATION") return s.includes("emulation"); if (catName === "APPS") return s.includes("apps"); if (catName === "FAVS") return g.FAV === 'YES'; if (catName === "WANT TO PLAY") return g.WANT_TO_PLAY === 'YES'; if (catName === "BACKLOG") return isBacklog(g); if (catName === "PLAYED") return isPlayed(g); return true; });
  let media = [];
  filtered.forEach(g => { if (g.Screenshot && String(g.Screenshot).trim()) media.push(...String(g.Screenshot).split('|').filter(s => s.trim())); });
  if (media.length < 3) filtered.forEach(g => { if (g.CoverArt && String(g.CoverArt).trim()) media.push(String(g.CoverArt)); });
  media.sort(() => Math.random() - 0.5);
  return media;
}
function fillMosaicIn(catName, iconId, mosaicId, imgClass = 'mosaic-img') {
  const iconEl = document.getElementById(iconId); const mosaicEl = document.getElementById(mosaicId);
  if (!iconEl || !mosaicEl) return;
  const media = getMediaForCategory(catName);
  if (media.length >= 1) { iconEl.style.display = 'none'; mosaicEl.style.display = 'block'; mosaicEl.innerHTML = ''; for (let i = 0; i < 3; i++) { const img = document.createElement('img'); img.className = imgClass; img.src = convertSafePath(media[i % media.length]); mosaicEl.appendChild(img); setTimeout(() => img.classList.add('show'), i * 150 + 50); } }
  else { mosaicEl.style.display = 'none'; iconEl.style.display = 'block'; iconEl.innerHTML = catName; }
}
function updateHeroMosaic(catName) { fillMosaicIn(catName, 'hero-icon', 'hero-mosaic'); }
function transitionToStart() {
  gameState = 'START'; clearMediaLoaders();
  clearGalleryMedia();
  document.getElementById('splash-screen').classList.add('hidden');
  document.getElementById('main-screen').classList.add('hidden');
  document.getElementById('gallery-screen').classList.add('hidden');
  document.getElementById('ggp-screen').classList.add('hidden');
  document.getElementById('home-screen')?.classList.add('hidden');
  document.getElementById('start-screen').classList.remove('hidden');
  const mode = audioCfg.startScreenMode === 'GRID' ? 'GRID' : 'CAROUSEL';
  document.getElementById('start-carousel').style.display = mode === 'CAROUSEL' ? 'flex' : 'none';
  document.getElementById('start-grid').style.display = mode === 'GRID' ? 'flex' : 'none';
  if (mode === 'GRID') renderGridMode();
  else renderCarouselMode();
}
function updateCategorySelection() {
  if (audioCfg.startScreenMode === 'GRID') { updateGridSelection(); return; }
  updateCarouselClasses();
  fillMosaicIn(categories[currentCategoryIndex], 'carousel-hero-icon', 'carousel-hero-mosaic');
}
function transitionToMain() {
  if ((audioCfg.browseMode || 'LIST') === 'GALLERY') { transitionToGallery(); return; }
  gameState = 'MAIN';
  ['start-screen', 'gallery-screen', 'ggp-screen', 'home-screen'].forEach(id => {
    const el = document.getElementById(id); if (el) el.classList.add('hidden');
  });
  document.getElementById('main-screen').classList.remove('hidden');
  const catName = categories[currentCategoryIndex];
  const safeCatName = catName.toLowerCase().replace(/ /g, '_');
  const catIconPath = logoPath(safeCatName);
  document.getElementById('main-header').innerHTML = `<div class="header-icon" style="-webkit-mask-image: url('${catIconPath}');"></div><div>${tCat(catName)}</div>`;
  searchQuery = ""; applyLiveFilters(false);
  maybeRunFlatpakScan(catName);
  maybeRunPico8Scan(catName);
}

// === CAROUSEL MODE ===
const CAROUSEL_PHANTOMS = 4;
let carouselRawPos = CAROUSEL_PHANTOMS;
let carouselAnimating = false;
function renderCarouselMode() {
  const track = document.getElementById('carousel-track'); if (!track) return;
  track.innerHTML = '';
  const all = [...categories.slice(-CAROUSEL_PHANTOMS), ...categories, ...categories.slice(0, CAROUSEL_PHANTOMS)];
  all.forEach(cat => { const item = document.createElement('div'); item.className = 'carousel-item'; const icon = logoPath(cat); item.innerHTML = `<div class="carousel-item-icon" style="-webkit-mask-image:url('${icon}');"></div><div class="carousel-item-label">${tCat(cat)}</div>`; track.appendChild(item); });
  carouselRawPos = currentCategoryIndex + CAROUSEL_PHANTOMS;
  updateCarouselTransform(false); updateCarouselClasses();
  fillMosaicIn(categories[currentCategoryIndex], 'carousel-hero-icon', 'carousel-hero-mosaic');
}
function updateCarouselTransform(animated) {
  const track = document.getElementById('carousel-track'); if (!track) return;
  if (!animated) { track.style.transition = 'none'; void track.offsetWidth; }
  track.style.transform = `translateX(${960 - 100 - carouselRawPos * 200}px)`;
  if (!animated) { void track.offsetWidth; track.style.transition = ''; }
}
function updateCarouselClasses() {
  document.querySelectorAll('#carousel-track .carousel-item').forEach((item, i) => { item.classList.remove('selected', 'near'); const dist = Math.abs(i - carouselRawPos); if (i === carouselRawPos) item.classList.add('selected'); else if (dist <= 2) item.classList.add('near'); });
}
function navigateCarousel(dir) {
  if (carouselAnimating) return;
  const N = categories.length;
  if (dir === 'right') { currentCategoryIndex = (currentCategoryIndex + 1) % N; carouselRawPos++; }
  else { currentCategoryIndex = (currentCategoryIndex - 1 + N) % N; carouselRawPos--; }
  updateCarouselTransform(true); updateCarouselClasses();
  fillMosaicIn(categories[currentCategoryIndex], 'carousel-hero-icon', 'carousel-hero-mosaic');
  if (carouselRawPos < CAROUSEL_PHANTOMS || carouselRawPos >= CAROUSEL_PHANTOMS + N) {
    carouselAnimating = true;
    setTimeout(() => {
      const track = document.getElementById('carousel-track');
      const items = track ? track.querySelectorAll('.carousel-item') : [];
      items.forEach(el => { el.style.transition = 'none'; });
      void track.offsetWidth;
      carouselRawPos = currentCategoryIndex + CAROUSEL_PHANTOMS;
      updateCarouselTransform(false);
      updateCarouselClasses();
      void track.offsetWidth;
      items.forEach(el => { el.style.transition = ''; });
      carouselAnimating = false;
    }, 320);
  }
}
// === GRID MODE ===
function renderGridMode() {
  const topHero = document.getElementById('grid-top-hero'); if (topHero) topHero.style.display = 'none';
  const cells = document.getElementById('grid-cells'); if (!cells) return;
  cells.innerHTML = '';
  categories.forEach((cat, i) => {
    const cell = document.createElement('div'); cell.className = 'grid-cell'; cell.id = `grid-cell-${i}`;
    const icon = logoPath(cat);
    const media = getMediaForCategory(cat);
    const bg = media.length > 0 ? `<img class="grid-cell-bg" src="${convertSafePath(media[0])}" alt="">` : '';
    cell.innerHTML = `${bg}<div class="grid-cell-grad"></div><div class="grid-cell-content"><div class="grid-cell-icon" style="-webkit-mask-image:url('${icon}');"></div><div class="grid-cell-name">${tCat(cat)}</div></div>`;
    cells.appendChild(cell);
  });
  updateGridSelection();
}
function updateGridSelection() {
  categories.forEach((cat, i) => { const cell = document.getElementById(`grid-cell-${i}`); if (cell) cell.classList.toggle('selected', currentCategoryIndex === i); });
}
function navigateGrid(action) {
  const N = categories.length; const COLS = 3;
  const row = Math.floor(currentCategoryIndex / COLS); const col = currentCategoryIndex % COLS;
  if (action === 'UP' && currentCategoryIndex - COLS >= 0) currentCategoryIndex -= COLS;
  else if (action === 'DOWN' && currentCategoryIndex + COLS < N) currentCategoryIndex += COLS;
  else if (action === 'LEFT' && col > 0) currentCategoryIndex--;
  else if (action === 'RIGHT' && col < COLS - 1 && currentCategoryIndex < N - 1) currentCategoryIndex++;
  updateGridSelection();
}
// === START SCREEN MENU ===
function openStartScreenMenu() {
  gameState = 'START_SCREEN_MENU';
  const current = audioCfg.startScreenMode === 'GRID' ? 'GRID' : 'CAROUSEL';
  const opts = [t('start_screen.carousel'), t('start_screen.grid')].map(m => {
    const key = m === t('start_screen.carousel') ? 'CAROUSEL' : 'GRID';
    return key === current ? `★ ${m}` : m;
  });
  opts.push(t('common.back_to_menu'));
  renderGenericOverlay(t('start_screen.title'), opts);
}

function renderGameList() {
  const l = document.getElementById('game-list');
  l.innerHTML = '';

  let emptyHint = document.getElementById('empty-state-hint');
  if (!emptyHint) {
    emptyHint = document.createElement('div');
    emptyHint.id = 'empty-state-hint';
    emptyHint.className = 'media-layer';
    emptyHint.style.cssText = "display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 40px; box-sizing: border-box; text-align: center; background: rgba(0,0,0,0.85); z-index: 20;";
    emptyHint.innerHTML = `<div style="font-size: 36px; font-weight: 900; color: var(--accent); margin-bottom: 20px; letter-spacing: 2px;">${t('empty.library_title')}</div><div style="font-size: 24px; color: var(--text_sec); line-height: 1.6;">${t('empty.library_body')}</div>`;
    document.getElementById('media-container').appendChild(emptyHint);
  }

  if (filteredGames.length === 0) {
    document.getElementById('game-desc').innerText = t('empty.no_games');
    clearMediaLoaders();
    const blank = "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=";
    const bg = document.getElementById('cover-backdrop'); bg.src = blank; bg.classList.remove('active');
    const mini = document.getElementById('cover-mini'); mini.src = blank; mini.classList.add('hidden');
    document.getElementById('stat-dev').innerText = "--"; document.getElementById('stat-pub').innerText = "--"; document.getElementById('stat-release').innerText = "--"; document.getElementById('stat-genre').innerText = "--"; document.getElementById('stat-hltb').innerText = "--"; document.getElementById('stat-proton').innerText = "--"; document.getElementById('stat-franchise').innerText = "--";
    if (document.getElementById('store-icons')) document.getElementById('store-icons').innerHTML = '';
    emptyHint.classList.add('active');
    return;
  } else {
    emptyHint.classList.remove('active');
  }

  const frag = document.createDocumentFragment();

  if (numRecentInList > 0) {
    const labelR = document.createElement('div');
    labelR.style.cssText = "color: var(--accent); font-weight: 900; letter-spacing: 4px; text-align: center; font-size: 16px; padding: 15px 0 5px 0; border-bottom: 2px solid var(--border_solid); margin-bottom: 10px; margin-top: 5px;";
    labelR.innerText = t('game.recent_games');
    frag.appendChild(labelR);
  }

  filteredGames.forEach((game, i) => {
    if (numRecentInList > 0 && i === numRecentInList) {
      const labelA = document.createElement('div');
      labelA.style.cssText = "color: var(--text_sec); font-weight: 900; letter-spacing: 4px; text-align: center; font-size: 16px; padding: 15px 0 5px 0; border-bottom: 2px solid var(--border_solid); margin-bottom: 10px; margin-top: 20px;";
      labelA.innerText = t('game.all_games_header');
      frag.appendChild(labelA);
    }

    const d = document.createElement('div');
    d.className = 'game-item';
    let p = ""; if (game.FAV === 'YES') p += "★ "; if (game.WANT_TO_PLAY === 'YES') p += "♥ ";
    const isInst = game.Installed == null || game.Installed == 1;
    d.innerHTML = `<span class="list-install-dot ${isInst ? 'is-installed' : 'not-installed'}" title="${isInst ? t('status.installed') : t('status.install')}">●</span>${p}${game.Game}`;
    d.id = `game-${i}`;
    frag.appendChild(d);
  });

  l.appendChild(frag);
  updateGameSelection();
}
function colorProtonText(el, tier) { if (!tier) return; const t = String(tier).toUpperCase(); el.innerText = t; if (t.includes("PLATINUM")) el.style.color = "#00e5ff"; else if (t.includes("GOLD")) el.style.color = "#ffd700"; else if (t.includes("SILVER")) el.style.color = "#c0c0c0"; else if (t.includes("BRONZE")) el.style.color = "#cd7f32"; else if (t.includes("BORKED")) el.style.color = "#ff0000"; else if (t.includes("NATIVE")) el.style.color = "#00ff00"; else el.style.color = "var(--text_main)"; }

function clearMediaLoaders() {
  clearTimeout(trailerTimeout); clearInterval(screenshotInterval);
  if (audioCfg.bgm && bgmAudio.volume < audioCfg.vol && hasBooted && gameState !== 'SPLASH' && gameState !== 'GAME_RUNNING' && audioCfg.bgm_mode !== "OFF") fadeBGM(audioCfg.vol);
  if (audioCfg.bgm && bgmAudio.paused && hasBooted && gameState !== 'SPLASH' && gameState !== 'GAME_RUNNING' && audioCfg.bgm_mode !== "OFF" && !window.manualBgmPause) { bgmAudio.play().catch(e=>{}); }
  const mainDock = document.getElementById('media-container'), vid = document.getElementById('video-player'), ss = document.getElementById('screenshot-player'), bg = document.getElementById('cover-backdrop'), mini = document.getElementById('cover-mini'), prompt = document.getElementById('mini-prompt');
  const blank = "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=";
  try {
    if(vid) { vid.pause(); vid.removeAttribute('src'); vid.load(); vid.classList.remove('active'); mainDock.appendChild(vid); }
    if(ss) { ss.src = blank; ss.classList.remove('active'); mainDock.appendChild(ss); }
    if(bg) { bg.src = blank; bg.classList.add('active'); mainDock.appendChild(bg); }
    if(prompt) { prompt.style.opacity = '1'; }
    let nm = document.getElementById('no-media-hint'); if (nm) nm.classList.remove('active');
  } catch(e) {}
  gameHasTrailer = false; mediaSwapped = false; setDebug("", false);
}

let listScrollTimer = null;

function updateGameSelection() {
  if (filteredGames.length === 0) return;

  const now = Date.now();
  const isSpeeding = (now - lastSelectionTime) < 150;
  lastSelectionTime = now;

  document.querySelectorAll('.game-item').forEach(el => {
    el.classList.remove('selected');
    el.style.transition = isSpeeding ? 'none' : 'all 0.1s';
  });

  const sel = document.getElementById(`game-${currentGameIndex}`);
  if (sel) {
    sel.classList.add('selected');
    sel.style.transition = isSpeeding ? 'none' : 'all 0.1s';
    sel.scrollIntoView({ behavior: isSpeeding ? "auto" : "smooth", block: "center" });
  }

  clearMediaLoaders();
  clearTimeout(listScrollTimer);

  listScrollTimer = setTimeout(() => {
    const game = filteredGames[currentGameIndex];
    try {
      let d = getLocalizedDescription(game) || t('empty.no_desc'); if (d.length > 500) d = d.substring(0, 497) + "..."; document.getElementById('game-desc').innerText = d;
      document.getElementById('stat-dev').innerText = game.DEV || "--"; document.getElementById('stat-pub').innerText = game.PUB || "--"; document.getElementById('stat-release').innerText = game.RELEASED || "--"; document.getElementById('stat-franchise').innerText = game.Franchise || "--";
      let genre = game.GENRE ? String(game.GENRE) : "--"; if (genre.includes(",")) genre = genre.split(",")[0]; document.getElementById('stat-genre').innerText = genre;
      const hltbEl = document.getElementById('stat-hltb'); if (game.HLTB_Main && String(game.HLTB_Main).trim() !== "") { hltbEl.innerText = game.HLTB_Main; hltbEl.style.color = "var(--accent)"; } else { hltbEl.innerText = "--"; hltbEl.style.color = "var(--text_dim)"; }
      const protonEl = document.getElementById('stat-proton'); if (game.ProtonTier && String(game.ProtonTier).trim() !== "") { colorProtonText(protonEl, game.ProtonTier); } else { protonEl.innerText = "--"; protonEl.style.color = "var(--text_dim)"; }
      const achBox = document.getElementById('stat-ach-box'); const achEl = document.getElementById('stat-ach');
      const _gogKey   = _cGogAppId(game);
      const _steamKey = game.SteamAppID ? `steam_${String(game.SteamAppID).replace(/\.0+$/, '')}` : null;
      const _listAchKey = _gogKey || _steamKey;
      if (_listAchKey) {
        achBox.style.display = ''; achEl.textContent = '...';
        window.api.getGameAchievements(_listAchKey).then(r => {
          if (gameState !== 'MAIN' || filteredGames[currentGameIndex]?.id !== game.id) return;
          if (r.ok && r.achievements.length) { const u = r.achievements.filter(a => a.date_unlocked).length; achEl.textContent = `${u} / ${r.achievements.length}`; }
          else { achBox.style.display = 'none'; }
        });
      } else { achBox.style.display = 'none'; }
      let hasCover = game.CoverArt && String(game.CoverArt).trim() !== "";
      let hasScreenshotsTemp = game.Screenshot && String(game.Screenshot).trim() !== "";

      let noMediaHint = document.getElementById('no-media-hint');
      if (!noMediaHint) {
        noMediaHint = document.createElement('div');
        noMediaHint.id = 'no-media-hint';
        noMediaHint.className = 'media-layer';
        noMediaHint.style.cssText = "display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 40px; box-sizing: border-box; text-align: center; background: rgba(0,0,0,0.7); z-index: 15;";
        noMediaHint.innerHTML = `<div style="font-size: 32px; font-weight: 900; color: var(--accent); margin-bottom: 15px; letter-spacing: 2px;">${t('empty.no_media')}</div><div style="font-size: 20px; color: var(--text_sec); line-height: 1.6;">${t('empty.no_media_hint1')}<br>${t('empty.no_media_hint2')}<br>${t('empty.no_media_hint3')}</div>`;
        document.getElementById('media-container').appendChild(noMediaHint);
      }

      if (!hasCover && !hasScreenshotsTemp) noMediaHint.classList.add('active');
      else noMediaHint.classList.remove('active');

      const bg = document.getElementById('cover-backdrop'); const mini = document.getElementById('cover-mini');
      const blank = "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=";
      if (hasCover) { const p = convertSafePath(game.CoverArt); bg.src = p; mini.src = p; mini.classList.remove('hidden'); }
      else { bg.src = blank; mini.src = blank; mini.classList.add('hidden'); }

      const storeContainer = document.getElementById('store-icons');
      if (storeContainer) { storeContainer.innerHTML = ''; if (game.Store && String(game.Store).trim() !== "") { const stores = String(game.Store).split(',').map(s => s.trim().toLowerCase().replace(/\s+/g, '_')).filter(s => s !== ""); stores.forEach(s => { const div = document.createElement('div'); div.className = 'store-icon'; div.style.webkitMaskImage = `url('${logoPath(s)}')`; storeContainer.appendChild(div); }); } }

      trailerTimeout = setTimeout(() => {
        let hasScreenshots = false;
        if (hasScreenshotsTemp) { screenshotArray = String(game.Screenshot).split('|').filter(s => String(s).trim() !== ""); if (screenshotArray.length > 0) { hasScreenshots = true; currentScreenshotIndex = 0; const ss = document.getElementById('screenshot-player'); ss.src = convertSafePath(screenshotArray[0]); screenshotInterval = setInterval(() => { currentScreenshotIndex = (currentScreenshotIndex + 1) % screenshotArray.length; ss.src = convertSafePath(screenshotArray[currentScreenshotIndex]); }, 4000); } }
        window.api.checkLocalTrailer(game.Game).then(localUrl => {

          // FIX: Guard against late promise resolution playing video in the background while game is launching
          if (gameState !== 'MAIN' || filteredGames[currentGameIndex]?.id !== game.id) return;

          const mainDock = document.getElementById('media-container'); const miniDock = document.getElementById('mini-dock'); const vid = document.getElementById('video-player'); const ss = document.getElementById('screenshot-player'); const prompt = document.getElementById('mini-prompt');
          if (localUrl) {
            if (noMediaHint) noMediaHint.classList.remove('active');
            gameHasTrailer = true; prompt.style.opacity = '0'; mainDock.appendChild(vid); miniDock.appendChild(ss); vid.src = localUrl; vid.volume = 0.5; vid.muted = false; vid.play().then(() => { fadeBGM(0); bg.classList.remove('active'); vid.classList.add('active'); if(hasScreenshots) ss.classList.add('active'); }).catch(e => { setDebug(`PLAYBACK ERROR`, true); });
          } else {
            gameHasTrailer = false; prompt.style.opacity = '1'; mainDock.appendChild(ss); if (hasScreenshots) { bg.classList.remove('active'); ss.classList.add('active'); }
          } });
      }, 2000);
    } catch(e) {}
  }, isSpeeding ? 150 : 0);
}

// === JUKEBOX OS ENGINE ===
let jbLibrary = [], jbPlaylists = {}, jbQueue = [];
let jbFocus = 'SIDEBAR', jbNavIndex = 0, jbListIndex = 0, jbView = 'ROOT', jbActiveSelection = null, jbSecondarySelection = null;
let jbListItems = [], jbSearchQuery = "", jbIsFullscreen = false, jbUpdateTimer = null;
let jbActionTarget = null;

const jbStyle = document.createElement('style');
jbStyle.innerHTML = `@keyframes bounce { 0% { height: 10px; } 100% { height: 40px; } }
@keyframes wave1 { 0% { transform: rotate(-6deg) translateY(30px) scaleX(1); } 100% { transform: rotate(6deg) translateY(-120px) scaleX(1.1); } }
@keyframes wave2 { 0% { transform: rotate(8deg) translateY(-30px) scaleX(1.1); } 100% { transform: rotate(-8deg) translateY(120px) scaleX(1); } }`;
document.head.appendChild(jbStyle);

function formatJbTime(sec) {
  if (!sec || isNaN(sec)) return "0:00";
  let m = Math.floor(sec / 60); let s = Math.floor(sec % 60);
  return m + ":" + (s < 10 ? "0" : "") + s;
}

async function openJukebox() {
  gameState = 'JUKEBOX'; setBlur(false);
  ['start-screen', 'main-screen', 'gallery-screen', 'ggp-screen'].forEach(id => {
    const el = document.getElementById(id); if (el) el.classList.add('hidden');
  });
  document.getElementById('jukebox-screen').classList.remove('hidden');
  document.getElementById('jb-footer').innerHTML = `${getBtn('dpad_up')}${getBtn('dpad_down')}${getBtn('L1')}${getBtn('R1')} ${t('footer.navigate')} &nbsp;&nbsp; ${getMappedBtn('SOUTH')} ${t('footer.play')} &nbsp;&nbsp; ${getMappedBtn('EAST')} ${t('footer.back')} &nbsp;&nbsp; ${getMappedBtn('NORTH')} ${t('footer.search')} &nbsp;&nbsp; ${getMappedBtn('WEST')} ${t('footer.fullscreen')} &nbsp;&nbsp; ${getMappedBtn('SELECT')} ${t('footer.options')}`;

  if (jbLibrary.length === 0) {
    document.getElementById('jb-status').innerText = t('status.scanning_music');
    jbLibrary = await window.api.getMusicLibrary();
    jbPlaylists = await window.api.getPlaylists() || {};
  }

  document.getElementById('jb-status').innerText = t('jb.n_tracks', {n: jbLibrary.length});
  jbFocus = 'SIDEBAR'; jbNavIndex = 0; jbView = 'ROOT'; jbListIndex = 0; jbSearchQuery = "";
  updateJbSidebar();
  renderJbList();

  clearInterval(jbUpdateTimer);
  jbUpdateTimer = setInterval(updateJbNowPlayingUI, 1000);
  updateJbNowPlayingUI();
}

function closeJukebox() {
  gameState = previousGameState;
  setBlur(false);
  document.getElementById('jukebox-screen').classList.add('hidden');

  if (gameState === 'START') {
    document.getElementById('start-screen').classList.remove('hidden');
  } else if (gameState === 'GALLERY' || gameState === 'GALLERY_GAMEPAGE') {
    document.getElementById('gallery-screen').classList.remove('hidden');
  } else {
    document.getElementById('main-screen').classList.remove('hidden');
  }

  clearInterval(jbUpdateTimer);
}

function updateJbSidebar() {
  const jbNavLabels = [t('jb.songs'), t('jb.artists'), t('jb.albums'), t('jb.playlists')];
  for(let i=0; i<4; i++) {
    let el = document.getElementById(`jb-nav-${i}`);
    if(el) {
      el.innerText = jbNavLabels[i];
      el.classList.remove('selected');
      if(i === jbNavIndex && jbFocus === 'SIDEBAR') el.classList.add('selected');
      else if (i === jbNavIndex && jbFocus === 'LIST') { el.style.color = 'var(--accent)'; el.style.fontWeight = 'bold'; }
      else { el.style.color = 'var(--text_sec)'; el.style.fontWeight = 'normal'; }
    }
  }
}

function renderJbList() {
  const l = document.getElementById('jb-list');
  l.innerHTML = ''; jbListItems = [];

  if (jbView === 'ROOT') {
    if (jbNavIndex === 0) jbListItems = jbLibrary;
    else if (jbNavIndex === 1) jbListItems = [...new Set(jbLibrary.map(t => t.artist))].sort();
    else if (jbNavIndex === 2) jbListItems = [...new Set(jbLibrary.map(t => t.album))].sort();
    else if (jbNavIndex === 3) { jbListItems = Object.keys(jbPlaylists); jbListItems.unshift(t('jb.add_new_playlist')); }
  } else if (jbView === 'ARTIST_ALBUMS') {
    let artistTracks = jbLibrary.filter(t => t.artist === jbActiveSelection);
    let albums = [...new Set(artistTracks.map(t => t.album))].sort();
    jbListItems = [t('jb.all_songs'), ...albums];
  } else if (jbView === 'SUBLIST_ALBUM') {
    jbListItems = jbLibrary.filter(t => t.artist === jbActiveSelection && t.album === jbSecondarySelection);
  } else {
    if (jbNavIndex === 1) jbListItems = jbLibrary.filter(t => t.artist === jbActiveSelection);
    else if (jbNavIndex === 2) jbListItems = jbLibrary.filter(t => t.album === jbActiveSelection);
    else if (jbNavIndex === 3) jbListItems = jbLibrary.filter(t => (jbPlaylists[jbActiveSelection] || []).includes(t.path));
  }

  if (jbSearchQuery && jbNavIndex === 0) {
    jbListItems = jbListItems.filter(t => t.title.toLowerCase().includes(jbSearchQuery.toLowerCase()) || t.artist.toLowerCase().includes(jbSearchQuery.toLowerCase()));
  }

  if (jbListItems.length === 0) {
    if (jbLibrary.length === 0) {
      l.innerHTML = `
      <div style="display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 40px; box-sizing: border-box; text-align: center; background: rgba(0,0,0,0.4); border-radius: 12px; height: 100%; border: 2px dashed var(--border_solid);">
      <div style="font-size: 32px; font-weight: 900; color: var(--accent); margin-bottom: 20px; letter-spacing: 2px;">${t('empty.jb_title')}</div>
      <div style="font-size: 22px; color: var(--text_sec); line-height: 1.6;">
      ${t('empty.jb_body')}<br>
      <strong style="color: var(--text_main); display: inline-block; margin-top: 10px; background: rgba(0,0,0,0.5); padding: 8px 15px; border-radius: 6px;">${t('empty.jb_folder')}</strong><br><br>
      ${t('empty.jb_hint')}
      </div>
      </div>`;
    } else {
      l.innerHTML = `<div style="display: flex; justify-content: center; align-items: center; height: 100%; color: var(--text_dim); font-size: 26px; font-weight: bold; letter-spacing: 2px;">${t('empty.jb_no_tracks')}</div>`;
    }
    return;
  }

  const frag = document.createDocumentFragment();
  jbListItems.forEach((item, i) => {
    const d = document.createElement('div');
    d.className = 'game-item';
    d.id = `jb-item-${i}`;
    if (jbView === 'ROOT' && jbNavIndex !== 0) d.innerText = item;
    else if (jbView === 'ARTIST_ALBUMS') d.innerText = item;
    else d.innerText = `${item.title} - ${item.artist}`;
    frag.appendChild(d);
  });
  l.appendChild(frag);
  if (jbListIndex >= jbListItems.length) jbListIndex = 0;
  updateJbListSelection();
}

function updateJbListSelection() {
  if (jbFocus !== 'LIST' || jbListItems.length === 0) {
    document.querySelectorAll('#jb-list .game-item').forEach(el => el.classList.remove('selected'));
    return;
  }
  document.querySelectorAll('#jb-list .game-item').forEach(el => el.classList.remove('selected'));
  const sel = document.getElementById(`jb-item-${jbListIndex}`);
  if (sel) {
    sel.classList.add('selected');
    sel.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

window.manualBgmPause = false;
function toggleJbPlayPause() {
  if (!isCustom || audioCfg.bgm_mode !== "CUSTOM") return;
  if (bgmAudio.paused) {
    window.manualBgmPause = false;
    bgmAudio.play().catch(e=>{});
  } else {
    window.manualBgmPause = true;
    bgmAudio.pause();
  }
}

function handleJbListAccept() {
  if (jbView === 'ROOT' && jbNavIndex !== 0) {
    const sel = jbListItems[jbListIndex];
    if (jbNavIndex === 3 && sel === t('jb.add_new_playlist')) {
      openOSK('NEW_PLAYLIST', t('osk.playlist_name'), '');
      return;
    }
    jbActiveSelection = sel;
    if (jbNavIndex === 1) jbView = 'ARTIST_ALBUMS';
    else jbView = 'SUBLIST';
    jbListIndex = 0;
    renderJbList();
  } else if (jbView === 'ARTIST_ALBUMS') {
    const sel = jbListItems[jbListIndex];
    if (sel === t('jb.all_songs')) {
      jbView = 'SUBLIST';
    } else {
      jbView = 'SUBLIST_ALBUM';
      jbSecondarySelection = sel;
    }
    jbListIndex = 0;
    renderJbList();
  } else {
    const selectedTarget = jbListItems[jbListIndex];
    const selectedPath = typeof selectedTarget === 'string' ? selectedTarget : selectedTarget.path;
    const currentPath = customPlaylist[customIndex - 1] || customPlaylist[0];

    if (isCustom && audioCfg.bgm_mode === "CUSTOM" && currentPath === selectedPath) {
      toggleJbPlayPause();
      return;
    }

    jbQueue = jbListItems;
    customPlaylist = jbQueue.map(t => typeof t === 'string' ? t : t.path);
    customIndex = jbListIndex;
    isCustom = true; audioCfg.bgm_mode = "CUSTOM"; window.api.saveAudioConfig(audioCfg);

    if (jbNavIndex === 0 && jbView === 'ROOT' && !jbSearchQuery) {
      let selected = customPlaylist[customIndex];
      customPlaylist = customPlaylist.sort(() => Math.random() - 0.5);
      customPlaylist = customPlaylist.filter(p => p !== selected);
      customPlaylist.unshift(selected);
      customIndex = 0;
    }

    playNextCustom(false);
    updateJbNowPlayingUI();
  }
}

function updateJbNowPlayingUI() {
  if (!isCustom || customPlaylist.length === 0) {
    const noCoverSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#141414"/><text x="50" y="42" dominant-baseline="middle" text-anchor="middle" fill="#777777" font-family="sans-serif" font-size="16" font-weight="bold" letter-spacing="1">NO</text><text x="50" y="62" dominant-baseline="middle" text-anchor="middle" fill="#777777" font-family="sans-serif" font-size="16" font-weight="bold" letter-spacing="1">COVER</text></svg>`;
    const svgData = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(noCoverSvg);

    const npCover = document.getElementById('jb-np-cover');
    if (npCover) npCover.src = svgData;
    document.getElementById('jb-np-title').innerText = t('jb.no_track');
    document.getElementById('jb-np-artist').innerText = "---";

    if (jbIsFullscreen) {
      const fsCover = document.getElementById('jb-fs-cover');
      if (fsCover) fsCover.src = svgData;
      const fsTitle = document.getElementById('jb-fs-title'); if (fsTitle) fsTitle.innerText = t('jb.no_track');
      const fsArtist = document.getElementById('jb-fs-artist'); if (fsArtist) fsArtist.innerText = "---";
      const fsCur = document.getElementById('jb-fs-current'); if (fsCur) fsCur.innerText = "0:00";
      const fsTot = document.getElementById('jb-fs-total'); if (fsTot) fsTot.innerText = "0:00";
      const fsProg = document.getElementById('jb-fs-progress'); if (fsProg) fsProg.style.width = '0%';
    }
    return;
  }

  const currentPath = customPlaylist[customIndex - 1] || customPlaylist[0];
  let meta = jbLibrary.find(t => t.path === currentPath);

  if (meta) {
    document.getElementById('jb-np-title').innerText = meta.title;
    document.getElementById('jb-np-artist').innerText = meta.artist;
  }

  window.api.getAudioMetadata(currentPath).then(track => {
    const cover = document.getElementById('jb-np-cover');
    if (track.cover) {
      cover.src = track.cover;
    } else {
      const noCoverSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#141414"/><text x="50" y="42" dominant-baseline="middle" text-anchor="middle" fill="#777777" font-family="sans-serif" font-size="16" font-weight="bold" letter-spacing="1">NO</text><text x="50" y="62" dominant-baseline="middle" text-anchor="middle" fill="#777777" font-family="sans-serif" font-size="16" font-weight="bold" letter-spacing="1">COVER</text></svg>`;
      cover.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(noCoverSvg);
    }
  });

  const qContainer = document.getElementById('jb-queue');
  qContainer.innerHTML = '';
  for(let i=0; i<10; i++) {
    let idx = customIndex + i;
    if (idx < customPlaylist.length) {
      let p = customPlaylist[idx];
      let m = jbLibrary.find(t => t.path === p);
      let text = m ? `${m.title} - ${m.artist}` : p.split('/').pop();
      let d = document.createElement('div');
      d.innerText = `${i+1}. ${text}`;
      d.style.whiteSpace = 'nowrap'; d.style.overflow = 'hidden'; d.style.textOverflow = 'ellipsis';
      if (i === 0) d.style.color = "var(--accent)";
      qContainer.appendChild(d);
    }
  }

  if (jbIsFullscreen) {
    const fsCover = document.getElementById('jb-fs-cover'); const npCover = document.getElementById('jb-np-cover');
    if (fsCover && npCover) fsCover.src = npCover.src;

    const fsTitle = document.getElementById('jb-fs-title'); const npTitle = document.getElementById('jb-np-title');
    if (fsTitle && npTitle) fsTitle.innerText = npTitle.innerText;

    const fsArtist = document.getElementById('jb-fs-artist'); const npArtist = document.getElementById('jb-np-artist');
    if (fsArtist && npArtist) fsArtist.innerText = npArtist.innerText;

    let cur = bgmAudio.currentTime || 0; let tot = bgmAudio.duration || 0;
    document.getElementById('jb-fs-current').innerText = formatJbTime(cur);
    document.getElementById('jb-fs-total').innerText = formatJbTime(tot);
    let pct = tot > 0 ? (cur / tot) * 100 : 0;
    document.getElementById('jb-fs-progress').style.width = pct + '%';
  }
}

function toggleJbFullscreen() {
  jbIsFullscreen = !jbIsFullscreen;
  const mainCont = document.querySelector('#jukebox-screen .main-container');
  const hdr = document.querySelector('#jukebox-screen .header');
  const ftr = document.getElementById('jb-footer');

  let fsView = document.getElementById('jb-fs-view');
  if (!fsView) {
    fsView = document.createElement('div');
    fsView.id = 'jb-fs-view';
    fsView.style.cssText = "position: absolute; top:0; left:0; width:100%; height:100%; z-index: 50; display: flex; flex-direction: column; justify-content: flex-end; padding: 100px; box-sizing: border-box; background: radial-gradient(circle at center, #0a0a0a 0%, #000000 100%); overflow: hidden; opacity: 0; transition: opacity 0.5s ease;";
    fsView.innerHTML = `
    <div class="xmb-wave" style="position:absolute; top:25%; left:-10%; width:120%; height:30%; background: linear-gradient(90deg, transparent, var(--accent), transparent); border-radius: 50%; opacity: 0.4; filter: blur(35px); animation: wave1 8s infinite alternate ease-in-out;"></div>
    <div class="xmb-wave" style="position:absolute; top:45%; left:-10%; width:120%; height:25%; background: linear-gradient(90deg, transparent, var(--text_sec), transparent); border-radius: 50%; opacity: 0.25; filter: blur(25px); animation: wave2 12s infinite alternate ease-in-out;"></div>
    <div class="xmb-wave" style="position:absolute; top:65%; left:-10%; width:120%; height:15%; background: linear-gradient(90deg, transparent, var(--text_main), transparent); border-radius: 50%; opacity: 0.15; filter: blur(15px); animation: wave1 10s infinite alternate-reverse ease-in-out;"></div>
    <div style="position: relative; z-index: 2; display: flex; align-items: center; gap: 50px; width: 100%;">
    <img id="jb-fs-cover" src="" style="width: 320px; height: 320px; border-radius: 15px; box-shadow: 0 20px 50px rgba(0,0,0,0.9); object-fit: cover; background: #111;">
    <div style="flex: 1; text-shadow: 0 5px 15px rgba(0,0,0,0.8);">
    <div id="jb-fs-title" style="font-size: 64px; font-weight: 900; color: #fff; margin-bottom: 10px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Title</div>
    <div id="jb-fs-artist" style="font-size: 36px; color: #ccc; margin-bottom: 50px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Artist</div>
    <div style="display: flex; align-items: center; gap: 20px; font-size: 24px; color: #aaa; font-weight: bold;">
    <span id="jb-fs-current" style="min-width: 80px; text-align: right;">0:00</span>
    <div style="flex: 1; height: 10px; background: rgba(255,255,255,0.15); border-radius: 5px; overflow: hidden; box-shadow: inset 0 1px 5px rgba(0,0,0,0.8);">
    <div id="jb-fs-progress" style="width: 0%; height: 100%; background: var(--accent); box-shadow: 0 0 15px var(--accent); transition: width 1s linear;"></div>
    </div>
    <span id="jb-fs-total" style="min-width: 80px;">0:00</span>
    </div>
    </div>
    </div>

    <div id="jb-fs-controls-hint" style="position: absolute; bottom: 30px; right: 40px; color: rgba(255,255,255,0.5); font-size: 20px; font-weight: bold; z-index: 5; display: flex; align-items: center; gap: 10px;">
    ${getMappedBtn('NORTH')} Controls
    </div>

    <div id="jb-fs-controls-popup" class="hidden" style="position: absolute; bottom: 80px; right: 40px; background: rgba(0,0,0,0.85); border: 2px solid var(--border_solid); border-radius: 12px; padding: 25px; z-index: 10; display: flex; flex-direction: column; gap: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.8); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); transition: opacity 0.3s ease;">
    <div style="color: var(--text_main); font-size: 22px; font-weight: bold; text-align: center; margin-bottom: 5px; border-bottom: 1px solid var(--border_solid); padding-bottom: 10px;">FULLSCREEN CONTROLS</div>
    <div style="color: var(--text_sec); font-size: 20px; display: flex; align-items: center; gap: 15px;">${getMappedBtn('SOUTH')} Play / Pause</div>
    <div style="color: var(--text_sec); font-size: 20px; display: flex; align-items: center; gap: 15px;">${getBtn('L3')} / ${getBtn('R3')} Prev / Next Track</div>
    <div style="color: var(--text_sec); font-size: 20px; display: flex; align-items: center; gap: 15px;">${getMappedBtn('WEST')} / ${getMappedBtn('EAST')} Exit Fullscreen</div>
    </div>
    `;
    document.getElementById('jukebox-screen').appendChild(fsView);
    updateJbFsHints();
  }

  if (jbIsFullscreen) {
    mainCont.style.display = 'none'; hdr.style.display = 'none'; ftr.style.display = 'none';
    fsView.classList.remove('hidden'); fsView.style.opacity = '1';
    updateJbNowPlayingUI();
  } else {
    fsView.style.opacity = '0'; fsView.classList.add('hidden');
    const pop = document.getElementById('jb-fs-controls-popup');
    if (pop) pop.classList.add('hidden');
    mainCont.style.display = 'flex'; hdr.style.display = 'flex'; ftr.style.display = 'flex';
  }
}

function handleJbSelectBtn() {
  if (jbListItems.length === 0) return;

  if (jbView === 'ROOT' && jbNavIndex === 3) {
    if (jbListIndex === 0) return;
    jbActionTarget = jbListItems[jbListIndex];
    gameState = 'JUKEBOX_OVERLAY'; currentOverlayType = 'JB_PLAYLIST_OPTS';
    renderGenericOverlay(t('jb.playlist_options', {name: jbActionTarget}), [t('jb.remove_playlist'), t('jb.duplicate_playlist'), t('jb.rename_playlist'), t('common.cancel')]);
  } else if ((jbView === 'ROOT' && (jbNavIndex === 1 || jbNavIndex === 2)) || jbView === 'ARTIST_ALBUMS') {
    const sel = jbListItems[jbListIndex];
    let batchType = 'ALBUM';
    let targetName = sel;
    let overlayTitle = t('jb.album_batch', {name: sel});

    if ((jbView === 'ROOT' && jbNavIndex === 1) || sel === t('jb.all_songs')) {
      batchType = 'ARTIST';
      targetName = sel === t('jb.all_songs') ? jbActiveSelection : sel;
      overlayTitle = t('jb.artist_batch', {name: targetName});
    }

    jbActionTarget = { type: batchType, name: targetName, artist: jbActiveSelection };
    gameState = 'JUKEBOX_OVERLAY'; currentOverlayType = 'JB_BATCH_ADD';

    let opts = Object.keys(jbPlaylists).map(p => t('jb.add_to', {name: p}));
    opts.unshift(t('jb.add_new_playlist'));
    opts.push(t('common.cancel'));
    renderGenericOverlay(overlayTitle, opts);
  } else if (jbNavIndex === 0 || jbView === 'SUBLIST' || jbView === 'SUBLIST_ALBUM') {
    jbActionTarget = jbListItems[jbListIndex];
    gameState = 'JUKEBOX_OVERLAY'; currentOverlayType = 'JB_SONG_OPTS';
    let opts = Object.keys(jbPlaylists).map(p => t('jb.add_to', {name: p}));
    opts.unshift(t('jb.add_new_playlist'));
    if (jbNavIndex === 3 && jbView === 'SUBLIST') opts.unshift(t('jb.remove_from'));
    opts.push(t('common.cancel'));
    renderGenericOverlay(t('jb.song_options'), opts);
  }
}

function executeJbOverlayAction() {
  const action = overlayItems[currentOverlayIndex];
  if (action === t('common.cancel')) { closeOverlay(); gameState = 'JUKEBOX'; return; }

  if (action === t('jb.add_new_playlist') && (currentOverlayType === 'JB_BATCH_ADD' || currentOverlayType === 'JB_SONG_OPTS')) {
    closeOverlay();
    openOSK('NEW_PLAYLIST_ADD', t('osk.new_playlist_name'), '');
    return;
  }

  if (currentOverlayType === 'JB_PLAYLIST_OPTS') {
    if (action === t('jb.remove_playlist')) {
      delete jbPlaylists[jbActionTarget];
      window.api.savePlaylists(jbPlaylists);
      closeOverlay(); gameState = 'JUKEBOX'; renderJbList();
    } else if (action === t('jb.duplicate_playlist')) {
      jbPlaylists[`${jbActionTarget} Copy`] = [...jbPlaylists[jbActionTarget]];
      window.api.savePlaylists(jbPlaylists);
      closeOverlay(); gameState = 'JUKEBOX'; renderJbList();
    } else if (action === t('jb.rename_playlist')) {
      closeOverlay();
      openOSK('RENAME_PLAYLIST', t('osk.rename_playlist'), jbActionTarget);
    }
  } else if (currentOverlayType === 'JB_BATCH_ADD') {
    const addPrefix = t('jb.add_to', {name: ''});
    if (action.startsWith(addPrefix)) {
      let pName = action.slice(addPrefix.length);
      let tracksToAdd = [];

      if (jbActionTarget.type === 'ARTIST') {
        tracksToAdd = jbLibrary.filter(tr => tr.artist === jbActionTarget.name);
      } else if (jbActionTarget.type === 'ALBUM') {
        if (jbView === 'ARTIST_ALBUMS') {
          tracksToAdd = jbLibrary.filter(tr => tr.artist === jbActionTarget.artist && tr.album === jbActionTarget.name);
        } else {
          tracksToAdd = jbLibrary.filter(tr => tr.album === jbActionTarget.name);
        }
      }

      tracksToAdd.forEach(tr => {
        if (!jbPlaylists[pName].includes(tr.path)) jbPlaylists[pName].push(tr.path);
      });

        window.api.savePlaylists(jbPlaylists);
        closeOverlay(); gameState = 'JUKEBOX';
    }
  } else if (currentOverlayType === 'JB_SONG_OPTS') {
    if (action === t('jb.remove_from')) {
      let pList = jbPlaylists[jbActiveSelection];
      jbPlaylists[jbActiveSelection] = pList.filter(p => p !== jbActionTarget.path);
      window.api.savePlaylists(jbPlaylists);
      closeOverlay(); gameState = 'JUKEBOX'; renderJbList();
    } else {
      const addPrefix = t('jb.add_to', {name: ''});
      if (action.startsWith(addPrefix)) {
        let pName = action.slice(addPrefix.length);
        if (!jbPlaylists[pName].includes(jbActionTarget.path)) {
          jbPlaylists[pName].push(jbActionTarget.path);
          window.api.savePlaylists(jbPlaylists);
        }
        closeOverlay(); gameState = 'JUKEBOX';
      }
    }
  }
}

function handleJukeboxInput(action) {
  if (gameState === 'JUKEBOX_OVERLAY') {
    if (action === 'UP') { currentOverlayIndex = (currentOverlayIndex - 1 + overlayItems.length) % overlayItems.length; playSound(sfxNav); updateOverlaySelection(); }
    else if (action === 'DOWN') { currentOverlayIndex = (currentOverlayIndex + 1) % overlayItems.length; playSound(sfxNav); updateOverlaySelection(); }
    else if (action === 'BACK') { closeOverlay(); gameState = 'JUKEBOX'; }
    else if (action === 'ACCEPT') { playSound(sfxSelect); executeJbOverlayAction(); }
    return;
  }

  if (action === 'ACCEPT' && jbIsFullscreen) {
    playSound(sfxSelect);
    toggleJbPlayPause();
    return;
  }

  if (action === 'BACK') {
    if (jbIsFullscreen) {
      const pop = document.getElementById('jb-fs-controls-popup');
      if (pop && !pop.classList.contains('hidden')) {
        playSound(sfxBack);
        pop.classList.add('hidden');
        return;
      }
      playSound(sfxBack);
      toggleJbFullscreen();
      return;
    }
    if (jbFocus === 'LIST') {
      if (jbView === 'SUBLIST' && jbNavIndex === 1) { jbView = 'ARTIST_ALBUMS'; jbListIndex = 0; playSound(sfxBack); renderJbList(); }
      else if (jbView === 'SUBLIST_ALBUM') { jbView = 'ARTIST_ALBUMS'; jbListIndex = 0; playSound(sfxBack); renderJbList(); }
      else if (jbView !== 'ROOT') { jbView = 'ROOT'; jbListIndex = 0; playSound(sfxBack); renderJbList(); }
      else { jbFocus = 'SIDEBAR'; playSound(sfxNav); updateJbSidebar(); updateJbListSelection(); }
    } else {
      closeJukebox();
    }
  }
  else if (action === 'X_BUTTON') { playSound(sfxSelect); toggleJbFullscreen(); }
  else if (action === 'Y_BUTTON') {
    if (jbIsFullscreen) {
      playSound(sfxSelect);
      const pop = document.getElementById('jb-fs-controls-popup');
      if (pop) {
        if (pop.classList.contains('hidden')) pop.classList.remove('hidden');
        else pop.classList.add('hidden');
      }
    } else {
      playSound(sfxSelect); openOSK('JB_SEARCH', t('osk.jb_search'), jbSearchQuery);
    }
  }
  else if (jbFocus === 'SIDEBAR') {
    if (action === 'UP') { jbNavIndex = Math.max(0, jbNavIndex - 1); jbSearchQuery = ""; playSound(sfxNav); updateJbSidebar(); renderJbList(); }
    else if (action === 'DOWN') { jbNavIndex = Math.min(3, jbNavIndex + 1); jbSearchQuery = ""; playSound(sfxNav); updateJbSidebar(); renderJbList(); }
    else if (action === 'RIGHT' || action === 'ACCEPT') { if (jbListItems.length > 0) { jbFocus = 'LIST'; jbListIndex = 0; playSound(sfxSelect); updateJbSidebar(); updateJbListSelection(); } }
  } else if (jbFocus === 'LIST') {
    if (action === 'UP') { jbListIndex = Math.max(0, jbListIndex - 1); playSound(sfxNav); updateJbListSelection(); }
    else if (action === 'DOWN') { jbListIndex = Math.min(jbListItems.length - 1, jbListIndex + 1); playSound(sfxNav); updateJbListSelection(); }
    else if (action === 'L1') { jbListIndex = Math.max(0, jbListIndex - 10); playSound(sfxNav); updateJbListSelection(); }
    else if (action === 'R1') { jbListIndex = Math.min(jbListItems.length - 1, jbListIndex + 10); playSound(sfxNav); updateJbListSelection(); }
    else if (action === 'LEFT') {
      if (jbView !== 'ROOT') {
        if (jbView === 'SUBLIST' && jbNavIndex === 1) { jbView = 'ARTIST_ALBUMS'; jbListIndex = 0; playSound(sfxBack); renderJbList(); }
        else if (jbView === 'SUBLIST_ALBUM') { jbView = 'ARTIST_ALBUMS'; jbListIndex = 0; playSound(sfxBack); renderJbList(); }
        else { jbView = 'ROOT'; jbListIndex = 0; playSound(sfxBack); renderJbList(); }
      } else {
        jbFocus = 'SIDEBAR'; playSound(sfxNav); updateJbSidebar(); updateJbListSelection();
      }
    }
    else if (action === 'ACCEPT') { playSound(sfxSelect); handleJbListAccept(); }
    else if (action === 'SELECT_BTN') { playSound(sfxSelect); handleJbSelectBtn(); }
  }
}

// ══════════════════════════════════════════════════════════════════════════
// GALLERY VIEW
// ══════════════════════════════════════════════════════════════════════════

function getGalleryStoreLogo(store) {
  if (!store) return null;
  const s = store.toLowerCase();
  if (s.includes('steam'))    return 'assets/logos/steam.png';
  if (s.includes('gog'))      return 'assets/logos/gog.png';
  if (s.includes('epic'))     return 'assets/logos/epic.png';
  if (s.includes('flatpak'))  return 'assets/logos/flatpak.png';
  if (s.includes('itch'))    return 'assets/logos/itch.png';
  if (s.includes('pico'))    return 'assets/logos/pico8.png';
  if (s.includes('physical')) return 'assets/logos/physical.png';
  if (s.includes('emulat'))   return 'assets/logos/emulation.png';
  if (s.includes('app'))      return 'assets/logos/apps.png';
  if (s.includes('other'))    return 'assets/logos/others.png';
  return null;
}

function matchCatForGallery(g, catName) {
  const store = g.Store ? String(g.Store).toLowerCase() : '';
  if (isPlaylistCat(catName)) return playlistCatMatch(g, catName);
  if (catName === "ALL GAMES") return true;
  if (catName === "STEAM") return store.includes("steam");
  if (catName === "GOG") return store.includes("gog");
  if (catName === "EPIC") return store.includes("epic");
  if (catName === "FLATPAK") return store.includes("flatpak");
  if (catName === "ITCH") return store.includes("itch");
  if (catName === "PICO-8") return store.includes("pico");
  if (catName === "PHYSICAL") return store.includes("physical");
  if (catName === "EMULATION") return store.includes("emulation");
  if (catName === "APPS") return store.includes("apps");
  if (catName === "OTHERS") return store.includes("others");
  if (catName === "INSTALLED") { const isManual = !g.GrinderGameId && (store.includes("others") || store.includes("emulation") || store.includes("physical") || store.includes("apps")); return isManual ? !!g.LaunchCommand : g.Installed == 1; }
  if (catName === "FAVS") return g.FAV === 'YES';
  if (catName === "WANT TO PLAY") return g.WANT_TO_PLAY === 'YES';
  if (catName === "BACKLOG") return isBacklog(g);
  if (catName === "PLAYED") return isPlayed(g);
  return true;
}

function applyGalleryFilter() {
  const catName = categories[galleryCatIndex];
  const q = galleryQuery.toLowerCase();
  const base = allGames.filter(g => {
    if (!matchCatForGallery(g, catName)) return false;
    if (pico8HiddenFor(g, catName)) return false;
    if (q) {
      const title = String(g.Game || '').toLowerCase();
      const dev   = String(g.DEV || '').toLowerCase();
      const genre = String(g.GENRE || '').toLowerCase();
      const pub   = String(g.PUBLISHER || '').toLowerCase();
      const series= String(g.Franchise || '').toLowerCase();
      let desc = String(g.Description || '').toLowerCase();
      if (g.Description_i18n) { try { const d = JSON.parse(g.Description_i18n); desc = String(d[currentLang] || d['en'] || desc).toLowerCase(); } catch(e) {} }
      if (!title.includes(q) && !dev.includes(q) && !genre.includes(q) && !pub.includes(q) && !series.includes(q) && !desc.includes(q)) return false;
    }
    return true;
  });

  let recentGames = [];
  let regularGames = base.slice().sort((a, b) => String(a.Game).localeCompare(String(b.Game)));

  if (recentGamesCount > 0) {
    const played = base.filter(g => g.LastPlayed && g.LastPlayed > 0).sort((a, b) => b.LastPlayed - a.LastPlayed);
    recentGames = played.slice(0, recentGamesCount);
    const recentIds = new Set(recentGames.map(g => g.id));
    regularGames = base.filter(g => !recentIds.has(g.id)).sort((a, b) => String(a.Game).localeCompare(String(b.Game)));
  }

  galleryNumRecent = recentGames.length;
  galleryGames = [...recentGames, ...regularGames];
  if (galleryIndex >= galleryGames.length) galleryIndex = Math.max(0, galleryGames.length - 1);
}

function transitionToGallery() {
  gameState = 'GALLERY';
  galleryCatIndex = currentCategoryIndex;
  galleryQuery = '';
  ['start-screen','main-screen','jukebox-screen','gallery-screen','ggp-screen'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList[id === 'gallery-screen' ? 'remove' : 'add']('hidden');
  });
  applyGalleryFilter();
  galleryIndex = 0;
  renderGalleryGrid();
  renderFooters();
  resetIdleTimer();
}

function renderGalleryGrid() {
  const grid = document.getElementById('gallery-grid');
  if (!grid) return;
  grid.innerHTML = '';

  const catName = categories[galleryCatIndex];
  const safe = catName.toLowerCase().replace(/ /g, '_');
  const catIcon = document.getElementById('gallery-cat-icon');
  if (catIcon) { catIcon.style.webkitMaskImage = `url('${logoPath(catName)}')`; }
  document.getElementById('gallery-cat-name').innerText = tCat(catName);
  const searchTag = document.getElementById('gallery-search-tag');
  if (galleryQuery) { searchTag.style.display = 'block'; searchTag.innerText = `"${galleryQuery}"`; }
  else { searchTag.style.display = 'none'; }
  document.getElementById('gallery-count').innerText = `${galleryGames.length} ${t('history.games')}`;

  // Section header: recent games
  if (galleryNumRecent > 0) {
    const hdrRecent = document.createElement('div');
    hdrRecent.className = 'gallery-section-header recent';
    hdrRecent.innerText = t('game.recent_games');
    grid.appendChild(hdrRecent);
  }

  galleryGames.forEach((game, i) => {
    // Section header: all games (inserted between recent and regular)
    if (galleryNumRecent > 0 && i === galleryNumRecent) {
      const hdrAll = document.createElement('div');
      hdrAll.className = 'gallery-section-header all';
      hdrAll.innerText = tCat('ALL GAMES');
      grid.appendChild(hdrAll);
    } else if (galleryNumRecent === 0 && i === 0) {
      const hdrAll = document.createElement('div');
      hdrAll.className = 'gallery-section-header all';
      hdrAll.innerText = tCat('ALL GAMES');
      grid.appendChild(hdrAll);
    }

    const cell = document.createElement('div');
    cell.className = 'gcell' + (i === galleryIndex ? ' selected' : '');
    cell.id = `gcell-${i}`;
    const imgSrc = game.CoverArt ? convertSafePath(game.CoverArt) : '';
    const isInstalled = game.Installed == null || game.Installed == 1;
    let actionBtn = '';
    if (game.LaunchCommand && String(game.LaunchCommand).trim()) {
      actionBtn = isInstalled
        ? `<button class="gcell-play-btn gcell-installed-btn">▶ ${t('status.installed')}</button>`
        : `<button class="gcell-play-btn gcell-install-btn">⬇ ${t('status.install')}</button>`;
    }
    const _gcellBadges = (game.Store ? String(game.Store).split(',') : []).map(s => s.trim()).filter(Boolean).map(s => { const l = getGalleryStoreLogo(s); return l ? `<div class="gcell-store-badge" style="-webkit-mask-image:url('${l}');"></div>` : ''; }).join('');
    const storeBadgeGroup = _gcellBadges ? `<div style="display:flex;gap:3px;flex-shrink:0;">${_gcellBadges}</div>` : '';
    const coverArea = imgSrc
      ? `<div class="gcell-cover-area"><img src="${imgSrc}" alt="" loading="lazy" decoding="async"></div>`
      : `<div class="gcell-cover-area"><div class="gcell-noart">${game.Game}</div></div>`;
    if (!actionBtn && isManualCategory(game)) {
      actionBtn = `<button class="gcell-play-btn gcell-install-btn">⬇ ${t('status.install')}</button>`;
    }
    const footerRow = (actionBtn || storeBadgeGroup) ? `<div class="gcell-footer-row">${actionBtn}${storeBadgeGroup}</div>` : '';
    cell.innerHTML = `${coverArea}<div class="gcell-footer"><div class="gcell-title">${game.Game}</div>${footerRow}</div>`;
    cell.addEventListener('click', () => { galleryIndex = i; playSound(sfxSelect); openGalleryGamepage(galleryGames[i]); });
    grid.appendChild(cell);
  });

  updateGallerySelection(false);
}

function updateGallerySelection(animate = true) {
  document.querySelectorAll('.gcell').forEach((el, i) => el.classList.toggle('selected', i === galleryIndex));
  const scroller = document.getElementById('gallery-scroll');
  const inRecentSection = galleryNumRecent > 0 && galleryIndex < galleryNumRecent;
  const atVeryTopNoRecent = galleryNumRecent === 0 && galleryIndex === 0;

  if (scroller) {
    if (inRecentSection || atVeryTopNoRecent) {
      // Navigated to the recent section or top — scroll smoothly to reveal section header
      if (animate) scroller.scrollTo({ top: 0, behavior: 'smooth' });
      else scroller.scrollTop = 0;
    } else {
      const sel = document.getElementById(`gcell-${galleryIndex}`);
      if (sel) {
        // Keep selected cell vertically centered in the scroll container.
        // sel.offsetTop is relative to gallery-scroll (the nearest position:relative ancestor),
        // so we can compute the target directly without getBoundingClientRect.
        const targetTop = Math.max(0, sel.offsetTop - scroller.clientHeight / 2 + sel.offsetHeight / 2);
        if (animate) scroller.scrollTo({ top: targetTop, behavior: 'smooth' });
        else scroller.scrollTop = targetTop;
      }
    }
  }

  const game = galleryGames[galleryIndex];
  if (game) {
    updateGalleryBg(game);
  } else {
    // Empty category — clear every hero element so no stale image lingers
    const heroImg = document.getElementById('gallery-hero-img');
    if (heroImg) { heroImg.src = ''; heroImg.style.display = 'none'; }
    const heroLogo = document.getElementById('gallery-hero-logo');
    if (heroLogo) { heroLogo.src = ''; heroLogo.style.display = 'none'; }
    const heroName = document.getElementById('gallery-hero-game-name');
    if (heroName) heroName.innerText = '';
  }
}

function updateGalleryBg(game) {
  const src = game.HeroArt ? convertSafePath(game.HeroArt)
    : game.Screenshot ? convertSafePath(String(game.Screenshot).split('|')[0])
    : game.CoverArt ? convertSafePath(game.CoverArt) : '';

  const heroImg = document.getElementById('gallery-hero-img');
  if (heroImg) { heroImg.src = src; heroImg.style.display = src ? 'block' : 'none'; }

  const heroName = document.getElementById('gallery-hero-game-name');
  if (heroName) heroName.innerText = game.Game;

  const heroLogo = document.getElementById('gallery-hero-logo');
  if (heroLogo) {
    const logoSrc = game.Logo ? convertSafePath(game.Logo) : '';
    if (logoSrc) {
      heroLogo.src = logoSrc;
      heroLogo.style.display = '';
    } else {
      heroLogo.src = '';
      heroLogo.style.display = 'none';
    }
  }
}

function navigateGallery(dir) {
  const N = galleryGames.length;
  if (N === 0) return;
  const COLS = 9;
  const nr = galleryNumRecent;
  let idx = galleryIndex;

  if (dir === 'RIGHT') idx = (idx + 1) % N;
  else if (dir === 'LEFT') idx = (idx - 1 + N) % N;
  else if (dir === 'DOWN') {
    if (nr > 0 && idx < nr) {
      // Recent row → same visual column in first regular row
      const target = nr + idx;
      if (target < N) idx = target;
    } else {
      const next = idx + COLS;
      if (next < N) idx = next;
    }
  }
  else if (dir === 'UP') {
    if (idx < nr) {
      // Already in recent row, nowhere to go up
    } else if (nr > 0 && idx < nr + COLS) {
      // First regular row → same visual column in recent row (if a game exists there)
      const col = idx - nr; // 0-based column within this row
      if (col < nr) idx = col;
    } else {
      // Regular row 2+ (or no recent section): go up one row
      const prev = idx - COLS;
      if (prev >= 0) idx = prev;
    }
  }

  if (idx !== galleryIndex) { galleryIndex = idx; playSound(sfxNav); updateGallerySelection(); }
}

// ══════════════════════════════════════════════════════════════════════════
// GOG ACHIEVEMENTS (CREMA)
// ══════════════════════════════════════════════════════════════════════════

let _cAchAll  = [];
let _cAchFilter = 'all';
let _cAchStores = {};        // storeLabel → achievements[]
let _cAchCurrentLabel = null; // which store is open in the overlay

function _cRelDate(iso) {
  if (!iso) return '';
  try {
    const days = Math.floor((Date.now() - new Date(iso)) / 86400000);
    if (days === 0) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 7)  return `${days}d ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    return new Date(iso).toLocaleDateString();
  } catch { return iso; }
}

function _cGogAppId(game) {
  const m = (game.LaunchCommand || '').match(/grinder:\/\/launch\/gog\/(\d+)/i);
  return m ? m[1] : null;
}

async function loadCremaAchievements(game) {
  const container = document.getElementById('ggp-ach-container');
  container.innerHTML = '';
  _cAchAll = [];
  _cAchStores = {};
  _cAchCurrentLabel = null;

  const gogId    = _cGogAppId(game);
  const steamRaw = game.SteamAppID ? String(game.SteamAppID).replace(/\.0+$/, '') : null;

  const tasks = [];
  if (gogId)    tasks.push({ label: 'GOG',   fetch: async () => { let r = await window.api.getGameAchievements(gogId); if (!r.ok || !r.achievements.length) r = await window.api.fetchAchievementsNow(gogId); return r; } });
  if (steamRaw) tasks.push({ label: 'STEAM', fetch: async () => { const k = `steam_${steamRaw}`; let r = await window.api.getGameAchievements(k); if (!r.ok || !r.achievements.length) r = await window.api.fetchSteamAchievements(steamRaw); return r; } });
  if (!tasks.length) return;

  const results = await Promise.all(tasks.map(t => t.fetch()));
  const multi = results.filter(r => r.ok && r.achievements.length).length > 1;

  for (let i = 0; i < tasks.length; i++) {
    const res = results[i];
    if (!res.ok || !res.achievements.length) continue;
    const label = tasks[i].label;
    _cAchStores[label] = res.achievements;
    if (!_cAchAll.length) { _cAchAll = res.achievements; _cAchCurrentLabel = label; }
    _cRenderAchBox(container, label, res.achievements, multi);
  }
}

function _cRenderAchBox(container, label, achievements, showLabel) {
  const total    = achievements.length;
  const unlocked = achievements.filter(a => a.date_unlocked).length;
  const pct      = total ? Math.round(unlocked / total * 100) : 0;

  const box = document.createElement('div');
  box.className = 'stat-box';
  box.style.cssText = 'cursor:pointer; flex-direction:column; align-items:center; gap:8px; padding:14px 10px;';
  box.onclick = () => { _cAchCurrentLabel = label; _cAchAll = _cAchStores[label]; openCremaAchievementsOverlay(); };

  box.innerHTML = `
    <div style="position:relative; width:60px; height:60px; flex-shrink:0;">
      <svg viewBox="0 0 36 36" width="60" height="60" style="transform:rotate(-90deg);">
        <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="3"/>
        <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--accent)" stroke-width="3" stroke-linecap="round"
          stroke-dasharray="${pct} 100" style="transition:stroke-dasharray 0.6s ease;"/>
      </svg>
      <div style="position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center;">
        <span style="font-size:11px; font-weight:900; color:var(--text_main); line-height:1;">${pct}%</span>
      </div>
    </div>
    <div style="font-size:10px; font-weight:900; letter-spacing:2px; color:var(--text_dim); text-transform:uppercase; text-align:center;">
      Achievements${showLabel ? `<br><span style="font-size:9px; letter-spacing:1px; opacity:0.7;">${label}</span>` : ''}
    </div>
    <div style="font-size:13px; font-weight:900; color:var(--accent);">${unlocked} / ${total}</div>
    <div style="font-size:10px; color:var(--text_dim);">Press to view all</div>`;

  container.appendChild(box);
}

function openCremaAchievementsOverlay() {
  if (!_cAchAll.length) return;
  previousGameState = gameState;
  gameState = 'ACH_OVERLAY';
  setBlur(true);

  const overlay = document.getElementById('ach-overlay');
  const game    = galleryCurrentGame;
  const isMulti = Object.keys(_cAchStores).length > 1;
  document.getElementById('crema-ach-game-title').textContent =
    isMulti ? `${game?.Game || ''} — ${_cAchCurrentLabel}` : (game?.Game || '');
  _cAchUpdateHint();

  const total    = _cAchAll.length;
  const unlocked = _cAchAll.filter(a => a.date_unlocked).length;
  const pct      = total ? Math.round(unlocked / total * 100) : 0;
  document.getElementById('crema-ach-ring-big').setAttribute('stroke-dasharray', `${pct} 100`);
  document.getElementById('crema-ach-ring-pct').textContent   = `${pct}%`;
  document.getElementById('crema-ach-ring-count').textContent = `${unlocked}/${total}`;

  _cAchFilter = 'all';
  document.querySelectorAll('.crema-ach-tab').forEach(b => b.classList.toggle('active', b.dataset.f === 'all'));
  _cRenderGrid();
  overlay.classList.remove('hidden');
}
window.openCremaAchievementsOverlay = openCremaAchievementsOverlay;

function cAchSetFilter(f, btn) {
  _cAchFilter = f;
  document.querySelectorAll('.crema-ach-tab').forEach(b => b.classList.toggle('active', b.dataset.f === f));
  _cRenderGrid();
}
window.cAchSetFilter = cAchSetFilter;

function closeCremaAchievementsOverlay() {
  document.getElementById('ach-overlay').classList.add('hidden');
  gameState = previousGameState;
  setBlur(false);
}
window.closeCremaAchievementsOverlay = closeCremaAchievementsOverlay;

function _cAchUpdateHint() {
  const hintEl = document.getElementById('ach-nav-hint');
  if (!hintEl) return;
  const isMulti = Object.keys(_cAchStores).length > 1;
  if (usingKeyboard) {
    const k = getKey;
    const storeHint = isMulti ? ` &nbsp;&nbsp; ${k(',')}${k('.')} Store` : '';
    hintEl.innerHTML = `&#x25B2;&#x25BC; Scroll &nbsp;&nbsp; ${k('PgUp')}${k('PgDn')} Filter${storeHint}`;
  } else {
    const storeHint = isMulti ? ` &nbsp;&nbsp; ${getBtn('L2')}${getBtn('R2')} Store` : '';
    hintEl.innerHTML = `&#x25B2;&#x25BC; Scroll &nbsp;&nbsp; ${getBtn('L1')}${getBtn('R1')} Filter${storeHint}`;
  }
}

function cAchSwitchStore(dir) {
  const storeLabels = Object.keys(_cAchStores);
  if (storeLabels.length < 2) return;
  const idx = storeLabels.indexOf(_cAchCurrentLabel);
  _cAchCurrentLabel = storeLabels[(idx + dir + storeLabels.length) % storeLabels.length];
  _cAchAll = _cAchStores[_cAchCurrentLabel];
  const game = galleryCurrentGame;
  document.getElementById('crema-ach-game-title').textContent = `${game?.Game || ''} — ${_cAchCurrentLabel}`;
  const total    = _cAchAll.length;
  const unlocked = _cAchAll.filter(a => a.date_unlocked).length;
  const pct      = total ? Math.round(unlocked / total * 100) : 0;
  document.getElementById('crema-ach-ring-big').setAttribute('stroke-dasharray', `${pct} 100`);
  document.getElementById('crema-ach-ring-pct').textContent   = `${pct}%`;
  document.getElementById('crema-ach-ring-count').textContent = `${unlocked}/${total}`;
  _cAchFilter = 'all';
  document.querySelectorAll('.crema-ach-tab').forEach(b => b.classList.toggle('active', b.dataset.f === 'all'));
  _cRenderGrid();
}

function _cRenderGrid() {
  const grid  = document.getElementById('crema-ach-grid');
  const empty = document.getElementById('crema-ach-empty');
  grid.innerHTML = '';

  const list = _cAchAll.filter(a =>
      _cAchFilter === 'all'      ? true
    : _cAchFilter === 'unlocked' ? !!a.date_unlocked
    :                              !a.date_unlocked
  );

  if (!list.length) { grid.style.display = 'none'; empty.style.display = 'flex'; return; }
  grid.style.display = 'grid'; empty.style.display = 'none';

  for (const a of list) {
    const unlocked = !!a.date_unlocked;
    const card = document.createElement('div');
    card.className = 'crema-ach-card' + (unlocked ? ' unlocked' : '');

    const iconUrl = unlocked ? a.image_unlocked : a.image_locked;
    if (iconUrl) {
      const img = document.createElement('img');
      img.src = iconUrl;
      if (!unlocked) img.style.cssText = 'filter:grayscale(1) opacity(0.35);';
      img.onerror = () => img.replaceWith(Object.assign(document.createElement('div'), { style: 'width:64px;height:64px;border-radius:8px;background:rgba(255,255,255,0.05);flex-shrink:0;' }));
      card.appendChild(img);
    } else {
      const ph = document.createElement('div');
      ph.style.cssText = `width:64px; height:64px; border-radius:8px; background:rgba(255,255,255,0.05); flex-shrink:0; ${unlocked ? '' : 'opacity:0.35;'}`;
      card.appendChild(ph);
    }

    const info = document.createElement('div');
    info.style.cssText = 'flex:1; min-width:0;';

    const name = document.createElement('div');
    name.className = 'c-name';
    name.textContent = a.name || a.key;
    info.appendChild(name);

    if (a.description) {
      const desc = document.createElement('div');
      desc.className = 'c-desc';
      desc.textContent = a.description;
      info.appendChild(desc);
    }

    if (unlocked) {
      const date = document.createElement('div');
      date.className = 'c-date';
      date.textContent = `✓ ${_cRelDate(a.date_unlocked)}`;
      info.appendChild(date);
    } else {
      const lock = document.createElement('div');
      lock.className = 'c-lock';
      lock.textContent = '🔒';
      info.appendChild(lock);
    }
    card.appendChild(info);
    grid.appendChild(card);
  }
}

document.getElementById('ach-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('ach-overlay')) closeCremaAchievementsOverlay();
});

function cAchCycleFilter(dir) {
  const tabs = ['all', 'unlocked', 'locked'];
  const next = tabs[(tabs.indexOf(_cAchFilter) + dir + tabs.length) % tabs.length];
  cAchSetFilter(next, null);
}

// ══════════════════════════════════════════════════════════════════════════
// GALLERY GAMEPAGE
// ══════════════════════════════════════════════════════════════════════════

function openGalleryGamepage(game) {
  gameState = 'GALLERY_GAMEPAGE';
  galleryCurrentGame = game;
  galleryMediaMode = 'cover';
  ggpFocus = 'BUTTONS';
  ggpSlideshowOpen = false;
  ggpButtonIndex = 0;
  filteredGames = galleryGames;

  document.getElementById('gallery-screen').classList.add('hidden');
  document.getElementById('ggp-screen').classList.remove('hidden');

  const scroller = document.getElementById('ggp-scroll');
  if (scroller) scroller.scrollTop = 0;

  clearGalleryMedia();
  updateGalleryGamepageContent(game);
  renderFooters();
}

function closeGalleryGamepage() {
  ggpSlideshowOpen = false;
  clearGalleryMedia();
  // Re-render the grid so changes made on the gamepage (install→play, fav/want/played,
  // playlist membership) are reflected immediately — keep the user on the same game.
  const keepId = galleryCurrentGame ? galleryCurrentGame.id : null;
  applyGalleryFilter();
  if (keepId != null) {
    const i = galleryGames.findIndex(g => g.id === keepId);
    if (i >= 0) { galleryIndex = i; galleryCurrentGame = galleryGames[i]; currentGameIndex = i; }
  }
  renderGalleryGrid();
  document.getElementById('ggp-screen').classList.add('hidden');
  document.getElementById('gallery-screen').classList.remove('hidden');
  gameState = 'GALLERY';
  renderFooters();
}

function galleryGamepageNavigate(delta) {
  const N = galleryGames.length;
  if (N === 0) return;
  galleryIndex = (galleryIndex + delta + N) % N;
  galleryCurrentGame = galleryGames[galleryIndex];
  currentGameIndex = galleryIndex;
  galleryMediaMode = 'cover';
  clearGalleryMedia();
  playSound(sfxNav);
  updateGalleryGamepageContent(galleryCurrentGame);
}

function updateGalleryGamepageContent(game) {
  // Hero image — natural proportions, no Ken Burns
  const heroSrc = game.HeroArt ? convertSafePath(game.HeroArt)
    : game.Screenshot ? convertSafePath(String(game.Screenshot).split('|')[0])
    : game.CoverArt ? convertSafePath(game.CoverArt) : '';
  const heroImg = document.getElementById('ggp-hero-img');
  if (heroImg) { heroImg.src = heroSrc; heroImg.style.display = heroSrc ? 'block' : 'none'; }

  // Hero placeholder when no art at all
  const heroPh = document.getElementById('ggp-hero-placeholder');
  const heroPhName = document.getElementById('ggp-hero-ph-name');
  if (heroPh) heroPh.style.display = heroSrc ? 'none' : 'flex';
  if (heroPhName) heroPhName.innerText = game.Game || '';

  // Logo or title text
  const logoEl = document.getElementById('ggp-logo-img');
  const logoSrc = game.Logo ? convertSafePath(game.Logo) : '';
  if (logoEl) { logoEl.src = logoSrc; logoEl.style.display = logoSrc ? 'block' : 'none'; }

  // Store badges (one per store, overlaid on bottom-right of cover art)
  const storeBadgesEl = document.getElementById('ggp-store-badges');
  if (storeBadgesEl) {
    storeBadgesEl.innerHTML = '';
    if (game.Store) {
      String(game.Store).split(',').map(s => s.trim()).filter(Boolean).forEach(s => {
        const logo = getGalleryStoreLogo(s);
        if (!logo) return;
        const badge = document.createElement('div');
        badge.className = 'ggp-store-badge-icon';
        badge.style.webkitMaskImage = `url('${convertSafePath(logo)}')`;
        storeBadgesEl.appendChild(badge);
      });
    }
  }
  const oldBadge = document.getElementById('ggp-store-badge');
  if (oldBadge) oldBadge.style.display = 'none';

  // Cover art
  const coverEl = document.getElementById('ggp-media-img');
  const coverSrc = game.CoverArt ? convertSafePath(game.CoverArt) : '';
  if (coverEl) { coverEl.src = coverSrc; coverEl.style.display = coverSrc ? 'block' : 'none'; }
  const coverPh = document.getElementById('ggp-cover-placeholder');
  if (coverPh) coverPh.style.display = coverSrc ? 'none' : 'flex';

  // Action buttons
  ggpTrailerAvailable = false;
  const trailerBtn = document.getElementById('ggp-btn-trailer');
  trailerBtn.style.display = 'none';
  window.api.checkLocalTrailer(game.Game).then(url => {
    if (url && galleryCurrentGame && galleryCurrentGame.Game === game.Game) {
      ggpTrailerAvailable = true;
      trailerBtn.style.display = 'block';
      trailerBtn.dataset.url = url;
      ggpBuildButtonList();
      ggpUpdateButtonFocus();
    }
  });

  const playBtn = document.getElementById('ggp-btn-play');
  const hasCmd = game.LaunchCommand && String(game.LaunchCommand).trim();
  const isGameInstalled = game.Installed == null || game.Installed == 1;
  if (hasCmd) {
    playBtn.style.display = 'block';
    if (isGameInstalled) {
      playBtn.innerText = t('html.btn_play');
      playBtn.dataset.installMode = '';
      playBtn.classList.remove('install-mode');
    } else {
      playBtn.innerText = `⬇ ${t('status.install')}`;
      playBtn.dataset.installMode = '1';
      playBtn.classList.add('install-mode');
    }
  } else if (isManualCategory(game)) {
    playBtn.style.display = 'block';
    playBtn.innerText = `⬇ ${t('status.install')}`;
    playBtn.dataset.installMode = 'add_cmd';
    playBtn.classList.add('install-mode');
  } else {
    playBtn.style.display = 'none';
    playBtn.dataset.installMode = '';
    playBtn.classList.remove('install-mode');
  }

  updateGalleryGamepageBadges(game);
  ggpBuildButtonList();
  ggpUpdateButtonFocus();

  // Stats — vertical list
  const statsEl = document.getElementById('ggp-stats-row');
  if (statsEl) {
    const stats = [
      { label: t('html.stat_released'),   val: game.RELEASED },
      { label: t('html.stat_developer'),  val: game.DEV },
      { label: t('html.stat_publisher'),  val: game.PUBLISHER },
      { label: t('html.stat_genre'),      val: game.GENRE ? String(game.GENRE).split(',')[0].trim() : '' },
      { label: t('html.stat_hltb'),       val: game.HLTB_Main },
      { label: t('html.stat_metacritic'), val: game.METACRITIC },
      { label: t('html.stat_proton'),     val: game.ProtonTier },
    ].filter(s => s.val && String(s.val).trim() && String(s.val).trim() !== '--');
    statsEl.innerHTML = stats.map(s =>
      `<div class="ggp-stat"><div class="ggp-stat-label">${s.label}</div><div class="ggp-stat-val">${s.val}</div></div>`
    ).join('');
  }

  // Short description (localized, bold, accent)
  const localDesc = getLocalizedDescription(game);
  const shortEl = document.getElementById('ggp-short-desc');
  if (shortEl) {
    if (localDesc && localDesc.trim()) { shortEl.innerText = localDesc; shortEl.style.display = 'block'; }
    else shortEl.style.display = 'none';
  }

  // Full Steam HTML description or fallback
  const fullEl = document.getElementById('ggp-full-desc');
  const fallbackEl = document.getElementById('ggp-fallback-desc');
  if (game.SteamDesc && game.SteamDesc.trim()) {
    fullEl.innerHTML = game.SteamDesc; fullEl.style.display = 'block';
    fallbackEl.style.display = 'none';
  } else {
    fullEl.style.display = 'none';
    const noDesc = !localDesc || !localDesc.trim();
    fallbackEl.innerText = noDesc
      ? (heroSrc ? t('empty.no_desc') : 'This game has no artwork or metadata scraped yet.\n\nPress SELECT → SCRAPING ENGINE to download images and information automatically. Or use Cafe Neurotico Game Manager (the desktop app) to have more detailed, in-depth editing tools.')
      : '';
    fallbackEl.style.display = noDesc ? 'block' : 'none';
  }

  // Series + Similar in stats panel extra area
  const extraEl = document.getElementById('ggp-extra');
  if (extraEl) {
    let extraHtml = '';
    if (game.Franchise && game.Franchise.trim() && game.Franchise !== '--') {
      extraHtml += `<div><span style="color:var(--accent);font-size:10px;font-weight:900;letter-spacing:1.5px;text-transform:uppercase;">${t('html.stat_series')}</span><br>${game.Franchise}</div>`;
    }
    if (game.SimilarGames && game.SimilarGames.trim() && game.SimilarGames !== '--') {
      const names = game.SimilarGames.split(',').map(n => n.trim()).filter(Boolean);
      const links = names.map(name => {
        const match = allGames.find(g => g.Game.toLowerCase() === name.toLowerCase());
        return match ? `<span class="similar-link" data-id="${match.id}">${name}</span>` : `<span>${name}</span>`;
      }).join(', ');
      extraHtml += `<div style="margin-top:6px;"><span style="color:var(--accent);font-size:10px;font-weight:900;letter-spacing:1.5px;text-transform:uppercase;">${t('html.stat_similar')}</span><br>${links}</div>`;
    }
    extraEl.innerHTML = extraHtml;
    extraEl.style.display = extraHtml ? 'block' : 'none';
    extraEl.querySelectorAll('.similar-link').forEach(el => {
      el.addEventListener('click', () => {
        const g = allGames.find(g => g.id === parseInt(el.dataset.id));
        if (g) { const idx = galleryGames.findIndex(gg => gg.id === g.id); if (idx >= 0) { galleryIndex = idx; openGalleryGamepage(galleryGames[idx]); } else openGalleryGamepage(g); }
      });
    });
  }

  loadCremaAchievements(game);

  // Screenshots banner — Ken Burns cycling like CNGM
  galleryScreenshots = game.Screenshot ? String(game.Screenshot).split('|').filter(s => s.trim()) : [];
  galleryScreenIndex = 0;
  const ssBanner = document.getElementById('ggp-ss-banner');
  const ssKbImg = document.getElementById('ggp-ss-kb-img');
  clearInterval(ggpSsBannerInterval); ggpSsBannerInterval = null;

  if (galleryScreenshots.length > 0 && ssBanner && ssKbImg) {
    ssBanner.style.display = 'block';
    let kbIdx = 0;
    const showNext = () => {
      ssKbImg.style.opacity = '0';
      setTimeout(() => { ssKbImg.src = convertSafePath(galleryScreenshots[kbIdx]); ssKbImg.style.opacity = '1'; kbIdx = (kbIdx + 1) % galleryScreenshots.length; }, 500);
    };
    showNext();
    if (galleryScreenshots.length > 1) ggpSsBannerInterval = setInterval(showNext, 5000);
  } else if (ssBanner) {
    ssBanner.style.display = 'none';
  }
}

function updateGalleryGamepageBadges(game) {
  const favBtn = document.getElementById('ggp-btn-fav');
  const wantBtn = document.getElementById('ggp-btn-want');
  if (favBtn) {
    const on = game.FAV === 'YES';
    favBtn.innerText = on ? '★ FAV' : '+ FAV';
    favBtn.classList.toggle('ggp-active', on);
  }
  if (wantBtn) {
    const on = game.WANT_TO_PLAY === 'YES';
    wantBtn.innerText = on ? '⚑ WANT ✓' : '⚑ WANT TO PLAY';
    wantBtn.classList.toggle('ggp-active', on);
  }
}

function clearGalleryMedia() {
  clearInterval(ggpSsBannerInterval); ggpSsBannerInterval = null;
  ggpSlideshowOpen = false;
  ggpTrailerMode = false;
  const slideshow = document.getElementById('ggp-slideshow');
  if (slideshow) slideshow.classList.add('hidden');
  const vid = document.getElementById('ggp-trailer-vid');
  if (vid) { vid.pause(); vid.src = ''; vid.style.display = 'none'; }
  const img = document.getElementById('ggp-ss-img');
  if (img) img.style.display = 'block';
  const ssKbImg = document.getElementById('ggp-ss-kb-img');
  if (ssKbImg) { ssKbImg.src = ''; ssKbImg.style.opacity = '0'; }
  galleryMediaMode = 'cover';
}

function ggpBuildButtonList() {
  const ids = ['ggp-btn-fav', 'ggp-btn-want'];
  if (document.getElementById('ggp-btn-trailer')?.style.display !== 'none') ids.push('ggp-btn-trailer');
  if (document.getElementById('ggp-btn-play')?.style.display !== 'none') ids.push('ggp-btn-play');
  ggpButtonIds = ids;
  if (ggpButtonIndex >= ggpButtonIds.length) ggpButtonIndex = 0;
}

function ggpUpdateButtonFocus() {
  ggpButtonIds.forEach((id, i) => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('ggp-focused', ggpFocus === 'BUTTONS' && i === ggpButtonIndex);
  });
  const ssBanner = document.getElementById('ggp-ss-banner');
  if (ssBanner) ssBanner.classList.toggle('ggp-focused', ggpFocus === 'SS_BANNER');
}

function ggpMoveButton(dir) {
  if (ggpButtonIds.length === 0) return;
  ggpButtonIndex = (ggpButtonIndex + dir + ggpButtonIds.length) % ggpButtonIds.length;
  playSound(sfxNav);
  ggpUpdateButtonFocus();
}

function ggpSetFocus(target) {
  ggpFocus = target;
  ggpUpdateButtonFocus();
  if (target === 'SS_BANNER') {
    const el = document.getElementById('ggp-ss-banner');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  playSound(sfxNav);
}

function ggpActivateButton() {
  const id = ggpButtonIds[ggpButtonIndex];
  if (!id || !galleryCurrentGame) return;
  playSound(sfxSelect);
  const game = galleryCurrentGame;
  if (id === 'ggp-btn-fav') {
    game.FAV = game.FAV === 'YES' ? 'NO' : 'YES';
    window.api.saveDbField({ game: game.Game, field: 'FAV', value: game.FAV });
    updateGalleryGamepageBadges(game);
  } else if (id === 'ggp-btn-want') {
    game.WANT_TO_PLAY = game.WANT_TO_PLAY === 'YES' ? 'NO' : 'YES';
    window.api.saveDbField({ game: game.Game, field: 'WANT_TO_PLAY', value: game.WANT_TO_PLAY });
    updateGalleryGamepageBadges(game);
  } else if (id === 'ggp-btn-trailer') {
    const url = document.getElementById('ggp-btn-trailer')?.dataset?.url;
    if (url) { ggpPlayTrailer(url); }
  } else if (id === 'ggp-btn-play') {
    const playBtnEl = document.getElementById('ggp-btn-play');
    if (playBtnEl?.dataset?.installMode === 'add_cmd') {
      previousGameState = 'GALLERY_GAMEPAGE';
      document.getElementById('overlay-backdrop').classList.add('hidden');
      openOSK('LAUNCH_CMD', t('osk.launch_command'), '');
    } else if (playBtnEl?.dataset?.installMode === '1') {
      const stL = (game.Store || '').toLowerCase();
      if (game.GrinderGameId && !stL.includes('gog') && !stL.includes('epic')) {
        window.api.openGrinderGui(game.Game);
      } else if (stL.includes('gog') || stL.includes('epic')) { showGrinderConfirm(game); }
    } else if (game.LaunchCommand) { tryLaunch(game); }
  }
}

function ggpOpenSlideshow() {
  if (galleryScreenshots.length === 0) return;
  ggpSlideshowOpen = true;
  ggpSlideshowScreens = galleryScreenshots;
  ggpSlideshowIndex = 0;
  playSound(sfxSelect);
  document.getElementById('ggp-slideshow').classList.remove('hidden');
  const hintEl = document.getElementById('ggp-ss-hint');
  if (hintEl) hintEl.innerText = usingKeyboard ? `← → Navigate   Esc Close` : `${t('footer.navigate')}   B ${t('footer.back')}`;
  ggpSlideshowRender();
}

function ggpSlideshowRender() {
  const img = document.getElementById('ggp-ss-img');
  const counter = document.getElementById('ggp-ss-counter');
  if (img) img.src = convertSafePath(ggpSlideshowScreens[ggpSlideshowIndex]);
  if (counter) counter.innerText = `${ggpSlideshowIndex + 1} / ${ggpSlideshowScreens.length}`;
}

function ggpSlideshowNav(dir) {
  ggpSlideshowIndex = (ggpSlideshowIndex + dir + ggpSlideshowScreens.length) % ggpSlideshowScreens.length;
  playSound(sfxNav);
  ggpSlideshowRender();
}

function ggpPlayTrailer(url) {
  ggpSlideshowOpen = true;
  ggpTrailerMode = true;
  playSound(sfxSelect);
  const slideshow = document.getElementById('ggp-slideshow');
  slideshow.classList.remove('hidden');
  const img = document.getElementById('ggp-ss-img');
  const vid = document.getElementById('ggp-trailer-vid');
  const counter = document.getElementById('ggp-ss-counter');
  const header = document.getElementById('ggp-trailer-header');
  const titleEl = document.getElementById('ggp-trailer-game-name');
  if (img) img.style.display = 'none';
  if (counter) counter.style.display = 'none';
  if (header) header.style.display = 'flex';
  if (titleEl && galleryCurrentGame) titleEl.innerText = galleryCurrentGame.Game;
  if (vid) { vid.src = url; vid.style.display = 'block'; vid.play().catch(e => {}); }
  fadeBGM(0);
  const hint = document.getElementById('ggp-ss-hint');
  if (hint) hint.innerHTML = usingKeyboard
    ? `${getKey('Esc')} / ${getKey('Enter')} &nbsp; ${t('footer.back')}`
    : `${getMappedBtn('EAST')} &nbsp; ${t('footer.back')}`;
}

function ggpCloseSlideshow() {
  ggpSlideshowOpen = false;
  playSound(sfxBack);
  const vid = document.getElementById('ggp-trailer-vid');
  if (vid) { vid.pause(); vid.src = ''; vid.style.display = 'none'; }
  if (ggpTrailerMode && audioCfg.bgm && audioCfg.bgm_mode !== 'OFF') {
    bgmAudio.play().catch(e => {});
    fadeBGM(audioCfg.vol);
  }
  const img = document.getElementById('ggp-ss-img');
  if (img) img.style.display = 'block';
  const counter = document.getElementById('ggp-ss-counter');
  if (counter) counter.style.display = 'block';
  const header = document.getElementById('ggp-trailer-header');
  if (header) header.style.display = 'none';
  ggpTrailerMode = false;
  document.getElementById('ggp-slideshow').classList.add('hidden');
}

// ══════════════════════════════════════════════════════════════════════════
// CREMA FLAT GAMEPAGE
// ══════════════════════════════════════════════════════════════════════════

let _cfgpGame   = null;
let _cfgpKbTimer = null;
let _cfgpKbIdx   = 0;
let _cfgpBtns    = [];
let _cfgpBtnIdx  = 0;

function _cfgpStartKenBurns(slides) {
  clearInterval(_cfgpKbTimer);
  document.querySelectorAll('#cfgp-bg .kb-slide').forEach(s => s.remove());
  if (!slides.length) return;
  const bg = document.getElementById('cfgp-bg');
  slides.forEach(src => {
    const d = document.createElement('div');
    d.className = 'kb-slide';
    d.style.backgroundImage = `url("${src}")`;
    bg.appendChild(d);
  });
  _cfgpKbIdx = 0;
  _cfgpActivateKbSlide(0);
  if (slides.length > 1) {
    _cfgpKbTimer = setInterval(() => {
      _cfgpKbIdx = (_cfgpKbIdx + 1) % slides.length;
      _cfgpActivateKbSlide(_cfgpKbIdx);
    }, 7000);
  }
}

function _cfgpActivateKbSlide(idx) {
  const slides = document.querySelectorAll('#cfgp-bg .kb-slide');
  slides.forEach((s, i) => {
    if (i === idx) requestAnimationFrame(() => s.classList.add('kb-active'));
    else s.classList.remove('kb-active');
  });
}

function _cfgpStopKenBurns() {
  clearInterval(_cfgpKbTimer);
  _cfgpKbTimer = null;
  document.querySelectorAll('#cfgp-bg .kb-slide').forEach(s => s.remove());
}

async function openCremaFlatGamepage(game) {
  _cfgpGame = game;
  gameState = 'CREMA_FGP';

  document.getElementById('ggp-screen').classList.add('hidden');
  document.getElementById('gallery-screen').classList.add('hidden');
  document.getElementById('cfgp-screen').classList.remove('hidden');

  // Store tag + title
  document.getElementById('cfgp-store-tag').textContent =
    (game.Store || '').split(',')[0].trim().toUpperCase();
  document.getElementById('cfgp-title').textContent = game.Game || '';

  // Meta pills
  const meta = document.getElementById('cfgp-meta');
  meta.innerHTML = '';
  const pills = [];
  if (game.GENRE)      pills.push({ t: game.GENRE });
  if (game.HLTB_Main)  pills.push({ t: (isFinite(+game.HLTB_Main) ? game.HLTB_Main + 'h' : game.HLTB_Main), accent: true });
  if (game.ProtonTier) pills.push({ t: game.ProtonTier });
  if (game.METACRITIC) pills.push({ t: 'Metacritic ' + game.METACRITIC, accent: true });
  if (game.RELEASED)   pills.push({ t: game.RELEASED });
  pills.forEach((p, i) => {
    if (i > 0) { const sep = document.createElement('div'); sep.className = 'cfgp-meta-sep'; meta.appendChild(sep); }
    const span = document.createElement('span');
    span.className = 'cfgp-meta-pill' + (p.accent ? ' accent' : '');
    span.textContent = p.t;
    meta.appendChild(span);
  });

  // Description
  const desc = getLocalizedDescription(game) || '';
  document.getElementById('cfgp-desc').textContent = desc;

  // Cover card + aura
  const coverSrc = game.CoverArt ? convertSafePath(game.CoverArt) : '';
  const coverWrap = document.getElementById('cfgp-cover-wrap');
  coverWrap.style.display = coverSrc ? '' : 'none';
  if (coverSrc) {
    document.getElementById('cfgp-cover-aura').src = coverSrc;
    document.getElementById('cfgp-cover-card').src = coverSrc;
  }

  // Ken Burns slideshow or trailer video
  const kbSlides = [];
  if (game.Screenshot) game.Screenshot.split('|').filter(s => s.trim()).forEach(s => kbSlides.push(convertSafePath(s)));
  if (game.HeroArt)    kbSlides.push(convertSafePath(game.HeroArt));
  if (!kbSlides.length && game.CoverArt) kbSlides.push(convertSafePath(game.CoverArt));

  const video      = document.getElementById('cfgp-video');
  const trailerBtn = document.getElementById('cfgp-btn-trailer');
  const localTrailer = await window.api.checkLocalTrailer(game.Game || '');

  if (localTrailer) {
    _cfgpStopKenBurns();
    video.src = localTrailer;
    video.muted = true;
    video.style.display = 'block';
    trailerBtn.innerHTML = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:5px;vertical-align:middle;"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>UNMUTE';
    trailerBtn.style.display = '';
  } else {
    video.pause(); video.src = ''; video.style.display = 'none';
    _cfgpStartKenBurns(kbSlides);
    trailerBtn.style.display = 'none';
  }

  // Fav / Want buttons
  _cfgpUpdateBadges(game);

  // Play button
  const playBtn = document.getElementById('cfgp-btn-play');
  playBtn.style.display = (game.LaunchCommand && String(game.LaunchCommand).trim()) ? '' : 'none';

  _cfgpBuildButtonList();
  _cfgpFocusBtn(0);
  renderFooters();
}

function closeCremaFlatGamepage() {
  _cfgpStopKenBurns();
  const video = document.getElementById('cfgp-video');
  video.pause(); video.src = ''; video.style.display = 'none';
  document.getElementById('cfgp-screen').classList.add('hidden');
  _cfgpGame = null;
}

function _cfgpUpdateBadges(game) {
  const favBtn  = document.getElementById('cfgp-btn-fav');
  const wantBtn = document.getElementById('cfgp-btn-want');
  const favOn   = game.FAV === 'YES';
  const wantOn  = game.WANT_TO_PLAY === 'YES';
  favBtn.textContent = favOn ? '★ FAV' : '+ FAV';
  favBtn.classList.toggle('cfgp-active', favOn);
  wantBtn.textContent = wantOn ? '⚑ WANT ✓' : '⚑ WANT';
  wantBtn.classList.toggle('cfgp-active', wantOn);
}

function _cfgpBuildButtonList() {
  _cfgpBtns = ['cfgp-btn-back','cfgp-btn-fav','cfgp-btn-want','cfgp-btn-trailer','cfgp-btn-play']
    .map(id => document.getElementById(id))
    .filter(b => b && b.style.display !== 'none');
}

function _cfgpFocusBtn(idx) {
  _cfgpBtnIdx = Math.max(0, Math.min(idx, _cfgpBtns.length - 1));
  _cfgpBtns.forEach((b, i) => b.classList.toggle('cfgp-focused', i === _cfgpBtnIdx));
}

function _cfgpActivateBtn() {
  const btn = _cfgpBtns[_cfgpBtnIdx];
  if (!btn || !_cfgpGame) return;
  const id = btn.id;
  const game = _cfgpGame;
  playSound(sfxSelect);

  if (id === 'cfgp-btn-back') {
    closeCremaFlatGamepage();
    document.getElementById('gallery-screen').classList.remove('hidden');
    gameState = 'GALLERY';
    renderFooters();
  } else if (id === 'cfgp-btn-fav') {
    game.FAV = game.FAV === 'YES' ? 'NO' : 'YES';
    window.api.saveDbField({ game: game.Game, field: 'FAV', value: game.FAV });
    _cfgpUpdateBadges(game);
  } else if (id === 'cfgp-btn-want') {
    game.WANT_TO_PLAY = game.WANT_TO_PLAY === 'YES' ? 'NO' : 'YES';
    window.api.saveDbField({ game: game.Game, field: 'WANT_TO_PLAY', value: game.WANT_TO_PLAY });
    _cfgpUpdateBadges(game);
  } else if (id === 'cfgp-btn-trailer') {
    const video = document.getElementById('cfgp-video');
    if (video.src && video.style.display !== 'none') {
      video.muted = !video.muted;
      btn.innerHTML = video.muted
        ? '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:5px;vertical-align:middle;"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>UNMUTE'
        : '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:5px;vertical-align:middle;"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>MUTE';
    }
  } else if (id === 'cfgp-btn-play') {
    tryLaunch(game);
  }
}

// Keyboard/gamepad handler for CREMA_FGP state — wired into the existing input handler
function handleCfgpInput(action) {
  if (action === 'LEFT')   { playSound(sfxNav); _cfgpFocusBtn(_cfgpBtnIdx - 1); }
  else if (action === 'RIGHT')  { playSound(sfxNav); _cfgpFocusBtn(_cfgpBtnIdx + 1); }
  else if (action === 'ACCEPT') _cfgpActivateBtn();
  else if (action === 'BACK')   { playSound(sfxBack); _cfgpActivateBtn.call(null); closeCremaFlatGamepage(); document.getElementById('gallery-screen').classList.remove('hidden'); gameState = 'GALLERY'; renderFooters(); }
}

// ══════════════════════════════════════════════════════════════════════════
// BROWSE MODE MENU
// ══════════════════════════════════════════════════════════════════════════

function openBrowseModeMenu() {
  gameState = 'BROWSE_MODE_MENU';
  playSound(sfxSelect);
  currentOverlayIndex = 0;
  document.getElementById('overlay-backdrop').classList.remove('hidden');
  const current = audioCfg.browseMode || 'LIST';
  const opts = [t('browse.list'), t('browse.gallery')].map(m => {
    const key = m === t('browse.list') ? 'LIST' : 'GALLERY';
    return key === current ? `★ ${m}` : m;
  });
  opts.push(t('common.back_to_menu'));
  renderGenericOverlay(t('browse.mode'), opts);
}

function openGamepageStyleMenu() {
  gameState = 'GAMEPAGE_STYLE_MENU';
  playSound(sfxSelect);
  currentOverlayIndex = 0;
  document.getElementById('overlay-backdrop').classList.remove('hidden');
  const current = audioCfg.gamepageStyle || 'CLASSIC';
  const opts = ['Classic', 'Immersive'].map(m => {
    const key = m.toUpperCase();
    return key === current ? `★ ${m}` : m;
  });
  opts.push(t('common.back_to_menu'));
  renderGenericOverlay('GAMEPAGE STYLE', opts);
}

function openSmartGamepage(game) {
  if ((audioCfg.gamepageStyle || 'CLASSIC') === 'IMMERSIVE') {
    openCremaFlatGamepage(game);
  } else {
    openGalleryGamepage(game);
  }
}

// ── GRINDER headless install/uninstall ────────────────────────────────────────

function _gpStep(id, state) { // state: 'idle' | 'active' | 'done' | 'error'
    const el = document.getElementById(id); if (!el) return;
    el.className = 'gp-step' + (state === 'active' ? ' gp-active' : state === 'done' ? ' gp-done' : state === 'error' ? ' gp-error' : '');
}

function _setGrinderProgressStep(step, isUninstall) {
    const allInstall = ['auth','downloading','installing','redist'];
    const allUninstall = ['uninstalling'];
    const all = isUninstall ? allUninstall : allInstall;
    const idx = all.indexOf(step);
    all.forEach((s, i) => _gpStep(`gp-step-${s}`, i < idx ? 'done' : i === idx ? 'active' : 'idle'));
    if (step === 'done') all.forEach(s => _gpStep(`gp-step-${s}`, 'done'));
    if (step === 'error') all.forEach((s, i) => { if (i <= Math.max(idx, 0)) _gpStep(`gp-step-${s}`, i === Math.max(idx, 0) ? 'error' : 'done'); });
}

function showGrinderConfirm(game) {
    _grinderConfirmGame = game;
    if (!_grinderInstallDir) _grinderInstallDir = '/home/jose/Games/CafeNeurotico';
    document.getElementById('gc-action-title').textContent = 'INSTALL GAME';
    document.getElementById('gc-game-title').textContent = game.Game;
    document.getElementById('gc-dir').textContent = _grinderInstallDir;
    // Download/disk size + free space (shared GRINDER logic)
    const _gid = game.GrinderGameId || '';
    const _fmtB = b => b == null ? '?' : (b >= 1024**3 ? (b/1024**3).toFixed(1)+' GB' : (b/1024**2).toFixed(0)+' MB');
    const _sz = document.getElementById('gc-sizeinfo'); if (_sz) _sz.textContent = 'Checking size & space…';
    Promise.all([window.api.getInstallSize(_gid).catch(() => null), window.api.getDiskSpace(_grinderInstallDir).catch(() => null)]).then(([info, free]) => {
        if (!_sz) return;
        const parts = [];
        if (info?.download_size) parts.push(`Download ${_fmtB(info.download_size)}`);
        if (info?.disk_size) parts.push(`On disk ${_fmtB(info.disk_size)}`);
        const need = info?.disk_size || info?.download_size || 0;
        if (free != null) parts.push(`${_fmtB(free)} free${need && free < need ? '  ⚠️ NOT ENOUGH SPACE' : ''}`);
        _sz.textContent = parts.length ? parts.join('   ·   ') : 'Size info unavailable';
    });
    document.getElementById('grinder-confirm-backdrop').classList.remove('hidden');
    _grinderConfirmActive = true;
    previousGameState = gameState; gameState = 'GRINDER_CONFIRM';
    // Fetch GRINDER's saved default dir and update if different
    try { window.api.grinderGetDefaultInstallDir().then(dir => { if (dir) { _grinderInstallDir = dir; document.getElementById('gc-dir').textContent = dir; } }).catch(() => {}); } catch(e) {}
}

function hideGrinderConfirm() {
    document.getElementById('grinder-confirm-backdrop').classList.add('hidden');
    _grinderConfirmActive = false; _grinderConfirmGame = null;
    gameState = previousGameState;
}

function showGrinderProgress(isUninstall) {
    const game = _grinderConfirmGame;
    document.getElementById('gp-action-title').textContent = isUninstall ? 'UNINSTALLING' : 'INSTALLING';
    document.getElementById('gp-game-title').textContent = game?.Game || '';
    document.getElementById('gp-bar').style.width = '0%';
    document.getElementById('gp-message').textContent = '';
    // Toggle steps for install vs uninstall
    ['gp-step-auth','gp-step-downloading','gp-step-installing','gp-step-redist'].forEach(id => { const el = document.getElementById(id); if (el) el.parentElement.style.display = isUninstall ? 'none' : ''; });
    ['gp-sep-uninstall','gp-step-uninstalling'].forEach(id => { const el = document.getElementById(id); if (el) el.style.display = isUninstall ? '' : 'none'; });
    if (!isUninstall) ['auth','downloading','installing','redist'].forEach(s => _gpStep(`gp-step-${s}`, 'idle'));
    else _gpStep('gp-step-uninstalling', 'idle');
    document.getElementById('gp-cancel-hint').style.display = '';
    document.getElementById('grinder-progress-backdrop').classList.remove('hidden');
    _grinderProgressActive = true;
    previousGameState = gameState; gameState = 'GRINDER_PROGRESS';
    _grinderProgressInterval = setInterval(pollGrinderProgress.bind(null, isUninstall), 1200);
}

function hideGrinderProgress() {
    document.getElementById('grinder-progress-backdrop').classList.add('hidden');
    clearInterval(_grinderProgressInterval); _grinderProgressInterval = null;
    _grinderProgressActive = false; _grinderConfirmGame = null;
    gameState = previousGameState;
}

async function pollGrinderProgress(isUninstall) {
    const p = await window.api.grinderGetProgress();
    if (!p) return;
    _setGrinderProgressStep(p.step, isUninstall);
    document.getElementById('gp-bar').style.width = (p.percent || 0) + '%';
    document.getElementById('gp-message').textContent = p.message || '';
    if (p.done) {
        clearInterval(_grinderProgressInterval); _grinderProgressInterval = null;
        document.getElementById('gp-cancel-hint').style.display = 'none';
        if (p.step === 'done') {
            document.getElementById('gp-bar').style.width = '100%';
            window.api.syncGrinderInstalled().catch(() => {}).finally(() => {
                hideGrinderProgress(); refreshDatabase();
            });
        }
    }
}

async function triggerGrinderInstall() {
    const game = _grinderConfirmGame; if (!game) return;
    const storeL = (game.Store || '').toLowerCase();
    const store = storeL.includes('gog') ? 'gog' : 'epic';

    // app_id may be missing for older/imported rows — extract it from the LaunchCommand
    let appId = game.app_id;
    if (!appId && game.LaunchCommand) {
        const m = game.LaunchCommand.match(/grinder:\/\/launch\/(?:gog|epic)\/([^\s"]+)/i);
        if (m) appId = m[1];
    }

    if (!appId) {
        hideGrinderConfirm();
        _grinderConfirmGame = game;
        document.getElementById('gp-action-title').textContent = 'INSTALL ERROR';
        document.getElementById('gp-game-title').textContent = game.Game;
        document.getElementById('gp-message').textContent = 'No store app ID found. Open GRINDER directly to install it.';
        document.getElementById('gp-bar').style.width = '0%';
        document.getElementById('gp-cancel-hint').style.display = '';
        document.getElementById('grinder-progress-backdrop').classList.remove('hidden');
        _grinderProgressActive = true;
        previousGameState = gameState; gameState = 'GRINDER_PROGRESS';
        return;
    }

    hideGrinderConfirm();
    const result = await window.api.grinderHeadlessInstall(store, appId, 'windows', _grinderInstallDir);
    if (!result.ok) { alert(result.error); return; }
    showGrinderProgress(false);
}

async function triggerGrinderUninstall(game) {
    _grinderConfirmGame = game;
    const storeL = (game.Store || '').toLowerCase();
    const store = storeL.includes('gog') ? 'gog' : 'epic';
    // app_id may be missing (older/imported / CNGM rows) — extract from the LaunchCommand, same as install.
    let appId = game.app_id;
    if (!appId && game.LaunchCommand) {
        const m = game.LaunchCommand.match(/grinder:\/\/launch\/(?:gog|epic)\/([^\s"]+)/i);
        if (m) appId = m[1];
    }
    if (!appId) { alert('No store app ID found — open GRINDER directly to uninstall.'); return; }
    const result = await window.api.grinderHeadlessUninstall(store, appId);
    if (!result.ok) { alert(result.error); return; }
    showGrinderProgress(true);
}

// ── GPU IDLE SUSPEND ──────────────────────────────────────────────────────────
// Freeze all CSS animations + videos when CREMA is hidden or unfocused (e.g. while a
// launched game is in the foreground, or when backgrounded) so the Ken Burns / screensaver
// compositor stops burning GPU. The gamepad poll keeps running (it must, to detect the
// wake combo while a game is focused); Chromium throttles it automatically when truly hidden.
(function () {
  let _suspended = null;
  function setGpuSuspended(s) {
    if (s === _suspended) return; _suspended = s;
    if (document.body) document.body.classList.toggle('gpu-suspended', s);
    if (s) { try { document.querySelectorAll('video').forEach(v => { if (!v.paused) v.pause(); }); } catch (e) {} }
  }
  document.addEventListener('visibilitychange', () => setGpuSuspended(document.hidden));
  window.addEventListener('blur',  () => setGpuSuspended(true));
  window.addEventListener('focus', () => setGpuSuspended(false));
})();

boot();
