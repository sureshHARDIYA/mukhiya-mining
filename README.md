# mukhiya-mining

Reusable React + TypeScript library for exploring process event logs, built for
web-application process mining (session = case, page or action = activity).

| Package                 | What it is                                                                                                                                                             |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@mukhiya-mining/core`  | Framework-free data handling: columnar event-log indexing, CSV/JSON adapters, four declarative filters, directly-follows graphs, variants, statistics, layered layout. |
| `@mukhiya-mining/react` | Components: `ProcessExplorer` (all-in-one), `ProcessMap`, `StatisticsView`, `CasesView`, `FilterBar`, plus `ProcessMiningProvider` and hooks.                          |
| `apps/demo`             | Vite app with a generated clickstream (10k, 100k or 1M sessions).                                                                                                      |

## Quick start

```bash
pnpm install
pnpm dev          # demo on http://localhost:5173
pnpm test         # core tests
pnpm build        # both packages to dist/
```

## Use in a React app

```tsx
import { buildEventLog, fromCsv } from "@mukhiya-mining/core";
import { ProcessExplorer } from "@mukhiya-mining/react";
import "@mukhiya-mining/react/styles.css";

const events = fromCsv(csvText, {
  caseId: "session",
  activity: "page",
  timestamp: "ts",
  endTimestamp: "end",
});
const log = buildEventLog(events);

<ProcessExplorer log={log} height={640} onCaseOpen={(id) => router.push(`/sessions/${id}`)} />;
```

Controlled filters, selection and detail levels follow the usual `value` / `defaultValue` /
`onChange` convention. Theme tokens are CSS variables (`--pm-*`) on the root element, or the
`theme` prop. See `docs/observations.md` for the design reference notes.

## Animation

`ProcessMap` can replay the log: one token per case moves along the paths; the map turns grey and
only the nodes and paths carrying a token light up, as in the reference tool. Turn it on with a prop; the rail then shows an "Animate" button.

```tsx
<ProcessExplorer log={log} map={{ animation: true, animationLimit: 4000 }} />
```

Two modes: real time (the busiest window of `animationLimit` cases, default 1500) and
synchronised starts (cases sampled evenly, all starting at 0). The speed slider sets how long the
whole timeline takes to play (10 s to 10 min, default 1 min), so a 90-day log and a 2-hour log
replay equally well; hops are stretched so each takes about half a second on screen. The bar has
play/pause, a seek timeline with an activity density curve, a clock and the speed slider. See `knowledge/react-api.md`. While a log is loading, show `<ExplorerSkeleton />`.

## Performance

Millions of events are fine: the log is indexed once into typed arrays and every metric derives
from that index. Prefer `EventLogBuilder` over per-event objects for very large inputs, and build
the log in a Web Worker (the demo does this and transfers the buffers).
