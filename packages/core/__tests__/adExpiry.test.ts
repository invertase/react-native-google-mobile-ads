import { AdStalenessGuidanceMillis } from '../src/types/AdExpiry';
import { createAdExpiry, resolveStalenessWindow } from '../src/internal/adExpiry';

describe('adExpiry', () => {
  describe('resolveStalenessWindow', () => {
    it('prefers a configured window', () => {
      expect(resolveStalenessWindow({ stalenessWindowMillis: 12_000, format: 'app_open' })).toEqual({
        stalenessWindowMillis: 12_000,
        stalenessWindowSource: 'configured',
      });
    });

    it('uses app-open guidance by default for that format', () => {
      expect(resolveStalenessWindow({ format: 'app_open' })).toEqual({
        stalenessWindowMillis: AdStalenessGuidanceMillis.APP_OPEN,
        stalenessWindowSource: 'guidance/app-open',
      });
    });

    it('uses other guidance otherwise', () => {
      expect(resolveStalenessWindow({})).toEqual({
        stalenessWindowMillis: AdStalenessGuidanceMillis.OTHER,
        stalenessWindowSource: 'guidance/other',
      });
    });
  });

  describe('createAdExpiry', () => {
    afterEach(() => {
      jest.useRealTimers();
    });

    it('treats null observedAt as never stale and never fires', () => {
      const expiry = createAdExpiry({
        observedAt: null,
        stalenessWindowMillis: 1000,
        now: () => 10_000,
      });
      const listener = jest.fn();
      expiry.onStaleByPolicy(listener);
      expect(expiry.isStaleByPolicy()).toBe(false);
      expect(listener).not.toHaveBeenCalled();
      expiry.clear();
    });

    it('invokes synchronously when already stale on subscribe', () => {
      const expiry = createAdExpiry({
        observedAt: 0,
        stalenessWindowMillis: 1000,
        now: () => 5000,
      });
      expect(expiry.isStaleByPolicy()).toBe(true);
      const listener = jest.fn();
      expiry.onStaleByPolicy(listener);
      expect(listener).toHaveBeenCalledTimes(1);
      expiry.clear();
    });

    it('fires once when the policy window elapses', () => {
      jest.useFakeTimers();
      let now = 1000;
      const expiry = createAdExpiry({
        observedAt: 1000,
        stalenessWindowMillis: 500,
        now: () => now,
      });
      const listener = jest.fn();
      expiry.onStaleByPolicy(listener);
      expect(listener).not.toHaveBeenCalled();
      now = 1600;
      jest.advanceTimersByTime(500);
      expect(listener).toHaveBeenCalledTimes(1);
      jest.advanceTimersByTime(500);
      expect(listener).toHaveBeenCalledTimes(1);
      expiry.clear();
    });

    it('clear makes later unsubscribe a no-op and stops the timer', () => {
      jest.useFakeTimers();
      const expiry = createAdExpiry({
        observedAt: 0,
        stalenessWindowMillis: 1000,
        now: () => 0,
      });
      const listener = jest.fn();
      const unsub = expiry.onStaleByPolicy(listener);
      expiry.clear();
      unsub();
      jest.advanceTimersByTime(2000);
      expect(listener).not.toHaveBeenCalled();
    });

    it('clear is idempotent and subscribe-after-clear returns a noop unsub', () => {
      jest.useFakeTimers();
      const expiry = createAdExpiry({
        observedAt: 0,
        stalenessWindowMillis: 1000,
        now: () => 0,
      });
      expiry.clear();
      expiry.clear();
      const listener = jest.fn();
      const unsub = expiry.onStaleByPolicy(listener);
      unsub();
      jest.advanceTimersByTime(2000);
      expect(listener).not.toHaveBeenCalled();
    });

    it('sync stale subscribe clears a pending timer and swallows listener throws', () => {
      jest.useFakeTimers();
      let now = 1000;
      const expiry = createAdExpiry({
        observedAt: 1000,
        stalenessWindowMillis: 500,
        now: () => now,
      });
      now = 2000;
      expect(() =>
        expiry.onStaleByPolicy(() => {
          throw new Error('consumer boom');
        }),
      ).not.toThrow();
      // Already-stale subscribers are still invoked synchronously once each.
      const late = jest.fn();
      expiry.onStaleByPolicy(late);
      expect(late).toHaveBeenCalledTimes(1);
      jest.advanceTimersByTime(500);
      expect(late).toHaveBeenCalledTimes(1);
      expiry.clear();
    });

    it('uses Date.now when now is omitted and fires via the pending timer', () => {
      jest.useFakeTimers();
      const realNow = Date.now();
      jest.setSystemTime(realNow);
      const expiry = createAdExpiry({
        observedAt: realNow,
        stalenessWindowMillis: 250,
      });
      const listener = jest.fn();
      expiry.onStaleByPolicy(listener);
      expect(listener).not.toHaveBeenCalled();
      jest.setSystemTime(realNow + 250);
      jest.advanceTimersByTime(250);
      expect(listener).toHaveBeenCalledTimes(1);
      expiry.clear();
    });

    it('fireEdge is a no-op when already fired or cleared', () => {
      jest.useFakeTimers();
      const pending: Array<() => void> = [];
      const setTimeoutSpy = jest
        .spyOn(global, 'setTimeout')
        .mockImplementation(((fn: TimerHandler) => {
          if (typeof fn === 'function') {
            pending.push(fn as () => void);
          }
          return 0 as unknown as ReturnType<typeof setTimeout>;
        }) as typeof setTimeout);

      try {
        const expiry = createAdExpiry({
          observedAt: 0,
          stalenessWindowMillis: 1000,
          now: () => 0,
        });
        expect(pending).toHaveLength(1);
        const fireEdge = pending[0];
        const listener = jest.fn();
        expiry.onStaleByPolicy(listener);
        fireEdge();
        expect(listener).toHaveBeenCalledTimes(1);
        fireEdge();
        expect(listener).toHaveBeenCalledTimes(1);

        const again = createAdExpiry({
          observedAt: 0,
          stalenessWindowMillis: 1000,
          now: () => 0,
        });
        expect(pending).toHaveLength(2);
        again.clear();
        pending[1]();
      } finally {
        setTimeoutSpy.mockRestore();
      }
    });

    it('swallows throws from timer-fired listeners', () => {
      jest.useFakeTimers();
      let now = 1000;
      const expiry = createAdExpiry({
        observedAt: 1000,
        stalenessWindowMillis: 500,
        now: () => now,
      });
      const ok = jest.fn();
      expiry.onStaleByPolicy(() => {
        throw new Error('boom');
      });
      expiry.onStaleByPolicy(ok);
      now = 1600;
      expect(() => jest.advanceTimersByTime(500)).not.toThrow();
      expect(ok).toHaveBeenCalledTimes(1);
      expiry.clear();
    });
  });
});
