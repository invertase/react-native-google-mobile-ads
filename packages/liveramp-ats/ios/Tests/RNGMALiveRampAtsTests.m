#import <XCTest/XCTest.h>

#import "../RNGMALiveRampAtsEnvelopeManager.h"

@interface RNGMALiveRampAtsTests : XCTestCase
@end

@implementation RNGMALiveRampAtsTests

- (void)testSignalPriority {
  RNGMALiveRampAtsEnvelopeRecord *record = [RNGMALiveRampAtsEnvelopeRecord new];
  record.envelope27 = @"z27";
  record.envelope19 = @"z19";
  XCTAssertEqualObjects([record signalForCollect], @"z27");

  record.envelope27 = nil;
  XCTAssertEqualObjects([record signalForCollect], @"z19");

  record.envelope19 = nil;
  XCTAssertEqualObjects([record signalForCollect], @"");
}

- (void)testEnvelopeParserFixture {
  NSBundle *bundle = [NSBundle bundleForClass:[self class]];
  NSString *path = [[bundle bundlePath] stringByAppendingPathComponent:@"../../__fixtures__/envelope-200-multi.json"];
  path = [path stringByStandardizingPath];
  NSData *data = [NSData dataWithContentsOfFile:path];
  XCTAssertNotNil(data);
  NSDictionary *json = [NSJSONSerialization JSONObjectWithData:data options:0 error:nil];
  XCTAssertTrue([json[@"envelopes"] isKindOfClass:[NSArray class]]);
}

@end