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
 *
 */

#import "RNGoogleMobileAdsNativeAdRegistry.h"

@implementation RNGoogleMobileAdsNativeAdRegistry

static NSMapTable<NSString *, GADNativeAd *> *_nativeAds;

+ (void)initialize {
  if (self == [RNGoogleMobileAdsNativeAdRegistry class]) {
    _nativeAds = [NSMapTable strongToStrongObjectsMapTable];
  }
}

+ (void)setNativeAd:(GADNativeAd *)nativeAd forResponseId:(NSString *)responseId {
  if (responseId.length == 0 || nativeAd == nil) {
    return;
  }

  @synchronized(self) {
    [_nativeAds setObject:nativeAd forKey:responseId];
  }
}

+ (nullable GADNativeAd *)nativeAdForResponseId:(NSString *)responseId {
  if (responseId.length == 0) {
    return nil;
  }

  @synchronized(self) {
    return [_nativeAds objectForKey:responseId];
  }
}

+ (void)removeNativeAdForResponseId:(NSString *)responseId {
  if (responseId.length == 0) {
    return;
  }

  @synchronized(self) {
    [_nativeAds removeObjectForKey:responseId];
  }
}

+ (void)removeAllNativeAds {
  @synchronized(self) {
    [_nativeAds removeAllObjects];
  }
}

@end