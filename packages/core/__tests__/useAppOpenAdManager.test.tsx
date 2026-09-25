import React from 'react';
import { act, render } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';

import { AdEventType, AppOpenAd, TestIds, useAppOpenAdManager } from '../src';
import type { UseAppOpenAdManagerResult } from '../src';
import { AdStalenessGuidanceMillis } from '../src/types/AdExpiry';
import type { AdError } from '../src/types/AdError';
import {
  __resetFullscreenAdPresenceForTests,
  markFullscreenAdClosed,
  markFullscreenAdOpened,
} from '../src/internal/fullscreenAdPresence';

type TestAdEventsListener = (event: { type: AdEventType; payload: unknown }) => void;
type ChangeHandler = (status: AppStateStatus) => void;

const addEventListener = AppState.addEventListener as unknown as jest.Mock;

function changeHandlers(): ChangeHandler[] {
  return addEventListener.mock.calls
    .filter(([event]) => event === 'change')
    .map(([, handler]) => handler as ChangeHandler);
}

function enterForeground() {
  act(() => {
    changeHandlers().forEach(handler => {
      handler('background');
      handler('active');
    });
  });
}

function createTestAppOpenAd() {
  let listener: TestAdEventsListener | undefined;
  const destroy = jest.fn();
  const load = jest.fn();
  const show = jest.fn(() => Promise.resolve()) as jest.Mock<Promise<void>, []>;
  const ad = {
    addAdEventsListener: jest.fn((nextListener: TestAdEventsListener) => {
      listener = nextListener;
      return jest.fn();
    }),
    destroy,
    load,
    show,
  } as unknown as AppOpenAd;

  return {
    ad,
    destroy,
    load,
    show,
    emit(type: AdEventType, payload?: unknown) {
      listener?.({ type, payload });
    },
  };
}

function createShowError(): AdError {
  return Object.assign(new Error('show-failed'), {
    code: 'googleMobileAds/internal-error',
    reason: 'internal-error',
    phase: 'show',
    responseInfo: null,
  }) as AdError;
}

