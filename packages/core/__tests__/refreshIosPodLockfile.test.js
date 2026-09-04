'use strict';

const {
  assertPinsMatch,
  extractLockedPodVersion,
  selfCheck,
} = require('../../../scripts/refresh-ios-pod-lockfile');

describe('refresh-ios-pod-lockfile helpers', () => {
  const sampleLock = `
PODS:
  - Google-Mobile-Ads-SDK (13.5.0):
    - GoogleUserMessagingPlatform (>= 1.1)
  - GoogleUserMessagingPlatform (3.1.0)
  - RNGoogleMobileAds (16.5.0):
`;

  it('extracts top-level locked pod versions (ignores nested deps)', () => {
    expect(extractLockedPodVersion(sampleLock, 'RNGoogleMobileAds')).toBe('16.5.0');
    expect(extractLockedPodVersion(sampleLock, 'Google-Mobile-Ads-SDK')).toBe('13.5.0');
    expect(extractLockedPodVersion(sampleLock, 'GoogleUserMessagingPlatform')).toBe('3.1.0');
    expect(extractLockedPodVersion(sampleLock, 'MissingPod')).toBeUndefined();
  });

  it('accepts matching package + SDK pins and rejects GMA drift', () => {
    const okPkg = {
      version: '16.5.0',
      sdkVersions: { ios: { googleMobileAds: '13.5.0', googleUmp: '3.1.0' } },
    };
    expect(assertPinsMatch(okPkg, sampleLock)).toEqual({
      packageVersion: '16.5.0',
      googleMobileAds: '13.5.0',
      googleUmp: '3.1.0',
    });

    expect(() =>
      assertPinsMatch(
        {
          version: '16.5.0',
          sdkVersions: { ios: { googleMobileAds: '13.1.0', googleUmp: '3.1.0' } },
        },
        sampleLock,
      ),
    ).toThrow(/Google-Mobile-Ads-SDK/);
  });

  it('self-check exercises accept and reject paths', () => {
    expect(() => selfCheck()).not.toThrow();
  });
});
