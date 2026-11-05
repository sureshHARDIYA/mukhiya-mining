# Contributing

Thanks for helping. The short version: open an issue first for anything bigger than a fix, keep
the scope of the library (web-application process mining, simple filters, performance first), and
send a pull request from a branch.

## Ground rules

- `main` is protected. Every change goes through a pull request with green CI and a maintainer
  review; nobody pushes to `main` directly, maintainers included.
- Keep functions under cognitive complexity 15 (Biome enforces it). Extract a helper rather than
  silencing the rule.
- Comment only what a reader cannot get from the code: a constraint, an invariant, something that
  looks wrong but is right, or how to verify. Do not restate the code.
- No reference to any commercial product, its branding or its internals, in code, docs, commits or
  issues.
- The `knowledge/` folder is the documentation. Update it in the same pull request when the API,
  data model, theming or behaviour changes.

## Working locally

```bash
pnpm install
pnpm dev          # demo on http://localhost:5173
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

The demo has a generated clickstream (10k to 1M sessions) and two anonymised real logs; verify a
visible change there before opening the pull request. Million-session performance is part of the
contract: a change that makes indexing, filtering or replay noticeably slower needs a reason.

## Pull requests

- One change per pull request, with a title that reads as a changelog line.
- Fill in the template. CI runs lint, typecheck, tests, both builds, the demo build and a
  dependency audit.
- Releases: bump both package versions to the same number in the pull request, then a maintainer
  pushes the matching `vX.Y.Z` tag after merge; the release workflow publishes to npm.
