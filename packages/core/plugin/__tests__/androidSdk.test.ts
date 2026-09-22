import type { ExpoConfig } from '@expo/config-types';
import withReactNativeGoogleMobileAds, {
  setAndroidSdkGradleProperties,
  withAndroidSdk,
} from '../src';

const config = {
  name: 'test',
  slug: 'test',
  modResults: [
    { type: 'property', key: 'RNGMA_ANDROID_BACKEND', value: 'classic' },
    { type: 'property', key: 'unrelated', value: 'kept' },
  ],
} as ExpoConfig & { modResults: Array<{ type: string; key: string; value: string }> };

describe('Android SDK selection', () => {
  beforeEach(() => {
    delete config.mods;
  });

  it('leaves Gradle properties untouched when omitted', () => {
    expect(withAndroidSdk(config, undefined)).toBe(config);
  });

  it('replaces an existing backend property', () => {
    expect(setAndroidSdkGradleProperties(config.modResults, 'nextgen')).toEqual([
      { type: 'property', key: 'unrelated', value: 'kept' },
      { type: 'property', key: 'RNGMA_ANDROID_BACKEND', value: 'nextgen' },
    ]);
  });

  it('rejects unsupported values at runtime', () => {
    expect(() => withAndroidSdk(config, 'unsupported' as 'classic')).toThrow(
      'Expected "classic", "legacy", or "nextgen"',
    );
  });

  it('registers the Gradle properties mod', () => {
    const result = withAndroidSdk(config, 'legacy');
    expect(result.mods?.android?.gradleProperties).toBeDefined();
  });

  it('applies the registered Gradle properties mod', async () => {
    const result = withAndroidSdk(config, 'nextgen');
    const applyMod = result.mods?.android?.gradleProperties;
    const applied = await applyMod?.({
      ...result,
      modResults: structuredClone(config.modResults),
      modRequest: {
        projectRoot: process.cwd(),
        platformProjectRoot: process.cwd(),
        platform: 'android',
        modName: 'gradleProperties',
        introspect: false,
      },
    });
    expect(applied?.modResults).toContainEqual({
      type: 'property',
      key: 'RNGMA_ANDROID_BACKEND',
      value: 'nextgen',
    });
  });

  it('wires backend selection through the root plugin', () => {
    const result = withReactNativeGoogleMobileAds(
      {
        ...config,
        _internal: { projectRoot: process.cwd() },
      } as ExpoConfig,
      {
        androidSdk: 'classic',
        androidAppId: 'android-app-id',
        iosAppId: 'ios-app-id',
      },
    );
    expect(result.mods?.android?.gradleProperties).toBeDefined();
  });
});
