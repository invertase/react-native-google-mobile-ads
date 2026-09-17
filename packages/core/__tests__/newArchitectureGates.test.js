'use strict';

const fs = require('fs');
const path = require('path');

const coreRoot = path.resolve(__dirname, '..');
const podspec = fs.readFileSync(path.join(coreRoot, 'RNGoogleMobileAds.podspec'), 'utf8');
const androidBuild = fs.readFileSync(path.join(coreRoot, 'android', 'build.gradle'), 'utf8');

function requireMatch(source, pattern, label) {
  const match = source.match(pattern);
  if (match == null) {
    throw new Error(`expected ${label} to match ${pattern}`);
  }
  return match;
}

/**
 * RNFB iOS: fail only when ENV is present as the string '0'.
 * `defined?(ENV["RCT_NEW_ARCH_ENABLED"])` is the "variable may vanish" guard;
 * a missing flag is not an opt-out.
 */
function iosExplicitlyDisabled(envValue) {
  const [, op, rhs] = requireMatch(
    podspec,
    /if defined\?\(ENV\["RCT_NEW_ARCH_ENABLED"\]\) != nil &&\s*(?:\()?ENV\["RCT_NEW_ARCH_ENABLED"\]\s*(==|!=)\s*'([^']+)'/,
    'iOS fail-fast gate',
  );
  if (op === '==') {
    return envValue === rhs;
  }
  return envValue !== rhs;
}

/**
 * RNFB Android: fail only when the property exists and is not the string "true".
 * Missing `newArchEnabled` is not an opt-out.
 */
function androidExplicitlyDisabled(propertyValue) {
  const helper = requireMatch(
    androidBuild,
    /def isNewArchitectureDisabled\(\)\s*\{\s*return (project\.hasProperty\("newArchEnabled"\) && project\.newArchEnabled != "true")\s*\}/,
    'Android isNewArchitectureDisabled helper',
  )[1];
  expect(helper).toBe('project.hasProperty("newArchEnabled") && project.newArchEnabled != "true"');
  return propertyValue !== undefined && propertyValue !== 'true';
}

describe('New Architecture installation gates', () => {
  it.each([
    { name: 'explicitly enabled', value: '1', disabled: false },
    { name: 'explicitly disabled', value: '0', disabled: true },
    { name: 'missing', value: undefined, disabled: false },
    { name: 'empty string', value: '', disabled: false },
  ])('iOS treats $name as disabled=$disabled', ({ value, disabled }) => {
    expect(iosExplicitlyDisabled(value)).toBe(disabled);
  });

  it('fails iOS install only on the RNFB explicit-disable predicate, then raises', () => {
    expect(podspec).toMatch(
      /if defined\?\(ENV\["RCT_NEW_ARCH_ENABLED"\]\) != nil && \(ENV\["RCT_NEW_ARCH_ENABLED"\] == '0'\)\s*\n\s*raise /,
    );
    expect(podspec).toContain("if ENV['RCT_NEW_ARCH_ENABLED'] != '0' then");
    expect(podspec).not.toMatch(
      /if defined\?\(ENV\["RCT_NEW_ARCH_ENABLED"\]\) != nil && ENV\["RCT_NEW_ARCH_ENABLED"\] != '1'/,
    );
  });

  it.each([
    { name: 'explicitly enabled', value: 'true', disabled: false },
    { name: 'explicitly disabled', value: 'false', disabled: true },
    { name: 'missing', value: undefined, disabled: false },
    { name: 'empty string', value: '', disabled: true },
  ])('Android treats $name as disabled=$disabled', ({ value, disabled }) => {
    expect(androidExplicitlyDisabled(value)).toBe(disabled);
  });

  it('fails Android install only on the RNFB explicit-disable helper, then throws', () => {
    expect(androidBuild).toMatch(
      /if \(isNewArchitectureDisabled\(\)\) \{\s*throw new GradleException/,
    );
    expect(androidBuild).toContain('return !isNewArchitectureDisabled()');
    expect(androidBuild).not.toMatch(/return !project\.hasProperty\("newArchEnabled"\)/);
  });
});
