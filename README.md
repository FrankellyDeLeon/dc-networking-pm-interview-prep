# Data Center Networking PM interview preparation

Public, two-page preparation guide for a 15-minute hiring-manager conversation about Cisco's
Senior / Engineering Product Manager, Data Center Networking role. It combines a call dashboard, role traceability,
candidate evidence checks, AI and enterprise data-center networking study material, product/commercial frameworks,
tailored interview stories, a reviewed source register, and a separate eleven-duty interview deep dive.

**Published site:** <https://frankellydeleon.github.io/dc-networking-pm-interview-prep/>

**Job duties deep dive:** <https://frankellydeleon.github.io/dc-networking-pm-interview-prep/duties.html>

> **Public-content warning:** this repository and its GitHub Pages site are public by explicit owner choice. Do not add
> customer/Cisco confidential information, secrets, private roadmap details, or personal claims that should not be
> publicly accessible. `[VERIFY]` and `[ADD YOUR FACT]` prompts must be resolved or consciously retained before sharing
> answers outside personal preparation.

## Local preview

The site has no package install, CDN, analytics, fonts, or runtime network dependency.

```bash
python3 -m http.server 8000 --bind 127.0.0.1
```

Open <http://127.0.0.1:8000/>. Binding to `127.0.0.1` keeps the preview on this computer; do not use `0.0.0.0` on an
untrusted network. Stop the server with <kbd>Ctrl</kbd>+<kbd>C</kbd>.

Opening `index.html` directly also works in modern browsers, but the loopback server more closely matches normal browser
loading and Content Security Policy behavior. Search/filter, theme, expand/collapse, copy buttons, print preparation,
deep links, and the readiness checklist run entirely in the browser. Theme and checklist progress are stored only in
that browser's local storage. Clicking a source link leaves the local site and contacts the named publisher.

## Structure

| Path | Purpose |
|---|---|
| `index.html` | All interview, technical, commercial, traceability, source, and integrity content |
| `duties.html` | Deep-dive playbooks, examples, answer scripts, artifacts, metrics, and probes for all 11 job duties |
| `styles.css` | Responsive visual design, accessibility states, diagrams, dark theme, and print layout |
| `app.js` | Dependency-free local interactions and readiness persistence |
| `scripts/validate.mjs` | Structural, content, citation, syntax, placeholder, dependency, and publication checks |
| `scripts/browser-smoke.mjs` | Optional Chrome/Edge interaction, responsive, print, and screenshot smoke test |

## Validation

Requires Node.js 18 or newer; it uses only Node's standard library.

```bash
node scripts/validate.mjs
node scripts/validate.mjs --check-links  # optional live-link reachability pass
```

The default deterministic pass checks:

- required landmarks and sections, unique IDs, and resolvable fragment links;
- typed buttons, secure external-link attributes, and titled/described inline SVGs;
- complete JD responsibility/minimum/preferred traceability markers;
- citation-to-source integrity and source reviewed dates;
- intentional `[VERIFY]` / `[ADD YOUR FACT]` prompts, with no `TODO`/`TBD` residue;
- JavaScript syntax and absence of external runtime network calls/dependencies;
- the README public-content warning and expected GitHub Pages URL;
- absence of an unexpected custom domain or deployment workflow (Pages uses the repository's `main` branch and root).

The optional link pass performs live requests. Some publishers block automation or rate-limit requests, so
`401`, `403`, and `429` are reported/accepted as access-controlled reachability; timeouts and other response failures are
warnings to review manually, not permission to replace an authoritative source with an unverified claim.

With the local server running, Node.js 22+ and Chrome/Edge installed:

```bash
node scripts/browser-smoke.mjs http://127.0.0.1:8000/
node scripts/browser-smoke.mjs http://127.0.0.1:8000/duties.html
node scripts/browser-smoke.mjs http://127.0.0.1:8000/ --screenshot /tmp/dcn-prep.png
```

This optional smoke test drives search, category filtering, theme, local progress, expand-all, and deep links through
Chrome DevTools; checks mobile overflow and print behavior; and fails on uncaught page exceptions.

## Source and content updates

Research was reviewed on **2026-09-17**. Product availability, data sheets, release support, licensing, standards,
competitive offers, job postings, and public profiles change.

1. Start with primary Cisco product/configuration/release documentation, standards bodies, vendor technical documents,
   and public filings. Use analyst/industry sources only with visible methodology.
2. Classify each statement as verified fact, vendor claim, strategic inference, or evidence unavailable.
3. Update both the inline claim and its source-register entry: publisher, title, publication/update date, HTTPS URL,
   reviewed date, exact support, and limitation.
4. Never transfer a feature, scale, command, optic, license, or availability statement across product, SKU, line card,
   region, or software release.
5. Preserve visible verification prompts wherever candidate metrics, authority, dates, customers, or attribution are not
   substantiated. Never add confidential Cisco/customer information.
6. Run deterministic validation, the optional link pass, and a local visual/keyboard/print check.

This is independent preparation, not Cisco documentation or endorsement. Official release-matched guides,
compatibility matrices, ordering/licensing information, security advisories, field notices, and change control govern
real deployments.
