import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// The generic Native gallery item must request a system-defined native unit.
// TestIds.GAM_NATIVE also serves a custom native format, and the generic
// NativeAd path only registers system-defined native ads (custom formats are
// opt-in through CustomNativeAd). That is a unit-choice correctness lock,
// not a claim that the unit caused (or will prevent) SDK internal-error 0.

function readRepoFile(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(`../../../${relativePath}`, import.meta.url)), 'utf8');
}

test('the example requests plain native ads from system-defined units only', () => {
  const app = readRepoFile('RNGoogleMobileAdsExample/App.tsx');
  const units = [...app.matchAll(/NativeAd\.createForAdRequest\(\s*TestIds\.(\w+)/g)].map(
    match => match[1],
  );

  assert.ok(units.length > 0, 'expected at least one plain native request to guard');
  for (const unit of units) {
    assert.doesNotMatch(
      unit,
      /^GAM_/,
      `NativeAd.createForAdRequest must not use TestIds.${unit}: use a system-defined native unit`,
    );
  }
});

/** Source text from `start` up to the next `end` (or end of file). */
function section(source: string, start: string, end: string): string {
  const from = source.indexOf(start);
  assert.ok(from >= 0, `expected to find ${start}`);
  const to = source.indexOf(end, from + start.length);
  return source.slice(from, to < 0 ? undefined : to);
}

// Custom native formats are opt-in (CustomNativeAd / customNativeFormatIds), so the files below do
// mention them. The lock is that the GENERIC NativeAd.createForAdRequest loaders never register a
// custom format: an AdLoader that registers no custom format ID cannot receive one, so the generic
// Native screen keeps getting system-defined native ads.
test('the generic native loaders do not request custom formats', () => {
  const classic = readRepoFile(
    'packages/core/android/src/classic/java/io/invertase/googlemobileads/ReactNativeGoogleMobileAdsNativeModule.kt',
  );
  const classicLoader = section(
    classic,
    'private inner class NativeAdHolder(',
    'private inner class CustomNativeAdHolder(',
  );
  assert.ok(classicLoader.includes('forNativeAd'), 'Android must still load system-defined native');
  assert.ok(
    !classicLoader.includes('forCustomFormatAd'),
    'Android NativeAdHolder now requests custom formats; revisit whether GAM_NATIVE is valid for the generic Native screen',
  );

  const nextgen = readRepoFile(
    'packages/core/android/src/nextgen/java/io/invertase/googlemobileads/ReactNativeGoogleMobileAdsNativeModule.kt',
  );
  const nextgenLoader = section(nextgen, 'private fun loadInitialized(', '@ReactMethod');
  assert.ok(
    nextgenLoader.includes('listOf(NativeAd.NativeAdType.NATIVE)'),
    'Next-Gen must still load system-defined native',
  );
  assert.ok(
    !nextgenLoader.includes('CUSTOM_NATIVE'),
    'Next-Gen NativeAd load now requests custom formats; revisit whether GAM_NATIVE is valid for the generic Native screen',
  );

  const ios = readRepoFile('packages/core/ios/RNGoogleMobileAds/RNGoogleMobileAdsNativeModule.mm');
  const iosLoader = section(ios, '@implementation RNGMANativeAdHolder', '@end');
  assert.ok(iosLoader.includes('GADAdLoaderAdTypeNative'), 'iOS must still load system-defined native');
  assert.ok(
    !iosLoader.includes('GADAdLoaderAdTypeCustomNative'),
    'iOS RNGMANativeAdHolder now requests custom formats; revisit whether GAM_NATIVE is valid for the generic Native screen',
  );
});

/**
 * Offsets of every `token` in `source` that lies OUTSIDE the brace-matched block opened by the first
 * `{` after `guard`. Empty means every occurrence is guarded. A missing guard or token is reported
 * through `guardFound` / `total` so callers can fail loudly instead of passing vacuously.
 */
function unguardedOccurrences(
  source: string,
  guard: string,
  token: string,
): { guardFound: boolean; total: number; outside: number[] } {
  const offsets: number[] = [];
  for (let at = source.indexOf(token); at >= 0; at = source.indexOf(token, at + token.length)) {
    offsets.push(at);
  }
  const guardAt = source.indexOf(guard);
  if (guardAt < 0) {
    return { guardFound: false, total: offsets.length, outside: offsets };
  }
  const open = source.indexOf('{', guardAt + guard.length - 1);
  let depth = 0;
  let close = -1;
  for (let i = open; i >= 0 && i < source.length; i++) {
    if (source[i] === '{') depth++;
    if (source[i] === '}' && --depth === 0) {
      close = i;
      break;
    }
  }
  return {
    guardFound: true,
    total: offsets.length,
    outside: offsets.filter(at => open < 0 || close < 0 || at < open || at > close),
  };
}

/** Lines containing `token` that do not also contain `guard` before it (single-line `if`). */
function unguardedLines(source: string, guard: string, token: string): string[] {
  return source
    .split('\n')
    .filter(line => line.includes(token))
    .filter(line => {
      const guardAt = line.indexOf(guard);
      return guardAt < 0 || guardAt > line.indexOf(token);
    });
}

test('the guard helpers reject registrations moved outside the guard', () => {
  const guarded = 'if (ids.isNotEmpty()) {\n  builder.forCustomFormatAd(id)\n}\nbuilder.build()';
  const movedOut = 'if (ids.isNotEmpty()) {\n  log()\n}\nbuilder.forCustomFormatAd(id)';
  const extraUnguarded = guarded + '\nbuilder.forCustomFormatAd(other)';
  const guard = 'if (ids.isNotEmpty()) {';
  assert.deepEqual(unguardedOccurrences(guarded, guard, 'forCustomFormatAd').outside, []);
  assert.equal(unguardedOccurrences(movedOut, guard, 'forCustomFormatAd').outside.length, 1);
  assert.equal(unguardedOccurrences(extraUnguarded, guard, 'forCustomFormatAd').outside.length, 1);
  assert.equal(unguardedOccurrences('no guard here', guard, 'x').guardFound, false);

  const lineGuard = 'if (ids.isNotEmpty())';
  assert.deepEqual(unguardedLines('if (ids.isNotEmpty()) types.add(CUSTOM)', lineGuard, 'CUSTOM'), []);
  assert.equal(unguardedLines('types.add(CUSTOM)', lineGuard, 'CUSTOM').length, 1);
});

test('multi-format requests register custom formats only when customNativeFormatIds is set', () => {
  const classic = section(
    readRepoFile(
      'packages/core/android/src/classic/java/io/invertase/googlemobileads/ReactNativeGoogleMobileAdsNativeModule.kt',
    ),
    'override fun loadMultiFormat(',
    'override fun destroyHandle(',
  );
  const classicCheck = unguardedOccurrences(
    classic,
    'if (customFormatIds.isNotEmpty()) {',
    'forCustomFormatAd',
  );
  assert.ok(classicCheck.guardFound, 'Android multi-format must guard custom formats on format IDs');
  assert.ok(classicCheck.total > 0, 'Android multi-format no longer registers custom formats');
  assert.deepEqual(
    classicCheck.outside,
    [],
    'Android multi-format registers custom formats outside the format-ID guard',
  );

  const nextgen = section(
    readRepoFile(
      'packages/core/android/src/nextgen/java/io/invertase/googlemobileads/ReactNativeGoogleMobileAdsNativeModule.kt',
    ),
    'private fun loadMultiFormatInitialized(',
    '@ReactMethod',
  );
  assert.ok(nextgen.includes('CUSTOM_NATIVE'), 'Next-Gen multi-format no longer requests custom formats');
  assert.deepEqual(
    unguardedLines(nextgen, 'if (customFormatIds.isNotEmpty())', 'CUSTOM_NATIVE'),
    [],
    'Next-Gen multi-format adds CUSTOM_NATIVE without the format-ID guard',
  );

  const ios = section(
    readRepoFile('packages/core/ios/RNGoogleMobileAds/RNGoogleMobileAdsNativeModule.mm'),
    '@implementation RNGMAMultiFormatAdHolder',
    '@end',
  );
  const iosCheck = unguardedOccurrences(
    ios,
    'if (_customFormatIds.count > 0) {',
    'GADAdLoaderAdTypeCustomNative',
  );
  assert.ok(iosCheck.guardFound, 'iOS multi-format must guard custom formats on format IDs');
  assert.ok(iosCheck.total > 0, 'iOS multi-format no longer requests custom formats');
  assert.deepEqual(
    iosCheck.outside,
    [],
    'iOS multi-format registers custom formats outside the format-ID guard',
  );
});
