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

#import "RNGoogleMobileAdsResponseInfo.h"
#import "RNGoogleMobileAdsOwnedMappers.h"

@implementation RNGoogleMobileAdsResponseInfo

+ (nullable id)nullIfNil:(nullable id)value {
  return value == nil ? [NSNull null] : value;
}

+ (nullable NSDictionary *)adapterErrorFromNSError:(nullable NSError *)error {
  if (error == nil) {
    return nil;
  }
  return @{
    @"domain" : error.domain ?: @"",
    @"code" : @(error.code),
    @"message" : error.localizedDescription ?: @"",
  };
}

+ (NSDictionary *)adapterResponseFromNetworkInfo:(GADAdNetworkResponseInfo *)info
                                    forceSuccess:(BOOL)forceSuccess {
  NSError *adError = forceSuccess ? nil : info.error;
  NSMutableDictionary *map = [@{
    @"adapterClassName" : info.adNetworkClassName ?: @"",
    @"adSourceName" :
        [self nullIfNil:[RNGoogleMobileAdsOwnedMappers emptyToNull:info.adSourceName]],
    @"adSourceId" : [self nullIfNil:[RNGoogleMobileAdsOwnedMappers emptyToNull:info.adSourceID]],
    @"adSourceInstanceName" :
        [self nullIfNil:[RNGoogleMobileAdsOwnedMappers emptyToNull:info.adSourceInstanceName]],
    @"adSourceInstanceId" :
        [self nullIfNil:[RNGoogleMobileAdsOwnedMappers emptyToNull:info.adSourceInstanceID]],
    @"latencyMillis" : [RNGoogleMobileAdsOwnedMappers latencyMillisFromSeconds:info.latency],
  } mutableCopy];

  if (adError == nil) {
    map[@"outcome"] = @"success";
    map[@"adError"] = [NSNull null];
  } else {
    map[@"outcome"] = @"error";
    map[@"adError"] = [self adapterErrorFromNSError:adError];
  }
  return map;
}

+ (nullable NSDictionary *)dictionaryFromResponseInfo:(GADResponseInfo *)responseInfo
                                              compact:(BOOL)compact {
  if (responseInfo == nil) {
    return nil;
  }

  GADAdNetworkResponseInfo *loaded = responseInfo.loadedAdNetworkResponseInfo;
  NSString *adapterClassName =
      loaded != nil ? [RNGoogleMobileAdsOwnedMappers emptyToNull:loaded.adNetworkClassName] : nil;

  NSDictionary *extras =
      [RNGoogleMobileAdsOwnedMappers allowlistedResponseInfoExtras:responseInfo.extrasDictionary];
  NSMutableDictionary *map = [@{
    @"responseId" : [self
        nullIfNil:[RNGoogleMobileAdsOwnedMappers emptyToNull:responseInfo.responseIdentifier]],
    @"adapterClassName" : [self nullIfNil:adapterClassName],
    @"extras" : extras,
  } mutableCopy];

  if (loaded == nil) {
    map[@"loadedAdapterResponse"] = [NSNull null];
  } else {
    map[@"loadedAdapterResponse"] = [self adapterResponseFromNetworkInfo:loaded forceSuccess:YES];
  }

  if (!compact) {
    NSMutableArray *rows = [NSMutableArray arrayWithCapacity:responseInfo.adNetworkInfoArray.count];
    for (GADAdNetworkResponseInfo *row in responseInfo.adNetworkInfoArray) {
      [rows addObject:[self adapterResponseFromNetworkInfo:row forceSuccess:NO]];
    }
    map[@"adapterResponses"] = rows;
  }

  return map;
}

+ (NSDictionary *)paidEventPayloadFromAdValue:(GADAdValue *)value
                                 responseInfo:(GADResponseInfo *)responseInfo {
  NSMutableDictionary *payload = [@{
    @"value" : value.value ?: @0,
    @"precision" : @(value.precision),
    @"currency" : value.currencyCode ?: @"",
  } mutableCopy];

  // iOS exposes currency units, not micros. Exact micros are unavailable.
  payload[@"valueMicros"] = [NSNull null];

  NSDictionary *compact = [self dictionaryFromResponseInfo:responseInfo compact:YES];
  if (compact != nil) {
    payload[@"responseInfo"] = compact;
  }
  return payload;
}

+ (nullable GADResponseInfo *)responseInfoFromLoadError:(NSError *)error {
  id info = error.userInfo[GADErrorUserInfoKeyResponseInfo];
  if ([info isKindOfClass:[GADResponseInfo class]]) {
    return (GADResponseInfo *)info;
  }
  return nil;
}

@end

#endif
