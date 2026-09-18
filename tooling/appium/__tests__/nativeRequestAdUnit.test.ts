import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// The generic Native gallery item must request a system-defined native unit.
// TestIds.GAM_NATIVE also serves a custom native format, and this SDK only
// registers system-defined native ads. That is a unit-choice correctness lock,
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

test('the native loader does not request custom formats', () => {
  const androidModule = readRepoFile(
    'packages/core/android/src/main/java/io/invertase/googlemobileads/ReactNativeGoogleMobileAdsNativeModule.kt',
  );
  const iosModule = readRepoFile('packages/core/ios/RNGoogleMobileAds/RNGoogleMobileAdsNativeModule.mm');

  assert.ok(androidModule.includes('forNativeAd'), 'Android must still load system-defined native');
  assert.ok(
    !androidModule.includes('forCustomFormatAd'),
    'Android now requests custom formats; revisit whether GAM_NATIVE is valid for the generic Native screen',
  );
  assert.ok(
    !iosModule.includes('GADAdLoaderAdTypeCustomNative'),
    'iOS now requests custom formats; revisit whether GAM_NATIVE is valid for the generic Native screen',
  );
});
