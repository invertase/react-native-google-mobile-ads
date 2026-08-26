import { validateAdShowOptions } from '../src/validateAdShowOptions';

describe('Admob Show Options', () => {
  it('returns an empty object when options are undefined', () => {
    expect(validateAdShowOptions()).toEqual({});
  });

  it('throws if options is not an object', () => {
    // @ts-expect-error intentional invalid input
    expect(() => validateAdShowOptions('foo')).toThrow("'options' expected an object value");
  });

  it('accepts undefined properties', () => {
    expect(validateAdShowOptions({ immersiveModeEnabled: undefined })).toEqual({});
  });

  it('throws if immersiveModeEnabled is not a boolean', () => {
    expect(() =>
      validateAdShowOptions({
        // @ts-expect-error intentional invalid input
        immersiveModeEnabled: 'true',
      }),
    ).toThrow("'options.immersiveModeEnabled' expected a boolean value");
  });

  it('sets immersiveModeEnabled', () => {
    const result = validateAdShowOptions({
      immersiveModeEnabled: true,
    });
    expect(result.immersiveModeEnabled).toBe(true);
  });
});
