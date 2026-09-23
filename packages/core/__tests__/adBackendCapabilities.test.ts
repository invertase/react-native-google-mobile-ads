import { AdFormat, getAdCapabilities } from '../src';
import type { AdBackend } from '../src';
import NativeGoogleMobileAdsModule from '../src/specs/modules/NativeGoogleMobileAdsModule';

const BACKENDS: AdBackend[] = ['ios', 'android-classic', 'android-next-gen'];

function mockBackend(backend: AdBackend) {
  jest.mocked(NativeGoogleMobileAdsModule.getConstants).mockReturnValue({
    sdkVersion: 'test-linked-sdk',
    backend,
  });
}

describe('getAdCapabilities backend constants', () => {
  afterEach(() => {
    mockBackend('ios');
  });

  it.each(BACKENDS)('locks backend value %s from native constants', backend => {
    mockBackend(backend);
    expect(getAdCapabilities().backend).toBe(backend);
    expect(getAdCapabilities().sdkVersion).toBe('test-linked-sdk');
  });

  it('reports ios classic capability bits', () => {
    mockBackend('ios');
    const caps = getAdCapabilities();
    expect(caps.fullscreenPreload).toBe('experimental');
    expect(caps.fullscreenPreloadFormats[AdFormat.REWARDED_INTERSTITIAL]).toBe('experimental');
    expect(caps.poolResponseInfoPeek).toBe('supported');
    expect(caps.displayPreload).toBe('emulated');
  });

  it('reports android-classic capability bits', () => {
    mockBackend('android-classic');
    const caps = getAdCapabilities();
    expect(caps.fullscreenPreload).toBe('experimental');
    expect(caps.fullscreenPreloadFormats[AdFormat.REWARDED_INTERSTITIAL]).toBe('unavailable');
    expect(caps.poolResponseInfoPeek).toBe('unavailable');
    expect(caps.displayPreload).toBe('emulated');
  });

  it('reports android-next-gen capability bits', () => {
    mockBackend('android-next-gen');
    const caps = getAdCapabilities();
    expect(caps.fullscreenPreload).toBe('supported');
    expect(caps.fullscreenPreloadFormats[AdFormat.APP_OPEN]).toBe('supported');
    expect(caps.fullscreenPreloadFormats[AdFormat.INTERSTITIAL]).toBe('supported');
    expect(caps.fullscreenPreloadFormats[AdFormat.REWARDED]).toBe('supported');
    expect(caps.fullscreenPreloadFormats[AdFormat.REWARDED_INTERSTITIAL]).toBe('unavailable');
    expect(caps.poolResponseInfoPeek).toBe('supported');
    expect(caps.displayPreload).toBe('emulated');
  });
});
