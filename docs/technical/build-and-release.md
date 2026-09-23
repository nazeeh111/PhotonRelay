# Build & release

## Scripts

```bash
npm run dev               # https dev server with HMR (self-signed cert)
npm run serve             # build, then serve the production bundle
npm run demo              # dev server with VITE_DEMO=1 — sender locked to bundled payloads
npm run diagnostics       # dev server + per-transfer run reports, saved for benchmark promotion — see diagnostics.md
npm run benchmark         # diagnostics + sender locked to the canonical 1 MB benchmark payload
npm run benchmark:promote # declare a captured run a record (updates benchmarks/ + README)
npm run benchmark:readme  # re-render the README "Measured speed" section from records.json
npm test                  # golden wire-format vectors and unit tests (node --test via tsx)
npm run build             # typecheck (app + node configs), hosted site → dist/
npm run build:standalone  # both self-contained pages → dist-standalone/
npm run build:all         # everything
npm run icons             # regenerate public/ icons from the logo (needs librsvg)
```

`npm run icons` strips the logo SVG's comments before rasterizing (a `--` inside a comment is invalid XML that browsers tolerate but librsvg rejects) and does exact-match surgery on the markup, throwing if the logo changes shape.

`VITE_SITE_URL` overrides the published URL baked into social cards and the share dialogs (default `https://nazeeh111.github.io/PhotonRelay/`, trailing slash required).

## PWA / service worker

`vite-plugin-pwa` (workbox) precaches everything including the 940 KB decoder wasm. Two pieces are custom (`build/root-pwa-head.ts`): manifest/SW references are rewritten to resolve to the site root from any page depth (the build validates this), and the registration script reports a waiting update without activating it or reloading open pages. Users finish transfers, save files, close all PhotonRelay tabs/app windows, then reopen. `public/pwa-update-guard.js` blocks legacy `SKIP_WAITING` messages before Workbox handles them. Forced activation and client claiming are disabled. A workbox `rangeRequests` route serves received media from the Cache API (see [Platform quirks](platform-quirks.md)).

## CI (`.github/workflows`)

- **`ci.yml`** — tests and builds on every push to `main` / `release/*` and every PR. Asserts the served `receive` chunk stays under 24 KB (catches the inlined worker/wasm leaking into the site build) and that manifest/SW references point at files that exist.
- **`pages.yml`** — deploys to GitHub Pages on every push to `main`.
- **Releases** — built from a clean verified commit and published with both `PhotonRelay-*.html` standalone files, the corresponding source archive, and `SHA256SUMS`.

The site builds with `base: "./"`, so it works under a project subpath with no configuration.

## Release pattern

1. `git checkout -b release/vX.Y.Z`, bump version (`npm version X.Y.Z --no-git-tag-version`), commit.
2. Feature work + docs on the branch; PR to `main`.
3. Build from the clean merged commit, verify publication checks, create the version tag, and attach the artifacts and checksums.

The footer stamps `v<version> · build <short-hash>` (`-dirty` when uncommitted work is in the build), so any artifact names its exact source.
