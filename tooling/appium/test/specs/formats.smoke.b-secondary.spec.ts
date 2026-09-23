import { NAVIGATION_SMOKE_SECONDARY } from '../../src/formats.ts';
import { STARTUP_READY_MARKER } from '../../src/startupSupervisor.ts';
import { AppiumTestIds } from '../../src/testIds.ts';
import {
  assertDisplayed,
  navigateToFormat,
  waitForGalleryHome,
} from '../helpers/gallery.ts';

describe('GMA gallery navigation/container smoke (secondary; no ad-load assertion)', () => {
  before(async () => {
    await waitForGalleryHome();
    console.log(
      `${STARTUP_READY_MARKER} ${JSON.stringify({ platform: driver.isAndroid ? 'android' : 'ios', spec: 'b-secondary' })}`,
    );
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
