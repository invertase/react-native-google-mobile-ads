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
 */

#import <XCTest/XCTest.h>

#import "RNGoogleMobileAds/RNGoogleMobileAdsOwnedMappers.h"

/**
 * Owned mapper/helper coverage for RNGoogleMobileAdsOwnedMappers.
 *
 * Does not assert Google Mobile Ads auction, fill, or adapter behavior.
 */
@interface RNGoogleMobileAdsOwnedMappersTests : XCTestCase
@end

@implementation RNGoogleMobileAdsOwnedMappersTests

- (void)testIsAdManagerUnit {
  XCTAssertTrue([RNGoogleMobileAdsOwnedMappers isAdManagerUnit:@"/1234/unit"]);
  XCTAssertFalse([RNGoogleMobileAdsOwnedMappers isAdManagerUnit:@"ca-app-pub-xxx"]);
  NSString *nilUnit = nil;
  XCTAssertFalse([RNGoogleMobileAdsOwnedMappers isAdManagerUnit:nilUnit]);
}

- (void)testCodeAndMessageFromAdErrorCode {
  NSDictionary *noFill =
      [RNGoogleMobileAdsOwnedMappers codeAndMessageFromAdErrorCode:1 message:@"no inventory"];
  XCTAssertEqualObjects(noFill[@"code"], @"no-fill");
  XCTAssertEqualObjects(noFill[@"message"], @"no inventory");

  NSDictionary *invalid =
      [RNGoogleMobileAdsOwnedMappers codeAndMessageFromAdErrorCode:0 message:@"bad request"];
  XCTAssertEqualObjects(invalid[@"code"], @"invalid-request");

  NSDictionary *network = [RNGoogleMobileAdsOwnedMappers codeAndMessageFromAdErrorCode:2
                                                                               message:@"offline"];
  XCTAssertEqualObjects(network[@"code"], @"network-error");

  NSDictionary *server = [RNGoogleMobileAdsOwnedMappers codeAndMessageFromAdErrorCode:3
                                                                              message:@"500"];
  XCTAssertEqualObjects(server[@"code"], @"server-error");

  NSDictionary *timeout = [RNGoogleMobileAdsOwnedMappers codeAndMessageFromAdErrorCode:5
                                                                               message:@"slow"];
  XCTAssertEqualObjects(timeout[@"code"], @"timeout");

  NSDictionary *mediationData =
      [RNGoogleMobileAdsOwnedMappers codeAndMessageFromAdErrorCode:7 message:@"mediation data"];
  XCTAssertEqualObjects(mediationData[@"code"], @"mediation-data-error");

  NSDictionary *mediationAdapter =
      [RNGoogleMobileAdsOwnedMappers codeAndMessageFromAdErrorCode:8 message:@"adapter"];
  XCTAssertEqualObjects(mediationAdapter[@"code"], @"mediation-adapter-error");

  NSDictionary *mediationSize =
      [RNGoogleMobileAdsOwnedMappers codeAndMessageFromAdErrorCode:10 message:@"size"];
  XCTAssertEqualObjects(mediationSize[@"code"], @"mediation-invalid-ad-size");

  NSDictionary *internalErr =
      [RNGoogleMobileAdsOwnedMappers codeAndMessageFromAdErrorCode:11 message:@"internal"];
  XCTAssertEqualObjects(internalErr[@"code"], @"internal-error");

  NSDictionary *invalidArg = [RNGoogleMobileAdsOwnedMappers codeAndMessageFromAdErrorCode:12
                                                                                  message:@"arg"];
  XCTAssertEqualObjects(invalidArg[@"code"], @"invalid-argument");

  NSDictionary *alreadyUsed = [RNGoogleMobileAdsOwnedMappers codeAndMessageFromAdErrorCode:19
                                                                                   message:@"used"];
  XCTAssertEqualObjects(alreadyUsed[@"code"], @"ad-already-used");

  NSDictionary *appId = [RNGoogleMobileAdsOwnedMappers codeAndMessageFromAdErrorCode:20
                                                                             message:@"missing"];
  XCTAssertEqualObjects(appId[@"code"], @"application-identifier-missing");

  NSDictionary *invalidAdString =
      [RNGoogleMobileAdsOwnedMappers codeAndMessageFromAdErrorCode:21 message:@"bad string"];
  XCTAssertEqualObjects(invalidAdString[@"code"], @"received-invalid-ad-string");

  NSString *nilMsg = nil;
  NSDictionary *nilMessage = [RNGoogleMobileAdsOwnedMappers codeAndMessageFromAdErrorCode:1
                                                                                  message:nilMsg];
  XCTAssertEqualObjects(nilMessage[@"code"], @"no-fill");
  XCTAssertEqualObjects(nilMessage[@"message"], @"");

  NSDictionary *unknown = [RNGoogleMobileAdsOwnedMappers codeAndMessageFromAdErrorCode:999
                                                                               message:@"mystery"];
  XCTAssertEqualObjects(unknown[@"code"], @"unknown");
  XCTAssertEqualObjects(unknown[@"message"], @"mystery");
}

