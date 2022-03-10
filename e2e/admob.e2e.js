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

describe('googleAds', function () {
  describe('setRequestConfiguration()', function () {
    it('should match text in the basic app element', async function () {
      await expect(element(by.text('Select test to run'))).toBeVisible();
    });

    it('throws if config is not an object', function () {
      try {
        googleAds.setRequestConfiguration('123');
        return Promise.reject(new Error('Did not throw Error.'));
      } catch (e) {
        e.message.should.containEql("'requestConfiguration' expected an object value");
        return Promise.resolve();
      }
    });

    describe('maxAdContentRating', function () {
      it('throws if maxAdContentRating is invalid', function () {
        try {
          googleAds.setRequestConfiguration({
            maxAdContentRating: 'Y',
          });
          return Promise.reject(new Error('Did not throw Error.'));
        } catch (e) {
          e.message.should.containEql("'requestConfiguration.maxAdContentRating' expected on of");
          return Promise.resolve();
        }
      });

      it('accepts a age rating', async function () {
        await googleAds.setRequestConfiguration({
          maxAdContentRating: googleAds.MaxAdContentRating.G,
        });
      });
    });

    describe('tagForChildDirectedTreatment', function () {
      it('throws if tagForChildDirectedTreatment not a boolean', function () {
        try {
          googleAds.setRequestConfiguration({
            tagForChildDirectedTreatment: 'true',
          });
          return Promise.reject(new Error('Did not throw Error.'));
        } catch (e) {
          e.message.should.containEql(
            "'requestConfiguration.tagForChildDirectedTreatment' expected a boolean value",
          );
          return Promise.resolve();
        }
      });

      it('sets the value', async function () {
        await googleAds.setRequestConfiguration({
          tagForChildDirectedTreatment: false,
        });
      });
    });

    describe('tagForUnderAgeOfConsent', function () {
      it('throws if tagForUnderAgeOfConsent not a boolean', function () {
        try {
          googleAds.setRequestConfiguration({
            tagForUnderAgeOfConsent: 'false',
          });
          return Promise.reject(new Error('Did not throw Error.'));
        } catch (e) {
          e.message.should.containEql(
            "'requestConfiguration.tagForUnderAgeOfConsent' expected a boolean value",
          );
          return Promise.resolve();
        }
      });

      it('sets the value', async function () {
        await googleAds.setRequestConfiguration({
          tagForUnderAgeOfConsent: false,
        });
      });
    });
  });
});
