<p align="center">
  <img src="https://viclip.shipby.me/_next/image?url=%2Ficon.png&w=384&q=75" alt="ViClip Logo" width="120" />
  <h1 align="center">ViClip</h1>
  <p align="center">
    <strong>The Universal Clipboard Sync Tool.</strong>
    <br />
    Seamlessly sync your clipboard across every device you own — phone, laptop, desktop, and browser.
    <br />
    <br />
    <a href="https://viclip.shipby.me">Website</a>
    ·
    <a href="https://github.com/vaaibhavmishra/viclip/issues">Report Bug</a>
    ·
    <a href="https://github.com/vaaibhavmishra/viclip/issues">Request Feature</a>
  </p>
</p>

<p align="center">
  <a href="https://www.gnu.org/licenses/gpl-3.0"><img src="https://img.shields.io/badge/License-GPLv3-blue.svg" alt="License: GPL v3" /></a>
  <a href="https://nextjs.org/"><img src="https://img.shields.io/badge/Next.js_16-000000?style=flat&logo=next.js&logoColor=white" alt="Next.js" /></a>
  <a href="https://www.electronjs.org/"><img src="https://img.shields.io/badge/Electron_41-47848F?style=flat&logo=electron&logoColor=white" alt="Electron" /></a>
  <a href="https://expo.dev/"><img src="https://img.shields.io/badge/Expo_55-000020?style=flat&logo=expo&logoColor=white" alt="Expo" /></a>
  <a href="https://turbo.build/"><img src="https://img.shields.io/badge/Turborepo-EF4444?style=flat&logo=turborepo&logoColor=white" alt="Turborepo" /></a>
  <a href="https://pnpm.io/"><img src="https://img.shields.io/badge/pnpm-F69220?style=flat&logo=pnpm&logoColor=white" alt="pnpm" /></a>
</p>

---

## ✨ Features

- **Real-time Sync** — Instant clipboard synchronization across all connected devices.
- **End-to-End Encryption** — All clipboard data is encrypted before leaving your device.
- **Cross-Platform** — Native apps for **iOS**, **Android**, **macOS**, **Windows**, **Linux**, and a **Web** dashboard.
- **Share Intent Support** — Share content directly from other apps on mobile.
- **Lightweight & Fast** — Minimal resource footprint with maximum performance.

---

## 🏗️ Architecture

This is a **pnpm monorepo** orchestrated by [Turborepo](https://turbo.build/).

```
ViClip-Monorepo/
├── apps/
│   ├── web/          → Next.js 16 — Marketing site & web dashboard
│   ├── desktop/      → Electron 41 (electron-vite) — macOS, Windows & Linux
│   └── mobile/       → Expo 55 (React Native) — iOS & Android
├── packages/
│   ├── constants/    → Shared business-logic constants & config
│   ├── types/        → Centralized TypeScript type definitions
│   ├── utils/        → Common utilities (crypto, formatting, etc.)
│   └── tsconfig/     → Shared TypeScript compiler configurations
├── turbo.json        → Turborepo pipeline configuration
├── biome.json        → Biome linter & formatter config
└── pnpm-workspace.yaml
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Web** | Next.js 16, React 19, Tailwind CSS 4, Framer Motion |
| **Desktop** | Electron 41, electron-vite, React 19, Tailwind CSS 4, Zustand |
| **Mobile** | Expo 55, React Native 0.83, NativeWind 4, Reanimated |
| **Backend / Infra** | Firebase (Auth, Realtime Database, Storage) |
| **Monorepo** | Turborepo, pnpm 10, Biome (lint + format) |
| **Language** | TypeScript 6 (strict mode) |
| **Quality Gates** | Husky pre-commit hooks, Commitlint (Conventional Commits) |

---

## 🚀 Getting Started

### Prerequisites

| Tool | Version |
|---|---|
| **Node.js** | ≥ 22 |
| **pnpm** | ≥ 10 |

### Installation

1. **Clone the repository:**

   ```bash
   git clone https://github.com/vaaibhavmishra/viclip.git
   cd ViClip-Monorepo
   ```

2. **Install dependencies:**

   ```bash
   pnpm install
   ```

3. **Set up environment variables:**

   Create a `.env` file in the project root with the following keys:

   ```env
   # Desktop (Electron-Vite — MAIN_VITE_ prefix required)
   MAIN_VITE_FIREBASE_API_KEY=
   MAIN_VITE_FIREBASE_AUTH_DOMAIN=
   MAIN_VITE_FIREBASE_DATABASE_URL=
   MAIN_VITE_FIREBASE_PROJECT_ID=
   MAIN_VITE_FIREBASE_STORAGE_BUCKET=
   MAIN_VITE_FIREBASE_MESSAGING_SENDER_ID=
   MAIN_VITE_FIREBASE_APP_ID=
   MAIN_VITE_FIREBASE_MEASUREMENT_ID=
   MAIN_VITE_ENCRYPTION_KEY=

   # Mobile (Expo)
   REVERSED_CLIENT_ID=
   ```

   > **Note:** The mobile app also requires `google-services.json` (Android) and `GoogleService-Info.plist` (iOS) in `apps/mobile/` for Firebase to work.

### Running in Development

```bash
# Start all apps simultaneously
pnpm dev

# Or run a specific platform
pnpm dev:web        # → http://localhost:3000
pnpm dev:desktop    # → Opens Electron window
pnpm dev:mobile     # → Starts Expo dev server
```

---

## 📦 Building for Production

```bash
# Build everything
pnpm build

# Platform-specific builds
pnpm build:web                    # Next.js production build
pnpm build:desktop:mac            # Electron → macOS (.dmg)
pnpm build:desktop:win            # Electron → Windows (.exe)
pnpm build:desktop:linux          # Electron → Linux (.AppImage)
pnpm build:mobile:android         # Expo → Android
pnpm build:mobile:android:local   # Expo → Android (local APK)
pnpm build:mobile:ios             # Expo → iOS
```

---

## 🧰 Available Scripts

| Script | Description |
|---|---|
| `pnpm dev` | Start all dev servers in parallel |
| `pnpm build` | Production build for all apps |
| `pnpm typecheck` | Run TypeScript type-checking across the monorepo |
| `pnpm check` | Lint & format all files with Biome (auto-fix) |
| `pnpm clean` | Remove all build artifacts, caches, and `node_modules` |

---

## 🤝 Contributing

Contributions are welcome! Here's how to get started:

1. **Fork** the repository
2. **Create** a feature branch:
   ```bash
   git checkout -b feature/amazing-feature
   ```
3. **Commit** your changes using [Conventional Commits](https://www.conventionalcommits.org/):
   ```bash
   git commit -m "feat: add amazing feature"
   ```
4. **Push** to your branch:
   ```bash
   git push origin feature/amazing-feature
   ```
5. **Open** a Pull Request

### Commit Convention

This project enforces [Conventional Commits](https://www.conventionalcommits.org/) via **Commitlint**. All commit messages must follow the format:

```
type(scope?): description
```

Common types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`.

### Git Hooks (Husky)

The following checks run automatically on every commit:

| Hook | What it does |
|---|---|
| **pre-commit** | Runs Biome lint/format → TypeScript typecheck → Full build |
| **commit-msg** | Validates commit message against Conventional Commits |

---

## ⚖️ License

Distributed under the **GPL-3.0 License**. See [`LICENSE`](LICENSE) for more information.

---

<p align="center">Built with ❤️ by <a href="https://github.com/vaaibhavmishra">Vaibhav Mishra</a></p>
