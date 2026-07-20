# CLAUDE.md

Guidance for working in this repo. Keep it short; update it when the facts change.

## What this is

**Cumbre** — a static web app that turns a race **GPX** into an elevation/distance
profile, as the starting point for a trail-running **nutrition & hydration** strategy.
No build step, no framework, no dependencies. Everything runs in the browser; GPX files
are never uploaded to a server.

## Structure

```
index.html            # Homepage "Cumbre": hero + race/distance picker + GPX upload
visor.html             # The viewer: parses a GPX and draws the profile
assets/
  css/index.css, visor.css   # 1:1 with each page — no shared stylesheet
  js/index.js, visor.js      # 1:1 with each page — no shared script
data/
  *.gpx                       # Official Ultra Coahuila 2026 tracks bundled with the site
vercel.json            # Static-site deploy config (cleanUrls, security headers)
```

Both HTML pages live at the **root** (not in a subfolder) — Vercel's `cleanUrls` and the
relative `href`/`src`/`fetch()` paths between them assume that. `assets/` and `data/` are
the only subfolders; don't nest the HTML entry points.

No build step, no framework, no bundler, no npm deps. CSS/JS live in their own files (not
inline) so the CSP can forbid inline scripts — **keep JS in the `.js` files, not inline
`<script>`/`onclick=`**, or the strict `script-src 'self'` (see `vercel.json`) will block it.

## Page hand-off (how the two pages talk)

The homepage sends the user to the viewer without a backend:

- **Catalog race** → `visor.html?ruta=data/<file>.gpx&carrera=<n>&distancia=<n>`. The viewer
  `fetch()`s the GPX by that relative path. `carrera`/`distancia` only override the display title.
- **Uploaded GPX** → the file text is put in `sessionStorage` (`cumbre_gpx_text`,
  `cumbre_gpx_name`) and the viewer opens with `?fuente=upload`, then reads and clears it.

The `autoload()` IIFE at the bottom of `visor.js` reads `location.search` and drives this.

## Conventions & gotchas

- **No Node.js in this environment.** Use `python3` for any GPX parsing/validation/stats
  scripts (`xml.etree.ElementTree`), never `node`.
- **Light theme only.** There is no dark mode and no theme toggle — don't add one.
- **Mountain palette is "terroso"** (earthy green/brown). Tokens live in `:root`
  (`--area-top`, `--area-mid`, `--area-bot`, `--ridge`) and are kept in sync between both files.
- **Never use `var(--x)` inside raw SVG presentation attributes** (`stop-color`, `stroke`,
  `fill`). It's cross-browser unreliable — use literal hex values in inline SVG.
- The bundled catalog GPX files (in `data/`) contain **zero `<wpt>` waypoints**, so a catalog
  route shows only Salida/Meta flags. Users can add points of interest manually in the viewer.
- **The homepage picker only lists the races it explicitly declares.** It currently links
  all four bundled tracks (30k, 50k, 80k, 100 millas). Adding a `.gpx` to `data/` does
  **not** surface it — add a `.dist-btn` with matching `data-ruta="data/<file>.gpx"`,
  `data-carrera`, `data-distancia` in `index.html`. Stat numbers (distance, D+) must be
  computed with the viewer's method (Haversine + 1.5 m hysteresis threshold), not a naive
  elevation sum. **Also add the exact `data/<file>.gpx` path to the `CATALOGO` allowlist in
  `assets/js/visor.js`** — the viewer only `fetch()`es `?ruta=` values on that list (security:
  blocks arbitrary/remote URLs); a race missing from it fails with "Ruta de carrera no reconocida".
- **Day / start time / cutoff shown on race rows are NOT in the GPX files** — they come from
  external race info. Don't fabricate them; the 50k/80k rows omit that line until provided.
- **Analytics = privacy-safe, swappable.** All tracking goes through `window.cumbreTrack(name, data)`
  in `assets/js/analytics.js` (currently **PostHog** — free tier has custom events + funnels; note
  Vercel Web Analytics does NOT support custom events on its free Hobby plan, which is why we moved).
  PostHog loads via `<script src=".../array.js">`; the `POSTHOG_KEY` placeholder must be filled with a
  real Project API key or nothing is sent. Configured with no cookies / no autocapture / no session
  recording. **Only send categories/buckets, never GPX content** (no coordinates, personal filenames,
  or waypoint names/notes). Events wired: `race_selected`, `gpx_uploaded`, `profile_rendered`,
  `profile_load_failed`, `marker_added`, `export_gpx`, `export_pdf`. Pageviews are automatic. PostHog
  is an external script, so its domains are in the `vercel.json` CSP (`script-src`/`connect-src`). To
  swap providers, change only `analytics.js`, the `<script>` tag, and the CSP domains.

## Run locally

Pure static; open the files or serve them:

```bash
python3 -m http.server 5173
# then open http://localhost:5173/index.html
```

## Deploy

Vercel serves it as a static site — no build command, root as output. Push to `main`
redeploys. See `README.md` for the CLI and Git+panel paths.

## Git

Commit/push only when asked. `main` is the default branch; the GitHub remote is
`LukoCastillo/altimetria-gpx` (public).