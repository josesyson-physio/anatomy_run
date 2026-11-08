# Anatomy Run

A free browser demo that teaches physiotherapy anatomy through play. Run and jump
through 22 levels, collect clinical clues, then make the diagnosis. Each level ends
with takeaways, a recap with references, and a bonus Clinic Shift where you plan
treatment, talk to the patient and offer a fair care package.

Made by **MotionPlus Physio** as an **Inclusive.Si** project.

- Clinical review: MSK by Dr. Pavithran and Dr. Venkatesh; Neuro by Dr. Sudharson and Dr. Jeeva
- Plays on phones (landscape) and desktop browsers
- No sign-up, no ads, no tracking. Progress is stored only in the player's own browser

## Play

Once GitHub Pages is on, the demo is at:
`https://josesyson-physio.github.io/anatomy_run/`

## What is in this repo

| Path | Purpose |
|---|---|
| `index.html` | The whole game: one self-contained file, no build step, no dependencies |
| `404.html` | Sends unknown paths back to the game |
| `scripts/security-check.mjs` | Security gate run in CI before every deploy |
| `.github/workflows/pages.yml` | Checks, then deploys only the public files to GitHub Pages |
| `.github/workflows/security.yml` | Security gate + secret scan on every push, PR and weekly |
| `docs/SECURITY-AUDIT.md` | The pre-launch security review and its results |
| `_headers` | Extra HTTP security headers, used only if you move to Netlify or Cloudflare Pages |
| `SECURITY.md`, `.well-known/security.txt` | How to report a vulnerability |

## Turning on the demo site

1. Repo **Settings > Pages > Build and deployment > Source: GitHub Actions**.
2. Push to `main` (or run the *Deploy demo to GitHub Pages* workflow).
3. The deploy only runs if the security gate passes.

GitHub Pages on a private repo needs a paid GitHub plan. On the free plan, make the
repo public first (the licence keeps all rights reserved either way).

## Editing the game

The page has a strict Content-Security-Policy that only allows the exact inline
script it ships with. After any change to the `<script>` block, refresh the hash
or the game will not run:

```sh
node scripts/security-check.mjs --fix-csp
node scripts/security-check.mjs
```

## Licence

Copyright (c) 2026 MotionPlus Physio Pvt. Ltd. All rights reserved. See `LICENSE`.
Clinical content is educational and is not medical advice.
