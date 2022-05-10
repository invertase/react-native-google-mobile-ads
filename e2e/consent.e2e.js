/*
 * Copyright (c) 2016-present Invertase Limited & Contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this library except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

let AdsConsent;

describe('googleAds AdsConsent', function () {
  before(function () {
    AdsConsent = jet.require('lib/AdsConsent');
  });

  describe('requestInfoUpdate', function () {
    it('requests info update', async function () {
      const info = await AdsConsent.requestInfoUpdate();
      info.status.should.be.equalOneOf('REQUIRED', 'NOT_REQUIRED', 'OBTAINED', 'UNKNOWN');
      info.isConsentFormAvailable.should.be.Boolean();
    });

    it('throws if options is not valid', function () {
      try {
        AdsConsent.requestInfoUpdate('foo');
        return Promise.reject(new Error('Did not throw Error.'));
      } catch (e) {
        e.message.should.containEql("'options' expected an object value");
        return Promise.resolve();
      }
    });

    it('accepts undefined properties', function () {
      AdsConsent.requestInfoUpdate({
        debugGeography: undefined,
        tagForUnderAgeOfConsent: undefined,
        testDeviceIdentifiers: undefined,
      });

      return Promise.resolve();
    });

    it('throws if debugGeography is not a AdsConsentDebugGeography value', function () {
      try {
        AdsConsent.requestInfoUpdate({
          debugGeography: 123,
        });
        return Promise.reject(new Error('Did not throw Error.'));
      } catch (e) {
        e.message.should.containEql(
          "'options.debugGeography' expected one of AdsConsentDebugGeography.DISABLED, AdsConsentDebugGeography.EEA or AdsConsentDebugGeography.NOT_EEA.",
        );
        return Promise.resolve();
      }
    });

    it('throws if tagForUnderAgeOfConsent is not a boolean', function () {
      try {
        AdsConsent.requestInfoUpdate({
          tagForUnderAgeOfConsent: 'foo',
        });
        return Promise.reject(new Error('Did not throw Error.'));
      } catch (e) {
        e.message.should.containEql("'options.tagForUnderAgeOfConsent' expected a boolean value");
        return Promise.resolve();
      }
    });

    it('throws if testDeviceIdentifiers is not an array', function () {
      try {
        AdsConsent.requestInfoUpdate({
          testDeviceIdentifiers: 'foo',
        });
        return Promise.reject(new Error('Did not throw Error.'));
      } catch (e) {
        e.message.should.containEql(
          "'options.testDeviceIdentifiers' expected an array of string values",
        );
        return Promise.resolve();
      }
    });

    it('throws if testDeviceIdentifiers contains invalid value', function () {
      try {
        AdsConsent.requestInfoUpdate({
          testDeviceIdentifiers: ['foo', 123],
        });
        return Promise.reject(new Error('Did not throw Error.'));
      } catch (e) {
        e.message.should.containEql(
          "'options.testDeviceIdentifiers' expected an array of string values",
        );
        return Promise.resolve();
      }
    });
  });

  describe('getUserChoices', function () {
    it('returns consent choices', async function () {
      const choices = await AdsConsent.getUserChoices();
      choices.storeAndAccessInformationOnDevice.should.be.Boolean();
      choices.usePreciseGeolocationData.should.be.Boolean();
    });
  });

  describe('reset', function () {
    it('resets', function () {
      AdsConsent.reset();
    });
  });
});
