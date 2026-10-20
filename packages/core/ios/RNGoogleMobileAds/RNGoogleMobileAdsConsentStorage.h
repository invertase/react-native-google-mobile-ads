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

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

/**
 * Reads IAB consent values that the UMP SDK stores in NSUserDefaults.
 * Safe for the lightweight XCTest harness (Foundation only; no UMP).
 */
@interface RNGoogleMobileAdsConsentStorage : NSObject

/**
 * `IABGPP_HDR_GppString`, as defined by the IAB GPP in-app spec:
 * https://github.com/InteractiveAdvertisingBureau/Global-Privacy-Platform/blob/main/Core/CMP%20API%20Specification.md#in-app-details
 */
+ (nullable NSString *)gppStringFromUserDefaults:(NSUserDefaults *)userDefaults;

@end

NS_ASSUME_NONNULL_END
