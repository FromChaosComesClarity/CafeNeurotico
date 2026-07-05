const { app, BrowserWindow, ipcMain, dialog, net, session, shell, Menu, Notification, nativeImage } = require('electron');
app.setName('cafeneurotico');
const path = require('path');
const os = require('os');
const Database = require('better-sqlite3');
const { registerSharedHandlers } = require('../../packages/core/shared-ipc.js');
const fs = require('fs');
const { exec, execFile, spawn } = require('child_process');

const https = require('https');

// Embedded SVG icons for the menu installer
const CNGM_SVG_B64 = 'PHN2ZyB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgdmlld0JveD0iMCAwIDUxMiA1MTIiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CiAgPCEtLSBCYXNlIEJhY2tncm91bmQgLS0+CiAgPHJlY3Qgd2lkdGg9IjUxMiIgaGVpZ2h0PSI1MTIiIHJ4PSIxMTIiIGZpbGw9IiMyQzFFMTYiLz4KICAKICA8IS0tIE91dGVyIENvbm5lY3RvcnMgLS0+CiAgPHBhdGggZD0iTSAyNCAyNTYgSCAxMTYiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI0Q0QTM3MyIgc3Ryb2tlLXdpZHRoPSIxMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+CiAgPGNpcmNsZSBjeD0iNzAiIGN5PSIyNTYiIHI9IjgiIGZpbGw9IiNENEEzNzMiLz4KICA8cGF0aCBkPSJNIDM5NiAyNTYgSCA0ODgiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI0Q0QTM3MyIgc3Ryb2tlLXdpZHRoPSIxMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+CiAgPGNpcmNsZSBjeD0iNDQyIiBjeT0iMjU2IiByPSI4IiBmaWxsPSIjRDRBMzczIi8+CgogIDwhLS0gVGhlIFBpbGwgQmVhbiBCb2R5IC0tPgogIDxyZWN0IHg9IjExNiIgeT0iODAiIHdpZHRoPSIyODAiIGhlaWdodD0iMzUyIiByeD0iMTQwIiBmaWxsPSIjNDMyODE4IiBzdHJva2U9IiNENEEzNzMiIHN0cm9rZS13aWR0aD0iMjAiLz4KCiAgPCEtLSBUaGUgUy1DcmFjayBFcmFzZXIgKFNwbGl0cyB0aGUgYmVhbiB1c2luZyBiYWNrZ3JvdW5kIGNvbG9yKSAtLT4KICA8cGF0aCBkPSJNIDI1NiAyNCBWIDEzNiBMIDIxNiAxNzYgViAyMTYgTCAyOTYgMjk2IFYgMzM2IEwgMjU2IDM3NiBWIDQ4OCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjMkMxRTE2IiBzdHJva2Utd2lkdGg9IjI4IiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+CgogIDwhLS0gVGhlIEdsb3dpbmcgUy1DcmFjayBDaXJjdWl0IFRyYWNlIC0tPgogIDxwYXRoIGQ9Ik0gMjU2IDI0IFYgMTM2IEwgMjE2IDE3NiBWIDIxNiBMIDI5NiAyOTYgViAzMzYgTCAyNTYgMzc2IFYgNDg4IiBmaWxsPSJub25lIiBzdHJva2U9IiNGRkU2QTciIHN0cm9rZS13aWR0aD0iOCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPgoKICA8IS0tIENpcmN1aXQgTm9kZXMgYWxvbmcgdGhlIHRyYWNlIC0tPgogIDxjaXJjbGUgY3g9IjI1NiIgY3k9IjEzNiIgcj0iOCIgZmlsbD0iI0ZGRTZBNyIvPgogIDxjaXJjbGUgY3g9IjIxNiIgY3k9IjE3NiIgcj0iOCIgZmlsbD0iI0ZGRTZBNyIvPgogIDxjaXJjbGUgY3g9IjIxNiIgY3k9IjIxNiIgcj0iOCIgZmlsbD0iI0ZGRTZBNyIvPgogIDxjaXJjbGUgY3g9IjI1NiIgY3k9IjI1NiIgcj0iMTIiIGZpbGw9IiNGRkU2QTciLz4gPCEtLSBDb3JlIENlbnRlciBOb2RlIC0tPgogIDxjaXJjbGUgY3g9IjI5NiIgY3k9IjI5NiIgcj0iOCIgZmlsbD0iI0ZGRTZBNyIvPgogIDxjaXJjbGUgY3g9IjI5NiIgY3k9IjMzNiIgcj0iOCIgZmlsbD0iI0ZGRTZBNyIvPgogIDxjaXJjbGUgY3g9IjI1NiIgY3k9IjM3NiIgcj0iOCIgZmlsbD0iI0ZGRTZBNyIvPgoKICA8IS0tIEdvbGRlbiBPdXRlciBCb3JkZXIgKERyYXduIGxhc3QgdG8gb3ZlcmxheSBwZXJmZWN0bHkpIC0tPgogIDxyZWN0IHg9IjI0IiB5PSIyNCIgd2lkdGg9IjQ2NCIgaGVpZ2h0PSI0NjQiIHJ4PSI4OCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjOEI1QTJCIiBzdHJva2Utd2lkdGg9IjEyIi8+Cjwvc3ZnPgo=';
const GRINDER_SVG_B64 = 'PHN2ZyB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgdmlld0JveD0iMCAwIDUxMiA1MTIiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CiAgPHJlY3Qgd2lkdGg9IjUxMiIgaGVpZ2h0PSI1MTIiIHJ4PSIxMTIiIGZpbGw9IiMyQzFFMTYiLz4KICAKICA8Y2lyY2xlIGN4PSIyNTYiIGN5PSI2NCIgcj0iOCIgZmlsbD0iI0ZGRTZBNyIvPgogIDxjaXJjbGUgY3g9IjI1NiIgY3k9IjkyIiByPSI4IiBmaWxsPSIjRkZFNkE3Ii8+CgogIDxwYXRoIGQ9Ik0gMTM2IDEyNCBMIDM3NiAxMjQgTCAzMjYgMjEwIEwgMTg2IDIxMCBaIiBmaWxsPSIjNDMyODE4IiBzdHJva2U9IiNENEEzNzMiIHN0cm9rZS13aWR0aD0iMTYiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KICAKICA8cmVjdCB4PSIxNjYiIHk9IjIxMCIgd2lkdGg9IjE4MCIgaGVpZ2h0PSIxODAiIHJ4PSIzMiIgZmlsbD0iIzQzMjgxOCIgc3Ryb2tlPSIjRDRBMzczIiBzdHJva2Utd2lkdGg9IjE2Ii8+CgogIDxwYXRoIGQ9Ik0gMjE2IDI2MCBIIDI5NiIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjRkZFNkE3IiBzdHJva2Utd2lkdGg9IjEyIiBzdHJva2UtbGluZWNhcD0icm91bmQiLz4KICA8cGF0aCBkPSJNIDIxNiAzMDAgSCAyOTYiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI0ZGRTZBNyIgc3Ryb2tlLXdpZHRoPSIxMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+CiAgPHBhdGggZD0iTSAyMTYgMzQwIEggMjk2IiBmaWxsPSJub25lIiBzdHJva2U9IiNGRkU2QTciIHN0cm9rZS13aWR0aD0iMTIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPgoKICA8cGF0aCBkPSJNIDIwNiAzOTAgViA0MzAgQyAyMDYgNDQxIDIxNSA0NTAgMjI2IDQ1MCBIIDI4NiBDIDI5NyA0NTAgMzA2IDQ0MSAzMDYgNDMwIFYgMzkwIiBmaWxsPSIjNDMyODE4IiBzdHJva2U9IiNENEEzNzMiIHN0cm9rZS13aWR0aD0iMTYiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KCiAgPHBhdGggZD0iTSAzNDYgMjcwIEggNDIwIiBmaWxsPSJub25lIiBzdHJva2U9IiNENEEzNzMiIHN0cm9rZS13aWR0aD0iMTYiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPgogIAogIDxjaXJjbGUgY3g9IjM0NiIgY3k9IjI3MCIgcj0iNiIgZmlsbD0iI0ZGRTZBNyIvPgoKICA8Y2lyY2xlIGN4PSI0MzYiIGN5PSIyNzAiIHI9IjE2IiBmaWxsPSIjRkZFNkE3Ii8+CgogIDxyZWN0IHg9IjI0IiB5PSIyNCIgd2lkdGg9IjQ2NCIgaGVpZ2h0PSI0NjQiIHJ4PSI4OCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjOEI1QTJCIiBzdHJva2Utd2lkdGg9IjEyIi8+Cjwvc3ZnPgo=';
const CREMA_SVG_B64    = 'PHN2ZyB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgdmlld0JveD0iMCAwIDUxMiA1MTIiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CiAgPCEtLSBCYXNlIEJhY2tncm91bmQgLS0+CiAgPHJlY3Qgd2lkdGg9IjUxMiIgaGVpZ2h0PSI1MTIiIHJ4PSIxMTIiIGZpbGw9IiMyQzFFMTYiLz4KICAKICA8IS0tIEdvbGRlbiBJbm5lciBCb3JkZXIgLS0+CiAgPHJlY3QgeD0iMjQiIHk9IjI0IiB3aWR0aD0iNDY0IiBoZWlnaHQ9IjQ2NCIgcng9Ijg4IiBmaWxsPSJub25lIiBzdHJva2U9IiM4QjVBMkIiIHN0cm9rZS13aWR0aD0iMTIiLz4KCiAgPCEtLSBDb2ZmZWUgQ3VwIEhhbmRsZSAtLT4KICA8cGF0aCBkPSJNIDM4MCAyNTYgQyA0OTAgMjU2LCA0OTAgMTUwLCAzODAgMTUwIiBmaWxsPSJub25lIiBzdHJva2U9IiNENEEzNzMiIHN0cm9rZS13aWR0aD0iMjQiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPgoKICA8IS0tIEVzcHJlc3NvIEN1cCBCYXNlIC0tPgogIDxjaXJjbGUgY3g9IjI1NiIgY3k9IjI1NiIgcj0iMTYwIiBmaWxsPSIjNDMyODE4IiBzdHJva2U9IiNENEEzNzMiIHN0cm9rZS13aWR0aD0iMTYiLz4KCiAgPCEtLSBDcmVtYSAvIFZpbnlsIFN3aXJscyAtLT4KICA8cGF0aCBkPSJNIDI1NiAxMzYgQSAxMjAgMTIwIDAgMCAxIDM3NiAyNTYiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI0Q0QTM3MyIgc3Ryb2tlLXdpZHRoPSIxNiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+CiAgPHBhdGggZD0iTSAyNTYgMzc2IEEgMTIwIDEyMCAwIDAgMSAxMzYgMjU2IiBmaWxsPSJub25lIiBzdHJva2U9IiNENEEzNzMiIHN0cm9rZS13aWR0aD0iMTYiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPgogIDxwYXRoIGQ9Ik0gMTg2IDI1NiBBIDcwIDcwIDAgMCAxIDI1NiAxODYiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI0ZGRTZBNyIgc3Ryb2tlLXdpZHRoPSIxMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+CiAgPHBhdGggZD0iTSAzMjYgMjU2IEEgNzAgNzAgMCAwIDEgMjU2IDMyNiIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjRkZFNkE3IiBzdHJva2Utd2lkdGg9IjEyIiBzdHJva2UtbGluZWNhcD0icm91bmQiLz4KCiAgPCEtLSBHYW1lcGFkIEFCWFkgQnV0dG9ucyAtLT4KICA8IS0tIFRvcCBCdXR0b24gKFkvVHJpYW5nbGUpIC0tPgogIDxjaXJjbGUgY3g9IjI1NiIgY3k9IjIwNCIgcj0iMTgiIGZpbGw9IiNGRkU2QTciLz4KICA8IS0tIEJvdHRvbSBCdXR0b24gKEEvQ3Jvc3MpIC0tPgogIDxjaXJjbGUgY3g9IjI1NiIgY3k9IjMwOCIgcj0iMTgiIGZpbGw9IiNGRkU2QTciLz4KICA8IS0tIExlZnQgQnV0dG9uIChYL1NxdWFyZSkgLS0+CiAgPGNpcmNsZSBjeD0iMjA0IiBjeT0iMjU2IiByPSIxOCIgZmlsbD0iI0ZGRTZBNyIvPgogIDwhLS0gUmlnaHQgQnV0dG9uIChCL0NpcmNsZSkgLS0+CiAgPGNpcmNsZSBjeD0iMzA4IiBjeT0iMjU2IiByPSIxOCIgZmlsbD0iI0ZGRTZBNyIvPgo8L3N2Zz4K';
const EMULATTE_SVG_B64 = 'PHN2ZyB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgdmlld0JveD0iMCAwIDUxMiA1MTIiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CiAgPCEtLSBCYXNlIGJhY2tncm91bmQgLS0+CiAgPHJlY3Qgd2lkdGg9IjUxMiIgaGVpZ2h0PSI1MTIiIHJ4PSIxMTIiIGZpbGw9IiMyQzFFMTYiLz4KICA8IS0tIE91dGVyIGJvcmRlciAtLT4KICA8cmVjdCB4PSIyNCIgeT0iMjQiIHdpZHRoPSI0NjQiIGhlaWdodD0iNDY0IiByeD0iODgiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzhCNUEyQiIgc3Ryb2tlLXdpZHRoPSIxMiIvPgoKICA8IS0tIENvZmZlZSBjdXAgYm9keSAtLT4KICA8cGF0aCBkPSJNIDE0MCAxODAgTCAzNzIgMTgwIEwgMzQwIDM5MCBDIDMzNiA0MTAgMzE4IDQyNCAyOTggNDI0IEwgMjE0IDQyNCBDIDE5NCA0MjQgMTc2IDQxMCAxNzIgMzkwIFoiCiAgICAgICAgZmlsbD0iIzQzMjgxOCIgc3Ryb2tlPSIjRDRBMzczIiBzdHJva2Utd2lkdGg9IjE2IiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+CgogIDwhLS0gQ3VwIGhhbmRsZSAtLT4KICA8cGF0aCBkPSJNIDM3MiAyMzAgQyA0NDAgMjMwIDQ0MCAzMTAgMzcyIDMxMCIKICAgICAgICBmaWxsPSJub25lIiBzdHJva2U9IiNENEEzNzMiIHN0cm9rZS13aWR0aD0iMjAiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPgoKICA8IS0tIENhcnRyaWRnZSB0b3AgKGdhbWUgc2xvdCkgLS0+CiAgPHJlY3QgeD0iMTYwIiB5PSIxNDAiIHdpZHRoPSIxOTIiIGhlaWdodD0iNTAiIHJ4PSIxMCIKICAgICAgICBmaWxsPSIjNDMyODE4IiBzdHJva2U9IiNENEEzNzMiIHN0cm9rZS13aWR0aD0iMTQiLz4KICA8IS0tIENhcnRyaWRnZSBub3RjaCAtLT4KICA8cmVjdCB4PSIyMjAiIHk9IjE0NSIgd2lkdGg9IjcyIiBoZWlnaHQ9IjIwIiByeD0iNCIgZmlsbD0iIzJDMUUxNiIvPgoKICA8IS0tIFN0ZWFtIHdpc3BzIC0tPgogIDxwYXRoIGQ9Ik0gMjIwIDE0MCBDIDIxMCAxMTAgMjMwIDkwIDIyMCA2NSIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjRkZFNkE3IiBzdHJva2Utd2lkdGg9IjgiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgb3BhY2l0eT0iMC42Ii8+CiAgPHBhdGggZD0iTSAyNTYgMTQwIEMgMjQ2IDEwNSAyNjYgODAgMjU2IDUwIiAgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjRkZFNkE3IiBzdHJva2Utd2lkdGg9IjgiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgb3BhY2l0eT0iMC42Ii8+CiAgPHBhdGggZD0iTSAyOTIgMTQwIEMgMjgyIDExMCAzMDIgOTAgMjkyIDY1IiBmaWxsPSJub25lIiBzdHJva2U9IiNGRkU2QTciIHN0cm9rZS13aWR0aD0iOCIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBvcGFjaXR5PSIwLjYiLz4KPC9zdmc+Cg==';

