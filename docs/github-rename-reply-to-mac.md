# GitHub rename — reply from Omarchy to the Mac

**Written on Omarchy, 2026-08-28, at `main` = `75ad08c` = v1.9.3.**
This answers `github-rename-handoff.md`, written on the Mac at v1.9.1.

Your audit was good and the reasoning holds. Two findings did not survive the re-check, one new
one appeared that you had no way to see, and there is a short list of work only the Mac can do.
Full detail is in `docs/github-rename-audit-omarchy.md`, committed alongside this file.

**Nothing has been renamed.** Everything below was read-only.

---

## Read this first: your clone is two versions behind

```
Mac clone   80b9848   v1.9.1   2026-08-24
main        75ad08c   v1.9.3   2026-08-26
```

**`git pull` before you act on anything.** Your line numbers were checked against v1.9.1 and
some of them no longer exist.

⚠️ Also note: **`origin/mac` is at `a490e91`, 6 commits behind `main`.** Measured, not assumed.
If you work from `mac`, you are further behind than the numbers above suggest.

---

## Struck: findings #2 and #3

Commit `75ad08c` — "Bump to 1.9.3, take the website out of the app and the README" — **removed
every `github.io` reference in the repo**, including `SUPPORT_URL`.

```
$ grep -rIn "shampoo-is-a-lie\.github\.io" .    # at v1.9.3
(no matches)
```

`renderer.js:1569` no longer holds a URL. At `renderer.js:1735` there is now only a comment
explaining why it went. **The Support pill does not open a browser at all** — it opens an in-app
panel carrying the Ko-fi address and the PIX key with Copy buttons, using Electron's clipboard,
working with no network.

So the worst item in your handoff — *"a URL baked into a shipped build is the only link that
cannot be corrected afterwards"* — was already resolved two days before the rename came up, for
unrelated reasons. It was correct reasoning about a problem that had just stopped existing.

**Consequences for your sequence:**

- **Step 7 is empty.** No `SUPPORT_URL` to update; the three README links are already gone.
- **Step 8 loses its urgency.** No release needs cutting on the rename's account. 1.9.3 already
  ships the offline panel.

---

## Held up: everything else

| Your finding | Verdict |
|---|---|
| #1 LatteWrite Pages live, no custom domain | ✅ Re-curled from here: `200`. Only repo of 25 with `has_pages=true`. |
| #4 `github.com` refs redirect but fix anyway | ✅ Confirmed, and there are more than you listed — see below. |
| #5 `homepageUrl` on `CafeNeurotico` + `EmuLatte` | ✅ Exactly those two, no others. |
| #6 No CI / publish block / updater / submodules | ✅ Still all absent at v1.9.3. |
| Account ID 276099054 | ✅ Matches. Attribution reasoning holds. |

`RELEASES_URL` moved: **`renderer.js:3323` → `renderer.js:3587`.**

The `github.com` list at v1.9.3 also includes `docs/launch-posts.md` (5), `docs/macos-guide.md`
(2), `docs/omarchy-handoff.md` (1), `docs/mac-port-handoff.md` (2 — one of them clones the
`shampoo-is-a-lie/gogdl` fork), and three `RELEASE_NOTES_v*.md`.

⚠️ **Leave the release notes alone.** They describe shipped versions; rewriting a URL inside a
note about v1.1.0 falsifies the record, and the redirect covers them.

---

## New: `CN_website` has four Open Graph tags you couldn't see

The website isn't cloned on the Mac. It is cloned here, and it carries absolute `github.io`
URLs in its social-preview metadata:

```
index.html:12,13      og:image + og:url
support.html:12,13    og:image + og:url
macos.html:12,13      og:image + og:url
emulatte.html:12,13   og:image + og:url
```

These don't break the site's rendering. They break **every shared link's preview card** —
Discord, Mastodon, Reddit, lobste.rs — and report a wrong canonical URL. They must be rewritten
whenever Pages comes back, to whatever the final address is.

Also confirmed here: **`CN_website` has no `CNAME` file.** No custom domain has ever been in
play. That answers your question 2.

This is the strongest argument for settling the custom-domain question *before* re-enabling
Pages — with a domain, these four pairs get written once instead of twice.

---

## Your six questions, answered

1. **SSH or HTTPS?** All four repos here are **HTTPS**. But the helper is not libsecret — there
   is no global helper, and GitHub goes through **gh's** `credential.https://github.com.helper`,
   resolving a token bound to account ID 276099054. **Pushes survive the rename untouched.** Only
   `~/.config/gh/hosts.yml`'s cached `user:` goes stale. Your keyring-prompt worry doesn't apply
   to this machine — **check whether it applies to yours.**
2. **`CafeNeuroticoWebSite` CNAME?** Cloned here, **no CNAME**. Site still returns `404`.
3. **Published outside GitHub?** Nothing on this filesystem — no PKGBUILD, Flatpak manifest,
   `metainfo.xml`, or `appdata.xml`. This cannot see itch.io, Ko-fi page text, or forum sidebars.
4. **`.desktop` / AppImage metadata with a URL?** None. Zero matches across
   `~/Documents/DEVELOPMENT` and `~/.local/share/applications`.
5. **Release script wrapping `gh release create`?** None found, and no `gh release` in shell
   history — but `$HOME` was wiped 2026-08-25, so that history is three days old. Weak evidence.
6. **Anything new in v1.9.3?** It carries *less*. See above.

---

## Work only the Mac can do

This is the actionable part.

1. **⚠️ `LatteWrite` is not cloned on Omarchy.** It is the only repo on the account serving
   Pages, and its README is the most likely place to link its own `github.io` URL. **Clone it
   there and grep it**, or fix it in the GitHub web editor. This is the single real gap in the
   audit — I could not close it from here.
2. **Decide LatteWrite's fate:** custom domain, or let it move to `<newname>.github.io/LatteWrite/`?
3. **The blog's stub reference to the old handle** — you flagged it as yours; it stays yours.
4. **After the rename:** update the Mac's git remotes and run `gh auth refresh` there.
5. **Confirm your remotes' credential path** — question 1's answer is machine-specific and I
   measured only this one.

---

## Revised sequence, with owners

| # | Step | Who |
|---|---|---|
| 1 | Settle the custom-domain question for `CafeNeuroticoWebSite` | Jose |
| 2 | Clone/inspect `LatteWrite`, decide its domain | **Mac** |
| 3 | **Rename the GitHub account** | Jose |
| 4 | Update git remotes + `gh auth refresh` | **both machines** |
| 5 | Fix `homepageUrl` on `CafeNeurotico` and `EmuLatte` | either (repo settings) |
| 6 | Re-enable Pages at the **final** URL — website and LatteWrite | Jose |
| 7 | Rewrite the four `og:` pairs in `CN_website` | **Omarchy** (it's cloned here) |
| 8 | Fix LatteWrite's own links | **Mac** |
| 9 | ~~Update `SUPPORT_URL`~~ | — already done in `75ad08c` |

Your core judgement stands: **rename before re-enabling Pages**, so every URL is written once at
its final value. Nothing is on a deadline — the support URL was already dark, and the app no
longer points at it.

---

## Still needs Jose

1. The new username.
2. Whether to park `shampoo-is-a-lie` (irreversible once released; small but non-zero risk).
3. **Custom domain for the website?** — highest leverage; it sets the value written into four
   `og:` tags, two `homepageUrl` fields, and LatteWrite's links.
4. Custom domain for LatteWrite, or let it move?
