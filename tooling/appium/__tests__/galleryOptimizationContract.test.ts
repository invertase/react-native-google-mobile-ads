import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const gallerySource = readFileSync(
  new URL('../test/helpers/gallery.ts', import.meta.url),
  'utf8',
);

test('gallery helper uses condition waits instead of fixed delays', () => {
  assert.doesNotMatch(gallerySource, /driver\.pause\(/);
  assert.match(gallerySource, /driver\.waitUntil\(/);
});

test('gallery helper avoids UiScrollable searches', () => {
  assert.doesNotMatch(gallerySource, /new UiScrollable/);
  assert.match(gallerySource, /mobile: swipeGesture/);
});

test('already-selected gallery sections skip top scrolling and re-selection', () => {
  const selectionStart = gallerySource.indexOf('export async function selectGallerySection');
  const selectionEnd = gallerySource.indexOf(
    '\nasync function clickAndroidOpenerByTitle',
    selectionStart,
  );
  const selectionSource = gallerySource.slice(selectionStart, selectionEnd);
  const selectedReturn = selectionSource.indexOf(
    'if (await selected().catch(() => false))',
  );
  const scrollToTop = selectionSource.indexOf('await scrollGalleryToTop()');

  assert.ok(selectedReturn >= 0, 'selection must detect the active section');
  assert.ok(scrollToTop > selectedReturn, 'active-section return must precede top scrolling');
});
