# OpenTimbre website

The public landing page for [OpenTimbre](https://github.com/panosadamop/OpenTimbre). Source lives in the `site/` folder of the main repo and is mirrored to [opentimbre-web](https://github.com/panosadamop/opentimbre-web). It is plain static HTML, CSS and JS, with no build step and no dependencies (fonts come from Google Fonts).

```
.
├── index.html          page markup and content
├── styles.css          styles and animations (reduced-motion aware)
├── main.js             waveforms, scroll reveals, tour, terminal, Web Audio mini-synth
└── assets/screens/     screenshots captured from the running Studio app (WebP, 1440×900)
```

## Preview locally

From this folder, any static server works, for example:

```bash
python -m http.server 5190
# or
npx serve .
```

Then open http://localhost:5190. Opening `index.html` directly from disk also works.

## Deploy

- **Cloudflare Pages**: create a project from this repo with no build command. Output directory: `/` in opentimbre-web, or `site` in the main repo.
- **GitHub Pages**: in opentimbre-web, Settings → Pages → Deploy from branch `main`, folder `/ (root)`.
- **Any web host / Virtualmin**: upload the contents of this folder to `public_html/`.

## Updating screenshots

The images in `assets/screens/` are real captures of the Studio at 1440×900. Retake them after visible UI changes so the site stays honest. Keep the demo instruments labelled as procedural/synthetic.

## Publishing to opentimbre-web

Edit the site in the main repo's `site/` folder, commit, then push that folder's history to the mirror from the main repo root:

```bash
git subtree push --prefix=site https://github.com/panosadamop/opentimbre-web.git main
```
