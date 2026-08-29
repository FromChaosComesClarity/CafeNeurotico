# GitHub rename — assessment handoff to Omarchy

**Written on the MacBook, 2026-08-28, to be read on Omarchy before the account is renamed.**

> ## ⚠️ Superseded in part — read this first
>
> **The rename is done.** The account is now **`FromChaosComesClarity`** (ID `276099054`,
> unchanged). This document is kept as the record of the pre-flight assessment, not as
> instructions.
>
> Two of its findings were **struck** by the Omarchy re-check at v1.9.3, and its line numbers
> were taken at v1.9.1 and have moved. Read it alongside:
>
> - `docs/github-rename-reply-to-mac.md` — Omarchy's answer, listing what was struck
> - `docs/github-rename-audit-omarchy.md` — the full Omarchy audit
>
> Corrections that matter, established after this was written:
>
> - **Finding #2 and #3 are stale.** Commit `75ad08c` (v1.9.3) removed every `github.io`
>   reference from this repo, `SUPPORT_URL` included. There is nothing here to update.
> - **The `og:` finding is larger than first reported.** All **7** pages in `CN_website` carry
>   `og:image` + `og:url` with the old handle — 14 tags, not 8 across 4 pages.
> - **LatteWrite links to its own Pages URL zero times.** The gap this document flagged was
>   closed on the Mac; only `package.json`'s `author` needed changing, and it has been.
> - **Mac credential path:** `osxkeychain` (Apple's system gitconfig) plus a
>   `credential.https://github.com.helper` pointing at `gh`. Pushes survived the rename with no
>   intervention. A stale `github.com` keychain entry for the old handle remains, and is inert.

Jose is planning to change his GitHub username from `shampoo-is-a-lie` to something else.
Nothing has been renamed yet. This document is the pre-flight check.

> ⚠️ **Read the "Evidence and its limits" section before trusting any file/line reference here.**
> The Mac clone is at **v1.9.1** and `main` on GitHub is at **v1.9.3**. Some findings may be
> stale. Every line number in this document needs re-checking on Omarchy.

---

## The decision in one paragraph

A GitHub username change is *mostly* safe: GitHub installs a permanent redirect from the old
name to the new one covering repo URLs, git operations over HTTPS and SSH, release downloads,
issues, and PRs. Account-bound things — SSH keys, PATs, the `gh` token — are tied to the numeric
account ID (**276099054**) and do not care about the name at all. **Commit attribution survives**,
because the commit email `276099054+shampoo-is-a-lie@users.noreply.github.com` is matched on the
numeric prefix, not the handle.

There is exactly one class of URL that is **not** redirected: `*.github.io` GitHub Pages
addresses. That is where the damage is, and there is more of it than expected.

---

## What breaks and what doesn't

| Survives the rename (redirected) | Breaks immediately (no redirect) |
|---|---|
| `github.com/<old>/<repo>` web URLs | **`<old>.github.io/...`** — all Pages URLs |
| `git clone` / `fetch` / `push`, HTTPS **and** SSH | `ghcr.io/<old>/...` image references |
| Release **download** URLs (incl. the pinned binaries) | `@<old>` mentions in existing issues/PRs |
| Issues, PRs, stars, forks, wiki, gists | Repo **homepage** metadata pointing at `github.io` |
| SSH keys, PATs, `gh` auth, commit attribution | Everything above, if someone claims the old handle |

**The redirect is a courtesy, not a contract.** It dies the instant anyone registers
`shampoo-is-a-lie`. Treat every redirect below as "works until it doesn't" and fix the sources.

---

## Confirmed findings

Gathered from the Mac on 2026-08-28 via the GitHub API and the local clone.

### 1. LatteWrite has a LIVE Pages site — this is the one nobody was tracking

```
https://shampoo-is-a-lie.github.io/LatteWrite/   →  HTTP 200   (cname: none)
```

It is the only repo on the account with Pages currently built and serving. It has **no custom
domain**, so the rename takes it down and it comes back at `<newname>.github.io/LatteWrite/`.
Anything linking to it — the LatteWrite README, any post, any listing — needs updating.

### 2. The Cafe Neurotico support URL is already dark

```
https://shampoo-is-a-lie.github.io/CafeNeuroticoWebSite/              →  HTTP 404
https://shampoo-is-a-lie.github.io/CafeNeuroticoWebSite/support.html  →  HTTP 404
```

Pages was disabled on `CafeNeuroticoWebSite` deliberately on 2026-08-26 while builds are
published as experimental. **So the rename does not newly break this link — it is already
broken.** That materially lowers the urgency, but it changes the *order* of operations: do not
re-enable Pages at the old `github.io` path and then rename, or you will break it a second time.

This URL is compiled into the shipped app:

```
apps/manager/renderer.js:1569
const SUPPORT_URL = 'https://shampoo-is-a-lie.github.io/CafeNeuroticoWebSite/support.html';
```

**There are 20 releases on `CafeNeurotico`, latest v1.9.3.** Every AppImage already downloaded
has this string baked in. No rename, redirect, or repo edit reaches those builds. The only fix
for existing users is a new release — and since the URL is already 404, they are already
affected.

### 3. `github.io` references in this repo (the breaking class)

```
README.md:15              [Website](https://shampoo-is-a-lie.github.io/CafeNeuroticoWebSite/)
README.md:16              [Support](https://shampoo-is-a-lie.github.io/CafeNeuroticoWebSite/support.html)
README.md:102             [The whole list ...](https://shampoo-is-a-lie.github.io/CafeNeuroticoWebSite/fixes.html)
apps/manager/renderer.js:1569   SUPPORT_URL
```

### 4. `github.com` references — these redirect, but fix them anyway

```
README.md:13              .../CafeNeurotico/releases/latest
README.md:58              .../CafeNeuroticoGameManager
README.md:59              .../GRINDER
apps/manager/renderer.js:3323   RELEASES_URL
scripts/fetch-binaries.mjs:53   linux binaries tarball
scripts/fetch-binaries.mjs:57   darwin binaries tarball
```

The two in `fetch-binaries.mjs` are sha256-pinned, so a redirect cannot silently swap the
payload on you. They are safe but should still be updated.

### 5. Repo metadata (`homepageUrl`) pointing at dead Pages URLs

| Repo | homepage |
|---|---|
| `CafeNeurotico` | `https://shampoo-is-a-lie.github.io/CafeNeuroticoWebSite/` |
| `EmuLatte` | `https://shampoo-is-a-lie.github.io/CafeNeuroticoWebSite/emulatte.html` |

Set in repo settings, not in any file — easy to forget. Both break.

### 6. What is reassuringly absent

- **No `.github/` directory** in this repo at v1.9.1 — no Actions workflows, no `FUNDING.yml`.
- **No `publish` block** in the electron-builder config — releases are cut by hand, so there is
  no CI credential or hardcoded owner in an automated publish path.
- **No in-app updater** (by design, per the comment at `renderer.js:3321`) — so no shipped
  client is polling a URL that would break.
- **No submodules** (`.gitmodules` absent).
- README badges are **static** shields.io badges, not API-backed, so they do not break.

Confirm all five on Omarchy at v1.9.3 — absence at v1.9.1 is not proof of absence today.

---

## Evidence and its limits

Everything above came from:

- `gh api` against the live account (repo list, Pages status, releases) — **current, trustworthy**
- `curl` against the three `github.io` URLs — **current, trustworthy**
- `grep` over the **Mac clone at commit `80b9848`, v1.9.1, 2026-08-24** — **possibly stale**

`main` on GitHub was pushed 2026-08-27 and the latest release is v1.9.3. **The Mac clone is at
least two versions behind.** Re-run the audit on Omarchy before acting on any line number.

I did not inspect: the `CafeNeuroticoWebSite` repo (not cloned on the Mac), any Omarchy-local
tooling, shell history, or packaging metadata.

---

## Assess on Omarchy BEFORE renaming

Run this from anywhere. It is **read-only** — it prints, it does not change anything.

```bash
#!/usr/bin/env bash
# github-rename-audit.sh — read-only. Prints what a rename would touch.
OLD="shampoo-is-a-lie"

echo "### 1. Every file mentioning the old handle"
grep -rIl "$OLD" ~ \
  --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=.venv \
  --exclude-dir=.cache --exclude-dir=dist --exclude-dir=out --exclude-dir=target \
  --exclude-dir=_site --exclude-dir=build --exclude-dir=.egg-info \
  2>/dev/null

echo; echo "(this handoff file will match its own greps — ignore it in the results)"
echo; echo "### 2. The breaking class — *.github.io references"
grep -rIn "${OLD}\.github\.io" ~ \
  --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=.cache 2>/dev/null

echo; echo "### 3. Git remotes (note SSH vs HTTPS)"
find ~ -name .git -maxdepth 6 -type d 2>/dev/null | while read -r g; do
  r="${g%/.git}"; printf '\n--- %s\n' "$r"
  git -C "$r" remote -v 2>/dev/null | sed 's/^/    /'
  printf '    email: %s\n' "$(git -C "$r" config --get user.email || echo '(global)')"
done

echo; echo "### 4. gh CLI cached identity"
grep -n "user:" ~/.config/gh/hosts.yml 2>/dev/null || echo "  (none)"

echo; echo "### 5. Release tooling / CI that might hardcode the owner"
find ~ \( -name '*.yml' -o -name '*.yaml' -o -name 'PKGBUILD' -o -name '*.desktop' \
       -o -name '*metainfo.xml' -o -name '*appdata.xml' -o -name '.npmrc' \) \
  -not -path '*/node_modules/*' -not -path '*/.git/*' 2>/dev/null | xargs grep -ln "$OLD" 2>/dev/null

echo; echo "### 6. Release commands in shell history"
grep -hE "gh (release|repo)" ~/.bash_history ~/.zsh_history 2>/dev/null | sort -u | tail -20

echo; echo "### 7. Credential helper (may cache the old username)"
git config --get credential.helper
```

### Questions only Omarchy can answer

1. **Are the remotes SSH or HTTPS there?** Both redirect, but if HTTPS, the credential helper
   (libsecret/gnome-keyring) may have the old username cached and start prompting after the
   rename. Clearing that entry is the fix.
2. **Is `CafeNeuroticoWebSite` cloned there, and does it have a `CNAME` file?** This decides
   whether a custom domain is already in play or whether the `github.io` URL is load-bearing.
3. **Is anything published outside GitHub?** AUR `PKGBUILD`, a Flatpak manifest, an AppStream
   `metainfo.xml`, itch.io, Ko-fi, a Reddit/lobste.rs sidebar. None of these get GitHub's
   redirect and none are visible from the Mac.
4. **Do any `.desktop` files or AppImage metadata embed a project URL?** They ship to users.
5. **Is there a release script, Makefile, or shell function wrapping `gh release create`** with
   the owner spelled out?
6. **Is `v1.9.3` carrying anything new** that references the handle and post-dates the Mac clone?

---

## Decide before renaming, not after

1. **The new username.** Everything else waits on it.
2. **Whether to park `shampoo-is-a-lie`.** Once released it is claimable by anyone, and the
   moment it is claimed every redirect dies at once. Parking it needs a second account, which
   sits awkwardly against GitHub's one-free-personal-account rule — worth a look at the current
   ToS rather than taking my word for it. The handle is distinctive enough that squatting is
   unlikely; the risk is small but not zero and it is irreversible.
3. **Does `CafeNeuroticoWebSite` get a custom domain?** This is the strategic one. A custom
   domain makes every `github.io` link in this document permanently rename-proof, and it is the
   same argument that put the blog on its own domain. If yes, buy it *before* fixing
   `SUPPORT_URL`, so the URL is written once.
4. **Does LatteWrite's Pages site get a custom domain, or does it just move?**
5. **Does a CN release get cut before or after the rename?** Recommendation below.

---

## Recommended sequence

The support URL is already 404, so there is no rush to beat a deadline. Order it to touch
`SUPPORT_URL` exactly once:

1. Run the audit script above. Reconcile against this document.
2. Decide the custom-domain question for `CafeNeuroticoWebSite`.
3. **Rename the GitHub account.**
4. Update git remotes on both machines (redirects work, but do not rely on them).
5. Fix `repos/*/homepageUrl` for `CafeNeurotico` and `EmuLatte` in repo settings.
6. Re-enable Pages on `CafeNeuroticoWebSite` — at its **final** URL, custom domain or new
   `github.io`. Same call for `LatteWrite`.
7. Update `SUPPORT_URL` in `renderer.js` to that final URL. Update the three README links.
8. Cut the next CN release. That build is the first one users get with a working support link.
9. Clear the git credential cache if HTTPS remotes start prompting.

Doing the rename **before** re-enabling Pages means the URL is written correctly once instead of
being fixed, broken, and fixed again.

---

## Out of scope

The personal blog being scaffolded on the Mac is a separate repo, separate host, separate
domain, and is not yet connected to anything. One note only: **it is not wired to Cloudflare
Pages yet, which is lucky** — a rename mid-flight can break the Cloudflare↔GitHub App link and
force a reconnect. Renaming now costs nothing there. It holds a single reference to the old
handle, in a stub file, which will be fixed on the Mac side.

Nothing in this document asks for a change to Cafe Neurotico's architecture, release process, or
website content. It is an inventory and a sequence, nothing more.
