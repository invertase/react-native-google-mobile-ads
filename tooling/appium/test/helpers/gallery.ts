import {
  EXAMPLE_ANDROID_PACKAGE,
  EXAMPLE_IOS_BUNDLE_ID,
  gallerySectionForFormat,
  type GallerySectionId,
  type NavigationSmokeCase,
  type RepresentativeRequestOutcomeContract,
} from '../../src/formats.ts';
import {
  classifyRequestOutcome,
  hasNonzeroRectangle,
  nativeFingerprintFromAndroidLog,
  requestIdFromText,
  runRepresentativeRequestOutcomeContract,
  type RequestOutcomeClassification,
  type RequestFingerprint,
} from '../../src/requestOutcomes.ts';
import { AppiumTestIds } from '../../src/testIds.ts';

function isAndroid(): boolean {
  return (driver.capabilities.platformName?.toString().toLowerCase() ?? '') === 'android';
}

function appBundleId(): string {
  return isAndroid() ? EXAMPLE_ANDROID_PACKAGE : EXAMPLE_IOS_BUNDLE_ID;
}

/** Resolve a React Native testID across platforms (Android resource-id, iOS accessibility id). */
export async function findByTestId(testId: string) {
  if (isAndroid()) {
    return $(`android=new UiSelector().resourceId("${testId}")`);
  }
  return $(`~${testId}`);
}

async function scrollGalleryIos(testId: string): Promise<void> {
  try {
    await driver.execute('mobile: scroll', {
      direction: 'down',
      predicateString: `identifier == "${testId}"`,
    });
    return;
  } catch {
    // Fall back for older XCUITest builds.
  }
  await driver.execute('mobile: scroll', { direction: 'down' });
}

/** True when gallery home is showing (format back button hidden). */
async function isGalleryHome(): Promise<boolean> {
  const back = await findByTestId(AppiumTestIds.galleryBack);
  return !(await back.isDisplayed().catch(() => false));
}

async function scrollGalleryToTop(): Promise<void> {
  if (!isAndroid()) {
    try {
      await driver.execute('mobile: scroll', { direction: 'up' });
    } catch {
      // Best-effort on iOS.
    }
    return;
  }
  const topChip = await findByTestId(AppiumTestIds.section.all);
  for (let attempt = 0; attempt < 6; attempt++) {
    const rect = await topChip.getLocation().catch(() => null);
    const size = await topChip.getSize().catch(() => null);
    if (rect && size && rect.y >= 0 && size.height > 0) {
      return;
    }
    await androidSwipe('down', 0.65);
  }
  await topChip.waitForDisplayed({ timeout: 5000 });
}

/** Scroll the gallery list until the target testID is displayed. */
export async function scrollToTestId(testId: string) {
  const el = await findByTestId(testId);
  if (await el.isDisplayed().catch(() => false)) {
    return el;
  }

  if (isAndroid()) {
    const { height } = await driver.getWindowSize();
    for (let attempt = 0; attempt < 12; attempt++) {
      const latest = await findByTestId(testId);
      const rect = await latest.getLocation().catch(() => null);
      const size = await latest.getSize().catch(() => null);
      if (
        rect &&
        size &&
        size.height > 0 &&
        rect.y >= 0 &&
        rect.y + size.height <= height
      ) {
        return latest;
      }
      await androidSwipe('up', 0.55);
    }
    const finalEl = await findByTestId(testId);
    await finalEl.waitForDisplayed({ timeout: 5000 });
    return finalEl;
  }

  for (let i = 0; i < 8; i++) {
    if (await el.isDisplayed().catch(() => false)) {
      return el;
    }
    await scrollGalleryIos(testId);
  }

  await el.waitForDisplayed({ timeout: 5000 });
  return el;
}

/** Mid-screen band — avoid status bar and gesture-nav / Flush-adjacency misses. */
const ANDROID_SAFE_Y_MAX = 0.68;

async function androidSwipe(direction: 'up' | 'down', percent = 0.4): Promise<void> {
  const { height, width } = await driver.getWindowSize();
  try {
    await driver.execute('mobile: swipeGesture', {
      left: Math.floor(width * 0.2),
      top: Math.floor(height * 0.4),
      width: Math.floor(width * 0.6),
      height: Math.floor(height * 0.35),
      direction,
      percent,
    });
  } catch {
    // Best-effort.
  }
}

