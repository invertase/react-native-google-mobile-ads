import {
  NAVIGATION_SMOKE_PRIMARY,
  REPRESENTATIVE_REQUEST_OUTCOME_CONTRACTS,
} from '../../src/formats.ts';
import { AppiumTestIds } from '../../src/testIds.ts';
import {
  assertDisplayed,
  navigateToFormat,
  proveRepresentativeRequestOutcome,
  waitForGalleryHome,
} from '../helpers/gallery.ts';

describe('GMA gallery navigation smoke and representative request outcomes (primary)', () => {
  before(async () => {
    await waitForGalleryHome();
  });

  it('shows gallery home with stable root testID', async () => {
    await assertDisplayed(AppiumTestIds.root);
    await assertDisplayed(AppiumTestIds.gallery);
  });

  describe('navigation/container smoke (does not assert ad load)', () => {
    for (const format of NAVIGATION_SMOKE_PRIMARY) {
      it(`opens ${format.title}`, async () => {
        await navigateToFormat(format);
      });
    }
  });

  describe('representative Google test-ID request-outcome contracts', () => {
    for (const format of REPRESENTATIVE_REQUEST_OUTCOME_CONTRACTS) {
      it(`proves ${format.title}`, async () => {
        await proveRepresentativeRequestOutcome(format);
      });
    }
  });
});
