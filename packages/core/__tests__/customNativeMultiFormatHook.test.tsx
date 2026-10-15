import { act, render } from '@testing-library/react-native';

import { AdFormat, useMultiFormatAd } from '../src';
import NativeGoogleMobileAdsNativeModule from '../src/specs/modules/NativeGoogleMobileAdsNativeModule';

/**
 * useMultiFormatAd's handle types are native / banner only, so it must refuse custom native
 * format IDs at runtime instead of returning a handle its types cannot describe.
 */
describe('useMultiFormatAd with customNativeFormatIds', () => {
  it('resolves an invalid-request error without calling native', async () => {
    jest.mocked(NativeGoogleMobileAdsNativeModule.loadMultiFormat).mockClear();
    let multi: ReturnType<typeof useMultiFormatAd> | undefined;
    function Probe() {
      multi = useMultiFormatAd({
        adUnitId: '/123/u',
        requestOptions: {
          formats: [AdFormat.NATIVE],
          adServer: 'ad-manager',
          customNativeFormatIds: ['12345678'],
        } as never,
        autoLoad: false,
      });
      return null;
    }
    const { unmount } = render(<Probe />);
    await act(async () => {
      const result = await multi!.load();
      expect(result.status).toBe('error');
      expect(result.errors[0]?.reason).toBe('invalid-request');
      expect(result.errors[0]?.message).toMatch(/use MultiFormatAdRequest\.create/);
    });
    expect(NativeGoogleMobileAdsNativeModule.loadMultiFormat).not.toHaveBeenCalled();
    unmount();
  });
});
