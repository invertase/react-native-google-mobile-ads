#import <XCTest/XCTest.h>

#import "RNGoogleMobileAds/RNGoogleMobileAdsPoolGeneration.h"

@interface RNGoogleMobileAdsPoolGenerationTests : XCTestCase
@end

@implementation RNGoogleMobileAdsPoolGenerationTests

- (void)testGatesStartCallbacksReadsAndDestroy {
  RNGoogleMobileAdsPoolGeneration *tracker = [RNGoogleMobileAdsPoolGeneration new];
  NSString *key = @"interstitial::pool";

  XCTAssertTrue([tracker claimStartForKey:key generation:@1]);
  XCTAssertTrue([tracker allowsOperationForKey:key generation:@1]);
  XCTAssertTrue([tracker claimStartForKey:key generation:@2]);
  XCTAssertFalse([tracker allowsOperationForKey:key generation:@1]);
  XCTAssertFalse([tracker releaseDestroyForKey:key generation:@1]);
  XCTAssertTrue([tracker allowsOperationForKey:key generation:@2]);
  XCTAssertTrue([tracker releaseDestroyForKey:key generation:@2]);
  XCTAssertFalse([tracker allowsOperationForKey:key generation:@2]);
  XCTAssertFalse([tracker claimStartForKey:key generation:@1]);
}

@end
