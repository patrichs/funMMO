export const MIN_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export function lockedPackages(lock) {
  if (lock.lockfileVersion !== 3 || !lock.packages || !lock.packages['']) {
    throw new Error('A version 3 package-lock with a root package is required.');
  }
  const found = new Map();
  for (const [path, pkg] of Object.entries(lock.packages)) {
    if (!path) continue;
    // Workspaces are not used in this first slice. Reject all links for now.
    if (pkg.link || !path.includes('node_modules/')) throw new Error(`Unsupported dependency: ${path}`);
    const name = path.split('node_modules/').at(-1);
    if (!/^(@[a-z0-9_.-]+\/)?[a-z0-9_.-]+$/.test(name)) throw new Error(`Invalid package: ${name}`);
    if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(pkg.version ?? '')) throw new Error(`Invalid version: ${name}`);
    const expected = `https://registry.npmjs.org/${name}/-/${name.split('/').at(-1)}-${pkg.version}.tgz`;
    if (pkg.resolved !== expected) {
      throw new Error(`Non-registry or aliased dependency: ${name}`);
    }
    const url = new URL(pkg.resolved);
    if (url.username || url.password || url.search || url.hash || url.port) throw new Error(`Invalid registry URL: ${name}`);
    if (!/^sha512-[A-Za-z0-9+/]+={0,2}$/.test(pkg.integrity ?? '') || Buffer.from(pkg.integrity.slice(7),'base64').length!==64) throw new Error(`Missing SHA-512 integrity: ${name}`);
    found.set(`${name}@${pkg.version}`, {name, version: pkg.version, integrity: pkg.integrity});
  }
  return [...found.values()];
}

export function checkAge(pkg, times, now = Date.now()) {
  const stamp = times?.[pkg.version];
  const published = typeof stamp === 'string' ? Date.parse(stamp) : NaN;
  if (!Number.isFinite(now) || !Number.isFinite(published)) throw new Error(`Missing publication date: ${pkg.name}@${pkg.version}`);
  if (now - published < MIN_AGE_MS) throw new Error(`Version is younger than 168 hours: ${pkg.name}@${pkg.version}`);
  return { ...pkg, publishedAt: stamp };
}
