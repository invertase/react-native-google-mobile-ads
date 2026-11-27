import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const exampleSource = readFileSync(
  new URL('../../../RNGoogleMobileAdsExample/App.tsx', import.meta.url),
  'utf8',
);

test('selected format swallows hardware back without clearing selection', () => {
  assert.match(exampleSource, /BackHandler/);
  const contentStart = exampleSource.indexOf('function AppContent');
  assert.ok(contentStart >= 0, 'AppContent must exist');
  const returnStart = exampleSource.indexOf('\n  return (\n', contentStart);
  assert.ok(returnStart > contentStart, 'AppContent render return must exist');
  const effectBlock = exampleSource.slice(contentStart, returnStart);

  assert.match(
    effectBlock,
    /useEffect\(\(\) => \{[\s\S]*selectedId == null[\s\S]*BackHandler\.addEventListener\('hardwareBackPress'/,
  );
  assert.match(effectBlock, /hardwareBackPress', \(\) => true\)/);
  assert.doesNotMatch(effectBlock, /hardwareBackPress[\s\S]*setSelectedId\(null\)/);
});