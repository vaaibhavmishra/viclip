# ViClip Monorepo

This workspace combines the ViClip website, desktop app, and mobile app into a
single `pnpm` + `turbo` monorepo.

## Apps

- `apps/web` - Next.js marketing website
- `apps/desktop` - Electron desktop app
- `apps/mobile` - Expo mobile app

## Packages

- `packages/constants` - shared constants
- `packages/types` - shared types
- `packages/utils` - shared utilities
- `packages/tsconfig` - shared TypeScript config presets

## Commands

- `pnpm install`
- `pnpm dev:web`
- `pnpm dev:desktop`
- `pnpm dev:mobile`
- `pnpm build`
- `pnpm lint`
- `pnpm typecheck`
