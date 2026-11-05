# Demo app

`apps/demo` is a private Vite + React app that renders `ProcessExplorer` on a generated clickstream.

## Running

```bash
pnpm install
pnpm dev                              # http://localhost:5173 (Vite default port)
pnpm --filter demo dev --port 5180    # another port
```

`pnpm dev` runs `pnpm --filter demo dev`. The demo resolves the packages from source (see development.md), so no build is needed first.

## UI

| Control | Effect |
| --- | --- |
| `10,000 sessions`, `100,000 sessions`, `1,000,000 sessions` | Regenerates the log with that many cases (seed 3). The active size button is disabled. |
| `dark` checkbox | Switches page colours and passes `colorScheme="dark"` to the explorer. Initial value follows `prefers-color-scheme`. |
| Status line | Shows sessions, events and generate + index time, plus total time including transfer. |
| Case "Open" button | `onCaseOpen` shows `alert("Open case <id> in the host app")`. |

The explorer is rendered with `height="calc(100vh - 110px)"`.

## Worker pattern

`App.tsx` creates one worker: `new Worker(new URL("./worker.ts", import.meta.url), { type: "module" })`. When `cases` changes it clears the log, posts `{ cases, seed: 3 }`, and sets the log from the reply `{ log, ms }`.

`worker.ts`:

1. Calls `generateSampleEventLog({ cases, seed })` and times it.
2. Collects the `ArrayBuffer` of `caseStart`, `caseLength`, `caseStartTime`, `caseEndTime`, `eventActivity`, `eventStart`, `eventEnd` and of every attribute's `codes`.
3. Posts `{ log, ms }` with that list as the transfer list.

Buffers are moved, not copied (zero copy). The `activities`, `cases` strings and attribute `values` arrays are structured-cloned. The log object received on the main thread is a normal `EventLog`.

## Sample journey model

Source: `packages/core/src/sample.ts`. Session = case, page = activity. Each session has a device (`mobile` 58 %, `desktop` 42 %) and a channel (`organic` 45 %, `paid` 30 %, `email` 15 %, `direct` 10 %) as attributes.

A session starts on `Landing` at a random time in the window (default 30 days from 2026-10-01). Each page: dwell time is uniform in the range below (seconds); the gap before the next page is `random()^3 * 90 s` (mostly near zero); the next page is drawn by weight. `EXIT` ends the session (it is not emitted as an event). A session also ends after `maxEventsPerCase` (default 25) events.

| Page | Dwell (s) | Next page: probability |
| --- | --- | --- |
| Landing | 5-40 | Product list 0.50, Search 0.30, Account 0.08, EXIT 0.12 |
| Search | 8-60 | Product list 0.55, Search 0.15, Product detail 0.20, EXIT 0.10 |
| Product list | 15-120 | Product detail 0.65, Search 0.10, EXIT 0.25 |
| Product detail | 20-180 | Add to cart 0.45, Product list 0.25, EXIT 0.30 |
| Add to cart | 2-10 | Cart 0.70, Product list 0.25, EXIT 0.05 |
| Cart | 10-90 | Checkout 0.60, Product list 0.20, EXIT 0.20 |
| Checkout | 30-240 | Payment 0.75, Cart 0.10, Help 0.05, EXIT 0.10 |
| Payment | 20-120 | Order confirmed 0.85, Checkout 0.10, EXIT 0.05 |
| Help | 30-200 | Checkout 0.60, EXIT 0.40 |
| Account | 10-60 | Product list 0.60, EXIT 0.40 |
| Order confirmed | 5-30 | EXIT 1.00 |

The pseudo-random generator is `seededRandom` (mulberry32), so the same seed gives the same log. Case ids are `s-0001`, `s-0002`, ... in base 36.
