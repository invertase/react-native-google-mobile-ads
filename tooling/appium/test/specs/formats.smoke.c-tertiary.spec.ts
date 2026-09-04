import { SMOKE_FORMATS_TERTIARY } from '../../src/formats.ts';
import { AppiumTestIds } from '../../src/testIds.ts';
import {
  assertDisplayed,
  smokeFormat,
  waitForGalleryHome,
} from '../helpers/gallery.ts';

describe('GMA format gallery smoke (tertiary)', () => {
  before(async () => {
    await waitForGalleryHome();
  });

  it('shows gallery home with stable root testID', async () => {
    await assertDisplayed(AppiumTestIds.root);
    await assertDisplayed(AppiumTestIds.gallery);
  });

  for (const format of SMOKE_FORMATS_TERTIARY) {
    it(`opens ${format.title}`, async () => {
      await smokeFormat({
        formatId: format.id,
        containerId: format.containerId,
        actionId: format.actionId,
        galleryTitle: format.title,
        expectLoadedSubstring: format.expectLoadedSubstring,
        actionAccessibilityLabel: format.actionAccessibilityLabel,
      });
    });
  }
});
