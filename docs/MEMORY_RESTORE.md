# Restoring Claude Code's memory onto the Omarchy laptop

The repo carries the code. **Claude Code's memory carries the reasoning** — why decisions were
made, which traps cost real debugging, what is verified versus merely built. None of it is in
git. Restore it with **ClaudeMemKeeper** before the first real session.

---

## Why this needs an app at all

Claude Code keys everything by absolute path. Memories live in

```
~/.claude/projects/<slug>/memory/
```

where `<slug>` is the project's absolute path with every `/`, `_` and `.` turned into `-`. For
this project on the Nobara desktop that is:

```
-home-jose-Documents-DEVELOPMENT-CLAUDE-CafeNeurotico
```

The `projects` map in `~/.claude.json` is keyed by absolute path too, and every line of a session
transcript records the `cwd` it ran in. Copy the folder across untranslated and the memories are
on disk but invisible. ClaudeMemKeeper rewrites all three on restore.

**The lucky part:** if you clone to `/home/jose/Documents/DEVELOPMENT/CLAUDE/CafeNeurotico` on the
laptop — same username, same path — the slug is **identical** and no translation is needed at all.
Only a different username or a different directory makes the remapping matter. The Mac needs it
(`/Users/jose/…`); this laptop probably won't.

---

## On the Nobara desktop — before you leave

1. Open **ClaudeMemKeeper** (`~/ClaudeMemKeeper/ClaudeMemKeeper.AppImage`).
2. **Back up.** Do this *after* any memory updates from the session you just finished, or you
   will carry a stale snapshot across. The app skips the upload entirely if nothing changed,
   so a redundant backup costs nothing.
3. The credentials file is **already exported** to `~/claudememkeeper-settings.json` (mode 0600).
   It holds the Google OAuth **client id and secret** — no token, no machine identity. Treat it
   like a password: move it on a USB stick or another private channel, not a public one.

Current state of that machine, for reference:

| | |
|---|---|
| Machine name in Drive | `nobara-pc-Linux` |
| Sets included | core, memories, projectConfig, transcripts, promptHistory |
| Transcript cap | none (`transcriptDays: 0`) |
| Retention | 10 snapshots |

---

## On the Omarchy laptop

1. **Get the app there.** Copy `ClaudeMemKeeper.AppImage` across (~115 MB), or clone
   `ClaudeMemKeeper` and `npm install && npm run build`. Put the AppImage in its own folder —
   ⚠️ **on Linux it keeps its settings in `CMK_DATA/` *beside the AppImage*, not in `~/.config`**,
   so binary and config travel together. `chmod +x` it. (Needs `fuse2`, same as Cafe Neurotico.)
2. **Settings → Import settings…** and pick `claudememkeeper-settings.json`. This is the only
   step that cannot bootstrap itself — a fresh machine has no Drive credentials, including this
   app's own.
3. **Connect to Google Drive.** Each machine authorises separately; the token is deliberately not
   in the settings file, so revoking one machine cannot sign the others out. Sign-in uses a
   loopback redirect on a port the OS assigns, so there is nothing to configure.
4. **Name this machine** — that name becomes its own folder in Drive. Something like
   `omarchy-laptop-Linux`. **Do not reuse `nobara-pc-Linux`**, or the two machines' snapshots
   land in the same folder and the retention limit will start evicting the other machine's.
5. **Restore → pick the `nobara-pc-Linux` snapshot.** Use **"Add only what is missing"** for this
   first import — it never overwrites and never deletes, which is what you want on a machine that
   already has its own fresh Claude Code install. ("Merge, newest wins" is the right mode later,
   once the two are in step.)
6. The app builds a **plan** first: how many files would be written, which are identical, which
   local copies are newer. What you approve is exactly what runs, and a rollback archive goes to
   `CMK_RECOVERY/` before anything is touched.

---

## Then

```bash
cd ~/Documents/DEVELOPMENT/CLAUDE/CafeNeurotico
claude
```

and open with:

> "Resume the Cafe Neurotico project. Read your memory files for context."

If the memories did not land, the giveaway is Claude having no idea what CREMA or GRINDER are.
Check that `~/.claude/projects/-home-jose-Documents-DEVELOPMENT-CLAUDE-CafeNeurotico/memory/`
exists and holds ~38 `.md` files with `MEMORY.md` among them.

---

## What is deliberately never carried across

`.credentials.json` (Claude Code's own auth token — machine-bound, and copying it is how you get
mystery logouts), live session runtime state, and caches. From `~/.claude.json`: `machineID`,
`userID`, `oauthAccount` and onboarding flags, so two installs never claim to be the same one.

Read `~/Documents/DEVELOPMENT/CLAUDE/ClaudeMemKeeper/README.md` for the full picture.