async function androidSwipeUp(percent = 0.4): Promise<void> {
  await androidSwipe('up', percent);
}

/**
 * Prefer a coordinate shell tap. Avoid UiScrollable.scrollIntoView when the node
 * already has on-screen bounds — isDisplayed() is false-negative on RN buttons
 * mid-list, and scrollIntoView parks them on the gesture-nav edge.
 *
 * Lift repeatedly into a mid-screen band (hooks like RWI sit just above Flush).
 * Do not prefer elementId clickGesture here — it can no-op on RN Buttons while
 * still resolving, which caused broader smoke regressions during remediation.
 */
async function clickAndroidByTestId(testId: string): Promise<void> {
  const { height, width } = await driver.getWindowSize();
  const safeMax = height * ANDROID_SAFE_Y_MAX;

  try {
    await driver.waitUntil(
      async () => {
        try {
          const el = await findByTestId(testId);
          await el.getLocation();
          return true;
        } catch {
          return false;
        }
      },
      { timeout: 8000, timeoutMsg: `testID ${testId} not present` },
    );
  } catch {
    await scrollGalleryToTop();
    await scrollToTestId(testId);
  }

  let el = await findByTestId(testId);
  let rect = await el.getLocation();
  let size = await el.getSize();
  let centerY = rect.y + size.height / 2;

  if (centerY < 0 || centerY > height) {
    await scrollToTestId(testId);
    el = await findByTestId(testId);
    rect = await el.getLocation();
    size = await el.getSize();
    centerY = rect.y + size.height / 2;
  }

  // Repeated lift only when the opener sits in the gesture-nav band.
  for (let lift = 0; lift < 2 && centerY >= safeMax; lift++) {
    await androidSwipeUp(centerY > height ? 0.55 : 0.4);
    el = await findByTestId(testId);
    rect = await el.getLocation();
    size = await el.getSize();
    centerY = rect.y + size.height / 2;
  }

  // Tap the element's own center (never clamp Y onto a different row).
  const x = Math.floor(rect.x + size.width / 2);
  const y = Math.floor(rect.y + size.height / 2);
  try {
    await driver.execute('mobile: shell', {
      command: 'input',
      args: ['tap', String(x), String(y)],
    });
  } catch {
    await driver.execute('mobile: clickGesture', { x, y });
  }
}

/**
 * Cross-platform gallery tap: Android uses the hardened coordinate path;
 * iOS scrolls then clicks. Used by coverage flush teardown.
 */
export async function tapByTestId(testId: string): Promise<void> {
  if (isAndroid()) {
    await clickAndroidByTestId(testId);
    return;
  }
  await scrollToTestId(testId);
  await clickElement(await findByTestId(testId));
}

async function clickElement(el: WebdriverIO.Element): Promise<void> {
  await el.waitForDisplayed({ timeout: 10000 });
  if (isAndroid()) {
    await driver.execute('mobile: clickGesture', { elementId: el.elementId });
    return;
  }
  try {
    await el.click();
  } catch {
    await driver.execute('mobile: clickGesture', { elementId: el.elementId });
  }
}

function isInstrumentationCrash(err: unknown): boolean {
  const msg = String(err);
  return (
    msg.includes('instrumentation process is not running') ||
    msg.includes('socket hang up') ||
    msg.includes('Could not proxy command')
  );
}

async function withInstrumentationRecovery<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (!isInstrumentationCrash(err)) {
      throw err;
    }
    await resetAppState();
    return fn();
  }
}

