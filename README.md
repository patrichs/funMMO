# funMMO

A browser MMO prototype set in **The Green Reach**, a 1 km × 1 km human
borderland. Begin in Embervale and follow the roads to farms, riverside cottages,
a quarry, an old abbey and Northwatch. Adventure alongside other guest players.

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
| Tab / click an enemy | Choose a target |
| 1–6 | Sunbolt, Mending light, Frost lance, Fireburst, Stone ward, Windstep |
| E / click a nearby NPC or resource | Talk or gather |
| R | Summon / dismiss travel horse (outside combat) |
| M | Toggle world map |
| C | Inspect character / restore previous camera |
| Enter | Local chat |
| Escape | Clear target / close map or conversation / leave chat input |

Start by speaking to **Warden Elin**, beside the lantern path, and accept her
quest. Ten quests cover combat, gathering and exploration across six locations.
Return to the quest giver to claim each reward. Press R for faster travel and M
to find your way. See [the game guide](docs/GAME.md) for the world, quest chains,
spell details and current gameplay limits.

Progress is temporary: this slice uses guest sessions and has no database or
accounts yet. Leaving the session or restarting the server resets progress.

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

- A 1 km² procedural countryside with six settlements/landmarks, farms and roads.
- Human adventurers and quest givers, ten quests, six enemy types and 74 enemies.
- An original rigged anime adventurer with blonde hair, hoodie and plaid skirt;
  idle, run, casting and mounted animations, plus a distance model.
- Six spells, mana, travel horses, a world map, minimap and objective tracking.
- Shared Colyseus zones with up to 20 guest players each.
- Server-controlled movement, collision, spell cooldowns, damage, XP and respawns.
- Local chat rendered as text, targeting, health/mana display and spell cooldowns.
- Automated tests and the same Docker dependency safeguards in CI.

The 20-player setting is a room capacity, not a measured performance guarantee.
Next steps: PostgreSQL-backed characters, inventory and loot, movement prediction, and measured multi-client load tests. Authentication,
cross-zone travel, durable progression and public hosting are not implemented.

## Layout

- `client/`: Babylon.js world and HTML/CSS interface.
- `server/`: authoritative zone and Node HTTP/WebSocket adapter.
- `shared/`: state schema, movement rules, and world/quest/spell content.
- `docs/GAME.md`: player guide and current gameplay scope.
- `docs/CHARACTER.md`: character concepts, Blender source, animation and export workflow.
- `assets/characters/`: editable character source and concept art.
- `public/characters/`: self-contained game models and export manifest.
- `tools/`, `security/`: isolated workflow and dependency review evidence.
- `tests/`: policy, gameplay, multiplayer, and rendered browser verification.

Colyseus handles matchmaking, room lifecycle and serialization. A small adapter
uses Node's HTTP server, `ws`, and Colyseus's public WebSocketClient submodule so
the prototype does not require Express. The selected dependencies and rationale
are documented in [security/dependencies.md](security/dependencies.md).
