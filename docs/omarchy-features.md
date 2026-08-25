# Cafe Neurotico on Omarchy

**A running list of everything the suite does specifically for [Omarchy](https://omarchy.org/).**
This file is the source for anything shown to Omarchy users — a forum post, a release note, a
page on the site. Add to it whenever an Omarchy-specific feature lands; keep it honest about
what is implemented versus planned.

Omarchy is **not a separate build**. `host.id` is `linux` and it runs the exact same
`packages/core/platform/linux.js` as any other Linux host. Everything below is a *desktop-level*
integration that switches itself on when Omarchy is detected and is invisible everywhere else —
the same shape as the KDE display picker, which does the reverse.

**Where the code lives:** `packages/core/omarchy.js` and `packages/core/omarchy-theme.js`. Both
import node builtins only and nothing from the rest of the suite, so they can be copied into
EmuLatte unchanged.

---

## Shipped

### 1. It knows it is on Omarchy

Reads `/etc/os-release`, so `ID=omarchy` is detected properly rather than being lumped in with
generic Arch. Version, Hyprland presence and the compositor's own version are all reported.

Two questions are kept deliberately separate:

- **`isOmarchy()`** — gates the things only Omarchy has (`omarchy pkg`, `omarchy install gaming`,
  the theme bridge).
- **`isHyprland()`** — gates window-management behaviour, and is true for anyone running Hyprland
  on plain Arch too. Those users get the Hyprland behaviour without being told they are on Omarchy.

> ⚠️ `ID_LIKE=arch` is what makes the existing pacman hints elsewhere in the app fire correctly.
> `isArchLike()` exists so nothing depends on `ID` alone if a future release drops `ID_LIKE`.

### 2. Cafe Neurotico wears your Omarchy theme

**The app applies your actual Omarchy theme — not the closest-looking one of its own 93.**

Omarchy declares its palette in `colors.toml` per theme, in named roles (`background`,
`foreground`, `accent`, …). The suite's themes have the same shape, so the palette is read and
mapped directly into a live theme. Switch themes with `omarchy theme set` and the app follows
within a moment — no restart, and nothing written to your system.

Read from `~/.local/state/omarchy/current/theme/colors.toml`, which is the *materialised* current
theme. That one path sidesteps resolving display names against slugs and stock themes against
user overlays.

> ⚠️ **Only three roles are guaranteed.** Measured across all 46 themes on a real Omarchy 4 box:
> `accent`, `background` and `foreground` appear in all 37 that ship a `colors.toml`; the richer
> roles appear in 23–24, and `mode` in 24. So declared roles are preferred and everything else is
> *derived* — an early version that just fell back through a preference chain collapsed every text
> tier into one colour and made menus invisible on minimal themes.
>
> Validated across all 46: **37 generate a clean theme, 0 failures**, lowest text-on-background
> contrast 6.66:1. The 9 with no `colors.toml` report unavailable rather than half-working.
>
> Two edge cases worth keeping: a theme whose `dark_background` equals its `background`
> (tokyoled) is treated as not having declared one, and a pure-black background derives its menu
> layer *lighter*, since darkening `#000000` goes nowhere.

Light themes (catppuccin-latte, flexoki-light) work without inverting anything — the role names
mean the same thing, and only the size of the step between layers changes.

**How it gets applied.** On a fresh install on Omarchy it is simply the default — the app comes up
already matching the desktop. For anyone who has run Cafe Neurotico before there is a one-click
**Match My Omarchy Theme** button in the Omarchy card, and the theme also sits in the picker under
**Your Desktop**.

> ⚠️ The button is not a convenience, it is the only route for an existing user. `applyTheme()`
> writes `cngm_theme` on *every* call, including when it falls back to the built-in default — so
> "this user has never chosen a theme" stops being true after the very first launch in the app's
> history, and the fresh-install default can never fire for them. Overriding a theme somebody
> deliberately picked would be worse than asking, so adopting it is one button rather than a
> silent takeover.

**CREMA follows too.** The couch face mirrors the Manager's theme by name when its theme source is
`MANAGER`, resolving it against its *own* theme table — so the palette is registered in both faces
and the IPC lives in `packages/core/shared-ipc.js` rather than the Manager's `main.js`.

> ⚠️ This is a correctness fix, not tidiness. A theme the Manager knows and CREMA does not
> resolves to `null` in `mapManagerThemeToCrema()`, and the couch face silently drops back to its
> own default — so a user matching their desktop on one face would stop matching it on the other.

### 3. It tells you what a fresh Omarchy is missing for gaming

Omarchy is aimed at developers, so a clean install has almost none of the gaming stack. Nobara —
the reference host this project develops against — ships all of it. The suite compares the two and
reports the gap, in three honest tiers:

| Tier | Meaning |
|---|---|
| **Required** | Something in the app degrades without it, and the entry says exactly what. `umu-launcher`, a DOSBox. |
| **Optional** | Useful, not load-bearing. `wine`, `pipx`, `flatpak`, `wmctrl`. |
| **Extra** | Nobara ships it and a gamer wants it, but the suite never calls it: `gamemode`, `mangohud`, `gamescope`, `winetricks`, `protontricks`. |

Every entry names the binary actually probed for, so nobody is told they need something the app
does not use. Alternates count — plain `dosbox` satisfies the DOSBox requirement, not just
`dosbox-staging`.

### 4. One-click install, through a terminal you can watch

Installing packages needs root. Rather than escalate privileges behind a GUI, the suite hands the
command to a terminal — `xdg-terminal-exec` where present, so it honours the terminal you actually
chose — and the window stays open afterwards so a failure is readable.

Repo and AUR packages become separate commands (`omarchy pkg add` / `omarchy pkg aur add`),
because mixing them produces a "target not found".

> ⚠️ **Nothing in this app ever runs `sudo` on your behalf.** You see the command, you type your
> own password, in a real terminal. This matches Omarchy's own guidance.

### 5. Omarchy's own installers, where Omarchy has one

For anything `omarchy install gaming …` covers, the suite defers to it rather than installing the
package itself — Omarchy's Steam installer also pulls the 32-bit graphics drivers selected for
*your* GPU, which is the step people miss and the reason a fresh Arch box runs Proton games badly
or not at all.

- **Steam** — detected, and if missing you are taken to `omarchy install gaming steam`. The Steam
  library is the largest part of most collections here and the suite reads it directly from disk,
  so this is surfaced prominently rather than as one item in a list.
- **32-bit graphics drivers** (`gpu-lib32`) — Proton needs the lib32 Vulkan stack.
- **Xbox controller support** — CREMA is gamepad-first, so this is worth having for couch play.

> ⚠️ **Heroic and Lutris are deliberately never mentioned.** The suite signs in to GOG and Epic
> itself and runs Windows games through Proton directly. A second launcher is not a missing piece,
> and offering to install one would undercut the thing this app exists to do.

RetroArch is carried in the module but hidden in Cafe Neurotico — emulation is EmuLatte's pillar,
and the flag exists so the EmuLatte port shows it while this app does not.

### 6. GOG downloads work on Arch at all

> ⚠️ **This was a total failure of GOG installs on every non-Fedora distribution, and nothing
> in the error pointed at the cause.**

`gogdl` is a frozen PyInstaller binary, and the `requests` inside it resolves its CA bundle from
the path baked in at *build* time. The suite's binaries are built on Fedora/Nobara, so that path is
`/etc/pki/ca-trust/extracted/pem/tls-ca-bundle.pem` — which does not exist on Arch, Debian,
openSUSE or Alpine. Every HTTPS call died before it was made:

```
OSError: Could not find a suitable TLS CA certificate bundle, invalid path:
         /etc/pki/ca-trust/extracted/pem/tls-ca-bundle.pem
```

What the user saw was "the install failed" on **every GOG title**, with no mention of TLS anywhere —
and every obvious suspect (the account, the token, the network, the store, GRINDER itself) checking
out fine.

The host's real CA bundle is now located at startup and exported as `REQUESTS_CA_BUNDLE` and
`SSL_CERT_FILE` before any helper is spawned. Fedora is checked first, because on the host the
binaries were built for the baked-in path is already correct and there is nothing to override; a
value the user exported themselves is left alone.

Diagnosed and fixed on Omarchy 4 on 2026-08-25, and verified with a real download: B.I.O.T.A.
reached 100% (211.73 MiB) where it had previously failed instantly.

> ⚠️ This is **not Omarchy-specific** — it affects Arch, Debian, Ubuntu, openSUSE and Alpine users
> of every release so far. It is listed here because Omarchy is where it was found.

### 7. Hyprland-friendly

- **The KDE-only "Which Screen Games Open On" card is removed on Hyprland**, not hidden. It is a
  KWin script and KWin is not running, so a card offering to "let KDE decide" has no business on
  an Omarchy desktop.

  > ⚠️ Hiding it was not enough, and this was a real bug rather than a theoretical one: the card
  > carries `.tools-section`, and the Control Panel resets `display` on every `.tools-section` in
  > three places — so an inline `display:none` was undone the moment the panel was opened. The
  > Mac-Native card had the identical bug in 1.8.0. Removal is the fix in both cases.

- **`wmctrl` is correctly treated as unnecessary here.** It is an X11 tool, so on a pure Wayland
  session it does nothing even when installed. The suite says so instead of reporting it missing.
- **Optional desktop tools cannot crash the app.** A minimal Wayland-only box has no `wmctrl`,
  `gio` or `xdg-open`, and a missing one used to be fatal — `spawn` reports ENOENT asynchronously,
  so the `try/catch` that looked like a guard never saw it. Fixed in 1.9.1 (`spawnOptional`), and
  **confirmed on a real Omarchy laptop that genuinely has no `wmctrl`**: CREMA, the face that would
  have died, starts clean.
- **Monitors are read through `hyprctl -j`**, matching on connector name rather than index so
  unplugging a monitor does not shift the meaning of a stored choice.

---

## Not done yet

- **A Hyprland equivalent of the per-game screen picker.** `hyprctl keyword windowrulev2 monitor`
  is the obvious route and `hyprctl` is a far friendlier IPC surface than KWin turned out to be.
  It would implement the same interface as `kwin-display.js` and be selected at runtime, so the
  existing UI would simply start working.
- **EmuLatte.** Both modules were written to be copied there unchanged; only the wiring differs.
  RetroArch's entry is already flagged for it.
- **Omarchy theme *hooks*.** `omarchy hook install theme-set` would remove the need to watch the
  filesystem, but it means writing a script into the user's system that outlives uninstalling us.
  Watching `~/.local/state/omarchy/current` costs nothing and needs no permission, so that is what
  is done instead.

---

## Testing notes

Everything above was built and verified on a real Omarchy 4.0.0 laptop (Hyprland 0.56.2), not
simulated. The theme mapping was validated against all 46 installed themes at once.

⚠️ **Releases are never cut from an Omarchy machine** — the AppImage links against the build host's
glibc, and building on rolling Arch silently raises the floor for everyone who downloads it. See
`docs/omarchy-handoff.md`.
