/**
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
 */

#import "RNGoogleMobileAdsFullScreenEventDelivery.h"

@implementation RNGoogleMobileAdsFullScreenEventDelivery

+ (void)deliverTerminalEventWithEmit:(void (^)(void))emit evict:(void (^)(void))evict {
  // Emit CLOSED/ERROR while the holder still strongly retains the weakly-held
  // GAD fullScreenContentDelegate; only then evict (#880).
  if (emit) {
    emit();
  }
  if (evict) {
    evict();
  }
}

+ (NSDictionary<NSString *, id> *)rewardEventDataWithType:(NSString *)type
                                                   amount:(NSNumber *)amount {
  NSString *safeType = type ?: @"";
  NSNumber *safeAmount = amount != nil ? @([amount doubleValue]) : @0;
  return @{
    @"type" : safeType,
    @"amount" : safeAmount,
  };
}

+ (void)dispatchAsyncOnMainQueue:(void (^)(void))block {
  if (block == nil) {
    return;
  }
  // Sync when already on main so reward emission shares CLOSED/ERROR's
  // queueing policy: earn then dismiss on one main turn keeps
  // EARNED_REWARD before CLOSED (#880 F1). Hop only when off main.
  if ([NSThread isMainThread]) {
    block();
  } else {
    dispatch_async(dispatch_get_main_queue(), block);
  }
}

@end
