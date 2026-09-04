# funMMO

A small browser MMO taking its first steps. Explore **Embervale**, a peaceful
village at the edge of a restless forest, with other adventurers.

## Play locally

Requires Docker with Compose, Python 3.11+, and an x86_64 Linux development
environment. The browser client can be opened on any desktop with WebGL support.
No host Node.js installation is required.

```sh
./dev bootstrap
./dev image
./dev policy-test
./dev install
./dev build
./dev up
```

Open **http://localhost:5173**. Open a second tab to join as another adventurer.
The service binds to loopback and is intended for local development.

| Control | Action |
| --- | --- |
| WASD | Move relative to the camera |
| Right mouse drag | Rotate the camera |
| Mouse wheel | Zoom |
| Tab / click a wisp | Choose a target |
| 1 | Sunbolt (12 m range; 0.8 s cooldown) |
| 2 | Mending light (+40 health; 6 s cooldown) |
| Enter | Local chat |
| Escape | Clear target / leave chat input |

Defeat three wisps to complete the first objective. Wisps damage nearby
adventurers and respawn after eight seconds. A defeated adventurer returns to
the village heartstone. Progress is temporary: this slice uses guest sessions
and has no database or accounts yet.

## Development and verification

See [CONTRIBUTING.md](CONTRIBUTING.md) for the contribution workflow and required
checks, and [SECURITY.md](SECURITY.md) for dependency review requirements.

```sh
./dev test       # policy, movement/combat rules, and real multiplayer clients
./dev build      # TypeScript checks, server compilation, production browser build
./dev up         # recreate the local server with the current source
./dev browser    # two-player WebGL browser checks and screenshots
./dev logs
./dev down       # stops containers; preserves the dependency volume
```

Rebuild after editing server code. The repository is mounted read-only; the
tooling stages source into its Docker volume when a task starts. Screenshots are
written to the ignored `artifacts/` directory. Generated builds and node_modules
stay in the Docker volume.

Use `./dev metadata PACKAGE`, `./dev resolve`, and `./dev audit` when reviewing
dependency changes. Follow [SECURITY.md](SECURITY.md) before installing a changed
lockfile. All package-manager commands go through Socket Firewall; every locked
external version must be at least seven days old. Install scripts stay disabled.

## Current scope

- Procedural 3D village, forest, characters and effects; no external art downloads.
- Shared Colyseus zones with up to 20 guest players each.
- Server-controlled movement, collision, spell cooldowns, damage, XP and respawns.
- Local chat rendered as text, targeting, health display and a small hotbar.
- Automated tests and the same Docker dependency safeguards in CI.

The 20-player setting is a room capacity, not a measured performance guarantee.
Next steps: PostgreSQL-backed characters, inventory and loot, quest interactions,
movement prediction, and measured multi-client load tests. Authentication,
cross-zone travel, durable progression and public hosting are not implemented.

## Layout

- `client/`: Babylon.js world and HTML/CSS interface.
- `server/`: authoritative zone and Node HTTP/WebSocket adapter.
- `shared/`: state schema and movement/combat rules.
- `tools/`, `security/`: isolated workflow and dependency review evidence.
- `tests/`: policy, gameplay, multiplayer, and rendered browser verification.

Colyseus handles matchmaking, room lifecycle and serialization. A small adapter
uses Node's HTTP server, `ws`, and Colyseus's public WebSocketClient submodule so
the prototype does not require Express. The selected dependencies and rationale
are documented in [security/dependencies.md](security/dependencies.md).
