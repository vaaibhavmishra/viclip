# ViClip - Cross-Device Clipboard Sync

<div align="center">

![ViClip Logo](resources/icon.png)

**Sync your clipboard across Windows, macOS, and Linux instantly.**

[![License: Proprietary](https://img.shields.io/badge/License-Proprietary-blue.svg)](LICENSE.txt)
![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey)

[Features](#-features) • [Tech Stack](#%EF%B8%8F-tech-stack) • [Getting Started](#-getting-started) • [Development](#-development) • [Security](#-security--privacy)

</div>

---

## 🚀 Why ViClip?

ViClip solves the problem of seamless text and link sharing between your computers. Whether you're a developer working on a Mac and a PC, or just need to share a link from your laptop to your desktop, ViClip makes it instant and secure. No more emailing yourself links or using messaging apps as a clipboard.

## ✨ Features

- **Real-time Sync**: Copy on one device, paste on another instantly.
- **Cross-Platform**: Native support for macOS (Intel & Apple Silicon), Windows, and Linux.
- **Secure Storage**: End-to-end encryption for your clipboard data.
- **History Management**: Access and search your past clipboard items.
- **Device Management**: View and manage all your connected devices.
- **Dark Mode**: Sleek, modern interface with dark mode support.
- **Keyboard Shortcuts**: Efficient workflow with customizable shortcuts.

## 🛠️ Tech Stack

ViClip is built with a modern, robust technology stack ensuring performance and reliability:

- **Core**: [Electron](https://www.electronjs.org/), [React](https://reactjs.org/), [TypeScript](https://www.typescriptlang.org/)
- **Build Tooling**: [Vite](https://vitejs.dev/), [Electron-Vite](https://electron-vite.org/)
- **Styling**: [TailwindCSS](https://tailwindcss.com/)
- **UI Components**: [Radix UI](https://www.radix-ui.com/), [Lucide React](https://lucide.dev/) (Icons)
- **State Management**: [Zustand](https://github.com/pmndrs/zustand)
- **Backend / Sync**: [Firebase](https://firebase.google.com/) (Realtime Database, Auth)
- **Linting & Formatting**: [Biome](https://biomejs.dev/)

## 📂 Project Structure

The project follows a standard Electron-Vite structure:

```
ViClip-Desktop/
├── src/
│   ├── main/       # Electron main process code
│   ├── preload/    # Preload scripts for IPC
│   └── renderer/   # React frontend application
├── resources/      # Static assets (icons, etc.)
├── electron.vite.config.ts  # Vite configuration
└── package.json    # Project dependencies and scripts
```

## 📥 Getting Started

### Prerequisites

- **Node.js**: v16 or higher (v20+ recommended)
- **pnpm**: We use pnpm for package management.

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/viclip.git
   cd viclip
   ```

2. **Install dependencies:**
   ```bash
   pnpm install
   ```

3. **Environment Setup:**
   Create a `.env` file in the root directory with your Firebase configuration. You can use `.env.example` as a template.
   ```bash
   cp .env.example .env
   ```
   *Note: You will need your own Firebase project credentials.*

## 💻 Development

### Running Locally

Start the development server with hot-reloading:

```bash
pnpm dev
```

### Building for Production

To build the application for your current operating system:

```bash
pnpm build
```

To build for specific platforms:

```bash
# Windows
pnpm build:win

# macOS
pnpm build:mac

# Linux
pnpm build:linux
```

### Code Quality

Run the linter and type checker:

```bash
# Check for linting errors and format code
pnpm check

# Run type checking
pnpm typecheck
```

## 🔒 Security & Privacy

We take privacy seriously.

- **Local Encryption**: Sensitive tokens are encrypted on your device using your OS's native keychain (Keychain on macOS, DPAPI on Windows, Secret Service API on Linux).
- **Control**: You can pause syncing at any time.
- **Clear History**: You have full control to clear your cloud history instantly.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

Proprietary Software. Copyright © 2025 ViClip. All rights reserved.
See [LICENSE](LICENSE.txt) for more information.