export async function waitForGalleryHome(): Promise<void> {
  try {
    await driver.updateSettings({
      waitForIdleTimeout: 100,
      waitForSelectorTimeout: 1000,
      disableIdLocatorAutocompletion: true,
    });
  } catch {
    // Settings are best-effort across driver versions.
  }
  // LogBox can sit over the lower gallery rows on Android and swallow taps.
  if (isAndroid()) {
    try {
      const logbox = await $('android=new UiSelector().descriptionContains("Open debugger")');
      if (await logbox.isDisplayed().catch(() => false)) {
        const dismiss = await $('android=new UiSelector().descriptionContains("Open debugger")');
        // Tap the trailing dismiss control when present; otherwise shell-tap its right edge.
        const rect = await dismiss.getLocation();
        const size = await dismiss.getSize();
        await driver.execute('mobile: shell', {
          command: 'input',
          args: ['tap', String(Math.floor(rect.x + size.width - 40)), String(Math.floor(rect.y + size.height / 2))],
        });
        await driver.waitUntil(
          async () => !(await dismiss.isDisplayed().catch(() => false)),
          { timeout: 3000, timeoutMsg: 'LogBox did not dismiss' },
        );
      }
    } catch {
      // Best-effort.
    }
  }
  const root = await findByTestId(AppiumTestIds.root);
  await root.waitForDisplayed({ timeout: 90000 });
  await driver.waitUntil(async () => isGalleryHome(), {
    timeout: 30000,
    timeoutMsg: 'Gallery home did not become ready',
  });
}

export async function selectGallerySection(
  section: Exclude<GallerySectionId, 'all'>,
): Promise<void> {
  const chipId = AppiumTestIds.section[section];
  const selected = async (): Promise<boolean> => {
    const chip = await findByTestId(chipId);
    return (await elementText(chip)).includes('•');
  };
  if (await selected().catch(() => false)) {
    return;
  }
  await scrollGalleryToTop();
  // Chips stay near the top — use the same coordinate tap path as format openers.
  if (isAndroid()) {
    await clickAndroidByTestId(chipId);
  } else {
    const chip = await findByTestId(chipId);
    if (!(await chip.isDisplayed().catch(() => false))) {
      await scrollToTestId(chipId);
    }
    await clickElement(await findByTestId(chipId));
  }
  try {
    await driver.waitUntil(selected, {
      timeout: 3000,
      timeoutMsg: `Gallery section ${section} did not become selected`,
    });
  } catch (error) {
    if (!isAndroid()) {
      throw error;
    }
    await clickAndroidByTestId(chipId);
    await driver.waitUntil(selected, {
      timeout: 3000,
      timeoutMsg: `Gallery section ${section} did not become selected after retry`,
    });
  }
}

async function clickAndroidOpenerByTitle(galleryTitle: string): Promise<boolean> {
  for (const label of [galleryTitle.toUpperCase(), galleryTitle]) {
    const byText = await $(`android=new UiSelector().text("${label}")`);
    if (!(await byText.isExisting().catch(() => false))) {
      continue;
    }
    try {
      let rect = await byText.getLocation();
      let size = await byText.getSize();
      const { height, width } = await driver.getWindowSize();
      let centerY = rect.y + size.height / 2;
      // Lift only while measured bounds are clipped/unsafe, and stop if a swipe
      // did not move the row. This avoids the former repeated double-drag tax.
      for (
        let lift = 0;
        lift < 2 && (size.height <= 8 || centerY < 0 || centerY > height * 0.72);
        lift++
      ) {
        const previousCenterY = centerY;
        await androidSwipeUp(0.45);
        rect = await byText.getLocation();
        size = await byText.getSize();
        centerY = rect.y + size.height / 2;
        if (Math.abs(centerY - previousCenterY) < 2) {
          break;
        }
      }
      if (size.height <= 8 || centerY < 0 || centerY > height) {
        continue;
      }
      const x = Math.floor(Math.min(Math.max(rect.x + size.width / 2, width * 0.1), width * 0.9));
      const y = Math.floor(centerY);
      await driver.execute('mobile: shell', {
        command: 'input',
        args: ['tap', String(x), String(y)],
      });
      return true;
    } catch {
      // Try next label.
    }
  }
  return false;
}

async function clickGalleryOpener(openId: string, galleryTitle?: string): Promise<void> {
  if (isAndroid()) {
    // Prefer unique gallery title text when provided — resource-id taps on clipped
    // All-list rows (inverted bounds) are the residual RWI flake host; titles are unique.
    if (galleryTitle) {
      const usedTitle = await clickAndroidOpenerByTitle(galleryTitle);
      if (usedTitle) {
        return;
      }
    }
    await clickAndroidByTestId(openId);
    return;
  }
  if (galleryTitle) {
    const byText = await $(`~${galleryTitle}`);
    if (await byText.isDisplayed().catch(() => false)) {
      await clickElement(byText);
      return;
    }
  }
  await scrollToTestId(openId);
  const button = await findByTestId(openId);
  await clickElement(button);
}

