# Packrift Packaging Fit Lab

Static, browser-only packaging optimization utility for ecommerce, warehouse, and fulfillment teams.

Live target after publish:

`https://packrift.github.io/packaging-fit-lab/`

## What It Does

- Compares a current package against candidate cartons/mailers.
- Estimates utilization, wasted cube, DIM-weight pressure, labor/material assumptions, and annualized planning impact.
- Recommends source-backed Packrift SKUs from a static package library generated from the Packrift product spec graph and exact-spec feed.
- Runs batch SKU fit checks from pasted CSV-style rows.
- Exports single-scenario CSV, batch CSV, and markdown planning reports.
- Keeps all calculations local in the browser.
- Uses editable assumptions and clear caveats rather than pretending to know a merchant's real carrier contract.

## Count Treatment

This is an owned Packrift linkable asset. It can create crawlable Packrift mentions and earn links, but it is not a third-party backlink by itself.

## Citation and Data

- Live tool: `https://packrift.github.io/packaging-fit-lab/`
- Citation metadata: `CITATION.cff`
- AI/crawler summary: `docs/llms.txt`
- Data Package metadata: `docs/data/datapackage.json`
- Package library: `docs/data/packrift-package-library.json`
- Sample batch orders: `docs/data/fit-lab-sample-orders.csv`

## Files

- `docs/index.html` — public app shell and SEO/schema.
- `docs/styles.css` — responsive interface and visual system.
- `docs/app.js` — calculator, recommendation logic, visualization, and share/export helpers.
- `docs/data/packrift-package-library.json` — static Packrift package candidate library.
- `docs/data/datapackage.json` — machine-readable package-library metadata.
- `docs/data/fit-lab-sample-orders.csv` — example batch input.
- `docs/llms.txt` — AI/crawler-oriented resource summary.
- `CITATION.cff` — citation metadata.
- `build-packrift-package-library.mjs` — regenerates the static candidate library from local Packrift catalog source files.
- `docs/sitemap.xml` / `docs/robots.txt` — crawler support.
