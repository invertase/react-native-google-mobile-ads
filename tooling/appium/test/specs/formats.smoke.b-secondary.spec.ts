import { NAVIGATION_SMOKE_SECONDARY } from '../../src/formats.ts';
import { AppiumTestIds } from '../../src/testIds.ts';
import {
  assertDisplayed,
  navigateToFormat,
  waitForGalleryHome,
} from '../helpers/gallery.ts';

describe('GMA gallery navigation/container smoke (secondary; no ad-load assertion)', () => {
  before(async () => {
    await waitForGalleryHome();
  });

  it('shows gallery home with stable root testID', async () => {
    await assertDisplayed(AppiumTestIds.root);
    await assertDisplayed(AppiumTestIds.gallery);
  });

  for (const format of NAVIGATION_SMOKE_SECONDARY) {
    it(`opens ${format.title}`, async () => {
      await navigateToFormat(format);
    });
  }
});
