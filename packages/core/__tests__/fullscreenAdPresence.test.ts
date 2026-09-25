import {
  __resetFullscreenAdPresenceForTests,
  isFullscreenAdPresenting,
  markFullscreenAdClosed,
  markFullscreenAdOpened,
} from '../src/internal/fullscreenAdPresence';

// A `now` far past any grace window, used to probe the *strict* counter state
// (count > 0) independently of the post-close grace window.
const PAST_GRACE = (): number => Date.now() + 60_000;

describe('fullscreenAdPresence (AO-2 signal)', () => {
  afterEach(() => {
    __resetFullscreenAdPresenceForTests();
  });

  it('is absent by default', () => {
    expect(isFullscreenAdPresenting(PAST_GRACE())).toBe(false);
  });

  it('is present while an ad is open, and balances on close after the grace window', () => {
    markFullscreenAdOpened();
    expect(isFullscreenAdPresenting(PAST_GRACE())).toBe(true);

    markFullscreenAdClosed();
    // Within the grace window it is still reported present (absorbs the
    // AppState settle around CLOSED); well past the window it is absent.
    expect(isFullscreenAdPresenting()).toBe(true);
    expect(isFullscreenAdPresenting(PAST_GRACE())).toBe(false);
  });

  it('counts nested/overlapping presentations; grace is armed only at zero', () => {
    markFullscreenAdOpened();
    markFullscreenAdOpened();
    // count === 2 → strictly presenting regardless of grace.
    expect(isFullscreenAdPresenting(PAST_GRACE())).toBe(true);

    markFullscreenAdClosed();
    // count === 1 → still strictly presenting (not merely in grace).
    expect(isFullscreenAdPresenting(PAST_GRACE())).toBe(true);

    markFullscreenAdClosed();
    // count === 0 → grace armed: present now, absent past the window.
    expect(isFullscreenAdPresenting()).toBe(true);
    expect(isFullscreenAdPresenting(PAST_GRACE())).toBe(false);
  });

  it('ignores an unbalanced close (never goes negative) and does not arm grace', () => {
    markFullscreenAdClosed();
    expect(isFullscreenAdPresenting()).toBe(false);

    // A subsequent open still registers correctly (proves the count was not
    // driven negative by the stray close).
    markFullscreenAdOpened();
    expect(isFullscreenAdPresenting(PAST_GRACE())).toBe(true);
  });

  it('bounds the post-close grace window (suppression is not permanent)', () => {
    markFullscreenAdOpened();
    markFullscreenAdClosed();
    const now = Date.now();
    expect(isFullscreenAdPresenting(now)).toBe(true); // within grace
    expect(isFullscreenAdPresenting(now + 500)).toBe(true); // still within
    expect(isFullscreenAdPresenting(now + 2000)).toBe(false); // past grace
  });

  it('reset clears both the counter and the grace window', () => {
    markFullscreenAdOpened();
    __resetFullscreenAdPresenceForTests();
    expect(isFullscreenAdPresenting()).toBe(false);
    expect(isFullscreenAdPresenting(PAST_GRACE())).toBe(false);
  });
});
