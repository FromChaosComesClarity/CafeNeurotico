# GitHub rename — Omarchy audit results

**Run on Omarchy, 2026-08-28, at `main` = `75ad08c` = v1.9.3.**
Companion to `~/Downloads/github-rename-handoff.md` (written on the Mac at v1.9.1).

Everything below was executed read-only. **Nothing was renamed, edited, or re-enabled.**

---

## Headline: the repo is already clean

⚠️ **The Mac handoff's findings #2 and #3 are stale and should be struck.**

The Mac clone was at v1.9.1. Commit **`75ad08c`** — "Bump to 1.9.3, take the website out of the
app and the README", the current `main` — **deleted all four `github.io` references**, including
the one that mattered:

```
$ grep -rIn "shampoo-is-a-lie\.github\.io" .   # at v1.9.3
(no matches)
```

`SUPPORT_URL` no longer exists. `renderer.js:1735` now carries only a comment explaining why:

> ⚠️ This used to open the project website's support.html. The site is offline while the app is…

The Support pill opens an **in-app panel** with the Ko-fi address and PIX key plus Copy buttons —
no browser, no network, no URL. So the "URL baked into a shipped build" problem was already
solved two days before the rename was considered, for unrelated reasons.

**Consequence for the sequence:** step 7 of the Mac's recommended sequence ("Update `SUPPORT_URL`
in `renderer.js`") **no longer applies.** There is nothing to update. And step 8 — cutting a
release so users get a working support link — is no longer a rename concern either; 1.9.3 already
ships the offline panel.

---

## Confirmed, corrected, and new

| Mac finding | Status on Omarchy at v1.9.3 |
|---|---|
| #1 LatteWrite Pages is live | ✅ **Confirmed.** Re-curled from here: `200`. Only repo on the account with `has_pages=true`. |
| #2 `SUPPORT_URL` baked into the app | ❌ **Stale.** Removed in `75ad08c`. No longer in the codebase. |
| #3 Four `github.io` refs in the repo | ❌ **Stale.** All four removed in the same commit. Now zero. |
| #4 `github.com` refs (redirect anyway) | ⚠️ **Confirmed but renumbered** — see below. More of them than the Mac listed. |
| #5 Two repos with dead `homepageUrl` | ✅ **Confirmed exactly.** `CafeNeurotico` and `EmuLatte`, no others. |
| #6 No CI / publish / updater / submodules | ✅ **Confirmed at v1.9.3.** No `.github/`, no `.gitmodules`, no `publish` block. |
| — | 🆕 **`CN_website` holds four live `og:` `github.io` tags.** The Mac couldn't see this — the repo isn't cloned there. |

### 🆕 New finding: Open Graph tags in `CN_website`

Not visible from the Mac. Four pages carry absolute `github.io` URLs in their social-preview
metadata:

```
index.html:12,13      og:image + og:url   → .../CafeNeuroticoWebSite/
support.html:12,13    og:image + og:url   → .../support.html
macos.html:12,13      og:image + og:url   → .../macos.html
emulatte.html:12,13   og:image + og:url   → .../emulatte.html
```

These don't break the site's own rendering, but after a rename every shared link — Discord,
Reddit, Mastodon, lobste.rs — loses its preview image and reports a wrong canonical URL. They
must be rewritten **whenever the site comes back**, to whatever the final URL is. This is the
strongest argument yet for settling the custom-domain question *before* re-enabling Pages: with
a custom domain these get written once, correctly, forever.

`CN_website` also holds **12 `github.com` links** (releases, issues, source) across
`support.html`, `macos.html`, `emulatte.html`, `index.html`. Those redirect.

### Corrected line numbers in the monorepo

`RELEASES_URL` moved. The Mac had `renderer.js:3323`; at v1.9.3 it is:

```
apps/manager/renderer.js:3587   const RELEASES_URL = 'https://github.com/shampoo-is-a-lie/CafeNeurotico/releases'
scripts/fetch-binaries.mjs:53   linux binaries tarball    (sha256-pinned)
scripts/fetch-binaries.mjs:57   darwin binaries tarball   (sha256-pinned)
README.md:14, 71, 72, 73, 144, 148, 153
docs/macos-guide.md:9, 53
docs/mac-port-handoff.md:52, 245        ← :245 clones the gogdl fork
docs/omarchy-handoff.md:133
docs/launch-posts.md:78, 113, 139, 155, 170
RELEASE_NOTES_v1.1.0.md:13 · RELEASE_NOTES_v1.9.1.md:20 · RELEASE_NOTES_v1.9.2.md:52
```

All redirect. The release-notes files are historical records of shipped versions — **leave them
alone**; rewriting the URL in a note describing v1.1.0 falsifies the record, and the redirect
covers them.

---

## The six questions, answered

**1. SSH or HTTPS remotes?** — **All HTTPS.** Four repos cloned here:

