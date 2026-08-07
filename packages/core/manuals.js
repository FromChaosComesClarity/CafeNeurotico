'use strict';
/*
 * @cafeneurotico/core — per-game manuals.
 *
 * Plenty of games, RPGs above all, still expect you to read something: the PDF GOG ships
 * in the game folder, a scanned box manual, a fan-made reference. This keeps a pointer to
 * that file per game so it is one click away from the gamepage.
 *
 * A POINTER, never a copy. EmuLatte downloads manuals from ScreenScraper and therefore owns
 * the files it stores, so its viewer can offer to delete them. Here the file belongs to the
 * user — it is their download, or a file GOG installed — so the only thing this module may
 * ever remove is the association. Deleting the file itself is not ours to do.
 */

function ensureManualSchema(db) {
    if (!db) return;
    try { db.prepare("ALTER TABLE games ADD COLUMN ManualPath TEXT").run(); } catch (e) {}
}

// Anything Chromium can render in an iframe without help. PDF is the realistic case;
// the rest cost nothing to allow and cover the odd README or HTML manual.
const MANUAL_EXTENSIONS = ['pdf', 'htm', 'html', 'txt', 'md'];

const MANUAL_FILTERS = [
    { name: 'Manuals', extensions: MANUAL_EXTENSIONS },
    { name: 'PDF', extensions: ['pdf'] },
    { name: 'All Files', extensions: ['*'] },
];

// { path, exists }. `exists` is checked every time because the file lives outside our
// control — an uninstall or a moved folder can take it away without telling us.
function manualStatus(db, fs, gameId) {
    let p = null;
    try { p = db.prepare("SELECT ManualPath FROM games WHERE id=?").get(gameId)?.ManualPath || null; } catch {}
    if (!p) return { path: null, exists: false };
    let exists = false;
    try { exists = fs.existsSync(p); } catch {}
    return { path: p, exists };
}

function setManual(db, gameId, filePath) {
    try { db.prepare("UPDATE games SET ManualPath=? WHERE id=?").run(filePath || null, gameId); return true; }
    catch { return false; }
}

// Forget the association. The file on disk is deliberately left alone.
function clearManual(db, gameId) { return setManual(db, gameId, null); }

module.exports = { ensureManualSchema, manualStatus, setManual, clearManual, MANUAL_FILTERS, MANUAL_EXTENSIONS };
