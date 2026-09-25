import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  EXAMPLE_ANDROID_PACKAGE,
  EXAMPLE_IOS_BUNDLE_ID,
  gallerySectionForFormat,
  type GallerySectionId,
  type NavigationSmokeCase,
  type RepresentativeRequestOutcomeContract,
  type SdkUtilitySurfaceContract,
} from '../../src/formats.ts';
import {
  androidFocusedForeignApps,
  androidFocusedSystemDialog,
  focusIncludesAndroidForeignApp,
} from '../../src/androidFocus.ts';
import {
  classifyHookLoadOutcome,
  classifyPoolFilledOutcome,
  classifyPoolStructuredUnsupportedGate,
  classifyRequestOutcome,
  hasNonzeroRectangle,
  nativeFingerprintFromAndroidLog,
  requestIdFromText,
  runRepresentativeRequestOutcomeContract,
  type RequestOutcomeClassification,
  type RequestFingerprint,
} from '../../src/requestOutcomes.ts';
import { AppiumTestIds } from '../../src/testIds.ts';

/** Repo root from `tooling/appium/test/helpers/` — no host-absolute checkout paths. */
const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../..',
);

function isAndroid(): boolean {
  return (driver.capabilities.platformName?.toString().toLowerCase() ?? '') === 'android';
}

function appBundleId(): string {
  return isAndroid() ? EXAMPLE_ANDROID_PACKAGE : EXAMPLE_IOS_BUNDLE_ID;
}

function logAndroidHostTrace(
  event: string,
  detail: Record<string, unknown> = {},
): void {
  console.log(
    `[android-host-trace] ${JSON.stringify({
      event,
      platform: 'android',
      ...detail,
    })}`,
  );
}

