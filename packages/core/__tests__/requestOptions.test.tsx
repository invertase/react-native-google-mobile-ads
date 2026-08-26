import { validateAdRequestOptions } from '../src/validateAdRequestOptions';

describe('Admob RequestOptions', () => {
  it('returns defaults when options are undefined', () => {
    const result = validateAdRequestOptions();
    expect(result.requestAgent).toEqual(expect.stringMatching(/^rn-invertase-/));
  });

  it('throws if options is not an object', () => {
    // @ts-expect-error intentional invalid input
    expect(() => validateAdRequestOptions('foo')).toThrow("'options' expected an object value");
  });

  it('accepts undefined properties', () => {
    const result = validateAdRequestOptions({
      requestNonPersonalizedAdsOnly: undefined,
      networkExtras: undefined,
      keywords: undefined,
      contentUrl: undefined,
      neighboringContentUrls: undefined,
      requestAgent: undefined,
      serverSideVerificationOptions: undefined,
    });

    expect(result.requestNonPersonalizedAdsOnly).toBeUndefined();
    expect(result.networkExtras).toBeUndefined();
    expect(result.keywords).toBeUndefined();
    expect(result.contentUrl).toBeUndefined();
    expect(result.neighboringContentUrls).toBeUndefined();
    expect(result.serverSideVerificationOptions).toBeUndefined();
  });

  describe('requestNonPersonalizedAdsOnly', () => {
    it('throws if requestNonPersonalizedAdsOnly is not a boolean', () => {
      expect(() =>
        validateAdRequestOptions({
          // @ts-expect-error intentional invalid input
          requestNonPersonalizedAdsOnly: 'true',
        }),
      ).toThrow("'options.requestNonPersonalizedAdsOnly' expected a boolean value");
    });

    it('accepts requestNonPersonalizedAdsOnly boolean', () => {
      const result = validateAdRequestOptions({
        requestNonPersonalizedAdsOnly: false,
      });
      expect(result.requestNonPersonalizedAdsOnly).toBe(false);
    });
  });

  describe('networkExtras', () => {
    it('throws if networkExtras is not an object', () => {
      expect(() =>
        validateAdRequestOptions({
          // @ts-expect-error intentional invalid input
          networkExtras: ['foo', 'bar'],
        }),
      ).toThrow("'options.networkExtras' expected an object of key/value pairs");
    });

    it('throws if networkExtras value is not a string', () => {
      expect(() =>
        validateAdRequestOptions({
          // @ts-expect-error intentional invalid input
          networkExtras: {
            foo: 'bar',
            bar: 123,
          },
        }),
      ).toThrow('\'options.networkExtras\' expected a string value for object key "bar"');
    });

    it('accepts networkExtras object', () => {
      const result = validateAdRequestOptions({
        networkExtras: {
          foo: 'bar',
          bar: 'baz',
        },
      });

      expect(result.networkExtras?.foo).toBe('bar');
      expect(result.networkExtras?.bar).toBe('baz');
    });
  });

  describe('keywords', () => {
    it('throws if keywords is not an array', () => {
      expect(() =>
        validateAdRequestOptions({
          // @ts-expect-error intentional invalid input
          keywords: { foo: 'bar' },
        }),
      ).toThrow("'options.keywords' expected an array containing string values");
    });

    it('throws if a keyword is not a string', () => {
      expect(() =>
        validateAdRequestOptions({
          // @ts-expect-error intentional invalid input
          keywords: ['foo', 123],
        }),
      ).toThrow("'options.keywords' expected an array containing string values");
    });

    it('accepts keywords array', () => {
      const result = validateAdRequestOptions({
        keywords: ['foo', 'bar'],
      });

      expect(result.keywords).toEqual(['foo', 'bar']);
    });
  });

  describe('contentUrl', () => {
    it('throws if contentUrl is not a string', () => {
      expect(() =>
        validateAdRequestOptions({
          // @ts-expect-error intentional invalid input
          contentUrl: 123,
        }),
      ).toThrow("'options.contentUrl' expected a string value");
    });

    it('throws if contentUrl is not a valid url', () => {
      expect(() =>
        validateAdRequestOptions({
          contentUrl: 'www.invertase.io',
        }),
      ).toThrow("'options.contentUrl' expected a valid HTTP or HTTPS url.");
    });

    it('throws if contentUrl is too long', () => {
      const str = Array.from({ length: 530 }, (_, i) => i.toString()).join('');

      expect(() =>
        validateAdRequestOptions({
          contentUrl: `https://invertase.io?${str}`,
        }),
      ).toThrow("'options.contentUrl' maximum length of a content URL is 512 characters.");
    });

    it('accepts a contentUrl', () => {
      const result = validateAdRequestOptions({
        contentUrl: 'http://invertase.io/privacy-policy',
      });

      expect(result.contentUrl).toBe('http://invertase.io/privacy-policy');
    });
  });

  describe('requestAgent', () => {
    it('throws if not a string', () => {
      expect(() =>
        validateAdRequestOptions({
          // @ts-expect-error intentional invalid input
          requestAgent: 1,
        }),
      ).toThrow("'options.requestAgent' expected a string value");
    });

    it('accepts a requestAgent', () => {
      const result = validateAdRequestOptions({
        requestAgent: 'CoolAds',
      });
      expect(result.requestAgent).toBe('CoolAds');
    });
  });

  describe('serverSideVerificationOptions', () => {
    it('throws if userId is not a string', () => {
      expect(() =>
        validateAdRequestOptions({
          serverSideVerificationOptions: {
            // @ts-expect-error intentional invalid input
            userId: 111,
          },
        }),
      ).toThrow("'options.serverSideVerificationOptions.userId' expected a string value");
    });

    it('throws if customData is not a string', () => {
      expect(() =>
        validateAdRequestOptions({
          serverSideVerificationOptions: {
            // @ts-expect-error intentional invalid input
            customData: 1111,
          },
        }),
      ).toThrow("'options.serverSideVerificationOptions.customData' expected a string value");
    });

    it('accepts a serverSideVerificationOptions', () => {
      const result = validateAdRequestOptions({
        serverSideVerificationOptions: {
          userId: '1',
          customData: 'my-custom-data',
        },
      });
      expect(result.serverSideVerificationOptions?.userId).toBe('1');
      expect(result.serverSideVerificationOptions?.customData).toBe('my-custom-data');
    });
  });

  describe('publisherProvidedSignals', () => {
    it('throws if publisherProvidedSignals is not an object', () => {
      expect(() =>
        validateAdRequestOptions({
          // @ts-expect-error intentional invalid input
          publisherProvidedSignals: 'not-an-object',
        }),
      ).toThrow("'options.publisherProvidedSignals' expected an object of key/value pairs");
    });

    it('throws if a publisherProvidedSignals value is not an array', () => {
      expect(() =>
        validateAdRequestOptions({
          // @ts-expect-error intentional invalid input
          publisherProvidedSignals: { IAB_CONTENT_2_2: 'not-an-array' },
        }),
      ).toThrow("'options.publisherProvidedSignals.IAB_CONTENT_2_2' expected an array of numbers");
    });

    it('sets publisherProvidedSignals if valid', () => {
      const result = validateAdRequestOptions({
        publisherProvidedSignals: { IAB_CONTENT_2_2: [533, 483, 1020] },
      });
      expect(result.publisherProvidedSignals).toEqual({
        IAB_CONTENT_2_2: [533, 483, 1020],
      });
    });

    it('passes through multiple signal keys', () => {
      const pps = {
        IAB_CONTENT_2_2: [533, 483],
        IAB_AUDIENCE_1_1: [6, 7],
      };
      const result = validateAdRequestOptions({ publisherProvidedSignals: pps });
      expect(result.publisherProvidedSignals).toEqual(pps);
    });

    it('does not set publisherProvidedSignals if not provided', () => {
      const result = validateAdRequestOptions({});
      expect(result.publisherProvidedSignals).toBeUndefined();
    });
  });

  describe('publisherProvidedId', () => {
    it('throws if publisherProvidedId is not a string', () => {
      expect(() =>
        validateAdRequestOptions({
          // @ts-expect-error intentional invalid input
          publisherProvidedId: 123,
        }),
      ).toThrow("'options.publisherProvidedId' expected a string value");
    });

    it('sets publisherProvidedId if valid', () => {
      const result = validateAdRequestOptions({
        publisherProvidedId: 'user-abc-123',
      });
      expect(result.publisherProvidedId).toBe('user-abc-123');
    });
  });

  describe('neighboringContentUrls', () => {
    it('throws if neighboringContentUrls is not an array', () => {
      expect(() =>
        validateAdRequestOptions({
          // @ts-expect-error intentional invalid input
          neighboringContentUrls: 'not-an-array',
        }),
      ).toThrow("'options.neighboringContentUrls' expected an array containing string values");
    });

    it('throws if neighboringContentUrls contains a non-string', () => {
      expect(() =>
        validateAdRequestOptions({
          // @ts-expect-error intentional invalid input
          neighboringContentUrls: [123],
        }),
      ).toThrow("'options.neighboringContentUrls' expected an array containing string values");
    });

    it('throws if neighboringContentUrls contains an invalid url', () => {
      expect(() =>
        validateAdRequestOptions({
          neighboringContentUrls: ['not-a-url'],
        }),
      ).toThrow("'options.neighboringContentUrls' expected valid HTTP or HTTPS urls.");
    });

    it('throws if neighboringContentUrls has more than 4 urls', () => {
      expect(() =>
        validateAdRequestOptions({
          neighboringContentUrls: [
            'https://www.example1.com',
            'https://www.example2.com',
            'https://www.example3.com',
            'https://www.example4.com',
            'https://www.example5.com',
          ],
        }),
      ).toThrow("'options.neighboringContentUrls' maximum of 4 URLs");
    });

    it('throws if neighboringContentUrls contains a url that is too long', () => {
      const longUrl = `https://example.com?${'a'.repeat(512)}`;

      expect(() =>
        validateAdRequestOptions({
          neighboringContentUrls: [longUrl],
        }),
      ).toThrow(
        "'options.neighboringContentUrls' maximum length of a content URL is 512 characters.",
      );
    });

    it('sets neighboringContentUrls if valid', () => {
      const urls = ['https://www.example1.com', 'https://www.example2.com'];
      const result = validateAdRequestOptions({ neighboringContentUrls: urls });
      expect(result.neighboringContentUrls).toEqual(urls);
    });
  });

  describe('customTargeting', () => {
    it('throws if customTargeting is not an object', () => {
      expect(() =>
        validateAdRequestOptions({
          // @ts-expect-error intentional invalid input
          customTargeting: 'not-an-object',
        }),
      ).toThrow("'options.customTargeting' expected an object of key/value pairs");
    });

    it('sets customTargeting if valid', () => {
      const result = validateAdRequestOptions({
        customTargeting: { key: 'value' },
      });
      expect(result.customTargeting).toEqual({ key: 'value' });
    });
  });
});
