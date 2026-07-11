const { contextBridge, ipcRenderer, webFrame } = require('electron');

contextBridge.exposeInMainWorld('api', {
    getBaseDir: () => ipcRenderer.invoke('get-basedir'),
                                getGames: () => ipcRenderer.invoke('get-games'),
                                addGame: (name) => ipcRenderer.invoke('add-game', name),
                                updateGame: (id, data) => ipcRenderer.invoke('update-game', id, data),
                                setGameFlag: (id, field, value) => ipcRenderer.invoke('set-game-flag', id, field, value),
                                notify: (p) => ipcRenderer.invoke('notify', p),
                                deleteGame: (id) => ipcRenderer.invoke('delete-game', id),
                                signalReady: () => ipcRenderer.send('renderer-ready'),
                                verifyInstallStatus: (id) => ipcRenderer.invoke('verify-install-status', id),
                                openInstallUrl: (url) => ipcRenderer.invoke('open-install-url', url),
                                openExternal: (url) => ipcRenderer.invoke('open-install-url', url),
                                checkAllInstallStatus: () => ipcRenderer.invoke('check-all-install-status'),
                                setLaunchCommand: (id, cmd) => ipcRenderer.invoke('set-launch-command', id, cmd),
                                onInstallStatusUpdated: (cb) => ipcRenderer.on('install-status-updated', () => cb()),
                                scanFlatpak: () => ipcRenderer.invoke('scan-flatpak'),

                                // --- PICO-8 ---
                                getPico8Status: () => ipcRenderer.invoke('get-pico8-status'),
                                browsePico8Binary: () => ipcRenderer.invoke('browse-pico8-binary'),
                                launchPico8Splore: () => ipcRenderer.invoke('launch-pico8-splore'),
                                scanPico8: () => ipcRenderer.invoke('scan-pico8'),
                                launchPico8Bbs: (accent) => ipcRenderer.invoke('launch-pico8-bbs', accent),
                                openPico8Folder: () => ipcRenderer.invoke('open-pico8-folder'),
                                getPico8Opts: () => ipcRenderer.invoke('get-pico8-opts'),
                                setPico8Opt: (k, v) => ipcRenderer.invoke('set-pico8-opt', k, v),
                                onPico8CartDownloaded: (cb) => ipcRenderer.on('pico8-cart-downloaded', (e, d) => cb(d)),
                                findFlatpakIcon: (n) => ipcRenderer.invoke('find-flatpak-icon', n),
                                readFileBase64: (p) => ipcRenderer.invoke('read-file-base64', p),
                                saveFlatpakArt: (id, c, h, i) => ipcRenderer.invoke('save-flatpak-art', id, c, h, i),
                                syncItch: () => ipcRenderer.invoke('sync-itch'),
                                syncSteam: (steamId, apiKey) => ipcRenderer.invoke('sync-steam', steamId, apiKey),
                                autoFetch: (id, name, appId) => ipcRenderer.invoke('auto-fetch', id, name, appId),
                                autoFetchText: (id, name, appId) => ipcRenderer.invoke('auto-fetch-text', id, name, appId),
                                searchSteam: (name) => ipcRenderer.invoke('search-steam', name),
                                launchGame: (cmd) => ipcRenderer.send('launch-game', cmd),
                                syncGog: () => ipcRenderer.invoke('sync-gog'),

                                // --- GAMING HISTORY ---
                                updateLastPlayed: (id) => ipcRenderer.invoke('update-last-played', id),
                                clearHistory: () => ipcRenderer.invoke('clear-history'),

                                // --- UI SCALING ---
                                setZoomLevel: (level) => webFrame.setZoomFactor(level),

                                // --- HLTB, PROTON, SGDB & LOCAL MEDIA ---
                                fetchHltb: (g) => ipcRenderer.invoke('fetch-hltb', g),
                                fetchProton: (id) => ipcRenderer.invoke('fetch-proton', id),

                                sgdbSearch: (g, k, id, assetType) => ipcRenderer.invoke('sgdb-search', g, k, id, assetType),
                                sgdbApply: (id, url, assetType) => ipcRenderer.invoke('sgdb-apply', id, url, assetType),

                                selectLocalImage: (id, type) => ipcRenderer.invoke('select-local-image', id, type),
                                getSetting: (k) => ipcRenderer.invoke('get-setting', k),
                                setSetting: (k, v) => ipcRenderer.invoke('set-setting', k, v),
                                getHomeStats: (opts) => ipcRenderer.invoke('get-home-stats', opts),
                                getRandomGame: (c) => ipcRenderer.invoke('get-random-game', c),
                                itadSearch: (q) => ipcRenderer.invoke('itad-search', q),
                                wishlistGet: () => ipcRenderer.invoke('wishlist-get'),
                                wishlistAdd: (item) => ipcRenderer.invoke('wishlist-add', item),
                                wishlistRemove: (id) => ipcRenderer.invoke('wishlist-remove', id),
                                wishlistDeals: () => ipcRenderer.invoke('wishlist-deals'),
                                freeGames: () => ipcRenderer.invoke('free-games'),
                                getNews: () => ipcRenderer.invoke('get-news'),
                                getGameNews: () => ipcRenderer.invoke('get-game-news'),
                                protonCheck: () => ipcRenderer.invoke('proton-check'),
                                protonWatchGet: () => ipcRenderer.invoke('proton-watch-get'),
                                diskScan: () => ipcRenderer.invoke('disk-scan'),
                                diskGet: () => ipcRenderer.invoke('disk-get'),
                                achScan: () => ipcRenderer.invoke('ach-scan'),
                                achGet: () => ipcRenderer.invoke('ach-get'),
                                openWebPopup: (url) => ipcRenderer.invoke('open-web-popup', url),

                                // --- TRAILERS ---
                                checkLocalTrailer: (g) => ipcRenderer.invoke('check-local-trailer', g),
                                fetchSteamTrailer: (appId) => ipcRenderer.invoke('fetch-steam-trailer', appId),
                                searchYoutube: (g) => ipcRenderer.invoke('search-youtube', g),
                                downloadTrailer: (g, id) => ipcRenderer.invoke('download-trailer', g, id),
                                deleteTrailer: (g) => ipcRenderer.invoke('delete-trailer', g),
                                onDownloadProgress: (cb) => ipcRenderer.on('download-progress', (e, d) => cb(d)),

                                // --- DATA TOOLS & CSV ---
                                downloadCsvTemplate: () => ipcRenderer.invoke('download-csv-template'),
                                exportCsv: () => ipcRenderer.invoke('export-csv'),
                                importCsv: () => ipcRenderer.invoke('import-csv'),
                                clearBrowserData: () => ipcRenderer.invoke('clear-browser-data'),
                                backupZip: () => ipcRenderer.invoke('backup-zip'),
                                restoreZip: () => ipcRenderer.invoke('restore-zip'),
                                onZipStarted: (cb) => ipcRenderer.on('zip-started', () => cb()),

                                // FIX: New Image Cleanup Tools
                                cleanUnusedImages: () => ipcRenderer.invoke('clean-unused-images'),
                                clearAllImages: () => ipcRenderer.invoke('clear-all-images'),

                                // --- SYSTEM ---
                                installToMenu: () => ipcRenderer.invoke('install-to-menu'),
                                getCremaAutostart: () => ipcRenderer.invoke('get-crema-autostart'),
                                setCremaAutostart: (en) => ipcRenderer.invoke('set-crema-autostart', en),

                                // --- CREMA COMPANION ---
                                checkCrema: () => ipcRenderer.invoke('check-crema'),
                                launchCrema: () => ipcRenderer.send('launch-crema'),

                                // --- EMULATTE ---
                                checkEmuLatte: () => ipcRenderer.invoke('check-emulatte'),
                                launchEmuLatte: () => ipcRenderer.send('launch-emulatte'),

                                // --- ACHIEVEMENTS ---
                                getGameAchievements: (appId) => ipcRenderer.invoke('get-game-achievements', appId),
                                fetchAchievementsNow: (appId) => ipcRenderer.invoke('fetch-achievements-now', appId),
                                fetchSteamAchievements: (appId) => ipcRenderer.invoke('fetch-steam-achievements', appId),

                                // --- IGDB ---
                                igdbTest: () => ipcRenderer.invoke('igdb-test'),
                                igdbSearchList: (name) => ipcRenderer.invoke('igdb-search-list', name),
                                igdbFetchScreenshots: (id) => ipcRenderer.invoke('igdb-fetch-screenshots', id),
                                igdbSaveScreenshot: (gameId, url) => ipcRenderer.invoke('igdb-save-screenshot', gameId, url),

                                // --- I18N ---
                                getStrings: (lang) => ipcRenderer.invoke('get-strings', lang),

                                // --- STORE BROWSER ---
                                openStoreBrowser: (store, colors) => ipcRenderer.invoke('open-store-browser', store, colors),

                                // --- GRINDER ---
                                openGrinder: (name) => ipcRenderer.invoke('open-grinder', name),
                                openGrinderStorage: () => ipcRenderer.invoke('open-grinder-storage'),
                                openGrinderSetup: (game) => ipcRenderer.invoke('open-grinder-setup', game),
                                grinderStatus: () => ipcRenderer.invoke('grinder-status'),
                                syncGrinderInstalled: (ids) => ipcRenderer.invoke('sync-grinder-installed', ids),
                                syncAllGrinderGames: (games, p) => ipcRenderer.invoke('sync-all-grinder-games', games, p),
                                grinderRefreshOwned: () => ipcRenderer.invoke('grinder-refresh-owned'),
                                // --- in-process install (no GRINDER window) ---
                                grinderInstall:   (payload) => ipcRenderer.invoke('grinder-install', payload),
                                grinderCancelInstall: () => ipcRenderer.invoke('grinder-install-cancel'),
                                grinderUninstall: (payload) => ipcRenderer.invoke('grinder-uninstall', payload),
                                grinderDefaultDir: () => ipcRenderer.invoke('grinder-default-dir'),
                                grinderPickDir:    () => ipcRenderer.invoke('grinder-pick-dir'),
                                getDiskSpace:      (p)   => ipcRenderer.invoke('get-disk-space', p),
                                getInstallSize:    (gid) => ipcRenderer.invoke('get-install-size', gid),
                                onGrinderInstallProgress: (cb) => ipcRenderer.on('grinder-install-progress', (e, d) => cb(d)),
                                onWindowRefocused: (cb) => ipcRenderer.on('window-refocused', () => cb()),

                                // --- PLAYLISTS ---
                                getPlaylists:           ()           => ipcRenderer.invoke('get-playlists'),
                                addPlaylist:            (name)       => ipcRenderer.invoke('add-playlist', name),
                                updatePlaylist:         (id, name)   => ipcRenderer.invoke('update-playlist', id, name),
                                deletePlaylist:         (id)         => ipcRenderer.invoke('delete-playlist', id),
                                getPlaylistGames:       (plId)       => ipcRenderer.invoke('get-playlist-games', plId),
                                addGameToPlaylist:      (plId, gId)  => ipcRenderer.invoke('add-game-to-playlist', plId, gId),
                                removeGameFromPlaylist: (plId, gId)  => ipcRenderer.invoke('remove-game-from-playlist', plId, gId),
                                getGamePlaylists:       (gId)        => ipcRenderer.invoke('get-game-playlists', gId),
                                getRecentlyImported:    (limit)      => ipcRenderer.invoke('get-recently-imported', limit),

                                // --- MANUAL ---
                                openManual: () => ipcRenderer.send('open-manual'),

                                // --- WINDOW CONTROLS ---
                                minimizeApp: () => ipcRenderer.send('window-minimize'),
                                maximizeApp: () => ipcRenderer.send('window-maximize'),
                                closeApp: () => ipcRenderer.send('window-close'),

                                // --- COMMAND BAR ---
                                runShellCmd: (cmd) => ipcRenderer.invoke('run-shell-cmd', cmd)
});
