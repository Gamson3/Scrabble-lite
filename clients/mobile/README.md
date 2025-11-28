# Word Rush ⚡ Mobile Client

This folder hosts a minimal Capacitor shell that packages the React/Vite Word Rush web client for Android and iOS builds. The shell simply serves the compiled `clients/web` bundle inside a native WebView, providing a hybrid mobile app that shares the same codebase as the web client.

## Prerequisites

- Node 18+
- Android Studio for Android builds / Xcode for iOS builds
- `clients/web` fully configured (env vars, API hosts, etc.)

## Quick start

```bash
cd clients/mobile
npm install
npm run build
```

`npm run build` performs three steps:

1. Builds the React client (`npm run web:build`).
2. Copies the web bundle into `clients/web/dist`.
3. Runs `npx cap sync` to update the native Android/iOS projects.

### Running on devices

```bash
# Android emulator/device
npm run android

# iOS simulator/device
npm run ios
```

Both commands rebuild the web app, sync Capacitor, and then launch the platform-specific tooling. Use `npm run open:android` or `npm run open:ios` if you need to open the IDE without rebuilding first.

## Environment variables

The wrapped web app still reads `VITE_*` variables. Configure them in `clients/web/.env` before running `npm run build`. The mobile shell does not add additional configuration layers; it simply serves whatever dist bundle you produce.