async function ensureBannerAccordionClosed(): Promise<void> {
  if (isAndroid()) {
    for (const label of ['Hide banner sizes', 'HIDE BANNER SIZES']) {
      const hide = await $(`android=new UiSelector().text("${label}")`);
      if (await hide.isDisplayed().catch(() => false)) {
        await clickElement(hide);
        await driver.waitUntil(
          async () => {
            for (const currentLabel of ['Hide banner sizes', 'HIDE BANNER SIZES']) {
              const current = await $(`android=new UiSelector().text("${currentLabel}")`);
              if (await current.isDisplayed().catch(() => false)) {
                return false;
              }
            }
            return true;
          },
          { timeout: 3000, timeoutMsg: 'Banner accordion did not close' },
        );
        return;
      }
    }
    return;
  }
  const hide = await $('~Hide banner sizes');
  if (await hide.isDisplayed().catch(() => false)) {
    await clickElement(hide);
    await driver.waitUntil(
      async () => {
        const current = await $('~Hide banner sizes');
        return !(await current.isDisplayed().catch(() => false));
      },
      { timeout: 3000, timeoutMsg: 'Banner accordion did not close' },
    );
  }
}

async function formatLooksOpen(formatId: string): Promise<boolean> {
  const back = await findByTestId(AppiumTestIds.galleryBack);
  const container = await findByTestId(formatId);
  return (
    (await back.isDisplayed().catch(() => false)) ||
    (await container.isDisplayed().catch(() => false))
  );
}

async function waitForFormatOpen(formatId: string, timeoutMs: number): Promise<boolean> {
  try {
    await driver.waitUntil(async () => formatLooksOpen(formatId), {
      timeout: timeoutMs,
      timeoutMsg: `Format ${formatId} did not open`,
    });
    return true;
  } catch {
    return formatLooksOpen(formatId);
  }
}

export async function openFormat(formatId: string, galleryTitle?: string): Promise<void> {
  await withInstrumentationRecovery(async () => {
    const openId = AppiumTestIds.openFormat(formatId);
    // Android: one fast miss-retry with title-text fallback covers residual RWI / Flush
    // adjacency flakes without tripling every opener's worst-case wait.
    const maxAttempts = isAndroid() ? 2 : 1;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      if (!(await isGalleryHome())) {
        await backToGallery();
      }
      await ensureBannerAccordionClosed();
      await selectGallerySection(gallerySectionForFormat(formatId));
      if (formatId.startsWith('gma.format.banner.')) {
        const variantOpen = await findByTestId(openId);
        if (!(await variantOpen.isDisplayed().catch(() => false))) {
          const hideTitle = isAndroid()
            ? await $(`android=new UiSelector().text("Hide banner sizes")`)
            : await $('~Hide banner sizes');
          const accordionOpen = await hideTitle.isDisplayed().catch(() => false);
          if (!accordionOpen) {
            await clickGalleryOpener(
              AppiumTestIds.openFormat(AppiumTestIds.format.banner),
              'Banner sizes',
            );
            await driver.waitUntil(
              async () => {
                const opener = await findByTestId(openId);
                return opener.isExisting().catch(() => false);
              },
              {
                timeout: 5000,
                timeoutMsg: `Banner variant ${formatId} did not appear`,
              },
            );
          }
        }
      }
      if (isAndroid() && attempt > 1 && galleryTitle) {
        const usedTitle = await clickAndroidOpenerByTitle(galleryTitle);
        if (!usedTitle) {
          await clickGalleryOpener(openId, galleryTitle);
        }
      } else {
        await clickGalleryOpener(openId, galleryTitle);
      }
      const waitMs = attempt < maxAttempts ? 12000 : 45000;
      if (await waitForFormatOpen(formatId, waitMs)) {
        return;
      }
      if (attempt < maxAttempts) {
        if (!(await isGalleryHome())) {
          try {
            await backToGallery();
          } catch {
            await resetAppState();
          }
        } else {
          // Likely tapped Flush (same home) — cold restart clears sticky scroll/section.
          await resetAppState();
        }
      }
    }
    throw new Error(`Format ${formatId} did not open (container/back not visible)`);
  });
}

