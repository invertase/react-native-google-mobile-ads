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

import { NativeEventEmitter, NativeModules, EmitterSubscription } from 'react-native';

const { RNAppModule } = NativeModules;

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

    // React Native 0.65+ altered EventEmitter:
    // - removeSubscription is gone
    // - addListener returns an unsubscriber instead of a more complex object with eventType etc

    // make sure eventType for backwards compatibility just in case
    subscription.eventType = `rnapp_${eventType}`;

    // New style is to return a remove function on the object, just in csae people call that,
    // we will modify it to do our native unsubscription then call the original
    const originalRemove = subscription.remove;
    const newRemove = () => {
      RNAppModule.eventsRemoveListener(eventType, false);
      if (super.removeSubscription != null) {
        // This is for RN <= 0.64 - 65 and greater no longer have removeSubscription
        super.removeSubscription(subscription);
      } else if (originalRemove != null) {
        // This is for RN >= 0.65
        originalRemove();
      }
    };
    subscription.remove = newRemove;
    return subscription;
  }

  removeAllListeners(eventType: string) {
    RNAppModule.eventsRemoveListener(eventType, true);
    super.removeAllListeners(`rnapp_${eventType}`);
  }

  // This is likely no longer ever called, but it is here for backwards compatibility with RN <= 0.64
  removeSubscription(subscription: EmitterSubscription) {
    RNAppModule.eventsRemoveListener(subscription.eventType.replace('rnapp_', ''), false);
    if (super.removeSubscription != null) {
      super.removeSubscription(subscription);
    }
  }
}

export const GoogleMobileAdsNativeEventEmitter = new GANativeEventEmitter();
