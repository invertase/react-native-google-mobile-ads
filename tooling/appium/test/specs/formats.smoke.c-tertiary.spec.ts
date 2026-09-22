import {
  NATIVE_RNGMA_TESTING_PROBE,
  NAVIGATION_SMOKE_TERTIARY,
} from '../../src/formats.ts';
import { AppiumTestIds } from '../../src/testIds.ts';
import {
  assertDisplayed,
  navigateToFormat,
  proveProbeStatus,
  waitForGalleryHome,
} from '../helpers/gallery.ts';

describe('GMA gallery navigation smoke and probe status (tertiary)', () => {
  before(async () => {
    await waitForGalleryHome();
  });

  it('shows gallery home with stable root testID', async () => {
    await assertDisplayed(AppiumTestIds.root);
    await assertDisplayed(AppiumTestIds.gallery);
  });

  for (const format of NAVIGATION_SMOKE_TERTIARY) {
    it(`opens ${format.title}`, async () => {
      await navigateToFormat(format);
    });
  }

  it('preserves NativeRNGMATesting loaded/status probe behavior', async () => {
    await proveProbeStatus({
      formatId: NATIVE_RNGMA_TESTING_PROBE.id,
      containerId: NATIVE_RNGMA_TESTING_PROBE.containerId,
      galleryTitle: NATIVE_RNGMA_TESTING_PROBE.title,
      actionId: NATIVE_RNGMA_TESTING_PROBE.actionId,
      expectedStatusText: NATIVE_RNGMA_TESTING_PROBE.expectedStatusText,
      expectedStatusMarkers: NATIVE_RNGMA_TESTING_PROBE.expectedStatusMarkers,
      expectedPingByPlatform: NATIVE_RNGMA_TESTING_PROBE.expectedPingByPlatform,
      actionAccessibilityLabel: NATIVE_RNGMA_TESTING_PROBE.actionAccessibilityLabel,
    });
  });
});
