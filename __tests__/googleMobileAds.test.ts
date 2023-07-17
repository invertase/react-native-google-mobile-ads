import admob, { MaxAdContentRating } from '../src';
import RNGoogleMobileAdsModule from '../src/NativeGoogleMobileAdsModule';

describe('Admob', function () {
  describe('setRequestConfiguration()', function () {
    it('throws if config is not an object', function () {
      // @ts-ignore
      expect(() => admob().setRequestConfiguration('123')).toThrowError(
        "setRequestConfiguration(*) 'requestConfiguration' expected an object value",
      );
    });

    describe('maxAdContentRating', function () {
      it('throws if maxAdContentRating is invalid', function () {
        expect(() =>
          admob().setRequestConfiguration({
            maxAdContentRating: 'Y' as MaxAdContentRating,
          }),
        ).toThrowError(
          "setRequestConfiguration(*) 'requestConfiguration.maxAdContentRating' expected on of MaxAdContentRating.G, MaxAdContentRating.PG, MaxAdContentRating.T or MaxAdContentRating.MA",
        );
      });
    });

    describe('tagForChildDirectedTreatment', function () {
      it('throws if tagForChildDirectedTreatment not a boolean', function () {
        expect(() =>
          admob().setRequestConfiguration({
            // @ts-ignore
            tagForChildDirectedTreatment: 'true',
          }),
        ).toThrowError(
          "setRequestConfiguration(*) 'requestConfiguration.tagForChildDirectedTreatment' expected a boolean value",
        );
      });
    });

    describe('tagForUnderAgeOfConsent', function () {
      it('throws if tagForUnderAgeOfConsent not a boolean', function () {
        expect(() =>
          admob().setRequestConfiguration({
            // @ts-ignore
            tagForUnderAgeOfConsent: 'false',
          }),
        ).toThrowError(
          "setRequestConfiguration(*) 'requestConfiguration.tagForUnderAgeOfConsent' expected a boolean value",
        );
      });
    });

    describe('testDeviceIdentifiers', function () {
      it('throws if testDeviceIdentifiers not an array', function () {
        expect(() =>
          admob().setRequestConfiguration({
            // @ts-ignore
            testDeviceIdentifiers: 'EMULATOR',
          }),
        ).toThrowError(
          "setRequestConfiguration(*) 'requestConfiguration.testDeviceIdentifiers' expected an array value",
        );
      });
    });

    describe('testDebugMenu', function () {
      it('does call native initialize method', () => {
        admob().initialize();
        expect(RNGoogleMobileAdsModule.initialize).toBeCalledTimes(1);
      });

      it('does call native setRequestConfiguration method', () => {
        admob().setRequestConfiguration({ tagForChildDirectedTreatment: true });
        expect(RNGoogleMobileAdsModule.setRequestConfiguration).toBeCalledTimes(1);
      });

      it('does call native openAdInspector method', () => {
        admob().openAdInspector();
        expect(RNGoogleMobileAdsModule.openAdInspector).toBeCalledTimes(1);
      });

      it('does call native openDebugMenu method', () => {
        admob().openDebugMenu('12345');
        expect(RNGoogleMobileAdsModule.openDebugMenu).toBeCalledTimes(1);
      });

      it('throws if adUnit is empty', function () {
        expect(() => {
          admob().openDebugMenu('');
        }).toThrowError('openDebugMenu expected a non-empty string value');
      });
    });
  });
});
