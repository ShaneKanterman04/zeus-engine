# Zeus Editor

Native C++/Qt visual editor for Zeus projects.

V1 is a read-only remote editor:

- Browse a project over SSH.
- Preview remote text and image files.
- Launch the project dev server over SSH.
- Open the running project in an embedded Qt WebEngine viewport through a local SSH tunnel.
- Use an embedded terminal tab that starts in the remote project directory.

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
npm run editor:run -- --remote user@example-host --path /path/to/game-project
```

The editor creates a default profile at:

```text
~/.config/Zeus/Editor/profiles.json
```

The default profile is created from the command-line values you pass to `editor:run`. Use a remote SSH target and project path that are valid for your environment.

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
The app button now relaunches the editor automatically after a successful update.


## Kill Stale Project Server

Inside the app, press **Kill Stale Server** to stop any process listening on the configured remote dev port.

From the command line:

```bash
npm run editor:kill-server
npm run editor:kill-server -- --remote user@example-host --port 5173
```
