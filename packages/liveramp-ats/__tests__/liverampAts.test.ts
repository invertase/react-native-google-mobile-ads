import { LiveRampAts, nativeSecureSignalsAdapterClassName, secureSignalsProvider } from '../src';

jest.mock('../src/specs/NativeLiveRampAtsModule', () => ({
  __esModule: true,
  default: {
    configure: jest.fn(() => Promise.resolve()),
    setIdentifier: jest.fn(() => Promise.resolve()),
    clearIdentifier: jest.fn(() => Promise.resolve()),
    getEnvelope: jest.fn(() =>
      Promise.resolve({
        envelope27: 'z27',
        envelope19: 'z19',
        envelope25: null,
        signal: 'z27',
        placementId: 14,
        origin: 'https://com.example.app',
      }),
    ),
  },
}));

describe('@react-native-google-mobile-ads/liveramp-ats', () => {
  it('exports stable RTB adapter class names', () => {
    expect(nativeSecureSignalsAdapterClassName).toEqual({
      android: 'io.invertase.googlemobileads.securesignals.liveramp.LiveRampAtsRtbAdapter',
      ios: 'RNGMALiveRampAtsRtbAdapter',
    });
    expect(secureSignalsProvider).toBe('liveramp-ats');
  });

  it('delegates configure to native module', async () => {
    await LiveRampAts.configure({ placementId: 14, bundleId: 'com.example.app' });
    const native = jest.requireMock('../src/specs/NativeLiveRampAtsModule').default;
    expect(native.configure).toHaveBeenCalledWith({ placementId: 14, bundleId: 'com.example.app' });
  });

  it('getEnvelope returns diagnostics from native', async () => {
    const envelope = await LiveRampAts.getEnvelope();
    expect(envelope.signal).toBe('z27');
  });
});