async function openFormatStrict(formatId: string, galleryTitle?: string): Promise<void> {
  if (!(await isGalleryHome())) {
    await backToGallery();
  }
  await ensureBannerAccordionClosed();
  await selectGallerySection(gallerySectionForFormat(formatId));
  const openId = AppiumTestIds.openFormat(formatId);
  if (formatId.startsWith('gma.format.banner.')) {
    const variantOpen = await findByTestId(openId);
    if (!(await variantOpen.isDisplayed().catch(() => false))) {
      await clickGalleryOpener(
        AppiumTestIds.openFormat(AppiumTestIds.format.banner),
        'Banner sizes',
      );
      const opener = await findByTestId(openId);
      await opener.waitForExist({
        timeout: 5000,
        timeoutMsg: `Banner variant ${formatId} did not appear`,
      });
    }
  }
  await clickGalleryOpener(openId, galleryTitle);
  await driver.waitUntil(async () => formatLooksOpen(formatId), {
    timeout: 45000,
    timeoutMsg: `Format ${formatId} did not open (container/back not visible)`,
  });
}

export async function backToGallery(): Promise<void> {
  const back = await findByTestId(AppiumTestIds.galleryBack);
  if (await back.isDisplayed().catch(() => false)) {
    await clickElement(back);
  } else {
    await driver.back();
  }
  await driver.waitUntil(async () => isGalleryHome(), {
    timeout: 15000,
    timeoutMsg: 'Gallery home did not restore after back',
  });
}

export async function resetAppState(): Promise<void> {
  await driver.terminateApp(appBundleId());
  await driver.activateApp(appBundleId());
  await waitForGalleryHome();
}

export async function assertDisplayed(testId: string): Promise<void> {
  const el = await findByTestId(testId);
  await el.waitForDisplayed({ timeout: 20000 });
  await expect(el).toBeDisplayed();
}

type RenderRectangle = { width: number; height: number };

async function assertRenderedRectangle(testId: string): Promise<RenderRectangle> {
  const el = await findByTestId(testId);
  await el.waitForDisplayed({ timeout: 20000 });
  await expect(el).toBeDisplayed();
  const size = await el.getSize();
  if (!hasNonzeroRectangle(size)) {
    throw new Error(
      `[request-outcome] render proof ${testId} has zero rectangle ${JSON.stringify(size)}`,
    );
  }
  return size;
}

async function assertRenderedBannerSubtree(testId: string): Promise<{
  root: RenderRectangle;
  descendant: RenderRectangle;
  descendantType: string;
}> {
  const rootRectangle = await assertRenderedRectangle(testId);
  const root = await findByTestId(testId);
  const descendants = await root.$$('.//*');
  for (const descendant of descendants) {
    if (!(await descendant.isDisplayed().catch(() => false))) {
      continue;
    }
    const size = await descendant.getSize().catch(() => ({ width: 0, height: 0 }));
    if (hasNonzeroRectangle(size)) {
      const descendantType = await descendant
        .getAttribute(isAndroid() ? 'className' : 'type')
        .catch(() => 'unknown');
      return {
        root: rootRectangle,
        descendant: size,
        descendantType: String(descendantType || 'unknown'),
      };
    }
  }
  throw new Error(
    `[request-outcome] banner render proof ${testId} has no displayed nonzero native descendant`,
  );
}

async function elementText(el: WebdriverIO.Element): Promise<string> {
  const parts: string[] = [];
  const push = async (fn: () => Promise<unknown>) => {
    try {
      const v = await fn();
      if (v != null && String(v).length > 0) {
        parts.push(String(v));
      }
    } catch {
      // Platform-specific attributes throw on the other OS — ignore.
    }
  };
  await push(() => el.getText());
  if (isAndroid()) {
    await push(() => el.getAttribute('text'));
    await push(() => el.getAttribute('contentDescription'));
    await push(() => el.getAttribute('content-desc'));
  } else {
    await push(() => el.getAttribute('label'));
    await push(() => el.getAttribute('name'));
    await push(() => el.getAttribute('value'));
  }
  return parts.join(' ');
}

