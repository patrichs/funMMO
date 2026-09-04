# Dependency security

This project requires reviewed dependencies, a minimum version age of seven
days, and Socket Firewall Free around every package-manager command. AGENTS.md
records the mandatory workflow for all contributors and automation.

## Bootstrapping Socket Firewall

Before using a package manager, obtain the appropriate standalone binary from
Socket's official releases. Pin a release and asset that are both at least seven
days old, verify the published digest before execution, and make `sfw` available
inside the development container. Do not bootstrap using an unprotected npm
installation or a floating latest-release URL.

Socket documents that its binaries are unsigned. Checking the published digest
detects download corruption or a mismatch; it is not independent
publisher-signature verification. Keep machine-specific installation records
outside this public repository.

## Enforced development workflow

`./dev` is the supported entry point. Package operations run in an unprivileged
Docker container with a read-only root filesystem and repository mount, dropped
capabilities, and no host credentials or Docker socket. The writable workspace
and node_modules live in a named Docker volume. The development port is bound to
loopback only. Browser tests run in a separate restricted container; only their
artifact directory is writable on the host.

`tools/task.mjs` verifies npm's age units and required configuration before every
task. The age gate in `tools/age-policy.mjs` rejects young or undated versions,
non-registry dependencies, links, and missing SHA-512 integrity. Tests include
young nested optional/development dependencies and an exact 168-hour boundary.

For dependency changes:

1. Run `./dev bootstrap`, `./dev image`, and `./dev policy-test` to prepare and
   verify the pinned tools. The bootstrap verifies release/asset timestamps and
   checksums against official Socket release metadata.
2. Keep npm's actual age-setting verification enabled when changing toolchains.
3. Review direct dependencies against official upstream ownership and security
   information; record the package, exact version, publication date, source,
   reason for use, and review outcome.
4. Run `./dev resolve`, which uses `sfw npm install --package-lock-only`, with install
   scripts disabled and the seven-day cutoff active. Review Socket output and
   all transitive additions; do not proceed on warnings.
5. Inspect `./dev audit` and the complete lockfile diff. Validate every external version against registry
   publication timestamps before `sfw npm ci`. Reject missing timestamps,
   ineligible versions, and non-registry dependencies. Age restrictions during
   fresh resolution must not be assumed to cover locked installs.
6. Record the review in `security/dependencies.md` and update
   `security/reviewed-lock.sha256` to the reviewed lockfile's SHA-256. This records
   a contributor review, not a cryptographic endorsement by Socket. Run
   `./dev install`: it requires the matching hash, revalidates every timestamp,
   installs through Socket with a fresh container-local cache and scripts
   disabled, and requires a clean npm audit before recording installation success.
7. Builds and tests require that successful installation marker to match the
   reviewed lockfile. CI runs the same checks before builds and browser tests;
   it uses a pinned checkout action with credential persistence disabled.

Run `./dev` on the host; it executes the underlying npm commands inside Docker.
Do not run npm directly on the host. This policy is a workflow requirement, not
a machine-wide interception of arbitrary shell commands.

## Release-age configuration

The project sets `min-release-age=7`, in days. Verify that the selected npm
toolchain computes a cutoff at least 168 hours in the past. Check the actual
behavior when changing toolchains rather than relying on version assumptions.
The separate lockfile-age check is required even when this setting is active.

## Limits of the controls

Socket Free blocks confirmed malware, warns about suspected malware, and permits
unknown/unscanned versions. It checks network downloads, so cached artifacts can
skip checking. Age and reputation reduce risk but cannot guarantee safety.
Disabling install scripts does not prevent code execution during builds, tests,
or normal runtime; container isolation applies to all of those activities.
Containers share the host kernel and are not equivalent to a separate VM.

References:

- https://docs.socket.dev/docs/socket-firewall-free
- https://docs.npmjs.com/cli/v11/using-npm/config/#min-release-age
