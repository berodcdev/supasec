# Contributing to supasec

Thanks for your interest in contributing! supasec is an open-source Supabase security testing toolkit, and we welcome contributions of all kinds.

## Getting Started

```bash
git clone https://github.com/berodcdev/supasec.git
cd supasec
npm install
npm run dev
```

The dev server starts at `http://localhost:3000`.

## Development

| Command              | Description                    |
| -------------------- | ------------------------------ |
| `npm run dev`        | Dev server (localhost only)    |
| `npm run build`      | Production build               |
| `npm run typecheck`  | Type-check with tsc            |
| `npm run lint`       | Lint with ESLint               |
| `npm run test`       | Run tests (vitest)             |

Before submitting a PR, make sure:

```bash
npm run typecheck  # zero errors
npm run lint       # zero warnings
npm run test       # all passing
```

## What to Contribute

- **New detection modules** — Found a Supabase misconfiguration pattern we don't cover? Open an issue or PR.
- **Wordlist additions** — Better table/bucket/function name lists improve bruteforce coverage.
- **Bug fixes** — Check the issue tracker for open bugs.
- **Documentation** — Improvements to the README, inline help, or usage guides.
- **UI/UX** — The instrument-grade dark theme is core to the identity; keep it consistent.

## Architecture

- **Next.js 16 + React 19** — App Router, all client-side (no server-side data processing)
- **Components** live in `components/supasec/` — one file per module (database, storage, auth, etc.)
- **Shared components** in `components/supasec/shared/` — reusable pieces (json-viewer, section-header, etc.)
- **Business logic** in `lib/` — findings engine, sensitive detection, scan history, etc.
- **API routes** in `app/api/` — extract-config proxy, AI analysis, healthcheck

## Code Style

- TypeScript strict mode, no `as any` casts
- Tailwind CSS v4 for styling, no CSS modules
- shadcn/ui (Radix) for base components
- No comments unless the WHY is non-obvious
- Prefer editing existing files over creating new ones

## Pull Requests

1. Fork the repo and create a branch from `master`
2. Make your changes
3. Run typecheck + lint + test
4. Open a PR with a clear description of what changed and why

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
