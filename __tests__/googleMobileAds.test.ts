import admob, { MaxAdContentRating } from '../src';
import RNGoogleMobileAdsModule from '../src/specs/modules/NativeGoogleMobileAdsModule';

describe('Admob', function () {
  describe('setRequestConfiguration()', function () {
    it('throws if config is not an object', function () {
      // @ts-ignore
      expect(() => admob().setRequestConfiguration('123')).toThrow(
        "setRequestConfiguration(*) 'requestConfiguration' expected an object value",
      );
    });

    describe('maxAdContentRating', function () {
      it('throws if maxAdContentRating is invalid', function () {
        expect(() =>
          admob().setRequestConfiguration({
            maxAdContentRating: 'Y' as MaxAdContentRating,
          }),
        ).toThrow(
          "setRequestConfiguration(*) 'requestConfiguration.maxAdContentRating' expected one of G, PG, T, MA",
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
        ).toThrow(
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
        ).toThrow(
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
        ).toThrow(
          "setRequestConfiguration(*) 'requestConfiguration.testDeviceIdentifiers' expected an array value",
        );
      });
    });

    describe('testDebugMenu', function () {
      it('does call native initialize method', () => {
        admob().initialize();
        expect(RNGoogleMobileAdsModule.initialize).toHaveBeenCalledTimes(1);
      });

      it('does call native setRequestConfiguration method', () => {
        admob().setRequestConfiguration({ tagForChildDirectedTreatment: true });
        expect(RNGoogleMobileAdsModule.setRequestConfiguration).toHaveBeenCalledTimes(1);
      });

      it('does call native openAdInspector method', () => {
        admob().openAdInspector();
        expect(RNGoogleMobileAdsModule.openAdInspector).toHaveBeenCalledTimes(1);
      });

      it('does call native openDebugMenu method', () => {
        admob().openDebugMenu('12345');
        expect(RNGoogleMobileAdsModule.openDebugMenu).toHaveBeenCalledTimes(1);
      });

      it('throws if adUnit is empty', function () {
        expect(() => {
          admob().openDebugMenu('');
        }).toThrow('openDebugMenu expected a non-empty string value');
      });

      it('does call native setAppVolume method', () => {
        admob().setAppVolume(0.5);
        expect(RNGoogleMobileAdsModule.setAppVolume).toHaveBeenCalledTimes(1);
      });

      it('throws if setAppVolume is greater than 1', function () {
        expect(() => {
          admob().setAppVolume(2);
        }).toThrow('The app volume must be a value between 0 and 1 inclusive.');
      });

      it('does call native setAppMuted method', () => {
        admob().setAppMuted(true);
        expect(RNGoogleMobileAdsModule.setAppMuted).toHaveBeenCalledTimes(1);
      });
    });
  });
});
