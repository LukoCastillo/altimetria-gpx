# CLAUDE.md

Guidance for working in this repo. Keep it short; update it when the facts change.

## What this is

**Cumbre** — a static web app that turns a race **GPX** into an elevation/distance
profile, as the starting point for a trail-running **nutrition & hydration** strategy.
No build step, no framework, no dependencies. Everything runs in the browser; GPX files
are never uploaded to a server.

## Structure

```
index.html   # Homepage "Cumbre": hero + race/distance picker + GPX upload
visor.html   # The viewer: parses a GPX and draws the profile (HTML+CSS+JS in one file)
vercel.json  # Static-site deploy config (cleanUrls, no build)
*.gpx        # Official Ultra Coahuila 2026 tracks bundled with the site
```

Each page is a **single self-contained file** — HTML, CSS (`<style>`), and JS
(`<script>`) all inline. There is no shared JS/CSS. Keep it that way unless there's a
strong reason; match the existing inline style rather than introducing a bundler.

## Page hand-off (how the two pages talk)

The homepage sends the user to the viewer without a backend:

- **Catalog race** → `visor.html?ruta=<file>.gpx&carrera=<n>&distancia=<n>`. The viewer
  `fetch()`s the GPX by relative path. `carrera`/`distancia` only override the display title.
- **Uploaded GPX** → the file text is put in `sessionStorage` (`cumbre_gpx_text`,
  `cumbre_gpx_name`) and the viewer opens with `?fuente=upload`, then reads and clears it.

The `autoload()` IIFE at the bottom of `visor.html` reads `location.search` and drives this.

## Conventions & gotchas

- **No Node.js in this environment.** Use `python3` for any GPX parsing/validation/stats
  scripts (`xml.etree.ElementTree`), never `node`.
- **Light theme only.** There is no dark mode and no theme toggle — don't add one.
- **Mountain palette is "terroso"** (earthy green/brown). Tokens live in `:root`
  (`--area-top`, `--area-mid`, `--area-bot`, `--ridge`) and are kept in sync between both files.
- **Never use `var(--x)` inside raw SVG presentation attributes** (`stop-color`, `stroke`,
  `fill`). It's cross-browser unreliable — use literal hex values in inline SVG.
- The bundled catalog GPX files contain **zero `<wpt>` waypoints**, so a catalog route
  shows only Salida/Meta flags. Users can add points of interest manually in the viewer.
- **The homepage picker only lists the races it explicitly declares.** It currently links
  all four bundled tracks (30k, 50k, 80k, 100 millas). Adding a `.gpx` to the folder does
  **not** surface it — add a `.dist-btn` with matching `data-ruta`/`data-carrera`/`data-distancia`
  in `index.html`. Stat numbers (distance, D+) must be computed with the viewer's method
  (Haversine + 1.5 m hysteresis threshold), not a naive elevation sum.
- **Day / start time / cutoff shown on race rows are NOT in the GPX files** — they come from
  external race info. Don't fabricate them; the 50k/80k rows omit that line until provided.

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
