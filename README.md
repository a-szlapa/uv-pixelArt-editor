# Electron + React + TypeScript Starter

A minimal desktop starter using Electron, React, TypeScript/TSX, and Vite.

## Requirements

- Node.js 20.19+ or 22.12+
- npm

## Start in development

```bash
npm install
npm run dev
```

Vite serves the React renderer at `http://127.0.0.1:5173`; Electron opens a desktop window and reloads the renderer as you edit files.

## Scripts

- `npm run dev` — run Vite and Electron together
- `npm run typecheck` — run the TypeScript checker
- `npm run build` — type-check and build the renderer into `dist/`
- `npm run dist` — build and package the app with electron-builder

Packaged installers are written to `release/`. Packaging depends on the host OS and its build tooling.

## Project layout

```text
electron-react-ts-starter/
├── electron/
│   ├── main.cjs       # Electron main process
│   └── preload.cjs    # Safe, limited API bridge
├── src/
│   ├── App.tsx        # React UI
│   ├── main.tsx       # Renderer entry point
│   ├── styles.css
│   └── vite-env.d.ts
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Security notes

The renderer has `nodeIntegration: false`, `contextIsolation: true`, and sandboxing enabled. Add native Electron functionality through `electron/preload.cjs` and expose only narrowly scoped methods with `contextBridge`; do not expose the full `ipcRenderer` or Node.js APIs.

## Customize

Start in `src/App.tsx`. Add React components under `src/`, and add typed methods to the preload bridge as your app needs them.
