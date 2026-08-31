<div align="center">

# Cafe Neurotico

### *the game center for Omarchy*

![version](https://img.shields.io/badge/version-1.11.0-2fe0d6?style=flat-square)
![status](https://img.shields.io/badge/status-Experimental-ff5fa2?style=flat-square)
![platform](https://img.shields.io/badge/platform-Linux-0e1113?style=flat-square)
![license](https://img.shields.io/badge/license-GPL--3.0-2fe0d6?style=flat-square)

</div>

Every game you own — Steam, GOG, Epic, itch, PICO-8, emulators, fan games, source ports and
mods — in one place. One AppImage, three faces, no cloud, no launcher farm.

**2.0 is what this is becoming.** What you can download today is the experimental line: used
daily on the machine it is built on, and rough in places. There is no date on 2.0.

## The three faces

| | | |
|---|---|---|
| **The Manager** | the desk | Import, organise, scrape, install, launch. Mouse and keyboard. |
| **CREMA** | the sofa | Fullscreen, gamepad-first, made for a television across a room. |
| **GRINDER** | underneath | Installs GOG and Epic games headlessly, with no store client. |

## Get it

Download `CafeNeurotico.AppImage` from [Releases](https://github.com/FromChaosComesClarity/CafeNeurotico/releases),
make it executable, run it.

```bash
chmod +x CafeNeurotico.AppImage
./CafeNeurotico.AppImage              # the Manager
./CafeNeurotico.AppImage --crema      # the couch face
```

Your library, artwork and settings live in a folder beside the AppImage. Portable, backed up by
copying it, gone when you delete it.

## On Omarchy

There is a [companion plugin](https://github.com/FromChaosComesClarity/omarchy-cafeneurotico):
a bar widget showing what is installed and what is playing, and a launcher overlay — type a few
letters, press Enter, play. The app reads your actual Omarchy theme, opens games fullscreen on
the screen you chose, and stays out of the way otherwise.

## Build it

```bash
npm install
npm run dist        # → dist/CafeNeurotico.AppImage
```

Needs Node 22. `npm run dist:mac` builds the macOS pair, and only runs on a Mac.

## Documentation

The manual ships **inside the app**, under Menu → Manual. Deeper notes on the port catalogue,
per-game fixes and the macOS build live in [`docs/`](docs/) and on the
[website](https://fromchaoscomesclarity.github.io/CafeNeuroticoWebSite/).

## Support it

- **Ko-fi:** <https://ko-fi.com/cafeneurotico>
- **PIX (Brazil):** `b734a9e2-e479-42f9-abd6-c88d1b8b880e`

Starring the repo and reporting what breaks counts too.

---

<div align="center">

**one library · three faces · zero cloud**

Built by J.R.A. · GPL-3.0-or-later

</div>
