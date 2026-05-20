# Zeus Editor

Native C++/Qt visual editor for Zeus projects.

V1 includes a remote project browser, embedded terminal, project preview, and Asset Studio workflow:

- Browse a project over SSH.
- Preview remote text and image files.
- Launch the project dev server over SSH.
- Open the running project in an embedded Qt WebEngine viewport through a local SSH tunnel.
- Use an embedded terminal tab that starts in the remote project directory.
- Run Asset Studio workflows that can generate, promote, pack, and validate project assets.

## Prerequisites

- CMake 3.24+
- Ninja
- Qt 6.5+ with Widgets, WebEngineWidgets, and Network
- OpenSSH client tools available on `PATH`
- Working key or agent auth for the target server
- Codex CLI on the remote host for Asset Studio generation workflows

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

The file explorer and preview are read-only. Asset Studio is not read-only: it can run remote generation commands, copy promoted assets, write promotion metadata, and run project validation/packing commands. V1 still does not provide scene editing or migrations.

Some default Asset Studio paths and scripts are currently tuned for Last Hearth. That is allowed at the app/profile layer, but reusable engine packages under `packages/*` must remain game-agnostic.

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
