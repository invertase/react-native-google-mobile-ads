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

#import "RNGoogleMobileAdsOwnedMappers.h"

// Integer values mirror GoogleMobileAds GADErrorCode (GADRequestError.h).
static const NSInteger kRNGMAErrorInvalidRequest = 0;
static const NSInteger kRNGMAErrorNoFill = 1;
static const NSInteger kRNGMAErrorNetworkError = 2;
static const NSInteger kRNGMAErrorServerError = 3;
static const NSInteger kRNGMAErrorTimeout = 5;
static const NSInteger kRNGMAErrorMediationDataError = 7;
static const NSInteger kRNGMAErrorMediationAdapterError = 8;
static const NSInteger kRNGMAErrorMediationInvalidAdSize = 10;
static const NSInteger kRNGMAErrorInternalError = 11;
static const NSInteger kRNGMAErrorInvalidArgument = 12;
static const NSInteger kRNGMAErrorAdAlreadyUsed = 19;
static const NSInteger kRNGMAErrorApplicationIdentifierMissing = 20;
static const NSInteger kRNGMAErrorReceivedInvalidAdString = 21;

@implementation RNGoogleMobileAdsOwnedMappers

+ (BOOL)isAdManagerUnit:(NSString *)unitId {
  if (unitId == nil) {
    return NO;
  }
  return [unitId hasPrefix:@"/"];
}

+ (NSDictionary<NSString *, NSString *> *)codeAndMessageFromAdErrorCode:(NSInteger)code
                                                                message:(NSString *)message {
  NSString *mappedCode = @"unknown";
  NSString *mappedMessage = message ?: @"";

  if (code == kRNGMAErrorInvalidRequest) {
    mappedCode = @"invalid-request";
  } else if (code == kRNGMAErrorNoFill) {
    mappedCode = @"no-fill";
  } else if (code == kRNGMAErrorNetworkError) {
    mappedCode = @"network-error";
  } else if (code == kRNGMAErrorServerError) {
    mappedCode = @"server-error";
  } else if (code == kRNGMAErrorTimeout) {
    mappedCode = @"timeout";
  } else if (code == kRNGMAErrorMediationDataError) {
    mappedCode = @"mediation-data-error";
  } else if (code == kRNGMAErrorMediationAdapterError) {
    mappedCode = @"mediation-adapter-error";
  } else if (code == kRNGMAErrorMediationInvalidAdSize) {
    mappedCode = @"mediation-invalid-ad-size";
  } else if (code == kRNGMAErrorInternalError) {
    mappedCode = @"internal-error";
  } else if (code == kRNGMAErrorInvalidArgument) {
    mappedCode = @"invalid-argument";
  } else if (code == kRNGMAErrorReceivedInvalidAdString) {
    mappedCode = @"received-invalid-ad-string";
  } else if (code == kRNGMAErrorAdAlreadyUsed) {
    mappedCode = @"ad-already-used";
  } else if (code == kRNGMAErrorApplicationIdentifierMissing) {
    mappedCode = @"application-identifier-missing";
  }

  return @{
    @"code" : mappedCode,
    @"message" : mappedMessage,
  };
}

+ (BOOL)customAdSizeFromString:(NSString *)value width:(CGFloat *)width height:(CGFloat *)height {
  if (value == nil || width == NULL || height == NULL) {
    return NO;
  }

  NSError *error = nil;
  NSRegularExpression *regex =
      [NSRegularExpression regularExpressionWithPattern:@"([0-9]+)x([0-9]+)"
                                                options:0
                                                  error:&error];
  if (error != nil || regex == nil) {
    return NO;
  }

  NSArray<NSTextCheckingResult *> *matches = [regex matchesInString:value
                                                            options:0
                                                              range:NSMakeRange(0, value.length)];
  for (NSTextCheckingResult *match in matches) {
    NSString *matchText = [value substringWithRange:match.range];
    if (matchText.length == 0) {
      continue;
    }
    NSArray<NSString *> *values = [matchText componentsSeparatedByString:@"x"];
    if (values.count != 2) {
      continue;
    }
    *width = (CGFloat)[values[0] intValue];
    *height = (CGFloat)[values[1] intValue];
    return YES;
  }

  return NO;
}

+ (NSString *)namedBannerSizeTokenFromString:(NSString *)value {
  if (value == nil) {
    return nil;
  }

  NSString *upper = [value uppercaseString];
  NSArray<NSString *> *known = @[
    @"BANNER",
    @"FLUID",
    @"WIDE_SKYSCRAPER",
    @"LARGE_BANNER",
    @"MEDIUM_RECTANGLE",
    @"FULL_BANNER",
    @"LEADERBOARD",
    @"ANCHORED_ADAPTIVE_BANNER",
    @"LARGE_ANCHORED_ADAPTIVE_BANNER",
    @"INLINE_ADAPTIVE_BANNER",
  ];

  if ([known containsObject:upper]) {
    return upper;
  }
  return nil;
}

@end
