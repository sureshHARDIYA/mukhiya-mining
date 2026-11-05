# Security

Report a vulnerability privately through
[GitHub security advisories](https://github.com/sureshHARDIYA/pathminer/security/advisories/new),
not as a public issue. You will get an answer within five working days.

## Scope

The packages `@pathminer/core` and `@pathminer/react` as published on npm, and the demo
application in this repository. The library runs entirely in the browser, has one runtime
dependency (`@dagrejs/dagre`), never fetches anything, and never uses `eval`, `innerHTML` or
`dangerouslySetInnerHTML`; exported SVG escapes all text.

## Supported versions

The latest minor release. Fixes are released as a new patch version.