/** Wait until a testID's accessible text includes `substring` (probe / status seams). */
export async function waitForTestIdTextContaining(
  testId: string,
  substring: string,
  timeoutMs = 20000,
): Promise<void> {
  let lastSeen = '';
  try {
    await driver.waitUntil(
      async () => {
        if (isAndroid()) {
          for (const sel of [
            `android=new UiSelector().resourceId("${testId}").textContains("${substring}")`,
            `android=new UiSelector().resourceId("${testId}").descriptionContains("${substring}")`,
          ]) {
            if (await $(sel).isExisting().catch(() => false)) {
              return true;
            }
          }
        } else {
          // XCUITest: accessibility label / value often carries RN accessibilityLabel.
          for (const pred of [
            `name == "${testId}" AND label CONTAINS "${substring}"`,
            `name == "${testId}" AND value CONTAINS "${substring}"`,
          ]) {
            if (await $(`-ios predicate string:${pred}`).isExisting().catch(() => false)) {
              return true;
            }
          }
        }
        const el = await findByTestId(testId);
        if (!(await el.isExisting().catch(() => false))) {
          return false;
        }
        lastSeen = await elementText(el);
        return lastSeen.includes(substring);
      },
      {
        timeout: timeoutMs,
        timeoutMsg: `testID ${testId} text did not include "${substring}" (lastSeen=${JSON.stringify(lastSeen)})`,
      },
    );
  } catch (err) {
    try {
      const dump = await driver.getPageSource();
      const idx = dump.indexOf(testId);
      const snip =
        idx >= 0 ? dump.slice(Math.max(0, idx - 120), idx + 280).replace(/\s+/g, ' ') : 'testID absent from page source';
      throw new Error(`${String(err)} | pageSource=${snip}`);
    } catch (inner) {
      if (String(inner).includes('pageSource=')) {
        throw inner;
      }
      throw err;
    }
  }
}

async function observeRepresentativeRequestOutcome(
  formatId: string,
  path: RepresentativeRequestOutcomeContract['path'],
  attempt: number,
  timeoutMs = 10000,
): Promise<{
  requestId: number;
  classification: RequestOutcomeClassification;
  detail: string;
  fingerprint: RequestFingerprint;
}> {
  const testId = AppiumTestIds.action.loaded(formatId);
  let lastSeen = '';
  const marker = await findByTestId(testId);
  if (!(await marker.isExisting())) {
    throw new Error(`[request-outcome] ${formatId}: required marker ${testId} is missing`);
  }
  try {
    await driver.waitUntil(
      async () => {
        const el = await findByTestId(testId);
        if (!(await el.isExisting())) {
          throw new Error(`[request-outcome] ${formatId}: marker ${testId} disappeared`);
        }
        lastSeen = await el.getText();
        if (!lastSeen.includes(`Request attempt: ${attempt};`)) {
          return false;
        }
        return classifyRequestOutcome(lastSeen) !== undefined;
      },
      {
        timeout: timeoutMs,
        timeoutMsg: `testID ${testId} did not report terminal request attempt ${attempt} (lastSeen=${JSON.stringify(lastSeen)})`,
      },
    );
    const classification = classifyRequestOutcome(lastSeen);
    if (!classification) {
      throw new Error(
        `[request-outcome] ${formatId}: wait completed without a terminal outcome`,
      );
    }
    const requestId = requestIdFromText(lastSeen);
    if (requestId === undefined) {
      throw new Error(`[request-outcome] ${formatId}: terminal marker omitted request id`);
    }
    return {
      requestId,
      classification,
      detail: lastSeen,
      fingerprint: await collectRequestFingerprint(path, classification),
    };
  } catch (error) {
    let snippet = 'page source unavailable';
    try {
      const dump = await driver.getPageSource();
      const index = dump.indexOf(testId);
      snippet =
        index >= 0
          ? dump.slice(Math.max(0, index - 120), index + 320).replace(/\s+/g, ' ')
          : 'testID absent from page source';
    } catch {
      // Preserve the original WebDriver failure; page source is diagnostics only.
    }
    throw new Error(`${String(error)} | pageSource=${snippet}`, { cause: error });
  }
}

