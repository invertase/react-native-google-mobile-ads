import { NativeAd, NativeAdEventType } from '../src';
import NativeGoogleMobileAdsNativeModule from '../src/specs/modules/NativeGoogleMobileAdsNativeModule';

const nativeAdProps = {
  responseId: 'native-ad-response-id',
  advertiser: null,
  body: 'Body',
  callToAction: 'Install',
  headline: 'Headline',
  price: null,
  store: null,
  starRating: null,
  icon: null,
  images: null,
  mediaContent: null,
  extras: null,
};

describe('NativeAd', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('forwards the paid event currency payload', async () => {
    const nativeModule = NativeGoogleMobileAdsNativeModule as unknown as {
      load: jest.Mock;
      onAdEvent: jest.Mock;
    };
    nativeModule.load.mockResolvedValue(nativeAdProps);

    const nativeAd = await NativeAd.createForAdRequest('native-ad-unit-id');
    const listener = jest.fn();
    nativeAd.addAdEventListener(NativeAdEventType.PAID, listener);

    const nativeEventListener = nativeModule.onAdEvent.mock.calls[0][0];
    nativeEventListener({
      responseId: nativeAdProps.responseId,
      type: NativeAdEventType.PAID,
      value: 1.5,
      precision: 3,
      currency: 'USD',
    });

    expect(listener).toHaveBeenCalledWith({
      value: 1.5,
      precision: 3,
      currency: 'USD',
    });
  });
});