describe('useAppOpenAdManager', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
    addEventListener.mockClear();
    // AO-2: reset the process-wide fullscreen-ad-presence singleton so state
    // never leaks between tests.
    __resetFullscreenAdPresenceForTests();
  });

  it('preloads on mount and does not show on first cold start', async () => {
    const fake = createTestAppOpenAd();
    jest.spyOn(AppOpenAd, 'createForAdRequest').mockReturnValue(fake.ad);
    let result: UseAppOpenAdManagerResult | undefined;

    function Probe() {
      result = useAppOpenAdManager({ adUnitId: TestIds.APP_OPEN });
      return null;
    }

    render(<Probe />);

    expect(result!.status).toBe('loading');
    expect(fake.load).toHaveBeenCalledTimes(1);
    expect(fake.show).not.toHaveBeenCalled();

    act(() => {
      fake.emit(AdEventType.LOADED);
    });

    expect(result).toMatchObject({
      status: 'loaded',
      isShowing: false,
    });
    // Cold start: AppState never went background → active, so no auto-show.
    expect(fake.show).not.toHaveBeenCalled();
  });

  it('shows on warm foreground only when a fresh ad is available', async () => {
    const fake = createTestAppOpenAd();
    jest.spyOn(AppOpenAd, 'createForAdRequest').mockReturnValue(fake.ad);
    let result: UseAppOpenAdManagerResult | undefined;

    function Probe() {
      result = useAppOpenAdManager({ adUnitId: TestIds.APP_OPEN });
      return null;
    }

    render(<Probe />);
    act(() => {
      fake.emit(AdEventType.LOADED);
    });
    expect(fake.show).not.toHaveBeenCalled();

    enterForeground();

    expect(fake.show).toHaveBeenCalledTimes(1);
    expect(result!.isShowing).toBe(true);

    act(() => {
      fake.emit(AdEventType.OPENED);
    });
    expect(result!.status).toBe('showing');
  });

  it('does not show a stale (>4h) ad and triggers reload instead', () => {
    jest.useFakeTimers({ now: 1_000_000 });
    const first = createTestAppOpenAd();
    const second = createTestAppOpenAd();
    jest
      .spyOn(AppOpenAd, 'createForAdRequest')
      .mockReturnValueOnce(first.ad)
      .mockReturnValueOnce(second.ad);
    let result: UseAppOpenAdManagerResult | undefined;

    function Probe() {
      result = useAppOpenAdManager({ adUnitId: TestIds.APP_OPEN });
      return null;
    }

    render(<Probe />);
    act(() => {
      first.emit(AdEventType.LOADED);
    });
    expect(result!.status).toBe('loaded');

    act(() => {
      jest.advanceTimersByTime(AdStalenessGuidanceMillis.APP_OPEN + 1);
    });

    enterForeground();

    expect(first.show).not.toHaveBeenCalled();
    expect(first.destroy).toHaveBeenCalled();
    expect(second.load).toHaveBeenCalledTimes(1);
    expect(result!.status).toBe('loading');
  });

  it('isShowing guard prevents a second show while an ad is up', () => {
    const fake = createTestAppOpenAd();
    jest.spyOn(AppOpenAd, 'createForAdRequest').mockReturnValue(fake.ad);
    let result: UseAppOpenAdManagerResult | undefined;

    function Probe() {
      result = useAppOpenAdManager({ adUnitId: TestIds.APP_OPEN });
      return null;
    }

    render(<Probe />);
    act(() => {
      fake.emit(AdEventType.LOADED);
    });

    act(() => {
      result!.showAdIfAvailable();
    });
    expect(fake.show).toHaveBeenCalledTimes(1);
    expect(result!.isShowing).toBe(true);

    act(() => {
      result!.showAdIfAvailable();
      enterForeground();
    });
    expect(fake.show).toHaveBeenCalledTimes(1);
  });

  it('reloads after close', () => {
    jest.useFakeTimers();
    const first = createTestAppOpenAd();
    const second = createTestAppOpenAd();
    jest
      .spyOn(AppOpenAd, 'createForAdRequest')
      .mockReturnValueOnce(first.ad)
      .mockReturnValueOnce(second.ad);
    let result: UseAppOpenAdManagerResult | undefined;

    function Probe() {
      result = useAppOpenAdManager({ adUnitId: TestIds.APP_OPEN });
      return null;
    }

    render(<Probe />);
    act(() => {
      first.emit(AdEventType.LOADED);
    });
    act(() => {
      result!.showAdIfAvailable();
    });
    act(() => {
      first.emit(AdEventType.OPENED);
    });

    act(() => {
      first.emit(AdEventType.CLOSED);
    });
    act(() => {
      jest.runOnlyPendingTimers();
    });

    expect(result!.status).toBe('loading');
    expect(result!.isShowing).toBe(false);
    expect(first.destroy).toHaveBeenCalled();
    expect(second.load).toHaveBeenCalledTimes(1);
  });

  it('reloads after a show-phase error', () => {
    jest.useFakeTimers();
    const first = createTestAppOpenAd();
    const second = createTestAppOpenAd();
    jest
      .spyOn(AppOpenAd, 'createForAdRequest')
      .mockReturnValueOnce(first.ad)
      .mockReturnValueOnce(second.ad);
    let result: UseAppOpenAdManagerResult | undefined;

    function Probe() {
      result = useAppOpenAdManager({ adUnitId: TestIds.APP_OPEN });
      return null;
    }

    render(<Probe />);
    act(() => {
      first.emit(AdEventType.LOADED);
    });
    act(() => {
      result!.showAdIfAvailable();
    });

    act(() => {
      first.emit(AdEventType.ERROR, createShowError());
    });
    act(() => {
      jest.runOnlyPendingTimers();
    });

    expect(result!.isShowing).toBe(false);
    expect(first.destroy).toHaveBeenCalled();
    expect(second.load).toHaveBeenCalledTimes(1);
  });

  it('exposes showAdIfAvailable for cold-start loading screens', () => {
    const fake = createTestAppOpenAd();
    jest.spyOn(AppOpenAd, 'createForAdRequest').mockReturnValue(fake.ad);
    let result: UseAppOpenAdManagerResult | undefined;

    function Probe() {
      result = useAppOpenAdManager({ adUnitId: TestIds.APP_OPEN });
      return null;
    }

    render(<Probe />);
    act(() => {
      fake.emit(AdEventType.LOADED);
    });

    act(() => {
      result!.showAdIfAvailable();
    });

    expect(fake.show).toHaveBeenCalledTimes(1);
  });

  it('stays idle when adUnitId is null and autoLoad is off', () => {
    const create = jest.spyOn(AppOpenAd, 'createForAdRequest');
    let result: UseAppOpenAdManagerResult | undefined;

    function Probe() {
      result = useAppOpenAdManager({ adUnitId: null, autoLoad: false });
      return null;
    }

    render(<Probe />);
    expect(result).toMatchObject({ status: 'idle', isShowing: false });
    expect(create).not.toHaveBeenCalled();

    act(() => {
      result!.showAdIfAvailable();
    });
    expect(create).not.toHaveBeenCalled();
  });

  it('maps load-phase no-fill and other load errors', () => {
    const noFill = createTestAppOpenAd();
    jest.spyOn(AppOpenAd, 'createForAdRequest').mockReturnValue(noFill.ad);
    let result: UseAppOpenAdManagerResult | undefined;

    function Probe({ adUnitId }: { adUnitId: string }) {
      result = useAppOpenAdManager({ adUnitId });
      return null;
    }

    const view = render(<Probe adUnitId={TestIds.APP_OPEN} />);
    act(() => {
      noFill.emit(
        AdEventType.ERROR,
        Object.assign(new Error('no-fill'), {
          code: 'googleMobileAds/no-fill',
          reason: 'no-fill',
          phase: 'load',
          responseInfo: null,
        }) as AdError,
      );
    });
    expect(result!.status).toBe('no-fill');
    expect(noFill.destroy).toHaveBeenCalled();

    const other = createTestAppOpenAd();
    (AppOpenAd.createForAdRequest as jest.Mock).mockReturnValue(other.ad);
    view.rerender(<Probe adUnitId="unit-b" />);
    act(() => {
      other.emit(
        AdEventType.ERROR,
        Object.assign(new Error('network-error'), {
          code: 'googleMobileAds/network-error',
          reason: 'network-error',
          phase: 'load',
          responseInfo: null,
        }) as AdError,
      );
    });
    expect(result!.status).toBe('error');
  });

  it('maps mediation-no-fill on the load path', () => {
    const fake = createTestAppOpenAd();
    jest.spyOn(AppOpenAd, 'createForAdRequest').mockReturnValue(fake.ad);
    let result: UseAppOpenAdManagerResult | undefined;

    function Probe() {
      result = useAppOpenAdManager({ adUnitId: TestIds.APP_OPEN });
      return null;
    }

    render(<Probe />);
    act(() => {
      fake.emit(
        AdEventType.ERROR,
        Object.assign(new Error('mediation-no-fill'), {
          code: 'googleMobileAds/mediation-no-fill',
          reason: 'mediation-no-fill',
          phase: 'load',
          responseInfo: null,
        }) as AdError,
      );
    });
    expect(result!.status).toBe('no-fill');
  });

  it('maps synchronous createForAdRequest throws to error', () => {
    jest.spyOn(AppOpenAd, 'createForAdRequest').mockImplementation(() => {
      throw new Error('bad unit');
    });
    let result: UseAppOpenAdManagerResult | undefined;

    function Probe() {
      result = useAppOpenAdManager({ adUnitId: TestIds.APP_OPEN });
      return null;
    }

    render(<Probe />);
    expect(result!.status).toBe('error');
  });

  it('ignores events after unmount and no-ops showAdIfAvailable', async () => {
    const fake = createTestAppOpenAd();
    jest.spyOn(AppOpenAd, 'createForAdRequest').mockReturnValue(fake.ad);
    let result: UseAppOpenAdManagerResult | undefined;

    function Probe() {
      result = useAppOpenAdManager({ adUnitId: TestIds.APP_OPEN });
      return null;
    }

    const view = render(<Probe />);
    const savedShow = result!.showAdIfAvailable;
    view.unmount();

    act(() => {
      fake.emit(AdEventType.LOADED);
      savedShow();
    });
    expect(fake.show).not.toHaveBeenCalled();
  });

  it('ignores non-lifecycle ad events and skips reload when already loading', () => {
    const fake = createTestAppOpenAd();
    const create = jest.spyOn(AppOpenAd, 'createForAdRequest').mockReturnValue(fake.ad);
    let result: UseAppOpenAdManagerResult | undefined;

    function Probe() {
      result = useAppOpenAdManager({ adUnitId: TestIds.APP_OPEN });
      return null;
    }

    render(<Probe />);
    expect(create).toHaveBeenCalledTimes(1);
    expect(result!.status).toBe('loading');

    act(() => {
      fake.emit(AdEventType.CLICKED);
      // Still loading — showAdIfAvailable should not start a second create.
      result!.showAdIfAvailable();
    });
    expect(create).toHaveBeenCalledTimes(1);

    act(() => {
      fake.emit(AdEventType.LOADED);
    });
    // Fresh ad held — attachAndLoad via show when already available is a no-op load.
    const loadsBefore = fake.load.mock.calls.length;
    act(() => {
      // Force attachAndLoad early-return on isAdAvailable by calling show (shows) then
      // nothing else — covered by isShowing guard separately. Here ensure create count
      // stays put after a redundant foreground while loaded.
      enterForeground();
    });
    expect(create).toHaveBeenCalledTimes(1);
    expect(fake.load.mock.calls.length).toBe(loadsBefore);
  });

  it('reloads when show() promise rejects', async () => {
    const first = createTestAppOpenAd();
    first.show.mockReturnValue(Promise.reject(new Error('declined')));
    const second = createTestAppOpenAd();
    jest
      .spyOn(AppOpenAd, 'createForAdRequest')
      .mockReturnValueOnce(first.ad)
      .mockReturnValueOnce(second.ad);
    let result: UseAppOpenAdManagerResult | undefined;

    function Probe() {
      result = useAppOpenAdManager({ adUnitId: TestIds.APP_OPEN });
      return null;
    }

    render(<Probe />);
    act(() => {
      first.emit(AdEventType.LOADED);
    });

    await act(async () => {
      result!.showAdIfAvailable();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result!.status).toBe('loading');
    expect(result!.isShowing).toBe(false);
    expect(first.destroy).toHaveBeenCalled();
    expect(second.load).toHaveBeenCalledTimes(1);
  });

  it('swallows show() rejection after unmount without reload', async () => {
    const fake = createTestAppOpenAd();
    let rejectShow!: (error: Error) => void;
    fake.show.mockReturnValue(
      new Promise((_resolve, reject) => {
        rejectShow = reject;
      }),
    );
    jest.spyOn(AppOpenAd, 'createForAdRequest').mockReturnValue(fake.ad);
    let result: UseAppOpenAdManagerResult | undefined;

    function Probe() {
      result = useAppOpenAdManager({ adUnitId: TestIds.APP_OPEN });
      return null;
    }

    const view = render(<Probe />);
    act(() => {
      fake.emit(AdEventType.LOADED);
    });
    act(() => {
      result!.showAdIfAvailable();
    });
    view.unmount();

    await act(async () => {
      rejectShow(new Error('declined'));
      await Promise.resolve();
      await Promise.resolve();
    });

    // Unmounted — no second create for reload.
    expect(AppOpenAd.createForAdRequest).toHaveBeenCalledTimes(1);
  });

  it('no-ops attachAndLoad when a fresh ad is already held (autoLoad flip)', () => {
    const fake = createTestAppOpenAd();
    const create = jest.spyOn(AppOpenAd, 'createForAdRequest').mockReturnValue(fake.ad);
    let result: UseAppOpenAdManagerResult | undefined;

    function Probe({ autoLoad }: { autoLoad: boolean }) {
      result = useAppOpenAdManager({ adUnitId: TestIds.APP_OPEN, autoLoad });
      return null;
    }

    const view = render(<Probe autoLoad />);
    act(() => {
      fake.emit(AdEventType.LOADED);
    });
    expect(create).toHaveBeenCalledTimes(1);

    view.rerender(<Probe autoLoad={false} />);
    view.rerender(<Probe autoLoad />);
    expect(create).toHaveBeenCalledTimes(1);
    expect(result!.status).toBe('loaded');
  });

  it('skips post-close reload when unmounted before the deferred reload', () => {
    jest.useFakeTimers();
    const fake = createTestAppOpenAd();
    const create = jest.spyOn(AppOpenAd, 'createForAdRequest').mockReturnValue(fake.ad);
    let result: UseAppOpenAdManagerResult | undefined;

    function Probe() {
      result = useAppOpenAdManager({ adUnitId: TestIds.APP_OPEN });
      return null;
    }

    const view = render(<Probe />);
    act(() => {
      fake.emit(AdEventType.LOADED);
    });
    act(() => {
      result!.showAdIfAvailable();
      fake.emit(AdEventType.OPENED);
    });

    const createsBeforeClose = create.mock.calls.length;
    act(() => {
      fake.emit(AdEventType.CLOSED);
    });
    view.unmount();
    act(() => {
      jest.runOnlyPendingTimers();
    });

    expect(create.mock.calls.length).toBe(createsBeforeClose);
  });

  it('skips post-close reload when adUnitId becomes null before the deferred reload', () => {
    jest.useFakeTimers();
    const fake = createTestAppOpenAd();
    const create = jest.spyOn(AppOpenAd, 'createForAdRequest').mockReturnValue(fake.ad);
    let result: UseAppOpenAdManagerResult | undefined;

    function Probe({ adUnitId }: { adUnitId: string | null }) {
      result = useAppOpenAdManager({ adUnitId });
      return null;
    }

    const view = render(<Probe adUnitId={TestIds.APP_OPEN} />);
    act(() => {
      fake.emit(AdEventType.LOADED);
    });
    act(() => {
      result!.showAdIfAvailable();
      fake.emit(AdEventType.OPENED);
    });

    const createsBeforeClose = create.mock.calls.length;
    act(() => {
      fake.emit(AdEventType.CLOSED);
    });
    view.rerender(<Probe adUnitId={null} />);
    act(() => {
      jest.runOnlyPendingTimers();
    });

    expect(create.mock.calls.length).toBe(createsBeforeClose);
    expect(result!.status).toBe('idle');
  });

  // AO-1: autoLoad is the master request gate. While false, no path loads.
  it('does not load on warm foreground while autoLoad is false', () => {
    const create = jest.spyOn(AppOpenAd, 'createForAdRequest');
    let result: UseAppOpenAdManagerResult | undefined;

    function Probe() {
      result = useAppOpenAdManager({ adUnitId: TestIds.APP_OPEN, autoLoad: false });
      return null;
    }

    render(<Probe />);
    expect(create).not.toHaveBeenCalled();

    enterForeground();

    expect(create).not.toHaveBeenCalled();
    expect(result!.status).toBe('idle');
    expect(result!.isShowing).toBe(false);
  });

  it('showAdIfAvailable does not load while autoLoad is false and no ad is held', () => {
    const create = jest.spyOn(AppOpenAd, 'createForAdRequest');
    let result: UseAppOpenAdManagerResult | undefined;

    function Probe() {
      result = useAppOpenAdManager({ adUnitId: TestIds.APP_OPEN, autoLoad: false });
      return null;
    }

    render(<Probe />);
    act(() => {
      result!.showAdIfAvailable();
    });

    expect(create).not.toHaveBeenCalled();
    expect(result!.isShowing).toBe(false);
    expect(result!.status).toBe('idle');
  });

  it('still shows an already-held fresh ad via showAdIfAvailable after autoLoad flips false', () => {
    const fake = createTestAppOpenAd();
    const create = jest.spyOn(AppOpenAd, 'createForAdRequest').mockReturnValue(fake.ad);
    let result: UseAppOpenAdManagerResult | undefined;

    function Probe({ autoLoad }: { autoLoad: boolean }) {
      result = useAppOpenAdManager({ adUnitId: TestIds.APP_OPEN, autoLoad });
      return null;
    }

    const view = render(<Probe autoLoad />);
    act(() => {
      fake.emit(AdEventType.LOADED);
    });
    expect(create).toHaveBeenCalledTimes(1);

    // Consent withdrawn / not ready: no new request, but a held fresh ad shows.
    view.rerender(<Probe autoLoad={false} />);
    act(() => {
      result!.showAdIfAvailable();
    });

    expect(fake.show).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledTimes(1);
    expect(result!.isShowing).toBe(true);
  });

  // AO-1: the post-close reload path (CLOSED → scheduleReload → attachAndLoad)
  // must also honour the autoLoad gate. If consent is withdrawn while an ad is
  // showing, closing it must not silently issue a fresh request.
  it('does not reload after CLOSED while autoLoad is false', () => {
    jest.useFakeTimers();
    const first = createTestAppOpenAd();
    const second = createTestAppOpenAd();
    const create = jest
      .spyOn(AppOpenAd, 'createForAdRequest')
      .mockReturnValueOnce(first.ad)
      .mockReturnValueOnce(second.ad);
    let result: UseAppOpenAdManagerResult | undefined;

    function Probe({ autoLoad }: { autoLoad: boolean }) {
      result = useAppOpenAdManager({ adUnitId: TestIds.APP_OPEN, autoLoad });
      return null;
    }

    const view = render(<Probe autoLoad />);
    act(() => {
      first.emit(AdEventType.LOADED);
    });
    act(() => {
      result!.showAdIfAvailable();
    });
    act(() => {
      first.emit(AdEventType.OPENED);
    });

    // Consent withdrawn before the ad closes.
    view.rerender(<Probe autoLoad={false} />);

    act(() => {
      first.emit(AdEventType.CLOSED);
    });
    act(() => {
      jest.runOnlyPendingTimers();
    });

    // Post-close reload is gated: no second ad requested or loaded.
    expect(create).toHaveBeenCalledTimes(1);
    expect(second.load).not.toHaveBeenCalled();
    expect(result!.status).toBe('closed');
  });

  // AO-2: a genuine app return (home / app-switcher) must still auto-show. No
  // library fullscreen ad is presenting, so the presence signal is absent.
  it('auto-shows on a genuine warm-foreground app return (no library ad presenting)', () => {
    const fake = createTestAppOpenAd();
    jest.spyOn(AppOpenAd, 'createForAdRequest').mockReturnValue(fake.ad);
    let result: UseAppOpenAdManagerResult | undefined;

    function Probe() {
      result = useAppOpenAdManager({ adUnitId: TestIds.APP_OPEN });
      return null;
    }

    render(<Probe />);
    act(() => {
      fake.emit(AdEventType.LOADED);
    });

    // Nothing is presenting → the foreground return is genuine → show.
    enterForeground();

    expect(fake.show).toHaveBeenCalledTimes(1);
    expect(result!.isShowing).toBe(true);
  });

  // AO-2: a warm foreground caused purely by a *library* fullscreen ad Activity
  // (e.g. an interstitial) dismissing must NOT auto-show an app-open ad, or two
  // fullscreen ads would stack back-to-back. The caller-driven cold-start path
  // (showAdIfAvailable) is intentionally still allowed.
  it('does not auto-show on the foreground triggered by a library fullscreen ad closing', () => {
    const fake = createTestAppOpenAd();
    jest.spyOn(AppOpenAd, 'createForAdRequest').mockReturnValue(fake.ad);
    let result: UseAppOpenAdManagerResult | undefined;

    function Probe() {
      result = useAppOpenAdManager({ adUnitId: TestIds.APP_OPEN });
      return null;
    }

    render(<Probe />);
    act(() => {
      fake.emit(AdEventType.LOADED);
    });

    // Simulate another library fullscreen ad (interstitial) opening then closing
    // — exactly what raises/lowers the process-wide presence signal on device.
    // On close, a short grace window keeps "presenting" true to absorb the
    // AppState settle, so the immediately-following background → active is
    // recognised as ad-driven, not a real app return.
    act(() => {
      markFullscreenAdOpened();
      markFullscreenAdClosed();
    });

    enterForeground();

    expect(fake.show).not.toHaveBeenCalled();
    expect(result!.isShowing).toBe(false);
    // Cold-start / caller-driven path is unaffected by the suppression.
    act(() => {
      result!.showAdIfAvailable();
    });
    expect(fake.show).toHaveBeenCalledTimes(1);
    expect(result!.isShowing).toBe(true);
  });

  // AO-2: while a library fullscreen ad is still OPEN (not yet closed), a warm
  // foreground must also be suppressed — covers the on-device ordering where
  // AppState `active` arrives *before* the interstitial's CLOSED event.
  it('does not auto-show while a library fullscreen ad is still presenting', () => {
    const fake = createTestAppOpenAd();
    jest.spyOn(AppOpenAd, 'createForAdRequest').mockReturnValue(fake.ad);

    function Probe() {
      useAppOpenAdManager({ adUnitId: TestIds.APP_OPEN });
      return null;
    }

    render(<Probe />);
    act(() => {
      fake.emit(AdEventType.LOADED);
    });

    act(() => {
      markFullscreenAdOpened(); // interstitial Activity is up, no CLOSED yet
    });

    enterForeground();

    expect(fake.show).not.toHaveBeenCalled();
  });

  // AO-2: once the post-close grace window elapses, a later genuine foreground
  // return resumes auto-showing (the suppression is bounded, not permanent).
  it('resumes auto-show on a later genuine foreground after the ad-close grace elapses', () => {
    jest.useFakeTimers({ now: 5_000_000 });
    const fake = createTestAppOpenAd();
    jest.spyOn(AppOpenAd, 'createForAdRequest').mockReturnValue(fake.ad);

    function Probe() {
      useAppOpenAdManager({ adUnitId: TestIds.APP_OPEN });
      return null;
    }

    render(<Probe />);
    act(() => {
      fake.emit(AdEventType.LOADED);
    });

    act(() => {
      markFullscreenAdOpened();
      markFullscreenAdClosed(); // arms a 1s grace window from "now"
    });

    // Foreground within the grace window: suppressed.
    enterForeground();
    expect(fake.show).not.toHaveBeenCalled();

    // Advance well past the grace window, then a genuine return: shows.
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    enterForeground();
    expect(fake.show).toHaveBeenCalledTimes(1);
  });
});
