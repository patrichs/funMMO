# Dependency review

Review date: 2026-09-04. Direct versions were selected from official public npm
metadata through Socket Firewall. Newer ineligible releases were excluded.
The complete external version/publication list is in dependency-ages.json after
resolution. reviewed-lock.sha256 binds the review to the exact lockfile.

| Package | Version | Published (UTC date) | Upstream | Purpose |
| --- | --- | --- | --- | --- |
| @babylonjs/core | 9.23.0 | 2026-08-27 | BabylonJS/Babylon.js | 3D engine; no downloaded art assets |
| @colyseus/core | 0.18.10 | 2026-08-28 | colyseus/colyseus | Authoritative room server |
| @colyseus/schema | 5.0.23 | 2026-08-27 | colyseus/schema | State serialization |
| @colyseus/sdk | 0.18.2 | 2026-08-20 | colyseus/colyseus | Browser and test clients |
| @colyseus/ws-transport | 0.18.2 | 2026-08-26 | colyseus/colyseus | Public WebSocketClient submodule only |
| ws | 8.21.3 | 2026-08-07 | websockets/ws | WebSocket connections for the Node HTTP adapter |
| @types/node | 24.13.3 | 2026-07-08 | DefinitelyTyped/DefinitelyTyped | Types matching Node 24 |
| @types/ws | 8.18.1 | 2025-04-01 | DefinitelyTyped/DefinitelyTyped | WebSocket types |
| playwright-core | 1.62.1 | 2026-07-30 | microsoft/playwright | Browser automation; no install-time browser download |
| typescript | 6.0.3 | 2026-04-16 | microsoft/TypeScript | Established JavaScript compiler build; avoids native compiler packages |
| vite | 8.2.2 | 2026-08-20 | vitejs/vite | Browser development and production bundling |

All listed packages have official upstream repository metadata and registry
integrity/signature metadata. Vite and Playwright also advertise npm provenance.
This records observed metadata, not a claim of independent signature verification
or a complete source audit. Socket installation output and npm audit must pass
before execution. No install lifecycle scripts are permitted.

Use Node's built-in test runner to avoid adding another test framework. The
PostgreSQL adapter will be selected and reviewed when persistence is implemented.

## Initial transitive review

The resolved tree contains 73 external versions, including platform-specific
optional packages. Reviewed families: Colyseus's clock/timer, shared types and
HTTP helpers; Better Auth/Fetch routing utilities; msgpackr and its optional
native decoders; ws; Vite's Rolldown/Oxc, Lightning CSS, PostCSS and glob utilities;
DefinitelyTyped declarations; debug/ms, nanoid, tslib and source-map support.
These correspond to the declared runtime/build dependencies. No Git, URL, alias,
or external local-file dependency is present. All locked versions passed the
registry timestamp check. Resolution reported zero audit vulnerabilities.

Two entries declare install scripts: msgpackr-extract (optional native decoder)
and fsevents (macOS watcher). Scripts remain disabled; neither is approved to run
an install script. Platform binaries are age-checked as part of the full lockfile.
Installation must still pass Socket's tarball checks and a fresh npm audit.

## HTTP transport choice

The default WebSocketTransport imports Express even when no Express app is
configured. Its qs dependency had an audit finding whose fixed release was
younger than seven days at review time. Neither package is in the dependency tree.
The game instead supplies a small Node HTTP/WebSocket adapter using Colyseus's
public Transport interface, public WebSocketClient submodule, and reserved-seat
connection helper. Colyseus core handles matchmaking and HTTP routing directly.
No upstream package is patched and no release-age exception is used. Transport
behavior is covered by real-client integration tests.
