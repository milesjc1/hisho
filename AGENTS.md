# Agent notes — desktop-hisho

## Releasing (manual — required for code to reach the installed app)

The installed `.exe` auto-updates only from **GitHub Releases** (`electron-updater`,
provider `milesjc1/hisho`). Merging to `main` does **not** update anyone's app. After
merging changes you want shipped, you must cut a release by hand:

```
npm version patch      # bump package.json + commit + tag vX.Y.Z (use minor/major as needed)
npm run release        # electron-vite build && electron-builder --win --publish always
git push --follow-tags # push the version commit + tag
```

`npm run release` needs a GitHub token with release-write access exposed as `GH_TOKEN`.
If it isn't in the environment, provide it inline, e.g. `GH_TOKEN=$(gh auth token) npm run release`.

This builds the installer + `latest.yml` and uploads them to a new GitHub Release.
Installed apps then see it on their next check (launch / every 6h / the in-app
**Settings → Updates → Check for updates** button) and install on quit.

Note: the build is unsigned — Windows SmartScreen warns on install, but auto-update works.
