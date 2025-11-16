<h1 align="center">RetroLauncher</h1>

<p align="center">
  <b>A modern, delightful retro game launcher for desktop.</b><br/>
  Search and install ROMs from <a href="https://crocdb.net" target="_blank">CrocDB</a>, manage your library, and play via <a href="https://www.retroarch.com/" target="_blank">RetroArch</a> with automatic core management. Includes a TV‑friendly Big Picture Mode with full gamepad support.
</p>

<p align="center">
  <a href="https://tauri.app/"><img alt="Tauri" src="https://img.shields.io/badge/Tauri-1.5-blue?logo=tauri&logoColor=white"/></a>
  <a href="https://www.rust-lang.org/"><img alt="Rust" src="https://img.shields.io/badge/Rust-stable-orange?logo=rust&logoColor=white"/></a>
  <a href="https://react.dev/"><img alt="React" src="https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white"/></a>
  <a href="https://www.typescriptlang.org/"><img alt="TS" src="https://img.shields.io/badge/TypeScript-5-blue?logo=typescript&logoColor=white"/></a>
  <a href="https://tailwindcss.com/"><img alt="Tailwind" src="https://img.shields.io/badge/TailwindCSS-3-38BDF8?logo=tailwindcss&logoColor=white"/></a>
</p>

---

## ✨ Highlights

- 🎮 Library management with covers, favorites, and play stats
- 🔎 Integrated CrocDB search (platform/region filters)
- ⏬ One‑click install: download → extract → detect ROM → add to library
- 🧩 RetroArch integration with automatic core detection and install
- 🖥️ Big Picture Mode (TV UI) with full gamepad navigation and virtual keyboard
- 🌍 Multilingual (default EN, FR, ES, DE, IT, JA)
- ⚡ Modern UI: TailwindCSS + Framer Motion
- 📥 Floating download manager with live percentage, bytes, and speed

---

## 🖼️ Screenshots


- Library view
  <img width="1920" height="1040" alt="image" src="https://github.com/user-attachments/assets/bae91b28-2f29-435f-8524-37e7bece0741" />


- CrocDB search & install  
<img width="1920" height="1040" alt="image" src="https://github.com/user-attachments/assets/846e7deb-4d0e-4cbc-9636-bc598eb10361" />



- RetroArch Manager (cores)  
<img width="1920" height="1040" alt="image" src="https://github.com/user-attachments/assets/7ad7c454-6440-4bdb-8167-ef2bd02d901b" />



- Big Picture Mode (TV UI)  
<img width="1920" height="1040" alt="image" src="https://github.com/user-attachments/assets/73f0b0e5-5422-488b-a415-7f2710f885e3" />



---

## 🚀 Quickstart

### Prerequisites
- Node.js 18+
- Rust toolchain (stable)
- Tauri prerequisites  
  See: https://tauri.app/v1/guides/getting-started/prerequisites  
  - Windows: Visual Studio Build Tools + Windows SDK

### Install & Run (Dev)
```bash
# from project root
npm install
npm run tauri dev
```

The dev app runs against Vite dev server and will auto‑reload on changes.

### Build (Release)
```bash
npm run tauri build
# Bundles in src-tauri/target/release
```

---

## 🧩 RetroArch & Cores

RetroLauncher installs portable RetroArch (v1.21.0) and manages cores automatically.

- Install RetroArch in the app (RetroArch Manager)
- Cores are listed by platform and can be installed individually or in bulk
- Core detection works even for unknown DLLs by scanning the `cores/` directory

### Core cache & paths
- A full cores pack is downloaded once and extracted into an application cache:
  - Windows: `AppData/\Roaming/\com.retrolauncher.app/\cache/\retroarch_cores/\RetroArch-Win64/\cores`
- Installed cores used by RetroArch live here:
  - `AppData/\Roaming/\com.retrolauncher.app/\retroarch/\cores`
- UI lists available cores from the cache and marks ones installed in RetroArch.

---

## 📦 CrocDB Integration

- Search games by title, platform, region
- One‑click install:
  1) Download ZIP
  2) Extract
  3) Detect ROM
  4) Download cover art
  5) Add to local library (SQLite)
- Library is refreshed automatically after install.

---

## 🖥️ Big Picture Mode (TV)

- Full gamepad navigation (D‑pad/Analog, A/B/X/Y, LB/RB, START/SELECT)
- 4 primary views: Main Menu, Library, Favorites, Details
- Virtual keyboard for search (QWERTY/AZERTY)
- Search with LT/Y, live filtering, hints overlay
- Smooth transitions (Framer Motion), modern gradient themes

---

## ⚙️ Settings

- Language (default EN)  
  Files in `src/i18n/locales/*.json`. Change in Settings → persists across restarts.
- Appearance
  - Theme (Dark/Light/Auto)
  - Brand palette (normal + Big Picture)
- Big Picture options
  - Start view, grid size, hints, reduce motion, keyboard layout


