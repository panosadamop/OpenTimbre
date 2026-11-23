# OpenTimbre website

The public landing page for the project. It is plain static HTML, CSS and JS, with no build step and no dependencies (fonts come from Google Fonts).

```
site/
├── index.html          page markup and content
├── styles.css          styles and animations (reduced-motion aware)
├── main.js             waveforms, scroll reveals, tour, terminal, Web Audio mini-synth
└── assets/screens/     screenshots captured from the running Studio app (WebP, 1440×900)
```

## Preview locally

Any static server works, for example:

```bash
python -m http.server 5190 --directory site
# or
npx serve site
```

Then open http://localhost:5190. Opening `index.html` directly from disk also works.

## Deploy

- **Cloudflare Pages**: create a project from this repo with no build command and the output directory set to `site`.
- **GitHub Pages**: publish the `site/` folder, for example with an Actions workflow using `actions/upload-pages-artifact` and `path: site`.
- **Any web host / Virtualmin**: upload the contents of `site/` to `public_html/`.

## Updating screenshots

The images in `assets/screens/` are real captures of the Studio at 1440×900. Retake them after visible UI changes so the site stays honest. Keep the demo instruments labelled as procedural/synthetic.
