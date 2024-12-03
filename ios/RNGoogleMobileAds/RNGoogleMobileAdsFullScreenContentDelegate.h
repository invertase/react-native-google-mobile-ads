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

#if !TARGET_OS_MACCATALYST

#import <Foundation/Foundation.h>
#import <GoogleMobileAds/GoogleMobileAds.h>

@interface RNGoogleMobileAdsFullScreenContentDelegate
    : NSObject <GADFullScreenContentDelegate, GADAppEventDelegate>

@property(nonatomic, strong, readonly) NSString *adEventName;
@property(nonatomic, assign, readonly) int requestId;
@property(nonatomic, strong, readonly) NSString *adUnitId;

- (instancetype)initWithAdEventName:(NSString *)adEventName
                          requestId:(int)requestId
                           adUnitId:(NSString *)adUnitId;

@end

#endif