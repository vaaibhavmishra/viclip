# ViClip 📋

**The Universal Clipboard Sync Tool.**

ViClip is a cross-platform application designed to make sharing content between your devices effortless. Whether you're moving a snippet of text from your phone to your laptop or sharing a link across operating systems, ViClip ensures your clipboard is always in sync.

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![Next.js](https://img.shields.io/badge/Next.js-000000?style=flat&logo=next.js&logoColor=white)](https://nextjs.org/)
[![Electron](https://img.shields.io/badge/Electron-47848F?style=flat&logo=electron&logoColor=white)](https://www.electronjs.org/)
[![Expo](https://img.shields.io/badge/Expo-000020?style=flat&logo=expo&logoColor=white)](https://expo.dev/)

---

## ✨ Features

- **Real-time Sync**: Instant clipboard synchronization across all your devices.
- **Cross-Platform**: Available on **iOS**, **Android**, **macOS**, **Windows**, **Linux**, and the **Web**.
- **Secure**: Privacy-focused synchronization keeping your data safe.

## 🏗️ Project Structure

This is a monorepo managed with [Turborepo](https://turbo.build/) and [pnpm](https://pnpm.io/).

### Apps
- `apps/web`: Next.js marketing website and web dashboard.
- `apps/desktop`: Electron application for macOS, Windows, and Linux.
- `apps/mobile`: Expo (React Native) app for iOS and Android.

### Packages (Shared)
- `packages/constants`: Shared business logic constants.
- `packages/types`: Centralized TypeScript definitions.
- `packages/utils`: Common utility functions (Crypto, Formatting, etc.).
- `packages/tsconfig`: Shared TypeScript configurations.

## 🛠️ Tech Stack

- **Frameworks**: Next.js, Electron, Expo (React Native).
- **Tooling**: Turborepo, pnpm, Biome (Linting/Formatting).
- **Language**: TypeScript.
- **Infrastructure**: Firebase (Storage & Auth).

## 🚀 Getting Started

### Prerequisites

- **Node.js**: v22 or higher.
- **pnpm**: v10 or higher.

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/vaaibhavmishra/viclip.git
   cd ViClip-Monorepo
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Set up environment variables:
   Create a `.env` file in the root directory with your Firebase and API configuration.

### Development

Run the development servers for all apps simultaneously:
```bash
pnpm dev
```

Or run specific platforms:
- **Web**: `pnpm dev:web`
- **Desktop**: `pnpm dev:desktop`
- **Mobile**: `pnpm dev:mobile`

## 📦 Building for Production

To build all apps for production:
```bash
pnpm build
```

Specific platform builds:
- **Desktop (Mac)**: `pnpm build:desktop:mac`
- **Mobile (Android Local)**: `pnpm build:mobile:android:local`

## 🤝 Contributing

Contributions are what make the open-source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## ⚖️ License

Distributed under the **GPL-3.0 License**. See `LICENSE` for more information.

---
Built with ❤️ by [Vaibhav Mishra](https://github.com/vaaibhavmishra)