async function searchHltb(gameName) {
    const initData = await new Promise((resolve, reject) => {
        const req = https.get(`https://howlongtobeat.com/api/bleed/init?t=${Date.now()}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'referer': 'https://howlongtobeat.com/',
            }
        }, res => {
            let body = '';
            res.on('data', c => body += c);
            res.on('end', () => { try { resolve(JSON.parse(body)); } catch(e) { reject(e); } });
        });
        req.on('error', reject);
        req.setTimeout(10000, () => { req.destroy(); reject(new Error('timeout')); });
    });
    const { token, hpKey, hpVal } = initData;
    const payload = {
        searchType: 'games', searchTerms: gameName.trim().split(' '),
        searchPage: 1, size: 5,
        searchOptions: {
            games: { userId: 0, platform: '', sortCategory: 'popular', rangeCategory: 'main', rangeTime: { min: 0, max: 0 }, gameplay: { perspective: '', flow: '', genre: '', difficulty: '' }, rangeYear: { min: 0, max: 0 }, modifier: '' },
            users: { sortCategory: 'postcount' }, lists: { sortCategory: 'all' },
            filter: '', sort: 0, randomizer: 0
        },
        useCache: true
    };
    if (hpKey) payload[hpKey] = hpVal;
    const body = JSON.stringify(payload);
    return new Promise((resolve, reject) => {
        const req = https.request({ hostname: 'howlongtobeat.com', path: '/api/bleed', method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body),
                'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'origin': 'https://howlongtobeat.com', 'referer': 'https://howlongtobeat.com/search',
                'x-auth-token': token, 'x-hp-key': hpKey, 'x-hp-val': hpVal }
        }, res => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => { try { resolve(JSON.parse(data).data || []); } catch(e) { reject(e); } });
        });
        req.on('error', reject);
        req.setTimeout(15000, () => { req.destroy(); reject(new Error('timeout')); });
        req.write(body); req.end();
    });
}

let baseDir;
if (process.env.APPIMAGE) {
    baseDir = path.dirname(process.env.APPIMAGE);
} else if (app.isPackaged) {
    baseDir = path.dirname(process.execPath);
} else {
    baseDir = __dirname;
}

const configDir = path.join(baseDir, 'GameManagerConfig');

// Write a minimal game entry to GRINDER's DB (called before opening GRINDER for setup)
function ensureInGrinderDb(id, title, store, appId, installed) {
    const home = os.homedir();
    const candidates = [
        path.join(home, '.config', 'grinder', 'grinder.db'),
        path.join(home, '.config', 'GRINDER', 'grinder.db'),
        path.join(baseDir, 'GRINDERConfig', 'grinder.db'),
    ];
    const gdbPath = candidates.find(p => fs.existsSync(p));
    if (!gdbPath) return false; // GRINDER has never been launched — can't write yet
    try {
        const gdb = new Database(gdbPath, { timeout: 5000 });
        gdb.prepare(`INSERT OR IGNORE INTO games (id, title, store, app_id, installed) VALUES (?, ?, ?, ?, ?)`)
           .run(id, title, store, appId || null, installed ? 1 : 0);
        gdb.close();
        return true;
    } catch (e) { console.error('[ensureInGrinderDb]', e); return false; }
}

// Open GRINDER focused on a specific game's setup (called by "Setup with GRINDER" button)
ipcMain.handle('open-grinder-setup', (_, game) => {
    const grinderPath = findGrinderPath();
    if (!grinderPath) return { ok: false, error: 'GRINDER not found.' };

    let grinderGameId = game.GrinderGameId || null;

    if (!grinderGameId) {
        // Determine what ID and store to use for GRINDER
        const steamId = game.SteamAppID ? String(game.SteamAppID).replace(/\.0+$/, '') : null;
        if (steamId) {
            grinderGameId = `steam_${steamId}`;
            ensureInGrinderDb(grinderGameId, game.Game, 'steam', steamId, game.Installed);
            // Link back so verifyAndLaunch routes to GRINDER's headless engine
            if (db) db.prepare("UPDATE games SET GrinderGameId=? WHERE id=?").run(grinderGameId, game.id);
        } else {
            // Others/Physical/non-catalogued — use a deterministic CNGM-prefixed ID
            const safe = (game.Game || 'game').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 32);
            grinderGameId = `cngm_${safe}_${Date.now().toString(36)}`;
            const launchCmd = game.LaunchCommand || '';
            const storeGuess = /grinder.*gog/i.test(launchCmd) ? 'gog'
                             : /grinder.*epic/i.test(launchCmd) ? 'epic'
                             : 'custom';
            ensureInGrinderDb(grinderGameId, game.Game, storeGuess, null, game.Installed);
            // Write back the GrinderGameId to CNGM's DB so future calls reuse it
            if (db) db.prepare("UPDATE games SET GrinderGameId=? WHERE id=?").run(grinderGameId, game.id);
        }
    }

    spawnGrinder(['setup', grinderGameId]);
    return { ok: true };
});
const imagesDir = path.join(configDir, 'images');
const trailersDir = path.join(configDir, 'videos');
const dbPath = path.join(configDir, 'games.db');

// YT-DLP Paths
const baseAssetPath = app.isPackaged ? process.resourcesPath : __dirname;
const binDir = path.join(baseAssetPath, 'assets', 'bin', 'linux');
const ytDlpPath = path.join(binDir, 'yt-dlp');
const ffmpegPath = path.join(binDir, 'ffmpeg');
const ytDlpConfigPath = path.join(binDir, 'yt-dlp.conf');

let db;

function getSavedBounds() {
    try {
        const raw = db.prepare("SELECT value FROM settings WHERE key='window_bounds'").get()?.value;
        if (raw) return JSON.parse(raw);
    } catch(e) {}
    return null;
}

function createWindow () {
    const saved = getSavedBounds();
    const win = new BrowserWindow({
        width:  saved?.width  || 1400,
        height: saved?.height || 950,
        x: saved?.x,
        y: saved?.y,
        frame: false,
        show: false,
        backgroundColor: '#2C1E16',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
                                  contextIsolation: true,
                                  nodeIntegration: false,
                                  webSecurity: false
        }
    });

    win.setMenu(null);
    win.loadFile(path.join(__dirname, 'index.html'));

    // When the Manager regains focus (e.g. after using the GRINDER window to
    // install/uninstall), tell the renderer to re-sync install states from the
    // shared DB so the Play/Install buttons reflect external changes.
    win.on('focus', () => { try { win.webContents.send('window-refocused'); } catch {} });

    // Save window size/position when closing
    win.on('close', () => {
        if (!win.isMaximized() && !win.isMinimized()) {
            const b = win.getBounds();
            db.prepare("INSERT OR REPLACE INTO settings (key,value) VALUES ('window_bounds',?)").run(JSON.stringify(b));
        }
    });

    // Show only after the renderer has applied the theme — eliminates blank screen and color flash.
    // Fallback: if renderer never signals within 3s, show anyway.
    const showWin = () => { if (!win.isVisible()) win.show(); };
    ipcMain.once('renderer-ready', showWin);
    win.once('ready-to-show', () => setTimeout(showWin, 3000));
    win.webContents.once('did-finish-load', () => startSteamInstallWatcher(win));
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
    app.quit();
} else {
    app.on('second-instance', () => {
        const w = BrowserWindow.getAllWindows()[0];
        if (w) { if (w.isMinimized()) w.restore(); w.focus(); }
    });
}

app.whenReady().then(() => {
    if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });
    if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true });
    if (!fs.existsSync(trailersDir)) fs.mkdirSync(trailersDir, { recursive: true });

    try {
        db = new Database(dbPath);
        db.pragma('journal_mode = WAL');
    // Shared IPC handlers live in packages/core/shared-ipc.js (single source of truth).
    registerSharedHandlers({ db, baseDir, trailersDir, ytDlpPath, ytDlpConfigPath, ffmpegPath, getBeautifulName, getOldCrushedName });
        db.prepare(`
        CREATE TABLE IF NOT EXISTS games (
            id INTEGER PRIMARY KEY AUTOINCREMENT, Store TEXT, FAV TEXT, WANT_TO_PLAY TEXT,
            PLAYING TEXT, FINISHED TEXT, Game TEXT, METACRITIC TEXT, RELEASED TEXT, GENRE TEXT,
            DEV TEXT, PUB TEXT, Acquired TEXT, HLTB_Main TEXT, HLTB_Main_Side TEXT, HLTB_Comp TEXT,
            CoverArt TEXT, Screenshot TEXT, Description TEXT, Tags TEXT,
            SteamAppID TEXT, SteamRating TEXT, Price TEXT, LowestPrice TEXT,
            Coop TEXT, NumPlayers TEXT, SimilarGames TEXT, LaunchCommand TEXT
        )
        `).run();

        try { db.prepare("ALTER TABLE games ADD COLUMN ProtonTier TEXT").run(); } catch(e) {}
        try { db.prepare("ALTER TABLE games ADD COLUMN LastPlayed INTEGER DEFAULT 0").run(); } catch(e) {}
        try { db.prepare("ALTER TABLE games ADD COLUMN Playtime INTEGER DEFAULT 0").run(); } catch(e) {}       // minutes (Steam playtime_forever)
        try { db.prepare("ALTER TABLE games ADD COLUMN Playtime2wk INTEGER DEFAULT 0").run(); } catch(e) {}    // minutes (Steam playtime_2weeks)
        try { db.prepare("ALTER TABLE games ADD COLUMN DiskSize INTEGER DEFAULT 0").run(); } catch(e) {}       // bytes (on-disk install size)
        try { db.prepare("ALTER TABLE games ADD COLUMN AchUnlocked INTEGER DEFAULT 0").run(); } catch(e) {}
        try { db.prepare("ALTER TABLE games ADD COLUMN AchTotal INTEGER DEFAULT 0").run(); } catch(e) {}

        try { db.prepare("ALTER TABLE games ADD COLUMN HeroArt TEXT").run(); } catch(e) {}
        try { db.prepare("ALTER TABLE games ADD COLUMN Logo TEXT").run(); } catch(e) {}
        try { db.prepare("ALTER TABLE games ADD COLUMN Icon TEXT").run(); } catch(e) {}
        try { db.prepare("ALTER TABLE games ADD COLUMN SteamDesc TEXT").run(); } catch(e) {}
        try { db.prepare("ALTER TABLE games ADD COLUMN SteamTrailer TEXT").run(); } catch(e) {}
        try { db.prepare("ALTER TABLE games ADD COLUMN Description_i18n TEXT DEFAULT ''").run(); } catch(e) {}
        try { db.prepare("ALTER TABLE games ADD COLUMN Franchise TEXT DEFAULT ''").run(); } catch(e) {}
        try { db.prepare("ALTER TABLE games ADD COLUMN IGDBTrailer TEXT DEFAULT ''").run(); } catch(e) {}
        try { db.prepare("ALTER TABLE games ADD COLUMN Installed INTEGER DEFAULT 1").run(); } catch(e) {}
        try { db.prepare("ALTER TABLE games ADD COLUMN GrinderGameId TEXT").run(); } catch(e) {}
        try { db.prepare("ALTER TABLE games ADD COLUMN LaunchCommands TEXT DEFAULT NULL").run(); } catch(e) {}
        // One-time migration: rename the legacy launch scheme heroic://launch/… → grinder://launch/… (Heroic-era leftover)
        try { db.prepare("UPDATE games SET LaunchCommand = REPLACE(LaunchCommand, 'heroic://launch/', 'grinder://launch/') WHERE LaunchCommand LIKE '%heroic://launch/%'").run(); } catch(e) {}
        try { db.prepare("UPDATE games SET LaunchCommands = REPLACE(LaunchCommands, 'heroic://launch/', 'grinder://launch/') WHERE LaunchCommands LIKE '%heroic://launch/%'").run(); } catch(e) {}
        try { db.prepare("ALTER TABLE games ADD COLUMN date_added INTEGER DEFAULT 0").run(); } catch(e) {}
        try { db.prepare("ALTER TABLE games ADD COLUMN kb_played INTEGER DEFAULT 0").run(); } catch(e) {}
        try { db.prepare("ALTER TABLE games ADD COLUMN FreeToPlay INTEGER DEFAULT 0").run(); } catch(e) {} // 1 = Steam free-to-play (played-free-games)
        try { db.prepare("ALTER TABLE games ADD COLUMN Hidden INTEGER DEFAULT 0").run(); } catch(e) {}      // 1 = user-hidden from all library views
        try {
            db.prepare(`CREATE TRIGGER IF NOT EXISTS auto_date_added
                AFTER INSERT ON games
                WHEN NEW.date_added IS NULL OR NEW.date_added = 0
                BEGIN UPDATE games SET date_added = CAST(strftime('%s','now') AS INTEGER) WHERE id = NEW.id; END`).run();
        } catch(e) {}
        // A blank Store leaves a game uncategorizable; file it under "Others" (same bucket GRINDER games use).
        try { db.prepare("UPDATE games SET Store = 'Others' WHERE Store IS NULL OR TRIM(Store) = ''").run(); } catch(e) {}
        try {
            db.prepare(`CREATE TRIGGER IF NOT EXISTS auto_store_others
                AFTER INSERT ON games
                WHEN NEW.Store IS NULL OR TRIM(NEW.Store) = ''
                BEGIN UPDATE games SET Store = 'Others' WHERE id = NEW.id; END`).run();
        } catch(e) {}

        db.prepare(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)`).run();
        db.prepare(`CREATE TABLE IF NOT EXISTS playlists (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL)`).run();
        db.prepare(`CREATE TABLE IF NOT EXISTS playlist_games (playlist_id INTEGER NOT NULL, game_id INTEGER NOT NULL, sort_order INTEGER DEFAULT 0, PRIMARY KEY (playlist_id, game_id), FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE, FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE)`).run();
    } catch (err) {
        console.error("Could not connect to database:", err);
    }
    createWindow();
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

// In the unified suite GRINDER is THIS binary invoked with a leading 'grinder' arg —
// there is no separate GRINDER.AppImage to locate, so this always resolves.
function findGrinderPath() {
    return process.env.APPIMAGE || process.execPath;
}

// Spawn the GRINDER face as a detached process ('grinder' identity, own lock + GUI).
// Packaged:   <CafeNeurotico.AppImage> grinder <subArgs...>
// Dev:        <electron> <repoRoot> grinder <subArgs...>
function spawnGrinder(subArgs) {
    const bin  = process.env.APPIMAGE || process.execPath;
    const args = process.env.APPIMAGE
        ? ['grinder', ...subArgs]
        : [path.join(__dirname, '..', '..'), 'grinder', ...subArgs];
    const child = spawn(bin, args, { detached: true, stdio: 'ignore' });
    child.unref();
    return child;
}

// Returns a Map<appId, grinderId> from GRINDER's DB for grinder:// launch routing
function getGrinderMap() {
    const home = os.homedir();
    const candidates = [
        path.join(home, '.config', 'grinder', 'grinder.db'),
        path.join(home, '.config', 'GRINDER', 'grinder.db'),
        path.join(baseDir, 'GRINDERConfig', 'grinder.db'),
    ];
    const gdbPath = candidates.find(p => fs.existsSync(p));
    if (!gdbPath) return new Map();
    try {
        const gdb = new Database(gdbPath, { timeout: 5000, readonly: true });
        const rows = gdb.prepare('SELECT id, app_id FROM games WHERE app_id IS NOT NULL').all();
        gdb.close();
        return new Map(rows.map(r => [String(r.app_id), String(r.id)]));
    } catch (e) { console.error('[getGrinderMap]', e); return new Map(); }
}

// In-process GRINDER engine for launching GOG/Epic games WITHOUT spawning a
// second AppImage process (Electron AppImages relaunching themselves is flaky).
// Points at GRINDER's own data dir (~/.config/grinder) so it reads the same DB,
// prefixes and Proton settings the grinder face uses.
const grinderEngine = require('../../packages/core/grinder-engine.js');
let _grinderEngineDb = null;
let _grinderProgressCb = null;   // set per install/uninstall to route progress to the renderer
let _grinderBusy = false;        // serialize install/uninstall (one at a time)
function ensureGrinderEngine() {
    if (_grinderEngineDb) return true;
    const home = os.homedir();
    const gdbPath = [
        path.join(home, '.config', 'grinder', 'grinder.db'),
        path.join(home, '.config', 'GRINDER', 'grinder.db'),
        path.join(baseDir, 'GRINDERConfig', 'grinder.db'),
    ].find(p => fs.existsSync(p));
    if (!gdbPath) return false;
    const gConfigDir  = path.dirname(gdbPath);
    const engineBinDir = app.isPackaged
        ? path.join(process.resourcesPath, 'assets', 'bin', 'linux')
        : path.join(__dirname, 'assets', 'bin', 'linux');
    try {
        _grinderEngineDb = new Database(gdbPath, { timeout: 5000 });
    } catch (e) { console.error('[grinder-engine] DB open failed:', e); _grinderEngineDb = null; return false; }
    grinderEngine.init({
        configDir:   gConfigDir,
        prefixesDir: path.join(gConfigDir, 'prefixes'),
        logDir:      path.join(gConfigDir, 'game_logs'),
        binDir:      engineBinDir,
        appImageDir: baseDir,
        homeDir:     home,
        db:          _grinderEngineDb,
        onProgress:  (data) => { try { _grinderProgressCb && _grinderProgressCb(data); } catch {} },
    });
    return true;
}

// Split a GrinderGameId like "gog_2049187585" / "epic_<hex>" into { store, appId }.
function parseGrinderId(gid) {
    if (!gid) return null;
    const m = String(gid).match(/^(gog|epic)_(.+)$/i);
    if (!m) return null;            // custom (mp...) ids aren't gogdl/legendary-installable
    return { store: m[1].toLowerCase(), appId: m[2] };
}

function grinderDefaultDir() {
    try { return _grinderEngineDb?.prepare("SELECT value FROM settings WHERE key='default_install_dir'").get()?.value || ''; }
    catch { return ''; }
}

// Pre-install: free disk space at a path + download/disk size for a GOG/Epic title (shared engine).
ipcMain.handle('get-disk-space', (_, p) => grinderEngine.getDiskSpace(p));
ipcMain.handle('get-install-size', async (_, grinderGameId) => {
    if (!ensureGrinderEngine()) return null;
    const parsed = parseGrinderId(grinderGameId); if (!parsed) return null;
    if (parsed.store === 'gog') {
        let platform = null;
        try { platform = _grinderEngineDb.prepare("SELECT platform FROM games WHERE app_id=? AND store=?").get(parsed.appId, parsed.store)?.platform; } catch {}
        return grinderEngine.gogInstallInfo(parsed.appId, platform || 'linux');
    }
    if (parsed.store === 'epic') return grinderEngine.epicInstallInfo(parsed.appId);
    return null;
});

// Headless owned-library refresh: pull newly-purchased GOG/Epic titles from the
// store APIs into grinder.db (import-only, installed=0). The refresh-library flow
// runs this before sync-all-grinder-games so the new titles enter CNGM's library.
ipcMain.handle('grinder-refresh-owned', async () => {
    if (!ensureGrinderEngine()) return { available: false };
    try {
        const r = await grinderEngine.syncOwnedLibrary();
        return { available: true, ...r };
    } catch (e) {
        return { available: true, error: e.message };
    }
});

// In-process install of a GOG/Epic game via the shared engine; progress streams
// to the calling renderer over 'grinder-install-progress'.
ipcMain.handle('grinder-install', async (event, { gameId, grinderGameId, installDir } = {}) => {
    if (_grinderBusy) return { ok: false, error: 'Another install/uninstall is in progress.' };
    if (!ensureGrinderEngine()) return { ok: false, error: 'GRINDER data not found.' };
    const parsed = parseGrinderId(grinderGameId);
    if (!parsed) return { ok: false, error: 'This game cannot be installed in-process (not a GOG/Epic title).' };
    const platform = (() => {
        try { return _grinderEngineDb.prepare("SELECT platform FROM games WHERE app_id=? AND store=?").get(parsed.appId, parsed.store)?.platform; }
        catch { return null; }
    })();
    const dir = installDir || grinderDefaultDir() || undefined;
    _grinderBusy = true;
    // Watch for an error/cancel event so we don't mark a failed or cancelled download as installed.
    let installErr = null;
    _grinderProgressCb = (data) => {
        if (data && data.step === 'error') installErr = data.message || 'Install failed.';
        try { event.sender.send('grinder-install-progress', data); } catch {}
    };
    try {
        await grinderEngine.headlessInstall(parsed.store, parsed.appId, platform, dir);
        if (installErr) return { ok: false, error: installErr };
        if (gameId && db) { try { db.prepare("UPDATE games SET Installed=1 WHERE id=?").run(gameId); } catch {} }
        try { event.sender.send('install-status-updated'); } catch {}
        return { ok: true };
    } catch (e) {
        return { ok: false, error: e.message };
    } finally {
        _grinderBusy = false; _grinderProgressCb = null;
    }
});

// Cancel the in-flight in-process download (kills gogdl/legendary). The install
// promise then resolves as failed and the renderer's queue advances to the next.
ipcMain.handle('grinder-install-cancel', () => {
    if (!_grinderEngineDb) return { ok: false };
    return { ok: grinderEngine.cancelActiveInstall() };
});

ipcMain.handle('grinder-uninstall', async (event, { gameId, grinderGameId } = {}) => {
    if (_grinderBusy) return { ok: false, error: 'Another install/uninstall is in progress.' };
    if (!ensureGrinderEngine()) return { ok: false, error: 'GRINDER data not found.' };
    const parsed = parseGrinderId(grinderGameId);
    if (!parsed) return { ok: false, error: 'This game cannot be uninstalled in-process (not a GOG/Epic title).' };
    _grinderBusy = true;
    _grinderProgressCb = (data) => { try { event.sender.send('grinder-install-progress', data); } catch {} };
    try {
        await grinderEngine.headlessUninstall(parsed.store, parsed.appId);
        if (gameId && db) { try { db.prepare("UPDATE games SET Installed=0 WHERE id=?").run(gameId); } catch {} }
        try { event.sender.send('install-status-updated'); } catch {}
        return { ok: true };
    } catch (e) {
        return { ok: false, error: e.message };
    } finally {
        _grinderBusy = false; _grinderProgressCb = null;
    }
});

// Default install dir + a native folder picker for the install dialog.
ipcMain.handle('grinder-default-dir', () => { ensureGrinderEngine(); return grinderDefaultDir(); });
ipcMain.handle('grinder-pick-dir', async () => {
    const r = await dialog.showOpenDialog(win, { properties: ['openDirectory', 'createDirectory'] });
    return (!r.canceled && r.filePaths[0]) ? r.filePaths[0] : null;
});

// CREMA is now a face of this same binary (launched with --crema), so it's always available.
ipcMain.handle('check-crema', () => true);

function findEmuLattePath() {
    try {
        const f = fs.readdirSync(baseDir).find(n => /^EmuLatte\.(AppImage|appimage)$/i.test(n));
        return f ? path.join(baseDir, f) : null;
    } catch(e) { return null; }
}
ipcMain.handle('check-emulatte', () => !!findEmuLattePath());

// ── INSTALL STATUS HELPERS ────────────────────────────────────────────────
function getSteamLibraryPaths() {
    const home = os.homedir();
    const roots = [
        path.join(home, '.local', 'share', 'Steam'),
        path.join(home, '.var', 'app', 'com.valvesoftware.Steam', 'data', 'steam'),
        path.join(home, '.steam', 'steam'),
    ];
    const dirs = new Set();
    for (const root of roots) {
        const sa = path.join(root, 'steamapps');
        if (!fs.existsSync(sa)) continue;
        dirs.add(sa);
        try {
            const vdf = path.join(sa, 'libraryfolders.vdf');
            if (fs.existsSync(vdf)) {
                const content = fs.readFileSync(vdf, 'utf8');
                for (const m of content.matchAll(/"path"\s+"([^"]+)"/g)) {
                    const extra = path.join(m[1], 'steamapps');
                    if (fs.existsSync(extra)) dirs.add(extra);
                }
            }
        } catch(e) {}
    }
    return [...dirs];
}
function guessLauncherLabel(cmd) {
    if (!cmd) return 'Custom';
    if (/steam:\/\/rungameid/i.test(cmd))         return 'Steam';
    if (/grinder:\/\/launch\/gog/i.test(cmd))      return 'GOG via GRINDER';
    if (/grinder:\/\/launch\/epic/i.test(cmd))     return 'Epic via GRINDER';
    if (cmd.startsWith('itch://'))                return 'itch.io';
    if (cmd.startsWith('pico8-cart:'))            return 'PICO-8';
    if (/^flatpak run/i.test(cmd))               return 'Flatpak';
    if (cmd.startsWith('grinder://'))             return 'GRINDER';
    return 'Custom';
}

function isSteamGameInstalled(appId) {
    if (!appId || appId === 'None' || appId === '') return false;
    const id = String(appId).replace(/\.0+$/, '');
    return getSteamLibraryPaths().some(dir => fs.existsSync(path.join(dir, `appmanifest_${id}.acf`)));
}

// ── Disk footprint scan ──────────────────────────────────────────────────────
function _dirSizeBytes(dir) {
    let total = 0, guard = 0; const stack = [dir];
    while (stack.length && guard < 400000) {
        const d = stack.pop();
        let entries; try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { continue; }
        for (const e of entries) {
            guard++;
            if (e.isSymbolicLink()) continue;
            const p = path.join(d, e.name);
            if (e.isDirectory()) stack.push(p);
            else { try { total += fs.statSync(p).size; } catch {} }
        }
    }
    return total;
}
function _diskStoreBucket(s) {
    s = (s || '').toLowerCase();
    if (s.includes('steam')) return 'Steam'; if (s.includes('gog')) return 'GOG'; if (s.includes('epic')) return 'Epic';
    if (s.includes('itch')) return 'itch.io'; if (s.includes('flatpak')) return 'Flatpak'; if (s.includes('pico')) return 'PICO-8';
    if (s.includes('emulation')) return 'Emulation'; if (s.includes('physical')) return 'Physical'; if (s.includes('apps')) return 'Apps';
    if (s.includes('others')) return 'Others'; return 'Other';
}
ipcMain.handle('disk-get', () => { try { const raw = db.prepare("SELECT value FROM settings WHERE key='disk_usage'").get()?.value; return raw ? JSON.parse(raw) : null; } catch { return null; } });
ipcMain.handle('disk-scan', async () => {
    if (!db) return null;
    const home = os.homedir();
    // Steam: read SizeOnDisk straight from each appmanifest (cheap + exact).
    const steamSizes = new Map();
    for (const dir of getSteamLibraryPaths()) {
        let files; try { files = fs.readdirSync(dir); } catch { continue; }
        for (const f of files) {
            const idm = f.match(/^appmanifest_(\d+)\.acf$/); if (!idm) continue;
            try { const sm = fs.readFileSync(path.join(dir, f), 'utf8').match(/"SizeOnDisk"\s+"(\d+)"/i); if (sm) steamSizes.set(idm[1], parseInt(sm[1], 10)); } catch {}
        }
    }
    // GRINDER (GOG/Epic): install_path → directory size.
    const grinderPaths = new Map();
    const gcands = [path.join(home, '.config', 'grinder', 'grinder.db'), path.join(home, '.config', 'GRINDER', 'grinder.db'), path.join(baseDir, 'GRINDERConfig', 'grinder.db')];
    const gpath = gcands.find(p => fs.existsSync(p));
    if (gpath) { try { const gdb = new Database(gpath, { readonly: true, timeout: 5000 }); for (const r of gdb.prepare("SELECT id, install_path FROM games WHERE installed=1 AND install_path IS NOT NULL AND install_path != ''").all()) grinderPaths.set(String(r.id), r.install_path); gdb.close(); } catch {} }

    const expand = p => (p && p.startsWith('~')) ? path.join(home, p.slice(1)) : p;
    for (const g of db.prepare("SELECT id, SteamAppID, GrinderGameId FROM games").all()) {
        let size = 0;
        const appid = g.SteamAppID ? String(g.SteamAppID).replace(/\.0+$/, '') : '';
        if (appid && steamSizes.has(appid)) size = steamSizes.get(appid);
        else if (g.GrinderGameId && grinderPaths.has(String(g.GrinderGameId))) { const ip = expand(grinderPaths.get(String(g.GrinderGameId))); if (ip && fs.existsSync(ip)) size = _dirSizeBytes(ip); }
        try { db.prepare("UPDATE games SET DiskSize=? WHERE id=?").run(size, g.id); } catch {}
    }
    const rows = db.prepare("SELECT Game, Store, DiskSize FROM games WHERE DiskSize > 0").all();
    let total = 0; const byStore = new Map();
    for (const r of rows) { total += r.DiskSize; const b = _diskStoreBucket(r.Store); byStore.set(b, (byStore.get(b) || 0) + r.DiskSize); }
    const result = {
        ts: Date.now(), totalBytes: total, scanned: rows.length,
        byStore: [...byStore.entries()].map(([store, bytes]) => ({ store, bytes })).sort((a, b) => b.bytes - a.bytes),
        biggest: rows.sort((a, b) => b.DiskSize - a.DiskSize).slice(0, 8).map(r => ({ game: r.Game, bytes: r.DiskSize })),
    };
    try { db.prepare("INSERT OR REPLACE INTO settings (key,value) VALUES ('disk_usage', ?)").run(JSON.stringify(result)); } catch {}
    return result;
});

// ── Achievement completion scan (Steam) ──────────────────────────────────────
const _achEngine = require('../../packages/core/achievements.js');
ipcMain.handle('ach-scan', async () => {
    if (!db) return null;
    const key = db.prepare("SELECT value FROM settings WHERE key='steam_api_key'").get()?.value;
    const steamid = db.prepare("SELECT value FROM settings WHERE key='steam_id'").get()?.value;
    if (!key || !steamid) return { error: 'Steam API key + SteamID required (set them in Connect & Sync).' };
    const targets = db.prepare("SELECT id, SteamAppID FROM games WHERE SteamAppID IS NOT NULL AND TRIM(SteamAppID) != '' AND SteamAppID != 'None'").all()
        .map(g => ({ id: g.id, appid: String(g.SteamAppID).replace(/\.0+$/, '') }));
    const results = await _achEngine.scanLibrary(targets, key, steamid, { limit: 400 });
    const upd = db.prepare("UPDATE games SET AchUnlocked=?, AchTotal=? WHERE id=?");
    db.transaction(() => { for (const r of results) upd.run(r.unlocked, r.total, r.id); })();
    let withAch = 0, completed = 0, sumPct = 0, totalUnlocked = 0, totalAch = 0;
    for (const r of results) { withAch++; totalUnlocked += r.unlocked; totalAch += r.total; sumPct += r.unlocked / r.total; if (r.unlocked === r.total) completed++; }
    const stats = { ts: Date.now(), withAch, completed, avgPct: withAch ? Math.round(sumPct / withAch * 100) : 0, totalUnlocked, totalAch };
    try { db.prepare("INSERT OR REPLACE INTO settings (key,value) VALUES ('ach_stats', ?)").run(JSON.stringify(stats)); } catch {}
    return stats;
});

function resolveInstallState(launchCommand, steamAppId) {
    const cmd = launchCommand || '';
    // GOG/Epic (grinder://) install state is reconciled straight from GRINDER's DB
    // (sync-grinder-installed / sync-all-grinder-games) — the source of truth.
    if (/steam:\/\/rungameid/i.test(cmd) && steamAppId && steamAppId !== 'None' && steamAppId !== '') {
        return isSteamGameInstalled(steamAppId) ? 1 : 0;
    }
    return null;
}

ipcMain.handle('verify-install-status', (e, gameId) => {
    if (!db) return { installed: 1 };
    const game = db.prepare("SELECT id, SteamAppID, LaunchCommand, Installed FROM games WHERE id=?").get(gameId);
    if (!game) return { installed: 1 };
    const installed = resolveInstallState(game.LaunchCommand, game.SteamAppID);
    if (installed !== null) db.prepare("UPDATE games SET Installed=? WHERE id=?").run(installed, gameId);
    return { installed: installed ?? game.Installed ?? 1 };
});

// ── DYNAMIC INSTALL WATCHER ───────────────────────────────────────────────
let steamInstallWatchers = [];
function startSteamInstallWatcher(win) {
    steamInstallWatchers.forEach(w => { try { w.close(); } catch(e) {} });
    steamInstallWatchers = [];
    let debounce = null;
    const onChange = (ev, filename) => {
        if (!filename || !filename.startsWith('appmanifest_')) return;
        clearTimeout(debounce);
        debounce = setTimeout(() => {
            if (!db) return;
            const games = db.prepare("SELECT id, SteamAppID, LaunchCommand FROM games WHERE LaunchCommand IS NOT NULL AND LaunchCommand != ''").all();
            for (const g of games) {
                const s = resolveInstallState(g.LaunchCommand, g.SteamAppID);
                if (s !== null) db.prepare("UPDATE games SET Installed=? WHERE id=?").run(s, g.id);
            }
            if (win) win.webContents.send('install-status-updated');
        }, 1500);
    };
    for (const dir of getSteamLibraryPaths()) {
        try { steamInstallWatchers.push(fs.watch(dir, { persistent: false }, onChange)); } catch(e) {}
    }
}

ipcMain.handle('check-all-install-status', async () => {
    if (!db) return { updated: 0 };
    let updated = 0;

    // ── STEAM: filesystem detection ──────────────────────────────────────────
    const steamGames = db.prepare("SELECT id, SteamAppID, LaunchCommand FROM games WHERE LaunchCommand LIKE '%steam://rungameid%'").all();
    for (const g of steamGames) {
        const s = resolveInstallState(g.LaunchCommand, g.SteamAppID);
        if (s !== null) { db.prepare("UPDATE games SET Installed=? WHERE id=?").run(s, g.id); updated++; }
    }

    // GOG/Epic (grinder://) install state is reconciled from GRINDER's DB via
    // sync-grinder-installed / sync-all-grinder-games — not detected here.

    // ── PHYSICAL / OTHERS / EMULATION / APPS: installed = has launch command ──
    const manualResult = db.prepare(`
        UPDATE games SET Installed = CASE WHEN LaunchCommand IS NOT NULL AND LaunchCommand != '' THEN 1 ELSE 0 END
        WHERE (LOWER(Store) LIKE '%physical%' OR LOWER(Store) LIKE '%others%' OR LOWER(Store) LIKE '%emulation%' OR LOWER(Store) LIKE '%apps%')
          AND LOWER(Store) NOT LIKE '%steam%' AND LOWER(Store) NOT LIKE '%epic%'
          AND LOWER(Store) NOT LIKE '%gog%'
    `).run();
    updated += manualResult.changes;

    return { updated };
});

ipcMain.handle('set-launch-command', (e, gameId, cmd) => {
    if (!db) return false;
    const installed = (cmd && cmd.trim() !== '') ? 1 : 0;
    db.prepare("UPDATE games SET LaunchCommand=?, Installed=? WHERE id=?").run(cmd || '', installed, gameId);
    return true;
});

ipcMain.handle('open-grinder', (_, gameName) => {
    const args = !gameName ? []
              : gameName.startsWith('sync-') ? [gameName]
              : ['search', gameName];
    spawnGrinder(args);
    return { ok: true };
});

// Auto-sync GRINDER installed status into CNGM library.
// installedIds = array of GRINDER game IDs that are installed (from grinderStatus).
// Sets GrinderGameId + Installed=1 for matching GOG/Epic games.
ipcMain.handle('sync-grinder-installed', (_, installedIds) => {
    if (!db || !Array.isArray(installedIds)) return { synced: 0 };
    const idSet = new Set(installedIds);
    let synced = 0;
    const games = db.prepare(
        "SELECT id, LaunchCommand, GrinderGameId FROM games WHERE LaunchCommand LIKE '%grinder://launch/%'"
    ).all();
    for (const g of games) {
        const epicMatch = (g.LaunchCommand || '').match(/grinder:\/\/launch\/epic\/([^"\s]+)/i);
        const gogMatch  = (g.LaunchCommand || '').match(/grinder:\/\/launch\/gog\/([^"\s]+)/i);
        const m = epicMatch || gogMatch;
        if (!m) continue;
        const gid = epicMatch ? `epic_${epicMatch[1]}` : `gog_${gogMatch[1]}`;
        if (idSet.has(gid)) {
            db.prepare("UPDATE games SET GrinderGameId=?, Installed=1 WHERE id=?").run(gid, g.id);
            synced++;
        } else if (g.GrinderGameId) {
            // No longer installed in GRINDER — clear the auto-set override
            db.prepare("UPDATE games SET GrinderGameId=NULL WHERE id=?").run(g.id);
        }
    }
    return { synced };
});

ipcMain.handle('grinder-status', () => {
    const home = os.homedir();
    const grinderPath = findGrinderPath();
    if (!grinderPath) return { found: false, installedGames: [] };

    // Electron uses lowercase app name for userData: ~/.config/grinder/
    const candidates = [
        path.join(home, '.config', 'grinder', 'grinder.db'),   // packaged (actual)
        path.join(home, '.config', 'GRINDER', 'grinder.db'),   // capitalised fallback
        path.join(baseDir, 'GRINDERConfig', 'grinder.db'),     // dev mode fallback
    ];
    const grinderDb = candidates.find(p => fs.existsSync(p));
    if (!grinderDb) return { found: true, path: grinderPath, installedGames: [], error: 'Launch GRINDER once to create its database.' };

    try {
        const gdb = new Database(grinderDb, { readonly: true });
        const installed = gdb.prepare("SELECT id FROM games WHERE installed=1").all();
        const allGames  = gdb.prepare("SELECT id, title, store, app_id, installed, platform, is_dlc FROM games").all();
        gdb.close();
        return { found: true, path: grinderPath,
                 installedGames: installed.map(r => r.id),
                 allGames };
    } catch (e) {
        return { found: true, path: grinderPath, installedGames: [], allGames: [], error: `Could not read GRINDER DB: ${e.message}` };
    }
});

// Sync ALL GRINDER games into CNGM (installed and not installed).
// Matches by app_id for GOG/Epic; inserts new entries for unmatched games.
ipcMain.handle('sync-all-grinder-games', (_, allGrinderGames, grinderPath) => {
    if (!allGrinderGames?.length) return { synced: 0 };
    let synced = 0;

    // Build set of DLC grinder IDs so we can clean up any previously-synced entries
    const dlcIds = new Set(allGrinderGames.filter(g => g.is_dlc).map(g => g.id));

    // Remove any CNGM entries that were auto-synced from GRINDER but are DLC/non-game content
    if (dlcIds.size) {
        const placeholders = Array.from(dlcIds).map(() => '?').join(',');
        db.prepare(`DELETE FROM games WHERE GrinderGameId IN (${placeholders})`).run(...dlcIds);
    }

    for (const gg of allGrinderGames) {
        // Never bring DLC/soundtrack/extras into CNGM's library
        if (gg.is_dlc) continue;

        // Authoritative install state: any CNGM game already linked to this GRINDER game reflects
        // GRINDER's real installed flag, regardless of CNGM's stored value (e.g. after restoring an
        // older backup, or after a GRINDER-side install/uninstall CNGM never saw). GRINDER keeps this
        // flag accurate via its own verify-installs (checks the files on disk).
        try {
            db.prepare("UPDATE games SET Installed=? WHERE GrinderGameId=?").run(gg.installed ? 1 : 0, gg.id);
            // ...and make sure GOG/Epic games have a launch command, otherwise the UI shows "Install"
            // (button needs LaunchCommand) even though they're installed — and they couldn't launch.
            if (gg.app_id && (gg.store === 'gog' || gg.store === 'epic')) {
                db.prepare("UPDATE games SET LaunchCommand=? WHERE GrinderGameId=? AND (LaunchCommand IS NULL OR TRIM(LaunchCommand)='')")
                  .run(`grinder://launch/${gg.store}/${gg.app_id}`, gg.id);
            }
        } catch {}

        // Try to find a matching CNGM game by app_id embedded in the GRINDER LaunchCommand
        let existing = null;
        if (gg.app_id) {
            existing = db.prepare(
                "SELECT id, GrinderGameId FROM games WHERE LaunchCommand LIKE ? AND (GrinderGameId IS NULL OR GrinderGameId=?)"
            ).get(`%${gg.app_id}%`, gg.id);
        }

        if (existing) {
            // Matched — update GrinderGameId and install status
            db.prepare("UPDATE games SET GrinderGameId=?, Installed=? WHERE id=?")
              .run(gg.id, gg.installed ? 1 : 0, existing.id);
            synced++;
        } else {
            // No CNGM equivalent — insert as new entry if not already imported
            const alreadyIn = db.prepare("SELECT id FROM games WHERE GrinderGameId=?").get(gg.id);
            if (!alreadyIn) {
                let launchCmd = '';
                if (gg.store === 'gog' && gg.app_id)   launchCmd = `grinder://launch/gog/${gg.app_id}`;
                if (gg.store === 'epic' && gg.app_id)  launchCmd = `grinder://launch/epic/${gg.app_id}`;
                const store = gg.store === 'gog' ? 'GOG' : gg.store === 'epic' ? 'EPIC' : 'Others';
                if (!launchCmd) launchCmd = `grinder://${gg.id}`;

                // Before inserting, check if a Steam game with the same title already exists — merge instead
                const steamMatch = (gg.store === 'gog' || gg.store === 'epic') && gg.title
                    ? db.prepare(
                        "SELECT * FROM games WHERE LOWER(TRIM(Game))=LOWER(TRIM(?)) AND Store LIKE '%Steam%' AND (GrinderGameId IS NULL OR GrinderGameId='')"
                      ).get(gg.title)
                    : null;

                if (steamMatch) {
                    let launchers = [];
                    try { launchers = JSON.parse(steamMatch.LaunchCommands || '[]'); } catch(e) {}
                    if (launchers.length === 0 && steamMatch.LaunchCommand) {
                        launchers.push({ label: guessLauncherLabel(steamMatch.LaunchCommand), cmd: steamMatch.LaunchCommand });
                    }
                    if (!launchers.some(l => l.cmd === launchCmd)) {
                        launchers.push({ label: store + ' via GRINDER', cmd: launchCmd });
                    }
                    const storeArr = (steamMatch.Store || '').split(',').map(s => s.trim()).filter(Boolean);
                    if (!storeArr.some(s => s.toLowerCase() === store.toLowerCase())) storeArr.push(store);
                    db.prepare("UPDATE games SET Store=?, GrinderGameId=?, Installed=?, LaunchCommands=? WHERE id=?")
                      .run(storeArr.join(', '), gg.id,
                           Math.max(gg.installed ? 1 : 0, steamMatch.Installed || 0),
                           JSON.stringify(launchers), steamMatch.id);
                } else {
                    db.prepare(
                        "INSERT INTO games (Game, LaunchCommand, Store, Installed, GrinderGameId) VALUES (?, ?, ?, ?, ?)"
                    ).run(gg.title || gg.id, launchCmd, store, gg.installed ? 1 : 0, gg.id);
                }
                synced++;
            }
        }
    }
    return { synced };
});

ipcMain.on('launch-crema', () => {
    // Launch the CREMA face of THIS binary (separate 'crema' process), not an external AppImage.
    const bin  = process.env.APPIMAGE || process.execPath;
    const args = process.env.APPIMAGE ? ['--crema'] : [path.join(__dirname, '..', '..'), '--crema'];
    const child = spawn(bin, args, { detached: true, stdio: 'ignore' });
    child.unref();
    const win = BrowserWindow.getAllWindows()[0];
    if (win) win.minimize();
    // Restore the Manager window when the CREMA face exits.
    child.on('exit', () => { const w = BrowserWindow.getAllWindows()[0]; if (w) { if (w.isMinimized()) w.restore(); w.focus(); } });
});

ipcMain.on('launch-emulatte', () => {
    const p = findEmuLattePath();
    if (!p) return;
    const child = spawn(p, [], { detached: true, stdio: 'ignore' });
    child.unref();
    const win = BrowserWindow.getAllWindows()[0];
    if (win) win.minimize();
});

ipcMain.handle('install-to-menu', () => {
    try {
        const appsDir = path.join(os.homedir(), '.local', 'share', 'applications');
        const iconsDir = path.join(baseDir, 'icons');
        if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir, { recursive: true });
        fs.writeFileSync(path.join(iconsDir, 'CNGM.svg'),     Buffer.from(CNGM_SVG_B64,     'base64'));
        fs.writeFileSync(path.join(iconsDir, 'CREMA.svg'),    Buffer.from(CREMA_SVG_B64,    'base64'));
        fs.writeFileSync(path.join(iconsDir, 'GRINDER.svg'),  Buffer.from(GRINDER_SVG_B64,  'base64'));
        fs.writeFileSync(path.join(iconsDir, 'EmuLatte.svg'), Buffer.from(EMULATTE_SVG_B64, 'base64'));
        if (!fs.existsSync(appsDir)) fs.mkdirSync(appsDir, { recursive: true });
        const files = fs.readdirSync(baseDir);
        const suiteFile    = files.find(f => /^CafeNeurotico.*\.AppImage$/i.test(f));
        const suitePath    = suiteFile ? path.join(baseDir, suiteFile) : (process.env.APPIMAGE || null);
        const emulatteFile = files.find(f => /^EmuLatte.*\.AppImage$/i.test(f));

        // Remove stale pre-merge launchers (separate CNGM/GRINDER AppImages are gone).
        for (const stale of ['cafe-neurotico-game-manager.desktop', 'cafe-neurotico-grinder.desktop']) {
            try { fs.unlinkSync(path.join(appsDir, stale)); } catch {}
        }

        const installed = [];
        if (suitePath) {
            fs.chmodSync(suitePath, '755');
            // Manager (default face)
            fs.writeFileSync(path.join(appsDir, 'cafe-neurotico.desktop'),
                `[Desktop Entry]\nVersion=1.0\nType=Application\nName=Cafe Neurotico\nComment=Your game library — Manager, GRINDER and CREMA in one.\nExec="${suitePath}"\nIcon=${path.join(iconsDir,'CNGM.svg')}\nTerminal=false\nCategories=Game;Utility;\nStartupWMClass=cafeneurotico\n`);
            // CREMA fullscreen face
            fs.writeFileSync(path.join(appsDir, 'cafe-neurotico-crema.desktop'),
                `[Desktop Entry]\nVersion=1.0\nType=Application\nName=CREMA (Fullscreen)\nComment=Cafe Neurotico in fullscreen, gamepad-first mode — made for the living room / TV.\nExec="${suitePath}" --crema\nIcon=${path.join(iconsDir,'CREMA.svg')}\nTerminal=false\nCategories=Game;\nKeywords=couch;tv;living room;gamepad;controller;fullscreen;big picture;bigpicture;cafe neurotico;crema;\nStartupWMClass=crema\n`);
            installed.push('Cafe Neurotico', 'CREMA');
        }
        if (emulatteFile) {
            const p = path.join(baseDir, emulatteFile); fs.chmodSync(p, '755');
            fs.writeFileSync(path.join(appsDir, 'cafe-neurotico-emulatte.desktop'),
                `[Desktop Entry]\nVersion=1.0\nType=Application\nName=EmuLatte\nComment=Cafe Neurotico EmuLatte — ROM library manager.\nExec="${p}"\nIcon=${path.join(iconsDir,'EmuLatte.svg')}\nTerminal=false\nCategories=Game;Emulator;\n`);
            installed.push('EmuLatte');
        }
        execFile('update-desktop-database', [appsDir], () => {});
        if (installed.length === 0) return { success: false, message: 'CafeNeurotico.AppImage not found in the app folder.' };
        return { success: true, message: `Installed to menu: ${installed.join(' + ')}` };
    } catch(err) { return { success: false, message: err.message }; }
});

// Opt-in: auto-start the CREMA (fullscreen) face on login (living-room / HTPC). Off by default.
// State = presence of the XDG autostart entry; no separate setting to drift.
const cremaAutostartPath = () => path.join(os.homedir(), '.config', 'autostart', 'cafe-neurotico-crema.desktop');
ipcMain.handle('get-crema-autostart', () => { try { return fs.existsSync(cremaAutostartPath()); } catch { return false; } });
ipcMain.handle('set-crema-autostart', (_, enabled) => {
    try {
        const file = cremaAutostartPath();
        if (!enabled) { try { fs.unlinkSync(file); } catch {} return { ok: true, enabled: false }; }
        fs.mkdirSync(path.dirname(file), { recursive: true });
        const sf = (() => { try { return fs.readdirSync(baseDir).find(f => /^CafeNeurotico.*\.AppImage$/i.test(f)); } catch { return null; } })();
        const suitePath = sf ? path.join(baseDir, sf) : (process.env.APPIMAGE || process.execPath);
        const iconsDir = path.join(baseDir, 'icons');
        try { fs.mkdirSync(iconsDir, { recursive: true }); fs.writeFileSync(path.join(iconsDir, 'CREMA.svg'), Buffer.from(CREMA_SVG_B64, 'base64')); } catch {}
        fs.writeFileSync(file,
            `[Desktop Entry]\nVersion=1.0\nType=Application\nName=CREMA (Fullscreen)\nComment=Cafe Neurotico — auto-start in fullscreen / gamepad mode on login.\nExec="${suitePath}" --crema\nIcon=${path.join(iconsDir, 'CREMA.svg')}\nTerminal=false\nCategories=Game;\nStartupWMClass=crema\nX-GNOME-Autostart-enabled=true\n`);
        return { ok: true, enabled: true };
    } catch (e) { return { ok: false, error: e.message }; }
});

let manualWin = null;
ipcMain.on('open-manual', () => {
    if (manualWin && !manualWin.isDestroyed()) { manualWin.focus(); return; }
    manualWin = new BrowserWindow({ width: 1100, height: 800, minWidth: 800, minHeight: 500, frame: false, backgroundColor: '#2C1E16',
        webPreferences: { contextIsolation: true, nodeIntegration: false } });
    manualWin.loadFile(path.join(__dirname, 'manual.html'));
    manualWin.setMenu(null);
    manualWin.on('closed', () => { manualWin = null; });
});

ipcMain.on('window-minimize', () => { const win = BrowserWindow.getFocusedWindow(); if(win) win.minimize(); });
ipcMain.on('window-maximize', () => {
    const win = BrowserWindow.getFocusedWindow();
    if(win) { if(win.isMaximized()) win.unmaximize(); else win.maximize(); }
});
ipcMain.on('window-close', () => { const win = BrowserWindow.getFocusedWindow(); if(win) win.close(); });

const STEAM_LANG_MAP = { en: 'english', pt_BR: 'brazilian' };
async function fetchDescI18n(appId, enDesc) {
    const lang = db?.prepare("SELECT value FROM settings WHERE key='language'").get()?.value || 'en';
    const i18n = { en: enDesc };
    if (lang !== 'en' && STEAM_LANG_MAP[lang]) {
        try {
            const r = await fetch(`https://store.steampowered.com/api/appdetails?appids=${appId}&l=${STEAM_LANG_MAP[lang]}`);
            const d = await r.json();
            if (d[appId]?.success) i18n[lang] = d[appId].data.short_description || enDesc;
        } catch(e) {}
    }
    return JSON.stringify(i18n);
}

// ── IGDB / Twitch ──────────────────────────────────────────────────────────
async function getIgdbToken() {
    const clientId = db?.prepare("SELECT value FROM settings WHERE key='igdb_client_id'").get()?.value;
    const secret   = db?.prepare("SELECT value FROM settings WHERE key='igdb_client_secret'").get()?.value;
    if (!clientId || !secret) return null;

    const cached  = db.prepare("SELECT value FROM settings WHERE key='igdb_token'").get()?.value;
    const expiry  = db.prepare("SELECT value FROM settings WHERE key='igdb_token_expiry'").get()?.value;
    if (cached && expiry && Date.now() < parseInt(expiry)) return { token: cached, clientId };

    try {
        const res  = await fetch(`https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${secret}&grant_type=client_credentials`, { method: 'POST' });
        const data = await res.json();
        if (!data.access_token) return null;
        const exp = Date.now() + (data.expires_in * 1000) - 86400000;
        db.prepare("INSERT OR REPLACE INTO settings (key,value) VALUES ('igdb_token',?)").run(data.access_token);
        db.prepare("INSERT OR REPLACE INTO settings (key,value) VALUES ('igdb_token_expiry',?)").run(String(exp));
        return { token: data.access_token, clientId };
    } catch(e) { return null; }
}

async function igdbQuery(auth, body) {
    const res = await fetch('https://api.igdb.com/v4/games', {
        method: 'POST',
        headers: { 'Client-ID': auth.clientId, 'Authorization': `Bearer ${auth.token}`, 'Content-Type': 'text/plain' },
        body
    });
    const data = await res.json();
    // IGDB returns error objects with a 'title' field instead of 'name'
    if (!Array.isArray(data) || data[0]?.title) return null;
    return data[0] || null;
}

async function igdbSearch(gameName, steamAppId) {
    const auth = await getIgdbToken();
    if (!auth) return null;
    const fields = 'fields name,summary,involved_companies.developer,involved_companies.publisher,involved_companies.company.name,genres.name,themes.name,themes.id,first_release_date,aggregated_rating,cover.url,screenshots.url,videos.video_id,similar_games.name,franchises.name,collection.name,external_games.category,external_games.uid;';
    try {
        // Try Steam App ID lookup first (precise), fall back to name search
        if (steamAppId) {
            const byId = await igdbQuery(auth, `${fields} where external_games.uid = "${steamAppId}" & external_games.category = 1; limit 1;`);
            if (byId) return byId;
        }
        return await igdbQuery(auth, `search "${gameName.replace(/"/g, '')}"; ${fields} limit 3;`);
    } catch(e) { return null; }
}

function titleSimilarity(a, b) {
    const tokens = s => new Set(s.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean));
    const ta = tokens(a), tb = tokens(b);
    if (!ta.size || !tb.size) return 0;
    let inter = 0;
    for (const t of ta) if (tb.has(t)) inter++;
    return inter / (ta.size + tb.size - inter);
}

function igdbImg(url, size = 'cover_big') {
    if (!url) return null;
    return 'https:' + url.replace('t_thumb', `t_${size}`);
}

// ── GOG Achievements ──────────────────────────────────────────────────────────
const GOG_CLIENT_ID     = '46899977096215655';
const GOG_CLIENT_SECRET = '9d85c43b1482497dbbce61f6e4aa173a433796eeae2ca8c5f6129f2dc4de46d9';

ipcMain.handle('fetch-achievements-now', async (_, appId) => {
    const home = os.homedir();
    const candidates = [
        path.join(home, '.config', 'grinder', 'grinder.db'),
        path.join(home, '.config', 'GRINDER', 'grinder.db'),
        path.join(baseDir, 'GRINDERConfig', 'grinder.db'),
    ];
    const gdbPath = candidates.find(p => fs.existsSync(p));
    if (!gdbPath) return { ok: false, error: 'grinder_not_found' };

    let token, userId;
    try {
        const gdb = new Database(gdbPath, { timeout: 5000 });
        const get = k => gdb.prepare("SELECT value FROM settings WHERE key=?").get(k)?.value;
        let access  = get('gog_access_token');
        const refresh = get('gog_refresh_token');
        const expiry  = parseInt(get('gog_token_expiry') || '0');
        userId = get('gog_user_id');

        if (!refresh || !userId) { gdb.close(); return { ok: false, error: 'not_logged_in' }; }

        if (!access || Date.now() >= expiry - 60000) {
            const res = await fetch('https://auth.gog.com/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    client_id: GOG_CLIENT_ID, client_secret: GOG_CLIENT_SECRET,
                    grant_type: 'refresh_token', refresh_token: refresh,
                }).toString(),
            });
            const data = await res.json();
            if (!data.access_token) { gdb.close(); return { ok: false, error: 'token_refresh_failed' }; }
            access = data.access_token;
            const set = (k, v) => gdb.prepare("INSERT OR REPLACE INTO settings VALUES (?,?)").run(k, v);
            set('gog_access_token', access);
            set('gog_token_expiry', String(Date.now() + data.expires_in * 1000));
            if (data.refresh_token) set('gog_refresh_token', data.refresh_token);
        }
        token = access;
        gdb.close();
    } catch (e) { return { ok: false, error: e.message }; }

    try {
        const res = await fetch(
            `https://gameplay.gog.com/clients/${appId}/users/${userId}/achievements`,
            { headers: { 'Authorization': `Bearer ${token}`, 'User-Agent': 'CNGM/1.0' } }
        );
        if (!res.ok) return { ok: false, error: `GOG API ${res.status}` };
        const data = await res.json();
        const items = data.items || [];

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
            for (const a of list) upsert.run(
                appId, a.achievement_key, a.name, a.description,
                a.image_url_locked, a.image_url_unlocked, a.date_unlocked || null,
                a.visible === false ? 0 : 1
            );
        })(items);

        const rows = db.prepare(
            "SELECT * FROM achievements WHERE app_id = ? ORDER BY date_unlocked DESC, name COLLATE NOCASE"
        ).all(appId);
        return { ok: true, achievements: rows };
    } catch (e) { return { ok: false, error: e.message }; }
});

