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
 *
 */

#if !TARGET_OS_MACCATALYST

#import <GoogleMobileAds/GADAppEventDelegate.h>
#import <GoogleMobileAds/GADBannerView.h>
#import <GoogleMobileAds/GADBannerViewDelegate.h>
#import <React/RCTView.h>

@interface RNGoogleMobileAdsBannerComponent : RCTView <GADBannerViewDelegate, GADAppEventDelegate>

@property GADBannerView *banner;
@property(nonatomic, assign) BOOL requested;

@property(nonatomic, copy) NSArray *sizes;
@property(nonatomic, copy) NSString *unitId;
@property(nonatomic, copy) NSDictionary *request;
@property(nonatomic, copy) NSNumber *manualImpressionsEnabled;
@property(nonatomic, assign) BOOL propsChanged;

@property(nonatomic, copy) RCTBubblingEventBlock onNativeEvent;

- (void)requestAd;
- (void)recordManualImpression;

@end

#endif
