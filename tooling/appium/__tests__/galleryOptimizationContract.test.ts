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

test('gallery home requires the All section chip', () => {
  const homeStart = gallerySource.indexOf('async function isGalleryHome');
  const homeEnd = gallerySource.indexOf('async function scrollGalleryToTop', homeStart);
  const homeSource = gallerySource.slice(homeStart, homeEnd);
  assert.match(homeSource, /AppiumTestIds\.section\.all/);
  assert.doesNotMatch(homeSource, /galleryBack/);
});

test('scrollGalleryToTop caps swipe churn when section chip is missing', () => {
  const scrollStart = gallerySource.indexOf('async function scrollGalleryToTop');
  const scrollEnd = gallerySource.indexOf('/** Scroll the gallery list', scrollStart);
  const scrollSource = gallerySource.slice(scrollStart, scrollEnd);
  assert.match(scrollSource, /attempt < 2/);
  assert.match(scrollSource, /timeout: 3000/);
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

test('iOS backToGallery avoids driver.back and uses gallery back tap', () => {
  const backStart = gallerySource.indexOf('export async function backToGallery');
  const backEnd = gallerySource.indexOf('export async function resetAppState', backStart);
  const backSource = gallerySource.slice(backStart, backEnd);
  const iosTapStart = gallerySource.indexOf('async function tapIosGalleryBackButton');
  const iosTapEnd = gallerySource.indexOf('function isInstrumentationCrash', iosTapStart);
  const iosTapSource = gallerySource.slice(iosTapStart, iosTapEnd);
  assert.match(iosTapSource, /isExisting/);
  assert.match(backSource, /tapIosGalleryBackButton/);
  assert.match(backSource, /resetAppState/);
  const androidBranch = backSource.indexOf('if (isAndroid()) {');
  const androidElse = backSource.indexOf('} else {', androidBranch);
  const iosEntryStart = backSource.indexOf('} else {', androidElse + 1);
  const iosEntryEnd = backSource.indexOf('try {', iosEntryStart);
  assert.doesNotMatch(backSource.slice(iosEntryStart, iosEntryEnd), /driver\.back/);
  const iosCatchStart = backSource.indexOf('await captureIosStallEvidence');
  assert.match(backSource.slice(iosCatchStart), /resetAppState/);
  assert.doesNotMatch(backSource.slice(iosCatchStart), /driver\.back/);
});

test('iOS app-open close waits for chrome gone after lifecycle closed', () => {
  const closeStart = gallerySource.indexOf('async function runIosFullscreenShowCloseLifecycle');
  const closeEnd = gallerySource.indexOf('async function runIosHookShowCloseLifecycle', closeStart);
  const closeSource = gallerySource.slice(closeStart, closeEnd);
  assert.match(
    closeSource,
    /SHOW_LIFECYCLE_CLOSED[\s\S]*isIosFullscreenCloseChromeVisible[\s\S]*return true/,
  );
});

test('isIosAppOpenFeedChromeVisible prefers Continue before Test mode exclusion', () => {
  const feedStart = gallerySource.indexOf('async function isIosAppOpenFeedChromeVisible');
  const feedEnd = gallerySource.indexOf('async function tapIosAppOpenContinueChrome', feedStart);
  const feedSource = gallerySource.slice(feedStart, feedEnd);
  const continueIdx = feedSource.indexOf('IOS_APP_OPEN_CONTINUE_NAMES');
  const testModeIdx = feedSource.indexOf("'Test mode'");
  assert.ok(continueIdx >= 0 && testModeIdx > continueIdx);
});

test('format open requires container and diagnoses tap-miss vs navigation-stuck', () => {
  assert.match(gallerySource, /classifyFormatOpenObservation/);
  assert.match(gallerySource, /formatOpenDiagnosisMessage/);
  assert.match(gallerySource, /gallery\.open\.miss/);
  assert.match(gallerySource, /SMOKE_GAM_FLUID_VARIANT/);
  // Back-alone must not count as open (classic Fluid: back visible, container missing).
  const looksOpenStart = gallerySource.indexOf('async function formatLooksOpen');
  const looksOpenEnd = gallerySource.indexOf('\nasync function observeFormatOpen', looksOpenStart);
  const looksOpenSource = gallerySource.slice(looksOpenStart, looksOpenEnd);
  assert.doesNotMatch(
    looksOpenSource,
    /back\.isDisplayed[\s\S]*\|\|[\s\S]*container\.isDisplayed/,
  );
  assert.match(looksOpenSource, /container\.isDisplayed/);
});
