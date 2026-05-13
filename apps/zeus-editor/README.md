# Zeus Editor

Native C++/Qt visual editor for Zeus projects.

V1 is a read-only remote editor:

- Browse a project over SSH.
- Preview remote text and image files.
- Launch the project dev server over SSH.
- Open the running project in an embedded Qt WebEngine viewport through a local SSH tunnel.

## Prerequisites

- CMake 3.24+
- Ninja
- Qt 6.5+ with Widgets, WebEngineWidgets, and Network
- OpenSSH client tools available on `PATH`
- Working key or agent auth for the target server

## Run

From the `zeus-engine` repo root:

```bash
npm run editor:configure
npm run editor:build
npm run editor:run -- --remote shane@10.0.0.194 --path /home/shane/Projects/last-hearth-game
```

The editor creates a default profile at:

```text
~/.config/Zeus/Editor/profiles.json
```

The default profile targets `shane@10.0.0.194` and `/home/shane/Projects/last-hearth-game`.

## Package

```bash
npm run editor:package
```

This installs the Linux build into:

```text
dist/zeus-editor
```

## Scope

V1 does not edit files, run migrations, or provide scene editing. The file explorer and preview are intentionally read-only.

## Update

From the command line:

```bash
npm run editor:update
```

Inside the app, press **Update Editor**. The updater pulls the latest repo changes, runs `npm install`, and rebuilds the editor. Restart the app after it completes.
