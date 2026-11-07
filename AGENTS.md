# ViClip Agent Guidelines & Architecture Map

Welcome, AI Agent! This document defines the engineering standards, architecture, data contracts, and verification commands for **ViClip**. Read this before writing or modifying code.

---

## 1. Project Overview & Architecture

ViClip is a universal, real-time, end-to-end encrypted clipboard synchronization system across Web, Desktop, and Mobile.

### Architecture Map

```
ViClip-Monorepo/
├── apps/
│   ├── web/          → Next.js 16, React 19, Tailwind CSS 4 (Marketing & Web Dashboard)
│   ├── desktop/      → Electron, electron-vite, React 19, Tailwind CSS 4, Zustand
│   └── mobile/       → Expo 55, React Native 0.83, NativeWind 4, Reanimated
├── packages/
│   ├── constants/    → App-wide configs, DB paths, limits, crypto constants
│   ├── types/        → Centralized TypeScript interfaces (Auth, Clips, Crypto, Devices)
│   ├── utils/        → Universal crypto service, formatting, date helpers
│   └── tsconfig/     → Shared TypeScript base configs
├── functions/        → Firebase Cloud Functions (Push notifications & cross-device triggers)
├── database.rules.json → Firebase Realtime Database security rules
├── biome.json        → Biome linter & formatter configuration
└── turbo.json        → Turborepo orchestration pipelines
```

---

## 2. Core Cryptography & Sync Protocol

ViClip uses **Client-Side Zero-Knowledge Encryption (AES-256-GCM)**. The backend (Firebase Realtime Database) **never** receives plaintext clipboard contents.

### Encryption Pipeline

1. **User Authentication**: User logs in with Firebase Auth.
2. **Key Derivation (KEK)**: `deriveKEK(password, salt)` uses PBKDF2 (`100,000` iterations, SHA-256) to derive a 256-bit Key Encryption Key.
3. **Data Encryption Key (DEK)**: A unique 256-bit AES key is randomly generated for clipboard data.
   - The DEK is encrypted ("wrapped") with the KEK: `wrapKey(dek, kek)`.
   - The wrapped DEK is stored at `users/{userId}/encryption/wrappedKey`.
   - The DEK remains in memory on the device (`setActiveDEK(dek)`).
4. **Clipboard Payload Format**:
   - Every encrypted string conforms to:
     $$\text{Payload} = \texttt{ivHex} : \texttt{authTagHex} : \texttt{encryptedHex}$$
   - Any modification to `iv` (12 bytes), `authTag` (16 bytes), or ciphertext fails authentication during decryption.

> [!CRITICAL]
> All encryption/decryption utilities live in [`@viclip/utils`](file:///Users/vaibhav/Developer/viclip/packages/utils/src/crypto.ts) and depend on abstract interfaces [`CryptoAPI`](file:///Users/vaibhav/Developer/viclip/packages/types/src/crypto.ts). **Never introduce Node-specific modules (like direct `import 'crypto'`) into `@viclip/utils`** without adapter abstraction, as it will break Web and React Native targets!

---

## 3. Database Schema & Paths

Firebase Realtime Database is partitioned by user ID (`users/{userId}`):
- `profile`: User metadata (`email`, `name`, `createdAt`).
- `devices/{deviceId}`: Active clients (`deviceName`, `platform`, `lastActive`).
- `clips/{clipId}`: Encrypted clips. Schema requirements:
  - `content`: string (encrypted in `iv:authTag:ciphertext` format).
  - `type`: one of `text`, `text-formatted`, `url`, `email`, `color`, `image`, `document`, `spreadsheet`, `presentation`, `unknown`.
  - `timestamp`: number.
  - `sourceDevice`: string (device name or ID).
- `encryption`: Holds `salt` and `wrappedKey`.
- `settings`: Holds `autoSync`, `maxClipHistory`.

---

## 4. Verification & Quality Gates

Always verify your changes before reporting completion.

### Essential Commands

- **Compound Verification** (Lint + Typecheck + Unit Tests):

  ```bash
  pnpm verify
  ```
- **Linter & Formatter** (Biome):

  ```bash
  pnpm check
  ```

  _Note: ViClip uses Biome exclusively. Never run `eslint` or `prettier`._
- **TypeScript Typecheck**:

  ```bash
  pnpm typecheck
  ```
- **Unit Tests**:

  ```bash
  pnpm test
  ```
- **Build Targets**:
  - Web: `pnpm build:web`
  - Desktop: `pnpm build:desktop`
  - Mobile: `pnpm build:mobile`

---

## 5. Coding Standards & Conventions

1. **Monorepo Imports**:
   - Shared packages are referenced as workspace dependencies: `@viclip/constants`, `@viclip/types`, `@viclip/utils`.
   - Update `packages/types` first when introducing new data structures.
2. **Git Commit Messages**:
   - ViClip enforces **Conventional Commits** via Commitlint and Husky.
   - Format: `feat(scope): message`, `fix(scope): message`, `refactor(scope): message`, `chore(scope): message`.
   - Examples: `feat(desktop): add tray copy shortcut`, `fix(mobile): resolve background clipboard polling`.
3. **Guardrails & Boundaries**:
   - **Do NOT touch or log secrets** from `.env` or Firebase configuration files.
   - **Do NOT deploy or alter production database instances** without explicit user instruction.
   - **Do NOT delete existing comments, JSDoc, or license headers**.
