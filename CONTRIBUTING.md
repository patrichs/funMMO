# Contributing to funMMO

Start with the game overview, controls, and local setup in [README.md](README.md).
Read [AGENTS.md](AGENTS.md) and [SECURITY.md](SECURITY.md) before changing
dependencies or running project tools. These requirements apply to people and
automated contributors alike.

## Making a change

1. Create a branch for a focused change. Describe larger gameplay or architecture
   proposals in an issue before building them.
2. Use `./dev` from the repository root. It runs project commands inside Docker;
   no host Node installation or package-manager commands are needed.
3. Keep movement, combat, rewards, and progression rules authoritative on the
   server. Treat client messages as untrusted input. Put reusable game rules in
   `shared/`, rendering and interface work in `client/`, and room behavior in
   `server/`.
4. Add or adjust tests when changing behavior. Use the built-in Node test runner
   and existing multiplayer/browser harnesses where possible.
5. Update the game and setup documentation when behavior or commands change.

After the initial setup, verify gameplay changes with:

```sh
./dev test
./dev build
./dev up
./dev browser
./dev down
```

The browser check joins two players and exercises rendering, movement
replication, combat, chat, NPC quest acceptance, maps, riding, gathering, quest
turn-in, and leaving the world. It writes screenshots into the
ignored `artifacts/` directory. Review those images for visual changes. Use a
fresh local server for the browser check, without other players connected.

For character art, see [the character guide](docs/CHARACTER.md). Keep Blender
source, glTF detail levels and the export manifest synchronized. The browser
check also verifies skinned models and run/ride animation selection.

Run these commands sequentially: tooling tasks share one Docker workspace
volume. Rebuild after server edits and use `./dev up` to restart with current
source. Documentation-only changes need a content/link review, not a full
gameplay test run. CI runs the complete verification workflow for pushes and
pull requests.

World content is declared in `shared/content.ts`; rules live in
`server/WorldRoom.ts`. Update [the game guide](docs/GAME.md) when controls,
quests, spells or progression change. Keep private session progress in the
optional local handoff, outside tracked documentation.

## Changing dependencies

Follow the full review procedure in [SECURITY.md](SECURITY.md). Use exact direct
versions, check official upstream ownership and security findings, and review
the complete lockfile diff. Every external version must be at least 168 hours
old, including transitive and optional packages. All package commands must go
through Socket Firewall, with install scripts disabled.

Commit dependency changes together with `package-lock.json`, the updated age
report, dependency review notes, and the reviewed lockfile hash. After reviewing
the lockfile, record its SHA-256 with:

```sh
sha256sum package-lock.json | cut -d ' ' -f 1 > security/reviewed-lock.sha256
./dev install
```

Updating the hash records your review; it does not replace one. Do not bypass
Socket warnings, age checks, audits, or container restrictions to make a build
pass.

## Opening a pull request

Explain the problem, the resulting behavior, and the checks you ran. Include
known limitations and screenshots when they help explain a visual change. Keep
unrelated changes separate and use original or appropriately licensed assets.

This is a public repository. Review staged files, screenshots, logs, and commit
metadata before publishing. Use a GitHub noreply commit email if you want to
keep your email private. Keep credentials, personal paths, workstation details,
and private session handoffs outside tracked files. Public documentation should
describe the game and the reproducible contribution workflow.