async function resetNativeFingerprintWindow(): Promise<void> {
  if (!isAndroid()) {
    return;
  }
  await driver.execute('mobile: shell', { command: 'logcat', args: ['-c'] });
}

async function collectRequestFingerprint(
  path: RepresentativeRequestOutcomeContract['path'],
  classification: RequestOutcomeClassification,
): Promise<RequestFingerprint> {
  if (path !== 'native' || classification !== 'internal-error') {
    return { status: 'not-applicable', evidence: 'not-native-internal-error' };
  }
  if (!isAndroid()) {
    return {
      status: 'unavailable',
      evidence: 'ios:no-request-scoped-native-sdk-log-capability',
    };
  }
  const log = await driver.execute('mobile: shell', {
    command: 'logcat',
    args: ['-d', '-v', 'threadtime'],
  });
  return nativeFingerprintFromAndroidLog(
    typeof log === 'string' ? log : JSON.stringify(log),
  );
}

/** Tap a format action without using gallery UiScrollable (format detail is not the gallery list). */
const SHOW_LIFECYCLE_OPENED = 'Show lifecycle: opened';
const SHOW_LIFECYCLE_CLOSED = 'Show lifecycle: closed';

/** Dismiss a fullscreen test creative without tapping in-ad UI (system back). */
async function dismissFullscreenAdWithoutCreativeTap(): Promise<void> {
  if (isAndroid()) {
    await driver.execute('mobile: shell', {
      command: 'input',
      args: ['keyevent', '4'],
    });
    return;
  }
  await driver.back();
}

async function assertShowCloseLifecycle(formatId: string): Promise<void> {
  await tapFormatAction(AppiumTestIds.action.show(formatId));
  await waitForTestIdTextContaining(
    AppiumTestIds.action.lifecycle(formatId),
    SHOW_LIFECYCLE_OPENED,
    90000,
  );
  await dismissFullscreenAdWithoutCreativeTap();
  await waitForTestIdTextContaining(
    AppiumTestIds.action.lifecycle(formatId),
    SHOW_LIFECYCLE_CLOSED,
    90000,
  );
  console.log(
    `[show-close-proof] ${JSON.stringify({
      format: formatId,
      platform: isAndroid() ? 'android' : 'ios',
      opened: SHOW_LIFECYCLE_OPENED,
      closed: SHOW_LIFECYCLE_CLOSED,
    })}`,
  );
}

async function tapFormatAction(actionId: string, accessibilityLabel?: string): Promise<void> {
  if (isAndroid()) {
    const selectors = [
      `android=new UiSelector().resourceId("${actionId}")`,
      ...(accessibilityLabel
        ? [
            `android=new UiSelector().description("${accessibilityLabel}")`,
            `android=new UiSelector().text("${accessibilityLabel}")`,
            `android=new UiSelector().textContains("${accessibilityLabel}")`,
          ]
        : []),
    ];
    for (const sel of selectors) {
      const el = await $(sel);
      if (!(await el.isExisting().catch(() => false))) {
        continue;
      }
      try {
        const rect = await el.getLocation();
        const size = await el.getSize();
        if (size.height <= 0 || size.width <= 0) {
          continue;
        }
        const x = Math.floor(rect.x + size.width / 2);
        const y = Math.floor(rect.y + size.height / 2);
        await driver.execute('mobile: shell', {
          command: 'input',
          args: ['tap', String(x), String(y)],
        });
        return;
      } catch {
        // Try next selector.
      }
    }
  } else if (accessibilityLabel) {
    const byLabel = await $(`~${accessibilityLabel}`);
    if (await byLabel.isExisting().catch(() => false)) {
      await clickElement(byLabel);
      return;
    }
  }
  // Fallback: testID click within the current screen (not gallery UiScrollable).
  const el = await findByTestId(actionId);
  await clickElement(el);
}

