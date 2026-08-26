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

import { NativeEventEmitter } from 'react-native';
import NativeAppModule from '../specs/modules/NativeAppModule';

const RNAppModule = NativeAppModule;

class GANativeEventEmitter extends NativeEventEmitter {
  ready: boolean;

  constructor() {
    super(RNAppModule);
    this.ready = false;
  }

  addListener(
    eventType: string,
    listener: (event: { adUnitId: string; requestId: number }) => void,
    context?: Record<string, unknown>,
  ) {
    if (!this.ready) {
      RNAppModule.eventsNotifyReady(true);
      this.ready = true;
    }
    RNAppModule.eventsAddListener(eventType);

    const subscription = super.addListener(`rnapp_${eventType}`, listener, context);

    // override the default remove to unsubscribe our native listener, then call super
    subscription.remove = () => {
      RNAppModule.eventsRemoveListener(eventType, false);
      subscription.remove();
    };
    return subscription;
  }

  removeAllListeners(eventType: string) {
    RNAppModule.eventsRemoveListener(eventType, true);
    super.removeAllListeners(`rnapp_${eventType}`);
  }
}

export const GoogleMobileAdsNativeEventEmitter = new GANativeEventEmitter();
