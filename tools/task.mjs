import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {lockedPackages, checkAge, MIN_AGE_MS} from './age-policy.mjs';

const source = '/source';
const workspace = '/workspace';
const require = createRequire(import.meta.url);
const hash = (value) => createHash('sha256').update(value).digest('hex');
const json = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

function verifyEnvironment() {
  if (!fs.existsSync('/.dockerenv') || process.getuid() === 0) throw new Error('Requires an unprivileged Docker container.');
  const {definitions} = require('/usr/local/lib/node_modules/npm/node_modules/@npmcli/config/lib/definitions');
  const before = Date.now(); const flat = {};
  definitions['min-release-age'].flatten('min-release-age', {'min-release-age': 7}, flat);
  if (Math.abs(before - flat.before.getTime() - MIN_AGE_MS) > 1000) throw new Error('npm age units are not days.');
  const expected = { 'ignore-scripts': 'true', 'min-release-age': '7', 'save-exact': 'true', audit: 'true', 'engine-strict': 'true', 'strict-ssl': 'true', registry: 'https://registry.npmjs.org/'};
  const config = Object.fromEntries(fs.readFileSync(`${source}/.npmrc`, 'utf8').split('\n').filter(l => l && !l.startsWith('#')).map(l => {const i=l.indexOf('='); return [l.slice(0,i),l.slice(i+1)];}));
  for (const [key, value] of Object.entries(expected)) if (config[key] !== value) throw new Error(`Unsafe npm config: ${key}`);
  if (Object.keys(config).some(key => /exclude|before|scope|proxy/.test(key))) throw new Error('Unexpected npm configuration override.');
}

function command(exe, args, {capture = false, env = {}} = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(exe, args, {cwd: workspace, env: {...process.env, ...env}, stdio: ['ignore','pipe','pipe']});
    let stdout = '', stderr = '';
    child.stdout.on('data', b => {stdout += b; if (!capture) process.stdout.write(b);});
    child.stderr.on('data', b => {stderr += b; process.stderr.write(b);});
    child.on('error', reject);
    child.on('exit', code => code === 0 ? resolve({stdout, stderr}) : reject(new Error(`${exe} exited ${code}`)));
  });
}

async function npm(args, capture = false) {
  const cache = fs.mkdtempSync(path.join(os.tmpdir(), 'funmmo-npm-'));
  try {
    const result = await command('sfw', ['npm', ...args], {capture, env: {NPM_CONFIG_CACHE: cache}});
    if (/\bwarn(?:ing)?\b|unscanned|unknown (?:package|version)|suspected malware/i.test(result.stderr + (capture ? '' : result.stdout))) {
      throw new Error('Package operation reported a warning; review required before proceeding.');
    }
    return capture ? JSON.parse(result.stdout) : result;
  } finally { fs.rmSync(cache, {recursive: true, force: true}); }
}

function stage(includeCode = false) {
  for (const name of ['package.json', 'package-lock.json', '.npmrc']) {
    if (fs.existsSync(`${source}/${name}`)) fs.copyFileSync(`${source}/${name}`, `${workspace}/${name}`);
    else if (fs.existsSync(`${workspace}/${name}`)) fs.unlinkSync(`${workspace}/${name}`);
  }
  if (includeCode) for (const name of ['client','server','shared','tests','tools','tsconfig.json','tsconfig.server.json','vite.config.ts','index.html']) {
    if (!fs.existsSync(`${source}/${name}`)) continue;
    fs.rmSync(`${workspace}/${name}`, {recursive: true, force: true});
    fs.cpSync(`${source}/${name}`, `${workspace}/${name}`, {recursive: true});
  }
}

async function validateLock() {
  const packages = lockedPackages(json(`${workspace}/package-lock.json`));
  const names = [...new Set(packages.map(p => p.name))];
  const times = new Map();
  // Metadata queries also pass through Socket. Bound concurrency to avoid bursts.
  for (let i=0; i<names.length; i+=4) {
    await Promise.all(names.slice(i,i+4).map(async name => times.set(name, await npm(['view',name,'time','--json'], true))));
  }
  const report = packages.map(pkg => checkAge(pkg, times.get(pkg.name)));
  fs.writeFileSync(`${workspace}/age-report.json`, JSON.stringify(report, null, 2)+'\n');
  console.log(`Age gate passed: ${report.length} external versions are at least 168 hours old.`);
}

function verifyReview() {
  const expected = fs.readFileSync(`${source}/security/reviewed-lock.sha256`, 'utf8').trim();
  if (expected !== hash(fs.readFileSync(`${workspace}/package-lock.json`))) throw new Error('Lockfile changed: dependency review required.');
}

try {
  verifyEnvironment();
  const [task, ...args] = process.argv.slice(2);
  if (task === 'policy-test') {
    await command('sfw',['--help']);
    await command('node',['--test',`${source}/tests/age-policy.test.mjs`]);
  } else if (task === 'metadata') {
    for (const name of args) {
      if (!/^(@[a-z0-9_.-]+\/)?[a-z0-9_.-]+(?:@\d+\.\d+\.\d+)?$/.test(name)) throw new Error('Invalid package name');
      const value = await npm(['view',name,'--json'], true);
      const eligible = Object.entries(value.time ?? {}).filter(([v,t]) => /^\d+\.\d+\.\d+$/.test(v) && Date.now()-Date.parse(t)>=MIN_AGE_MS).sort((a,b) => Date.parse(b[1])-Date.parse(a[1])).slice(0,6);
      console.log(JSON.stringify({name, version:value.version, publishedAt:value.time?.[value.version], eligible, repository:value.repository, engines:value.engines, dependencies:value.dependencies, deprecated:value.deprecated, dist:value.dist},null,2));
    }
  } else if (task === 'audit') {
    stage();await npm(['audit','--audit-level=low']);
  } else if (task === 'resolve') {
    stage();
    const pkg = json(`${workspace}/package.json`);
    for (const version of Object.values({...pkg.dependencies,...pkg.devDependencies})) if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Direct versions must be exact stable releases.');
    await npm(['install','--package-lock-only','--ignore-scripts']);
    await validateLock();
  } else if (task === 'install') {
    stage(); verifyReview();
    fs.rmSync(`${workspace}/.installed-lock`, {force:true});
    await validateLock();
    await npm(['ci','--ignore-scripts']);
    // npm audit's nonzero exit is a stop condition before executing dependency code.
    await npm(['audit','--audit-level=low']);
    fs.writeFileSync(`${workspace}/.installed-lock`,hash(fs.readFileSync(`${workspace}/package-lock.json`)));
  } else if (['build','test','serve'].includes(task)) {
    stage(true); verifyReview();
    if (fs.readFileSync(`${workspace}/.installed-lock`,'utf8') !== hash(fs.readFileSync(`${workspace}/package-lock.json`))) throw new Error('Run the checked installation first.');
    await npm(['run',task]);
  } else if (['export-lock','export-age'].includes(task)) {
    process.stdout.write(fs.readFileSync(`${workspace}/${task === 'export-lock' ? 'package-lock.json' : 'age-report.json'}`));
  } else throw new Error(`Unsupported task: ${task}`);
} catch (error) { console.error(error.message); process.exitCode = 1; }
