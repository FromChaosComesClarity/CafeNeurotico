# Phase 4 — CREMA gets simpler, and the project gets a face

**Opened 2026-08-31**, from a single instruction: cut management out of CREMA, make its
installs seamless, redesign the jukebox, give the bar widget a menu, refresh the public face
(website, README, manual), and publish the plugin when testing says so.

The through-line: **the Manager manages, CREMA plays.** Everything below either enforces that
split or shows the result to someone who has never seen the app.

---

## The one gate

⚠️ **Nothing is cut from CREMA until the inventory below is reviewed.** Asked how far
"eliminate any management feature" goes, Jose chose *"show me the inventory first"* — so W1 is
a review step with no code in it, and W2 does not start until it comes back marked up.

---

## W1 — CREMA feature inventory (review, no code)

Every user-reachable feature in CREMA today, with a recommendation. CREMA is 4,886 lines of
renderer, 1,136 of main, 1,047 of markup.

### System menu (START) — 20 items in 5 sections

| Section | Item | Recommend | Why |
|---|---|---|---|
| Audio | Jukebox Mode | **keep** | The thing being redesigned in W4 |
| Audio | Sound Settings | **keep** | Volume and BGM belong where you listen |
| Appearance | Color Scheme | **keep** | 93 themes; changing one is a couch decision |
| Appearance | Interface Font | **keep** | Same |
| Appearance | Home Screen | **keep** | Which face CREMA opens on |
| Appearance | Start Screen | **keep** | Same |
| Appearance | Browse Mode | **keep** | How you move through the library |
| Appearance | Gamepage Style | **keep** | Same |
| Appearance | Screensaver | **keep** | Only meaningful on a TV |
| Controls | Keybindings | **keep** | Unusable from another room if it moves |
| Controls | Gamepad Icons | **keep** | Same |
| Controls | Wake Method | **keep** | Same |
| Library | Filter by Genre | **keep** | Browsing, not management |
| Library | History | **keep** | Browsing |
| Library | PICO-8 Games | **keep** | A visibility filter |
| Library | Free-to-Play Games | **keep** | A visibility filter |
| Library | Hidden Games | **cut** | Editing what the library contains — the Manager owns it |
| System | About | **keep** | |
| System | Quit | **keep** | |

### Per-game menu (SELECT) — 12 items

| Item | Recommend | Why |
|---|---|---|
| Download / Delete Trailer | **cut** | Fetches and deletes media: library maintenance |
| Add / Remove Favourite | **keep** | One-button taste, the point of a couch UI |
| Add / Remove Want to Play | **keep** | Same |
| Mark / Unmark Played | **keep** | Same |
| Add to Playlist | **decide** | Assigning is couch-shaped; *creating* playlists is not |
| Add Launch Command | **cut** | Typing a command line on a gamepad |
| Rename | **cut** | Editing library data |
| Scraping | **cut** | The heaviest management feature in CREMA |
| View Achievements | **keep** | Read-only, and it belongs beside the game |
| Install via GRINDER | **keep, rebuild** | See W3 — this is the seam that needs fixing |
| Uninstall via GRINDER | **decide** | Freeing space from the couch is real; so is doing it by accident |

### Known defect to fix while in here

`apps/crema/renderer.js:4726` — the install dialog swallows a null size into "Size info
unavailable". Deliberately unfixed until now because CREMA exposes no auth-status IPC and must
never offer a store login; the honest fix is a "sign in from The Manager" message plus two new
handlers. **This is the oldest open item in the project.**

**Deliverable:** this table, marked up by Jose. Nothing else.

## W2 — Cut what W1 says to cut

Mechanical once W1 returns. Expect a large deletion in `renderer.js` and `index.html`, and the
menus to shrink.

⚠️ **The overlay input-routing allowlist trap.** A menu's `gameState` missing from the
allowlist looks like a *total app freeze*, not a broken menu — it cost a bug on the font
picker. Removing states is safer than adding them, but the allowlist has to shrink with them.

