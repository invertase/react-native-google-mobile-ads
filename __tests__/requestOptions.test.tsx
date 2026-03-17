import { validateAdRequestOptions } from '../src/validateAdRequestOptions';

describe('Admob RequestOptions', () => {
  describe('publisherProvidedSignals', () => {
    it('throws if publisherProvidedSignals is not an object', () => {
      expect(() =>
        validateAdRequestOptions({
          // @ts-ignore
          publisherProvidedSignals: 'not-an-object',
        }),
      ).toThrow("'options.publisherProvidedSignals' expected an object of key/value pairs");
    });

    it('throws if a publisherProvidedSignals value is not an array', () => {
      expect(() =>
        validateAdRequestOptions({
          // @ts-ignore
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
          // @ts-ignore
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

  describe('customTargeting', () => {
    it('throws if customTargeting is not an object', () => {
      expect(() =>
        validateAdRequestOptions({
          // @ts-ignore
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
