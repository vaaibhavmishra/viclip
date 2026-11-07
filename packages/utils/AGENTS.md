# ViClip Shared Utils (@viclip/utils) Agent Guidelines

This package provides runtime-agnostic utility functions and cryptographic abstractions consumed across Web, Desktop, and Mobile.

## Rules & Architecture

1. **Runtime Agnosticism**:
   - This package MUST NOT depend directly on `node:crypto`, `electron`, `window`, or React Native globals.
   - All environment-dependent capabilities are injected via interfaces (see `CryptoAPI` in `@viclip/types`).
2. **Cryptographic Integrity**:
   - Uses AES-256-GCM.
   - Payload serialization must remain `ivHex:authTagHex:encryptedHex`.
   - Any change to crypto primitives MUST include corresponding tests in `src/crypto.test.ts`.
3. **Testing**:
   - Run unit tests: `pnpm --filter @viclip/utils test`
   - Test files live alongside source files as `*.test.ts` and use Vitest.
