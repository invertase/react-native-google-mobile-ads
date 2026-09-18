#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@interface RNGoogleMobileAdsPoolGeneration : NSObject

- (BOOL)claimStartForKey:(NSString *)key generation:(NSNumber *)generation;
- (BOOL)allowsOperationForKey:(NSString *)key generation:(NSNumber *)generation;
- (BOOL)releaseDestroyForKey:(NSString *)key generation:(NSNumber *)generation;

@end

NS_ASSUME_NONNULL_END
