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

#import "RNGoogleMobileAdsBannerPaidHandlerLifecycle.h"

@implementation RNGoogleMobileAdsPaidEventSurface
@end

@implementation RNGoogleMobileAdsBannerPaidHandlerLifecycle

+ (void)attachStrongOwnerPaidHandlerToSurface:(RNGoogleMobileAdsPaidEventSurface *)surface
                                        owner:(id)owner
                                         emit:(void (^)(id owner, id value))emit {
  // Deliberately strong — documents #540 Fabric paidEventHandler capture.
  surface.paidEventHandler = ^(id value) {
    if (emit != nil) {
      emit(owner, value);
    }
  };
}

+ (void)attachWeakOwnerPaidHandlerToSurface:(RNGoogleMobileAdsPaidEventSurface *)surface
                                      owner:(id)owner
                                       emit:(void (^)(id owner, id value))emit {
  __weak id weakOwner = owner;
  surface.paidEventHandler = ^(id value) {
    id strongOwner = weakOwner;
    if (strongOwner == nil || emit == nil) {
      return;
    }
    emit(strongOwner, value);
  };
}

@end