```
CafeNeurotico · CN_website · LatteDictate · OAKANIZER    (all https://github.com/shampoo-is-a-lie/…)
```

But the credential path is **not** libsecret/gnome-keyring. There is **no global helper**; GitHub
uses gh's:

```
credential.https://github.com.helper = !…/mise/installs/gh/2.98.0/…/gh auth git-credential
```

That resolves through the OAuth token, which is bound to account ID **276099054**, not the
handle. **Pushes will keep working after the rename with no intervention.** The stale bit is
cosmetic: `~/.config/gh/hosts.yml` caches `user: shampoo-is-a-lie`. Fix with `gh auth refresh`
(or re-login) after renaming. The Mac's worry about a keyring prompt does not apply to this
machine.

**2. Is `CafeNeuroticoWebSite` cloned here, and does it have a CNAME?** — **Yes, cloned. No
`CNAME` file.** No custom domain is in play; the `github.io` URL is the only address it has ever
had. Re-verified live: the site returns `404` (Pages still deliberately disabled).

**3. Anything published outside GitHub?** — **Nothing found.** No `PKGBUILD`, no Flatpak
manifest, no `metainfo.xml`/`appdata.xml` anywhere under `~/Documents/DEVELOPMENT`. The only
`.desktop` files are LatteDictate's, and **none contain the handle**. The installed
`~/.local/share/applications/lattewrite.desktop` points at a local AppImage path only.
⚠️ This covers *this machine's filesystem only* — it cannot see itch.io, Ko-fi page text, or a
Reddit sidebar. Those remain unverified.

**4. Do `.desktop` files or AppImage metadata embed a project URL?** — **No.** Grepped every
`.desktop` in `~/Documents/DEVELOPMENT` and `~/.local/share/applications`: zero matches.

**5. A release script or shell function wrapping `gh release create`?** — **None found**, and
shell history has no `gh release`/`gh repo` invocations at all. Note the home directory was wiped
on 2026-08-25, so the history is only three days old — this is weak evidence, not proof.

**6. Does v1.9.3 carry anything new referencing the handle?** — It carries **less**, not more.
See the headline.

---

## Full account inventory (25 repos)

Pulled live via `gh api user/repos`. `login=shampoo-is-a-lie  id=276099054` — the ID matches the
Mac's, so commit attribution reasoning holds.

**Only one repo has Pages:**

| Repo | Pages | Visibility | homepage |
|---|---|---|---|
| **LatteWrite** | ✅ **true** | public | — |
| CafeNeurotico | false | public | ⚠️ `…github.io/CafeNeuroticoWebSite/` |
| EmuLatte | false | public | ⚠️ `…github.io/CafeNeuroticoWebSite/emulatte.html` |
| CafeNeuroticoWebSite | false | public | — |
| CafeNeuroticoClock · CafeNeuroticoGameManager · CREMA · Crema-KDE-Theme · GRINDER · gogdl · WhatsTheFuck · youTOBA | false | public | — |
| BrewBalance · ClaudeMemKeeper · CREMAfy · DripSync · DripSync_Android · EspressoStudio · LatteDictate · LatteRIG · LatteScribe · LatteWriteAndroid · LatteWriteMac · OAKANIZER · OAKANIZER_Mac | false | private | — |

⚠️ **`LatteWrite` is not cloned on Omarchy.** Its README — the thing most likely to link its own
Pages site — cannot be checked or fixed from this machine. **That work belongs to the Mac**, or
to the GitHub web editor. This is the one real gap in the audit.

---

## What changes in the recommended sequence

The Mac's sequence is sound. Three amendments:

- **Drop step 7's `SUPPORT_URL` half.** Already done in `75ad08c`. The three README links it
  mentions are also already gone — README now has no `github.io` links at all.
- **Add: rewrite the four `og:` tag pairs in `CN_website`** at step 6/7, when the final URL is
  known. This is new work the Mac didn't know about.
- **Add: `gh auth refresh` on both machines** after the rename, to clear the cached `user:` in
  `hosts.yml`. Cosmetic, but it prevents confusing output later.
- **Add: LatteWrite's README is Mac-side work** — not clonable here.

The Mac's core judgement stands: **rename before re-enabling Pages**, so every URL is written
once at its final value.

---

## Still needs Jose — unchanged from the Mac's list

1. The new username.
2. Whether to park `shampoo-is-a-lie`.
3. **Custom domain for `CafeNeuroticoWebSite`?** — now the highest-leverage question, because it
   determines the value written into four `og:` tags, two `homepageUrl` fields, and LatteWrite's
   links. Same argument that put the blog on its own domain.
4. Custom domain for LatteWrite, or just let it move?

No release needs to be cut for the rename. Nothing is on a deadline: the support URL was already
dark before this came up, and the app no longer points at it.
