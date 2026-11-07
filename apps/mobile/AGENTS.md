# ViClip Mobile (@viclip/mobile) Agent Guidelines

This application is built with **Expo 55**, **React Native 0.83**, **NativeWind 4**, and **React Native Reanimated**.

## Architecture & Conventions

- **Routing**: Expo Router (`app/` directory). File-based routing with layouts.
- **Styling**: NativeWind v4 (Tailwind CSS for React Native). Use `className="..."`.
- **Crypto Adapter (`services/crypto.ts`)**:
  - Implements `CryptoAPI` adapter using React Native compatible libraries (`expo-crypto`, `react-native-quick-crypto`, or `@craftzdog/react-native-buffer`).
  - Never import `node:crypto` directly.
- **Push & Background Sync**:
  - Expo Notifications handles incoming push alerts when clipboard sync events occur on other devices.
  - Clipboard listeners must be sensitive to battery and platform permissions (iOS modal/paste notifications, Android background clipboard restrictions).

## Key Commands

- Run dev client: `pnpm --filter @viclip/mobile dev`
- Typecheck: `pnpm --filter @viclip/mobile typecheck`
- Local build checks: `pnpm build:mobile:android:local`

## Guardrails

- Do NOT commit or alter `google-services.json` or `GoogleService-Info.plist` unless specifically instructed.
- When adding native modules, verify Expo config plugins in `app.json` / `app.config.js`.
