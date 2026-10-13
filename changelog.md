# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

* * *

## [Unreleased]

## [1.0.9] - 2026-10-13

## [1.0.8] - 2026-10-13

### Added

- CF-style `bind` attribute auto-wiring in `ajax-core.js`. Plain HTML elements carrying a
  `bind` attribute (e.g. `<cfselect bind="cfc:...">` emitted by bx-ui-forms) are now wired
  up client-side on page load - parsing `cfc:` / `url:` / `javascript:` / local binds,
  registering listeners on referenced controls, populating `ColdFusion.bindHandlerCache`,
  and honouring `bindonload`.
- `BXUICompat.Bind.parseBindExpression()`, `BXUICompat.Bind.bindElement()` and the
  re-runnable `BXUICompat.Bind.scan(root)` for AJAX content swaps.
- `form`, `input`, and `select` tag support in `<bx:ajaximport>`; these tags import the
  AJAX bind runtime (`ajax-core.js` + `ajaxproxy.js`).

### Fixed

- Core `ajax-core.css` / `ajax-core.js` assets are now emitted only once per request.
- `<select>` population falls back to the first two query columns when no value/display
  columns have been registered (CF parity for untyped CFC bind results).

## [1.0.7] - 2026-08-31

## [1.0.6] - 2026-08-28

## [1.0.5] - 2026-08-12

## [1.0.4] - 2026-05-07

## [1.0.3] - 2026-05-06

## [1.0.2] - 2026-02-08

### Fixed

- Boxlang v1.10.0 compat

## [1.0.1] - 2026-01-15

### Fixed

- Fixed import location

## [1.0.0] - 2025-10-23

- First iteration of this module

[unreleased]: https://github.com/ortus-boxlang/bx-ui-compat/compare/v1.0.9...HEAD
[1.0.9]: https://github.com/ortus-boxlang/bx-ui-compat/compare/v1.0.8...v1.0.9
[1.0.8]: https://github.com/ortus-boxlang/bx-ui-compat/compare/v1.0.7...v1.0.8
[1.0.7]: https://github.com/ortus-boxlang/bx-ui-compat/compare/v1.0.6...v1.0.7
[1.0.6]: https://github.com/ortus-boxlang/bx-ui-compat/compare/v1.0.5...v1.0.6
[1.0.5]: https://github.com/ortus-boxlang/bx-ui-compat/compare/v1.0.4...v1.0.5
[1.0.4]: https://github.com/ortus-boxlang/bx-ui-compat/compare/v1.0.3...v1.0.4
[1.0.3]: https://github.com/ortus-boxlang/bx-ui-compat/compare/v1.0.2...v1.0.3
[1.0.2]: https://github.com/ortus-boxlang/bx-ui-compat/compare/v1.0.0...v1.0.2

\[]: <https://github.com/ortus-boxlang/bx-ui-compat/compare/v1.0.0...v>

[1.0.0]: https://github.com/ortus-boxlang/bx-ui-compat/compare/dfaac47fb59f1f12c00a87adcd695aec980dfd8e...v1.0.0
