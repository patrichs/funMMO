# funMMO instructions

## Direction

Build a browser-based, third-person MMO inspired by WoW's gameplay, using
Babylon.js, TypeScript, Colyseus, and PostgreSQL. Start with a small playable zone.

## Mandatory dependency security policy

These requirements apply to all contributors and automation.

- Run ALL package-manager commands through Socket Firewall Free (`sfw`),
  including installs, updates, `ci`, metadata queries, audits, and script commands.
  Do not use bare npm/npx/pnpm/yarn or remotely downloaded scaffolding tools.
  If Socket is unavailable, fails, or reports suspected malware, stop the package
  operation. Do not retry without it or suppress warnings.
- Run project dependency installation, builds, tests, and game servers inside
  Docker. No host node_modules or global npm installs. Container configuration
  must be established and verified before the first project package command.
- Run containers as an unprivileged user, drop capabilities, and enable
  no-new-privileges. Never mount the Docker socket, home directory, SSH keys,
  cloud credentials, or SSH agent. Expose development ports on loopback only.
  Minimize writable mounts; package code must not get access to unrelated work.
- Every external package VERSION must have been published at least 7 full days
  (168 hours) ago, including transitive, optional, development, and build packages.
  No exemptions, lowered age limits, forced updates, or auto-fixes that bypass
  this rule. Missing publication metadata means stop, not assume it is old.
- Check the actual npm implementation's release-age units when selecting or
  changing the toolchain. This project's `.npmrc` uses days (`7`).
- Minimum age during resolution is not enough: before materializing dependencies
  from an existing or changed lockfile, validate every external locked version's
  registry publication timestamp against the 168-hour cutoff. Do not assume
  `npm ci` or an existing lockfile enforces publication age.
- Use official public npm registry releases, exact direct versions, and a
  committed package-lock.json with integrity hashes. No Git, URL, tarball, alias,
  or external local-file dependencies. Our own workspace links are permitted;
  their external dependencies remain subject to every check.
- Keep `ignore-scripts=true`, `save-exact=true`, `audit=true`,
  `engine-strict=true`, and TLS verification enabled. Review any necessary
  lifecycle script before proposing an explicit, narrowly scoped exception to
  a maintainer. Never enable all install scripts to fix a build.
- Use a fresh container-local npm cache for each dependency installation so
  cached tarballs cannot skip Socket's network checks. Do not reuse host caches.
- Prefer a small dependency tree and established, actively maintained upstream
  projects. Verify package spelling, official repository/ownership, selected
  version, maintenance, security findings, and available provenance. Record
  direct dependency decisions and review transitive changes before execution.
  Popularity, age, audit results, and a Socket pass are not proof of safety.
- Socket Free permits unscanned packages and warns rather than blocks on
  suspected malware. A warning is a stop condition for us. Unscanned packages
  require further review before use. Do not treat an exit code of zero as a
  substitute for reading the report.
- Apply the same rules in CI; pin container images by digest and third-party
  actions by reviewed commit. Bootstrap Socket from an official, age-eligible,
  pinned release and verify its published digest before execution.

Do not weaken these requirements without explicit maintainer approval.
See SECURITY.md for the dependency workflow and implementation status.

## Public repository privacy

This repository is public. Keep documentation, code, configuration, fixtures,
logs, screenshots, and commit messages free of personal information and
machine-specific details. Do not include personal filesystem paths, account
identifiers, private infrastructure details, credentials, or workstation notes.
Use repository-relative paths and generic placeholders in examples. Keep local
setup records outside the repository. Review changes for privacy before commits
or publication.

For optional machine-local session context, check `.git/LOCAL-HANDOFF.md` if it
exists. It is private Git metadata, must never be copied into tracked files, and
does not replace this repository's contributor or security requirements.
