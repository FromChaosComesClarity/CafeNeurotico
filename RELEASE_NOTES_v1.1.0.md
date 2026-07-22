Cafe Neurotico 1.1.0

A small, focused release: Cafe Neurotico now opens **straight to a game**.

## What's new

**`--game=<id>` deep-links.** Launch the suite with `--game=<id>` and The Manager opens directly on that game's page instead of the library — and if it's already running, the open window navigates there rather than a second copy starting up.

```sh
./CafeNeurotico.AppImage --game=753    # opens straight to that game
```

The desk-clock companion, [**CafeNeuroticoClock**](https://github.com/shampoo-is-a-lie/CafeNeuroticoClock), is the first to use it: the game name on its slideshow is now clickable and brings you here, to that exact game.

Everything else from 1.0 is unchanged — same database, same 92 themes, same three faces.

## Install

1. Download `CafeNeurotico.AppImage` below
2. `chmod +x CafeNeurotico.AppImage`
3. Run it

Upgrading from 1.0.0? Just replace the AppImage. Your `GameManagerConfig` folder — your entire library — is untouched.

```sh
./CafeNeurotico.AppImage            # The Manager — the desktop library hub
./CafeNeurotico.AppImage --crema    # CREMA — fullscreen, gamepad-first
./CafeNeurotico.AppImage grinder    # GRINDER — the GOG/Epic engine
```

## Notes

- Linux only. The suite ships as a single AppImage; there are no Windows or macOS builds.
- The About dialog now reads 1.1.0.

## Tip the barista

If Cafe Neurotico organized your gaming life, consider buying me a coffee — it keeps the pot warm. *"more caffeine is `more good`."*

- **Ko-fi (Intl):** https://ko-fi.com/cafeneurotico
- **PIX (Brazil):** `b734a9e2-e479-42f9-abd6-c88d1b8b880e`

Built by J.R.A. · GPL-3.0-or-later
