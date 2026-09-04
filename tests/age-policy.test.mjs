import {test} from 'node:test';
import assert from 'node:assert/strict';
import {lockedPackages, checkAge, MIN_AGE_MS} from '../tools/age-policy.mjs';

const now = Date.UTC(2026, 8, 4, 12);
const pkg = {name: 'example', version: '1.0.0'};
const entry = (name) => ({version: '1.0.0', resolved: `https://registry.npmjs.org/${name}/-/${name.split('/').at(-1)}-1.0.0.tgz`, integrity: `sha512-${Buffer.alloc(64).toString('base64')}`});
const lock = () => ({lockfileVersion: 3, packages: {'': {}, 'node_modules/example': entry('example'), 'node_modules/example/node_modules/nested': {...entry('nested'), optional: true, dev: true}}});

test('accepts exactly 168 hours; rejects one millisecond younger and future dates', () => {
  assert.equal(checkAge(pkg, {'1.0.0': new Date(now - MIN_AGE_MS).toISOString()}, now).name, 'example');
  for (const age of [MIN_AGE_MS - 1, 0, -1000]) {
    assert.throws(() => checkAge(pkg, {'1.0.0': new Date(now - age).toISOString()}, now), /younger/);
  }
});
test('rejects missing and invalid publication metadata', () => {
  for (const times of [undefined, {}, {'1.0.0': null}, {'1.0.0': 'invalid'}]) assert.throws(() => checkAge(pkg, times, now), /Missing/);
});
test('checks nested optional development dependencies', () => {
  const packages = lockedPackages(lock());
  assert.equal(packages.length, 2);
  const times = {'1.0.0': new Date(now - 3600000).toISOString()};
  assert.throws(() => checkAge(packages.find(p => p.name === 'nested'), times, now), /nested/);
});
test('rejects links, non-registry URLs, URL tricks and missing integrity', () => {
  for (const bad of [{link: true}, {resolved: 'git+https://example.com/repo.git'}, {resolved: 'https://registry.npmjs.org.evil.test/example/-/example-1.0.0.tgz'}, {resolved: 'https://registry.npmjs.org/other/-/other-1.0.0.tgz'}, {integrity: undefined}]) {
    const value = lock();
    Object.assign(value.packages['node_modules/example'], bad);
    assert.throws(() => lockedPackages(value));
  }
});
test('rejects unsupported lockfiles and handles scoped packages', () => {
  assert.throws(() => lockedPackages({lockfileVersion: 1}));
  const value = lock(); value.packages['node_modules/@scope/example'] = entry('@scope/example');
  assert(lockedPackages(value).some(p => p.name === '@scope/example'));
});
