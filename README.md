<div align="center">

# ☕ Cafe Neurotico

### *your Linux game library, brewed into one app*

![status](https://img.shields.io/badge/status-brewing-ffb000?style=flat-square)
![platform](https://img.shields.io/badge/platform-Linux-1d2420?style=flat-square)
![electron](https://img.shields.io/badge/built%20with-Electron-9EAAB8?style=flat-square)
![license](https://img.shields.io/badge/license-GPL--3.0-D4A373?style=flat-square)

</div>

---

```console
cafeneurotico@linux:~$ ./brew
[ ok ] mounting library................ Manager
[ ok ] roasting GOG/Epic engine........ GRINDER
[ ok ] pouring fullscreen interface.... CREMA
[ ok ] blending into one shot.......... done

▓▓ CAFE NEUROTICO ▓▓
> three faces, one binary. brewing…
```

---

## ☕ Today's brew — one shot, three notes

| | | |
|---|---|---|
| **Manager** | your whole Linux game library, one shelf | *(formerly CNGM)* |
| **GRINDER** | roasts & installs your GOG / Epic games | *the robot barista* |
| **CREMA** | the fullscreen, gamepad-first crema on top | *the bon vivant* |

Three apps that used to ship separately are now **one Electron binary with three faces**, dispatched by argv — one runtime, one `better-sqlite3`, one copy of the helper binaries. It replaces the now-archived
[CafeNeuroticoGameManager](https://github.com/shampoo-is-a-lie/CafeNeuroticoGameManager) ·
[GRINDER](https://github.com/shampoo-is-a-lie/GRINDER) ·
[CREMA](https://github.com/shampoo-is-a-lie/CREMA).

## 🫖 The three faces

| Pour it like this | …and you get |
|-------------------|--------------|
| `cafeneurotico` | **Manager** — windowed library hub |
| `cafeneurotico grinder <cmd>` | **GRINDER** — GOG/Epic install/launch engine (+ GUI) |
| `cafeneurotico --crema` | **CREMA** — fullscreen, gamepad interface |

```
cafeneurotico/
├── main.js          # single Electron entry — argv dispatch + window factory
├── packages/core/   # shared engine + IPC (db, metadata, grinder, trailers, settings)
└── apps/
    ├── manager/     # Manager face
    ├── grinder/     # GRINDER engine + GUI
    └── crema/       # CREMA fullscreen face
```

## 🔧 Grind your own

```sh
npm install          # deps + rebuilds better-sqlite3; pulls the helper binaries (GitHub Release)
npm start            # run the Manager face
npm run start:crema  # run the CREMA face
npm run dist         # build CafeNeurotico.AppImage
```

> Helper binaries (ffmpeg / yt-dlp / gogdl / legendary / comet) and CREMA's wallpaper pack
> are fetched from this repo's GitHub Releases — keeping the repo and the AppImage lean.

## ☕ Tip the barista

If Cafe Neurotico organized your gaming life, consider buying me a coffee — it keeps the pot warm.
**"more caffeine is `more good`."**

- ☕ **Ko-fi (Intl):** <https://ko-fi.com/cafeneurotico>
- 🇧🇷 **PIX (Brazil):** `b734a9e2-e479-42f9-abd6-c88d1b8b880e`

If you do, [let me know](mailto:shampooisalie@gmail.com) so I can thank you personally! :)

---

<div align="center">

**▸ now brewing as ONE app · coming soon**

Built by J.R.A. · `shampooisalie@gmail.com` · GPL-3.0-or-later

</div>
