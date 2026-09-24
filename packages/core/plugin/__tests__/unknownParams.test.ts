import {
  KNOWN_PLUGIN_PARAMETER_KEYS,
  warnUnknownPluginParameters,
} from '../src';

describe('core Expo plugin unknown parameters', () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('exports the documented known parameter keys', () => {
    expect(KNOWN_PLUGIN_PARAMETER_KEYS).toEqual([
      'androidSdk',
      'androidAppId',
      'iosAppId',
      'delayAppMeasurementInit',
      'optimizeInitialization',
      'optimizeAdLoading',
      'skAdNetworkItems',
      'userTrackingUsageDescription',
    ]);
  });

  it('does not warn for known keys only', () => {
    warnUnknownPluginParameters({
      androidAppId: 'ca-app-pub-x~y',
      iosAppId: 'ca-app-pub-x~y',
    });
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('warns when Meta Audience Network keys are passed on the core plugin', () => {
    warnUnknownPluginParameters({
      androidAppId: 'ca-app-pub-x~y',
      metaAdvertiserTrackingEnabled: true,
      metaDataProcessingOptions: [],
      metaAudienceNetworkEnabled: true,
    });

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toMatch(/metaAdvertiserTrackingEnabled/);
    expect(warnSpy.mock.calls[0][0]).toMatch(/@react-native-google-mobile-ads\/facebook/);
    expect(warnSpy.mock.calls[0][0]).toMatch(/setAdvertiserTrackingEnabled/);
  });

  it('warns for other unknown keys with the known-key list', () => {
    warnUnknownPluginParameters({ totallyUnknown: true });

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toMatch(/totallyUnknown/);
    expect(warnSpy.mock.calls[0][0]).toMatch(/androidAppId/);
  });

  it('ignores nullish or non-object params', () => {
    warnUnknownPluginParameters(undefined);
    warnUnknownPluginParameters(null as unknown as undefined);
    warnUnknownPluginParameters([] as unknown as Record<string, unknown>);
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