function androidFocusSnippet(dump: string): string {
  const focus = dump.match(/mCurrentFocus=[^\n]+/)?.[0] ?? 'mCurrentFocus=?';
  const app = dump.match(/mFocusedApp=[^\n]+/)?.[0] ?? 'mFocusedApp=?';
  return `${focus} | ${app}`;
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

  const started = Date.now();
  let handledStall = false;
  for (let i = 0; i < 8; i++) {
    const latest = await findByTestId(testId);
    if (await latest.isDisplayed().catch(() => false)) {
      return latest;
    }
    if (!handledStall && Date.now() - started > 12000) {
      handledStall = true;
      await captureIosStallEvidence(`scrollToTestId:${testId}`);
      await dismissIosBlockingOverlays(`scrollToTestId:${testId}:stall`);
      const after = await findByTestId(testId);
      if (await after.isDisplayed().catch(() => false)) {
        return after;
      }
      throw new Error(
        `scrollToTestId(${testId}): still blocked after stall dismiss (gallery buried under overlay)`,
      );
    }
    await scrollGalleryIos(testId);
  }

  const finalEl = await findByTestId(testId);
  await finalEl.waitForDisplayed({ timeout: 5000 });
  return finalEl;
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

async function clickElement(
  el: WebdriverIO.Element,
  trace?: string,
): Promise<void> {
  await el.waitForDisplayed({ timeout: 10000 });
  if (isAndroid()) {
    const resourceId = String(
      (await el.getAttribute('resource-id').catch(() => null)) ??
        (await el.getAttribute('resourceId').catch(() => '')),
    );
    const description = String(
      (await el.getAttribute('content-desc').catch(() => null)) ??
        (await el.getAttribute('contentDescription').catch(() => '')),
    );
    logAndroidHostTrace('clickElement', {
      trace: trace ?? 'unspecified',
      resourceId,
      description,
      method: resourceId === AppiumTestIds.galleryBack ? 'shell-center' : 'clickGesture',
    });
    if (resourceId === AppiumTestIds.galleryBack) {
      await clickAndroidByTestId(AppiumTestIds.galleryBack);
      return;
    }
    await driver.execute('mobile: clickGesture', { elementId: el.elementId });
    return;
  }
  try {
    await el.click();
  } catch {
    const loc = await el.getLocation().catch(() => null);
    const size = await el.getSize().catch(() => null);
    if (loc && size) {
      await iosTapPoint(loc.x + size.width / 2, loc.y + size.height / 2);
    }
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
  if (isAndroid()) {
    await recoverAndroidTestHost();
  }
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
  await dismissIosBlockingOverlays(`openFormatStrict:${formatId}`);
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
  logAndroidHostTrace('gallery.back.begin');
  const back = await findByTestId(AppiumTestIds.galleryBack);
  if (await back.isDisplayed().catch(() => false)) {
    await clickElement(back, 'backToGallery');
  } else {
    logAndroidHostTrace('gallery.back.fallback', { method: 'driver.back' });
    await driver.back();
  }
  try {
    await driver.waitUntil(async () => isGalleryHome(), {
      timeout: 15000,
      timeoutMsg: 'Gallery home did not restore after back',
    });
  } catch (error) {
    if (!isAndroid()) {
      await captureIosStallEvidence('backToGallery');
      await dismissIosBlockingOverlays('backToGallery:stall');
      if (await isGalleryHome()) {
        return;
      }
    }
    throw error;
  } finally {
    if (isAndroid()) {
      const focus = await androidWindowFocusDump();
      if (focus.includes('com.android.chrome')) {
        logAndroidHostTrace('gallery.back.chrome-after-tap', {
          focus: androidFocusSnippet(focus),
        });
      }
      await recoverAndroidTestHost();
    }
  }
  logAndroidHostTrace('gallery.back.done', { galleryHome: await isGalleryHome() });
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
  const deadline = Date.now() + 10_000;
  let lastRoot = rootRectangle;
  while (Date.now() <= deadline) {
    const root = await findByTestId(testId);
    lastRoot = await root.getSize().catch(() => lastRoot);
    if (!hasNonzeroRectangle(lastRoot)) {
      await sleep(250);
      continue;
    }
    // Prefer direct children first — iOS XCUITest sometimes hides deep WKWebView
    // descendants from a broad `.//*` walk while the native ad host is already sized.
    const candidates = [
      ...(await root.$$('*').catch(() => [])),
      ...(await root.$$('.//*').catch(() => [])),
    ];
    for (const descendant of candidates) {
      if (!(await descendant.isDisplayed().catch(() => false))) {
        continue;
      }
      const size = await descendant.getSize().catch(() => ({ width: 0, height: 0 }));
      if (hasNonzeroRectangle(size)) {
        const descendantType = await descendant
          .getAttribute(isAndroid() ? 'className' : 'type')
          .catch(() => 'unknown');
        return {
          root: lastRoot,
          descendant: size,
          descendantType: String(descendantType || 'unknown'),
        };
      }
    }
    await sleep(250);
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
          const focus = await androidWindowFocusDump();
          if (focus.includes('com.android.chrome')) {
            await recoverAndroidTestHost('waitForTestIdTextContaining');
          }
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

async function readPoolLoadedMarkerText(formatId: string): Promise<string> {
  const el = await findByTestId(AppiumTestIds.action.loaded(formatId));
  if (!(await el.isExisting().catch(() => false))) {
    return '';
  }
  return elementText(el);
}

/** AdPoolProvider registers pools asynchronously; polling while `poolStatus=absent` is a no-op. */
async function waitForPoolRegistryReady(formatId: string, timeoutMs = 45000): Promise<void> {
  await driver.waitUntil(
    async () => {
      const text = await readPoolLoadedMarkerText(formatId);
      if (!text) {
        return false;
      }
      if (/\bpoolStatus=absent\b/.test(text)) {
        return false;
      }
      return /\bpoolStatus=(creating|ready|ready-degraded|error)\b/.test(text);
    },
    {
      timeout: timeoutMs,
      interval: 250,
      timeoutMsg: `Pool registry for ${formatId} stayed absent (provider never registered)`,
    },
  );
}

function poolPollActionId(formatId: string): string {
  if (formatId === AppiumTestIds.format.poolInterstitialImperative) {
    return AppiumTestIds.action.reload(formatId);
  }
  return AppiumTestIds.action.load(formatId);
}

async function observePoolFilledOutcome(
  formatId: string,
  attempt: number,
  timeoutMs = 120000,
): Promise<{
  requestId: number;
  classification: RequestOutcomeClassification;
  detail: string;
  fingerprint: RequestFingerprint;
}> {
  const testId = AppiumTestIds.action.loaded(formatId);
  const pollActionId = poolPollActionId(formatId);
  let lastSeen = '';
  const marker = await findByTestId(testId);
  if (!(await marker.isExisting())) {
    throw new Error(`[pool-outcome] ${formatId}: required marker ${testId} is missing`);
  }
  let pollsWhileIdle = 0;
  try {
    await driver.waitUntil(
      async () => {
        const el = await findByTestId(testId);
        if (!(await el.isExisting())) {
          throw new Error(`[pool-outcome] ${formatId}: marker ${testId} disappeared`);
        }
        lastSeen = await elementText(el);
        if (classifyPoolFilledOutcome(lastSeen) !== undefined) {
          return true;
        }
        if (/\bpooledStatus=(idle|empty)\b/.test(lastSeen)) {
          pollsWhileIdle += 1;
          const shouldRepoll =
            /\bpooledStatus=idle\b/.test(lastSeen) ||
            (/\bpooledStatus=empty\b/.test(lastSeen) && /\bavailable=true\b/.test(lastSeen));
          if (shouldRepoll && pollsWhileIdle % 5 === 0) {
            await tapFormatAction(pollActionId);
          }
        }
        return false;
      },
      {
        timeout: timeoutMs,
        interval: 500,
        timeoutMsg: `testID ${testId} did not report terminal pooled fill attempt ${attempt} (lastSeen=${JSON.stringify(lastSeen)})`,
      },
    );
    const classification = classifyPoolFilledOutcome(lastSeen);
    if (!classification) {
      throw new Error(`[pool-outcome] ${formatId}: wait completed without a terminal pooled fill outcome`);
    }
    return {
      requestId: attempt,
      classification,
      detail: lastSeen,
      fingerprint: { status: 'not-applicable', evidence: 'pool-status-marker' },
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

async function observePoolStructuredUnsupportedGate(
  formatId: string,
  gate: 'peek' | 'rwi-preload',
  attempt: number,
  timeoutMs = 120000,
): Promise<{
  requestId: number;
  classification: RequestOutcomeClassification;
  detail: string;
  fingerprint: RequestFingerprint;
}> {
  const testId = AppiumTestIds.action.loaded(formatId);
  let lastSeen = '';
  await driver.waitUntil(
    async () => {
      const el = await findByTestId(testId);
      lastSeen = await elementText(el);
      return classifyPoolStructuredUnsupportedGate(lastSeen, gate) !== undefined;
    },
    {
      timeout: timeoutMs,
      timeoutMsg: `testID ${testId} did not report terminal structured gate attempt ${attempt} (lastSeen=${JSON.stringify(lastSeen)})`,
    },
  );
  const classification = classifyPoolStructuredUnsupportedGate(lastSeen, gate);
  if (!classification) {
    throw new Error(`[pool-gate] ${formatId}: wait completed without a terminal structured gate outcome`);
  }
  return {
    requestId: attempt,
    classification,
    detail: lastSeen,
    fingerprint: { status: 'not-applicable', evidence: `pool-gate-${gate}` },
  };
}

async function observeHookLoadOutcome(
  formatId: string,
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
    throw new Error(`[hook-lifecycle] ${formatId}: required marker ${testId} is missing`);
  }
  try {
    await driver.waitUntil(
      async () => {
        const el = await findByTestId(testId);
        if (!(await el.isExisting())) {
          throw new Error(`[hook-lifecycle] ${formatId}: marker ${testId} disappeared`);
        }
        lastSeen = await elementText(el);
        return classifyHookLoadOutcome(lastSeen) !== undefined;
      },
      {
        timeout: timeoutMs,
        timeoutMsg: `testID ${testId} did not report terminal hook load attempt ${attempt} (lastSeen=${JSON.stringify(lastSeen)})`,
      },
    );
    const classification = classifyHookLoadOutcome(lastSeen);
    if (!classification) {
      throw new Error(`[hook-lifecycle] ${formatId}: wait completed without a terminal hook load outcome`);
    }
    return {
      requestId: attempt,
      classification,
      detail: lastSeen,
      fingerprint: { status: 'not-applicable', evidence: 'hook-status-marker' },
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
const HOOK_LIFECYCLE_SHOWING = 'status=showing';
const HOOK_LIFECYCLE_CLOSED = 'status=closed';
const UTILITY_LIFECYCLE_OPENED = 'Utility lifecycle: opened';
const UTILITY_LIFECYCLE_CLOSED = 'Utility lifecycle: closed';

/** Classic GMA + Next-Gen mobile SDK fullscreen AdActivity package markers. */
const ANDROID_AD_ACTIVITY_MARKERS = [
  'com.google.android.gms.ads.AdActivity',
  'com.google.android.libraries.ads.mobile.sdk.common.AdActivity',
] as const;

function focusIncludesAndroidAdActivity(focus: string): boolean {
  return ANDROID_AD_ACTIVITY_MARKERS.some(marker => focus.includes(marker));
}

function invalidateAndroidWindowFocusDump(): void {
  cachedAndroidWindowFocusDump = { at: 0, value: '' };
}

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

async function tapAndroidShellFraction(fx: number, fy: number): Promise<void> {
  const { width, height } = await driver.getWindowRect();
  await driver.execute('mobile: shell', {
    command: 'input',
    args: ['tap', String(Math.floor(width * fx)), String(Math.floor(height * fy))],
  });
}

async function tapAndroidShellPoint(x: number, y: number): Promise<void> {
  await driver.execute('mobile: shell', {
    command: 'input',
    args: ['tap', String(Math.floor(x)), String(Math.floor(y))],
  });
}

let cachedAndroidWindowFocusDump = { at: 0, value: '' };
/** When true, skip top-right blind taps unless Close/end-card is visible (Rewarded). */
let androidSkipBlindCloseFallback = false;

async function androidWindowFocusDump(): Promise<string> {
  const now = Date.now();
  if (now - cachedAndroidWindowFocusDump.at < 350) {
    return cachedAndroidWindowFocusDump.value;
  }
  const value = String(
    await driver.execute('mobile: shell', {
      command: 'dumpsys',
      args: ['window', 'displays'],
    }),
  );
  cachedAndroidWindowFocusDump = { at: now, value };
  return value;
}

async function dismissChromeFirstRunIfPresent(): Promise<boolean> {
  const focus = await androidWindowFocusDump();
  if (!androidFocusedForeignApps(focus).includes('com.android.chrome')) {
    return false;
  }
  for (const fragment of [
    'textContains("Use without an account")',
    'text("Use without an account")',
    'textContains("No thanks")',
    'textContains("Accept & continue")',
  ]) {
    if (await tapAndroidSelectorIfDisplayed(`android=new UiSelector().${fragment}`)) {
      await sleep(600);
      return true;
    }
  }
  const { width, height } = await driver.getWindowRect();
  await driver.execute('mobile: clickGesture', {
    x: Math.floor(width * 0.5),
    y: Math.floor(height * 0.9),
  });
  await sleep(600);
  return true;
}

/**
 * Android immersive-mode coachmark ("Viewing full screen" / "Got it") over AdActivity.
 * System education overlay — not ad chrome. Prefer text selectors; uiautomator dump often fails.
 * Never HOME to clear it. Must not throw when the overlay is absent (WDIO `$` can throw).
 */
async function dismissAndroidImmersiveModeEducationIfPresent(): Promise<boolean> {
  if (!isAndroid()) {
    return false;
  }
  let hasViewing = false;
  try {
    const viewingEls = await $$('android=new UiSelector().textContains("Viewing full screen")');
    for (const el of viewingEls) {
      if (await el.isDisplayed().catch(() => false)) {
        hasViewing = true;
        break;
      }
    }
  } catch {
    hasViewing = false;
  }
  let hasGotIt = false;
  try {
    for (const selector of [
      'android=new UiSelector().text("Got it")',
      'android=new UiSelector().textContains("Got it")',
    ]) {
      const els = await $$(selector);
      for (const el of els) {
        if (await el.isDisplayed().catch(() => false)) {
          hasGotIt = true;
          break;
        }
      }
      if (hasGotIt) {
        break;
      }
    }
  } catch {
    hasGotIt = false;
  }
  if (!hasViewing && !hasGotIt) {
    return false;
  }
  for (const fragment of ['text("Got it")', 'textContains("Got it")']) {
    if (await tapAndroidSelectorIfDisplayed(`android=new UiSelector().${fragment}`)) {
      logAndroidHostTrace('immersiveEducation.dismissed', {
        via: fragment,
        viewing: hasViewing,
      });
      await sleep(400);
      return true;
    }
  }
  if (hasViewing) {
    logAndroidHostTrace('immersiveEducation.visible-no-tap', { viewing: true });
  }
  return false;
}

async function isAndroidExampleAppForeground(): Promise<boolean> {
  const focus = await androidWindowFocusDump();
  return focus.includes(EXAMPLE_ANDROID_PACKAGE);
}

/** One-shot relaunch when utility dismiss left the launcher focused — not for tight poll loops. */
async function bringExampleAppForwardOnceIfNeeded(reason: string): Promise<void> {
  if (await isAndroidAdActivityForeground()) {
    return;
  }
  if (await isAndroidExampleAppForeground()) {
    return;
  }
  logAndroidHostTrace('utility.bringAppForwardOnce', {
    reason,
    focus: androidFocusSnippet(await androidWindowFocusDump()),
  });
  await driver.activateApp(EXAMPLE_ANDROID_PACKAGE);
  await sleep(600);
}

/** Force-stop Chrome / Play Store diversion, then bring the example app forward. */
async function recoverAndroidForeignAppIfPresent(reason: string): Promise<boolean> {
  if (!isAndroid()) {
    return false;
  }
  invalidateAndroidWindowFocusDump();
  const focus = await androidWindowFocusDump();
  const foreign = androidFocusedForeignApps(focus);
  if (foreign.length === 0) {
    return false;
  }
  logAndroidHostTrace('recover.foreign', {
    reason,
    focus: androidFocusSnippet(focus),
  });
  if (foreign.includes('com.android.chrome')) {
    await driver.execute('mobile: shell', {
      command: 'am',
      args: ['force-stop', 'com.android.chrome'],
    });
  }
  if (foreign.includes('com.android.vending') || foreign.includes('com.google.android.finsky')) {
    await driver.execute('mobile: shell', {
      command: 'am',
      args: ['force-stop', 'com.android.vending'],
    });
  }
  await sleep(400);
  invalidateAndroidWindowFocusDump();
  await driver.activateApp(EXAMPLE_ANDROID_PACKAGE);
  await sleep(600);
  invalidateAndroidWindowFocusDump();
  return true;
}

/** Answer a focused system ANR ("Wait") or crash ("Close app") dialog; true when one was focused. */
async function dismissAndroidSystemDialogIfPresent(reason: string): Promise<boolean> {
  const focus = await androidWindowFocusDump();
  const dialog = androidFocusedSystemDialog(focus);
  if (!dialog) {
    return false;
  }
  logAndroidHostTrace('recover.systemDialog', {
    reason,
    dialog,
    focus: androidFocusSnippet(focus),
  });
  const fragments =
    dialog === 'anr'
      ? ['resourceId("android:id/aerr_wait")', 'text("Wait")']
      : ['resourceId("android:id/aerr_close")', 'text("Close app")'];
  for (const fragment of fragments) {
    if (await tapAndroidSelectorIfDisplayed(`android=new UiSelector().${fragment}`)) {
      break;
    }
  }
  await sleep(dialog === 'anr' ? 2000 : 600);
  invalidateAndroidWindowFocusDump();
  return true;
}

async function recoverAndroidTestHost(reason = 'unspecified'): Promise<void> {
  if (!isAndroid()) {
    return;
  }
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await dismissChromeFirstRunIfPresent();
    await dismissAndroidImmersiveModeEducationIfPresent();
    if (await recoverAndroidForeignAppIfPresent(`${reason}.foreign`)) {
      continue;
    }
    if (await dismissAndroidSystemDialogIfPresent(`${reason}.systemDialog`)) {
      continue;
    }
    const focus = await androidWindowFocusDump();
    if (focusIncludesAndroidAdActivity(focus)) {
      return;
    }
    if (focus.includes(EXAMPLE_ANDROID_PACKAGE)) {
      return;
    }
    logAndroidHostTrace('recover.host', {
      reason,
      attempt,
      focus: androidFocusSnippet(focus),
    });
    await driver.activateApp(EXAMPLE_ANDROID_PACKAGE);
    await sleep(600);
    invalidateAndroidWindowFocusDump();
  }
}

async function ensureExampleAppInForeground(): Promise<void> {
  await recoverAndroidTestHost();
}

async function showLifecycleText(formatId: string): Promise<string> {
  return elementText(await findByTestId(AppiumTestIds.action.lifecycle(formatId)));
}

async function safeShowLifecycleText(formatId: string): Promise<string> {
  const el = await findByTestId(AppiumTestIds.action.lifecycle(formatId));
  if (!(await el.isExisting().catch(() => false))) {
    return '';
  }
  return elementText(el);
}

async function tapAndroidSelectorIfDisplayed(selector: string): Promise<boolean> {
  const el = await $(selector);
  if (
    (await el.isExisting().catch(() => false)) &&
    (await el.isDisplayed().catch(() => false))
  ) {
    await el.click();
    await sleep(400);
    return true;
  }
  return false;
}

/** Feed / app-open chrome only — never coordinate-fallback (avoids Install / creative taps). */
async function tapAndroidContinueToAppIfPresent(): Promise<boolean> {
  for (const fragment of [
    'textContains("Continue to app")',
    'descriptionContains("Continue to app")',
  ]) {
    if (await tapAndroidSelectorIfDisplayed(`android=new UiSelector().${fragment}`)) {
      return true;
    }
  }
  return false;
}

async function isAndroidAppOpenFeedChromeVisible(): Promise<boolean> {
  const testAd = await $('android=new UiSelector().text("Test Ad")');
  if (!(await testAd.isDisplayed().catch(() => false))) {
    return false;
  }
  for (const needle of [
    'test interstitial',
    'interstitial test ad',
    'This is an interstitial test ad',
    'Reward granted',
    'test rewarded',
    'rewarded test ad',
  ]) {
    const el = await $(`android=new UiSelector().textContains("${needle}")`);
    if (await el.isDisplayed().catch(() => false)) {
      return false;
    }
  }
  if (await isAndroidInterstitialCloseChromeVisible()) {
    return false;
  }
  if (await isAndroidAdActivityForeground()) {
    return false;
  }
  // App-open feed only — not advertiser names (e.g. Microsoft) on interstitial AdActivity.
  for (const needle of ['Continue to app', 'Feed Test', 'App Open']) {
    const el = await $(`android=new UiSelector().textContains("${needle}")`);
    if (await el.isDisplayed().catch(() => false)) {
      return true;
    }
  }
  return false;
}

/** App-open feed "Continue to app" is often WebView-only; header-band tap avoids Install CTA. */
async function tapAndroidAppOpenContinueChrome(): Promise<boolean> {
  if (await tapAndroidContinueToAppIfPresent()) {
    return true;
  }
  if (!(await isAndroidAppOpenFeedChromeVisible())) {
    return false;
  }
  const { width, height } = await driver.getWindowRect();
  const headerBand: Array<[number, number]> = [
    [0.93, 0.075],
    [0.9, 0.075],
    [0.87, 0.085],
  ];
  for (const [fx, fy] of headerBand) {
    const x = Math.floor(width * fx);
    const y = Math.floor(height * fy);
    await driver.execute('mobile: clickGesture', { x, y });
    await sleep(450);
    if (!(await isAndroidAppOpenFeedChromeVisible())) {
      return true;
    }
  }
  return true;
}

async function dismissAndroidAppOpenFeedIfPresent(): Promise<void> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (!(await isAndroidAppOpenFeedChromeVisible())) {
      return;
    }
    await tapAndroidAppOpenContinueChrome();
    await sleep(400);
  }
}

async function isAndroidAdInspectorVisible(): Promise<boolean> {
  if (!(await isAndroidAdActivityForeground())) {
    return false;
  }
  try {
    const els = await $$('android=new UiSelector().textContains("Ad Inspector")');
    const limit = Math.min(els.length, 3);
    for (let index = 0; index < limit; index += 1) {
      if (await els[index]!.isDisplayed().catch(() => false)) {
        return true;
      }
    }
  } catch {
    return false;
  }
  return false;
}

async function dismissAndroidAdInspectorIfPresent(): Promise<void> {
  if (!(await isAndroidAdActivityForeground())) {
    return;
  }
  let attempts = 0;
  logAndroidHostTrace('adInspector.dismiss.begin', {
    adActivity: await isAndroidAdActivityForeground(),
    visible: await isAndroidAdInspectorVisible(),
  });
  await dismissAndroidImmersiveModeEducationIfPresent();
  await driver.waitUntil(
    async () => {
      if (!(await isAndroidAdActivityForeground())) {
        logAndroidHostTrace('adInspector.dismiss.success', { attempts });
        return true;
      }
      attempts += 1;
      await dismissAndroidImmersiveModeEducationIfPresent();
      for (const fragment of [
        'descriptionContains("Close Ad Inspector")',
        'descriptionContains("Close ad inspector")',
        'descriptionContains("Navigate up")',
        'descriptionContains("Close")',
      ]) {
        await tapAndroidSelectorIfDisplayed(`android=new UiSelector().${fragment}`);
      }
      await tapAndroidInterstitialCloseAttempt();
      if (attempts >= 4 && attempts % 2 === 0) {
        try {
          await driver.back();
        } catch {
          await driver.execute('mobile: shell', {
            command: 'input',
            args: ['keyevent', '4'],
          });
        }
      }
      await sleep(450);
      return false;
    },
    {
      timeout: 45000,
      interval: 400,
      timeoutMsg: 'Ad Inspector did not dismiss from AdActivity',
    },
  );
}

async function isAndroidAdActivityForeground(): Promise<boolean> {
  const focus = await androidWindowFocusDump();
  if (!focusIncludesAndroidAdActivity(focus)) {
    return false;
  }
  return (
    focus.includes('mFocusedApp=ActivityRecord') ||
    focus.includes('mCurrentFocus=Window')
  );
}

/** Fullscreen GMA surface in AdActivity (excludes app-open feed chrome). */
async function isAndroidFullscreenAdShowing(): Promise<boolean> {
  if (!(await isAndroidAdActivityForeground())) {
    return false;
  }
  if (await isAndroidAppOpenFeedChromeVisible()) {
    return false;
  }
  return true;
}

async function isAndroidFullscreenTestAdObstructing(): Promise<boolean> {
  if (await isAndroidFullscreenAdShowing()) {
    return true;
  }
  for (const needle of [
    'test interstitial',
    'interstitial test ad',
    'This is an interstitial test ad',
    'Google Ad Manager',
    "You're displaying a test interstitial",
    'Reward granted',
    'test rewarded',
    'rewarded test ad',
    'Nice job',
  ]) {
    const el = await $(`android=new UiSelector().textContains("${needle}")`);
    if (await el.isDisplayed().catch(() => false)) {
      return true;
    }
  }
  if (await isAndroidInterstitialCloseChromeVisible()) {
    return true;
  }
  return false;
}

async function isAndroidInterstitialCloseChromeVisible(): Promise<boolean> {
  for (const fragment of [
    'descriptionContains("Interstitial close button")',
    'descriptionContains("Close ad")',
    'descriptionContains("Interstitial close")',
    'descriptionContains("Close Advertisement")',
    'descriptionContains("Close")',
    'text("Close")',
    'textContains("Close ad")',
  ]) {
    const el = await $(`android=new UiSelector().${fragment}`);
    if (await el.isDisplayed().catch(() => false)) {
      return true;
    }
  }
  return false;
}

/** Rewarded end-card / grant copy — safe signal that Close chrome may be actionable. */
async function isAndroidRewardedEndCardVisible(): Promise<boolean> {
  for (const needle of [
    'Reward granted',
    'test rewarded',
    'rewarded test ad',
    'Nice job',
    'You earned',
    'Video has finished',
    'Advertisement',
  ]) {
    const el = await $(`android=new UiSelector().textContains("${needle}")`);
    if (await el.isDisplayed().catch(() => false)) {
      return true;
    }
  }
  return false;
}

function isAndroidRewardedFormat(formatId: string): boolean {
  return (
    formatId === AppiumTestIds.format.rewardedHook ||
    formatId === AppiumTestIds.format.rewardedInterstitialHook ||
    formatId === AppiumTestIds.format.rewarded ||
    formatId === AppiumTestIds.format.rewardedInterstitial
  );
}

/**
 * Wait until rewarded Close is present or an end-card marker appears.
 * Blind top-right taps during the creative open Play Store on nextgen Play AVDs.
 * After the mandatory watch (reward / long AdActivity), allow guarded dismiss even when
 * WebView creatives hide Close from UiAutomator (run-06: AdActivity stuck, no chrome).
 */
async function waitForAndroidRewardedDismissReady(formatId: string): Promise<void> {
  const started = Date.now();
  await driver.waitUntil(
    async () => {
      await dismissAndroidImmersiveModeEducationIfPresent();
      await recoverAndroidForeignAppIfPresent('rewardedDismissReady');
      if (await isAndroidRewardedEndCardVisible()) {
        return true;
      }
      if (await isAndroidInterstitialCloseChromeVisible()) {
        // Even when Close exists early, give a short mandatory-watch window.
        return Date.now() - started >= 8000;
      }
      const phase = await safeShowLifecycleText(formatId);
      // Reward earned / lifecycle reward text ⇒ Close is usually actionable.
      if (/reward/i.test(phase) && Date.now() - started >= 10000) {
        logAndroidHostTrace('rewardedDismissReady.lifecycle', { phase });
        return true;
      }
      // Long AdActivity with no discoverable chrome — still better than Play Store taps mid-roll.
      if (Date.now() - started >= 25000 && (await isAndroidAdActivityForeground())) {
        logAndroidHostTrace('rewardedDismissReady.adActivityElapsed', {
          ms: Date.now() - started,
        });
        return true;
      }
      return false;
    },
    {
      timeout: 120000,
      interval: 750,
      timeoutMsg: 'Android rewarded dismiss never became actionable (Close / end card)',
    },
  );
}

async function withAndroidRewardedDismissGuard<T>(
  formatId: string,
  fn: () => Promise<T>,
): Promise<T> {
  androidSkipBlindCloseFallback = true;
  try {
    await waitForAndroidRewardedDismissReady(formatId);
    return await fn();
  } finally {
    androidSkipBlindCloseFallback = false;
  }
}

async function tapAndroidInterstitialCloseAttempt(): Promise<void> {
  await dismissAndroidImmersiveModeEducationIfPresent();
  if (await recoverAndroidForeignAppIfPresent('closeAttempt')) {
    return;
  }
  if (await isAndroidAppOpenFeedChromeVisible()) {
    await dismissAndroidAppOpenFeedIfPresent();
    return;
  }
  for (const fragment of [
    'descriptionContains("Interstitial close button")',
    'resourceId("com.google.android.gms.ads:id/close_button")',
    'resourceId("com.google.android.gms.ads:id/dismiss")',
    'descriptionContains("Close ad")',
    'descriptionContains("Interstitial close")',
  ]) {
    const el = await $(`android=new UiSelector().${fragment}`);
    if (!(await el.isExisting().catch(() => false))) {
      continue;
    }
    if (!(await el.isDisplayed().catch(() => false))) {
      continue;
    }
    try {
      await el.click();
    } catch {
      const rect = await el.getLocation();
      const size = await el.getSize();
      await driver.execute('mobile: clickGesture', {
        x: Math.floor(rect.x + size.width / 2),
        y: Math.floor(rect.y + size.height / 2),
      });
    }
    await sleep(300);
    invalidateAndroidWindowFocusDump();
    return;
  }
  // Blind top-right fallback — required for interstitial / app-open when Close
  // chrome is late. Rewarded sets androidSkipBlindCloseFallback until Close /
  // end-card is visible so we do not open Play Store mid-creative.
  if (
    androidSkipBlindCloseFallback &&
    !(await isAndroidInterstitialCloseChromeVisible()) &&
    !(await isAndroidRewardedEndCardVisible())
  ) {
    return;
  }
  const { width, height } = await driver.getWindowRect();
  const minX = width * 0.75;
  const maxY = height * 0.12;
  const clickables = await $$('android=new UiSelector().clickable(true)');
  for (const control of clickables) {
    if (!(await control.isDisplayed().catch(() => false))) {
      continue;
    }
    const rect = await control.getLocation();
    const size = await control.getSize();
    const centerX = rect.x + size.width / 2;
    const centerY = rect.y + size.height / 2;
    if (
      centerX >= minX &&
      centerY <= maxY &&
      size.width <= 180 &&
      size.height <= 180
    ) {
      try {
        await control.click();
      } catch {
        await driver.execute('mobile: clickGesture', { x: centerX, y: centerY });
      }
      await sleep(300);
      invalidateAndroidWindowFocusDump();
      return;
    }
  }
  for (const [fx, fy] of [
    [0.97, 0.038],
    [0.95, 0.055],
    [0.93, 0.072],
  ] as Array<[number, number]>) {
    await driver.execute('mobile: clickGesture', {
      x: Math.floor(width * fx),
      y: Math.floor(height * fy),
    });
    await sleep(300);
  }
  invalidateAndroidWindowFocusDump();
}

async function isAndroidDebugModePickerVisible(): Promise<boolean> {
  const el = await $('android=new UiSelector().textContains("Select a debug mode")');
  return (
    (await el.isExisting().catch(() => false)) &&
    (await el.isDisplayed().catch(() => false))
  );
}

/** Debug Menu picker dismiss often skips AppState inactive; HOME + relaunch satisfies the example contract. */
async function nudgeAndroidAppStateForUtilityClose(): Promise<void> {
  await driver.execute('mobile: shell', {
    command: 'input',
    args: ['keyevent', '3'],
  });
  await sleep(500);
  await driver.activateApp(EXAMPLE_ANDROID_PACKAGE);
  await sleep(600);
  await ensureExampleAppInForeground();
}

/** Debug Menu opens a modal picker; dismiss the scrim (not the list) before backing out of SDK UI. */
async function dismissAndroidDebugModePickerIfPresent(): Promise<void> {
  if (!(await isAndroidDebugModePickerVisible())) {
    return;
  }
  await driver.execute('mobile: shell', {
    command: 'input',
    args: ['keyevent', '4'],
  });
  await sleep(450);
  if (!(await isAndroidDebugModePickerVisible())) {
    return;
  }
  const { width, height } = await driver.getWindowRect();
  const outsideTaps: Array<[number, number]> = [
    [width / 2, Math.floor(height * 0.28)],
    [width / 2, Math.floor(height * 0.84)],
    [Math.floor(width * 0.08), Math.floor(height * 0.28)],
    [Math.floor(width * 0.92), Math.floor(height * 0.28)],
  ];
  for (const [x, y] of outsideTaps) {
    await driver.execute('mobile: clickGesture', { x: Math.floor(x), y: Math.floor(y) });
    await sleep(400);
    if (!(await isAndroidDebugModePickerVisible())) {
      return;
    }
  }
}

async function utilityLifecycleText(formatId: string): Promise<string> {
  return elementText(await findByTestId(AppiumTestIds.action.lifecycle(formatId)));
}

/**
 * Interstitial / Ad Inspector close — retry top-right chrome only while test ad copy is visible.
 */
async function tapAndroidFullscreenCloseWithRetries(): Promise<void> {
  await dismissAndroidImmersiveModeEducationIfPresent();
  await recoverAndroidForeignAppIfPresent('dismiss.begin');
  if (!(await isAndroidAdActivityForeground())) {
    await ensureExampleAppInForeground();
  }
  if (
    !(await isAndroidFullscreenAdShowing()) &&
    !(await isAndroidAdActivityForeground()) &&
    !(await isAndroidAppOpenFeedChromeVisible()) &&
    !(await isAndroidFullscreenTestAdObstructing())
  ) {
    return;
  }
  let attempts = 0;
  logAndroidHostTrace('interstitial.dismiss.begin', {
    adActivity: await isAndroidAdActivityForeground(),
    feedChrome: await isAndroidAppOpenFeedChromeVisible(),
  });
  await driver.waitUntil(
    async () => {
      await dismissAndroidImmersiveModeEducationIfPresent();
      if (await recoverAndroidForeignAppIfPresent('dismiss.loop')) {
        // Play Store / Chrome diversion is not a successful dismiss.
        return false;
      }
      const adActivity = await isAndroidAdActivityForeground();
      const obstructing = await isAndroidFullscreenTestAdObstructing();
      if (!adActivity && !obstructing) {
        invalidateAndroidWindowFocusDump();
        const focus = await androidWindowFocusDump();
        if (focusIncludesAndroidForeignApp(focus)) {
          await recoverAndroidForeignAppIfPresent('dismiss.falseSuccess');
          return false;
        }
        logAndroidHostTrace('interstitial.dismiss.success', { attempts });
        return true;
      }
      attempts += 1;
      await tapAndroidInterstitialCloseAttempt();
      return false;
    },
    {
      timeout: 90000,
      interval: 400,
      timeoutMsg: 'Fullscreen AdActivity did not dismiss within 90s',
    },
  );
}

async function dismissAndroidUtilitySurface(formatId: string): Promise<void> {
  await dismissAndroidImmersiveModeEducationIfPresent();
  if (formatId === AppiumTestIds.format.adInspector) {
    await dismissAndroidAdInspectorIfPresent();
    await bringExampleAppForwardOnceIfNeeded('dismissAndroidUtilitySurface.adInspector');
    return;
  }
  await ensureExampleAppInForeground();
  if (formatId === AppiumTestIds.format.debugMenu) {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      await dismissAndroidDebugModePickerIfPresent();
      if (!(await isAndroidDebugModePickerVisible())) {
        break;
      }
      await sleep(300);
    }
    if (!(await utilityLifecycleText(formatId)).includes(UTILITY_LIFECYCLE_CLOSED)) {
      await nudgeAndroidAppStateForUtilityClose();
    }
    return;
  }
  await tapAndroidFullscreenCloseWithRetries();
}

/** App Open Show can reach opened and closed while the feed chrome is still visible — observe opened first. */
async function runAndroidAppOpenShowCloseLifecycle(formatId: string): Promise<void> {
  await dismissAndroidImmersiveModeEducationIfPresent();
  await tapFormatAction(AppiumTestIds.action.show(formatId));
  await driver.waitUntil(
    async () => {
      await dismissAndroidImmersiveModeEducationIfPresent();
      const phase = await safeShowLifecycleText(formatId);
      if (phase.includes(SHOW_LIFECYCLE_OPENED) || phase.includes(SHOW_LIFECYCLE_CLOSED)) {
        return true;
      }
      if (await isAndroidAppOpenFeedChromeVisible()) {
        await dismissAndroidAppOpenFeedIfPresent();
        return false;
      }
      if (await isAndroidFullscreenAdShowing()) {
        await tapAndroidInterstitialCloseAttempt();
        return false;
      }
      return false;
    },
    {
      timeout: 90000,
      interval: 200,
      timeoutMsg:
        'App Open Show never reached opened/closed after dismissing feed chrome',
    },
  );
  await ensureExampleAppInForeground();
  await dismissAndroidAppOpenFeedIfPresent();
  if (!(await safeShowLifecycleText(formatId)).includes(SHOW_LIFECYCLE_CLOSED)) {
    await dismissFullscreenAdWithoutCreativeTap();
  }
  await waitForTestIdTextContaining(
    AppiumTestIds.action.lifecycle(formatId),
    SHOW_LIFECYCLE_CLOSED,
    90000,
  );
}

/** RN Android `Button` ignores touches while `disabled`; wait after filled markers update. */
async function waitForAndroidShowActionEnabled(formatId: string, timeoutMs = 15000): Promise<void> {
  const showActionId = AppiumTestIds.action.show(formatId);
  await driver.waitUntil(
    async () => {
      const el = await $(`android=new UiSelector().resourceId("${showActionId}").enabled(true)`);
      if (!(await el.isExisting().catch(() => false))) {
        return false;
      }
      const enabled = await el.getAttribute('enabled').catch(() => 'false');
      return enabled === 'true' || enabled === true;
    },
    {
      timeout: timeoutMs,
      interval: 100,
      timeoutMsg: `Show action ${showActionId} never became enabled`,
    },
  );
}

/** Fullscreen interstitial / GAM show-close while RN lifecycle nodes may be off-tree. */
async function runAndroidFullscreenShowCloseLifecycle(formatId: string): Promise<void> {
  await dismissAndroidImmersiveModeEducationIfPresent();
  const showActionId = AppiumTestIds.action.show(formatId);
  const probesPerTap = 10;
  const probeIntervalMs = 400;
  const maxTaps = 4;
  let lastProbe = { tap: 0, probe: 0, phase: '', adActivity: false, testAd: false };

  const openedAfterProbe = async (
    tap: number,
    probe: number,
  ): Promise<boolean> => {
    await dismissAndroidImmersiveModeEducationIfPresent();
    const phase = await safeShowLifecycleText(formatId);
    const adActivity = probe % 2 === 0 ? await isAndroidAdActivityForeground() : false;
    const testAd =
      adActivity || (probe % 4 === 0 ? await isAndroidFullscreenTestAdObstructing() : false);
    lastProbe = { tap, probe, phase, adActivity, testAd };
    const opened =
      phase.includes(SHOW_LIFECYCLE_OPENED) || adActivity || testAd;
    console.log(
      `[show-close-probe] ${JSON.stringify({
        format: formatId,
        tap,
        probe,
        phase,
        adActivity,
        testAd,
        opened,
      })}`,
    );
    return opened;
  };

  let opened = false;
  for (let tap = 1; tap <= maxTaps && !opened; tap += 1) {
    console.log(`[show-close-tap] ${JSON.stringify({ format: formatId, tap })}`);
    await waitForAndroidShowActionEnabled(formatId, 8000);
    await tapFormatAction(showActionId);
    for (let probe = 1; probe <= probesPerTap; probe += 1) {
      if (await openedAfterProbe(tap, probe)) {
        opened = true;
        break;
      }
      if (probe < probesPerTap) {
        await sleep(probeIntervalMs);
      }
    }
  }
  if (!opened) {
    throw new Error(
      `[show-close-fail] ${formatId}: no opened lifecycle or fullscreen chrome after ${maxTaps} show tap(s); lastProbe=${JSON.stringify(lastProbe)}`,
    );
  }
  const finishClosedWait = async (): Promise<void> => {
    await driver.waitUntil(
      async () => {
        await dismissAndroidImmersiveModeEducationIfPresent();
        if (await recoverAndroidForeignAppIfPresent('showClose.waitClosed')) {
          return false;
        }
        if (
          (await isAndroidFullscreenAdShowing()) ||
          (await isAndroidAdActivityForeground()) ||
          (await isAndroidFullscreenTestAdObstructing()) ||
          (await isAndroidInterstitialCloseChromeVisible())
        ) {
          await tapAndroidInterstitialCloseAttempt();
          return false;
        }
        const phase = await safeShowLifecycleText(formatId);
        return phase.includes(SHOW_LIFECYCLE_CLOSED);
      },
      {
        timeout: isAndroidRewardedFormat(formatId) ? 120000 : 90000,
        interval: 400,
        timeoutMsg: 'Fullscreen Show never reached Show lifecycle: closed after dismiss',
      },
    );
  };
  if (isAndroidRewardedFormat(formatId)) {
    await withAndroidRewardedDismissGuard(formatId, async () => {
      await dismissFullscreenAdWithoutCreativeTap();
      await finishClosedWait();
    });
  } else {
    await dismissFullscreenAdWithoutCreativeTap();
    await finishClosedWait();
  }
}

/** iOS GMA test creatives expose a stable close control while RN lifecycle nodes are off-tree. */
const IOS_FULLSCREEN_CLOSE_NAMES = [
  'Close Advertisement',
  'Close Ad',
  'Close advertisement',
  // Bare "Close" is rewarded end-card only — handled in tapIosFullscreenCloseAttempt end-card path.
] as const;

/** Markers that the fullscreen creative itself is on-screen (not leftover Close chrome). */
const IOS_FULLSCREEN_OPEN_MARKERS = [
  'Test mode',
  "You're displaying a test interstitial",
  'Nice job!',
  'test rewarded',
  'rewarded test ad',
  'Test Ad',
] as const;

/** iOS UIMenu / text-selection chrome — blocks Close / Continue taps until dismissed. */
const IOS_TEXT_SELECTION_MENU_NAMES = [
  'Copy',
  'Look Up',
  'Translate',
  'Select',
  'Select All',
  'Share…',
  'Share...',
  // Rewarded end-card link selection (2026-09-23T1921-slot-5).
  'Open Link',
] as const;

const IOS_CONTINUE_TO_APP_NAMES = [
  'Continue to app',
  'Continue To App',
  'Continue to app >',
  'Continue to app>',
] as const;

const IOS_DEBUG_OPTIONS_SHEET_MARKERS = [
  'Debug Options',
  'Open ad inspector',
  'Ad inspector settings',
  'Creative Preview',
  'Troubleshooting',
  'Ad Information',
] as const;

async function findDisplayedIosElementByNames(
  names: readonly string[],
): Promise<WebdriverIO.Element | undefined> {
  for (const name of names) {
    const predicates = [
      `name == "${name}"`,
      `label == "${name}"`,
      `name CONTAINS "${name}"`,
      `label CONTAINS "${name}"`,
    ];
    for (const predicate of predicates) {
      const el = await $(`-ios predicate string:${predicate}`);
      if (
        (await el.isExisting().catch(() => false)) &&
        (await el.isDisplayed().catch(() => false))
      ) {
        return el;
      }
    }
  }
  return undefined;
}

async function iosElementExistsByName(name: string): Promise<boolean> {
  for (const predicate of [`name == "${name}"`, `label == "${name}"`]) {
    const el = await $(`-ios predicate string:${predicate}`);
    if (await el.isExisting().catch(() => false)) {
      return true;
    }
  }
  return false;
}

async function iosTapPoint(x: number, y: number): Promise<void> {
  // XCUITest supports mobile: tap; mobile: clickGesture is Android-only.
  await driver.execute('mobile: tap', { x: Math.floor(x), y: Math.floor(y) });
}

async function isIosTextSelectionMenuVisible(): Promise<boolean> {
  // Require at least two menu items so gallery "Copy" labels cannot false-trigger.
  // Also accept Copy+Open Link (run-08 rewarded end-card link selection bar).
  let hits = 0;
  for (const name of IOS_TEXT_SELECTION_MENU_NAMES) {
    if (await findDisplayedIosElementByNames([name])) {
      hits += 1;
      if (hits >= 2) {
        return true;
      }
    }
  }
  return false;
}

/** Tap outside to clear iOS UIMenu (Copy / Look Up / Translate / Open Link). */
async function dismissIosTextSelectionMenuIfPresent(): Promise<boolean> {
  if (!(await isIosTextSelectionMenuVisible())) {
    return false;
  }
  const { width, height } = await driver.getWindowRect();
  // Prefer chrome that is not selectable ad body text — mid-card taps re-open the menu
  // (run-04: Bolt description / rating selection under Copy|Look Up|Translate).
  for (const [fx, fy] of [
    [0.5, 0.055],
    [0.72, 0.055],
    [0.5, 0.93],
    [0.12, 0.055],
  ] as const) {
    await iosTapPoint(width * fx, height * fy);
    const gone = await driver
      .waitUntil(async () => !(await isIosTextSelectionMenuVisible()), {
        timeout: 1200,
        interval: 100,
      })
      .then(() => true)
      .catch(() => false);
    if (gone) {
      return true;
    }
  }
  // Last resort: force the named Close control even under a sticky UIMenu.
  const close = await findDisplayedIosElementByNames(IOS_FULLSCREEN_CLOSE_NAMES);
  if (close) {
    const loc = await close.getLocation().catch(() => null);
    const size = await close.getSize().catch(() => null);
    if (loc && size && size.width > 0 && size.height > 0) {
      await iosTapPoint(loc.x + size.width / 2, loc.y + size.height / 2);
      const gone = await driver
        .waitUntil(async () => !(await isIosTextSelectionMenuVisible()), {
          timeout: 1500,
          interval: 100,
        })
        .then(() => true)
        .catch(() => false);
      if (gone) {
        return true;
      }
    }
  }
  try {
    await driver.back();
  } catch {
    // best-effort — XCUITest does not implement mobile: keys / Escape
  }
  return driver
    .waitUntil(async () => !(await isIosTextSelectionMenuVisible()), {
      timeout: 1200,
      interval: 100,
    })
    .then(() => true)
    .catch(async () => !(await isIosTextSelectionMenuVisible()));
}

async function isIosDebugOptionsSheetVisible(): Promise<boolean> {
  if (await iosElementExistsByName('Debug Options')) {
    return true;
  }
  // Sheet body without reliable title — Ad Information + Dismiss together.
  const dismiss = await findDisplayedIosElementByNames(['Dismiss']);
  if (!dismiss) {
    return false;
  }
  for (const marker of IOS_DEBUG_OPTIONS_SHEET_MARKERS) {
    if (await findDisplayedIosElementByNames([marker])) {
      return true;
    }
  }
  return false;
}

async function dismissIosDebugOptionsSheetIfPresent(): Promise<boolean> {
  if (!(await isIosDebugOptionsSheetVisible())) {
    return false;
  }
  if (await tapIosNamedControlForce('Dismiss')) {
    const gone = await driver
      .waitUntil(async () => !(await isIosDebugOptionsSheetVisible()), {
        timeout: 2000,
        interval: 100,
      })
      .then(() => true)
      .catch(() => false);
    if (gone) {
      return true;
    }
  }
  for (const name of ['Done', 'Cancel', 'Close']) {
    await tapIosNamedControlForce(name);
    if (!(await isIosDebugOptionsSheetVisible())) {
      return true;
    }
  }
  try {
    await driver.back();
  } catch {
    // best-effort
  }
  return driver
    .waitUntil(async () => !(await isIosDebugOptionsSheetVisible()), {
      timeout: 2000,
      interval: 100,
    })
    .then(() => true)
    .catch(async () => !(await isIosDebugOptionsSheetVisible()));
}

async function tapIosContinueToAppIfPresent(): Promise<boolean> {
  const el = await findDisplayedIosElementByNames(IOS_CONTINUE_TO_APP_NAMES);
  if (!el) {
    return false;
  }
  try {
    await el.click();
  } catch {
    const loc = await el.getLocation().catch(() => null);
    const size = await el.getSize().catch(() => null);
    if (loc && size) {
      await iosTapPoint(loc.x + size.width / 2, loc.y + size.height / 2);
    } else {
      // Top-right "Continue to app >" band from live Flood-It / app-open captures.
      const { width, height } = await driver.getWindowRect();
      await iosTapPoint(width * 0.88, height * 0.08);
    }
  }
  await driver
    .waitUntil(
      async () => !(await findDisplayedIosElementByNames(IOS_CONTINUE_TO_APP_NAMES)),
      { timeout: 2000, interval: 100 },
    )
    .catch(() => undefined);
  return true;
}

/**
 * Clear iOS overlays that block gallery navigation and ad close chrome:
 * text-selection UIMenu, GMA Debug Options sheet, Continue to app, Close.
 */
export async function dismissIosBlockingOverlays(
  reason = 'unspecified',
): Promise<void> {
  if (isAndroid()) {
    return;
  }
  let changed = false;
  if (await dismissIosTextSelectionMenuIfPresent()) {
    changed = true;
  }
  if (await dismissIosDebugOptionsSheetIfPresent()) {
    changed = true;
  }
  if (await tapIosContinueToAppIfPresent()) {
    changed = true;
  }
  if (await isIosFullscreenCloseChromeVisible()) {
    if (await tapIosFullscreenCloseAttempt()) {
      changed = true;
    }
  }
  if (changed) {
    console.log(`[ios-overlay-dismiss] ${JSON.stringify({ reason, changed: true })}`);
  }
}

async function captureIosStallEvidence(label: string): Promise<void> {
  if (isAndroid()) {
    return;
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, '').replace('T', 'T').slice(0, 15);
  const slot = process.env.RNGMA_E2E_SLOT ?? process.env.RNGMA_SLOT ?? 'unknown';
  const udid = process.env.RNGMA_IOS_UDID ?? '';
  const dir = path.join(
    repositoryRoot,
    '.agents/reports/post-17.1.0-quality/ios-preflight-flakes',
    `${stamp}-slot-${slot}`,
  );
  try {
    const fs = await import('node:fs/promises');
    await fs.mkdir(dir, { recursive: true });
    if (udid) {
      const { execFileSync } = await import('node:child_process');
      execFileSync('xcrun', ['simctl', 'io', udid, 'screenshot', path.join(dir, 'screen.png')], {
        stdio: 'ignore',
      });
    }
    const source = await driver.getPageSource().catch(() => '');
    await fs.writeFile(path.join(dir, 'pageSource.xml'), source);
    await fs.writeFile(
      path.join(dir, 'meta.txt'),
      `label=${label}\nslot=${slot}\nudid=${udid}\nat=${new Date().toISOString()}\n`,
    );
    console.log(`[ios-stall-evidence] ${JSON.stringify({ label, dir })}`);
  } catch (error) {
    console.warn(`[ios-stall-evidence] capture failed: ${String(error)}`);
  }
}

async function isIosFullscreenTestAdVisible(): Promise<boolean> {
  return (await findDisplayedIosElementByNames(IOS_FULLSCREEN_OPEN_MARKERS)) != null;
}

async function isIosFullscreenCloseChromeVisible(): Promise<boolean> {
  // Rewarded end-card uses a nameless top-right Other X — treat end-card as close chrome.
  if (await isIosRewardedEndCardVisible()) {
    return true;
  }
  const el = await findDisplayedIosElementByNames(IOS_FULLSCREEN_CLOSE_NAMES);
  if (!el) {
    return false;
  }
  // Ghost leftover from a prior interstitial: disabled Close with no creative.
  const enabled = await el.isEnabled().catch(() => true);
  if (enabled) {
    return true;
  }
  return await isIosFullscreenTestAdVisible();
}

/**
 * Dismiss fullscreen X.
 * - Interstitial: named Close Advertisement (often enabled=false) — force-tap bounds
 *   when in the top-right band; ignore left-edge ghost (x≈0) unless rewarded end-card.
 * - Rewarded end-card (run-05 2026-09-24T1341): real X is bare enabled `Close` at ~12,74
 *   (top-LEFT). Disabled `Close Advertisement` at top-RIGHT is a ghost — do not prefer it.
 *   Clear UIMenu (Copy / Look Up / Translate) before tapping.
 */
async function tapIosFullscreenCloseAttempt(): Promise<boolean> {
  await dismissIosTextSelectionMenuIfPresent();
  const { width, height } = await driver.getWindowRect();
  const endCard = await isIosRewardedEndCardVisible();
  const creativeUp = endCard || (await isIosFullscreenTestAdVisible());

  // Rewarded end-card: X may be top-LEFT bare `Close` (run-05) OR top-RIGHT
  // (run-08 multi-ad "Ad 2 of 2" with left disabled Close Advertisement ghost at x=0).
  if (endCard) {
    for (const predicate of [
      'name == "Close" AND enabled == 1',
      'name == "Close Advertisement" AND enabled == 1',
    ]) {
      const rewardedClose = await $(`-ios predicate string:${predicate}`);
      if (
        (await rewardedClose.isExisting().catch(() => false)) &&
        (await rewardedClose.isDisplayed().catch(() => false))
      ) {
        const loc = await rewardedClose.getLocation().catch(() => null);
        const size = await rewardedClose.getSize().catch(() => null);
        try {
          await rewardedClose.click();
          return true;
        } catch {
          if (loc && size && size.width > 0 && size.height > 0) {
            await iosTapPoint(loc.x + size.width / 2, loc.y + size.height / 2);
            return true;
          }
        }
      }
    }
    // Prefer top-right band first (multi-ad end-card); then left X fallback.
    for (const [fx, fy] of [
      [0.92, 0.09],
      [0.93, 0.09],
      [0.06, 0.09],
      [0.08, 0.1],
    ] as const) {
      await iosTapPoint(width * fx, height * fy);
    }
    return true;
  }

  const el = await findDisplayedIosElementByNames(IOS_FULLSCREEN_CLOSE_NAMES);
  if (el) {
    const loc = await el.getLocation().catch(() => null);
    const size = await el.getSize().catch(() => null);
    const name = await el.getAttribute('name').catch(() => '');
    const enabled = await el.isEnabled().catch(() => true);
    // Left-edge disabled Close Advertisement ghost (interstitial leftover) — skip.
    const isLeftGhost =
      loc != null && loc.x < width * 0.25 && !enabled && /advertisement/i.test(String(name));
    if (!isLeftGhost) {
      if (enabled) {
        try {
          await el.click();
          return true;
        } catch {
          // fall through to coordinate force-tap
        }
      }
      // Rewarded only: never force-tap a disabled top-right Close Advertisement ghost.
      if (!enabled && endCard && loc != null && loc.x > width * 0.5) {
        // fall through to coordinate band / other names
      } else if (loc && size && size.width > 0 && size.height > 0) {
        await iosTapPoint(loc.x + size.width / 2, loc.y + size.height / 2);
        return true;
      }
    }
  }

  // Nameless top-right Other / coordinate band (interstitial fallback).
  if (creativeUp) {
    for (const [fx, fy] of [
      [0.92, 0.09],
      [0.93, 0.09],
      [0.9, 0.08],
    ] as const) {
      await iosTapPoint(width * fx, height * fy);
    }
    return true;
  }
  return false;
}

const IOS_REWARDED_END_CARD_MARKERS = [
  // Do NOT include "Nice job!" — GAM/interstitial test creatives use the same copy
  // (run-06: misclassified as rewarded end-card → tapped top-left instead of top-right X).
  'Claim',
  'Reward granted',
  'You earned',
  // Multi-ad rewarded end-card (stall 2026-09-23T1921-slot-5).
  'Ad 2 of 2',
  'Ad 1 of 2',
] as const;

async function isIosRewardedEndCardVisible(): Promise<boolean> {
  return (await findDisplayedIosElementByNames(IOS_REWARDED_END_CARD_MARKERS)) != null;
}

function isIosRewardedFormat(formatId: string): boolean {
  return (
    formatId === AppiumTestIds.format.rewardedHook ||
    formatId === AppiumTestIds.format.rewardedInterstitialHook ||
    formatId === AppiumTestIds.format.rewarded ||
    formatId === AppiumTestIds.format.rewardedInterstitial
  );
}

/** Wait until rewarded Close is enabled or an end-card marker appears. */
async function waitForIosRewardedDismissReady(): Promise<void> {
  const started = Date.now();
  await driver.waitUntil(
    async () => {
      if (await findDisplayedIosElementByNames(IOS_REWARDED_END_CARD_MARKERS)) {
        return true;
      }
      const el = await findDisplayedIosElementByNames(IOS_FULLSCREEN_CLOSE_NAMES);
      if (!el) {
        return false;
      }
      const enabled = await el.isEnabled().catch(() => true);
      // Even when Close reports enabled during countdown, give the creative a
      // short mandatory-watch window before the first dismiss attempt.
      return enabled && Date.now() - started >= 10000;
    },
    {
      timeout: 120000,
      interval: 750,
      timeoutMsg: 'iOS rewarded dismiss never became actionable (enabled Close / end card)',
    },
  );
}

async function tapIosFullscreenCloseWithRetries(): Promise<void> {
  // Only block on Close Advertisement when that chrome is actually present.
  // App Open feeds can leave RN lifecycle on-tree with "Test mode" copy and no close button.
  await dismissIosBlockingOverlays('tapIosFullscreenCloseWithRetries:begin');
  if (!(await isIosFullscreenCloseChromeVisible())) {
    await dismissIosAppOpenFeedIfPresent();
    return;
  }
  let clicks = 0;
  const started = Date.now();
  let handledStall = false;
  await driver.waitUntil(
    async () => {
      if (await tapIosContinueToAppIfPresent()) {
        if (!(await isIosFullscreenCloseChromeVisible())) {
          return true;
        }
      }
      const tapped = await tapIosFullscreenCloseAttempt();
      if (tapped) {
        clicks += 1;
        if (!(await isIosFullscreenCloseChromeVisible())) {
          return true;
        }
        // Ghost Close controls leftover from a prior interstitial can remain
        // "displayed" while App Open RN lifecycle is already on-tree. Escape.
        if (clicks >= 5) {
          await dismissIosAppOpenFeedIfPresent();
          if (!(await isIosFullscreenCloseChromeVisible())) {
            return true;
          }
          if (clicks === 5 || clicks === 10) {
            try {
              await driver.back();
            } catch {
              // best-effort
            }
          }
          if (clicks >= 12) {
            return true;
          }
        }
        return false;
      }
      if (!(await isIosFullscreenCloseChromeVisible())) {
        return true;
      }
      // Still stuck with disabled X — force top-right band even without name hit.
      if (await isIosFullscreenTestAdVisible()) {
        const { width, height } = await driver.getWindowRect();
        await iosTapPoint(width * 0.9, height * 0.08);
        clicks += 1;
      }
      if (!handledStall && Date.now() - started > 15000) {
        handledStall = true;
        await captureIosStallEvidence('tapIosFullscreenCloseWithRetries');
        await dismissIosBlockingOverlays('tapIosFullscreenCloseWithRetries:stall');
        // After evidence: always force-tap top-right X (enabled=false case).
        const { width, height } = await driver.getWindowRect();
        await iosTapPoint(width * 0.9, height * 0.08);
        await iosTapPoint(width * 0.93, height * 0.075);
        if (!(await isIosFullscreenCloseChromeVisible())) {
          return true;
        }
      }
      return false;
    },
    {
      timeout: 90000,
      interval: 400,
      timeoutMsg: 'iOS fullscreen Close Advertisement did not dismiss within 90s',
    },
  );
}

const IOS_APP_OPEN_CONTINUE_NAMES = [
  'Continue to app >',
  'Continue to app>',
  'Continue to app',
  'Continue To App',
] as const;

async function isIosAppOpenFeedChromeVisible(): Promise<boolean> {
  if (await isIosFullscreenCloseChromeVisible()) {
    return false;
  }
  // Interstitial/rewarded test creatives also say "Test mode" — exclude those.
  for (const needle of [
    'test interstitial',
    "You're displaying a test interstitial",
    'Nice job!',
    'Reward granted',
    'Test mode',
  ]) {
    if (await findDisplayedIosElementByNames([needle])) {
      return false;
    }
  }
  // Prefer Continue control — lean lookup (avoid 4×CONTAINS spam per poll).
  for (const name of IOS_APP_OPEN_CONTINUE_NAMES) {
    if (await iosElementExistsByName(name)) {
      const el = await $(`~${name}`);
      if (await el.isDisplayed().catch(() => false)) {
        return true;
      }
    }
  }
  return (await findDisplayedIosElementByNames(['Feed Test'])) != null;
}

async function tapIosAppOpenContinueChrome(): Promise<boolean> {
  await dismissIosTextSelectionMenuIfPresent();
  if (await tapIosContinueToAppIfPresent()) {
    return true;
  }
  const continueBtn = await findDisplayedIosElementByNames(IOS_APP_OPEN_CONTINUE_NAMES);
  if (continueBtn) {
    await continueBtn.click();
    await driver
      .waitUntil(async () => !(await isIosAppOpenFeedChromeVisible()), {
        timeout: 2000,
        interval: 100,
      })
      .catch(() => undefined);
    return true;
  }
  if (!(await isIosAppOpenFeedChromeVisible())) {
    return false;
  }
  // Header-band X — mirrors Android app-open feed dismiss without tapping Install CTAs.
  const { width, height } = await driver.getWindowRect();
  for (const [fx, fy] of [
    [0.93, 0.075],
    [0.9, 0.075],
    [0.87, 0.085],
  ] as const) {
    await iosTapPoint(width * fx, height * fy);
    const gone = await driver
      .waitUntil(async () => !(await isIosAppOpenFeedChromeVisible()), {
        timeout: 1200,
        interval: 100,
      })
      .then(() => true)
      .catch(() => false);
    if (gone) {
      return true;
    }
  }
  return true;
}

async function dismissIosAppOpenFeedIfPresent(): Promise<boolean> {
  let dismissed = false;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (!(await isIosAppOpenFeedChromeVisible())) {
      return dismissed;
    }
    await tapIosAppOpenContinueChrome();
    dismissed = true;
  }
  return dismissed;
}

/** Dismiss a fullscreen test creative without tapping in-ad UI. */
async function dismissFullscreenAdWithoutCreativeTap(): Promise<void> {
  if (isAndroid()) {
    await tapAndroidFullscreenCloseWithRetries();
    return;
  }
  await dismissIosBlockingOverlays('dismissFullscreenAdWithoutCreativeTap');
  if (await isIosFullscreenCloseChromeVisible()) {
    await tapIosFullscreenCloseWithRetries();
    return;
  }
  await dismissIosAppOpenFeedIfPresent();
}

/** Fullscreen interstitial / GAM / rewarded show-close while RN lifecycle nodes may be off-tree. */
async function runIosFullscreenShowCloseLifecycle(formatId: string): Promise<void> {
  const showActionId = AppiumTestIds.action.show(formatId);
  const isAppOpen = formatId === AppiumTestIds.format.appOpen;
  const probesPerTap = 10;
  const probeIntervalMs = 400;
  const maxTaps = 4;
  let lastProbe = { tap: 0, probe: 0, phase: '', adVisible: false, feedVisible: false };

  const openedAfterProbe = async (tap: number, probe: number): Promise<boolean> => {
    const phase = await safeShowLifecycleText(formatId);
    const adVisible =
      probe % 2 === 0
        ? await isIosFullscreenTestAdVisible()
        : await isIosFullscreenCloseChromeVisible();
    const feedVisible = isAppOpen && (await isIosAppOpenFeedChromeVisible());
    lastProbe = { tap, probe, phase, adVisible, feedVisible };
    const opened =
      phase.includes(SHOW_LIFECYCLE_OPENED) ||
      phase.includes(SHOW_LIFECYCLE_CLOSED) ||
      adVisible ||
      feedVisible;
    console.log(
      `[show-close-probe] ${JSON.stringify({
        format: formatId,
        platform: 'ios',
        tap,
        probe,
        phase,
        adVisible,
        feedVisible,
        opened,
      })}`,
    );
    return opened;
  };

  let opened = false;
  for (let tap = 1; tap <= maxTaps && !opened; tap += 1) {
    console.log(`[show-close-tap] ${JSON.stringify({ format: formatId, platform: 'ios', tap })}`);
    await tapFormatAction(showActionId);
    for (let probe = 1; probe <= probesPerTap; probe += 1) {
      if (await openedAfterProbe(tap, probe)) {
        opened = true;
        break;
      }
      if (probe < probesPerTap) {
        await sleep(probeIntervalMs);
      }
    }
  }
  if (!opened) {
    throw new Error(
      `[show-close-fail] ${formatId}: no opened lifecycle or iOS fullscreen chrome after ${maxTaps} show tap(s); lastProbe=${JSON.stringify(lastProbe)}`,
    );
  }
  if (isIosRewardedFormat(formatId)) {
    await waitForIosRewardedDismissReady();
  }
  await dismissFullscreenAdWithoutCreativeTap();
  await driver.waitUntil(
    async () => {
      // Prefer RN closed phase first — ghost Close / gallery titles must not block it.
      const phase = await safeShowLifecycleText(formatId);
      if (phase.includes(SHOW_LIFECYCLE_CLOSED)) {
        return true;
      }
      if (await isIosFullscreenCloseChromeVisible()) {
        await tapIosFullscreenCloseAttempt();
        return false;
      }
      if (isAppOpen && (await isIosAppOpenFeedChromeVisible())) {
        await tapIosAppOpenContinueChrome();
        return false;
      }
      if (await isIosFullscreenTestAdVisible()) {
        await tapIosFullscreenCloseAttempt();
        return false;
      }
      return false;
    },
    {
      timeout: isIosRewardedFormat(formatId) ? 120000 : 90000,
      interval: 400,
      timeoutMsg: 'iOS fullscreen Show never reached Show lifecycle: closed after dismiss',
    },
  );
}

async function runIosHookShowCloseLifecycle(formatId: string): Promise<void> {
  const isAppOpenHook = formatId === AppiumTestIds.format.appOpenHook;
  const isRewardedHook = isIosRewardedFormat(formatId);
  await driver.waitUntil(
    async () => {
      const phase = await safeShowLifecycleText(formatId);
      if (phase.includes(HOOK_LIFECYCLE_SHOWING) || phase.includes(HOOK_LIFECYCLE_CLOSED)) {
        return true;
      }
      if (isAppOpenHook && (await isIosAppOpenFeedChromeVisible())) {
        return true;
      }
      // Rewarded creatives often omit Test mode / open markers until end-card
      // (run-12: timed out on showing, teardown saw Reward granted + enabled Close).
      if (isRewardedHook) {
        if (await isIosRewardedEndCardVisible()) {
          return true;
        }
        const close = await $(`-ios predicate string:name == "Close" AND enabled == 1`);
        if (
          (await close.isExisting().catch(() => false)) &&
          (await close.isDisplayed().catch(() => false))
        ) {
          return true;
        }
      }
      // Require creative copy (not bare Close chrome) — Close Advertisement can be a
      // ghost leftover from a prior interstitial in the same session.
      return await isIosFullscreenTestAdVisible();
    },
    {
      timeout: isRewardedHook ? 120000 : 90000,
      interval: 400,
      timeoutMsg: 'iOS hook Show never reached status=showing or fullscreen chrome',
    },
  );
  if (isRewardedHook) {
    await waitForIosRewardedDismissReady();
  }
  if (isAppOpenHook) {
    // Prefer feed / header dismiss — do not get stuck on ghost Close Advertisement
    // left over from a prior interstitial in the same session.
    await dismissIosBlockingOverlays(`runIosHookShowCloseLifecycle:${formatId}`);
    await dismissIosAppOpenFeedIfPresent();
    if (await isIosFullscreenCloseChromeVisible()) {
      for (let i = 0; i < 3; i += 1) {
        if (!(await tapIosFullscreenCloseAttempt())) {
          break;
        }
        if (!(await isIosFullscreenCloseChromeVisible())) {
          break;
        }
      }
    }
  } else {
    await dismissFullscreenAdWithoutCreativeTap();
  }
  let closeClicks = 0;
  let handledStall = false;
  const closeStarted = Date.now();
  await driver.waitUntil(
    async () => {
      await dismissIosTextSelectionMenuIfPresent();
      const phase = await safeShowLifecycleText(formatId);
      if (phase.includes(HOOK_LIFECYCLE_CLOSED)) {
        return true;
      }
      if (isAppOpenHook && (await isIosAppOpenFeedChromeVisible())) {
        await tapIosAppOpenContinueChrome();
        return false;
      }
      if (await tapIosContinueToAppIfPresent()) {
        return false;
      }
      if (await isIosFullscreenCloseChromeVisible() || (await isIosRewardedEndCardVisible())) {
        closeClicks += 1;
        const tapped = await tapIosFullscreenCloseAttempt();
        if (!tapped && isRewardedHook) {
          // Still in mandatory watch — keep polling without counting as a ghost.
          return false;
        }
        if (closeClicks >= 5) {
          if (isAppOpenHook) {
            // Ghost close — try header band and accept lifecycle polling.
            await tapIosAppOpenContinueChrome();
          }
          if (closeClicks === 6 || closeClicks === 12) {
            try {
              await driver.back();
            } catch {
              // best-effort
            }
          }
        }
        return false;
      }
      if (await isIosFullscreenTestAdVisible()) {
        await tapIosFullscreenCloseAttempt();
        return false;
      }
      if (!handledStall && Date.now() - closeStarted > 15000) {
        handledStall = true;
        await captureIosStallEvidence(`runIosHookShowCloseLifecycle:${formatId}`);
        await dismissIosBlockingOverlays(`runIosHookShowCloseLifecycle:${formatId}:stall`);
      }
      if (isAppOpenHook) {
        await tapIosAppOpenContinueChrome();
      }
      return false;
    },
    {
      timeout: isRewardedHook ? 120000 : 90000,
      interval: 400,
      timeoutMsg: 'iOS hook Show never reached status=closed after dismiss',
    },
  );
}

async function assertShowCloseLifecycle(formatId: string): Promise<void> {
  if (isAndroid()) {
    if (formatId === AppiumTestIds.format.appOpen) {
      await runAndroidAppOpenShowCloseLifecycle(formatId);
    } else {
      await runAndroidFullscreenShowCloseLifecycle(formatId);
    }
    console.log(
      `[show-close-proof] ${JSON.stringify({
        format: formatId,
        platform: 'android',
        opened: SHOW_LIFECYCLE_OPENED,
        closed: SHOW_LIFECYCLE_CLOSED,
      })}`,
    );
    return;
  }
  await runIosFullscreenShowCloseLifecycle(formatId);
  console.log(
    `[show-close-proof] ${JSON.stringify({
      format: formatId,
      platform: 'ios',
      opened: SHOW_LIFECYCLE_OPENED,
      closed: SHOW_LIFECYCLE_CLOSED,
    })}`,
  );
}

/** Native Ad Inspector chrome — require inspector body, not a lingering ghost Close. */
async function isIosAdInspectorVisible(): Promise<boolean> {
  // Unique footer on the inspector sheet.
  if (await findDisplayedIosElementByNames(['Single ad source test'])) {
    return true;
  }
  // Title plus the real top-right Close (enabled) — not the disabled ghost.
  const title = await findDisplayedIosElementByNames(['Ad Inspector']);
  if (!title) {
    return false;
  }
  const close = await $('~Close');
  if (
    (await close.isExisting().catch(() => false)) &&
    (await close.isEnabled().catch(() => false)) &&
    (await close.isDisplayed().catch(() => false))
  ) {
    return true;
  }
  // Ad unit list rows inside the sheet.
  for (const marker of ['Adapters', 'Privacy', 'Ad units'] as const) {
    if (await findDisplayedIosElementByNames([marker])) {
      return true;
    }
  }
  return false;
}

async function tapIosNamedControlForce(name: string): Promise<boolean> {
  const el = await $(`-ios predicate string:name == "${name}"`);
  if (!(await el.isExisting().catch(() => false))) {
    return false;
  }
  try {
    await el.click();
  } catch {
    const loc = await el.getLocation().catch(() => null);
    const size = await el.getSize().catch(() => null);
    if (!loc || !size) {
      return false;
    }
    await iosTapPoint(loc.x + size.width / 2, loc.y + size.height / 2);
  }
  return true;
}

async function dismissIosAdInspectorIfPresent(): Promise<void> {
  if (!(await isIosAdInspectorVisible())) {
    return;
  }
  let attempts = 0;
  await driver.waitUntil(
    async () => {
      await dismissIosTextSelectionMenuIfPresent();
      if (!(await isIosAdInspectorVisible())) {
        return true;
      }
      attempts += 1;
      // Hierarchy shows enabled top-right "Close" (X). "Close Ad Inspector" is often
      // a disabled/inaccessible ghost on the left — prefer the real Close first.
      if (await tapIosNamedControlForce('Close')) {
        if (!(await isIosAdInspectorVisible())) {
          return true;
        }
      }
      // Force-tap ghost Close Ad Inspector bounds anyway (may still work).
      const ghost = await $('~Close Ad Inspector');
      if (await ghost.isExisting().catch(() => false)) {
        const loc = await ghost.getLocation().catch(() => null);
        const size = await ghost.getSize().catch(() => null);
        if (loc && size) {
          await iosTapPoint(loc.x + size.width / 2, loc.y + size.height / 2);
        }
      }
      // Top-right X band from live Ad Inspector screenshots (~346,77 on 402-wide).
      const { width, height } = await driver.getWindowRect();
      await iosTapPoint(width * 0.9, height * 0.1);
      if (!(await isIosAdInspectorVisible())) {
        return true;
      }
      // Sheet-style dismiss: swipe down from the header.
      if (attempts >= 2) {
        try {
          await driver.execute('mobile: swipe', {
            direction: 'down',
            velocity: 2500,
          });
        } catch {
          try {
            await driver.execute('mobile: dragFromToForDuration', {
              duration: 0.35,
              fromX: Math.floor(width * 0.5),
              fromY: Math.floor(height * 0.12),
              toX: Math.floor(width * 0.5),
              toY: Math.floor(height * 0.75),
            });
          } catch {
            // best-effort
          }
        }
      }
      if (attempts >= 4) {
        try {
          await driver.back();
        } catch {
          // best-effort
        }
      }
      return !(await isIosAdInspectorVisible());
    },
    {
      timeout: 45000,
      interval: 400,
      timeoutMsg: 'iOS Ad Inspector did not dismiss',
    },
  );
}

const IOS_DEBUG_MENU_MARKERS = [
  'Debug Options',
  'Creative Preview',
  'Troubleshooting',
  'Select a debug mode',
  'Debug options',
  'Open ad inspector',
  'Ad inspector settings',
  'Ad Information',
] as const;

async function isIosDebugMenuVisible(): Promise<boolean> {
  if (await isIosDebugOptionsSheetVisible()) {
    return true;
  }
  for (const name of IOS_DEBUG_MENU_MARKERS) {
    if (await iosElementExistsByName(name)) {
      return true;
    }
    const el = await findDisplayedIosElementByNames([name]);
    if (el) {
      return true;
    }
  }
  const src = await driver.getPageSource().catch(() => '');
  return IOS_DEBUG_MENU_MARKERS.some(marker => src.includes(marker));
}

/** Debug Menu closed contract listens for AppState inactive/background. */
async function nudgeIosAppStateForUtilityClose(): Promise<void> {
  await driver.execute('mobile: pressButton', { name: 'home' });
  await sleep(500);
  await driver.activateApp(EXAMPLE_IOS_BUNDLE_ID);
  await sleep(600);
}

async function dismissIosDebugMenuIfPresent(): Promise<void> {
  await dismissIosDebugOptionsSheetIfPresent();
  for (const name of ['Dismiss', 'Done', 'Cancel', 'Close']) {
    if (!(await isIosDebugMenuVisible())) {
      return;
    }
    await tapIosNamedControlForce(name);
  }
  if (await isIosDebugMenuVisible()) {
    try {
      await driver.back();
    } catch {
      // best-effort
    }
    await sleep(400);
  }
}

async function dismissIosUtilitySurface(formatId: string): Promise<void> {
  if (formatId === AppiumTestIds.format.adInspector) {
    await dismissIosAdInspectorIfPresent();
    return;
  }
  if (formatId === AppiumTestIds.format.debugMenu) {
    await dismissIosDebugMenuIfPresent();
    try {
      if (!(await utilityLifecycleText(formatId)).includes(UTILITY_LIFECYCLE_CLOSED)) {
        await nudgeIosAppStateForUtilityClose();
      }
    } catch {
      await nudgeIosAppStateForUtilityClose();
    }
  }
}

async function assertUtilityOpenCloseLifecycle(
  formatId: string,
  actionAccessibilityLabel?: string,
): Promise<void> {
  await tapFormatAction(AppiumTestIds.action.show(formatId), actionAccessibilityLabel);
  if (isAndroid()) {
    await driver.waitUntil(
      async () => {
        const el = await findByTestId(AppiumTestIds.action.lifecycle(formatId));
        if (await el.isExisting().catch(() => false)) {
          if ((await elementText(el)).includes(UTILITY_LIFECYCLE_OPENED)) {
            return true;
          }
        }
        if (
          formatId === AppiumTestIds.format.adInspector &&
          (await isAndroidAdInspectorVisible())
        ) {
          return true;
        }
        if (
          formatId === AppiumTestIds.format.debugMenu &&
          (await isAndroidDebugModePickerVisible())
        ) {
          return true;
        }
        return false;
      },
      {
        timeout: 90000,
        interval: 200,
        timeoutMsg: `Utility surface never opened for ${formatId}`,
      },
    );
  } else {
    // Native inspector/debug chrome covers RN lifecycle nodes; accept chrome OR text.
    await driver.waitUntil(
      async () => {
        const el = await findByTestId(AppiumTestIds.action.lifecycle(formatId));
        if (await el.isExisting().catch(() => false)) {
          if ((await elementText(el)).includes(UTILITY_LIFECYCLE_OPENED)) {
            return true;
          }
        }
        if (
          formatId === AppiumTestIds.format.adInspector &&
          (await isIosAdInspectorVisible())
        ) {
          return true;
        }
        if (
          formatId === AppiumTestIds.format.debugMenu &&
          (await isIosDebugMenuVisible())
        ) {
          return true;
        }
        return false;
      },
      {
        timeout: 90000,
        interval: 200,
        timeoutMsg: `Utility surface never opened for ${formatId}`,
      },
    );
  }
  if (isAndroid()) {
    await dismissAndroidUtilitySurface(formatId);
    let broughtExampleAppForwardForClose = false;
    await driver.waitUntil(
      async () => {
        if (formatId === AppiumTestIds.format.adInspector && (await isAndroidAdActivityForeground())) {
          await dismissAndroidAdInspectorIfPresent();
          return false;
        }
        if (formatId === AppiumTestIds.format.debugMenu) {
          await recoverAndroidTestHost('assertUtilityOpenCloseLifecycle.close');
          if (await isAndroidDebugModePickerVisible()) {
            await dismissAndroidDebugModePickerIfPresent();
            return false;
          }
        }
        const el = await findByTestId(AppiumTestIds.action.lifecycle(formatId));
        if (!(await el.isExisting().catch(() => false))) {
          if (formatId === AppiumTestIds.format.adInspector) {
            if (!broughtExampleAppForwardForClose) {
              broughtExampleAppForwardForClose = true;
              await bringExampleAppForwardOnceIfNeeded('assertUtilityOpenCloseLifecycle.close');
            }
          } else {
            await recoverAndroidTestHost('assertUtilityOpenCloseLifecycle.close');
          }
          return false;
        }
        return (await elementText(el)).includes(UTILITY_LIFECYCLE_CLOSED);
      },
      {
        timeout: 90000,
        interval: 400,
        timeoutMsg: `Utility surface never closed for ${formatId}`,
      },
    );
  } else {
    await dismissIosUtilitySurface(formatId);
    await driver.waitUntil(
      async () => {
        if (
          formatId === AppiumTestIds.format.adInspector &&
          (await isIosAdInspectorVisible())
        ) {
          await dismissIosAdInspectorIfPresent();
          return false;
        }
        if (formatId === AppiumTestIds.format.debugMenu) {
          if (await isIosDebugMenuVisible()) {
            await dismissIosDebugMenuIfPresent();
            return false;
          }
        }
        const el = await findByTestId(AppiumTestIds.action.lifecycle(formatId));
        if (!(await el.isExisting().catch(() => false))) {
          if (formatId === AppiumTestIds.format.debugMenu) {
            await nudgeIosAppStateForUtilityClose();
          }
          return false;
        }
        const text = await elementText(el);
        if (text.includes(UTILITY_LIFECYCLE_CLOSED)) {
          return true;
        }
        if (
          formatId === AppiumTestIds.format.debugMenu &&
          text.includes(UTILITY_LIFECYCLE_OPENED)
        ) {
          await nudgeIosAppStateForUtilityClose();
        }
        return false;
      },
      {
        timeout: 90000,
        interval: 400,
        timeoutMsg: `Utility surface never closed for ${formatId}`,
      },
    );
  }
  console.log(
    `[utility-open-close-proof] ${JSON.stringify({
      format: formatId,
      platform: isAndroid() ? 'android' : 'ios',
      opened: UTILITY_LIFECYCLE_OPENED,
      closed: UTILITY_LIFECYCLE_CLOSED,
    })}`,
  );
}

async function runAndroidHookShowCloseLifecycle(formatId: string): Promise<void> {
  const isAppOpenHook = formatId === AppiumTestIds.format.appOpenHook;
  await dismissAndroidImmersiveModeEducationIfPresent();
  await driver.waitUntil(
    async () => {
      await dismissAndroidImmersiveModeEducationIfPresent();
      if (await isAndroidAdActivityForeground()) {
        return true;
      }
      if (await isAndroidFullscreenTestAdObstructing()) {
        return true;
      }
      if (isAppOpenHook && (await isAndroidAppOpenFeedChromeVisible())) {
        await dismissAndroidAppOpenFeedIfPresent();
        return false;
      }
      const el = await findByTestId(AppiumTestIds.action.lifecycle(formatId));
      if (await el.isExisting().catch(() => false)) {
        const phase = await elementText(el);
        if (phase.includes(HOOK_LIFECYCLE_CLOSED)) {
          return true;
        }
        if (
          phase.includes(HOOK_LIFECYCLE_SHOWING) &&
          ((await isAndroidAdActivityForeground()) ||
            (await isAndroidFullscreenTestAdObstructing()))
        ) {
          return true;
        }
      }
      return false;
    },
    {
      timeout: 90000,
      interval: 200,
      timeoutMsg: 'Hook Show never reached showing or native fullscreen chrome',
    },
  );
  if (isAppOpenHook) {
    await dismissAndroidAppOpenFeedIfPresent();
  }
  const finishHookClosedWait = async (): Promise<void> => {
    await driver.waitUntil(
      async () => {
        await dismissAndroidImmersiveModeEducationIfPresent();
        if (await recoverAndroidForeignAppIfPresent('hookClose.waitClosed')) {
          return false;
        }
        if (isAppOpenHook && (await isAndroidAppOpenFeedChromeVisible())) {
          await dismissAndroidAppOpenFeedIfPresent();
          return false;
        }
        if (
          (await isAndroidFullscreenAdShowing()) ||
          (await isAndroidAdActivityForeground()) ||
          (await isAndroidFullscreenTestAdObstructing()) ||
          (await isAndroidInterstitialCloseChromeVisible())
        ) {
          await tapAndroidInterstitialCloseAttempt();
          return false;
        }
        const el = await findByTestId(AppiumTestIds.action.lifecycle(formatId));
        if (!(await el.isExisting().catch(() => false))) {
          return false;
        }
        return (await elementText(el)).includes(HOOK_LIFECYCLE_CLOSED);
      },
      {
        timeout: isAndroidRewardedFormat(formatId) ? 120000 : 90000,
        interval: 400,
        timeoutMsg: 'Hook Show never reached status=closed',
      },
    );
  };
  if (isAndroidRewardedFormat(formatId)) {
    await withAndroidRewardedDismissGuard(formatId, async () => {
      await dismissFullscreenAdWithoutCreativeTap();
      await finishHookClosedWait();
    });
  } else {
    await dismissFullscreenAdWithoutCreativeTap();
    await finishHookClosedWait();
  }
}

/** Hook screens publish `Hook lifecycle:` markers; reward/paid delivery stays non-blocking. */
async function assertHookShowCloseLifecycle(formatId: string): Promise<void> {
  await tapFormatAction(AppiumTestIds.action.show(formatId));
  if (isAndroid()) {
    await runAndroidHookShowCloseLifecycle(formatId);
    console.log(
      `[hook-lifecycle-proof] ${JSON.stringify({
        format: formatId,
        platform: 'android',
        showing: HOOK_LIFECYCLE_SHOWING,
        closed: HOOK_LIFECYCLE_CLOSED,
      })}`,
    );
    return;
  }
  await runIosHookShowCloseLifecycle(formatId);
  console.log(
    `[hook-lifecycle-proof] ${JSON.stringify({
      format: formatId,
      platform: 'ios',
      showing: HOOK_LIFECYCLE_SHOWING,
      closed: HOOK_LIFECYCLE_CLOSED,
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
        if (await el.isDisplayed().catch(() => false)) {
          await clickElement(el);
          return;
        }
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

/** Prove MobileAds utility surfaces open and close without SDK version or ad-fill claims. */
export async function proveSdkUtilitySurface(contract: SdkUtilitySurfaceContract): Promise<void> {
  await withInstrumentationRecovery(async () => {
    await openFormat(contract.id, contract.galleryTitle);
    await assertDisplayed(contract.containerId);
    await assertUtilityOpenCloseLifecycle(contract.id, contract.actionAccessibilityLabel);
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
    hookAutoLoad:
      (format.path === 'hook' && !format.actionId) ||
      (format.path === 'multi-format' && format.multiFormatHookAutoLoad === true),
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
        if (format.path === 'pool' && format.id === AppiumTestIds.format.poolInterstitialProvider) {
          await waitForPoolRegistryReady(format.id);
        }
        await tapFormatAction(format.actionId);
        if (format.id === AppiumTestIds.format.poolInterstitialImperative) {
          await tapFormatAction(AppiumTestIds.action.reload(format.id));
        }
      },
      observe: uiAttempt => {
        if (format.structuredUnsupportedGate) {
          return observePoolStructuredUnsupportedGate(
            format.id,
            format.structuredUnsupportedGate,
            uiAttempt,
          );
        }
        if (format.path === 'pool') {
          return observePoolFilledOutcome(format.id, uiAttempt);
        }
        if (format.path === 'hook') {
          return observeHookLoadOutcome(format.id, uiAttempt);
        }
        return observeRepresentativeRequestOutcome(format.id, format.path, uiAttempt);
      },
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
      if (format.renderProof === 'native-or-banner') {
        const loadedEl = await findByTestId(AppiumTestIds.action.loaded(format.id));
        const loadedText = await loadedEl.getText();
        const winner = /winner=(native|banner)/.exec(loadedText)?.[1];
        if (winner !== 'native' && winner !== 'banner') {
          throw new Error(
            `[render-proof] ${format.id}: loaded marker omitted winner=native|banner (text=${JSON.stringify(loadedText)})`,
          );
        }
        if (winner === 'native') {
          const rectangle = await assertRenderedRectangle(
            AppiumTestIds.action.rendered(format.id),
          );
          console.log(
            `[render-proof] ${JSON.stringify({
              format: format.id,
              platform: isAndroid() ? 'android' : 'ios',
              winner,
              rectangle,
            })}`,
          );
        } else {
          const evidence = await assertRenderedBannerSubtree(
            AppiumTestIds.action.rendered(format.id),
          );
          console.log(
            `[render-proof] ${JSON.stringify({
              format: format.id,
              platform: isAndroid() ? 'android' : 'ios',
              winner,
              ...evidence,
            })}`,
          );
        }
      }
      if (format.hookLifecycle) {
        await assertHookShowCloseLifecycle(format.id);
      } else if (format.poolShowClose) {
        await assertShowCloseLifecycle(format.id);
      } else if (format.showClose) {
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