ipcMain.handle('igdb-test', async () => {
    const auth = await getIgdbToken();
    if (!auth) return { success: false, message: 'No credentials saved.' };
    // Use name search for the test — most reliable, no external_games dependency
    const result = await igdbQuery(auth, 'search "Portal 2"; fields name; limit 1;');
    if (result?.name) return { success: true, message: `✅ Connected! Found: ${result.name}` };
    return { success: false, message: '❌ Token OK but IGDB query failed. Try again in a moment.' };
});

ipcMain.handle('igdb-search-list', async (e, gameName) => {
    try {
        const auth = await getIgdbToken();
        if (!auth) return { error: 'no_key', results: [] };
        const res = await fetch('https://api.igdb.com/v4/games', {
            method: 'POST',
            headers: { 'Client-ID': auth.clientId, 'Authorization': `Bearer ${auth.token}`, 'Content-Type': 'text/plain' },
            body: `search "${gameName.replace(/"/g, '')}"; fields id,name,first_release_date; limit 8;`
        });
        const data = await res.json();
        if (!Array.isArray(data)) return { error: null, results: [] };
        return { error: null, results: data.filter(g => g.name).map(g => ({ id: g.id, name: g.name, year: g.first_release_date ? new Date(g.first_release_date * 1000).getFullYear() : null })) };
    } catch(e) { return { error: null, results: [] }; }
});