async function runFormatContract(opts: {
  formatId: string;
  containerId: string;
  galleryTitle: string;
  actionId?: string;
  expectedText?: string;
  expectedTexts?: readonly string[];
  emitStatusLabel?: string;
  actionAccessibilityLabel?: string;
  requiresAppRestart?: boolean;
}): Promise<void> {
  // Cold restarts are opt-in for formats with demonstrated state leakage.
  // Instrumentation-crash recovery remains in withInstrumentationRecovery().
  if (opts.requiresAppRestart) {
    await resetAppState();
  }
  await withInstrumentationRecovery(async () => {
    await openFormat(opts.formatId, opts.galleryTitle);
    await assertDisplayed(opts.containerId);
    if (opts.actionId && opts.expectedText) {
      await tapFormatAction(opts.actionId, opts.actionAccessibilityLabel);
    }
    for (const expectedText of [
      ...(opts.expectedText ? [opts.expectedText] : []),
      ...(opts.expectedTexts ?? []),
    ]) {
      await waitForTestIdTextContaining(
        AppiumTestIds.action.loaded(opts.formatId),
        expectedText,
        60000,
      );
    }
    if (opts.emitStatusLabel) {
      const status = await elementText(
        await findByTestId(AppiumTestIds.action.loaded(opts.formatId)),
      );
      console.log(
        `[${opts.emitStatusLabel}] ${JSON.stringify({
          platform: isAndroid() ? 'android' : 'ios',
          status,
        })}`,
      );
    }
    await backToGallery();
  });
}

/** Broad gallery contract: navigation and container presence only, never ad fill. */
export async function navigateToFormat(format: NavigationSmokeCase): Promise<void> {
  await runFormatContract({
    formatId: format.id,
    containerId: format.containerId,
    galleryTitle: format.title,
    requiresAppRestart: format.requiresAppRestart,
  });
}

/** Prove the locked representative-session policy and any required loaded render. */
export async function proveRepresentativeRequestOutcome(
  format: RepresentativeRequestOutcomeContract,
): Promise<void> {
  if (format.requiresAppRestart) {
    await resetAppState();
  }
  await runRepresentativeRequestOutcomeContract({
    format: format.id,
    platform: isAndroid() ? 'android' : 'ios',
    path: format.path,
    retry: format.retry ?? 'default',
    runtime: {
      navigate: async () => {
        await openFormatStrict(format.id, format.galleryTitle);
        await assertDisplayed(format.containerId);
      },
      backToGallery,
      clearNativeLogs: resetNativeFingerprintWindow,
      reload: async () => tapFormatAction(AppiumTestIds.action.reload(format.id)),
      load: async () => {
        if (!format.actionId) {
          throw new Error(`No Load action configured for ${format.id}`);
        }
        await tapFormatAction(format.actionId);
      },
      observe: uiAttempt =>
        observeRepresentativeRequestOutcome(format.id, format.path, uiAttempt),
    },
    onAccepted: async attempt => {
      if (attempt.classification !== 'loaded') {
        return;
      }
      if (format.renderProof === 'banner') {
        const evidence = await assertRenderedBannerSubtree(
          AppiumTestIds.action.rendered(format.id),
        );
        console.log(
          `[render-proof] ${JSON.stringify({
            format: format.id,
            platform: isAndroid() ? 'android' : 'ios',
            ...evidence,
          })}`,
        );
      }
      if (format.renderProof === 'native') {
        const rectangle = await assertRenderedRectangle(
          AppiumTestIds.action.rendered(format.id),
        );
        console.log(
          `[render-proof] ${JSON.stringify({
            format: format.id,
            platform: isAndroid() ? 'android' : 'ios',
            rectangle,
          })}`,
        );
      }
      if (format.showClose) {
        await assertShowCloseLifecycle(format.id);
      }
    },
  });
}

/** Preserve the example-only NativeRNGMATesting status behavior outside ad-fill contracts. */
export async function proveProbeStatus(opts: {
  formatId: string;
  containerId: string;
  galleryTitle: string;
  actionId: string;
  expectedStatusText: string;
  expectedStatusMarkers: readonly string[];
  expectedPingByPlatform: { android: string; ios: string };
  actionAccessibilityLabel: string;
}): Promise<void> {
  const { expectedStatusMarkers, expectedPingByPlatform, ...contract } = opts;
  await runFormatContract({
    ...contract,
    expectedText: opts.expectedStatusText,
    emitStatusLabel: 'probe-seam',
    expectedTexts: [
      expectedPingByPlatform[isAndroid() ? 'android' : 'ios'],
      ...expectedStatusMarkers,
    ],
  });
}
