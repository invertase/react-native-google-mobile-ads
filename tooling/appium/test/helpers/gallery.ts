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
      if (await el.isDisplayed().catch(() => false)) {
        return el;
      }
      try {
        await $(`android=${scrollable}.scrollIntoView(new UiSelector().resourceId("${testId}"))`);
      } catch {
        await $(`android=${scrollable}.scrollForward()`);
      }
    }
    await el.waitForDisplayed({ timeout: 15000 });
    return el;
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
  const chip = await findByTestId(chipId);
  if (!(await chip.isDisplayed().catch(() => false))) {
    await scrollToTestId(chipId);
  }
  await clickElement(await findByTestId(chipId));
  await driver.pause(400);
}

async function clickGalleryOpener(openId: string, galleryTitle?: string): Promise<void> {
  if (galleryTitle && isAndroid()) {
    const byText = await $(`android=new UiSelector().text("${galleryTitle}")`);
    if (await byText.isDisplayed().catch(() => false)) {
      await clickElement(byText);
      return;
    }
  }
  await scrollToTestId(openId);
  if (galleryTitle && isAndroid()) {
    const byText = await $(`android=new UiSelector().text("${galleryTitle}")`);
    if (await byText.isDisplayed().catch(() => false)) {
      await clickElement(byText);
      return;
    }
  }
  const button = await findByTestId(openId);
  await clickElement(button);
}

export async function openFormat(formatId: string, galleryTitle?: string): Promise<void> {
  await withInstrumentationRecovery(async () => {
    if (!(await isGalleryHome())) {
      await backToGallery();
    }
    const openId = AppiumTestIds.openFormat(formatId);
    await driver.pause(300);
    await selectGallerySection(gallerySectionForFormat(formatId));
    // BannerAdSize variants live under the Banner sizes accordion (Formats section).
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
    await clickGalleryOpener(openId, galleryTitle);
    const back = await findByTestId(AppiumTestIds.galleryBack);
    const container = await findByTestId(formatId);
    await driver.waitUntil(
      async () =>
        (await back.isDisplayed().catch(() => false)) ||
        (await container.isDisplayed().catch(() => false)),
      {
        timeout: 45000,
        timeoutMsg: `Format ${formatId} did not open (container/back not visible)`,
      },
    );
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
