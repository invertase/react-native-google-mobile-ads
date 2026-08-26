import { AdsConsent } from '../src';

describe('Google Mobile Ads AdsConsent', function () {
  describe('requestInfoUpdate', function () {
    it('throws if options are not an object', function () {
      // @ts-ignore
      expect(() => AdsConsent.requestInfoUpdate('123')).toThrow(
        "AdsConsent.requestInfoUpdate(*) 'options' expected an object value.",
      );
    });

    it('throws if options.debugGeography is not a valid value.', function () {
      // @ts-ignore
      expect(() => AdsConsent.requestInfoUpdate({ debugGeography: -1 })).toThrow(
        "AdsConsent.requestInfoUpdate(*) 'options.debugGeography' expected one of AdsConsentDebugGeography.DISABLED, AdsConsentDebugGeography.EEA, AdsConsentDebugGeography.NOT_EEA, AdsConsentDebugGeography.REGULATED_US_STATE or AdsConsentDebugGeography.OTHER.",
      );
    });

    it('throws if options.tagForUnderAgeOfConsent is not a boolean.', function () {
      // @ts-ignore
      expect(() => AdsConsent.requestInfoUpdate({ tagForUnderAgeOfConsent: '123' })).toThrow(
        "AdsConsent.requestInfoUpdate(*) 'options.tagForUnderAgeOfConsent' expected a boolean value.",
      );
    });

    it('throws if options.testDeviceIdentifiers is not an array', function () {
      // @ts-ignore
      expect(() => AdsConsent.requestInfoUpdate({ testDeviceIdentifiers: '123' })).toThrow(
        "AdsConsent.requestInfoUpdate(*) 'options.testDeviceIdentifiers' expected an array of string values.",
      );
    });
  });
});
