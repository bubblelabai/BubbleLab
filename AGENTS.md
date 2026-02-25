# AGENTS.md

## Cursor Cloud specific instructions

### Architecture Overview

This is a **pnpm + Turborepo monorepo** with two main apps and several shared packages. See `CONTRIBUTING.md` for full setup docs.

| Service                      | Tech              | Port | Start command                                                      |
| ---------------------------- | ----------------- | ---- | ------------------------------------------------------------------ |
| **bubble-studio** (frontend) | React 19 + Vite 7 | 3000 | `pnpm vite --host 0.0.0.0 --port 3000` (from `apps/bubble-studio`) |
| **bubblelab-api** (backend)  | Bun + Hono        | 3001 | `bun run src/index.ts` (from `apps/bubblelab-api`)                 |

### Key Dev Notes

- **Bun** is required for the backend (installed at `~/.bun/bin/bun`). Ensure `$HOME/.bun/bin` is in `PATH`.
- Dev mode uses **SQLite** (`file:./dev.db`) and disables auth (`DISABLE_AUTH=TRUE`). No external DB or Clerk keys needed.
- A dev user `dev@localhost.com` is auto-seeded on first API start.
- Core packages (`shared-schemas`, `bubble-core`, `bubble-runtime`) must be built before running apps: `pnpm build:core`.
- After building core, copy type bundles before starting the frontend: the `apps/bubble-studio/package.json` `dev` script does this automatically.
- `pnpm run dev` orchestrates everything: env setup, core build, and both servers via Turborepo.
- API tests use `bun test` and can take 3-5 minutes. Run with: `pnpm test`.
- Lint: `pnpm lint` (warnings expected, zero errors).
- pnpm 10 may warn about ignored build scripts on install; these are non-blocking since Vite/tsx resolve esbuild through their own dependency trees.
