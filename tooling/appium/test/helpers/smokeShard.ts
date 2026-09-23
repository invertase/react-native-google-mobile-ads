import { smokeShard, type ShardId, type SmokeShardCase } from '../../src/sessionShards.ts';
import { STARTUP_READY_MARKER } from '../../src/startupSupervisor.ts';
import { AppiumTestIds } from '../../src/testIds.ts';
import {
  assertDisplayed,
  navigateToFormat,
  proveProbeStatus,
  proveRepresentativeRequestOutcome,
  proveSdkUtilitySurface,
  waitForGalleryHome,
} from './gallery.ts';

/**
 * One WDIO session per derived shard. Case membership and the per-session test
 * count come from `sessionShards.ts`; this body only dispatches by case kind.
 */
export function describeSmokeShard(id: ShardId): void {
  const shard = smokeShard(id);

  describe(`GMA gallery smoke shard ${shard.id}`, () => {
    before(async () => {
      await waitForGalleryHome();
      console.log(
        `${STARTUP_READY_MARKER} ${JSON.stringify({ platform: driver.isAndroid ? 'android' : 'ios', spec: shard.id })}`,
      );
    });

    it('shows gallery home with stable root testID', async () => {
      await assertDisplayed(AppiumTestIds.root);
      await assertDisplayed(AppiumTestIds.gallery);
    });

    for (const smokeCase of shard.cases) {
      it(smokeCase.testTitle, async () => {
        switch (smokeCase.kind) {
          case 'navigation':
            await navigateToFormat(smokeCase.navigation);
            return;
          case 'request-outcome':
            await proveRepresentativeRequestOutcome(smokeCase.contract);
            return;
          case 'utility-surface':
            await proveSdkUtilitySurface(smokeCase.utility);
            return;
          case 'probe':
            await proveProbeStatus({
              formatId: smokeCase.probe.id,
              containerId: smokeCase.probe.containerId,
              galleryTitle: smokeCase.probe.title,
              actionId: smokeCase.probe.actionId,
              expectedStatusText: smokeCase.probe.expectedStatusText,
              expectedStatusMarkers: smokeCase.probe.expectedStatusMarkers,
              expectedPingByPlatform: smokeCase.probe.expectedPingByPlatform,
              actionAccessibilityLabel: smokeCase.probe.actionAccessibilityLabel,
            });
            return;
          default: {
            const _exhaustive: never = smokeCase;
            throw new Error(`Unhandled smoke case kind: ${(_exhaustive as SmokeShardCase).kind}`);
          }
        }
      });
    }
  });
}
