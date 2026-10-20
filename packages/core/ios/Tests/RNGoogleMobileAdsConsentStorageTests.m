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

#import <XCTest/XCTest.h>

#import "RNGoogleMobileAds/RNGoogleMobileAdsConsentStorage.h"

static NSString *const kSuiteName = @"io.invertase.googlemobileads.ConsentStorageTests";
static NSString *const kGppString = @"DBABMA~CPXxRfAPXxRfAAfKABENB-CgAAAAAAAAAAYgAAAAAAAA";

@interface RNGoogleMobileAdsConsentStorageTests : XCTestCase
@property(nonatomic, strong) NSUserDefaults *userDefaults;
@end

@implementation RNGoogleMobileAdsConsentStorageTests

- (void)setUp {
  [super setUp];
  [[NSUserDefaults standardUserDefaults] removePersistentDomainForName:kSuiteName];
  self.userDefaults = [[NSUserDefaults alloc] initWithSuiteName:kSuiteName];
}

- (void)tearDown {
  [[NSUserDefaults standardUserDefaults] removePersistentDomainForName:kSuiteName];
  [super tearDown];
}

- (void)testReturnsStoredGppString {
  [self.userDefaults setObject:kGppString forKey:@"IABGPP_HDR_GppString"];
  XCTAssertEqualObjects(
      [RNGoogleMobileAdsConsentStorage gppStringFromUserDefaults:self.userDefaults], kGppString);
}

- (void)testReturnsNilWhenNoGppStringIsStored {
  XCTAssertNil([RNGoogleMobileAdsConsentStorage gppStringFromUserDefaults:self.userDefaults]);
}

@end
