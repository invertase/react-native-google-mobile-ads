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

#import <React/RCTUtils.h>

#if !TARGET_OS_MACCATALYST
#import <GoogleMobileAds/GoogleMobileAds.h>
#endif

#import "RNAppModule.h"
#import "RNJSON.h"
#import "RNMeta.h"
#import "RNPreferences.h"
#import "RNRCTEventEmitter.h"
#import "RNSharedUtils.h"

@implementation RNAppModule

#pragma mark -
#pragma mark Module Setup

RCT_EXPORT_MODULE();

- (dispatch_queue_t)methodQueue {
  return dispatch_get_main_queue();
}

- (void)setBridge:(RCTBridge *)bridge {
  [RNRCTEventEmitter shared].bridge = bridge;
}

- (RCTBridge *)bridge {
  return [RNRCTEventEmitter shared].bridge;
}

- (id)init {
  return self;
}

- (void)invalidate {
  [[RNRCTEventEmitter shared] invalidate];
}

#pragma mark -
#pragma mark META Methods

RCT_EXPORT_METHOD(metaGetAll
                  : (RCTPromiseResolveBlock)resolve rejecter
                  : (RCTPromiseRejectBlock)reject) {
  resolve([RNMeta getAll]);
}

#pragma mark -
#pragma mark JSON Methods

RCT_EXPORT_METHOD(jsonGetAll
                  : (RCTPromiseResolveBlock)resolve rejecter
                  : (RCTPromiseRejectBlock)reject) {
  resolve([[RNJSON shared] getAll]);
}

#pragma mark -
#pragma mark Preference Methods

RCT_EXPORT_METHOD(preferencesSetBool
                  : (NSString *)key boolValue
                  : (BOOL)boolValue resolver
                  : (RCTPromiseResolveBlock)resolve rejecter
                  : (RCTPromiseRejectBlock)reject) {
  [[RNPreferences shared] setBooleanValue:key boolValue:boolValue];
  resolve([NSNull null]);
}

RCT_EXPORT_METHOD(preferencesSetString
                  : (NSString *)key stringValue
                  : (NSString *)stringValue resolver
                  : (RCTPromiseResolveBlock)resolve rejecter
                  : (RCTPromiseRejectBlock)reject) {
  [[RNPreferences shared] setStringValue:key stringValue:stringValue];
  resolve([NSNull null]);
}

RCT_EXPORT_METHOD(preferencesGetAll
                  : (RCTPromiseResolveBlock)resolve rejecter
                  : (RCTPromiseRejectBlock)reject) {
  resolve([[RNPreferences shared] getAll]);
}

RCT_EXPORT_METHOD(preferencesClearAll
                  : (RCTPromiseResolveBlock)resolve rejecter
                  : (RCTPromiseRejectBlock)reject) {
  [[RNPreferences shared] clearAll];
  resolve([NSNull null]);
}

#pragma mark -
#pragma mark Event Methods

RCT_EXPORT_METHOD(eventsNotifyReady : (BOOL)ready) {
  [[RNRCTEventEmitter shared] notifyJsReady:ready];
}

RCT_EXPORT_METHOD(eventsGetListeners
                  : (RCTPromiseResolveBlock)resolve rejecter
                  : (RCTPromiseRejectBlock)reject) {
  resolve([[RNRCTEventEmitter shared] getListenersDictionary]);
}

RCT_EXPORT_METHOD(eventsPing
                  : (NSString *)eventName eventBody
                  : (NSDictionary *)eventBody resolver
                  : (RCTPromiseResolveBlock)resolve rejecter
                  : (RCTPromiseRejectBlock)reject) {
  [[RNRCTEventEmitter shared] sendEventWithName:eventName body:eventBody];
  resolve(eventBody);
}

RCT_EXPORT_METHOD(eventsAddListener : (NSString *)eventName) {
  [[RNRCTEventEmitter shared] addListener:eventName];
}

RCT_EXPORT_METHOD(eventsRemoveListener : (NSString *)eventName all : (BOOL)all) {
  [[RNRCTEventEmitter shared] removeListeners:eventName all:all];
}

#pragma mark -
#pragma mark Events Unused

RCT_EXPORT_METHOD(addListener : (NSString *)eventName) {
  // Keep: Required for RN built in Event Emitter Calls.
}

RCT_EXPORT_METHOD(removeListeners : (NSInteger)count) {
  // Keep: Required for RN built in Event Emitter Calls.
}

- (NSDictionary *)constantsToExport {
  NSMutableDictionary *constants = [NSMutableDictionary new];

  constants[@"ADMOB_RAW_JSON"] = [[RNJSON shared] getRawJSON];

  // Precision types in ad revenue events.
  // See: https://developers.google.com/admob/ios/impression-level-ad-revenue#objective-c
#if !TARGET_OS_MACCATALYST
  constants[@"REVENUE_PRECISION_UNKNOWN"] = @(GADAdValuePrecisionUnknown);
  constants[@"REVENUE_PRECISION_ESTIMATED"] = @(GADAdValuePrecisionEstimated);
  constants[@"REVENUE_PRECISION_PUBLISHER_PROVIDED"] = @(GADAdValuePrecisionPublisherProvided);
  constants[@"REVENUE_PRECISION_PRECISE"] = @(GADAdValuePrecisionPrecise);
#endif

  return constants;
}

+ (BOOL)requiresMainQueueSetup {
  return YES;
}
@end