- (void)testCustomAdSizeFromString {
  CGFloat width = 0;
  CGFloat height = 0;
  XCTAssertTrue([RNGoogleMobileAdsOwnedMappers customAdSizeFromString:@"320x50"
                                                                width:&width
                                                               height:&height]);
  XCTAssertEqualWithAccuracy(width, 320, 0.001);
  XCTAssertEqualWithAccuracy(height, 50, 0.001);

  XCTAssertFalse([RNGoogleMobileAdsOwnedMappers customAdSizeFromString:@"BANNER"
                                                                 width:&width
                                                                height:&height]);
  NSString *nilSize = nil;
  XCTAssertFalse([RNGoogleMobileAdsOwnedMappers customAdSizeFromString:nilSize
                                                                 width:&width
                                                                height:&height]);
}

- (void)testNamedBannerSizeTokenFromString {
  XCTAssertEqualObjects([RNGoogleMobileAdsOwnedMappers namedBannerSizeTokenFromString:@"banner"],
                        @"BANNER");
  XCTAssertEqualObjects(
      [RNGoogleMobileAdsOwnedMappers namedBannerSizeTokenFromString:@"MEDIUM_RECTANGLE"],
      @"MEDIUM_RECTANGLE");
  XCTAssertEqualObjects(
      [RNGoogleMobileAdsOwnedMappers namedBannerSizeTokenFromString:@"inline_adaptive_banner"],
      @"INLINE_ADAPTIVE_BANNER");
  XCTAssertNil([RNGoogleMobileAdsOwnedMappers namedBannerSizeTokenFromString:@"320x50"]);
  XCTAssertNil([RNGoogleMobileAdsOwnedMappers namedBannerSizeTokenFromString:@"not-a-size"]);
}

- (void)testEmptyToNullAndExtrasAllowlist {
  XCTAssertNil([RNGoogleMobileAdsOwnedMappers emptyToNull:nil]);
  XCTAssertNil([RNGoogleMobileAdsOwnedMappers emptyToNull:@""]);
  XCTAssertNil([RNGoogleMobileAdsOwnedMappers emptyToNull:@"  "]);
  XCTAssertEqualObjects([RNGoogleMobileAdsOwnedMappers emptyToNull:@"AdMob"], @"AdMob");

  NSDictionary *extras = [RNGoogleMobileAdsOwnedMappers allowlistedResponseInfoExtras:@{
    @"mediation_group_name" : @"group-a",
    @"creative_id" : @"creative-1",
    @"secret_credential" : @"drop-me",
    @"mediation_ab_test_name" : @"",
  }];
  XCTAssertEqualObjects(extras[@"mediationGroupName"], @"group-a");
  XCTAssertEqualObjects(extras[@"creativeId"], @"creative-1");
  XCTAssertNil(extras[@"secret_credential"]);
  XCTAssertNil(extras[@"mediationAbTestName"]);
}

- (void)testLatencyMillisAndCompactPaid {
  XCTAssertEqualObjects([RNGoogleMobileAdsOwnedMappers latencyMillisFromSeconds:0.042], @(42));
  NSDictionary *full = @{
    @"responseId" : @"abc",
    @"adapterResponses" : @[ @{} ],
    @"extras" : @{},
  };
  NSDictionary *compact = [RNGoogleMobileAdsOwnedMappers compactPaidResponseInfoFromFull:full];
  XCTAssertEqualObjects(compact[@"responseId"], @"abc");
  XCTAssertNil(compact[@"adapterResponses"]);
}

@end
