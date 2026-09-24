import {
  KNOWN_PLUGIN_PARAMETER_KEYS,
  warnUnknownPluginParameters,
} from '../src';

describe('facebook Expo plugin unknown parameters', () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('exports skAdNetworkItems as the only known key', () => {
    expect(KNOWN_PLUGIN_PARAMETER_KEYS).toEqual(['skAdNetworkItems']);
  });

  it('does not warn for skAdNetworkItems', () => {
    warnUnknownPluginParameters({ skAdNetworkItems: ['abc.skadnetwork'] });
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('warns that Meta advertiser-tracking keys are runtime JS APIs', () => {
    warnUnknownPluginParameters({
      metaAdvertiserTrackingEnabled: true,
      advertiserTrackingEnabled: false,
    });

    expect(warnSpy).toHaveBeenCalled();
    const message = warnSpy.mock.calls.map(call => call[0]).join('\n');
    expect(message).toMatch(/metaAdvertiserTrackingEnabled|advertiserTrackingEnabled/);
    expect(message).toMatch(/setAdvertiserTrackingEnabled/);
    expect(message).toMatch(/before mobileAds\(\)\.initialize/);
  });

  it('warns for other unknown keys', () => {
    warnUnknownPluginParameters({ fooBar: 1 });
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toMatch(/fooBar/);
    expect(warnSpy.mock.calls[0][0]).toMatch(/skAdNetworkItems/);
  });
});
