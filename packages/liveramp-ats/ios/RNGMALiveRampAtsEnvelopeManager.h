#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@interface RNGMALiveRampAtsEnvelopeRecord : NSObject
@property (nonatomic, copy, nullable) NSString *envelope27;
@property (nonatomic, copy, nullable) NSString *envelope19;
@property (nonatomic, copy, nullable) NSString *envelope25;
@property (nonatomic, assign) NSInteger placementId;
@property (nonatomic, copy, nullable) NSString *origin;
- (NSString *)signalForCollect;
@end

@interface RNGMALiveRampAtsEnvelopeManager : NSObject
+ (instancetype)sharedManager;
- (void)hydrateIfNeeded;
- (void)configureWithPlacementId:(NSInteger)placementId bundleId:(nullable NSString *)bundleId;
- (void)setEmail:(nullable NSString *)email phone:(nullable NSString *)phone;
- (void)clearIdentifier;
- (nullable RNGMALiveRampAtsEnvelopeRecord *)currentRecord;
+ (NSString *)cachedSignal;
@end

NS_ASSUME_NONNULL_END