import React from 'react';
import { render } from '@testing-library/react-native';
import { BannerAd, BannerAdSize } from '../src';

const MOCK_ID = 'MOCK_ID';

describe('Google Mobile Ads Banner', function () {
  it('throws if no unit ID was provided.', function () {
    let errorMsg;
    try {
      render(<BannerAd unitId="" size={BannerAdSize.BANNER} />);
    } catch (e) {
      errorMsg = e.message;
    }
    expect(errorMsg).toEqual("BannerAd: 'unitId' expected a valid string unit ID.");
  });

  it('throws if size does not exist.', function () {
    let errorMsg;
    try {
      render(<BannerAd unitId={MOCK_ID} size="NON_EXISTENT_SIZE" />);
    } catch (e) {
      errorMsg = e.message;
    }
    expect(errorMsg).toEqual(
      "BannerAd: 'size(s)' expected a valid BannerAdSize or custom size string.",
    );
  });

  it('throws if requestOptions is invalid.', function () {
    let errorMsg;
    try {
      render(<BannerAd unitId={MOCK_ID} size={BannerAdSize.BANNER} requestOptions={'options'} />);
    } catch (e) {
      errorMsg = e.message;
    }
    expect(errorMsg).toEqual("BannerAd: 'options' expected an object value");
  });
});
