# Knowledge folder

Documentation derived from the source code of `pathminer`. Each file states only what exists in the code.

| Document | Contents |
| --- | --- |
| [architecture.md](architecture.md) | Workspace layout, core/react split, data flow with a diagram, animation data flow. |
| [data-model.md](data-model.md) | Types: ProcessEvent, EventLog, LogView, Dfg, Variant, Filter and the invariants. |
| [core-api.md](core-api.md) | Every export of `@pathminer/core` with signatures and examples. |
| [react-api.md](react-api.md) | Every export of `@pathminer/react`: provider, hooks, components (incl. `ExplorerSkeleton`), render helpers, animation replay. |
| [theming.md](theming.md) | `--pm-*` CSS variables, dark mode, overriding, CSS class names, animation styling. |
| [performance.md](performance.md) | Design choices, stress-run numbers (2026-11-05), known limits. |
| [demo.md](demo.md) | Running the demo, skeleton and animation settings, worker pattern, sample journey model. |
| [observations.md](observations.md) | Phase 1 notes: what was observed in the commercial reference tool, what is unknown, keep/drop list. |
| [design-reference.md](design-reference.md) | Summary of `observations.md` and what the library keeps, drops, changes. |
| [development.md](development.md) | Scripts, Biome rules, tests, publishing, workspace aliases. |
