import {
  AdEventType,
  InterstitialAd,
  RewardedAd,
  RewardedAdEventType,
  RewardedInterstitialAd,
} from '../src';

/**
 * Owned JS wiring for fullscreen paid / click / earned-reward callbacks.
 * Inventory delivery and creative clicks stay out of scope (GMA-AD-6).
 */
describe('fullscreen owned event callback wiring', () => {
  describe('paid-event listeners', () => {
    it('forwards RewardedAd PAID payloads to addAdEventListener', () => {
      const ad = RewardedAd.createForAdRequest('abc');
      const paidListener = jest.fn();
      ad.addAdEventListener(AdEventType.PAID, paidListener);

      // @ts-expect-error private handler for owned wiring
      ad._handleAdEvent({
        body: {
          type: AdEventType.PAID,
          data: {
            currency: 'USD',
            precision: 3,
            value: 0.05,
            valueMicros: '50000',
            responseInfo: {
              responseId: 'rewarded-paid-1',
              adapterClassName: 'adapter',
              loadedAdapterResponse: null,
              extras: {},
            },
          },
        },
      });

      expect(paidListener).toHaveBeenCalledTimes(1);
      expect(paidListener.mock.calls[0][0]).toEqual(
        expect.objectContaining({
          currency: 'USD',
          valueMicros: '50000',
          responseInfo: expect.objectContaining({ responseId: 'rewarded-paid-1' }),
        }),
      );
    });

    it('forwards RewardedInterstitialAd PAID payloads to addAdEventListener', () => {
      const ad = RewardedInterstitialAd.createForAdRequest('abc');
      const paidListener = jest.fn();
      ad.addAdEventListener(AdEventType.PAID, paidListener);

      // @ts-expect-error private handler for owned wiring
      ad._handleAdEvent({
        body: {
          type: AdEventType.PAID,
          data: {
            currency: 'EUR',
            precision: 2,
            value: 0.01,
            valueMicros: '10000',
          },
        },
      });

      expect(paidListener).toHaveBeenCalledWith(
        expect.objectContaining({ currency: 'EUR', valueMicros: '10000' }),
      );
    });
  });

  describe('click listeners', () => {
    it('notifies InterstitialAd CLICKED listeners', () => {
      const ad = InterstitialAd.createForAdRequest('abc');
      const clickListener = jest.fn();
      ad.addAdEventListener(AdEventType.CLICKED, clickListener);

      // @ts-expect-error private handler for owned wiring
      ad._handleAdEvent({ body: { type: AdEventType.CLICKED } });

      expect(clickListener).toHaveBeenCalledTimes(1);
      expect(clickListener).toHaveBeenCalledWith(undefined);
    });

    it('notifies RewardedAd CLICKED listeners and stops after unsubscribe', () => {
      const ad = RewardedAd.createForAdRequest('abc');
      const clickListener = jest.fn();
      const unsub = ad.addAdEventListener(AdEventType.CLICKED, clickListener);

      // @ts-expect-error private handler for owned wiring
      ad._handleAdEvent({ body: { type: AdEventType.CLICKED } });
      expect(clickListener).toHaveBeenCalledTimes(1);

      unsub();
      // @ts-expect-error private handler for owned wiring
      ad._handleAdEvent({ body: { type: AdEventType.CLICKED } });
      expect(clickListener).toHaveBeenCalledTimes(1);
    });
  });

  describe('rewarded EARNED_REWARD listeners', () => {
    const reward = { type: 'coins', amount: 10 };

    it('delivers RewardedAd EARNED_REWARD payloads and honors unsubscribe', () => {
      const ad = RewardedAd.createForAdRequest('abc');
      const earnedListener = jest.fn();
      const unsub = ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, earnedListener);

      // @ts-expect-error private handler for owned wiring
      ad._handleAdEvent({
        body: { type: RewardedAdEventType.EARNED_REWARD, data: reward },
      });

      expect(earnedListener).toHaveBeenCalledTimes(1);
      expect(earnedListener).toHaveBeenCalledWith(reward);

      unsub();
      // @ts-expect-error private handler for owned wiring
      ad._handleAdEvent({
        body: { type: RewardedAdEventType.EARNED_REWARD, data: { type: 'gems', amount: 1 } },
      });
      expect(earnedListener).toHaveBeenCalledTimes(1);
    });

    it('delivers RewardedInterstitialAd EARNED_REWARD payloads', () => {
      const ad = RewardedInterstitialAd.createForAdRequest('abc');
      const earnedListener = jest.fn();
      ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, earnedListener);

      // @ts-expect-error private handler for owned wiring
      ad._handleAdEvent({
        body: {
          type: RewardedAdEventType.EARNED_REWARD,
          data: { type: 'lives', amount: 3 },
        },
      });

      expect(earnedListener).toHaveBeenCalledWith({ type: 'lives', amount: 3 });
    });
  });
});
