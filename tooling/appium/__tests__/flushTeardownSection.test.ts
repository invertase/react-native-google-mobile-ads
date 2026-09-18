import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { FLUSH_TEARDOWN_SECTION, gallerySectionForFormat } from '../src/formats.ts';
import { AppiumTestIds } from '../src/testIds.ts';

// Regression lock for the a-primary skipped flush: teardown used to inherit whatever
// section the suite left selected. Ending on the long `formats` list parked the bottom
// Flush button beyond the scrollable viewport, so UiAutomator2 never exposed it and the
// coverage flush was skipped (b-secondary/c-tertiary ended on `debug` and succeeded).

test('flush teardown targets a real, narrow gallery section', () => {
  assert.equal(FLUSH_TEARDOWN_SECTION, 'debug');
  assert.ok(
    Object.prototype.hasOwnProperty.call(AppiumTestIds.section, FLUSH_TEARDOWN_SECTION),
    'teardown section must be a real gallery chip',
  );
  assert.notEqual(FLUSH_TEARDOWN_SECTION, 'all', 'the full list is what hid Flush');
  assert.notEqual(FLUSH_TEARDOWN_SECTION, 'formats', 'formats is the long list that hid Flush');
  // The flush surface belongs to the same section teardown selects.
  assert.equal(gallerySectionForFormat(AppiumTestIds.format.flushCoverage), FLUSH_TEARDOWN_SECTION);
});

test('flush teardown narrows the section before locating Flush', () => {
  const source = readFileSync(
    fileURLToPath(new URL('../src/flushCoverage.ts', import.meta.url)),
    'utf8',
  );
  const selectAt = source.indexOf('selectGallerySection(FLUSH_TEARDOWN_SECTION)');
  const tapAt = source.indexOf(`tapByTestId(AppiumTestIds.flushCoverage)`);
  assert.ok(selectAt > 0, 'teardown must select the narrow section');
  assert.ok(tapAt > 0, 'teardown must still tap Flush');
  assert.ok(selectAt < tapAt, 'section must be narrowed before locating Flush');
});
