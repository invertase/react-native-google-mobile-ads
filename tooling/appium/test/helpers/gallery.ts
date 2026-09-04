import {
  EXAMPLE_ANDROID_PACKAGE,
  EXAMPLE_IOS_BUNDLE_ID,
  GALLERY_HOME_ONLY_FORMATS,
  gallerySectionForFormat,
  type GallerySectionId,
} from '../../src/formats.ts';
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
  const galleryId = AppiumTestIds.gallery;
  await $(
    `android=new UiScrollable(new UiSelector().scrollable(true).resourceId("${galleryId}")).scrollToBeginning(5)`,
  );
}

/** Scroll the gallery list until the target testID is displayed. */
export async function scrollToTestId(testId: string) {
  const el = await findByTestId(testId);
  if (await el.isDisplayed().catch(() => false)) {
    return el;
  }

  if (isAndroid()) {
    const galleryId = AppiumTestIds.gallery;
    const scrollable = `new UiScrollable(new UiSelector().scrollable(true).resourceId("${galleryId}")).setMaxSearchSwipes(30)`;
    for (let attempt = 0; attempt < 35; attempt++) {
      const latest = await findByTestId(testId);
      if (await latest.isDisplayed().catch(() => false)) {
        return latest;
      }
      try {
        await $(`android=${scrollable}.scrollIntoView(new UiSelector().resourceId("${testId}"))`);
      } catch {
        await $(`android=${scrollable}.scrollForward()`);
      }
    }
    const finalEl = await findByTestId(testId);
    await finalEl.waitForDisplayed({ timeout: 15000 });
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

async function androidSwipeUp(percent = 0.4): Promise<void> {
  const { height, width } = await driver.getWindowSize();
  try {
    await driver.execute('mobile: swipeGesture', {
      left: Math.floor(width * 0.2),
      top: Math.floor(height * 0.4),
      width: Math.floor(width * 0.6),
      height: Math.floor(height * 0.35),
      direction: 'up',
      percent,
    });
  } catch {
    // Best-effort.
  }
  await driver.pause(350);
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

  // Repeated lift — single swipe was not enough for low rows (RWI / Flush adjacency).
  for (let lift = 0; lift < 5 && centerY >= safeMax; lift++) {
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
  await driver.pause(250);
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
  await driver.pause(3000);
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
        await driver.pause(300);
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

async function selectGallerySection(section: Exclude<GallerySectionId, 'all'>): Promise<void> {
  await scrollGalleryToTop();
  const chipId = AppiumTestIds.section[section];
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
  await driver.pause(600);
  if (isAndroid()) {
    // Prefer confirming via content-desc • prefix; soft-retry once if missing.
    const chip = await findByTestId(chipId);
    const desc = String(
      (await chip.getAttribute('contentDescription').catch(() => null)) ??
        (await chip.getAttribute('content-desc').catch(() => null)) ??
        '',
    );
    if (!desc.includes('•')) {
      await clickAndroidByTestId(chipId);
      await driver.pause(500);
    }
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
      // Bring title into mid-screen if clipped or near the gesture edge.
      for (let lift = 0; lift < 5 && (size.height <= 8 || centerY < 0 || centerY > height * 0.72); lift++) {
        await androidSwipeUp(0.45);
        rect = await byText.getLocation();
        size = await byText.getSize();
        centerY = rect.y + size.height / 2;
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
      await driver.pause(250);
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
        await driver.pause(300);
        return;
      }
    }
    return;
  }
  const hide = await $('~Hide banner sizes');
  if (await hide.isDisplayed().catch(() => false)) {
    await clickElement(hide);
    await driver.pause(300);
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
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await formatLooksOpen(formatId)) {
      return true;
    }
    await driver.pause(400);
  }
  return formatLooksOpen(formatId);
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
      await driver.pause(300);
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
            await driver.pause(300);
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
      await driver.pause(400);
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

/**
 * Smoke: open format, assert container, optionally tap an action without waiting for ad fill.
 * Live Google auction/fill is out of scope (ANR / flake); UI seam + TestIds wiring is the gate.
 */
export async function smokeFormat(opts: {
  formatId: string;
  containerId: string;
  actionId?: string;
  galleryTitle?: string;
}): Promise<void> {
  if (!GALLERY_HOME_ONLY_FORMATS.has(opts.formatId)) {
    await resetAppState();
  }
  await withInstrumentationRecovery(async () => {
    await openFormat(opts.formatId, opts.galleryTitle);
    await assertDisplayed(opts.containerId);
    if (opts.actionId) {
      const action = await findByTestId(opts.actionId);
      if (await action.isDisplayed().catch(() => false)) {
        await clickElement(action);
      }
    }
    await backToGallery();
  });
}
