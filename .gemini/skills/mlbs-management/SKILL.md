---
name: mlbs-management
description: Unified management for MLBSv4 project including Code Review, Build, Reverse Engineering, and Documentation tasks. Use this skill when working on Frida scripts, native C++ patches, analyzing Il2Cpp dumps, or managing project builds and documentation.
---

# MLBS Management Skill

This skill consolidates the expertise of specialized agents to manage the MLBSv4 project effectively.

## Core Capabilities

### 1. Code Review & Security
- **Trigger**: When modifying Frida scripts (`src/mods/`, `src/index.js`) or C++ patches (`native-patcher/jni/`).
- **Instructions**: Detect memory leaks, logic bugs, and ensure safe hooking. Verify JNI reference management in C++.

### 2. Build & Deployment
- **Trigger**: When requested to build the project or prepare for deployment.
- **Instructions**: 
  - Run Android NDK for `native-patcher`.
  - Bundle Frida scripts to `dist/agent.js` using `npm run build`.
  - Prepare environment for Vercel or Firebase.

### 3. Reverse Engineering Assistance
- **Trigger**: When analyzing Il2Cpp dumps or creating new hooks.
- **Instructions**: Analyze `dump.cs` (if available), find offsets, and generate Frida (JS) or C++ templates.

### 4. Documentation & Context
- **Trigger**: When structure analysis or documentation updates are needed.
- **Instructions**: Update README, architecture docs, and maintain inline code comments.

### 5. Testing & QA
- **Trigger**: Before finalizing changes or when running tests.
- **Instructions**: Run `test-api.js`, check Frida script syntax, and use Playwright for web automation if applicable.

## Project Resources
- **Frida Scripts**: `src/`
- **Native Patcher**: `native-patcher/`
- **Output Bundle**: `dist/agent.js`
- **Build Scripts**: `package.json`
