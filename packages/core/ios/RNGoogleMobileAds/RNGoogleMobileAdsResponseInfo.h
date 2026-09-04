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

#if !TARGET_OS_MACCATALYST

#import <Foundation/Foundation.h>
#import <GoogleMobileAds/GoogleMobileAds.h>

NS_ASSUME_NONNULL_BEGIN

@interface RNGoogleMobileAdsResponseInfo : NSObject

/**
 * Full waterfall snapshot, or compact paid snapshot (omits `adapterResponses`).
 * Returns nil when responseInfo is nil.
 */
+ (nullable NSDictionary *)dictionaryFromResponseInfo:(nullable GADResponseInfo *)responseInfo
                                              compact:(BOOL)compact;

/**
 * Paid event payload: currency / precision / value / valueMicros / responseInfo?.
 * Public key is always `currency` (not `currencyCode`).
 */
+ (NSDictionary *)paidEventPayloadFromAdValue:(GADAdValue *)value
                                 responseInfo:(nullable GADResponseInfo *)responseInfo;

/**
 * ResponseInfo nested under NSError.userInfo for load failures, when present.
 */
+ (nullable GADResponseInfo *)responseInfoFromLoadError:(NSError *)error;

@end

NS_ASSUME_NONNULL_END

#endif
