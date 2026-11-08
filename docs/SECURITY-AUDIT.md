# Anatomy Run: pre-launch security review

**Version:** demo v1.1  **Date:** 8 Nov 2026  **Scope:** `index.html`, donation flow, hosting setup

## Summary

Anatomy Run is a single static page. It has no server, no login, no database,
no third-party scripts and no network calls after the page loads. That keeps the
attack surface small. The review found **no critical or high issues**. Medium and
low items were fixed before launch; what remains is listed under *Residual risks*.

## Attack surface

| Area | What exists | Risk |
|---|---|---|
| Code | One inline script, ~490 KB, no libraries | Low: nothing to patch, no supply chain |
| Third parties | Google Fonts (CSS + font files) | Low: style only, disclosed in privacy policy |
| User input | Player name, feedback text | Low: rendered as text only |
| Storage | `localStorage` (progress), `sessionStorage` (splash flags) | Low: player's own device |
| Money | UPI QR codes + UPI ID for voluntary support | Medium if tampered: guarded by CI |
| Outbound links | Physiopedia, PubMed searches, Inclusive.Si page | Low: isolated tabs |

## Checks and results

| # | Check | Result |
|---|---|---|
| 1 | XSS: every `innerHTML` sink reviewed; player name and feedback never reach one (`textContent` only) | Pass |
| 2 | XSS test: name `<b>Tes\a ter</b>";` and feedback `<script>alert(1)</script>` | Pass: stored as `bTester/b`, no markup created, no dialog |
| 3 | Poisoned save (`<img onerror>` name, `__proto__`, huge numbers, wrong types) | **Fixed**: new sanitiser cleans every field on load; no injection, no prototype pollution, no crash |
| 4 | Content-Security-Policy | **Added**: `default-src 'none'`, script allowed only by SHA-256 hash, `connect-src 'none'`, `object-src`/`base-uri`/`form-action 'none'` |
| 5 | CSP regression: full level, recap, share card, feedback in Chrome | Pass: 0 violations, 0 page errors |
| 6 | Clickjacking: game loaded inside a foreign iframe | **Fixed**: game refuses to start when framed and shows only "Open in a new tab" |
| 7 | Dynamic code: `eval`, `new Function`, `document.write`, string timers, inline `on*=` handlers | None found |
| 8 | Network: `fetch`, XHR, WebSocket, beacons | None; only Google Fonts is requested |
| 9 | External links | **Fixed**: all use `rel="noopener noreferrer"`; page sends `no-referrer` |
| 10 | Secrets: API keys, tokens, private keys | None; plus a TruffleHog scan in CI over full git history |
| 11 | Donation integrity: decoded all 4 QR codes | Pass: every code pays `jose496@ybl`; CI fails if any UPI link changes |
| 12 | Personal data | Only public contact details (grievance officer, email) required by Indian IT Rules; no player data leaves the device |
| 13 | Dependencies | None to scan; Dependabot watches the GitHub Actions used |
| 14 | CI hardening | Least-privilege `permissions`, `persist-credentials: false`, deploy blocked unless the gate passes, only public files published |

## Fixes made in this release

1. Saved-progress sanitiser (`cleanName` + field validation) in both the claude.ai and GitHub builds.
2. Player name stripped of control characters and markup characters, capped at 16.
3. Strict hash-based CSP and `no-referrer` policy (GitHub build).
4. Anti-framing guard (GitHub build; the claude.ai artifact is framed by design).
5. `noreferrer` on every new-tab link.
6. Version label corrected to v1.1 on the start screen and legal page.
7. Privacy policy names GitHub Pages as the host.

## Residual risks (accepted for the demo)

- **Response headers.** GitHub Pages cannot set `frame-ancestors`, `X-Frame-Options`
  or `Permissions-Policy`. The JS frame guard covers clickjacking. For full headers,
  host on Cloudflare Pages or Netlify; `_headers` is ready.
- **`style-src 'unsafe-inline'`.** Needed for the game's inline styles. With scripts locked by hash,
  this cannot run code.
- **Google Fonts.** No Subresource Integrity is possible because the CSS is generated per browser.
  A later version can self-host the two font files.
- **Personal UPI ID.** Kept on purpose for the demo. Donations go to an individual account, so
  receipts and tax treatment follow personal rules. Move to a business UPI/payment gateway before scaling.
- **Local progress can be edited** by the player in their own browser. Nothing depends on it
  (no leaderboard or rewards), so this is harmless now; validate on a server if a leaderboard is added.
- **Instagram in-app browser.** Works, but storage there can be cleared by the app. The in-game tip already
  suggests opening in Chrome/Safari.

## How to re-run

```sh
node scripts/security-check.mjs           # 32 automated checks
```