⚠️ Deleting by line range has bitten this codebase twice (a lost `renderGallery`, 18 unclosed
CSS comments). Delete by structure, then check brace *and* comment balance, then run the app.

## W3 — Installs, seamless

The ask: "the installs should be as seamless as possible."

Today CREMA's install path opens a confirm dialog, hands to GRINDER's headless installer, and
polls `grinder-progress.json`. The failure modes are the interesting part: no auth (the null
above), not enough disk, a store that needs a browser login. On a gamepad, in another room,
each of those is a dead end.

- Progress that reads at three metres — a real bar, bytes and ETA, not a line of text
- Every failure ends in an instruction, not a shrug ("Sign in from The Manager on your desk")
- Cancel and resume without leaving the game's page
- Install from the gamepage, in place: no modal stack

## W4 — The jukebox, redesigned

Reference: **cliamp.stream** — dark near-black, cyan accent with magenta secondary, monospace
throughout, box-drawing borders, CRT/scanline feel, numbered file-name section labels, terse
copy, flat surfaces, generous vertical rhythm.

A complete redesign, not a restyle: transport, spectrum visualiser, playlist, now-playing with
art, all readable from a sofa and drivable on a gamepad. It should look like the thing Winamp
would have been if it had been written for a TV.

## W5 — A menu for the bar widget

One click from the bar: the Manager · CREMA · the launcher overlay · Manage Storage, plus what
is playing when something is. Modelled on the shell's own popup surfaces, themed from the same
tokens as the launcher.

## W6 — The website, as a teaser

Currently **offline on purpose** (Pages disabled, nothing deleted) and three releases behind.

- The cliamp.stream identity, and **drop the coffee-shop theme** for this phase
- The message: the app is changing, and it has found a home in Omarchy
- A slideshow from `/home/jose/Pictures/CN_Omarchy Screenshots` — **106 shots, 78 MB** — a
  selected handful converted to webp
- Restoring Pages is a separate, deliberate step: source `main`, path `/`

## W7 — README, short and assertive

Currently 196 lines. Cut hard: what it is, what it runs, how to get it, one screenshot.
Details live in the manual and on the site.

⚠️ Two mentions of the old identity's email address remain at lines 188 and 196 — **the only
mentions left in the repository**, and they need Jose's call on which address replaces them.

## W8 — The manual, revised (not rewritten)

730 lines, well structured, and the outline is right. Recommendation: **revise, do not
rewrite** — a rewrite discards correct prose to re-derive the same outline.

What is stale, measured: **GRINDER appears 18 times** and its GUI no longer exists · "sidebar"
and the layout system are gone · the display picker is described as KDE-only · **Omarchy
appears zero times** despite being where the app now lives.

⚠️ **This goes last.** CREMA's chapters describe features W2 is about to delete.

## W9 — Publish the plugin

Gated on Jose's testing, not on the app: 1.11.0 ships the descriptor the plugin needs. When
unblocked: flip the repo public, add `preview.png`, submit to Omarchy's plugin marketplace.

---

## Done already, 2026-08-31

- **`docs/omarchy-phase3.md`** — Phase 3 written up.
- **The old handle is gone from the repository.** Three release notes had live links rewritten
  (a claimed handle would repoint them at a stranger); the timeline was redacted; three
  finished cross-machine rename handoffs (621 lines) deleted; and `package.json`'s author —
  which ships inside every AppImage — corrected to `J.R.A.`. Only the README's two email
  mentions remain, pending W7.
- **`github.com/FromChaosComesClarity/omarchy-cafeneurotico`** created **private**, default
  branch `main`, three commits pushed. One command makes it public when testing says so.

## Order

W1 gates W2. W8 follows W2 and W4. Everything else is independent.

A sensible run: **W1 → W5 → W6 → W7** (visible, unblocked) while the inventory is being
reviewed, then **W2 → W3 → W4**, then **W8**, with **W9** whenever Jose says.
