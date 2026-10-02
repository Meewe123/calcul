# Changelog

All notable changes are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

## [1.0.0] — 2026-10-02

A rebuild of the first prototype into a calculator with a paper tape. See [AUDIT.md](AUDIT.md) for what was wrong before and why.

### Added

- Exact decimal arithmetic on BigInt with 34 significant digits and round-half-even; rounded results are shown with `≈`.
- Expressions with operator precedence, parentheses (auto-closed), unary minus and percent (`1200 − 15% = 1020`).
- The tape: numbered calculations, reuse a result with one press, copy as text, clear with undo, saved in the browser.
- Live preview while typing; errors keep the expression and underline the problem.
- Russian and English interface; light, dark and system themes.
- Keyboard shortcuts with an in-app list; Ctrl+C copies the result, Ctrl+V pastes an expression.
- Design system in CSS custom properties; IBM Plex Mono and Sans, self-hosted.
- 404 page, Open Graph preview, icons, web app manifest, robots.txt, sitemap.
- Content Security Policy with hashed inline scripts.
- Unit, property-based, browser and accessibility tests; GitHub Actions with Lighthouse CI and deployment to GitHub Pages; Dependabot.
- README in English and Russian, design notes, MIT license.

### Fixed

- Wrong results for numbers longer than 12 significant digits (`123456789012345 + 1` gave `123456789012000`).
- Long numbers were cut off on the display instead of fitting or scrolling.
- No way to delete a digit on a phone.
- `Ctrl+−` and `Ctrl+=` (browser zoom) were captured as calculator keys.
- `/` opened quick find in Firefox.
- `200 + 10%` gave `200.1`.
- A sign change after an operator was silently lost.
- An error wiped the expression instead of letting you fix it.
- Overflow and division by zero showed the same unexplained "Error".
- White text on orange keys had a contrast of 2.2:1; results were not announced to screen readers.

## [0.1.0] — 2026-10-01

- A four-function calculator in a single `index.html`.

[1.0.0]: https://github.com/Meewe123/calcul/compare/a50ee66...HEAD
[0.1.0]: https://github.com/Meewe123/calcul/commit/ab920ef
