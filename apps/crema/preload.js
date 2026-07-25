const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getBaseDir: () => ipcRenderer.invoke('get-basedir'),
                                getGames: () => ipcRenderer.invoke('get-games'),
                                launchGame: (cmd) => ipcRenderer.send('launch-game', cmd),
                                quitApp: () => ipcRenderer.send('quit-app'),
                                saveDbField: (data) => ipcRenderer.send('save-db-field', data),
                                fetchHltb: (g) => ipcRenderer.invoke('fetch-hltb', g),
                                fetchProton: (id) => ipcRenderer.invoke('fetch-proton', id),
                                checkLocalTrailer: (g) => ipcRenderer.invoke('check-local-trailer', g),
                                deleteTrailer: (g) => ipcRenderer.invoke('delete-trailer', g),
                                searchYoutube: (g) => ipcRenderer.invoke('search-youtube', g),
                                downloadTrailer: (g, id) => ipcRenderer.invoke('download-trailer', g, id),
                                onDownloadProgress: (cb) => ipcRenderer.on('download-progress', (e, d) => cb(d)),
                                getAudioConfig: () => ipcRenderer.invoke('get-audio-config'),
                                saveAudioConfig: (cfg) => ipcRenderer.send('save-audio-config', cfg),
                                getCustomMusic: () => ipcRenderer.invoke('get-custom-music'),
                                getStandardBgm: (m) => ipcRenderer.invoke('get-standard-bgm', m),
                                getSetting: (k) => ipcRenderer.invoke('get-setting', k),
                                setSetting: (k, v) => ipcRenderer.invoke('set-setting', k, v),
                                getHomeStats: (opts) => ipcRenderer.invoke('get-home-stats', opts),
                                getRandomGame: (c) => ipcRenderer.invoke('get-random-game', c),
                                wishlistDeals: () => ipcRenderer.invoke('wishlist-deals'),
                                freeGames: () => ipcRenderer.invoke('free-games'),
                                getNews: () => ipcRenderer.invoke('get-news'),
                                getGameNews: () => ipcRenderer.invoke('get-game-news'),
                                fetchArticle: (url) => ipcRenderer.invoke('fetch-article', url),
                                protonWatchGet: () => ipcRenderer.invoke('proton-watch-get'),
                                achGet: () => ipcRenderer.invoke('ach-get'),
                                verifyInstallStatus: (id) => ipcRenderer.invoke('verify-install-status', id),
                                launcherStates: (id) => ipcRenderer.invoke('launcher-states', id),
                                openInstallUrl: (url) => ipcRenderer.invoke('open-install-url', url),
                                onInstallStatusUpdated: (cb) => ipcRenderer.on('install-status-updated', () => cb()),
                                searchSteam: (g) => ipcRenderer.invoke('search-steam', g),
                                searchIgdb: (g) => ipcRenderer.invoke('search-igdb', g),
                                scrapeIgdbData: (g, mode, id) => ipcRenderer.invoke('scrape-igdb-data', g, mode, id),
                                sgdbSearch: (g, k, id) => ipcRenderer.invoke('sgdb-search', g, k, id),
                                sgdbApply: (g, url) => ipcRenderer.invoke('sgdb-apply', g, url),
                                scrapeSteamData: (g, mode, id) => ipcRenderer.invoke('scrape-steam-data', g, mode, id),
                                getAudioMetadata: (p) => ipcRenderer.invoke('get-audio-metadata', p),
                                getMusicLibrary: () => ipcRenderer.invoke('get-music-library'),
                                getPlaylists: () => ipcRenderer.invoke('get-playlists'),
                                savePlaylists: (pl) => ipcRenderer.send('save-playlists', pl),

                                // --- GAME PLAYLISTS (shared games.db, see The Manager) ---
                                getGamePlaylists: () => ipcRenderer.invoke('get-game-playlist-list'),
                                getPlaylistGames: (id) => ipcRenderer.invoke('get-playlist-games', id),
                                getPlaylistsForGame: (gameId) => ipcRenderer.invoke('get-game-playlists', gameId),
                                addPlaylist: (name) => ipcRenderer.invoke('add-playlist', name),
                                deletePlaylist: (id) => ipcRenderer.invoke('delete-playlist', id),
                                addGameToPlaylist: (plId, gameId) => ipcRenderer.invoke('add-game-to-playlist', plId, gameId),
                                removeGameFromPlaylist: (plId, gameId) => ipcRenderer.invoke('remove-game-from-playlist', plId, gameId),

                                // NEW: Force Focus
                                forceFocus: () => ipcRenderer.send('force-focus'),


                                // FIX: Expose Gaming History IPCs for CREMA
                                updateLastPlayed: (gameName) => ipcRenderer.invoke('update-last-played', gameName),
                                clearHistory: () => ipcRenderer.invoke('clear-history'),

                                // --- ACHIEVEMENTS ---
                                getGameAchievements: (appId) => ipcRenderer.invoke('get-game-achievements', appId),
                                fetchAchievementsNow: (appId) => ipcRenderer.invoke('fetch-achievements-now', appId),
                                fetchSteamAchievements: (appId) => ipcRenderer.invoke('fetch-steam-achievements', appId),

                                // --- I18N ---
                                getStrings: (lang) => ipcRenderer.invoke('get-strings', lang),

                                // --- GRINDER headless install/uninstall ---
                                openGrinderGui: (term) => ipcRenderer.invoke('open-grinder-gui', term),
                                syncGrinderInstalled: () => ipcRenderer.invoke('sync-grinder-installed'),
                                grinderGetDefaultInstallDir: () => ipcRenderer.invoke('grinder-get-default-install-dir'),
                                getDiskSpace:   (p)   => ipcRenderer.invoke('get-disk-space', p),
                                getInstallSize: (gid) => ipcRenderer.invoke('get-install-size', gid),
                                grinderHeadlessInstall: (store, appId, platform, installDir) => ipcRenderer.invoke('grinder-headless-install', store, appId, platform, installDir),
                                grinderHeadlessUninstall: (store, appId) => ipcRenderer.invoke('grinder-headless-uninstall', store, appId),
                                grinderGetProgress: () => ipcRenderer.invoke('grinder-get-progress'),
                                grinderCancelHeadless: () => ipcRenderer.invoke('grinder-cancel-headless'),

                                // --- PICO-8 ---
                                scanPico8: () => ipcRenderer.invoke('scan-pico8'),

                                // --- FLATPAK ---
                                scanFlatpak: () => ipcRenderer.invoke('scan-flatpak'),
                                findFlatpakIcon: (n) => ipcRenderer.invoke('find-flatpak-icon', n),
                                readFileBase64: (p) => ipcRenderer.invoke('read-file-base64', p),
                                saveFlatpakArt: (id, c, h, i) => ipcRenderer.invoke('save-flatpak-art', id, c, h, i),
});
