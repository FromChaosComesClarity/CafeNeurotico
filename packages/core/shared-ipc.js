'use strict';
/*
 * @cafeneurotico/core — shared IPC handlers that are byte-identical across the
 * suite's faces (Manager today; CREMA in Phase 3). Single source of truth so a
 * fix here can never drift between faces.
 *
 * Call once per face (faces run as separate processes) after the DB is open:
 *   require('../../packages/core/shared-ipc.js').registerSharedHandlers({
 *     db, baseDir, trailersDir, ytDlpPath, ytDlpConfigPath, ffmpegPath,
 *     getBeautifulName, getOldCrushedName });
 */
const { ipcMain, BrowserWindow, shell } = require('electron');
const path = require('path');
const fs   = require('fs');
const os   = require('os');
const { spawn } = require('child_process');
const homeStats = require('./home-stats.js');
const itad = require('./itad.js');
const freebies = require('./freebies.js');
const rss = require('./rss.js');
const proton = require('./proton.js');

function registerSharedHandlers(ctx) {
    const { db, baseDir, trailersDir, ytDlpPath, ytDlpConfigPath, ffmpegPath,
            getBeautifulName, getOldCrushedName } = ctx;

    // Wishlist of UN-OWNED games (Phase 2) — distinct from WANT_TO_PLAY (owned).
    try { db.prepare(`CREATE TABLE IF NOT EXISTS wishlist (id INTEGER PRIMARY KEY AUTOINCREMENT, itad_id TEXT UNIQUE, title TEXT, slug TEXT, cover TEXT, appid TEXT, added_at INTEGER DEFAULT 0, target_price REAL)`).run(); } catch (e) {}

    ipcMain.handle('get-basedir', () => baseDir);

    ipcMain.handle('get-games', () => {
        if (!db) return { games: [] };
        try { return { games: db.prepare("SELECT * FROM games ORDER BY Game ASC").all() }; }
        catch (err) { return { games: [] }; }
    });

    ipcMain.handle('clear-history', () => {
        if (!db) return false;
        try { db.prepare("UPDATE games SET LastPlayed = 0").run(); return true; } catch(err) { return false; }
    });

    ipcMain.handle('read-file-base64', (e, filePath) => {
        try { return fs.readFileSync(filePath).toString('base64'); } catch { return null; }
    });

    ipcMain.handle('open-install-url', async (e, url) => {
        if (url) await shell.openExternal(url);
    });

    ipcMain.handle('get-setting', (e, key) => { try { const row = db.prepare("SELECT value FROM settings WHERE key=?").get(key); return row ? row.value : null; } catch(e) { return null; } });

    ipcMain.handle('set-setting', (e, key, val) => { try { db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run(key, val); return true; } catch(e) { return false; } });

    // ── Home dashboard (Phase 1) — one snapshot, rendered by both faces' Home screens. ──
    ipcMain.handle('get-home-stats', (e, opts) => {
        if (!db) return null;
        try {
            const games = db.prepare("SELECT * FROM games").all();
            return homeStats.computeHomeSnapshot(games, {
                dailySeed: new Date().toISOString().slice(0, 10),
                ...(opts || {}),
            });
        } catch (err) { return null; }
    });

    // Random game for the Roulette widget (constraints: installedOnly/backlogOnly/favsOnly/wantOnly/store/genre/maxHours).
    ipcMain.handle('get-random-game', (e, constraints) => {
        if (!db) return null;
        try { return homeStats.pickRandom(db.prepare("SELECT * FROM games").all(), constraints || {}); }
        catch (err) { return null; }
    });

    // ── Wishlist + IsThereAnyDeal deals (Phase 2) — all opt-in (no key → no network). ──
    const _itadKey = () => { try { return db.prepare("SELECT value FROM settings WHERE key='itad_api_key'").get()?.value || ''; } catch { return ''; } };
    const _itadCountry = () => { try { return db.prepare("SELECT value FROM settings WHERE key='itad_country'").get()?.value || 'US'; } catch { return 'US'; } };

    ipcMain.handle('itad-search', async (e, q) => itad.search(_itadKey(), q));
    ipcMain.handle('wishlist-get', () => { try { return db.prepare("SELECT * FROM wishlist ORDER BY added_at DESC").all(); } catch { return []; } });
    ipcMain.handle('wishlist-remove', (e, itadId) => { try { db.prepare("DELETE FROM wishlist WHERE itad_id=?").run(itadId); return true; } catch { return false; } });
    ipcMain.handle('wishlist-add', async (e, item) => {
        if (!item || !item.id) return { ok: false };
        let cover = item.cover || '', appid = item.appid || null;
        if (!cover) { const inf = await itad.info(_itadKey(), item.id); if (inf) { cover = inf.cover; appid = appid || inf.appid; } }
        try {
            db.prepare("INSERT OR IGNORE INTO wishlist (itad_id,title,slug,cover,appid,added_at) VALUES (?,?,?,?,?,?)")
              .run(item.id, item.title || '', item.slug || '', cover || '', appid, Date.now());
            return { ok: true };
        } catch (err) { return { ok: false, error: err.message }; }
    });
    // List + live prices/historical-low (network — only if a key is set).
    ipcMain.handle('wishlist-deals', async () => {
        let rows = []; try { rows = db.prepare("SELECT * FROM wishlist ORDER BY added_at DESC").all(); } catch {}
        const key = _itadKey();
        if (!key || !rows.length) return { keyed: !!key, rows: rows.map(r => ({ ...r, deal: null, low: null })) };
        return { keyed: true, rows: await itad.enrich(key, _itadCountry(), rows) };
    });

    // Free games this week (Epic public endpoint, no key) — fetched only when the widget is on.
    ipcMain.handle('free-games', async () => { try { return await freebies.freeGames(_itadCountry()); } catch { return []; } });

    // Gaming news (RSS/Atom) — sources from `news_sources` setting (newline/comma list) or curated defaults.
    ipcMain.handle('get-news', async () => {
        let urls = [];
        try { const raw = db.prepare("SELECT value FROM settings WHERE key='news_sources'").get()?.value; if (raw) urls = raw.split(/[\n,]+/).map(s => s.trim()).filter(Boolean); } catch {}
        if (!urls.length) urls = rss.DEFAULT_NEWS;
        try { return await rss.fetchNews(urls, 14); } catch { return []; }
    });

    // ProtonDB tier watch — last cached result + an on-demand library sweep.
    ipcMain.handle('proton-watch-get', () => { try { const raw = db.prepare("SELECT value FROM settings WHERE key='proton_watch'").get()?.value; return raw ? JSON.parse(raw) : null; } catch { return null; } });
    ipcMain.handle('proton-check', async () => {
        let games = [];
        try { games = db.prepare("SELECT id, Game, SteamAppID, ProtonTier FROM games WHERE SteamAppID IS NOT NULL AND TRIM(SteamAppID) != '' AND SteamAppID != 'None'").all(); } catch {}
        const { checked, changes } = await proton.checkLibrary(games, { limit: 120 });
        for (const c of changes) { try { db.prepare("UPDATE games SET ProtonTier=? WHERE id=?").run(c.now, c.id); } catch {} }
        const result = { ts: Date.now(), checked, changes };
        try { db.prepare("INSERT OR REPLACE INTO settings (key,value) VALUES ('proton_watch', ?)").run(JSON.stringify(result)); } catch {}
        return result;
    });

    ipcMain.handle('find-flatpak-icon', (e, iconName) => {
        const bases = [
            path.join(os.homedir(), '.local/share/flatpak/exports/share/icons/hicolor'),
            '/var/lib/flatpak/exports/share/icons/hicolor'
        ];
        const sizes = ['512x512', '256x256', '192x192', '128x128'];
        for (const base of bases) {
            for (const size of sizes) {
                const p = path.join(base, size, 'apps', iconName + '.png');
                if (fs.existsSync(p)) return p;
            }
            const svg = path.join(base, 'scalable', 'apps', iconName + '.svg');
            if (fs.existsSync(svg)) return svg;
        }
        return null;
    });

    ipcMain.handle('scan-flatpak', () => {
        const GAME_CATS = new Set(['Game','ActionGame','ArcadeGame','BoardGame','CardGame',
            'KidsGame','LogicGame','RolePlaying','Shooter','Simulation','SportsGame','StrategyGame']);
        const dirs = [
            '/var/lib/flatpak/exports/share/applications',
            path.join(os.homedir(), '.local/share/flatpak/exports/share/applications')
        ];

        const found = new Set();
        const iconMap = {}; // gameId → iconName (= appId for Flatpak)

        for (const dir of dirs) {
            let files;
            try { files = fs.readdirSync(dir).filter(f => f.endsWith('.desktop')); }
            catch { continue; }
            for (const file of files) {
                let content;
                try { content = fs.readFileSync(path.join(dir, file), 'utf8'); }
                catch { continue; }
                let name = '', cats = '', icon = '';
                for (const line of content.split('\n')) {
                    if (line.startsWith('Name=')       && !name) name = line.slice(5).trim();
                    if (line.startsWith('Categories=') && !cats) cats = line.slice(11).trim();
                    if (line.startsWith('Icon=')       && !icon) icon = line.slice(5).trim();
                }
                if (!cats.split(';').map(c => c.trim()).some(c => GAME_CATS.has(c))) continue;
                const appId = file.slice(0, -8);
                if (!name) name = appId;
                if (!icon) icon = appId;
                const launchCmd = `flatpak run ${appId}`;
                found.add(launchCmd);
                const row = db.prepare('SELECT id, Store, CoverArt FROM games WHERE LaunchCommand = ?').get(launchCmd);
                if (row) {
                    const stores = (row.Store || '').split(',').map(s => s.trim());
                    if (!stores.some(s => s.toLowerCase() === 'flatpak'))
                        db.prepare('UPDATE games SET Store=?, Installed=1 WHERE id=?').run([...stores, 'Flatpak'].join(', '), row.id);
                    else
                        db.prepare('UPDATE games SET Installed=1 WHERE id=?').run(row.id);
                    if (!row.CoverArt) iconMap[row.id] = icon;
                } else {
                    const info = db.prepare('INSERT INTO games (Game,Store,LaunchCommand,Installed) VALUES (?,?,?,1)').run(name, 'Flatpak', launchCmd);
                    iconMap[info.lastInsertRowid] = icon;
                }
            }
        }

        const existing = db.prepare("SELECT id, LaunchCommand FROM games WHERE Store = 'Flatpak'").all();
        for (const row of existing) {
            if (!found.has(row.LaunchCommand))
                db.prepare('DELETE FROM games WHERE id=?').run(row.id);
        }

        return { count: found.size, iconMap };
    });

    ipcMain.handle('check-local-trailer', (event, gameName) => {
        const beautifulPath = path.join(trailersDir, `${getBeautifulName(gameName)}.mp4`);
        const oldPath = path.join(trailersDir, `${getOldCrushedName(gameName)}.mp4`);
        if (fs.existsSync(beautifulPath)) return `file://${beautifulPath}`;
            if (fs.existsSync(oldPath)) return `file://${oldPath}`;
                return null;
    });

    ipcMain.handle('download-trailer', (event, gameName, videoId) => {
        const fileName = `${getBeautifulName(gameName)}.mp4`;
        const filePath = path.join(trailersDir, fileName);
        const win = BrowserWindow.getFocusedWindow();
        const args = [ '--config-location', ytDlpConfigPath, '--ffmpeg-location', ffmpegPath, `https://www.youtube.com/watch?v=${videoId}`, '-f', 'bestvideo[ext=mp4][height<=720]+bestaudio[ext=m4a]/best[ext=mp4]/best', '-o', filePath, '--no-part', '--newline' ];
        return new Promise((resolve) => {
            const ytdlp = spawn(ytDlpPath, args);
            ytdlp.stdout.on('data', (data) => {
                const match = data.toString().match(/\[download\]\s+(\d+(\.\d+)?)%/);
                if (match && match[1]) { if (win) win.webContents.send('download-progress', parseFloat(match[1])); }
            });
            ytdlp.on('close', (code) => resolve(code === 0));
        });
    });

    ipcMain.handle('fetch-steam-achievements', async (_, appId) => {
        const get = k => db.prepare("SELECT value FROM settings WHERE key=?").get(k)?.value;
        const apiKey  = get('steam_api_key');
        const steamId = get('steam_id');
        if (!apiKey || !steamId) return { ok: false, error: 'no_credentials' };

        const dbKey = `steam_${appId}`;
        try {
            const [playerRes, schemaRes] = await Promise.all([
                fetch(`https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v1/?key=${apiKey}&steamid=${steamId}&appid=${appId}&l=english`),
                fetch(`https://api.steampowered.com/ISteamUserStats/GetSchemaForGame/v2/?key=${apiKey}&appid=${appId}`),
            ]);
            const playerData = await playerRes.json();
            const schemaData = await schemaRes.json();

            if (!playerData.playerstats?.success) return { ok: false, error: playerData.playerstats?.error || 'no_stats' };

            const playerAchs = playerData.playerstats.achievements || [];
            const schemaAchs = schemaData.game?.availableGameStats?.achievements || [];
            const iconMap = {};
            for (const s of schemaAchs) iconMap[s.name] = { icon: s.icon || null, icongray: s.icongray || null };

            db.exec(`CREATE TABLE IF NOT EXISTS achievements (
                app_id TEXT NOT NULL, key TEXT NOT NULL, name TEXT,
                description TEXT, image_locked TEXT, image_unlocked TEXT,
                date_unlocked TEXT, visible INTEGER DEFAULT 1,
                PRIMARY KEY (app_id, key)
            )`);
            const upsert = db.prepare(`INSERT OR REPLACE INTO achievements
                (app_id, key, name, description, image_locked, image_unlocked, date_unlocked, visible)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
            db.transaction(list => {
                for (const a of list) {
                    const icons = iconMap[a.apiname] || {};
                    const dateUnlocked = (a.achieved && a.unlocktime) ? new Date(a.unlocktime * 1000).toISOString() : null;
                    upsert.run(dbKey, a.apiname, a.name || a.apiname, a.description || null,
                        icons.icongray || null, icons.icon || null, dateUnlocked, 1);
                }
            })(playerAchs);

            const rows = db.prepare(
                "SELECT * FROM achievements WHERE app_id = ? ORDER BY date_unlocked DESC, name COLLATE NOCASE"
            ).all(dbKey);
            return { ok: true, achievements: rows };
        } catch (e) { return { ok: false, error: e.message }; }
    });

    ipcMain.handle('get-game-achievements', (_, appId) => {
        try {
            // Ensure the table exists (created by GRINDER on first sync)
            db.exec(`CREATE TABLE IF NOT EXISTS achievements (
                app_id TEXT NOT NULL, key TEXT NOT NULL, name TEXT,
                description TEXT, image_locked TEXT, image_unlocked TEXT,
                date_unlocked TEXT, visible INTEGER DEFAULT 1,
                PRIMARY KEY (app_id, key)
            )`);
            const rows = db.prepare(
                "SELECT * FROM achievements WHERE app_id = ? ORDER BY date_unlocked DESC, name COLLATE NOCASE"
            ).all(appId);
            return { ok: true, achievements: rows };
        } catch (e) { return { ok: false, achievements: [] }; }
    });

}

module.exports = { registerSharedHandlers };
