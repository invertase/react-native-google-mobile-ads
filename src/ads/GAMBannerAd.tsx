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

import React, { createRef } from 'react';
import { findNodeHandle, Platform, UIManager } from 'react-native';
import { GAMBannerAdProps } from '../types/BannerAdProps';
import { BaseAd, GoogleMobileAdsBannerView } from './BaseAd';

export class GAMBannerAd extends React.Component<GAMBannerAdProps> {
  private ref = createRef<GoogleMobileAdsBannerView>();

  recordManualImpression() {
    let commandID: string | number = UIManager.getViewManagerConfig('RNGoogleMobileAdsBannerView')
      .Commands.recordManualImpression;
    if (Platform.OS === 'android') {
      commandID = commandID.toString();
    }
    UIManager.dispatchViewManagerCommand(findNodeHandle(this.ref.current), commandID, undefined);
  }

  render() {
    return <BaseAd ref={this.ref} {...this.props} />;
  }
}
