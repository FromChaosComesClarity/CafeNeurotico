# Cafe Neurotico on macOS — Experimental

**Linux is the primary platform.** It's what's tested first, what ships fastest, and what the
rest of this README is written for. The macOS build is a second host in the same codebase —
real, working, and actively used, but younger, unsigned, and with less mileage behind it than Linux.
"Experimental" means exactly that: expect it to work for the things listed below as working, and
expect rough edges anywhere this guide doesn't mention.

If something breaks, [open an issue](https://github.com/shampoo-is-a-lie/CafeNeurotico/issues) —
macOS reports are genuinely useful right now, this build needs them.

## What works today

- **The full library**: Steam, GOG and Epic sign-in, sync, and browsing — all three faces (the
  Manager, CREMA, and GRINDER)
- **Installing and launching Mac-native GOG and Epic games** — real downloads through `gogdl` and
  `legendary` directly, not a browser hand-off
- **A filter for which of your games are actually Mac-native** — the "Mac-Native" option in the
  library's category dropdown, plus a small apple badge on the cover art of anything it applies
  to. GOG/Epic are checked instantly from what you already own; Steam needs one "Scan for Mac
  Compatibility" pass (Control Panel → search "mac native") since it's a live check per game
- Artwork, genres, playlists, save-game backups, themes — everything that isn't platform-specific
  works exactly like the Linux build, because almost all of the app *is* the same code

## What doesn't work yet

- **Windows games.** No compatibility layer is wired in yet — installing or launching a
  Windows-only GOG/Epic title won't work. This is the current focus (CrossOver integration); it
  isn't a small gap, it's the next real chunk of the port.
- **A picker for which screen a game opens on.** KDE-only feature on Linux; no macOS equivalent
  exists yet.
- **Custom installers / source ports / mods** (Ironwail, GZDoom, the Build-engine games, etc.) —
  the whole recipe catalogue is Linux-only for now.
- **An external-drive-aware install location.** Games install to `~/Games/CafeNeurotico` on your
  internal disk; pointing that at an external SSD works if you pick the folder yourself, but
  nothing in the app is aware of a drive being unplugged yet.

## Install

1. Download the `.dmg` (or the `.zip`) from the
   [latest release](https://github.com/shampoo-is-a-lie/CafeNeurotico/releases/latest) — look for
   the macOS asset specifically, it's separate from the Linux AppImage.
2. Open the `.dmg` and drag **Cafe Neurotico** into **Applications** (or, for the `.zip`, unzip it
   and move the `.app` there yourself).
3. **The build isn't signed** — no Apple Developer account behind it yet — so the very first
   launch needs one extra step. Pick whichever works on your macOS version:
   - **Right-click (or Control-click) the app → Open → Open.** This still works on most versions,
     though Apple has been tightening it release over release.
   - **If that option doesn't appear at all:** double-click normally, let it get blocked, then go
     to **System Settings → Privacy & Security**, scroll down, and click **Open Anyway** next to
     the message about Cafe Neurotico. Confirm once more when it asks.
   - **From Terminal, if neither of the above shows anything:**
     ```sh
     xattr -dr com.apple.quarantine "/Applications/Cafe Neurotico.app"
     ```
     This strips the quarantine flag macOS attaches to anything downloaded from the internet —
     after that, it opens like any other app, every time.

   You only need to do this once per install. It's not a workaround for something broken — it's
   the standard cost of an app that hasn't gone through Apple's notarization process yet.

4. First launch walks you through connecting Steam/GOG/Epic — the same onboarding as the Linux
   build. Nothing here is mandatory; everything it offers also lives in the Control Panel later.

## Where things live

Everything is under `~/Library/Application Support/`:

| What | Where |
|---|---|
| Your library (games, artwork, playlists, settings) | `CafeNeurotico/GameManagerConfig/` |
| GOG/Epic install state, auth, launch logs | `CafeNeurotico/GRINDERConfig/` |
| Installed games (default location) | `~/Games/CafeNeurotico/` |

Nothing is under `/Applications` except the app bundle itself — deleting the app and reinstalling
a new build never touches your library.

## If something looks wrong

- **A game the app thinks is installed won't launch, or shows a "not found" error it shouldn't.**
  This build occasionally ends up with two disagreeing copies of its GOG/Epic database if the
  standalone GRINDER window and the Manager have ever pointed at different files — a known,
  fixed-once-already class of bug. Quitting and reopening the app (Cmd+Q, not just closing the
  window) resolves it if it recurs; if it doesn't, that's worth reporting with the exact error
  text.
- **Nothing opens at all, silently.** Check Console.app (search for "Cafe Neurotico") for a crash
  log, or run the app from Terminal directly to see errors live:
  ```sh
  "/Applications/Cafe Neurotico.app/Contents/MacOS/Cafe Neurotico"
  ```

## For anyone building from source

The developer-facing docs — architecture, the platform-backend design, exact phase-by-phase
history of what got built and why — live in `docs/mac-port-handoff.md` and
`docs/mac-port-phase-a.md` in this repo. Worth reading before touching the macOS-specific code;
several of the traps documented there cost real debugging time to find the first time.
