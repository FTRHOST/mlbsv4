# MLBSv4 API and Native Patcher

This repository contains the backend and native components for a mobile game tournament integration tool. The core features involve dynamically modifying memory at runtime via a Frida engine built into a custom native Android library, which syncs its hooks Over-The-Air (OTA) with a centralized Vercel-hosted API.

## Code Architecture

### 1. `mlbsv4-api` (Backend/Vercel Node.js API)
- **Framework**: Express.js
- **Purpose**: Provides HTTP Server-Sent Events (SSE) and handles data aggregation from connected game clients.
- **OTA Hosting**: It serves the compiled `hook.js` and signed native binaries `libmypatch.so` used for OTA updates.

### 2. `native-patcher` (Android Native Core)
This handles injecting the Frida-GumJS engine and executing dynamically fetched scripts.

#### Loader (`loader.cpp` -> `libmyloader.so`)
- A lightweight bootstrap library that initializes the hooking sequence.
- **Engine Split Design**: To make OTA payloads drastically smaller, the heavy Frida-GumJS engine was extracted into its own shared library (`libfrida-gumjs.so`). The loader pre-loads this engine globally.
- **Fallback Mechanism**: If the dynamic load fails, it safely extracts `libmypatch.so` and `libfrida-gumjs.so` from the APK `assets` directly into the app's internal `/data/data/com.package.name/files` folder, ensuring robust multi-environment execution.
- **OTA Verification**: Asynchronously queries the server to download new binary versions of `libmypatch.so`. Signature verification guarantees safety. To prevent freezing or crashes mid-game, updates are cached locally and **only applied upon the next boot**.

#### Payload Engine (`main.cpp` -> `libmypatch.so`)
- Uses JNI to establish the connection with the Java JVM.
- Runs an internal embedded Frida-GumJS engine.
- Just like the Loader, the Payload Engine immediately runs the cached (or fallback) JavaScript hooking script so gameplay is uninterrupted. It then checks the network API in the background. If a new `hook.js` script is detected, it is verified against a strict RSA public key, downloaded, and scheduled to run on the next boot.

## CI/CD Pipeline (GitHub Actions)

A comprehensive, fully automated CI/CD pipeline is configured in `.github/workflows/build-and-deploy.yml`.

### Automatic Building on Changes
The workflow is triggered **automatically** upon every push or Pull Request targeting the `main` branch.
Whenever code changes are detected:
1. **Compilation**: The workflow compiles the Node.js dependencies, encrypts the JS scripts (`encrypt.py`), and uses Android NDK (`ndk-build`) to rebuild all native components (`libmypatch.so`, `libmyloader.so`).
2. **Key Injection**: Environment variables from GitHub Secrets (`PRIVATE_KEY`, `PUBLIC_KEY`, `FIREBASE_SERVICE_ACCOUNT`) are directly securely injected into the build environment.
3. **Signing (`sign-lib.js`, `sign-ota.js`)**: All compiled scripts and `.so` libraries are strongly signed for OTA verification.
4. **Vercel Deployment**: Finally, the newly compiled, signed binaries and the Node.js API server are seamlessly deployed to production via Vercel.

### Required GitHub Secrets
Ensure the following are set in your Repository Settings -> Secrets and Variables -> Actions:
- `PRIVATE_KEY`: PEM format private RSA key.
- `PUBLIC_KEY`: DER format public RSA key.
- `FIREBASE_SERVICE_ACCOUNT`: JSON service account.
- `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `VERCEL_TOKEN`: Used to deploy the latest API.

### Build Scripts
- `npm run watch`: Continuously compile Frida scripts.
- `npm run gen-keys`: Generate the public/private key-pair needed for OTA updates (only do this once).
- `cd native-patcher && ./build.sh --all`: Local script for triggering the NDK compile manually.
