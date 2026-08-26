import { AdEventType, RewardedAd, RewardedAdEventType } from '../src';
import NativeRewardedModule from '../src/specs/modules/NativeRewardedModule';

describe('Google Mobile Ads Rewarded', () => {
  describe('createForAdRequest', () => {
    it('throws if adUnitId is invalid', () => {
      // @ts-expect-error intentional invalid input
      expect(() => RewardedAd.createForAdRequest(123)).toThrow(
        "'adUnitId' expected an string value",
      );
    });

    it('throws if requestOptions are invalid', () => {
      // @ts-expect-error intentional invalid input
      expect(() => RewardedAd.createForAdRequest('123', 123)).toThrow(
        "RewardedAd.createForAdRequest(_, *) 'options' expected an object value.",
      );
    });

    it('returns a new instance', () => {
      const ad = RewardedAd.createForAdRequest('abc');
      expect(ad.constructor.name).toEqual('RewardedAd');
      expect(ad.adUnitId).toEqual('abc');
      expect(ad.loaded).toEqual(false);
    });
  });

  describe('show', () => {
    it('throws if showing before loaded', () => {
      const ad = RewardedAd.createForAdRequest('abc');

      expect(() => ad.show()).toThrow(
        'The requested RewardedAd has not loaded and could not be shown',
      );
    });
  });

  describe('addAdEventListener', () => {
    it('throws if listener is not a function', () => {
      const ad = RewardedAd.createForAdRequest('abc');

      // @ts-expect-error intentional invalid input
      expect(() => ad.addAdEventListener(RewardedAdEventType.LOADED, 'foo')).toThrow(
        "'listener' expected a function",
      );
    });

    it('returns an unsubscriber function', () => {
      const ad = RewardedAd.createForAdRequest('abc');
      const unsub = ad.addAdEventListener(RewardedAdEventType.LOADED, () => {});
      expect(unsub).toBeDefined();
      unsub();
    });
  });

  describe('load()', () => {
    afterEach(() => {
      jest.clearAllMocks();
    });

    it('does call native load method', () => {
      const ad = RewardedAd.createForAdRequest('abc');
      ad.load();
      expect(NativeRewardedModule.rewardedLoad).toHaveBeenCalledTimes(1);
    });

    it('can be called again after ad was closed', () => {
      const ad = RewardedAd.createForAdRequest('abc');
      ad.load();
      expect(NativeRewardedModule.rewardedLoad).toHaveBeenCalledTimes(1);

      // @ts-expect-error private handler for lifecycle
      ad._handleAdEvent({ body: { type: AdEventType.CLOSED } });

      ad.load();
      expect(NativeRewardedModule.rewardedLoad).toHaveBeenCalledTimes(2);
    });
  });
});
