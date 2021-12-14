/*
 * Copyright (c) 2016-present Invertase Limited & Contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this library except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

import React, { useState, useEffect } from 'react';
import { HostComponent, requireNativeComponent } from 'react-native';
import { isFunction } from '../common';
import NativeError from '../internal/NativeError';
import BannerAdSize from '../BannerAdSize';
import validateAdRequestOptions from '../validateAdRequestOptions';
import { BannerAdProps } from '../types/BannerAdProps';
import { RequestOptions } from '../types/RequestOptions';

const initialState = [0, 0];
const sizeRegex = /([0-9]+)x([0-9]+)/;

function BannerAd({ unitId, size, requestOptions, ...props }: BannerAdProps) {
  const [dimensions, setDimensions] = useState(initialState);

  useEffect(() => {
    if (!unitId) {
      throw new Error("BannerAd: 'unitId' expected a valid string unit ID.");
    }
  }, [unitId]);

  useEffect(() => {
    if (!BannerAdSize[size] && !sizeRegex.test(size)) {
      throw new Error("BannerAd: 'size' expected a valid BannerAdSize or custom size string.");
    }
  }, [size]);

  useEffect(() => {
    if (!BannerAdSize[size] && !sizeRegex.test(size)) {
      throw new Error("BannerAd: 'size' expected a valid BannerAdSize or custom size string.");
    }
  }, [size]);

  const parsedRequestOptions = JSON.stringify(requestOptions);

  useEffect(() => {
    if (requestOptions) {
      try {
        validateAdRequestOptions(requestOptions);
      } catch (e) {
        if (e instanceof Error) {
          throw new Error(`BannerAd: ${e.message}`);
        }
      }
    }
  }, [parsedRequestOptions]);

  function onNativeEvent({ nativeEvent }) {
    const { width, height, type } = nativeEvent;

    if (type !== 'onSizeChanged' && isFunction(props[type])) {
      let eventPayload;
      if (type === 'onAdFailedToLoad') {
        eventPayload = NativeError.fromEvent(nativeEvent, 'googleAds');
      }
      props[type](eventPayload);
    }

    if (width && height && size !== 'FLUID') {
      setDimensions([width, height]);
    }
  }

  let style;
  if (size === 'FLUID') {
    // @ts-ignore: Property 'style' does not exist on type error
    style = props.style;
  } else {
    style = {
      width: dimensions[0],
      height: dimensions[1],
    };
  }

  return (
    <GoogleAdsBannerView
      size={size}
      style={style}
      unitId={unitId}
      request={validateAdRequestOptions(requestOptions)}
      onNativeEvent={onNativeEvent}
    />
  );
}

const GoogleAdsBannerView: HostComponent<{
  size: string;
  style: {
    width: number;
    height: number;
  };
  unitId: string;
  request: RequestOptions;
  onNativeEvent: (event: {
    nativeEvent: { type: 'string'; width: number; height: number };
  }) => void;
}> = requireNativeComponent('RNGoogleAdsBannerView');

export default BannerAd;
