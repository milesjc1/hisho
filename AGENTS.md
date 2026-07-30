# Agent notes — desktop-hisho

## Releasing (CI on tag push — required for code to reach the installed app)

The installed `.exe` auto-updates only from **GitHub Releases** (`electron-updater`,
provider `milesjc1/hisho`). Merging to `main` does **not** update anyone's app — you
must cut a release. This is now automated by CI (`.github/workflows/release.yml`):
pushing a `vX.Y.Z` tag builds the installer on a Windows runner and publishes the
release. So after merging what you want shipped, from `main`:

```
git pull                # get the merged changes
npm version patch       # bump package.json + commit + tag vX.Y.Z (minor/major as needed)
git push --follow-tags  # push the version commit + tag → fires the release workflow
```

No local build, no `GH_TOKEN` needed — CI uses the built-in `GITHUB_TOKEN`. Watch it
with `gh run watch` or `gh run list --workflow release.yml`. The tag version and
`package.json` version must match (`npm version` keeps them in sync — don't hand-edit).

The workflow builds the installer + `latest.yml` and uploads them to a new GitHub
Release. Installed apps see it on their next check (launch / every 6h / the in-app
**Settings → Updates → Check for updates** button) and install on quit — **no manual
reinstall**; the update applies automatically when the app fully quits (from the tray),
or immediately via the in-app **Restart & install now** button.

Note: the build is unsigned — Windows SmartScreen warns on install, but auto-update works.

### Manual fallback

If CI is down, cut it locally (needs a release-write token as `GH_TOKEN`):

```
npm run release   # electron-vite build && electron-builder --win --publish always
```
e.g. `GH_TOKEN=$(gh auth token) npm run release`.
