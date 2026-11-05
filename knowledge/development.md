# Development

## Scripts

Root `package.json` (`pnpm@12.3.4`):

| Command | Runs |
| --- | --- |
| `pnpm build` | `pnpm -r --filter './packages/*' build` (core and react, not the demo). |
| `pnpm test` | `pnpm -r test` (vitest in each package that has a `test` script). |
| `pnpm typecheck` | `pnpm -r typecheck` (`tsc --noEmit`). |
| `pnpm lint` | `biome check .` |
| `pnpm format` | `biome format --write .` |
| `pnpm dev` | `pnpm --filter demo dev` |

Per package: `core` has `build`, `typecheck`, `test`. `react` has the same scripts; it has no test files in the repo. `demo` has `dev`, `build` (`vite build`), `typecheck`.

Dev dependencies at the root: Biome ^2.2.0, TypeScript ^5.6.0, tsup ^8.3.0, Vitest ^3.0.0. `.npmrc` sets the npm registry.

## TypeScript

`tsconfig.base.json`: target ES2022, module ESNext, `moduleResolution: Bundler`, `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `isolatedModules`, `jsx: react-jsx`. Because of `exactOptionalPropertyTypes`, optional props in the React package are declared `T | undefined`.

## Biome (`biome.json`)

- Files: everything except `dist` and `node_modules`.
- Formatter: 2 spaces, line width 100.
- Linter: `recommended` rules.
- `complexity/noExcessiveCognitiveComplexity` is an **error** with `maxAllowedComplexity: 15`. Split large functions into helpers or use early returns instead of suppressing it.

## Tests

`packages/core/test/core.test.ts` (Vitest, imports from `../src`). Groups: `buildEventLog`, `adapters`, `dfg`, `filters`, `variants and statistics`, `layout and format`. Run with `pnpm --filter @mukhiya-mining/core test` or `pnpm test`. There are no tests for the React package.

## Building and publishing

Both packages are ESM with a CJS build (`"type": "module"`, `main` `./dist/index.cjs`, `module` `./dist/index.js`, `types` `./dist/index.d.ts`), `files: ["dist", "README.md"]`, version `0.1.0`, license MIT.

- core: `tsup src/index.ts --format esm,cjs --dts --sourcemap --clean`
- react: `tsup src/index.ts --format esm,cjs --dts --sourcemap --clean --external react,react-dom && cp src/styles.css dist/styles.css`. The package `exports` map includes `"./styles.css": "./dist/styles.css"`, and `sideEffects` is `["*.css"]`.
- `@mukhiya-mining/react` depends on `@mukhiya-mining/core` as `workspace:*`; pnpm rewrites it to the real version on publish. Publish core first.
- Publish steps are not scripted in this repo; use `pnpm publish` from each package after `pnpm build`. (`files` lists `README.md`, but no package-level README exists in the repo.)

## Workspace aliases in the demo

The demo uses the package sources, not `dist`:

- `apps/demo/vite.config.ts`: `resolve.alias` maps `@mukhiya-mining/core` to `packages/core/src/index.ts`, `@mukhiya-mining/react/styles.css` to `packages/react/src/styles.css`, and `@mukhiya-mining/react` to `packages/react/src/index.ts`. The `styles.css` alias is listed before the bare package alias so it matches first.
- `apps/demo/tsconfig.json`: `paths` for `@mukhiya-mining/core` and `@mukhiya-mining/react` to the same source entries, `baseUrl: "."`, `noEmit`.
- `pnpm.onlyBuiltDependencies` allows `esbuild` and `@biomejs/biome` install scripts.
