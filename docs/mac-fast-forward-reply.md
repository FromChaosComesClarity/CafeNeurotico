# Reply — `mac` is caught up, and one Linux assumption was wrong

**Written on the MacBook Air, 2026-08-31, answering `docs/mac-fast-forward-handoff.md`.**
**`mac` fast-forwarded to `6cad12a` (1.12.0), built, run, and checked.**

The headline: everything the handoff asked about works, but **the deeplink worry was aimed at
the wrong thing**. `second-instance` is fine on macOS. `open --args` is what's broken, and it
breaks for a reason that has a one-word fix.

---

## The fast-forward

Clean, as predicted — measured here, not taken on trust:

```
git merge-base --is-ancestor origin/mac origin/main   → succeeds
git rev-list --count origin/main..origin/mac          → 0
```

**49 commits, not 48** — the handoff commit itself (`6cad12a`) landed after the doc was written.
Local `main` and `mac` are both at `6cad12a`; `package.json` went 1.9.1 → 1.12.0. (This clone's
`mac` was at `80b9848`, older than `origin/mac`, and also a clean ancestor.)

`npm install` was not skipped. `better-sqlite3` rebuilt for arm64 without complaint.

---

## Answers to the five questions

### 1. Does it launch? **Yes.**

Both faces, from source and from the packaged `.app`.

The handoff rightly warns that a live process is not proof, because an Electron error dialog
keeps one alive. So this was confirmed positively instead: a **renderer helper process** exists,
and the window title reads `Cafe Neurotico - Game Library Manager` — an error dialog would carry
neither. CREMA comes up fullscreen and fully populated (527 games, Today's Pick, the rebuilt hint
bar).

**The console mentions `omarchy`, `hypr` and `displayPicker` exactly zero times.** No warnings,
no caught-and-logged anything.

### 2. Do the deeplinks work? **Yes — and the handoff's suspicion was misdirected.**

The handoff expected `second-instance` argv delivery to be the macOS difference, and predicted a
finding of "deeplinks work on first launch only." That is **not** what happens. Measured:

| Invocation | Result |
|---|---|
| `open -a "Cafe Neurotico" --args --action=settings-desktop` (cold) | ✅ Control Panel opened on the **Desktop** page |
| `open -a … --args --action=settings-appearance` (already running) | ❌ nothing — stayed on Desktop |
| `open -n -a … --args --action=settings-appearance` (already running) | ✅ panel switched to **Appearance** |
| `open -a … --args --game=2` (cold) | ✅ opened *Lust from Beyond*'s game page |

The middle row is the one that matters, and the row below it explains it. **`second-instance`
fires correctly on macOS and argv reaches it intact** — the `-n` run proves that end to end, and
the instance count returns to one, so the lock is doing its job.

What fails is `open` itself. Handed an app that is **already running**, macOS `open` simply
activates it and **discards `--args`** — no second process is ever spawned, so there is nothing
for `second-instance` to receive. `-n` forces a new instance, which hands its argv over and quits.

⚠️ **So the rule for anything on macOS that drives the app the way the Omarchy plugin does is
`open -n -a`, not `open -a`.** Nothing in `main.js` needs to change; the dispatch code is correct
as written.

`--play=` was **deliberately not fired** — it starts a real game. It rides the exact same
`REQUEST_ARGS` → `sendRequestToWindow` path as the two that were tested, so the mechanism is
covered, but the flag itself is unproven and I am not claiming otherwise.

### 3. CREMA's two menus — **not verified.**

CREMA launches and renders correctly, but opening START and SELECT needs synthetic key input,
and **`osascript` does not have Accessibility permission on this machine**:

```
System Events got an error: osascript is not allowed assistive access. (-25211)
```

Screenshots work; clicks and keystrokes do not. Granting Terminal/osascript Accessibility in
System Settings → Privacy & Security → Accessibility would unblock this, or it is thirty seconds
by hand. **The input-routing allowlist trap the handoff flags remains unchecked**, and it is the
one thing here that could still look like a total freeze.

### 4. The jukebox — **not verified**, same reason. Reaching it needs menu navigation.

### 5. What this host disagrees with

- **`open --args` on a running app**, above. The real finding.
- **The descriptor** behaves exactly as predicted, and is worth seeing once:
  `~/.config/cafeneurotico/desktop.json` is written on every start with
  `exec` = `…/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron` when run from
  source, because `suiteExecutable()` finds no `*.AppImage` and falls back to `selfExecutable()`.
  Harmless — nothing on macOS reads it — but it does mean the file records the *dev* binary
  whenever the last start was `npm start`. Still a decision rather than a bug.

---

## One thing fixed

`apps/manager/main.js:961` — the unguarded `host.desktop.displayPicker` the handoff called out.

An audit of every `desktop.{omarchy,displayPicker,omarchyTheme}` access across `apps/` and
`packages/` found **this was the only unguarded one in the codebase**; every other site already
uses `?.`. It is now:

```js
const kwinDisplay = host.desktop?.displayPicker || null;
…
try {
    kwinDisplay?.configure(configDir);
    if (kwinDisplay?.isSupported()) kwinDisplay.apply();
} catch {}
```

Not cosmetic. Before this, macOS threw a `TypeError` on **every single start**, swallowed by the
bare `catch {}` — which also meant that block could never report a *genuine* KWin failure on
Linux, because the first statement always threw first on one platform and any real error was
indistinguishable from the expected one. The guard makes the `catch` mean something again.
Verified: the app still launches, console still clean.

---

## The build

`npm run dist:mac`, exit 0, no errors or warnings:

- `dist/CafeNeurotico.dmg` — 269M
- `dist/CafeNeurotico-arm64.zip` — 268M
- ⚠️ **unsigned** — `skipped macOS code signing  reason=identity explicitly is set to null`

**No release was cut, no tag was touched, nothing was pushed.** Per the handoff, shipping a dmg
is a separate decision, and these artifacts exist only to run the checks above.

---

## Left for whoever picks this up

1. **CREMA's START and SELECT menus**, and the jukebox's bars-and-audio-together check. Needs
   either Accessibility permission for osascript or a human at the keyboard.
2. **`--play=<id>`** against a real installed game.
3. Whether the descriptor should be written on macOS at all — still the open one-line question
   the handoff raised, and still a decision rather than a defect.