ipcMain.handle('igdb-fetch-screenshots', async (e, igdbId) => {
    try {
        const auth = await getIgdbToken();
        if (!auth) return { error: 'no_key', screenshots: [] };
        const res = await fetch('https://api.igdb.com/v4/games', {
            method: 'POST',
            headers: { 'Client-ID': auth.clientId, 'Authorization': `Bearer ${auth.token}`, 'Content-Type': 'text/plain' },
            body: `fields screenshots.url; where id = ${igdbId}; limit 1;`
        });
        const data = await res.json();
        if (!Array.isArray(data) || !data[0]?.screenshots) return { error: null, screenshots: [] };
        return { error: null, screenshots: data[0].screenshots.map(s => ({
            thumb: 'https:' + s.url.replace('t_thumb', 't_screenshot_med'),
            full:  'https:' + s.url.replace('t_thumb', 't_screenshot_big')
        })) };
    } catch(e) { return { error: null, screenshots: [] }; }
});

ipcMain.handle('igdb-save-screenshot', async (e, gameId, screenshotUrl) => {
    try {
        const row = db.prepare("SELECT Game, Screenshot FROM games WHERE id=?").get(gameId);
        if (!row) return null;
        const safeName = row.Game.replace(/[\\/:*?"<>|#]/g, '').trim();
        const existing = (row.Screenshot || '').split('|').filter(s => s.trim() && s.startsWith('GameManagerConfig'));
        const fn = `${safeName} - Screen IGDB-${Date.now()}.jpg`;
        if (!await downloadImage(screenshotUrl, path.join(imagesDir, fn))) return null;
        const newPath = `GameManagerConfig/images/${fn}`;
        const allScreens = [...existing, newPath].join('|');
        db.prepare("UPDATE games SET Screenshot=? WHERE id=?").run(allScreens, gameId);
        return allScreens;
    } catch(e) { return null; }
});
// ───────────────────────────────────────────────────────────────────────────

ipcMain.handle('open-web-popup', async (event, url) => {
    const popupWin = new BrowserWindow({
        width: 1000, height: 700, title: "Web Search", autoHideMenuBar: true,
        webPreferences: { nodeIntegration: false, contextIsolation: true }
    });
    popupWin.setMenu(null);
    popupWin.loadURL(url);
});

// --- DATA MANAGEMENT TOOLS ---
ipcMain.handle('clear-browser-data', async () => {
    try {
        await session.defaultSession.clearStorageData();
        return { success: true, message: "Browser data (cookies, active logins, cache) successfully wiped!" };
    } catch (err) {
        return { success: false, message: err.message };
    }
});

// FIX: New handler to ruthlessly clean orphaned images
ipcMain.handle('clean-unused-images', () => {
    try {
        const files = fs.readdirSync(imagesDir);
        const rows = db.prepare("SELECT CoverArt, HeroArt, Logo, Icon, Screenshot FROM games").all();
        const usedSet = new Set();

        rows.forEach(r => {
            if (r.CoverArt) usedSet.add(path.basename(r.CoverArt));
            if (r.HeroArt) usedSet.add(path.basename(r.HeroArt));
            if (r.Logo) usedSet.add(path.basename(r.Logo));
            if (r.Icon) usedSet.add(path.basename(r.Icon));
            if (r.Screenshot) {
                r.Screenshot.split('|').filter(s => s.trim() !== '').forEach(s => {
                    usedSet.add(path.basename(s));
                });
            }
        });

        let deletedCount = 0;
        files.forEach(file => {
            if (!usedSet.has(file)) {
                fs.unlinkSync(path.join(imagesDir, file));
                deletedCount++;
            }
        });
        return { success: true, message: `Successfully deleted ${deletedCount} unused/orphaned images!` };
    } catch (err) {
        return { success: false, message: `Cleanup failed: ${err.message}` };
    }
});

// FIX: New handler for the nuclear option (Clear All Images)
ipcMain.handle('clear-all-images', () => {
    try {
        const files = fs.readdirSync(imagesDir);
        let deletedCount = 0;
        files.forEach(file => {
            fs.unlinkSync(path.join(imagesDir, file));
            deletedCount++;
        });
        db.prepare("UPDATE games SET CoverArt='', HeroArt='', Logo='', Icon='', Screenshot=''").run();
        return { success: true, message: `Successfully wiped ${deletedCount} images from the system and reset the database!` };
    } catch (err) {
        return { success: false, message: `Failed to wipe images: ${err.message}` };
    }
});

// RetroArch save locations, so the suite backup can bundle EmuLatte's save states (they live
// OUTSIDE GameManagerConfig). Reads EmuLatte's owned RA config first, then the host config.
const _runFile = (prog, args, opts) => new Promise((res, rej) => execFile(prog, args, opts, e => e ? rej(e) : res()));
function raCfgDir() {
    const flat = path.join(os.homedir(), '.var', 'app', 'org.libretro.RetroArch', 'config', 'retroarch');
    return fs.existsSync(flat) ? flat : path.join(os.homedir(), '.config', 'retroarch');
}
function raCfgKey(key) {
    const owned = path.join(configDir, 'EmuLatte', 'retroarch', 'emulatte-retroarch.cfg');
    const host  = path.join(raCfgDir(), 'retroarch.cfg');
    for (const f of [owned, host]) {
        try {
            const m = fs.readFileSync(f, 'utf8').match(new RegExp(`^\\s*${key}\\s*=\\s*"([^"]*)"`, 'm'));
            if (m && m[1] && m[1] !== 'default') return m[1].replace(/^~(?=[/\\])/, os.homedir()).replace(/^:/, raCfgDir());
        } catch {}
    }
    return '';
}
const raStateDir = () => raCfgKey('savestate_directory') || path.join(raCfgDir(), 'states');
const raSaveDir  = () => raCfgKey('savefile_directory')  || path.join(raCfgDir(), 'saves');

ipcMain.handle('backup-zip', async (event) => {
    const win = BrowserWindow.getFocusedWindow();
    const { filePath } = await dialog.showSaveDialog(win, {
        title: 'Save ZIP Backup',
        defaultPath: 'CafeNeurotico Suite.zip',
            filters: [{ name: 'ZIP Archives', extensions: ['zip'] }]
    });
    if (!filePath) return { success: false, canceled: true };

    event.sender.send('zip-started');

    const isWin = process.platform === 'win32';
    try {
        if (isWin) {
            await _runFile('powershell', ['-command', `Compress-Archive -Path '${configDir}' -DestinationPath '${filePath}' -Force`], { timeout: 300000 });
        } else {
            await _runFile('zip', ['-r', filePath, 'GameManagerConfig'], { cwd: baseDir, timeout: 300000 });
            // Bundle RetroArch save states + savefiles under a known prefix (they live outside GameManagerConfig).
            const stateDir = raStateDir(), saveDir = raSaveDir();
            const stage = path.join(os.tmpdir(), 'cn-suite-saves-' + Date.now());
            let staged = false;
            try {
                if (fs.existsSync(stateDir)) { fs.cpSync(stateDir, path.join(stage, '__ra_saves__', 'states'), { recursive: true }); staged = true; }
                if (fs.existsSync(saveDir) && path.resolve(saveDir) !== path.resolve(stateDir)) { fs.cpSync(saveDir, path.join(stage, '__ra_saves__', 'saves'), { recursive: true }); staged = true; }
                if (staged) await _runFile('zip', ['-r', filePath, '__ra_saves__'], { cwd: stage, timeout: 300000 });
            } finally { try { fs.rmSync(stage, { recursive: true, force: true }); } catch {} }
        }
        return { success: true, message: "ZIP Backup successfully created!" };
    } catch (error) {
        return { success: false, message: `Backup failed: ${error.message}` };
    }
});

ipcMain.handle('restore-zip', async (event) => {
    const win = BrowserWindow.getFocusedWindow();
    const { filePaths } = await dialog.showOpenDialog(win, {
        title: 'Restore ZIP Backup',
        filters: [{ name: 'ZIP Archives', extensions: ['zip'] }],
        properties: ['openFile']
    });
    if (!filePaths || filePaths.length === 0) return { success: false, canceled: true };

    event.sender.send('zip-started');

    const filePath = filePaths[0];
    const isWin = process.platform === 'win32';
    try {
        if (isWin) {
            await _runFile('powershell', ['-command', `Expand-Archive -Path '${filePath}' -DestinationPath '${baseDir}' -Force`], { timeout: 300000 });
        } else {
            await _runFile('unzip', ['-o', filePath, '-d', baseDir], { timeout: 300000 });
            // Re-home any bundled RetroArch saves into THIS machine's RA dirs, then drop the temp folder.
            const extracted = path.join(baseDir, '__ra_saves__');
            if (fs.existsSync(extracted)) {
                try {
                    const stStates = path.join(extracted, 'states'), stSaves = path.join(extracted, 'saves');
                    if (fs.existsSync(stStates)) fs.cpSync(stStates, raStateDir(), { recursive: true });
                    if (fs.existsSync(stSaves))  fs.cpSync(stSaves,  raSaveDir(),  { recursive: true });
                } finally { try { fs.rmSync(extracted, { recursive: true, force: true }); } catch {} }
            }
        }
        return { success: true, message: "Restore successful! Please restart the app to load the new database." };
    } catch (error) {
        return { success: false, message: `Restore failed: ${error.message}` };
    }
});

ipcMain.handle('add-game', (e, name) => {
    try {
        const gameName = (name && name.trim()) ? name.trim() : 'New Game';
        const info = db.prepare("INSERT INTO games (Game, Store, LaunchCommand, FAV, WANT_TO_PLAY) VALUES (?, '', '', 'NO', 'NO')").run(gameName);
        return { success: true, id: info.lastInsertRowid };
    } catch (err) { return { success: false }; }
});

ipcMain.handle('set-game-flag', (_, id, field, value) => {
    const allowed = ['FAV', 'WANT_TO_PLAY', 'kb_played', 'Hidden'];
    if (!allowed.includes(field)) return { ok: false };
    db.prepare(`UPDATE games SET ${field}=? WHERE id=?`).run(value, id);
    return { ok: true };
});

// Desktop notification (freedesktop/DBus via Electron). KDE Connect's notification-sync
// plugin (or GSConnect) mirrors these to a paired phone — icon included when the phone
// app has "sync icons" on. `icon` is a games-db art path (baseDir-relative) or absolute.
ipcMain.handle('notify', (_, { title, body, icon } = {}) => {
    try {
        if (!Notification.isSupported()) return { ok: false, error: 'not supported' };
        let img;
        if (icon) {
            const p = path.isAbsolute(icon) ? icon : path.join(baseDir, icon);
            if (fs.existsSync(p)) { const ni = nativeImage.createFromPath(p); if (!ni.isEmpty()) img = ni; }
        }
        new Notification({ title: String(title || 'Cafe Neurotico'), body: String(body || ''), icon: img }).show();
        return { ok: true };
    } catch (e) { return { ok: false, error: e.message }; }
});

ipcMain.handle('update-game', (event, id, data) => {
    try {
        // Preserve existing translations when English description is edited manually
        let descI18n = data.Description_i18n || null;
        if (!descI18n && data.Description) {
            const existing = db.prepare("SELECT Description_i18n FROM games WHERE id=?").get(id);
            try { const p = JSON.parse(existing?.Description_i18n || '{}'); p.en = data.Description; descI18n = JSON.stringify(p); }
            catch(e) { descI18n = JSON.stringify({ en: data.Description }); }
        }
        // Preserve LaunchCommands when caller doesn't explicitly pass it (e.g. FAV/WANT toggles)
        let launchCommands = data.LaunchCommands !== undefined
            ? data.LaunchCommands
            : db.prepare("SELECT LaunchCommands FROM games WHERE id=?").get(id)?.LaunchCommands ?? null;
        const stmt = db.prepare(`UPDATE games SET Game=?, Store=?, GENRE=?, RELEASED=?, LaunchCommand=?, LaunchCommands=?, FAV=?, WANT_TO_PLAY=?, METACRITIC=?, HLTB_Main=?, DEV=?, PUB=?, Coop=?, NumPlayers=?, Tags=?, SimilarGames=?, Franchise=?, Description=?, Description_i18n=?, SteamAppID=?, ProtonTier=?, HeroArt=?, Logo=?, Icon=?, SteamDesc=?, SteamTrailer=?, CoverArt=?, Screenshot=?, IGDBTrailer=? WHERE id=?`);
        stmt.run(data.Game, data.Store, data.GENRE, data.RELEASED, data.LaunchCommand, launchCommands, data.FAV, data.WANT_TO_PLAY, data.METACRITIC, data.HLTB_Main, data.DEV, data.PUB, data.Coop, data.NumPlayers, data.Tags, data.SimilarGames, data.Franchise || "", data.Description, descI18n, data.SteamAppID, data.ProtonTier, data.HeroArt, data.Logo, data.Icon, data.SteamDesc, data.SteamTrailer, data.CoverArt, data.Screenshot, data.IGDBTrailer || "", id);
        return true;
    } catch (err) { return false; }
});

ipcMain.handle('delete-game', (event, id) => {
    try { db.prepare(`DELETE FROM games WHERE id=?`).run(id); return true; } catch (err) { return false; }
});

ipcMain.on('launch-game', (event, cmd) => {
    if (!cmd) return;

    // GOG/Epic via GRINDER, launched IN-PROCESS (cmd carries GRINDER's game id).
    // This is the path used by games with a GrinderGameId (the common case).
    const gLaunch = cmd.match(/^grinder:\/\/(?:launch\/)?(.+)$/);
    if (gLaunch) {
        const gid = gLaunch[1];
        if (ensureGrinderEngine()) {
            grinderEngine.launchGame(gid)
                .then(r => console.log('[launch-game] launched via', r?.method))
                .catch(e => console.error('[launch-game] grinder launch failed:', e.message));
        } else {
            spawnGrinder(['launch', gid]); // fallback if grinder DB not found
        }
        return;
    }

    // GOG/Epic via GRINDER (grinder:// cmd → resolve id via getGrinderMap), in-process
    const grinderMatch = cmd.match(/grinder:\/\/launch\/(epic|gog)\/([^"\s]+)/i);
    if (grinderMatch) {
        const appId = grinderMatch[2];
        const gMap  = getGrinderMap();
        const gId   = gMap.get(appId);
        if (gId) {
            // Launch in-process via the shared engine (no AppImage self-spawn).
            if (ensureGrinderEngine()) {
                grinderEngine.launchGame(gId)
                    .then(r => console.log('[launch-game] launched via', r?.method))
                    .catch(e => console.error('[launch-game] grinder launch failed:', e.message));
            } else {
                spawnGrinder(['launch', gId]); // fallback if grinder DB not found
            }
            return;
        }
    }

    // itch.io — delegate to itch app via xdg-open (shell.openExternal rejects custom schemes)
    if (cmd.startsWith('itch://')) {
        spawn('xdg-open', [cmd], { detached: true, stdio: 'ignore' }).unref();
        return;
    }

    // PICO-8 cart launch (binary resolved from settings at runtime)
    if (cmd.startsWith('pico8-cart:')) {
        const cartPath = cmd.slice('pico8-cart:'.length);
        const bin = _getPico8Bin();
        if (bin) {
            const args = ['-run', cartPath];
            const get = (k) => db.prepare("SELECT value FROM settings WHERE key=?").get(k)?.value;
            if (get('pico8_windowed')      === '1') args.push('-windowed', '1');
            if (get('pico8_mute')          === '1') args.push('-volume', '0');
            if (get('pico8_pixel_perfect') === '1') args.push('-pixel_perfect', '1');
            if (get('pico8_joystick')      === '1') args.push('-joystick', '1');
            spawn(bin, args, { detached: true, stdio: 'ignore' }).unref();
        }
        return;
    }

    const child = spawn(cmd, [], { shell: true, detached: true, stdio: 'ignore' });
    child.unref();
});

// ── PICO-8 ────────────────────────────────────────────────────────────────

function humanizeCartName(filename) {
    let name = filename.replace(/\.p8\.png$/, '').replace(/\.p8$/, '');
    name = name.replace(/_\d+$/, '');               // strip BBS pid suffix
    name = name.replace(/[_-]+/g, ' ').trim();
    return name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') || filename;
}

function _getPico8Bin() {
    const row = db.prepare("SELECT value FROM settings WHERE key='pico8_path'").get();
    if (row?.value && fs.existsSync(row.value)) return row.value;
    const pico8Dir = path.join(baseDir, 'GameManagerConfig', 'pico8');
    for (const n of ['pico8', 'pico8_dyn', 'pico8_64']) {
        const p = path.join(pico8Dir, n);
        if (fs.existsSync(p)) return p;
    }
    return null;
}

ipcMain.handle('get-pico8-status', () => ({
    bin: _getPico8Bin(),
    cartsDir: path.join(baseDir, 'GameManagerConfig', 'pico8', 'carts')
}));

ipcMain.handle('browse-pico8-binary', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openFile'], title: 'Select PICO-8 Executable' });
    if (result.canceled || !result.filePaths.length) return null;
    const p = result.filePaths[0];
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('pico8_path', ?)").run(p);
    return p;
});

ipcMain.handle('launch-pico8-splore', () => {
    const bin = _getPico8Bin();
    if (bin) spawn(bin, ['-splore'], { detached: true, stdio: 'ignore' }).unref();
    return !!bin;
});

ipcMain.handle('open-pico8-folder', () => {
    const dir = path.join(baseDir, 'GameManagerConfig', 'pico8', 'carts');
    try { fs.mkdirSync(dir, { recursive: true }); } catch {}
    shell.openPath(dir);
    return true;
});

ipcMain.handle('get-pico8-opts', () => {
    const get = (k) => db.prepare("SELECT value FROM settings WHERE key=?").get(k)?.value === '1';
    return { windowed: get('pico8_windowed'), mute: get('pico8_mute'), pixelPerfect: get('pico8_pixel_perfect'), joystick: get('pico8_joystick') };
});

ipcMain.handle('set-pico8-opt', (e, key, val) => {
    const map = { windowed: 'pico8_windowed', mute: 'pico8_mute', pixelPerfect: 'pico8_pixel_perfect', joystick: 'pico8_joystick' };
    const dbKey = map[key];
    if (!dbKey) return false;
    db.prepare("INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)").run(dbKey, val ? '1' : '0');
    return true;
});

ipcMain.handle('scan-pico8', () => {
    if (!db) return { count: 0 };
    const cartsDir = path.join(baseDir, 'GameManagerConfig', 'pico8', 'carts');
    const imagesDir = path.join(baseDir, 'GameManagerConfig', 'images');
    try { fs.mkdirSync(cartsDir, { recursive: true }); } catch {}
    let files;
    try { files = fs.readdirSync(cartsDir); } catch { return { count: 0 }; }

    const found = new Set();

    const setCartCover = (rowId, cartPath) => {
        // The .p8.png IS the cover image — copy it directly, no canvas needed
        try {
            const coverFile = `${rowId}_p8_cover.png`;
            fs.copyFileSync(cartPath, path.join(imagesDir, coverFile));
            db.prepare("UPDATE games SET CoverArt=? WHERE id=?").run(`GameManagerConfig/images/${coverFile}`, rowId);
        } catch {}
    };

    for (const file of files) {
        const hasPng = file.endsWith('.p8.png');
        const hasP8  = !hasPng && file.endsWith('.p8');
        if (!hasPng && !hasP8) continue;
        const cartPath = path.join(cartsDir, file);
        const launchCmd = `pico8-cart:${cartPath}`;
        found.add(launchCmd);
        const name = humanizeCartName(file);
        const row = db.prepare("SELECT id, Store, CoverArt FROM games WHERE LaunchCommand = ?").get(launchCmd);
        if (row) {
            const stores = (row.Store || '').split(',').map(s => s.trim());
            if (!stores.some(s => s.toLowerCase() === 'pico-8'))
                db.prepare("UPDATE games SET Store=?, Installed=1 WHERE id=?").run([...stores, 'PICO-8'].join(', '), row.id);
            else
                db.prepare("UPDATE games SET Installed=1 WHERE id=?").run(row.id);
            if (!row.CoverArt && hasPng) setCartCover(row.id, cartPath);
        } else {
            const info = db.prepare("INSERT INTO games (Game,Store,LaunchCommand,Installed) VALUES (?,?,?,1)").run(name, 'PICO-8', launchCmd);
            if (hasPng) setCartCover(info.lastInsertRowid, cartPath);
        }
    }

    const all = db.prepare("SELECT id, LaunchCommand FROM games WHERE LaunchCommand LIKE 'pico8-cart:%'").all();
    for (const row of all) {
        if (!found.has(row.LaunchCommand)) db.prepare("DELETE FROM games WHERE id=?").run(row.id);
    }
    return { count: found.size };
});

let _bbsWin = null;

ipcMain.handle('launch-pico8-bbs', (e, accent = '#ff77a8') => {
    const cartsDir = path.join(baseDir, 'GameManagerConfig', 'pico8', 'carts');
    try { fs.mkdirSync(cartsDir, { recursive: true }); } catch {}

    if (_bbsWin && !_bbsWin.isDestroyed()) { _bbsWin.focus(); return; }

    _bbsWin = new BrowserWindow({
        width: 1280, height: 860,
        frame: false,
        webPreferences: {
            partition: 'persist:pico8bbs',
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    _bbsWin.loadURL('https://www.lexaloffle.com/bbs/?cat=7&carts_tab=1#mode=carts&sub=2');

    const isCart = (url = '') => /\.p8(\.png)?($|\?|#)/.test(url) || url.endsWith('.p8') || url.endsWith('.p8.png');
    const a = accent.replace(/['"\\<>]/g, '');

    const injectUI = () => {
        _bbsWin.webContents.executeJavaScript(`
        (function(){
            if (document.getElementById('cngm-p8-style')) return;
            const s = document.createElement('style');
            s.id = 'cngm-p8-style';
            s.textContent = \`
                ::-webkit-scrollbar{width:8px;height:8px}
                ::-webkit-scrollbar-track{background:#0d0d0d}
                ::-webkit-scrollbar-thumb{background:${a}55;border-radius:4px}
                ::-webkit-scrollbar-thumb:hover{background:${a}aa}
                #cngm-titlebar{position:fixed;top:0;left:0;right:0;height:38px;background:#0d0d0d;border-bottom:1px solid ${a}33;z-index:99999;display:flex;align-items:center;-webkit-app-region:drag;user-select:none}
                #cngm-titlebar .cngm-tb-brand{padding:0 14px;font-family:monospace;font-size:13px;font-weight:900;letter-spacing:3px;color:${a};flex-shrink:0}
                #cngm-titlebar .cngm-tb-hint{font-family:monospace;font-size:10px;color:#444;flex:1;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
                #cngm-titlebar .cngm-tb-btns{display:flex;-webkit-app-region:no-drag;flex-shrink:0}
                #cngm-titlebar .cngm-tb-btns button{width:46px;height:38px;border:none;background:transparent;color:#666;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background 0.15s,color 0.15s}
                #cngm-titlebar .cngm-tb-btns button:hover{background:rgba(255,255,255,0.08);color:#ccc}
                #cngm-titlebar .cngm-tb-btns .tb-close:hover{background:#c0392b;color:#fff}
            \`;
            document.head.appendChild(s);
            const bar = document.createElement('div');
            bar.id = 'cngm-titlebar';
            bar.innerHTML = \`
                <div class="cngm-tb-brand">CNGM — PICO-8 BBS</div>
                <div class="cngm-tb-hint">Right-click a cart image · click CART · or click any .p8.png link to save to your library</div>
                <div class="cngm-tb-btns">
                    <button class="tb-close" onclick="window.close()" title="Close">&#x2715;</button>
                </div>
            \`;
            document.body.insertBefore(bar, document.body.firstChild);
            document.documentElement.style.paddingTop = '38px';
        })()
        `).catch(() => {});
    };

    _bbsWin.webContents.on('did-finish-load', injectUI);
    _bbsWin.webContents.on('did-navigate', injectUI);

    _bbsWin.webContents.on('will-navigate', (event, url) => {
        if (isCart(url)) { event.preventDefault(); _bbsWin.webContents.downloadURL(url); }
    });

    _bbsWin.webContents.setWindowOpenHandler(({ url }) => {
        if (isCart(url)) { _bbsWin.webContents.downloadURL(url); return { action: 'deny' }; }
        shell.openExternal(url);
        return { action: 'deny' };
    });

    _bbsWin.webContents.on('context-menu', (event, params) => {
        const dlURL = [params.srcURL, params.linkURL].find(u => isCart(u));
        const items = [];
        if (dlURL) {
            items.push({ label: '⬇  Save to PICO-8 Library', click: () => _bbsWin.webContents.downloadURL(dlURL) });
            items.push({ type: 'separator' });
        }
        if (params.selectionText) items.push({ role: 'copy', label: 'Copy' });
        if (params.linkURL && !isCart(params.linkURL)) items.push({ label: 'Open Link in Browser', click: () => shell.openExternal(params.linkURL) });
        if (items.length) Menu.buildFromTemplate(items).popup({ window: _bbsWin });
    });

    _bbsWin.webContents.session.on('will-download', (event, item) => {
        const filename = item.getFilename();
        if (!isCart(filename)) return;
        const destPath = path.join(cartsDir, filename);
        const srcURL = item.getURL();
        item.setSavePath(destPath);

        item.on('done', async (ev, state) => {
            if (state !== 'completed') return;

            let name = humanizeCartName(filename);
            const launchCmd = `pico8-cart:${destPath}`;
            let gameId;
            try {
                const existing = db.prepare("SELECT id FROM games WHERE LaunchCommand = ?").get(launchCmd);
                if (existing) { gameId = existing.id; }
                else { gameId = db.prepare("INSERT INTO games (Game,Store,LaunchCommand,Installed) VALUES (?,?,?,1)").run(name, 'PICO-8', launchCmd).lastInsertRowid; }
            } catch {}

            // Copy the .p8.png directly as cover art — it IS the image, no conversion needed
            if (gameId && filename.endsWith('.p8.png')) {
                try {
                    const imDir = path.join(baseDir, 'GameManagerConfig', 'images');
                    const coverFile = `${gameId}_p8_cover.png`;
                    fs.copyFileSync(destPath, path.join(imDir, coverFile));
                    db.prepare("UPDATE games SET CoverArt=? WHERE id=?").run(`GameManagerConfig/images/${coverFile}`, gameId);
                } catch {}
            }

            // Fetch real title from BBS page using pid in the download URL
            const pidM = srcURL.match(/\/cposts\/\d+\/(\d+)\.p8\.png/);
            if (pidM) {
                try {
                    const res = await session.defaultSession.fetch(
                        `https://www.lexaloffle.com/bbs/?pid=${pidM[1]}`,
                        { headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36' } }
                    );
                    const html = await res.text();
                    const titleM = html.match(/<title[^>]*>([^<]+?)\s*[-–]\s*Lexaloffle BBS/i);
                    if (titleM && titleM[1].trim()) {
                        name = titleM[1].trim();
                        if (gameId) db.prepare("UPDATE games SET Game=? WHERE id=?").run(name, gameId);
                    }
                } catch {}
            }

            // Toast in BBS window
            if (_bbsWin && !_bbsWin.isDestroyed()) {
                const toastMsg = JSON.stringify(`✓ ${name} — saved to library`);
                _bbsWin.webContents.executeJavaScript(`
                    (function(){
                        const t=document.createElement('div');
                        t.style.cssText='position:fixed;bottom:24px;right:24px;z-index:999999;background:#0d0d0d;border:1px solid ${a};color:${a};padding:10px 20px;border-radius:6px;font-family:monospace;font-size:13px;font-weight:700;letter-spacing:1px;box-shadow:0 6px 24px rgba(0,0,0,0.9);transition:opacity 0.4s';
                        t.textContent=${toastMsg};
                        document.body.appendChild(t);
                        setTimeout(()=>{t.style.opacity='0';setTimeout(()=>t.remove(),400)},2800);
                    })()
                `).catch(() => {});
            }

            // Notify main window
            const mainWin = BrowserWindow.getAllWindows().find(w => w !== _bbsWin && !w.isDestroyed());
            if (mainWin) mainWin.webContents.send('pico8-cart-downloaded', { name });
        });
    });

    _bbsWin.on('closed', () => { _bbsWin = null; });
});

ipcMain.handle('update-last-played', (event, id) => {
    if (!db) return false;
    try { db.prepare("UPDATE games SET LastPlayed = ? WHERE id = ?").run(Date.now(), id); return true; } catch(err) { return false; }
});

ipcMain.handle('get-strings', (_, lang) => require('./i18n')(lang || 'en'));

// ── ITCH.IO SYNC ──────────────────────────────────────────────────────────

async function doItchSync() {
    if (!db) return { success: false, message: 'Database not ready.' };
    const home = os.homedir();
    const butlerPaths = [
        path.join(home, '.config', 'itch', 'db', 'butler.db'),
        path.join(home, '.var', 'app', 'io.itch.itch', 'config', 'itch', 'db', 'butler.db')
    ];
    const butlerDbPath = butlerPaths.find(p => fs.existsSync(p));
    if (!butlerDbPath) return { success: false, message: 'itch app not found. Install it and log in first.' };

    let itchDb;
    try { itchDb = new Database(butlerDbPath, { readonly: true }); }
    catch(e) { return { success: false, message: 'Could not open itch database: ' + e.message }; }

    let imported = 0;
    try {
        // Only import games the user actually owns: installed (cave), purchased (download_key), or in library (profile_games)
        const games  = itchDb.prepare(`
            SELECT DISTINCT g.* FROM games g
            LEFT JOIN caves c ON g.id = c.game_id
            LEFT JOIN download_keys dk ON g.id = dk.game_id
            LEFT JOIN profile_games pg ON g.id = pg.game_id
            WHERE c.game_id IS NOT NULL OR dk.game_id IS NOT NULL OR pg.game_id IS NOT NULL
        `).all();
        const caves  = itchDb.prepare("SELECT * FROM caves").all();
        const imDir  = path.join(baseDir, 'GameManagerConfig', 'images');
        const caveByGame = {};
        for (const c of caves) caveByGame[c.game_id] = c;

        // Collect async cover-download tasks so they fire after the transaction
        const coverTasks = [];

        db.transaction(() => {
        for (const game of games) {
            const cave = caveByGame[game.id];
            let launchCmd = null, installed = 0;

            if (cave) {
                installed = 1;
                try {
                    const v = JSON.parse(cave.verdict || '{}');
                    const linuxExe = (v.candidates || []).find(c => c.flavor === 'linux');
                    launchCmd = (v.basePath && linuxExe)
                        ? path.join(v.basePath, linuxExe.path)
                        : `itch://launch/${cave.id}`;
                } catch { launchCmd = `itch://launch/${cave.id}`; }
            } else {
                launchCmd = `itch://install/${game.id}`;
            }

            // Match existing record: by launch key, then title+store, then any itch:// launch cmd + title
            let existing = db.prepare("SELECT * FROM games WHERE LaunchCommand = ?").get(`itch://install/${game.id}`);
            if (!existing) existing = db.prepare("SELECT * FROM games WHERE LOWER(Store) LIKE '%itch%' AND LOWER(Game) = LOWER(?)").get(game.title);
            if (!existing && cave) existing = db.prepare("SELECT * FROM games WHERE LaunchCommand = ? AND LOWER(Game) = LOWER(?)").get(`itch://launch/${cave.id}`, game.title);
            if (!existing) existing = db.prepare("SELECT * FROM games WHERE LaunchCommand LIKE 'itch://%' AND LOWER(Game) = LOWER(?)").get(game.title);

            let gameId;
            if (existing) {
                const storeFixed = (existing.Store || '').toLowerCase().includes('itch') ? existing.Store : 'itch.io';
                db.prepare("UPDATE games SET LaunchCommand=?, Installed=?, Store=? WHERE id=?").run(launchCmd, installed, storeFixed, existing.id);
                gameId = existing.id;
            } else {
                gameId = db.prepare("INSERT INTO games (Game,Store,LaunchCommand,Installed) VALUES (?,?,?,?)").run(game.title, 'itch.io', launchCmd, installed).lastInsertRowid;
            }

            // Queue cover art download (must run outside the transaction — it's async)
            const hasCover = (existing?.CoverArt || '');
            if (game.cover_url && !hasCover && gameId) {
                coverTasks.push({ url: game.cover_url, gameId });
            }

            imported++;
        }
        })();

        // Fire cover downloads after transaction commits
        for (const { url, gameId } of coverTasks) {
            (async () => {
                try {
                    const res = await session.defaultSession.fetch(url, { headers: { 'User-Agent': 'CNGM/1.0' } });
                    const buf = Buffer.from(await res.arrayBuffer());
                    const file = `${gameId}_itch_cover.png`;
                    fs.writeFileSync(path.join(imDir, file), buf);
                    db.prepare("UPDATE games SET CoverArt=? WHERE id=?").run(`GameManagerConfig/images/${file}`, gameId);
                } catch (e) { console.error('[itch cover download]', gameId, e.message); }
            })();
        }
    } catch(e) {
        return { success: false, message: e.message };
    } finally {
        try { itchDb.close(); } catch {}
    }

    return { success: true, count: imported, message: `Synced ${imported} itch.io game${imported !== 1 ? 's' : ''}.` };
}

ipcMain.handle('sync-itch', async () => doItchSync());

// ── STORE BROWSER ─────────────────────────────────────────────────────────

const STORE_CONFIGS = {
    gog:     { url: 'https://www.gog.com/',         label: 'GOG STORE'  },
    epic:    { url: 'https://store.epicgames.com/', label: 'EPIC STORE' },
    flathub: { url: 'https://flathub.org/',         label: 'FLATHUB'    }
};
const _storeWins = {};

ipcMain.handle('open-store-browser', (e, store, colors) => {
    const cfg = STORE_CONFIGS[store];
    if (!cfg) return;
    if (_storeWins[store] && !_storeWins[store].isDestroyed()) { _storeWins[store].focus(); return; }

    const { bg, bgMenu, accent, textDim, borderSolid } = colors;

    const win = new BrowserWindow({
        width: 1400, height: 900, frame: false,
        webPreferences: { partition: `persist:store-${store}` }
    });
    _storeWins[store] = win;
    win.on('closed', () => { delete _storeWins[store]; });

    const injectTitlebar = () => {
        const script = `(function(){
            if(document.getElementById('cngm-sb'))return;
            var bg=${JSON.stringify(bg)},bgMenu=${JSON.stringify(bgMenu)},accent=${JSON.stringify(accent)},textDim=${JSON.stringify(textDim)},borderSolid=${JSON.stringify(borderSolid)},label=${JSON.stringify(cfg.label)};
            var st=document.createElement('style');
            st.textContent='::-webkit-scrollbar{width:8px;height:8px}::-webkit-scrollbar-track{background:'+bg+'}::-webkit-scrollbar-thumb{background:'+accent+';border-radius:4px}::-webkit-scrollbar-thumb:hover{opacity:.8}body{margin-top:38px!important}html{padding-top:0!important}';
            document.head.appendChild(st);
            var tb=document.createElement('div');
            tb.id='cngm-sb';
            tb.style.cssText='position:fixed;top:0;left:0;right:0;height:38px;background:'+bgMenu+';border-bottom:1px solid '+borderSolid+';display:flex;align-items:center;justify-content:space-between;z-index:2147483647;-webkit-app-region:drag;font-family:Raleway,sans-serif;box-sizing:border-box;';
            var brand=document.createElement('div');
            brand.style.cssText='padding:0 16px;font-size:10px;font-weight:900;color:'+textDim+';letter-spacing:3px;';
            brand.textContent=label;
            var bs='background:transparent;border:none;color:'+accent+';width:42px;height:38px;cursor:pointer;font-size:15px;display:flex;align-items:center;justify-content:center;-webkit-app-region:no-drag;transition:background 0.1s;';
            function mkBtn(html,onclick){var b=document.createElement('button');b.style.cssText=bs;b.innerHTML=html;b.onclick=onclick;return b;}
            var bk=mkBtn('&#8592;',function(){history.back();});
            var fw=mkBtn('&#8594;',function(){history.forward();});
            var cl=mkBtn('&#x2715;',function(){window.close();});
            cl.onmouseover=function(){this.style.background='#d32f2f';this.style.color='white';};
            cl.onmouseout=function(){this.style.background='transparent';this.style.color=accent;};
            var ctrls=document.createElement('div');
            ctrls.style.cssText='display:flex;height:100%;-webkit-app-region:no-drag;';
            ctrls.appendChild(bk);ctrls.appendChild(fw);ctrls.appendChild(cl);
            tb.appendChild(brand);tb.appendChild(ctrls);
            if(document.body)document.body.prepend(tb);
            function pushFixed(){
                var sels=['header','nav','[role="banner"]','[class*="header"]','[class*="Header"]','[class*="navbar"]','[class*="topbar"]','[class*="top-bar"]','[class*="nav-bar"]','[class*="navigation"]'];
                sels.forEach(function(sel){
                    try{document.querySelectorAll(sel).forEach(function(el){
                        if(el.id==='cngm-sb')return;
                        var s=window.getComputedStyle(el);
                        if(s.position==='fixed'){var t=parseFloat(s.top)||0;if(t<38)el.style.setProperty('top',(t+38)+'px','important');}
                    });}catch(e){}
                });
            }
            setTimeout(pushFixed,200);
            setTimeout(pushFixed,800);
        })();`;
        win.webContents.executeJavaScript(script).catch(() => {});
    };

    win.webContents.on('did-finish-load', injectTitlebar);
    win.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });
    win.loadURL(cfg.url);
});

// --- SYNC ENGINES ---
// ── FLATPAK ────────────────────────────────────────────────────────────────

ipcMain.handle('save-flatpak-art', (e, gameId, coverB64, heroB64, iconSrcPath) => {
    const imagesDir = path.join(baseDir, 'GameManagerConfig', 'images');
    const ts = Date.now();
    const coverFile = `${gameId}_fp_cover_${ts}.png`;
    const heroFile  = `${gameId}_fp_hero_${ts}.png`;
    fs.writeFileSync(path.join(imagesDir, coverFile), Buffer.from(coverB64, 'base64'));
    fs.writeFileSync(path.join(imagesDir, heroFile),  Buffer.from(heroB64,  'base64'));
    const coverPath = `GameManagerConfig/images/${coverFile}`;
    const heroPath  = `GameManagerConfig/images/${heroFile}`;
    let logoPath = '';
    if (iconSrcPath && fs.existsSync(iconSrcPath)) {
        const ext = path.extname(iconSrcPath);
        const logoFile = `${gameId}_fp_logo_${ts}${ext}`;
        fs.copyFileSync(iconSrcPath, path.join(imagesDir, logoFile));
        logoPath = `GameManagerConfig/images/${logoFile}`;
    }
    db.prepare('UPDATE games SET CoverArt=?, HeroArt=?, Logo=?, Icon=? WHERE id=?')
      .run(coverPath, heroPath, logoPath, logoPath, gameId);
    return true;
});

ipcMain.handle('sync-steam', async (event, steamId, apiKey) => {
    if (!steamId || !apiKey) return { success: false, message: "Missing SteamID or API Key." };
    // skip_unvetted_apps=false is REQUIRED: it defaults to true, which makes Steam
    // silently omit "unvetted" apps (a trust flag on many small/indie titles) from
    // GetOwnedGames — so owned games like those never import.
    // include_played_free_games=true also pulls free-to-play games you've played.
    const base = `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${apiKey}&steamid=${steamId}&include_appinfo=true&skip_unvetted_apps=false`;
    try {
        // Primary list = everything, including played free-to-play games (the import set).
        const response = await fetch(`${base}&include_played_free_games=true`);
        if (!response.ok) throw new Error(`HTTP Error ${response.status}`);
        const data = await response.json();
        if (!data.response || !data.response.games) return { success: false, message: "Could not read games." };

        // Second list = paid/owned only (no free games). Any appid in the primary list
        // but NOT here is a free-to-play title → tag it so the UI can pill + hide it.
        // Best-effort: if this call fails we still import everything, just untagged.
        const freeAppids = new Set();
        let freeSetKnown = false;
        try {
            const paidResp = await fetch(base);
            if (paidResp.ok) {
                const paidData = await paidResp.json();
                const paidIds = new Set((paidData.response?.games || []).map(g => String(g.appid)));
                for (const g of data.response.games) {
                    const id = String(g.appid);
                    if (!paidIds.has(id)) freeAppids.add(id);
                }
                freeSetKnown = true;
            }
        } catch (e) { /* 2nd fetch failed → leave tags untouched this run */ }

        let added = 0;
        let updated = 0;
        const games = data.response.games;
        const insertStmt = db.prepare("INSERT INTO games (Store, Game, SteamAppID, LaunchCommand, FAV, WANT_TO_PLAY) VALUES (?, ?, ?, ?, 'NO', 'NO')");

        db.transaction(() => { for (const g of games) {
            const appid = String(g.appid);
            const name = g.name ? g.name.trim() : 'Unknown Game';
            if (!name) continue;

            const launchCommand = `steam steam://rungameid/${appid} -silent`;
            const isInstalled = isSteamGameInstalled(appid) ? 1 : 0;

            // Match only by exact LaunchCommand or SteamAppID — never by game name,
            // to prevent merging separate store entries (e.g. GOG + Steam of the same title).
            const existing = db.prepare(
                "SELECT * FROM games WHERE LaunchCommand = ? OR (SteamAppID = ? AND SteamAppID IS NOT NULL AND SteamAppID != '' AND SteamAppID != 'None')"
            ).get(launchCommand, appid);

            if (existing) {
                const existingCmd = existing.LaunchCommand || '';
                if (/steam:\/\/rungameid/i.test(existingCmd)) {
                    // Pure Steam update — refresh SteamAppID and install status
                    db.prepare("UPDATE games SET SteamAppID=?, Installed=? WHERE id=?")
                      .run(appid, isInstalled, existing.id);
                    // Also check for a sibling non-Steam entry with the same title (pre-existing duplicate)
                    // — if found, merge the Steam launcher into it and delete this Steam-only orphan
                    const sibling = db.prepare(
                        "SELECT * FROM games WHERE LOWER(TRIM(Game))=LOWER(TRIM(?)) AND id != ? AND Store NOT LIKE '%Steam%'"
                    ).get(name, existing.id);
                    if (sibling) {
                        let launchers = [];
                        try { launchers = JSON.parse(sibling.LaunchCommands || '[]'); } catch(e) {}
                        if (launchers.length === 0 && sibling.LaunchCommand) {
                            launchers.push({ label: guessLauncherLabel(sibling.LaunchCommand), cmd: sibling.LaunchCommand });
                        }
                        if (!launchers.some(l => l.cmd === launchCommand)) {
                            launchers.push({ label: 'Steam', cmd: launchCommand });
                        }
                        const storeArr = (sibling.Store || '').split(',').map(s => s.trim()).filter(Boolean);
                        if (!storeArr.some(s => s.toLowerCase() === 'steam')) storeArr.push('Steam');
                        db.prepare("UPDATE games SET Store=?, SteamAppID=?, Installed=?, LaunchCommands=? WHERE id=?")
                          .run(storeArr.join(', '), appid,
                               Math.max(isInstalled, sibling.Installed || 0),
                               JSON.stringify(launchers), sibling.id);
                        db.prepare("DELETE FROM games WHERE id=?").run(existing.id);
                    }
                } else {
                    // Cross-store merge — append Steam launcher to LaunchCommands, keep existing as primary
                    let launchers = [];
                    try { launchers = JSON.parse(existing.LaunchCommands || '[]'); } catch(e) {}
                    if (launchers.length === 0 && existingCmd) {
                        launchers.push({ label: guessLauncherLabel(existingCmd), cmd: existingCmd });
                    }
                    if (!launchers.some(l => l.cmd === launchCommand)) {
                        launchers.push({ label: 'Steam', cmd: launchCommand });
                    }
                    const storeArr = (existing.Store || '').split(',').map(s => s.trim()).filter(Boolean);
                    if (!storeArr.some(s => s.toLowerCase() === 'steam')) storeArr.push('Steam');
                    db.prepare("UPDATE games SET Store=?, SteamAppID=?, Installed=?, LaunchCommands=? WHERE id=?")
                      .run(storeArr.join(', '), appid,
                           Math.max(isInstalled, existing.Installed || 0),
                           JSON.stringify(launchers), existing.id);
                }
                updated++;
            } else {
                // Fallback: title match against a non-Steam entry with no SteamAppID yet
                // (covers the case where GOG/Epic was imported via GRINDER before Steam sync)
                const titleMatch = db.prepare(
                    "SELECT * FROM games WHERE LOWER(TRIM(Game))=LOWER(TRIM(?)) AND Store NOT LIKE '%Steam%' AND (SteamAppID IS NULL OR SteamAppID='' OR SteamAppID='None')"
                ).get(name);

                if (titleMatch) {
                    const existingCmd = titleMatch.LaunchCommand || '';
                    let launchers = [];
                    try { launchers = JSON.parse(titleMatch.LaunchCommands || '[]'); } catch(e) {}
                    if (launchers.length === 0 && existingCmd) {
                        launchers.push({ label: guessLauncherLabel(existingCmd), cmd: existingCmd });
                    }
                    if (!launchers.some(l => l.cmd === launchCommand)) {
                        launchers.push({ label: 'Steam', cmd: launchCommand });
                    }
                    const storeArr = (titleMatch.Store || '').split(',').map(s => s.trim()).filter(Boolean);
                    if (!storeArr.some(s => s.toLowerCase() === 'steam')) storeArr.push('Steam');
                    db.prepare("UPDATE games SET Store=?, SteamAppID=?, Installed=?, LaunchCommands=? WHERE id=?")
                      .run(storeArr.join(', '), appid,
                           Math.max(isInstalled, titleMatch.Installed || 0),
                           JSON.stringify(launchers), titleMatch.id);
                    updated++;
                } else {
                    db.prepare("INSERT INTO games (Store, Game, SteamAppID, LaunchCommand, FAV, WANT_TO_PLAY, Installed) VALUES (?, ?, ?, ?, 'NO', 'NO', ?)").run("Steam", name, appid, launchCommand, isInstalled);
                    added++;
                }
            }
        } })();
        // Capture Steam playtime (minutes): playtime_forever (total) + playtime_2weeks (recent).
        const _ptStmt = db.prepare("UPDATE games SET Playtime=?, Playtime2wk=? WHERE SteamAppID=?");
        db.transaction(() => { for (const g of games) _ptStmt.run(g.playtime_forever || 0, g.playtime_2weeks || 0, String(g.appid)); })();
        // Tag free-to-play Steam games (matched by SteamAppID, whichever import path they took).
        // Only re-tag when the free set was actually computed, so a failed 2nd fetch never wipes tags.
        if (freeSetKnown) {
            const _ftpStmt = db.prepare("UPDATE games SET FreeToPlay=? WHERE SteamAppID=?");
            db.transaction(() => { for (const g of games) _ftpStmt.run(freeAppids.has(String(g.appid)) ? 1 : 0, String(g.appid)); })();
        }
        return { success: true, count: added, message: `Imported ${added} new games from Steam.\n(Updated ${updated} existing entries).` };
    } catch (err) {
        return { success: false, message: `Steam API Error: ${err.message}` };
    }
});

ipcMain.handle('sync-gog', async () => {
    return new Promise((resolve) => {
        const parentWin = BrowserWindow.getFocusedWindow();
        const gogWin = new BrowserWindow({
            parent: parentWin, modal: true, width: 1000, height: 800, title: "Log in to GOG",
            webPreferences: { nodeIntegration: false, contextIsolation: true }
        });
        gogWin.setMenu(null);
        gogWin.loadURL('https://www.gog.com/');
        gogWin.webContents.on('did-finish-load', () => {
            gogWin.webContents.executeJavaScript(`
            if (!document.getElementById('cngm-gog-banner')) {
                const banner = document.createElement('div');
                banner.id = 'cngm-gog-banner';
                banner.innerHTML = "<strong style='font-size:16px;'>Cafe Neurotico:</strong> Log in to your GOG account using the menu at the top, then <u>CLOSE THIS WINDOW</u> to fetch your games!";
                banner.style.cssText = "position: fixed; bottom: 0; left: 0; width: 100%; background: #673ab7; color: white; text-align: center; padding: 15px; z-index: 9999999; box-shadow: 0 -4px 6px rgba(0,0,0,0.3); font-family: sans-serif;";
                document.body.appendChild(banner);
            }
            `);
        });
        gogWin.on('closed', async () => {
            try {
                const url = "https://www.gog.com/account/getFilteredProducts?hiddenFlag=0&mediaType=1&page=1&totalPages=50";
                const response = await net.fetch(url);
                if (!response.ok) { resolve({ success: false, message: "Could not fetch GOG data. Make sure you logged in successfully." }); return; }
                const data = await response.json();
                if (!data.products) { resolve({ success: false, message: "No games found or login failed." }); return; }

                let added = 0;
                let updated = 0;
                const insertStmt = db.prepare("INSERT INTO games (Store, Game, FAV, WANT_TO_PLAY) VALUES ('GOG', ?, 'NO', 'NO')");
                const selectStmt = db.prepare("SELECT * FROM games WHERE LOWER(Game) = LOWER(?)");
                const updateStmt = db.prepare("UPDATE games SET Store = ? WHERE id = ?");

                db.transaction(() => {
                for (const product of data.products) {
                    const title = product.title.trim();
                    if (!title) continue;

                    const existing = selectStmt.get(title);

                    if (existing) {
                        let stores = existing.Store ? existing.Store.split(',').map(s => s.trim()) : [];
                        if (!stores.some(s => s.toLowerCase() === 'gog')) {
                            stores.push('GOG');
                            updateStmt.run(stores.join(', '), existing.id);
                            updated++;
                        }
                    } else {
                        insertStmt.run(title);
                        added++;
                    }
                }
                })();
                resolve({ success: true, message: `Imported ${added} new games from GOG!\n(Updated ${updated} existing entries).` });
            } catch (err) { resolve({ success: false, message: `GOG Fetch Error: ${err.message}` }); }
        });
    });
});

// --- LOCAL FILE PICKER ---
ipcMain.handle('select-local-image', async (event, gameId, type) => {
    const win = BrowserWindow.getFocusedWindow();

    let titleStr = "Image";
    if (type === 'cover') titleStr = "Cover Art";
    else if (type === 'screenshot') titleStr = "Screenshot";
    else if (type === 'hero') titleStr = "Hero Art";
    else if (type === 'logo') titleStr = "Logo (Transparent PNG)";
    else if (type === 'icon') titleStr = "Icon";

    const { filePaths } = await dialog.showOpenDialog(win, {
        title: `Select Local ${titleStr}`,
        filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp', 'ico'] }],
        properties: ['openFile']
    });

    if (filePaths && filePaths.length > 0) {
        try {
            const source = filePaths[0];
            const ext = path.extname(source);
            const fileName = `${gameId}_local_${type}_${Date.now()}${ext}`;
            const dest = path.join(imagesDir, fileName);
            fs.copyFileSync(source, dest);

            const dbPath = `GameManagerConfig/images/${fileName}`;

            let column = 'CoverArt';
            if (type === 'screenshot') column = 'Screenshot';
            else if (type === 'hero') column = 'HeroArt';
            else if (type === 'logo') column = 'Logo';
            else if (type === 'icon') column = 'Icon';

            db.prepare(`UPDATE games SET ${column} = ? WHERE id = ?`).run(dbPath, gameId);
            return dbPath;
        } catch (e) { return null; }
    }
    return null;
});

// --- TRAILER LOGIC ---
function getBeautifulName(gameName) { return gameName.replace(/[\\/:*?"<>|#]/g, '').trim(); }
function getOldCrushedName(gameName) { return gameName.replace(/[^a-z0-9]/gi, '_').toLowerCase(); }

ipcMain.handle('delete-trailer', (event, gameName) => {
    const beautifulPath = path.join(trailersDir, `${getBeautifulName(gameName)}.mp4`);
    const oldPath = path.join(trailersDir, `${getOldCrushedName(gameName)}.mp4`);
    let deleted = false;
    try {
        if (fs.existsSync(beautifulPath)) { fs.unlinkSync(beautifulPath); deleted = true; }
        if (fs.existsSync(oldPath)) { fs.unlinkSync(oldPath); deleted = true; }
    } catch(e) {}
    return deleted;
});

ipcMain.handle('search-youtube', async (event, gameName) => {
    const runSearch = (query) => new Promise((resolve) => {
        const args = ['--config-location', ytDlpConfigPath, `ytsearch5:${query}`, '--print', '%(id)s|%(thumbnail)s|%(title)s', '--no-playlist'];
        execFile(ytDlpPath, args, { timeout: 20000 }, (error, stdout) => {
            if (!stdout?.trim()) { resolve([]); return; }
            const lines = stdout.split('\n').filter(l => l.trim());
            resolve(lines.map(line => { const parts = line.split('|'); return { id: parts[0], thumbnail: parts[1], title: parts.slice(2).join('|') }; }));
        });
    });
    // Try "official trailer" first — broader and catches branded trailers; fall back to plain "trailer"
    let results = await runSearch(`${gameName} official trailer`);
    if (results.length === 0) results = await runSearch(`${gameName} trailer`);
    return results;
});

ipcMain.handle('fetch-steam-trailer', async (event, appId) => {
    try {
        if (!appId || appId === 'None') return null;
        const detailsUrl = `https://store.steampowered.com/api/appdetails?appids=${appId}`;
        const detailsRes = await fetch(detailsUrl);
        const detailsData = await detailsRes.json();

        if (!detailsData[appId].success) return null;

        const appData = detailsData[appId].data;
        if (appData.movies && appData.movies.length > 0) {
            const movie = appData.movies[0];
            if (movie.mp4 && movie.mp4.max) return movie.mp4.max;
            if (movie.webm && movie.webm.max) return movie.webm.max;
            if (movie.webm && movie.webm['480']) return movie.webm['480'];
        }
        return null;
    } catch (e) {
        return null;
    }
});

// --- OTHER FETCHERS ---
ipcMain.handle('fetch-hltb', async (event, gameName) => {
    try {
        let results = await searchHltb(gameName);
        if (results.length === 0) {
            let cleanName = gameName.replace(/[:\-].*/, '').replace(/[™®©]/g, '').trim();
            results = await searchHltb(cleanName);
        }
        if (results.length > 0 && results[0].comp_main > 0) return `${Math.round(results[0].comp_main / 3600)} Hours`;
        return "Unknown";
    } catch (e) {
        if (e.message.includes('404')) return "API Offline";
        return "Error";
    }
});

ipcMain.handle('fetch-proton', async (event, appId) => {
    try {
        const response = await fetch(`https://www.protondb.com/api/v1/reports/summaries/${appId}.json`);
        if (!response.ok) return "ERROR";
        const data = await response.json();
        return data.tier ? data.tier.toUpperCase() : "UNKNOWN";
    } catch (e) { return "ERROR"; }
});

ipcMain.handle('search-steam', async (e, gameName) => {
    try {
        let res = await fetch(`https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(gameName)}&l=english&cc=US`);
        let data = await res.json();
        if (!data.items || data.items.length === 0) return [];
        return data.items.map(item => ({ id: item.id, name: item.name }));
    } catch(e) { return []; }
});

async function sgdbFetchFirst(gameName, apiKey, appId, assetType) {
    try {
        const headers = { "Authorization": `Bearer ${apiKey}`, "User-Agent": "Mozilla/5.0" };
        let sgdbId = null;
        if (appId) {
            const r = await fetch(`https://www.steamgriddb.com/api/v2/games/steam/${appId}`, { headers });
            const d = await r.json();
            if (d.success && d.data) sgdbId = d.data.id;
        }
        if (!sgdbId) {
            const res = await fetch(`https://www.steamgriddb.com/api/v2/search/autocomplete/${encodeURIComponent(gameName)}`, { headers });
            const data = await res.json();
            if (!data.success || !data.data?.length) return null;
            sgdbId = data.data[0].id;
        }
        const endpoint = assetType === 'hero' ? 'heroes' : assetType === 'logo' ? 'logos' : 'grids';
        const res2 = await fetch(`https://www.steamgriddb.com/api/v2/${endpoint}/game/${sgdbId}`, { headers });
        const data2 = await res2.json();
        if (!data2.success || !data2.data?.length) return null;
        const url = data2.data[0].url;
        const ext = assetType === 'logo' ? 'png' : 'jpg';
        const safeN = gameName.replace(/[\\/:*?"<>|#]/g, '').trim();
        const fileName = `${safeN} - SGDB ${assetType}.${ext}`;
        if (await downloadImage(url, path.join(imagesDir, fileName))) return `GameManagerConfig/images/${fileName}`;
        return null;
    } catch(e) { return null; }
}

ipcMain.handle('sgdb-search', async (e, gameName, apiKey, appId, assetType = 'cover') => {
    try {
        const headers = { "Authorization": `Bearer ${apiKey}`, "User-Agent": "Mozilla/5.0" };
        let sgdbId = null;
        if (appId) {
            let r = await fetch(`https://www.steamgriddb.com/api/v2/games/steam/${appId}`, {headers});
            let d = await r.json();
            if (d.success && d.data) sgdbId = d.data.id;
        }
        if (!sgdbId) {
            let res = await fetch(`https://www.steamgriddb.com/api/v2/search/autocomplete/${encodeURIComponent(gameName)}`, {headers});
            let data = await res.json();
            if (!data.success || !data.data || data.data.length === 0) return [];
            sgdbId = data.data[0].id;
        }

        let endpoint = 'grids';
        if (assetType === 'hero') endpoint = 'heroes';
        else if (assetType === 'logo') endpoint = 'logos';
        else if (assetType === 'icon') endpoint = 'icons';

        let queryStr = assetType === 'cover' ? '?dimensions=600x900' : '';

        let res2 = await fetch(`https://www.steamgriddb.com/api/v2/${endpoint}/game/${sgdbId}${queryStr}`, {headers});
        let data2 = await res2.json();
        if (!data2.success || !data2.data) return [];
        return data2.data.map(g => ({ thumb: g.thumb, url: g.url }));
    } catch(e) { return []; }
});

ipcMain.handle('sgdb-apply', async (e, gameId, url, assetType = 'cover') => {
    try {
        const ext = assetType === 'cover' || assetType === 'hero' ? 'jpg' : 'png';
        const fileName = `${gameId}_Custom${assetType}_${Date.now()}.${ext}`;
        const savePath = path.join(imagesDir, fileName);

        const success = await downloadImage(url, savePath);
        if (success) {
            const dbPath = `GameManagerConfig/images/${fileName}`;

            let col = 'CoverArt';
            if (assetType === 'hero') col = 'HeroArt';
            else if (assetType === 'logo') col = 'Logo';
            else if (assetType === 'icon') col = 'Icon';

            db.prepare(`UPDATE games SET ${col} = ? WHERE id = ?`).run(dbPath, gameId);
            return dbPath;
        }
        return false;
    } catch(err) { return false; }
});

async function downloadImage(url, destPath) {
    try {
        const res = await fetch(url);
        if (!res.ok) return false;
        const buffer = await res.arrayBuffer();
        fs.writeFileSync(destPath, Buffer.from(buffer));
        return true;
    } catch (err) { return false; }
}

ipcMain.handle('auto-fetch', async (event, gameId, gameName, specificAppId) => {
    try {
        const safeName = gameName.replace(/[\\/:*?"<>|#]/g, '').trim();
        let appId = specificAppId;

        // ── 1. STEAM SEARCH (find App ID if missing) ──────────────────────
        if (!appId) {
            try {
                const sr = await fetch(`https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(gameName)}&l=english&cc=US`);
                const sd = await sr.json();
                if (sd.items?.length > 0) {
                    const match = sd.items.find(item => titleSimilarity(item.name || '', gameName) >= 0.4);
                    if (match) appId = match.id;
                }
            } catch(e) {}
        }

        // ── 2. STEAM DETAILS ──────────────────────────────────────────────
        // Read existing local images — preserved if already set; never overwritten
        const existing = db.prepare("SELECT CoverArt, HeroArt, Logo, Icon, Screenshot FROM games WHERE id=?").get(gameId) || {};
        const isLocal = (v) => v && String(v).startsWith('GameManagerConfig');

        let steamSuccess = false, appData = null;
        let desc = "", htmlDesc = "", dev = "", pub = "", released = "", meta = "";
        let genre = "", coop = "None", players = "", tags = "";
        let hltbResult = "", protonResult = "", steamTrailerUrl = "";
        let dbCoverPath  = isLocal(existing.CoverArt)   ? existing.CoverArt   : "";
        let dbHeroPath   = isLocal(existing.HeroArt)    ? existing.HeroArt    : "";
        let dbLogoPath   = isLocal(existing.Logo)       ? existing.Logo       : "";
        let dbScreenPath = isLocal(existing.Screenshot) ? existing.Screenshot : "";

        if (appId) {
            try {
                const dr = await fetch(`https://store.steampowered.com/api/appdetails?appids=${appId}`);
                const dd = await dr.json();
                if (dd[appId]?.success) {
                    steamSuccess = true;
                    appData = dd[appId].data;

                    desc     = appData.short_description || "";
                    htmlDesc = appData.detailed_description || "";
                    dev      = appData.developers?.join(', ') || "";
                    pub      = appData.publishers?.join(', ') || "";
                    released = appData.release_date?.date?.slice(-4) || "";
                    meta     = appData.metacritic ? String(appData.metacritic.score) : "";
                    genre    = appData.genres?.map(g => g.description).join(', ') || "";

                    const cats = appData.categories?.map(c => c.description) || [];
                    if (cats.includes("Online Co-op") && cats.includes("Shared/Split Screen Co-op")) coop = "Local & Online";
                    else if (cats.includes("Online Co-op")) coop = "Online";
                    else if (cats.includes("Shared/Split Screen Co-op")) coop = "Local";
                    else if (cats.includes("Co-op")) coop = "Online/Local";
                    players = [cats.includes("Single-player") && "Single-player", cats.includes("Multi-player") && "Multi-player"].filter(Boolean).join(', ');
                    tags    = cats.slice(0, 5).join(", ");

                    // HLTB
                    try {
                        let hr = await searchHltb(gameName);
                        if (!hr.length) hr = await searchHltb(gameName.replace(/[:\-].*/, '').replace(/[™®©]/g, '').trim());
                        if (hr.length > 0 && hr[0].comp_main > 0) hltbResult = `${Math.round(hr[0].comp_main / 3600)} Hours`;
                    } catch(e) {}

                    // ProtonDB
                    try {
                        const pr = await fetch(`https://www.protondb.com/api/v1/reports/summaries/${appId}.json`);
                        if (pr.ok) { const pd = await pr.json(); if (pd.tier) protonResult = pd.tier.toUpperCase(); }
                    } catch(e) {}

                    // Cover (skip if already have a local file)
                    if (!dbCoverPath) {
                        const coverFileName = `${safeName} - Cover.jpg`;
                        const coverPath = path.join(imagesDir, coverFileName);
                        let coverOk = await downloadImage(`https://steamcdn-a.akamaihd.net/steam/apps/${appId}/library_600x900.jpg`, coverPath);
                        if (!coverOk && appData.header_image) coverOk = await downloadImage(appData.header_image, coverPath);
                        if (coverOk) dbCoverPath = `GameManagerConfig/images/${coverFileName}`;
                    }

                    // Hero (skip if already have a local file)
                    if (!dbHeroPath) {
                        const heroFileName = `${safeName} - Hero.jpg`;
                        if (await downloadImage(`https://steamcdn-a.akamaihd.net/steam/apps/${appId}/library_hero.jpg`, path.join(imagesDir, heroFileName)))
                            dbHeroPath = `GameManagerConfig/images/${heroFileName}`;
                    }

                    // Logo (skip if already have a local file)
                    if (!dbLogoPath) {
                        const logoFileName = `${safeName} - Logo.png`;
                        if (await downloadImage(`https://steamcdn-a.akamaihd.net/steam/apps/${appId}/logo.png`, path.join(imagesDir, logoFileName)))
                            dbLogoPath = `GameManagerConfig/images/${logoFileName}`;
                    }

                    // Screenshots (skip if already have local screenshots)
                    if (!dbScreenPath && appData.screenshots?.length > 0) {
                        const saved = [];
                        for (let i = 0; i < Math.min(5, appData.screenshots.length); i++) {
                            const fn = `${safeName} - Screen ${i+1}.jpg`;
                            if (await downloadImage(appData.screenshots[i].path_full, path.join(imagesDir, fn)))
                                saved.push(`GameManagerConfig/images/${fn}`);
                        }
                        if (saved.length) dbScreenPath = saved.join('|');
                    }

                    // Steam trailer
                    const movie = appData.movies?.[0];
                    if (movie) steamTrailerUrl = movie.mp4?.max || movie.webm?.max || movie.webm?.['480'] || "";
                }
            } catch(e) {}
        }

        // ── 3. SGDB FALLBACK — Hero Art & Logo ───────────────────────────
        const sgdbApiKey = db?.prepare("SELECT value FROM settings WHERE key='steamgriddb_api'").get()?.value;
        if (sgdbApiKey) {
            if (!dbHeroPath) dbHeroPath = await sgdbFetchFirst(gameName, sgdbApiKey, appId, 'hero') || "";
            if (!dbLogoPath) dbLogoPath = await sgdbFetchFirst(gameName, sgdbApiKey, appId, 'logo') || "";
        }

        // ── 4. IGDB ENRICHMENT ────────────────────────────────────────────
        let similarGames = "", franchise = "", igdbTrailerId = "";
        const igdb = await igdbSearch(gameName, appId);

        const isAdultContent = igdb?.themes?.some(t => t.id === 42);
        const igdbTitleSim   = igdb ? titleSimilarity(igdb.name || '', gameName) : 1;
        const skipIgdbArtwork = isAdultContent || igdbTitleSim < 0.4;

        if (igdb) {
            // Similar games & franchise (for all games)
            if (igdb.similar_games?.length) similarGames = igdb.similar_games.map(g => g.name).slice(0, 6).join(', ');
            franchise = igdb.franchises?.[0]?.name || igdb.collection?.name || "";
            igdbTrailerId = igdb.videos?.[0]?.video_id || "";

            // Fill gaps — used when Steam failed or game is non-Steam
            if (!desc   && igdb.summary)               desc    = igdb.summary;
            if (!dev    && igdb.involved_companies)     dev     = igdb.involved_companies.filter(c => c.developer).map(c => c.company.name).join(', ');
            if (!pub    && igdb.involved_companies)     pub     = igdb.involved_companies.filter(c => c.publisher).map(c => c.company.name).join(', ');
            if (!genre  && igdb.genres)                 genre   = [...(igdb.genres?.map(g => g.name) || []), ...(igdb.themes?.map(t => t.name) || [])].slice(0, 3).join(', ');
            if (!released && igdb.first_release_date)   released = new Date(igdb.first_release_date * 1000).getFullYear().toString();
            if (!meta   && igdb.aggregated_rating)      meta    = Math.round(igdb.aggregated_rating).toString();

            // Discover Steam App ID for non-Steam games → enables ProtonDB
            if (!appId) {
                const steamExt = igdb.external_games?.find(e => e.category === 1);
                if (steamExt?.uid) {
                    appId = String(steamExt.uid).replace(/\.0+$/, '');
                    try {
                        const pr = await fetch(`https://www.protondb.com/api/v1/reports/summaries/${appId}.json`);
                        if (pr.ok) { const pd = await pr.json(); if (pd.tier) protonResult = pd.tier.toUpperCase(); }
                    } catch(e) {}
                }
            }

            // Cover from IGDB (fallback) — skip if adult content or title mismatch
            if (!dbCoverPath && igdb.cover?.url && !skipIgdbArtwork) {
                const fn = `${safeName} - Cover.jpg`;
                if (await downloadImage(igdbImg(igdb.cover.url, 'cover_big'), path.join(imagesDir, fn)))
                    dbCoverPath = `GameManagerConfig/images/${fn}`;
            }

            // Screenshots from IGDB (fallback) — skip if adult content or title mismatch
            if (!dbScreenPath && igdb.screenshots?.length && !skipIgdbArtwork) {
                const saved = [];
                for (let i = 0; i < Math.min(5, igdb.screenshots.length); i++) {
                    const fn = `${safeName} - Screen ${i+1}.jpg`;
                    if (await downloadImage(igdbImg(igdb.screenshots[i].url, 'screenshot_big'), path.join(imagesDir, fn)))
                        saved.push(`GameManagerConfig/images/${fn}`);
                }
                if (saved.length) dbScreenPath = saved.join('|');
            }
        }

        // ── 5. SAVE ───────────────────────────────────────────────────────
        if (!steamSuccess && !igdb) return { success: false, message: "No data found on Steam or IGDB." };

        const descI18n = await fetchDescI18n(appId, desc);
        db.prepare(`UPDATE games SET Description=?, SteamDesc=?, Description_i18n=?, DEV=?, PUB=?, RELEASED=?, METACRITIC=?, GENRE=?, CoverArt=?, HeroArt=?, Logo=?, Screenshot=?, SteamAppID=?, Coop=?, NumPlayers=?, Tags=?, HLTB_Main=?, ProtonTier=?, SteamTrailer=?, SimilarGames=?, Franchise=?, IGDBTrailer=? WHERE id=?`)
        .run(desc, htmlDesc, descI18n, dev, pub, released, meta, genre, dbCoverPath, dbHeroPath, dbLogoPath, dbScreenPath, appId || "", coop, players, tags, hltbResult, protonResult, steamTrailerUrl, similarGames, franchise, igdbTrailerId, gameId);

        const sources = [steamSuccess && 'Steam', igdb && 'IGDB'].filter(Boolean).join(' + ');
        return { success: true, message: `Data fetched via ${sources}!` };
    } catch (err) { return { success: false, message: `Scraping error: ${err.message}` }; }
});

// Text-only variant — same as auto-fetch but skips all image downloads
ipcMain.handle('auto-fetch-text', async (event, gameId, gameName, specificAppId) => {
    try {
        let appId = specificAppId;

        if (!appId) {
            try {
                const sr = await fetch(`https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(gameName)}&l=english&cc=US`);
                const sd = await sr.json();
                if (sd.items?.length > 0) {
                    const match = sd.items.find(item => titleSimilarity(item.name || '', gameName) >= 0.4);
                    if (match) appId = match.id;
                }
            } catch(e) {}
        }

        let steamSuccess = false, appData = null;
        let desc = "", htmlDesc = "", dev = "", pub = "", released = "", meta = "";
        let genre = "", coop = "None", players = "", tags = "";
        let hltbResult = "", protonResult = "", steamTrailerUrl = "";

        if (appId) {
            try {
                const dr = await fetch(`https://store.steampowered.com/api/appdetails?appids=${appId}`);
                const dd = await dr.json();
                if (dd[appId]?.success) {
                    steamSuccess = true;
                    appData = dd[appId].data;
                    desc     = appData.short_description || "";
                    htmlDesc = appData.detailed_description || "";
                    dev      = appData.developers?.join(', ') || "";
                    pub      = appData.publishers?.join(', ') || "";
                    released = appData.release_date?.date?.slice(-4) || "";
                    meta     = appData.metacritic ? String(appData.metacritic.score) : "";
                    genre    = appData.genres?.map(g => g.description).join(', ') || "";
                    const cats = appData.categories?.map(c => c.description) || [];
                    if (cats.includes("Online Co-op") && cats.includes("Shared/Split Screen Co-op")) coop = "Local & Online";
                    else if (cats.includes("Online Co-op")) coop = "Online";
                    else if (cats.includes("Shared/Split Screen Co-op")) coop = "Local";
                    else if (cats.includes("Co-op")) coop = "Online/Local";
                    players = [cats.includes("Single-player") && "Single-player", cats.includes("Multi-player") && "Multi-player"].filter(Boolean).join(', ');
                    tags    = cats.slice(0, 5).join(", ");
                    try {
                        let hr = await searchHltb(gameName);
                        if (!hr.length) hr = await searchHltb(gameName.replace(/[:\-].*/, '').replace(/[™®©]/g, '').trim());
                        if (hr.length > 0 && hr[0].comp_main > 0) hltbResult = `${Math.round(hr[0].comp_main / 3600)} Hours`;
                    } catch(e) {}
                    try {
                        const pr = await fetch(`https://www.protondb.com/api/v1/reports/summaries/${appId}.json`);
                        if (pr.ok) { const pd = await pr.json(); if (pd.tier) protonResult = pd.tier.toUpperCase(); }
                    } catch(e) {}
                    const movie = appData.movies?.[0];
                    if (movie) steamTrailerUrl = movie.mp4?.max || movie.webm?.max || movie.webm?.['480'] || "";
                }
            } catch(e) {}
        }

        let similarGames = "", franchise = "", igdbTrailerId = "";
        const igdb = await igdbSearch(gameName, appId);
        if (igdb) {
            if (igdb.similar_games?.length) similarGames = igdb.similar_games.map(g => g.name).slice(0, 6).join(', ');
            franchise = igdb.franchises?.[0]?.name || igdb.collection?.name || "";
            igdbTrailerId = igdb.videos?.[0]?.video_id || "";
            if (!desc   && igdb.summary)             desc    = igdb.summary;
            if (!dev    && igdb.involved_companies)   dev     = igdb.involved_companies.filter(c => c.developer).map(c => c.company.name).join(', ');
            if (!pub    && igdb.involved_companies)   pub     = igdb.involved_companies.filter(c => c.publisher).map(c => c.company.name).join(', ');
            if (!genre  && igdb.genres)               genre   = [...(igdb.genres?.map(g => g.name) || []), ...(igdb.themes?.map(t => t.name) || [])].slice(0, 3).join(', ');
            if (!released && igdb.first_release_date) released = new Date(igdb.first_release_date * 1000).getFullYear().toString();
            if (!meta   && igdb.aggregated_rating)    meta    = Math.round(igdb.aggregated_rating).toString();
            if (!appId) {
                const steamExt = igdb.external_games?.find(e => e.category === 1);
                if (steamExt?.uid) {
                    appId = String(steamExt.uid).replace(/\.0+$/, '');
                    try {
                        const pr = await fetch(`https://www.protondb.com/api/v1/reports/summaries/${appId}.json`);
                        if (pr.ok) { const pd = await pr.json(); if (pd.tier) protonResult = pd.tier.toUpperCase(); }
                    } catch(e) {}
                }
            }
        }

        if (!steamSuccess && !igdb) return { success: false, message: "No data found on Steam or IGDB." };

        const descI18n = await fetchDescI18n(appId, desc);
        db.prepare(`UPDATE games SET Description=?, SteamDesc=?, Description_i18n=?, DEV=?, PUB=?, RELEASED=?, METACRITIC=?, GENRE=?, SteamAppID=?, Coop=?, NumPlayers=?, Tags=?, HLTB_Main=?, ProtonTier=?, SteamTrailer=?, SimilarGames=?, Franchise=?, IGDBTrailer=? WHERE id=?`)
        .run(desc, htmlDesc, descI18n, dev, pub, released, meta, genre, appId || "", coop, players, tags, hltbResult, protonResult, steamTrailerUrl, similarGames, franchise, igdbTrailerId, gameId);

        const sources = [steamSuccess && 'Steam', igdb && 'IGDB'].filter(Boolean).join(' + ');
        return { success: true, message: `Text metadata fetched via ${sources}!` };
    } catch (err) { return { success: false, message: `Scraping error: ${err.message}` }; }
});

ipcMain.handle('download-csv-template', async () => {
    const win = BrowserWindow.getFocusedWindow();
    const { filePath } = await dialog.showSaveDialog(win, {
        title: 'Save CSV Template',
        defaultPath: 'GameManager_Template.csv',
            filters: [{ name: 'CSV Files', extensions: ['csv'] }]
    });

    if (filePath) {
        const headers = "Store,FAV,WANT_TO_PLAY,Game,LaunchCommand,GENRE,RELEASED,SteamAppID,ProtonTier,METACRITIC,HLTB_Main,DEV,PUB,Coop,NumPlayers,Tags,SimilarGames,HeroArt,Logo,Icon,SteamTrailer,SteamDesc,Description\n";
        fs.writeFileSync(filePath, headers, 'utf8');
        return { success: true, message: "Template generated successfully!" };
    }
    return { success: false };
});

ipcMain.handle('export-csv', async () => {
    const win = BrowserWindow.getFocusedWindow();
    const { filePath } = await dialog.showSaveDialog(win, {
        title: 'Export Library to CSV',
        defaultPath: 'GameManager_Export.csv',
            filters: [{ name: 'CSV Files', extensions: ['csv'] }]
    });

    if (filePath) {
        try {
            const rows = db.prepare("SELECT Store, FAV, WANT_TO_PLAY, Game, LaunchCommand, GENRE, RELEASED, SteamAppID, ProtonTier, METACRITIC, HLTB_Main, DEV, PUB, Coop, NumPlayers, Tags, SimilarGames, HeroArt, Logo, Icon, SteamTrailer, SteamDesc, Description FROM games").all();

            let csvContent = "Store,FAV,WANT_TO_PLAY,Game,LaunchCommand,GENRE,RELEASED,SteamAppID,ProtonTier,METACRITIC,HLTB_Main,DEV,PUB,Coop,NumPlayers,Tags,SimilarGames,HeroArt,Logo,Icon,SteamTrailer,SteamDesc,Description\n";
            rows.forEach(r => {
                const safeStore = `"${(r.Store || '').replace(/"/g, '""')}"`;
                const safeFav = `"${(r.FAV || '').replace(/"/g, '""')}"`;
                const safeWant = `"${(r.WANT_TO_PLAY || '').replace(/"/g, '""')}"`;
                const safeGame = `"${(r.Game || '').replace(/"/g, '""')}"`;
                const safeLaunch = `"${(r.LaunchCommand || '').replace(/"/g, '""')}"`;
                const safeGenre = `"${(r.GENRE || '').replace(/"/g, '""')}"`;
                const safeRel = `"${(r.RELEASED || '').replace(/"/g, '""')}"`;
                const safeAppId = `"${(r.SteamAppID || '').replace(/"/g, '""')}"`;
                const safeProton = `"${(r.ProtonTier || '').replace(/"/g, '""')}"`;
                const safeMeta = `"${(r.METACRITIC || '').replace(/"/g, '""')}"`;
                const safeHltb = `"${(r.HLTB_Main || '').replace(/"/g, '""')}"`;
                const safeDev = `"${(r.DEV || '').replace(/"/g, '""')}"`;
                const safePub = `"${(r.PUB || '').replace(/"/g, '""')}"`;
                const safeCoop = `"${(r.Coop || '').replace(/"/g, '""')}"`;
                const safePlayers = `"${(r.NumPlayers || '').replace(/"/g, '""')}"`;
                const safeTags = `"${(r.Tags || '').replace(/"/g, '""')}"`;
                const safeSimilar = `"${(r.SimilarGames || '').replace(/"/g, '""')}"`;

                const safeHero = `"${(r.HeroArt || '').replace(/"/g, '""')}"`;
                const safeLogo = `"${(r.Logo || '').replace(/"/g, '""')}"`;
                const safeIcon = `"${(r.Icon || '').replace(/"/g, '""')}"`;
                const safeSteamTrailer = `"${(r.SteamTrailer || '').replace(/"/g, '""')}"`;
                const safeSteamDesc = `"${(r.SteamDesc || '').replace(/"/g, '""')}"`;
                const safeDesc = `"${(r.Description || '').replace(/"/g, '""')}"`;

                csvContent += `${safeStore},${safeFav},${safeWant},${safeGame},${safeLaunch},${safeGenre},${safeRel},${safeAppId},${safeProton},${safeMeta},${safeHltb},${safeDev},${safePub},${safeCoop},${safePlayers},${safeTags},${safeSimilar},${safeHero},${safeLogo},${safeIcon},${safeSteamTrailer},${safeSteamDesc},${safeDesc}\n`;
            });

            fs.writeFileSync(filePath, csvContent, 'utf8');
            return { success: true, message: "Library exported successfully!" };
        } catch (err) {
            return { success: false, message: `Export failed: ${err.message}` };
        }
    }
    return { success: false };
});

ipcMain.handle('import-csv', async () => {
    const win = BrowserWindow.getFocusedWindow();
    const { filePaths } = await dialog.showOpenDialog(win, {
        title: 'Import CSV',
        filters: [{ name: 'CSV Files', extensions: ['csv'] }],
        properties: ['openFile']
    });

    if (filePaths && filePaths.length > 0) {
        try {
            const fileContent = await fs.promises.readFile(filePaths[0], 'utf8');

            const rows = [];
            let currentRow = [];
            let currentCell = "";
            let insideQuotes = false;

            for (let i = 0; i < fileContent.length; i++) {
                const char = fileContent[i];
                const nextChar = fileContent[i+1];

                if (char === '"' && insideQuotes && nextChar === '"') {
                    currentCell += '"'; i++;
                } else if (char === '"') {
                    insideQuotes = !insideQuotes;
                } else if (char === ',' && !insideQuotes) {
                    currentRow.push(currentCell.trim()); currentCell = "";
                } else if ((char === '\n' || char === '\r') && !insideQuotes) {
                    if (char === '\r' && nextChar === '\n') i++;
                    currentRow.push(currentCell.trim());
                    if (currentRow.length > 1 || currentRow[0] !== "") rows.push(currentRow);
                    currentRow = []; currentCell = "";
                } else {
                    currentCell += char;
                }
            }
            if (currentCell || currentRow.length > 0) {
                currentRow.push(currentCell.trim());
                rows.push(currentRow);
            }

            if (rows.length < 2) return { success: false, message: "CSV file appears empty or invalid." };

            const headers = rows[0].map(h => h.toLowerCase().replace(/ /g, '_'));
            const gameIdx = headers.indexOf('game');
            const storeIdx = headers.indexOf('store');

            if (gameIdx === -1) return { success: false, message: "CSV is missing the required 'Game' header." };

            let added = 0;
            let skipped = 0;

            const existingRows = db.prepare("SELECT LOWER(Game), LOWER(Store) FROM games").all();
            const existingCache = new Set(existingRows.map(r => `${r['LOWER(Game)']}|${r['LOWER(Store)'] || ''}`));

            const insertStmt = db.prepare(`INSERT INTO games (Store, FAV, WANT_TO_PLAY, Game, LaunchCommand, GENRE, RELEASED, SteamAppID, ProtonTier, METACRITIC, HLTB_Main, DEV, PUB, Coop, NumPlayers, Tags, SimilarGames, HeroArt, Logo, Icon, SteamTrailer, SteamDesc, Description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                const gameName = row[gameIdx];
                const storeName = storeIdx !== -1 ? row[storeIdx] : '';

                if (!gameName) continue;

                const cacheKey = `${gameName.toLowerCase()}|${storeName.toLowerCase()}`;
                if (existingCache.has(cacheKey)) {
                    skipped++;
                    continue;
                }

                const getVal = (colName) => { const idx = headers.indexOf(colName.toLowerCase()); return idx !== -1 ? row[idx] : ""; };

                insertStmt.run(
                    storeName,
                    getVal('fav'),
                               getVal('want_to_play') || getVal('want to play'),
                               gameName,
                               getVal('launchcommand') || getVal('launch_command'),
                               getVal('genre'),
                               getVal('released') || getVal('released_(year)'),
                               getVal('steamappid') || getVal('steam_app_id'),
                               getVal('protontier') || getVal('protondb_tier') || getVal('proton_tier'),
                               getVal('metacritic') || getVal('metacritic_score'),
                               getVal('hltb_main') || getVal('hltb_(hours)'),
                               getVal('dev') || getVal('developer'),
                               getVal('pub') || getVal('publisher'),
                               getVal('coop') || getVal('co-op'),
                               getVal('numplayers') || getVal('players'),
                               getVal('tags'),
                               getVal('similargames') || getVal('similar_games'),
                               getVal('heroart') || getVal('hero_art'),
                               getVal('logo'),
                               getVal('icon'),
                               getVal('steamtrailer') || getVal('steam_trailer'),
                               getVal('steamdesc') || getVal('steam_desc'),
                               getVal('description')
                );

                added++;
                existingCache.add(cacheKey);
            }

            return { success: true, message: `Imported ${added} new games!\nSkipped ${skipped} duplicates.` };

        } catch (err) {
            return { success: false, message: `Import failed: ${err.message}` };
        }
    }
    return { success: false };
});

// ── PLAYLISTS ─────────────────────────────────────────────────────────────────
ipcMain.handle('get-playlists', () => {
    if (!db) return [];
    return db.prepare('SELECT * FROM playlists ORDER BY name').all();
});
ipcMain.handle('add-playlist', (_, name) => {
    if (!db) return null;
    return db.prepare('INSERT INTO playlists (name) VALUES (?)').run(name.trim()).lastInsertRowid;
});
ipcMain.handle('update-playlist', (_, id, name) => {
    if (!db) return false;
    db.prepare('UPDATE playlists SET name=? WHERE id=?').run(name.trim(), id);
    return true;
});
ipcMain.handle('delete-playlist', (_, id) => {
    if (!db) return false;
    db.prepare('DELETE FROM playlist_games WHERE playlist_id=?').run(id);
    db.prepare('DELETE FROM playlists WHERE id=?').run(id);
    return true;
});
ipcMain.handle('get-playlist-games', (_, playlistId) => {
    if (!db) return [];
    return db.prepare('SELECT g.* FROM playlist_games pg JOIN games g ON g.id=pg.game_id WHERE pg.playlist_id=? ORDER BY pg.sort_order, g.Game').all(playlistId);
});
ipcMain.handle('add-game-to-playlist', (_, playlistId, gameId) => {
    if (!db) return { ok: false };
    const max = db.prepare('SELECT MAX(sort_order) AS m FROM playlist_games WHERE playlist_id=?').get(playlistId);
    const order = (max?.m ?? -1) + 1;
    try {
        db.prepare('INSERT INTO playlist_games (playlist_id, game_id, sort_order) VALUES (?, ?, ?)').run(playlistId, gameId, order);
        return { ok: true };
    } catch { return { ok: false, error: 'Already in playlist' }; }
});
ipcMain.handle('remove-game-from-playlist', (_, playlistId, gameId) => {
    if (!db) return false;
    db.prepare('DELETE FROM playlist_games WHERE playlist_id=? AND game_id=?').run(playlistId, gameId);
    return true;
});
ipcMain.handle('get-game-playlists', (_, gameId) => {
    if (!db) return [];
    return db.prepare('SELECT playlist_id FROM playlist_games WHERE game_id=?').all(gameId).map(r => r.playlist_id);
});
ipcMain.handle('get-recently-imported', (_, limit) => {
    if (!db) return [];
    return db.prepare('SELECT * FROM games WHERE date_added > 0 ORDER BY date_added DESC LIMIT ?').all(limit);
});

// ── COMMAND BAR SHELL LAUNCHER ────────────────────────────────────────────────
ipcMain.handle('run-shell-cmd', async (_, cmdStr) => {
    const { execFileSync } = require('child_process');
    const parts = cmdStr.trim().split(/\s+/);
    const [cmd, ...args] = parts;

    // Verify binary exists in PATH
    let binPath;
    try { binPath = execFileSync('which', [cmd], { encoding: 'utf8' }).trim(); }
    catch { return { ok: false, msg: `not found: ${cmd}` }; }

    // Known TUI apps that need a terminal emulator
    const TUI = new Set([
        'btop','htop','top','bpytop','glances',
        'vim','nvim','nano','micro','emacs',
        'ranger','mc','nnn','lf','vifm',
        'ncdu','lazygit','tig',
        'cmus','ncmpcpp','cava',
        'mutt','neomutt','aerc',
        'weechat','irssi',
        'alsamixer','pulsemixer',
        'neofetch','fastfetch','pfetch',
        'tmux','screen','zellij',
        'bash','zsh','fish','sh',
    ]);

    // Also flag anything with Terminal=true in its .desktop file
    let needsTerm = TUI.has(cmd);
    if (!needsTerm) {
        try {
            const desktopCheck = execFileSync('bash', ['-c',
                `grep -rl "^Exec=.*\\b${cmd}\\b" /usr/share/applications/ 2>/dev/null | xargs grep -l "^Terminal=true" 2>/dev/null | head -1`
            ], { encoding: 'utf8' }).trim();
            if (desktopCheck) needsTerm = true;
        } catch {}
    }

    if (needsTerm) {
        // Detect available terminal emulator
        const candidates = [
            process.env.TERMINAL,
            'xdg-terminal-exec',
            'x-terminal-emulator',
            'alacritty', 'kitty', 'foot',
            'gnome-terminal', 'konsole',
            'xfce4-terminal', 'xterm',
        ].filter(Boolean);

        let term = null;
        for (const t of candidates) {
            try { execFileSync('which', [t], { encoding: 'utf8' }); term = t; break; }
            catch {}
        }
        if (!term) return { ok: false, msg: 'no terminal emulator found' };

        const fullCmd = [cmd, ...args].join(' ');
        // Keep terminal open after the command exits so TUIs that close naturally
        // don't leave a ghost window — drop to an interactive shell instead.
        const bashInvoc = ['bash', '-c', `${fullCmd}; exec bash`];
        let termArgs;
        if (term === 'gnome-terminal') termArgs = ['--', ...bashInvoc];
        else if (term === 'xdg-terminal-exec') termArgs = bashInvoc;
        else if (['kitty', 'foot'].includes(term)) termArgs = bashInvoc;
        else termArgs = ['-e', ...bashInvoc]; // alacritty, xterm, konsole, xfce4-terminal, x-terminal-emulator

        spawn(term, termArgs, { detached: true, stdio: 'ignore' }).unref();
    } else {
        spawn(binPath, args, { detached: true, stdio: 'ignore' }).unref();
    }

    return { ok: true };
});
